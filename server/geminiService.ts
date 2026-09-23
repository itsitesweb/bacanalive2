// server/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { Match, TacticalAnalysis } from "../src/types";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gerenciamento de Cache e Cota (Rate-Limiting & Quota-Exhaustion Protection)
// ─────────────────────────────────────────────────────────────────────────────
interface CachedAnalysis {
  analysis: TacticalAnalysis;
  cachedAt: number;
  minute: number;
  scoreKey: string;
}

const analysisCache = new Map<string, CachedAnalysis>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos de validade por padrão
let quotaCooldownUntil = 0; // Timestamp até quando chamadas à API são suspensas por 429
const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // 5 minutos de proteção contra estourar cota

export function getGeminiStatus(): {
  isQuotaExhausted: boolean;
  cooldownRemainingSeconds: number;
  cachedAnalysesCount: number;
} {
  const now = Date.now();
  const isCooldown = now < quotaCooldownUntil;
  return {
    isQuotaExhausted: isCooldown,
    cooldownRemainingSeconds: isCooldown ? Math.ceil((quotaCooldownUntil - now) / 1000) : 0,
    cachedAnalysesCount: analysisCache.size,
  };
}

export async function generateTacticalAnalysis(match: Match): Promise<TacticalAnalysis> {
  const now = Date.now();
  const currentScoreKey = `${match.score.home}-${match.score.away}`;

  // 1. Verificação de Cache em Memória
  const cached = analysisCache.get(match.id);
  if (cached) {
    const isFresh = now - cached.cachedAt < CACHE_TTL_MS;
    const sameScore = cached.scoreKey === currentScoreKey;
    const minuteDiff = Math.abs(match.minute - cached.minute);

    // Se o placar não mudou, está dentro do TTL e a partida não avançou mais de 2 minutos
    if (isFresh && sameScore && minuteDiff <= 2) {
      return {
        ...cached.analysis,
        isCached: true,
      };
    }
  }

  // 2. Proteção contra Quota Exceeded (Cooldown Ativo)
  if (now < quotaCooldownUntil) {
    console.warn(`[Gemini] Cooldown ativo por cota esgotada (restam ${Math.ceil((quotaCooldownUntil - now) / 1000)}s). Usando fallback heurístico.`);
    const fallback = buildHeuristicTacticalAnalysis(match, true);
    return fallback;
  }

  // 3. Sem chave configurada?
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[Gemini] GEMINI_API_KEY não configurada. Usando fallback heurístico.");
    return buildHeuristicTacticalAnalysis(match, false);
  }

  const prompt = `Você é um analista tático sênior de futebol e especialista em análise de momentum e trading esportivo ao vivo.
Analise a partida atual com base nos dados estatísticos e de pressão em tempo real:

Jogo: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.league})
Placar: ${match.score.home} x ${match.score.away} | Minuto: ${match.minute}' (${match.status})
Posse de Bola: ${match.stats.possession.home}% vs ${match.stats.possession.away}%
xG (Gols Esperados): ${match.stats.xG.home.toFixed(2)} vs ${match.stats.xG.away.toFixed(2)}
Finalizações no Gol: ${match.stats.shotsOnTarget.home} vs ${match.stats.shotsOnTarget.away} (Fora: ${match.stats.shotsOffTarget.home} vs ${match.stats.shotsOffTarget.away})
Ataques Perigosos: ${match.stats.dangerousAttacks.home} vs ${match.stats.dangerousAttacks.away}
Ataques Perigosos últimos 10min: ${match.stats.dangerousAttacksLast10.home} vs ${match.stats.dangerousAttacksLast10.away}
Escanteios: ${match.stats.corners.home} vs ${match.stats.corners.away}
Cartões: Amarelos (${match.stats.yellowCards.home} vs ${match.stats.yellowCards.away}), Vermelhos (${match.stats.redCards.home} vs ${match.stats.redCards.away})
Índice de Pressão Atual (0-100): ${match.stats.pressureIndex.home} vs ${match.stats.pressureIndex.away}
Últimos Eventos: ${match.events.slice(-4).map(e => `${e.minute}' [${e.type}] ${e.team === 'home' ? match.homeTeam.name : match.awayTeam.name} ${e.player || ''}`).join(', ')}

