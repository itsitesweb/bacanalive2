// server/rulesEngine.ts
import {
  Match,
  OperationalRulesConfig,
  Codigo31Evaluation,
  Codigo31AlertType,
  TripleDebtEvaluation,
  PressaoVendavelEvaluation,
  DominantTrailingEvaluation,
  ImminentGoalEvaluation,
  TrendAlertEvaluation,
  AmbasMarcamEvaluation,
  TraditionalRuleSignal,
  MatchRulesAnalysis,
  TacticalTipData,
  BettingTipData,
  DEFAULT_V12_CONFIG,
  DEFAULT_SUPER_PRESSURE_CONFIG,
  DEFAULT_PRESSAO_VENDAVEL_CONFIG,
  DEFAULT_TRIPLE_DEBT_CONFIG,
  DEFAULT_DOMINANT_TRAILING_CONFIG,
  DEFAULT_GOAL_DEBT_CLASSIC_CONFIG,
  DEFAULT_HALFTIME_VALUE_CONFIG,
  GoalDebtClassicConfig,
  GoalDebtClassicEvaluation,
  HalfTimeValueConfig,
  HalfTimeValueEvaluation,
  PressaoVendavelConfig,
  TripleDebtConfig,
  DominantTrailingConfig,
  SuperBackDominanteConfig,
  DEFAULT_SUPER_BACK_DOMINANTE_CONFIG,
  SuperBackDominanteEvaluation,
  AmbasMarcamConfig,
  DEFAULT_AMBAS_MARCAM_CONFIG,
  ImminentGoalConfig,
  DEFAULT_IMMINENT_GOAL_CONFIG,
} from "../src/types";

// Default operational rules configuration
export const DEFAULT_RULES_CONFIG: OperationalRulesConfig = {
  chancesPerGoalRatio: 2.5, // Ratio 2.5:1
  ccRateMaxMinutes: 15.0, // Máximo 15 min/CC
  ccRateForteMaxMinutes: 12.0, // Máximo 12 min/CC para Forte/Premium
  debtMarginXG: 1.5, // Dívida xG/xGOT (gols + 1.5)
  imminentGoalThresholdPct: 50, // Limiar padrão de variação nos últimos 5 min
  minAlertProbabilityPct: 50, // Faixa mínima de probabilidade para disparar alerta (%)
  maxAlertProbabilityPct: 100, // Faixa máxima de probabilidade para disparar alerta (%)
  enableCodigo31: false,
  enableTripleDebt: true,
  tripleDebtConfig: DEFAULT_TRIPLE_DEBT_CONFIG,
  enablePressaoVendavel: true,
  pressaoVendavelConfig: DEFAULT_PRESSAO_VENDAVEL_CONFIG,
  enableDominantTrailing: true,
  dominantTrailingConfig: DEFAULT_DOMINANT_TRAILING_CONFIG,
  enableSuperBackDominante: true,
  superBackDominanteConfig: DEFAULT_SUPER_BACK_DOMINANTE_CONFIG,
  enableGoalDebtClassic: true,
  goalDebtClassicConfig: DEFAULT_GOAL_DEBT_CLASSIC_CONFIG,
  enableHalfTimeValue: true,
  halfTimeValueConfig: DEFAULT_HALFTIME_VALUE_CONFIG,
  enableV12OverBack: true,
  v12Config: DEFAULT_V12_CONFIG,
  enableImminentGoal: true,
  imminentGoalConfig: DEFAULT_IMMINENT_GOAL_CONFIG,
  enableTrendAlert: true,
  trendAlertWindowMinutes: 10,
  trendAlertMinAvgPressure: 70,
  trendAlertMinConsistencyPct: 70,
  trendAlertMinMinute: 10,
  trendAlertPointThreshold: 65,
  superPressureConfig: DEFAULT_SUPER_PRESSURE_CONFIG,
  // Estratégias de Análise Tática e Pressão
  enableAmbasMarcamBTTS: true,
  ambasMarcamConfig: DEFAULT_AMBAS_MARCAM_CONFIG,
  postGoalCooldownMinutes: 1,
  crawlerStartupCooldownMinutes: 0.5,
  enableGoalAlerts: true,
  showGoalAlerts: true,
  crawlerConfig: {
    mode: "node",
    maxWatchlistSize: 20,
    tier3ReservedSlots: 2,
    discoveryIntervalSeconds: 30,
    concurrentWorkers: 4,
    routeResourceBlock: true,
    enableBackgroundDiscovery: true,
    autoPruneMinutes: 10,
    noStatsBackoffMinutes: 1,
    minEntryMinute: 1,
    maxEntryMinute: 85,
    antiSpamCooldownMinutes: 1,
    startupCooldownMinutes: 0.5,
    matchReadTimeoutMs: 5000,
    discoveryTimeoutMs: 12000,
    excludeEsoccer: true,
    excludeWomen: true,
    excludeYouthUnder: true,
    customExcludedKeywords: [],
    tierFilter: {
      enableTier0Signals: true,
      enableTier05PremiumLeagues: true,
      enableTier12Window: true,
      enableTier3Rotation: true,
      enableTier1: true,
      enableTier2: true,
      enableTier3: true,
      enableTier4: true,
    },
  },
  soundAlertsEnabled: true,
  minMinuteAlert: 3,
  maxMinuteAlert: 85,
  viteDebugMode: false,
};

// ──────────────────────────────────────────────────────────────────────────
// GERADOR DE INSIGHTS E RECOMENDAÇÕES TÁTICAS (ANÁLISE ESPORTIVA PURA)
// ──────────────────────────────────────────────────────────────────────────
export function getLastGoalMinute(match: Match): number | null {
  if (match.lastGoalMinute !== undefined && match.lastGoalMinute !== null) {
    const num = Number(match.lastGoalMinute);
    if (!isNaN(num) && num >= 0) return num;
  }
  if (match.events && Array.isArray(match.events)) {
    const goalEvents = match.events.filter(
      (ev) => ev.type === "goal" || ev.type === "penalty_scored"
    );
    if (goalEvents.length > 0) {
      const lastEv = goalEvents[goalEvents.length - 1];
      const min = Number(lastEv.minute);
      if (!isNaN(min) && min >= 0) {
        return min;
      }
    }
  }
  return null;
}

/**
 * Função compartilhada de resguardo pós-gol (Cooldown pós-gol).
 * Verifica se a partida teve um gol recente (tanto pelo relógio do jogo quanto por timestamp real)
 * para suprimir disparos precipitados imediatamente após um gol.
 */
export function isWithinPostGoalSuppression(
  match: Match,
  postGoalMinutes: number = 3,
  postGoalSeconds: number = 180
): boolean {
  // 1. Verificação por timestamp real de recebimento do gol (resguardo em tempo real: 3 minutos / 180s)
  if (match.lastGoalTimestamp && postGoalSeconds > 0) {
    const elapsedSeconds = (Date.now() - match.lastGoalTimestamp) / 1000;
    if (elapsedSeconds < postGoalSeconds) {
      return true;
    }
  }

  // 2. Verificação por minuto de jogo (relógio do árbitro: 3 minutos)
  const lastGoalMin = getLastGoalMinute(match);
  if (lastGoalMin !== null && postGoalMinutes > 0) {
    const minSinceGoal = (match.minute || 0) - lastGoalMin;
    if (minSinceGoal >= 0 && minSinceGoal < postGoalMinutes) {
      return true;
    }
  }

  return false;
}

export function generateBettingTip(params: {
  marketCode: string;
  marketName: string;
  targetSelection: string;
  probabilityPct: number;
  confidence: 'extrema' | 'alta' | 'moderada';
  reasoning: string;
  actionText: string;
  match: Match;
  config?: OperationalRulesConfig;
}): TacticalTipData {
  const prob = Math.max(12, Math.min(96, Math.round(params.probabilityPct)));
  return {
    marketCode: params.marketCode,
    marketName: params.marketName,
    targetSelection: params.targetSelection,
    probabilityPct: prob,
    confidence: params.confidence,
    reasoning: params.reasoning,
    actionText: params.actionText,
  };
}

/**
 * Validação e formatação matemática da linha de Over dinâmico:
 * Garante que nunca seja recomendada uma linha de Over inferior ou igual aos gols já marcados.
 * Exemplo: Se o jogo já está 3-1 (4 gols), Over 2.5 não existe mais, adaptando para Over 4.5 ou Próximo Gol.
 */
export function formatDynamicOverSelection(totalGoals: number, preferredLine = 2.5): { marketCode: string; targetSelection: string } {
  const minValidLine = totalGoals + 0.5;
  const chosenLine = preferredLine > totalGoals ? preferredLine : minValidLine;
  const lineFormatted = chosenLine % 1 === 0 ? chosenLine.toFixed(0) : chosenLine.toFixed(1);
  return {
    marketCode: `OVER_${lineFormatted.replace(".", "_")}`,
    targetSelection: `Over ${lineFormatted} Gols`,
  };
}

// Titles and messages mapping from Python codigo_3_1.py
export const ALERT_DISPLAY_MAP: Record<Codigo31AlertType, { emoji: string; label: string }> = {
  over_bilateral_premium: { emoji: "🟢", label: "PREMIUM 3.1.2 — OVER BILATERAL PESADO" },
  over_premium_xg:        { emoji: "🟢", label: "PREMIUM 3.1.2 — CC + xG CONFIRMADOS" },
  over_premium:           { emoji: "🟢", label: "PREMIUM 3.1.2 — GOL MUITO DEVENDO" },
  back_premium:           { emoji: "🟢", label: "PREMIUM 3.1.2 — BACK DOMINANTE EXTREMO" },
  over_forte:             { emoji: "🟠", label: "FORTE 3.1.2 — GOL DEVENDO" },
  back_forte:             { emoji: "🟠", label: "FORTE 3.1.2 — BACK DOMINANTE" },
  over_watch:             { emoji: "📡", label: "WATCH 3.1.2 — RADAR DE GOL" },
  back_watch:             { emoji: "📡", label: "WATCH 3.1.2 — RADAR DE BACK DOMINANTE" },
};

export const MESSAGE_TEMPLATES_MAP: Record<Codigo31AlertType, { motivo: string; leitura: string }> = {
  over_watch: {
    motivo: "Produção suficiente para gol, mas o placar ainda não pagou.",
    leitura: "Radar ativo. Não é entrada automática. Aguardar nova CC ou evolução para FORTE/PREMIUM.",
  },
  over_forte: {
    motivo: "Produção ofensiva forte, rate qualificado e placar abaixo da produção.",
    leitura: "Sinal operacional. Avaliar entrada em gol/Over conforme odd e contexto.",
  },
  over_premium: {
    motivo: "Volume alto de chances claras e placar claramente atrasado.",
    leitura: "Sinal premium de gol atrasado. Prioridade alta para análise de entrada.",
  },
  over_premium_xg: {
    motivo: "Chances claras e xG confirmam alta produção ofensiva com placar abaixo.",
    leitura: "Sinal premium confirmado por duas métricas. Prioridade máxima.",
  },
  over_bilateral_premium: {
    motivo: "Os dois times já criaram 3+ chances claras. Jogo aberto dos dois lados.",
    leitura: "Padrão forte para Over/BTTS. Não é sinal de Back; é sinal de jogo aberto.",
  },
  back_watch: {
    motivo: "Um time começou a abrir vantagem em chances claras, mas o placar ainda não refletiu.",
    leitura: "Radar ativo. Não é entrada automática. Aguardar confirmação de domínio para FORTE/PREMIUM.",
  },
  back_forte: {
    motivo: "Dominante tem vantagem clara em chances, mas o placar ainda não pagou essa produção.",
    leitura: "Sinal operacional para Back do dominante. Confirmar pressão atual antes da entrada.",
  },
  back_premium: {
    motivo: "Domínio extremo em chances claras, adversário sem produção relevante e placar contra a lógica do jogo.",
    leitura: "Sinal premium para reação do dominante. Prioridade alta.",
  },
};

const CODIGO_PRIORITY: Codigo31AlertType[] = [
  "over_bilateral_premium",
  "over_premium_xg",
  "over_premium",
  "back_premium",
  "over_forte",
  "back_forte",
  "over_watch",
  "back_watch",
];

// Helper to extract Big Chances (with fallback estimation if needed)
export function getMatchBigChances(match: Match): { home: number; away: number; total: number } {
  if (match.stats.bigChances) {
    const home = Math.max(0, Math.round(match.stats.bigChances.home || 0));
    const away = Math.max(0, Math.round(match.stats.bigChances.away || 0));
    return { home, away, total: home + away };
  }
  // Heuristic fallback if bigChances not yet populated: based on shots on target and xG
  const homeEst = Math.max(0, Math.floor((match.stats.shotsOnTarget.home * 0.4) + (match.stats.xG.home * 0.7)));
  const awayEst = Math.max(0, Math.floor((match.stats.shotsOnTarget.away * 0.4) + (match.stats.xG.away * 0.7)));
  return { home: homeEst, away: awayEst, total: homeEst + awayEst };
}

