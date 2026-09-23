// server/crawler-node/catalog.ts
/**
 * Catálogo Central e Motor de Cache Adaptativo por TIER (server/crawler-node/catalog.ts)
 * Portado 1:1 de MatchCatalogEntry e MatchCatalogManager do bridge_web.py.
 * Persistência assíncrona não-bloqueante em ./data/crawler_catalog_cache.json.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { MatchTier, TIER_SCAN_TTL_SECONDS, MatchCatalogEntryData } from "./types";
import { resolveMatchStatusAndPeriod } from "./statusResolver";
import { getLeagueTier } from "../../src/utils/leagueTier";

export function isTierAllowed(
  tier: string,
  crawlerConfig?: { tierFilter?: Record<string, any> } | null
): boolean {
  if (!crawlerConfig) return true;
  const tf = crawlerConfig.tierFilter || {};
  if (!tf || Object.keys(tf).length === 0) return true;

  if (tier === "Tier 1") {
    if (tf.enableTier1 === false) return false;
    if (tf.enableTier05PremiumLeagues === false && tf.enableTier12Window === false && !("enableTier1" in tf)) {
      return false;
    }
    return true;
  } else if (tier === "Tier 2") {
    if (tf.enableTier2 === false) return false;
    if (tf.enableTier12Window === false && tf.enableTier05PremiumLeagues === false && !("enableTier2" in tf)) {
      return false;
    }
    return true;
  } else if (tier === "Tier 3") {
    if (tf.enableTier3 === false) return false;
    if (tf.enableTier3Rotation === false) return false;
    return true;
  } else if (tier === "Tier 4") {
    if (tf.enableTier4 === false) return false;
    if (tf.enableTier3Rotation === false) return false;
    return true;
  }

  return true;
}

// =============================================================================
// 1. ENTRADA INDIVIDUAL DO CATÁLOGO (MatchCatalogEntry)
// =============================================================================
export class MatchCatalogEntry implements MatchCatalogEntryData {
  public match_id: string;
  public url: string;
  public league: string;
  public country: string;
  public home: string;
  public away: string;
  public first_seen_at: number;
  public last_seen_at: number;
  public last_scanned_at: number = 0.0;
  public minute: number = 0;
  public status: string = "LIVE";
  public home_score: number = 0;
  public away_score: number = 0;
  public ad: number = 0;
  public ao: number = 0;
  public stage_code: string = "";
  public kickoff_time_str: string = "";
  public start_date_iso: string = "";
  public league_tier: string;
  public is_premium: boolean;
  public scan_cadence: string;
  public tier: string;
  public has_open_position: boolean = false;
  public last_signal_time: number = 0.0;
  public had_stats: boolean = false;
  public no_stats_until: number = 0.0;
  public is_finished: boolean = false;
  public last_scanned_minute: number = 0;
  public stagnant_minute_count: number = 0;
  public cached_payload?: Record<string, any> | null = null;

  constructor(
    match_id: string,
    url: string,
    league: string = "",
    country: string = "",
    home: string = "",
    away: string = ""
  ) {
    this.match_id = match_id;
    this.url = url;
    this.league = league;
    this.country = country;
    this.home = home;
    this.away = away;
    const nowSec = Date.now() / 1000;
    this.first_seen_at = nowSec;
    this.last_seen_at = nowSec;

    this.league_tier = getLeagueTier(league, country);
    this.is_premium = this.league_tier === "Tier 1";
    this.scan_cadence = this.is_premium ? MatchTier.TIER_05 : MatchTier.TIER_3;
    this.tier = this.league_tier;
  }

  /**
   * Calcula o minuto exato da partida em tempo real baseado nos timestamps oficiais FlashScore.
   */
  public getCurrentMinute(): number {
    if (this.is_finished) {
      return this.minute || 90;
    }

    // Priorizar sempre o minuto oficial extraído diretamente do FlashScore quando disponível (> 0)
    if (this.minute > 0) {
      return this.minute;
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    // AO (Actual Kickoff) é o horário real que a partida começou. AD é apenas o horário agendado!
    const effectiveStart = this.ao > 0 ? this.ao : this.ad;

    if (this.stage_code === "12") {
      // 1º Tempo
      if (this.minute > 0 && this.minute <= 45) {
        return this.minute;
      }
      if (effectiveStart > 0) {
        return Math.max(1, Math.floor((nowEpoch - effectiveStart) / 60));
      }
      return Math.max(1, this.minute);
    } else if (this.stage_code === "38") {
      // Intervalo / Half-Time
      return 45;
    } else if (this.stage_code === "13") {
      // 2º Tempo
      if (this.minute >= 46) {
        return this.minute;
      }
      if (this.ao > 0) {
        return Math.min(90, Math.max(46, 45 + Math.floor((nowEpoch - this.ao) / 60)));
      } else if (this.ad > 0) {
        return Math.min(90, Math.max(46, Math.floor((nowEpoch - this.ad) / 60) - 15));
      }
      return Math.max(46, this.minute);
    } else if (this.stage_code === "14" || this.stage_code === "15") {
      // Prorrogação
      if (this.ao > 0) {
        return Math.max(91, 90 + Math.floor((nowEpoch - this.ao) / 60));
      }
      return Math.max(91, this.minute);
    }

    if (effectiveStart > 0) {
      const elapsed = Math.floor((nowEpoch - effectiveStart) / 60);
      if (elapsed <= 45) {
        return Math.max(1, elapsed);
      } else if (elapsed <= 55) {
        return 45;
      } else {
        return Math.max(46, elapsed - 15);
      }
    }

    return this.minute || 1;
  }

  /**
   * Calcula dinamicamente a cadência de scan (TTL) da partida.
   */
  public determineCadence(antiSpamMinutes: number = 5.0): string {
    const now = Date.now() / 1000;
    if (this.is_finished) {
      this.scan_cadence = MatchTier.FINISHED;
      return this.scan_cadence;
    }

    // TIER 1 TEM PRIORIDADE ABSOLUTA: nunca entra em NO_STATS backoff e é rastreado toda vez
    if (this.is_premium || this.league_tier === "Tier 1") {
      this.scan_cadence = MatchTier.TIER_05;
      return this.scan_cadence;
    }

    if (now < this.no_stats_until) {
      this.scan_cadence = MatchTier.NO_STATS;
      return this.scan_cadence;
    }

    const stUp = (this.status || "").toUpperCase();
    const isHtCadence =
      this.stage_code === "38" ||
      this.status === "HT" ||
      stUp.includes("HT") ||
      stUp.includes("INTERVAL") ||
      stUp.includes("DESCANSO") ||
      (this.minute === 45 && !["2H", "2T", "2ND HALF"].includes(stUp));

    if (isHtCadence) {
      this.scan_cadence = MatchTier.HT;
      return this.scan_cadence;
    }

    if (this.has_open_position || now - this.last_signal_time < antiSpamMinutes * 60) {
      this.scan_cadence = MatchTier.TIER_0;
      return this.scan_cadence;
    }

    const m = this.minute || 0;
    if (m >= 20 && m <= 83) {
      if (this.had_stats) {
        this.scan_cadence = MatchTier.TIER_1;
      } else {
        this.scan_cadence = MatchTier.TIER_2;
      }
      return this.scan_cadence;
    }

    this.scan_cadence = MatchTier.TIER_3;
    return this.scan_cadence;
  }

  public determineTier(antiSpamMinutes: number = 5.0): string {
    if (!this.league_tier) {
      this.league_tier = getLeagueTier(this.league, this.country);
    }
    this.tier = this.league_tier;
    this.is_premium = this.league_tier === "Tier 1";
    return this.determineCadence(antiSpamMinutes);
  }

  /**
   * Avalia se a partida precisa de uma nova requisição de rede ou se pode usar o cache.
   * Retorna: [needs_scan, current_cadence, remaining_ttl]
   */
  public shouldScan(nowSec?: number, antiSpamMinutes: number = 5.0): [boolean, string, number] {
    const now = nowSec ?? Date.now() / 1000;

    if (this.is_finished) {
      return [false, MatchTier.FINISHED, 999999.0];
    }

    // Jogos do Tier 1 têm PRIORIDADE TOTAL e devem ser rastreados a cada ciclo sem atrasos de cache
    if (this.is_premium || this.league_tier === "Tier 1") {
      return [true, MatchTier.TIER_05, 0.0];
    }

    const currentCadence = this.determineCadence(antiSpamMinutes);
    const ttl = TIER_SCAN_TTL_SECONDS[currentCadence] ?? 35.0;

    const elapsed = now - this.last_scanned_at;
    if (elapsed < ttl) {
      const remaining = ttl - elapsed;
      return [false, currentCadence, remaining];
    }

    return [true, currentCadence, 0.0];
  }
}

