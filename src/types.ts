// src/types.ts
export type MatchStatus = '1H' | 'HT' | '2H' | 'FT' | '1T' | '2T' | 'LIVE' | 'SCHEDULED' | 'FINISHED' | 'ENCERRADO';

export interface TeamInfo {
  name: string;
  shortName: string;
  logo: string;
  color: string;
  form?: ('W' | 'D' | 'L')[];
}

export interface MatchScore {
  home: number;
  away: number;
  htHome?: number;
  htAway?: number;
}

export interface MatchStats {
  possession: { home: number; away: number };
  dangerousAttacks: { home: number; away: number };
  attacks: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  shotsOffTarget: { home: number; away: number };
  blockedShots: { home: number; away: number };
  totalShots?: { home: number; away: number }; // Total de Finalizações (FlashScore: shotsOnTarget + shotsOffTarget + blockedShots)
  corners: { home: number; away: number };
  xG: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
  fouls: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  saves: { home: number; away: number };
  pressureIndex: { home: number; away: number }; // 0 to 100 live momentum
  dangerousAttacksLast10: { home: number; away: number };
  apmLast10?: { home: number; away: number }; // Attacks per minute last 10m
  bigChances?: { home: number; away: number }; // Chances Claras (CC / BC)
  xGOT?: { home: number; away: number }; // Expected Goals on Target
  boxTouches?: { home: number; away: number }; // Toques na Área Adversária
}

export interface MomentumPoint {
  minute: number;
  homePressure: number; // 0 to 100
  awayPressure: number; // 0 to 100
  diff: number; // homePressure - awayPressure (-100 to 100)
  homeDangerousAttack?: boolean;
  awayDangerousAttack?: boolean;
  homeShot?: boolean;
  awayShot?: boolean;
  event?: string;
}

export interface MatchEvent {
  id: string;
  minute: number;
  extraMinute?: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'second_yellow' | 'sub' | 'var' | 'corner' | 'penalty_missed' | 'penalty_scored' | 'dangerous_attack';
  team: 'home' | 'away';
  player?: string;
  assistPlayer?: string;
  detail?: string;
  score?: string;
}

export interface MatchOdds {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  cornerOver95: number;
}

export interface HeadToHeadMatch {
  id: string;
  date: string;
  competition: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away' | 'draw';
  totalCorners?: number;
  totalCards?: number;
  stadium?: string;
}

export interface HeadToHeadSummary {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  avgGoalsPerGame: number;
  bttsPercentage: number; // % both teams scored
  over25Percentage: number; // % games > 2.5 goals
  avgCornersPerGame: number;
  avgCardsPerGame: number;
  dominantTrendInsight: string;
}

export interface Match {
  id: string;
  league: string;
  country?: string;
  leagueCountry?: string;
  startDate?: string;
  startTime?: string;
  stadium?: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score: MatchScore;
  minute: number;
  status: MatchStatus;
  stats: MatchStats;
  momentumTimeline: MomentumPoint[];
  events: MatchEvent[];
  odds: MatchOdds;
  source: 'crawler' | 'simulator' | 'manual';
  url?: string;
  lastUpdated: string;
  crawlerSourceId?: string;
  notes?: string;
  lastGoalMinute?: number;
  lastGoalTimestamp?: number;
  hasCompleteStats?: boolean;
  tier?: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';
  h2h?: {
    summary: HeadToHeadSummary;
    matches: HeadToHeadMatch[];
  };
}

export type AlertMetric =
  | 'minute'
  | 'pressureHome'
  | 'pressureHomeAvgWindow'
  | 'pressureAwayAvgWindow'
  | 'pressureTrendWindow'
  | 'pressureAway'
  | 'pressureDiff'
  | 'xgDiff'
  | 'totalXg'
  | 'dangerousAttacksLast10Home'
  | 'dangerousAttacksLast10Away'
  | 'chancesVariation5m'
  | 'cornersCombined'
  | 'cornersHome'
  | 'cornersAway'
  | 'shotsOnTargetHome'
  | 'shotsOnTargetAway'
  | 'shotsOnTargetDiff'
  | 'goalLeadDiff'
  | 'possessionHome'
  | 'possessionAway'
  | 'redCardHome'
  | 'redCardAway'
  | 'totalGoals'
  | 'bigChancesTotal'
  | 'debtGoals'
  | 'tripleDebtFormed'
  | 'pressaoVendavelQualified'
  | 'dominantTrailingConfirmed'
  | 'superBackDominanteQualified'
  | 'v12OverBackQualified'
  | 'ambasMarcamQualified'
  | 'imminentGoalQualified';

export type AlertOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';
export type AlertSeverity = 'info' | 'warning' | 'opportunity' | 'critical';

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  value: number;
  windowMinutes?: number; // Janela em minutos para métricas temporais (ex: 3, 5, 10, 15 min)
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  matchId: string; // 'all' for all matches or specific match id
  enabled: boolean;
  conditions: AlertCondition[];
  logic: 'AND' | 'OR';
  severity: AlertSeverity;
  soundEnabled: boolean;
  browserNotification: boolean;
  messageTemplate: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface TrendAlertData {
  team: 'home' | 'away';
  teamName: string;
  opponentName: string;
  windowMinutes: number;
  avgPressure: number;
  consistencyPct: number;
  highPressureMinutes: number;
  totalPoints: number;
  shotsInWindow: number;
  dangerousAttacksInWindow: number;
  trendDirection: 'increasing' | 'sustained_high' | 'peak';
  intensity: 'extrema' | 'alta' | 'moderada';
}

export interface AlertLog {
  id: string;
  ruleId: string;
  ruleName: string;
  matchId: string;
  matchTitle: string;
  league?: string;
  country?: string;
  leagueCountry?: string;
  minute: number;
  extraMinute?: number;
  status?: string;
  score: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  read: boolean;
  url?: string;
  category?: string;
  bettingTip?: BettingTipData;
  trendData?: TrendAlertData;
}

