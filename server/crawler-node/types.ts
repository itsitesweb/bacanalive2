// server/crawler-node/types.ts
/**
 * Tipos e Estruturas de Dados do Crawler Node.js (server/crawler-node/types.ts)
 * Portado 1:1 de bridge_web.py para preservar compatibilidade exata com o server.ts.
 */

// =============================================================================
// 1. NÍVEIS DE PRIORIDADE DE SCAN E TTL (MatchTier)
// =============================================================================
export enum MatchTier {
  TIER_0 = "TIER_0",       // Sinais / Posições Abertas (TTL: 10s)
  TIER_05 = "TIER_05",     // Ligas Premium / Tier 1 (TTL: 5s - Prioridade Máxima)
  TIER_1 = "TIER_1",       // Janela 20-83' com Stats & Perigo (TTL: 20s)
  TIER_2 = "TIER_2",       // Janela 20-83' Normal (TTL: 30s)
  TIER_3 = "TIER_3",       // Ligas Alternativas / Fora de Janela (TTL: 45s)
  HT = "HT",               // Intervalo / Half-Time (TTL: 35s - Sincronização Periódica Ativa)
  NO_STATS = "NO_STATS",   // Sem stats disponíveis (TTL: 120s)
  FINISHED = "FINISHED"    // Encerrado (TTL: Infinito)
}

export const TIER_SCAN_TTL_SECONDS: Record<MatchTier | string, number> = {
  [MatchTier.TIER_0]: 10.0,
  [MatchTier.TIER_05]: 5.0,
  [MatchTier.TIER_1]: 20.0,
  [MatchTier.TIER_2]: 30.0,
  [MatchTier.TIER_3]: 45.0,
  [MatchTier.HT]: 35.0,
  [MatchTier.NO_STATS]: 120.0,
  [MatchTier.FINISHED]: 999999.0
};

// =============================================================================
// 2. MODELO DE DADOS MATCHSTATE (Dataclass MatchState do bridge_web.py)
// =============================================================================
export interface MatchEvent {
  minute: number;
  type: string;
  team: "home" | "away" | string;
  player?: string;
  detail?: string;
  extra_minute?: number;
  [key: string]: any;
}

export interface MatchState {
  match_id: string;
  home: string;
  away: string;
  league: string;
  country: string;
  minute: number;
  home_score: number;
  away_score: number;
  home_bc: number;
  away_bc: number;
  home_xgot: number;
  away_xgot: number;
  home_red_cards: number;
  away_red_cards: number;
  home_sot: number;
  away_sot: number;
  home_shots: number;
  away_shots: number;
  home_xg: number;
  away_xg: number;
  home_corners: number;
  away_corners: number;
  home_possession: number;
  away_possession: number;
  home_dangerous_attacks: number;
  away_dangerous_attacks: number;
  home_attacks: number;
  away_attacks: number;
  home_shots_off_target: number;
  away_shots_off_target: number;
  home_blocked_shots: number;
  away_blocked_shots: number;
  home_fouls: number;
  away_fouls: number;
  home_yellow_cards: number;
  away_yellow_cards: number;
  home_saves: number;
  away_saves: number;
  home_xa: number;
  away_xa: number;
  all_stats: Record<string, any>;
  home_bc_raw?: number | null;
  away_bc_raw?: number | null;
  home_xgot_raw?: number | null;
  away_xgot_raw?: number | null;
  home_xg_raw?: number | null;
  away_xg_raw?: number | null;
  home_sot_raw?: number | null;
  away_sot_raw?: number | null;
  home_shots_raw?: number | null;
  away_shots_raw?: number | null;
  status_raw: string;
  stage_code: string;
  period: string;
  start_time: string;
  start_date: string;
  kickoff_ts: number;
  events: MatchEvent[];
}

