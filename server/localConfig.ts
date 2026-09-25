// server/localConfig.ts
import fs from "fs";
import path from "path";
import { OperationalRulesConfig, AlertRule, CustomWebhookEndpoint } from "../src/types";
import { DEFAULT_RULES_CONFIG } from "./rulesEngine";

export interface LocalConfigFile {
  version: string;
  savedAt: string;
  userProfile: {
    displayName: string;
    role: "admin";
    status: "approved";
    crawlerToken: string;
    mode: "local_standalone";
  };
  preferences: {
    viewMode: "grid" | "carousel" | "compact";
    sortOption: string;
    soundEnabled: boolean;
    customMatchOrder: string[];
    leagueFilter: string;
  };
  noiseReduction?: {
    hideFinishedMatches: boolean;
    mutedMatchIds: Record<string, boolean>;
    enabledCategories: Record<string, boolean>;
    selectedMatchFilter: string;
  };
  operationalConfig: OperationalRulesConfig;
  alertRules: AlertRule[];
  customWebhooks: CustomWebhookEndpoint[];
  customUserSettings: Record<string, any>;
}

export type DeepPartialLocalConfigFile = {
  version?: string;
  savedAt?: string;
  userProfile?: Partial<LocalConfigFile["userProfile"]>;
  preferences?: Partial<LocalConfigFile["preferences"]>;
  noiseReduction?: Partial<NonNullable<LocalConfigFile["noiseReduction"]>>;
  operationalConfig?: Partial<OperationalRulesConfig>;
  alertRules?: AlertRule[];
  customWebhooks?: CustomWebhookEndpoint[];
  customUserSettings?: Record<string, any>;
};

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE_PATH = path.join(DATA_DIR, "bacanalive_config.json");