export interface CrawlerLogItem {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface CrawlerStatus {
  connected: boolean;
  lastHeartbeat: string | null;
  activeInstances: number;
  totalPacketsReceived: number;
  crawlerIp?: string;
  apiKey?: string;
  apiKeyConfigured: boolean;
  logs: CrawlerLogItem[];
  ingestedMatchesCount: number;
  isStartupCooldownActive?: boolean;
  startupCooldownRemainingSeconds?: number;
  sessionId?: string | null;
  session_id?: string | null;
  crawlerEngine?: "node";
}

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  webhookSlug: string;
  timestamp: string;
  sourceIp: string;
  matchId?: string;
  matchTitle?: string;
  status: 'success' | 'warning' | 'error';
  statusCode: number;
  processingTimeMs: number;
  payloadSummary: string;
  asyncProcessed: boolean;
}

export interface CustomWebhookEndpoint {
  id: string;
  name: string;
  slug: string;
  secretToken: string;
  description: string;
  active: boolean;
  asyncMode: boolean;
  autoTriggerAlerts: boolean;
  autoComputeMomentum: boolean;
  targetLeague?: string;
  createdAt: string;
  totalCalls: number;
  lastCallTimestamp?: string | null;
  lastSourceIp?: string | null;
  lastStatus?: 'ok' | 'error';
}

export interface TacticalAnalysis {
  matchId: string;
  summary: string;
  momentumVerdict: 'home_dominant' | 'away_dominant' | 'balanced' | 'end_to_end';
  likelyNextEvent: string;
  nextGoalProbability: {
    home: number;
    away: number;
    noGoal: number;
  };
  keyInsights: string[];
  cornerPressureScore: number; // 0-100
  cardRiskScore: number; // 0-100
  tradingAngles: string[];
  analyzedAt: string;
  source?: 'gemini' | 'heuristic_fallback';
  isCached?: boolean;
  isQuotaExhausted?: boolean;
}

// ==========================================
// Tactical Tip & Insight Types (Pure Sports Analytics)
// ==========================================

export interface TacticalTipData {
  marketCode: string; // Ex: "OVER_GOL_LIMITE", "FUNIL_CANTOS", "PRESSAO_CANTOS_BLITZ", "BTTS_YES"
  marketName: string; // Ex: "Over Gol Limite FT (> 1.5)", "Pressão de Cantos (Blitz)", "Ambas Marcam: SIM"
  targetSelection: string; // Ex: "Mais de 1.5 Gols", "Pressão Ofensiva Final", "Próximo Gol Mandante"
  probabilityPct: number; // Probabilidade calculada estatística (0 a 100%)
  confidence: 'extrema' | 'alta' | 'moderada';
  reasoning: string;
  actionText: string;
}

export type BettingTipData = TacticalTipData;

// ==========================================
// Regras e Alertas Python (Diagnóstico & Turbo)
// ==========================================

// Configuração Específica dos 4 Sinais Multimercado V1.2
export interface V12OverPremiumConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 36
  maxMinute: number; // Padrão: 50
  minTotalCc: number; // Padrão: 3
  maxCcRate: number; // Padrão: 15.0 min/CC
  minTeamCc: number; // Padrão: 1
}

export interface V12OverBilateralForteConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 36
  maxMinute: number; // Padrão: 65
  minTotalCc: number; // Padrão: 4
  maxCcRate: number; // Padrão: 15.0 min/CC
  minTeamCc: number; // Padrão: 2
}

export interface V12OverGolLimiteConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 76
  maxMinute: number; // Padrão: 83
  minTotalCc: number; // Padrão: 7
  minTeamCc: number; // Padrão: 2
  minScoreDiff: number; // Padrão: 1 (pelo menos 1 gol de diferença)
}

export interface V12BackT1MainConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 36
  maxMinute: number; // Padrão: 50
  minDomCc: number; // Padrão: 3
  maxOppCc: number; // Padrão: 0
  minDomXgot: number; // Padrão: 0.50
}

export interface V12RulesConfig {
  overPremium: V12OverPremiumConfig;
  overBilateralForte: V12OverBilateralForteConfig;
  overGolLimite: V12OverGolLimiteConfig;
  backT1Main: V12BackT1MainConfig;
}

export const DEFAULT_V12_CONFIG: V12RulesConfig = {
  overPremium: {
    enabled: true,
    minMinute: 36,
    maxMinute: 50,
    minTotalCc: 3,
    maxCcRate: 15.0,
    minTeamCc: 1,
  },
  overBilateralForte: {
    enabled: true,
    minMinute: 36,
    maxMinute: 65,
    minTotalCc: 4,
    maxCcRate: 15.0,
    minTeamCc: 2,
  },
  overGolLimite: {
    enabled: true,
    minMinute: 76,
    maxMinute: 83,
    minTotalCc: 7,
    minTeamCc: 2,
    minScoreDiff: 1,
  },
  backT1Main: {
    enabled: true,
    minMinute: 36,
    maxMinute: 50,
    minDomCc: 3,
    maxOppCc: 0,
    minDomXgot: 0.5,
  },
};

export interface SuperPressureTrendConfig {
  enabled?: boolean; // Padrão: true
  minAvgPressure: number; // Padrão: 68% (Pressão média contínua da equipe dominante)
  minConsistencyPct: number; // Padrão: 65% (Consistência no ataque: % do tempo com pressão >= pointThreshold)
  windowMinutes: number; // Padrão: 15 min (Janela temporal retrospectiva no momentumTimeline)
  minMinute: number; // Padrão: 20 min (Minuto mínimo da partida para disparar - evita falso alerta no início do 1T)
  pointThreshold: number; // Padrão: 60% (Pressão instantânea mínima em cada minuto para pontuar consistência)
  minFinalizations?: number; // Padrão: 2 (Finalizações mínimas na janela para eliminar posse estéril)
  cutoff1T?: number; // Padrão: 38 min (Corte máximo no 1º Tempo)
  cutoff2T?: number; // Padrão: 82 min (Corte máximo no 2º Tempo)
  cutoffMinute1T?: number; // Padrão: 38
  cutoffMinute2T?: number; // Padrão: 82
  minShotsInWindow?: number; // Padrão: 2
  minTargetOdd1T?: number; // Padrão: 1.60
  minTargetOdd2T?: number; // Padrão: 1.70
  targetOdd1T?: number; // Padrão: 1.60
  targetOdd2T?: number; // Padrão: 1.70
}

