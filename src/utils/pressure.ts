// src/utils/pressure.ts
import { MatchStats, MomentumPoint } from "../types";

export type PressureIntensity = "baixa" | "moderada" | "alta" | "extrema";
export type DangerLevel = "baixo" | "medio" | "alto" | "critico";
export type DominanceTrend = "home" | "away" | "neutral";

export interface PressureContext {
  score?: { home: number; away: number };
  redCards?: { home: number; away: number };
  windowMinutes?: number; // Janela configurável em minutos (ex: 5, 7, 10, 15)
}

export interface DetailedPressureResult {
  home: number; // 5% a 95%
  away: number; // 5% a 95%
  trend: DominanceTrend;
  dominanceText: string;
  intensity: PressureIntensity;
  dangerLevel: DangerLevel;
  sterilePossessionHome: boolean;
  sterilePossessionAway: boolean;
  rawScoreHome: number;
  rawScoreAway: number;
  totalDangerScore: number;
  explanation: string;
}

/**
 * Motor Avançado de Cálculo de Pressão e Momentum Ofensivo:
 * 1. Desacoplamento temporal: evita distorção de dados acumulados antigos (peso de 70% na janela recente).
 * 2. Filtro Anti-Posse Inútil (Sterile Possession): posse de bola sem finalizações ou entradas no terço final não infla pressão.
 * 3. Conversão de Ameaça Real: chances claras (BC), xG, xGOT, finalizações no alvo e defesas forçadas no goleiro adversário.
 * 4. Ajuste por Estado do Jogo: urgência do placar e impacto de cartões vermelhos.
 * 5. Termômetro de Intensidade Absoluta: evita falsa ilusão de 50%/50% em jogos truncados/mornos.
 */
