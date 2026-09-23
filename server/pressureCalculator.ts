// server/pressureCalculator.ts
import { MatchStats, MomentumPoint } from "../src/types";
import {
  calculateAdvancedPressure,
  DetailedPressureResult,
  PressureContext,
  PressureIntensity,
  DangerLevel,
  DominanceTrend,
} from "../src/utils/pressure";

export type {
  DetailedPressureResult,
  PressureContext,
  PressureIntensity,
  DangerLevel,
  DominanceTrend,
};

/**
 * Calcula o Índice de Pressão Ofensiva Dinâmico em Tempo Real (0 a 100% para Mandante e Visitante)
 * utilizando o modelo de desacoplamento temporal, filtro anti-posse inútil, conversão de perigo
 * qualificado e contexto de jogo (placar e expulsões).
 */
export function calculateDynamicPressureIndex(
  stats: Partial<MatchStats> | undefined,
  minute: number = 45,
  context?: PressureContext,
  momentumTimeline?: MomentumPoint[]
): DetailedPressureResult {
  return calculateAdvancedPressure(stats, minute, context, momentumTimeline);
}

