// src/utils/leagueTier.ts
/**
 * League Tier Classifier Utility
 * Categoriza qualquer liga de futebol em TIER 1, TIER 2, TIER 3 ou TIER 4
 * com base na relevância competitiva, liquidez e prestígio internacional.
 */

export type LeagueTier = "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";

export interface LeagueTierInfo {
  tier: LeagueTier;
  label: string; // Ex: "TIER 1"
  badgeClass: string;
}

// Normaliza strings removendo acentos e caracteres especiais
function normalizeStr(str?: string): string {
  if (!str) return "";
  const s = typeof str === "object" && (str as any)?.name ? (str as any).name : String(str);
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getLeagueTier(leagueRaw?: any, countryRaw?: any): LeagueTier {
  const league = normalizeStr(leagueRaw);
  const country = normalizeStr(countryRaw);
  const full = `${league} ${country}`.trim();

  if (!league && !country) return "Tier 3";

  // ──────────────────────────────────────────────
  // TIER 4: Divisões Regionais, Amadoras, Sub/Youth ou 4ª+ Divisão
  // ──────────────────────────────────────────────
  if (
    full.includes("serie d") ||
    full.includes("league two") ||
    full.includes("national league") ||
    full.includes("segunda rfef") ||
    full.includes("tercera") ||
    full.includes("regionalliga") ||
    full.includes("sub-") ||
    full.includes("sub ") ||
    full.includes("u19") ||
    full.includes("u20") ||
    full.includes("u21") ||
    full.includes("u23") ||
    full.includes("youth") ||
    full.includes("reserves") ||
    full.includes("reserva") ||
    full.includes("amateur") ||
    full.includes("amador") ||
    full.includes("regional") ||
    full.includes("estadual") ||
    full.includes("copa paulista") ||
    full.includes("carioca 2") ||
    full.includes("paulista a2") ||
    full.includes("paulista a3")
  ) {
    return "Tier 4";
  }

  // ──────────────────────────────────────────────
  // TIER 1: Elite Mundial, Grandes Torneios & Top 7 Ligas
  // ──────────────────────────────────────────────

  // Torneios continentais e mundiais de primeira linha
  if (
    full.includes("champions league") ||
    full.includes("liga dos campeoes") ||
    full.includes("europa league") ||
    full.includes("conference league") ||
    full.includes("copa libertadores") ||
    full.includes("libertadores") ||
    full.includes("sul-americana") ||
    full.includes("sudamericana") ||
    full.includes("copa do mundo") ||
    full.includes("world cup") ||
    full.includes("eurocopa") ||
    full.includes("copa america") ||
    full.includes("club world cup") ||
    full.includes("mundial de clubes")
  ) {
    return "Tier 1";
  }

  // Inglaterra - Premier League (verificar se não é Kuwait, etc.)
  if (
    league.includes("premier league") &&
    (country.includes("inglaterra") || country.includes("england") || country.includes("uk") || !country)
  ) {
    return "Tier 1";
  }

  // Espanha - La Liga / Primera División
  if (
    (league.includes("la liga") || league.includes("laliga") || league.includes("primera division") || league.includes("la liga santander") || league.includes("la liga ea sports")) &&
    (country.includes("espanha") || country.includes("spain") || !country) &&
    !league.includes("2") &&
    !league.includes("smartbank") &&
    !league.includes("hypermotion")
  ) {
    return "Tier 1";
  }

  // Brasil - Brasileirão Série A
  if (
    (league.includes("serie a") || league.includes("brasileirao") || league.includes("brasileirão") || league.includes("betano")) &&
    (country.includes("brasil") || country.includes("brazil") || full.includes("brasileir")) &&
    !full.includes("serie b") &&
    !full.includes("serie c") &&
    !full.includes("serie d") &&
    !full.includes("sub")
  ) {
    return "Tier 1";
  }

  // Itália - Serie A TIM
  if (
    league.includes("serie a") &&
    (country.includes("italia") || country.includes("italy")) &&
    !league.includes("serie b") &&
    !league.includes("serie c")
  ) {
    return "Tier 1";
  }

  // Alemanha - Bundesliga
  if (
    league.includes("bundesliga") &&
    (country.includes("alemanha") || country.includes("germany") || !country) &&
    !league.includes("2") &&
    !league.includes("austria")
  ) {
    return "Tier 1";
  }

  // França - Ligue 1
  if (
    league.includes("ligue 1") &&
    (country.includes("franca") || country.includes("france") || !country)
  ) {
    return "Tier 1";
  }

  // Portugal - Primeira Liga / Liga Portugal
  if (
    (league.includes("primeira liga") || league.includes("liga portugal") || league.includes("liga betclic")) &&
    (country.includes("portugal") || !country) &&
    !league.includes("2")
  ) {
    return "Tier 1";
  }

  // Holanda - Eredivisie
  if (
    league.includes("eredivisie") &&
    (country.includes("holanda") || country.includes("netherlands") || country.includes("paises baixos") || !country)
  ) {
    return "Tier 1";
  }

  // ──────────────────────────────────────────────
  // TIER 2: Segundas divisões de elite, Copas nacionais e Ligas competitivas
  // ──────────────────────────────────────────────

  // Segundas divisões de ponta
  if (
    full.includes("championship") ||
    full.includes("serie b") ||
    full.includes("2. bundesliga") ||
    full.includes("2 bundesliga") ||
    full.includes("segunda division") ||
    full.includes("la liga 2") ||
    full.includes("hypermotion") ||
    full.includes("ligue 2") ||
    full.includes("liga portugal 2") ||
    full.includes("eerste divisie")
  ) {
    return "Tier 2";
  }

  // Copas Nacionais principais
  if (
    full.includes("copa do brasil") ||
    full.includes("fa cup") ||
    full.includes("efl cup") ||
    full.includes("copa del rey") ||
    full.includes("dfb pokal") ||
    full.includes("coppa italia") ||
    full.includes("coupe de france") ||
    full.includes("taca de portugal") ||
    full.includes("knvb beker")
  ) {
    return "Tier 2";
  }

  // Ligas das Américas e Europa Tier 2
  if (
    full.includes("mls") ||
    full.includes("major league soccer") ||
    full.includes("liga mx") ||
    full.includes("liga profesional") ||
    full.includes("primera division argentina") ||
    full.includes("liga betplay") ||
    full.includes("primera division colombia") ||
    full.includes("liga pro ecuador") ||
    full.includes("primera division chile") ||
    full.includes("primera division uruguay") ||
    full.includes("primera division paraguay") ||
    full.includes("premiership") ||
    full.includes("super lig") ||
    full.includes("superlig") ||
    full.includes("jupiler pro league") ||
    full.includes("pro league belgica") ||
    full.includes("eliteserien") ||
    full.includes("allsvenskan") ||
    full.includes("superliga dinamarca") ||
    full.includes("super league suica") ||
    full.includes("austrian bundesliga")
  ) {
    return "Tier 2";
  }

  // ──────────────────────────────────────────────
  // TIER 3: Terceiras divisões, Ligas emergentes / Leste / Ásia
  // ──────────────────────────────────────────────
  if (
    full.includes("serie c") ||
    full.includes("league one") ||
    full.includes("3. liga") ||
    full.includes("primera federacion") ||
    full.includes("primera rfef") ||
    full.includes("saudi pro league") ||
    full.includes("j-league") ||
    full.includes("k-league") ||
    full.includes("super league grecia") ||
    full.includes("ekstraklasa") ||
    full.includes("fortuna liga") ||
    full.includes("parva liga")
  ) {
    return "Tier 3";
  }

  // Padrão inteligente:
  // Se for uma liga nacional desconhecida ou torneio não mapeado, define como Tier 3
  return "Tier 3";
}

export function getLeagueTierInfo(leagueRaw?: any, countryRaw?: any): LeagueTierInfo {
  const tier = getLeagueTier(leagueRaw, countryRaw);

  switch (tier) {
    case "Tier 1":
      return {
        tier,
        label: "TIER 1",
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      };
    case "Tier 2":
      return {
        tier,
        label: "TIER 2",
        badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      };
    case "Tier 3":
      return {
        tier,
        label: "TIER 3",
        badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      };
    case "Tier 4":
      return {
        tier,
        label: "TIER 4",
        badgeClass: "bg-slate-800 text-slate-400 border-slate-700",
      };
  }
}
