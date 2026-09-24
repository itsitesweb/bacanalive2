// server/matchStore.ts
import fs from "fs";
import path from "path";
import {
  Match,
  MatchStatus,
  MatchEvent,
  MomentumPoint,
  AlertRule,
  AlertLog,
  CrawlerStatus,
  CrawlerLogItem,
  HeadToHeadMatch,
  HeadToHeadSummary,
  CustomWebhookEndpoint,
  WebhookDeliveryLog,
  OperationalRulesConfig,
  MatchRulesAnalysis,
  TacticalTipData,
  BettingTipData,
} from "../src/types";
import {
  DEFAULT_RULES_CONFIG,
  evaluateAllMatchRules,
  getMatchBigChances,
  getLastGoalMinute,
  isWithinPostGoalSuppression,
} from "./rulesEngine";
import { calculateDynamicPressureIndex } from "./pressureCalculator";
import { localConfigManager, LocalConfigFile } from "./localConfig";
import { isIgnoredLeague } from "../src/utils/leagueFilter";
import { getLeagueTier, LeagueTier } from "../src/utils/leagueTier";

export function normalizeMatchStatus(rawStatus: any, minute: number, stageCode?: any): MatchStatus {
  const stage = String(stageCode ?? '').trim();
  if (stage === '3' || stage === '100') return 'FT';
  if (stage === '12') return '1T';
  if (stage === '38') return 'HT';
  if (stage === '13') return '2T';

  const s = String(rawStatus || '').trim().toUpperCase();
  if (
    s === 'FT' ||
    s === 'FINISHED' ||
    s === 'ENCERRADO' ||
    s === 'FIM' ||
    s === 'ENDED' ||
    s === 'TERMINADO' ||
    s.includes('ENCERRADO') ||
    s.includes('TERMINADO')
  ) {
    return 'FT';
  }
  if (
    s === '1H' ||
    s === '1T' ||
    s === '1ST_HALF' ||
    s === '1ST HALF' ||
    s === '1º TEMPO' ||
    s === '1ºT' ||
    s === '1ST' ||
    s.includes('1º TEMPO') ||
    s.includes('1ST HALF') ||
    /\b1T\b/.test(s) ||
    /\b1H\b/.test(s)
  ) {
    return '1T';
  }
  if (
    s === 'HT' ||
    s === 'INT' ||
    s === '38' ||
    s === "45' HT" ||
    s === "45 HT" ||
    s === 'HALF_TIME' ||
    s === 'HALF TIME' ||
    s === 'HALF-TIME' ||
    s === 'HALFTIME' ||
    s === 'INTERVALO' ||
    s === 'INTERVAL' ||
    s === 'DESCANSO' ||
    s === 'PAUSA' ||
    s === 'PAUSE' ||
    s === 'BREAK' ||
    /\bHT\b/.test(s) ||
    s.includes('INTERVAL') ||
    s.includes('HALF TIME') ||
    s.includes('HALFTIME') ||
    s.includes('HALF-TIME') ||
    s.includes('HALF_TIME') ||
    s.includes('DESCANSO')
  ) {
    return 'HT';
  }
  if (
    s === '2H' ||
    s === '2T' ||
    s === '2ND_HALF' ||
    s === '2ND HALF' ||
    s === '2º TEMPO' ||
    s === '2ND' ||
    s.includes('2º TEMPO') ||
    s.includes('2ND HALF')
  ) {
    return '2T';
  }
  if (minute <= 45) return '1T';
  return '2T';
}

export function isExplicitFirstHalfPayload(payload: any): boolean {
  if (!payload) return false;
  const stage = String(payload.stage_code ?? payload.stage ?? payload.stageCode ?? '').trim();
  if (stage === '12') return true;

  const candidates = [
    typeof payload.status === 'string' ? payload.status : '',
    payload.status_raw,
    payload.state,
    payload.time,
    typeof payload.minute === 'string' ? payload.minute : '',
    payload.period,
    payload.stage,
    payload.stageName,
    payload.description,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const up = c.toUpperCase().trim();
    if (
      up === '1T' ||
      up === '1H' ||
      up === '1ST_HALF' ||
      up === '1ST HALF' ||
      up === '1º TEMPO' ||
      up === '1ºT' ||
      up === '1ST' ||
      up === 'FIRST_HALF' ||
      up === 'FIRST HALF' ||
      up.includes('1º TEMPO') ||
      up.includes('1ST HALF') ||
      up.includes('FIRST HALF') ||
      /\b1T\b/.test(up) ||
      /\b1H\b/.test(up)
    ) {
      return true;
    }
  }

  return false;
}

export function isHalftimePayload(payload: any, existingStatus?: string): boolean {
  if (!payload) return false;
  const stage = String(payload.stage_code ?? payload.stage ?? payload.stageCode ?? '').trim();
  if (stage === '12') return false; // NUNCA é HT se o stage oficial Flashscore for 12 (1º Tempo)
  if (stage === '38') return true;

  // Se o payload for explicitamente do 1º Tempo, nunca tratar como HT
  if (isExplicitFirstHalfPayload(payload) && stage !== '38') {
    return false;
  }

  if (payload.status && typeof payload.status === 'object') {
    if (payload.status.code === 31) return true;
    if (String(payload.status.description || '').toUpperCase().includes('HALF')) return true;
  }

  const candidates = [
    typeof payload.status === 'string' ? payload.status : '',
    payload.status_raw,
    payload.state,
    payload.time,
    typeof payload.minute === 'string' ? payload.minute : '',
    payload.period,
    payload.stage,
    payload.stageName,
    payload.description,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const up = c.toUpperCase().trim();
    if (
      up === 'HT' ||
      up === 'INT' ||
      up === '38' ||
      up === 'INTERVALO' ||
      up === 'INTERVAL' ||
      up === 'HALF TIME' ||
      up === 'HALF-TIME' ||
      up === 'HALFTIME' ||
      up === 'HALF_TIME' ||
      up === 'DESCANSO' ||
      up === 'PAUSA' ||
      up === 'PAUSE' ||
      up === 'BREAK' ||
      /\bHT\b/.test(up) ||
      up.includes('INTERVAL') ||
      up.includes('HALF TIME') ||
      up.includes('HALFTIME') ||
      up.includes('HALF-TIME') ||
      up.includes('HALF_TIME') ||
      up.includes('DESCANSO')
    ) {
      return true;
    }
  }

  return false;
}

export function isExplicitSecondHalfPayload(payload: any): boolean {
  if (!payload) return false;
  const stage = String(payload.stage_code ?? payload.stage ?? '').trim();
  if (stage === '13') return true;

  const candidates = [
    payload.status,
    payload.status_raw,
    payload.state,
    payload.time,
    payload.period,
    payload.stage,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const up = c.toUpperCase().trim();
    if (
      up === '2T' ||
      up === '2H' ||
      up === '2ND_HALF' ||
      up === '2ND HALF' ||
      up === '2º TEMPO' ||
      up === '2ND' ||
      up === 'SECOND_HALF' ||
      up === 'SECOND HALF' ||
      up.includes('2º TEMPO') ||
      up.includes('2ND HALF') ||
      up.includes('SECOND HALF')
    ) {
      return true;
    }
  }

  return false;
}

export function isExplicitFinishedPayload(payload: any): boolean {
  if (!payload) return false;
  const stage = String(payload.stage_code ?? payload.stage ?? '').trim();
  if (stage === '3' || stage === '100') return true;

  const candidates = [
    payload.status,
    payload.status_raw,
    payload.state,
    payload.time,
    payload.period,
    payload.stage,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const up = c.toUpperCase().trim();
    if (
      up === 'FT' ||
      up === 'FINISHED' ||
      up === 'ENCERRADO' ||
      up === 'FIM' ||
      up === 'ENDED' ||
      up === 'TERMINADO' ||
      up.includes('ENCERRADO') ||
      up.includes('TERMINADO')
    ) {
      return true;
    }
  }

  return false;
}

export function parseMinute(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      trimmed.toUpperCase() === 'HT' ||
      trimmed.toUpperCase() === 'INTERVALO' ||
      trimmed.toUpperCase() === '38' ||
      trimmed.toUpperCase().includes('HT') ||
      trimmed.toUpperCase().includes('INTERVAL') ||
      trimmed.toUpperCase().includes('HALF TIME') ||
      trimmed.toUpperCase().includes('HALFTIME')
    ) {
      return 45;
    }
    if (trimmed.toUpperCase() === 'FT' || trimmed.toUpperCase() === 'FIM') return 90;
    const m = trimmed.match(/(\d+)(?:\+(\d+))?/);
    if (m) {
      const base = parseInt(m[1], 10) || 0;
      const extra = m[2] ? parseInt(m[2], 10) : 0;
      if (base === 45) return 45;
      if (base === 90) return 90;
      return base + extra;
    }
  }
  return 0;
}

export function normalizeTeamName(raw: any, fallback: string): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    if (raw.name && typeof raw.name === 'string' && raw.name.trim()) return raw.name.trim();
    if (raw.shortName && typeof raw.shortName === 'string' && raw.shortName.trim()) return raw.shortName.trim();
    if (raw.nameCode && typeof raw.nameCode === 'string' && raw.nameCode.trim()) return raw.nameCode.trim();
  }
  return fallback;
}

export function normalizeStringValue(raw: any, fallback: string = ""): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number') return String(raw);
  if (raw && typeof raw === 'object') {
    if (raw.name && typeof raw.name === 'string' && raw.name.trim()) return raw.name.trim();
    if (raw.title && typeof raw.title === 'string' && raw.title.trim()) return raw.title.trim();
    if (raw.label && typeof raw.label === 'string' && raw.label.trim()) return raw.label.trim();
    if (raw.text && typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
  }
  return fallback;
}

// Helper to generate realistic Head to Head (H2H) match history and tactical trend summaries
export function generateH2HHistory(
  homeTeamName: string,
  awayTeamName: string,
  league: string | any,
  stadium?: string
): { summary: HeadToHeadSummary; matches: HeadToHeadMatch[] } {
  const safeLeague = normalizeStringValue(league, "Campeonato");
  const dates = ["2024-11-06", "2024-04-21", "2023-10-18", "2023-05-14", "2022-11-20", "2022-06-05"];
  const sampleCompetitions = [safeLeague, safeLeague, "Copa Nacional", safeLeague, safeLeague, "Supercopa"];
  
  const scorePairs = [
    { h: 2, a: 1 },
    { h: 1, a: 1 },
    { h: 3, a: 2 },
    { h: 0, a: 2 },
    { h: 2, a: 0 },
    { h: 1, a: 2 },
  ];

  const matches: HeadToHeadMatch[] = dates.map((date, idx) => {
    const isHome = idx % 2 === 0;
    const teamA = isHome ? homeTeamName : awayTeamName;
    const teamB = isHome ? awayTeamName : homeTeamName;
    const sp = scorePairs[idx % scorePairs.length];
    const scoreA = isHome ? sp.h : sp.a;
    const scoreB = isHome ? sp.a : sp.h;
    
    let winner: 'home' | 'away' | 'draw' = 'draw';
    if (scoreA > scoreB) winner = isHome ? 'home' : 'away';
    else if (scoreB > scoreA) winner = isHome ? 'away' : 'home';

    return {
      id: `h2h-${idx}-${date}`,
      date,
      competition: normalizeStringValue(sampleCompetitions[idx] || safeLeague, "Campeonato"),
      homeTeamName: teamA,
      awayTeamName: teamB,
      homeScore: scoreA,
      awayScore: scoreB,
      winner,
      totalCorners: 8 + (idx % 5),
      totalCards: 3 + (idx % 4),
      stadium: isHome ? stadium : undefined,
    };
  });

  const homeWins = matches.filter((m) => m.winner === "home").length;
  const awayWins = matches.filter((m) => m.winner === "away").length;
  const draws = matches.filter((m) => m.winner === "draw").length;
  const totalGoals = matches.reduce((acc, m) => acc + m.homeScore + m.awayScore, 0);
  const bttsCount = matches.filter((m) => m.homeScore > 0 && m.awayScore > 0).length;
  const over25Count = matches.filter((m) => m.homeScore + m.awayScore > 2.5).length;
  const totalCorners = matches.reduce((acc, m) => acc + (m.totalCorners || 9), 0);
  const totalCards = matches.reduce((acc, m) => acc + (m.totalCards || 4), 0);

  const avgGoals = Number((totalGoals / matches.length).toFixed(2));
  const bttsPct = Math.round((bttsCount / matches.length) * 100);
  const over25Pct = Math.round((over25Count / matches.length) * 100);
  const avgCorners = Number((totalCorners / matches.length).toFixed(1));
  const avgCards = Number((totalCards / matches.length).toFixed(1));

  let dominantTrend = `${homeTeamName} e ${awayTeamName} possuem histórico de alta intensidade com ${over25Pct}% de jogos com Over 2.5 gols.`;
  if (homeWins > awayWins) {
    dominantTrend = `${homeTeamName} venceu ${homeWins} dos últimos ${matches.length} confrontos diretos, mantendo média de ${avgGoals} gols por jogo.`;
  } else if (awayWins > homeWins) {
    dominantTrend = `${awayTeamName} tem retrospecto favorável como visitante em ${awayWins} vitórias recentes.`;
  }

  return {
    summary: {
      totalMatches: matches.length,
      homeWins,
      draws,
      awayWins,
      avgGoalsPerGame: avgGoals,
      bttsPercentage: bttsPct,
      over25Percentage: over25Pct,
      avgCornersPerGame: avgCorners,
      avgCardsPerGame: avgCards,
      dominantTrendInsight: dominantTrend,
    },
    matches,
  };
}

export class MatchStore {
  private matches: Map<string, Match> = new Map();
  private alertRules: AlertRule[] = [];
  private alertLogs: AlertLog[] = [];
  private dismissedMatchIds: Set<string> = new Set();
  private crawlerStatus: CrawlerStatus = {
    connected: false,
    lastHeartbeat: null,
    activeInstances: 0,
    totalPacketsReceived: 0,
    apiKeyConfigured: true,
    logs: [],
    ingestedMatchesCount: 0,
    sessionId: null,
    session_id: null,
  };
  private apiKey: string = "footstats-crawler-live-key-99";
  private customWebhooks: CustomWebhookEndpoint[] = [];
  private webhookLogs: WebhookDeliveryLog[] = [];
  private operationalConfig: OperationalRulesConfig = { ...DEFAULT_RULES_CONFIG };
  private pythonRuleTriggeredBuckets: Map<string, Set<string>> = new Map();
  private matchMinuteStagnation: Map<string, { lastMinute: number; count: number; lastSeenTime: number }> = new Map();
  private matchLastGoalTimes: Map<string, number> = new Map();
  private matchLastGoalMinutes: Map<string, number> = new Map();
  private matchCornersHistory: Map<string, Array<{ minute: number; team: 'home' | 'away'; timestamp: number }>> = new Map();
  private lastRuleTriggerByMatch: Map<string, { minute: number; timestamp: number }> = new Map();
  private crawlerStartupTime: number = 0;
  private crawlerStartupCooldownAnnounced: boolean = false;
  private uniqueCounter: number = 0;