export const DEFAULT_SUPER_PRESSURE_CONFIG: SuperPressureTrendConfig = {
  enabled: true,
  minAvgPressure: 68,
  minConsistencyPct: 65,
  windowMinutes: 15,
  minMinute: 20,
  pointThreshold: 60,
  minFinalizations: 2,
  cutoff1T: 38,
  cutoff2T: 82,
  cutoffMinute1T: 38,
  cutoffMinute2T: 82,
  minShotsInWindow: 2,
  minTargetOdd1T: 1.60,
  minTargetOdd2T: 1.70,
  targetOdd1T: 1.60,
  targetOdd2T: 1.70,
};

export interface ImminentGoalSurgeConfig {
  enabled?: boolean;
  windowMinutes?: number; // 5
  minMinute1T?: number; // 20
  cutoffMinute1T?: number; // 38
  minMinute2T?: number; // 55
  cutoffMinute2T?: number; // 82
  minApPerMinute?: number; // 1.6
  minShotsInWindow?: number; // 2
  targetOdd?: number; // 1.50
}

export interface ImminentGoalConfig {
  enabled?: boolean; // Padrão: true
  windowMinutes: number; // Padrão: 5 min (Janela de análise imediata de surto)
  minAvgPressure: number; // Padrão: 72% (Pressão média contínua da equipe dominante na janela de 5m)
  minConsistencyPct: number; // Padrão: 60% (Consistência no ataque: % de pontos na janela com pressão >= pointThreshold)
  pointThreshold: number; // Padrão: 70% (Pressão instantânea mínima em cada minuto para pontuar consistência no surto)
  minMinute: number; // Padrão: 20 min (Minuto mínimo da partida para disparar no 1T)
  minMinute2T?: number; // Padrão: 55 min (Minuto mínimo para disparar no 2T)
  cutoff1T?: number; // Padrão: 38 min (Corte máximo no 1º Tempo)
  cutoff2T?: number; // Padrão: 82 min (Corte máximo no 2º Tempo)
  minDangerousAttacks: number; // Padrão: 2 (Ataques perigosos comprovados na janela de 5m)
  minDangerousAttacksPerMin?: number; // Padrão: 1.6 AP/min
  minShots: number; // Padrão: 2 (Finalizações na janela de 5m)
  minTargetOdd?: number; // Padrão: 1.50 (Odd mínima alvo)
  extremePressureBypass: number; // Padrão: 80% (Se pressão atingir este nível, dispensa exigência de ataques/chutes)
}

export const DEFAULT_IMMINENT_GOAL_CONFIG: ImminentGoalConfig = {
  enabled: true,
  windowMinutes: 5,
  minAvgPressure: 75,
  minConsistencyPct: 80,
  pointThreshold: 70,
  minMinute: 20,
  minMinute2T: 55,
  cutoff1T: 38,
  cutoff2T: 82,
  minDangerousAttacks: 8,
  minDangerousAttacksPerMin: 1.6,
  minShots: 2,
  minTargetOdd: 1.50,
  extremePressureBypass: 85,
};

export interface AmbasMarcamConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 18'
  maxMinute: number; // Padrão: 86'
  minHomeXg: number; // Padrão: 0.35
  minAwayXg: number; // Padrão: 0.35
  minTotalXg: number; // Padrão: 1.10
  minHomeAttacks10m: number; // Padrão: 3 (ataques perigosos últimos 10m)
  minAwayAttacks10m: number; // Padrão: 3
  minHomeShots10m: number; // Padrão: 1
  minAwayShots10m: number; // Padrão: 1
  minHomePressure: number; // Padrão: 45%
  minAwayPressure: number; // Padrão: 45%
  minCombinedPressure: number; // Padrão: 100%
  minProbabilityPct: number; // Padrão: 68%
  blockIfBothScored: boolean; // Padrão: true (Se ambos já marcaram, encerra mercado)
  blockIfBlowout: boolean; // Padrão: true (Bloqueia goleada >= 3 gols sem reação no final)
  windowMinutes: number; // Padrão: 10 min
}

export const DEFAULT_AMBAS_MARCAM_CONFIG: AmbasMarcamConfig = {
  enabled: true,
  minMinute: 18,
  maxMinute: 86,
  minHomeXg: 0.35,
  minAwayXg: 0.35,
  minTotalXg: 1.10,
  minHomeAttacks10m: 3,
  minAwayAttacks10m: 3,
  minHomeShots10m: 1,
  minAwayShots10m: 1,
  minHomePressure: 45,
  minAwayPressure: 45,
  minCombinedPressure: 100,
  minProbabilityPct: 68,
  blockIfBothScored: true,
  blockIfBlowout: true,
  windowMinutes: 10,
};

export interface OperationalRulesConfig {
  chancesPerGoalRatio: number; // Parâmetro Central do Radar (Fonte Única da Verdade / Regra 3:1). Governa Diagnóstico Clássico, Dívida de Gols e Trinca de Dívidas.
  ccRateMaxMinutes: number; // Padrão: 15.0 min/CC
  ccRateForteMaxMinutes: number; // Padrão: 12.0 min/CC
  debtMarginXG: number; // Padrão: 1.0
  imminentGoalThresholdPct?: number; // Limiar percentual configurável de variação 5m (Padrão: 50%)
  