// ──────────────────────────────────────────────────────────────────────────
// 1. REGRA DIAGNÓSTICO (COM RATIO DINÂMICO AJUSTÁVEL)
// ──────────────────────────────────────────────────────────────────────────
export function evaluateCodigo31(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): Codigo31Evaluation {
  const ratio = Math.max(1.0, config.chancesPerGoalRatio || 3.0);
  const bc = getMatchBigChances(match);
  const homeBc = bc.home;
  const awayBc = bc.away;
  const totalCc = bc.total;

  const homeScore = match.score.home || 0;
  const awayScore = match.score.away || 0;
  const totalGoals = homeScore + awayScore;
  const minute = match.minute || 1;

  const ccRate = totalCc > 0 ? Number((minute / totalCc).toFixed(1)) : 999.0;
  // Expected goals according to configured ratio (e.g. totalCc / 3.0)
  const expectedGoalsOver = Math.floor(totalCc / ratio);
  const isDevendoGol = totalGoals < expectedGoalsOver;
  const saldoGolsDevidos = Math.max(0, expectedGoalsOver - totalGoals);

  // Dominant team detection
  let dominantTeam: 'home' | 'away' | null = null;
  let dominantName = "";
  let dominantScore = 0;
  let oppScore = 0;
  let domCc = 0;
  let oppCc = 0;

  if (homeBc > awayBc) {
    dominantTeam = "home";
    dominantName = match.homeTeam.name;
    dominantScore = homeScore;
    oppScore = awayScore;
    domCc = homeBc;
    oppCc = awayBc;
  } else if (awayBc > homeBc) {
    dominantTeam = "away";
    dominantName = match.awayTeam.name;
    dominantScore = awayScore;
    oppScore = homeScore;
    domCc = awayBc;
    oppCc = homeBc;
  }

  const ccDiff = domCc - oppCc;
  const expectedDominantGoalsByCc = domCc >= ratio ? Math.floor(domCc / ratio) : 0;
  const isDominantDevendoGol = expectedDominantGoalsByCc > 0 && dominantScore < expectedDominantGoalsByCc;
  const saldoGolsDominante = Math.max(0, expectedDominantGoalsByCc - dominantScore);
  const domLead = dominantScore - oppScore;
  const isDominantTrailing = dominantScore < oppScore; // Dominante perdendo no placar

  const totalXg = (match.stats.xG.home || 0) + (match.stats.xG.away || 0);

  // Evaluate all candidates
  const candidates: Array<{
    alertType: Codigo31AlertType;
    level: 'watch' | 'forte' | 'premium';
    market: 'over' | 'back';
    reason: string;
    bucket: number;
  }> = [];

  // Resguardo Pós-Gol Unificado (Cooldown geral após qualquer gol na partida)
  const postGoalCooldown = config.postGoalCooldownMinutes ?? 3;
  const isPostGoalCooldown = isWithinPostGoalSuppression(match, postGoalCooldown);

  // Minimum threshold based on ratio (e.g., if ratio=3, base CC threshold is 3)
  const minWatchCc = Math.max(2, Math.round(ratio));
  const minForteCc = Math.max(3, Math.round(ratio * 1.33));
  const minPremiumCc = Math.max(5, Math.round(ratio * 2.0));

  // Se a partida estiver sob resguardo pós-gol (cooldown de 3m / 180s), suprime novos alertas imediatos
  if (!isPostGoalCooldown) {
    // 1. OVER BILATERAL PESADO
    if (homeBc >= minWatchCc && awayBc >= minWatchCc && totalCc >= minPremiumCc && isDevendoGol) {
      candidates.push({
        alertType: "over_bilateral_premium",
        level: "premium",
        market: "over",
        reason: "OVER_PREMIUM_BILATERAL",
        bucket: expectedGoalsOver,
      });
    }

    // 2. OVER PREMIUM + xG
    if (totalCc >= minPremiumCc && ccRate <= config.ccRateForteMaxMinutes && isDevendoGol && totalXg >= 2.5) {
      candidates.push({
        alertType: "over_premium_xg",
        level: "premium",
        market: "over",
        reason: "OVER_PREMIUM_CC_XG",
        bucket: expectedGoalsOver,
      });
    }

    // 3. OVER PREMIUM
    if (totalCc >= minPremiumCc && ccRate <= config.ccRateForteMaxMinutes && isDevendoGol) {
      candidates.push({
        alertType: "over_premium",
        level: "premium",
        market: "over",
        reason: "OVER_PREMIUM",
        bucket: expectedGoalsOver,
      });
    }

    // 4. BACK PREMIUM (CORREÇÃO: Bloqueado se dominante estiver perdendo [domLead < 0] ou já vencendo por 2+ [domLead >= 2])
    if (
      dominantTeam &&
      !isDominantTrailing &&
      domLead >= 0 &&
      domLead < 2 &&
      domCc >= minPremiumCc &&
      oppCc === 0 &&
      ccDiff >= minPremiumCc &&
      isDominantDevendoGol
    ) {
      candidates.push({
        alertType: "back_premium",
        level: "premium",
        market: "back",
        reason: "BACK_PREMIUM_EXTREMO",
        bucket: expectedDominantGoalsByCc,
      });
    }

    // 5. OVER FORTE
    if (totalCc >= minForteCc && ccRate <= config.ccRateForteMaxMinutes && isDevendoGol) {
      candidates.push({
        alertType: "over_forte",
        level: "forte",
        market: "over",
        reason: "OVER_FORTE",
        bucket: expectedGoalsOver,
      });
    }

    // 6. BACK FORTE (CORREÇÃO: Bloqueado se dominante estiver perdendo [domLead < 0] ou já vencendo por 2+ [domLead >= 2])
    if (
      dominantTeam &&
      !isDominantTrailing &&
      domLead >= 0 &&
      domLead < 2 &&
      domCc >= minForteCc &&
      oppCc <= 1 &&
      ccDiff >= minForteCc &&
      isDominantDevendoGol
    ) {
      candidates.push({
        alertType: "back_forte",
        level: "forte",
        market: "back",
        reason: "BACK_FORTE",
        bucket: expectedDominantGoalsByCc,
      });
    }

    // 7. OVER WATCH (Regra Original)
    if (totalCc >= minWatchCc && ccRate <= config.ccRateMaxMinutes && isDevendoGol) {
      candidates.push({
        alertType: "over_watch",
        level: "watch",
        market: "over",
        reason: "OVER_WATCH",
        bucket: expectedGoalsOver,
      });
    }

    // 8. BACK WATCH (CORREÇÃO: Bloqueado se dominante estiver perdendo [domLead < 0] ou já vencendo por 2+ [domLead >= 2])
    if (
      dominantTeam &&
      !isDominantTrailing &&
      domLead >= 0 &&
      domLead < 2 &&
      domCc >= minWatchCc &&
      oppCc <= 1 &&
      ccDiff >= minWatchCc &&
      isDominantDevendoGol
    ) {
      candidates.push({
        alertType: "back_watch",
        level: "watch",
        market: "back",
        reason: "BACK_WATCH",
        bucket: expectedDominantGoalsByCc,
      });
    }
  }

  const homeExpectedGoalsByCc = Math.floor(homeBc / ratio);
  const awayExpectedGoalsByCc = Math.floor(awayBc / ratio);
  const homeDebt = Math.max(0, homeExpectedGoalsByCc - homeScore);
  const awayDebt = Math.max(0, awayExpectedGoalsByCc - awayScore);

  let debtorTeamName = "";
  let debtorTeamSide: 'home' | 'away' | 'both' | null = null;

  if (homeDebt > 0 && awayDebt > 0) {
    debtorTeamSide = 'both';
    debtorTeamName = `Ambos (${match.homeTeam.name} e ${match.awayTeam.name})`;
  } else if (homeDebt > 0) {
    debtorTeamSide = 'home';
    debtorTeamName = match.homeTeam.name;
  } else if (awayDebt > 0) {
    debtorTeamSide = 'away';
    debtorTeamName = match.awayTeam.name;
  } else if (dominantTeam) {
    if (homeBc > awayBc) {
      debtorTeamSide = 'home';
      debtorTeamName = match.homeTeam.name;
    } else if (awayBc > homeBc) {
      debtorTeamSide = 'away';
      debtorTeamName = match.awayTeam.name;
    } else {
      debtorTeamSide = 'both';
      debtorTeamName = `Ambos (${match.homeTeam.name} e ${match.awayTeam.name})`;
    }
  } else {
    debtorTeamSide = 'both';
    debtorTeamName = `Ambos (${match.homeTeam.name} e ${match.awayTeam.name})`;
  }

  // Sort by priority
  let chosenAlert: (typeof candidates)[0] | null = null;
  if (candidates.length > 0) {
    candidates.sort((a, b) => CODIGO_PRIORITY.indexOf(a.alertType) - CODIGO_PRIORITY.indexOf(b.alertType));
    chosenAlert = candidates[0];
  }

  const alertType = chosenAlert ? chosenAlert.alertType : null;
  const shouldAlert = Boolean(chosenAlert);
  
  let dynamicLabel = alertType ? ALERT_DISPLAY_MAP[alertType].label : (isDevendoGol ? "GOL EM ATRASO" : "SALDO EM DIA");
  if (alertType === "over_premium" && (debtorTeamSide === "home" || debtorTeamSide === "away")) {
    dynamicLabel = `PREMIUM 3.1.2 — GOL MUITO DEVENDO (${debtorTeamName})`;
  } else if (alertType === "over_forte" && (debtorTeamSide === "home" || debtorTeamSide === "away")) {
    dynamicLabel = `FORTE 3.1.2 — GOL DEVENDO (${debtorTeamName})`;
  }

  const display = alertType ? { emoji: ALERT_DISPLAY_MAP[alertType].emoji, label: dynamicLabel } : { emoji: "⚖️", label: dynamicLabel };
  const defaultReason = isPostGoalCooldown
    ? "RESGUARDO_POS_GOL_COOLDOWN"
    : isDominantTrailing && isDominantDevendoGol
    ? "DOMINANTE_PERDENDO_BACK_BLOQUEADO"
    : isDevendoGol
    ? "GOL_DEVENDO_RADAR"
    : "SALDO_EM_DIA";

  const template = alertType ? MESSAGE_TEMPLATES_MAP[alertType] : {
    motivo: isPostGoalCooldown
      ? `Partida sob resguardo pós-gol (cooldown unificado de ${postGoalCooldown}m). Aguardando estabilização para novos alertas.`
      : isDominantTrailing && isDominantDevendoGol
      ? `Time dominante (${dominantName}) com ${domCc} CCs está perdendo no placar (${dominantScore}-${oppScore}). Alerta de Back bloqueado por proteção de zebra.`
      : isDevendoGol
      ? `Total de ${totalCc} CC para ${totalGoals} gols (devendo ${saldoGolsDevidos} gol).`
      : "Produção ofensiva convertida em gols dentro do esperado.",
    leitura: isPostGoalCooldown
      ? "Resguardo pós-gol ativo — novas entradas pausadas temporariamente."
      : isDominantTrailing && isDominantDevendoGol
      ? "Favorito perdendo — aguardar reação ofensiva comprovada e não entrar em Back cego."
      : isDevendoGol
      ? "Observar evolução de finalizações na área."
      : "Sem anomalia de conversão.",
  };

  // Build Telegram formatted message (Python format with each data point on a separate line)
  let formattedTelegram = "";
  if (alertType) {
    if (chosenAlert?.market === "back") {
      formattedTelegram = `${display.emoji} ${display.label}
Partida: ${match.homeTeam.name} ${homeScore}-${awayScore} ${match.awayTeam.name}
Minuto: ${minute}'
Time Dominante: ${dominantName}
CC: ${homeBc}x${awayBc}
Diferença CC: ${ccDiff}
Ritmo: ${ccRate} min/CC
Esperado Dominante (Ratio ${ratio.toFixed(1)}:1): ${expectedDominantGoalsByCc}
Gols Dominante: ${dominantScore}
Dívida: ${saldoGolsDominante} gol(s)`;
    } else {
      const xgLine = totalXg > 0 ? `xG Total: ${totalXg.toFixed(2)}\n` : "";
      const debtorLine = debtorTeamName ? `Time Devedor: ${debtorTeamName}\n` : "";
      formattedTelegram = `${display.emoji} ${display.label}
Partida: ${match.homeTeam.name} ${homeScore}-${awayScore} ${match.awayTeam.name}
Minuto: ${minute}'
${debtorLine}CC Total: ${homeBc}x${awayBc} = ${totalCc}
Ritmo: ${ccRate} min/CC
${xgLine}Esperado por CC (Ratio ${ratio.toFixed(1)}:1): ${expectedGoalsOver}
Gols Reais: ${totalGoals}
Dívida de Gols: ${saldoGolsDevidos} gol(s)`;
    }
  }

  let bettingTip: BettingTipData | undefined = undefined;
  if (alertType) {
    const isBack = chosenAlert?.market === "back";
    const prob = chosenAlert?.level === "premium" ? 84 : chosenAlert?.level === "forte" ? 75 : 67;
    bettingTip = generateBettingTip({
      marketCode: isBack ? "BACK_DOMINANTE" : "OVER_GOLS_DEVENDO",
      marketName: isBack ? `Back ${dominantName} (Diagnóstico)` : `Over ${totalGoals + 0.5} Gols`,
      targetSelection: isBack ? `Vitória ${dominantName} / HA 0.0` : `Mais de ${totalGoals + 0.5} Gols`,
      probabilityPct: prob,
      confidence: chosenAlert?.level === "premium" ? "extrema" : chosenAlert?.level === "forte" ? "alta" : "moderada",
      reasoning: template.motivo,
      actionText: isBack ? `Entrada em Back ${dominantName} no mercado 1X2 / Handicap` : `Entrada no mercado de Over Gols à frente`,
      match,
      config,
    });
  }

  return {
    alertType,
    shouldAlert,
    reason: chosenAlert ? chosenAlert.reason : defaultReason,
    level: chosenAlert ? chosenAlert.level : null,
    market: chosenAlert ? chosenAlert.market : null,
    bucket: chosenAlert ? chosenAlert.bucket : expectedGoalsOver,
    totalCc,
    homeCc: homeBc,
    awayCc: awayBc,
    totalGoals,
    homeScore,
    awayScore,
    ccRate,
    expectedGoalsByCc: expectedGoalsOver,
    isDevendoGol,
    saldoGolsDevidos,
    ratioUsed: ratio,
    dominantTeam,
    dominantName,
    dominantCc: domCc,
    oppCc,
    ccDiff,
    expectedDominantGoalsByCc,
    isDominantDevendoGol,
    saldoGolsDominante,
    isDominantTrailing,
    dominantLead: domLead,
    debtorTeamName,
    debtorTeamSide,
    title: display.label,
    emoji: display.emoji,
    motivo: template.motivo,
    leitura: template.leitura,
    formattedTelegram,
    bettingTip,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. TRIPLO FILTRO DE DÍVIDA DE GOLS (TRIPLE DEBT FILTER)
// ──────────────────────────────────────────────────────────────────────────
export function evaluateTripleDebt(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): TripleDebtEvaluation {
  const tdCfg = config.tripleDebtConfig || DEFAULT_TRIPLE_DEBT_CONFIG;
  const isEnabled = config.enableTripleDebt !== false && tdCfg.enabled !== false;
  if (!isEnabled) {
    return {
      tripleDebtFormed: false,
      scope: 'none',
      scopeSide: null,
      ccInScope: 0,
      xgInScope: 0,
      xgotInScope: 0,
      goalsInScope: 0,
      expectedGoalsByCc: 0,
      ccDebt: false,
      xgDebt: false,
      xgotDebt: false,
      failedReasons: ['regra_desativada'],
      blockReason: 'regra_desativada',
      wouldBlockSignal: true,
      statusBadge: '⚖️ Regra Desativada',
    };
  }

  const bc = getMatchBigChances(match);
  const hCc = bc.home;
  const aCc = bc.away;
  const totalCc = bc.total;

  const hXg = match.stats.xG.home || 0;
  const aXg = match.stats.xG.away || 0;
  const totalXg = hXg + aXg;

  const hXgot = match.stats.xGOT?.home ?? Number((hXg * 0.85).toFixed(2));
  const aXgot = match.stats.xGOT?.away ?? Number((aXg * 0.85).toFixed(2));
  const totalXgot = hXgot + aXgot;

  const hG = match.score.home || 0;
  const aG = match.score.away || 0;
  const totalGoals = hG + aG;

  const debtMargin = tdCfg.debtMarginXG ?? config.debtMarginXG ?? 1.0;
  // Parâmetro Central do Radar (Fonte Única da Verdade: Regra 3:1)
  const ratio = Math.max(1.0, config.chancesPerGoalRatio || 3.0);
  const minUniCc = tdCfg.minUnilateralCc ?? 3;
  const minBiCc = tdCfg.minBilateralCc ?? 3;
  const minBiXg = tdCfg.minBilateralXg ?? 1.0;
  const minBiXgot = tdCfg.minBilateralXgot ?? 1.0;
  const minMinute = tdCfg.minMinute ?? 15;

  const minute = match.minute || 0;
  if (minute < minMinute) {
    return {
      tripleDebtFormed: false,
      scope: 'none',
      scopeSide: null,
      ccInScope: 0,
      xgInScope: 0,
      xgotInScope: 0,
      goalsInScope: totalGoals,
      expectedGoalsByCc: 0,
      ratioUsed: ratio,
      ccDebt: false,
      xgDebt: false,
      xgotDebt: false,
      failedReasons: [`minute < ${minMinute}`],
      blockReason: `minute < ${minMinute}`,
      wouldBlockSignal: true,
      statusBadge: '⚖️ Minuto Inferior ao Mínimo',
    };
  }

  // Unilateral checks
  const hHits = (hCc >= minUniCc ? 1 : 0) +
    (hCc / (totalCc || 1) >= 0.7 ? 1 : 0) +
    (hXg / (totalXg || 1) >= 0.65 ? 1 : 0) +
    (hXgot / (totalXgot || 1) >= 0.65 ? 1 : 0) +
    (aCc <= 1 || (hCc - aCc) >= 2 ? 1 : 0);

  const aHits = (aCc >= minUniCc ? 1 : 0) +
    (aCc / (totalCc || 1) >= 0.7 ? 1 : 0) +
    (aXg / (totalXg || 1) >= 0.65 ? 1 : 0) +
    (aXgot / (totalXgot || 1) >= 0.65 ? 1 : 0) +
    (hCc <= 1 || (aCc - hCc) >= 2 ? 1 : 0);

  let scope: 'unilateral' | 'bilateral' | 'none' = 'none';
  let scopeSide: 'home' | 'away' | 'total' | null = null;
  let ccInScope = 0;
  let xgInScope = 0;
  let xgotInScope = 0;
  let goalsInScope = 0;

  if (hCc >= minUniCc && hHits >= 4) {
    scope = 'unilateral';
    scopeSide = 'home';
    ccInScope = hCc;
    xgInScope = hXg;
    xgotInScope = hXgot;
    goalsInScope = hG;
  } else if (aCc >= minUniCc && aHits >= 4) {
    scope = 'unilateral';
    scopeSide = 'away';
    ccInScope = aCc;
    xgInScope = aXg;
    xgotInScope = aXgot;
    goalsInScope = aG;
  } else if (totalCc >= minBiCc && totalXg >= minBiXg && totalXgot >= minBiXgot) {
    scope = 'bilateral';
    scopeSide = 'total';
    ccInScope = totalCc;
    xgInScope = totalXg;
    xgotInScope = totalXgot;
    goalsInScope = totalGoals;
  }

  const expectedGoalsByCc = Math.floor(ccInScope / ratio);
  const ccDebt = expectedGoalsByCc > goalsInScope;
  const xgDebt = xgInScope >= goalsInScope + debtMargin;
  const xgotDebt = xgotInScope >= goalsInScope + debtMargin;

  const failedReasons: string[] = [];
  if (!ccDebt) failedReasons.push("triple_debt_failed_cc");
  if (!xgDebt) failedReasons.push("triple_debt_failed_xg");
  if (!xgotDebt) failedReasons.push("triple_debt_failed_xgot");

  const tripleDebtFormed = scope !== 'none' && ccDebt && xgDebt && xgotDebt;
  let blockReason: string | null = null;

  if (scope === 'none') {
    blockReason = "scope_not_classified";
  } else if (failedReasons.length === 3) {
    blockReason = "no_real_debt";
  } else if (failedReasons.length > 0) {
    blockReason = failedReasons.join("+");
  }

  const debtorTeamName = scope === 'unilateral'
    ? (scopeSide === 'home' ? match.homeTeam.name : match.awayTeam.name)
    : scope === 'bilateral'
    ? 'Ambos os Times'
    : undefined;

  let statusBadge = "⚖️ Sem Dívida Trinca";
  if (tripleDebtFormed) {
    statusBadge = scope === 'unilateral' && debtorTeamName
      ? `💎 TRINCA DE DÍVIDAS ATIVA (${debtorTeamName})`
      : `💎 TRINCA DE DÍVIDAS ATIVA (${scope.toUpperCase()})`;
  } else if (ccDebt || xgDebt || xgotDebt) {
    statusBadge = `⚠️ Dívida Parcial (${[ccDebt ? 'CC' : '', xgDebt ? 'xG' : '', xgotDebt ? 'xGOT' : ''].filter(Boolean).join('+')})`;
  }

  let bettingTip: BettingTipData | undefined = undefined;
  if (tripleDebtFormed) {
    const isUni = scope === 'unilateral';
    const targetName = debtorTeamName || 'Equipe Devedora';
    bettingTip = generateBettingTip({
      marketCode: isUni ? "TRIPLE_DEBT_UNILATERAL" : "TRIPLE_DEBT_OVER",
      marketName: isUni ? `Próximo Gol (${targetName})` : `Over Gols (+0.5 Gol)`,
      targetSelection: isUni ? `Gol de ${targetName}` : `Mais de ${goalsInScope + 0.5} Gols`,
      probabilityPct: isUni ? 85 : 88,
      confidence: 'extrema',
      reasoning: `Tríplice Dívida Ativa: CC (${ccInScope}), xG (${xgInScope}) e xGOT (${xgotInScope}) com saldo atrasado de ${goalsInScope} gols marcados.`,
      actionText: isUni ? `Entrada em Próximo Gol / Back de ${targetName}` : `Entrada em Over Gols à frente`,
      match,
      config,
    });
  }

  return {
    tripleDebtFormed,
    scope,
    scopeSide,
    debtorTeamName,
    ccInScope,
    xgInScope: Number(xgInScope.toFixed(2)),
    xgotInScope: Number(xgotInScope.toFixed(2)),
    goalsInScope,
    expectedGoalsByCc,
    ratioUsed: ratio,
    ccDebt,
    xgDebt,
    xgotDebt,
    failedReasons,
    blockReason,
    wouldBlockSignal: !tripleDebtFormed,
    statusBadge,
    bettingTip,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. PRESSÃO VENDÁVEL (BACK ALTO + LAY BAIXO)
// ──────────────────────────────────────────────────────────────────────────
export function evaluatePressaoVendavel(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): PressaoVendavelEvaluation {
  const minute = match.minute || 0;
  const hG = match.score.home || 0;
  const aG = match.score.away || 0;
  const bc = getMatchBigChances(match);

  const pvCfg = config.pressaoVendavelConfig || DEFAULT_PRESSAO_VENDAVEL_CONFIG;
  const isEnabled = config.enablePressaoVendavel !== false && pvCfg.enabled !== false;
  if (!isEnabled) {
    return {
      qualified: false,
      side: null,
      team: '',
      minute,
      score: `${hG}-${aG}`,
      tese: '',
      fails: ['regra_desativada'],
      metrics: {
        cc: 0,
        xg: 0,
        xgot: 0,
        shots: 0,
        sot: 0,
        sotPct: 0,
        posse: 0,
        toquesArea: 0,
        oppXg: 0,
      },
    };
  }

  const minMinute = pvCfg.minMinute ?? 25;
  const maxMinute = pvCfg.maxMinute ?? 70;
  const minXg = pvCfg.minXg ?? 1.0;
  const minCc = pvCfg.minCc ?? 2;
  const minXgot = pvCfg.minXgot ?? 0.8;
  const maxOppXg = pvCfg.maxOppXg ?? 0.7;
  const minPossession = pvCfg.minPossessionPct ?? 60;
  const minSot = pvCfg.minSotPct ?? 0.35;
  const maxDeficit = pvCfg.maxDeficitGoals ?? 1;

  const evalSide = (side: 'home' | 'away') => {
    const isHome = side === 'home';
    const ownG = isHome ? hG : aG;
    const oppG = isHome ? aG : hG;
    const ownDiff = ownG - oppG;
    const team = isHome ? match.homeTeam.name : match.awayTeam.name;

    const cc = isHome ? bc.home : bc.away;
    const xg = isHome ? match.stats.xG.home : match.stats.xG.away;
    const xgot = isHome
      ? (match.stats.xGOT?.home ?? xg * 0.85)
      : (match.stats.xGOT?.away ?? xg * 0.85);

    const shots = isHome ? (match.stats.shotsOnTarget.home + match.stats.shotsOffTarget.home) : (match.stats.shotsOnTarget.away + match.stats.shotsOffTarget.away);
    const sot = isHome ? match.stats.shotsOnTarget.home : match.stats.shotsOnTarget.away;
    const sotPct = shots > 0 ? Number((sot / shots).toFixed(2)) : 0;
    const oppXg = isHome ? match.stats.xG.away : match.stats.xG.home;

    const posse = isHome ? match.stats.possession.home : match.stats.possession.away;
    const toq = isHome ? (match.stats.boxTouches?.home ?? Math.round(match.stats.dangerousAttacks.home * 0.4)) : (match.stats.boxTouches?.away ?? Math.round(match.stats.dangerousAttacks.away * 0.4));
    const toqOpp = isHome ? (match.stats.boxTouches?.away ?? Math.round(match.stats.dangerousAttacks.away * 0.4)) : (match.stats.boxTouches?.home ?? Math.round(match.stats.dangerousAttacks.home * 0.4));

    const fails: string[] = [];
    if (minute < minMinute) fails.push(`minute < ${minMinute}`);
    if (minute > maxMinute) fails.push(`minute > ${maxMinute}`);
    if (ownDiff > 0) fails.push("ja_vencendo");
    if (ownDiff < -maxDeficit) fails.push(`desvantagem_maior_que_${maxDeficit}_gol(s)`);
    if (cc < minCc) fails.push(`cc < ${minCc}`);
    if (xg < minXg) fails.push(`xg < ${minXg}`);
    if (xgot < minXgot) fails.push(`xgot < ${minXgot}`);
    const toqRatio = toqOpp > 0 ? toq / toqOpp : 2.5;
    if (posse < minPossession && !(toqRatio >= 2.0 && toq >= 8)) fails.push(`posse < ${minPossession}%`);
    if (sotPct < minSot) fails.push(`sot_pct < ${(minSot * 100).toFixed(0)}%`);
    if (oppXg > maxOppXg) fails.push(`opp_xg > ${maxOppXg}`);

    const qualified = fails.length === 0;
    return {
      side,
      team,
      qualified,
      fails,
      metrics: {
        cc,
        xg: Number(xg.toFixed(2)),
        xgot: Number(xgot.toFixed(2)),
        shots,
        sot,
        sotPct,
        posse,
        toquesArea: toq,
        oppXg: Number(oppXg.toFixed(2)),
      },
    };
  };

  const homeRes = evalSide('home');
  const awayRes = evalSide('away');

  let best = homeRes.qualified ? homeRes : awayRes.qualified ? awayRes : null;
  if (homeRes.qualified && awayRes.qualified) {
    best = homeRes.metrics.xg >= awayRes.metrics.xg ? homeRes : awayRes;
  }

  if (best && best.qualified) {
    const probTarget = Math.min(88, Math.max(55, Math.round(60 + (best.metrics.xg - best.metrics.oppXg) * 15)));
    const fairOdd = Number((100 / probTarget).toFixed(2));
    const minRecommendedOdd = Number((fairOdd * 1.1).toFixed(2));

    const tese = `BACK ${best.team} agora — pressão acumulada (${best.metrics.posse}% posse / ${best.metrics.cc} CC) e adversário sem reação (xG ${best.metrics.oppXg}). Modelo projeta ${probTarget}% de probabilidade de vitória. Odd justa = ${fairOdd}. Recomendado entrar se odd ≥ ${minRecommendedOdd} e vender no gol (LAY).`;

    const bettingTip = generateBettingTip({
      marketCode: "PRESSAO_VENDAVEL",
      marketName: `Pressão Vendável (${best.team})`,
      targetSelection: `Back ${best.team} / Lay Adversário`,
      probabilityPct: probTarget,
      confidence: 'alta',
      reasoning: tese,
      actionText: `Entrada recomendada se odd >= ${minRecommendedOdd.toFixed(2)}. Realizar Lay assim que sair o gol.`,
      match,
    });

    return {
      qualified: true,
      side: best.side,
      team: best.team,
      minute,
      score: `${hG}-${aG}`,
      tese,
      fairOdd,
      minRecommendedOdd,
      probTarget,
      fails: [],
      metrics: best.metrics,
      bettingTip,
    };
  }

  return {
    qualified: false,
    side: null,
    team: "",
    minute,
    score: `${hG}-${aG}`,
    tese: "Sem oportunidade de Pressão Vendável nos parâmetros defensivos atuais.",
    fails: [...homeRes.fails, ...awayRes.fails],
    metrics: homeRes.metrics.xg >= awayRes.metrics.xg ? homeRes.metrics : awayRes.metrics,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4. BLINDAGEM DE FAVORITO PERDENDO (DOMINANT TRAILING / REGRA 4)
// ──────────────────────────────────────────────────────────────────────────
export function evaluateDominantTrailing(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): DominantTrailingEvaluation {
  const dtConfig = config.dominantTrailingConfig || DEFAULT_DOMINANT_TRAILING_CONFIG;
  const isRuleEnabled = config.enableDominantTrailing !== false && dtConfig.enabled !== false;

  const bc = getMatchBigChances(match);
  const hG = match.score.home || 0;
  const aG = match.score.away || 0;
  const minute = match.minute || 0;

  // Select dominant team based on configured superiority metric (CC or xG, CC only, xG only)
  let dominantSide: 'home' | 'away' | null = null;
  const metric = dtConfig.superiorityMetric || 'cc_or_xg';

  if (metric === 'cc_only') {
    if (bc.home > bc.away) dominantSide = 'home';
    else if (bc.away > bc.home) dominantSide = 'away';
  } else if (metric === 'xg_only') {
    if (match.stats.xG.home > match.stats.xG.away) dominantSide = 'home';
    else if (match.stats.xG.away > match.stats.xG.home) dominantSide = 'away';
  } else {
    // 'cc_or_xg': Prioritizes CC, then xG
    if (bc.home > bc.away) dominantSide = 'home';
    else if (bc.away > bc.home) dominantSide = 'away';
    else if (match.stats.xG.home > match.stats.xG.away) dominantSide = 'home';
    else if (match.stats.xG.away > match.stats.xG.home) dominantSide = 'away';
  }

  if (!isRuleEnabled || !dominantSide) {
    return {
      dominantSide: isRuleEnabled ? dominantSide : null,
      dominantScore: 0,
      opponentScore: 0,
      dominantIsTrailing: false,
      dominantTrailingBy: 0,
      dominantReactionConfirmed: false,
      livePressureStatus: 'neutro',
      entryAllowed: isRuleEnabled && dominantSide === null,
      blockReason: !isRuleEnabled ? "rule_disabled" : "",
      status: 'NOT_TRAILING',
      blockMessage: !isRuleEnabled ? "Regra 4 (Back Dominante) desativada nas configurações." : undefined,
    };
  }

  const domScore = dominantSide === 'home' ? hG : aG;
  const oppScore = dominantSide === 'home' ? aG : hG;
  const isTrailing = oppScore > domScore;
  const trailingBy = Math.max(0, oppScore - domScore);

  const domPressure = dominantSide === 'home' ? (match.stats.pressureIndex?.home ?? 0) : (match.stats.pressureIndex?.away ?? 0);
  const domDangerousAttacksLast10 = dominantSide === 'home'
    ? (match.stats.dangerousAttacksLast10?.home ?? 0)
    : (match.stats.dangerousAttacksLast10?.away ?? 0);
  const domSot = dominantSide === 'home'
    ? (match.stats.shotsOnTarget?.home ?? 0)
    : (match.stats.shotsOnTarget?.away ?? 0);

  const brutalThreshold = dtConfig.brutalPressureThreshold ?? 85;
  const strongThreshold = dtConfig.strongPressureThreshold ?? 68;

  let livePressureStatus: 'brutal' | 'forte' | 'neutro' | 'dead' = 'neutro';
  if (domPressure >= brutalThreshold) livePressureStatus = 'brutal';
  else if (domPressure >= strongThreshold) livePressureStatus = 'forte';
  else if (domPressure <= 35) livePressureStatus = 'dead';

  const minPressure = dtConfig.minPressure ?? 65;
  const minDangerousAttacksLast10 = dtConfig.minDangerousAttacksLast10 ?? 6;
  const minSot = dtConfig.minShotsOnTarget ?? 3;

  const isPressureQualified = domPressure >= minPressure;
  const isDangerQualified = domDangerousAttacksLast10 >= minDangerousAttacksLast10;
  const isSotQualified = domSot >= minSot;

  const reactionReasons: string[] = [];
  if (isPressureQualified) reactionReasons.push(`Pressão ${domPressure}% ≥ ${minPressure}%`);
  if (isDangerQualified) reactionReasons.push(`Perigo Recente ${domDangerousAttacksLast10} ≥ ${minDangerousAttacksLast10}`);
  if (isSotQualified) reactionReasons.push(`Chutes no Alvo ${domSot} ≥ ${minSot}`);

  const reactionConfirmed = dtConfig.requireOnlyOneReactionCriteria !== false
    ? (isPressureQualified || isDangerQualified || isSotQualified)
    : (isPressureQualified && isDangerQualified && isSotQualified);

  const reactionDetails = {
    domPressure,
    domDangerousAttacksLast10,
    domSot,
    reactionReasons,
    isPressureQualified,
    isDangerQualified,
    isSotQualified,
  };

  if (!isTrailing) {
    return {
      dominantSide,
      dominantScore: domScore,
      opponentScore: oppScore,
      dominantIsTrailing: false,
      dominantTrailingBy: 0,
      dominantReactionConfirmed: true,
      livePressureStatus,
      entryAllowed: true,
      blockReason: "",
      status: 'NOT_TRAILING',
      reactionDetails,
    };
  }

  // Check minute window
  const minMinute = dtConfig.minMinute ?? 15;
  const maxMinute = dtConfig.maxMinute ?? 85;
  if (minute < minMinute || minute > maxMinute) {
    return {
      dominantSide,
      dominantScore: domScore,
      opponentScore: oppScore,
      dominantIsTrailing: true,
      dominantTrailingBy: trailingBy,
      dominantReactionConfirmed: false,
      livePressureStatus,
      entryAllowed: false,
      blockReason: "outside_minute_window",
      status: 'DOMINANT_TRAILING_TRAP',
      blockMessage: `BLOQUEADO — Fora da janela de minutos permitida (${minMinute}' a ${maxMinute}'). Jogo aos ${minute}'.`,
      reactionDetails,
    };
  }

  // Check max deficit goals
  const maxTrailing = dtConfig.maxTrailingGoals ?? 1;
  if (trailingBy > maxTrailing && livePressureStatus !== 'brutal') {
    return {
      dominantSide,
      dominantScore: domScore,
      opponentScore: oppScore,
      dominantIsTrailing: true,
      dominantTrailingBy: trailingBy,
      dominantReactionConfirmed: false,
      livePressureStatus,
      entryAllowed: false,
      blockReason: "dominant_trailing_by_two_or_more",
      status: 'DOMINANT_TRAILING_TRAP',
      blockMessage: `BLOQUEADO — Favorito perdendo por ${trailingBy} gol(s) (máx. permitido: ${maxTrailing}) sem pressão brutal.`,
      reactionDetails,
    };
  }

  if (!reactionConfirmed) {
    return {
      dominantSide,
      dominantScore: domScore,
      opponentScore: oppScore,
      dominantIsTrailing: true,
      dominantTrailingBy: trailingBy,
      dominantReactionConfirmed: false,
      livePressureStatus,
      entryAllowed: false,
      blockReason: "dominant_trailing_without_confirmed_reaction",
      status: 'DOMINANT_TRAILING_TRAP',
      blockMessage: `BLOQUEADO — Favorito perdendo por ${trailingBy} gol(s) sem reação viva confirmada (Necessário: Pressão ≥ ${minPressure}%, Perigo Recente ≥ ${minDangerousAttacksLast10} ou Chutes a Gol ≥ ${minSot}).`,
      reactionDetails,
    };
  }

  const domTeamName = dominantSide === 'home' ? match.homeTeam.name : match.awayTeam.name;
  const bettingTip = generateBettingTip({
    marketCode: "BACK_DOMINANTE",
    marketName: `Back Dominante (${domTeamName})`,
    targetSelection: `Back ${domTeamName}`,
    probabilityPct: livePressureStatus === 'brutal' ? 82 : 72,
    confidence: livePressureStatus === 'brutal' ? 'extrema' : 'alta',
    reasoning: `${domTeamName} perde por ${trailingBy} gol(s) aos ${match.minute}' com reação viva comprovada (${reactionReasons.join(", ")}).`,
    actionText: `Entrada em Back recomendada para virada ou empate de ${domTeamName}.`,
    match,
  });

  return {
    dominantSide,
    dominantScore: domScore,
    opponentScore: oppScore,
    dominantIsTrailing: true,
    dominantTrailingBy: trailingBy,
    dominantReactionConfirmed: true,
    livePressureStatus,
    entryAllowed: true,
    blockReason: "",
    status: 'DOMINANT_REACTION_CONFIRMED',
    bettingTip,
    reactionDetails,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4.0. REGRA UNIFICADA: SUPER BACK DOMINANTE (REAÇÃO CONFIRMADA & PRESSÃO VENDÁVEL)
// ──────────────────────────────────────────────────────────────────────────
export function evaluateSuperBackDominante(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): SuperBackDominanteEvaluation {
  const sbdCfg = config.superBackDominanteConfig || DEFAULT_SUPER_BACK_DOMINANTE_CONFIG;
  const isEnabled = config.enableSuperBackDominante !== false && sbdCfg.enabled !== false;

  const minute = match.minute || 0;
  const hG = match.score.home || 0;
  const aG = match.score.away || 0;
  const scoreStr = `${hG}-${aG}`;
  const bc = getMatchBigChances(match);

  const homeXg = match.stats.xG?.home ?? 0;
  const awayXg = match.stats.xG?.away ?? 0;
  const homeCc = bc.home;
  const awayCc = bc.away;
  const hPres = match.stats.pressureIndex?.home ?? 50;
  const aPres = match.stats.pressureIndex?.away ?? 50;

  // Atribuição automática da equipe dominante/favorita (Cascata 3 Níveis)
  let dominantSide: 'home' | 'away' | null = null;
  const odds = match.odds;
  const isFavHomeFlag = (match as any).isFavoriteHome;
  const isFavAwayFlag = (match as any).isFavoriteAway;

  if (isFavHomeFlag) dominantSide = 'home';
  else if (isFavAwayFlag) dominantSide = 'away';
  else if (odds && odds.homeWin && odds.awayWin) {
    if (odds.homeWin <= 2.15 && odds.homeWin < odds.awayWin) dominantSide = 'home';
    else if (odds.awayWin <= 2.15 && odds.awayWin < odds.homeWin) dominantSide = 'away';
  }

  if (!dominantSide) {
    const homeXgDiff = homeXg - awayXg;
    const awayXgDiff = awayXg - homeXg;
    if (homeXg >= 0.95 && homeXgDiff >= 0.50 && homeCc >= 2) {
      dominantSide = 'home';
    } else if (awayXg >= 0.95 && awayXgDiff >= 0.50 && awayCc >= 2) {
      dominantSide = 'away';
    }
  }

  if (!dominantSide) {
    if (hPres >= 70 && hPres >= aPres + 10) dominantSide = 'home';
    else if (aPres >= 70 && aPres >= hPres + 10) dominantSide = 'away';
    else {
      dominantSide = hPres >= aPres ? 'home' : 'away';
    }
  }

  const domTeam = dominantSide === 'home' ? match.homeTeam.name : match.awayTeam.name;
  const oppTeam = dominantSide === 'home' ? match.awayTeam.name : match.homeTeam.name;

  if (!isEnabled || !dominantSide) {
    return {
      qualified: false,
      tier: 'NENHUM',
      dominantSide: null,
      dominantTeam: "",
      opponentTeam: "",
      minute,
      score: scoreStr,
      deficitGoals: 0,
      situation: 'EMPATANDO',
      dominantXg: 0,
      opponentXg: 0,
      xgDiff: 0,
      dominantCc: 0,
      dominantPressure: 50,
      livePressureStatus: 'neutro',
      dangerousAttacksLast10: 0,
      shotsOnTarget: 0,
      possession: 50,
      hasStructuralVolume: false,
      hasLiveReaction: false,
      hasOpponentZeroThreat: false,
      tese: "Super Back Dominante desativado ou sem lado dominante definido.",
      marketTarget: "Back Favorito",
      probTarget: 0,
      fairOdd: 0,
      minRecommendedOdd: 1.75,
      confidence: 'moderada',
      reactionReasons: [],
      fails: [!isEnabled ? "regra_desativada" : "sem_lado_dominante"],
      isSuperBack: false,
      convictionLevel: 'LOW',
    };
  }

  const isHome = dominantSide === 'home';
  const domScore = isHome ? hG : aG;
  const oppScore = isHome ? aG : hG;
  const deficitGoals = Math.max(0, oppScore - domScore);
  const situation: 'EMPATANDO' | 'PERDENDO' | 'VENCENDO' =
    domScore > oppScore ? 'VENCENDO' : domScore === oppScore ? 'EMPATANDO' : 'PERDENDO';

  const domXg = Number((isHome ? homeXg : awayXg).toFixed(2));
  const oppXg = Number((isHome ? awayXg : homeXg).toFixed(2));
  const domCc = isHome ? homeCc : awayCc;
  const domPressure = isHome ? hPres : aPres;

  const domDangerousAttacksLast10 = isHome
    ? (match.stats.dangerousAttacksLast10?.home ?? 0)
    : (match.stats.dangerousAttacksLast10?.away ?? 0);

  const oppDangerousAttacksLast10 = isHome
    ? (match.stats.dangerousAttacksLast10?.away ?? 0)
    : (match.stats.dangerousAttacksLast10?.home ?? 0);

  const domSot = isHome
    ? (match.stats.shotsOnTarget?.home ?? 0)
    : (match.stats.shotsOnTarget?.away ?? 0);

  const possession = isHome
    ? (match.stats.possession?.home ?? 50)
    : (match.stats.possession?.away ?? 50);

  const minMin = sbdCfg.minMinute ?? 55;
  const maxMin = sbdCfg.maxMinute ?? 78;
  const minPressure = sbdCfg.minReactionPressure ?? 70;
  const minApPerMin = 1.5;
  const maxOppApPerMin = 0.6;
  const minShotsInWindow = sbdCfg.minShotsInWindow ?? 2;
  const maxGoalDeficit = 1;
  const targetOddDraw = sbdCfg.targetOddDraw ?? 1.75;
  const targetOddLosing = sbdCfg.targetOddLosing ?? 2.20;
  const minXgDom = sbdCfg.minXgDominant ?? 0.95;
  const maxOppXg = sbdCfg.maxOpponentXg ?? 0.70;
  const minCcDom = sbdCfg.minCcDominant ?? 2;

  const statusUpper = (match.status || "").toUpperCase();
  const isSecondHalf = minute >= 46 || statusUpper === "2H" || statusUpper === "2T";

  const fails: string[] = [];

  // Trava de Expulsão (Cartão Vermelho)
  const domRedCards = isHome ? (match.stats.redCards?.home ?? 0) : (match.stats.redCards?.away ?? 0);
  if (domRedCards >= 1) {
    fails.push('favorito_com_cartao_vermelho_bloqueado');
  }

  // Janela temporal: 2º Tempo, entre 55' e 78'
  if (!isSecondHalf || minute < minMin) fails.push(`minuto < ${minMin}' (2T)`);
  if (minute > maxMin) fails.push(`cutoff_maximo_${maxMin}'_atingido`);

  // Trava de placar: Empatando ou perdendo por no máximo 1 gol
  if (situation === 'VENCENDO') fails.push('favorito_ja_vencendo');
  if (deficitGoals > maxGoalDeficit) fails.push(`desvantagem_maior_que_${maxGoalDeficit}_gols`);

  // xG & Opponent xG e CCs
  if (domXg < minXgDom) fails.push(`xg_favorito_${domXg}_<_$minXgDom}`);
  if (oppXg > maxOppXg) fails.push(`xg_oponente_${oppXg}_>_${maxOppXg}`);
  if (domCc < minCcDom) fails.push(`cc_favorito_${domCc}_<_$minCcDom}`);

  // Pressão e AP/min
  if (domPressure < minPressure) {
    fails.push(`pressao_media_${domPressure}%_<_$minPressure}%`);
  }

  const domApPerMin = Number((domDangerousAttacksLast10 / 10).toFixed(2));
  if (domApPerMin < minApPerMin) {
    fails.push(`ap_per_min_${domApPerMin}_<_$minApPerMin}`);
  }

  // Finalizações no recorte de 10 min >= 2
  const minThreshold = Math.max(46, minute - 10);
  const rawTimeline = match.momentumTimeline || [];
  const recentTimeline = rawTimeline.filter(pt => pt.minute >= minThreshold && pt.minute <= minute);
  const shotsInWindow = recentTimeline.filter(pt => isHome ? pt.homeShot : pt.awayShot).length || (domSot >= minShotsInWindow ? minShotsInWindow : 0);
  const effectiveShots = Math.max(shotsInWindow, domSot);
  if (effectiveShots < minShotsInWindow) {
    fails.push(`chutes_recolhidos_${effectiveShots}_<_$minShotsInWindow}`);
  }

  // Trava contra-ataque da zebra (Opponent AP/min <= 0.6)
  const oppApPerMin = Number((oppDangerousAttacksLast10 / 10).toFixed(2));
  if (oppApPerMin > maxOppApPerMin) {
    fails.push(`zebra_perigosa_ap_min_${oppApPerMin}_>_${maxOppApPerMin}`);
  }

  const qualified = fails.length === 0;
  const targetOdd = deficitGoals === 0 ? targetOddDraw : targetOddLosing;

  const tese = qualified
    ? `🔥 SUPER BACK QUALIFICADO: ${domTeam} sufocando no 2T (${minute}'). xG: ${domXg.toFixed(2)} vs ${oppXg.toFixed(2)}, Chutes (10m): ${effectiveShots}, AP/min: ${domApPerMin}. Odd Mínima Recomendada: >= [${targetOdd.toFixed(2)}].`
    : `Super Back não qualificado (${fails.join(", ")}).`;

  const bettingTip: TacticalTipData | undefined = qualified
    ? generateBettingTip({
        marketCode: "SUPER_BACK_DOMINANTE",
        marketName: `Super Back Dominante (${domTeam})`,
        targetSelection: `Back ${domTeam}`,
        probabilityPct: deficitGoals === 0 ? 78 : 72,
        confidence: 'alta',
        reasoning: tese,
        actionText: `Entrada em Back ${domTeam} (Odd Mínima Match Odds ≥ ${targetOdd.toFixed(2)})`,
        match,
      })
    : undefined;

  return {
    qualified,
    tier: qualified ? 'OURO' : 'NENHUM',
    dominantSide,
    dominantTeam: domTeam,
    opponentTeam: oppTeam,
    minute,
    score: scoreStr,
    deficitGoals,
    situation,
    dominantXg: domXg,
    opponentXg: oppXg,
    xgDiff: Number((domXg - oppXg).toFixed(2)),
    dominantCc: domCc,
    dominantPressure: domPressure,
    livePressureStatus: domPressure >= 80 ? 'brutal' : 'forte',
    dangerousAttacksLast10: domDangerousAttacksLast10,
    shotsOnTarget: domSot,
    possession,
    hasStructuralVolume: qualified,
    hasLiveReaction: qualified,
    hasOpponentZeroThreat: oppApPerMin <= maxOppApPerMin,
    tese,
    marketTarget: "Back Favorito",
    probTarget: deficitGoals === 0 ? 78 : 72,
    fairOdd: Number((1.0 / (deficitGoals === 0 ? 0.78 : 0.72)).toFixed(2)),
    minRecommendedOdd: targetOdd,
    confidence: 'alta',
    reactionReasons: [`Pressão ${domPressure}%`, `AP/min ${domApPerMin}`, `Chutes ${effectiveShots}`, `xG ${domXg} vs ${oppXg}`],
    fails,
    bettingTip,
    isSuperBack: qualified,
    convictionLevel: qualified ? 'HIGH' : 'LOW',
  };
}



// ──────────────────────────────────────────────────────────────────────────
// 4.1. DÍVIDA DE GOLS TRADICIONAL / DIAGNÓSTICO CLÁSSICO
// ──────────────────────────────────────────────────────────────────────────
export function evaluateGoalDebtClassic(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): GoalDebtClassicEvaluation {
  const gdc = config.goalDebtClassicConfig || DEFAULT_GOAL_DEBT_CLASSIC_CONFIG;
  const isEnabled = config.enableGoalDebtClassic !== false && gdc.enabled !== false;
  const curMin = Math.max(1, match.minute || 1);
  const homeScore = match.score.home || 0;
  const awayScore = match.score.away || 0;
  const totalGoals = homeScore + awayScore;
  const scoreStr = `${homeScore} - ${awayScore}`;

  const homeXg = match.stats.xG?.home ?? 0;
  const awayXg = match.stats.xG?.away ?? 0;
  const totalXg = Number((homeXg + awayXg).toFixed(2));
  const isHomeDominant = homeXg >= awayXg;
  const dominantTeam = isHomeDominant ? match.homeTeam.name : match.awayTeam.name;
  const dominantSide: 'home' | 'away' = isHomeDominant ? 'home' : 'away';
  const dominantXg = isHomeDominant ? homeXg : awayXg;
  const dominantGoals = isHomeDominant ? homeScore : awayScore;
  const underdogTeam = isHomeDominant ? match.awayTeam.name : match.homeTeam.name;
  const underdogXg = isHomeDominant ? awayXg : homeXg;
  const underdogGoals = isHomeDominant ? awayScore : homeScore;
  const xgDiff = Number((dominantXg - underdogXg).toFixed(2));
  const dominantXgDebt = Number(Math.max(0, dominantXg - dominantGoals).toFixed(2));

  // Cálculo da dívida baseada em Chances Claras e xG (Fonte Única da Verdade: Parâmetro Central do Radar)
  const bc = getMatchBigChances(match);
  const ratio = Math.max(1.0, config.chancesPerGoalRatio || 3.0);
  const expectedGoalsByCc = Math.floor(bc.total / ratio);
  const totalDebtGoals = Math.max(0, expectedGoalsByCc - totalGoals, Math.round(totalXg - totalGoals));
  const isDevendoGol = totalGoals < expectedGoalsByCc || totalXg - totalGoals >= (gdc.minDebtGoals || 1.0);

  if (!isEnabled) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalDebtGoals: 0,
      ratioUsed: ratio,
      totalXg,
      xgDiff,
      dominantTeam,
      dominantSide,
      dominantXg,
      dominantGoals,
      dominantXgDebt,
      underdogTeam,
      underdogXg,
      underdogGoals,
      isDevendoGol: false,
      blockReason: "Regra de Dívida de Gols Clássica desativada",
      reasoning: "",
      actionText: "",
    };
  }

  // Validação temporal
  if (curMin < gdc.minMinute || curMin > gdc.maxMinute) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalDebtGoals,
      ratioUsed: ratio,
      totalXg,
      xgDiff,
      dominantTeam,
      dominantSide,
      dominantXg,
      dominantGoals,
      dominantXgDebt,
      underdogTeam,
      underdogXg,
      underdogGoals,
      isDevendoGol,
      blockReason: `Fora da janela (${gdc.minMinute}'-${gdc.maxMinute}')`,
      reasoning: "",
      actionText: "",
    };
  }

  // Resguardo Pós-Gol Unificado (Cooldown geral após qualquer gol na partida)
  const postGoalCooldown = config.postGoalCooldownMinutes ?? gdc.postGoalCooldownMinutes ?? 3;
  if (postGoalCooldown > 0 && isWithinPostGoalSuppression(match, postGoalCooldown)) {
    const lastGoalMin = getLastGoalMinute(match);
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalDebtGoals,
      ratioUsed: ratio,
      totalXg,
      xgDiff,
      dominantTeam,
      dominantSide,
      dominantXg,
      dominantGoals,
      dominantXgDebt,
      underdogTeam,
      underdogXg,
      underdogGoals,
      isDevendoGol: false,
      blockReason: `Resguardo pós-gol ativo (${postGoalCooldown}m unificado${lastGoalMin !== null ? ` após gol aos ${lastGoalMin}'` : ""})`,
      reasoning: "",
      actionText: "",
    };
  }

  // Filtros de bloqueio inteligente:
  // 1. Dominante já marcou >= xG e está vencendo
  if (gdc.blockIfDebtPaid && dominantGoals > underdogGoals && dominantGoals >= dominantXg) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalDebtGoals,
      ratioUsed: ratio,
      totalXg,
      xgDiff,
      dominantTeam,
      dominantSide,
      dominantXg,
      dominantGoals,
      dominantXgDebt,
      underdogTeam,
      underdogXg,
      underdogGoals,
      isDevendoGol: false,
      blockReason: "Dívida quitada: time dominante já converteu todo seu xG e está vencendo",
      reasoning: "",
      actionText: "",
    };
  }

  // 2. Dominante vencendo por 2+ gols
  if (gdc.blockIfWinningBy2Plus && dominantGoals - underdogGoals >= 2) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalDebtGoals,
      ratioUsed: ratio,
      totalXg,
      xgDiff,
      dominantTeam,
      dominantSide,
      dominantXg,
      dominantGoals,
      dominantXgDebt,
      underdogTeam,
      underdogXg,
      underdogGoals,
      isDevendoGol: false,
      blockReason: "Placar elástico: dominante vence com 2+ gols de vantagem",
      reasoning: "",
      actionText: "",
    };
  }

  // 3. Critérios analíticos mínimos
  const hasMinDebt = totalDebtGoals >= (gdc.minDebtGoals || 1.0) || (totalXg - totalGoals) >= (gdc.minDebtGoals || 1.0);
  const hasMinTotalXg = totalXg >= (gdc.minTotalXg || 1.2);
  const hasMinXgDiffOrDominantDebt = xgDiff >= (gdc.minXgDiff || 0.80) || dominantXgDebt >= (gdc.minDominantDebt || 0.70);

  if (!hasMinDebt || !hasMinTotalXg || !hasMinXgDiffOrDominantDebt) {
    const reasons: string[] = [];
    if (!hasMinDebt) reasons.push(`Dívida insuficiente (${totalDebtGoals} < ${gdc.minDebtGoals})`);
    if (!hasMinTotalXg) reasons.push(`xG total baixo (${totalXg} < ${gdc.minTotalXg})`);
    if (!hasMinXgDiffOrDominantDebt) reasons.push(`Assimetria insuficiente (dif xG ${xgDiff} < ${gdc.minXgDiff})`);
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalDebtGoals,
      ratioUsed: ratio,
      totalXg,
      xgDiff,
      dominantTeam,
      dominantSide,
      dominantXg,
      dominantGoals,
      dominantXgDebt,
      underdogTeam,
      underdogXg,
      underdogGoals,
      isDevendoGol,
      blockReason: reasons.join("; "),
      reasoning: "",
      actionText: "",
    };
  }

  const prob = Math.min(92, Math.max(70, 72 + Math.round(totalDebtGoals * 8) + (xgDiff >= 1.2 ? 6 : 0)));
  const reasoning = `Dívida de ${totalDebtGoals} gol(s) acumulada aos ${curMin}'. Volume de ${totalXg} xG gerado para placar de ${scoreStr}. ${dominantTeam} com xG ${dominantXg.toFixed(2)} vs ${underdogXg.toFixed(2)} de ${underdogTeam} (dívida unilateral: ${dominantXgDebt.toFixed(2)}).`;
  const actionText = `Entrada em Over Gols ou Back ${dominantTeam} recomendada pela Dívida Clássica.`;

  const bettingTip = generateBettingTip({
    marketCode: "GOAL_DEBT_CLASSIC",
    marketName: "Dívida de Gols & Diagnóstico Clássico",
    targetSelection: dominantGoals <= underdogGoals ? `Back ${dominantTeam} / Over` : "Over Próximo Gol",
    probabilityPct: prob,
    confidence: prob >= 82 ? 'extrema' : 'alta',
    reasoning,
    actionText,
    match,
    config,
  });

  return {
    qualified: true,
    minute: curMin,
    score: scoreStr,
    totalDebtGoals,
    ratioUsed: ratio,
    totalXg,
    xgDiff,
    dominantTeam,
    dominantSide,
    dominantXg,
    dominantGoals,
    dominantXgDebt,
    underdogTeam,
    underdogXg,
    underdogGoals,
    isDevendoGol: true,
    reasoning,
    actionText,
    bettingTip,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4.2. SINAL DE VALOR HT (1º TEMPO 30'-45')
// ──────────────────────────────────────────────────────────────────────────
export function evaluateHalfTimeValue(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): HalfTimeValueEvaluation {
  const htCfg = config.halfTimeValueConfig || DEFAULT_HALFTIME_VALUE_CONFIG;
  const isEnabled = config.enableHalfTimeValue !== false && htCfg.enabled !== false;
  const curMin = Math.max(1, match.minute || 1);
  const homeScore = match.score.home || 0;
  const awayScore = match.score.away || 0;
  const totalGoals = homeScore + awayScore;
  const scoreStr = `${homeScore} - ${awayScore}`;

  const homePressure = match.stats.pressureIndex?.home ?? 0;
  const awayPressure = match.stats.pressureIndex?.away ?? 0;
  const combinedPressure = homePressure + awayPressure;
  const isHomeDominant = homePressure >= awayPressure;
  const dominantPressure = isHomeDominant ? homePressure : awayPressure;
  const dominantTeam = isHomeDominant ? match.homeTeam.name : match.awayTeam.name;
  const dominantSide: 'home' | 'away' = isHomeDominant ? 'home' : 'away';

  const bc = getMatchBigChances(match);
  const totalCc = bc.total;
  const homeXg = match.stats.xG?.home ?? 0;
  const awayXg = match.stats.xG?.away ?? 0;
  const totalXg = Number((homeXg + awayXg).toFixed(2));

  const homeAttacks = match.stats.dangerousAttacksLast10?.home || 0;
  const awayAttacks = match.stats.dangerousAttacksLast10?.away || 0;
  const dangerousAttacksLast10 = homeAttacks + awayAttacks;

  const targetMarket = htCfg.targetMarket || 'OVER_HT';
  const targetLine = totalGoals === 0 ? "Over 0.5 HT (Gols 1º Tempo)" : `Over ${totalGoals}.5 HT`;

  if (!isEnabled) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalGoals,
      combinedPressure,
      dominantPressure,
      dominantTeam,
      dominantSide,
      totalCc,
      totalXg,
      dangerousAttacksLast10,
      targetMarket,
      targetLine,
      confidenceTier: 'B+',
      reasoning: "Sinal de Valor HT desativado",
      actionText: "",
    };
  }

  // Validação temporal específica do 1º Tempo
  if (curMin < htCfg.minMinute || curMin > htCfg.maxMinute) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalGoals,
      combinedPressure,
      dominantPressure,
      dominantTeam,
      dominantSide,
      totalCc,
      totalXg,
      dangerousAttacksLast10,
      targetMarket,
      targetLine,
      confidenceTier: 'B+',
      reasoning: `Fora da janela do 1º Tempo (${htCfg.minMinute}'-${htCfg.maxMinute}')`,
      actionText: "",
    };
  }

  // Teto de gols no HT (geralmente <= 1 para buscar Over 0.5 ou 1.5 HT)
  if (totalGoals > htCfg.maxTotalGoals) {
    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalGoals,
      combinedPressure,
      dominantPressure,
      dominantTeam,
      dominantSide,
      totalCc,
      totalXg,
      dangerousAttacksLast10,
      targetMarket,
      targetLine,
      confidenceTier: 'B+',
      reasoning: `Placar de ${totalGoals} gols excede o teto permitido para HT (${htCfg.maxTotalGoals})`,
      actionText: "",
    };
  }

  // Pressão combinada ou dominância de pressão
  const hasPressure = combinedPressure >= htCfg.minCombinedPressure || dominantPressure >= htCfg.minDominantPressure;
  const hasCc = totalCc >= htCfg.minTotalCc;
  const hasXg = totalXg >= htCfg.minTotalXg;
  const hasAttacks = dangerousAttacksLast10 >= htCfg.minDangerousAttacksLast10;

  if (!hasPressure || !hasCc || !hasXg || !hasAttacks) {
    const reasons: string[] = [];
    if (!hasPressure) reasons.push(`Pressão insuficiente (Comb: ${combinedPressure}% < ${htCfg.minCombinedPressure}% e Dom: ${dominantPressure}% < ${htCfg.minDominantPressure}%)`);
    if (!hasCc) reasons.push(`Chances Claras baixas (${totalCc} < ${htCfg.minTotalCc})`);
    if (!hasXg) reasons.push(`xG insuficiente (${totalXg} < ${htCfg.minTotalXg})`);
    if (!hasAttacks) reasons.push(`Perigo recente baixo (${dangerousAttacksLast10} < ${htCfg.minDangerousAttacksLast10})`);

    return {
      qualified: false,
      minute: curMin,
      score: scoreStr,
      totalGoals,
      combinedPressure,
      dominantPressure,
      dominantTeam,
      dominantSide,
      totalCc,
      totalXg,
      dangerousAttacksLast10,
      targetMarket,
      targetLine,
      confidenceTier: 'B+',
      reasoning: reasons.join("; "),
      actionText: "",
    };
  }

  const confidenceTier: 'A' | 'B+' | 'Especial' =
    combinedPressure >= 125 || dominantPressure >= 75 || totalCc >= 2 ? 'A' : 'B+';
  const prob = confidenceTier === 'A' ? 82 : 74;

  const reasoning = `Pressão extrema na reta final do 1º tempo (${curMin}'): Pressão Combinada de ${combinedPressure}% (${dominantTeam}: ${dominantPressure}%), ${totalCc} Chances Claras e ${totalXg} xG gerados com ${dangerousAttacksLast10} ataques perigosos recentes no placar ${scoreStr}.`;
  const actionText = `Entrada recomendada em ${targetLine} ou Back ${dominantTeam} antes do intervalo.`;

  const bettingTip = generateBettingTip({
    marketCode: "HALF_TIME_VALUE",
    marketName: "Sinal de Valor HT (1º Tempo)",
    targetSelection: targetLine,
    probabilityPct: prob,
    confidence: confidenceTier === 'A' ? 'extrema' : 'alta',
    reasoning,
    actionText,
    match,
    config,
  });

  return {
    qualified: true,
    minute: curMin,
    score: scoreStr,
    totalGoals,
    combinedPressure,
    dominantPressure,
    dominantTeam,
    dominantSide,
    totalCc,
    totalXg,
    dangerousAttacksLast10,
    targetMarket,
    targetLine,
    confidenceTier,
    reasoning,
    actionText,
    bettingTip,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 5. REGRAS TRADICIONAIS V1.2 (OVER & BACK MULTIMERCADO EDITÁVEIS)
// ──────────────────────────────────────────────────────────────────────────
export function evaluateTraditionalSignals(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): TraditionalRuleSignal[] {
  const signals: TraditionalRuleSignal[] = [];
  const min = match.minute || 0;
  const bc = getMatchBigChances(match);
  const totalBc = bc.total;
  const minBc = Math.min(bc.home, bc.away);
  const domBc = Math.max(bc.home, bc.away);
  const oppBc = Math.min(bc.home, bc.away);
  const totalGoals = (match.score.home || 0) + (match.score.away || 0);
  const rate = totalBc > 0 ? min / totalBc : 999;
  const isHomeDom = bc.home >= bc.away;
  const domXgot = isHomeDom
    ? (match.stats.xGOT?.home ?? match.stats.xG.home * 0.85)
    : (match.stats.xGOT?.away ?? match.stats.xG.away * 0.85);

  const v12Cfg = config.v12Config || DEFAULT_V12_CONFIG;
  const op = v12Cfg.overPremium ?? DEFAULT_V12_CONFIG.overPremium;
  const obf = v12Cfg.overBilateralForte ?? DEFAULT_V12_CONFIG.overBilateralForte;
  const ogl = v12Cfg.overGolLimite ?? DEFAULT_V12_CONFIG.overGolLimite;
  const btm = v12Cfg.backT1Main ?? DEFAULT_V12_CONFIG.backT1Main;

  // 1. Over Premium (Padrão: Min 36-50, Total CC >= 3, Rate <= 15, Min CC >= 1)
  if (
    op.enabled !== false &&
    min >= op.minMinute &&
    min <= op.maxMinute &&
    totalBc >= op.minTotalCc &&
    rate <= op.maxCcRate &&
    minBc >= op.minTeamCc
  ) {
    // Validação de Linha de Gols: Over 2.5 só existe se o jogo tiver no máximo 2 gols.
    // Se o placar já tiver 3+ gols (ex: 3-1 = 4 gols), a linha de 2.5 já bateu!
    // Nesse caso adaptamos para a linha viva real (Próximo Gol / Over seguinte) ou sinalizamos a linha correta.
    const dynamicOver = formatDynamicOverSelection(totalGoals, 2.5);
    const effectiveMarket = dynamicOver.marketCode;

    signals.push({
      ruleName: "OVER_PREMIUM",
      marketTarget: effectiveMarket,
      confidenceTier: "A-",
      recommendedAction: "ENTER_OVER_PREMIUM",
      trace: `Over Premium ativado (Total CC: ${totalBc}/${op.minTotalCc}, Rate: ${rate.toFixed(1)} min/CC <= ${op.maxCcRate}, Min CC: ${minBc}>=${op.minTeamCc}, Gols Atuais: ${totalGoals} -> Linha Dinâmica: ${dynamicOver.targetSelection})`,
    });
  }

  // 2. Over Bilateral Forte (Padrão: Min 36-65, Total CC >= 4, Rate <= 15, Min CC >= 2)
  if (
    obf.enabled !== false &&
    min >= obf.minMinute &&
    min <= obf.maxMinute &&
    totalBc >= obf.minTotalCc &&
    rate <= obf.maxCcRate &&
    minBc >= obf.minTeamCc
  ) {
    const dynamicOver = formatDynamicOverSelection(totalGoals, 2.5);
    const effectiveMarket = dynamicOver.marketCode;

    signals.push({
      ruleName: "OVER_BILATERAL_FORTE",
      marketTarget: effectiveMarket,
      confidenceTier: "B+",
      recommendedAction: "ENTER_OVER_BILATERAL_FORTE",
      trace: `Over Bilateral Forte ativado (Total CC: ${totalBc}/${obf.minTotalCc}, Min CC: ${minBc}>=${obf.minTeamCc}, Rate: ${rate.toFixed(1)}<=${obf.maxCcRate}, Gols Atuais: ${totalGoals} -> Linha Dinâmica: ${dynamicOver.targetSelection})`,
    });
  }

  // 3. Over Gol Limite (Padrão: Min 76-83, Total CC >= 7, Min CC >= 2, Diferença Placar >= 1)
  const scoreDiff = Math.abs(match.score.home - match.score.away);
  if (
    ogl.enabled !== false &&
    min >= ogl.minMinute &&
    min <= ogl.maxMinute &&
    totalBc >= ogl.minTotalCc &&
    minBc >= ogl.minTeamCc &&
    scoreDiff >= (ogl.minScoreDiff ?? 1)
  ) {
    signals.push({
      ruleName: "OVER_GOL_LIMITE",
      marketTarget: "NEXT_GOAL",
      confidenceTier: "Especial",
      recommendedAction: "ENTER_OVER_GOL_LIMITE",
      trace: `Over Gol Limite no final (Total CC: ${totalBc}/${ogl.minTotalCc}, Min CC: ${minBc}>=${ogl.minTeamCc}, Gols: ${totalGoals}, Diferença: ${scoreDiff})`,
    });
  }

  // 4. Back T1 Main (Padrão: Min 36-50, Dominante CC >= 3, Opp CC <= 0, xGOT >= 0.5, Placar empatado ou +1)
  const domScore = isHomeDom ? (match.score.home || 0) : (match.score.away || 0);
  const oppScore = isHomeDom ? (match.score.away || 0) : (match.score.home || 0);
  const domLead = domScore - oppScore;
  if (
    btm.enabled !== false &&
    min >= btm.minMinute &&
    min <= btm.maxMinute &&
    domBc >= btm.minDomCc &&
    oppBc <= (btm.maxOppCc ?? 0) &&
    domXgot >= btm.minDomXgot &&
    domLead >= 0 &&
    domLead < 2
  ) {
    signals.push({
      ruleName: "BACK_T1_MAIN",
      marketTarget: "BACK_DOMINANT",
      confidenceTier: "A",
      recommendedAction: "ENTER_BACK_T1_MAIN",
      trace: `Back T1 Main ativado (Dom CC: ${domBc}/${btm.minDomCc}, Opp CC: ${oppBc}<=${btm.maxOppCc}, xGOT: ${domXgot.toFixed(2)}>=${btm.minDomXgot}, Placar: ${domScore}-${oppScore})`,
    });
  }

  return signals;
}

// ──────────────────────────────────────────────────────────────────────────
// 6. GOL IMINENTE: SURTO OFENSIVO (5 MINUTOS - ALTA AGRESSIVIDADE)
// ──────────────────────────────────────────────────────────────────────────
// Refatorado com a mesma lógica contínua do Trend Alert adaptado para janela
// fixa de 5 minutos, com proteção contra cold-start, resets em gol/HT e
// parâmetros calibrados para real agressividade e abafa fático.
export function evaluateImminentGoal(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): ImminentGoalEvaluation {
  // Configuração editável da Regra 7 (Gol Iminente / Surto Ofensivo)
  const immConfig = config.imminentGoalConfig || DEFAULT_IMMINENT_GOAL_CONFIG;

  // Se a regra estiver desabilitada
  if (config.enableImminentGoal === false || immConfig.enabled === false) {
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes: immConfig.windowMinutes ?? 5,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: "Alerta de Gol Iminente desativado nas configurações operacionais.",
      title: "",
      triggerReason: "Regra pausada pelo usuário.",
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
    };
  }

  // Janela configurável (Padrão: 5 minutos)
  const windowMinutes = Math.max(2, Math.min(20, immConfig.windowMinutes ?? 5));
  // Parâmetros configuráveis com fallbacks nos padrões recomendados
  const minAvgPressure = immConfig.minAvgPressure ?? 72;
  const minConsistency = immConfig.minConsistencyPct ?? 60;
  const pointThreshold = immConfig.pointThreshold ?? 70;
  const minMinute1T = immConfig.minMinute ?? 20;
  const minMinute2T = immConfig.minMinute2T ?? 55;
  const cutoff1T = immConfig.cutoff1T ?? 38;
  const cutoff2T = immConfig.cutoff2T ?? 82;
  const minDangerousAttacks = immConfig.minDangerousAttacks ?? 2;
  const minDangerousAttacksPerMin = immConfig.minDangerousAttacksPerMin ?? 1.6;
  const minShots = immConfig.minShots ?? 2;
  const extremePressureBypass = immConfig.extremePressureBypass ?? 80;
  const minTargetOdd = immConfig.minTargetOdd ?? 1.50;

  const curMin = Math.max(1, match.minute || 1);
  const statusUpper = (match.status || "").toUpperCase();
  const isSecondHalfMatch = curMin >= 46 || statusUpper === "2H" || statusUpper === "2T";

  // Não emitir alertas de jogos no intervalo (HT)
  const isHalfTime =
    statusUpper === "HT" ||
    statusUpper === "INT" ||
    statusUpper === "38" ||
    statusUpper === "HALF_TIME" ||
    statusUpper === "HALF TIME" ||
    statusUpper === "HALF-TIME" ||
    statusUpper === "HALFTIME" ||
    statusUpper === "INTERVALO" ||
    statusUpper === "INTERVAL" ||
    statusUpper === "DESCANSO" ||
    statusUpper === "PAUSA" ||
    statusUpper === "BREAK" ||
    statusUpper.includes("HT") ||
    statusUpper.includes("INTERVAL") ||
    statusUpper.includes("HALF TIME") ||
    statusUpper.includes("HALFTIME") ||
    statusUpper.includes("HALF-TIME") ||
    statusUpper.includes("HALF_TIME") ||
    statusUpper.includes("DESCANSO") ||
    statusUpper.includes("PAUSA") ||
    /\bHT\b/.test(statusUpper) ||
    /\bINT\b/.test(statusUpper) ||
    match.status === "HT";

  if (isHalfTime) {
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: "Partida no Intervalo (HT) - Alertas pausados.",
      title: "",
      triggerReason: "Partida no Intervalo (HT).",
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
      targetOddMin: minTargetOdd,
    };
  }

  // Travas de Cutoff Máximo de Minutagem (1T <= 38' e 2T <= 82')
  if (!isSecondHalfMatch && curMin > cutoff1T) {
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: `Alerta pausado por Cutoff de Minutagem do 1º Tempo (> ${cutoff1T}').`,
      title: "Cutoff 1T Atingido",
      triggerReason: `Minuto ${curMin}' ultrapassou o limite operacional de ${cutoff1T}' no 1T.`,
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
      targetOddMin: minTargetOdd,
    };
  }

  if (isSecondHalfMatch && curMin > cutoff2T) {
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: `Alerta pausado por Cutoff de Minutagem do 2º Tempo (> ${cutoff2T}').`,
      title: "Cutoff 2T Atingido",
      triggerReason: `Minuto ${curMin}' ultrapassou o limite operacional de ${cutoff2T}' no 2T.`,
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
      targetOddMin: minTargetOdd,
    };
  }

  // Travas de Minuto Mínimo (20' no 1T e 55' no 2T)
  const effectiveMinMinute = isSecondHalfMatch ? minMinute2T : minMinute1T;
  if (curMin < effectiveMinMinute) {
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: isSecondHalfMatch
        ? `Aguardando amostragem inicial do 2º Tempo (minuto mínimo: ${minMinute2T}').`
        : `Aguardando amostragem inicial do 1º Tempo (minuto mínimo: ${minMinute1T}').`,
      title: "Aguardando Minutagem Mínima",
      triggerReason: `Partida aos ${curMin}', aguardando alcançar ${effectiveMinMinute}' para validação de surto com EV+.`,
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
      targetOddMin: minTargetOdd,
    };
  }

  const lastGoalMin = getLastGoalMinute(match);

  // 1. REGRA MANDATÓRIA DE PRIORIDADE DE GOL E RESET DE JANELA:
  // Se saiu gol na partida, o surto anterior culminou no gol. A janela é resetada.
  // Só voltará a alertar em novo surto de novos 5 minutos estritamente pós-gol.
  if (lastGoalMin !== null && lastGoalMin !== undefined && curMin >= lastGoalMin) {
    const minutesSinceGoal = curMin - lastGoalMin;
    if (minutesSinceGoal < windowMinutes) {
      return {
        qualified: false,
        isImminent: false,
        team: null,
        teamName: "",
        opponentName: "",
        windowMinutes,
        avgPressure: 50,
        consistencyPct: 0,
        highPressureMinutes: 0,
        totalPointsInWindow: 0,
        shotsInWindow: 0,
        dangerousAttacksInWindow: 0,
        trendDirection: "sustained_high",
        intensity: "nenhuma",
        targetMarket: "",
        actionText: `Janela de surto resetada por gol recente aos ${lastGoalMin}'. Aguardando novos 5 min de pressão pós-gol (${Math.max(0, minutesSinceGoal)}/5m transcorridos).`,
        title: `Janela resetada por gol aos ${lastGoalMin}'`,
        triggerReason: `Gol aos ${lastGoalMin}' zerou a contagem de surto. Novo ciclo de blitz em andamento.`,
        confidenceScore: 0,
        variationPct5m: 0,
        totalChancesLast5: 0,
        totalChancesPrev5: 0,
        homeChancesLast5: 0,
        awayChancesLast5: 0,
        effectiveDebt: 0,
      };
    }
  }

  // 2. REGRA DE RESET DE INTERVALO (HT):
  // No segundo tempo (min >= 46), a janela de 5m não pode cruzar o HT.
  if (curMin >= 46) {
    const minutesInSecondHalf = curMin - 45;
    if (minutesInSecondHalf < windowMinutes) {
      return {
        qualified: false,
        isImminent: false,
        team: null,
        teamName: "",
        opponentName: "",
        windowMinutes,
        avgPressure: 50,
        consistencyPct: 0,
        highPressureMinutes: 0,
        totalPointsInWindow: 0,
        shotsInWindow: 0,
        dangerousAttacksInWindow: 0,
        trendDirection: "sustained_high",
        intensity: "nenhuma",
        targetMarket: "",
        actionText: `Janela resetada no Intervalo (HT). Aguardando 5 min contínuos de 2º Tempo (${minutesInSecondHalf}/5m transcorridos).`,
        title: "Aguardando início do 2º Tempo",
        triggerReason: "Início do 2º Tempo. Acumulando dados da janela de 5 minutos.",
        confidenceScore: 0,
        variationPct5m: 0,
        totalChancesLast5: 0,
        totalChancesPrev5: 0,
        homeChancesLast5: 0,
        awayChancesLast5: 0,
        effectiveDebt: 0,
      };
    }
  }

  // Minutagem mínima de jogo
  if (curMin < effectiveMinMinute) {
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: "Aguardando minutos iniciais da partida.",
      title: "",
      triggerReason: "Menos de 5 minutos de partida.",
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
    };
  }

  // Determina corte da janela cronológica pós-gol ou pós-intervalo
  const isSecondHalf = curMin >= 46;
  const halfStartMin = isSecondHalf ? 46 : 1;
  const baseThreshold = Math.max(halfStartMin, curMin - windowMinutes);
  const minThreshold = (lastGoalMin !== null && lastGoalMin !== undefined)
    ? Math.max(baseThreshold, lastGoalMin + 1)
    : baseThreshold;

  const rawTimeline = match.momentumTimeline || [];
  const pointsInWindow = rawTimeline.filter(
    (pt) => pt.minute >= minThreshold && pt.minute <= curMin
  );

  let homeSum = 0;
  let awaySum = 0;
  let homeHighPoints = 0;
  let awayHighPoints = 0;
  let homeShots = 0;
  let awayShots = 0;
  let homeAttacks = 0;
  let awayAttacks = 0;

  const totalPoints = pointsInWindow.length;

  if (totalPoints >= 2) {
    pointsInWindow.forEach((pt) => {
      const hPress = pt.homePressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 + pt.diff / 2)) : 50);
      const aPress = pt.awayPressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 - pt.diff / 2)) : 50);
      homeSum += hPress;
      awaySum += aPress;

      if (hPress >= pointThreshold) homeHighPoints++;
      if (aPress >= pointThreshold) awayHighPoints++;

      if (pt.homeShot) homeShots++;
      if (pt.awayShot) awayShots++;
      if (pt.homeDangerousAttack) homeAttacks++;
      if (pt.awayDangerousAttack) awayAttacks++;
    });
  } else {
    // Proteção contra Cold Start / Primeiro Scan do Crawler:
    // Exige histórico cronológico mínimo de 2 leituras na janela de 5m.
    return {
      qualified: false,
      isImminent: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: totalPoints,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "nenhuma",
      targetMarket: "",
      actionText: `Aguardando histórico real da janela de 5m (${totalPoints}/2 leituras recentes).`,
      title: "",
      triggerReason: "Aguardando leituras suficientes na janela de 5 minutos.",
      confidenceScore: 0,
      variationPct5m: 0,
      totalChancesLast5: 0,
      totalChancesPrev5: 0,
      homeChancesLast5: 0,
      awayChancesLast5: 0,
      effectiveDebt: 0,
    };
  }

  const effectiveCount = totalPoints;
  const avgHome = Math.round(homeSum / (effectiveCount || 1));
  const avgAway = Math.round(awaySum / (effectiveCount || 1));
  const homeConsistency = Math.round((homeHighPoints / (effectiveCount || 1)) * 100);
  const awayConsistency = Math.round((awayHighPoints / (effectiveCount || 1)) * 100);

  // Critério de Real Agressividade no Surto de 5m (ou janela configurada):
  // - Pressão média nos minutos da janela >= minAvgPressure (Padrão: 72%)
  // - Consistência (tempo no ataque com pressão >= pointThreshold) >= minConsistency (Padrão: 60%)
  // - Agressividade fática comprovada:
  //   * Pelo menos minShots (Padrão: >= 2 finalizações) E densidade de ataques perigosos (AP/min >= 1.6 ou ataques >= minDangerousAttacks)
  //   * OU pressão extrema >= extremePressureBypass (80%)
  const homeApPerMin = homeAttacks / (windowMinutes || 5);
  const awayApPerMin = awayAttacks / (windowMinutes || 5);

  const isHomeDominant =
    avgHome >= minAvgPressure &&
    homeConsistency >= minConsistency &&
    ((homeShots >= minShots && (homeApPerMin >= minDangerousAttacksPerMin || homeAttacks >= minDangerousAttacks)) || avgHome >= extremePressureBypass);

  const isAwayDominant =
    avgAway >= minAvgPressure &&
    awayConsistency >= minConsistency &&
    ((awayShots >= minShots && (awayApPerMin >= minDangerousAttacksPerMin || awayAttacks >= minDangerousAttacks)) || avgAway >= extremePressureBypass);

  let qualified = false;
  let dominantSide: "home" | "away" | null = null;

  if (isHomeDominant && (!isAwayDominant || avgHome >= avgAway)) {
    qualified = true;
    dominantSide = "home";
  } else if (isAwayDominant) {
    qualified = true;
    dominantSide = "away";
  }

  const teamName = dominantSide === "home" ? match.homeTeam.name : dominantSide === "away" ? match.awayTeam.name : "";
  const opponentName = dominantSide === "home" ? match.awayTeam.name : dominantSide === "away" ? match.homeTeam.name : "";
  const avgPressure = dominantSide === "home" ? avgHome : dominantSide === "away" ? avgAway : Math.max(avgHome, avgAway);
  const consistencyPct = dominantSide === "home" ? homeConsistency : dominantSide === "away" ? awayConsistency : 0;
  const highPressureMinutes = dominantSide === "home" ? homeHighPoints : dominantSide === "away" ? awayHighPoints : 0;
  const shotsInWindow = dominantSide === "home" ? homeShots : dominantSide === "away" ? awayShots : 0;
  const dangerousAttacksInWindow = dominantSide === "home" ? homeAttacks : dominantSide === "away" ? awayAttacks : 0;

  // Níveis de Intensidade para Surto Ofensivo
  let intensity: ImminentGoalEvaluation["intensity"] = "nenhuma";
  if (qualified) {
    if (avgPressure >= 80 && consistencyPct >= 75 && (dangerousAttacksInWindow >= 3 || shotsInWindow >= 2)) {
      intensity = "extrema";
    } else if (avgPressure >= 74 && consistencyPct >= 60) {
      intensity = "alta";
    } else {
      intensity = "moderada";
    }
  }

  // Direção da tendência no surto
  let trendDirection: ImminentGoalEvaluation["trendDirection"] = "sustained_high";
  if (pointsInWindow.length >= 3) {
    const lastPoint = pointsInWindow[pointsInWindow.length - 1];
    const lastPress = dominantSide === "home" ? (lastPoint.homePressure ?? 50) : (lastPoint.awayPressure ?? 50);
    if (lastPress >= 82) {
      trendDirection = "peak";
    } else if (lastPress > avgPressure + 5) {
      trendDirection = "increasing";
    }
  }

  // Confiança e mercados
  const confidenceScore = qualified
    ? Math.min(98, Math.max(72, Math.round(avgPressure * 0.7 + consistencyPct * 0.3)))
    : 0;

  const domGoals = dominantSide === "home" ? match.score.home : match.score.away;
  const oppGoals = dominantSide === "home" ? match.score.away : match.score.home;

  let targetMarket = "";
  let actionText = "";
  if (qualified) {
    const totalGoals = (match.score.home || 0) + (match.score.away || 0);
    const dynamicOver = formatDynamicOverSelection(totalGoals);
    if (domGoals <= oppGoals) {
      targetMarket = `Próximo Gol ${teamName} / Back ${teamName}`;
      actionText = `Blitz imediata de 5m. Entrada a favor do ${teamName} (Próximo Gol / Back).`;
    } else {
      targetMarket = `${dynamicOver.targetSelection} / Próximo Gol ${teamName}`;
      actionText = `Surto ofensivo de 5m mantido mesmo em vantagem. Oportunidade em ${dynamicOver.targetSelection} ou Próximo Gol.`;
    }
  } else {
    actionText = "Ritmo em equilíbrio na janela recente de 5 minutos.";
  }

  const triggerReason = qualified
    ? `Blitz ofensiva em 5m: Pressão média de ${avgPressure}% (${consistencyPct}% sufocando), ${dangerousAttacksInWindow} ataques perigosos e ${shotsInWindow} finalizações recentes.`
    : `Sem surto recente nos últimos 5 minutos (pressão média: ${avgPressure}%).`;

  const title = qualified
    ? intensity === "extrema"
      ? `🚨 GOL IMINENTE: Blitz Extrema (${teamName})`
      : `🚨 GOL IMINENTE: Surto Ofensivo 5m (${teamName})`
    : "Ritmo Estável (5m)";

  let bettingTip: TacticalTipData | undefined = undefined;
  if (qualified) {
    bettingTip = generateBettingTip({
      marketCode: "SURTO_OFENSIVO_5M",
      marketName: "Gol Iminente: Surto Ofensivo (5m)",
      targetSelection: targetMarket,
      probabilityPct: confidenceScore,
      confidence: intensity === "extrema" ? "extrema" : "alta",
      reasoning: `O ${teamName} disparou um surto ofensivo de alta agressividade nos últimos 5 minutos com ${avgPressure}% de pressão média (${consistencyPct}% do tempo acuando), acumulando ${dangerousAttacksInWindow} ataques e ${shotsInWindow} chutes.`,
      actionText,
      match,
      config,
    });
  }

  const formattedTelegram = qualified
    ? `🚨 GOL IMINENTE: ${teamName} em blitz agressiva (${avgPressure}% em 5m) aos ${match.minute}'!`
    : "";

  return {
    qualified,
    isImminent: qualified,
    team: dominantSide,
    teamName,
    opponentName,
    windowMinutes,
    avgPressure,
    consistencyPct,
    highPressureMinutes,
    totalPointsInWindow: effectiveCount,
    shotsInWindow,
    dangerousAttacksInWindow,
    trendDirection,
    intensity,
    targetMarket,
    actionText,
    title,
    triggerReason,
    confidenceScore,
    bettingTip,
    formattedTelegram,
    // Campos auxiliares para compatibilidade de UI
    variationPct5m: Math.max(0, Math.round((avgPressure - 50) * 2)),
    totalChancesLast5: shotsInWindow + dangerousAttacksInWindow,
    totalChancesPrev5: 0,
    homeChancesLast5: dominantSide === "home" ? shotsInWindow + dangerousAttacksInWindow : 0,
    awayChancesLast5: dominantSide === "away" ? shotsInWindow + dangerousAttacksInWindow : 0,
    effectiveDebt: 1,
    beneficiaryTeam: teamName || undefined,
    targetOddMin: minTargetOdd,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 8. AMBAS MARCAM (BTTS: SIM) - ALGORITMO APRIMORADO BILATERAL EDITÁVEL
// ──────────────────────────────────────────────────────────────────────────
export function evaluateAmbasMarcam(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): AmbasMarcamEvaluation {
  const cfg = config.ambasMarcamConfig || DEFAULT_AMBAS_MARCAM_CONFIG;

  if (!config.enableAmbasMarcamBTTS || cfg.enabled === false) {
    return {
      qualified: false,
      homeXg: 0,
      awayXg: 0,
      totalXg: 0,
      homeSot: 0,
      awaySot: 0,
      currentScore: "",
      scoreScenario: "other",
    };
  }

  const min = Math.max(1, match.minute || 1);
  const hG = match.score.home || 0;
  const aG = match.score.away || 0;
  const currentScore = `${hG}-${aG}`;

  const homeXg = Number((match.stats.xG?.home ?? 0).toFixed(2));
  const awayXg = Number((match.stats.xG?.away ?? 0).toFixed(2));
  const totalXg = Number((homeXg + awayXg).toFixed(2));
  const homeSot = match.stats.shotsOnTarget?.home ?? 0;
  const awaySot = match.stats.shotsOnTarget?.away ?? 0;

  // Determinar o cenário de placar tático
  let scoreScenario: "0-0" | "1-0" | "0-1" | "tied_multi" | "lead_multi" | "both_already_scored" | "other" = "other";
  if (hG > 0 && aG > 0) {
    scoreScenario = "both_already_scored";
  } else if (hG === 0 && aG === 0) {
    scoreScenario = "0-0";
  } else if (hG === 1 && aG === 0) {
    scoreScenario = "1-0";
  } else if (hG === 0 && aG === 1) {
    scoreScenario = "0-1";
  } else if (hG >= 2 && aG === 0) {
    scoreScenario = "lead_multi";
  } else if (hG === 0 && aG >= 2) {
    scoreScenario = "lead_multi";
  }

  // 1. FILTRO: Se ambos os times já marcaram gol, o mercado BTTS SIM já bateu!
  if (scoreScenario === "both_already_scored" && cfg.blockIfBothScored !== false) {
    return {
      qualified: false,
      homeXg,
      awayXg,
      totalXg,
      homeSot,
      awaySot,
      currentScore,
      scoreScenario,
      reasoning: `Ambas as equipes já marcaram gol (Placar: ${currentScore}). Mercado BTTS SIM concretizado.`,
    };
  }

  // 2. FILTRO: Bloquear em goleadas elásticas desconexas (>= 3 gols de diferença aos 70'+ sem reação ativa)
  const leadDiff = Math.abs(hG - aG);
  if (cfg.blockIfBlowout !== false && leadDiff >= 3 && min >= 70) {
    const trailingIsAway = hG > aG;
    const trailingPress = trailingIsAway
      ? (match.stats.pressureIndex?.away ?? 50)
      : (match.stats.pressureIndex?.home ?? 50);
    const trailingDang = trailingIsAway
      ? (match.stats.dangerousAttacksLast10?.away ?? 0)
      : (match.stats.dangerousAttacksLast10?.home ?? 0);

    if (trailingPress < 42 && trailingDang < 2) {
      return {
        qualified: false,
        homeXg,
        awayXg,
        totalXg,
        homeSot,
        awaySot,
        currentScore,
        scoreScenario,
        reasoning: `Goleada elástica (${currentScore}) sem reação da equipe em desvantagem aos ${min}'.`,
      };
    }
  }

  // 3. ANÁLISE RETROSPECTIVA NA JANELA (Padrão: últimos 10 minutos)
  const windowMin = cfg.windowMinutes && cfg.windowMinutes > 0 ? cfg.windowMinutes : 10;
  const minStart = Math.max(1, min - windowMin);
  const lastWindowPoints = (match.momentumTimeline || []).filter(
    (pt) => pt.minute > minStart && pt.minute <= min
  );

  const homeAttacksRaw = match.stats.dangerousAttacksLast10?.home || 0;
  const awayAttacksRaw = match.stats.dangerousAttacksLast10?.away || 0;
  const homeDangPoints = lastWindowPoints.filter((pt) => pt.homeDangerousAttack).length;
  const awayDangPoints = lastWindowPoints.filter((pt) => pt.awayDangerousAttack).length;
  const homeAttacks10m = Math.max(homeAttacksRaw, homeDangPoints);
  const awayAttacks10m = Math.max(awayAttacksRaw, awayDangPoints);

  const homeShots10m = lastWindowPoints.filter((pt) => pt.homeShot).length;
  const awayShots10m = lastWindowPoints.filter((pt) => pt.awayShot).length;

  const homePressure10m =
    lastWindowPoints.length > 0
      ? Math.round(lastWindowPoints.reduce((acc, p) => acc + p.homePressure, 0) / lastWindowPoints.length)
      : (match.stats.pressureIndex?.home ?? 50);
  const awayPressure10m =
    lastWindowPoints.length > 0
      ? Math.round(lastWindowPoints.reduce((acc, p) => acc + p.awayPressure, 0) / lastWindowPoints.length)
      : (match.stats.pressureIndex?.away ?? 50);

  // 4. CRITÉRIOS DE ATIVIDADE BILATERAL RIGOROSAMENTE BASEADOS NA CONFIGURAÇÃO EDITÁVEL
  const minHomeAttacks = Number(cfg.minHomeAttacks10m ?? 3);
  const minAwayAttacks = Number(cfg.minAwayAttacks10m ?? 3);
  const minHomeShots = Number(cfg.minHomeShots10m ?? 1);
  const minAwayShots = Number(cfg.minAwayShots10m ?? 1);
  const minHomePress = Number(cfg.minHomePressure ?? 50);
  const minAwayPress = Number(cfg.minAwayPressure ?? 50);
  const minCombPress = Number(cfg.minCombinedPressure ?? 100);
  const minTotXg = Number(cfg.minTotalXg ?? 1.10);
  const minHXg = Number(cfg.minHomeXg ?? 0.35);
  const minAXg = Number(cfg.minAwayXg ?? 0.35);

  const homeAttacksOk = homeAttacks10m >= minHomeAttacks;
  const awayAttacksOk = awayAttacks10m >= minAwayAttacks;
  const homeThreatOk =
    homeShots10m >= minHomeShots ||
    homePressure10m >= minHomePress ||
    (hG === 0 && (homeXg >= minHXg || homeSot >= 1));
  const awayThreatOk =
    awayShots10m >= minAwayShots ||
    awayPressure10m >= minAwayPress ||
    (aG === 0 && (awayXg >= minAXg || awaySot >= 1));

  const homeMeetsConfig = homeAttacksOk && homeThreatOk;
  const awayMeetsConfig = awayAttacksOk && awayThreatOk;

  const combinedPressure = homePressure10m + awayPressure10m;
  const meetsCombinedPressure = combinedPressure >= minCombPress;
  const meetsTotalXg = totalXg >= minTotXg;
  const withinMinuteWindow = min >= Number(cfg.minMinute ?? 20) && min <= Number(cfg.maxMinute ?? 85);

  let scenarioFlowOk = true;
  if (scoreScenario === "1-0") {
    // Mandante marcou, visitante precisa buscar o gol com perigo ativo
    const awayReactionActive =
      awayAttacksOk &&
      (awayShots10m >= minAwayShots || awayPressure10m >= minAwayPress || awayXg >= minAXg || awaySot >= 1);
    scenarioFlowOk = awayReactionActive;
  } else if (scoreScenario === "0-1") {
    // Visitante marcou, mandante precisa reagir com pressão no seu estádio
    const homeReactionActive =
      homeAttacksOk &&
      (homeShots10m >= minHomeShots || homePressure10m >= minHomePress || homeXg >= minHXg || homeSot >= 1);
    scenarioFlowOk = homeReactionActive;
  } else if (scoreScenario === "0-0") {
    // Placar fechado: ambos precisam comprovar capacidade de finalização/criação
    const openPace =
      homeAttacksOk &&
      awayAttacksOk &&
      (homeXg >= minHXg || homeSot >= 1) &&
      (awayXg >= minAXg || awaySot >= 1);
    scenarioFlowOk = openPace;
  }

  // 5. CÁLCULO PROBABILÍSTICO AVANÇADO & PRECIFICAÇÃO EV+
  let rawProb = 62;
  // Bônus de volume de xG bilateral
  if (homeXg >= minHXg && awayXg >= minAXg) rawProb += 8;
  if (totalXg >= minTotXg) rawProb += 5;
  // Bônus de produção recente na janela
  rawProb += Math.min(10, (homeAttacks10m + awayAttacks10m) * 1.2);
  rawProb += Math.min(8, (homeShots10m + awayShots10m) * 3);
  // Bônus de pressão mútua
  if (homePressure10m >= minHomePress && awayPressure10m >= minAwayPress) rawProb += 6;
  // Bônus de histórico H2H se favorável
  if (match.h2h?.summary?.bttsPercentage && match.h2h.summary.bttsPercentage >= 60) {
    rawProb += 4;
  }

  // Ajuste por tempo restante no relógio
  if (min >= 78) {
    if (scoreScenario === "0-0") {
      rawProb -= 8; // Faltam 2 gols em menos de 15 minutos
    } else if (scoreScenario === "1-0" || scoreScenario === "0-1") {
      rawProb -= 3; // Falta apenas 1 gol
    }
  }

  const probTarget = Math.min(94, Math.max(50, Math.round(rawProb)));
  const fairOdd = +(1 / (probTarget / 100)).toFixed(2);
  const minRecommendedOdd = +(fairOdd * 1.10).toFixed(2);

  const meetsProbThreshold =
    probTarget >= (cfg.minProbabilityPct ?? 68) &&
    probTarget >= (config.minAlertProbabilityPct ?? 50);

  const qualified =
    withinMinuteWindow &&
    meetsProbThreshold &&
    meetsTotalXg &&
    meetsCombinedPressure &&
    homeMeetsConfig &&
    awayMeetsConfig &&
    scenarioFlowOk;

  // 6. ELABORAÇÃO DO REASONING E BETTING TIP
  let scenarioDesc = "";
  if (scoreScenario === "0-0") {
    scenarioDesc = "Placar 0-0 com ambas as equipes atacando e criando oportunidades reais";
  } else if (scoreScenario === "1-0") {
    scenarioDesc = `Mandante vence por 1-0, mas Visitante pressiona forte (${awayPressure10m}% na janela) em busca do empate`;
  } else if (scoreScenario === "0-1") {
    scenarioDesc = `Visitante lidera 0-1, e Mandante sufoca (${homePressure10m}% na janela) em forte reação`;
  } else {
    scenarioDesc = `Volume mútuo elevado no placar ${currentScore}`;
  }

  const reasoning = `${scenarioDesc}. Mandante: ${homeXg} xG, ${homeSot} no alvo, ${homeAttacks10m} ataques perigosos (${windowMin}m). Visitante: ${awayXg} xG, ${awaySot} no alvo, ${awayAttacks10m} ataques perigosos (${windowMin}m). Probabilidade: ${probTarget}%. Odd Justa: @${fairOdd}.`;

  let bettingTip: BettingTipData | undefined = undefined;
  if (qualified) {
    bettingTip = generateBettingTip({
      marketCode: "BTTS_YES",
      marketName: "Ambas as Equipes Marcam (BTTS: SIM)",
      targetSelection: "Ambas Marcam: SIM",
      probabilityPct: probTarget,
      confidence: probTarget >= 82 ? "extrema" : probTarget >= 72 ? "alta" : "moderada",
      reasoning,
      actionText: `Entrada em Ambas Marcam: SIM (Odd Justa @${fairOdd}, entrar se Odd ≥ @${minRecommendedOdd})`,
      match,
      config,
    });
  }

  return {
    qualified,
    homeXg,
    awayXg,
    totalXg,
    homeSot,
    awaySot,
    homeAttacks10m,
    awayAttacks10m,
    homeShots10m,
    awayShots10m,
    homePressure10m,
    awayPressure10m,
    currentScore,
    scoreScenario,
    probTarget,
    fairOdd,
    minRecommendedOdd,
    reasoning,
    bettingTip,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// TREND ALERT: PRESSÃO ALTA CONSTANTE DE LONGO PRAZO (EX: 15 MINUTOS)
// ──────────────────────────────────────────────────────────────────────────
export function evaluateTrendAlert(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): TrendAlertEvaluation {
  const windowMinutes = config.superPressureConfig?.windowMinutes ?? config.trendAlertWindowMinutes ?? 15;
  const minAvgPressure = config.superPressureConfig?.minAvgPressure ?? config.trendAlertMinAvgPressure ?? 68;
  const minConsistency = config.superPressureConfig?.minConsistencyPct ?? config.trendAlertMinConsistencyPct ?? 65;
  const minMinute = config.superPressureConfig?.minMinute ?? config.trendAlertMinMinute ?? 20;
  const pointThreshold = config.superPressureConfig?.pointThreshold ?? config.trendAlertPointThreshold ?? 60;
  const minFinalizations = config.superPressureConfig?.minFinalizations ?? 2;
  const cutoff1T = config.superPressureConfig?.cutoff1T ?? 38;
  const cutoff2T = config.superPressureConfig?.cutoff2T ?? 82;
  const minTargetOdd1T = config.superPressureConfig?.minTargetOdd1T ?? 1.60;
  const minTargetOdd2T = config.superPressureConfig?.minTargetOdd2T ?? 1.70;

  const curMin = Math.max(1, match.minute || 1);
  const statusUpper = (match.status || "").toUpperCase();
  const isSecondHalfMatch = curMin >= 46 || statusUpper === "2H" || statusUpper === "2T";
  const targetOddMin = isSecondHalfMatch ? minTargetOdd2T : minTargetOdd1T;

  // Não emitir alertas de jogos no intervalo (HT)
  const isHalfTime =
    statusUpper === "HT" ||
    statusUpper === "INT" ||
    statusUpper === "38" ||
    statusUpper === "HALF_TIME" ||
    statusUpper === "HALF TIME" ||
    statusUpper === "HALF-TIME" ||
    statusUpper === "HALFTIME" ||
    statusUpper === "INTERVALO" ||
    statusUpper === "INTERVAL" ||
    statusUpper === "DESCANSO" ||
    statusUpper === "PAUSA" ||
    statusUpper === "BREAK" ||
    statusUpper.includes("HT") ||
    statusUpper.includes("INTERVAL") ||
    statusUpper.includes("HALF TIME") ||
    statusUpper.includes("HALFTIME") ||
    statusUpper.includes("HALF-TIME") ||
    statusUpper.includes("HALF_TIME") ||
    statusUpper.includes("DESCANSO") ||
    statusUpper.includes("PAUSA") ||
    /\bHT\b/.test(statusUpper) ||
    /\bINT\b/.test(statusUpper) ||
    match.status === "HT";

  if (isHalfTime) {
    return {
      qualified: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "moderada",
      targetMarket: "",
      actionText: "Partida no Intervalo (HT) - Alertas pausados.",
      confidenceScore: 0,
      targetOddMin,
    };
  }

  // Travas de Cutoff Máximo de Minutagem (1T <= 38' e 2T <= 82')
  if (!isSecondHalfMatch && curMin > cutoff1T) {
    return {
      qualified: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "moderada",
      targetMarket: "",
      actionText: `Alerta pausado por Cutoff de Minutagem do 1º Tempo (> ${cutoff1T}').`,
      confidenceScore: 0,
      targetOddMin,
    };
  }

  if (isSecondHalfMatch && curMin > cutoff2T) {
    return {
      qualified: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "moderada",
      targetMarket: "",
      actionText: `Alerta pausado por Cutoff de Minutagem do 2º Tempo (> ${cutoff2T}').`,
      confidenceScore: 0,
      targetOddMin,
    };
  }

  const lastGoalMin = getLastGoalMinute(match);

  // 1. REGRA MANDATÓRIA DE PRIORIDADE DE GOL E RESET DE JANELA:
  // Se saiu gol na partida, o alerta anterior perde a validade da janela pois houve gol!
  // Os contadores de tempo da janela foram ZERADOS pelo gol.
  // Só voltará a alertar em novo pico de pressão de novos N minutos (janela completa) estritamente pós-gol.
  if (lastGoalMin !== null && lastGoalMin !== undefined && curMin >= lastGoalMin) {
    const minutesSinceGoal = curMin - lastGoalMin;
    if (minutesSinceGoal < windowMinutes) {
      return {
        qualified: false,
        team: null,
        teamName: "",
        opponentName: "",
        windowMinutes,
        avgPressure: 50,
        consistencyPct: 0,
        highPressureMinutes: 0,
        totalPointsInWindow: 0,
        shotsInWindow: 0,
        dangerousAttacksInWindow: 0,
        trendDirection: "sustained_high",
        intensity: "moderada",
        targetMarket: "",
        actionText: `Janela resetada por gol recente aos ${lastGoalMin}'. Aguardando ${windowMinutes} min de nova pressão pós-gol (${Math.max(0, minutesSinceGoal)}/${windowMinutes}m transcorridos).`,
        confidenceScore: 0,
      };
    }
  }

  // 2. REGRA DE RESET DE INTERVALO (HT):
  // O intervalo de 15 minutos quebra a pressão contínua do 1º tempo.
  // No segundo tempo (min >= 46), a janela contínua não pode cruzar o HT.
  // É necessário acumular tempo real de jogo no 2T.
  if (curMin >= 46) {
    const minutesInSecondHalf = curMin - 45;
    if (minutesInSecondHalf < windowMinutes) {
      return {
        qualified: false,
        team: null,
        teamName: "",
        opponentName: "",
        windowMinutes,
        avgPressure: 50,
        consistencyPct: 0,
        highPressureMinutes: 0,
        totalPointsInWindow: 0,
        shotsInWindow: 0,
        dangerousAttacksInWindow: 0,
        trendDirection: "sustained_high",
        intensity: "moderada",
        targetMarket: "",
        actionText: `Janela resetada no Intervalo (HT). Aguardando ${windowMinutes} min contínuos de 2º Tempo (${minutesInSecondHalf}/${windowMinutes}m transcorridos).`,
        confidenceScore: 0,
      };
    }
  }

  // Precisa estar em andamento e ter minutagem suficiente para janela contínua (mínimo Math.max(minMinute, windowMinutes))
  if (curMin < Math.max(minMinute, windowMinutes)) {
    return {
      qualified: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: 0,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "moderada",
      targetMarket: "",
      actionText: "",
      confidenceScore: 0,
    };
  }

  // Se houve gol no histórico ou intervalo HT, os pontos anteriores NÃO podem ser computados!
  const isSecondHalfTrend = curMin >= 46;
  const halfStartMinTrend = isSecondHalfTrend ? 46 : 1;
  const baseThreshold = Math.max(halfStartMinTrend, curMin - windowMinutes);
  const minThreshold = (lastGoalMin !== null && lastGoalMin !== undefined)
    ? Math.max(baseThreshold, lastGoalMin + 1)
    : baseThreshold;

  const rawTimeline = match.momentumTimeline || [];
  const pointsInWindow = rawTimeline.filter(
    (pt) => pt.minute >= minThreshold && pt.minute <= curMin
  );

  let homeSum = 0;
  let awaySum = 0;
  let homeHighPoints = 0;
  let awayHighPoints = 0;
  let homeShots = 0;
  let awayShots = 0;
  let homeAttacks = 0;
  let awayAttacks = 0;

  const totalPoints = pointsInWindow.length;

  const minPointMin = pointsInWindow.length > 0 ? Math.min(...pointsInWindow.map((p) => p.minute)) : curMin;
  const maxPointMin = pointsInWindow.length > 0 ? Math.max(...pointsInWindow.map((p) => p.minute)) : curMin;
  const chronologicalSpan = maxPointMin - minPointMin;
  const requiredSpan = Math.min(windowMinutes - 2, 5);

  if (totalPoints >= 3 && chronologicalSpan >= requiredSpan) {
    pointsInWindow.forEach((pt) => {
      const hPress = pt.homePressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 + pt.diff / 2)) : 50);
      const aPress = pt.awayPressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 - pt.diff / 2)) : 50);
      homeSum += hPress;
      awaySum += aPress;

      if (hPress >= pointThreshold) homeHighPoints++;
      if (aPress >= pointThreshold) awayHighPoints++;

      if (pt.homeShot) homeShots++;
      if (pt.awayShot) awayShots++;
      if (pt.homeDangerousAttack) homeAttacks++;
      if (pt.awayDangerousAttack) awayAttacks++;
    });
  } else {
    // Proteção contra Cold Start / Primeiro Scan do Crawler ou leituras agrupadas:
    // Uma tendência de pressão contínua exige dados cronológicos reais da janela cobrindo o tempo necessário.
    return {
      qualified: false,
      team: null,
      teamName: "",
      opponentName: "",
      windowMinutes,
      avgPressure: 50,
      consistencyPct: 0,
      highPressureMinutes: 0,
      totalPointsInWindow: totalPoints,
      shotsInWindow: 0,
      dangerousAttacksInWindow: 0,
      trendDirection: "sustained_high",
      intensity: "moderada",
      targetMarket: "",
      actionText: `Aguardando histórico real da janela recente (${totalPoints}/3 leituras, cobertura ${chronologicalSpan}m/${requiredSpan}m). Aguarde alguns minutos de monitoramento ao vivo.`,
      confidenceScore: 0,
    };
  }

  const effectiveCount = totalPoints >= 3 ? totalPoints : windowMinutes;
  const avgHome = Math.round(homeSum / (effectiveCount || 1));
  const avgAway = Math.round(awaySum / (effectiveCount || 1));
  const homeConsistency = Math.round((homeHighPoints / (effectiveCount || 1)) * 100);
  const awayConsistency = Math.round((awayHighPoints / (effectiveCount || 1)) * 100);

  // Critério de pressão alta constante no período da janela:
  // - Pressão média >= minAvgPressure (Padrão: 68%)
  // - Consistência (tempo no ataque com pressão >= pointThreshold) >= minConsistency (Padrão: 65%)
  // - Finalizações mínimas comprovadas na janela (Padrão: >= 2 chutes no gol ou fora) para eliminar falsa pressão estéril
  // - Atividade ofensiva na janela
  const isHomeDominant =
    avgHome >= minAvgPressure &&
    homeConsistency >= minConsistency &&
    (homeShots >= minFinalizations || (homeAttacks >= 5 && avgHome >= (minAvgPressure + 6)));

  const isAwayDominant =
    avgAway >= minAvgPressure &&
    awayConsistency >= minConsistency &&
    (awayShots >= minFinalizations || (awayAttacks >= 5 && avgAway >= (minAvgPressure + 6)));

  let qualified = false;
  let dominantSide: 'home' | 'away' | null = null;

  if (isHomeDominant && (!isAwayDominant || avgHome >= avgAway)) {
    qualified = true;
    dominantSide = 'home';
  } else if (isAwayDominant) {
    qualified = true;
    dominantSide = 'away';
  }

  // Proteção: O time dominante qualificado precisa ter pressão comprovadamente alta
  const minSafePressure = Math.min(minAvgPressure, 65);
  if (dominantSide === 'home' && avgHome < minSafePressure) {
    qualified = false;
    dominantSide = null;
  }
  if (dominantSide === 'away' && avgAway < minSafePressure) {
    qualified = false;
    dominantSide = null;
  }
  if (!dominantSide) {
    qualified = false;
  }

  const teamName = dominantSide === 'home' ? match.homeTeam.name : dominantSide === 'away' ? match.awayTeam.name : "";
  const opponentName = dominantSide === 'home' ? match.awayTeam.name : dominantSide === 'away' ? match.homeTeam.name : "";
  const avgPressure = dominantSide === 'home' ? avgHome : dominantSide === 'away' ? avgAway : 50;
  const consistencyPct = dominantSide === 'home' ? homeConsistency : dominantSide === 'away' ? awayConsistency : 0;
  const highPressureMinutes = dominantSide === 'home' ? homeHighPoints : dominantSide === 'away' ? awayHighPoints : 0;
  const shotsInWindow = dominantSide === 'home' ? homeShots : dominantSide === 'away' ? awayShots : 0;
  const dangerousAttacksInWindow = dominantSide === 'home' ? homeAttacks : dominantSide === 'away' ? awayAttacks : 0;

  let intensity: TrendAlertEvaluation['intensity'] = 'moderada';
  if (avgPressure >= 78 && consistencyPct >= 80) {
    intensity = 'extrema';
  } else if (avgPressure >= 70 && consistencyPct >= 70) {
    intensity = 'alta';
  }

  // Direção da tendência recente
  let trendDirection: TrendAlertEvaluation['trendDirection'] = 'sustained_high';
  if (pointsInWindow.length >= 6) {
    const firstHalf = pointsInWindow.slice(0, Math.floor(pointsInWindow.length / 2));
    const secondHalf = pointsInWindow.slice(Math.floor(pointsInWindow.length / 2));
    const firstAvg = firstHalf.reduce((acc, p) => acc + (dominantSide === 'home' ? (p.homePressure ?? 50) : (p.awayPressure ?? 50)), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((acc, p) => acc + (dominantSide === 'home' ? (p.homePressure ?? 50) : (p.awayPressure ?? 50)), 0) / secondHalf.length;
    if (secondAvg > firstAvg + 8) {
      trendDirection = 'increasing';
    } else if (secondAvg >= 80) {
      trendDirection = 'peak';
    }
  }

  // Confiança e mercado sugerido
  const confidenceScore = Math.min(96, Math.max(70, Math.round(avgPressure * 0.7 + consistencyPct * 0.3)));
  const domGoals = dominantSide === 'home' ? match.score.home : match.score.away;
  const oppGoals = dominantSide === 'home' ? match.score.away : match.score.home;

  let targetMarket = "";
  let actionText = "";
  if (domGoals <= oppGoals) {
    targetMarket = `Próximo Gol ${teamName} / Back ${teamName}`;
    actionText = `Pressão sufocante há ${windowMinutes} min. Entrada a favor do ${teamName} (Próximo Gol ou Back).`;
  } else {
    targetMarket = `Over Gols / Escanteios ${teamName}`;
    actionText = `Mesmo em vantagem, o ${teamName} mantém pressão constante há ${windowMinutes} min. Favorável a Over e Cantos.`;
  }

  let bettingTip: TacticalTipData | undefined = undefined;
  if (qualified) {
    bettingTip = generateBettingTip({
      marketCode: "TREND_PRESSURE_15M",
      marketName: `Trend Alert: Pressão Contínua (${windowMinutes} min)`,
      targetSelection: targetMarket,
      probabilityPct: confidenceScore,
      confidence: intensity,
      reasoning: `O ${teamName} sustentou ${avgPressure}% de pressão média nos últimos ${windowMinutes} minutos (${consistencyPct}% do tempo acuando o adversário), produzindo ${dangerousAttacksInWindow} ataques e ${shotsInWindow} finalizações.`,
      actionText,
      match,
      config,
    });
  }

  const formattedTelegram = `TREND ALERT: ${teamName} mantém sufoco contínuo (${avgPressure}% em ${windowMinutes}m) aos ${match.minute}'!`;

  return {
    qualified,
    team: dominantSide,
    teamName,
    opponentName,
    windowMinutes,
    avgPressure,
    consistencyPct,
    highPressureMinutes,
    totalPointsInWindow: effectiveCount,
    shotsInWindow,
    dangerousAttacksInWindow,
    trendDirection,
    intensity,
    targetMarket,
    actionText,
    confidenceScore,
    bettingTip,
    formattedTelegram,
    targetOddMin,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// MASTER AGGREGATOR: EVALUATE ALL RULES FOR A MATCH
// ──────────────────────────────────────────────────────────────────────────
export function evaluateAllMatchRules(
  match: Match,
  config: OperationalRulesConfig = DEFAULT_RULES_CONFIG
): MatchRulesAnalysis {
  // Parâmetro Central do Radar (Fonte Única da Verdade: Regra 3:1)
  // Unifica centralmente chancesPerGoalRatio para Diagnóstico Clássico, Dívida de Gols e Trinca de Dívidas
  const centralRatio = Math.max(1.0, config.chancesPerGoalRatio || 3.0);
  const unifiedConfig: OperationalRulesConfig = {
    ...config,
    chancesPerGoalRatio: centralRatio,
    tripleDebtConfig: config.tripleDebtConfig
      ? { ...config.tripleDebtConfig, chancesPerGoalRatio: centralRatio }
      : undefined,
    goalDebtClassicConfig: config.goalDebtClassicConfig
      ? { ...config.goalDebtClassicConfig, chancesPerGoalRatio: centralRatio }
      : undefined,
  };

  // Check if match is within the configured minute window for alerts
  const minMin = Number(unifiedConfig.minMinuteAlert ?? 0);
  const maxMin = Number(unifiedConfig.maxMinuteAlert ?? 90);
  const curMin = Number(match.minute ?? 0);
  const statusUpper = (match.status || "").toUpperCase();
  const isFinished = statusUpper === "FT" || statusUpper === "FINISHED" || statusUpper === "ENCERRADO" || curMin >= 90;
  const isHalfTime =
    statusUpper === "HT" ||
    statusUpper === "INT" ||
    statusUpper === "38" ||
    statusUpper === "HALF_TIME" ||
    statusUpper === "HALF TIME" ||
    statusUpper === "HALF-TIME" ||
    statusUpper === "HALFTIME" ||
    statusUpper === "INTERVALO" ||
    statusUpper === "INTERVAL" ||
    statusUpper === "DESCANSO" ||
    statusUpper === "PAUSA" ||
    statusUpper === "BREAK" ||
    statusUpper.includes("HT") ||
    statusUpper.includes("INTERVAL") ||
    statusUpper.includes("HALF TIME") ||
    statusUpper.includes("HALFTIME") ||
    statusUpper.includes("HALF-TIME") ||
    statusUpper.includes("HALF_TIME") ||
    statusUpper.includes("DESCANSO") ||
    statusUpper.includes("PAUSA") ||
    /\bHT\b/.test(statusUpper) ||
    /\bINT\b/.test(statusUpper) ||
    match.status === "HT";

  // Cooldown Geral Pós-Gol (3 minutos / 180s)
  const postGoalMinutes = config.postGoalCooldownMinutes ?? 3;
  const postGoalSeconds = postGoalMinutes * 60;
  const lastGoalTime = match.lastGoalTimestamp || 0;
  const elapsedSec = lastGoalTime > 0 ? (Date.now() - lastGoalTime) / 1000 : 99999;
  const lastGoalMin = getLastGoalMinute(match);
  const minSinceGoal = lastGoalMin !== null ? curMin - lastGoalMin : 99999;
  const isPostGoalCooldown = (lastGoalTime > 0 && elapsedSec < postGoalSeconds) || (lastGoalMin !== null && minSinceGoal >= 0 && minSinceGoal < postGoalMinutes);
  const remainingCooldownSec = elapsedSec < postGoalSeconds
    ? Math.max(0, Math.ceil(postGoalSeconds - elapsedSec))
    : (minSinceGoal >= 0 && minSinceGoal < postGoalMinutes ? (postGoalMinutes - minSinceGoal) * 60 : 0);

  const postGoalCooldownInfo = {
    active: isPostGoalCooldown,
    remainingSeconds: isPostGoalCooldown ? remainingCooldownSec : 0,
    lastGoalMinute: lastGoalMin ?? undefined,
  };

  if (isFinished || isHalfTime || curMin < minMin || curMin > maxMin) {
    const reasonText = isFinished
      ? "Partida encerrada"
      : isHalfTime
      ? "Partida no Intervalo (HT) - Alertas pausados"
      : `Fora da Janela de Minutos (${minMin}'-${maxMin}')`;
    return {
      matchId: match.id,
      ratioConfigured: unifiedConfig.chancesPerGoalRatio,
      postGoalCooldown: postGoalCooldownInfo,
      codigo31: {
        alertType: null,
        shouldAlert: false,
        reason: reasonText,
        level: null,
        market: null,
        bucket: 0,
        totalCc: 0,
        homeCc: 0,
        awayCc: 0,
        totalGoals: 0,
        homeScore: match.score.home,
        awayScore: match.score.away,
        ccRate: 0,
        expectedGoalsByCc: 0,
        isDevendoGol: false,
        saldoGolsDevidos: 0,
        ratioUsed: unifiedConfig.chancesPerGoalRatio,
        dominantTeam: null,
        dominantName: "",
        dominantCc: 0,
        oppCc: 0,
        ccDiff: 0,
        expectedDominantGoalsByCc: 0,
        isDominantDevendoGol: false,
        saldoGolsDominante: 0,
        isDominantTrailing: false,
        dominantLead: 0,
        title: "",
        emoji: "",
        motivo: reasonText,
        leitura: "",
        formattedTelegram: "",
      },
      tripleDebt: {
        tripleDebtFormed: false,
        scope: "none",
        scopeSide: null,
        debtorTeamName: undefined,
        ccInScope: 0,
        xgInScope: 0,
        xgotInScope: 0,
        goalsInScope: 0,
        expectedGoalsByCc: 0,
        ccDebt: false,
        xgDebt: false,
        xgotDebt: false,
        failedReasons: [reasonText],
        blockReason: reasonText,
        wouldBlockSignal: false,
        statusBadge: "Sem Débito",
      },
      pressaoVendavel: {
        qualified: false,
        side: null,
        team: "",
        minute: curMin,
        score: `${match.score.home} - ${match.score.away}`,
        tese: "",
        fails: [reasonText],
        metrics: {
          cc: 0,
          xg: 0,
          xgot: 0,
          shots: 0,
          sot: 0,
          sotPct: 0,
          posse: 50,
          toquesArea: 0,
          oppXg: 0,
        },
      },
      dominantTrailing: {
        dominantSide: null,
        dominantScore: 0,
        opponentScore: 0,
        dominantIsTrailing: false,
        dominantTrailingBy: 0,
        dominantReactionConfirmed: false,
        livePressureStatus: "neutro",
        entryAllowed: false,
        blockReason: reasonText,
        status: "NOT_TRAILING",
      },
      superBackDominante: {
        qualified: false,
        tier: 'NENHUM',
        dominantSide: null,
        dominantTeam: "",
        opponentTeam: "",
        minute: curMin,
        score: `${match.score.home} - ${match.score.away}`,
        deficitGoals: 0,
        situation: 'EMPATANDO',
        dominantXg: 0,
        opponentXg: 0,
        xgDiff: 0,
        dominantCc: 0,
        dominantPressure: 50,
        livePressureStatus: 'neutro',
        dangerousAttacksLast10: 0,
        shotsOnTarget: 0,
        possession: 50,
        hasStructuralVolume: false,
        hasLiveReaction: false,
        hasOpponentZeroThreat: false,
        tese: reasonText,
        marketTarget: "Back Favorito / Lay Zebra",
        probTarget: 0,
        fairOdd: 0,
        minRecommendedOdd: 0,
        confidence: 'moderada',
        reactionReasons: [],
        fails: [reasonText],
      },
      goalDebtClassic: {
        qualified: false,
        minute: curMin,
        score: `${match.score.home} - ${match.score.away}`,
        totalDebtGoals: 0,
        totalXg: 0,
        xgDiff: 0,
        dominantTeam: "",
        dominantSide: null,
        dominantXg: 0,
        dominantGoals: 0,
        dominantXgDebt: 0,
        underdogTeam: "",
        underdogXg: 0,
        underdogGoals: 0,
        isDevendoGol: false,
        blockReason: reasonText,
        reasoning: "",
        actionText: "",
      },
      halfTimeValue: {
        qualified: false,
        minute: curMin,
        score: `${match.score.home} - ${match.score.away}`,
        totalGoals: (match.score.home || 0) + (match.score.away || 0),
        combinedPressure: 0,
        dominantPressure: 0,
        dominantTeam: "",
        dominantSide: null,
        totalCc: 0,
        totalXg: 0,
        dangerousAttacksLast10: 0,
        targetMarket: 'OVER_HT',
        targetLine: "",
        confidenceTier: 'B+',
        reasoning: reasonText,
        actionText: "",
      },
      imminentGoal: {
        qualified: false,
        isImminent: false,
        intensity: "nenhuma",
        team: null,
        teamName: "",
        opponentName: "",
        windowMinutes: 5,
        avgPressure: 50,
        consistencyPct: 0,
        highPressureMinutes: 0,
        totalPointsInWindow: 0,
        shotsInWindow: 0,
        dangerousAttacksInWindow: 0,
        trendDirection: "sustained_high",
        targetMarket: "",
        variationPct5m: 0,
        totalChancesLast5: 0,
        totalChancesPrev5: 0,
        homeChancesLast5: 0,
        awayChancesLast5: 0,
        effectiveDebt: 0,
        triggerReason: reasonText,
        confidenceScore: 0,
        title: "",
        actionText: "",
      },
      trendAlert: {
        qualified: false,
        team: null,
        teamName: "",
        opponentName: "",
        windowMinutes: config.trendAlertWindowMinutes || 15,
        avgPressure: 50,
        consistencyPct: 0,
        highPressureMinutes: 0,
        totalPointsInWindow: 0,
        shotsInWindow: 0,
        dangerousAttacksInWindow: 0,
        trendDirection: "sustained_high",
        intensity: "moderada",
        targetMarket: "",
        actionText: "",
        confidenceScore: 0,
      },
      ambasMarcam: {
        qualified: false,
        homeXg: match.stats.xG.home,
        awayXg: match.stats.xG.away,
        homeSot: match.stats.shotsOnTarget.home,
        awaySot: match.stats.shotsOnTarget.away,
        currentScore: `${match.score.home} - ${match.score.away}`,
      },
      traditionalSignals: [],
      hasActiveOperationalAlert: false,
      primaryAlertBadge: undefined,
      activeTips: [],
    };
  }

  const codigo31 = evaluateCodigo31(match, unifiedConfig);
  const tripleDebt = evaluateTripleDebt(match, unifiedConfig);
  const pressaoVendavel = evaluatePressaoVendavel(match, unifiedConfig);
  const dominantTrailing = evaluateDominantTrailing(match, unifiedConfig);
  const superBackDominante = evaluateSuperBackDominante(match, unifiedConfig);
  const goalDebtClassic = evaluateGoalDebtClassic(match, unifiedConfig);
  const halfTimeValue = evaluateHalfTimeValue(match, unifiedConfig);
  const imminentGoal = evaluateImminentGoal(match, unifiedConfig);
  const trendAlert = evaluateTrendAlert(match, unifiedConfig);
  const ambasMarcam = evaluateAmbasMarcam(match, unifiedConfig);
  const traditionalSignals = evaluateTraditionalSignals(match, unifiedConfig);

  // ──────────────────────────────────────────────────────────────────────────
  // ENGINE DE CONFLUÊNCIA CRUZADA (REGRA 1 - TREND ALERT + REGRA 7 - SURTO 5M)
  // Se ambas as regras dispararem para o mesmo time dentro do recorte recente:
  // - isConfluent = true
  // - convictionLevel = 'MAX'
  // - targetOddMin reduzida para 1.40 - 1.45
  // ──────────────────────────────────────────────────────────────────────────
  const isSecondHalfForConfluence = curMin >= 46 || statusUpper === "2H" || statusUpper === "2T";
  let isConfluent = false;
  let confluenceReason = "";

  if (
    imminentGoal.isImminent &&
    trendAlert.qualified &&
    imminentGoal.team &&
    trendAlert.team &&
    imminentGoal.team === trendAlert.team
  ) {
    isConfluent = true;
    const dominantConfluentTeam = imminentGoal.teamName || trendAlert.teamName || "Equipe";
    confluenceReason = `CONFLUÊNCIA MÁXIMA: Regra 1 (Super Pressão Contínua) e Regra 7 (Surto 5m) disparadas em sincronia para o ${dominantConfluentTeam}. Convicção MAX: Exigência de Odd reduzida para ${isSecondHalfForConfluence ? "1.40" : "1.45"}.`;
    
    // Atualiza estado de confluência nas avaliações individuais
    imminentGoal.isConfluent = true;
    imminentGoal.convictionLevel = 'MAX';
    imminentGoal.targetOddMin = isSecondHalfForConfluence ? 1.40 : 1.45;

    trendAlert.isConfluent = true;
    trendAlert.convictionLevel = 'MAX';
    trendAlert.targetOddMin = isSecondHalfForConfluence ? 1.40 : 1.45;
  } else {
    if (imminentGoal.isImminent) {
      imminentGoal.convictionLevel = imminentGoal.intensity === 'extrema' ? 'ALTA' : 'MODERADA';
    }
    if (trendAlert.qualified) {
      trendAlert.convictionLevel = trendAlert.intensity === 'extrema' ? 'ALTA' : 'MODERADA';
    }
  }

  // Collect all active tactical tips
  const activeTips: TacticalTipData[] = [];
  if (codigo31.shouldAlert && codigo31.bettingTip) activeTips.push(codigo31.bettingTip);
  if (tripleDebt.tripleDebtFormed && tripleDebt.bettingTip) activeTips.push(tripleDebt.bettingTip);
  if (superBackDominante.qualified && superBackDominante.bettingTip) activeTips.push(superBackDominante.bettingTip);
  else {
    if (pressaoVendavel.qualified && pressaoVendavel.bettingTip) activeTips.push(pressaoVendavel.bettingTip);
    if (dominantTrailing.status === 'DOMINANT_REACTION_CONFIRMED' && dominantTrailing.bettingTip) activeTips.push(dominantTrailing.bettingTip);
  }
  if (goalDebtClassic.qualified && goalDebtClassic.bettingTip) activeTips.push(goalDebtClassic.bettingTip);
  if (halfTimeValue.qualified && halfTimeValue.bettingTip) activeTips.push(halfTimeValue.bettingTip);
  if (imminentGoal.isImminent && imminentGoal.bettingTip) activeTips.push(imminentGoal.bettingTip);
  if (config.enableTrendAlert !== false && trendAlert.qualified && trendAlert.bettingTip) activeTips.push(trendAlert.bettingTip);
  if (ambasMarcam.qualified && ambasMarcam.bettingTip) activeTips.push(ambasMarcam.bettingTip);
  if (config.enableV12OverBack !== false && traditionalSignals.length > 0) {
    const topSig = traditionalSignals[0];
    const isOverMarket = topSig.marketTarget.startsWith("OVER_");
    const formattedSelection = isOverMarket
      ? `Over ${topSig.marketTarget.replace("OVER_", "").replace("_", ".")} Gols`
      : topSig.marketTarget === "NEXT_GOAL"
        ? "Próximo Gol"
        : "Back Favorito";

    const tip = generateBettingTip({
      marketCode: topSig.marketTarget,
      marketName: topSig.ruleName.replace(/_/g, " "),
      targetSelection: formattedSelection,
      probabilityPct: topSig.confidenceTier.startsWith("A") ? 82 : 74,
      confidence: topSig.confidenceTier.startsWith("A") ? "extrema" : "alta",
      reasoning: topSig.trace,
      actionText: `Entrada recomendada via Sinal Tradicional V1.2: ${topSig.recommendedAction}.`,
      match,
    });
    if (tip) activeTips.push(tip);
  }

  let hasActiveOperationalAlert =
    codigo31.shouldAlert ||
    tripleDebt.tripleDebtFormed ||
    superBackDominante.qualified ||
    pressaoVendavel.qualified ||
    dominantTrailing.status === 'DOMINANT_REACTION_CONFIRMED' ||
    goalDebtClassic.qualified ||
    halfTimeValue.qualified ||
    (config.enableImminentGoal && imminentGoal.isImminent && (imminentGoal.intensity === 'extrema' || imminentGoal.intensity === 'alta')) ||
    (config.enableTrendAlert !== false && trendAlert.qualified) ||
    ambasMarcam.qualified ||
    (config.enableV12OverBack !== false && traditionalSignals.length > 0);

  let primaryAlertBadge: MatchRulesAnalysis["primaryAlertBadge"] = undefined;
  
  if (isConfluent) {
    primaryAlertBadge = {
      emoji: "🔥",
      label: `CONFLUÊNCIA MÁX (${imminentGoal.teamName ? imminentGoal.teamName.slice(0, 10) : 'R1+R7'})`,
      level: "premium",
      market: imminentGoal.targetMarket.includes("Back") || imminentGoal.targetMarket.includes("BACK") ? "back" : "over",
    };
  } else if (superBackDominante.qualified) {
    primaryAlertBadge = {
      emoji: "🎯",
      label: `SUPER BACK (${superBackDominante.dominantTeam.slice(0, 10)} [${superBackDominante.tier}])`,
      level: superBackDominante.tier === 'OURO' ? "premium" : "forte",
      market: "back",
    };
  } else if (config.enableImminentGoal && imminentGoal.isImminent && imminentGoal.intensity === 'extrema') {
    primaryAlertBadge = {
      emoji: "🚨",
      label: `GOL IMINENTE (${imminentGoal.teamName ? imminentGoal.teamName.slice(0, 10) : 'SURTO'} ${imminentGoal.avgPressure}%)`,
      level: "premium",
      market: imminentGoal.targetMarket.includes("Back") || imminentGoal.targetMarket.includes("BACK") ? "back" : "over",
    };
  } else if (config.enableTrendAlert !== false && trendAlert.qualified) {
    primaryAlertBadge = {
      emoji: "📈",
      label: `TREND ALERT (${trendAlert.teamName.slice(0, 10)} ${trendAlert.avgPressure}%)`,
      level: trendAlert.intensity === 'extrema' ? "premium" : "forte",
      market: "back",
    };
  } else if (halfTimeValue.qualified) {
    primaryAlertBadge = {
      emoji: "⏱️",
      label: `VALOR HT (${halfTimeValue.targetLine})`,
      level: halfTimeValue.confidenceTier === 'A' ? "premium" : "forte",
      market: "over",
    };
  } else if (codigo31.shouldAlert && codigo31.level && codigo31.market) {
    primaryAlertBadge = {
      emoji: codigo31.emoji,
      label: codigo31.title,
      level: codigo31.level,
      market: codigo31.market,
    };
  } else if (goalDebtClassic.qualified) {
    primaryAlertBadge = {
      emoji: "⚡",
      label: `DÍVIDA CLÁSSICA (${goalDebtClassic.totalDebtGoals} GOL${goalDebtClassic.totalDebtGoals > 1 ? 'S' : ''})`,
      level: "forte",
      market: goalDebtClassic.dominantGoals <= goalDebtClassic.underdogGoals ? "back" : "over",
    };
  } else if (tripleDebt.tripleDebtFormed) {
    const debtorLabel = tripleDebt.scope === "unilateral" && tripleDebt.debtorTeamName
      ? `TRINCA DE DÍVIDAS (${tripleDebt.debtorTeamName})`
      : `TRINCA DE DÍVIDAS (${tripleDebt.scope.toUpperCase()})`;
    primaryAlertBadge = {
      emoji: "💎",
      label: debtorLabel,
      level: "premium",
      market: tripleDebt.scope === "unilateral" ? "back" : "over",
    };
  } else if (config.enableImminentGoal && imminentGoal.isImminent && imminentGoal.intensity === 'alta') {
    primaryAlertBadge = {
      emoji: "🚨",
      label: `GOL IMINENTE (${imminentGoal.teamName ? imminentGoal.teamName.slice(0, 10) : 'SURTO'} ${imminentGoal.avgPressure}%)`,
      level: "forte",
      market: "over",
    };
  } else if (pressaoVendavel.qualified) {
    primaryAlertBadge = {
      emoji: "⚡",
      label: `PRESSÃO VENDÁVEL (${pressaoVendavel.team})`,
      level: "forte",
      market: "back",
    };
  } else if (dominantTrailing.status === 'DOMINANT_REACTION_CONFIRMED') {
    const domTeam = dominantTrailing.dominantSide === 'home' ? match.homeTeam.name : match.awayTeam.name;
    primaryAlertBadge = {
      emoji: "🎯",
      label: `BACK DOMINANTE (${domTeam})`,
      level: dominantTrailing.livePressureStatus === 'brutal' ? "premium" : "forte",
      market: "back",
    };
  } else if (ambasMarcam.qualified) {
    primaryAlertBadge = {
      emoji: "🎯",
      label: "AMBAS MARCAM (BTTS: SIM)",
      level: "forte",
      market: "btts",
    };
  } else if (config.enableV12OverBack !== false && traditionalSignals.length > 0) {
    const topSig = traditionalSignals[0];
    primaryAlertBadge = {
      emoji: "📈",
      label: `V1.2: ${topSig.ruleName.replace(/_/g, " ")}`,
      level: topSig.confidenceTier.startsWith("A") ? "premium" : "forte",
      market: topSig.marketTarget.includes("BACK") ? "back" : "over",
    };
  }

  // Se a partida estiver sob resguardo / cooldown pós-gol de 3 minutos, neutraliza o alerta principal ativo
  if (isPostGoalCooldown) {
    hasActiveOperationalAlert = false;
    primaryAlertBadge = undefined;
  }

  return {
    matchId: match.id,
    ratioConfigured: unifiedConfig.chancesPerGoalRatio,
    postGoalCooldown: postGoalCooldownInfo,
    isConfluent,
    confluenceReason: isConfluent ? confluenceReason : undefined,
    codigo31,
    tripleDebt,
    pressaoVendavel,
    dominantTrailing,
    superBackDominante,
    goalDebtClassic,
    halfTimeValue,
    imminentGoal,
    trendAlert,
    ambasMarcam,
    traditionalSignals,
    hasActiveOperationalAlert,
    primaryAlertBadge,
    activeTips,
  };
}
