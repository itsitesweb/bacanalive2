// src/components/MatchCard.tsx
import React from "react";
import { Match, MatchRulesAnalysis } from "../types";
import { Zap, Flame, ShieldAlert, Sparkles, GripVertical, ChevronLeft, ChevronRight, Trash2, ExternalLink, Star } from "lucide-react";
import { getFlashscoreUrl } from "../utils/flashscore";
import { getLivePressure5Min } from "../utils/pressure";
import { formatMatchMinute } from "../utils/minuteFormatter";
import { RedCardBadges, getTeamRedCards } from "./RedCardBadges";
import { getLeagueTierInfo } from "../utils/leagueTier";
import { getMarketRecommendation } from "../utils/marketRecommendation";

interface MatchCardProps {
  key?: React.Key;
  match: Match;
  isSelected: boolean;
  onSelect: () => void;
  rulesAnalysis?: MatchRulesAnalysis;
  ratioConfigured?: number;
  onMoveLeft?: (e: React.MouseEvent) => void;
  onMoveRight?: (e: React.MouseEvent) => void;
  onDeleteMatch?: (e: React.MouseEvent) => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  isFavorite?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isBeingDragged?: boolean;
  isFlashingGoal?: boolean;
}

export function MatchCard({
  match,
  isSelected,
  onSelect,
  rulesAnalysis,
  ratioConfigured = 3.0,
  onMoveLeft,
  onMoveRight,
  onDeleteMatch,
  onToggleFavorite,
  isFavorite = false,
  canMoveLeft = false,
  canMoveRight = false,
  isDraggable = true,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isBeingDragged = false,
  isFlashingGoal = false,
}: MatchCardProps) {
  const isLive = match.status === "1H" || match.status === "2H" || match.status === "1T" || match.status === "2T" || match.status === "LIVE";
  const {
    home: homePressure,
    away: awayPressure,
    dominanceText,
    intensity: pressureIntensity,
    sterilePossessionHome,
    sterilePossessionAway,
    explanation: pressureExplanation,
  } = getLivePressure5Min(
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

  const homeCc = match.stats.bigChances?.home ?? Math.max(0, Math.floor(match.stats.shotsOnTarget.home / 2));
  const awayCc = match.stats.bigChances?.away ?? Math.max(0, Math.floor(match.stats.shotsOnTarget.away / 2));
  const totalCc = homeCc + awayCc;

  // Standard clean border & background styling or intense flash on Goal
  const cardBorderClasses = isFlashingGoal
    ? "bg-emerald-950/70 border-emerald-400 ring-4 ring-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.9)] animate-pulse"
    : isSelected
    ? "bg-slate-800/95 border-emerald-500/80 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50"
    : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850";

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`p-3.5 sm:p-4 rounded-2xl cursor-pointer transition-all duration-200 border relative overflow-hidden flex flex-col justify-between select-none ${
        isBeingDragged ? "opacity-40 scale-95 border-dashed border-emerald-400" : ""
      } ${cardBorderClasses}`}
    >
      {/* Flashing Goal Banner if active */}
      {isFlashingGoal && (
        <div className="mb-2 py-1 px-2.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-between shadow-lg shadow-emerald-950/60 animate-bounce">
          <span className="flex items-center gap-1.5">
            <span className="text-sm">⚽</span>
            <span className="tracking-wide">GOL CONFIRMADO!</span>
          </span>
          <span className="font-mono text-[11px] bg-slate-950 text-emerald-300 px-2 py-0.5 rounded font-black border border-emerald-400/40">
            {match.score.home} - {match.score.away}
          </span>
        </div>
      )}

      {/* Card Header: Toolbar buttons on top bar, followed by 100% width Country, League, and Start Time */}
      <div>
        {/* Top Control Bar: Action Buttons & Live Status */}
        <div className="flex items-center justify-between gap-1.5 mb-2 relative z-10">
          <div className="flex items-center gap-1 min-w-0">
            <span
              title="Arraste para reposicionar o card"
              className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 p-0.5"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>

            {/* Quick Reorder Controls (Move Left / Move Right) */}
            {onMoveLeft && canMoveLeft && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveLeft(e);
                }}
                title="Mover card para esquerda"
                className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            )}
            {onMoveRight && canMoveRight && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveRight(e);
                }}
                title="Mover card para direita"
                className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            )}

            {/* Favorite Star Button */}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(e);
                }}
                title={isFavorite ? "Remover dos Favoritos" : "Favoritar partida (fixar no topo)"}
                className={`p-1 rounded transition border ${
                  isFavorite
                    ? "text-amber-400 bg-amber-500/20 border-amber-500/40 shadow-sm"
                    : "text-slate-500 hover:text-amber-400 hover:bg-slate-800 border-transparent"
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? "fill-amber-400" : ""}`} />
              </button>
            )}

            {/* FlashScore Link */}
            <a
              href={getFlashscoreUrl(match)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Abrir partida no FlashScore"
              className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/40 border border-cyan-500/20 hover:border-cyan-500/50 transition"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Right: Status Badge & Delete Icon next to game time */}
          <div className="flex items-center gap-1.5 shrink-0">
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
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800/80 text-amber-300 border border-slate-700/70">
                    45' HT
                  </span>
                );
              }
              if (statusUpper === "FT" || statusUpper === "FINISHED" || statusUpper === "ENCERRADO") {
                return (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    FT Encerrado
                  </span>
                );
              }
              if (isLive) {
                const minDisplay = formatMatchMinute(match.minute, match.status);
                return (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-200 border border-slate-700/60">
                    {minDisplay}
                  </span>
                );
              }
              return (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
                  {match.status || "AGENDADO"}
                </span>
              );
            })()}

            {/* Delete Match Button right next to game time */}
            {onDeleteMatch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMatch(e);
                }}
                title="Apagar jogo (ocultar nesta sessão)"
                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 100% Width Country, League & Time Header */}
        <div className="w-full min-w-0 flex flex-col gap-0.5 mb-2.5 pb-2 border-b border-slate-800/80">
          {/* Linha 1: País */}
          {match.country && (
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wide truncate w-full block">
              {typeof match.country === 'object' && match.country !== null ? (match.country as any).name || 'País' : String(match.country)}
            </span>
          )}
          {/* Linha 2: Liga com TIER */}
          <div className="flex items-center gap-1.5 min-w-0 w-full mb-0.5">
            <span className="text-[11px] font-bold text-slate-100 uppercase tracking-tight truncate flex-1">
              {typeof match.league === 'object' && match.league !== null ? (match.league as any).name || 'Liga' : String(match.league || '')}
            </span>
            {(() => {
              const tierInfo = getLeagueTierInfo(match.league, match.country || match.leagueCountry);
              return (
                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border shrink-0 uppercase tracking-wider ${tierInfo.badgeClass}`}>
                  {tierInfo.label}
                </span>
              );
            })()}
          </div>
          {/* Linha 3: Horário oficial de início da partida */}
          {(() => {
            let timeStr = match.startTime || "";
            if (!timeStr && match.startDate) {
              try {
                const d = new Date(match.startDate);
                if (!isNaN(d.getTime())) {
                  timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                }
              } catch {
                timeStr = "";
              }
            }
            return timeStr ? (
              <span className="text-[9.5px] text-slate-400 font-mono leading-tight truncate w-full block">
                Início: {timeStr}
              </span>
            ) : null;
          })()}
        </div>

        {/* Teams and Score Grid */}
        <div className="space-y-1.5 mb-2.5">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm">{match.homeTeam.logo}</span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {match.homeTeam.name}
              </span>
              <RedCardBadges count={getTeamRedCards(match, "home")} size="sm" />
            </div>
            <div className="flex items-center gap-1.5">
              {homePressure >= 75 && (
                <span title="Pressão Alta Mandante" className="text-[9px] text-amber-400">
                  🔥
                </span>
              )}
              <span className="text-base font-black text-white w-5 text-right font-mono">
                {match.score?.home ?? (match.homeTeam as any)?.score ?? 0}
              </span>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm">{match.awayTeam.logo}</span>
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {match.awayTeam.name}
              </span>
              <RedCardBadges count={getTeamRedCards(match, "away")} size="sm" />
            </div>
            <div className="flex items-center gap-1.5">
              {awayPressure >= 75 && (
                <span title="Pressão Alta Visitante" className="text-[9px] text-cyan-400">
                  🔥
                </span>
              )}
              <span className="text-base font-black text-white w-5 text-right font-mono">
                {match.score?.away ?? (match.awayTeam as any)?.score ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Pressure Mini-Meter (Últimos 5 Minutos com Proteção contra Análise Incorreta) */}
        <div
          className="mb-2.5 p-1.5 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-inner"
          title={`Pressão 5m: Mandante ${homePressure}% vs Visitante ${awayPressure}%\nIntensidade: ${pressureIntensity?.toUpperCase()}\nDiagnóstico: ${dominanceText}\n${pressureExplanation}`}
        >
          <div className="flex items-center justify-between text-[9.5px] mb-1 font-semibold">
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="text-emerald-300 font-black font-mono">{homePressure}%</span>
              {sterilePossessionHome && (
                <span
                  title="Posse Estéril: Mandante retém a bola sem penetração na área ou chutes"
                  className="text-[7.5px] font-bold text-amber-400 bg-slate-900 px-1 py-0.2 rounded border border-slate-800"
                >
                  Estéril
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded border border-slate-700/80 bg-slate-900 text-slate-300 shadow-sm">
                Pressão 5'
              </span>
            </div>

            <div className="flex items-center gap-1 min-w-0 justify-end">
              {sterilePossessionAway && (
                <span
                  title="Posse Estéril: Visitante retém a bola sem penetração na área ou chutes"
                  className="text-[7.5px] font-bold text-amber-400 bg-slate-900 px-1 py-0.2 rounded border border-slate-800"
                >
                  Estéril
                </span>
              )}
              <span className="text-orange-300 font-black font-mono">{awayPressure}%</span>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0"></span>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800 shadow-inner">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
              style={{ width: `${(homePressure / (homePressure + awayPressure || 1)) * 100}%` }}
            />
            <div
              className="bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300 shadow-[0_0_6px_rgba(249,115,22,0.5)]"
              style={{ width: `${(awayPressure / (homePressure + awayPressure || 1)) * 100}%` }}
            />
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
            <div className={`mb-2.5 p-2 rounded-xl border text-[10px] bg-slate-950/90 shadow-sm transition-all duration-300 animate-pulse ${rec.badgeClass}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 font-bold truncate">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider bg-slate-900 text-white">
                    {displayActionLabel}
                  </span>
                  <span className="text-white font-black truncate">{rec.marketTitle}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-slate-300 font-mono font-bold">
                    Alvo @{rec.targetOdd.toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="text-[9.5px] text-slate-300 leading-snug">
                {rec.reasoning}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Quick stats footer with CC (Chances Claras) */}
      <div className="grid grid-cols-4 gap-1 text-center pt-2 border-t border-slate-800/80 text-[9px] text-slate-400 relative z-10">
        <div
          className="p-0.5 rounded"
          title={`Total: ${totalCc} Chances Claras (Índice: ${ratioConfigured} CC/Gol)`}
        >
          <span className="block text-slate-400">
            CC
          </span>
          <span className="font-black text-amber-400">
            {homeCc}-{awayCc}
          </span>
        </div>
        <div className="p-0.5">
          <span className="text-slate-400 block">xG</span>
          <span className="font-semibold text-slate-200">
            {match.stats.xG.home.toFixed(1)}-{match.stats.xG.away.toFixed(1)}
          </span>
        </div>
        <div className="p-0.5">
          <span className="text-slate-400 block">Chutes</span>
          <span className="font-semibold text-slate-200">
            {match.stats.shotsOnTarget.home}-{match.stats.shotsOnTarget.away}
          </span>
        </div>
        <div className="p-0.5">
          <span className="text-slate-400 block">Cantos</span>
          <span className="font-semibold text-slate-200">
            {match.stats.corners.home}-{match.stats.corners.away}
          </span>
        </div>
      </div>
    </div>
  );
}

