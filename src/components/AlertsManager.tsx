// src/components/AlertsManager.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  AlertRule,
  AlertLog,
  AlertSeverity,
  Match,
  OperationalRulesConfig,
  SuperPressureTrendConfig,
  MatchRulesAnalysis,
  TrendAlertEvaluation,
  DEFAULT_SUPER_PRESSURE_CONFIG,
} from "../types";
import {
  Bell,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Search,
  Zap,
  Info,
  Eye,
  EyeOff,
  ExternalLink,
  TrendingUp,
  Clock,
  Activity,
  Sparkles,
  Check,
  RotateCcw,
  Sliders,
  Gauge,
  Plus,
  RefreshCw,
  Filter,
} from "lucide-react";
import { getFlashscoreUrl } from "../utils/flashscore";
import { formatMatchMinute } from "../utils/minuteFormatter";
import { NewRuleForm, RuleCard } from "./AlertRuleEditor";
import { getLeagueTierInfo } from "../utils/leagueTier";

export interface ActiveFiltersProps {
  country?: string;
  league?: string;
  tiers?: string[];
  search?: string;
}

interface AlertsManagerProps {
  rules?: AlertRule[];
  logs: AlertLog[];
  matches: Match[];
  allMatches?: Match[];
  rulesConfig?: OperationalRulesConfig | null;
  rulesAnalysisMap?: Record<string, MatchRulesAnalysis>;
  activeFilters?: ActiveFiltersProps;
  onUpdateRulesConfig?: (config: OperationalRulesConfig) => Promise<void>;
  onSaveRule?: (rule: AlertRule) => Promise<void>;
  onDeleteRule?: (id: string) => Promise<void>;
  onDeleteAlert?: (id: string) => Promise<void>;
  onDeleteMatch?: (id: string) => Promise<void> | void;
  onMarkAsRead?: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onTriggerTestAlert?: (severity: AlertSeverity) => void;
  onSelectMatch?: (matchId: string) => void;
}

