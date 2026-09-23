// server/crawler-node/extractors.ts
/**
 * Motor de Extração de Estatísticas e Detalhes da Partida (server/crawler-node/extractors.ts)
 * Portado 1:1 de FlashscoreReader, feed stats, incidents e scripts DOM de bridge_web.py.
 * Os scripts JS dentro de page.evaluate() foram copiados literalmente.
 */

import { Page, BrowserContext } from "playwright";
import { MatchState, MatchEvent, FlashscoreFeedMeta, FlashscoreFeedIncidents } from "./types";
import { resolveMatchStatusAndPeriod } from "./statusResolver";

// =============================================================================
// 1. FILTROS DE LIGAS IGNORADAS (E-Soccer, Feminino, Under/Youth)
// =============================================================================

export const IGNORED_PATTERNS: RegExp[] = [
  /\besoccer\b/i, /\be-soccer\b/i, /\besports\b/i, /\be-sports\b/i,
  /\bcyber\b/i, /\bvirtual\b/i, /\bgt league\b/i, /\bgt battle\b/i,
  /\bfifa\b/i, /\bpes\b/i, /\bvolta\b/i, /\b2x2\b/i, /\b3x3\b/i, /\b4x4\b/i,
  /\b5x5\b/i, /\b6x6\b/i, /\b7x7\b/i, /\b8x8\b/i, /\bgg league\b/i,
  /\bh2h gg\b/i, /\be-football\b/i, /\befootball\b/i, /\bpenalty\b/i,
  /\bsrl\b/i, /\bsimulated\b/i, /\bshort football\b/i,
  /\bfeminino\b/i, /\bfeminina\b/i, /\bwomen\b/i, /\bwoman\b/i,
  /\bladies\b/i, /\bfrauen\b/i, /\bdames\b/i, /\bfemmes\b/i,
  /\bdamen\b/i, /\bkvinner\b/i, /\bnaiset\b/i, /\bmulheres\b/i,
  /\b\(w\)\b/i, /\b\[w\]\b/i, /\b\(f\)\b/i, /\b\[f\]\b/i, /\b\(fem\)\b/i,
  /\bwfc\b/i, /\bffc\b/i, /\bwomen's\b/i,
  /\b[a-záàâãéêíóôõúç\d\s]+\s+f\b/i, /\b[a-záàâãéêíóôõúç\d\s]+\s+w\b/i,
];

