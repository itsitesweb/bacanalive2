// src/components/MatchDetail.tsx
import React, { useState } from "react";
import {
  Match,
  TacticalAnalysis,
  MatchRulesAnalysis,
  MatchEvent,
  OperationalRulesConfig,
} from "../types";
import {
  Sparkles,
  Zap,
  Clock,
  Target,
  RotateCw,
  BarChart2,
  Info,
  ChevronRight,
  Flame,
  Sliders,
  ExternalLink,
  Activity,
  ListOrdered,
  Filter,
  ArrowDownUp,
  ShieldAlert,
  Flag,
  TrendingUp,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getFlashscoreUrl } from "../utils/flashscore";
import { getLivePressure, getLivePressure5Min } from "../utils/pressure";
import { formatMatchMinute, getMatchPeriod } from "../utils/minuteFormatter";
import { RedCardBadges, getTeamRedCards } from "./RedCardBadges";
import { getLeagueTierInfo } from "../utils/leagueTier";
import { getMarketRecommendation } from "../utils/marketRecommendation";

interface MatchDetailProps {
  match: Match;
  onAnalyzeWithAi: (matchId: string) => Promise<TacticalAnalysis | null>;
  aiAnalysis: TacticalAnalysis | null;
  isAiLoading: boolean;
  rulesAnalysis?: MatchRulesAnalysis;
  ratioConfigured?: number;
  rulesConfig?: OperationalRulesConfig | null;
  onOpenRulesModal?: () => void;
}