  // Regras de Gols & Back
  enableCodigo31: boolean;
  enableTripleDebt: boolean;
  tripleDebtConfig?: TripleDebtConfig; // Configurações editáveis da Trinca de Dívidas (Regra 2)
  enablePressaoVendavel: boolean;
  pressaoVendavelConfig?: PressaoVendavelConfig; // Configurações editáveis da Regra 3 (Pressão Vendável / Ineficiência / Back Favorito)
  enableDominantTrailing: boolean;
  dominantTrailingConfig?: DominantTrailingConfig; // Configurações editáveis da Regra 4 (Back Dominante em Desvantagem: Reação Confirmada)
  enableSuperBackDominante?: boolean; // Regra Unificada: Super Back Dominante (Reação Confirmada & Pressão Vendável)
  superBackDominanteConfig?: SuperBackDominanteConfig; // Configuração da Regra Unificada Super Back Dominante
  enableGoalDebtClassic?: boolean; // Diagnóstico Clássico: Dívida de Gols & xG Divergente
  goalDebtClassicConfig?: GoalDebtClassicConfig; // Configurações editáveis da Dívida de Gols Tradicional
  enableHalfTimeValue?: boolean; // Sinal de Valor HT (30'-45')
  halfTimeValueConfig?: HalfTimeValueConfig; // Configurações editáveis do Sinal de Valor HT
  enableV12OverBack: boolean;
  v12Config?: V12RulesConfig; // Configurações detalhadas e editáveis dos 4 sinais clássicos V1.2
  enableImminentGoal: boolean; // Alerta de Gol Iminente (Surto 5m)
  imminentGoalConfig?: ImminentGoalConfig; // Configuração unificada e editável de Gol Iminente / Surto Ofensivo (Regra 7)

  // ESTRATÉGIAS DE ANÁLISE TÁTICA E PRESSÃO
  enableTrendAlert?: boolean; // Trend Alert: Pressão Alta Constante no Longo Prazo (momentumTimeline)
  trendAlertWindowMinutes?: number; // Janela de análise de tendência (Padrão: 15 min)
  trendAlertMinAvgPressure?: number; // Pressão média contínua mínima (Padrão: 68%)
  trendAlertMinConsistencyPct?: number; // Consistência mínima no ataque (Padrão: 65%)
  trendAlertMinMinute?: number; // Minuto mínimo da partida para disparar (Padrão: 15)
  trendAlertPointThreshold?: number; // Limiar de pressão instantânea por minuto (Padrão: 60%)
  superPressureConfig?: SuperPressureTrendConfig; // Configuração unificada e editável de Blitz e Super Pressão Contínua (Regra 1)
  enableAmbasMarcamBTTS: boolean; // Ambas Marcam (BTTS Sim)
  ambasMarcamConfig?: AmbasMarcamConfig; // Configuração editável da regra Ambas Marcam (BTTS Sim)

  // Cooldown Geral do Sistema
  postGoalCooldownMinutes?: number; // Padrão: 3 (Cooldown geral após qualquer gol na partida em minutos/180s)
  crawlerStartupCooldownMinutes?: number; // Padrão: 3 (Cooldown geral na inicialização do Crawler para estabilização de grade)
  alertCooldownMinutes?: number; // Padrão: 5 (Intervalo mínimo unificado de resguardo / cooldown entre disparos de regras na partida)

  // Configuração de Faixa de Probabilidade dos Alertas (%)
  minAlertProbabilityPct?: number; // Padrão: 50%
  maxAlertProbabilityPct?: number; // Padrão: 100%

  // Ingestão e Exibição de Alertas de Gol
  enableGoalAlerts?: boolean; // Padrão: true (se false/Ocultos, suprime a ingestão de alertas de gol no feed e banco)
  showGoalAlerts?: boolean; // Padrão: true (espelho de persistência para visualização de gols no Alert Manager)

  // MODO DEBUG DO VITE (Dev Server / Console logs)
  viteDebugMode?: boolean; // Padrão: false (desativado = suprime logs do Vite/WS; ativado = exibe todos os logs)

  // MOTOR CRAWLER: CATÁLOGO, WATCHLIST & VELOCIDADE (Playwright / Discovery)
  crawlerConfig?: {
    mode?: "node"; // Motor oficial: Node.js nativo (TypeScript HTTP Feed)
    maxWatchlistSize: number; // Padrão: 15 (Capacidade máxima de jogos escaneados por ciclo)
    tier3ReservedSlots: number; // Padrão: 2 (Slots mínimos garantidos para rotação round-robin Tier 3)
    discoveryIntervalSeconds: number; // Padrão: 180 (Varredura do catálogo ao vivo a cada 3 minutos)
    concurrentWorkers: number; // Padrão: 4 (Páginas Playwright abertas em paralelo)
    routeResourceBlock: boolean; // Padrão: true (Bloqueio de imagens, fontes e mídias no Playwright)
    enableBackgroundDiscovery: boolean; // Padrão: true (Descoberta em thread paralela desacoplada)
    autoPruneMinutes: number; // Padrão: 30 (Faxina do catálogo para jogos sumidos)
    catalogPruneMinutes?: number; // Faxina customizável do catálogo
    noStatsBackoffMinutes: number; // Padrão: 10 (Cooldown para partidas sem estatísticas suportadas)
    minEntryMinute: number; // Padrão: 20 (Minuto mínimo para watchlist operacional)
    maxEntryMinute: number; // Padrão: 83 (Minuto máximo para watchlist operacional)
    antiSpamCooldownMinutes: number; // Padrão: 5 (Intervalo mínimo entre repetição de sinais no mesmo jogo)
    startupCooldownMinutes?: number; // Padrão: 3 (Cooldown geral ao iniciar o crawler pela primeira vez)
    matchReadTimeoutMs?: number; // Padrão: 5000 (Timeout para leitura/extração detalhada da partida em ms)
    discoveryTimeoutMs?: number; // Padrão: 12000 (Timeout para requisição/página de descoberta em ms)
    // Filtros Excludentes do Crawler
    excludeEsoccer?: boolean; // Padrão: true (Ignorar e-soccer / esport / simulados)
    excludeWomen?: boolean; // Padrão: true (Ignorar futebol feminino)
    excludeYouthUnder?: boolean; // Padrão: true (Ignorar categorias de base: Sub-17/19/20/21/23 / Youth)
    customExcludedKeywords?: string[]; // Termos customizados adicionais para exclusão
    tierFilter: {
      enableTier0Signals: boolean; // Posições abertas & sinais recentes
      enableTier05PremiumLeagues: boolean; // Ligas Premium A/B/C
      enableTier12Window: boolean; // Jogos no range 20-83 min
      enableTier3Rotation: boolean; // Rodízio de ligas alternativas
      enableTier1?: boolean; // Habilitar ingestão de partidas Tier 1 (Elite)
      enableTier2?: boolean; // Habilitar ingestão de partidas Tier 2 (Pro)
      enableTier3?: boolean; // Habilitar ingestão de partidas Tier 3 (Alternativo)
      enableTier4?: boolean; // Habilitar ingestão de partidas Tier 4 (Menor / Regional)
    };
  };