export function isIgnoredMatch(
  league: string = "",
  country: string = "",
  home: string = "",
  away: string = "",
  crawlerConfig?: any
): boolean {
  const text = `${league} ${country} ${home} ${away}`.toLowerCase();

  if (crawlerConfig) {
    const customKws = crawlerConfig.customExcludedKeywords || [];
    for (const kw of customKws) {
      const kwClean = String(kw).trim().toLowerCase();
      if (kwClean && text.includes(kwClean)) {
        return true;
      }
    }

    if (crawlerConfig.excludeYouthUnder ?? true) {
      const youthPatterns = [
        /\bu17\b/i, /\bu18\b/i, /\bu19\b/i, /\bu20\b/i, /\bu21\b/i, /\bu23\b/i,
        /\bsub[- ]\d+/i, /\byouth\b/i, /\breserva\b/i
      ];
      for (const yp of youthPatterns) {
        if (yp.test(text)) return true;
      }
    }
  }

  for (const pattern of IGNORED_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

// =============================================================================
// 2. SCRIPTS JS COPIADOS LITERALMENTE DE BRIDGE_WEB.PY (NENHUMA ALTERAÇÃO)
// =============================================================================

export const SCRIPT_RED_CARDS = `
() => {
  let homeRed = 0, awayRed = 0;
  const events = [];
  // Localizar exclusivamente ícones/elementos com classes formais de cartão vermelho ou segundo amarelo
  const redCards = document.querySelectorAll('.card-ico--red, .card-ico--yellow-red, [class*="card-ico--red"], [class*="card-ico--yellow-red"]');
  redCards.forEach((card, idx) => {
    const parentRow = card.closest('.smv__incident, [class*="incidentRow"], [class*="smh__incident"]') || card.parentElement;
    if (!parentRow) return;
    const isHome = parentRow.closest('.smv__homeParticipant, .smv__incidentHomeScore, [class*="--home"], [class*="incidentSubRow--home"]') !== null ||
                   parentRow.matches('.smv__incidentHomeScore, [class*="--home"]');
    const isAway = parentRow.closest('.smv__awayParticipant, .smv__incidentAwayScore, [class*="--away"], [class*="incidentSubRow--away"]') !== null ||
                   parentRow.matches('.smv__incidentAwayScore, [class*="--away"]');
    if (isHome) homeRed++;
    else if (isAway) awayRed++;

    // Extrair minuto real em que a expulsão ocorreu no jogo
    let cardMin = 0;
    let extraMin = null;
    const timeEl = parentRow.querySelector('.smv__timeBox, [class*="timeBox"], [class*="incidentTime"]');
    if (timeEl) {
      const tStr = (timeEl.textContent || '').replace("'", '').trim();
      const mMatch = tStr.match(/^(\\d+)(?:\\+(\\d+))?/);
      if (mMatch) {
        cardMin = parseInt(mMatch[1], 10);
        if (mMatch[2]) extraMin = parseInt(mMatch[2], 10);
      }
    }

    // Extrair nome do jogador punido
    const playerEl = parentRow.querySelector('.smv__playerName, [class*="playerName"], [class*="participantName"], a[class*="player"]');
    const playerName = playerEl ? (playerEl.textContent || '').trim() : '';

    if (cardMin > 0 || playerName) {
      events.push({
        id: \`dom_rc_\${idx}_\${cardMin}\`,
        minute: cardMin,
        extraMinute: extraMin,
        type: 'red_card',
        team: isHome ? 'home' : (isAway ? 'away' : 'home'),
        player: playerName || null
      });
    }
  });
  return JSON.stringify({home_red: homeRed, away_red: awayRed, events: events});
}
`;

export const _JS_EXTRACTION_SCRIPT = `
() => {
  const rows = document.querySelectorAll('[class*="wcl-category"], [class*="statRow"], [class*="category__"]');
  const stats = {};
  rows.forEach(r => {
    const labelEl = r.querySelector('[class*="categoryName"], [class*="category_"], [class*="statName"]');
    if (!labelEl) return;
    const name = labelEl.textContent.trim();
    if (!name) return;
    let homeVal = '', awayVal = '';
    const homeEl = r.querySelector('[class*="homeValue"], [class*="home_"], [class*="value--home"], [class*="categoryHomeValue"]');
    const awayEl = r.querySelector('[class*="awayValue"], [class*="away_"], [class*="value--away"], [class*="categoryAwayValue"]');
    if (homeEl && awayEl) {
      homeVal = homeEl.textContent.trim();
      awayVal = awayEl.textContent.trim();
    } else {
      const fullText = r.textContent.trim();
      const labelIdx = fullText.indexOf(name);
      if (labelIdx > 0) {
        homeVal = fullText.substring(0, labelIdx).trim();
        awayVal = fullText.substring(labelIdx + name.length).trim();
      }
    }
    stats[name] = { h: homeVal, a: awayVal };
  });

  const scoreEl = document.querySelector('[class*="detailScore__wrapper"], [class*="detailScore"], .detailScore__matchInfo');
  const scoreRaw = scoreEl ? scoreEl.textContent.trim() : '';
  const statusEl = document.querySelector('[class*="detailStatus"], [class*="liveTime"], [class*="eventTime"], [class*="fixedHeaderDuel__detailStatus"]');
  const statusRaw = statusEl ? statusEl.textContent.trim() : '';

  let homeTeam = '', awayTeam = '';
  const hParticipant = document.querySelector('[class*="duelParticipant__home"] [class*="participantName"], [class*="participant__participantName--home"], [class*="homeTeam"] [class*="name"]');
  const aParticipant = document.querySelector('[class*="duelParticipant__away"] [class*="participantName"], [class*="participant__participantName--away"], [class*="awayTeam"] [class*="name"]');
  if (hParticipant && aParticipant) {
    homeTeam = hParticipant.textContent.trim();
    awayTeam = aParticipant.textContent.trim();
  } else {
    const teamEls = document.querySelectorAll('[class*="participant__participantName"], [class*="duelParticipant"] [class*="participantName"]');
    const teamsSet = [...new Set(Array.from(teamEls).map(e => e.textContent.trim()).filter(Boolean))];
    homeTeam = teamsSet[0] || '';
    awayTeam = teamsSet[1] || '';
  }

  if (!homeTeam || !awayTeam) {
    const titleClean = (document.title || '').split('|')[0].split('-')[0].trim();
    const titleMatch = titleClean.match(/^(.+?)\\s+[-xX–vsVS.]+\\s+(.+?)$/);
    if (titleMatch) {
      if (!homeTeam) homeTeam = titleMatch[1].trim();
      if (!awayTeam) awayTeam = titleMatch[2].trim();
    }
  }

  let countryName = '';
  let leagueName = '';
  const countryEl = document.querySelector('[class*="tournamentHeader__country"], [class*="tournamentHeader__category"], [class*="breadcrumb"] span:first-child, [class*="breadcrumb"] a:first-child');
  const leagueEl = document.querySelector('[class*="tournamentHeader__league"], [class*="tournamentHeader__title"], [class*="tournamentHeader"] a:last-child');
  if (countryEl) countryName = countryEl.textContent.replace(/[:\\s]+$/, '').trim();
  if (leagueEl) leagueName = leagueEl.textContent.trim();

  return JSON.stringify({
    title: document.title || '',
    score_raw: scoreRaw,
    status_raw: statusRaw,
    home_team: homeTeam || '?',
    away_team: awayTeam || '?',
    country: countryName,
    league: leagueName,
    stats: stats,
  });
}
`;

// =============================================================================
// 3. DICIONÁRIOS DE LABELS (PADRONIZAÇÃO FLASHSCORE PT / EN)
// =============================================================================

export const BC_LABELS = [
  "Chances claras", "Big chances", "Grandes oportunidades", "Grandes chances",
  "Chances Claras", "Grandes Oportunidades", "Big Chances"
];
export const XGOT_LABELS = [
  "xG das finalizações no alvo (xGOT)", "xG on target (xGOT)", "xG na baliza (xGOT)",
  "xG no alvo (xGOT)", "xGOT", "Golos esperados no alvo (xGOT)", "Gols esperados no alvo (xGOT)"
];
export const XG_LABELS = [
  "Gols esperados (xG)", "Golos esperados (xG)", "Expected goals (xG)",
  "xG (esperado)", "xG", "Expected goals", "Gols esperados"
];
export const SOT_LABELS = [
  "Finalizações no alvo", "Finalizações ao gol", "Remates à baliza",
  "Shots on target", "Chutes ao gol", "Remates no alvo", "Chutes no gol"
];
export const SHOTS_LABELS = [
  "Total de finalizações", "Total shots", "Remates totais",
  "Finalizações totais", "Chutes", "Finalizações", "Total Shots"
];
export const XA_LABELS = [
  "Assistências esperadas (xA)", "Expected assists (xA)", "xA (esperado)", "xA"
];
export const CORNERS_LABELS = [
  "Escanteios", "Pontapés de canto", "Cantos", "Corner kicks", "Corners", "Córners"
];
export const POSSESSION_LABELS = [
  "Posse de bola", "Posse de bola (%)", "Posse", "Ball possession", "Possession"
];
export const ATTACKS_LABELS = [
  "Ataques", "Total attacks", "Attacks"
];
export const DANGEROUS_ATTACKS_LABELS = [
  "Ataques Perigosos", "Ataques perigosos", "Dangerous attacks"
];
export const SHOTS_OFF_TARGET_LABELS = [
  "Finalizações para fora", "Remates para fora", "Shots off target", "Chutes fora"
];
export const BLOCKED_SHOTS_LABELS = [
  "Finalizações bloqueadas", "Chutes travados", "Remates bloqueados", "Blocked shots"
];
export const FOULS_LABELS = [
  "Faltas", "Fouls"
];
export const YELLOW_CARDS_LABELS = [
  "Cartões amarelos", "Cartões Amarelos", "Yellow cards"
];
export const RED_CARDS_LABELS = [
  "Cartões vermelhos", "Cartões Vermelhos", "Red cards", "Tarjetas rojas", "Cartão vermelho"
];
export const SAVES_LABELS = [
  "Defesas do goleiro", "Defesas", "Goalkeeper saves", "Saves"
];

// =============================================================================
// 4. PARSERS AUXILIARES E EXTRAÇÃO DE IDs E URLs
// =============================================================================

export function extractMatchId(url: string): string {
  let m = url.match(/\/jogo\/([A-Za-z0-9]{5,12})/);
  if (m) return `FS_${m[1]}`;
  m = url.match(/\/match\/([A-Za-z0-9]+)/);
  if (m) return `FS_${m[1]}`;
  m = url.match(/mid=([A-Za-z0-9]+)/);
  if (m) return `FS_${m[1]}`;
  m = url.match(/\/jogo\/[^/]+\/[^/]+-([A-Za-z0-9]+)/);
  if (m) return `FS_${m[1]}`;
  return "FS_UNKNOWN";
}

export function getRawId(midOrUrl: string): string {
  if (!midOrUrl) return "";
  const clean = String(midOrUrl).trim();
  if (clean.startsWith("FS_") || clean.startsWith("fs_")) {
    return clean.substring(3);
  }
  let m = clean.match(/\/jogo\/([A-Za-z0-9]{5,12})/);
  if (m) return m[1];
  m = clean.match(/\/match\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  return clean;
}

export function normalizeStatsUrl(url: string): string {
  const base = url.split("#")[0].replace(/\/+$/, "");
  return `${base}#/match-summary/match-statistics/0`;
}

export function ensureStatsUrl(url: string): string {
  const clean = url.split("#")[0];
  if (clean.includes("/resumo/estatisticas/total/")) {
    return clean;
  }
  let p = clean;
  let q = "";
  if (clean.includes("?")) {
    const parts = clean.split("?");
    p = parts[0];
    q = `?${parts.slice(1).join("?")}`;
  }
  p = p.replace(/\/+$/, "") + "/resumo/estatisticas/total/";
  return p + q;
}

export function toFloat(s: any): number {
  if (s === null || s === undefined || s === "") return 0.0;
  const str = String(s).trim();
  const m = str.match(/([\d]+(?:[\.,]\d+)?)/);
  if (m) {
    try {
      return parseFloat(m[1].replace(",", "."));
    } catch {
      return 0.0;
    }
  }
  return 0.0;
}

export function getStatFloat(stats: Record<string, any>, labels: string[], side: "h" | "a"): number {
  const statsLower: Record<string, any> = {};
  for (const [k, v] of Object.entries(stats)) {
    statsLower[k.toLowerCase().trim()] = v;
  }

  for (const label of labels) {
    const key = label.toLowerCase().trim();
    if (key in statsLower) {
      const val = statsLower[key]?.[side] ?? "";
      return toFloat(val);
    }
  }

  for (const label of labels) {
    const key = label.toLowerCase().trim();
    for (const [sk, sv] of Object.entries(statsLower)) {
      if (sk.includes(key) || key.includes(sk)) {
        const val = sv?.[side] ?? "";
        const v = toFloat(val);
        if (v > 0) return v;
      }
    }
  }

  return 0.0;
}

export function getStatInt(stats: Record<string, any>, labels: string[], side: "h" | "a"): number {
  return Math.round(getStatFloat(stats, labels, side));
}

export function getStatFloatOrNone(
  stats: Record<string, any>,
  labels: string[],
  side: "h" | "a"
): number | null {
  const statsLower: Record<string, any> = {};
  for (const [k, v] of Object.entries(stats)) {
    statsLower[k.toLowerCase().trim()] = v;
  }

  for (const label of labels) {
    const key = label.toLowerCase().trim();
    if (key in statsLower) {
      const raw = statsLower[key]?.[side];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        return toFloat(raw);
      }
    }
  }

  for (const label of labels) {
    const key = label.toLowerCase().trim();
    for (const [sk, sv] of Object.entries(statsLower)) {
      if (sk.includes(key) || key.includes(sk)) {
        const raw = sv?.[side];
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
          return toFloat(raw);
        }
      }
    }
  }

  return null;
}

export function getStatIntOrNone(
  stats: Record<string, any>,
  labels: string[],
  side: "h" | "a"
): number | null {
  const v = getStatFloatOrNone(stats, labels, side);
  return v !== null ? Math.round(v) : null;
}

export function parseScore(scoreRaw: string, title: string = ""): [number, number] {
  if (title) {
    const titleClean = title.split("|")[0];
    const m = titleClean.match(/\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b/);
    if (m) {
      const h = parseInt(m[1], 10);
      const a = parseInt(m[2], 10);
      if (h <= 20 && a <= 20) {
        return [h, a];
      }
    }
  }
  if (!scoreRaw) return [0, 0];
  const m2 = scoreRaw.match(/(\d{1,2})\s*[-:]\s*(\d{1,2})/);
  if (!m2) return [0, 0];
  return [parseInt(m2[1], 10), parseInt(m2[2], 10)];
}

export function parseMinute(statusRaw: string, scoreRaw: string = ""): number {
  const status = (statusRaw || "").trim();
  if (!status) return 0;
  const up = status.toUpperCase();

  for (const source of [status, scoreRaw]) {
    const m = source.match(/(\d{1,3}):(\d{2})/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 0 && n <= 130) return n;
    }
  }

  if (up.includes("TERMINADO") || up.includes("FINISHED") || up.includes("ENCERRADO") || /\bFT\b/.test(up)) {
    return 90;
  }
  if (up.includes("INTERVALO") || up.includes("HALF TIME") || /\bHT\b/.test(up)) {
    return 45;
  }

  const mDigits = status.match(/\b(\d{1,3})\b/);
  if (mDigits) {
    const n = parseInt(mDigits[1], 10);
    if (n >= 0 && n <= 130) return n;
  }
  return 0;
}

