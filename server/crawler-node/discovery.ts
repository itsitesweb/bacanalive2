// server/crawler-node/discovery.ts
/**
 * Motor de Descoberta de Partidas via Playwright Node & Fallback HTTP (server/crawler-node/discovery.ts)
 * Portado 1:1 de discover_live_games, parse_feed_text_to_live_matches e scripts DOM de bridge_web.py.
 */

import { chromium, type BrowserContext, type Page } from "playwright";
import * as path from "path";
import { DiscoveredMatch } from "./types";
import { MatchCatalogManager, isTierAllowed } from "./catalog";
import { getLeagueTier } from "../../src/utils/leagueTier";

// =============================================================================
// 1. SCRIPTS JAVASCRIPT COPIADOS 1:1 DO BRIDGE_WEB.PY (NENHUMA ALTERAÇÃO INTERNA)
// =============================================================================

export const _JS_CLICK_AO_VIVO = `
() => {
  const directLiveSelectors = [
    '.filters__tab[data-analytics-alias="live"]',
    '[data-analytics-alias="live"]',
    '[class*="filters__tab"][data-value="live"]',
    '.filter__filter[data-value="live"]',
    '[class*="filter__filter"][data-value="live"]',
    '.tab__tab[data-value="live"]'
  ];
  for (const sel of directLiveSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.click();
      return true;
    }
  }

  const allTabs = document.querySelectorAll(
    '.filters__tab, [class*="filters__tab"], [class*="filters__text"], .filter__filter, [class*="filter__filter"], [role="tab"], button, a, span'
  );
  for (const t of allTabs) {
    const txt = (t.textContent || '').trim().toLowerCase();
    if (txt === 'ao vivo' || txt === 'live' || txt.startsWith('ao vivo') || txt.startsWith('live')) {
      const btn = t.closest('button, a, [role="tab"], .filters__tab, .filter__filter, div') || t;
      btn.click();
      return true;
    }
  }
  return false;
}
`;

export const _JS_EXPAND_LEAGUES = `
() => {
  document.querySelectorAll('[class*="event__expander"], [class*="wcl-scores"]').forEach(el => {
    const p = el.closest('[class*="leagues--live"], [class*="sportName"]');
    if (p) p.click();
  });
  document.querySelectorAll('span').forEach(s => {
    if (/exibir jogos?/i.test(s.textContent)) {
      const clickable = s.closest('[role="button"], a, [class*="event__expander"]') || s.parentElement;
      if (clickable) clickable.click();
    }
  });
}
`;