// =============================================================================
// 2. GERENCIADOR DO CATÁLOGO DE PARTIDAS (MatchCatalogManager)
// =============================================================================
export class MatchCatalogManager {
  public persistenceFile: string;
  public matches: Record<string, MatchCatalogEntry> = {};

  // Mecanismo anti-corrida para persistência assíncrona no disco
  private isSaving: boolean = false;
  private pendingSave: boolean = false;

  constructor(persistenceFile?: string, startFresh: boolean = false) {
    this.persistenceFile =
      persistenceFile || path.resolve(process.cwd(), "data", "crawler_catalog_cache.json");

    if (startFresh) {
      void this.clearAll();
    } else {
      void this.load();
    }
  }

  /**
   * Zera completamente o catálogo em memória e remove o arquivo de cache em disco.
   */
  public async clearAll(): Promise<void> {
    this.matches = {};
    try {
      await fs.unlink(this.persistenceFile);
      console.log(`🧹 [Catálogo Cache] Arquivo ${path.basename(this.persistenceFile)} removido do disco.`);
    } catch {
      try {
        const dir = path.dirname(this.persistenceFile);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(
          this.persistenceFile,
          JSON.stringify({ updated_at: Date.now() / 1000, matches: [] }, null, 2),
          "utf-8"
        );
      } catch {
        // Ignora silenciosamente
      }
    }
  }

