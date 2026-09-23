// server/crawler-node/index.ts
/**
 * Motor Crawler Unificado em Node.js (server/crawler-node/index.ts)
 * Portado 1:1 de bridge_web.py para execução nativa em Node.js / TypeScript.
 * Fonte ÚNICA e EXCLUSIVA: Flashscore (Playwright DOM + Feeds HTTP oficiais resilientes).
 */

import * as path from "path";
import * as fs from "fs";
import { chromium, BrowserContext } from "playwright";
import { MatchCatalogManager, isTierAllowed } from "./catalog";
import { Dispatcher, defaultDispatcher } from "./dispatch";
import {
  discoverLiveGames,
  httpFallbackDiscoverLive,
  acceptCookies,
  setupResourceBlocking,
} from "./discovery";
import { FlashscoreReader, isIgnoredMatch } from "./extractors";
import { fetchDismissedMatches } from "./discovery";
import { resolveMatchStatusAndPeriod } from "./statusResolver";
import { CrawlerConfig, WebhookMatchPayload } from "./types";
import { getLeagueTier } from "../../src/utils/leagueTier";

export const LOCAL_SERVER_URL =
  process.env.BACANALIVE_LOCAL_URL || "http://127.0.0.1:3000";
export const DASHBOARD_WEBHOOK =
  process.env.BACANALIVE_WEBHOOK_URL ||
  `${LOCAL_SERVER_URL}/api/crawler/webhook/flashscore-live`;
export const WEBHOOK_SECRET =
  process.env.BACANALIVE_WEBHOOK_SECRET || "sec_flashscore_982a17f";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_CACHE_PATH = path.join(DATA_DIR, "bacanalive_config.json");
const PERSISTENCE_FILE = path.join(DATA_DIR, "bacanalive_catalog.json");

export function getDefaultCrawlerConfig(): CrawlerConfig {
  return {
    mode: "both",
    maxWatchlistSize: 15,
    concurrentWorkers: 4,
    discoveryIntervalSeconds: 180,
    tier3ReservedSlots: 2,
    minEntryMinute: 20,
    maxEntryMinute: 83,
    antiSpamCooldownMinutes: 5,
    autoPruneMinutes: 30,
    noStatsBackoffMinutes: 10,
    matchReadTimeoutMs: 5000,
    discoveryTimeoutMs: 12000,
    routeResourceBlock: true,
    enableBackgroundDiscovery: true,
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
  };
}