export const _JS_EXTRACT_ALL_MATCH_URLS = `
() => {
  const matches = [];
  const seen = new Set();

  // Modern Flashscore DOM parser for Live matches
  const matchElements = document.querySelectorAll('[id^="g_1_"], .event__match, [class*="event__match"]');
  matchElements.forEach(el => {
    let rawId = (el.id || '').replace(/^g_1_/, '').trim();
    if (!rawId) {
      const idAttr = el.getAttribute('id') || '';
      if (idAttr.startsWith('g_1_')) rawId = idAttr.substring(4);
    }
    if (!rawId) {
      const link = el.querySelector('a[href*="/jogo/"], a[href*="/match/"]');
      if (link) {
        const hrefMatch = (link.getAttribute('href') || '').match(/\\/(?:jogo|match)\\/([A-Za-z0-9]+)/);
        if (hrefMatch) rawId = hrefMatch[1];
      }
    }
    if (!rawId || rawId.length < 5 || seen.has(rawId)) return;
    seen.add(rawId);

    const homeEl = el.querySelector('.event__homeParticipant, .event__participant--home, [class*="homeParticipant"], [class*="participant--home"], [class*="participantHome"]');
    const awayEl = el.querySelector('.event__awayParticipant, .event__participant--away, [class*="awayParticipant"], [class*="participant--away"], [class*="participantAway"]');
    const homeScoreEl = el.querySelector('.event__score--home, [class*="score--home"], [class*="scoreHome"]');
    const awayScoreEl = el.querySelector('.event__score--away, [class*="score--away"], [class*="scoreAway"]');
    const stageEl = el.querySelector('.event__stage--block, .event__time, [class*="stage--block"], [class*="event__stage"], [class*="stage--live"]');

    const home = homeEl ? (homeEl.textContent || '').trim() : '';
    const away = awayEl ? (awayEl.textContent || '').trim() : '';
    const hScore = homeScoreEl ? parseInt((homeScoreEl.textContent || '0').trim(), 10) || 0 : 0;
    const aScore = awayScoreEl ? parseInt((awayScoreEl.textContent || '0').trim(), 10) || 0 : 0;
    const stage = stageEl ? (stageEl.textContent || '').trim() : '';

    // Filtrar partidas que já terminaram ou estão agendadas
    const isFinished = el.classList.contains('event__match--finished') ||
                       el.classList.contains('event__match--scheduled') ||
                       /encerrado|terminado|fim|finished|ft\\b|ap\\b|pen\\b/i.test(stage) ||
                       /adiado|cancelado|postponed|cancelled/i.test(stage);
    if (isFinished) return;

    let minute = 0;
    const isHt = /intervalo|half[- ]?time|\\bint\\b|\\bht\\b|descanso/i.test(stage);
    const mDigits = stage.match(/\\b(\\d{1,3})\\b/);
    if (mDigits) {
      minute = parseInt(mDigits[1], 10);
    } else if (stage.includes('1T') || stage.includes('1H')) {
      minute = 25;
    } else if (isHt || stage.includes('HT')) {
      minute = 45;
    } else if (stage.includes('2T') || stage.includes('2H')) {
      minute = 70;
    }

    if (isHt) {
      minute = 45;
    }

    if (minute > 120) return;

    const isLive = el.classList.contains('event__match--live') || 
                   stage.includes("'") || 
                   minute > 0 || 
                   stage.includes('1T') || stage.includes('2T') || stage.includes('HT') ||
                   isHt;

    if (!isLive) return;

    matches.push({
      mid: 'FS_' + rawId,
      url: 'https://www.flashscore.com.br/jogo/' + rawId,
      home: home,
      away: away,
      home_score: hScore,
      away_score: aScore,
      minute: minute,
      stage: isHt ? '38' : (stage || 'LIVE'),
      status: isHt ? 'HT' : (stage || 'LIVE'),
      stage_code: isHt ? '38' : '',
      is_live: isLive
    });
  });

  return matches;
}
`;