export function AlertsManager({
  rules = [],
  logs,
  matches,
  allMatches,
  rulesConfig,
  rulesAnalysisMap,
  activeFilters,
  onUpdateRulesConfig,
  onSaveRule,
  onDeleteRule,
  onDeleteAlert,
  onDeleteMatch,
  onMarkAsRead,
  onClearLogs,
  onTriggerTestAlert,
  onSelectMatch,
}: AlertsManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"logs" | "rules" | "trend_config">("logs");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "goal" | "trend" | "imminent" | "triple_debt" | "goal_debt" | "super_back" | "btts" | "corners"
  >("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchLog, setSearchLog] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Toggle para mostrar ou ocultar alertas de GOL marcado (sincronizado com localStorage e com o servidor)
  const [showGoalAlerts, setShowGoalAlerts] = useState<boolean>(() => {
    if (rulesConfig && (rulesConfig.showGoalAlerts !== undefined || rulesConfig.enableGoalAlerts !== undefined)) {
      return rulesConfig.showGoalAlerts !== false && rulesConfig.enableGoalAlerts !== false;
    }
    try {
      const saved = localStorage.getItem("bacanapicks_show_goal_alerts");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (rulesConfig && (rulesConfig.showGoalAlerts !== undefined || rulesConfig.enableGoalAlerts !== undefined)) {
      setShowGoalAlerts(rulesConfig.showGoalAlerts !== false && rulesConfig.enableGoalAlerts !== false);
    }
  }, [rulesConfig?.showGoalAlerts, rulesConfig?.enableGoalAlerts]);

  const toggleShowGoalAlerts = async () => {
    const next = !showGoalAlerts;
    setShowGoalAlerts(next);
    try {
      localStorage.setItem("bacanapicks_show_goal_alerts", String(next));
    } catch {}
    if (onUpdateRulesConfig && rulesConfig) {
      try {
        await onUpdateRulesConfig({
          ...rulesConfig,
          showGoalAlerts: next,
          enableGoalAlerts: next,
        });
      } catch (err) {
        console.error("Falha ao sincronizar estado de visualização de gols com o servidor:", err);
      }
    }
  };

  // Classificação estrita de Alerta de Gol Marcado (não confunde com Gol Iminente, Dívida de Gols, etc)
  const isGoalAlertItem = (l: AlertLog) => {
    if (l.ruleId === "live-goal-delta" || l.category === "goal_alert" || l.category === "goal") {
      return true;
    }
    // Excluir regras táticas com 'gol' no nome/id
    if (
      l.ruleId.includes("imm") ||
      l.ruleId.includes("debt") ||
      l.ruleId.includes("divida") ||
      l.ruleId.includes("trinca") ||
      l.ruleId.includes("c31") ||
      l.ruleId.includes("super-back") ||
      l.ruleId.includes("btts") ||
      l.ruleId.includes("trend") ||
      l.ruleName.toLowerCase().includes("gol iminente") ||
      l.ruleName.toLowerCase().includes("dívida de gols") ||
      l.message.toLowerCase().includes("gol iminente")
    ) {
      return false;
    }
    return (
      l.message.includes("Placar anterior:") ||
      (l.message.startsWith("⚽ GOL!") && !l.message.toLowerCase().includes("iminente") && !l.message.toLowerCase().includes("dívida"))
    );
  };

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isAddingNewRule, setIsAddingNewRule] = useState<boolean>(false);
  const [searchRuleQuery, setSearchRuleQuery] = useState<string>("");
  const [ruleSeverityFilter, setRuleSeverityFilter] = useState<string>("all");
  const [ruleStatusFilter, setRuleStatusFilter] = useState<string>("all");

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (ruleSeverityFilter !== "all" && r.severity !== ruleSeverityFilter) return false;
      if (ruleStatusFilter === "enabled" && !r.enabled) return false;
      if (ruleStatusFilter === "disabled" && r.enabled) return false;
      if (searchRuleQuery) {
        const q = searchRuleQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          r.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rules, ruleSeverityFilter, ruleStatusFilter, searchRuleQuery]);

  const handleToggleRule = async (ruleId: string) => {
    const target = rules.find((r) => r.id === ruleId);
    if (!target || !onSaveRule) return;
    await onSaveRule({
      ...target,
      enabled: !target.enabled,
    });
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!onDeleteRule) return;
    if (confirm("Tem certeza que deseja excluir esta regra de alerta?")) {
      await onDeleteRule(ruleId);
      if (editingRuleId === ruleId) {
        setEditingRuleId(null);
      }
    }
  };

  const handleCreateNewRule = async (newRule: Partial<AlertRule>) => {
    if (!onSaveRule) return;
    await onSaveRule(newRule as AlertRule);
    setIsAddingNewRule(false);
  };

  const trendConfig: SuperPressureTrendConfig = useMemo(() => {
    return rulesConfig?.superPressureConfig || {
      enabled: rulesConfig?.enableTrendAlert !== false,
      minAvgPressure: rulesConfig?.trendAlertMinAvgPressure ?? 68,
      minConsistencyPct: rulesConfig?.trendAlertMinConsistencyPct ?? 65,
      windowMinutes: rulesConfig?.trendAlertWindowMinutes ?? 15,
      minMinute: rulesConfig?.trendAlertMinMinute ?? 15,
      pointThreshold: rulesConfig?.trendAlertPointThreshold ?? 60,
    };
  }, [rulesConfig]);

  const isTrendAlertEnabled = trendConfig.enabled !== false;
  const trendWindowMinutes = trendConfig.windowMinutes || 15;

  // Filter logs based on search keyword, alert type, and sort order
  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => {
        // Se o usuário optou por ocultar alertas de gol marcado
        if (!showGoalAlerts && isGoalAlertItem(l)) {
          return false;
        }

        // Type filter estritamente alinhado às 7 Regras Visuais do App (+ Gols Marcados)
        if (typeFilter !== "all") {
          const isGoal = isGoalAlertItem(l);

          // 1. Trend Alert / Super Pressão (Janela 10-15m)
          const isTrend =
            l.category === "trend_alert" ||
            l.ruleId === "python-trend-alert" ||
            l.ruleId === "rule-trend-super-pressure" ||
            l.ruleName.toLowerCase().includes("trend alert") ||
            l.ruleName.toLowerCase().includes("super pressão") ||
            l.message.toLowerCase().includes("trend alert") ||
            l.message.toLowerCase().includes("super pressão contínua");

          // 2. Gol Iminente (Surto Ofensivo 5m)
          const isImminent =
            l.category === "imminent_goal" ||
            l.ruleId === "python-imminent-goal" ||
            l.ruleId === "rule-gol-iminente-surto" ||
            l.ruleId === "rule-imminent-goal" ||
            l.ruleName.toLowerCase().includes("gol iminente") ||
            l.message.toLowerCase().includes("gol iminente") ||
            l.message.toLowerCase().includes("surto ofensivo");

          // 3. Trinca de Dívidas (CC + xG + xGOT Confluentes)
          const isTripleDebt =
            l.category === "triple_debt" ||
            l.ruleId === "rule-trinca-de-dividas" ||
            l.ruleId.includes("trinca") ||
            l.ruleName.toLowerCase().includes("trinca de dívidas") ||
            l.message.toLowerCase().includes("trinca de dívidas");

          // 4. Diagnóstico / Dívida de Gols (Código 3:1)
          const isGoalDebt =
            l.category === "codigo_31" ||
            l.ruleId === "rule-diagnostico-classico" ||
            l.ruleId.includes("c31") ||
            l.ruleId.includes("diagnostico") ||
            (l.category === "goal_debt" && !l.ruleId.includes("trinca")) ||
            (l.ruleName.toLowerCase().includes("diagnóstico") && !l.ruleName.toLowerCase().includes("trinca")) ||
            (l.ruleName.toLowerCase().includes("dívida de gols") && !l.ruleName.toLowerCase().includes("trinca")) ||
            (l.message.toLowerCase().includes("diagnóstico clássico") && !l.message.toLowerCase().includes("trinca"));

          // 5. Super Back Dominante (Reação Confirmada & Pressão Vendável)
          const isSuperBack =
            l.category === "super_back" ||
            l.category === "pressao_vendavel" ||
            l.ruleId.includes("super-back") ||
            l.ruleId.includes("pressao-vendavel") ||
            l.ruleId.includes("dominant") ||
            l.ruleName.toLowerCase().includes("super back") ||
            l.ruleName.toLowerCase().includes("pressão vendável") ||
            l.ruleName.toLowerCase().includes("back dominante");

          // 6. Ambas Marcam (BTTS: Sim)
          const isBtts =
            l.category === "btts" ||
            l.ruleId.includes("btts") ||
            l.ruleId.includes("ambas") ||
            l.ruleName.toLowerCase().includes("ambas") ||
            l.ruleName.toLowerCase().includes("btts");

          // 7. Cantos / Blitz de Escanteios
          const isCorners =
            l.category === "corners" ||
            l.category === "cantos" ||
            l.ruleId.includes("fc") ||
            l.ruleId.includes("cantos") ||
            l.ruleName.toLowerCase().includes("cantos") ||
            l.ruleName.toLowerCase().includes("escanteios") ||
            l.message.toLowerCase().includes("cantos");

          if (typeFilter === "goal" && !isGoal) return false;
          if (typeFilter === "trend" && !isTrend) return false;
          if (typeFilter === "imminent" && !isImminent) return false;
          if (typeFilter === "triple_debt" && !isTripleDebt) return false;
          if (typeFilter === "goal_debt" && !isGoalDebt) return false;
          if (typeFilter === "super_back" && !isSuperBack) return false;
          if (typeFilter === "btts" && !isBtts) return false;
          if (typeFilter === "corners" && !isCorners) return false;
        }

        // Search keyword
        if (searchLog) {
          const q = searchLog.toLowerCase();
          return (
            l.message.toLowerCase().includes(q) ||
            l.matchTitle.toLowerCase().includes(q) ||
            l.ruleName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [logs, typeFilter, searchLog, sortOrder, showGoalAlerts]);

  // Contagem de alertas de gol registrados
  const goalAlertsCount = useMemo(() => {
    return logs.filter(isGoalAlertItem).length;
  }, [logs]);

  // Regra 'Trend Alert: Super Pressão Contínua'
  const trendRule = useMemo(() => {
    return (
      rules.find(
        (r) =>
          r.id === "rule-trend-super-pressure" ||
          r.id === "python-trend-alert" ||
          r.name.toLowerCase().includes("trend alert") ||
          r.name.toLowerCase().includes("super pressão")
      ) || null
    );
  }, [rules]);

  // Critérios extraídos da regra ativa ou da configuração operacional
  const trendRuleCriteria = useMemo(() => {
    const minMinCond = trendRule?.conditions?.find((c) => c.metric === "minute");
    const pressCond = trendRule?.conditions?.find(
      (c) => c.metric === "pressureTrendWindow" || c.metric === "pressure" || c.metric === "avgPressure"
    );

    // Priorizar os critérios da configuração operacional ativa (o que o usuário edita no Config),
    // com fallback sincronizado para as condições da regra e para os padrões do sistema
    const minMinute =
      rulesConfig?.superPressureConfig?.minMinute !== undefined
        ? Number(rulesConfig.superPressureConfig.minMinute)
        : (rulesConfig?.trendAlertMinMinute !== undefined
            ? Number(rulesConfig.trendAlertMinMinute)
            : (minMinCond && typeof minMinCond.value === "number" ? Number(minMinCond.value) : 15));

    const minAvgPressure =
      rulesConfig?.superPressureConfig?.minAvgPressure !== undefined
        ? Number(rulesConfig.superPressureConfig.minAvgPressure)
        : (rulesConfig?.trendAlertMinAvgPressure !== undefined
            ? Number(rulesConfig.trendAlertMinAvgPressure)
            : (pressCond && typeof pressCond.value === "number" ? Number(pressCond.value) : 68));

    const windowMinutes =
      rulesConfig?.superPressureConfig?.windowMinutes !== undefined
        ? Number(rulesConfig.superPressureConfig.windowMinutes)
        : (rulesConfig?.trendAlertWindowMinutes !== undefined
            ? Number(rulesConfig.trendAlertWindowMinutes)
            : ((pressCond as any)?.windowMinutes !== undefined ? Number((pressCond as any).windowMinutes) : 15));

    const minConsistencyPct =
      rulesConfig?.superPressureConfig?.minConsistencyPct !== undefined
        ? Number(rulesConfig.superPressureConfig.minConsistencyPct)
        : (rulesConfig?.trendAlertMinConsistencyPct !== undefined
            ? Number(rulesConfig.trendAlertMinConsistencyPct)
            : 65);

    const pointThreshold =
      rulesConfig?.superPressureConfig?.pointThreshold !== undefined
        ? Number(rulesConfig.superPressureConfig.pointThreshold)
        : (rulesConfig?.trendAlertPointThreshold !== undefined
            ? Number(rulesConfig.trendAlertPointThreshold)
            : 60);

    const isEnabled =
      rulesConfig?.superPressureConfig?.enabled !== undefined
        ? Boolean(rulesConfig.superPressureConfig.enabled)
        : (trendRule ? trendRule.enabled : (rulesConfig?.enableTrendAlert !== false));

    return {
      ruleName: trendRule?.name || "📈 Trend Alert: Super Pressão Contínua",
      ruleDescription:
        trendRule?.description ||
        `Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=${minAvgPressure}% de média com consistência >=${minConsistencyPct}%) no histórico do momentum em ${windowMinutes}m.`,
      isEnabled,
      minMinute,
      minAvgPressure,
      windowMinutes,
      minConsistencyPct,
      pointThreshold,
    };
  }, [trendRule, rulesConfig]);

  // Partidas sob Super Pressão Contínua segundo o critério da Regra 'Trend Alert: Super Pressão Contínua'
  const highPressureMatches = useMemo(() => {
    const { minMinute, minAvgPressure, windowMinutes, minConsistencyPct, pointThreshold } = trendRuleCriteria;

    return matches
      .map((m) => {
        // 1. Tentar ler do motor de regras oficial do servidor (rulesAnalysisMap),
        // validando se atende aos critérios atualmente ativos na configuração
        const analysisTrend = rulesAnalysisMap?.[m.id]?.trendAlert;
        if (
          analysisTrend &&
          analysisTrend.qualified &&
          analysisTrend.teamName &&
          analysisTrend.avgPressure >= minAvgPressure &&
          analysisTrend.consistencyPct >= minConsistencyPct &&
          (m.minute || 0) >= minMinute
        ) {
          return {
            match: m,
            qualified: true,
            trendData: analysisTrend,
          };
        }

        // 2. Avaliação em tempo real com os critérios da regra
        const curMin = Math.max(1, m.minute || 1);
        const statusUpper = (m.status || "").toUpperCase();
        const isHT =
          statusUpper === "HT" ||
          statusUpper === "INT" ||
          statusUpper === "INTERVALO" ||
          statusUpper === "HALF TIME" ||
          statusUpper === "HALFTIME" ||
          statusUpper.includes("HT") ||
          statusUpper.includes("INTERVAL");

        const isFinished = statusUpper === "FT" || statusUpper === "FINISHED" || statusUpper === "ENCERRADO";
        if (isHT || isFinished) {
          return { match: m, qualified: false, trendData: null };
        }

        if (curMin < Math.max(minMinute, 5)) {
          return { match: m, qualified: false, trendData: null };
        }

        // Resguardo pós-gol unificado (cooldown de 3 minutos após qualquer gol)
        const postGoalCooldown = Number(rulesConfig?.postGoalCooldownMinutes ?? 3);
        const lastGoalMin = m.lastGoalMinute ?? (m.events?.filter(e => e.type === 'goal' || e.type === 'penalty_scored').reduce((acc, e) => Math.max(acc, e.minute || 0), 0) || null);
        if (lastGoalMin !== null && lastGoalMin > 0 && curMin >= lastGoalMin && (curMin - lastGoalMin) < postGoalCooldown) {
          return { match: m, qualified: false, trendData: null };
        }

        // Isolamento estrito de tempos: No 2º Tempo (minuto >= 46), a janela de pressão
        // JAMAIS pode usar pontos do final do 1º Tempo nem disparar sem volume acumulado no 2T
        const isSecondHalf = curMin >= 46;
        if (isSecondHalf && (curMin - 45) < windowMinutes) {
          return { match: m, qualified: false, trendData: null };
        }

        const rawTimeline = m.momentumTimeline || [];
        const minThreshold = isSecondHalf
          ? Math.max(46, curMin - windowMinutes)
          : Math.max(1, curMin - windowMinutes);

        const pointsInWindow = rawTimeline.filter(
          (pt) => pt.minute >= minThreshold && pt.minute <= curMin
        );

        if (pointsInWindow.length >= 3) {
          let homeSum = 0;
          let awaySum = 0;
          let homeHighPoints = 0;
          let awayHighPoints = 0;
          let homeShots = 0;
          let awayShots = 0;
          let homeAttacks = 0;
          let awayAttacks = 0;

          pointsInWindow.forEach((pt) => {
            const hPress = pt.homePressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 + pt.diff / 2)) : 50);
            const aPress = pt.awayPressure ?? (pt.diff !== undefined ? Math.min(100, Math.max(0, 50 - pt.diff / 2)) : 50);
            homeSum += hPress;
            awaySum += aPress;
            if (hPress >= pointThreshold) homeHighPoints++;
            if (aPress >= pointThreshold) awayHighPoints++;
            if (pt.homeShot) homeShots++;
            if (pt.awayShot) awayShots++;
            if (pt.homeDangerousAttack) homeAttacks++;
            if (pt.awayDangerousAttack) awayAttacks++;
          });

          const totalPts = pointsInWindow.length;
          const avgH = Math.round(homeSum / totalPts);
          const avgA = Math.round(awaySum / totalPts);
          const consH = Math.round((homeHighPoints / totalPts) * 100);
          const consA = Math.round((awayHighPoints / totalPts) * 100);

          const isHomeDom = avgH >= minAvgPressure && consH >= minConsistencyPct;
          const isAwayDom = avgA >= minAvgPressure && consA >= minConsistencyPct;

          if (isHomeDom || isAwayDom) {
            const domSide: 'home' | 'away' = isHomeDom && (!isAwayDom || avgH >= avgA) ? 'home' : 'away';
            const domTeam = domSide === 'home' ? m.homeTeam.name : m.awayTeam.name;
            const oppTeam = domSide === 'home' ? m.awayTeam.name : m.homeTeam.name;
            const domAvg = domSide === 'home' ? avgH : avgA;
            const domCons = domSide === 'home' ? consH : consA;
            const domHigh = domSide === 'home' ? homeHighPoints : awayHighPoints;
            const shots = domSide === 'home' ? homeShots : awayShots;
            const attacks = domSide === 'home' ? homeAttacks : awayAttacks;

            const trendData: TrendAlertEvaluation = {
              qualified: true,
              team: domSide,
              teamName: domTeam,
              opponentName: oppTeam,
              windowMinutes,
              avgPressure: domAvg,
              consistencyPct: domCons,
              highPressureMinutes: domHigh,
              totalPointsInWindow: totalPts,
              shotsInWindow: shots,
              dangerousAttacksInWindow: attacks,
              trendDirection: 'sustained_high',
              intensity: domAvg >= 78 && domCons >= 80 ? 'extrema' : domAvg >= 70 ? 'alta' : 'moderada',
              targetMarket: 'Over Gols / Vitória no Mercado ao Vivo',
              actionText: `${domTeam} mantém pressão contínua (${domAvg}% em ${windowMinutes}m)`,
              confidenceScore: Math.min(100, Math.round(domAvg * 0.7 + domCons * 0.3)),
            };

            return { match: m, qualified: true, trendData };
          }
        } else {
          // Fallback para pressão instantânea caso momentumTimeline ainda esteja populando
          const hPress = m.stats.pressureIndex?.home ?? 50;
          const aPress = m.stats.pressureIndex?.away ?? 50;
          const maxPress = Math.max(hPress, aPress);
          if (maxPress >= minAvgPressure && curMin >= minMinute) {
            const domSide: 'home' | 'away' = hPress >= aPress ? 'home' : 'away';
            const domTeam = domSide === 'home' ? m.homeTeam.name : m.awayTeam.name;
            const oppTeam = domSide === 'home' ? m.awayTeam.name : m.homeTeam.name;
            const trendData: TrendAlertEvaluation = {
              qualified: true,
              team: domSide,
              teamName: domTeam,
              opponentName: oppTeam,
              windowMinutes,
              avgPressure: maxPress,
              consistencyPct: 100,
              highPressureMinutes: 1,
              totalPointsInWindow: 1,
              shotsInWindow: domSide === 'home' ? m.stats.shotsOnTarget.home : m.stats.shotsOnTarget.away,
              dangerousAttacksInWindow: domSide === 'home' ? m.stats.dangerousAttacks.home : m.stats.dangerousAttacks.away,
              trendDirection: 'sustained_high',
              intensity: maxPress >= 78 ? 'extrema' : maxPress >= 70 ? 'alta' : 'moderada',
              targetMarket: 'Over Gols / Pressão Ofensiva',
              actionText: `${domTeam} com pressão elevada (${maxPress}%)`,
              confidenceScore: maxPress,
            };
            return { match: m, qualified: true, trendData };
          }
        }

        return { match: m, qualified: false, trendData: null };
      })
      .filter((item): item is { match: Match; qualified: boolean; trendData: TrendAlertEvaluation } => item.qualified && item.trendData !== null)
      .sort((a, b) => (b.trendData?.avgPressure ?? 0) - (a.trendData?.avgPressure ?? 0));
  }, [matches, rulesAnalysisMap, trendRuleCriteria]);

  const updateSuperPressureConfig = async (patch: Partial<SuperPressureTrendConfig>) => {
    if (!rulesConfig || !onUpdateRulesConfig) return;
    setIsSavingConfig(true);
    try {
      const updated: SuperPressureTrendConfig = {
        ...trendConfig,
        ...patch,
      };
      await onUpdateRulesConfig({
        ...rulesConfig,
        enableTrendAlert: updated.enabled !== false,
        trendAlertMinAvgPressure: updated.minAvgPressure,
        trendAlertMinConsistencyPct: updated.minConsistencyPct,
        trendAlertWindowMinutes: updated.windowMinutes,
        trendAlertMinMinute: updated.minMinute,
        trendAlertPointThreshold: updated.pointThreshold,
        superPressureConfig: updated,
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const toggleTrendAlert = async () => {
    await updateSuperPressureConfig({ enabled: !isTrendAlertEnabled });
  };

  const updateTrendWindow = async (newWindow: number) => {
    await updateSuperPressureConfig({ windowMinutes: newWindow });
  };

  const resetSuperPressureDefaults = async () => {
    await updateSuperPressureConfig({
      enabled: true,
      minAvgPressure: 68,
      minConsistencyPct: 65,
      windowMinutes: 15,
      minMinute: 15,
      pointThreshold: 60,
    });
  };



  const getSeverityBadge = (sev: AlertSeverity) => {
    switch (sev) {
      case "critical":
        return (
          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Crítico
          </span>
        );
      case "opportunity":
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <Flame className="w-3 h-3" /> Oportunidade
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Aviso
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase flex items-center gap-1">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Central de Notificações & Alertas em Tempo Real
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Histórico ao vivo, detecção de Gol Iminente, Trinca de Dívidas e o novo <strong>Trend Alert (Pressão 15m Contínua)</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Alertas Ativos: {filteredLogs.length}</span>
          </div>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("logs")}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "logs"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Feed de Alertas ao Vivo ({filteredLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("trend_config")}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "trend_config"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Super Pressão (Trend)</span>
          {highPressureMatches.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30">
              {highPressureMatches.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("rules")}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeSubTab === "rules"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Regras de Alerta ({rules.length})</span>
          {rules.filter((r) => r.enabled).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30">
              {rules.filter((r) => r.enabled).length} ativas
            </span>
          )}
        </button>
      </div>

      {/* SUB-TAB 1: FEED DE ALERTAS AO VIVO */}
      {activeSubTab === "logs" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          {/* Filter & Actions Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por time, jogo ou mensagem..."
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 shrink-0 font-medium cursor-pointer"
              >
                <option value="all">🎯 Todos os Tipos</option>
                <option value="goal">⚽ GOL (Gols Marcados)</option>
                <option value="imminent">🚨 1. Gol Iminente (Surto 5m)</option>
                <option value="trend">📈 2. Trend Alert / Super Pressão</option>
                <option value="triple_debt">💎 3. Trinca de Dívidas</option>
                <option value="goal_debt">📊 4. Diagnóstico (Código 3:1)</option>
                <option value="super_back">🎯 5. Super Back / Back Dominante</option>
                <option value="btts">⚽ 6. Ambas Marcam (BTTS)</option>
                <option value="corners">🚩 7. Cantos / Blitz de Escanteios</option>
              </select>

              {/* Sort Order Filter */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 shrink-0 font-medium cursor-pointer"
              >
                <option value="desc">⏱️ Mais recentes primeiro</option>
                <option value="asc">⏳ Mais antigos primeiro</option>
              </select>

              {/* Botão Mostrar / Ocultar Alertas de Gol */}
              <button
                type="button"
                onClick={toggleShowGoalAlerts}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer ${
                  showGoalAlerts
                    ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60"
                    : "bg-slate-950 border-amber-500/40 text-amber-300 hover:bg-slate-900"
                }`}
                title={
                  showGoalAlerts
                    ? "Clique para ocultar os alertas de GOL marcado do feed"
                    : "Clique para exibir os alertas de GOL marcado no feed"
                }
              >
                {showGoalAlerts ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Gols: Visíveis</span>
                    {goalAlertsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                        {goalAlertsCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gols: Ocultos</span>
                    {goalAlertsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                        {goalAlertsCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {logs.length > 0 && (
                <button
                  onClick={onClearLogs}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-rose-300 text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Histórico
                </button>
              )}
            </div>
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Bell className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">
                Nenhum alerta correspondente aos filtros ativos.
              </p>
              <p className="text-xs text-slate-600">
                Aguarde os próximos eventos e tendências identificadas em tempo real na grade ao vivo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log, logIdx) => {
                const isTrend =
                  log.category === "trend_alert" ||
                  log.ruleId.includes("trend") ||
                  log.ruleName.toLowerCase().includes("trend") ||
                  log.message.toLowerCase().includes("trend alert");

                return (
                  <div
                    key={`${log.id || 'log'}-${logIdx}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isTrend
                        ? "bg-slate-950 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/20"
                        : log.read
                        ? "bg-slate-950/60 border-slate-800/80"
                        : "bg-slate-950 border-slate-700 shadow-md"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isTrend ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> TREND ALERT
                          </span>
                        ) : (
                          getSeverityBadge(log.severity)
                        )}

                        {log.country && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase flex items-center gap-1">
                            🌍 {typeof log.country === 'object' && log.country !== null ? (log.country as any).name || 'País' : String(log.country)}
                          </span>
                        )}
                        {log.league && (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase truncate max-w-[220px]">
                              🏆 {typeof log.league === 'object' && log.league !== null ? (log.league as any).name || 'Liga' : String(log.league)}
                            </span>
                            {(() => {
                              const tInfo = getLeagueTierInfo(log.league, log.country || log.leagueCountry);
                              return (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase ${tInfo.badgeClass}`}>
                                  {tInfo.label}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                        <span className="text-xs font-bold text-white">{log.matchTitle}</span>
                        <span className="text-xs font-semibold text-emerald-400">({log.score})</span>
                        <span className="text-[11px] font-bold text-slate-400">• Minuto {formatMatchMinute(log.minute, log.status, log.extraMinute)}</span>

                        {/* Ver Partida Button */}
                        {log.matchId && onSelectMatch && (
                          <button
                            type="button"
                            onClick={() => onSelectMatch(log.matchId!)}
                            title="Abrir partida no Dashboard"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Partida</span>
                          </button>
                        )}

                        {/* FlashScore Link */}
                        {getFlashscoreUrl(log.url, log.matchId) && (
                          <a
                            href={getFlashscoreUrl(log.url, log.matchId)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir partida no FlashScore"
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                          >
                            <span>FlashScore</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">
                          {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                        </span>
                        {onDeleteAlert && (
                          <button
                            type="button"
                            onClick={() => onDeleteAlert(log.id)}
                            title="Apagar este alerta"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition flex items-center gap-1 text-[11px]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Apagar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Alerta Enxuto para Trend Alert */}
                    {isTrend ? (
                      <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/30 my-2">
                        <p className="text-xs font-semibold text-emerald-200 leading-relaxed flex items-center gap-2">
                          <span className="text-sm">📈</span>
                          <span>
                            {log.trendData
                              ? `TREND ALERT: ${log.trendData.teamName} mantém sufoco contínuo (${log.trendData.avgPressure}% em ${log.trendData.windowMinutes || 15}m) aos ${formatMatchMinute(log.minute, log.status, log.extraMinute)}!`
                              : log.message.startsWith("TREND ALERT") || log.message.startsWith("📈 TREND ALERT")
                              ? log.message.replace(/^📈\s*/, "").split("\n")[0]
                              : `TREND ALERT: ${log.matchTitle.split(" vs ")[0] || "Equipe"} mantém sufoco contínuo (77% em 15m) aos ${formatMatchMinute(log.minute, log.status, log.extraMinute)}!`}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800/80 my-2">
                        <p className="text-xs font-mono text-slate-200 whitespace-pre-line leading-relaxed">
                          {log.message}
                        </p>
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-500">
                      <span>Regra: {log.ruleName}</span>
                      {!log.read && (
                        <span className="text-emerald-400 font-bold">• Novo Alerta</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SUPER PRESSÃO (TREND) - PARTIDAS AO VIVO */}
      {activeSubTab === "trend_config" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-xl space-y-5">
          {/* Header & Criteria Details */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>Partidas ao Vivo sob Super Pressão (Trend Alert)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                    {highPressureMatches.length} em alta pressão
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confrontos em andamento com volume ofensivo contínuo, pressão dominante e blitz sustentada na janela recente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                trendRuleCriteria.isEnabled
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-950 text-amber-300 border-amber-500/30"
              }`}>
                <span className={`w-2 h-2 rounded-full ${trendRuleCriteria.isEnabled ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span>{trendRuleCriteria.isEnabled ? "Regra Ativa" : "Regra Pausada"}</span>
              </span>
            </div>
          </div>

          {/* Banner de Critérios da Regra & Filtros Ativos da Grade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            {/* Critérios da Regra */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Critérios da Regra: {trendRuleCriteria.ruleName}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  Minuto ≥ {trendRuleCriteria.minMinute}'
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  Janela: {trendRuleCriteria.windowMinutes}m
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  Pressão Média ≥ {trendRuleCriteria.minAvgPressure}%
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  Consistência ≥ {trendRuleCriteria.minConsistencyPct}%
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                  Ponto ≥ {trendRuleCriteria.pointThreshold}%
                </span>
              </div>
            </div>

            {/* Filtros Ativos na Grade */}
            <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-3">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Filtros da Grade de Jogos Aplicados:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                  País: {activeFilters?.country && activeFilters.country !== "all" ? activeFilters.country : "Todos"}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                  Liga: {activeFilters?.league && activeFilters.league !== "all" ? activeFilters.league : "Todas"}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                  Tiers: {activeFilters?.tiers && activeFilters.tiers.length < 4 ? activeFilters.tiers.join(", ") : "T1-T4"}
                </span>
                {activeFilters?.search && activeFilters.search.trim() !== "" && (
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                    "{activeFilters.search}"
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Matches List Grid */}
          {highPressureMatches.length === 0 ? (
            <div className="p-12 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">
                Nenhuma partida sob super pressão contínua no momento
              </p>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                Nenhum confronto atende simultaneamente aos filtros ativos da grade e aos critérios da regra{" "}
                <span className="text-emerald-400 font-semibold">{trendRuleCriteria.ruleName}</span> (minuto ≥ {trendRuleCriteria.minMinute}' com pressão média sustentada ≥ {trendRuleCriteria.minAvgPressure}% em {trendRuleCriteria.windowMinutes} minutos).
              </p>
              <p className="text-[11px] text-slate-500">
                Confrontos em andamento com blitz ofensiva qualificada aparecerão aqui instantaneamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {highPressureMatches.map(({ match: m, trendData }) => {
                const tierInfo = getLeagueTierInfo(m.league, m.country || m.leagueCountry);
                const countryStr =
                  typeof m.country === "object" && m.country !== null
                    ? (m.country as any).name || (m.country as any).code || ""
                    : typeof m.leagueCountry === "object" && m.leagueCountry !== null
                    ? (m.leagueCountry as any).name || ""
                    : String(m.country || m.leagueCountry || "").trim() || "País Desconhecido";

                const leagueStr =
                  typeof m.league === "object" && m.league !== null
                    ? (m.league as any).name || "Liga"
                    : String(m.league || "Liga");

                const isHomeDominant = trendData.team === "home";
                const isAwayDominant = trendData.team === "away";

                return (
                  <div
                    key={m.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800/90 hover:border-emerald-500/50 transition-all flex flex-col justify-between gap-3.5 shadow-lg relative group"
                  >
                    {/* Top Header: País, Liga + TIER, Tempo, Link Flashscore & Botão Apagar */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        {/* Linha 1: País em destaque padronizado */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1 truncate">
                            <span>🌐</span>
                            <span>{countryStr}</span>
                          </span>
                        </div>

                        {/* Linha 2: Liga com TIER */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-100 uppercase tracking-tight truncate max-w-[200px] sm:max-w-[280px]">
                            🏆 {leagueStr}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider ${tierInfo.badgeClass}`}>
                            {tierInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Right controls: Minuto, Flashscore & Apagar */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Minuto / Status da Partida */}
                        <span className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-900 text-slate-200 border border-slate-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatMatchMinute(m.minute, m.status, (m as any).extraMinute)}</span>
                        </span>

                        {/* Link direto FlashScore */}
                        <a
                          href={getFlashscoreUrl(m)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir partida no FlashScore"
                          className="p-1.5 px-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">FlashScore</span>
                        </a>

                        {/* Botão Apagar Partida */}
                        {onDeleteMatch && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja apagar a partida "${m.homeTeam.name} x ${m.awayTeam.name}" desta sessão?`)) {
                                onDeleteMatch(m.id);
                              }
                            }}
                            title="Apagar partida desta sessão"
                            className="p-1.5 px-2 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition flex items-center gap-1 text-xs font-bold shadow-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Apagar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Placar & Confronto */}
                    <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                      <div className={`flex-1 text-left min-w-0 ${isHomeDominant ? "text-emerald-300 font-black" : "text-slate-200 font-bold"}`}>
                        <div className="text-xs sm:text-sm truncate flex items-center gap-1">
                          {isHomeDominant && <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 inline" />}
                          <span className="truncate">{m.homeTeam.name}</span>
                        </div>
                      </div>

                      <div className="shrink-0 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-base sm:text-lg font-black text-emerald-400 tracking-wider shadow-inner">
                        {m.score.home} - {m.score.away}
                      </div>

                      <div className={`flex-1 text-right min-w-0 ${isAwayDominant ? "text-emerald-300 font-black" : "text-slate-200 font-bold"}`}>
                        <div className="text-xs sm:text-sm truncate flex items-center justify-end gap-1">
                          <span className="truncate">{m.awayTeam.name}</span>
                          {isAwayDominant && <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 inline" />}
                        </div>
                      </div>
                    </div>

                    {/* Box Padronizado de Super Pressão Contínua (Trend Alert) */}
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                          <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                          <span>Dominante: <strong className="text-white">{trendData.teamName}</strong></span>
                        </div>

                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                          trendData.intensity === "extrema"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                            : trendData.intensity === "alta"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}>
                          Pressão {trendData.intensity || "alta"}
                        </span>
                      </div>

                      {/* Métricas Técnicas da Janela */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Pressão Média</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                            {trendData.avgPressure}%
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Consistência</span>
                          <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                            {trendData.consistencyPct}%
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Janela Analisada</span>
                          <span className="text-xs sm:text-sm font-black text-slate-200 font-mono">
                            {trendData.windowMinutes || trendRuleCriteria.windowMinutes} min
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Chutes / Ataques</span>
                          <span className="text-xs sm:text-sm font-black text-cyan-300 font-mono">
                            {trendData.shotsInWindow} / {trendData.dangerousAttacksInWindow}
                          </span>
                        </div>
                      </div>

                      {/* Texto de Ação Tática */}
                      {trendData.actionText && (
                        <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{trendData.actionText}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <div className="text-[10px] text-slate-500 font-mono">
                        Regra: {trendRuleCriteria.ruleName}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={getFlashscoreUrl(m)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>FlashScore</span>
                        </a>

                        {onSelectMatch && (
                          <button
                            type="button"
                            onClick={() => onSelectMatch(m.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition shadow-sm cursor-pointer"
                          >
                            Ver Partida
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: REGRAS DE ALERTA (COM QUADROS COM VALORES / RULE PARAMETERS EDITOR) */}
      {activeSubTab === "rules" && (
        <div className="space-y-6">
          {/* Header & Filter Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-400" />
                  <span>Central de Regras de Alerta</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {filteredRules.length} de {rules.length} regras
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Gerencie e edite os parâmetros operacionais das regras em quadros diretos com valores numéricos.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsAddingNewRule(!isAddingNewRule)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Regra</span>
                </button>
              </div>
            </div>

            {/* Filter and search controls */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-3 border-t border-slate-800/80">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchRuleQuery}
                  onChange={(e) => setSearchRuleQuery(e.target.value)}
                  placeholder="Buscar por nome, descrição ou ID da regra..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>

              {/* Severity filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={ruleSeverityFilter}
                  onChange={(e) => setRuleSeverityFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="all">Todas as Severidades</option>
                  <option value="opportunity">✨ Oportunidade</option>
                  <option value="critical">🔥 Crítico</option>
                  <option value="warning">⚠️ Aviso</option>
                  <option value="info">ℹ️ Informativo</option>
                </select>

                {/* Status filter */}
                <select
                  value={ruleStatusFilter}
                  onChange={(e) => setRuleStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-300 cursor-pointer"
                >
                  <option value="all">Todos os Status</option>
                  <option value="enabled">Apenas Ativas ({rules.filter((r) => r.enabled).length})</option>
                  <option value="disabled">Apenas Pausadas ({rules.filter((r) => !r.enabled).length})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form: New Rule */}
          {isAddingNewRule && (
            <NewRuleForm
              onSave={handleCreateNewRule}
              onCancel={() => setIsAddingNewRule(false)}
            />
          )}

          {/* Rules List Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Lista de Regras Operacionais</span>
              <span>{filteredRules.length} exibidas</span>
            </div>

            {filteredRules.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                Nenhuma regra encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    isEditing={editingRuleId === rule.id}
                    rulesConfig={rulesConfig}
                    onStartEdit={() => setEditingRuleId(rule.id)}
                    onCancelEdit={() => setEditingRuleId(null)}
                    onToggle={() => handleToggleRule(rule.id)}
                    onDelete={() => handleDeleteRule(rule.id)}
                    onSaveRule={onSaveRule}
                    onUpdateRulesConfig={onUpdateRulesConfig}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
