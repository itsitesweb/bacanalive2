// src/utils/marketRecommendation.ts
import { Match, MatchRulesAnalysis, OperationalRulesConfig } from "../types";

export type MarketType = "OVER_HT" | "OVER_FT" | "MATCH_ODDS";
export type MarketAction = "ENTER_NOW" | "SNIPE" | "NO_ENTRY";
export type ConvictionLevel = "MAX" | "ALTA" | "MODERADA" | "NEUTRA";

export interface MarketRecommendation {
  marketType: MarketType;
  marketLabel: string;
  targetLine: string;
  recommendedOddMin: number;
  currentEstimatedOdd?: number;
  action: MarketAction;
  actionLabel: string;
  actionBadgeColor: string; // Tailwind class
  convictionLevel: ConvictionLevel;
  convictionBadgeColor: string; // Tailwind class
  justification: string;
  isConfluent: boolean;
  teamTarget?: string;
  cutoffBlocked?: boolean;
}

/**
 * Pure decision engine function to calculate market recommendation based on
 * game half (1T vs 2T), score, minute cutoffs, odds triggers and confluence.
 *
 * Rules:
 * - Corner markets strictly blocked/hidden.
 * - Match Odds strictly blocked in 1st Half (1T).
 * - Cutoffs: 1T = 38' (Over HT blocked after 38'), 2T = 82' (Over FT & Match Odds blocked after 82').
 * - 1T: Focus on Over HT (Over 0.5 HT if 0x0, Over 1.5 HT if 1 goal, Over totalGoals+0.5 HT).
 *   Target Odd: 1.60 (or 1.45 if confluent). If odd < target, SNIPE (wait till ~30'-32').
 * - 2T: Focus on Over FT & Match Odds (Back/Lay).
 *   - Over FT: Target Odd 1.50 - 1.70 (1.40 if confluent).
 *   - Match Odds: Only if draw or favorite down by 1 goal (empate ou desvantagem de 1 gol).
 *     Target Odd 1.60 - 2.10 (Lay se azarão liderando ou Back se favorito empatando).
 */
