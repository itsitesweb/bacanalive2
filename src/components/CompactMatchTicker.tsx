// src/components/CompactMatchTicker.tsx
import React from "react";
import { Match, MatchRulesAnalysis } from "../types";
import { Activity, Flame, ShieldAlert, Clock, ArrowRight, Zap, Trash2, ExternalLink, Star } from "lucide-react";
import { getFlashscoreUrl } from "../utils/flashscore";
import { formatMatchMinute, getMatchPeriod } from "../utils/minuteFormatter";
import { RedCardBadges, getTeamRedCards } from "./RedCardBadges";

interface CompactMatchTickerProps {
  matches: Match[];
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string) => void;
  onDeleteMatch?: (matchId: string, e: React.MouseEvent) => void;
  onToggleFavorite?: (matchId: string, e: React.MouseEvent) => void;
  favoriteMatchIds?: string[];
  rulesAnalysisMap?: Record<string, MatchRulesAnalysis>;
  ratioConfigured?: number;
  flashingMatchIds?: Record<string, number>;
}

export function CompactMatchTicker({
  matches,
  selectedMatchId,
  onSelectMatch,
  onDeleteMatch,
  onToggleFavorite,
  favoriteMatchIds = [],
  rulesAnalysisMap = {},
  ratioConfigured = 3.0,
  flashingMatchIds = {},
}: CompactMatchTickerProps) {
  // Extract all recent events from all concurrent matches, sorted newest first
  const allRecentEvents = matches
    .flatMap((m) =>
      m.events.map((e) => ({
        ...e,
        matchTitle: `${m.homeTeam.shortName} x ${m.awayTeam.shortName}`,
        matchId: m.id,
        league: m.league,
      }))
    )
    .sort((a, b) => b.minute - a.minute);

  return (
    <div className="space-y-3">
      {/* Live Event Ticker Tape Marquee / Feed */}
      {allRecentEvents.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 overflow-hidden shadow-inner">
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Ticker de Eventos Simultâneos
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {allRecentEvents.slice(0, 8).map((ev, idx) => (
              <button
                key={`${ev.matchId}-${ev.id}-${idx}`}
                onClick={() => onSelectMatch(ev.matchId)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all border shrink-0 ${
                  ev.type === "goal"
                    ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/50"
                    : ev.type === "red_card"
                    ? "bg-rose-950/60 border-rose-600/40 text-rose-300 hover:bg-rose-900/50"
                    : ev.type === "yellow_card"
                    ? "bg-amber-950/60 border-amber-600/40 text-amber-300 hover:bg-amber-900/50"
                    : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="font-bold">{formatMatchMinute(ev.minute, undefined, ev.extraMinute)}</span>
                <span>
                  {ev.type === "goal"
                    ? "⚽"
                    : ev.type === "yellow_card"
                    ? "🟨"
                    : ev.type === "red_card"
                    ? "🟥"
                    : "🚩"}
                </span>
                <span className="font-bold text-white">{ev.matchTitle}</span>
                {ev.player && <span className="text-slate-400">({ev.player})</span>}
                {ev.score && <span className="font-extrabold text-emerald-400">[{ev.score}]</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dense Ticker-Style Match List */}
      <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-1">
        {matches.map((match) => {
          const isSelected = selectedMatchId === match.id;
          const isFavorite = favoriteMatchIds.includes(match.id);
          const isLive =
            match.status === "1H" || match.status === "2H" || match.status === "1T" || match.status === "2T" || match.status === "LIVE";
          const homePressure = match.stats.pressureIndex.home;
          const awayPressure = match.stats.pressureIndex.away;
          const dominantPressure = Math.max(homePressure, awayPressure);
          const isHot = dominantPressure >= 75;

          // Latest single event for this match
          const latestEvent = match.events[0];

          const isFlashing = Boolean(flashingMatchIds && flashingMatchIds[match.id]);

          return (
            <div
              key={match.id}
              onClick={() => onSelectMatch(match.id)}
              className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all border flex items-center justify-between gap-3 group ${
                isFlashing
                  ? "bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.8)] animate-pulse"
                  : isSelected
                  ? "bg-slate-800/95 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40"
                  : "bg-slate-900/70 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700"
              }`}
            >
              {/* Left: Time & Teams */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Minute Badge */}
                <div className="min-w-[4.25rem] shrink-0 text-center">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700/60 whitespace-nowrap">
                      {formatMatchMinute(match.minute, match.status)}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                      {match.status === "FT" ? "FT" : match.status}
                    </span>
                  )}
                </div>

                {/* Match names and score */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    {/* Teams with Hover Tooltip displaying full team names */}
                    <div
                      title={`Mandante: ${match.homeTeam.name}\nVisitante: ${match.awayTeam.name}`}
                      className="flex items-center gap-1.5 text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors"
                    >
                      <span>{match.homeTeam.logo}</span>
                      <span
                        title={match.homeTeam.name}
                        className="truncate hover:underline decoration-emerald-400/60"
                      >
                        {match.homeTeam.shortName || match.homeTeam.name}
                      </span>
                      <RedCardBadges count={getTeamRedCards(match, "home")} size="sm" />
                      <span className="text-slate-500 font-normal">vs</span>
                      <span>{match.awayTeam.logo}</span>
                      <span
                        title={match.awayTeam.name}
                        className="truncate hover:underline decoration-cyan-400/60"
                      >
                        {match.awayTeam.shortName || match.awayTeam.name}
                      </span>
                      <RedCardBadges count={getTeamRedCards(match, "away")} size="sm" />
                    </div>

                    {/* Placar com fonte maior e destaque */}
                    <span className="text-sm font-black font-mono text-emerald-400 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 shadow-sm shrink-0 tracking-tight">
                      {match.score.home} - {match.score.away}
                    </span>
                  </div>

                  {/* Secondary Ticker Subline: Latest Event or Pressure Meter */}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="truncate text-slate-400 font-medium flex items-center gap-1">
                      {match.country && (
                        <strong className="text-emerald-400 font-bold">
                          {typeof match.country === 'object' && match.country !== null ? (match.country as any).name || 'País' : String(match.country)} •
                        </strong>
                      )}
                      <span>{typeof match.league === 'object' && match.league !== null ? (match.league as any).name || 'Liga' : String(match.league || '')}</span>
                    </span>

                    {latestEvent && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-emerald-300 font-semibold truncate flex items-center gap-1">
                          <span>
                            {latestEvent.type === "goal" ? "⚽" : latestEvent.type === "red_card" ? "🟥" : "🚩"}
                          </span>
                          <span>{latestEvent.player || latestEvent.type} ({formatMatchMinute(latestEvent.minute, undefined, latestEvent.extraMinute)})</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Key Stats Ticker Chips & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Pressure Mini Tag */}
                <div
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    isHot
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse"
                      : "bg-slate-950 text-slate-300 border-slate-800"
                  }`}
                  title={`Pressão: ${match.homeTeam.shortName} ${homePressure}% x ${awayPressure}% ${match.awayTeam.shortName}`}
                >
                  <Zap className={`w-2.5 h-2.5 ${isHot ? "text-amber-400" : "text-slate-400"}`} />
                  <span>{Math.max(homePressure, awayPressure)}%</span>
                </div>

                {/* xG */}
                <div
                  className="hidden sm:flex flex-col text-right font-mono text-[9px] text-slate-400"
                  title="Gols Esperados (xG Mandante - Visitante)"
                >
                  <span className="text-slate-500">xG</span>
                  <span className="text-slate-300 font-bold">
                    {match.stats.xG.home.toFixed(1)}-{match.stats.xG.away.toFixed(1)}
                  </span>
                </div>

                {/* Corners */}
                <div
                  className="hidden sm:flex flex-col text-right font-mono text-[9px] text-slate-400"
                  title="Escanteios (Mandante - Visitante)"
                >
                  <span className="text-slate-500">Cantos</span>
                  <span className="text-slate-300 font-bold">
                    {match.stats.corners.home + match.stats.corners.away}
                  </span>
                </div>

                {/* FlashScore Link */}
                <a
                  href={getFlashscoreUrl(match)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Abrir no FlashScore"
                  className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/40 border border-cyan-500/20 hover:border-cyan-500/50 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>

                {/* Favorite Star Button */}
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(match.id, e);
                    }}
                    title={isFavorite ? "Remover dos Favoritos" : "Favoritar partida (fixar no topo)"}
                    className={`p-1 rounded transition border ${
                      isFavorite
                        ? "text-amber-400 bg-amber-500/20 border-amber-500/40 shadow-sm"
                        : "text-slate-500 hover:text-amber-400 hover:bg-slate-800 border-transparent"
                    }`}
                  >
                    <Star className={`w-3 h-3 ${isFavorite ? "fill-amber-400" : ""}`} />
                  </button>
                )}

                {/* Delete Match Button */}
                {onDeleteMatch && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMatch(match.id, e);
                    }}
                    title="Apagar jogo (ocultar nesta sessão)"
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
