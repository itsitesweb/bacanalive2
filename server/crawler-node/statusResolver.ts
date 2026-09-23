// server/crawler-node/statusResolver.ts
/**
 * Resolvedor determinístico de status, minuto e período (server/crawler-node/statusResolver.ts)
 * Portado 1:1 de resolve_match_status_and_period do bridge_web.py.
 * Garante determinismo total e blindagem contra regressão de jogos em Intervalo (HT).
 */

export interface MatchStatusResolveResult {
  status_raw: string;
  minute: number;
  stage_code: string;
  period: string;
}

export function resolveMatchStatusAndPeriod(
  st_val: string = "",
  min_val: number = 0,
  stage_code: string = "",
  meta?: any,
  c_entry?: any
): [string, number, string, string] {
  const sc = String(stage_code || meta?.stage_code || c_entry?.stage_code || "").trim();
  const raw = String(st_val || meta?.status_str || c_entry?.status || "").trim();
  const up = raw.toUpperCase();

  // 1. Encerrado / Finished (FT)
  const is_ft = (
    ["3", "16", "17", "18", "19", "20", "21", "100"].includes(sc) ||
    ["FT", "ENDED", "FINISHED", "ENCERRADO", "TERMINADO", "AET", "PEN", "FIM"].includes(up) ||
    up.includes("ENCERRADO") ||
    up.includes("TERMINADO") ||
    Boolean(meta?.is_finished) ||
    Boolean(c_entry?.is_finished) ||
    min_val > 125
  );

  if (is_ft) {
    return ["FT", Math.max(90, min_val || 90), sc || "3", "FT"];
  }

  // 2. 1º Tempo Oficial Flashscore (stage_code 12)
  // Quando Flashscore envia stage_code 12, a partida está NO PRIMEIRO TEMPO (NUNCA HT ou 2T).
  if (sc === "12") {
    const m = Math.max(1, min_val || 1);
    return [`${m}' 1T`, m, "12", "1T"];
  }

  // 3. Intervalo / Halftime (HT)
  const is_ht = (
    sc === "38" ||
    ["HT", "INT", "38", "45' HT", "45 HT", "INTERVALO", "INTERVAL", "HALF TIME", "HALF-TIME", "HALFTIME", "DESCANSO", "PAUSA", "PAUSE", "BREAK"].includes(up) ||
    up.includes("INTERVAL") ||
    up.includes("HALF TIME") ||
    up.includes("HALFTIME") ||
    up.includes("HALF-TIME") ||
    up.includes("DESCANSO") ||
    /\bHT\b/.test(up) ||
    (c_entry && (c_entry.stage_code === "38" || c_entry.status === "HT") && sc !== "13" && sc !== "12" && min_val <= 45)
  );

  if (is_ht) {
    return ["HT", 45, "38", "HT"];
  }

  // 4. 2º Tempo
  const is_2t = (
    sc === "13" ||
    ["2H", "2T", "2ND HALF", "2º TEMPO", "2ºT", "2ND_HALF"].includes(up) ||
    up.includes("2º TEMPO") ||
    up.includes("2ND HALF") ||
    (min_val > 45 && sc !== "12")
  );

  if (is_2t) {
    const m = Math.max(46, min_val || 46);
    return [`${m}' 2T`, m, "13", "2T"];
  }

  // 5. 1º Tempo (textual ou por minuto)
  const is_1t = (
    ["1H", "1T", "1ST HALF", "1º TEMPO", "1ºT", "1ST_HALF"].includes(up) ||
    up.includes("1º TEMPO") ||
    up.includes("1ST HALF") ||
    (min_val > 0 && min_val <= 45)
  );

  if (is_1t) {
    const m = Math.max(1, min_val || 1);
    return [`${m}' 1T`, m, "12", "1T"];
  }

  // 6. Prorrogação
  if (["14", "15"].includes(sc) || ["ET", "EXTRA TIME", "PRORROGAÇÃO"].includes(up)) {
    const m = Math.max(91, min_val || 91);
    return [`${m}' ET`, m, sc, "ET"];
  }

  if (min_val > 0) {
    const p = min_val > 45 ? "2T" : "1T";
    return [`${min_val}' ${p}`, min_val, sc || (min_val > 45 ? "13" : "12"), p];
  }

  return [raw || "LIVE", min_val || 0, sc || "12", "1T"];
}