export const _JS_EXTRACT_LEAGUE_META = `
() => {
  const hasClass = (el, subs) => {
    if (!el) return false;
    const c = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
    return subs.some(s => c.indexOf(s.toLowerCase()) !== -1);
  };
  const STAR_SUBSTR = [
    'headerleague--has-star', 'headerleague--star',
    'wcl-pinned', 'is-pinned',
    'is-favourite-league', 'favourite-league',
    'is-favorite-league', 'favorite-league',
    'is-highlighted', 'wcl-ishighlighted'
  ];

  const titleCase = (s) => {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const parseLeagueHeader = (wrapper) => {
    let titleEl = wrapper.querySelector('[class*="headerLeague__title-text"]');
    if (!titleEl) {
      const candidates = wrapper.querySelectorAll('[class*="headerLeague__title"]');
      for (const el of candidates) {
        const cls = (typeof el.className === 'string') ? el.className : '';
        if (cls.toLowerCase().indexOf('wrapper') === -1) { titleEl = el; break; }
      }
    }
    const catEl = wrapper.querySelector(
      '[class*="headerLeague__category"], [class*="headerLeague__meta"]'
    );
    let league = titleEl ? (titleEl.textContent || '').trim() : '';
    let country = catEl ? (catEl.textContent || '').replace(/[:\\s]+$/, '').trim() : '';

    if (!league) {
      const fullTxt = (wrapper.textContent || '').trim().replace(/\\s+/g, ' ');
      const m = fullTxt.match(/^(.+?)\\s*([A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝ]{3,})\\s*:/);
      if (m) {
        league = m[1].trim();
        if (!country) country = m[2].trim();
      } else {
        league = fullTxt.slice(0, 80);
      }
    }
    if (country) country = titleCase(country);

    if (league) {
      league = league.replace(
        /\\s*[A-ZÁÀÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝ]{3,}\\s*:?\\s*$/, ''
      ).trim();
    }

    const css = [];
    const pushCls = (el) => {
      if (el && typeof el.className === 'string') {
        el.className.split(/\\s+/).forEach(c => { if (c) css.push(c); });
      }
    };
    pushCls(wrapper);
    wrapper.querySelectorAll('*').forEach(pushCls);

    const star = css.some(c =>
      STAR_SUBSTR.some(s => c.toLowerCase().indexOf(s) !== -1)
    );

    let yellow = star;
    if (!yellow && window.getComputedStyle) {
      try {
        const cs = window.getComputedStyle(wrapper);
        const m = (cs.backgroundColor || '').match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
        if (m) {
          const r = +m[1], g = +m[2], b = +m[3];
          if (r >= 220 && g >= 180 && b <= 120) yellow = true;
        }
      } catch (e) {}
    }

    return {
      league_name: league,
      country: country,
      css_classes: css,
      star_detected: star,
      yellow_bg_detected: yellow,
      header_text: (wrapper.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 200),
    };
  };

  const result = {};
  const stats = { total_links: 0 };
  const containers = document.querySelectorAll('[class*="sportName"]');

  for (const container of containers) {
    let currentLeague = null;
    for (const child of container.children) {
      if (hasClass(child, ['headerLeague__wrapper', 'headerLeague'])) {
        currentLeague = parseLeagueHeader(child);
        continue;
      }
      if (hasClass(child, ['event__match'])) {
        const rawId = (child.id || '').replace(/^g_1_/, '').trim();
        if (rawId && currentLeague) {
          result['FS_' + rawId] = Object.assign({header_found: true}, currentLeague);
        }
      }
    }
  }

  return {result: result, stats: stats};
}
`;

// =============================================================================
// 2. ORQUESTRAÇÃO PLAYWRIGHT NODE & BLOQUEIO SELETIVO DE RECURSOS
// =============================================================================

/**
 * Cria ou inicializa um Persistent Browser Context com as configurações do bridge_web.py
 */