// =============================================================================
// 3. ESTRUTURA DO CATÁLOGO DE PARTIDAS (MatchCatalogEntry)
// =============================================================================
export interface MatchCatalogEntryData {
  match_id: string;
  url: string;
  league: string;
  country: string;
  home: string;
  away: string;
  first_seen_at: number;
  last_seen_at: number;
  last_scanned_at: number;
  minute: number;
  status: string;
  home_score: number;
  away_score: number;
  ad: number;
  ao: number;
  stage_code: string;
  kickoff_time_str: string;
  start_date_iso: string;
  league_tier: string;
  is_premium: boolean;
  scan_cadence: string;
  tier: string;
  has_open_position: boolean;
  last_signal_time: number;
  had_stats: boolean;
  no_stats_until: number;
  is_finished: boolean;
  last_scanned_minute: number;
  stagnant_minute_count: number;
  cached_payload?: Record<string, any> | null;
}

// =============================================================================
// 4. ESTRUTURAS DE DESCOBERTA (Discovery & Feeds)
// =============================================================================
export interface DiscoveredMatch {
  mid: string;
  url: string;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  minute: number;
  stage: string;
  status?: string;
  stage_code?: string;
  is_live: boolean;
  league?: string;
  country?: string;
  ad?: number;
  ao?: number;
  st_str?: string;
  sd_iso?: string;
}

export interface FlashscoreFeedMeta {
  minute: number;
  home_score: number;
  away_score: number;
  status_str: string;
  stage_code: string;
  is_finished: boolean;
  has_stats: boolean;
}

export interface FlashscoreFeedIncidents {
  home_red: number;
  away_red: number;
  home_score?: number | null;
  away_score?: number | null;
  latest_minute: number;
  stage: string;
  events: MatchEvent[];
}

// =============================================================================
// 5. CONFIGURAÇÃO OPERACIONAL DO CRAWLER
// =============================================================================
export interface TierFilterConfig {
  enableTier0Signals: boolean;
  enableTier05PremiumLeagues: boolean;
  enableTier12Window: boolean;
  enableTier3Rotation: boolean;
  enableTier1: boolean;
  enableTier2: boolean;
  enableTier3: boolean;
  enableTier4: boolean;
}

export interface CrawlerConfig {
  mode?: "python" | "node" | "both";
  maxWatchlistSize: number;
  concurrentWorkers: number;
  discoveryIntervalSeconds: number;
  tier3ReservedSlots: number;
  minEntryMinute: number;
  maxEntryMinute: number;
  antiSpamCooldownMinutes: number;
  autoPruneMinutes: number;
  noStatsBackoffMinutes: number;
  matchReadTimeoutMs: number;
  discoveryTimeoutMs: number;
  routeResourceBlock: boolean;
  enableBackgroundDiscovery: boolean;
  excludeEsoccer: boolean;
  excludeWomen: boolean;
  excludeYouthUnder: boolean;
  customExcludedKeywords: string[];
  tierFilter: TierFilterConfig;
}

// =============================================================================
// 6. PAYLOAD DE DISPATCH (Emitido para /api/crawler/webhook ou matchStore)
// =============================================================================
export interface WebhookMatchPayload {
  id: string;
  homeTeam: {
    name: string;
    score: number;
    redCards?: number;
  };
  awayTeam: {
    name: string;
    score: number;
    redCards?: number;
  };
  score: {
    home: number;
    away: number;
  };
  homeScore: number;
  awayScore: number;
  league: string;
  country: string;
  leagueCountry: string;
  tier: string;
  startTime: string;
  startDate: string;
  minute: number;
  status: string;
  stage_code: string;
  stage: string;
  period: string;
  hasCompleteStats: boolean;
  home_shots?: number;
  away_shots?: number;
  home_total_shots?: number;
  away_total_shots?: number;
  statistics: {
    possession: { home: number; away: number };
    totalShots?: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
    shotsOffTarget: { home: number; away: number };
    corners: { home: number; away: number };
    dangerousAttacks: { home: number; away: number };
    attacks: { home: number; away: number };
    xg: { home: number; away: number };
    xgot: { home: number; away: number };
    bigChances: { home: number; away: number };
    yellowCards: { home: number; away: number };
    redCards: { home: number; away: number };
    goalkeeperSaves: { home: number; away: number };
  };
  events: MatchEvent[];
  updatedAt: string;
}

export interface CrawlerHeartbeatPayload {
  crawlerId: string;
  version: string;
  activeMatches: number;
  status: string;
  session_id: string;
  sessionId: string;
}