export async function fetchOperationalCrawlerConfig(
  localServerUrl: string = LOCAL_SERVER_URL
): Promise<CrawlerConfig> {
  const defaults = getDefaultCrawlerConfig();

  const mergeConfig = (incoming: any) => {
    if (!incoming || typeof incoming !== "object") return;
    if (incoming.tierFilter && typeof incoming.tierFilter === "object") {
      Object.assign(defaults.tierFilter, incoming.tierFilter);
    }
    for (const [k, v] of Object.entries(incoming)) {
      if (k !== "tierFilter" && v !== undefined && v !== null) {
        (defaults as any)[k] = v;
      }
    }
  };

  // 1. Tenta carregar do endpoint /api/crawler/config
  try {
    const res = await fetch(`${localServerUrl}/api/crawler/config`, {
      signal: AbortSignal.timeout(800),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data?.crawlerConfig) {
        mergeConfig(data.crawlerConfig);
        return defaults;
      }
    }
  } catch {}

  // 2. Fallback para /api/rules/config
  try {
    const res = await fetch(`${localServerUrl}/api/rules/config`, {
      signal: AbortSignal.timeout(800),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const cConf = data?.config?.crawlerConfig;
      if (cConf) {
        mergeConfig(cConf);
        return defaults;
      }
    }
  } catch {}

  // 3. Fallback para arquivo JSON em disco
  try {
    if (fs.existsSync(CONFIG_CACHE_PATH)) {
      const content = fs.readFileSync(CONFIG_CACHE_PATH, "utf-8");
      const data = JSON.parse(content);
      const cConf = data?.operationalConfig?.crawlerConfig;
      if (cConf) {
        mergeConfig(cConf);
      }
    }
  } catch {}

  return defaults;
}

/**
 * Motor Unificado de Descoberta e Varredura Contínua de Jogos.
 */
export class UnifiedCrawlerEngine {
  private catalogMgr: MatchCatalogManager;
  private dispatcher: Dispatcher;
  private isRunning: boolean = false;
  private browserContext: BrowserContext | null = null;
  private reader: FlashscoreReader;
  private lastDiscoveryTime: number = 0;
  private isDiscovering: boolean = false;
  private lastForcedRefreshTime: number = 0;
  private cycleCount: number = 0;

  constructor(options?: {
    catalogMgr?: MatchCatalogManager;
    dispatcher?: Dispatcher;
  }) {
    this.catalogMgr =
      options?.catalogMgr ||
      new MatchCatalogManager(PERSISTENCE_FILE, true);
    this.dispatcher = options?.dispatcher || defaultDispatcher;
    this.reader = new FlashscoreReader(null);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("=".repeat(78));
    console.log("🚀 BacanaLive Node Crawler — Motor Unificado TypeScript");
    console.log(`📡 Webhook Destino: ${this.dispatcher.webhookUrl}`);
    console.log(`⚙️ Config Local Sync: ${this.dispatcher.localServerUrl}/api/rules/config`);
    console.log(`🆔 Node Session ID: ${this.dispatcher.sessionId}`);
    console.log("=".repeat(78));

    // Notifica reset inicial e zera catálogo em disco
    console.log("🧹 [Crawler Startup] Reinicialização detectada: zerando catálogo em disco, cache TTL e grade no servidor...");
    this.catalogMgr.clearAll();
    await this.dispatcher.notifyCrawlerStartupReset();
    console.log("✨ [Crawler Startup] Começando do ZERO: Grade, catálogo e cache 100% limpos para nova descoberta!");

    this.dispatcher.start();
    this.dispatcher.setActiveMatchesProvider(
      () => this.catalogMgr.getActiveCount()
    );

    // Inicialização do navegador Playwright
    let hasPlaywright = false;
    try {
      const userDataDir = path.join(DATA_DIR, "playwright_profile");
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      this.browserContext = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        locale: "pt-BR",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--blink-settings=imagesEnabled=false",
        ],
      });

      this.reader.setContext(this.browserContext);
      hasPlaywright = true;
      console.log("✅ Motor Nativo Playwright Carregado com Sucesso!");
    } catch (pwErr: any) {
      console.warn(
        `ℹ️ Playwright indisponível ou falhou ao abrir navegador (${pwErr?.message}). Operando via feeds HTTP oficiais Flashscore ultra-rápidos.`
      );
      hasPlaywright = false;
    }

    // Mesmo sem Playwright navegador, executamos o loop nativo do Flashscore (descoberta via feed HTTP oficial + leitor com estatísticas e incidentes)
    await this.runPlaywrightLoop();
  }

  public getStatus(): {
    isRunning: boolean;
    cycleCount: number;
    catalogCount: number;
    activeCount: number;
    queueLength: number;
    lastDiscoveryTime: number;
  } {
    return {
      isRunning: this.isRunning,
      cycleCount: this.cycleCount,
      catalogCount: this.catalogMgr.count(),
      activeCount: this.catalogMgr.getActiveCount(),
      queueLength: this.dispatcher.getQueueLength(),
      lastDiscoveryTime: this.lastDiscoveryTime,
    };
  }

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log("\n🛑 Sinal de encerramento recebido. Finalizando Node Crawler...");

    try {
      await this.dispatcher.notifyCrawlerShutdown();
      await this.dispatcher.stop();
    } catch {}

    if (this.browserContext) {
      try {
        await this.browserContext.close();
        this.browserContext = null;
      } catch {}
    }
    console.log("👋 Node Crawler finalizado com segurança.");
  }

  public async restart(): Promise<void> {
    console.log("🔄 [UnifiedCrawlerEngine] Reiniciando motor Node.js...");
    await this.stop();
    await new Promise((r) => setTimeout(r, 600));
    this.catalogMgr.clearAll();
    this.start().catch((e) => {
      console.error("⚠️ [Node Crawler Worker Error on Restart]:", e?.message || e);
    });
  }

  private async runPlaywrightLoop(): Promise<void> {
    let cfg = await fetchOperationalCrawlerConfig(this.dispatcher.localServerUrl);

    if (cfg.routeResourceBlock && this.browserContext) {
      try {
        await setupResourceBlocking(this.browserContext);
        console.log("🚀 [Playwright] Bloqueador seletivo de imagens, fontes e mídias ativado!");
      } catch (err: any) {
        console.warn(`ℹ️ Route blocker: ${err?.message}`);
      }
    }

    // Executa descoberta inicial
    await this.performDiscovery();

    this.lastForcedRefreshTime = Date.now() / 1000;

    while (this.isRunning) {
      try {
        cfg = await fetchOperationalCrawlerConfig(this.dispatcher.localServerUrl);

        const activeCount = this.catalogMgr.getActiveCount();
        const discInterval = activeCount === 0 ? 15.0 : cfg.discoveryIntervalSeconds || 180;
        const nowSec = Date.now() / 1000;

        if (nowSec - this.lastDiscoveryTime > discInterval) {
          await this.performDiscovery();
        }

        // Re-varredura forçada de todas as partidas ativas a cada 180s
        if (nowSec - this.lastForcedRefreshTime >= 180) {
          console.log("\n🔄 [Re-varredura 180s] Forçando re-varredura em background de todas as partidas da grade (sem reload no app)...");
          for (const entry of Object.values(this.catalogMgr.matches)) {
            if (!entry.is_finished) {
              entry.last_scanned_at = 0.0;
            }
          }
          this.lastForcedRefreshTime = Date.now() / 1000;
        }

        const watchlistItems = this.catalogMgr.selectWatchlistByTiers(
          cfg.maxWatchlistSize || 15,
          cfg.tier3ReservedSlots || 2,
          cfg.minEntryMinute || 20,
          cfg.maxEntryMinute || 83,
          cfg.antiSpamCooldownMinutes || 5,
          cfg.tierFilter
        );

        if (watchlistItems.length === 0) {
          const nowT = Date.now() / 1000;
          let minRem = 15.0;
          for (const e of Object.values(this.catalogMgr.matches)) {
            if (!e.is_finished) {
              const [, , rem] = e.shouldScan(nowT, cfg.antiSpamCooldownMinutes || 5);
              if (rem > 0 && rem < minRem) {
                minRem = rem;
              }
            }
          }
          const sleepS = Math.max(4.0, Math.min(minRem, 15.0));
          console.log(
            `⏳ [Aguardando TTL Cache] Catálogo: ${this.catalogMgr.getActiveCount()} partidas ativas sincronizadas. Próximo lote em ${Math.round(sleepS)}s...`
          );
          await new Promise((r) => setTimeout(r, sleepS * 1000));
          continue;
        }

        this.cycleCount++;
        console.log(
          `\n⚡ [SCAN #${this.cycleCount}] Watchlist Ativa: ${watchlistItems.length} jogos precisando de refresh (Total no Catálogo: ${this.catalogMgr.getActiveCount()})`
        );

        const scanSingleMatch = async (item: [any, string]): Promise<boolean> => {
          if (!this.isRunning) return false;
          const [entry] = item;
          try {
            const readTo = Number(cfg.matchReadTimeoutMs || 5000);
            const ms = await this.reader.readMatch(
              entry.url,
              entry.match_id,
              readTo,
              entry
            );

            if (ms) {
              const isEnded =
                (ms.minute || 0) > 125 ||
                ["FT", "Ended", "Finished", "Encerrado", "TERMINADO", "AET", "PEN"].includes(
                  ms.status_raw
                );

              if (isEnded) {
                this.catalogMgr.markFinished(entry.match_id);
                this.dispatcher.emitMatchUpdate(
                  {
                    id: `fs_${ms.match_id}`,
                    status: "FT",
                    minute: ms.minute || 90,
                    homeTeam: { name: ms.home || entry.home || "Mandante" },
                    awayTeam: { name: ms.away || entry.away || "Visitante" },
                  },
                  "FT"
                );
                return true;
              }

              let leagueF = ms.league || entry.league || "FlashScore Live";
              let countryF = (ms.country || entry.country || "Internacional")
                .replace(":", "")
                .trim();

              if (leagueF.includes(":")) {
                const parts = leagueF.split(":");
                const pfx = parts[0].trim();
                const sfx = parts.slice(1).join(":").trim();
                if (
                  pfx.toLowerCase() === countryF.toLowerCase() ||
                  !countryF ||
                  countryF === "Internacional"
                ) {
                  if (!countryF || countryF === "Internacional") {
                    countryF = pfx;
                  }
                  leagueF = sfx;
                }
              }

              const homeName =
                ms.home && ms.home !== "?" ? ms.home : entry.home || "Mandante";
              const awayName =
                ms.away && ms.away !== "?" ? ms.away : entry.away || "Visitante";

              if (isIgnoredMatch(leagueF, countryF, homeName, awayName, cfg)) {
                return false;
              }

              const lTier = getLeagueTier(leagueF, countryF);
              entry.league_tier = lTier;
              entry.tier = lTier;
              if (!isTierAllowed(lTier, cfg)) {
                return false;
              }

              const pHome = ms.home_possession > 0 ? ms.home_possession : 50;
              const pAway = ms.away_possession > 0 ? ms.away_possession : 100 - pHome;

              const hasRealStats =
                ms.home_bc > 0 ||
                ms.away_bc > 0 ||
                ms.home_xgot > 0 ||
                ms.away_xgot > 0 ||
                ms.home_sot > 0 ||
                ms.away_sot > 0;
              const realMinute = ms.minute || entry.getCurrentMinute() || 0;

              const isFinishedStagnant = this.catalogMgr.updateScanResult(
                entry.match_id,
                realMinute,
                ms.status_raw || "LIVE",
                ms.home_score,
                ms.away_score,
                hasRealStats,
                !hasRealStats,
                Number(cfg.noStatsBackoffMinutes || 10),
                ms.stage_code || entry.stage_code || ""
              );

              if (isFinishedStagnant || entry.is_finished) {
                this.catalogMgr.markFinished(entry.match_id);
                this.dispatcher.emitMatchUpdate(
                  {
                    id: `fs_${ms.match_id}`,
                    status: "FT",
                    minute: realMinute || 90,
                    homeTeam: { name: homeName, score: ms.home_score },
                    awayTeam: { name: awayName, score: ms.away_score },
                  },
                  "FT"
                );
                return true;
              }

              const startTimeStr = ms.start_time || entry.kickoff_time_str || "";
              const startDateIso = ms.start_date || entry.start_date_iso || "";

              const hasCompleteStats = Boolean(
                ms.home_dangerous_attacks > 0 ||
                  ms.away_dangerous_attacks > 0 ||
                  ms.home_sot > 0 ||
                  ms.away_sot > 0 ||
                  ms.home_shots_off_target > 0 ||
                  ms.away_shots_off_target > 0 ||
                  ms.home_corners > 0 ||
                  ms.away_corners > 0 ||
                  ms.home_attacks > 0 ||
                  ms.away_attacks > 0
              );

              const [stRaw, stMin, stStage, stPeriod] = resolveMatchStatusAndPeriod(
                ms.status_raw || entry.status,
                realMinute,
                ms.stage_code || entry.stage_code,
                undefined,
                entry
              );

              const payload: WebhookMatchPayload = {
                id: `fs_${ms.match_id}`,
                homeTeam: {
                  name: homeName,
                  score: ms.home_score,
                  redCards: ms.home_red_cards,
                },
                awayTeam: {
                  name: awayName,
                  score: ms.away_score,
                  redCards: ms.away_red_cards,
                },
                score: { home: ms.home_score, away: ms.away_score },
                homeScore: ms.home_score,
                awayScore: ms.away_score,
                league: leagueF,
                country: countryF || "Internacional",
                leagueCountry: countryF || "Internacional",
                tier: lTier,
                startTime: startTimeStr,
                startDate: startDateIso,
                minute: stMin,
                status: stRaw,
                stage_code: stStage,
                stage: stStage,
                period: stPeriod,
                hasCompleteStats,
                home_shots: ms.home_shots,
                away_shots: ms.away_shots,
                home_total_shots: ms.home_shots,
                away_total_shots: ms.away_shots,
                statistics: {
                  possession: { home: pHome, away: pAway },
                  totalShots: {
                    home: ms.home_shots || (ms.home_sot + ms.home_shots_off_target + (ms.home_blocked_shots || 0)),
                    away: ms.away_shots || (ms.away_sot + ms.away_shots_off_target + (ms.away_blocked_shots || 0)),
                  },
                  shotsOnTarget: { home: ms.home_sot, away: ms.away_sot },
                  shotsOffTarget: {
                    home: ms.home_shots_off_target,
                    away: ms.away_shots_off_target,
                  },
                  corners: { home: ms.home_corners, away: ms.away_corners },
                  dangerousAttacks: {
                    home: ms.home_dangerous_attacks,
                    away: ms.away_dangerous_attacks,
                  },
                  attacks: { home: ms.home_attacks, away: ms.away_attacks },
                  xg: { home: ms.home_xg, away: ms.away_xg },
                  xgot: { home: ms.home_xgot, away: ms.away_xgot },
                  bigChances: { home: ms.home_bc, away: ms.away_bc },
                  yellowCards: {
                    home: ms.home_yellow_cards,
                    away: ms.away_yellow_cards,
                  },
                  redCards: {
                    home: ms.home_red_cards,
                    away: ms.away_red_cards,
                  },
                  goalkeeperSaves: {
                    home: ms.home_saves,
                    away: ms.away_saves,
                  },
                },
                events: ms.events || [],
                updatedAt: new Date().toISOString(),
              };

              this.dispatcher.emitMatchUpdate(payload, lTier);
              console.log(
                `  [${lTier}] ${homeName} ${ms.home_score}x${ms.away_score} ${awayName} (${realMinute}') | xG: ${ms.home_xg.toFixed(2)}x${ms.away_xg.toFixed(2)} | BC: ${ms.home_bc}x${ms.away_bc}`
              );
              return true;
            }
          } catch (itemErr: any) {
            console.warn(`  ⚠️ Erro ao ler jogo ${entry.match_id}: ${itemErr?.message}`);
            entry.last_scanned_at = Date.now() / 1000;
            return false;
          }
          return false;
        };

        const workers = Math.max(
          1,
          Math.min(Number(cfg.concurrentWorkers || 4), 12)
        );

        let scannedCount = 0;
        if (workers > 1 && watchlistItems.length > 1) {
          // Processa em batches limitados pelo número de workers
          for (let i = 0; i < watchlistItems.length; i += workers) {
            if (!this.isRunning) break;
            const chunk = watchlistItems.slice(i, i + workers);
            const results = await Promise.all(chunk.map((it) => scanSingleMatch(it)));
            scannedCount += results.filter(Boolean).length;
          }
        } else {
          for (const item of watchlistItems) {
            if (!this.isRunning) break;
            if (await scanSingleMatch(item)) {
              scannedCount++;
            }
          }
        }

        console.log(
          `✅ Ciclo #${this.cycleCount} concluído! ${scannedCount} jogos transmitidos ao Dashboard. Aguardando 12s para próximo scan...`
        );
        await new Promise((r) => setTimeout(r, 12000));
      } catch (loopErr: any) {
        console.error(`⚠️ Erro no loop de varredura: ${loopErr?.message || loopErr}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async performDiscovery(): Promise<void> {
    if (this.isDiscovering) return;
    this.isDiscovering = true;

    try {
      const cfg = await fetchOperationalCrawlerConfig(this.dispatcher.localServerUrl);
      const discTimeout = Number(cfg.discoveryTimeoutMs || 12000);
      console.log(
        `🔭 [Flashscore Discovery] Varrendo grade Flashscore para catalogar novos jogos (timeout ${discTimeout}ms)...`
      );

      let liveMatches: any[] = [];
      if (this.browserContext) {
        try {
          liveMatches = await discoverLiveGames(
            this.browserContext,
            "https://www.flashscore.com.br/",
            acceptCookies,
            discTimeout
          );
        } catch (domErr: any) {
          console.warn(`⚠️ [Flashscore DOM] Descoberta DOM falhou ou indisponível (${domErr?.message}). Alternando para feed HTTP Flashscore...`);
        }
      }

      if (!liveMatches || liveMatches.length === 0) {
        console.log("ℹ️ [Flashscore Feed] Chamando feed HTTP oficial Flashscore...");
        liveMatches = await httpFallbackDiscoverLive(undefined);
      }

      if (!liveMatches || liveMatches.length === 0) {
        console.error(
          "❌ [Flashscore Error] Flashscore indisponível: 0 partidas retornadas. Fonte única: Flashscore. Continuando tentativas de rastreamento..."
        );
      } else {
        this.lastDiscoveryTime = Date.now() / 1000;
        const dismissedIds = await fetchDismissedMatches(this.dispatcher.localServerUrl);
        const acceptedCount = this.processAndCatalogMatches(liveMatches, cfg, dismissedIds);
        console.log(
          `✨ [Flashscore Discovery] ${liveMatches.length} partidas AO VIVO encontradas | ${acceptedCount} no Catálogo (${dismissedIds.size} suprimidas)`
        );
      }
    } catch (err: any) {
      console.error(`❌ [Flashscore Error]: ${err?.message || err}. Tentando feed HTTP oficial...`);
      try {
        const fbMatches = await httpFallbackDiscoverLive(undefined);
        if (fbMatches && fbMatches.length > 0) {
          this.lastDiscoveryTime = Date.now() / 1000;
          const cfg = await fetchOperationalCrawlerConfig(this.dispatcher.localServerUrl);
          const acceptedCount = this.processAndCatalogMatches(fbMatches, cfg);
          console.log(
            `✨ [Flashscore Discovery Feed] ${fbMatches.length} partidas AO VIVO encontradas | ${acceptedCount} no Catálogo`
          );
        } else {
          console.error("❌ [Flashscore Error] Flashscore indisponível. Fonte única: Flashscore. Continuando tentativas de rastreamento...");
        }
      } catch (fbErr: any) {
        console.error(`❌ [Flashscore Error] Erro de comunicação Flashscore (${fbErr?.message || fbErr}). Continuando tentativas de rastreamento...`);
      }
    } finally {
      this.isDiscovering = false;
    }
  }

  private processAndCatalogMatches(
    matchesList: any[],
    opCfg: CrawlerConfig,
    dismissedIds: Set<string> = new Set()
  ): number {
    if (!matchesList || matchesList.length === 0) return 0;
    let accepted = 0;

    for (const item of matchesList) {
      const mid = item.mid;
      if (!mid || dismissedIds.has(mid)) continue;

      const url = item.url;
      const lName = item.league || "";
      const cName = item.country || "";
      const home = item.home || "";
      const away = item.away || "";
      const hScore = Number(item.home_score ?? 0);
      const aScore = Number(item.away_score ?? 0);
      const minute = Number(item.minute ?? 0);
      const status = item.status || "LIVE";
      const adVal = Number(item.ad ?? 0);
      const aoVal = Number(item.ao ?? 0);
      const stageCode = item.stage_code || "";
      const stStr = item.startTime || "";
      const sdIso = item.startDate || "";

      if (isIgnoredMatch(lName, cName, home, away, opCfg)) {
        continue;
      }

      const lTier = getLeagueTier(lName, cName);
      if (!isTierAllowed(lTier, opCfg)) {
        continue;
      }

      this.catalogMgr.upsertDiscovered(
        mid,
        url,
        lName,
        cName,
        home,
        away,
        hScore,
        aScore,
        minute,
        status,
        adVal,
        aoVal,
        stageCode,
        stStr,
        sdIso
      );
      accepted++;
    }

    this.catalogMgr.pruneStale(opCfg.autoPruneMinutes || 30);
    this.catalogMgr.save();
    return accepted;
  }
}

let singletonEngine: UnifiedCrawlerEngine | null = null;
export function getUnifiedNodeEngine(): UnifiedCrawlerEngine {
  if (!singletonEngine) {
    singletonEngine = new UnifiedCrawlerEngine();
  }
  return singletonEngine;
}

export async function restartUnifiedNodeEngine(): Promise<UnifiedCrawlerEngine> {
  console.log("🔄 [Node Crawler API] Requisição recebida para Reiniciar Motor Node...");
  if (singletonEngine) {
    try {
      await singletonEngine.stop();
    } catch (err: any) {
      console.warn("Aviso ao parar singletonEngine anterior:", err?.message || err);
    }
  }

  // Pausa para encerramento de conexões anteriores
  await new Promise((r) => setTimeout(r, 600));

  const newDispatcher = new Dispatcher();
  singletonEngine = new UnifiedCrawlerEngine({ dispatcher: newDispatcher });

  singletonEngine.start().catch((err: any) => {
    console.error("⚠️ [Node Crawler Worker Error on Restart]:", err?.message || err);
  });

  return singletonEngine;
}

// Execução direta via terminal ou script npm
if (
  process.argv[1] &&
  (process.argv[1].endsWith("server/crawler-node/index.ts") ||
    process.argv[1].endsWith("crawler-node/index.ts") ||
    process.argv[1].endsWith("server/crawler-node/index.js"))
) {
  const engine = new UnifiedCrawlerEngine();

  const shutdownHandler = async () => {
    await engine.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);

  engine.start().catch((err) => {
    console.error("❌ Erro fatal no UnifiedCrawlerEngine:", err);
    process.exit(1);
  });
}
