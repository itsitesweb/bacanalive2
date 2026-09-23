// src/utils/leagueFilter.ts
/**
 * League & Match Filter Utility
 * Detects and filters out Women's leagues, E-Soccer / Virtual leagues, and Youth/Under leagues.
 */

export interface LeagueFilterOptions {
  excludeEsoccer?: boolean;
  excludeWomen?: boolean;
  excludeYouthUnder?: boolean;
  customExcludedKeywords?: string[];
}

export function isIgnoredLeague(
  leagueName?: string,
  country?: string,
  homeTeamName?: string,
  awayTeamName?: string,
  options?: LeagueFilterOptions
): boolean {
  const combined = [
    leagueName || "",
    country || "",
    homeTeamName || "",
    awayTeamName || "",
  ]
    .join(" ")
    .toLowerCase();

  if (!combined.trim()) return false;

  const opt = {
    excludeEsoccer: options?.excludeEsoccer !== false,
    excludeWomen: options?.excludeWomen !== false,
    excludeYouthUnder: options?.excludeYouthUnder !== false,
    customExcludedKeywords: options?.customExcludedKeywords || [],
  };

  // 1. Custom user-defined keywords
  if (opt.customExcludedKeywords && opt.customExcludedKeywords.length > 0) {
    for (const kw of opt.customExcludedKeywords) {
      const trimmed = (kw || "").trim().toLowerCase();
      if (trimmed && combined.includes(trimmed)) {
        return true;
      }
    }
  }

  // 2. E-Soccer / Virtual & Simulated leagues
  if (opt.excludeEsoccer) {
    const esoccerPatterns = [
      /\besoccer\b/i,
      /\be-soccer\b/i,
      /\besports\b/i,
      /\be-sports\b/i,
      /\bcyber\b/i,
      /\bvirtual\b/i,
      /\bgt league\b/i,
      /\bgt battle\b/i,
      /\bfifa\b/i,
      /\bpes\b/i,
      /\bfifa volta\b/i,
      /\bvolta football\b/i,
      /\b2x2\b/i,
      /\b3x3\b/i,
      /\b4x4\b/i,
      /\b5x5\b/i,
      /\b6x6\b/i,
      /\b7x7\b/i,
      /\b8x8\b/i,
      /\bgg league\b/i,
      /\bh2h gg\b/i,
      /\be-football\b/i,
      /\befootball\b/i,
      /\bpenalty shootout\b/i,
      /\bsrl\b/i,
      /\bsimulated\b/i,
      /\bshort football\b/i,
      /\bbattle 8m\b/i,
      /\bbattle 10m\b/i,
      /\bbattle 12m\b/i,
    ];

    for (const pattern of esoccerPatterns) {
      if (pattern.test(combined)) {
        return true;
      }
    }
  }

  // 3. Women's Football / Ligas Femininas
  if (opt.excludeWomen) {
    const womenPatterns = [
      /\bfeminino\b/i,
      /\bfeminina\b/i,
      /\bwomen\b/i,
      /\bwoman\b/i,
      /\bladies\b/i,
      /\bfrauen\b/i,
      /\bdames\b/i,
      /\bfemmes\b/i,
      /\bdamen\b/i,
      /\bkvinner\b/i,
      /\bnaiset\b/i,
      /\bmulheres\b/i,
      /\b\(w\)\b/i,
      /\b\[w\]\b/i,
      /\b\(f\)\b/i,
      /\b\[f\]\b/i,
      /\b\(fem\)\b/i,
      /\bwfc\b/i,
      /\bffc\b/i,
      /\bwomen's\b/i,
      /\bfem\.\b/i,
    ];

    for (const pattern of womenPatterns) {
      if (pattern.test(combined)) {
        return true;
      }
    }
  }

  // 4. Categorias de Base / Youth / Under
  if (opt.excludeYouthUnder) {
    const youthUnderPatterns = [
      /\bsub[- ]?1[4-9]\b/i,
      /\bsub[- ]?2[0-3]\b/i,
      /\bu[- ]?1[4-9]\b/i,
      /\bu[- ]?2[0-3]\b/i,
      /\bunder[- ]?1[4-9]\b/i,
      /\bunder[- ]?2[0-3]\b/i,
      /\byouth\b/i,
      /\bjuniores\b/i,
      /\bjuvenil\b/i,
      /\bjunior\b/i,
      /\bprimavera\b/i,
      /\bjunioren\b/i,
      /\bjeunes\b/i,
      /\baspirantes\b/i,
      /\breserves\b/i,
      /\breservas\b/i,
      /\bdevelopment league\b/i,
      /\bacademy\b/i,
    ];

    for (const pattern of youthUnderPatterns) {
      if (pattern.test(combined)) {
        return true;
      }
    }
  }

  return false;
}