  soundAlertsEnabled: boolean;
  minMinuteAlert: number;
  maxMinuteAlert: number;
}

export type Codigo31AlertType =
  | 'over_bilateral_premium'
  | 'over_premium_xg'
  | 'over_premium'
  | 'back_premium'
  | 'over_forte'
  | 'back_forte'
  | 'over_watch'
  | 'back_watch';

export interface Codigo31Evaluation {
  alertType: Codigo31AlertType | null;
  shouldAlert: boolean;
  reason: string;
  level: 'watch' | 'forte' | 'premium' | null;
  market: 'over' | 'back' | null;
  bucket: number;
  totalCc: number;
  homeCc: number;
  awayCc: number;
  totalGoals: number;
  homeScore: number;
  awayScore: number;
  ccRate: number;
  expectedGoalsByCc: number;
  isDevendoGol: boolean;
  saldoGolsDevidos: number;
  ratioUsed: number;
  dominantTeam: 'home' | 'away' | null;
  dominantName: string;
  dominantCc: number;
  oppCc: number;
  ccDiff: number;
  expectedDominantGoalsByCc: number;
  isDominantDevendoGol: boolean;
  saldoGolsDominante: number;
  isDominantTrailing: boolean;
  dominantLead: number;
  debtorTeamName?: string;
  debtorTeamSide?: 'home' | 'away' | 'both' | null;
  title: string;
  emoji: string;
  motivo: string;
  leitura: string;
  formattedTelegram: string;
  bettingTip?: BettingTipData;
}

export interface TripleDebtEvaluation {
  tripleDebtFormed: boolean;
  scope: 'unilateral' | 'bilateral' | 'none';
  scopeSide: 'home' | 'away' | 'total' | null;
  debtorTeamName?: string;
  ccInScope: number;
  xgInScope: number;
  xgotInScope: number;
  goalsInScope: number;
  expectedGoalsByCc: number;
  ratioUsed?: number; // Ratio central 3:1 utilizado no cálculo
  ccDebt: boolean;
  xgDebt: boolean;
  xgotDebt: boolean;
  failedReasons: string[];
  blockReason: string | null;
  wouldBlockSignal: boolean;
  statusBadge: string;
  bettingTip?: BettingTipData;
}

export interface PressaoVendavelEvaluation {
  qualified: boolean;
  side: 'home' | 'away' | null;
  team: string;
  minute: number;
  score: string;
  tese: string;
  fairOdd?: number;
  minRecommendedOdd?: number;
  probTarget?: number;
  fails: string[];
  metrics: {
    cc: number;
    xg: number;
    xgot: number;
    shots: number;
    sot: number;
    sotPct: number;
    posse: number;
    toquesArea: number;
    oppXg: number;
  };
  bettingTip?: BettingTipData;
}

// Configuração Editável da Regra 3 (Pressão Vendável & Ineficiência / Back Favorito / Lay Zebra)
export interface PressaoVendavelConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 25'
  maxMinute: number; // Padrão: 70'
  minXg: number; // Padrão: 1.0 (xG mínimo da equipe dominante)
  minCc: number; // Padrão: 2 (Chances claras mínimas da equipe dominante)
  minXgot: number; // Padrão: 0.8 (xGOT mínimo da equipe dominante)
  maxOppXg: number; // Padrão: 0.7 (Adversário nulo: xG máximo permitido do adversário)
  minPossessionPct: number; // Padrão: 60% (Posse mínima ou razão de toques na área >= 2.0)
  minSotPct: number; // Padrão: 0.35 (35% de chutes no alvo em relação ao total)
  maxDeficitGoals: number; // Padrão: 1 (Desvantagem máxima: empate ou perdendo por no máximo 1 gol)
}

export const DEFAULT_PRESSAO_VENDAVEL_CONFIG: PressaoVendavelConfig = {
  enabled: true,
  minMinute: 25,
  maxMinute: 70,
  minXg: 1.0,
  minCc: 2,
  minXgot: 0.8,
  maxOppXg: 0.7,
  minPossessionPct: 60,
  minSotPct: 0.35,
  maxDeficitGoals: 1,
};

// Configuração Editável da Regra 2 (Trinca de Dívidas: CC + xG + xGOT Confluentes)
export interface TripleDebtConfig {
  enabled: boolean;
  minMinute: number; // Padrão: 15'
  debtMarginXG: number; // Padrão: 1.0 (Margem de dívida em relação aos gols marcados)
  chancesPerGoalRatio: number; // Padrão: 3.0 (3 chances claras por gol esperado)
  minUnilateralCc: number; // Padrão: 3 (CC mínima unilateral)
  minBilateralCc: number; // Padrão: 3 (CC mínima combinada bilateral)
  minBilateralXg: number; // Padrão: 1.0 (xG mínimo bilateral)
  minBilateralXgot: number; // Padrão: 1.0 (xGOT mínimo bilateral)
}

