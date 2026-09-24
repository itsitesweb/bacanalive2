// src/utils/marketRecommendation.ts
import { Match, OperationalRulesConfig, RuleConfluenceState, MarketRecommendation, RecommendationAction } from "../types";

/**
 * Motor de Decisão Tática e Recomendações de Mercado (PROMPT #11)
 * Avalia cutoffs, minutagem, placar, confluência e restringe mercados (Proibido escanteios, Match Odds restrito no 1T).
 */
export function getMarketRecommendation(
  match: Match,
  rulesConfig?: OperationalRulesConfig | null,
  confluenceState?: RuleConfluenceState | null
): MarketRecommendation {
  const minute = match.minute || 0;
  const statusUpper = (match.status || "").toUpperCase();
  const isFinished = statusUpper === "FT" || statusUpper === "FINISHED" || statusUpper === "ENCERRADO" || minute >= 90;
  const isHT = statusUpper === "HT" || statusUpper === "INT" || statusUpper === "INTERVALO" || statusUpper.includes("HALF");

  if (isFinished || isHT) {
    return {
      action: 'NO_TRADE',
      marketTitle: 'Partida Encerrada / Intervalo',
      marketCode: 'NO_TRADE',
      targetOdd: 0.0,
      reasoning: 'Mercados pausados no intervalo ou fim de jogo.',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }

  const is1T = minute <= 45 && statusUpper !== "2H" && statusUpper !== "2T";
  const is2T = minute > 45 || statusUpper === "2H" || statusUpper === "2T";

  const totalGoals = (match.score?.home ?? 0) + (match.score?.away ?? 0);
  const homeScore = match.score?.home ?? 0;
  const awayScore = match.score?.away ?? 0;

  const cutoff1T = rulesConfig?.superPressureConfig?.cutoff1T ?? rulesConfig?.superPressureConfig?.cutoffMinute1T ?? 38;
  const cutoff2T = rulesConfig?.superPressureConfig?.cutoff2T ?? rulesConfig?.superPressureConfig?.cutoffMinute2T ?? 82;

  const isConfluent = !!confluenceState?.isConfluent;

  // ──────────────────────────────────────────────────────────
  // 1º TEMPO (1T)
  // ──────────────────────────────────────────────────────────
  if (is1T) {
    // 05'-20': "🛑 NÃO APOSTAR" (Mercado sem maturação)
    if (minute < 20) {
      return {
        action: 'NO_TRADE',
        marketTitle: 'Aguardando Maturação (1T)',
        marketCode: 'MATURACAO_1T',
        targetOdd: 1.60,
        reasoning: `Minuto ${minute}' < 20': Fase inicial de estudo. Mercado sem maturação estatística suficiente.`,
        badgeClass: 'bg-slate-900 text-slate-400 border-slate-800',
      };
    }

    // 38'+: "🛑 NÃO APOSTAR (Cutoff 1T)"
    if (minute >= cutoff1T) {
      return {
        action: 'NO_TRADE',
        marketTitle: 'Cutoff 1º Tempo Atingido',
        marketCode: 'CUTOFF_1T',
        targetOdd: 1.60,
        reasoning: `Minuto ${minute}' ≥ ${cutoff1T}': Risco de tempo insuficiente para conversão e cera.`,
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      };
    }

    // Match Odds é estritamente PROIBIDO no 1T
    // 20'-38' com isConfluent = true: "🚀 ENTRADA IMEDIATA (MAX): Over Gols HT" (Odd Piso >= 1.40)
    if (isConfluent) {
      return {
        action: 'GO_MAX',
        marketTitle: '🚀 ENTRADA IMEDIATA (MAX): Over Gols HT',
        marketCode: 'OVER_HT_CONFLUENT',
        targetOdd: 1.40,
        reasoning: `Confluência máxima ativada no 1T! Regra 1 e Regra 7 sincronizadas para Over Gols HT (Placar: ${homeScore}-${awayScore}).`,
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse font-black',
        isConfluent: true,
      };
    }

    // 20'-38' (1x0 Fav Vencendo): "⏳ AGUARDAR (SNIPE)" para Over 1.5 HT se Odd >= 1.80 aos 33'-35'
    if (totalGoals === 1 && minute >= 30 && minute <= 36) {
      return {
        action: 'SNIPE',
        marketTitle: '⏳ AGUARDAR (SNIPE): Over 1.5 HT',
        marketCode: 'SNIPE_OVER_15_HT',
        targetOdd: 1.80,
        reasoning: `Placar 1-0 aos ${minute}'. Aguardar janela de sniper (33'-35') para buscar Over 1.5 HT com Odd ≥ 1.80.`,
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    }

    // 20'-38' (0x0 / Fav Pressionando): "🎯 ENTRADA LIBERADA: Over 0.5 HT" se Odd >= 1.60. Se Odd < 1.60, "⏳ AGUARDAR (SNIPE)" (Entrar 33'-35')
    if (totalGoals === 0) {
      const estimatedOdd = Number((1.30 + (minute - 20) * 0.025).toFixed(2));
      if (estimatedOdd >= 1.60) {
        return {
          action: 'ENTER',
          marketTitle: '🎯 ENTRADA LIBERADA: Over 0.5 HT',
          marketCode: 'OVER_05_HT',
          targetOdd: 1.60,
          reasoning: `Pressão no 0x0 aos ${minute}'. Odd estimada (${estimatedOdd}) atinge o piso mínimo (≥ 1.60).`,
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      } else {
        return {
          action: 'SNIPE',
          marketTitle: '⏳ AGUARDAR (SNIPE): Over 0.5 HT',
          marketCode: 'SNIPE_OVER_05_HT',
          targetOdd: 1.60,
          reasoning: `Odd atual abaixo de 1.60 (${estimatedOdd}). Aguardar maturação até 33'-35' (Snipe).`,
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      }
    }

    // Padrão 1T se houver volume
    return {
      action: 'ENTER',
      marketTitle: '🎯 ENTRADA LIBERADA: Over Gols HT',
      marketCode: 'OVER_GOLS_HT',
      targetOdd: 1.65,
      reasoning: `Volume ofensivo ativo no 1º tempo aos ${minute}'.`,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  }

  // ──────────────────────────────────────────────────────────
  // 2º TEMPO (2T)
  // ──────────────────────────────────────────────────────────
  if (is2T) {
    // 46'-55': "🛑 NÃO APOSTAR" (Estudo pós-intervalo)
    if (minute <= 55) {
      return {
        action: 'NO_TRADE',
        marketTitle: 'Estudo Pós-Intervalo (2T)',
        marketCode: 'ESTUDO_2T',
        targetOdd: 1.70,
        reasoning: `Minuto ${minute}' (46'-55'): Janela de reajuste tático pós-intervalo. Aguardar consolidação do ritmo.`,
        badgeClass: 'bg-slate-900 text-slate-400 border-slate-800',
      };
    }

    // 82'+: "🛑 NÃO APOSTAR (Cutoff Final)"
    if (minute >= cutoff2T) {
      return {
        action: 'NO_TRADE',
        marketTitle: 'Cutoff Final Atingido (82\')',
        marketCode: 'CUTOFF_2T',
        targetOdd: 1.70,
        reasoning: `Minuto ${minute}' ≥ ${cutoff2T}': Reta final de jogo. Entradas bloqueadas por segurança.`,
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      };
    }

    // 60'-82' com isConfluent = true: "🚀 ENTRADA IMEDIATA (MAX): Back Favorito / Over FT" (Odd Piso >= 1.45)
    if (isConfluent && minute >= 60) {
      return {
        action: 'GO_MAX',
        marketTitle: '🚀 ENTRADA IMEDIATA (MAX): Back Favorito / Over FT',
        marketCode: 'BACK_OVER_FT_CONFLUENT',
        targetOdd: 1.45,
        reasoning: `Confluência máxima no 2º tempo aos ${minute}'! Pressão contínua e surto 5m confirmados. Odd piso ≥ 1.45.`,
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse font-black',
        isConfluent: true,
      };
    }

    // 70'-82' (1x0 Fav Vencendo): "🛑 NÃO APOSTAR" (Match Odds esmagada, sem EV+)
    if (Math.abs(homeScore - awayScore) === 1 && minute >= 70 && minute <= 82) {
      return {
        action: 'NO_TRADE',
        marketTitle: '🛑 NÃO APOSTAR: Match Odds Esmagada',
        marketCode: 'MO_ESMAGADA',
        targetOdd: 1.80,
        reasoning: `Placar de 1 gol de diferença no terço final (70'-82'). Odds de Match Odds desprovidas de EV+ (esmagadas).`,
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      };
    }

    // 75'-82' (0x0 ou 0x1 / Blitz Final): "🎯 ENTRADA LIBERADA: Over Gol Limite FT" (Odd >= 1.80)
    if (minute >= 75) {
      return {
        action: 'ENTER',
        marketTitle: '🎯 ENTRADA LIBERADA: Over Gol Limite FT',
        marketCode: 'OVER_LIMITE_FT',
        targetOdd: 1.80,
        reasoning: `Blitz final de jogo aos ${minute}'. Oportunidade em Over Gol Limite FT com Odd ≥ 1.80.`,
        badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      };
    }

    // 55'-75' (0x0 / Fav Pressionando): "🎯 ENTRADA LIBERADA: Back Favorito" (Odd >= 1.70) OU "Over 0.5 FT" (Odd >= 1.55)
    return {
      action: 'ENTER',
      marketTitle: '🎯 ENTRADA LIBERADA: Back Favorito / Over FT',
      marketCode: 'BACK_OR_OVER_2T',
      targetOdd: 1.70,
      reasoning: `Pressão sustentada no 2º tempo aos ${minute}'. Entrada liberada em Back Favorito ou Over FT.`,
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  }

  return {
    action: 'NO_TRADE',
    marketTitle: 'Aguardando Cenário Tático',
    marketCode: 'PENDING',
    targetOdd: 1.50,
    reasoning: 'Monitorando parâmetros da partida.',
    badgeClass: 'bg-slate-900 text-slate-400 border-slate-800',
  };
}