export function MatchDetail({
  match,
  onAnalyzeWithAi,
  aiAnalysis,
  isAiLoading,
  rulesAnalysis,
  ratioConfigured = 3.0,
  rulesConfig,
  onOpenRulesModal,
}: MatchDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState<"rules_codigo31" | "stats" | "events" | "ai">("rules_codigo31");
  const [eventFilter, setEventFilter] = useState<"all" | "goals" | "cards" | "var">("all");
  const [eventsSortOrder, setEventsSortOrder] = useState<"desc" | "asc">("desc");

  const stats = match.stats;
  const isLive = match.status === "1H" || match.status === "2H" || match.status === "1T" || match.status === "2T" || match.status === "LIVE";

  const homeScore = match.score?.home ?? (match.homeTeam as any)?.score ?? 0;
  const awayScore = match.score?.away ?? (match.awayTeam as any)?.score ?? 0;

  // Filtered and sorted events (excluding substitutions by default)
  const rawEvents = (match.events || []).filter((ev) => ev.type !== "sub");
  const filteredEvents = rawEvents.filter((ev) => {
    if (eventFilter === "goals") {
      return ev.type === "goal" || ev.type === "penalty_scored";
    }
    if (eventFilter === "cards") {
      return ev.type === "yellow_card" || ev.type === "red_card";
    }
    if (eventFilter === "var") {
      return ev.type === "var";
    }
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const minA = Number(a.minute || 0) + Number(a.extraMinute || 0) * 0.1;
    const minB = Number(b.minute || 0) + Number(b.extraMinute || 0) * 0.1;
    return eventsSortOrder === "desc" ? minB - minA : minA - minB;
  });

  const goalsCount = rawEvents.filter((e) => e.type === "goal" || e.type === "penalty_scored").length;
  const cardsCount = rawEvents.filter((e) => e.type === "yellow_card" || e.type === "red_card").length;
  const varCount = rawEvents.filter((e) => e.type === "var").length;

  // Goal debt calculations & dynamic visual intensity
  const homeCc = stats.bigChances?.home ?? Math.max(0, Math.floor(stats.shotsOnTarget.home / 2));
  const awayCc = stats.bigChances?.away ?? Math.max(0, Math.floor(stats.shotsOnTarget.away / 2));
  const totalCc = homeCc + awayCc;
  const totalGoals = homeScore + awayScore;
  const expectedGoals = +(totalCc / ratioConfigured).toFixed(2);
  const rawSaldoDevido = +(expectedGoals - totalGoals).toFixed(2);
  const saldoDevido = Math.max(0, rawSaldoDevido);
  const isDevendo = isLive && (totalCc >= 2 && expectedGoals > totalGoals);

  const tripleDebtFormed = Boolean(rulesAnalysis?.tripleDebt?.tripleDebtFormed);
  const effectiveDebt = Math.max(
    saldoDevido,
    rulesAnalysis?.codigo31?.saldoGolsDevidos ?? 0,
    tripleDebtFormed ? 1.5 : 0
  );

  // Live 5-minute pressure calculation com proteção contextual contra falsos positivos
  const pressure5Min = getLivePressure5Min(
    match.stats,
    match.minute,
    match.momentumTimeline,
    {
      score: match.score,
      redCards: {
        home: getTeamRedCards(match, "home"),
        away: getTeamRedCards(match, "away"),
      },
    }
  );

  // Comparison Bar helper
  const renderStatBar = (
    label: string,
    homeVal: number,
    awayVal: number,
    formatSuffix: string = "",
    highlightDiff: boolean = false
  ) => {
    // Se a estatística estiver zerada para ambos os times, não exibir até o próximo scan capturar valores
    const numHome = Number(homeVal) || 0;
    const numAway = Number(awayVal) || 0;
    if (numHome === 0 && numAway === 0) {
      return null;
    }

    const total = numHome + numAway || 1;
    const homePct = (numHome / total) * 100;
    const awayPct = (numAway / total) * 100;

    return (
      <div className="space-y-1 py-2 border-b border-slate-800/60 last:border-0">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className={`w-16 text-left ${homeVal > awayVal && highlightDiff ? "text-emerald-400 font-bold" : "text-slate-200"}`}>
            {homeVal}{formatSuffix}
          </span>
          <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider text-center flex-1">
            {label}
          </span>
          <span className={`w-16 text-right ${awayVal > homeVal && highlightDiff ? "text-cyan-400 font-bold" : "text-slate-200"}`}>
            {awayVal}{formatSuffix}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500 rounded-l"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="h-full bg-cyan-500 transition-all duration-500 rounded-r"
            style={{ width: `${awayPct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Scoreboard & Match Header */}
      <div className="rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-700 ease-out border bg-slate-900/90 border-slate-800">
        {/* League, Country, Start Time and Status Tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800/80 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            {match.country && (
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold tracking-wide flex items-center gap-1">
                🌍 {typeof match.country === 'object' && match.country !== null ? (match.country as any).name || 'País' : String(match.country)}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 text-xs font-bold tracking-wide flex items-center gap-1.5">
              <span>🏆 {typeof match.league === 'object' && match.league !== null ? (match.league as any).name || 'Liga' : String(match.league || '')} {match.leagueCountry && match.leagueCountry !== match.country ? `(${typeof match.leagueCountry === 'object' && match.leagueCountry !== null ? (match.leagueCountry as any).name || '' : String(match.leagueCountry)})` : ""}</span>
              {(() => {
                const tierInfo = getLeagueTierInfo(match.league, match.country || match.leagueCountry);
                return (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider ${tierInfo.badgeClass}`}>
                    {tierInfo.label}
                  </span>
                );
              })()}
            </span>
            {(() => {
              let timeFormatted = match.startTime || "";
              let dateFormatted = "";
              if (match.startDate) {
                try {
                  const d = new Date(match.startDate);
                  if (!isNaN(d.getTime())) {
                    if (!timeFormatted) {
                      timeFormatted = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    }
                    dateFormatted = d.toLocaleDateString("pt-BR");
                  }
                } catch {
                  // Ignore parse error
                }
              }
              return (timeFormatted || dateFormatted) ? (
                <span className="px-2.5 py-1 rounded-md bg-slate-850 border border-slate-700/60 text-slate-300 text-xs font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {timeFormatted}
                  {dateFormatted && !match.startTime && (
                    <span className="text-slate-500 text-[11px]">
                      ({dateFormatted})
                    </span>
                  )}
                </span>
              ) : null;
            })()}
          </div>

          <div className="flex items-center gap-2">
            {(() => {
              const statusUpper = (match.status || "").toUpperCase();
              const isInterval =
                statusUpper === "HT" ||
                statusUpper === "INTERVALO" ||
                statusUpper === "INTERVAL" ||
                statusUpper === "HALF_TIME" ||
                statusUpper === "HALF TIME" ||
                statusUpper === "HALFTIME" ||
                statusUpper === "INT" ||
                statusUpper.includes("INTERVAL") ||
                statusUpper.includes("HALFTIME");

              if (isInterval) {
                return (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    INTERVALO • 45' HT
                  </span>
                );
              }
              if (statusUpper === "FT" || statusUpper === "FINISHED" || statusUpper === "ENCERRADO") {
                return (
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold">
                    ENCERRADO (FT)
                  </span>
                );
              }
              if (isLive) {
                return (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    AO VIVO • {formatMatchMinute(match.minute, match.status)}
                  </span>
                );
              }
              return (
                <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                  {match.status || "AGENDADO"}
                </span>
              );
            })()}
            {/* FlashScore External Link */}
            <a
              href={getFlashscoreUrl(match)}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir partida completa no FlashScore"
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <span>FlashScore</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <span className="text-xs text-slate-400">
              {(() => {
                try {
                  const d = new Date(match.lastUpdated);
                  return !isNaN(d.getTime()) ? `Atualizado: ${d.toLocaleTimeString("pt-BR")}` : "";
                } catch {
                  return "";
                }
              })()}
            </span>
          </div>
        </div>

        {/* Teams and Big Score */}
        <div className="grid grid-cols-12 items-center gap-4 py-2 relative z-10">
          {/* Home Team */}
          <div className="col-span-4 text-center sm:text-right flex flex-col sm:flex-row items-center justify-end gap-3">
            <div className="order-2 sm:order-1">
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center justify-center sm:justify-end gap-1.5 flex-wrap">
                <span>{match.homeTeam.name}</span>
                <RedCardBadges count={getTeamRedCards(match, "home")} size="lg" />
              </h2>
              <div className="flex items-center justify-center sm:justify-end gap-1 mt-1">
                {match.homeTeam.form?.map((f, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${
                      f === "W"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : f === "D"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-3xl sm:text-4xl order-1 sm:order-2 p-2 rounded-2xl bg-slate-800/80 border border-slate-700/80">
              {match.homeTeam.logo}
            </div>
          </div>

          {/* Big Score Center */}
          <div className="col-span-4 text-center flex flex-col items-center justify-center">
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tighter">
                {homeScore}
              </span>
              <span className="text-2xl sm:text-3xl font-light text-slate-600">-</span>
              <span className="text-4xl sm:text-5xl font-black text-cyan-400 tracking-tighter">
                {awayScore}
              </span>
            </div>
            {match.score.htHome !== undefined && (
              <span className="text-[11px] text-slate-400 font-medium mt-1">
                (Intervalo: {match.score.htHome} - {match.score.htAway})
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="col-span-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-start gap-3">
            <div className="text-3xl sm:text-4xl p-2 rounded-2xl bg-slate-800/80 border border-slate-700/80">
              {match.awayTeam.logo}
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <span>{match.awayTeam.name}</span>
                <RedCardBadges count={getTeamRedCards(match, "away")} size="lg" />
              </h2>
              <div className="flex items-center justify-center sm:justify-start gap-1 mt-1">
                {match.awayTeam.form?.map((f, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${
                      f === "W"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : f === "D"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Momentum Metrics Bar Below Scoreboard (4 Key Metrics) */}
        <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Gols Esperados (xG)</span>
            <span className="text-sm font-bold text-white">
              <span className="text-emerald-400">{stats.xG.home.toFixed(2)}</span> vs{" "}
              <span className="text-cyan-400">{stats.xG.away.toFixed(2)}</span>
            </span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Posse de Bola</span>
            <span className="text-sm font-bold text-white">
              <span className="text-emerald-400">{stats.possession.home}%</span> vs{" "}
              <span className="text-cyan-400">{stats.possession.away}%</span>
            </span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Escanteios</span>
            <span className="text-sm font-bold text-white">
              <span className="text-emerald-400">{stats.corners.home}</span> vs{" "}
              <span className="text-cyan-400">{stats.corners.away}</span> (Tot: {stats.corners.home + stats.corners.away})
            </span>
          </div>

          {(() => {
            const livePress = getLivePressure(
              stats,
              match.minute,
              {
                score: match.score,
                redCards: {
                  home: getTeamRedCards(match, "home"),
                  away: getTeamRedCards(match, "away"),
                },
              },
              match.momentumTimeline
            );
            return (
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Pressão Dinâmica</span>
                <span className="text-sm font-bold text-white flex items-center justify-center gap-1.5 pt-0.5">
                  <span className="text-emerald-400">{livePress.home}%</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-cyan-400">{livePress.away}%</span>
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tactical Market Decision Panel (Gols & Match Odds, Zero Corners) */}
      {(() => {
        const hasTrendAlert = !!rulesAnalysis?.trendAlert?.qualified;
        const hasImminentAlert = !!rulesAnalysis?.imminentGoal?.qualified || !!rulesAnalysis?.imminentGoal?.isImminent;

        // Exigência obrigatória: Apenas exibir se houver Trend Alert ou Surto (Imminent Alert) ativo
        if (!hasTrendAlert && !hasImminentAlert) {
          return null;
        }

        const isConfluent = !!rulesAnalysis?.imminentGoal?.isConfluent || !!rulesAnalysis?.trendAlert?.isConfluent;
        const confluenceState = {
          isConfluent,
          convictionLevel: isConfluent ? ('MAX' as const) : ('MEDIUM' as const),
          rule1Triggered: hasTrendAlert,
          rule2Triggered: hasImminentAlert,
          triggeredTeam: rulesAnalysis?.imminentGoal?.team || rulesAnalysis?.trendAlert?.team || undefined,
          teamName: rulesAnalysis?.imminentGoal?.teamName || rulesAnalysis?.trendAlert?.teamName || undefined,
        };
        const rec = getMarketRecommendation(match, null, confluenceState);
        if (!rec || rec.action === 'NO_TRADE') return null;

        let displayActionLabel: string = rec.action;
        if (rec.action === 'GO_MAX') displayActionLabel = '🚀 ENTRADA IMEDIATA (MAX)';
        else if (rec.action === 'ENTER') displayActionLabel = '🎯 ENTRADA LIBERADA';
        else if (rec.action === 'SNIPE') displayActionLabel = '⏳ AGUARDAR (SNIPE)';
        else if (rec.action === 'NO_TRADE') displayActionLabel = '🛑 NÃO APOSTAR';

        return (
          <div className={`p-3 rounded-2xl border text-xs bg-slate-950/95 shadow-lg transition-all duration-500 animate-pulse ${rec.badgeClass}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 font-bold truncate">
                <span className="px-2 py-0.5 rounded text-[10px] border uppercase tracking-wider bg-slate-900 text-white">
                  {displayActionLabel}
                </span>
                <span className="text-white font-black text-sm truncate">{rec.marketTitle}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-300 font-mono font-bold text-xs">
                  Alvo @{rec.targetOdd.toFixed(2)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {rec.reasoning}
            </p>
          </div>
        );
      })()}

      {/* 2-Column Section: Left Vertical Navigation Menu + Right Active Content Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Vertical Menu / Sidebar */}
        <div className="md:col-span-4 lg:col-span-3 space-y-2">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3 shadow-lg md:sticky md:top-4">
            <div className="px-2 py-1.5 mb-2 border-b border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Menu de Análise
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                4 seções
              </span>
            </div>

            <nav className="space-y-1.5">
              {/* Option 1: Diagnóstico & Regras */}
              <button
                onClick={() => setActiveSubTab("rules_codigo31")}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  activeSubTab === "rules_codigo31"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm"
                    : "text-amber-400/90 hover:text-amber-200 hover:bg-amber-950/30 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg ${activeSubTab === "rules_codigo31" ? "bg-amber-500/20 text-amber-300" : "bg-amber-950/40 text-amber-400"}`}>
                    <Zap className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="truncate">
                    <span className="block font-semibold">Diagnóstico & Regras</span>
                    <span className="text-[10px] text-amber-400/70 font-normal block">Métricas 3:1 & Pressão 5m</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {activeSubTab === "rules_codigo31" && <ChevronRight className="w-3.5 h-3.5 text-amber-300" />}
                </div>
              </button>

              {/* Option 2: Feed de Eventos & Linha do Tempo */}
              <button
                onClick={() => setActiveSubTab("events")}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  activeSubTab === "events"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm"
                    : "text-rose-400/90 hover:text-rose-200 hover:bg-rose-950/30 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg ${activeSubTab === "events" ? "bg-rose-500/20 text-rose-300" : "bg-rose-950/40 text-rose-400"}`}>
                    <Activity className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="block font-semibold">Feed de Eventos</span>
                      {rawEvents.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500/30 text-rose-200 border border-rose-500/40">
                          {rawEvents.length}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-rose-400/70 font-normal block">Gols, Cartões & Lances</span>
                  </div>
                </div>
                {activeSubTab === "events" && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-rose-300" />}
              </button>

              {/* Option 3: Estatísticas Detalhadas */}
              <button
                onClick={() => setActiveSubTab("stats")}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  activeSubTab === "stats"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg ${activeSubTab === "stats" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                    <BarChart2 className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="truncate">
                    <span className="block font-semibold">Estatísticas</span>
                    <span className="text-[10px] text-slate-500 font-normal block">Métricas Detalhadas</span>
                  </div>
                </div>
                {activeSubTab === "stats" && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
              </button>

              {/* Option 4: Análise Tática IA */}
              <button
                onClick={() => setActiveSubTab("ai")}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  activeSubTab === "ai"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm"
                    : "text-purple-400/90 hover:text-purple-200 hover:bg-purple-950/30 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg ${activeSubTab === "ai" ? "bg-purple-500/25 text-purple-300" : "bg-purple-950/40 text-purple-400"}`}>
                    <Sparkles className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="truncate">
                    <span className="block font-semibold">Análise Tática IA</span>
                    <span className="text-[10px] text-purple-400/70 font-normal block">Gemini Flash</span>
                  </div>
                </div>
                {activeSubTab === "ai" && <ChevronRight className="w-3.5 h-3.5 text-purple-300" />}
              </button>
            </nav>
          </div>
        </div>

        {/* Right Active Content Panel */}
        <div className="md:col-span-8 lg:col-span-9 space-y-6 min-w-0">
          {/* SUBTAB 1: DIAGNÓSTICO & REGRAS OPERACIONAIS PYTHON */}
          {activeSubTab === "rules_codigo31" && (
            <div className="space-y-6">
              {/* 1º QUADRO: PRESSÃO DOS ÚLTIMOS 5 MINUTOS (Recorte Recente & Blitz) */}
              <div className="bg-slate-900/95 rounded-2xl border-2 border-amber-500/30 p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-sm shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        Gráfico de Pressão dos Últimos 5 Minutos
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/25 text-amber-300 border border-amber-400/40 font-mono">
                          Janela 5m
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Intensidade e volume ofensivo calculados exclusivamente na janela móvel de 5 minutos
                      </p>
                    </div>
                  </div>
                </div>

                {/* Alerta de Posse Estéril (Proteção contra Ilusão de Domínio) */}
                {(pressure5Min.sterilePossessionHome || pressure5Min.sterilePossessionAway) && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-start gap-2.5 text-xs text-amber-200 shadow-sm">
                    <span className="text-sm shrink-0">⚠️</span>
                    <div>
                      <span className="font-black text-amber-300 uppercase tracking-wide block text-[11px]">
                        Filtro Anti-Posse Inútil Ativo:
                      </span>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        {pressure5Min.sterilePossessionHome && (
                          <span>O <strong>{match.homeTeam.name}</strong> tem posse de bola elevada, porém sem penetração na área adversária ou finalizações certas no período. A posse foi descontada para evitar falsa percepção de perigo.</span>
                        )}
                        {pressure5Min.sterilePossessionAway && (
                          <span>O <strong>{match.awayTeam.name}</strong> tem posse de bola elevada, porém sem penetração na área adversária ou finalizações certas no período. A posse foi descontada para evitar falsa percepção de perigo.</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Termômetro de Pressão 5m Mandante vs Visitante */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-black">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      <span className="text-emerald-300">{match.homeTeam.name}</span>
                      <span className="text-emerald-300 font-mono text-sm bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                        {pressure5Min.home}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 uppercase tracking-wide font-extrabold px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                      Pressão 5 Min
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-orange-300 font-mono text-sm bg-orange-950/80 px-2 py-0.5 rounded border border-orange-500/40">
                        {pressure5Min.away}%
                      </span>
                      <span className="text-orange-300">{match.awayTeam.name}</span>
                      <span className="w-3 h-3 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
                    </div>
                  </div>

                  {/* Barra de Pressão 5m de Alto Contraste */}
                  <div className="w-full h-5 bg-slate-950 rounded-full overflow-hidden flex border-2 border-slate-700/80 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 transition-all duration-500 flex items-center justify-start pl-3 text-[10px] font-black text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                      style={{ width: `${pressure5Min.home}%` }}
                    >
                      {pressure5Min.home >= 15 && `${pressure5Min.home}% Mandante`}
                    </div>
                    <div
                      className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 transition-all duration-500 flex items-center justify-end pr-3 text-[10px] font-black text-slate-950 shadow-[0_0_10px_rgba(249,115,22,0.6)]"
                      style={{ width: `${pressure5Min.away}%` }}
                    >
                      {pressure5Min.away >= 15 && `${pressure5Min.away}% Visitante`}
                    </div>
                  </div>

                  {/* Explicação Dinâmica do Motor */}
                  {pressure5Min.explanation && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                      <span>💡 <strong>Diagnóstico:</strong> {pressure5Min.explanation}</span>
                      <span className="font-mono text-[10px] text-slate-500">Score perigo: {pressure5Min.totalDangerScore} pts</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Header Card with Ratio and Quick Edit */}
              <div className={`rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-700 ease-out border ${
                effectiveDebt >= 1.8
                  ? "bg-gradient-to-br from-rose-950/70 via-slate-900 to-red-900/60 border-red-500 shadow-xl shadow-red-950/50"
                  : effectiveDebt >= 1.0
                  ? "bg-gradient-to-br from-slate-900 via-rose-950/40 to-rose-900/40 border-rose-500/60 shadow-lg shadow-rose-950/40"
                  : effectiveDebt > 0
                  ? "bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 border-rose-600/40 shadow-md"
                  : "bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/40"
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg border transition-colors ${
                        effectiveDebt >= 1.0
                          ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}>
                        <Zap className="w-5 h-5" />
                      </span>
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        Diagnóstico Operacional & Dívida de Gols
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      Metodologia do Terminal: a cada <strong>{ratioConfigured.toFixed(1)} Chances Claras</strong> criadas,
                      espera-se estatisticamente <strong>1 gol</strong>. Se o placar não refletir isso, a partida entra em alerta de Dívida de Gols.
                    </p>
                  </div>

                  {onOpenRulesModal && (
                    <button
                      onClick={onOpenRulesModal}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm border ${
                        effectiveDebt >= 1.0
                          ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-500/40"
                          : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Alterar Índice ({ratioConfigured.toFixed(1)}:1)</span>
                    </button>
                  )}
                </div>

                {/* Quick Metrics Bar: CCs, Gols Esperados, Gols Reais e Saldo */}
                {(() => {
                  const ccRate = totalCc > 0 ? +(match.minute / totalCc).toFixed(1) : 99;
                  const isFastPaced = ccRate <= 12.0;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-800/80">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block font-medium">Total de Chances Claras</span>
                        <div className="text-xl font-black text-amber-400 mt-0.5">
                          {totalCc} <span className="text-xs font-normal text-slate-400">({homeCc}x{awayCc})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Ritmo: <strong className={isFastPaced ? "text-emerald-400" : "text-slate-400"}>{ccRate}m/CC</strong>
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block font-medium">Gols Esperados (por CC)</span>
                        <div className="text-xl font-black text-cyan-400 mt-0.5">
                          {expectedGoals}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Fórmula: {totalCc} / {ratioConfigured.toFixed(1)}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block font-medium">Placar Real da Partida</span>
                        <div className="text-xl font-black text-white mt-0.5">
                          {totalGoals} <span className="text-xs font-normal text-slate-400">({match.score.home}-{match.score.away})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Minuto: {formatMatchMinute(match.minute, match.status)}
                        </span>
                      </div>

                      <div className={`p-3 rounded-xl border transition-all duration-500 ${
                        effectiveDebt >= 1.8
                          ? "bg-rose-950/60 border-red-500/80 shadow-md ring-1 ring-red-500/30"
                          : effectiveDebt >= 1.0
                          ? "bg-rose-500/25 border-rose-500/70 shadow-md"
                          : isDevendo
                          ? "bg-amber-500/20 border-amber-500/60 shadow-sm"
                          : "bg-slate-950/80 border-slate-800"
                      }`}>
                        <span className="text-[11px] text-slate-300 block font-medium">Status de Dívida</span>
                        <div className={`text-xl font-black mt-0.5 ${
                          effectiveDebt >= 1.0 ? "text-rose-300 font-mono" : isDevendo ? "text-amber-300 font-mono" : "text-slate-400"
                        }`}>
                          {effectiveDebt > 0 ? `+${effectiveDebt.toFixed(2)} Gol(s)` : "Quitado (0)"}
                        </div>
                        <span className={`text-[10px] font-bold block mt-0.5 ${
                          effectiveDebt >= 1.0 ? "text-rose-400" : isDevendo ? "text-amber-400" : "text-slate-500"
                        }`}>
                          {effectiveDebt > 0 ? "🔥 DEVENDO GOL" : "Sem dívida ativa"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 5 Pillars of Rules: Gol Iminente, Diagnóstico, Trinca de Dívidas, Pressão Vendável, Dominant Trailing */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Pillar 0: Gol Iminente (Surto Ofensivo 5m) */}
                <div className={`p-5 rounded-2xl border space-y-3 transition-all ${
                  rulesAnalysis?.imminentGoal?.isImminent
                    ? rulesAnalysis.imminentGoal.intensity === "extrema"
                      ? "bg-gradient-to-br from-red-950/60 via-slate-900 to-slate-900 border-red-500/80 shadow-lg shadow-red-950/40"
                      : "bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/70 shadow-md"
                    : "bg-slate-900 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚨</span>
                      <h4 className="text-sm font-bold text-white">Gol Iminente (Surto 5m)</h4>
                    </div>
                    {rulesAnalysis?.imminentGoal?.isImminent ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border animate-pulse ${
                        rulesAnalysis.imminentGoal.intensity === "extrema"
                          ? "bg-red-500/20 text-red-300 border-red-500/50"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      }`}>
                        {rulesAnalysis.imminentGoal.intensity.toUpperCase()} ({rulesAnalysis.imminentGoal.avgPressure}% méd.)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        ESTÁVEL ({rulesAnalysis?.imminentGoal?.avgPressure !== undefined ? `${rulesAnalysis.imminentGoal.avgPressure}% méd.` : '0%'})
                      </span>
                    )}
                  </div>

                  {rulesAnalysis?.imminentGoal?.isImminent ? (
                    <div className="space-y-2 text-xs">
                      <div className={`p-3 rounded-xl border ${
                        rulesAnalysis.imminentGoal.intensity === "extrema"
                          ? "bg-red-950/50 border-red-500/40 text-red-200"
                          : "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                      }`}>
                        <strong className="text-sm font-bold block">{rulesAnalysis.imminentGoal.title}</strong>
                        <p className="text-[11px] mt-1 opacity-90">{rulesAnalysis.imminentGoal.triggerReason}</p>
                        {rulesAnalysis.imminentGoal.beneficiaryTeam && (
                          <p className="text-[11px] text-white mt-1.5 font-semibold">
                            🎯 Time Pressionando: <span className="underline">{rulesAnalysis.imminentGoal.beneficiaryTeam}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>Mercado: <strong className="text-white uppercase">{rulesAnalysis.imminentGoal.targetMarket || 'Over Gols'}</strong></span>
                        <span>Confiança: <strong className="text-emerald-400">{rulesAnalysis.imminentGoal.confidenceScore}%</strong></span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Audita pressão contínua e blitz de finalizações/ataques da equipe dominante na janela imediata de 5 minutos com sensibilidade agressiva.
                    </p>
                  )}
                </div>

                {/* Pillar 1: Diagnóstico Status */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      <h4 className="text-sm font-bold text-white">Gatilho de Diagnóstico</h4>
                    </div>
                    {rulesAnalysis?.codigo31?.shouldAlert ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        QUALIFICADO ({rulesAnalysis.codigo31.level?.toUpperCase()})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        EM OBSERVAÇÃO
                      </span>
                    )}
                  </div>

                  {rulesAnalysis?.codigo31?.shouldAlert ? (
                    <div className="space-y-2 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-200">
                        <strong className="text-sm font-bold">{rulesAnalysis.codigo31.title}</strong>
                        {rulesAnalysis.codigo31.debtorTeamName && (
                          <p className="text-[11px] text-amber-300 mt-1 font-semibold">
                            🎯 Time Devedor: <span className="text-white">{rulesAnalysis.codigo31.debtorTeamName}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>Mercado Indicado: <strong className="text-white uppercase">{rulesAnalysis.codigo31.market}</strong></span>
                        <span>Bucket de Cooldown: #{rulesAnalysis.codigo31.bucket}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Critérios para qualificação: Mínimo 2 CCs totais, Ritmo &le; 15 min/CC, e Dívida positiva (Gols esperados &gt; placar).
                      {rulesAnalysis?.codigo31?.reason && (
                        <span className="block mt-1 text-slate-400 font-mono text-[11px]">
                          Status: {rulesAnalysis.codigo31.reason}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Pillar 2: Trinca de Dívidas (3-Pillar Validation) */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💎</span>
                      <h4 className="text-sm font-bold text-white">Trinca de Dívidas (CC + xG + xGOT)</h4>
                    </div>
                    {rulesAnalysis?.tripleDebt?.tripleDebtFormed ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        {rulesAnalysis.tripleDebt.scope === "unilateral" && rulesAnalysis.tripleDebt.debtorTeamName
                          ? `TRINCA FORMADA: ${rulesAnalysis.tripleDebt.debtorTeamName.toUpperCase()}`
                          : `TRINCA FORMADA (${rulesAnalysis.tripleDebt.scope.toUpperCase()})`}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        PARCIAL
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className={`p-2.5 rounded-xl border ${
                      rulesAnalysis?.tripleDebt?.ccDebt
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}>
                      <span className="text-[10px] block font-bold">1. Dívida CC</span>
                      <span className="font-extrabold text-sm">{rulesAnalysis?.tripleDebt?.ccDebt ? "✅ SIM" : "❌ NÃO"}</span>
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      rulesAnalysis?.tripleDebt?.xgDebt
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}>
                      <span className="text-[10px] block font-bold">2. Dívida xG</span>
                      <span className="font-extrabold text-sm">{rulesAnalysis?.tripleDebt?.xgDebt ? "✅ SIM" : "❌ NÃO"}</span>
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      rulesAnalysis?.tripleDebt?.xgotDebt
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}>
                      <span className="text-[10px] block font-bold">3. Dívida xGOT</span>
                      <span className="font-extrabold text-sm">{rulesAnalysis?.tripleDebt?.xgotDebt ? "✅ SIM" : "❌ NÃO"}</span>
                    </div>
                  </div>

                  {rulesAnalysis?.tripleDebt?.scope === "unilateral" && rulesAnalysis.tripleDebt.debtorTeamName && (
                    <div className="text-[11px] font-medium text-purple-300 bg-purple-950/40 p-2.5 rounded-xl border border-purple-800/40 flex items-center justify-between">
                      <span>🎯 Time Devedor: <strong className="text-white font-bold">{rulesAnalysis.tripleDebt.debtorTeamName}</strong></span>
                      <span className="text-purple-400 text-[10px] font-mono">Dívida Unilateral</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400">
                    A Trinca avalia se o time finalizou com consistência (xG), acertou a baliza com perigo (xGOT) e gerou chances claras (CC).
                  </p>
                </div>

                {/* Unified Pillar: Super Back Dominante */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 sm:col-span-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Super Back Dominante (Reação Confirmada & Pressão Vendável)</span>
                          {rulesAnalysis?.superBackDominante?.qualified && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/50">
                              TIER {rulesAnalysis.superBackDominante.tier}
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Fusão das Regras 3 e 4: Superioridade estatística & ineficiência aliadas à reação ofensiva imediata
                        </p>
                      </div>
                    </div>
                    {rulesAnalysis?.superBackDominante?.qualified ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                        QUALIFICADO ({rulesAnalysis.superBackDominante.dominantTeam})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        MONITORANDO
                      </span>
                    )}
                  </div>

                  {rulesAnalysis?.superBackDominante?.qualified ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 text-xs space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 text-slate-300">
                        <div className="flex items-center gap-3">
                          <span>Time: <strong className="text-white font-bold">{rulesAnalysis.superBackDominante.dominantTeam}</strong></span>
                          <span>Cenário: <strong className="text-amber-400">{rulesAnalysis.superBackDominante.situation === "PERDENDO" ? `Perdendo por ${rulesAnalysis.superBackDominante.deficitGoals} gol` : "Empatando"}</strong></span>
                          <span>Pressão: <strong className="text-emerald-400 font-mono">{rulesAnalysis.superBackDominante.dominantPressure}% ({rulesAnalysis.superBackDominante.livePressureStatus})</strong></span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="text-slate-400">Probabilidade: <strong className="text-cyan-300">{rulesAnalysis.superBackDominante.probTarget}%</strong></span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-amber-200">
                        <strong>Tese Analítica:</strong> {rulesAnalysis.superBackDominante.tese}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[9px] uppercase">xG Dominante vs Zebra</span>
                          <strong className="text-emerald-400">{rulesAnalysis.superBackDominante.dominantXg.toFixed(2)} vs {rulesAnalysis.superBackDominante.opponentXg.toFixed(2)}</strong>
                        </div>
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[9px] uppercase">Chances Claras</span>
                          <strong className="text-amber-400">{rulesAnalysis.superBackDominante.dominantCc} CC</strong>
                        </div>
                        <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[9px] uppercase">Mercado Recomendado</span>
                          <strong className="text-cyan-400">Back {rulesAnalysis.superBackDominante.dominantTeam} / Lay Zebra</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
                      <p>
                        A regra unificada vigia equipes dominantes em empate ou desvantagem por até 1 gol que acumulam forte superioridade estatística (xG ≥ 0.95, CC ≥ 2, zebra inofensiva) combinada com reação viva no momento (pressão ≥ 65% ou ataques perigosos recentes).
                      </p>
                      {rulesAnalysis?.dominantTrailing?.blockReason && (
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-amber-400">
                          Fator de proteção ativo: {rulesAnalysis.dominantTrailing.blockReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>


            </div>
          )}

          {/* SUBTAB 2: DETAILED STATS COMPARISON */}
          {activeSubTab === "stats" && (
            <div className="space-y-6">
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-lg">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    {match.homeTeam.name}
                    <RedCardBadges count={getTeamRedCards(match, "home")} size="sm" />
                  </span>
                  <span className="text-xs text-slate-400 font-medium">vs</span>
                  <span className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                    {match.awayTeam.name}
                    <RedCardBadges count={getTeamRedCards(match, "away")} size="sm" />
                  </span>
                </div>
                <span className="text-xs text-slate-400">Dados consolidados ao vivo</span>
              </div>

              <div className="space-y-1">
                {renderStatBar("Posse de Bola", stats.possession.home, stats.possession.away, "%", true)}
                {renderStatBar("Chances Claras (Big Chances)", stats.bigChances?.home ?? Math.max(0, Math.floor(stats.shotsOnTarget.home / 2)), stats.bigChances?.away ?? Math.max(0, Math.floor(stats.shotsOnTarget.away / 2)), "", true)}
                {renderStatBar("Gols Esperados (xG)", +stats.xG.home.toFixed(2), +stats.xG.away.toFixed(2), "", true)}
                {stats.xGOT && renderStatBar("xGOT (Gols Esperados Pós-Chute)", +stats.xGOT.home.toFixed(2), +stats.xGOT.away.toFixed(2), "", true)}
                {stats.boxTouches && renderStatBar("Toques na Área Adversária", stats.boxTouches.home, stats.boxTouches.away, "", true)}
                {renderStatBar("Finalizações no Alvo", stats.shotsOnTarget.home, stats.shotsOnTarget.away, "", true)}
                {renderStatBar("Finalizações Fora", stats.shotsOffTarget.home, stats.shotsOffTarget.away)}
                {renderStatBar("Chutes Bloqueados", stats.blockedShots.home, stats.blockedShots.away)}
                {renderStatBar("Ataques Totais", stats.attacks.home, stats.attacks.away)}
                {renderStatBar("Ataques Perigosos", stats.dangerousAttacks.home, stats.dangerousAttacks.away, "", true)}
                {renderStatBar("Ataques Perigosos (Últimos 10 min)", stats.dangerousAttacksLast10.home, stats.dangerousAttacksLast10.away, "", true)}
                {renderStatBar("Escanteios", stats.corners.home, stats.corners.away, "", true)}
                {renderStatBar("Precisão de Passes", stats.passAccuracy.home, stats.passAccuracy.away, "%")}
                {renderStatBar("Defesas do Goleiro", stats.saves.home, stats.saves.away)}
                {renderStatBar("Faltas Cometidas", stats.fouls.home, stats.fouls.away)}
                {renderStatBar("Cartões Amarelos", stats.yellowCards.home, stats.yellowCards.away)}
                {renderStatBar("Cartões Vermelhos", stats.redCards.home, stats.redCards.away)}
              </div>
            </div>
            </div>
          )}

          {/* SUBTAB 3: FEED DE EVENTOS & LINHA DO TEMPO */}
          {activeSubTab === "events" && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Feed de Eventos da Partida</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-800 text-slate-300 border border-slate-700">
                        {rawEvents.length} {rawEvents.length === 1 ? "evento" : "eventos"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Histórico de gols, cartões e lances em tempo real (alinhados por mandante e visitante)</p>
                  </div>
                </div>

                {/* Sort Order Toggle */}
                <button
                  onClick={() => setEventsSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 self-start sm:self-auto transition-all"
                >
                  <ArrowDownUp className="w-3.5 h-3.5 text-rose-400" />
                  <span>{eventsSortOrder === "desc" ? "Recentes no topo (90' ➔ 1')" : "Cronológico (1' ➔ 90')"}</span>
                </button>
              </div>

              {/* Team Alignment Legend Banner */}
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold justify-start">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                  <span className="truncate">Mandante (Esquerda): {match.homeTeam.name}</span>
                </div>
                <div className="flex items-center gap-2 text-cyan-400 font-bold justify-end text-right">
                  <span className="truncate">Visitante (Direita): {match.awayTeam.name}</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm animate-pulse"></span>
                </div>
              </div>

              {/* Filter Chips Bar (Substituições removidas conforme solicitação) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setEventFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    eventFilter === "all"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm"
                      : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Todos ({rawEvents.length})</span>
                </button>

                <button
                  onClick={() => setEventFilter("goals")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    eventFilter === "goals"
                      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm"
                      : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-emerald-300 hover:bg-slate-800"
                  }`}
                >
                  <span>⚽ Gols ({goalsCount})</span>
                </button>

                <button
                  onClick={() => setEventFilter("cards")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    eventFilter === "cards"
                      ? "bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm"
                      : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-amber-300 hover:bg-slate-800"
                  }`}
                >
                  <span>🟨 🟥 Cartões ({cardsCount})</span>
                </button>

                {varCount > 0 && (
                  <button
                    onClick={() => setEventFilter("var")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      eventFilter === "var"
                        ? "bg-purple-500/25 text-purple-300 border-purple-500/50 shadow-sm"
                        : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-purple-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>📺 VAR ({varCount})</span>
                  </button>
                )}
              </div>

              {/* Events Timeline List with Left/Right Home/Away alignment */}
              {sortedEvents.length > 0 ? (
                <div className="relative space-y-5 md:before:absolute md:before:left-1/2 md:before:top-3 md:before:bottom-3 md:before:w-0.5 md:before:-translate-x-1/2 md:before:bg-slate-800">
                  {sortedEvents.map((ev, index) => {
                    const isHome = ev.team === "home" || !ev.team;
                    const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;

                    const isGoal = ev.type === "goal" || ev.type === "penalty_scored";
                    const isYellow = ev.type === "yellow_card";
                    const isRed = ev.type === "red_card";
                    const isVar = ev.type === "var";

                    return (
                      <div
                        key={ev.id || `${ev.minute}-${index}`}
                        className={`relative flex flex-col ${
                          isHome
                            ? "md:w-[calc(50%-18px)] md:mr-auto"
                            : "md:w-[calc(50%-18px)] md:ml-auto"
                        }`}
                      >
                        <div
                          className={`relative p-4 rounded-xl border transition-all shadow-md ${
                            isHome
                              ? "border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900/90 border-slate-800 text-left"
                              : "border-r-4 border-r-cyan-500 bg-gradient-to-l from-cyan-950/40 via-slate-900 to-slate-900/90 border-slate-800 text-left"
                          } ${
                            isGoal
                              ? "ring-1 ring-emerald-500/40 shadow-emerald-950/50"
                              : isRed
                              ? "ring-1 ring-rose-500/40 shadow-rose-950/50"
                              : isYellow
                              ? "ring-1 ring-amber-500/30"
                              : isVar
                              ? "ring-1 ring-purple-500/30"
                              : ""
                          }`}
                        >
                          {/* Minute node connection on timeline */}
                          <div
                            className={`hidden md:flex absolute top-4 min-w-7 h-7 px-1 rounded-full bg-slate-950 border-2 items-center justify-center text-[10px] font-mono font-bold z-10 shadow-md ${
                              isHome
                                ? "-right-[36px] border-emerald-500 text-emerald-300"
                                : "-left-[36px] border-cyan-500 text-cyan-300"
                            }`}
                            title={`Minuto ${formatMatchMinute(ev.minute, undefined, ev.extraMinute)}`}
                          >
                            {formatMatchMinute(ev.minute, undefined, ev.extraMinute)}
                          </div>

                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Minute badge (visible on mobile) */}
                              <span className="md:hidden px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-black font-mono text-white shadow-inner">
                                {formatMatchMinute(ev.minute, undefined, ev.extraMinute)}
                              </span>

                              {/* Event Type badge */}
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
                                  isGoal
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : isRed
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : isYellow
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : isVar
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : "bg-slate-800 text-slate-300 border-slate-700"
                                }`}
                              >
                                {isGoal && "⚽ GOL"}
                                {isYellow && "🟨 Cartão Amarelo"}
                                {isRed && "🟥 Cartão Vermelho"}
                                {isVar && "📺 VAR"}
                                {!isGoal && !isYellow && !isRed && !isVar && (ev.type || "Lance")}
                              </span>

                              {/* Team Tag */}
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                  isHome
                                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-700/50"
                                    : "bg-cyan-950/70 text-cyan-300 border-cyan-700/50"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isHome ? "bg-emerald-400" : "bg-cyan-400"}`}></span>
                                {isHome ? "Mandante" : "Visitante"}: {teamName}
                              </span>
                            </div>

                            {/* Score at moment of event */}
                            {ev.score && (
                              <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-slate-950 text-emerald-400 border border-emerald-500/30">
                                Placar: {ev.score}
                              </span>
                            )}
                          </div>

                          {/* Player & Detail Info */}
                          <div className="space-y-1 mt-2 text-xs">
                            {ev.player && (
                              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                <span>{ev.player}</span>
                              </div>
                            )}

                            {ev.assistPlayer && (
                              <div className="text-slate-300 flex items-center gap-1">
                                <span className="text-slate-400 font-medium">Assistência:</span>
                                <span className="font-semibold text-slate-200">{ev.assistPlayer}</span>
                              </div>
                            )}

                            {ev.detail && (
                              <div className="text-slate-400 text-xs italic bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                                {ev.detail}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Nenhum evento registrado no filtro selecionado</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      {eventFilter === "all"
                        ? "Esta partida ainda não possui eventos detalhados cadastrados ou os dados estão sendo transmitidos em tempo real pelo crawler."
                        : `Não foram encontrados eventos do tipo "${eventFilter}" para este confronto.`}
                    </p>
                  </div>
                  {eventFilter !== "all" && (
                    <button
                      onClick={() => setEventFilter("all")}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all"
                    >
                      Ver Todos os Eventos
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 4: GEMINI AI TACTICAL ANALYSIS */}
          {activeSubTab === "ai" && (
            <div className="bg-slate-900/90 rounded-2xl border border-purple-900/40 p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Diagnóstico Tático com IA (Gemini)</h3>
                    <p className="text-xs text-slate-400">Leitura de fluxo de jogo, momentum e projeção de gols</p>
                  </div>
                </div>

                <button
                  onClick={() => onAnalyzeWithAi(match.id)}
                  disabled={isAiLoading}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950/50 flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCw className={`w-4 h-4 ${isAiLoading ? "animate-spin" : ""}`} />
                  {isAiLoading ? "Analisando Partida..." : "Gerar Nova Análise IA"}
                </button>
              </div>

              {isAiLoading ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-semibold text-purple-300">
                    Gemini processando estatísticas de pressão, xG e eventos...
                  </p>
                  <p className="text-xs text-slate-500">Calculando probabilidade de gol e ângulos de mercado</p>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-6">
                  {/* Summary box */}
                  <div className="bg-purple-950/30 border border-purple-800/40 p-4 rounded-xl">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block">
                        Resumo Tático da Partida
                      </span>
                      <div className="flex items-center gap-1.5">
                        {aiAnalysis.source === "gemini" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            ✨ Gemini AI
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            🛡️ Heurística {aiAnalysis.isQuotaExhausted ? "(Cota Protegida)" : "(Econômica)"}
                          </span>
                        )}
                        {aiAnalysis.isCached && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            📦 Em Cache
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-normal">
                      {aiAnalysis.summary}
                    </p>
                  </div>

                  {/* Probabilities & Pressure Indexes */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Next Goal Probability */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-slate-400 block mb-2">
                        Probabilidade do Próximo Gol
                      </span>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-400 font-semibold">{match.homeTeam.name}:</span>
                          <span className="font-bold text-white">{aiAnalysis.nextGoalProbability.home}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${aiAnalysis.nextGoalProbability.home}%` }} />
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-cyan-400 font-semibold">{match.awayTeam.name}:</span>
                          <span className="font-bold text-white">{aiAnalysis.nextGoalProbability.away}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500" style={{ width: `${aiAnalysis.nextGoalProbability.away}%` }} />
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-400 font-semibold">Sem novos gols:</span>
                          <span className="font-bold text-slate-300">{aiAnalysis.nextGoalProbability.noGoal}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Corner & Card Threat Level */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-slate-400 block mb-2">
                        Termômetro de Risco & Cantos
                      </span>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">Pressão de Escanteios:</span>
                            <span className="font-bold text-cyan-400">{aiAnalysis.cornerPressureScore}/100</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${aiAnalysis.cornerPressureScore}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">Risco de Cartões / Faltas:</span>
                            <span className="font-bold text-amber-400">{aiAnalysis.cardRiskScore}/100</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${aiAnalysis.cardRiskScore}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Next Likely Event */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 block mb-2">
                          Evento Mais Provável (10-15 min)
                        </span>
                        <p className="text-xs font-medium text-emerald-300 leading-snug">
                          "{aiAnalysis.likelyNextEvent}"
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-2">
                        Gerado em: {new Date(aiAnalysis.analyzedAt).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  {/* Key Insights & Trading Angles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-cyan-400" />
                        Insights Chave
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiAnalysis.keyInsights.map((insight, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        Ângulos de Análise / Trading
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiAnalysis.tradingAngles.map((angle, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold">✓</span>
                            <span>{angle}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400 mb-3">
                    Clique no botão acima para acionar a inteligência artificial Gemini para analisar a dinâmica e tendências desta partida.
                  </p>
                  <button
                    onClick={() => onAnalyzeWithAi(match.id)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md"
                  >
                    Analisar Agora
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