export const DEFAULT_TRIPLE_DEBT_CONFIG: TripleDebtConfig = {
  enabled: true,
  minMinute: 10,
  debtMarginXG: 1.5,
  chancesPerGoalRatio: 2.5,
  minUnilateralCc: 3,
  minBilateralCc: 4,
  minBilateralXg: 1.0,
  minBilateralXgot: 1.0,
};

export interface DominantTrailingConfig {
  enabled: boolean;
  maxTrailingGoals: number; // Padrão: 1 (Desvantagem máxima no placar: 1 gol)
  minPressure: number; // Padrão: 65 (Pressão mínima >= 65)
  minDangerousAttacksLast10: number; // Padrão: 6 (Perigo recente nos últimos 10 min >= 6)
  minShotsOnTarget: number; // Padrão: 3 (Finalizações / chutes no alvo >= 3)
  minMinute: number; // Padrão: 15 (Minuto inicial)
  maxMinute: number; // Padrão: 85 (Minuto final)
  requireOnlyOneReactionCriteria: boolean; // Padrão: true (basta satisfazer 1 dos critérios: pressão >= 65 OU perigo recente >= 6 OU chutes a gol >= 3)
  brutalPressureThreshold: number; // Padrão: 85 (Pressão brutal para exceção de 2+ gols e confiança extrema)
  strongPressureThreshold: number; // Padrão: 68 (Pressão forte)
  superiorityMetric: 'cc_or_xg' | 'cc_only' | 'xg_only'; // Padrão: 'cc_or_xg' (Estatisticamente superior em CC ou xG)
}

export const DEFAULT_DOMINANT_TRAILING_CONFIG: DominantTrailingConfig = {
  enabled: true,
  maxTrailingGoals: 1,
  minPressure: 65,
  minDangerousAttacksLast10: 6,
  minShotsOnTarget: 3,
  minMinute: 15,
  maxMinute: 85,
  requireOnlyOneReactionCriteria: true,
  brutalPressureThreshold: 85,
  strongPressureThreshold: 68,
  superiorityMetric: 'cc_or_xg',
};