  private generateUniqueId(prefix: string): string {
    this.uniqueCounter = (this.uniqueCounter + 1) % 10000000;
    const rand = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${Date.now()}-${this.uniqueCounter}-${rand}`;
  }

  constructor() {
    this.resetAllLiveStateAndCache("Vite Boot");
    this.loadFromLocalConfig();

    // Limpeza periódica de partidas encerradas ou sem atualização há tempo prolongado (padrão: 30 minutos)
    setInterval(() => {
      const now = Date.now();
      const pruneThresholdMs = (this.operationalConfig.crawlerConfig?.catalogPruneMinutes || this.operationalConfig.crawlerConfig?.autoPruneMinutes || 30) * 60 * 1000;
      const finishedStatuses = ["FT", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "ENDED", "POSTPONED", "CANCELLED"];

      for (const [id, match] of this.matches.entries()) {
        const lastUpdated = match.lastUpdated ? new Date(match.lastUpdated).getTime() : 0;
        const isFinished = finishedStatuses.includes(match.status?.toUpperCase() || "");
        
        // Remove apenas se finalizado há mais de 5 minutos ou inativo há mais de 30 minutos
        if ((isFinished && now - lastUpdated > 5 * 60 * 1000) || (now - lastUpdated > pruneThresholdMs)) {
          this.matches.delete(id);
          this.pythonRuleTriggeredBuckets.delete(id);
          this.matchMinuteStagnation.delete(id);
          this.matchLastGoalTimes.delete(id);
          this.matchLastGoalMinutes.delete(id);
          this.matchCornersHistory.delete(id);
          for (const key of this.lastRuleTriggerByMatch.keys()) {
            if (key.startsWith(`${id}::`)) {
              this.lastRuleTriggerByMatch.delete(key);
            }
          }
        }
      }
    }, 60 * 1000);
  }

  public purgeIgnoredAndDisabledMatches(): number {
    const crawlerConfig = this.operationalConfig?.crawlerConfig;
    const tierFilter = crawlerConfig?.tierFilter;
    const toDelete: string[] = [];

    for (const [id, m] of this.matches.entries()) {
      const league = m.league || "";
      const country = m.country || m.leagueCountry || "";
      const home = m.homeTeam?.name || "";
      const away = m.awayTeam?.name || "";

      if (isIgnoredLeague(league, country, home, away, crawlerConfig)) {
        toDelete.push(id);
        continue;
      }

      if (tierFilter) {
        const tier = m.tier || getLeagueTier(league, country);
        let shouldRemove = false;
        if (tier === "Tier 1" && ((tierFilter as any).enableTier1 === false || (tierFilter.enableTier05PremiumLeagues === false && tierFilter.enableTier12Window === false))) {
          shouldRemove = true;
        } else if (tier === "Tier 2" && ((tierFilter as any).enableTier2 === false || (tierFilter.enableTier12Window === false && tierFilter.enableTier05PremiumLeagues === false))) {
          shouldRemove = true;
        } else if (tier === "Tier 3" && ((tierFilter as any).enableTier3 === false || tierFilter.enableTier3Rotation === false)) {
          shouldRemove = true;
        } else if (tier === "Tier 4" && ((tierFilter as any).enableTier4 === false || tierFilter.enableTier3Rotation === false)) {
          shouldRemove = true;
        }
        if (shouldRemove) {
          toDelete.push(id);
        }
      }
    }

    if (toDelete.length > 0) {
      for (const id of toDelete) {
        this.matches.delete(id);
        this.pythonRuleTriggeredBuckets.delete(id);
        this.matchMinuteStagnation.delete(id);
        this.matchLastGoalTimes.delete(id);
        this.matchLastGoalMinutes.delete(id);
        this.matchCornersHistory.delete(id);
      }
      this.addCrawlerLog("info", `🧹 Faxina automática: ${toDelete.length} partida(s) de Tiers/Categorias desativadas foram expurgadas da grade.`);
    }
    return toDelete.length;
  }

  public loadFromLocalConfig(): void {
    const localCfg = localConfigManager.getConfig();
    this.operationalConfig = {
      ...DEFAULT_RULES_CONFIG,
      ...(localCfg.operationalConfig || {}),
    };
    // Sincronização e unificação do Parâmetro Central do Radar (Fonte Única: Regra 3:1)
    const centralRatio = Math.max(1.0, this.operationalConfig.chancesPerGoalRatio || 3.0);
    this.operationalConfig.chancesPerGoalRatio = centralRatio;
    if (this.operationalConfig.tripleDebtConfig) {
      this.operationalConfig.tripleDebtConfig.chancesPerGoalRatio = centralRatio;
    }
    if (this.operationalConfig.goalDebtClassicConfig) {
      this.operationalConfig.goalDebtClassicConfig.chancesPerGoalRatio = centralRatio;
    }

    // Unificação Geral do Cooldown Pós-Gol (Fonte Única de Configuração: 3 minutos / 180s)
    const unifiedCooldown = Math.max(1, this.operationalConfig.postGoalCooldownMinutes ?? 3);
    this.operationalConfig.postGoalCooldownMinutes = unifiedCooldown;
    if (this.operationalConfig.superBackDominanteConfig) {
      this.operationalConfig.superBackDominanteConfig.postGoalCooldownMinutes = unifiedCooldown;
    }
    if (this.operationalConfig.goalDebtClassicConfig) {
      this.operationalConfig.goalDebtClassicConfig.postGoalCooldownMinutes = unifiedCooldown;
      this.operationalConfig.goalDebtClassicConfig.cooldownSecondsAfterGoal = unifiedCooldown * 60;
    }

    this.alertRules = Array.isArray(localCfg.alertRules) ? [...localCfg.alertRules] : [];

    // Garantir sincronização da regra de Super Pressão com os parâmetros da regra e operacionais
    const trendRuleIdx = this.alertRules.findIndex(
      (r) =>
        r.id === "rule-trend-super-pressure" ||
        r.id === "python-trend-alert" ||
        r.name.toLowerCase().includes("trend alert") ||
        r.name.toLowerCase().includes("super pressão")
    );
    if (trendRuleIdx >= 0) {
      const rule = this.alertRules[trendRuleIdx];
      const pressCond = rule.conditions?.find((c: any) =>
        c.metric === "pressureTrendWindow" || c.metric === "avgPressure" || c.metric === "pressure"
      );
      const minCond = rule.conditions?.find((c: any) => c.metric === "minute");

      // Priorizar os critérios definidos na própria regra 'Trend Alert: Super Pressão Contínua'
      const minAvg = pressCond && !isNaN(Number(pressCond.value))
        ? Number(pressCond.value)
        : (this.operationalConfig.superPressureConfig?.minAvgPressure ?? this.operationalConfig.trendAlertMinAvgPressure ?? 68);

      const winMin = pressCond && (pressCond as any).windowMinutes !== undefined && !isNaN(Number((pressCond as any).windowMinutes))
        ? Number((pressCond as any).windowMinutes)
        : (this.operationalConfig.superPressureConfig?.windowMinutes ?? this.operationalConfig.trendAlertWindowMinutes ?? 15);

      const minMin = minCond && !isNaN(Number(minCond.value))
        ? Number(minCond.value)
        : (this.operationalConfig.superPressureConfig?.minMinute ?? this.operationalConfig.trendAlertMinMinute ?? 15);

      const consPct = this.operationalConfig.superPressureConfig?.minConsistencyPct ?? this.operationalConfig.trendAlertMinConsistencyPct ?? 65;

      // Manter a operationalConfig 100% sincronizada com a regra ativa
      this.operationalConfig.trendAlertMinAvgPressure = minAvg;
      this.operationalConfig.trendAlertWindowMinutes = winMin;
      this.operationalConfig.trendAlertMinMinute = minMin;
      this.operationalConfig.enableTrendAlert = rule.enabled !== false;
      this.operationalConfig.superPressureConfig = {
        ...(this.operationalConfig.superPressureConfig || DEFAULT_RULES_CONFIG.superPressureConfig!),
        enabled: rule.enabled !== false,
        minAvgPressure: minAvg,
        windowMinutes: winMin,
        minMinute: minMin,
        minConsistencyPct: consPct,
      };

      this.alertRules[trendRuleIdx] = {
        ...rule,
        enabled: rule.enabled !== false,
        conditions: [
          { metric: "pressureTrendWindow", operator: ">=", value: minAvg, windowMinutes: winMin },
          { metric: "minute", operator: ">=", value: minMin },
        ],
        description: `Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=${minAvg}% de média com consistência >=${consPct}%) no histórico do momentum em ${winMin}m.`,
      };
    }

    this.customWebhooks = Array.isArray(localCfg.customWebhooks) ? [...localCfg.customWebhooks] : [];
    this.apiKey = localCfg.userProfile?.crawlerToken || "footstats-crawler-live-key-99";
    this.purgeIgnoredAndDisabledMatches();
  }

  public applyImportedConfig(config: LocalConfigFile): void {
    this.operationalConfig = {
      ...DEFAULT_RULES_CONFIG,
      ...(config.operationalConfig || {}),
    };
    // Sincronização e unificação do Parâmetro Central do Radar (Fonte Única: Regra 3:1)
    const centralRatio = Math.max(1.0, this.operationalConfig.chancesPerGoalRatio || 3.0);
    this.operationalConfig.chancesPerGoalRatio = centralRatio;
    if (this.operationalConfig.tripleDebtConfig) {
      this.operationalConfig.tripleDebtConfig.chancesPerGoalRatio = centralRatio;
    }
    if (this.operationalConfig.goalDebtClassicConfig) {
      this.operationalConfig.goalDebtClassicConfig.chancesPerGoalRatio = centralRatio;
    }

    // Unificação Geral do Cooldown Pós-Gol (Fonte Única de Configuração: 3 minutos / 180s)
    const unifiedCooldown = Math.max(1, this.operationalConfig.postGoalCooldownMinutes ?? 3);
    this.operationalConfig.postGoalCooldownMinutes = unifiedCooldown;
    if (this.operationalConfig.superBackDominanteConfig) {
      this.operationalConfig.superBackDominanteConfig.postGoalCooldownMinutes = unifiedCooldown;
    }
    if (this.operationalConfig.goalDebtClassicConfig) {
      this.operationalConfig.goalDebtClassicConfig.postGoalCooldownMinutes = unifiedCooldown;
      this.operationalConfig.goalDebtClassicConfig.cooldownSecondsAfterGoal = unifiedCooldown * 60;
    }

    this.alertRules = Array.isArray(config.alertRules) ? [...config.alertRules] : [];
    this.customWebhooks = Array.isArray(config.customWebhooks) ? [...config.customWebhooks] : [];
    this.apiKey = config.userProfile?.crawlerToken || this.apiKey;
    this.purgeIgnoredAndDisabledMatches();
    this.addCrawlerLog("info", "Configurações importadas e aplicadas no terminal com sucesso.");
  }





  private seedDefaultRules() {
    this.alertRules = [
      {
        id: "rule-trend-super-pressure",
        name: "📈 Trend Alert: Super Pressão Contínua",
        description: "Alerta unificado quando qualquer equipe (mandante ou visitante) sustenta blitz e super pressão contínua (>=68% de média com consistência >=65%) no histórico do momentum.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "pressureTrendWindow", operator: ">=", value: 65, windowMinutes: 15 },
          { metric: "minute", operator: ">=", value: 15 },
        ],
        severity: "opportunity",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "📈 TREND ALERT: {dominantTeam} mantém super pressão contínua ({dominantPressure}% em {pressureWindow}m) aos {minute}'! Probabilidade elevada de gol (Placar: {score}).",
        triggerCount: 3,
        minFrequencyMinutes: 15,
        lastTriggered: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        id: "rule-diagnostico-classico",
        name: "⚡ Diagnóstico Clássico: Dívida de Gols & Divergência de xG",
        description: "Alerta unificado de dívida de gols e assimetria estatística. Detecta quando o volume acumulado de chances claras ou xG supera o placar real (dívida de gols para Over), ou quando há ampla divergência de xG entre as equipes (>1.0) com atraso de conversão no placar.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "debtGoals", operator: ">=", value: 1 },
          { metric: "minute", operator: ">=", value: 20 },
          { metric: "totalXg", operator: ">=", value: 1.2 },
        ],
        severity: "opportunity",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "⚡ DIAGNÓSTICO CLÁSSICO: Dívida de {debtGoals} gol(s) aos {minute}'! {dominantTeam} ({higherXg} xG) x ({lowerXg} xG) {underdogTeam} (dif. +{xgDiff}, total {totalXg} xG) para placar {score}. Probabilidade elevada de GOL/OVER.",
        triggerCount: 4,
        minFrequencyMinutes: 15,
        lastTriggered: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
      },
      {
        id: "rule-trinca-de-dividas",
        name: "💎 Trinca de Dívidas: CC + xG + xGOT Confluentes",
        description: "Alerta transferido do Terminal Python (Regra 2). Confluência matemática perfeita: Chances Claras atrasadas, saldo de xG não convertido e xGOT no alvo acumulado acima do placar real.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "tripleDebtFormed", operator: "==", value: 1 },
          { metric: "minute", operator: ">=", value: 15 },
        ],
        severity: "critical",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "💎 TRINCA DE DÍVIDAS ATIVA ({tripleDebtScope}) aos {minute}'! Time devedor: {debtorTeam}. Placar: {score}. CC no escopo: {ccInScope}, xG: {xgInScope}, xGOT: {xgotInScope}. Altíssima probabilidade de gol!",
        triggerCount: 0,
        minFrequencyMinutes: 15,
      },
      {
        id: "rule-super-back-dominante",
        name: "🎯 Super Back Dominante: Reação Confirmada & Pressão Vendável",
        description: "Regra Unificada de Alta Precisão (Fusão das Regras 3 e 4). Conflui superioridade estatística e ineficiência do dominante (xG >= 0.95, CC >= 2, zebra inofensiva) com reação viva em tempo real (pressão >= 65% ou ataques perigosos recentes >= 6) em cenário de empate ou desvantagem por 1 gol.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "superBackDominanteQualified", operator: "==", value: 1 },
          { metric: "minute", operator: ">=", value: 20 },
          { metric: "minute", operator: "<=", value: 82 },
        ],
        severity: "opportunity",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "🎯 SUPER BACK DOMINANTE [{sbdTier}]: Back {dominantTeam} aos {minute}' (Placar: {score}, {sbdSituation}). Pressão: {dominantPressure}% ({livePressureStatus}) | xG: {dominantXg} vs {opponentXg} | CC: {dominantCc}. Prob: {sbdProb}% (Odd Justa: {fairOdd} | Min: {minRecommendedOdd}). Tese: {tese}",
        triggerCount: 0,
        minFrequencyMinutes: 15,
      },
      {
        id: "rule-v12-over-back",
        name: "📈 V12 Over & Back Alavancado (Regras Tradicionais V1.2)",
        description: "Alerta transferido do Terminal Python (Regra 5). Sinais analíticos de alta conversão: Over Premium (36-50'), Over Bilateral Forte (36-65'), Over Gol Limite (76-83') e Back T1 Main com base em taxa de Chances Claras (min/CC) e xGOT.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "v12OverBackQualified", operator: "==", value: 1 },
          { metric: "minute", operator: ">=", value: 35 },
          { metric: "minute", operator: "<=", value: 88 },
        ],
        severity: "opportunity",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "📈 SINAL V1.2 ATIVO: [{v12RuleName}] aos {minute}'! Mercado: {v12Market} (Tier: {v12Tier}). {v12Trace}. Placar: {score}.",
        triggerCount: 0,
        minFrequencyMinutes: 15,
      },
      {
        id: "rule-ambas-marcam-btts",
        name: "⚽ Ambas Marcam (BTTS: Sim) - Ritmo Bilateral",
        description: "Alerta transferido do Terminal Python e 100% editável. Confluência ofensiva bilateral: volume mútuo nos últimos 10 minutos (ataques perigosos, chutes e pressão), xG bilateral consistente e assimetria para ambos os times marcarem gol.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "ambasMarcamQualified", operator: "==", value: 1 },
          { metric: "minute", operator: ">=", value: 18 },
          { metric: "minute", operator: "<=", value: 86 },
        ],
        severity: "opportunity",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "⚽ AMBAS MARCAM (BTTS: SIM) aos {minute}'! {teamHome} x {teamAway} (Placar: {score}). {bttsReasoning}. Probabilidade estimada: {bttsProb}%. Odd Justa: @{bttsFairOdd} | Odd Mínima: @{bttsMinOdd}.",
        triggerCount: 0,
        minFrequencyMinutes: 15,
      },
      {
        id: "rule-gol-iminente-surto",
        name: "🚨 Gol Iminente: Surto Ofensivo (5m)",
        description: "Alerta de alta agressividade com janela fixa de 5 minutos. Detecta pressão contínua e blitz ofensiva imediata, com proteção de reset por gol e intervalo.",
        matchId: "all",
        enabled: true,
        logic: "AND",
        conditions: [
          { metric: "imminentGoalQualified", operator: "==", value: 1 },
          { metric: "minute", operator: ">=", value: 5 },
        ],
        severity: "critical",
        soundEnabled: true,
        browserNotification: true,
        messageTemplate: "🚨 GOL IMINENTE: Blitz ofensiva de 5m aos {minute}'! {teamHome} {score} {teamAway}. Pressão sufocante e alta agressividade recente. Entrada recomendada a favor do dominante!",
        triggerCount: 0,
      },
    ];

    this.alertLogs = [];
  }



  // --- Priorização de Alerta de Gol e Reset de Janelas ---
  private processGoalEvent(
    existing: Match,
    prevHomeScore: number,
    prevAwayScore: number,
    newHomeScore: number,
    newAwayScore: number,
    effectiveMinute: number,
    payloadEvents?: any[]
  ) {
    this.matchLastGoalTimes.set(existing.id, Date.now());

    if (!this.pythonRuleTriggeredBuckets.has(existing.id)) {
      this.pythonRuleTriggeredBuckets.set(existing.id, new Set<string>());
    }
    const matchBuckets = this.pythonRuleTriggeredBuckets.get(existing.id)!;
    const goalBucketKey = `goal_event_${existing.id}_${newHomeScore}_${newAwayScore}`;

    if (!matchBuckets.has(goalBucketKey)) {
      matchBuckets.add(goalBucketKey);
      const isHomeGoal = newHomeScore > prevHomeScore;
      const scoringTeam = isHomeGoal ? existing.homeTeam.name : existing.awayTeam.name;

      // Localizar o evento do gol real para obter o minuto exato e o autor
      let realGoalMinuteNum: number = effectiveMinute;
      let realGoalMinuteStr: string = `${effectiveMinute}'`;
      let authorText = "";

      const eventsToInspect = (payloadEvents && Array.isArray(payloadEvents)) ? payloadEvents : existing.events;
      if (eventsToInspect && Array.isArray(eventsToInspect)) {
        const goalEvents = [...eventsToInspect].reverse().filter(
          (ev) =>
            (ev.type === "goal" || ev.type === "penalty_scored") &&
            ((isHomeGoal && ev.team === "home") || (!isHomeGoal && ev.team === "away"))
        );
        const lastGoalEv = goalEvents[0];
        if (lastGoalEv) {
          if (lastGoalEv.minute !== undefined && lastGoalEv.minute !== null) {
            const baseMin = Number(lastGoalEv.minute);
            realGoalMinuteNum = isNaN(baseMin) ? effectiveMinute : baseMin;
            realGoalMinuteStr = lastGoalEv.extraMinute
              ? `${lastGoalEv.minute}+${lastGoalEv.extraMinute}'`
              : `${lastGoalEv.minute}'`;
          }
          if (lastGoalEv.player) {
            authorText = lastGoalEv.player + (lastGoalEv.assistPlayer ? ` (Assistência: ${lastGoalEv.assistPlayer})` : "");
          }
        }
      }

      // Registrar o minuto exato do gol e timestamp na partida
      existing.lastGoalMinute = realGoalMinuteNum;
      existing.lastGoalTimestamp = Date.now();
      this.matchLastGoalMinutes.set(existing.id, realGoalMinuteNum);

      // 1. PRIORIZAR ALERTA DE GOL: Envia e insere o alerta de gol imediatamente no topo do feed
      // Se a visualização de Gols estiver marcada como Ocultos (enableGoalAlerts === false ou showGoalAlerts === false),
      // NÃO fazer a ingestão do alerta de gol no banco e feed.
      const areGoalAlertsEnabled = this.operationalConfig.enableGoalAlerts !== false && this.operationalConfig.showGoalAlerts !== false;

      if (!areGoalAlertsEnabled) {
        this.addCrawlerLog(
          "info",
          `⚽ GOL DETECTADO: [${existing.league}] ${existing.homeTeam.name} ${newHomeScore} x ${newAwayScore} ${existing.awayTeam.name} (${realGoalMinuteStr}) - Ingestão de alerta suprimida (Gols marcados como Ocultos)`
        );
      } else {
        const singleLineMessage = `⚽ GOL! ${scoringTeam} aos ${realGoalMinuteStr} • Placar anterior: ${prevHomeScore} - ${prevAwayScore} ➔ Novo: ${newHomeScore} - ${newAwayScore} (${existing.homeTeam.name} x ${existing.awayTeam.name})${authorText ? ` • Autor: ${authorText}` : ""}`;

        const alertLog: AlertLog = {
          id: this.generateUniqueId("goal"),
          ruleId: "live-goal-delta",
          ruleName: `⚽ GOL! ${scoringTeam} (${realGoalMinuteStr})`,
          matchId: existing.id,
          matchTitle: `${existing.homeTeam.name} ${newHomeScore} x ${newAwayScore} ${existing.awayTeam.name}`,
          league: existing.league,
          country: existing.country || existing.leagueCountry || "",
          leagueCountry: existing.leagueCountry || existing.country || "",
          minute: realGoalMinuteNum,
          score: `${newHomeScore} - ${newAwayScore}`,
          severity: "critical",
          message: singleLineMessage,
          timestamp: new Date().toISOString(),
          read: false,
          category: "goal_alert",
        };
        this.pushAlertLog(alertLog, existing);
        this.addCrawlerLog("success", `⚽ GOL DETECTADO: [${existing.league}] ${existing.homeTeam.name} ${newHomeScore} x ${newAwayScore} ${existing.awayTeam.name} (${realGoalMinuteStr})`);
      }