Forneça um diagnóstico tático aprofundado e prático em Português do Brasil com recomendações analíticas sobre o fluxo do jogo, tendências de gols, escanteios e cartões.`;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Resumo conciso de 2 a 3 frases sobre o panorama atual do confronto e dinâmica de jogo.",
            },
            momentumVerdict: {
              type: Type.STRING,
              enum: ["home_dominant", "away_dominant", "balanced", "end_to_end"],
              description: "Veredito sobre o domínio da partida.",
            },
            likelyNextEvent: {
              type: Type.STRING,
              description: "Evento mais provável nos próximos 10-15 minutos (ex: 'Gol do time da casa por blitz ofensiva', 'Pressão de escanteios').",
            },
            nextGoalProbability: {
              type: Type.OBJECT,
              properties: {
                home: { type: Type.INTEGER, description: "Probabilidade % de gol do mandante (0 a 100)" },
                away: { type: Type.INTEGER, description: "Probabilidade % de gol do visitante (0 a 100)" },
                noGoal: { type: Type.INTEGER, description: "Probabilidade % de nenhum gol adicional (0 a 100)" },
              },
              required: ["home", "away", "noGoal"],
            },
            keyInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de 3 a 4 insights táticos práticos.",
            },
            cornerPressureScore: {
              type: Type.INTEGER,
              description: "Score de pressão para escanteios nos próximos minutos (0 a 100).",
            },
            cardRiskScore: {
              type: Type.INTEGER,
              description: "Score de risco de novos cartões devido à rispidez do jogo (0 a 100).",
            },
            tradingAngles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "1 a 3 ângulos táticos operacionais (ex: 'Valor em Over cantos', 'Favorito devendo gol').",
            },
          },
          required: [
            "summary",
            "momentumVerdict",
            "likelyNextEvent",
            "nextGoalProbability",
            "keyInsights",
            "cornerPressureScore",
            "cardRiskScore",
            "tradingAngles",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    const result: TacticalAnalysis = {
      matchId: match.id,
      summary: parsed.summary || "Análise concluída com base nas métricas ao vivo.",
      momentumVerdict: parsed.momentumVerdict || "balanced",
      likelyNextEvent: parsed.likelyNextEvent || "Disputa acirrada no meio-campo.",
      nextGoalProbability: parsed.nextGoalProbability || { home: 40, away: 30, noGoal: 30 },
      keyInsights: parsed.keyInsights || [
        "Equipe mandante mantendo alto volume no terço final.",
        "Transições rápidas do time visitante gerando contragolpes perigosos.",
      ],
      cornerPressureScore: parsed.cornerPressureScore || 65,
      cardRiskScore: parsed.cardRiskScore || 45,
      tradingAngles: parsed.tradingAngles || ["Acompanhar linha de escanteios asiáticos."],
      analyzedAt: new Date().toISOString(),
      source: "gemini",
      isCached: false,
      isQuotaExhausted: false,
    };

    // Salva no cache
    analysisCache.set(match.id, {
      analysis: result,
      cachedAt: now,
      minute: match.minute,
      scoreKey: currentScoreKey,
    });

    return result;
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    console.error("Erro ao gerar análise com Gemini:", errMsg);

    // Se o erro foi de cota ou rate-limiting (429, RESOURCE_EXHAUSTED)
    if (
      errMsg.includes("429") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("quota") ||
      errMsg.includes("rate limit")
    ) {
      quotaCooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
      console.warn(`[Gemini] Cota da API esgotada. Entrando em cooldown de 5 minutos até ${new Date(quotaCooldownUntil).toLocaleTimeString()}.`);
    }

    const fallback = buildHeuristicTacticalAnalysis(match, now < quotaCooldownUntil);
    
    // Salva o fallback no cache por 1 minuto para não repetir cálculos seguidos
    analysisCache.set(match.id, {
      analysis: fallback,
      cachedAt: now,
      minute: match.minute,
      scoreKey: currentScoreKey,
    });

    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Heurístico Avançado (Modo Econômico / Cooldown de Quota)
// ─────────────────────────────────────────────────────────────────────────────
function buildHeuristicTacticalAnalysis(match: Match, isQuotaExhausted: boolean): TacticalAnalysis {
  const homePressure = match.stats.pressureIndex.home;
  const awayPressure = match.stats.pressureIndex.away;
  const homeAttacks10 = match.stats.dangerousAttacksLast10.home || 0;
  const awayAttacks10 = match.stats.dangerousAttacksLast10.away || 0;
  const totalCc = (match.stats.bigChances?.home || 0) + (match.stats.bigChances?.away || 0);
  const homeXg = match.stats.xG.home;
  const awayXg = match.stats.xG.away;
  const totalCorners = match.stats.corners.home + match.stats.corners.away;
  const totalCards = match.stats.yellowCards.home + match.stats.yellowCards.away + (match.stats.redCards.home + match.stats.redCards.away) * 2;

  let verdict: TacticalAnalysis["momentumVerdict"] = "balanced";
  if (homePressure >= 68 && homePressure - awayPressure >= 20) {
    verdict = "home_dominant";
  } else if (awayPressure >= 68 && awayPressure - homePressure >= 20) {
    verdict = "away_dominant";
  } else if (homePressure >= 60 && awayPressure >= 60) {
    verdict = "end_to_end";
  }

  const domTeam = verdict === "home_dominant" ? match.homeTeam.name : verdict === "away_dominant" ? match.awayTeam.name : null;
  const summary = domTeam
    ? `Aos ${match.minute}', o ${domTeam} mantém forte sufoco ofensivo (${verdict === "home_dominant" ? homePressure : awayPressure}% de pressão). Jogo inclinado com chances iminentes.`
    : verdict === "end_to_end"
    ? `Partida aberta aos ${match.minute}' com trocas rápidas de ataque de ambos os lados e chances mútuas no placar de ${match.score.home}x${match.score.away}.`
    : `Duelo de equilíbrio e posse tática aos ${match.minute}' (${match.score.home}x${match.score.away}), com disputa física concentrada na intermediária.`;

  const likelyNextEvent = domTeam
    ? `Pressão aguda e finalização perigosa do ${domTeam}`
    : verdict === "end_to_end"
    ? "Contra-ataque com perigo de finalização"
    : "Retenção de posse e organização posicional";

  const rawHomeProb = Math.round(homePressure * 0.55 + (homeAttacks10 > awayAttacks10 ? 15 : 0) + homeXg * 10);
  const rawAwayProb = Math.round(awayPressure * 0.55 + (awayAttacks10 > homeAttacks10 ? 15 : 0) + awayXg * 10);
  const totalRaw = Math.max(1, rawHomeProb + rawAwayProb + 40);

  const homePct = Math.min(85, Math.max(10, Math.round((rawHomeProb / totalRaw) * 100)));
  const awayPct = Math.min(85, Math.max(10, Math.round((rawAwayProb / totalRaw) * 100)));
  const noGoalPct = Math.max(5, 100 - homePct - awayPct);

  const keyInsights: string[] = [
    `xG acumulado: ${match.homeTeam.name} (${homeXg.toFixed(2)}) vs ${match.awayTeam.name} (${awayXg.toFixed(2)}) com ${totalCc} chance(s) clara(s).`,
    `Ataques perigosos recentes (10m): ${homeAttacks10} x ${awayAttacks10} (Total no jogo: ${match.stats.dangerousAttacks.home} x ${match.stats.dangerousAttacks.away}).`,
    `Volume de finalizações: ${match.stats.shotsOnTarget.home + match.stats.shotsOffTarget.home} finalizações do mandante contra ${match.stats.shotsOnTarget.away + match.stats.shotsOffTarget.away} do visitante.`,
  ];

  if (match.stats.redCards.home > 0 || match.stats.redCards.away > 0) {
    keyInsights.push(`Desvantagem numérica em campo: ${match.stats.redCards.home > 0 ? match.homeTeam.name : match.awayTeam.name} jogando com jogador a menos.`);
  }

  const cornerPressureScore = Math.min(98, Math.max(20, Math.round(totalCorners * 7 + (homeAttacks10 + awayAttacks10) * 2)));
  const cardRiskScore = Math.min(95, Math.max(15, Math.round(totalCards * 14 + (match.stats.fouls.home + match.stats.fouls.away) * 2)));

  const tradingAngles: string[] = [];
  if (domTeam) {
    tradingAngles.push(`Favorecimento tático ao ${domTeam} (Pressão e volume de criação sustentados).`);
  }
  if (homeXg + awayXg > (match.score.home + match.score.away) + 0.8) {
    tradingAngles.push(`Dívida estatística de gols aberta: volume de xG (${(homeXg + awayXg).toFixed(2)}) supera o placar real (${match.score.home + match.score.away}).`);
  }
  if (cornerPressureScore >= 70) {
    tradingAngles.push(`Tendência aquecida para escanteios com ritmo acelerado nos flancos.`);
  }
  if (tradingAngles.length === 0) {
    tradingAngles.push(`Mercado equilibrado: aguardar definição de volume ofensivo ou oportunidade de valor no empate.`);
  }

  return {
    matchId: match.id,
    summary,
    momentumVerdict: verdict,
    likelyNextEvent,
    nextGoalProbability: {
      home: homePct,
      away: awayPct,
      noGoal: noGoalPct,
    },
    keyInsights,
    cornerPressureScore,
    cardRiskScore,
    tradingAngles,
    analyzedAt: new Date().toISOString(),
    source: "heuristic_fallback",
    isCached: false,
    isQuotaExhausted,
  };
}