export interface DominantTrailingEvaluation {
  dominantSide: 'home' | 'away' | null;
  dominantScore: number;
  opponentScore: number;
  dominantIsTrailing: boolean;
  dominantTrailingBy: number;
  dominantReactionConfirmed: boolean;
  livePressureStatus: 'brutal' | 'forte' | 'neutro' | 'dead';
  entryAllowed: boolean;
  blockReason: string;
  status: 'GOAL_DEBT_ALIVE' | 'GOAL_DEBT_DEAD' | 'DOMINANT_TRAILING_TRAP' | 'DOMINANT_REACTION_CONFIRMED' | 'NOT_TRAILING';
  blockMessage?: string;
  bettingTip?: BettingTipData;
  reactionDetails?: {
    domPressure: number;
    domDangerousAttacksLast10: number;
    domSot: number;
    reactionReasons: string[];
    isPressureQualified: boolean;
    isDangerQualified: boolean;
    isSotQualified: boolean;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Regra Unificada: Super Back Dominante (Reação Confirmada & Pressão Vendável)
// ──────────────────────────────────────────────────────────────────────────
export interface SuperBackDominanteConfig {
  enabled?: boolean;
  minXgDominant?: number;          // Padrão: 0.95
  minCcDominant?: number;          // Padrão: 2
  maxOpponentXg?: number;          // Padrão: 0.70
  minReactionPressure?: number;    // Padrão: 70%
  minRecentDangerAttacks?: number; // Padrão: 6 (em 10 min)
  minShotsInWindow?: number;       // Padrão: 2
  minMinute?: number;              // Padrão: 55
  maxMinute?: number;              // Padrão: 78
  cooldownMinutes?: number;        // Padrão: 3 min
  targetOddDraw?: number;          // Padrão: 1.75
  targetOddLosing?: number;        // Padrão: 2.20
  minAvgPressure?: number;
  minApPerMinute?: number;
  maxOpponentApPerMinute?: number;
  maxGoalDeficit?: number;
  postGoalCooldownMinutes?: number;
}

export const DEFAULT_SUPER_BACK_DOMINANTE_CONFIG: SuperBackDominanteConfig = {
  enabled: true,
  minXgDominant: 0.95,
  minCcDominant: 2,
  maxOpponentXg: 0.70,
  minReactionPressure: 70,
  minRecentDangerAttacks: 6,
  minShotsInWindow: 2,
  minMinute: 55,
  maxMinute: 78,
  cooldownMinutes: 3,
  targetOddDraw: 1.75,
  targetOddLosing: 2.20,
  minAvgPressure: 70,
  minApPerMinute: 1.5,
  maxOpponentApPerMinute: 0.6,
  maxGoalDeficit: 1,
  postGoalCooldownMinutes: 3,
};

export interface SuperBackDominanteEvaluation {
  qualified: boolean;
  tier: 'OURO' | 'PRATA' | 'BRONZE' | 'NENHUM';
  dominantSide: 'home' | 'away' | null;
  dominantTeam: string;
  opponentTeam: string;
  minute: number;
  score: string;
  deficitGoals: number;
  situation: 'EMPATANDO' | 'PERDENDO' | 'VENCENDO';
  dominantXg: number;
  opponentXg: number;
  xgDiff: number;
  dominantCc: number;
  dominantPressure: number;
  livePressureStatus: 'brutal' | 'forte' | 'neutro' | 'dead';
  dangerousAttacksLast10: number;
  shotsOnTarget: number;
  possession: number;
  hasStructuralVolume: boolean;
  hasLiveReaction: boolean;
  hasOpponentZeroThreat: boolean;
  tese: string;
  marketTarget: string;
  probTarget: number;
  fairOdd: number;
  minRecommendedOdd: number;
  confidence: 'extrema' | 'alta' | 'moderada';
  reactionReasons: string[];
  fails: string[];
  bettingTip?: TacticalTipData;
  isSuperBack?: boolean;
  convictionLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';
}

export interface GoalDebtClassicConfig {
  enabled: boolean; // Padrão: true
  minDebtGoals: number; // Padrão: 1.0 (Dívida mínima de gols calculada)
  minMinute: number; // Padrão: 20' (Minuto inicial de validação)
  maxMinute: number; // Padrão: 85' (Minuto final de validação)
  minTotalXg: number; // Padrão: 1.2 (xG total acumulado)
  minXgDiff: number; // Padrão: 0.80 (Diferença de xG entre dominante e zebra)
  minDominantDebt: number; // Padrão: 0.70 (Dívida unilateral de xG do dominante)
  chancesPerGoalRatio: number; // Padrão: 3.0 (Chances Claras necessárias para 1 gol)
  blockIfWinningBy2Plus: boolean; // Padrão: true (Não alertar se dominante vence por 2+ gols)
  blockIfDebtPaid: boolean; // Padrão: true (Não alertar se dominante já marcou >= xG)
  cooldownSecondsAfterGoal?: number; // Legado: 180s (3 minutos)
  postGoalCooldownMinutes?: number; // Unificado: Padrão 3 minutos de resguardo após qualquer gol
}

export const DEFAULT_GOAL_DEBT_CLASSIC_CONFIG: GoalDebtClassicConfig = {
  enabled: true,
  minDebtGoals: 1.5,
  minMinute: 20,
  maxMinute: 85,
  minTotalXg: 2.0,
  minXgDiff: 0.80,
  minDominantDebt: 0.70,
  chancesPerGoalRatio: 2.5,
  blockIfWinningBy2Plus: true,
  blockIfDebtPaid: true,
  cooldownSecondsAfterGoal: 180,
  postGoalCooldownMinutes: 3,
};

export interface GoalDebtClassicEvaluation {
  qualified: boolean;
  minute: number;
  score: string;
  totalDebtGoals: number;
  ratioUsed?: number; // Ratio central 3:1 utilizado no cálculo
  totalXg: number;
  xgDiff: number;
  dominantTeam: string;
  dominantSide: 'home' | 'away' | null;
  dominantXg: number;
  dominantGoals: number;
  dominantXgDebt: number;
  underdogTeam: string;
  underdogXg: number;
  underdogGoals: number;
  isDevendoGol: boolean;
  blockReason?: string;
  reasoning: string;
  actionText: string;
  bettingTip?: BettingTipData;
}

export interface HalfTimeValueConfig {
  enabled: boolean; // Padrão: true
  minMinute: number; // Padrão: 30' (Início da janela de pressão no 1T)
  maxMinute: number; // Padrão: 45' (Fim da janela do 1T)
  minCombinedPressure: number; // Padrão: 110% (Soma de pressão Home + Away)
  minDominantPressure: number; // Padrão: 65% (Pressão mínima da equipe que ataca)
  minTotalCc: number; // Padrão: 1 (Chances Claras mínimas no 1T)
  minTotalXg: number; // Padrão: 0.70 (xG acumulado no 1T)
  minDangerousAttacksLast10: number; // Padrão: 5 (Ataques perigosos nos últimos 10 min)
  maxTotalGoals: number; // Padrão: 1 (Placar de 0x0 ou 1x0/0x1 para buscar Over 0.5 HT / 1.5 HT)
  targetMarket: 'OVER_HT' | 'BACK_HT' | 'BOTH'; // Padrão: 'OVER_HT'
}

export const DEFAULT_HALFTIME_VALUE_CONFIG: HalfTimeValueConfig = {
  enabled: true,
  minMinute: 30,
  maxMinute: 45,
  minCombinedPressure: 110,
  minDominantPressure: 65,
  minTotalCc: 1,
  minTotalXg: 0.70,
  minDangerousAttacksLast10: 5,
  maxTotalGoals: 1,
  targetMarket: 'OVER_HT',
};

export interface HalfTimeValueEvaluation {
  qualified: boolean;
  minute: number;
  score: string;
  totalGoals: number;
  combinedPressure: number;
  dominantPressure: number;
  dominantTeam: string;
  dominantSide: 'home' | 'away' | null;
  totalCc: number;
  totalXg: number;
  dangerousAttacksLast10: number;
  targetMarket: 'OVER_HT' | 'BACK_HT' | 'BOTH';
  targetLine: string;
  confidenceTier: 'A' | 'B+' | 'Especial';
  reasoning: string;
  actionText: string;
  bettingTip?: BettingTipData;
}

export interface TraditionalRuleSignal {
  ruleName: string;
  marketTarget: string;
  confidenceTier: string;
  recommendedAction: string;
  trace: string;
}

export interface ImminentGoalEvaluation {
  qualified: boolean;
  isImminent: boolean;
  team: 'home' | 'away' | null;
  teamName: string;
  opponentName: string;
  windowMinutes: number; // 5 minutos fixos
  avgPressure: number;
  consistencyPct: number;
  highPressureMinutes: number;
  totalPointsInWindow: number;
  shotsInWindow: number;
  dangerousAttacksInWindow: number;
  trendDirection: 'increasing' | 'sustained_high' | 'peak';
  intensity: 'extrema' | 'alta' | 'moderada' | 'nenhuma';
  targetMarket: string;
  actionText: string;
  title: string;
  triggerReason: string;
  confidenceScore: number; // 0-100
  bettingTip?: TacticalTipData;
  formattedTelegram?: string;

  // Campos complementares para compatibilidade visual
  variationPct5m?: number;
  totalChancesLast5?: number;
  totalChancesPrev5?: number;
  homeChancesLast5?: number;
  awayChancesLast5?: number;
  effectiveDebt?: number;
  beneficiaryTeam?: string;
  isConfluent?: boolean;
  convictionLevel?: 'MAX' | 'ALTA' | 'MODERADA' | 'NEUTRA';
  targetOddMin?: number;
}

// ──────────────────────────────────────────
// Interfaces para as Novas Estratégias
// ──────────────────────────────────────────

export interface PressaoCantosBlitzEvaluation {
  qualified: boolean;
  minute: number;
  recentCornersCount: number;
  cornerWindowMinutes: number;
  totalCorners: number;
  attacksPerMinLast10: number;
  dominantTeam?: string;
  pressureAvg: number;
  reason: string;
  tacticalTip?: TacticalTipData;
}

export interface AmbasMarcamEvaluation {
  qualified: boolean;
  homeXg: number;
  awayXg: number;
  totalXg?: number;
  homeSot: number;
  awaySot: number;
  homeAttacks10m?: number;
  awayAttacks10m?: number;
  homeShots10m?: number;
  awayShots10m?: number;
  homePressure10m?: number;
  awayPressure10m?: number;
  currentScore: string;
  scoreScenario?: string;
  probTarget?: number;
  fairOdd?: number;
  minRecommendedOdd?: number;
  reasoning?: string;
  bettingTip?: BettingTipData;
}

export interface TrendAlertEvaluation {
  qualified: boolean;
  team: 'home' | 'away' | null;
  teamName: string;
  opponentName: string;
  windowMinutes: number;
  avgPressure: number;
  consistencyPct: number;
  highPressureMinutes: number;
  totalPointsInWindow: number;
  shotsInWindow: number;
  dangerousAttacksInWindow: number;
  trendDirection: 'increasing' | 'sustained_high' | 'peak';
  intensity: 'extrema' | 'alta' | 'moderada';
  targetMarket: string;
  actionText: string;
  confidenceScore: number;
  bettingTip?: TacticalTipData;
  formattedTelegram?: string;
  isConfluent?: boolean;
  convictionLevel?: 'MAX' | 'ALTA' | 'MODERADA' | 'NEUTRA';
  targetOddMin?: number;
}

export interface MatchRulesAnalysis {
  matchId: string;
  ratioConfigured: number;
  isConfluent?: boolean;
  confluenceReason?: string;
  codigo31: Codigo31Evaluation;
  tripleDebt: TripleDebtEvaluation;
  pressaoVendavel: PressaoVendavelEvaluation;
  dominantTrailing: DominantTrailingEvaluation;
  superBackDominante?: SuperBackDominanteEvaluation;
  goalDebtClassic?: GoalDebtClassicEvaluation;
  halfTimeValue?: HalfTimeValueEvaluation;
  imminentGoal?: ImminentGoalEvaluation;
  trendAlert?: TrendAlertEvaluation;
  pressaoCantosBlitz?: PressaoCantosBlitzEvaluation;
  ambasMarcam?: AmbasMarcamEvaluation;
  traditionalSignals: TraditionalRuleSignal[];
  hasActiveOperationalAlert: boolean;
  primaryAlertBadge?: {
    emoji: string;
    label: string;
    level: 'watch' | 'forte' | 'premium';
    market: 'over' | 'back' | 'corners' | 'btts';
  };
  postGoalCooldown?: {
    active: boolean;
    remainingSeconds: number;
    lastGoalMinute?: number;
  };
  activeTips: TacticalTipData[];
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'approved' | 'pending' | 'rejected' | 'blocked';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  crawlerToken: string;
  createdAt: string;
  lastLoginAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface UserCustomSettings {
  rulesConfig?: Partial<OperationalRulesConfig>;
  customMatchOrder?: string[];
  favoriteMatchIds?: string[];
  sortOption?: string;
  viewMode?: 'grid' | 'carousel' | 'compact';
  audioEnabled?: boolean;
  audioVolume?: number;
}

export const DEFAULT_MODAL_CONFIG: OperationalRulesConfig = {
  chancesPerGoalRatio: 2.5,
  ccRateMaxMinutes: 15.0,
  ccRateForteMaxMinutes: 12.0,
  debtMarginXG: 1.5,
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
  enableAmbasMarcamBTTS: true,
  ambasMarcamConfig: DEFAULT_AMBAS_MARCAM_CONFIG,
  postGoalCooldownMinutes: 3,
  crawlerStartupCooldownMinutes: 3,
  enableGoalAlerts: true,
  showGoalAlerts: true,
  crawlerConfig: {
    mode: "node",
    maxWatchlistSize: 20,
    tier3ReservedSlots: 2,
    discoveryIntervalSeconds: 180,
    concurrentWorkers: 4,
    routeResourceBlock: true,
    enableBackgroundDiscovery: true,
    autoPruneMinutes: 10,
    noStatsBackoffMinutes: 5,
    minEntryMinute: 1,
    maxEntryMinute: 83,
    antiSpamCooldownMinutes: 2,
    startupCooldownMinutes: 3,
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

export const DEFAULT_OPERATIONAL_CONFIG = DEFAULT_MODAL_CONFIG;

export interface RuleConfluenceState {
  isConfluent: boolean;
  convictionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'MAX';
  rule1Triggered: boolean;
  rule2Triggered: boolean;
  triggeredTeam?: 'home' | 'away';
  teamName?: string;
}

export type RecommendationAction = 'GO_MAX' | 'ENTER' | 'SNIPE' | 'NO_TRADE';

export interface MarketRecommendation {
  action: RecommendationAction;
  marketTitle: string;
  marketCode: string;
  targetOdd: number;
  reasoning: string;
  badgeClass: string;
  isConfluent?: boolean;
}