export function getMarketRecommendation(
  match: Match,
  rulesAnalysis?: MatchRulesAnalysis,
  config?: OperationalRulesConfig
): MarketRecommendation | null {
  const minute = match.minute || 0;
  const statusUpper = (match.status || "").toUpperCase();
  const isFinished = statusUpper === "FT" || statusUpper === "FINISHED" || statusUpper === "ENCERRADO" || minute >= 90;
  const isHT = statusUpper === "HT" || statusUpper === "INT" || statusUpper === "INTERVALO" || statusUpper.includes("HALF");

  if (isFinished || isHT) {
    return null;
  }

  const is1T = minute <= 45 && statusUpper !== "2H" && statusUpper !== "2T";
  const is2T = minute > 45 || statusUpper === "2H" || statusUpper === "2T";

  const totalGoals = (match.score?.home ?? 0) + (match.score?.away ?? 0);
  const homeScore = match.score?.home ?? 0;
  const awayScore = match.score?.away ?? 0;

  // Confluence and rules analysis evaluation
  const isConfluent = !!rulesAnalysis?.imminentGoal?.isConfluent || !!rulesAnalysis?.trendAlert?.isConfluent;
  const imminent = rulesAnalysis?.imminentGoal;
  const trend = rulesAnalysis?.trendAlert;

  const hasImminentAlert = !!imminent?.isImminent && imminent.intensity !== "nenhuma";
  const hasTrendAlert = !!trend?.qualified;

  // A sugestão só é válida e informada quando a partida emitir um alerta de TREND ou Surto
  if (!hasImminentAlert && !hasTrendAlert) {
    return null;
  }

  // Identify dominant team if any
  const dominantSide = imminent?.team || trend?.team || null;
  const dominantName = dominantSide === "home" ? match.homeTeam.name : dominantSide === "away" ? match.awayTeam.name : (imminent?.teamName || trend?.teamName || "");

  // If neither rule is active, but there are other operational alerts, check them
  const hasPressureSignal = hasImminentAlert || hasTrendAlert || !!rulesAnalysis?.hasActiveOperationalAlert;

  // Cutoffs
  const cutoff1T = config?.superPressureConfig?.cutoff1T ?? 38;
  const cutoff2T = config?.superPressureConfig?.cutoff2T ?? 82;

  // ──────────────────────────────────────────────────────────
  // 1º TEMPO (1T): Apenas Over Limite HT (Gols). Match Odds bloqueado.
  // ──────────────────────────────────────────────────────────
  if (is1T) {
    // Cutoff check
    if (minute >= cutoff1T) {
      return {
        marketType: "OVER_HT",
        marketLabel: "Over Gols HT",
        targetLine: `Over ${totalGoals + 0.5} HT`,
        recommendedOddMin: 1.60,
        action: "NO_ENTRY",
        actionLabel: "Cutoff Atingido (38')",
        actionBadgeColor: "bg-slate-800 text-slate-400 border-slate-700",
        convictionLevel: "NEUTRA",
        convictionBadgeColor: "bg-slate-800 text-slate-400",
        justification: "Tempo regulamentar do 1º tempo avançado (> 38'). Risco de tempo insuficiente para conversão.",
        isConfluent: false,
        cutoffBlocked: true,
      };
    }

    // Determine target odd requirement
    const minOdd = isConfluent ? 1.45 : 1.60;
    const targetLine = `Over ${totalGoals + 0.5} HT`;

    // Estimate current live market odd roughly based on minute if not provided
    // Between 20' and 30', Over 0.5 HT typically scales from 1.30 to 1.65
    // In minute 30-35, it crosses 1.70-1.90
    const estimatedOdd = Number(
      (1.20 + (Math.max(0, minute - 15) * 0.035) + (totalGoals * 0.15)).toFixed(2)
    );

    let action: MarketAction = "ENTER_NOW";
    let actionLabel = "Entrar Agora";
    let actionBadgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

    if (estimatedOdd < minOdd && minute < 28) {
      action = "SNIPE";
      actionLabel = "Snipe / Aguardar Odd";
      actionBadgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse";
    }

    const convictionLevel: ConvictionLevel = isConfluent
      ? "MAX"
      : (hasImminentAlert && hasTrendAlert)
      ? "MAX"
      : (hasImminentAlert || hasTrendAlert)
      ? "ALTA"
      : "MODERADA";

    const convictionBadgeColor =
      convictionLevel === "MAX"
        ? "bg-rose-500 text-white font-black"
        : convictionLevel === "ALTA"
        ? "bg-emerald-500 text-slate-950 font-bold"
        : "bg-amber-500/80 text-slate-950 font-bold";

    let justification = "";
    if (isConfluent) {
      justification = `CONFLUÊNCIA CONFIRMADA: Super Pressão (R1) e Surto 5m (R7) no mesmo time (${dominantName}). Exigência de Odd reduzida para ${minOdd.toFixed(2)}.`;
    } else if (hasImminentAlert) {
      justification = `Surto ofensivo imediato (R7) com pressão recente. Busque ${targetLine} @ ${minOdd.toFixed(2)}+.`;
    } else if (hasTrendAlert) {
      justification = `Pressão contínua sustentada (R1). Monitorar valor no ${targetLine}.`;
    } else {
      justification = `Monitorando pressão no 1T para entrada em ${targetLine}.`;
    }

    return {
      marketType: "OVER_HT",
      marketLabel: "Over Limite HT",
      targetLine,
      recommendedOddMin: minOdd,
      currentEstimatedOdd: estimatedOdd,
      action,
      actionLabel,
      actionBadgeColor,
      convictionLevel,
      convictionBadgeColor,
      justification,
      isConfluent,
      teamTarget: dominantName || undefined,
    };
  }

  // ──────────────────────────────────────────────────────────
  // 2º TEMPO (2T): Over Limite FT ou Match Odds (Back/Lay).
  // ──────────────────────────────────────────────────────────
  if (is2T) {
    // Cutoff check
    if (minute >= cutoff2T) {
      return {
        marketType: "OVER_FT",
        marketLabel: "Mercados FT",
        targetLine: `Over ${totalGoals + 0.5} FT`,
        recommendedOddMin: 1.50,
        action: "NO_ENTRY",
        actionLabel: "Cutoff Atingido (82')",
        actionBadgeColor: "bg-slate-800 text-slate-400 border-slate-700",
        convictionLevel: "NEUTRA",
        convictionBadgeColor: "bg-slate-800 text-slate-400",
        justification: "Reta final de partida (> 82'). Entrada em gols ou Match Odds bloqueada por cutoff de segurança.",
        isConfluent: false,
        cutoffBlocked: true,
      };
    }

    // Check Match Odds suitability:
    // Only suggest Match Odds if match is tied OR dominant team is trailing by 1 goal
    const isTied = homeScore === awayScore;
    const isHomeDominant = dominantSide === "home";
    const isAwayDominant = dominantSide === "away";
    const isDominantTrailing =
      (isHomeDominant && awayScore - homeScore === 1) ||
      (isAwayDominant && homeScore - awayScore === 1);

    const qualifyMatchOdds = (isTied || isDominantTrailing) && Boolean(dominantName);

    // If Match Odds qualifies with strong dominance, we can prioritize or propose Match Odds
    if (qualifyMatchOdds && (hasImminentAlert || hasTrendAlert)) {
      const matchOddsType = isDominantTrailing ? `Back ${dominantName} (Reação)` : `Back ${dominantName}`;
      const minOddMO = isConfluent ? 1.50 : 1.70;

      const estimatedOddMO = isDominantTrailing ? 2.80 : 1.85;

      const convictionLevel: ConvictionLevel = isConfluent ? "MAX" : "ALTA";
      const convictionBadgeColor =
        convictionLevel === "MAX"
          ? "bg-rose-500 text-white font-black"
          : "bg-emerald-500 text-slate-950 font-bold";

      return {
        marketType: "MATCH_ODDS",
        marketLabel: "Match Odds (Back)",
        targetLine: matchOddsType,
        recommendedOddMin: minOddMO,
        currentEstimatedOdd: estimatedOddMO,
        action: "ENTER_NOW",
        actionLabel: "Back Favorito",
        actionBadgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        convictionLevel,
        convictionBadgeColor,
        justification: isDominantTrailing
          ? `${dominantName} em desvantagem mínima sufocando no 2T. Grande probabilidade de empate ou virada.`
          : `Empate no 2T com ${dominantName} em controle total e pressão extrema.`,
        isConfluent,
        teamTarget: dominantName,
      };
    }

    // Default 2T: Over Limite FT
    const targetLine = `Over ${totalGoals + 0.5} FT`;
    const minOdd = isConfluent ? 1.40 : 1.65;

    // Estimate current live market odd for next goal FT
    // In minute 60-70, Over FT is usually 1.40-1.70 depending on score
    const estimatedOdd = Number(
      (1.25 + (Math.max(0, minute - 50) * 0.025) + (totalGoals * 0.05)).toFixed(2)
    );

    let action: MarketAction = "ENTER_NOW";
    let actionLabel = "Entrar Agora";
    let actionBadgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

    if (estimatedOdd < minOdd && minute < 68) {
      action = "SNIPE";
      actionLabel = "Snipe / Aguardar Odd";
      actionBadgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse";
    }

    const convictionLevel: ConvictionLevel = isConfluent
      ? "MAX"
      : (hasImminentAlert && hasTrendAlert)
      ? "MAX"
      : (hasImminentAlert || hasTrendAlert)
      ? "ALTA"
      : "MODERADA";

    const convictionBadgeColor =
      convictionLevel === "MAX"
        ? "bg-rose-500 text-white font-black"
        : convictionLevel === "ALTA"
        ? "bg-emerald-500 text-slate-950 font-bold"
        : "bg-amber-500/80 text-slate-950 font-bold";

    let justification = "";
    if (isConfluent) {
      justification = `CONFLUÊNCIA NO 2T: Super Pressão e Surto 5m sincronizados (${dominantName || "Ofensiva"}). Odd mínima de entrada: ${minOdd.toFixed(2)}.`;
    } else if (hasImminentAlert) {
      justification = `Blitz e volume de finalizações no 2T. Entrada limpa em ${targetLine}.`;
    } else if (hasTrendAlert) {
      justification = `Pressão contínua acumulada sustentada no 2T. Aguardar odd mínima de ${minOdd.toFixed(2)}.`;
    } else {
      justification = `Pressão ofensiva favorável para gol no 2T.`;
    }

    return {
      marketType: "OVER_FT",
      marketLabel: "Over Limite FT",
      targetLine,
      recommendedOddMin: minOdd,
      currentEstimatedOdd: estimatedOdd,
      action,
      actionLabel,
      actionBadgeColor,
      convictionLevel,
      convictionBadgeColor,
      justification,
      isConfluent,
      teamTarget: dominantName || undefined,
    };
  }

  return null;
}