// Default initial clean rules
export const DEFAULT_LOCAL_ALERT_RULES: AlertRule[] = [
  {
    id: "rule-trend-super-pressure",
    name: "📈 Trend Alert: Super Pressão Contínua",
    description: "Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=70% de média com consistência >=70%) no histórico do momentum em 10m.",
    matchId: "all",
    enabled: true,
    logic: "AND",
    conditions: [
      { metric: "pressureTrendWindow", operator: ">=", value: 70, windowMinutes: 10 },
      { metric: "minute", operator: ">=", value: 10 },
    ],
    severity: "opportunity",
    soundEnabled: true,
    browserNotification: true,
    messageTemplate: "📈 TREND ALERT: {dominantTeam} mantém super pressão contínua ({dominantPressure}% em {pressureWindow}m) aos {minute}'! Probabilidade elevada de gol (Placar: {score}).",
    triggerCount: 0,
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
    triggerCount: 0,
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
  },
  {
    id: "rule-super-back-dominante",
    name: "🎯 Super Back Dominante: Reação Confirmada & Pressão Vendável",
    description: "Regra Unificada (Fusão Regras 3 e 4). Identifica favorito ou equipe dominante no 2T (55'-78') em empate ou perdendo por até 1 gol, com superioridade estatística comprovada e reação viva com alta pressão ofensiva.",
    matchId: "all",
    enabled: true,
    logic: "AND",
    conditions: [
      { metric: "superBackDominanteQualified", operator: "==", value: 1 },
      { metric: "minute", operator: ">=", value: 55 },
      { metric: "minute", operator: "<=", value: 78 },
    ],
    severity: "opportunity",
    soundEnabled: true,
    browserNotification: true,
    messageTemplate: "🔥 SUPER BACK QUALIFICADO: {dominantTeam} sufocando no 2T ({minute}'). xG: {dominantXg} vs {opponentXg}, Chutes (10m): {shotsInWindow}, AP/min: {apPerMin}. Odd Mínima Recomendada: >= [{targetOdd}].",
    triggerCount: 0,
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

export const DEFAULT_LOCAL_WEBHOOKS: CustomWebhookEndpoint[] = [
  {
    id: "wh-flashscore-live",
    name: "FlashScore Live Crawler BR",
    slug: "flashscore-live",
    secretToken: "sec_flashscore_982a17f",
    description: "Recepção assíncrona minuto a minuto do crawler FlashScore / Playwright (xG, xGOT, Chutes, Big Chances).",
    active: true,
    asyncMode: true,
    autoTriggerAlerts: true,
    autoComputeMomentum: true,
    targetLeague: "Brasileirão Série A / Libertadores / Premier League",
    createdAt: new Date().toISOString(),
    totalCalls: 0,
    lastStatus: "ok",
  },
];

export class LocalConfigManager {
  private currentConfig: LocalConfigFile;

  constructor() {
    this.ensureDataDir();
    this.currentConfig = this.getDefaultConfig();
    this.currentConfig = this.loadFromDisk();
  }

  private ensureDataDir(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      console.error("Erro ao criar pasta data/:", err);
    }
  }

  public getDefaultConfig(): LocalConfigFile {
    return {
      version: "2.5.0-standalone-local",
      savedAt: new Date().toISOString(),
      userProfile: {
        displayName: "Trader Local Pro",
        role: "admin",
        status: "approved",
        crawlerToken: "footstats-crawler-live-key-99",
        mode: "local_standalone",
      },
      preferences: {
        viewMode: "grid",
        sortOption: "tier",
        soundEnabled: true,
        customMatchOrder: [],
        leagueFilter: "all",
      },
      noiseReduction: {
        hideFinishedMatches: true,
        mutedMatchIds: {},
        enabledCategories: {
          imminent_goal: true,
          back_dominant: true,
          triple_debt: true,
          goal_debt_over: true,
          corners: true,
          btts_ambas: true,
          pressao_blitz: true,
          cards: true,
          under_value: true,
          virada_turnaround: true,
          cashout: true,
        },
        selectedMatchFilter: "all",
      },
      operationalConfig: {
        ...DEFAULT_RULES_CONFIG,
      },
      alertRules: [...DEFAULT_LOCAL_ALERT_RULES],
      customWebhooks: [...DEFAULT_LOCAL_WEBHOOKS],
      customUserSettings: {},
    };
  }

  private loadFromDisk(): LocalConfigFile {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        console.log("💾 [LOCAL CONFIG] Configurações carregadas com sucesso de:", CONFIG_FILE_PATH);
        const defaults = this.getDefaultConfig();
        return {
          ...defaults,
          ...parsed,
          userProfile: {
            ...defaults.userProfile,
            ...(parsed.userProfile || {}),
          },
          preferences: {
            ...defaults.preferences,
            ...(parsed.preferences || {}),
          },
          noiseReduction: {
            ...defaults.noiseReduction!,
            ...(parsed.noiseReduction || {}),
          },
          operationalConfig: {
            ...(parsed.operationalConfig || {}),
            ...defaults.operationalConfig,
            v12Config: {
              ...((parsed.operationalConfig && parsed.operationalConfig.v12Config) || {}),
              ...defaults.operationalConfig.v12Config,
              overPremium: {
                ...((parsed.operationalConfig && parsed.operationalConfig.v12Config && parsed.operationalConfig.v12Config.overPremium) || {}),
                ...defaults.operationalConfig.v12Config?.overPremium,
              },
              overBilateralForte: {
                ...((parsed.operationalConfig && parsed.operationalConfig.v12Config && parsed.operationalConfig.v12Config.overBilateralForte) || {}),
                ...defaults.operationalConfig.v12Config?.overBilateralForte,
              },
              overGolLimite: {
                ...((parsed.operationalConfig && parsed.operationalConfig.v12Config && parsed.operationalConfig.v12Config.overGolLimite) || {}),
                ...defaults.operationalConfig.v12Config?.overGolLimite,
              },
              backT1Main: {
                ...((parsed.operationalConfig && parsed.operationalConfig.v12Config && parsed.operationalConfig.v12Config.backT1Main) || {}),
                ...defaults.operationalConfig.v12Config?.backT1Main,
              },
            },
            superPressureConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.superPressureConfig) || {}),
              ...defaults.operationalConfig.superPressureConfig,
            },
            pressaoVendavelConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.pressaoVendavelConfig) || {}),
              ...defaults.operationalConfig.pressaoVendavelConfig,
            },
            tripleDebtConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.tripleDebtConfig) || {}),
              ...defaults.operationalConfig.tripleDebtConfig,
            },
            dominantTrailingConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.dominantTrailingConfig) || {}),
              ...defaults.operationalConfig.dominantTrailingConfig,
            },
            goalDebtClassicConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.goalDebtClassicConfig) || {}),
              ...defaults.operationalConfig.goalDebtClassicConfig,
            },
            halfTimeValueConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.halfTimeValueConfig) || {}),
              ...defaults.operationalConfig.halfTimeValueConfig,
            },
            superBackDominanteConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.superBackDominanteConfig) || {}),
              ...defaults.operationalConfig.superBackDominanteConfig,
            },
            ambasMarcamConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.ambasMarcamConfig) || {}),
              ...defaults.operationalConfig.ambasMarcamConfig,
            },
            imminentGoalConfig: {
              ...((parsed.operationalConfig && parsed.operationalConfig.imminentGoalConfig) || {}),
              ...defaults.operationalConfig.imminentGoalConfig,
            },

            crawlerConfig: {
              ...defaults.operationalConfig.crawlerConfig,
              ...((parsed.operationalConfig && parsed.operationalConfig.crawlerConfig) || {}),
              customExcludedKeywords: Array.isArray(parsed.operationalConfig?.crawlerConfig?.customExcludedKeywords)
                ? parsed.operationalConfig.crawlerConfig.customExcludedKeywords
                : (defaults.operationalConfig.crawlerConfig?.customExcludedKeywords || []),
              tierFilter: {
                ...defaults.operationalConfig.crawlerConfig?.tierFilter,
                ...((parsed.operationalConfig && parsed.operationalConfig.crawlerConfig && parsed.operationalConfig.crawlerConfig.tierFilter) || {}),
              },
            },
            trendAlertMinAvgPressure: parsed.operationalConfig?.trendAlertMinAvgPressure ?? parsed.operationalConfig?.superPressureConfig?.minAvgPressure ?? 70,
            trendAlertMinConsistencyPct: parsed.operationalConfig?.trendAlertMinConsistencyPct ?? parsed.operationalConfig?.superPressureConfig?.minConsistencyPct ?? 70,
            trendAlertWindowMinutes: parsed.operationalConfig?.trendAlertWindowMinutes ?? parsed.operationalConfig?.superPressureConfig?.windowMinutes ?? 10,
            trendAlertMinMinute: parsed.operationalConfig?.trendAlertMinMinute ?? parsed.operationalConfig?.superPressureConfig?.minMinute ?? 10,
            trendAlertPointThreshold: parsed.operationalConfig?.trendAlertPointThreshold ?? parsed.operationalConfig?.superPressureConfig?.pointThreshold ?? 65,
            postGoalCooldownMinutes: parsed.operationalConfig?.postGoalCooldownMinutes ?? defaults.operationalConfig.postGoalCooldownMinutes ?? 3,
            crawlerStartupCooldownMinutes: parsed.operationalConfig?.crawlerStartupCooldownMinutes ?? defaults.operationalConfig.crawlerStartupCooldownMinutes ?? 3,
            enableGoalAlerts: parsed.operationalConfig?.enableGoalAlerts ?? parsed.operationalConfig?.showGoalAlerts ?? defaults.operationalConfig.enableGoalAlerts ?? true,
            showGoalAlerts: parsed.operationalConfig?.showGoalAlerts ?? parsed.operationalConfig?.enableGoalAlerts ?? defaults.operationalConfig.showGoalAlerts ?? true,
          },
          alertRules: (() => {
            const rawList: AlertRule[] = Array.isArray(parsed.alertRules) ? parsed.alertRules : defaults.alertRules;
            let updated = rawList.map((r: AlertRule) => {
              if (r.id === "rule-super-pressure-home" || r.id === "rule-trend-super-pressure") {
                const pressCond = r.conditions?.find((c: any) =>
                  c.metric === "pressureTrendWindow" || c.metric === "avgPressure" || c.metric === "pressure"
                );
                const minCond = r.conditions?.find((c: any) => c.metric === "minute");
                const sp = parsed.operationalConfig?.superPressureConfig;
                const minAvg = pressCond && !isNaN(Number(pressCond.value))
                  ? Number(pressCond.value)
                  : (sp?.minAvgPressure ?? parsed.operationalConfig?.trendAlertMinAvgPressure ?? 70);
                const winMin = pressCond && (pressCond as any).windowMinutes !== undefined && !isNaN(Number((pressCond as any).windowMinutes))
                  ? Number((pressCond as any).windowMinutes)
                  : (sp?.windowMinutes ?? parsed.operationalConfig?.trendAlertWindowMinutes ?? 10);
                const minMin = minCond && !isNaN(Number(minCond.value))
                  ? Number(minCond.value)
                  : (sp?.minMinute ?? parsed.operationalConfig?.trendAlertMinMinute ?? 10);
                const consPct = sp?.minConsistencyPct ?? parsed.operationalConfig?.trendAlertMinConsistencyPct ?? 70;
                return {
                  ...r,
                  id: "rule-trend-super-pressure",
                  name: "📈 Trend Alert: Super Pressão Contínua",
                  description: `Alerta unificado quando qualquer equipe (mandante ou visitante) sustenta blitz e super pressão contínua (>=${minAvg}% de média com consistência >=${consPct}%) no histórico do momentum em ${winMin}m.`,
                  conditions: [
                    { metric: "pressureTrendWindow", operator: ">=", value: minAvg, windowMinutes: winMin },
                    { metric: "minute", operator: ">=", value: minMin },
                  ],
                  messageTemplate: "📈 TREND ALERT: {dominantTeam} mantém super pressão contínua ({dominantPressure}% em {pressureWindow}m) aos {minute}'! Probabilidade elevada de gol (Placar: {score}).",
                };
              }
              return r;
            });
            // Unifica e remove 'rule-xg-divergence' em favor da regra unificada 'rule-diagnostico-classico'
            updated = updated.filter((r) => r.id !== "rule-xg-divergence");
            const diagIndex = updated.findIndex((r) => r.id === "rule-diagnostico-classico");
            if (diagIndex >= 0) {
              updated[diagIndex] = {
                ...updated[diagIndex],
                name: "⚡ Diagnóstico Clássico: Dívida de Gols & Divergência de xG",
                description: "Alerta unificado de dívida de gols e assimetria estatística. Detecta quando o volume acumulado de chances claras ou xG supera o placar real (dívida de gols para Over), ou quando há ampla divergência de xG entre as equipes (>1.0) com atraso de conversão no placar.",
                messageTemplate: "⚡ DIAGNÓSTICO CLÁSSICO: Dívida de {debtGoals} gol(s) aos {minute}'! {dominantTeam} ({higherXg} xG) x ({lowerXg} xG) {underdogTeam} (dif. +{xgDiff}, total {totalXg} xG) para placar {score}. Probabilidade elevada de GOL/OVER.",
              };
            } else {
              const defaultDiagnostico = defaults.alertRules.find((r) => r.id === "rule-diagnostico-classico");
              if (defaultDiagnostico) updated.push(defaultDiagnostico);
            }
            // Adiciona a regra migrada Trinca de Dívidas (Regra 2) se ainda não existir
            if (!updated.some((r) => r.id === "rule-trinca-de-dividas")) {
              const defaultTriple = defaults.alertRules.find((r) => r.id === "rule-trinca-de-dividas");
              if (defaultTriple) updated.push(defaultTriple);
            }
            // Adiciona a regra migrada Super Back Dominante (Regra 3 unificada) se ainda não existir
            if (!updated.some((r) => r.id === "rule-super-back-dominante")) {
              const defaultSBD = defaults.alertRules.find((r) => r.id === "rule-super-back-dominante");
              if (defaultSBD) updated.push(defaultSBD);
            }
            // Adiciona a regra migrada V12 Over & Back Alavancado (Regra 4) se ainda não existir
            if (!updated.some((r) => r.id === "rule-v12-over-back")) {
              const defaultV12 = defaults.alertRules.find((r) => r.id === "rule-v12-over-back");
              if (defaultV12) updated.push(defaultV12);
            }
            // Adiciona a regra migrada Ambas Marcam (BTTS Sim) se ainda não existir
            if (!updated.some((r) => r.id === "rule-ambas-marcam-btts")) {
              const defaultBTTS = defaults.alertRules.find((r) => r.id === "rule-ambas-marcam-btts");
              if (defaultBTTS) updated.push(defaultBTTS);
            }
            // Atualiza ou adiciona a regra migrada Gol Iminente (Surto Ofensivo 5m)
            const immIndex = updated.findIndex((r) => r.id === "rule-gol-iminente-surto");
            const immCfg = parsed.operationalConfig?.imminentGoalConfig;
            const immWin = immCfg?.windowMinutes ?? 5;
            const immMin = immCfg?.minMinute ?? 5;
            const immAvg = immCfg?.minAvgPressure ?? 72;
            const immCons = immCfg?.minConsistencyPct ?? 60;
            if (immIndex >= 0) {
              updated[immIndex] = {
                ...updated[immIndex],
                name: `🚨 Gol Iminente: Surto Ofensivo (${immWin}m)`,
                description: `Alerta de alta agressividade com janela de ${immWin} minutos. Detecta pressão contínua (>=${immAvg}% de média, >=${immCons}% de consistência) e blitz ofensiva imediata, com proteção de reset por gol e intervalo.`,
                conditions: [
                  { metric: "imminentGoalQualified", operator: "==", value: 1 },
                  { metric: "minute", operator: ">=", value: immMin },
                ],
                messageTemplate: `🚨 GOL IMINENTE: Blitz ofensiva de ${immWin}m aos {minute}'! {teamHome} {score} {teamAway}. Pressão sufocante e alta agressividade recente. Entrada recomendada a favor do dominante!`,
              };
            } else {
              const defaultImm = defaults.alertRules.find((r) => r.id === "rule-gol-iminente-surto");
              if (defaultImm) updated.push(defaultImm);
            }
            // Elimina definitivamente regras descontinuadas, legadas e o Funil de Cantos
            return updated.filter(
              (r) =>
                r.id !== "rule-funil-cantos-ht-ft" &&
                r.id !== "rule-funil-cantos" &&
                r.id !== "rule-late-corners-surge" &&
                r.id !== "rule-red-card-advantage" &&
                r.id !== "rule_cartao_vermelho" &&
                r.id !== "rule-cartao-vermelho" &&
                r.id !== "rule_blitz_pos_60" &&
                r.id !== "rule_favorito_derrota" &&
                r.id !== "rule_zebrinha_aprontando" &&
                r.id !== "rule_empate_morno" &&
                r.id !== "rule-sinal-valor-ht" &&
                r.id !== "rule-pressao-vendavel" &&
                r.id !== "rule-back-dominante-desvantagem" &&
                r.id !== "rule-v12-over-premium" &&
                r.id !== "rule-v12-over-bilateral-forte" &&
                r.id !== "rule-v12-over-gol-limite" &&
                r.id !== "rule-v12-back-t1-main"
            );
          })(),
          customWebhooks: Array.isArray(parsed.customWebhooks) ? parsed.customWebhooks : defaults.customWebhooks,
        };
      }
    } catch (err) {
      console.error("⚠️ [LOCAL CONFIG] Falha ao ler arquivo de configuração local, inicializando padrão:", err);
    }

    const defaultCfg = this.getDefaultConfig();
    this.saveToDisk(defaultCfg);
    return defaultCfg;
  }

  public saveToDisk(config?: DeepPartialLocalConfigFile): LocalConfigFile {
    try {
      this.ensureDataDir();
      const base = this.currentConfig || this.getDefaultConfig();
      if (config) {
        this.currentConfig = {
          ...base,
          ...config,
          userProfile: config.userProfile
            ? ({ ...(base.userProfile || {}), ...config.userProfile } as LocalConfigFile["userProfile"])
            : base.userProfile,
          preferences: config.preferences
            ? ({ ...(base.preferences || {}), ...config.preferences } as LocalConfigFile["preferences"])
            : base.preferences,
          noiseReduction: config.noiseReduction
            ? ({ ...(base.noiseReduction || { hideFinishedMatches: true, mutedMatchIds: {}, enabledCategories: {}, selectedMatchFilter: "all" }), ...config.noiseReduction } as NonNullable<LocalConfigFile["noiseReduction"]>)
            : base.noiseReduction,
          operationalConfig: config.operationalConfig
            ? {
                ...base.operationalConfig,
                ...config.operationalConfig,
                crawlerConfig: {
                  ...base.operationalConfig.crawlerConfig,
                  ...(config.operationalConfig.crawlerConfig || {}),
                  customExcludedKeywords: Array.isArray(config.operationalConfig.crawlerConfig?.customExcludedKeywords)
                    ? config.operationalConfig.crawlerConfig.customExcludedKeywords
                    : (base.operationalConfig.crawlerConfig?.customExcludedKeywords || []),
                  tierFilter: {
                    ...base.operationalConfig.crawlerConfig?.tierFilter,
                    ...((config.operationalConfig.crawlerConfig && config.operationalConfig.crawlerConfig.tierFilter) || {}),
                  },
                },
              }
            : base.operationalConfig,
          alertRules: Array.isArray(config.alertRules)
            ? config.alertRules
            : base.alertRules,
          customWebhooks: Array.isArray(config.customWebhooks)
            ? config.customWebhooks
            : base.customWebhooks,
          customUserSettings: config.customUserSettings
            ? { ...(base.customUserSettings || {}), ...config.customUserSettings }
            : base.customUserSettings,
          savedAt: new Date().toISOString(),
        };
      } else {
        this.currentConfig = {
          ...base,
          savedAt: new Date().toISOString(),
        };
      }

      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(this.currentConfig, null, 2), "utf-8");
      console.log(`💾 [LOCAL CONFIG] Arquivo salvo em ${CONFIG_FILE_PATH} (${new Date().toISOString()})`);
      return this.currentConfig;
    } catch (err) {
      console.error("❌ [LOCAL CONFIG] Erro ao gravar arquivo local:", err);
      return this.currentConfig;
    }
  }

  public getConfig(): LocalConfigFile {
    return this.currentConfig;
  }

  public getFilePath(): string {
    return CONFIG_FILE_PATH;
  }

  public importConfig(newConfigData: any): { success: boolean; message: string; config?: LocalConfigFile } {
    try {
      if (!newConfigData || typeof newConfigData !== "object") {
        return { success: false, message: "JSON inválido ou vazio." };
      }

      const merged: LocalConfigFile = {
        ...this.getDefaultConfig(),
        ...newConfigData,
        savedAt: new Date().toISOString(),
      };

      this.currentConfig = merged;
      this.saveToDisk(this.currentConfig);

      return {
        success: true,
        message: "Configurações importadas e salvas no disco com sucesso!",
        config: this.currentConfig,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Falha ao importar configuração: ${err?.message || "Erro desconhecido"}`,
      };
    }
  }
}

export const localConfigManager = new LocalConfigManager();
