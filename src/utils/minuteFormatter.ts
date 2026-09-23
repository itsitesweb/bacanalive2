// src/utils/minuteFormatter.ts
export type MatchPeriod = "1T" | "HT" | "2T" | "FT" | "1H" | "2H";

/**
 * Identifica o período exato da partida:
 *  - 1T: 1º Tempo (1' até 45'+)
 *  - HT: Intervalo (Halftime)
 *  - 2T: 2º Tempo (46' até 90'+)
 *  - FT: Encerrado / Finalizado (Full Time)
 * baseado nos dados de status do FlashScore / Crawler e na minutagem do jogo.
 */
export function getMatchPeriod(minute?: number | string, status?: string): MatchPeriod {
  const st = String(status || "").trim().toUpperCase();

  if (
    st === "FT" ||
    st === "FINISHED" ||
    st === "ENCERRADO" ||
    st === "FIM" ||
    st === "ENDED" ||
    st === "TERMINADO" ||
    st.includes("ENCERRADO") ||
    st.includes("TERMINADO")
  ) {
    return "FT";
  }

  // 1º Tempo explícito (ex: "40' 1T", "1T", "1H", "1º TEMPO", stage_code 12)
  if (
    st === "1H" ||
    st === "1T" ||
    st === "1ST_HALF" ||
    st === "1ST HALF" ||
    st === "1º TEMPO" ||
    st === "1ST" ||
    st === "12" ||
    st.includes("1º TEMPO") ||
    st.includes("1ST HALF") ||
    /\b1T\b/.test(st) ||
    /\b1H\b/.test(st)
  ) {
    return "1T";
  }

  // Verificação robusta de Intervalo / Half-Time (incluindo "45' HT", "INTERVALO", stage_code 38, etc.)
  if (
    st === "HT" ||
    st === "INT" ||
    st === "38" ||
    st === "45' HT" ||
    st === "45 HT" ||
    st === "INTERVALO" ||
    st === "INTERVAL" ||
    st === "HALF_TIME" ||
    st === "HALF TIME" ||
    st === "HALF-TIME" ||
    st === "HALFTIME" ||
    st === "DESCANSO" ||
    st === "PAUSA" ||
    st === "BREAK" ||
    st.includes("INTERVAL") ||
    st.includes("HALF TIME") ||
    st.includes("HALFTIME") ||
    st.includes("HALF-TIME") ||
    st.includes("DESCANSO") ||
    /\bHT\b/.test(st)
  ) {
    return "HT";
  }

  if (
    st === "2H" ||
    st === "2T" ||
    st === "2ND_HALF" ||
    st === "2ND HALF" ||
    st === "2º TEMPO" ||
    st === "2ND" ||
    st === "13" ||
    st.includes("2º TEMPO") ||
    st.includes("2ND HALF") ||
    /\b2T\b/.test(st) ||
    /\b2H\b/.test(st)
  ) {
    return "2T";
  }

  const numMin = typeof minute === "number" ? minute : parseInt(String(minute || 0), 10) || 0;
  return numMin <= 45 ? "1T" : "2T";
}

/**
 * Formata o minuto com a identificação de período:
 *  - 1T (1º Tempo): "25' 1T", "45'+2 1T"
 *  - HT (Intervalo): "45' HT"
 *  - 2T (2º Tempo): "71' 2T", "90'+3 2T"
 *  - FT (Encerrado): "FT Encerrado"
 */
export function formatMatchMinute(
  minute?: number | string,
  status?: string,
  extraMinute?: number | string
): string {
  const period = getMatchPeriod(minute, status);

  if (period === "HT") {
    return "45' HT";
  }

  if (period === "FT") {
    return "FT Encerrado";
  }

  const numMin = typeof minute === "number" ? minute : parseInt(String(minute || 0), 10) || 0;

  if (period === "1T") {
    if (numMin > 45) {
      const extra = extraMinute !== undefined && extraMinute !== null && extraMinute !== "" ? extraMinute : (numMin - 45);
      return `45'+${extra} 1T`;
    }
    const extraStr = extraMinute ? `+${extraMinute}` : "";
    return `${numMin}${extraStr}' 1T`;
  }

  if (period === "2T") {
    if (numMin > 90) {
      const extra = extraMinute !== undefined && extraMinute !== null && extraMinute !== "" ? extraMinute : (numMin - 90);
      return `90'+${extra} 2T`;
    }
    const extraStr = extraMinute ? `+${extraMinute}` : "";
    return `${numMin}${extraStr}' 2T`;
  }

  const extraStr = extraMinute ? `+${extraMinute}` : "";
  return `${numMin}${extraStr}' ${period}`;
}

