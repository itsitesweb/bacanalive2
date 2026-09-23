// src/components/RedCardBadges.tsx
import React from "react";
import { Match } from "../types";

interface RedCardBadgesProps {
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Returns total count of red cards for a specific team in a match.
 */
export function getTeamRedCards(match?: Match | null, team?: "home" | "away"): number {
  if (!match || !team) return 0;
  const statsCount = Number(match.stats?.redCards?.[team] || 0);
  const eventsCount = Array.isArray(match.events)
    ? match.events.filter(
        (e: any) =>
          (e.type === "red_card" || e.type === "cartao_vermelho") &&
          (e.team === team || (team === "home" ? e.team === 1 : e.team === 2))
      ).length
    : 0;
  return Math.max(statsCount, eventsCount);
}

/**
 * Renders an authentic referee red card icon for each sent-off player.
 */
export function RedCardBadges({ count = 0, size = "md", className = "" }: RedCardBadgesProps) {
  if (!count || count <= 0) return null;

  const sizeClasses = {
    sm: "w-2 h-3 rounded-[1px]",
    md: "w-2.5 h-3.5 rounded-[1.5px]",
    lg: "w-3 h-4.5 rounded-[2px]",
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 align-middle select-none ${className}`}
      title={`${count} jogador(es) expulso(s) (Cartão Vermelho)`}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <span
          key={idx}
          aria-label="Cartão Vermelho"
          className={`inline-block bg-rose-600 border border-rose-300 dark:border-rose-400 shadow-xs shadow-rose-950/60 transform -rotate-6 transition-transform hover:scale-125 cursor-help ${sizeClasses}`}
        >
          <span className="block w-full h-full bg-gradient-to-br from-rose-300/40 via-transparent to-rose-900/40 pointer-events-none" />
        </span>
      ))}
    </span>
  );
}