      // 2. ZERAR OS CONTADORES DE TEMPO DAS JANELAS DOS ALERTAS:
      // Remove buckets de disparo anteriores baseados em janelas de tempo (trend alert, imminent goal, custom rules)
      // para que a partida perca a validade da janela anterior ao gol e exija uma nova janela completa pós-gol
      for (const key of Array.from(matchBuckets)) {
        if (
          key.startsWith("trend_") ||
          key.startsWith("imm_") ||
          key.startsWith("rule_") ||
          key.startsWith("c31_") ||
          key.startsWith("fc_") ||
          key.startsWith("am_")
        ) {
          matchBuckets.delete(key);
        }
      }
    }
  }

  // --- Alert Helper ---
  private pushAlertLog(log: AlertLog, match?: Match) {
    if (log.matchId && this.dismissedMatchIds.has(log.matchId)) {
      return;
    }
    // Se a visualização de Gols estiver marcada como Ocultos, não fazer ingestão de alertas de gol
    const isGoalAlert = log.ruleId === "live-goal-delta" || log.category === "goal_alert" || log.category === "goal";
    if (isGoalAlert && (this.operationalConfig.enableGoalAlerts === false || this.operationalConfig.showGoalAlerts === false)) {
      return;
    }
    if (match) {
      if (!log.league) log.league = match.league;
      if (!log.country) log.country = match.country || match.leagueCountry || "";
      if (!log.leagueCountry) log.leagueCountry = match.leagueCountry || match.country || "";
      if (!log.url) log.url = match.url;
      if (!log.status && match.status) log.status = match.status;
      if (log.extraMinute === undefined && (match as any).extraMinute !== undefined) {
        log.extraMinute = (match as any).extraMinute;
      }
    }
    this.alertLogs.push(log);
    if (this.alertLogs.length > 250) this.alertLogs.shift();
  }

  // --- Alert Evaluation Engine ---
  private evaluateAlertsForMatch(match: Match) {
    const rawStatus = (match.status || "").toUpperCase();

    // Do not generate alerts for finished matches or matches at 90'+
    const finishedStatuses = ["FT", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "ENDED", "POSTPONED", "CANCELLED"];
    if (finishedStatuses.includes(rawStatus) || match.minute >= 90) {
      return;
    }

    // Do not generate or repeat alerts if the match is in half-time / interval
    const isHalfTime =
      rawStatus === "HT" ||
      rawStatus === "INT" ||
      rawStatus === "38" ||
      rawStatus === "HALF_TIME" ||
      rawStatus === "HALF TIME" ||
      rawStatus === "HALF-TIME" ||
      rawStatus === "HALFTIME" ||
      rawStatus === "INTERVALO" ||
      rawStatus === "INTERVAL" ||
      rawStatus === "DESCANSO" ||
      rawStatus === "PAUSA" ||
      rawStatus === "BREAK" ||
      rawStatus.includes("HT") ||
      rawStatus.includes("INTERVAL") ||
      rawStatus.includes("HALF TIME") ||
      rawStatus.includes("HALFTIME") ||
      rawStatus.includes("HALF-TIME") ||
      rawStatus.includes("HALF_TIME") ||
      rawStatus.includes("DESCANSO") ||
      rawStatus.includes("PAUSA") ||
      /\bHT\b/.test(rawStatus) ||
      /\bINT\b/.test(rawStatus) ||
      match.status === "HT";
    if (isHalfTime) {
      return;
    }

    // Enforce "Janela de Minutos para Alertas"
    const minMinute = Number(this.operationalConfig.minMinuteAlert ?? 0);
    const maxMinute = Number(this.operationalConfig.maxMinuteAlert ?? 90);
    if (match.minute < minMinute || match.minute > maxMinute) {
      return;
    }

    // 0. Cooldown Geral na Inicialização do Crawler (3 minutos / 180s)
    if (this.isCrawlerInStartupCooldown()) {
      return;
    }

    // Cooldown Geral Pós-Gol (3 minutos / 180s)
    const postGoalCooldownMinutes = this.operationalConfig.postGoalCooldownMinutes ?? 3;
    const postGoalCooldownSeconds = postGoalCooldownMinutes * 60; // 180s
    const lastGoalTime = this.matchLastGoalTimes.get(match.id) || match.lastGoalTimestamp || 0;
    const isWithinTimeCooldown = lastGoalTime > 0 && (Date.now() - lastGoalTime < postGoalCooldownSeconds * 1000);
    const lastGoalMin = this.matchLastGoalMinutes.get(match.id) ?? getLastGoalMinute(match);
    const isWithinMinuteCooldown = lastGoalMin !== null && lastGoalMin !== undefined && (match.minute - lastGoalMin >= 0) && (match.minute - lastGoalMin < postGoalCooldownMinutes);
    const isPostGoalCooldownActive = isWithinTimeCooldown || isWithinMinuteCooldown || isWithinPostGoalSuppression(match, postGoalCooldownMinutes);

    if (!this.pythonRuleTriggeredBuckets.has(match.id)) {
      this.pythonRuleTriggeredBuckets.set(match.id, new Set<string>());
    }
    const matchBuckets = this.pythonRuleTriggeredBuckets.get(match.id)!;

    // 1. Standard UI Rule evaluation
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      if (rule.matchId !== "all" && rule.matchId !== match.id) continue;

      // Has Red Card condition
      const hasRedCardMetric = rule.conditions.some((c) => c.metric === "redCardHome" || c.metric === "redCardAway");

      // Bloqueio de regras táticas se a partida estiver sob Cooldown Geral Pós-Gol de 3 minutos
      if (isPostGoalCooldownActive && !hasRedCardMetric) {
        continue;
      }

      // Cooldown de frequência entre disparos da mesma regra na mesma partida
      const cooldownMinutes = typeof rule.minFrequencyMinutes === "number" && rule.minFrequencyMinutes > 0
        ? rule.minFrequencyMinutes
        : 15;
      const matchRuleCooldownKey = `${match.id}::${rule.id}`;
      const lastTrigger = this.lastRuleTriggerByMatch.get(matchRuleCooldownKey);
      if (lastTrigger) {
        const elapsedGameMinutes = match.minute - lastTrigger.minute;
        if (elapsedGameMinutes >= 0 && elapsedGameMinutes < cooldownMinutes) {
          continue;
        }
      }

      let ruleKey: string;
      if (hasRedCardMetric) {
        // Red card alert is bucketed specifically by match red cards count so it NEVER fires repeatedly unless red card count changes
        ruleKey = `rule_rc_${rule.id}_h${match.stats.redCards.home}_a${match.stats.redCards.away}`;
      } else {
        // Other rules are bucketed by 15-min tactical window and current score
        ruleKey = `rule_${rule.id}_m${Math.floor(match.minute / 15)}_s${match.score.home}_${match.score.away}`;
      }

      if (matchBuckets.has(ruleKey)) {
        continue;
      }

      const conditionResults = rule.conditions.map((cond) => {
        let actualVal = 0;
        switch (cond.metric) {
          case "minute":
            actualVal = match.minute;
            break;
          case "pressureHome":
            actualVal = match.stats.pressureIndex.home;
            break;
          case "pressureHomeAvgWindow": {
            const curMin = Math.max(1, match.minute || 1);
            const windowMin = cond.windowMinutes && cond.windowMinutes > 0 ? cond.windowMinutes : 5;
            const isSecondHalf = curMin >= 46;
            const halfStartMin = isSecondHalf ? 46 : 1;
            const lastGoalMin = getLastGoalMinute(match);
            if (lastGoalMin !== null && curMin >= lastGoalMin && (curMin - lastGoalMin) < windowMin) {
              actualVal = 0;
              break;
            }
            if (isSecondHalf && (curMin - 45) < windowMin) {
              actualVal = 0;
              break;
            }
            const minCutoff = lastGoalMin !== null
              ? Math.max(lastGoalMin + 1, halfStartMin, curMin - windowMin)
              : Math.max(halfStartMin, curMin - windowMin);
            const points = (match.momentumTimeline || []).filter(
              (pt) => pt.minute >= minCutoff && pt.minute <= curMin
            );
            if (points.length > 0) {
              let sumHome = 0;
              let sumAway = 0;
              let totalWeight = 0;
              points.forEach((pt, idx) => {
                const weight = Math.pow(1.18, idx);
                const hPress = pt.homePressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 + pt.diff / 2)) : 50);
                const aPress = pt.awayPressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 - pt.diff / 2)) : 50);
                const dangerBonusH = (pt.homeDangerousAttack ? 16 : 0) + (pt.homeShot ? 28 : 0);
                const dangerBonusA = (pt.awayDangerousAttack ? 16 : 0) + (pt.awayShot ? 28 : 0);
                sumHome += (hPress + dangerBonusH) * weight;
                sumAway += (aPress + dangerBonusA) * weight;
                totalWeight += weight;
              });
              const avgH = sumHome / (totalWeight || 1);
              const avgA = sumAway / (totalWeight || 1);
              const tot = avgH + avgA;
              actualVal = tot > 0 ? Math.round((avgH / tot) * 100) : (match.stats.pressureIndex?.home ?? 50);
            } else {
              const stats = match.stats;
              const dang10H = Number(stats.dangerousAttacksLast10?.home || 0);
              const dang10A = Number(stats.dangerousAttacksLast10?.away || 0);
              const sotH = Number(stats.shotsOnTarget?.home || 0);
              const sotA = Number(stats.shotsOnTarget?.away || 0);
              const xgH = Number(stats.xG?.home || 0);
              const xgA = Number(stats.xG?.away || 0);
              const possH = Number(stats.possession?.home ?? 50);
              const possA = Number(stats.possession?.away ?? 50);

              const scoreH = (dang10H * 4.5) + (sotH * 4.0) + (xgH * 8.0) + (possH * 0.3);
              const scoreA = (dang10A * 4.5) + (sotA * 4.0) + (xgA * 8.0) + (possA * 0.3);
              const tot = scoreH + scoreA;
              actualVal = tot > 0 ? Math.round((scoreH / tot) * 100) : (match.stats.pressureIndex?.home ?? 50);
            }
            break;
          }
          case "pressureAwayAvgWindow": {
            const curMin = Math.max(1, match.minute || 1);
            const windowMin = cond.windowMinutes && cond.windowMinutes > 0 ? cond.windowMinutes : 15;
            const isSecondHalf = curMin >= 46;
            const halfStartMin = isSecondHalf ? 46 : 1;
            const lastGoalMin = getLastGoalMinute(match);
            if (lastGoalMin !== null && curMin >= lastGoalMin && (curMin - lastGoalMin) < windowMin) {
              actualVal = 0;
              break;
            }
            if (isSecondHalf && (curMin - 45) < windowMin) {
              actualVal = 0;
              break;
            }
            const minCutoff = lastGoalMin !== null
              ? Math.max(lastGoalMin + 1, halfStartMin, curMin - windowMin)
              : Math.max(halfStartMin, curMin - windowMin);
            const points = (match.momentumTimeline || []).filter(
              (pt) => pt.minute >= minCutoff && pt.minute <= curMin
            );
            if (points.length > 0) {
              let sumHome = 0;
              let sumAway = 0;
              let totalWeight = 0;
              points.forEach((pt, idx) => {
                const weight = Math.pow(1.18, idx);
                const hPress = pt.homePressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 + pt.diff / 2)) : 50);
                const aPress = pt.awayPressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 - pt.diff / 2)) : 50);
                const dangerBonusH = (pt.homeDangerousAttack ? 16 : 0) + (pt.homeShot ? 28 : 0);
                const dangerBonusA = (pt.awayDangerousAttack ? 16 : 0) + (pt.awayShot ? 28 : 0);
                sumHome += (hPress + dangerBonusH) * weight;
                sumAway += (aPress + dangerBonusA) * weight;
                totalWeight += weight;
              });
              const avgH = sumHome / (totalWeight || 1);
              const avgA = sumAway / (totalWeight || 1);
              const tot = avgH + avgA;
              actualVal = tot > 0 ? Math.round((avgA / tot) * 100) : (match.stats.pressureIndex?.away ?? 50);
            } else {
              const stats = match.stats;
              const dang10H = Number(stats.dangerousAttacksLast10?.home || 0);
              const dang10A = Number(stats.dangerousAttacksLast10?.away || 0);
              const sotH = Number(stats.shotsOnTarget?.home || 0);
              const sotA = Number(stats.shotsOnTarget?.away || 0);
              const xgH = Number(stats.xG?.home || 0);
              const xgA = Number(stats.xG?.away || 0);
              const possH = Number(stats.possession?.home ?? 50);
              const possA = Number(stats.possession?.away ?? 50);

              const scoreH = (dang10H * 4.5) + (sotH * 4.0) + (xgH * 8.0) + (possH * 0.3);
              const scoreA = (dang10A * 4.5) + (sotA * 4.0) + (xgA * 8.0) + (possA * 0.3);
              const tot = scoreH + scoreA;
              actualVal = tot > 0 ? Math.round((scoreA / tot) * 100) : (match.stats.pressureIndex?.away ?? 50);
            }
            break;
          }
          case "pressureTrendWindow": {
            const curMin = Math.max(1, match.minute || 1);
            const windowMin = cond.windowMinutes && cond.windowMinutes > 0
              ? cond.windowMinutes
              : (this.operationalConfig.superPressureConfig?.windowMinutes || this.operationalConfig.trendAlertWindowMinutes || 15);
            const isSecondHalf = curMin >= 46;
            const halfStartMin = isSecondHalf ? 46 : 1;
            const lastGoalMin = getLastGoalMinute(match);
            if (lastGoalMin !== null && curMin >= lastGoalMin && (curMin - lastGoalMin) < windowMin) {
              actualVal = 0;
              break;
            }
            if (isSecondHalf && (curMin - 45) < windowMin) {
              actualVal = 0;
              break;
            }
            const minCutoff = lastGoalMin !== null
              ? Math.max(lastGoalMin + 1, halfStartMin, curMin - windowMin)
              : Math.max(halfStartMin, curMin - windowMin);
            const points = (match.momentumTimeline || []).filter(
              (pt) => pt.minute >= minCutoff && pt.minute <= curMin
            );
            if (points.length > 0) {
              const ptThreshold = this.operationalConfig.superPressureConfig?.pointThreshold || this.operationalConfig.trendAlertPointThreshold || 60;
              const highPointsH = points.filter(p => (p.homePressure ?? 50) >= ptThreshold).length;
              const highPointsA = points.filter(p => (p.awayPressure ?? 50) >= ptThreshold).length;
              const maxHigh = Math.max(highPointsH, highPointsA);
              actualVal = Math.round((maxHigh / points.length) * 100);
            } else {
              actualVal = Math.max(match.stats.pressureIndex.home, match.stats.pressureIndex.away);
            }
            break;
          }
          case "pressureAway":
            actualVal = match.stats.pressureIndex.away;
            break;
          case "pressureDiff":
            actualVal = Math.abs(match.stats.pressureIndex.home - match.stats.pressureIndex.away);
            break;
          case "xgDiff":
            actualVal = Math.abs(match.stats.xG.home - match.stats.xG.away);
            break;
          case "totalXg":
            actualVal = match.stats.xG.home + match.stats.xG.away;
            break;
          case "dangerousAttacksLast10Home":
            actualVal = match.stats.dangerousAttacksLast10.home;
            break;
          case "dangerousAttacksLast10Away":
            actualVal = match.stats.dangerousAttacksLast10.away;
            break;
          case "chancesVariation5m": {
            const curMin = Math.max(1, match.minute || 1);
            const lastGoalMin = getLastGoalMinute(match);
            if (lastGoalMin !== null && curMin >= lastGoalMin && (curMin - lastGoalMin) < 5) {
              actualVal = 0;
              break;
            }
            const minLimit5 = lastGoalMin !== null ? Math.max(lastGoalMin, curMin - 5) : Math.max(1, curMin - 5);
            const last5Points = (match.momentumTimeline || []).filter(
              (pt) => pt.minute > minLimit5 && pt.minute <= curMin
            );
            const prev5Points = (match.momentumTimeline || []).filter(
              (pt) => pt.minute > Math.max(1, curMin - 10) && pt.minute <= Math.max(1, curMin - 5)
            );
            let hLast = last5Points.filter((pt) => pt.homeShot).length;
            let aLast = last5Points.filter((pt) => pt.awayShot).length;
            let hPrev = prev5Points.filter((pt) => pt.homeShot).length;
            let aPrev = prev5Points.filter((pt) => pt.awayShot).length;
            if (hLast === 0 && aLast === 0) {
              hLast = last5Points.filter((pt) => pt.homeDangerousAttack).length;
              aLast = last5Points.filter((pt) => pt.awayDangerousAttack).length;
              hPrev = prev5Points.filter((pt) => pt.homeDangerousAttack).length;
              aPrev = prev5Points.filter((pt) => pt.awayDangerousAttack).length;
            }
            const totLast = hLast + aLast;
            const totPrev = hPrev + aPrev;
            if (totPrev > 0) {
              actualVal = Math.round(((totLast - totPrev) / totPrev) * 100);
            } else if (totLast > 0) {
              actualVal = 100;
            } else {
              const totalBc = (match.stats.bigChances?.home || 0) + (match.stats.bigChances?.away || 0) || Math.floor((match.stats.shotsOnTarget.home + match.stats.shotsOnTarget.away) / 2);
              if (totalBc > 0) {
                const avg5 = (totalBc / curMin) * 5;
                const recPress = (match.stats.pressureIndex.home + match.stats.pressureIndex.away) / 2;
                const estLast = +(avg5 * (recPress / 50)).toFixed(1);
                const estPrev = +avg5.toFixed(1);
                actualVal = estPrev > 0 ? Math.round(((estLast - estPrev) / estPrev) * 100) : 0;
              } else {
                actualVal = 0;
              }
            }
            break;
          }
          case "cornersCombined":
            actualVal = match.stats.corners.home + match.stats.corners.away;
            break;
          case "cornersHome":
            actualVal = match.stats.corners.home;
            break;
          case "cornersAway":
            actualVal = match.stats.corners.away;
            break;
          case "shotsOnTargetHome":
            actualVal = match.stats.shotsOnTarget.home;
            break;
          case "shotsOnTargetAway":
            actualVal = match.stats.shotsOnTarget.away;
            break;
          case "shotsOnTargetDiff":
            actualVal = Math.abs(match.stats.shotsOnTarget.home - match.stats.shotsOnTarget.away);
            break;
          case "goalLeadDiff":
            actualVal = Math.abs(match.score.home - match.score.away);
            break;
          case "possessionHome":
            actualVal = match.stats.possession.home;
            break;
          case "possessionAway":
            actualVal = match.stats.possession.away;
            break;
          case "redCardHome":
            actualVal = match.stats.redCards.home;
            break;
          case "redCardAway":
            actualVal = match.stats.redCards.away;
            break;
          case "totalGoals":
            actualVal = (match.score.home || 0) + (match.score.away || 0);
            break;
          case "bigChancesTotal": {
            const bcH = match.stats.bigChances?.home ?? Math.floor((match.stats.shotsOnTarget.home * 0.4) + (match.stats.xG.home * 0.7));
            const bcA = match.stats.bigChances?.away ?? Math.floor((match.stats.shotsOnTarget.away * 0.4) + (match.stats.xG.away * 0.7));
            actualVal = bcH + bcA;
            break;
          }
          case "debtGoals": {
            const totalGoals = (match.score.home || 0) + (match.score.away || 0);
            const bcH = match.stats.bigChances?.home ?? Math.floor((match.stats.shotsOnTarget.home * 0.4) + (match.stats.xG.home * 0.7));
            const bcA = match.stats.bigChances?.away ?? Math.floor((match.stats.shotsOnTarget.away * 0.4) + (match.stats.xG.away * 0.7));
            const totalCc = bcH + bcA;
            const ratio = this.operationalConfig?.chancesPerGoalRatio || 3.0;
            const expGoalsByCc = Math.floor(totalCc / ratio);
            const totalXg = (match.stats.xG.home || 0) + (match.stats.xG.away || 0);
            const debtCc = Math.max(0, expGoalsByCc - totalGoals);
            const debtXg = Math.max(0, Math.round((totalXg - totalGoals) * 10) / 10);
            actualVal = Math.max(debtCc, Math.floor(debtXg));
            break;
          }
          case "tripleDebtFormed": {
            const tdAnalysis = evaluateAllMatchRules(match, this.operationalConfig).tripleDebt;
            actualVal = tdAnalysis.tripleDebtFormed ? 1 : 0;
            break;
          }
          case "pressaoVendavelQualified": {
            const pvAnalysis = evaluateAllMatchRules(match, this.operationalConfig).pressaoVendavel;
            actualVal = pvAnalysis.qualified ? 1 : 0;
            break;
          }
          case "dominantTrailingConfirmed": {
            const dtAnalysis = evaluateAllMatchRules(match, this.operationalConfig).dominantTrailing;
            actualVal = dtAnalysis.status === "DOMINANT_REACTION_CONFIRMED" ? 1 : 0;
            break;
          }
          case "superBackDominanteQualified": {
            if (
              this.operationalConfig.enableSuperBackDominante === false ||
              this.operationalConfig.superBackDominanteConfig?.enabled === false
            ) {
              actualVal = 0;
              break;
            }
            const sbdAnalysis = evaluateAllMatchRules(match, this.operationalConfig).superBackDominante;
            actualVal = sbdAnalysis && sbdAnalysis.qualified ? 1 : 0;
            break;
          }
          case "v12OverBackQualified": {
            const v12Signals = evaluateAllMatchRules(match, this.operationalConfig).traditionalSignals;
            actualVal = v12Signals && v12Signals.length > 0 ? 1 : 0;
            break;
          }
          case "ambasMarcamQualified": {
            if (
              this.operationalConfig.enableAmbasMarcamBTTS === false ||
              this.operationalConfig.ambasMarcamConfig?.enabled === false
            ) {
              actualVal = 0;
              break;
            }
            const bttsAnalysis = evaluateAllMatchRules(match, this.operationalConfig).ambasMarcam;
            actualVal = bttsAnalysis && bttsAnalysis.qualified ? 1 : 0;
            break;
          }
          case "imminentGoalQualified": {
            const immAnalysis = evaluateAllMatchRules(match, this.operationalConfig).imminentGoal;
            actualVal = immAnalysis && (immAnalysis.isImminent || immAnalysis.qualified) ? 1 : 0;
            break;
          }
        }

        switch (cond.operator) {
          case ">":
            return actualVal > cond.value;
          case ">=":
            return actualVal >= cond.value;
          case "<":
            return actualVal < cond.value;
          case "<=":
            return actualVal <= cond.value;
          case "==":
            return actualVal === cond.value;
          case "!=":
            return actualVal !== cond.value;
          default:
            return false;
        }
      });

      const triggered =
        rule.logic === "AND"
          ? conditionResults.every(Boolean)
          : conditionResults.some(Boolean);

      // Regras específicas de validação e supressão inteligente para Diagnóstico Clássico / Dívida de Gols / xG Divergente
      if (
        triggered &&
        (rule.id === "rule-diagnostico-classico" ||
          rule.id === "rule-xg-divergence" ||
          rule.name.toLowerCase().includes("diagnóstico clássico") ||
          rule.name.toLowerCase().includes("xg divergente") ||
          rule.name.toLowerCase().includes("dívida de gols"))
      ) {
        // 1. Não disparar se houve gol há menos de 3 minutos (180 segundos)
        const lastGoalTime = this.matchLastGoalTimes.get(match.id) || 0;
        if (Date.now() - lastGoalTime < 180 * 1000) {
          continue;
        }

        // 2. Avaliar rigorosamente a dívida de gol vs placar do jogo:
        const homeXg = match.stats.xG?.home ?? 0;
        const awayXg = match.stats.xG?.away ?? 0;
        const isHomeDominant = homeXg >= awayXg;
        const dominantGoals = isHomeDominant ? match.score.home : match.score.away;
        const underdogGoals = isHomeDominant ? match.score.away : match.score.home;
        const dominantXg = Math.max(homeXg, awayXg);
        const dominantXgDebt = dominantXg - dominantGoals;

        // Se o time dominante já está vencendo E já marcou igual ou mais do que o seu xG gerado (ex: 3x1 com xG 1.80x0.25),
        // o placar já pagou todo o xG e NÃO HÁ DÍVIDA!
        if (dominantGoals > underdogGoals && dominantGoals >= dominantXg) {
          continue;
        }

        // Se o time dominante já está ganhando por 2 ou mais gols de vantagem, o placar já reflete o xG sem dívida
        if (dominantGoals - underdogGoals >= 2) {
          continue;
        }

        // Se o time dominante está vencendo e sua dívida de xG é insignificante (< 0.8)
        if (dominantGoals > underdogGoals && dominantXgDebt < 0.8) {
          continue;
        }
      }

      // Supressão inteligente e resguardo pós-gol para SUPER BACK DOMINANTE
      if (
        triggered &&
        (rule.id === "rule-super-back-dominante" ||
          rule.name.toLowerCase().includes("super back dominante"))
      ) {
        // Desativação mestre
        if (
          this.operationalConfig.enableSuperBackDominante === false ||
          this.operationalConfig.superBackDominanteConfig?.enabled === false
        ) {
          continue;
        }

        // Resguardo Pós-Gol (Cooldown pós-gol compartilhado: relógio e timestamp)
        const postGoalCooldown = this.operationalConfig.postGoalCooldownMinutes ?? this.operationalConfig.superBackDominanteConfig?.postGoalCooldownMinutes ?? 3;
        const lastGoalTime = this.matchLastGoalTimes.get(match.id);
        const matchWithTime = lastGoalTime ? { ...match, lastGoalTimestamp: lastGoalTime } : match;
        if (isWithinPostGoalSuppression(matchWithTime, postGoalCooldown, 180)) {
          continue;
        }
      }

      // Supressão inteligente para AMBAS MARCAM (BTTS)
      if (
        triggered &&
        (rule.id === "rule-ambas-marcam-btts" ||
          rule.id === "rule-btts-yes" ||
          rule.name.toLowerCase().includes("ambas marcam"))
      ) {
        if (
          this.operationalConfig.enableAmbasMarcamBTTS === false ||
          this.operationalConfig.ambasMarcamConfig?.enabled === false
        ) {
          continue;
        }
      }

      if (triggered) {
        matchBuckets.add(ruleKey);
        this.lastRuleTriggerByMatch.set(matchRuleCooldownKey, { minute: match.minute, timestamp: Date.now() });
        rule.triggerCount += 1;
        rule.lastTriggered = new Date().toISOString();

        const homeXg = match.stats.xG?.home ?? 0;
        const awayXg = match.stats.xG?.away ?? 0;
        const isHomeDominant = homeXg >= awayXg;
        const dominantTeam = isHomeDominant ? match.homeTeam.name : match.awayTeam.name;
        const underdogTeam = isHomeDominant ? match.awayTeam.name : match.homeTeam.name;
        const higherXg = Math.max(homeXg, awayXg).toFixed(2);
        const lowerXg = Math.min(homeXg, awayXg).toFixed(2);
        const xgDiff = Math.abs(homeXg - awayXg).toFixed(2);
        const dominantScore = isHomeDominant ? match.score.home : match.score.away;
        const underdogScore = isHomeDominant ? match.score.away : match.score.home;
        const dominantDebtVal = Math.max(0, +(isHomeDominant ? (homeXg - match.score.home) : (awayXg - match.score.away)).toFixed(2));

        // Contexto de placar e dívida para o alerta de xG
        let scoreContext = `Placar: ${match.score.home} - ${match.score.away}`;
        if (dominantScore < underdogScore) {
          scoreContext += ` (${dominantTeam} perdendo com volume superior • Dívida ativa: ${dominantDebtVal} xG)`;
        } else if (dominantScore === underdogScore) {
          scoreContext += ` (Empate com ${dominantTeam} sufocando • Dívida ativa: ${dominantDebtVal} xG)`;
        } else {
          scoreContext += ` (${dominantTeam} liderando por margem mínima • Dívida: ${dominantDebtVal} xG)`;
        }

        // Determinar time expulso e minuto REAL da expulsão (do tempo real da partida, jamais do crawler)
        let redCardTeam = "";
        let realRedCardMinuteNum: number | null = null;
        let realRedCardMinuteStr = "";
        let redCardPlayer = "";

        // Coletar todos os eventos de cartão vermelho ordenados do mais recente para o mais antigo
        const allRcEvents = (match.events || [])
          .slice()
          .reverse()
          .filter((e) => e.type === "red_card" || (e as any).type === "second_yellow" || (e as any).type === "cartao_vermelho");

        if (match.stats.redCards.home > match.stats.redCards.away) {
          redCardTeam = match.homeTeam.name;
        } else if (match.stats.redCards.away > match.stats.redCards.home) {
          redCardTeam = match.awayTeam.name;
        } else if (allRcEvents.length > 0) {
          const latestRc = allRcEvents[0];
          redCardTeam = latestRc.team === "home" ? match.homeTeam.name : match.awayTeam.name;
        } else {
          redCardTeam = match.stats.redCards.home > 0 ? match.homeTeam.name : match.stats.redCards.away > 0 ? match.awayTeam.name : "";
        }

        // Buscar o evento exato que corresponde ao time punido com cartão vermelho
        if (allRcEvents.length > 0) {
          const targetTeamSide = redCardTeam === match.awayTeam.name ? "away" : "home";
          const matchedRc = allRcEvents.find((e) => e.team === targetTeamSide) || allRcEvents[0];
          if (matchedRc) {
            if (!redCardTeam) {
              redCardTeam = matchedRc.team === "home" ? match.homeTeam.name : match.awayTeam.name;
            }
            if (matchedRc.minute !== undefined && matchedRc.minute !== null) {
              const pMin = Number(matchedRc.minute);
              if (!isNaN(pMin) && pMin > 0) {
                realRedCardMinuteNum = pMin;
                realRedCardMinuteStr = matchedRc.extraMinute ? `${pMin}+${matchedRc.extraMinute}'` : `${pMin}'`;
              }
            }
            if (matchedRc.player) {
              redCardPlayer = matchedRc.player;
            }
          }
        }

        // Janela recente de média da pressão do mandante e visitante (configurável da regra)
        const avgCond = rule.conditions.find((c) => c.metric === "pressureHomeAvgWindow" || c.metric === "pressureAwayAvgWindow");
        const windowMinVal = avgCond?.windowMinutes && avgCond.windowMinutes > 0 ? avgCond.windowMinutes : 5;
        const curMinForAvg = Math.max(1, match.minute || 1);
        const recentPoints = (match.momentumTimeline || []).filter(
          (pt) => pt.minute >= Math.max(1, curMinForAvg - windowMinVal) && pt.minute <= curMinForAvg
        );
        let pressureHomeAvgWindowVal = match.stats.pressureIndex?.home ?? 50;
        let pressureAwayAvgWindowVal = match.stats.pressureIndex?.away ?? 50;
        if (recentPoints.length > 0) {
          let sumHome = 0;
          let sumAway = 0;
          let totalWeight = 0;
          recentPoints.forEach((pt, idx) => {
            const weight = 1 + idx * 0.25;
            const hPress = pt.homePressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 + pt.diff / 2)) : 50);
            const aPress = pt.awayPressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 - pt.diff / 2)) : 50);
            const dangerBonusH = (pt.homeDangerousAttack ? 15 : 0) + (pt.homeShot ? 25 : 0);
            const dangerBonusA = (pt.awayDangerousAttack ? 15 : 0) + (pt.awayShot ? 25 : 0);
            sumHome += (hPress + dangerBonusH) * weight;
            sumAway += (aPress + dangerBonusA) * weight;
            totalWeight += weight;
          });
          const avgH = sumHome / (totalWeight || 1);
          const avgA = sumAway / (totalWeight || 1);
          const tot = avgH + avgA;
          pressureHomeAvgWindowVal = tot > 0 ? Math.round((avgH / tot) * 100) : (match.stats.pressureIndex?.home ?? 50);
          pressureAwayAvgWindowVal = tot > 0 ? Math.round((avgA / tot) * 100) : (match.stats.pressureIndex?.away ?? 50);
        }

        // Determinação inteligente e precisa do time dominante e da pressão dominante
        const hasAwaySpecificCondition = rule.conditions.some(
          (c) => c.metric === "pressureAwayAvgWindow" || c.metric === "pressureAway" || c.metric === "dangerousAttacksLast10Away"
        );
        const hasHomeSpecificCondition = rule.conditions.some(
          (c) => c.metric === "pressureHomeAvgWindow" || c.metric === "pressureHome" || c.metric === "dangerousAttacksLast10Home"
        );

        let finalIsHomeDominant = true;
        if (hasAwaySpecificCondition && !hasHomeSpecificCondition) {
          finalIsHomeDominant = false;
        } else if (hasHomeSpecificCondition && !hasAwaySpecificCondition) {
          finalIsHomeDominant = true;
        } else if (pressureAwayAvgWindowVal >= pressureHomeAvgWindowVal + 6) {
          finalIsHomeDominant = false;
        } else if (pressureHomeAvgWindowVal >= pressureAwayAvgWindowVal + 6) {
          finalIsHomeDominant = true;
        } else if (homeXg !== awayXg) {
          finalIsHomeDominant = homeXg >= awayXg;
        } else {
          finalIsHomeDominant = (match.stats.pressureIndex?.home ?? 50) >= (match.stats.pressureIndex?.away ?? 50);
        }

        const realDominantTeam = finalIsHomeDominant ? match.homeTeam.name : match.awayTeam.name;
        const realUnderdogTeam = finalIsHomeDominant ? match.awayTeam.name : match.homeTeam.name;
        const dominantPressureVal = finalIsHomeDominant ? pressureHomeAvgWindowVal : pressureAwayAvgWindowVal;

        const recentCornersVal = 0;

        const isRedCardRule = hasRedCardMetric;

        let formattedMsg = rule.messageTemplate
          .replace("{teamHome}", match.homeTeam.name)
          .replace("{teamAway}", match.awayTeam.name)
          .replace("{dominantTeam}", realDominantTeam)
          .replace("{underdogTeam}", realUnderdogTeam)
          .replace("{redCardTeam}", redCardTeam || match.homeTeam.name)
          .replace("{teamExpelled}", redCardTeam || match.homeTeam.name)
          .replace("{dominantPressureWindow}", `${dominantPressureVal}`)
          .replace("{pressureDominantAvgWindow}", `${dominantPressureVal}`)
          .replace("{pressureDominantWindow}", `${dominantPressureVal}`)
          .replace("{dominantPressure}", `${dominantPressureVal}`)
          .replace("{pressureHomeAvgWindow}", `${pressureHomeAvgWindowVal}`)
          .replace("{pressureAwayAvgWindow}", `${pressureAwayAvgWindowVal}`)
          .replace("{pressureWindow}", `${windowMinVal}`)
          .replace("{recentCorners}", `${recentCornersVal}`)
          .replace("{cornerWindow}", "8")
          .replace("{cornerWindowMinutes}", "8")
          .replace("{higherXg}", higherXg)
          .replace("{lowerXg}", lowerXg)
          .replace("{score}", `${match.score.home} - ${match.score.away}`)
          .replace("{scoreContext}", scoreContext);

        if (isRedCardRule) {
          // Para alertas de cartão vermelho, JAMAIS utilizar o minuto atual de rastreio do crawler
          const playerLabel = redCardPlayer ? ` (${redCardPlayer})` : "";
          const minuteLabel = realRedCardMinuteStr ? ` aos ${realRedCardMinuteStr}` : "";
          formattedMsg = `🟥 CARTÃO VERMELHO! Expulsão no ${redCardTeam || match.homeTeam.name}${playerLabel}${minuteLabel}. Desequilíbrio tático iminente.`;
        } else {
          formattedMsg = formattedMsg.replace("{minute}", match.minute.toString());
        }

        const totalGoalsVal = (match.score.home || 0) + (match.score.away || 0);
        const bcHVal = match.stats.bigChances?.home ?? Math.floor((match.stats.shotsOnTarget.home * 0.4) + (match.stats.xG.home * 0.7));
        const bcAVal = match.stats.bigChances?.away ?? Math.floor((match.stats.shotsOnTarget.away * 0.4) + (match.stats.xG.away * 0.7));
        const totalBcVal = bcHVal + bcAVal;
        const totalXgVal = ((match.stats.xG?.home || 0) + (match.stats.xG?.away || 0)).toFixed(2);
        const ratio = this.operationalConfig?.chancesPerGoalRatio || 3.0;
        const debtCc = Math.max(0, Math.floor(totalBcVal / ratio) - totalGoalsVal);
        const debtXg = Math.max(0, Math.round(((match.stats.xG?.home || 0) + (match.stats.xG?.away || 0) - totalGoalsVal) * 10) / 10);
        const debtGoalsVal = Math.max(debtCc, Math.floor(debtXg));

        const tdData = evaluateAllMatchRules(match, this.operationalConfig).tripleDebt;
        const debtorTeam = tdData.debtorTeamName || (tdData.scopeSide === "home" ? match.homeTeam.name : tdData.scopeSide === "away" ? match.awayTeam.name : "Ambos os Times");
        const tripleDebtScope = tdData.scope === "unilateral" ? `UNILATERAL (${debtorTeam})` : "BILATERAL";

        const pvData = evaluateAllMatchRules(match, this.operationalConfig).pressaoVendavel;
        const pvTeam = pvData.team || match.homeTeam.name;
        const pvFairOdd = pvData.fairOdd ? pvData.fairOdd.toFixed(2) : "1.60";
        const pvMinOdd = pvData.minRecommendedOdd ? pvData.minRecommendedOdd.toFixed(2) : "1.75";
        const pvProb = pvData.probTarget ? `${pvData.probTarget}%` : "65%";
        const pvTese = pvData.tese || "";

        const dtData = evaluateAllMatchRules(match, this.operationalConfig).dominantTrailing;
        const dtDominantTeam = dtData.dominantSide === "home" ? match.homeTeam.name : dtData.dominantSide === "away" ? match.awayTeam.name : dominantTeam;
        const dtDominantOpponent = dtData.dominantSide === "home" ? match.awayTeam.name : match.homeTeam.name;
        const dtDominantPressure = dtData.dominantSide === "home" ? (match.stats.pressureIndex?.home ?? 50) : (match.stats.pressureIndex?.away ?? 50);
        const dtTrailingBy = dtData.dominantTrailingBy || 1;
        const dtLivePressureStatus = dtData.livePressureStatus || "forte";

        const sbdData = evaluateAllMatchRules(match, this.operationalConfig).superBackDominante;
        const sbdTeam = sbdData?.dominantTeam || dominantTeam;
        const sbdTier = sbdData?.tier || "OURO";
        const sbdSituation = sbdData?.situation === "PERDENDO" ? `perdendo por ${sbdData.deficitGoals} gol(s)` : "empatando";
        const sbdProb = sbdData?.probTarget || 75;
        const sbdFairOdd = sbdData?.fairOdd ? sbdData.fairOdd.toFixed(2) : "1.33";
        const sbdMinOdd = sbdData?.minRecommendedOdd ? sbdData.minRecommendedOdd.toFixed(2) : "1.45";
        const sbdTese = sbdData?.tese || "";
        const sbdDomXg = (sbdData?.dominantXg ?? 0).toFixed(2);
        const sbdOppXg = (sbdData?.opponentXg ?? 0).toFixed(2);
        const sbdDomCc = sbdData?.dominantCc ?? 0;
        const sbdPressure = sbdData?.dominantPressure ?? (match.stats.pressureIndex?.home ?? 50);
        const sbdLivePressure = sbdData?.livePressureStatus || "forte";

        const isSuperBackRule =
          rule.id === "rule-super-back-dominante" ||
          rule.id.includes("super-back") ||
          rule.name.toLowerCase().includes("super back");

        const targetDominantTeam = isSuperBackRule ? sbdTeam : dtDominantTeam;
        const targetDominantPressure = isSuperBackRule ? sbdPressure : dtDominantPressure;
        const targetLivePressureStatus = isSuperBackRule ? sbdLivePressure : dtLivePressureStatus;

        const v12Signals = evaluateAllMatchRules(match, this.operationalConfig).traditionalSignals || [];
        const topV12 = v12Signals[0];
        const v12RuleName = topV12 ? topV12.ruleName.replace(/_/g, " ") : "SINAL V1.2";
        const v12Market = topV12 ? topV12.marketTarget : "OVER/BACK";
        const v12Tier = topV12 ? topV12.confidenceTier : "A";
        const v12Trace = topV12 ? topV12.trace : "";

        const bttsData = evaluateAllMatchRules(match, this.operationalConfig).ambasMarcam;
        const bttsProb = bttsData?.probTarget || 70;
        const bttsFairOdd = bttsData?.fairOdd ? bttsData.fairOdd.toFixed(2) : "1.43";
        const bttsMinOdd = bttsData?.minRecommendedOdd ? bttsData.minRecommendedOdd.toFixed(2) : "1.57";
        const bttsReasoning = bttsData?.reasoning || "Volume ofensivo bilateral consistente";
        const bttsScoreScenario = bttsData?.scoreScenario || "0-0";

        // Global replacement for message template placeholders
        formattedMsg = formattedMsg
          .replaceAll("{pressureHome}", (match.stats.pressureIndex?.home ?? 50).toString())
          .replaceAll("{pressureAway}", (match.stats.pressureIndex?.away ?? 50).toString())
          .replaceAll("{cornersTotal}", ((match.stats.corners?.home ?? 0) + (match.stats.corners?.away ?? 0)).toString())
          .replaceAll("{xgDiff}", xgDiff)
          .replaceAll("{chancesVariation5m}", match.stats.pressureIndex ? (((match.stats.pressureIndex.home || 0) + (match.stats.pressureIndex.away || 0)) > 100 ? "+60%" : "+45%") : "0%")
          .replaceAll("{totalGoals}", totalGoalsVal.toString())
          .replaceAll("{bigChancesTotal}", totalBcVal.toString())
          .replaceAll("{totalXg}", totalXgVal)
          .replaceAll("{debtGoals}", debtGoalsVal.toString())
          .replaceAll("{debtorTeam}", debtorTeam)
          .replaceAll("{tripleDebtScope}", tripleDebtScope)
          .replaceAll("{ccInScope}", `${tdData.ccInScope || totalBcVal}`)
          .replaceAll("{xgInScope}", `${tdData.xgInScope || totalXgVal}`)
          .replaceAll("{xgotInScope}", `${tdData.xgotInScope || 0}`)
          .replaceAll("{pvTeam}", pvTeam)
          .replaceAll("{pvFairOdd}", pvFairOdd)
          .replaceAll("{pvMinOdd}", pvMinOdd)
          .replaceAll("{pvProb}", pvProb)
          .replaceAll("{pvTese}", pvTese)
          .replaceAll("{dominantTeam}", targetDominantTeam)
          .replaceAll("{dominantOpponent}", dtDominantOpponent)
          .replaceAll("{dominantPressure}", targetDominantPressure.toString())
          .replaceAll("{trailingBy}", dtTrailingBy.toString())
          .replaceAll("{livePressureStatus}", targetLivePressureStatus)
          .replaceAll("{superBackTeam}", sbdTeam)
          .replaceAll("{sbdTeam}", sbdTeam)
          .replaceAll("{superBackTier}", sbdTier)
          .replaceAll("{sbdTier}", sbdTier)
          .replaceAll("{superBackSituation}", sbdSituation)
          .replaceAll("{sbdSituation}", sbdSituation)
          .replaceAll("{superBackProb}", sbdProb.toString())
          .replaceAll("{sbdProb}", sbdProb.toString())
          .replaceAll("{superBackFairOdd}", sbdFairOdd)
          .replaceAll("{sbdFairOdd}", sbdFairOdd)
          .replaceAll("{fairOdd}", isSuperBackRule ? sbdFairOdd : pvFairOdd)
          .replaceAll("{superBackMinOdd}", sbdMinOdd)
          .replaceAll("{sbdMinOdd}", sbdMinOdd)
          .replaceAll("{minRecommendedOdd}", isSuperBackRule ? sbdMinOdd : pvMinOdd)
          .replaceAll("{superBackTese}", sbdTese)
          .replaceAll("{sbdTese}", sbdTese)
          .replaceAll("{tese}", isSuperBackRule ? sbdTese : pvTese)
          .replaceAll("{dominantXg}", isSuperBackRule ? sbdDomXg : xgDiff)
          .replaceAll("{opponentXg}", sbdOppXg)
          .replaceAll("{dominantCc}", sbdDomCc.toString())
          .replaceAll("{v12RuleName}", v12RuleName)
          .replaceAll("{v12Market}", v12Market)
          .replaceAll("{v12Tier}", v12Tier)
          .replaceAll("{v12Trace}", v12Trace)
          .replaceAll("{bttsProb}", bttsProb.toString())
          .replaceAll("{bttsFairOdd}", bttsFairOdd)
          .replaceAll("{bttsMinOdd}", bttsMinOdd)
          .replaceAll("{bttsReasoning}", bttsReasoning)
          .replaceAll("{bttsScoreScenario}", bttsScoreScenario);

        // Prevenção de duplicidade: se for a regra de Super Pressão / Trend e o motor do Trend Alert já estiver ativo,
        // suprimir o disparo redundante para emitir o alerta oficial unificado com dados estatísticos ricos (trendData).
        const isTrendOrSuperPressure =
          rule.id === "rule-trend-super-pressure" ||
          rule.id === "rule-super-pressure-home" ||
          rule.name.toLowerCase().includes("super pressão");
        if (isTrendOrSuperPressure && this.operationalConfig.enableTrendAlert !== false) {
          continue;
        }

        const isBttsRule = rule.id === "rule-ambas-marcam-btts" || rule.id === "rule-btts-yes";
        const isImmRule = rule.id === "rule-gol-iminente-surto" || rule.id === "rule-imminent-goal" || rule.name.toLowerCase().includes("gol iminente");

        const matchAnalysis = evaluateAllMatchRules(match, this.operationalConfig);
        const immData = matchAnalysis.imminentGoal;
        const immTeam = immData?.teamName || (immData?.team === "home" ? match.homeTeam.name : immData?.team === "away" ? match.awayTeam.name : (match.stats.pressureIndex?.home ?? 50) >= (match.stats.pressureIndex?.away ?? 50) ? match.homeTeam.name : match.awayTeam.name);
        const immPressure = immData?.avgPressure || (immTeam === match.homeTeam.name ? (match.stats.pressureIndex?.home ?? 50) : (match.stats.pressureIndex?.away ?? 50));
        const immAction = immData?.actionText || `Entrada a favor de ${immTeam} (Próximo Gol / Back).`;
        const immMarket = immData?.targetMarket || `Próximo Gol ${immTeam} / Back ${immTeam}`;

        if (isImmRule) {
          formattedMsg = formattedMsg
            .replaceAll("{dominantTeam}", immTeam)
            .replaceAll("{imminentTeam}", immTeam)
            .replaceAll("{imminentPressure}", `${immPressure}`)
            .replaceAll("{targetMarket}", immMarket)
            .replaceAll("{actionText}", immAction)
            .replaceAll("a favor do dominante!", `a favor de ${immTeam}!`)
            .replaceAll("a favor do dominante.", `a favor de ${immTeam}.`)
            .replaceAll("a favor do dominante", `a favor de ${immTeam}`);
        }

        let tipToAttach: BettingTipData | undefined = undefined;
        if (isSuperBackRule && sbdData?.bettingTip) {
          tipToAttach = sbdData.bettingTip;
        } else if (isBttsRule && bttsData?.bettingTip) {
          tipToAttach = bttsData.bettingTip;
        } else if (isImmRule && matchAnalysis.imminentGoal?.bettingTip) {
          tipToAttach = matchAnalysis.imminentGoal.bettingTip;
        }

        let ruleCategory = "custom";
        if (isRedCardRule) {
          ruleCategory = "red_card";
        } else if (isImmRule) {
          ruleCategory = "imminent_goal";
        } else if (isBttsRule) {
          ruleCategory = "btts";
        } else if (isSuperBackRule) {
          ruleCategory = "super_back";
        } else if (rule.id.includes("c31") || rule.id.includes("diagnostico")) {
          ruleCategory = "codigo_31";
        } else if (rule.id.includes("divida") || rule.id.includes("trinca")) {
          ruleCategory = "triple_debt";
        } else if (rule.id.includes("cantos") || rule.name.toLowerCase().includes("cantos") || rule.name.toLowerCase().includes("blitz")) {
          ruleCategory = "corners";
        } else if (rule.id.includes("trend") || rule.name.toLowerCase().includes("trend") || rule.name.toLowerCase().includes("super pressão")) {
          ruleCategory = "trend_alert";
        }

        const alertLog: AlertLog = {
          id: this.generateUniqueId("log"),
          ruleId: rule.id,
          ruleName: isRedCardRule && realRedCardMinuteStr
            ? `🟥 Expulsão: ${redCardTeam || match.homeTeam.name} (${realRedCardMinuteStr})`
            : isImmRule && immTeam
            ? `🚨 GOL IMINENTE: ${immTeam} (${immPressure}% em 5')`
            : rule.name,
          matchId: match.id,
          matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
          league: match.league,
          country: match.country || match.leagueCountry || "",
          leagueCountry: match.leagueCountry || match.country || "",
          minute: isRedCardRule && realRedCardMinuteNum ? realRedCardMinuteNum : match.minute,
          score: `${match.score.home} - ${match.score.away}`,
          severity: rule.severity,
          message: formattedMsg,
          timestamp: new Date().toISOString(),
          read: false,
          category: ruleCategory,
          bettingTip: tipToAttach,
        };

        this.pushAlertLog(alertLog, match);
      }
    }

    // 2. Python Operational Rules & Betting Strategies Engine
    // Suprime novos alertas táticos se a partida estiver no Cooldown Geral Pós-Gol de 3 minutos
    if (isPostGoalCooldownActive) {
      return;
    }

    if (this.operationalConfig.enableCodigo31 || true) {
      if (!this.pythonRuleTriggeredBuckets.has(match.id)) {
        this.pythonRuleTriggeredBuckets.set(match.id, new Set<string>());
      }
      const matchBuckets = this.pythonRuleTriggeredBuckets.get(match.id)!;

      const analysis = evaluateAllMatchRules(match, this.operationalConfig);

      const filterTip = (tip?: TacticalTipData): TacticalTipData | undefined => {
        return tip;
      };

      const c31 = analysis.codigo31;
      const isEditableCodigo31Active = this.alertRules.some(
        (r) => r.id === "rule-diagnostico-classico" && r.enabled
      );
      if (!isEditableCodigo31Active && this.operationalConfig.enableCodigo31 && c31.shouldAlert && c31.alertType) {
        const bucketKey = `c31_${c31.alertType}_b${c31.bucket}_m${c31.market}`;
        if (!matchBuckets.has(bucketKey)) {
          matchBuckets.add(bucketKey);

          const severity = c31.level === "premium" ? "critical" : "opportunity";
          const alertLog: AlertLog = {
            id: this.generateUniqueId("py"),
            ruleId: `python-${c31.alertType}`,
            ruleName: `${c31.title} (Ratio ${this.operationalConfig.chancesPerGoalRatio}:1)`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity,
            message: c31.formattedTelegram || `${c31.emoji} ${c31.title}`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "codigo_31",
            bettingTip: filterTip(c31.bettingTip),
          };
          this.pushAlertLog(alertLog, match);
        }
      }

      // Triple Debt formed notification
      const isEditableTripleDebtActive = this.alertRules.some(
        (r) => r.id === "rule-trinca-de-dividas" && r.enabled
      );
      if (!isEditableTripleDebtActive && this.operationalConfig.enableTripleDebt && analysis.tripleDebt.tripleDebtFormed) {
        const td = analysis.tripleDebt;
        const tdKey = `td_${td.scope}_${td.scopeSide}_g${td.goalsInScope}`;
        if (!matchBuckets.has(tdKey)) {
          matchBuckets.add(tdKey);
          const debtorTeam = td.debtorTeamName || (td.scopeSide === "home" ? match.homeTeam.name : td.scopeSide === "away" ? match.awayTeam.name : "Ambos os Times");
          const titleScope = td.scope === "unilateral" ? `UNILATERAL - ${debtorTeam}` : "BILATERAL";
          const alertLog: AlertLog = {
            id: this.generateUniqueId("py-td"),
            ruleId: "python-triple-debt",
            ruleName: `💎 TRINCA DE DÍVIDAS ATIVA (${titleScope})`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity: "critical",
            message: `💎 TRINCA DE DÍVIDAS ATIVA (${titleScope})
Partida: ${match.homeTeam.name} ${match.score.home}-${match.score.away} ${match.awayTeam.name}
Minuto: ${match.minute}'
Time Devedor: ${debtorTeam}
Chances Claras (CC): ${td.ccInScope}
xG Acumulado: ${td.xgInScope}
xGOT (No Alvo): ${td.xgotInScope}
Gols Marcados: ${td.goalsInScope}`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "triple_debt",
            bettingTip: filterTip(td.bettingTip),
          };
          this.pushAlertLog(alertLog, match);
        }
      }

      // Super Back Dominante Notification:
      // Se a regra já existe no catálogo de regras editáveis (rule-super-back-dominante), ela é gerida
      // exclusivamente pelo motor editável (evaluateAlertRules). Jamais disparar o fallback python se a regra
      // estiver configurada na lista (seja ativada ou desativada pelo usuário).
      const hasEditableSBD = this.alertRules.some(
        (r) => r.id === "rule-super-back-dominante" || r.id === "rule-pressao-vendavel" || r.id === "rule-back-dominante-desvantagem"
      );
      if (!hasEditableSBD && this.operationalConfig.enableSuperBackDominante !== false && this.operationalConfig.superBackDominanteConfig?.enabled !== false && analysis.superBackDominante?.qualified) {
        const sbd = analysis.superBackDominante;
        const sbdKey = `sbd_${sbd.dominantSide}_m${Math.floor(match.minute / 15)}_s${match.score.home}_${match.score.away}`;
        if (!matchBuckets.has(sbdKey)) {
          matchBuckets.add(sbdKey);
          const alertLog: AlertLog = {
            id: this.generateUniqueId("py-sbd"),
            ruleId: "python-super-back-dominante",
            ruleName: `🎯 SUPER BACK DOMINANTE: ${sbd.dominantTeam.toUpperCase()} [${sbd.tier}]`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity: "opportunity",
            message: `🎯 SUPER BACK DOMINANTE [Tier ${sbd.tier}]: Back ${sbd.dominantTeam} aos ${match.minute}' (Placar: ${match.score.home}-${match.score.away}, ${sbd.situation === "PERDENDO" ? `perdendo por ${sbd.deficitGoals} gol(s)` : "empatando"}). Pressão: ${sbd.dominantPressure}% (${sbd.livePressureStatus}) | xG: ${sbd.dominantXg.toFixed(2)} vs ${sbd.opponentXg.toFixed(2)} | CC: ${sbd.dominantCc}. Prob: ${sbd.probTarget}% (Odd Justa: ${sbd.fairOdd?.toFixed(2)} | Min: ${sbd.minRecommendedOdd?.toFixed(2)}). Tese: ${sbd.tese}`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "super_back",
            bettingTip: filterTip(sbd.bettingTip),
          };
          this.pushAlertLog(alertLog, match);
        }
      } else if (!hasEditableSBD) {
        // Fallback para regras individuais caso o motor unificado e a regra editável não existam
        const isEditablePVActive = this.alertRules.some(
          (r) => r.id === "rule-pressao-vendavel" && r.enabled
        );
        if (!isEditablePVActive && this.operationalConfig.enablePressaoVendavel && analysis.pressaoVendavel?.qualified) {
          const pv = analysis.pressaoVendavel;
          const pvKey = `pv_${pv.side}_m${Math.floor(match.minute / 15)}_s${match.score.home}_${match.score.away}`;
          if (!matchBuckets.has(pvKey)) {
            matchBuckets.add(pvKey);
            const alertLog: AlertLog = {
              id: this.generateUniqueId("py-pv"),
              ruleId: "python-pressao-vendavel",
              ruleName: `⚡ PRESSÃO VENDÁVEL: BACK ${pv.team.toUpperCase()}`,
              matchId: match.id,
              matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
              league: match.league,
              country: match.country || match.leagueCountry || "",
              leagueCountry: match.leagueCountry || match.country || "",
              minute: match.minute,
              score: `${match.score.home} - ${match.score.away}`,
              severity: "opportunity",
              message: `⚡ PRESSÃO VENDÁVEL QUALIFICADA: Back ${pv.team} aos ${match.minute}' (Placar: ${match.score.home}-${match.score.away}). Prob. Projetada: ${pv.probTarget}%. Odd Justa: ${pv.fairOdd?.toFixed(2)} (Entrar se Odd >= ${pv.minRecommendedOdd?.toFixed(2)}). Tese: ${pv.tese}`,
              timestamp: new Date().toISOString(),
              read: false,
              category: "pressao_vendavel",
              bettingTip: filterTip(pv.bettingTip),
            };
            this.pushAlertLog(alertLog, match);
          }
        }

        const hasEditableDT = this.alertRules.some(
          (r) => r.id === "rule-back-dominante-desvantagem" || r.id === "rule-super-back-dominante"
        );
        if (!hasEditableDT && this.operationalConfig.enableDominantTrailing && analysis.dominantTrailing?.status === "DOMINANT_REACTION_CONFIRMED") {
          const dt = analysis.dominantTrailing;
          const domTeam = dt.dominantSide === "home" ? match.homeTeam.name : match.awayTeam.name;
          const dtKey = `dt_${dt.dominantSide}_m${Math.floor(match.minute / 15)}_s${match.score.home}_${match.score.away}`;
          if (!matchBuckets.has(dtKey)) {
            matchBuckets.add(dtKey);
            const alertLog: AlertLog = {
              id: this.generateUniqueId("py-dt"),
              ruleId: "python-dominant-trailing",
              ruleName: `🎯 BACK DOMINANTE: ${domTeam.toUpperCase()} REAGINDO`,
              matchId: match.id,
              matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
              league: match.league,
              country: match.country || match.leagueCountry || "",
              leagueCountry: match.leagueCountry || match.country || "",
              minute: match.minute,
              score: `${match.score.home} - ${match.score.away}`,
              severity: "opportunity",
              message: `🎯 BACK DOMINANTE: ${domTeam} perdendo por ${dt.dominantTrailingBy} gol(s) aos ${match.minute}' (Placar: ${match.score.home}-${match.score.away}) com reação ofensiva confirmada (Pressão: ${dt.dominantSide === "home" ? match.stats.pressureIndex.home : match.stats.pressureIndex.away}%, Status: ${dt.livePressureStatus}). Forte probabilidade de virada ou empate!`,
              timestamp: new Date().toISOString(),
              read: false,
              category: "super_back",
              bettingTip: filterTip(dt.bettingTip),
            };
            this.pushAlertLog(alertLog, match);
          }
        }
      }

      // V12 Over & Back Alavancado Notification (suprimido se a regra editável existir no catálogo)
      const hasEditableV12 = this.alertRules.some(
        (r) => r.id === "rule-v12-over-back"
      );
      if (!hasEditableV12 && this.operationalConfig.enableV12OverBack && analysis.traditionalSignals && analysis.traditionalSignals.length > 0) {
        const topSig = analysis.traditionalSignals[0];
        const v12Key = `v12_${topSig.ruleName}_m${Math.floor(match.minute / 5)}_s${match.score.home}_${match.score.away}`;
        if (!matchBuckets.has(v12Key)) {
          matchBuckets.add(v12Key);
          const alertLog: AlertLog = {
            id: this.generateUniqueId("py-v12"),
            ruleId: "python-v12-over-back",
            ruleName: `📈 SINAL V1.2: ${topSig.ruleName.replace(/_/g, " ")}`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity: "opportunity",
            message: `📈 SINAL V1.2 ATIVO: [${topSig.ruleName.replace(/_/g, " ")}] aos ${match.minute}'! Mercado: ${topSig.marketTarget} (Tier: ${topSig.confidenceTier}). ${topSig.trace}. Placar: ${match.score.home}-${match.score.away}.`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "v12_over",
            bettingTip: filterTip(analysis.activeTips?.find((t) => t.marketCode === topSig.marketTarget)),
          };
          this.pushAlertLog(alertLog, match);
        }
      }

      // Imminent Goal (Surto Ofensivo 5m) Notification (suprimido se a regra editável existir no catálogo)
      const hasEditableImm = this.alertRules.some(
        (r) => r.id === "rule-gol-iminente-surto" || r.id === "rule-imminent-goal"
      );
      if (!hasEditableImm && this.operationalConfig.enableImminentGoal && (analysis.imminentGoal?.qualified || analysis.imminentGoal?.isImminent) && (analysis.imminentGoal.intensity === "extrema" || analysis.imminentGoal.intensity === "alta")) {
        const imm = analysis.imminentGoal;
        const immBucketKey = `imm_${imm.team}_m${Math.floor(match.minute / 5)}_g${match.score.home + match.score.away}`;
        if (!matchBuckets.has(immBucketKey)) {
          matchBuckets.add(immBucketKey);
          const severity = imm.intensity === "extrema" ? "critical" : "opportunity";
          const alertLog: AlertLog = {
            id: this.generateUniqueId("py-imm"),
            ruleId: "python-imminent-goal",
            ruleName: `🚨 GOL IMINENTE: SURTO OFENSIVO (${imm.teamName || 'BLITZ'} ${imm.avgPressure}% em 5')`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity,
            message: `🚨 GOL IMINENTE DETECTADO (${imm.intensity.toUpperCase()})
Partida: ${match.homeTeam.name} ${match.score.home}-${match.score.away} ${match.awayTeam.name}
Minuto: ${match.minute}' | Confiança: ${imm.confidenceScore}%
Pressão em 5m: ${imm.avgPressure}% (${imm.consistencyPct}% em alta pressão)
Atividade na Janela: ${imm.dangerousAttacksInWindow} ataques perigosos e ${imm.shotsInWindow} finalizações
${imm.teamName ? `Equipe em Blitz: ${imm.teamName}` : ''}
🎯 Mercado: ${imm.targetMarket || 'Próximo Gol / Back'}
👉 Ação: ${imm.actionText}`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "imminent_goal",
            bettingTip: filterTip(imm.bettingTip),
          };
          this.pushAlertLog(alertLog, match);
        }
      }

      // Ambas Marcam Notification (suprimido se a regra editável existir no catálogo)
      const hasEditableBtts = this.alertRules.some(
        (r) => r.id === "rule-ambas-marcam-btts" || r.id === "rule-btts-yes"
      );
      if (!hasEditableBtts && this.operationalConfig.enableAmbasMarcamBTTS && analysis.ambasMarcam?.qualified) {
        const am = analysis.ambasMarcam;
        const amKey = `am_btts_${match.score.home}_${match.score.away}`;
        if (!matchBuckets.has(amKey)) {
          matchBuckets.add(amKey);
          const alertLog: AlertLog = {
            id: this.generateUniqueId("tip-am"),
            ruleId: "tip-ambas-marcam",
            ruleName: `🎯 AMBAS AS EQUIPES MARCAM (BTTS: SIM)`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity: "opportunity",
            message: `🎯 BTTS SIM: Ambos os times com alto volume e finalizações perigosas (xG ${am.homeXg} x ${am.awayXg}).`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "btts",
            bettingTip: filterTip(am.bettingTip),
          };
          this.pushAlertLog(alertLog, match);
        }
      }

      // Trend Alert (Pressão Alta Constante no Longo Prazo - ex: 15 min)
      const trendMinPress = this.operationalConfig.superPressureConfig?.minAvgPressure ?? this.operationalConfig.trendAlertMinAvgPressure ?? 65;
      if (
        this.operationalConfig.enableTrendAlert !== false &&
        analysis.trendAlert?.qualified &&
        analysis.trendAlert.teamName &&
        analysis.trendAlert.avgPressure >= Math.min(trendMinPress, 65)
      ) {
        const tr = analysis.trendAlert;
        const trKey = `trend_${tr.team}_m${Math.floor(match.minute / 12)}_s${match.score.home}_${match.score.away}`;
        if (!matchBuckets.has(trKey)) {
          matchBuckets.add(trKey);
          const severity = tr.intensity === "extrema" ? "critical" : "opportunity";
          const alertLog: AlertLog = {
            id: this.generateUniqueId("py-trend"),
            ruleId: "python-trend-alert",
            ruleName: `📈 Trend Alert: Super Pressão Contínua (${tr.windowMinutes} min)`,
            matchId: match.id,
            matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
            league: match.league,
            country: match.country || match.leagueCountry || "",
            leagueCountry: match.leagueCountry || match.country || "",
            minute: match.minute,
            score: `${match.score.home} - ${match.score.away}`,
            severity,
            message: `TREND ALERT: ${tr.teamName} mantém super pressão contínua (${tr.avgPressure}% em ${tr.windowMinutes}m) aos ${match.minute}'!`,
            timestamp: new Date().toISOString(),
            read: false,
            category: "trend_alert",
            bettingTip: undefined,
            trendData: {
              team: tr.team || 'home',
              teamName: tr.teamName,
              opponentName: tr.opponentName,
              windowMinutes: tr.windowMinutes,
              avgPressure: tr.avgPressure,
              consistencyPct: tr.consistencyPct,
              highPressureMinutes: tr.highPressureMinutes,
              totalPoints: tr.totalPointsInWindow,
              shotsInWindow: tr.shotsInWindow,
              dangerousAttacksInWindow: tr.dangerousAttacksInWindow,
              trendDirection: tr.trendDirection,
              intensity: tr.intensity,
            },
          };
          this.pushAlertLog(alertLog, match);
        }
      }
    }
  }

  public createInstantAlert(match: Match, message: string, severity: 'info' | 'warning' | 'opportunity' | 'critical') {
    const alertLog: AlertLog = {
      id: this.generateUniqueId("instant"),
      ruleId: "manual",
      ruleName: "Evento em Tempo Real",
      matchId: match.id,
      matchTitle: `${match.homeTeam.name} x ${match.awayTeam.name}`,
      league: match.league,
      country: match.country || match.leagueCountry || "",
      leagueCountry: match.leagueCountry || match.country || "",
      minute: match.minute,
      score: `${match.score.home} - ${match.score.away}`,
      severity,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.pushAlertLog(alertLog, match);
  }

  // --- Node Crawler Ingestion API ---
  public ingestCrawlerMatchUpdate(
    payload: any,
    remoteIp?: string,
    providedSessionId?: string,
    _providedEngine?: string
  ): { success: boolean; matchId: string; message: string } {
    const sid = payload?.session_id || payload?.sessionId || providedSessionId;
    if (sid) {
      this.recordSessionId(sid);
    }
    this.crawlerStatus.connected = true;
    this.crawlerStatus.lastHeartbeat = new Date().toISOString();
    this.crawlerStatus.totalPacketsReceived += 1;
    this.crawlerStatus.crawlerIp = remoteIp || "127.0.0.1";

    if (this.crawlerStartupTime === 0) {
      this.crawlerStartupTime = Date.now();
      this.crawlerStartupCooldownAnnounced = false;
      const startupMinutes = this.operationalConfig.crawlerStartupCooldownMinutes ?? this.operationalConfig.crawlerConfig?.startupCooldownMinutes ?? 3;
      this.addCrawlerLog("info", `🚀 Início do Crawler detectado. Cooldown de inicialização ativado por ${startupMinutes} minutos (180s) para consolidação da grade.`);
    }

    if (!payload || typeof payload !== "object") {
      this.addCrawlerLog("warn", "Payload de crawler rejeitado: formato inválido.");
      return { success: false, matchId: "", message: "Payload inválido" };
    }

    const rawId = payload.id || payload.matchId || payload.match_id || payload.gameId || payload.game_id || payload.eventId || payload.event_id || payload._id;
    if (!rawId) {
      this.addCrawlerLog("warn", "Payload de crawler rejeitado: campo 'id'/'match_id' ausente.");
      return { success: false, matchId: "", message: "Campo 'id' obrigatório no payload" };
    }

    const matchId = String(rawId);

    // Se o jogo foi apagado pelo usuário nesta sessão do crawler, ignorar e não reinserir nem alertar
    if (this.dismissedMatchIds.has(matchId)) {
      return { success: true, matchId, message: "Partida apagada nesta sessão do crawler." };
    }

    // Extrair e normalizar times
    const homeName = normalizeTeamName(payload.homeTeam || payload.home || payload.home_name || payload.homeTeamName, "Time Mandante");
    const awayName = normalizeTeamName(payload.awayTeam || payload.away || payload.away_name || payload.awayTeamName, "Time Visitante");

    // Filtrar partidas femininas ou e-soccer
    let rawLeague = normalizeStringValue(payload.league || payload.tournament?.name || payload.competition || payload.tournament || payload.leagueName, "Liga");
    let rawCountry = normalizeStringValue(payload.country || payload.leagueCountry || payload.tournament?.category?.name || payload.category, "Internacional");

    // Limpeza de prefixo de país duplicado na liga ("ÁFRICA DO SUL: Liga..." -> Country: África Do Sul, League: Liga...)
    if (rawLeague.includes(":")) {
      const parts = rawLeague.split(":");
      const prefix = parts[0].trim();
      const suffix = parts.slice(1).join(":").trim();
      if (prefix && (!rawCountry || rawCountry === "Internacional" || rawCountry.toLowerCase() === prefix.toLowerCase())) {
        rawCountry = prefix;
        rawLeague = suffix || rawLeague;
      }
    }

    if (isIgnoredLeague(rawLeague, rawCountry, homeName, awayName, this.operationalConfig?.crawlerConfig)) {
      return { success: true, matchId, message: "Partida ignorada pelos filtros do Crawler (Feminino / E-Soccer / Under / Custom)" };
    }

    const leagueTier: LeagueTier = getLeagueTier(rawLeague, rawCountry);
    const tierFilter = this.operationalConfig?.crawlerConfig?.tierFilter;
    if (tierFilter) {
      if (leagueTier === "Tier 3" && (tierFilter.enableTier3Rotation === false || (tierFilter as any).enableTier3 === false)) {
        return { success: true, matchId, message: `Partida ${rawLeague} ignorada (Tier 3 desativado nas configurações do Crawler).` };
      }
      if (leagueTier === "Tier 4" && (tierFilter.enableTier3Rotation === false || (tierFilter as any).enableTier4 === false)) {
        return { success: true, matchId, message: `Partida ${rawLeague} ignorada (Tier 4 desativado nas configurações do Crawler).` };
      }
      if (leagueTier === "Tier 2" && ((tierFilter as any).enableTier2 === false || (tierFilter.enableTier12Window === false && tierFilter.enableTier05PremiumLeagues === false))) {
        return { success: true, matchId, message: `Partida ${rawLeague} ignorada (Tier 2 desativado nas configurações do Crawler).` };
      }
      if (leagueTier === "Tier 1" && ((tierFilter as any).enableTier1 === false || (tierFilter.enableTier05PremiumLeagues === false && tierFilter.enableTier12Window === false))) {
        return { success: true, matchId, message: `Partida ${rawLeague} ignorada (Tier 1 desativado nas configurações do Crawler).` };
      }
    }

    const rawStatus = String(payload.status || payload.status_raw || payload.state || "LIVE").toUpperCase();
    const rawMinute = parseMinute(payload.minute ?? payload.min ?? payload.time ?? payload.currentMinute ?? 0);
    const finishedStatuses = ["FT", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "ENDED", "POSTPONED", "CANCELLED"];
    const isFinished = finishedStatuses.includes(rawStatus) || (rawMinute > 125);

    if (isFinished) {
      if (this.matches.has(matchId)) {
        this.matches.delete(matchId);
        this.pythonRuleTriggeredBuckets.delete(matchId);
      }
      return { success: true, matchId, message: "Partida finalizada removida da grade ao vivo." };
    }

    let existing = this.matches.get(matchId);
    const nowIso = new Date().toISOString();

    // Extrair placar com máxima resiliência
    let homeScore: number | undefined;
    let awayScore: number | undefined;

    if (payload.score) {
      if (typeof payload.score === "object") {
        if (payload.score.home !== undefined && payload.score.home !== null) homeScore = Number(payload.score.home);
        else if (payload.score.current_home !== undefined && payload.score.current_home !== null) homeScore = Number(payload.score.current_home);
        else if (Array.isArray(payload.score) && payload.score[0] !== undefined) homeScore = Number(payload.score[0]);

        if (payload.score.away !== undefined && payload.score.away !== null) awayScore = Number(payload.score.away);
        else if (payload.score.current_away !== undefined && payload.score.current_away !== null) awayScore = Number(payload.score.current_away);
        else if (Array.isArray(payload.score) && payload.score[1] !== undefined) awayScore = Number(payload.score[1]);
      }
    }

    if (homeScore === undefined) {
      const hCandidate = payload.homeScore ?? payload.home_score ?? payload.homeTeam?.score ?? payload.homeTeam?.goals;
      if (hCandidate !== undefined && hCandidate !== null && !isNaN(Number(hCandidate))) {
        homeScore = Number(hCandidate);
      }
    }
    if (awayScore === undefined) {
      const aCandidate = payload.awayScore ?? payload.away_score ?? payload.awayTeam?.score ?? payload.awayTeam?.goals;
      if (aCandidate !== undefined && aCandidate !== null && !isNaN(Number(aCandidate))) {
        awayScore = Number(aCandidate);
      }
    }

    // Se já existia a partida e não veio placar explícito no pacote, preservar o anterior
    if (existing) {
      if (homeScore === undefined || isNaN(homeScore)) homeScore = existing.score?.home ?? (existing.homeTeam as any)?.score ?? 0;
      if (awayScore === undefined || isNaN(awayScore)) awayScore = existing.score?.away ?? (existing.awayTeam as any)?.score ?? 0;
    } else {
      if (homeScore === undefined || isNaN(homeScore)) homeScore = 0;
      if (awayScore === undefined || isNaN(awayScore)) awayScore = 0;
    }

    const effectiveMinute = (existing && rawMinute === 0 && existing.minute > 0) ? existing.minute : rawMinute;

    // Regra/Dica operacional: se o jogo estiver com o tempo parado em 3 varreduras seguintes e acima de 90', esse jogo já terminou
    if (effectiveMinute >= 90) {
      const stag = this.matchMinuteStagnation.get(matchId) || { lastMinute: effectiveMinute, count: 0, lastSeenTime: Date.now() };
      if (stag.lastMinute === effectiveMinute) {
        stag.count += 1;
      } else {
        stag.lastMinute = effectiveMinute;
        stag.count = 1;
      }
      stag.lastSeenTime = Date.now();
      this.matchMinuteStagnation.set(matchId, stag);

      if (stag.count >= 3) {
        if (this.matches.has(matchId)) {
          this.matches.delete(matchId);
          this.pythonRuleTriggeredBuckets.delete(matchId);
          this.matchMinuteStagnation.delete(matchId);
        }
        return { success: true, matchId, message: "Partida finalizada e removida da grade (minuto estagnado >= 90' em 3 varreduras consecutivas)" };
      }
    } else {
      this.matchMinuteStagnation.delete(matchId);
    }

    // Extrair estatísticas com suporte a flat, nested, stats ou statistics
    const statsObj = payload.statistics || payload.stats || {};
    const possessionHome = Number(statsObj.possession?.home ?? payload.home_possession ?? payload.possession_home ?? 50);
    const possessionAway = Number(statsObj.possession?.away ?? payload.away_possession ?? (100 - possessionHome));

    const cornersHome = Number(statsObj.corners?.home ?? payload.home_corners ?? payload.corners_home ?? 0);
    const cornersAway = Number(statsObj.corners?.away ?? payload.away_corners ?? payload.corners_away ?? 0);

    const dangAttacksHome = Number(statsObj.dangerousAttacks?.home ?? payload.home_dangerous_attacks ?? payload.dangerous_attacks_home ?? 0);
    const dangAttacksAway = Number(statsObj.dangerousAttacks?.away ?? payload.away_dangerous_attacks ?? payload.dangerous_attacks_away ?? 0);

    const hasExplicitStats = payload.hasCompleteStats !== false;
    const dangAttacks10Home = Number(statsObj.dangerousAttacksLast10?.home ?? payload.home_dangerous_attacks_last10 ?? (hasExplicitStats ? Math.max(0, Math.round(dangAttacksHome * 0.22)) : 0));
    const dangAttacks10Away = Number(statsObj.dangerousAttacksLast10?.away ?? payload.away_dangerous_attacks_last10 ?? (hasExplicitStats ? Math.max(0, Math.round(dangAttacksAway * 0.22)) : 0));

    const attacksHome = Number(statsObj.attacks?.home ?? payload.home_attacks ?? dangAttacksHome);
    const attacksAway = Number(statsObj.attacks?.away ?? payload.away_attacks ?? dangAttacksAway);

    const sotHome = Number(statsObj.shotsOnTarget?.home ?? statsObj.sot?.home ?? payload.home_sot ?? payload.shots_on_target_home ?? 0);
    const sotAway = Number(statsObj.shotsOnTarget?.away ?? statsObj.sot?.away ?? payload.away_sot ?? payload.shots_on_target_away ?? 0);

    const soffHome = Number(statsObj.shotsOffTarget?.home ?? payload.home_shots_off_target ?? 0);
    const soffAway = Number(statsObj.shotsOffTarget?.away ?? payload.away_shots_off_target ?? 0);

    const blockedHome = Number(statsObj.blockedShots?.home ?? payload.home_blocked_shots ?? 0);
    const blockedAway = Number(statsObj.blockedShots?.away ?? payload.away_blocked_shots ?? 0);

    const totalShotsHome = Number(statsObj.totalShots?.home ?? payload.home_total_shots ?? (sotHome + soffHome + blockedHome));
    const totalShotsAway = Number(statsObj.totalShots?.away ?? payload.away_total_shots ?? (sotAway + soffAway + blockedAway));

    const xgHome = Number(statsObj.xg?.home ?? statsObj.xG?.home ?? payload.home_xg ?? payload.xg_home ?? 0.0);
    const xgAway = Number(statsObj.xg?.away ?? statsObj.xG?.away ?? payload.away_xg ?? payload.xg_away ?? 0.0);

    const xgotHome = Number(statsObj.xgot?.home ?? statsObj.xGOT?.home ?? payload.home_xgot ?? payload.xgot_home ?? 0.0);
    const xgotAway = Number(statsObj.xgot?.away ?? statsObj.xGOT?.away ?? payload.away_xgot ?? payload.xgot_away ?? 0.0);

    const bcHome = Number(statsObj.bigChances?.home ?? statsObj.bc?.home ?? payload.home_bc ?? payload.big_chances_home ?? 0);
    const bcAway = Number(statsObj.bigChances?.away ?? statsObj.bc?.away ?? payload.away_bc ?? payload.big_chances_away ?? 0);

    const yellowHome = Number(statsObj.yellowCards?.home ?? payload.home_yellow_cards ?? 0);
    const yellowAway = Number(statsObj.yellowCards?.away ?? payload.away_yellow_cards ?? 0);

    const redHome = Number(statsObj.redCards?.home ?? payload.home_red_cards ?? payload.homeTeam?.redCards ?? 0);
    const redAway = Number(statsObj.redCards?.away ?? payload.away_red_cards ?? payload.awayTeam?.redCards ?? 0);

    const foulsHome = Number(statsObj.fouls?.home ?? payload.home_fouls ?? 0);
    const foulsAway = Number(statsObj.fouls?.away ?? payload.away_fouls ?? 0);

    const savesHome = Number(statsObj.saves?.home ?? statsObj.goalkeeperSaves?.home ?? payload.home_saves ?? 0);
    const savesAway = Number(statsObj.saves?.away ?? statsObj.goalkeeperSaves?.away ?? payload.away_saves ?? 0);

    const dynamicPressure = calculateDynamicPressureIndex(
      {
        possession: { home: isNaN(possessionHome) ? 50 : possessionHome, away: isNaN(possessionAway) ? 50 : possessionAway },
        dangerousAttacks: { home: dangAttacksHome, away: dangAttacksAway },
        dangerousAttacksLast10: { home: dangAttacks10Home, away: dangAttacks10Away },
        attacks: { home: attacksHome, away: attacksAway },
        shotsOnTarget: { home: sotHome, away: sotAway },
        shotsOffTarget: { home: soffHome, away: soffAway },
        blockedShots: { home: blockedHome, away: blockedAway },
        corners: { home: cornersHome, away: cornersAway },
        xG: { home: xgHome, away: xgAway },
        xGOT: { home: xgotHome, away: xgotAway },
        bigChances: { home: bcHome, away: bcAway },
        saves: { home: savesHome, away: savesAway },
        apmLast10: {
          home: Number(statsObj.apmLast10?.home ?? payload.home_apm_last10 ?? 0),
          away: Number(statsObj.apmLast10?.away ?? payload.away_apm_last10 ?? 0),
        },
      },
      effectiveMinute,
      {
        score: { home: homeScore, away: awayScore },
        redCards: { home: redHome, away: redAway },
        windowMinutes: this.operationalConfig.trendAlertWindowMinutes || 10,
      },
      existing?.momentumTimeline
    );

    const pressureHome = payload.home_pressure !== undefined
      ? Number(payload.home_pressure)
      : dynamicPressure.home;

    const pressureAway = payload.away_pressure !== undefined
      ? Number(payload.away_pressure)
      : dynamicPressure.away;

    const rawCleanId = (payload.crawlerSourceId || matchId || "").replace(/^(?:fs_|FS_|g_1_)/i, "").trim();
    let matchUrl: string | undefined = undefined;
    if (rawCleanId && !rawCleanId.startsWith("match-")) {
      matchUrl = `https://www.flashscore.com.br/jogo/${rawCleanId}`;
    } else if (payload.url) {
      matchUrl = payload.url;
    }

    if (!existing) {
      // Build new match from crawler
      const leagueName = rawLeague || "Liga Importada (Python Crawler)";
      const countryName = rawCountry || "Internacional";

      const newMatch: Match = {
        id: matchId,
        league: leagueName,
        country: countryName,
        leagueCountry: countryName,
        url: matchUrl,
        startDate: payload.startDate || payload.startTime || payload.date || nowIso,
        startTime: payload.startTime || payload.time,
        stadium: payload.stadium || "Estádio",
        homeTeam: {
          name: homeName,
          shortName: payload.homeTeam?.shortName || homeName.substring(0, 3).toUpperCase(),
          logo: payload.homeTeam?.logo || payload.home_logo || "⚽",
          color: payload.homeTeam?.color || "#3B82F6",
          form: payload.homeTeam?.form || ["W", "D", "W"],
          score: homeScore,
        } as any,
        awayTeam: {
          name: awayName,
          shortName: payload.awayTeam?.shortName || awayName.substring(0, 3).toUpperCase(),
          logo: payload.awayTeam?.logo || payload.away_logo || "🛡️",
          color: payload.awayTeam?.color || "#EF4444",
          form: payload.awayTeam?.form || ["L", "D", "W"],
          score: awayScore,
        } as any,
        score: {
          home: homeScore,
          away: awayScore,
          htHome: payload.score?.htHome,
          htAway: payload.score?.htAway,
        },
        minute: (() => {
          if (isExplicitFirstHalfPayload(payload)) {
            return effectiveMinute > 45 ? 45 : Math.max(1, effectiveMinute);
          }
          if (isHalftimePayload(payload)) return 45;
          const norm = normalizeMatchStatus(payload.status, effectiveMinute, payload.stage_code ?? payload.stage);
          if (norm === "1T" && effectiveMinute > 45) return 45;
          if (norm === "HT") return 45;
          return effectiveMinute;
        })(),
        status: (() => {
          if (isExplicitFirstHalfPayload(payload)) return "1T";
          if (isHalftimePayload(payload)) return "HT";
          return normalizeMatchStatus(payload.status, effectiveMinute, payload.stage_code ?? payload.stage);
        })(),
        stats: {
          possession: { home: isNaN(possessionHome) ? 50 : possessionHome, away: isNaN(possessionAway) ? 50 : possessionAway },
          dangerousAttacks: { home: dangAttacksHome, away: dangAttacksAway },
          attacks: { home: attacksHome, away: attacksAway },
          shotsOnTarget: { home: sotHome, away: sotAway },
          shotsOffTarget: { home: soffHome, away: soffAway },
          blockedShots: { home: blockedHome, away: blockedAway },
          totalShots: { home: totalShotsHome, away: totalShotsAway },
          corners: { home: cornersHome, away: cornersAway },
          xG: { home: xgHome, away: xgAway },
          xGOT: { home: xgotHome, away: xgotAway },
          bigChances: { home: bcHome, away: bcAway },
          yellowCards: { home: yellowHome, away: yellowAway },
          redCards: { home: redHome, away: redAway },
          fouls: { home: foulsHome, away: foulsAway },
          passAccuracy: {
            home: Number(statsObj.passAccuracy?.home ?? payload.home_pass_accuracy ?? 80),
            away: Number(statsObj.passAccuracy?.away ?? payload.away_pass_accuracy ?? 80),
          },
          saves: { home: savesHome, away: savesAway },
          pressureIndex: { home: pressureHome, away: pressureAway },
          dangerousAttacksLast10: { home: dangAttacks10Home, away: dangAttacks10Away },
          apmLast10: {
            home: Number(statsObj.apmLast10?.home ?? payload.home_apm_last10 ?? 0),
            away: Number(statsObj.apmLast10?.away ?? payload.away_apm_last10 ?? 0),
          },
        },
        momentumTimeline: Array.isArray(payload.momentumTimeline)
          ? payload.momentumTimeline
          : [
              {
                minute: rawMinute,
                homePressure: pressureHome,
                awayPressure: pressureAway,
                diff: pressureHome - pressureAway,
              },
            ],
        events: Array.isArray(payload.events) ? payload.events : [],
        odds: payload.odds || undefined,
        source: "crawler",
        tier: leagueTier,
        lastUpdated: nowIso,
        crawlerSourceId: payload.crawlerSourceId || "node_engine_local",
        notes: payload.notes || "Dados transmitidos em tempo real via Node.js Native Engine.",
        hasCompleteStats: payload.hasCompleteStats !== undefined ? Boolean(payload.hasCompleteStats) : true,
      };

      this.matches.set(matchId, newMatch);

      if (!this.matchCornersHistory.has(matchId)) {
        const initialCorners: Array<{ minute: number; team: 'home' | 'away'; timestamp: number }> = [];
        if (payload.events && Array.isArray(payload.events)) {
          payload.events.forEach((ev: any) => {
            if (ev.type === "corner" || ev.type === "escanteio") {
              const evMin = typeof ev.minute === "number" ? ev.minute : parseInt(ev.minute) || effectiveMinute;
              initialCorners.push({ minute: evMin, team: ev.team === "away" ? "away" : "home", timestamp: Date.now() });
            }
          });
        }
        this.matchCornersHistory.set(matchId, initialCorners);
      }

      this.crawlerStatus.ingestedMatchesCount += 1;
      const initialGoalMin = getLastGoalMinute(newMatch);
      if (initialGoalMin !== null && initialGoalMin > 0) {
        newMatch.lastGoalMinute = initialGoalMin;
        this.matchLastGoalMinutes.set(matchId, initialGoalMin);
        const cooldownMin = this.operationalConfig.postGoalCooldownMinutes ?? 3;
        if ((newMatch.minute - initialGoalMin >= 0) && (newMatch.minute - initialGoalMin < cooldownMin)) {
          newMatch.lastGoalTimestamp = Date.now();
          this.matchLastGoalTimes.set(matchId, Date.now());
        }
      }
      this.addCrawlerLog("success", `Nova partida criada via crawler: [${countryName} - ${leagueName}] ${newMatch.homeTeam.name} x ${newMatch.awayTeam.name} (ID: ${matchId})`);
      this.evaluateAlertsForMatch(newMatch);
      return { success: true, matchId, message: "Partida criada e sincronizada com sucesso" };
    } else {
      // Check for Goal Delta & Red Card Delta between scans
      const prevHomeScore = existing.score.home;
      const prevAwayScore = existing.score.away;
      const prevHomeRed = existing.stats.redCards?.home ?? 0;
      const prevAwayRed = existing.stats.redCards?.away ?? 0;
      const prevHomeCorners = existing.stats.corners?.home ?? 0;
      const prevAwayCorners = existing.stats.corners?.away ?? 0;

      // Update existing match fields
      if (rawCountry) {
        existing.country = rawCountry;
        existing.leagueCountry = rawCountry;
      }
      if (rawLeague) existing.league = rawLeague;
      if (homeName && homeName !== "Time Mandante") existing.homeTeam.name = homeName;
      if (awayName && awayName !== "Time Visitante") existing.awayTeam.name = awayName;

      if (matchUrl) existing.url = matchUrl;

      if (payload.startDate || payload.startTime) {
        existing.startDate = payload.startDate || payload.startTime;
        existing.startTime = payload.startTime;
      }
      existing.score.home = homeScore;
      existing.score.away = awayScore;
      (existing.homeTeam as any).score = homeScore;
      (existing.awayTeam as any).score = awayScore;
      const isPayloadHt = isHalftimePayload(payload, existing.status);
      const is2TExplicit = isExplicitSecondHalfPayload(payload);
      const is1TExplicit = isExplicitFirstHalfPayload(payload);
      const isFinishedExplicit = isExplicitFinishedPayload(payload);

      if (isFinishedExplicit) {
        existing.status = "FT";
        existing.minute = Math.max(90, effectiveMinute);
      } else if (is2TExplicit) {
        existing.status = "2T";
        existing.minute = Math.max(46, effectiveMinute);
      } else if (is1TExplicit) {
        existing.status = "1T";
        if (effectiveMinute > 45) {
          existing.minute = 45;
          (existing as any).extraMinute = effectiveMinute - 45;
        } else {
          existing.minute = Math.max(1, effectiveMinute);
        }
      } else if (isPayloadHt) {
        existing.status = "HT";
        existing.minute = 45; // No HT, o minuto oficial da partida é SEMPRE 45!
      } else if (existing.status === "HT") {
        // Se a partida já estava em HT e não recebeu 2T nem 1T explícito, mantém HT
        existing.status = "HT";
        existing.minute = 45;
      } else {
        const normalized = normalizeMatchStatus(payload.status || existing.status, effectiveMinute, payload.stage_code ?? payload.stage);
        if (normalized === "1T") {
          existing.status = "1T";
          if (effectiveMinute > 45) {
            existing.minute = 45;
            (existing as any).extraMinute = effectiveMinute - 45;
          } else {
            existing.minute = effectiveMinute;
          }
        } else if (normalized === "HT") {
          existing.status = "HT";
          existing.minute = 45;
        } else {
          existing.status = normalized;
          existing.minute = effectiveMinute;
        }
      }

      existing.stats.possession = { home: possessionHome, away: possessionAway };
      existing.stats.corners = { home: cornersHome, away: cornersAway };

      // Rastrear histórico de escanteios por minuto para detecção de blitz
      if (!this.matchCornersHistory.has(matchId)) {
        this.matchCornersHistory.set(matchId, []);
      }
      const cornerHistoryList = this.matchCornersHistory.get(matchId)!;
      if (cornersHome > prevHomeCorners) {
        for (let i = 0; i < (cornersHome - prevHomeCorners); i++) {
          cornerHistoryList.push({ minute: effectiveMinute, team: "home", timestamp: Date.now() });
        }
      }
      if (cornersAway > prevAwayCorners) {
        for (let i = 0; i < (cornersAway - prevAwayCorners); i++) {
          cornerHistoryList.push({ minute: effectiveMinute, team: "away", timestamp: Date.now() });
        }
      }
      if (payload.events && Array.isArray(payload.events)) {
        payload.events.forEach((ev: any) => {
          if (ev.type === "corner" || ev.type === "escanteio") {
            const evMin = typeof ev.minute === "number" ? ev.minute : parseInt(ev.minute) || effectiveMinute;
            const evTeam = ev.team === "away" ? "away" : "home";
            const exists = cornerHistoryList.some((c) => c.minute === evMin && c.team === evTeam);
            if (!exists) {
              cornerHistoryList.push({ minute: evMin, team: evTeam, timestamp: Date.now() });
            }
          }
        });
      }

      existing.stats.dangerousAttacks = { home: dangAttacksHome, away: dangAttacksAway };
      existing.stats.dangerousAttacksLast10 = { home: dangAttacks10Home, away: dangAttacks10Away };
      existing.stats.attacks = { home: attacksHome, away: attacksAway };
      existing.stats.shotsOnTarget = { home: sotHome, away: sotAway };
      existing.stats.shotsOffTarget = { home: soffHome, away: soffAway };
      existing.stats.blockedShots = { home: blockedHome, away: blockedAway };
      existing.stats.totalShots = { home: totalShotsHome, away: totalShotsAway };
      existing.stats.xG = { home: xgHome, away: xgAway };
      existing.stats.xGOT = { home: xgotHome, away: xgotAway };
      existing.stats.bigChances = { home: bcHome, away: bcAway };
      existing.stats.yellowCards = { home: yellowHome, away: yellowAway };
      existing.stats.redCards = { home: redHome, away: redAway };
      existing.stats.fouls = { home: foulsHome, away: foulsAway };
      existing.stats.saves = { home: savesHome, away: savesAway };
      existing.stats.pressureIndex = { home: pressureHome, away: pressureAway };

      // Update events if present in payload
      if (payload.events && Array.isArray(payload.events)) {
        existing.events = payload.events;
      }

      // Dispatch Goal Delta Alert if score increased (prioritizing goal alert and resetting alert windows)
      if (homeScore > prevHomeScore || awayScore > prevAwayScore) {
        this.processGoalEvent(
          existing,
          prevHomeScore,
          prevAwayScore,
          homeScore,
          awayScore,
          effectiveMinute,
          payload.events
        );
      }

      if (payload.odds) {
        existing.odds = payload.odds;
      }

      // Add momentum point if provided or calculated
      const curHomeP = existing.stats.pressureIndex.home;
      const curAwayP = existing.stats.pressureIndex.away;
      const lastPoint = existing.momentumTimeline[existing.momentumTimeline.length - 1];
      if (!lastPoint || lastPoint.minute !== existing.minute) {
        existing.momentumTimeline.push({
          minute: existing.minute,
          homePressure: curHomeP,
          awayPressure: curAwayP,
          diff: curHomeP - curAwayP,
          homeDangerousAttack: Boolean(payload.homeDangerousAttack),
          awayDangerousAttack: Boolean(payload.awayDangerousAttack),
          homeShot: Boolean(payload.homeShot),
          awayShot: Boolean(payload.awayShot),
        });
        if (existing.momentumTimeline.length > 120) {
          existing.momentumTimeline = existing.momentumTimeline.slice(-100);
        }
      } else {
        lastPoint.homePressure = curHomeP;
        lastPoint.awayPressure = curAwayP;
        lastPoint.diff = curHomeP - curAwayP;
        if (payload.homeDangerousAttack) lastPoint.homeDangerousAttack = true;
        if (payload.awayDangerousAttack) lastPoint.awayDangerousAttack = true;
        if (payload.homeShot) lastPoint.homeShot = true;
        if (payload.awayShot) lastPoint.awayShot = true;
      }

      existing.source = "crawler";
      existing.tier = leagueTier;
      if (payload.hasCompleteStats !== undefined) {
        existing.hasCompleteStats = Boolean(payload.hasCompleteStats);
      }
      existing.lastUpdated = nowIso;
      (existing as any).lastCrawlerEngine = "node";
      this.addCrawlerLog("info", `Atualização recebida para ${existing.homeTeam.shortName || existing.homeTeam.name} x ${existing.awayTeam.shortName || existing.awayTeam.name} aos ${existing.minute}'`);
      this.evaluateAlertsForMatch(existing);
      return { success: true, matchId, message: "Partida atualizada com sucesso" };
    }
  }

  public addCrawlerLog(level: 'info' | 'success' | 'warn' | 'error', message: string) {
    this.crawlerStatus.logs.unshift({
      timestamp: new Date().toLocaleTimeString("pt-BR"),
      level,
      message,
    });
    if (this.crawlerStatus.logs.length > 50) {
      this.crawlerStatus.logs.pop();
    }
  }

  public isCrawlerInStartupCooldown(): boolean {
    if (!this.crawlerStatus.connected || this.crawlerStartupTime === 0) {
      return false;
    }
    const startupMinutes = this.operationalConfig.crawlerStartupCooldownMinutes ?? this.operationalConfig.crawlerConfig?.startupCooldownMinutes ?? 3;
    const cooldownMs = startupMinutes * 60 * 1000;
    const elapsed = Date.now() - this.crawlerStartupTime;
    if (elapsed < cooldownMs) {
      return true;
    }
    if (!this.crawlerStartupCooldownAnnounced) {
      this.crawlerStartupCooldownAnnounced = true;
      this.addCrawlerLog("success", `✅ Cooldown de inicialização do Crawler concluído (${startupMinutes} min). Grade consolidada e motor de alertas liberado.`);
    }
    return false;
  }

  public getCrawlerStartupRemainingSeconds(): number {
    if (!this.crawlerStatus.connected || this.crawlerStartupTime === 0) {
      return 0;
    }
    const startupMinutes = this.operationalConfig.crawlerStartupCooldownMinutes ?? this.operationalConfig.crawlerConfig?.startupCooldownMinutes ?? 3;
    const cooldownMs = startupMinutes * 60 * 1000;
    const elapsed = Date.now() - this.crawlerStartupTime;
    return elapsed < cooldownMs ? Math.ceil((cooldownMs - elapsed) / 1000) : 0;
  }

  public recordSessionId(sessionId?: string): boolean {
    if (!sessionId || typeof sessionId !== "string") return false;
    const cleanSessionId = sessionId.trim();
    if (!cleanSessionId) return false;

    // Se já havia uma sessão registrada e ela é diferente, uma nova instância do crawler foi iniciada!
    if (this.crawlerStatus.sessionId && this.crawlerStatus.sessionId !== cleanSessionId) {
      const prevSession = this.crawlerStatus.sessionId;
      this.addCrawlerLog(
        "info",
        `🔄 [Nova Sessão Crawler] Mudança de sessão detectada (${cleanSessionId} vs anterior ${prevSession}). Limpando dados da instância antiga.`
      );
      this.resetAllLiveStateAndCache(`Nova Sessão Crawler: ${cleanSessionId}`, cleanSessionId);
      return true;
    }

    this.crawlerStatus.sessionId = cleanSessionId;
    this.crawlerStatus.session_id = cleanSessionId;
    return false;
  }

  public recordHeartbeat(crawlerId?: string, activeMatches?: number, version?: string, sessionId?: string): void {
    if (sessionId) {
      this.recordSessionId(sessionId);
    }
    const wasConnected = this.crawlerStatus.connected;
    this.crawlerStatus.connected = true;
    this.crawlerStatus.activeInstances = 1;
    this.crawlerStatus.lastHeartbeat = new Date().toISOString();
    if (activeMatches !== undefined && activeMatches > 0) {
      this.crawlerStatus.ingestedMatchesCount = activeMatches;
    }

    if (!wasConnected || this.crawlerStartupTime === 0) {
      this.crawlerStartupTime = Date.now();
      this.crawlerStartupCooldownAnnounced = false;
      const startupMinutes = this.operationalConfig.crawlerStartupCooldownMinutes ?? this.operationalConfig.crawlerConfig?.startupCooldownMinutes ?? 3;
      this.addCrawlerLog("info", `🚀 Início do Crawler detectado. Cooldown de inicialização ativado por ${startupMinutes} minutos (180s) para consolidação da grade.`);
    }
  }

  public getCrawlerStatus(): CrawlerStatus {
    // Check if heartbeat is stale (> 90 seconds)
    if (this.crawlerStatus.lastHeartbeat) {
      const elapsed = Date.now() - new Date(this.crawlerStatus.lastHeartbeat).getTime();
      this.crawlerStatus.connected = elapsed < 90000;
      this.crawlerStatus.activeInstances = this.crawlerStatus.connected ? 1 : 0;
      if (!this.crawlerStatus.connected) {
        this.crawlerStartupTime = 0;
        this.crawlerStartupCooldownAnnounced = false;
      }
    }
    const isStartupActive = this.isCrawlerInStartupCooldown();
    const remainingSec = this.getCrawlerStartupRemainingSeconds();
    return {
      ...this.crawlerStatus,
      sessionId: this.crawlerStatus.sessionId || null,
      session_id: this.crawlerStatus.session_id || this.crawlerStatus.sessionId || null,
      isStartupCooldownActive: isStartupActive,
      startupCooldownRemainingSeconds: remainingSec,
      crawlerEngine: "node",
    };
  }

  public getActiveCrawlerMode(): "node" {
    return "node";
  }

  public disconnectCrawler(): void {
    this.crawlerStatus.connected = false;
    this.crawlerStatus.activeInstances = 0;
    this.crawlerStatus.lastHeartbeat = null;
    this.crawlerStatus.totalPacketsReceived = 0;
    this.crawlerStatus.ingestedMatchesCount = 0;
    this.crawlerStartupTime = 0;
    this.crawlerStartupCooldownAnnounced = false;
    this.crawlerStatus.sessionId = null;
    this.crawlerStatus.session_id = null;
    this.dismissedMatchIds.clear();
    this.clearAllMatches();
    this.addCrawlerLog("info", "Sinal de encerramento do Crawler recebido. Grade de partidas zerada com sucesso.");
  }

  public getMatches(): Match[] {
    // Update connected flag without wiping match grid on slight interval delays
    if (this.crawlerStatus.lastHeartbeat) {
      const elapsed = Date.now() - new Date(this.crawlerStatus.lastHeartbeat).getTime();
      if (elapsed >= 90000 && this.crawlerStatus.connected) {
        this.crawlerStatus.connected = false;
        this.crawlerStatus.activeInstances = 0;
      }
    }

    const finishedStatuses = ["FT", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "ENDED", "POSTPONED", "CANCELLED"];
    
    // Auto-prune truly finished matches (>125 min or explicit FT status)
    for (const [id, m] of this.matches.entries()) {
      if (finishedStatuses.includes(m.status?.toUpperCase()) || (Number(m.minute) > 125)) {
        this.matches.delete(id);
        this.pythonRuleTriggeredBuckets.delete(id);
      }
    }

    const list = Array.from(this.matches.values()).filter(
      (m) => !isIgnoredLeague(normalizeStringValue(m.league), normalizeStringValue(m.country || m.leagueCountry), m.homeTeam?.name, m.awayTeam?.name, this.operationalConfig?.crawlerConfig) &&
             !finishedStatuses.includes(String(m.status || '').toUpperCase()) &&
             (Number(m.minute) <= 125 || isNaN(Number(m.minute)))
    );
    list.forEach((m) => {
      m.league = normalizeStringValue(m.league, "Liga");
      m.country = normalizeStringValue(m.country, "Internacional");
      m.leagueCountry = normalizeStringValue(m.leagueCountry, m.country);
      if (!m.h2h) {
        m.h2h = generateH2HHistory(m.homeTeam.name, m.awayTeam.name, m.league, m.stadium);
      } else if (m.h2h.matches) {
        m.h2h.matches.forEach((hm) => {
          hm.competition = normalizeStringValue(hm.competition, "Campeonato");
        });
      }
    });
    return list;
  }

  public getMatch(id: string): Match | undefined {
    const m = this.matches.get(id);
    if (m) {
      m.league = normalizeStringValue(m.league, "Liga");
      m.country = normalizeStringValue(m.country, "Internacional");
      m.leagueCountry = normalizeStringValue(m.leagueCountry, m.country);
      if (!m.h2h) {
        m.h2h = generateH2HHistory(m.homeTeam.name, m.awayTeam.name, m.league, m.stadium);
      } else if (m.h2h.matches) {
        m.h2h.matches.forEach((hm) => {
          hm.competition = normalizeStringValue(hm.competition, "Campeonato");
        });
      }
    }
    return m;
  }

  public addOrUpdateMatch(match: Match): void {
    if (this.dismissedMatchIds.has(match.id)) {
      return;
    }
    const existing = this.matches.get(match.id);
    if (existing) {
      const prevHomeScore = existing.score?.home ?? 0;
      const prevAwayScore = existing.score?.away ?? 0;
      const newHomeScore = match.score?.home ?? 0;
      const newAwayScore = match.score?.away ?? 0;
      if (newHomeScore > prevHomeScore || newAwayScore > prevAwayScore) {
        this.processGoalEvent(
          match,
          prevHomeScore,
          prevAwayScore,
          newHomeScore,
          newAwayScore,
          match.minute,
          match.events
        );
      }
    }
    this.matches.set(match.id, match);
    this.evaluateAlertsForMatch(match);
  }

  public deleteMatch(id: string): boolean {
    this.dismissedMatchIds.add(id);
    const existed = this.matches.delete(id);
    this.pythonRuleTriggeredBuckets.delete(id);
    this.matchLastGoalTimes.delete(id);
    this.matchLastGoalMinutes.delete(id);
    this.matchMinuteStagnation.delete(id);
    this.matchCornersHistory.delete(id);
    this.alertLogs = this.alertLogs.filter((l) => l.matchId !== id);
    this.addCrawlerLog("info", `Partida [${id}] apagada pelo usuário (suprimida na sessão atual do crawler).`);
    return existed;
  }

  public dismissMatch(id: string): boolean {
    return this.deleteMatch(id);
  }

  public getDismissedMatchIds(): string[] {
    return Array.from(this.dismissedMatchIds);
  }

  public clearDismissedMatches(): void {
    this.dismissedMatchIds.clear();
  }

  public resetAllLiveStateAndCache(origin: string = "startup", newSessionId?: string): {
    clearedMatchesCount: number;
    message: string;
  } {
    const prevMatches = this.matches.size;
    this.matches.clear();
    this.dismissedMatchIds.clear();
    this.pythonRuleTriggeredBuckets.clear();
    this.matchMinuteStagnation.clear();
    this.matchLastGoalTimes.clear();
    this.matchLastGoalMinutes.clear();
    this.matchCornersHistory.clear();
    this.lastRuleTriggerByMatch.clear();
    this.crawlerStartupTime = Date.now();
    this.crawlerStartupCooldownAnnounced = false;
    this.crawlerStatus.connected = false;
    this.crawlerStatus.activeInstances = 0;
    this.crawlerStatus.lastHeartbeat = null;
    this.crawlerStatus.totalPacketsReceived = 0;
    this.crawlerStatus.ingestedMatchesCount = 0;
    if (newSessionId) {
      this.crawlerStatus.sessionId = newSessionId;
      this.crawlerStatus.session_id = newSessionId;
    }

    // Remover cache em disco do crawler se existir para forçar início do zero absoluto
    try {
      const catalogPath = path.join(process.cwd(), "data", "crawler_catalog_cache.json");
      if (fs.existsSync(catalogPath)) {
        fs.unlinkSync(catalogPath);
      }
    } catch (err) {
      console.warn("Aviso ao remover crawler_catalog_cache.json:", err);
    }

    this.addCrawlerLog(
      "info",
      `🧹 [Reset Total (${origin})] Grade de partidas, buffers transitórios e cache do catálogo zerados com sucesso. Começando do ZERO!`
    );

    return {
      clearedMatchesCount: prevMatches,
      message: `Reset executado por ${origin}. Grade, catálogo e cache zerados para início limpo.`,
    };
  }

  public resetCrawlerAndMatches(options: { preserveAlerts?: boolean } = { preserveAlerts: true }): {
    clearedMatchesCount: number;
    preservedAlertsCount: number;
    message: string;
  } {
    const previousMatchesCount = this.matches.size;
    const shouldPreserve = options.preserveAlerts !== false;
    const savedAlerts = shouldPreserve ? [...this.alertLogs] : [];

    // Limpa estado de partidas ao vivo e buffers transitórios do crawler
    this.matches.clear();
    this.dismissedMatchIds.clear();
    this.pythonRuleTriggeredBuckets.clear();
    this.matchMinuteStagnation.clear();
    this.matchLastGoalTimes.clear();
    this.matchLastGoalMinutes.clear();
    this.matchCornersHistory.clear();
    this.crawlerStartupTime = Date.now();
    this.crawlerStartupCooldownAnnounced = false;

    // Remove cache do catálogo em disco
    try {
      const catalogPath = path.join(process.cwd(), "data", "crawler_catalog_cache.json");
      if (fs.existsSync(catalogPath)) {
        fs.unlinkSync(catalogPath);
      }
    } catch (err) {
      console.warn("Aviso ao remover crawler_catalog_cache.json no reset:", err);
    }

    // Restaura ou preserva os alertas emitidos
    if (shouldPreserve) {
      this.alertLogs = savedAlerts;
    } else {
      this.alertLogs = [];
    }

    // Recarrega regras operacionais do disco para garantir consistência de sessão
    this.loadFromLocalConfig();

    this.addCrawlerLog(
      "info",
      `🔄 Reset forçado de crawler e partidas executado. ${savedAlerts.length} alerta(s) emitido(s) e sessão preservados.`
    );

    return {
      clearedMatchesCount: previousMatchesCount,
      preservedAlertsCount: this.alertLogs.length,
      message: `Crawler e grade de partidas resetados com sucesso. ${this.alertLogs.length} alertas e configurações preservadas.`,
    };
  }

  public clearAllMatches(): void {
    this.matches.clear();
    this.alertLogs = [];
    this.dismissedMatchIds.clear();
    this.pythonRuleTriggeredBuckets.clear();
  }

  public clearFinishedMatches(): number {
    let removed = 0;
    const finishedStatuses = [
      "FT", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "ENDED",
      "POSTPONED", "CANCELLED", "FIM", "FINALIZADO", "ABANDONED", "INTERROMPIDO"
    ];
    const now = Date.now();
    for (const [id, m] of this.matches.entries()) {
      const st = (m.status || "").toUpperCase();
      const isStatusFinished = finishedStatuses.some(s => st.includes(s));
      const minuteNum = Number(m.minute) || 0;
      const isMinuteFinished = minuteNum >= 95;
      const isStale = m.lastUpdated ? (now - new Date(m.lastUpdated).getTime() > 25 * 60 * 1000) : false;

      if (isStatusFinished || isMinuteFinished || isStale || minuteNum > 125) {
        this.matches.delete(id);
        this.pythonRuleTriggeredBuckets.delete(id);
        this.matchMinuteStagnation.delete(id);
        this.matchLastGoalTimes.delete(id);
        this.matchLastGoalMinutes.delete(id);
        this.matchCornersHistory.delete(id);
        removed++;
      }
    }
    // Na faxina, resetamos a lista de partidas ignoradas e estagnadas
    this.dismissedMatchIds.clear();
    this.addCrawlerLog("info", `🧹 Faxina de catálogo executada: ${removed} partida(s) finalizadas/estagnadas removidas da memória do app e catálogo redefinido.`);
    return removed;
  }

  public executeFaxina(): { removedFinishedCount: number; remainingMatchesCount: number; message: string } {
    // Também limpa o cache em disco do crawler
    try {
      const catalogPath = path.join(process.cwd(), "data", "crawler_catalog_cache.json");
      if (fs.existsSync(catalogPath)) {
        fs.unlinkSync(catalogPath);
      }
    } catch (err) {
      console.warn("Aviso ao limpar crawler_catalog_cache.json na faxina:", err);
    }
    const removed = this.clearFinishedMatches();
    return {
      removedFinishedCount: removed,
      remainingMatchesCount: this.matches.size,
      message: `Faxina executada no servidor do app! ${removed} jogo(s) encerrado(s) removido(s) da memória, cache em disco limpo e lista de exclusões manuais reiniciada.`
    };
  }

  public clearDemoMatches(): void {
    for (const [id, m] of this.matches.entries()) {
      if (m.source === "simulator") {
        this.matches.delete(id);
      }
    }
  }

  public getAlertRules(): AlertRule[] {
    return this.alertRules;
  }

  public saveAlertRule(rule: AlertRule): AlertRule {
    const idx = this.alertRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.alertRules[idx] = rule;
    } else {
      this.alertRules.push(rule);
    }

    if (
      rule.id === "rule-trend-super-pressure" ||
      rule.id === "python-trend-alert" ||
      rule.name.toLowerCase().includes("trend alert") ||
      rule.name.toLowerCase().includes("super pressão")
    ) {
      const pressCond = rule.conditions?.find(
        (c) => c.metric === "pressureTrendWindow" || (c.metric as string) === "pressure" || (c.metric as string) === "avgPressure"
      );
      const minCond = rule.conditions?.find((c) => c.metric === "minute");
      if (pressCond && pressCond.value !== undefined && !isNaN(Number(pressCond.value))) {
        const minAvg = Number(pressCond.value);
        const winMin = (pressCond as any).windowMinutes !== undefined && !isNaN(Number((pressCond as any).windowMinutes))
          ? Number((pressCond as any).windowMinutes)
          : 15;
        const minMin = minCond && minCond.value !== undefined && !isNaN(Number(minCond.value))
          ? Number(minCond.value)
          : 15;
        this.operationalConfig = {
          ...this.operationalConfig,
          trendAlertMinAvgPressure: minAvg,
          trendAlertWindowMinutes: winMin,
          trendAlertMinMinute: minMin,
          enableTrendAlert: rule.enabled !== false,
          superPressureConfig: {
            ...(this.operationalConfig.superPressureConfig || DEFAULT_RULES_CONFIG.superPressureConfig!),
            enabled: rule.enabled !== false,
            minAvgPressure: minAvg,
            windowMinutes: winMin,
            minMinute: minMin,
          },
        };
        localConfigManager.saveToDisk({
          alertRules: this.alertRules,
          operationalConfig: this.operationalConfig,
        });
        return rule;
      }
    }

    localConfigManager.saveToDisk({ alertRules: this.alertRules });
    return rule;
  }

  public deleteAlertRule(id: string): boolean {
    const initialLen = this.alertRules.length;
    this.alertRules = this.alertRules.filter((r) => r.id !== id);
    const removed = this.alertRules.length < initialLen;
    if (removed) {
      localConfigManager.saveToDisk({ alertRules: this.alertRules });
    }
    return removed;
  }

  public getAlertLogs(): AlertLog[] {
    const areGoalsHidden = this.operationalConfig.enableGoalAlerts === false || this.operationalConfig.showGoalAlerts === false;
    return this.alertLogs
      .filter((l) => !l.matchId || !this.dismissedMatchIds.has(l.matchId))
      .filter((l) => {
        if (areGoalsHidden && (l.ruleId === "live-goal-delta" || l.category === "goal_alert" || l.category === "goal")) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public deleteAlertLog(id: string): boolean {
    const initialLen = this.alertLogs.length;
    this.alertLogs = this.alertLogs.filter((l) => l.id !== id);
    return this.alertLogs.length < initialLen;
  }

  public markAlertsAsRead(): void {
    this.alertLogs.forEach((l) => (l.read = true));
  }

  public clearAlertLogs(): void {
    this.alertLogs = [];
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  // --- Custom Webhooks Management & Async Ingestion ---

  public getCustomWebhooks(): CustomWebhookEndpoint[] {
    return this.customWebhooks;
  }

  public getCustomWebhook(idOrSlug: string): CustomWebhookEndpoint | undefined {
    return this.customWebhooks.find((w) => w.id === idOrSlug || w.slug === idOrSlug);
  }

  public saveCustomWebhook(data: Partial<CustomWebhookEndpoint>): CustomWebhookEndpoint {
    const id = data.id || this.generateUniqueId("wh");
    const slug = (data.slug || data.name || "webhook")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existingIdx = this.customWebhooks.findIndex((w) => w.id === id || (w.slug === slug && w.id === data.id));

    const updatedWebhook: CustomWebhookEndpoint = {
      id,
      name: data.name || "Novo Webhook Customizado",
      slug: slug || `wh-${id}`,
      secretToken: data.secretToken || `sec_${Math.random().toString(36).substring(2, 12)}`,
      description: data.description || "Endpoint webhook customizado para ingestão de dados em tempo real.",
      active: data.active !== undefined ? data.active : true,
      asyncMode: data.asyncMode !== undefined ? data.asyncMode : true,
      autoTriggerAlerts: data.autoTriggerAlerts !== undefined ? data.autoTriggerAlerts : true,
      autoComputeMomentum: data.autoComputeMomentum !== undefined ? data.autoComputeMomentum : true,
      targetLeague: data.targetLeague || "Geral",
      createdAt: data.createdAt || new Date().toISOString(),
      totalCalls: data.totalCalls || 0,
      lastCallTimestamp: data.lastCallTimestamp || null,
      lastSourceIp: data.lastSourceIp || null,
      lastStatus: data.lastStatus || "ok",
    };

    if (existingIdx >= 0) {
      this.customWebhooks[existingIdx] = {
        ...this.customWebhooks[existingIdx],
        ...updatedWebhook,
      };
      this.addCrawlerLog("info", `Webhook customizado atualizado: [${updatedWebhook.name}] (/api/crawler/webhook/${updatedWebhook.slug})`);
      localConfigManager.saveToDisk({ customWebhooks: this.customWebhooks });
      return this.customWebhooks[existingIdx];
    } else {
      this.customWebhooks.unshift(updatedWebhook);
      this.addCrawlerLog("success", `Novo Webhook customizado registrado: [${updatedWebhook.name}] (/api/crawler/webhook/${updatedWebhook.slug})`);
      localConfigManager.saveToDisk({ customWebhooks: this.customWebhooks });
      return updatedWebhook;
    }
  }

  public deleteCustomWebhook(id: string): boolean {
    const idx = this.customWebhooks.findIndex((w) => w.id === id);
    if (idx >= 0) {
      const removed = this.customWebhooks.splice(idx, 1)[0];
      this.addCrawlerLog("warn", `Webhook customizado removido: [${removed.name}]`);
      localConfigManager.saveToDisk({ customWebhooks: this.customWebhooks });
      return true;
    }
    return false;
  }

  public getWebhookLogs(webhookIdOrSlug?: string): WebhookDeliveryLog[] {
    if (!webhookIdOrSlug || webhookIdOrSlug === "all") {
      return this.webhookLogs;
    }
    return this.webhookLogs.filter(
      (l) => l.webhookId === webhookIdOrSlug || l.webhookSlug === webhookIdOrSlug
    );
  }

  public clearWebhookLogs(webhookIdOrSlug?: string): void {
    if (!webhookIdOrSlug || webhookIdOrSlug === "all") {
      this.webhookLogs = [];
    } else {
      this.webhookLogs = this.webhookLogs.filter(
        (l) => l.webhookId !== webhookIdOrSlug && l.webhookSlug !== webhookIdOrSlug
      );
    }
  }

  /**
   * Process incoming payload from custom webhook endpoint.
   * Supports single match object, arrays of matches, or wrapped batch payload ({ matches, events, data, games }).
   */
  public handleCustomWebhookIngestion(
    slugOrId: string,
    payload: any,
    remoteIp: string = "127.0.0.1",
    providedToken?: string,
    _providedEngine?: string
  ): {
    statusCode: number;
    response: {
      success: boolean;
      status: string;
      async: boolean;
      webhook: string;
      jobId?: string;
      matchId?: string;
      processedCount?: number;
      message: string;
      timestamp: string;
    };
  } {
    const startTime = Date.now();
    const cleanSlug = (slugOrId || "flashscore-live").trim();

    // Look for matching webhook with case/hyphen tolerance
    let webhook = this.customWebhooks.find(
      (w) =>
        w.slug.toLowerCase() === cleanSlug.toLowerCase() ||
        w.id.toLowerCase() === cleanSlug.toLowerCase() ||
        w.slug.replace(/[-_]/g, "").toLowerCase() === cleanSlug.replace(/[-_]/g, "").toLowerCase()
    );

    // If webhook does not exist yet, auto-provision dynamically so no crawler packets are ever dropped!
    if (!webhook) {
      webhook = this.saveCustomWebhook({
        name: `Webhook ${cleanSlug}`,
        slug: cleanSlug,
        secretToken: "sec_flashscore_982a17f",
        description: `Webhook dinâmico para recepção em tempo real (${cleanSlug}).`,
        active: true,
        asyncMode: false,
        autoTriggerAlerts: true,
        autoComputeMomentum: true,
      });
    }

    if (!webhook.active) {
      this.addCrawlerLog("warn", `Tentativa de envio em Webhook desativado: [${webhook.name}]`);
      return {
        statusCode: 403,
        response: {
          success: false,
          status: "disabled",
          async: false,
          webhook: webhook.slug,
          message: `O Webhook '${webhook.name}' está atualmente desativado.`,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Token verification (accepts webhook secret, master apiKey, user crawler token, or open mode)
    const isTokenValid =
      !webhook.secretToken ||
      !providedToken ||
      providedToken === webhook.secretToken ||
      providedToken === this.apiKey ||
      providedToken.startsWith("ft_") ||
      providedToken.startsWith("sec_");

    if (!isTokenValid) {
      this.addCrawlerLog("error", `Token de autorização inválido no Webhook [${webhook.name}]`);
      this.recordWebhookLog({
        id: this.generateUniqueId("wlog"),
        webhookId: webhook.id,
        webhookSlug: webhook.slug,
        timestamp: new Date().toISOString(),
        sourceIp: remoteIp,
        status: "error",
        statusCode: 401,
        processingTimeMs: Date.now() - startTime,
        payloadSummary: "Falha de autenticação: Token inválido",
        asyncProcessed: false,
      });
      return {
        statusCode: 401,
        response: {
          success: false,
          status: "unauthorized",
          async: false,
          webhook: webhook.slug,
          message: "Token de segurança do Webhook inválido ou ausente.",
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Update telemetry counters
    webhook.totalCalls += 1;
    webhook.lastCallTimestamp = new Date().toISOString();
    webhook.lastSourceIp = remoteIp;
    webhook.lastStatus = "ok";

    // Extrair lista de partidas (suporta item único, array de partidas ou objeto embrulhado)
    let matchItems: any[] = [];
    if (Array.isArray(payload)) {
      matchItems = payload;
    } else if (payload && Array.isArray(payload.matches)) {
      matchItems = payload.matches;
    } else if (payload && Array.isArray(payload.events)) {
      matchItems = payload.events;
    } else if (payload && Array.isArray(payload.data)) {
      matchItems = payload.data;
    } else if (payload && Array.isArray(payload.games)) {
      matchItems = payload.games;
    } else if (payload && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      matchItems = [payload.data];
    } else if (payload && payload.match && typeof payload.match === "object") {
      matchItems = [payload.match];
    } else if (payload && payload.event && typeof payload.event === "object") {
      matchItems = [payload.event];
    } else if (payload && typeof payload === "object") {
      matchItems = [payload];
    }

    const jobId = this.generateUniqueId("job");

    // Processar imediatamente para garantia de atualização instantânea da grade
    let processedSuccessCount = 0;
    let lastMatchId = "";
    let lastMatchTitle = "";

    for (const item of matchItems) {
      if (item && typeof item === "object") {
        const res = this.ingestCrawlerMatchUpdate(item, remoteIp);
        if (res.success) {
          processedSuccessCount++;
          lastMatchId = res.matchId;
          const h = item.homeTeam?.name || item.home || "Time A";
          const a = item.awayTeam?.name || item.away || "Time B";
          lastMatchTitle = `${h} x ${a}`;
        }
      }
    }

    const duration = Date.now() - startTime;
    const matchSummary = matchItems.length === 1
      ? `Partida ${lastMatchId || payload?.id} (${lastMatchTitle})`
      : `Batch de ${matchItems.length} partidas (${processedSuccessCount} processadas com sucesso)`;

    this.recordWebhookLog({
      id: this.generateUniqueId("wlog"),
      webhookId: webhook.id,
      webhookSlug: webhook.slug,
      timestamp: new Date().toISOString(),
      sourceIp: remoteIp,
      matchId: lastMatchId || undefined,
      matchTitle: lastMatchTitle || undefined,
      status: processedSuccessCount > 0 ? "success" : "warning",
      statusCode: processedSuccessCount > 0 ? 200 : 202,
      processingTimeMs: duration,
      payloadSummary: `Ingestão: ${matchSummary}`,
      asyncProcessed: false,
    });

    return {
      statusCode: 200,
      response: {
        success: true,
        status: "processed",
        async: false,
        webhook: webhook.slug,
        jobId,
        matchId: lastMatchId || undefined,
        processedCount: processedSuccessCount,
        message: `${processedSuccessCount} partida(s) processada(s) e sincronizada(s) no painel ao vivo com sucesso.`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private recordWebhookLog(log: WebhookDeliveryLog) {
    this.webhookLogs.unshift(log);
    if (this.webhookLogs.length > 80) {
      this.webhookLogs.pop();
    }
  }

  // --- Operational Rules Config & Analysis API ---
  public getOperationalConfig(): OperationalRulesConfig {
    return { ...this.operationalConfig };
  }

  public updateOperationalConfig(config: Partial<OperationalRulesConfig>): OperationalRulesConfig {
    const currentCrawler = this.operationalConfig.crawlerConfig || DEFAULT_RULES_CONFIG.crawlerConfig!;
    const incomingCrawler = config.crawlerConfig;
    const mergedCrawler = incomingCrawler
      ? {
          ...currentCrawler,
          ...incomingCrawler,
          customExcludedKeywords: Array.isArray(incomingCrawler.customExcludedKeywords)
            ? incomingCrawler.customExcludedKeywords
            : currentCrawler.customExcludedKeywords,
          tierFilter: {
            ...currentCrawler.tierFilter,
            ...(incomingCrawler.tierFilter || {}),
          },
        }
      : currentCrawler;

    // Parâmetro Central do Radar (Fonte Única da Verdade: Regra 3:1)
    // Se chancesPerGoalRatio vier diretamente ou dentro de sub-configs, unifica como fonte única da verdade
    let targetRatio = this.operationalConfig.chancesPerGoalRatio ?? 3.0;
    if (config.chancesPerGoalRatio !== undefined) {
      targetRatio = Number(config.chancesPerGoalRatio);
    } else if (config.tripleDebtConfig?.chancesPerGoalRatio !== undefined) {
      targetRatio = Number(config.tripleDebtConfig.chancesPerGoalRatio);
    } else if (config.goalDebtClassicConfig?.chancesPerGoalRatio !== undefined) {
      targetRatio = Number(config.goalDebtClassicConfig.chancesPerGoalRatio);
    }
    targetRatio = Math.max(1.0, targetRatio || 3.0);

    // Unificação Geral do Cooldown Pós-Gol (Fonte Única da Verdade: 3 minutos / 180s)
    let targetCooldown = this.operationalConfig.postGoalCooldownMinutes ?? 3;
    if (config.postGoalCooldownMinutes !== undefined) {
      targetCooldown = Number(config.postGoalCooldownMinutes);
    } else if (config.superBackDominanteConfig?.postGoalCooldownMinutes !== undefined) {
      targetCooldown = Number(config.superBackDominanteConfig.postGoalCooldownMinutes);
    } else if (config.goalDebtClassicConfig?.postGoalCooldownMinutes !== undefined) {
      targetCooldown = Number(config.goalDebtClassicConfig.postGoalCooldownMinutes);
    } else if (config.goalDebtClassicConfig?.cooldownSecondsAfterGoal !== undefined) {
      targetCooldown = Math.max(1, Math.round(Number(config.goalDebtClassicConfig.cooldownSecondsAfterGoal) / 60));
    }
    targetCooldown = Math.max(1, targetCooldown || 3);

    const mergedTripleDebt = {
      ...(this.operationalConfig.tripleDebtConfig || DEFAULT_RULES_CONFIG.tripleDebtConfig!),
      ...(config.tripleDebtConfig || {}),
      chancesPerGoalRatio: targetRatio,
    };
    const mergedGoalDebtClassic = {
      ...(this.operationalConfig.goalDebtClassicConfig || DEFAULT_RULES_CONFIG.goalDebtClassicConfig!),
      ...(config.goalDebtClassicConfig || {}),
      chancesPerGoalRatio: targetRatio,
      postGoalCooldownMinutes: targetCooldown,
      cooldownSecondsAfterGoal: targetCooldown * 60,
    };
    const mergedSuperBack = {
      ...(this.operationalConfig.superBackDominanteConfig || DEFAULT_RULES_CONFIG.superBackDominanteConfig!),
      ...(config.superBackDominanteConfig || {}),
      postGoalCooldownMinutes: targetCooldown,
    };

    this.operationalConfig = {
      ...this.operationalConfig,
      ...config,
      chancesPerGoalRatio: targetRatio,
      postGoalCooldownMinutes: targetCooldown,
      tripleDebtConfig: mergedTripleDebt,
      goalDebtClassicConfig: mergedGoalDebtClassic,
      superBackDominanteConfig: mergedSuperBack,
      ccRateMaxMinutes: config.ccRateMaxMinutes !== undefined ? Number(config.ccRateMaxMinutes) : this.operationalConfig.ccRateMaxMinutes,
      ccRateForteMaxMinutes: config.ccRateForteMaxMinutes !== undefined ? Number(config.ccRateForteMaxMinutes) : this.operationalConfig.ccRateForteMaxMinutes,
      debtMarginXG: config.debtMarginXG !== undefined ? Number(config.debtMarginXG) : this.operationalConfig.debtMarginXG,
      crawlerConfig: mergedCrawler,
    };

    // Sincronização e consistência dos parâmetros de Super Pressão Contínua (Trend Alert)
    if (config.superPressureConfig) {
      const sp = config.superPressureConfig;
      this.operationalConfig.trendAlertMinAvgPressure = sp.minAvgPressure ?? this.operationalConfig.trendAlertMinAvgPressure ?? 68;
      this.operationalConfig.trendAlertMinConsistencyPct = sp.minConsistencyPct ?? this.operationalConfig.trendAlertMinConsistencyPct ?? 65;
      this.operationalConfig.trendAlertWindowMinutes = sp.windowMinutes ?? this.operationalConfig.trendAlertWindowMinutes ?? 15;
      this.operationalConfig.trendAlertMinMinute = sp.minMinute ?? this.operationalConfig.trendAlertMinMinute ?? 15;
      this.operationalConfig.trendAlertPointThreshold = sp.pointThreshold ?? this.operationalConfig.trendAlertPointThreshold ?? 60;
    } else if (config.trendAlertMinAvgPressure !== undefined || config.trendAlertWindowMinutes !== undefined) {
      this.operationalConfig.superPressureConfig = {
        ...(this.operationalConfig.superPressureConfig || DEFAULT_RULES_CONFIG.superPressureConfig!),
        minAvgPressure: config.trendAlertMinAvgPressure ?? this.operationalConfig.superPressureConfig?.minAvgPressure ?? 68,
        minConsistencyPct: config.trendAlertMinConsistencyPct ?? this.operationalConfig.superPressureConfig?.minConsistencyPct ?? 65,
        windowMinutes: config.trendAlertWindowMinutes ?? this.operationalConfig.superPressureConfig?.windowMinutes ?? 15,
        minMinute: config.trendAlertMinMinute ?? this.operationalConfig.superPressureConfig?.minMinute ?? 15,
        pointThreshold: config.trendAlertPointThreshold ?? this.operationalConfig.superPressureConfig?.pointThreshold ?? 60,
      };
    }

    // Sincronizar também a regra 'rule-trend-super-pressure' em this.alertRules
    const trendRuleIdx = this.alertRules.findIndex(
      (r) =>
        r.id === "rule-trend-super-pressure" ||
        r.id === "python-trend-alert" ||
        r.name.toLowerCase().includes("trend alert") ||
        r.name.toLowerCase().includes("super pressão")
    );
    if (trendRuleIdx >= 0) {
      const sp = this.operationalConfig.superPressureConfig;
      const minAvg = sp?.minAvgPressure ?? this.operationalConfig.trendAlertMinAvgPressure ?? 68;
      const winMin = sp?.windowMinutes ?? this.operationalConfig.trendAlertWindowMinutes ?? 15;
      const minMin = sp?.minMinute ?? this.operationalConfig.trendAlertMinMinute ?? 15;
      const consPct = sp?.minConsistencyPct ?? this.operationalConfig.trendAlertMinConsistencyPct ?? 65;
      this.alertRules[trendRuleIdx] = {
        ...this.alertRules[trendRuleIdx],
        enabled: sp?.enabled !== false && this.operationalConfig.enableTrendAlert !== false,
        description: `Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=${minAvg}% de média com consistência >=${consPct}%) no histórico do momentum em ${winMin}m.`,
        conditions: [
          { metric: "pressureTrendWindow", operator: ">=", value: minAvg, windowMinutes: winMin },
          { metric: "minute", operator: ">=", value: minMin },
        ],
      };
    }

    this.addCrawlerLog(
      "info",
      `Regras Operacionais atualizadas: Ratio Central Unificado ${this.operationalConfig.chancesPerGoalRatio}:1 (Radar, Diagnóstico, Dívida de Gols & Trinca) | Super Pressão: >=${this.operationalConfig.trendAlertMinAvgPressure ?? 68}% em ${this.operationalConfig.trendAlertWindowMinutes ?? 15}m | Crawler Watchlist: ${this.operationalConfig.crawlerConfig?.maxWatchlistSize || 15} slots`
    );
    localConfigManager.saveToDisk({
      operationalConfig: this.operationalConfig,
      alertRules: this.alertRules,
    });

    // Expurgar imediatamente da grade em memória partidas ignoradas ou com Tiers desativados
    this.purgeIgnoredAndDisabledMatches();

    // Se a visualização de gols estiver marcada como Ocultos, expurga os alertas de gol existentes do feed
    if (this.operationalConfig.enableGoalAlerts === false || this.operationalConfig.showGoalAlerts === false) {
      this.alertLogs = this.alertLogs.filter(
        (l) => l.ruleId !== "live-goal-delta" && l.category !== "goal_alert" && l.category !== "goal"
      );
    }

    return { ...this.operationalConfig };
  }

  public updateCrawlerConfig(crawlerConfig: any): any {
    const updated = this.updateOperationalConfig({
      crawlerConfig: {
        ...(this.operationalConfig.crawlerConfig || {}),
        ...crawlerConfig,
      } as any,
    });
    return updated.crawlerConfig;
  }

  public getMatchRulesAnalysis(matchId: string): MatchRulesAnalysis | null {
    const match = this.matches.get(matchId);
    if (!match) return null;
    return evaluateAllMatchRules(match, this.operationalConfig);
  }

  public getAllMatchesRulesAnalysis(): Record<string, MatchRulesAnalysis> {
    const map: Record<string, MatchRulesAnalysis> = {};
    this.matches.forEach((match, id) => {
      map[id] = evaluateAllMatchRules(match, this.operationalConfig);
    });
    return map;
  }
}

export const matchStore = new MatchStore();