export async function createPersistentBrowserContext(options?: {
  userDataDir?: string;
  headless?: boolean;
  locale?: string;
}): Promise<BrowserContext> {
  const browserDir =
    options?.userDataDir || path.resolve(process.cwd(), "data", ".browser_data");

  return await chromium.launchPersistentContext(browserDir, {
    headless: options?.headless ?? true,
    locale: options?.locale || "pt-BR",
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

/**
 * Bloqueia seletivamente imagens, fontes e arquivos de mídia para acelerar o carregamento do Flashscore.
 */
export async function setupResourceBlocking(context: BrowserContext): Promise<void> {
  try {
    await context.route(
      "**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,ttf,otf,mp4,mp3}",
      async (route) => {
        const type = route.request().resourceType();
        if (type === "image" || type === "font" || type === "media") {
          await route.abort().catch(() => {});
        } else {
          await route.continue().catch(() => {});
        }
      }
    );
    console.log("🚀 [Playwright] Bloqueador seletivo de imagens, fontes e mídias ativado!");
  } catch (err: any) {
    console.warn("ℹ️ Route blocker warning:", err?.message || err);
  }
}

/**
 * Aceita cookies automaticamente se modal for exibido.
 */
export async function acceptCookies(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("ACEITAR")',
    'button:has-text("Accept")',
    '#onetrust-accept-btn-handler',
    'button:has-text("Aceitar tudo")',
  ];
  for (const s of selectors) {
    try {
      const btn = page.locator(s).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      continue;
    }
  }
}

// =============================================================================
// 3. DECODIFICADOR DO FEED FLASHSCORE (~ZA÷ / ~AA÷) & FALLBACK HTTP
// =============================================================================

export function parseFeedTextToLiveMatches(text: string): DiscoveredMatch[] {
  if (!text || !text.includes("~ZA÷")) {
    return [];
  }

  const liveMatches: DiscoveredMatch[] = [];
  const seen = new Set<string>();
  const nowEpoch = Math.floor(Date.now() / 1000);

  const sections = text.split("~ZA÷");
  for (const sec of sections.slice(1)) {
    const rawHeader = sec.split("~AA÷")[0] || "";
    const headerLine = (rawHeader.split("¬")[0] || "").trim();

    // 1. Extração de País e Liga separados
    let cName = "Internacional";
    const cMatch = rawHeader.match(/¬ZY÷([^¬]+)/);
    if (cMatch) {
      cName = cMatch[1].trim();
    } else if (headerLine.includes(":")) {
      cName = headerLine.split(":")[0].trim();
      cName = cName.charAt(0).toUpperCase() + cName.slice(1).toLowerCase();
    }

    let lName = "Geral";
    if (headerLine.includes(":")) {
      lName = headerLine.split(":").slice(1).join(":").trim();
    } else {
      lName = headerLine || "Geral";
    }

    if (lName.toLowerCase().startsWith(cName.toLowerCase() + ":")) {
      lName = lName.substring(cName.length + 1).trim();
    }

    const matchBlocks = sec.split("~AA÷");
    for (const mb of matchBlocks.slice(1)) {
      const midMatch = mb.match(/^([A-Za-z0-9]+)/);
      if (!midMatch) continue;

      const rawId = midMatch[1];
      if (seen.has(rawId)) continue;

      const statusCodeMatch = mb.match(/¬AB÷(\d+)/);
      const statusCode = statusCodeMatch ? statusCodeMatch[1] : "0";

      const stageMatch = mb.match(/¬AC÷([^¬]+)/);
      const stageCode = stageMatch ? stageMatch[1].trim() : "";

      // No Flashscore: AB=2 é partida AO VIVO, AC=38 é Intervalo/Halftime.
      if (
        (statusCode !== "2" && statusCode !== "38" && stageCode !== "38") ||
        ["3", "16", "17", "18", "19", "20", "21"].includes(stageCode)
      ) {
        continue;
      }

      const homeMatch = mb.match(/¬AE÷([^¬]+)/);
      const awayMatch = mb.match(/¬AF÷([^¬]+)/);
      const home = homeMatch ? homeMatch[1].trim() : "";
      const away = awayMatch ? awayMatch[1].trim() : "";

      if (!home || !away) continue;
      seen.add(rawId);

      const hScoreMatch = mb.match(/¬AG÷(\d+)/);
      const aScoreMatch = mb.match(/¬AH÷(\d+)/);
      const hScore = hScoreMatch ? parseInt(hScoreMatch[1], 10) : 0;
      const aScore = aScoreMatch ? parseInt(aScoreMatch[1], 10) : 0;

      const adMatch = mb.match(/¬AD÷(\d+)/) || mb.match(/¬ADE÷(\d+)/);
      const aoMatch = mb.match(/¬AO÷(\d+)/);
      const adVal = adMatch ? parseInt(adMatch[1], 10) : 0;
      const aoVal = aoMatch ? parseInt(aoMatch[1], 10) : 0;

      let minute = 1;
      let statusStr = "LIVE";

      const effectiveStart = aoVal > 0 ? aoVal : adVal;

      if (stageCode === "12") {
        const elapsed = effectiveStart > 0 ? Math.floor((nowEpoch - effectiveStart) / 60) : 1;
        if (elapsed > 45) {
          minute = 45;
          statusStr = "1H";
        } else {
          minute = Math.max(1, elapsed);
          statusStr = "1H";
        }
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

      let startTimeStr = "";
      let startDateIso = "";
      if (adVal > 0) {
        try {
          const dt = new Date(adVal * 1000);
          startTimeStr = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
          startDateIso = dt.toISOString();
        } catch {}
      }

      liveMatches.push({
        mid: `FS_${rawId}`,
        url: `https://www.flashscore.com.br/jogo/${rawId}`,
        league: lName,
        country: cName,
        home: home,
        away: away,
        home_score: hScore,
        away_score: aScore,
        minute: minute,
        stage: statusStr,
        status: statusStr,
        stage_code: stageCode,
        ad: adVal,
        ao: aoVal,
        st_str: startTimeStr,
        sd_iso: startDateIso,
        is_live: true,
      });
    }
  }

  return liveMatches;
}

/**
 * Fallback ultra-rápido e robusto via feed HTTP oficial do Flashscore com suporte a contexto Chromium ou conexão direta.
 */
export async function httpFallbackDiscoverLive(page?: Page | null): Promise<DiscoveredMatch[]> {
  // 1. Se page (Playwright) estiver aberto, tentar extrair diretamente do contexto interno do navegador (livre de bloqueios)
  if (page) {
    try {
      const jsFetch = `async () => {
        try {
          const res = await fetch('https://www.flashscore.com.br/x/feed/f_1_0_3_pt-br_1', {
            headers: { 'x-fsign': 'SW9D1eZo' }
          });
          if (res.ok) return await res.text();
          return '';
        } catch (e) {
          return '';
        }
      }`;
      const feedText = await page.evaluate<string>(jsFetch);
      if (feedText && feedText.includes("~ZA÷")) {
        const matches = parseFeedTextToLiveMatches(feedText);
        if (matches.length > 0) {
          console.log(`📡 [Discovery Feed Navegador] ${matches.length} partidas AO VIVO capturadas via sessão Playwright.`);
          return matches;
        }
      }
    } catch {
      // Ignora e continua para o fetch direto
    }
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "x-fsign": "SW9D1eZo",
    Referer: "https://www.flashscore.com.br/",
  };

  const feedUrls = [
    "https://www.flashscore.com.br/x/feed/f_1_0_3_pt-br_1",
    "https://www.flashscore.com/x/feed/f_1_0_3_en-gb_1",
    "https://www.flashscore.com/x/feed/f_1_0_1_en-gb_1",
    "https://www.flashscore.com.br/x/feed/f_1_1_3_pt-br_1",
  ];

  for (const u of feedUrls) {
    try {
      const res = await fetch(u, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes("~ZA÷")) {
          const matches = parseFeedTextToLiveMatches(text);
          if (matches.length > 0) {
            console.log(`📡 [Discovery Feed HTTP] ${matches.length} partidas AO VIVO catalogadas via ${u}`);
            return matches;
          }
        }
      }
    } catch (err: any) {
      console.warn(`ℹ️ [Discovery Feed] Falha no feed ${u}:`, err?.message || err);
      continue;
    }
  }

  return [];
}

// =============================================================================
// 4. FUNÇÃO PRINCIPAL DE DESCOBERTA (discoverLiveGames)
// =============================================================================

export async function discoverLiveGames(
  context: BrowserContext,
  baseUrl: string = "https://www.flashscore.com.br/",
  cookieAcceptFn?: (page: Page) => Promise<void>,
  timeoutMs: number = 12000
): Promise<DiscoveredMatch[]> {
  let page: Page | null = null;
  try {
    page = await context.newPage();

    let targetUrl = baseUrl.replace(/\/+$/, "");
    if (targetUrl.endsWith("/ao-vivo") || targetUrl.endsWith("/live")) {
      targetUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/"));
    }
    if (!targetUrl.endsWith(".br") && !targetUrl.endsWith(".com") && !targetUrl.endsWith("/futebol")) {
      targetUrl = `${targetUrl}/`;
    }

    let resp = null;
    try {
      resp = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    } catch {
      try {
        resp = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      } catch {
        // Silencioso
      }
    }

    if (resp && resp.status() === 404) {
      try {
        await page.goto("https://www.flashscore.com.br/", {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });
      } catch {
        // Silencioso
      }
    }

    if (cookieAcceptFn) {
      try {
        await cookieAcceptFn(page);
      } catch {}
    } else {
      try {
        await acceptCookies(page);
      } catch {}
    }

    try {
      await page.waitForSelector(
        '.filters__tab, .filter__filter, .tab__tab, [class*="event__match"], [id^="g_1_"]',
        { timeout: 4000, state: "attached" }
      );
      await page.evaluate(_JS_CLICK_AO_VIVO);
      await page.waitForTimeout(500);
    } catch {}

    try {
      await page.evaluate(_JS_EXPAND_LEAGUES);
      await page.waitForTimeout(400);
    } catch {}

    let domMatches: DiscoveredMatch[] = [];
    try {
      domMatches = (await page.evaluate<DiscoveredMatch[]>(_JS_EXTRACT_ALL_MATCH_URLS)) || [];
    } catch {}

    let leagueMeta: Record<string, any> = {};
    try {
      const walkerResult = await page.evaluate<{ result?: Record<string, any> }>(_JS_EXTRACT_LEAGUE_META);
      leagueMeta = walkerResult?.result || {};
    } catch {}

    const enrichedMatches: DiscoveredMatch[] = [];
    for (const m of domMatches) {
      const mid = m.mid || "";
      const meta = leagueMeta[mid] || {};
      const l_name = meta.league_name || m.league || "FlashScore Live";
      const c_name = meta.country || m.country || "Internacional";

      if (m.home && m.away) {
        m.league = l_name;
        m.country = c_name;
        enrichedMatches.push(m);
      }
    }

    if (enrichedMatches.length === 0) {
      console.log("ℹ️ [Discovery] 0 jogos no DOM. Acionando contingência HTTP feed...");
      const fb = await httpFallbackDiscoverLive(page);
      if (fb.length > 0) return fb;
    } else if (enrichedMatches.length < 15) {
      // Se encontrou poucos jogos no DOM, mescla com o feed oficial para cobrir todo o catálogo mundial
      const fb = await httpFallbackDiscoverLive(page);
      if (fb.length > 0) {
        const seenMids = new Set(enrichedMatches.map((m) => m.mid).filter(Boolean));
        for (const item of fb) {
          if (!seenMids.has(item.mid)) {
            enrichedMatches.push(item);
            seenMids.add(item.mid);
          }
        }
        console.log(`✨ [Discovery Híbrido] DOM + Feed combinados: ${enrichedMatches.length} partidas AO VIVO.`);
      }
    }

    return enrichedMatches;
  } catch (err: any) {
    console.warn(`⚠️ [Discovery DOM Exception]: ${err?.message || err}. Usando contingência HTTP...`);
    return await httpFallbackDiscoverLive(page);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

/**
 * Processa e insere partidas descobertas no catálogo, respeitando regras de filtros de ligas e tiers.
 */
export async function processAndCatalogMatches(
  catalogMgr: MatchCatalogManager,
  matchesList: DiscoveredMatch[],
  opCfg: Record<string, any> = {},
  dismissedIds: Set<string> = new Set()
): Promise<number> {
  if (!matchesList || matchesList.length === 0) return 0;

  let accepted = 0;
  for (const item of matchesList) {
    const mid = item.mid;
    if (!mid || dismissedIds.has(mid)) continue;

    const url = item.url;
    const l_name = item.league || "";
    const c_name = item.country || "";
    const home = item.home || "";
    const away = item.away || "";
    const h_score = item.home_score || 0;
    const a_score = item.away_score || 0;
    const minute = item.minute || 0;
    const status = item.status || "LIVE";
    const ad_val = item.ad || 0;
    const ao_val = item.ao || 0;
    const stage_code = item.stage_code || "";
    const st_str = item.st_str || "";
    const sd_iso = item.sd_iso || "";

    const l_tier = getLeagueTier(l_name, c_name);
    if (!isTierAllowed(l_tier, opCfg)) {
      continue;
    }

    catalogMgr.upsertDiscovered(
      mid,
      url,
      l_name,
      c_name,
      home,
      away,
      h_score,
      a_score,
      minute,
      status,
      ad_val,
      ao_val,
      stage_code,
      st_str,
      sd_iso
    );
    accepted++;
  }

  catalogMgr.pruneStale(opCfg.autoPruneMinutes || 30);
  await catalogMgr.save();
  return accepted;
}

export async function fetchDismissedMatches(
  localServerUrl: string = "http://127.0.0.1:3000"
): Promise<Set<string>> {
  try {
    const res = await fetch(`${localServerUrl}/api/crawler/dismissed-matches`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (Array.isArray(data?.dismissedMatchIds)) {
        return new Set(data.dismissedMatchIds);
      }
    }
  } catch {}
  return new Set();
}