// =============================================================================
// 5. DECODIFICADORES OFICIAIS FLASHSCORE (df_st, dc_1, df_sui) VIA FEED HTTP
// =============================================================================

export async function fetchFlashscoreFeedStats(
  rawId: string
): Promise<Record<string, { h: string; a: string }>> {
  if (!rawId) return {};

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "x-fsign": "SW9D1eZo",
    Referer: `https://www.flashscore.com.br/jogo/${rawId}/`,
  };

  const feedUrls = [
    `https://www.flashscore.com.br/x/feed/df_st_0_${rawId}`,
    `https://www.flashscore.com.br/x/feed/df_st_1_${rawId}`,
    `https://www.flashscore.com/x/feed/df_st_0_${rawId}`,
    `https://www.flashscore.com/x/feed/df_st_1_${rawId}`,
  ];

  const stats: Record<string, { h: string; a: string }> = {};

  for (const u of feedUrls) {
    try {
      const res = await fetch(u, { headers, signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes("¬SG÷")) {
          let mainPart = text;
          if (text.includes("SE÷Jogo")) {
            const parts = text.split(/~SE÷|¬SE÷/);
            for (const p of parts) {
              if (p.startsWith("Jogo") || p.includes("SE÷Jogo")) {
                mainPart = p;
                break;
              }
            }
          }

          // ¬SG÷ (Nome da Stat), ¬SH÷ (Valor Mandante), ¬SI÷ (Valor Visitante)
          const pattern = /¬SG÷([^¬~]+)[\s\S]*?¬SH÷([^¬~]+)[\s\S]*?¬SI÷([^¬~]+)/g;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(mainPart)) !== null) {
            const name = match[1].trim();
            const homeVal = match[2].trim();
            const awayVal = match[3].trim();
            if (name && (homeVal || awayVal) && !stats[name]) {
              stats[name] = { h: homeVal, a: awayVal };
            }
          }

          if (Object.keys(stats).length > 0) {
            break;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return stats;
}

export async function fetchFlashscoreFeedMeta(
  rawId: string
): Promise<FlashscoreFeedMeta | null> {
  if (!rawId) return null;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "x-fsign": "SW9D1eZo",
    Referer: `https://www.flashscore.com.br/jogo/${rawId}/`,
  };

  try {
    const res = await fetch(`https://www.flashscore.com.br/x/feed/dc_1_${rawId}`, {
      headers,
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;

    const lines = text.split("¬");
    const d: Record<string, string> = {};
    for (const l of lines) {
      if (l.includes("÷")) {
        const [k, v] = l.split("÷");
        d[k] = v;
      }
    }

    const statusCode = d["DA"] || "0";
    const stageCode = d["DB"] || "";
    const adVal = d["DC"] && /^\d+$/.test(d["DC"]) ? parseInt(d["DC"], 10) : 0;
    const aoVal = d["DD"] && /^\d+$/.test(d["DD"]) ? parseInt(d["DD"], 10) : 0;
    const hScore = d["DE"] && /^\d+$/.test(d["DE"]) ? parseInt(d["DE"], 10) : 0;
    const aScore = d["DF"] && /^\d+$/.test(d["DF"]) ? parseInt(d["DF"], 10) : 0;
    const dxFeatures = d["DX"] || "";
    const hasStatsTab = dxFeatures.includes("ST");

    const isFinished =
      statusCode === "3" ||
      ["3", "16", "17", "18", "19", "20", "21"].includes(stageCode);

    const nowEpoch = Math.floor(Date.now() / 1000);
    let minute = 1;
    let statusStr = "LIVE";

    const effectiveStart = aoVal > 0 ? aoVal : adVal;

    if (isFinished) {
      minute = 90;
      statusStr = "FT";
    } else if (stageCode === "12") {
      minute = effectiveStart > 0 ? Math.max(1, Math.floor((nowEpoch - effectiveStart) / 60)) : 1;
      statusStr = "1H";
    } else if (stageCode === "38") {
      minute = 45;
      statusStr = "HT";
    } else if (stageCode === "13") {
      if (aoVal > 0) {
        minute = Math.max(46, 45 + Math.floor((nowEpoch - aoVal) / 60));
      } else if (adVal > 0) {
        minute = Math.max(46, Math.floor((nowEpoch - adVal) / 60) - 15);
      } else {
        minute = 60;
      }
      statusStr = "2H";
    } else if (stageCode === "14" || stageCode === "15") {
      minute = aoVal > 0 ? Math.max(91, 90 + Math.floor((nowEpoch - aoVal) / 60)) : 95;
      statusStr = "ET";
    } else {
      if (effectiveStart > 0) {
        const elapsed = Math.floor((nowEpoch - effectiveStart) / 60);
        if (elapsed <= 45) {
          minute = Math.max(1, elapsed);
          statusStr = "1H";
        } else if (elapsed <= 55) {
          minute = 45;
          statusStr = "1H";
        } else {
          minute = Math.max(46, elapsed - 15);
          statusStr = "2H";
        }
      }
    }

    return {
      minute,
      home_score: hScore,
      away_score: aScore,
      status_str: statusStr,
      stage_code: stageCode,
      is_finished: isFinished,
      has_stats: hasStatsTab,
    };
  } catch {
    return null;
  }
}

export async function fetchFlashscoreFeedIncidents(
  rawId: string
): Promise<FlashscoreFeedIncidents & { latest_minute: number; events: MatchEvent[] }> {
  const result: FlashscoreFeedIncidents & { latest_minute: number; events: MatchEvent[] } = {
    home_red: 0,
    away_red: 0,
    home_score: null,
    away_score: null,
    latest_minute: 0,
    stage: "",
    events: [],
  };

  if (!rawId) return result;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "x-fsign": "SW9D1eZo",
    Referer: `https://www.flashscore.com.br/jogo/${rawId}/`,
  };

  try {
    const res = await fetch(`https://www.flashscore.com.br/x/feed/df_sui_1_${rawId}`, {
      headers,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return result;
    const text = await res.text();
    if (!text) return result;

    let homeGoalsCount = 0;
    let awayGoalsCount = 0;
    let hadGoals = false;
    const rawEvents: MatchEvent[] = [];
    let evIdx = 0;

    for (const item of text.split("~")) {
      const low = item.toLowerCase();

      // Minuto do evento (IB) e extra (IT)
      let evMinute = 0;
      const ibMatch = item.match(/¬IB÷(\d+)/);
      if (ibMatch) {
        evMinute = parseInt(ibMatch[1], 10);
        if (evMinute > result.latest_minute) {
          result.latest_minute = evMinute;
        }
      }

      let extraMin: number | undefined = undefined;
      const itMatch = item.match(/¬IT÷(\d+)/);
      if (itMatch) {
        extraMin = parseInt(itMatch[1], 10);
      }

      // Lado da equipe (IA: 1 = Home, 2 = Away)
      let evTeam: "home" | "away" = "home";
      const iaMatch = item.match(/¬?IA÷([12])/);
      if (iaMatch && iaMatch[1] === "2") {
        evTeam = "away";
      }

      // Nome do Jogador Principal (IF / IFB / PN / IN / IR)
      let playerName = "";
      for (const pPat of [/¬IF÷([^¬~]+)/, /¬IFB÷([^¬~]+)/, /¬PN÷([^¬~]+)/, /¬IN÷([^¬~]+)/, /¬IR÷([^¬~]+)/]) {
        const pm = item.match(pPat);
        if (pm) {
          playerName = pm[1].trim();
          break;
        }
      }

      // Assistência (IG / IGB / AS / I4)
      let assistName = "";
      for (const aPat of [/¬IG÷([^¬~]+)/, /¬IGB÷([^¬~]+)/, /¬AS÷([^¬~]+)/, /¬I4÷([^¬~]+)/]) {
        const am = item.match(aPat);
        if (am) {
          assistName = am[1].trim();
          break;
        }
      }

      // Detalhe do evento (IH / IK / ID)
      let detailText = "";
      const ihMatch = item.match(/¬IH÷([^¬~]+)/);
      if (ihMatch) {
        detailText = ihMatch[1].trim();
      }

      // Placar momentâneo (INX x IOX)
      let scoreMoment = "";
      const inxMatch = item.match(/¬INX÷(\d+)/);
      const ioxMatch = item.match(/¬IOX÷(\d+)/);
      if (inxMatch && ioxMatch) {
        scoreMoment = `${inxMatch[1]} - ${ioxMatch[1]}`;
      }

      // Cartões e eventos pelo campo ¬IK÷ (Incident Kind)
      const ikMatch = item.match(/¬?IK÷([^¬~]+)/i);
      if (ikMatch) {
        const ikVal = ikMatch[1].toLowerCase().trim();
        const isYellowOnly =
          ikVal.includes("amarelo") &&
          !ikVal.includes("2º") &&
          !ikVal.includes("segundo") &&
          !ikVal.includes("vermelho");
        const isRed =
          (ikVal.includes("cartão vermelho") ||
            ikVal.includes("cartao vermelho") ||
            ikVal.includes("red card") ||
            ikVal.includes("2º cartão amarelo/vermelho") ||
            ikVal.includes("2º amarelo") ||
            ikVal.includes("segundo amarelo") ||
            ikVal.includes("tarjeta roja")) &&
          !isYellowOnly;
        const isYellow =
          (ikVal.includes("amarelo") || ikVal.includes("yellow card") || ikVal.includes("tarjeta amarilla")) &&
          !isRed;
        const isSub =
          ikVal.includes("substitui") || ikVal.includes("substitution") || ikVal.includes("troca");
        const isVar =
          ikVal.includes("var") || ikVal.includes("vídeo árbitro") || ikVal.includes("video referee");

        if (isRed) {
          if (evTeam === "home") result.home_red += 1;
          else result.away_red += 1;
        }

        let evType: string | null = null;
        if (isRed) evType = "red_card";
        else if (isYellow) evType = "yellow_card";
        else if (isSub) evType = "sub";
        else if (isVar) evType = "var";

        if (evType && evMinute > 0) {
          evIdx++;
          rawEvents.push({
            id: `ev_${rawId}_${evIdx}_${evMinute}`,
            minute: evMinute,
            extra_minute: extraMin,
            type: evType,
            team: evTeam,
            player: playerName || undefined,
            assistPlayer: assistName || undefined,
            detail: detailText || undefined,
            score: scoreMoment || undefined,
          });
        }
      }

      // Estágio
      if (low.includes("ac÷")) {
        const stMatch = item.match(/¬?AC÷([^¬~]+)/);
        if (stMatch && stMatch[1].trim()) {
          result.stage = stMatch[1].trim();
        }
      }

      // Gols
      if (
        low.includes("¬ik÷gol") ||
        low.includes("¬ik÷golo") ||
        low.includes("¬ik÷goal") ||
        low.includes("¬ik÷pen")
      ) {
        hadGoals = true;
        if (inxMatch && ioxMatch) {
          result.home_score = parseInt(inxMatch[1], 10);
          result.away_score = parseInt(ioxMatch[1], 10);
        } else {
          if (evTeam === "home") homeGoalsCount++;
          else awayGoalsCount++;
        }

        if (evMinute > 0) {
          evIdx++;
          const isPenalty = low.includes("penal") || low.includes("pênalti");
          rawEvents.push({
            id: `ev_${rawId}_${evIdx}_${evMinute}`,
            minute: evMinute,
            extra_minute: extraMin,
            type: isPenalty ? "penalty_scored" : "goal",
            team: evTeam,
            player: playerName || undefined,
            assistPlayer: assistName || undefined,
            detail: detailText || (isPenalty ? "Pênalti" : undefined),
            score: scoreMoment || undefined,
          });
        }
      }
    }

    if (result.home_score === null && hadGoals) {
      result.home_score = homeGoalsCount;
      result.away_score = awayGoalsCount;
    }

    rawEvents.sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      return (a.extra_minute || 0) - (b.extra_minute || 0);
    });

    result.events = rawEvents;
  } catch {
    // Ignora erros no parsing de incidentes
  }

  return result;
}

// =============================================================================
// 6. BUILDER CENTRAL DE MATCHSTATE (Espelhado 1:1 com _to_match_state)
// =============================================================================

export function buildMatchStateFromStats(
  dados: Record<string, any>,
  redData: Record<string, any> = {},
  matchId: string = ""
): MatchState {
  let homeScore = 0;
  let awayScore = 0;

  if (dados.home_score !== undefined && dados.home_score !== null &&
      dados.away_score !== undefined && dados.away_score !== null) {
    try {
      homeScore = parseInt(dados.home_score, 10);
      awayScore = parseInt(dados.away_score, 10);
    } catch {
      [homeScore, awayScore] = parseScore(dados.score_raw || "", dados.title || "");
    }
  } else {
    [homeScore, awayScore] = parseScore(dados.score_raw || "", dados.title || "");
  }

  let minute = 0;
  if (dados.minute !== undefined && dados.minute !== null && parseInt(dados.minute, 10) > 0) {
    minute = parseInt(dados.minute, 10);
  } else {
    minute = parseMinute(dados.status_raw || "", dados.score_raw || "");
  }

  if (minute === 0 && redData && redData.latest_minute && redData.latest_minute > 0) {
    minute = parseInt(redData.latest_minute, 10);
  }

  const stats = dados.stats || {};

  const hBc = getStatIntOrNone(stats, BC_LABELS, "h");
  const aBc = getStatIntOrNone(stats, BC_LABELS, "a");
  const hXgot = getStatFloatOrNone(stats, XGOT_LABELS, "h");
  const aXgot = getStatFloatOrNone(stats, XGOT_LABELS, "a");
  const hXg = getStatFloatOrNone(stats, XG_LABELS, "h");
  const aXg = getStatFloatOrNone(stats, XG_LABELS, "a");
  const hSot = getStatIntOrNone(stats, SOT_LABELS, "h");
  const aSot = getStatIntOrNone(stats, SOT_LABELS, "a");
  const hShots = getStatIntOrNone(stats, SHOTS_LABELS, "h");
  const aShots = getStatIntOrNone(stats, SHOTS_LABELS, "a");
  const hXa = getStatFloatOrNone(stats, XA_LABELS, "h");
  const aXa = getStatFloatOrNone(stats, XA_LABELS, "a");

  let hPoss = getStatInt(stats, POSSESSION_LABELS, "h");
  let aPoss = getStatInt(stats, POSSESSION_LABELS, "a");
  if (hPoss === 0 && aPoss === 0) {
    hPoss = 50;
    aPoss = 50;
  }

  const hRedStat = getStatIntOrNone(stats, RED_CARDS_LABELS, "h");
  const aRedStat = getStatIntOrNone(stats, RED_CARDS_LABELS, "a");
  const homeRedCards = Math.max(hRedStat !== null ? hRedStat : 0, redData.home_red || 0);
  const awayRedCards = Math.max(aRedStat !== null ? aRedStat : 0, redData.away_red || 0);

  return {
    match_id: matchId || dados.match_id || "?",
    home: dados.home_team || dados.home || "?",
    away: dados.away_team || dados.away || "?",
    league: dados.league || "",
    country: dados.country || "",
    minute: minute,
    home_score: homeScore,
    away_score: awayScore,
    status_raw: (dados.status_raw || "").trim(),
    stage_code: (dados.stage_code || "").trim(),
    period: (dados.period || "").trim(),
    home_bc: hBc !== null ? hBc : 0,
    away_bc: aBc !== null ? aBc : 0,
    home_xgot: hXgot !== null ? hXgot : 0.0,
    away_xgot: aXgot !== null ? aXgot : 0.0,
    home_xg: hXg !== null ? hXg : 0.0,
    away_xg: aXg !== null ? aXg : 0.0,
    home_sot: hSot !== null ? hSot : 0,
    away_sot: aSot !== null ? aSot : 0,
    home_shots: hShots !== null ? hShots : 0,
    away_shots: aShots !== null ? aShots : 0,
    home_xa: hXa !== null ? hXa : 0.0,
    away_xa: aXa !== null ? aXa : 0.0,
    home_corners: getStatInt(stats, CORNERS_LABELS, "h"),
    away_corners: getStatInt(stats, CORNERS_LABELS, "a"),
    home_possession: hPoss,
    away_possession: aPoss,
    home_dangerous_attacks: getStatInt(stats, DANGEROUS_ATTACKS_LABELS, "h"),
    away_dangerous_attacks: getStatInt(stats, DANGEROUS_ATTACKS_LABELS, "a"),
    home_attacks: getStatInt(stats, ATTACKS_LABELS, "h"),
    away_attacks: getStatInt(stats, ATTACKS_LABELS, "a"),
    home_shots_off_target: getStatInt(stats, SHOTS_OFF_TARGET_LABELS, "h"),
    away_shots_off_target: getStatInt(stats, SHOTS_OFF_TARGET_LABELS, "a"),
    home_blocked_shots: getStatInt(stats, BLOCKED_SHOTS_LABELS, "h"),
    away_blocked_shots: getStatInt(stats, BLOCKED_SHOTS_LABELS, "a"),
    home_fouls: getStatInt(stats, FOULS_LABELS, "h"),
    away_fouls: getStatInt(stats, FOULS_LABELS, "a"),
    home_yellow_cards: getStatInt(stats, YELLOW_CARDS_LABELS, "h"),
    away_yellow_cards: getStatInt(stats, YELLOW_CARDS_LABELS, "a"),
    home_saves: getStatInt(stats, SAVES_LABELS, "h"),
    away_saves: getStatInt(stats, SAVES_LABELS, "a"),
    all_stats: stats,
    home_red_cards: homeRedCards,
    away_red_cards: awayRedCards,
    home_bc_raw: hBc,
    away_bc_raw: aBc,
    home_xgot_raw: hXgot,
    away_xgot_raw: aXgot,
    home_xg_raw: hXg,
    away_xg_raw: aXg,
    home_sot_raw: hSot,
    away_sot_raw: aSot,
    home_shots_raw: hShots,
    away_shots_raw: aShots,
    start_time: dados.start_time || "",
    start_date: dados.start_date || "",
    kickoff_ts: dados.ad || 0,
    events: redData.events || [],
  };
}

// =============================================================================
// 7. LEITOR FLASHSCORE HÍBRIDO (FlashscoreReader)
// =============================================================================

export class FlashscoreReader {
  private context: BrowserContext | null;

  constructor(context: BrowserContext | null = null) {
    this.context = context;
  }

  public setContext(context: BrowserContext | null): void {
    this.context = context;
  }

  /**
   * Lê estatísticas de uma partida com estratégia multinível (Meta Instantâneo -> Feed HTTP -> DOM Playwright).
   */
  public async readMatch(
    url: string,
    matchId?: string,
    timeoutMs: number = 15000,
    fallbackCatalogEntry?: any
  ): Promise<MatchState | null> {
    const mId = matchId || extractMatchId(url);
    const rawId = getRawId(mId || url);

    const cEntry = fallbackCatalogEntry;
    const hTeam = cEntry?.home || "?";
    const aTeam = cEntry?.away || "?";
    const lName = cEntry?.league || "";
    const cName = cEntry?.country || "";
    const startTimeStr = cEntry?.kickoff_time_str || "";
    const startDateIso = cEntry?.start_date_iso || "";

    // 1. Consulta metadados oficiais instantâneos (dc_1)
    const meta = rawId ? await fetchFlashscoreFeedMeta(rawId) : null;

    if (meta && meta.is_finished) {
      // Jogo já encerrou oficialmente
      return {
        match_id: mId || rawId || "?",
        home: hTeam,
        away: aTeam,
        league: lName,
        country: cName,
        minute: meta.minute || 90,
        home_score: meta.home_score || 0,
        away_score: meta.away_score || 0,
        status_raw: "FT",
        stage_code: "3",
        period: "FT",
        home_bc: 0, away_bc: 0, home_xgot: 0.0, away_xgot: 0.0, home_xg: 0.0, away_xg: 0.0,
        home_sot: 0, away_sot: 0, home_shots: 0, away_shots: 0, home_xa: 0.0, away_xa: 0.0,
        home_corners: 0, away_corners: 0, home_possession: 50, away_possession: 50,
        home_dangerous_attacks: 0, away_dangerous_attacks: 0, home_attacks: 0, away_attacks: 0,
        home_shots_off_target: 0, away_shots_off_target: 0, home_blocked_shots: 0, away_blocked_shots: 0,
        home_fouls: 0, away_fouls: 0, home_yellow_cards: 0, away_yellow_cards: 0,
        home_red_cards: 0, away_red_cards: 0, home_saves: 0, away_saves: 0,
        all_stats: {},
        start_time: startTimeStr,
        start_date: startDateIso,
        kickoff_ts: 0,
        events: []
      };
    }

    // 2. Tenta extração de estatísticas via Feed HTTP oficial Flashscore
    if (rawId) {
      const feedStats = await fetchFlashscoreFeedStats(rawId);
      if (feedStats && Object.keys(feedStats).length > 0) {
        const feedRed = await fetchFlashscoreFeedIncidents(rawId);
        let hScore = meta ? meta.home_score : (cEntry?.home_score ?? 0);
        let aScore = meta ? meta.away_score : (cEntry?.away_score ?? 0);
        if (feedRed.home_score !== null && feedRed.home_score !== undefined) {
          hScore = feedRed.home_score;
        }
        if (feedRed.away_score !== null && feedRed.away_score !== undefined) {
          aScore = feedRed.away_score;
        }

        let minVal = meta?.minute || (cEntry ? cEntry.minute : 0);
        if (minVal === 0 && feedRed.latest_minute > 0) {
          minVal = feedRed.latest_minute;
        }

        const stVal = meta ? meta.status_str : (feedRed.stage || cEntry?.status || "LIVE");
        const scVal = meta?.stage_code || cEntry?.stage_code || "";
        const [statusRaw, finalMin, stageCodeResolved, period] = resolveMatchStatusAndPeriod(
          stVal,
          minVal,
          scVal,
          meta,
          cEntry
        );

        const dados = {
          title: `${hTeam} ${hScore}-${aScore} ${aTeam}`,
          score_raw: `${hScore}-${aScore}`,
          home_score: hScore,
          away_score: aScore,
          minute: finalMin,
          status_raw: statusRaw,
          stage_code: stageCodeResolved,
          period: period,
          home_team: hTeam,
          away_team: aTeam,
          country: cName,
          league: lName,
          start_time: startTimeStr,
          start_date: startDateIso,
          stats: feedStats
        };
        return buildMatchStateFromStats(dados, feedRed, mId);
      }

      // Se meta confirmou que o jogo NÃO tem aba de estatísticas ('ST' não está em DX), não perde tempo no Playwright
      if (meta && !meta.has_stats) {
        let hScore = meta.home_score;
        let aScore = meta.away_score;
        let minVal = meta.minute;
        const stVal = meta.status_str;
        const feedRed = await fetchFlashscoreFeedIncidents(rawId);
        if (feedRed.home_score !== null && feedRed.home_score !== undefined) {
          hScore = feedRed.home_score;
        }
        if (feedRed.away_score !== null && feedRed.away_score !== undefined) {
          aScore = feedRed.away_score;
        }
        if (feedRed.latest_minute > minVal) {
          minVal = feedRed.latest_minute;
        }

        const scVal = meta.stage_code || cEntry?.stage_code || "";
        const [statusRaw, finalMin, stageCodeResolved, period] = resolveMatchStatusAndPeriod(
          stVal,
          minVal,
          scVal,
          meta,
          cEntry
        );

        const dados = {
          title: `${hTeam} ${hScore}-${aScore} ${aTeam}`,
          score_raw: `${hScore}-${aScore}`,
          home_score: hScore,
          away_score: aScore,
          minute: finalMin,
          status_raw: statusRaw,
          stage_code: stageCodeResolved,
          period: period,
          home_team: hTeam,
          away_team: aTeam,
          country: cName,
          league: lName,
          start_time: startTimeStr,
          start_date: startDateIso,
          stats: {}
        };
        return buildMatchStateFromStats(dados, feedRed, mId);
      }
    }

    // 3. Fallback via Playwright DOM se o contexto estiver disponível
    if (!this.context) {
      if (meta || cEntry) {
        return this.buildFallbackStateFromMeta(meta, cEntry, mId, rawId);
      }
      return null;
    }

    const perStepMs = Math.max(3000, Math.min(timeoutMs, 8000));
    const waitSelectorMs = Math.max(2000, Math.min(timeoutMs, 5000));

    let page: Page | null = null;
    try {
      page = await this.context.newPage();
      page.setDefaultTimeout(perStepMs);

      const statsUrl = ensureStatsUrl(url);
      await page.goto(statsUrl, { waitUntil: "domcontentloaded", timeout: perStepMs });

      // Aceitar cookies
      for (const s of ['button:has-text("ACEITAR")', 'button:has-text("Accept")', '#onetrust-accept-btn-handler']) {
        try {
          const btn = page.locator(s).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            await page.waitForTimeout(200);
            break;
          }
        } catch {
          continue;
        }
      }

      try {
        await page.waitForSelector('[class*="wcl-category"], [class*="statRow"]', {
          timeout: waitSelectorMs,
        });
      } catch {}

      await page.waitForTimeout(400);

      const rawJson = await page.evaluate<string>(_JS_EXTRACTION_SCRIPT);
      let dados: Record<string, any> = {};
      try {
        dados = JSON.parse(rawJson);
      } catch {
        dados = {};
      }

      let redData: Record<string, any> = { home_red: 0, away_red: 0, events: [] };
      try {
        const redRaw = await page.evaluate<string>(SCRIPT_RED_CARDS);
        redData = JSON.parse(redRaw);
      } catch {}

      // Preencher com metadados/catalog caso DOM retorne vazio
      if (meta) {
        if (dados.home_score === undefined && meta.home_score !== undefined) {
          dados.home_score = meta.home_score;
          dados.away_score = meta.away_score;
        }
        const domMin = dados.minute || 0;
        const domStatus = dados.status_raw || "";
        const domSc = meta.stage_code || cEntry?.stage_code || "";
        const [statusRaw, finalMin, scVal, period] = resolveMatchStatusAndPeriod(
          domStatus || meta.status_str,
          domMin || meta.minute,
          domSc,
          meta,
          cEntry
        );
        dados.status_raw = statusRaw;
        dados.minute = finalMin;
        dados.stage_code = scVal;
        dados.period = period;
      } else if (cEntry) {
        const [statusRaw, finalMin, scVal, period] = resolveMatchStatusAndPeriod(
          dados.status_raw || cEntry.status,
          dados.minute || cEntry.minute,
          cEntry.stage_code,
          undefined,
          cEntry
        );
        dados.status_raw = statusRaw;
        dados.minute = finalMin;
        dados.stage_code = scVal;
        dados.period = period;
      }

      if (rawId) {
        try {
          const feedInc = await fetchFlashscoreFeedIncidents(rawId);
          if (feedInc && feedInc.events && feedInc.events.length > 0) {
            const existingIds = new Set((redData.events || []).map((e: any) => e.id));
            for (const fe of feedInc.events) {
              if (!existingIds.has(fe.id)) {
                redData.events = redData.events || [];
                redData.events.push(fe);
              }
            }
            if (feedInc.home_red > (redData.home_red || 0)) {
              redData.home_red = feedInc.home_red;
            }
            if (feedInc.away_red > (redData.away_red || 0)) {
              redData.away_red = feedInc.away_red;
            }
          }
        } catch {}
      }

      if (!dados.stats && rawId) {
        const feedStats = await fetchFlashscoreFeedStats(rawId);
        if (feedStats) dados.stats = feedStats;
      }

      return buildMatchStateFromStats(dados, redData, mId);
    } catch {
      if (meta || cEntry) {
        return this.buildFallbackStateFromMeta(meta, cEntry, mId, rawId);
      }
      return null;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
    }
  }

  private async buildFallbackStateFromMeta(
    meta: any,
    cEntry: any,
    matchId: string,
    rawId: string
  ): Promise<MatchState> {
    const hTeam = meta?.home || cEntry?.home || "?";
    const aTeam = meta?.away || cEntry?.away || "?";
    const lName = cEntry?.league || "";
    const cName = cEntry?.country || "";
    const startTimeStr = cEntry?.kickoff_time_str || "";
    const startDateIso = cEntry?.start_date_iso || "";

    const hScore = meta?.home_score ?? cEntry?.home_score ?? 0;
    const aScore = meta?.away_score ?? cEntry?.away_score ?? 0;
    const minVal = meta?.minute ?? cEntry?.minute ?? 0;
    const stVal = meta?.status_str ?? cEntry?.status ?? "LIVE";
    const scVal = meta?.stage_code || cEntry?.stage_code || "";

    const [statusRaw, finalMin, scResolved, period] = resolveMatchStatusAndPeriod(
      stVal,
      minVal,
      scVal,
      meta,
      cEntry
    );

    let feedStats: Record<string, any> = {};
    if (rawId) {
      try {
        const stats = await fetchFlashscoreFeedStats(rawId);
        if (stats && Object.keys(stats).length > 0) {
          feedStats = stats;
        }
      } catch {}
    }

    const dados = {
      title: `${hTeam} ${hScore}-${aScore} ${aTeam}`,
      score_raw: `${hScore}-${aScore}`,
      home_score: hScore,
      away_score: aScore,
      minute: finalMin,
      status_raw: statusRaw,
      stage_code: scResolved,
      period: period,
      home_team: hTeam,
      away_team: aTeam,
      country: cName,
      league: lName,
      start_time: startTimeStr,
      start_date: startDateIso,
      stats: feedStats,
    };

    let feedRed: Record<string, any> = { home_red: 0, away_red: 0, events: [] };
    if (rawId) {
      try {
        feedRed = await fetchFlashscoreFeedIncidents(rawId);
      } catch {}
    }

    return buildMatchStateFromStats(dados, feedRed, matchId);
  }
}