  /**
   * Carrega o catálogo do arquivo JSON em disco.
   */
  public async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.persistenceFile, "utf-8");
      const data = JSON.parse(content);
      const nowSec = Date.now() / 1000;
      for (const item of data.matches || []) {
        const mid = item.match_id;
        if (mid) {
          const e = new MatchCatalogEntry(
            mid,
            item.url || "",
            item.league || "",
            item.country || "",
            item.home || "",
            item.away || ""
          );
          e.first_seen_at = item.first_seen_at ?? nowSec;
          e.last_seen_at = item.last_seen_at ?? nowSec;
          e.last_scanned_at = item.last_scanned_at ?? 0.0;
          e.minute = item.minute ?? 0;
          e.status = item.status || "LIVE";
          e.home_score = item.home_score ?? 0;
          e.away_score = item.away_score ?? 0;
          e.is_finished = Boolean(item.is_finished);
          this.matches[mid] = e;
        }
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.warn(`⚠️ [MatchCatalogManager] Erro ao carregar cache do disco:`, err?.message || err);
      }
    }
  }

  /**
   * Salva o catálogo em disco de forma atômica e com prevenção estrita de race condition.
   */
  public async save(): Promise<void> {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }
    this.isSaving = true;

    try {
      do {
        this.pendingSave = false;
        await this.writeToDisk();
      } while (this.pendingSave);
    } finally {
      this.isSaving = false;
    }
  }

  private async writeToDisk(): Promise<void> {
    try {
      const items = Object.values(this.matches).map((e) => ({
        match_id: e.match_id,
        url: e.url,
        league: e.league,
        country: e.country,
        home: e.home,
        away: e.away,
        first_seen_at: e.first_seen_at,
        last_seen_at: e.last_seen_at,
        last_scanned_at: e.last_scanned_at,
        minute: e.minute,
        status: e.status,
        home_score: e.home_score,
        away_score: e.away_score,
        is_finished: e.is_finished,
      }));

      const payload = JSON.stringify(
        {
          updated_at: Date.now() / 1000,
          matches: items,
        },
        null,
        2
      );

      const dir = path.dirname(this.persistenceFile);
      await fs.mkdir(dir, { recursive: true });

      const tmpFile = `${this.persistenceFile}.tmp.${Date.now()}`;
      await fs.writeFile(tmpFile, payload, "utf-8");
      await fs.rename(tmpFile, this.persistenceFile);
    } catch (err: any) {
      console.warn(`⚠️ [MatchCatalogManager] Erro ao salvar cache em disco:`, err?.message || err);
    }
  }

  public getActiveCount(): number {
    return Object.values(this.matches).filter((m) => !m.is_finished).length;
  }

  public count(): number {
    return Object.keys(this.matches).length;
  }

  public getTotalCount(): number {
    return Object.keys(this.matches).length;
  }

  public upsertDiscovered(
    match_id: string,
    url: string,
    league: string = "",
    country: string = "",
    home: string = "",
    away: string = "",
    home_score: number = 0,
    away_score: number = 0,
    minute: number = 0,
    status: string = "LIVE",
    ad: number = 0,
    ao: number = 0,
    stage_code: string = "",
    kickoff_time_str: string = "",
    start_date_iso: string = ""
  ): void {
    const existing = this.matches[match_id];
    const [res_st, res_min, res_sc] = resolveMatchStatusAndPeriod(
      status || (existing ? existing.status : "LIVE"),
      minute > 0 ? minute : existing ? existing.minute : 0,
      stage_code || (existing ? existing.stage_code : ""),
      undefined,
      existing
    );

    if (!existing) {
      const entry = new MatchCatalogEntry(match_id, url, league, country, home, away);
      entry.home_score = home_score;
      entry.away_score = away_score;
      entry.minute = res_min;
      entry.status = res_st || "LIVE";
      entry.ad = ad;
      entry.ao = ao;
      entry.stage_code = res_sc;
      entry.kickoff_time_str = kickoff_time_str;
      entry.start_date_iso = start_date_iso;
      this.matches[match_id] = entry;
    } else {
      const entry = existing;
      entry.last_seen_at = Date.now() / 1000;
      if (url && !entry.url) entry.url = url;
      if (league) entry.league = league;
      if (country) entry.country = country;
      if (league || country) {
        entry.league_tier = getLeagueTier(entry.league, entry.country);
        entry.tier = entry.league_tier;
        entry.is_premium = entry.league_tier === "Tier 1";
      }
      if (home && (!entry.home || entry.home === "?")) entry.home = home;
      if (away && (!entry.away || entry.away === "?")) entry.away = away;
      if (res_min > 0) entry.minute = res_min;
      if (ad > 0) entry.ad = ad;
      if (ao > 0) entry.ao = ao;
      if (res_sc) entry.stage_code = res_sc;
      if (kickoff_time_str) entry.kickoff_time_str = kickoff_time_str;
      if (start_date_iso) entry.start_date_iso = start_date_iso;
      if (res_st) entry.status = res_st;
      entry.home_score = home_score;
      entry.away_score = away_score;
    }
  }

  public markFinished(match_id: string): void {
    const entry = this.matches[match_id];
    if (entry) {
      entry.is_finished = true;
      entry.tier = MatchTier.FINISHED;
    }
  }

  /**
   * Atualiza a partida e verifica se o jogo terminou por status ou por tempo estagnado >= 90' em 3 varreduras consecutivas.
   * Retorna true se a partida foi detectada como finalizada.
   */
  public updateScanResult(
    match_id: string,
    minute: number,
    status: string,
    home_score: number,
    away_score: number,
    had_stats: boolean,
    no_stats: boolean = false,
    no_stats_backoff_minutes: number = 10.0,
    stage_code: string = ""
  ): boolean {
    const entry = this.matches[match_id];
    if (!entry) return false;

    entry.last_scanned_at = Date.now() / 1000;
    if (stage_code) {
      entry.stage_code = stage_code;
    }

    const stUp = (status || "").toUpperCase();
    // Resolução estrita de Halftime (Intervalo)
    const is_ht =
      entry.stage_code === "38" ||
      ["HT", "INT", "38", "INTERVALO", "INTERVAL", "HALFTIME", "HALF TIME", "DESCANSO"].includes(stUp) ||
      stUp.includes("INTERVAL") ||
      stUp.includes("HALFTIME") ||
      stUp.includes("HALF TIME");

    if (is_ht) {
      entry.status = "HT";
      entry.minute = 45;
      entry.stage_code = "38";
    } else if (entry.stage_code === "13") {
      entry.status = ["HT", "1T", "1H"].includes(stUp) ? "2T" : status;
      entry.minute = Math.max(46, minute);
    } else {
      entry.status = status;
      entry.minute = minute;
    }

    entry.home_score = home_score;
    entry.away_score = away_score;
    entry.had_stats = had_stats;

    if (no_stats && !entry.is_premium && entry.league_tier !== "Tier 1") {
      entry.no_stats_until = Date.now() / 1000 + no_stats_backoff_minutes * 60.0;
    } else {
      entry.no_stats_until = 0.0;
    }

    const is_status_finished =
      ["FT", "ENDED", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "FIM"].includes(stUp) ||
      minute > 120;

    if (is_status_finished) {
      entry.is_finished = true;
      entry.tier = MatchTier.FINISHED;
      console.log(
        `🛑 [FIM DE JOGO - STATUS OFICIAL] Partida ${entry.home} x ${entry.away} detectada como ENCERRADA (${status} / ${minute}').`
      );
      return true;
    }

    // Dica/Regra operacional: se o jogo estiver com o tempo parado em 3 varreduras seguintes e acima de 90', esse jogo já terminou.
    if (minute >= 90) {
      if (entry.last_scanned_minute === minute) {
        entry.stagnant_minute_count += 1;
      } else {
        entry.last_scanned_minute = minute;
        entry.stagnant_minute_count = 1;
      }

      if (entry.stagnant_minute_count >= 3) {
        entry.is_finished = true;
        entry.tier = MatchTier.FINISHED;
        console.log(
          `🛑 [FIM DE JOGO - TEMPO ESTAGNADO 3x] Partida ${entry.home} x ${entry.away} detectada como ENCERRADA (tempo parado em ${minute}' por 3 varreduras).`
        );
        return true;
      }
    } else if (minute === 0 && !had_stats) {
      // Partida sem estatísticas e com minuto 0
      if (entry.last_scanned_minute === 0) {
        entry.stagnant_minute_count += 1;
      } else {
        entry.last_scanned_minute = 0;
        entry.stagnant_minute_count = 1;
      }
      if (entry.stagnant_minute_count >= 3) {
        entry.no_stats_until = Date.now() / 1000 + no_stats_backoff_minutes * 60.0;
      }
    } else {
      entry.last_scanned_minute = minute;
      entry.stagnant_minute_count = 0;
    }

    return false;
  }

  public pruneStale(maxUnseenMinutes: number = 30.0): void {
    const nowSec = Date.now() / 1000;
    const cutoff = nowSec - maxUnseenMinutes * 60;
    const toDel: string[] = [];

    for (const [mid, e] of Object.entries(this.matches)) {
      if (e.is_finished) {
        toDel.push(mid);
      } else if (e.last_seen_at < cutoff && !e.has_open_position) {
        toDel.push(mid);
      }
    }

    for (const mid of toDel) {
      delete this.matches[mid];
    }
  }

  /**
   * Algoritmo de distribuição de vagas da watchlist por TIER respeitando cotas e prioridades rigorosas.
   */
  public selectWatchlistByTiers(
    maxSize: number = 15,
    tier3Reserved: number = 2,
    minEntryMinute: number = 20,
    maxEntryMinute: number = 83,
    antiSpamMinutes: number = 5.0,
    tierFilter?: Record<string, any>
  ): Array<[MatchCatalogEntry, string]> {
    const now = Date.now() / 1000;
    const tf = tierFilter || {};
    const enable_t0 = tf.enableTier0Signals !== false;
    const enable_t05 =
      tf.enableTier05PremiumLeagues !== false && tf.enableTier05Premium !== false;
    const enable_t1 = tf.enableTier1 !== false;
    const enable_t2 = tf.enableTier2 !== false;
    const enable_t3 = tf.enableTier3 !== false && tf.enableTier3Rotation !== false;

    const bucket_t0: MatchCatalogEntry[] = [];
    const bucket_t05: MatchCatalogEntry[] = [];
    const bucket_t1: MatchCatalogEntry[] = [];
    const bucket_t2: MatchCatalogEntry[] = [];
    const bucket_t3: MatchCatalogEntry[] = [];
    const bucket_ht: MatchCatalogEntry[] = [];

    for (const e of Object.values(this.matches)) {
      if (e.is_finished) continue;

      // Garantir sincronização do Tier esportivo oficial
      if (!e.league_tier) {
        e.league_tier = getLeagueTier(e.league, e.country);
        e.tier = e.league_tier;
        e.is_premium = e.league_tier === "Tier 1";
      }

      // FILTRO ESTRITO DE TIERS: se o Tier da liga estiver desativado pelo usuário, ignorar completamente
      if (!isTierAllowed(e.league_tier, { tierFilter: tf })) {
        continue;
      }

      const [needs_scan, cadence] = e.shouldScan(now, antiSpamMinutes);
      if (!needs_scan) continue;

      if (cadence === MatchTier.TIER_0 && enable_t0) {
        bucket_t0.push(e);
      } else if (cadence === MatchTier.TIER_05 && enable_t05) {
        bucket_t05.push(e);
      } else if (cadence === MatchTier.HT) {
        bucket_ht.push(e);
      } else if (cadence === MatchTier.TIER_1 && enable_t1) {
        bucket_t1.push(e);
      } else if (cadence === MatchTier.TIER_2 && enable_t2) {
        bucket_t2.push(e);
      } else if (cadence === MatchTier.TIER_3 && enable_t3) {
        bucket_t3.push(e);
      }
    }

    // Ordenar cada bucket por last_scanned_at crescente (o que não é varrido há mais tempo vem primeiro)
    bucket_t05.sort((a, b) => a.last_scanned_at - b.last_scanned_at);
    bucket_ht.sort((a, b) => a.last_scanned_at - b.last_scanned_at);
    bucket_t1.sort((a, b) => a.last_scanned_at - b.last_scanned_at);
    bucket_t2.sort((a, b) => a.last_scanned_at - b.last_scanned_at);
    bucket_t3.sort((a, b) => a.last_scanned_at - b.last_scanned_at);

    const selected: Array<[MatchCatalogEntry, string]> = [];

    // TIER 0: Posições abertas / sinais prioritários
    for (const e of bucket_t0) {
      selected.push([e, e.league_tier]);
    }

    // TIER 1 / TIER 05: PRIORIDADE MÁXIMA ABSOLUTA - Jogos de Tier 1 são rastreados toda vez em cada ciclo
    for (const e of bucket_t05) {
      selected.push([e, e.league_tier]);
    }

    // INTERVALO / HT: Rastrear e atualizar partidas no intervalo para garantir sincronização contínua de status
    for (const e of bucket_ht) {
      if (selected.length >= maxSize) break;
      selected.push([e, e.league_tier]);
    }

    let remaining_slots = Math.max(0, maxSize - selected.length);

    const t3_quota = Math.min(tier3Reserved, bucket_t3.length, remaining_slots);
    const t3_selected = bucket_t3.slice(0, t3_quota);
    remaining_slots -= t3_selected.length;

    for (const e of bucket_t1) {
      if (remaining_slots <= 0) break;
      selected.push([e, e.league_tier]);
      remaining_slots--;
    }

    for (const e of bucket_t2) {
      if (remaining_slots <= 0) break;
      selected.push([e, e.league_tier]);
      remaining_slots--;
    }

    for (const e of t3_selected) {
      selected.push([e, e.league_tier]);
    }

    return selected;
  }
}