export function calculateAdvancedPressure(
  stats: Partial<MatchStats> | undefined,
  minute: number = 45,
  context?: PressureContext,
  momentumTimeline?: MomentumPoint[]
): DetailedPressureResult {
  if (!stats) {
    return {
      home: 50,
      away: 50,
      trend: "neutral",
      dominanceText: "Sem Dados Estatísticos",
      intensity: "baixa",
      dangerLevel: "baixo",
      sterilePossessionHome: false,
      sterilePossessionAway: false,
      rawScoreHome: 0,
      rawScoreAway: 0,
      totalDangerScore: 0,
      explanation: "Aguardando início ou coleta de dados da partida.",
    };
  }

  const effectiveMin = Math.max(1, Math.min(125, minute));

  // Extração segura das métricas
  const dangH = Math.max(0, Number(stats.dangerousAttacks?.home || 0));
  const dangA = Math.max(0, Number(stats.dangerousAttacks?.away || 0));
  const dang10H = Math.max(0, Number(stats.dangerousAttacksLast10?.home || 0));
  const dang10A = Math.max(0, Number(stats.dangerousAttacksLast10?.away || 0));
  const attacksH = Math.max(0, Number(stats.attacks?.home || 0));
  const attacksA = Math.max(0, Number(stats.attacks?.away || 0));

  const sotH = Math.max(0, Number(stats.shotsOnTarget?.home || 0));
  const sotA = Math.max(0, Number(stats.shotsOnTarget?.away || 0));
  const soffH = Math.max(0, Number(stats.shotsOffTarget?.home || 0));
  const soffA = Math.max(0, Number(stats.shotsOffTarget?.away || 0));
  const blockedH = Math.max(0, Number(stats.blockedShots?.home || 0));
  const blockedA = Math.max(0, Number(stats.blockedShots?.away || 0));
  const cornH = Math.max(0, Number(stats.corners?.home || 0));
  const cornA = Math.max(0, Number(stats.corners?.away || 0));

  const xgH = Math.max(0, Number(stats.xG?.home || 0));
  const xgA = Math.max(0, Number(stats.xG?.away || 0));
  const xgotH = Math.max(0, Number(stats.xGOT?.home || 0));
  const xgotA = Math.max(0, Number(stats.xGOT?.away || 0));
  const bcH = Math.max(0, Number(stats.bigChances?.home || 0));
  const bcA = Math.max(0, Number(stats.bigChances?.away || 0));

  // Defesas forçadas: defesas feitas pelo goleiro visitante refletem perigo do mandante!
  const savesForcedH = Math.max(0, Number(stats.saves?.away || 0));
  const savesForcedA = Math.max(0, Number(stats.saves?.home || 0));

  const possH = Number(stats.possession?.home ?? 50);
  const possA = Number(stats.possession?.away ?? 50);

  // 1. Velocidade de Ataque Recente vs Global (Ataques Perigosos / Minuto)
  const apmGlobalH = dangH / Math.max(5, effectiveMin);
  const apmGlobalA = dangA / Math.max(5, effectiveMin);

  let apmRecentH = dang10H > 0 ? (dang10H / 10) : (stats.apmLast10?.home ? Number(stats.apmLast10.home) : apmGlobalH);
  let apmRecentA = dang10A > 0 ? (dang10A / 10) : (stats.apmLast10?.away ? Number(stats.apmLast10.away) : apmGlobalA);

  // Blended Attack Velocity (75% foco na janela recente de 10m, 25% no histórico por minuto)
  const attackVelocityH = (apmRecentH * 0.75) + (apmGlobalH * 0.25);
  const attackVelocityA = (apmRecentA * 0.75) + (apmGlobalA * 0.25);

  // 2. Filtro de Posse Estéril (Anti-Posse Inútil)
  // Posse alta (>= 56%) com menos de 0.25 APM recente e sem finalizações no alvo é posse estéril (troca de passes na zaga)
  const isSterileH = possH >= 56 && apmRecentH < 0.28 && sotH === 0 && xgH < 0.25;
  const isSterileA = possA >= 56 && apmRecentA < 0.28 && sotA === 0 && xgA < 0.25;

  const penRatioH = attacksH > 0 ? Math.min(1.0, Math.max(0.15, dangH / attacksH)) : 0.35;
  const penRatioA = attacksA > 0 ? Math.min(1.0, Math.max(0.15, dangA / attacksA)) : 0.35;

  const effectivePossScoreH = isSterileH
    ? (possH * 0.04) // Redução severa para posse inócua
    : (possH * 0.18) * (0.6 + penRatioH * 0.8);

  const effectivePossScoreA = isSterileA
    ? (possA * 0.04)
    : (possA * 0.18) * (0.6 + penRatioA * 0.8);

  // 3. Conversão de Ameaça e Finalizações Qualificadas
  // Normalização pelo progresso do jogo para evitar que finalizações do 1º tempo distorçam a realidade do 2º tempo
  // Reduz a inércia de chutes antigos do 1T para dar espaço a viradas dinâmicas no 2T
  const timeDecayFactor = effectiveMin > 15 ? Math.max(0.2, (20 / effectiveMin)) : 1.0;

  const rawThreatH =
    (bcH * 6.5) + // Chances claras têm altíssimo valor preditivo
    (xgH * 8.5) +
    (xgotH * 4.5) +
    (sotH * 3.6) +
    (savesForcedH * 3.0) +
    (cornH * 2.0) +
    (soffH * 1.1) +
    (blockedH * 0.9);

  const rawThreatA =
    (bcA * 6.5) +
    (xgA * 8.5) +
    (xgotA * 4.5) +
    (sotA * 3.6) +
    (savesForcedA * 3.0) +
    (cornA * 2.0) +
    (soffA * 1.1) +
    (blockedA * 0.9);

  const normalizedThreatH = rawThreatH * (0.2 + 0.8 * timeDecayFactor);
  const normalizedThreatA = rawThreatA * (0.2 + 0.8 * timeDecayFactor);

  // Pontuação base de perigo
  let rawScoreH = (attackVelocityH * 32.0) + normalizedThreatH + effectivePossScoreH;
  let rawScoreA = (attackVelocityA * 32.0) + normalizedThreatA + effectivePossScoreA;

  // 4. Ajustes por Estado do Jogo (Placar e Cartão Vermelho)
  const homeScore = context?.score?.home ?? (stats as any)?.score?.home ?? 0;
  const awayScore = context?.score?.away ?? (stats as any)?.score?.away ?? 0;
  const redH = context?.redCards?.home ?? stats.redCards?.home ?? 0;
  const redA = context?.redCards?.away ?? stats.redCards?.away ?? 0;

  // Urgência de placar: equipe em desvantagem no 2T com volume ofensivo ativo
  if (effectiveMin >= 55) {
    if (homeScore < awayScore && attackVelocityH > 0.3) {
      rawScoreH *= 1.12; // Bônus de urgência ofensiva do mandante
    } else if (awayScore < homeScore && attackVelocityA > 0.3) {
      rawScoreA *= 1.12; // Bônus de urgência ofensiva do visitante
    }
  }

  // Impacto de Cartão Vermelho: adversário com superioridade numérica ataca com mais espaço
  if (redA > redH) {
    rawScoreH *= (1 + 0.15 * (redA - redH));
  } else if (redH > redA) {
    rawScoreA *= (1 + 0.15 * (redH - redA));
  }

  // 5. Integração com Micro-Momento Recente (MomentumTimeline)
  // Utiliza janela móvel configurável (padrão 7 minutos; 5 minutos no getLivePressure5Min) com decaimento exponencial
  // REGRA CRÍTICA: No 2º Tempo (minuto >= 46), a janela NÃO pode cruzar o intervalo (HT) nem usar pontos do 1º Tempo!
  const recentWindowMin = Math.max(3, Math.min(25, context?.windowMinutes || 7));
  if (momentumTimeline && Array.isArray(momentumTimeline) && momentumTimeline.length > 0) {
    const curMin = effectiveMin > 0 ? effectiveMin : (momentumTimeline[momentumTimeline.length - 1]?.minute || 45);
    const isSecondHalf = curMin >= 46;
    const windowStartMin = isSecondHalf
      ? Math.max(46, curMin - recentWindowMin)
      : Math.max(1, curMin - recentWindowMin);

    const lastWindowPoints = momentumTimeline.filter(
      (pt) => pt.minute >= windowStartMin && pt.minute <= curMin
    );

    if (lastWindowPoints.length > 0) {
      let microSumH = 0;
      let microSumA = 0;
      let microWeight = 0;

      lastWindowPoints.forEach((pt, idx) => {
        // Peso exponencial progressivo nos minutos mais recentes (1.0, 1.3, 1.69, 2.20...)
        const w = Math.pow(1.3, idx);
        const hP = pt.homePressure ?? 50;
        const aP = pt.awayPressure ?? 50;
        const eventBonusH = (pt.homeDangerousAttack ? 16 : 0) + (pt.homeShot ? 30 : 0);
        const eventBonusA = (pt.awayDangerousAttack ? 16 : 0) + (pt.awayShot ? 30 : 0);

        microSumH += (hP + eventBonusH) * w;
        microSumA += (aP + eventBonusA) * w;
        microWeight += w;
      });

      const microAvgH = microSumH / (microWeight || 1);
      const microAvgA = microSumA / (microWeight || 1);
      const microTotal = microAvgH + microAvgA;

      if (microTotal > 0) {
        // 75% foco na dinâmica real da janela recente, 25% na pontuação global normalizada
        const microPctH = (microAvgH / microTotal) * 100;
        const currentThreatSum = rawScoreH + rawScoreA;
        const currentPctH = currentThreatSum > 0 ? (rawScoreH / currentThreatSum) * 100 : 50;
        const blendedPctH = Math.round(microPctH * 0.75 + currentPctH * 0.25);

        // Preserva a magnitude real de perigo em vez de forçar a soma para 100
        if (currentThreatSum > 0) {
          rawScoreH = (currentThreatSum * blendedPctH) / 100;
          rawScoreA = (currentThreatSum * (100 - blendedPctH)) / 100;
        } else {
          rawScoreH = 0;
          rawScoreA = 0;
        }
      }
    }
  }

  // 6. Verificação de Dados Reais de Ataque e Cálculo da Intensidade Absoluta
  const totalAttackingActions = dangH + dangA + sotH + sotA + soffH + soffA + cornH + cornA + bcH + bcA;
  const hasRealActivity = totalAttackingActions > 0 || (attackVelocityH > 0.1 || attackVelocityA > 0.1);

  let totalDangerScore = Math.round(rawScoreH + rawScoreA);
  if (!hasRealActivity) {
    totalDangerScore = 0;
  }

  let intensity: PressureIntensity = "baixa";
  let dangerLevel: DangerLevel = "baixo";

  if (!hasRealActivity || totalDangerScore < 20) {
    intensity = "baixa";
    dangerLevel = "baixo";
  } else if (totalDangerScore >= 100) {
    intensity = "extrema";
    dangerLevel = "critico";
  } else if (totalDangerScore >= 55) {
    intensity = "alta";
    dangerLevel = "alto";
  } else {
    intensity = "moderada";
    dangerLevel = "medio";
  }

  // Normalização relativa percentual (0 a 100)
  let pctHome = 50;
  let pctAway = 50;

  if (hasRealActivity && totalDangerScore > 0) {
    pctHome = Math.round((rawScoreH / (rawScoreH + rawScoreA)) * 100);
    pctHome = Math.max(5, Math.min(95, pctHome));
    pctAway = 100 - pctHome;
  }

  // 7. Determinação do Trend e Diagnóstico Textual Preciso
  // Filtro de Transição / Constância: verifica consistência por pelo menos 2-3 ciclos
  // ou presença de evento contundente (chute/ataque perigoso) antes de virar a dominância
  const recentPointsForFilter = momentumTimeline && momentumTimeline.length > 0 ? momentumTimeline.slice(-3) : [];
  const homeCyclesDominant = recentPointsForFilter.filter(p => (p.homePressure ?? 50) >= 57).length;
  const awayCyclesDominant = recentPointsForFilter.filter(p => (p.awayPressure ?? 50) >= 57).length;
  const homeHasDecisiveAction = recentPointsForFilter.some(p => p.homeShot || p.homeDangerousAttack) || dang10H >= 2 || sotH > 0;
  const awayHasDecisiveAction = recentPointsForFilter.some(p => p.awayShot || p.awayDangerousAttack) || dang10A >= 2 || sotA > 0;

  const homeDominanceConfirmed = homeCyclesDominant >= 2 || homeHasDecisiveAction || recentPointsForFilter.length < 2;
  const awayDominanceConfirmed = awayCyclesDominant >= 2 || awayHasDecisiveAction || recentPointsForFilter.length < 2;

  let trend: DominanceTrend = "neutral";
  let dominanceText = "Ritmo Equilibrado";
  let explanation = "";

  if (!hasRealActivity) {
    trend = "neutral";
    dominanceText = "Ritmo Equilibrado";
    explanation = "Aguardando volume de jogo ou dados estatísticos da partida.";
  } else if (intensity === "baixa") {
    trend = "neutral";
    dominanceText = "Jogo Truncado / Baixo Ritmo (Sem Pressão)";
    explanation = "Pouquíssimas finalizações e ataques travados no meio de campo.";
  } else if (isSterileH && !isSterileA) {
    trend = pctAway > 55 && awayDominanceConfirmed ? "away" : "neutral";
    dominanceText = "Posse Estéril Mandante (Sem Ameaça)";
    explanation = "Mandante retém a posse de bola sem penetração na área ou finalizações.";
  } else if (isSterileA && !isSterileH) {
    trend = pctHome > 55 && homeDominanceConfirmed ? "home" : "neutral";
    dominanceText = "Posse Estéril Visitante (Sem Ameaça)";
    explanation = "Visitante retém a posse de bola sem penetração na área ou finalizações.";
  } else if (pctHome >= 60) {
    if (homeDominanceConfirmed) {
      trend = "home";
      if (pctHome >= 72) {
        dominanceText = intensity === "extrema" ? "Blitz Asfixiante Mandante" : "Pressão Dominante Mandante";
        explanation = `Mandante com alto volume de ataques perigosos (${dang10H} nos últimos 10m) e pressão territorial sustentada.`;
      } else {
        dominanceText = "Pressão Ofensiva Mandante";
        explanation = `Mandante no controle do ritmo ofensivo com ${sotH} finalizações certas.`;
      }
    } else {
      trend = "neutral";
      dominanceText = "Reação Mandante (Em Confirmação)";
      explanation = "Mandante inicia volume ofensivo recente, aguardando consolidação por 2-3 ciclos.";
    }
  } else if (pctAway >= 60) {
    if (awayDominanceConfirmed) {
      trend = "away";
      if (pctAway >= 72) {
        dominanceText = intensity === "extrema" ? "Blitz Asfixiante Visitante" : "Pressão Dominante Visitante";
        explanation = `Visitante com alto volume de ataques perigosos (${dang10A} nos últimos 10m) e pressão territorial sustentada.`;
      } else {
        dominanceText = "Pressão Ofensiva Visitante";
        explanation = `Visitante no controle do ritmo ofensivo com ${sotA} finalizações certas.`;
      }
    } else {
      trend = "neutral";
      dominanceText = "Reação Visitante (Em Confirmação)";
      explanation = "Visitante inicia volume ofensivo recente, aguardando consolidação por 2-3 ciclos.";
    }
  } else {
    trend = "neutral";
    const bothActive = (dang10H >= 3 && dang10A >= 3) || ((sotH + soffH) >= 2 && (sotA + soffA) >= 2);
    if ((intensity === "alta" || intensity === "extrema") && bothActive && totalAttackingActions >= 8) {
      dominanceText = "Trocação Franca (Alta Intensidade)";
      explanation = "Ambas as equipes atacam com velocidade e criam perigo alternado.";
    } else if (intensity === "alta" || intensity === "extrema") {
      dominanceText = "Disputa Intensa (Equilibrada)";
      explanation = "Ritmo acelerado no meio de campo com chegadas alternadas.";
    } else {
      dominanceText = "Pressão Equilibrada";
      explanation = "Disputa equilibrada no meio de campo com poucas chances claras.";
    }
  }

  return {
    home: pctHome,
    away: pctAway,
    trend,
    dominanceText,
    intensity,
    dangerLevel,
    sterilePossessionHome: isSterileH,
    sterilePossessionAway: isSterileA,
    rawScoreHome: Math.round(rawScoreH * 10) / 10,
    rawScoreAway: Math.round(rawScoreA * 10) / 10,
    totalDangerScore,
    explanation,
  };
}

/**
 * Utilitário para cálculo do Índice de Pressão nos últimos 5 minutos (0 a 100%)
 * Mantém compatibilidade total com interfaces existentes e adiciona diagnósticos detalhados.
 */
export function getLivePressure5Min(
  stats: Partial<MatchStats> | undefined,
  minute: number = 45,
  momentumTimeline?: MomentumPoint[],
  context?: PressureContext
): DetailedPressureResult {
  const ctx5: PressureContext = {
    ...context,
    windowMinutes: 5,
  };
  return calculateAdvancedPressure(stats, minute, ctx5, momentumTimeline);
}

/**
 * Utilitário para cálculo do Índice de Pressão Geral da partida
 */
export function getLivePressure(
  stats: Partial<MatchStats> | undefined,
  minute: number = 45,
  context?: PressureContext,
  momentumTimeline?: MomentumPoint[]
): DetailedPressureResult {
  return calculateAdvancedPressure(stats, minute, context, momentumTimeline);
}


