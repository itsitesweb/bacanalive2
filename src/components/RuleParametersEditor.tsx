// src/components/RulesParametersEditor.tsx
import React, { useState } from "react";
import {
  Zap,
  Sliders,
  Clock,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
  Activity,
  RotateCcw,
  Save,
  CheckCircle,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Gauge,
  Compass,
  Power,
} from "lucide-react";
import {
  AlertRule,
  OperationalRulesConfig,
  SuperPressureTrendConfig,
  TripleDebtConfig,
  SuperBackDominanteConfig,
  GoalDebtClassicConfig,
  DEFAULT_SUPER_BACK_DOMINANTE_CONFIG,
  DEFAULT_TRIPLE_DEBT_CONFIG,
  DEFAULT_GOAL_DEBT_CLASSIC_CONFIG,
  AmbasMarcamConfig,
  DEFAULT_AMBAS_MARCAM_CONFIG,
  ImminentGoalConfig,
  DEFAULT_IMMINENT_GOAL_CONFIG,
} from "../types";

interface RuleParametersEditorProps {
  rule: AlertRule;
  rulesConfig?: OperationalRulesConfig | null;
  onUpdateRulesConfig?: (config: OperationalRulesConfig) => Promise<void>;
  onSaveRule?: (rule: AlertRule) => Promise<void>;
  isInsideModal?: boolean;
}

export function RuleParametersEditor({
  rule,
  rulesConfig,
  onUpdateRulesConfig,
  onSaveRule,
  isInsideModal = false,
}: RuleParametersEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!rulesConfig || !onUpdateRulesConfig) {
    return (
      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 text-xs text-center">
        Configurações operacionais não carregadas do servidor.
      </div>
    );
  }

  const showSaveSuccess = (msg: string = "Parâmetros salvos com sucesso no disco!") => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Helper de persistência genérico
  const saveConfigPatch = async (patch: Partial<OperationalRulesConfig>, msg?: string) => {
    setIsSaving(true);
    try {
      const updated = {
        ...rulesConfig,
        ...patch,
      };
      await onUpdateRulesConfig(updated);
      showSaveSuccess(msg);
    } catch (err) {
      console.error("Erro ao salvar parâmetros da regra:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const ruleId = rule.id.toLowerCase();
  const ruleName = rule.name.toLowerCase();

  // Identificação do tipo de regra analítica
  const isTrendRule =
    ruleId.includes("trend") ||
    ruleId.includes("pressure") ||
    ruleName.includes("super pressão") ||
    ruleName.includes("trend alert");

  const isTripleDebtRule =
    ruleId.includes("trinca") ||
    ruleId.includes("triple-debt") ||
    ruleName.includes("trinca de dívidas");

  const isSuperBackRule =
    ruleId.includes("super-back") ||
    ruleId.includes("back-dominante") ||
    ruleId.includes("pressao-vendavel") ||
    ruleName.includes("super back") ||
    ruleName.includes("reação confirmada") ||
    ruleName.includes("pressão vendável");

  const isGoalDebtClassicRule =
    ruleId.includes("diagnostico") ||
    ruleId.includes("classic") ||
    ruleName.includes("diagnóstico clássico") ||
    ruleName.includes("dívida de gols");

  const isImminentGoalRule =
    ruleId.includes("iminente") ||
    ruleName.includes("iminente") ||
    ruleName.includes("surto");

  const isAmbasMarcamRule =
    ruleId.includes("ambas-marcam") ||
    ruleId.includes("btts") ||
    ruleName.includes("ambas marcam") ||
    ruleName.includes("btts");

  // --------------------------------------------------------------------------
  // 1. REGRA 1: SUPER PRESSÃO CONTÍNUA (TREND ALERT)
  // --------------------------------------------------------------------------
  if (isTrendRule) {
    const trend: SuperPressureTrendConfig = rulesConfig.superPressureConfig || {
      enabled: rulesConfig.enableTrendAlert !== false,
      minAvgPressure: rulesConfig.trendAlertMinAvgPressure ?? 68,
      minConsistencyPct: rulesConfig.trendAlertMinConsistencyPct ?? 65,
      windowMinutes: rulesConfig.trendAlertWindowMinutes ?? 15,
      minMinute: rulesConfig.trendAlertMinMinute ?? 15,
      pointThreshold: rulesConfig.trendAlertPointThreshold ?? 60,
    };

    const updateTrend = (patch: Partial<SuperPressureTrendConfig>) => {
      const updatedTrend = { ...trend, ...patch };
      saveConfigPatch({
        superPressureConfig: updatedTrend,
        enableTrendAlert: updatedTrend.enabled !== false,
        trendAlertMinAvgPressure: updatedTrend.minAvgPressure,
        trendAlertMinConsistencyPct: updatedTrend.minConsistencyPct,
        trendAlertWindowMinutes: updatedTrend.windowMinutes,
        trendAlertMinMinute: updatedTrend.minMinute,
        trendAlertPointThreshold: updatedTrend.pointThreshold,
      });

      if (onSaveRule && rule) {
        onSaveRule({
          ...rule,
          enabled: updatedTrend.enabled !== false,
          description: `Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=${updatedTrend.minAvgPressure}% de média com consistência >=${updatedTrend.minConsistencyPct}%) no histórico do momentum em ${updatedTrend.windowMinutes}m.`,
          conditions: [
            { metric: "pressureTrendWindow", operator: ">=", value: updatedTrend.minAvgPressure, windowMinutes: updatedTrend.windowMinutes },
            { metric: "minute", operator: ">=", value: updatedTrend.minMinute },
          ],
        });
      }
    };

    const resetTrendDefaults = () => {
      updateTrend({
        enabled: true,
        minAvgPressure: 68,
        minConsistencyPct: 65,
        windowMinutes: 15,
        minMinute: 15,
        pointThreshold: 60,
      });
    };

    return (
      <div className="p-4 bg-slate-950/80 border border-emerald-500/40 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Super Pressão Contínua (Momentum Timeline)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
              Regra 1
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetTrendDefaults}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Restaurar Padrões</span>
            </button>
            <button
              type="button"
              onClick={() => updateTrend({})}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Salvando..." : "Salvar no Disco"}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Monitora se a equipe favorita mantém pressão sufocante no terço final por múltiplos minutos consecutivos via timeline:
        </p>

        {/* Quadros com Valores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Pressão Média Mínima */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> Pressão Média Mínima
              </label>
              <span className="text-xs font-mono font-bold text-emerald-300">≥ {trend.minAvgPressure}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50}
                max={95}
                value={trend.minAvgPressure}
                onChange={(e) => updateTrend({ minAvgPressure: parseInt(e.target.value) || 68 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[60, 65, 68, 70, 75].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTrend({ minAvgPressure: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    trend.minAvgPressure === val
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Média mínima de pressão da equipe na janela móvel. (Padrão: <strong>68%</strong>)
            </p>
          </div>

          {/* 2. Consistência no Ataque */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Consistência no Ataque
              </label>
              <span className="text-xs font-mono font-bold text-teal-300">≥ {trend.minConsistencyPct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={30}
                max={95}
                value={trend.minConsistencyPct}
                onChange={(e) => updateTrend({ minConsistencyPct: parseInt(e.target.value) || 65 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[50, 55, 60, 65, 70].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTrend({ minConsistencyPct: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    trend.minConsistencyPct === val
                      ? "bg-teal-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              % de minutos da janela com pressão ≥ {trend.pointThreshold}%. (Padrão: <strong>65%</strong>)
            </p>
          </div>

          {/* 3. Janela Temporal */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Janela Temporal
              </label>
              <span className="text-xs font-mono font-bold text-amber-300">{trend.windowMinutes} min</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={30}
                value={trend.windowMinutes}
                onChange={(e) => updateTrend({ windowMinutes: parseInt(e.target.value) || 15 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">min</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[10, 12, 15, 20].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTrend({ windowMinutes: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    trend.windowMinutes === val
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}m
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Extensão da janela retrospectiva no momentumTimeline. (Padrão: <strong>15 min</strong>)
            </p>
          </div>

          {/* 4. Minuto Mínimo de Jogo */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1.5">
                <Gauge className="w-4 h-4" /> Minuto Mínimo
              </label>
              <span className="text-xs font-mono font-bold text-sky-300">≥ {trend.minMinute}&apos;</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={70}
                value={trend.minMinute}
                onChange={(e) => updateTrend({ minMinute: parseInt(e.target.value) || 15 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">&apos;</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[10, 15, 20, 25, 30].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTrend({ minMinute: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    trend.minMinute === val
                      ? "bg-sky-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}&apos;
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Minuto inicial em que o alerta é permitido disparar. (Padrão: <strong>15&apos;</strong>)
            </p>
          </div>

          {/* 5. Limiar Instantâneo por Ponto */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Limiar por Ponto
              </label>
              <span className="text-xs font-mono font-bold text-purple-300">≥ {trend.pointThreshold}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={40}
                max={85}
                value={trend.pointThreshold}
                onChange={(e) => updateTrend({ pointThreshold: parseInt(e.target.value) || 60 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[50, 55, 60, 65].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTrend({ pointThreshold: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    trend.pointThreshold === val
                      ? "bg-purple-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Piso de pressão individual por minuto para contar consistência. (Padrão: <strong>60%</strong>)
            </p>
          </div>

          {/* 6. Ativação da Regra */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Ativação da Regra 1</label>
            <button
              type="button"
              onClick={() => updateTrend({ enabled: trend.enabled === false })}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition border ${
                trend.enabled !== false
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900"
              }`}
            >
              {trend.enabled !== false ? "✓ Regra 1 Ativa" : "✕ Regra 1 Pausada"}
            </button>
            <p className="text-[10px] text-slate-500 leading-tight">
              Controla se o motor monitora a timeline de super pressão.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. REGRA 2: TRINCA DE DÍVIDAS (CC + xG + xGOT CONFLUENTES)
  // --------------------------------------------------------------------------
  if (isTripleDebtRule) {
    const td: TripleDebtConfig = rulesConfig.tripleDebtConfig || DEFAULT_TRIPLE_DEBT_CONFIG;

    const updateTD = (patch: Partial<TripleDebtConfig>) => {
      const unifiedRatio = patch.chancesPerGoalRatio !== undefined ? patch.chancesPerGoalRatio : (td.chancesPerGoalRatio || rulesConfig.chancesPerGoalRatio || 3.0);
      const updated = { ...td, ...patch, chancesPerGoalRatio: unifiedRatio };
      saveConfigPatch({
        chancesPerGoalRatio: unifiedRatio,
        tripleDebtConfig: updated,
        enableTripleDebt: updated.enabled !== false,
        goalDebtClassicConfig: rulesConfig.goalDebtClassicConfig
          ? { ...rulesConfig.goalDebtClassicConfig, chancesPerGoalRatio: unifiedRatio }
          : undefined,
      });
    };

    const resetTDDefaults = () => {
      const defaultRatio = 3.0;
      updateTD({ ...DEFAULT_TRIPLE_DEBT_CONFIG, chancesPerGoalRatio: defaultRatio });
    };

    return (
      <div className="p-4 bg-slate-950/80 border border-purple-500/40 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Trinca de Dívidas (CC + xG + xGOT Confluentes)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-950 text-purple-300 border border-purple-700/60">
              Regra 2
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetTDDefaults}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
              <span>Restaurar Padrões</span>
            </button>
            <button
              type="button"
              onClick={() => updateTD({})}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Salvando..." : "Salvar no Disco"}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Gatilho matemático estrito de confluência tripla (Chances Claras atrasadas, volume de xG e pontaria em xGOT):
        </p>

        {/* Quadros com Valores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Margem Dívida xG */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Margem Dívida xG
              </label>
              <span className="text-xs font-mono font-bold text-purple-300">+{td.debtMarginXG.toFixed(1)} gol</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={3.0}
              value={td.debtMarginXG}
              onChange={(e) => updateTD({ debtMarginXG: parseFloat(e.target.value) || 1.0 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[0.8, 1.0, 1.2, 1.5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTD({ debtMarginXG: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    td.debtMarginXG === val
                      ? "bg-purple-500 text-white font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  +{val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Excesso de xG e xGOT sobre os gols reais para configurar dívida. (Padrão: <strong>1.0</strong>)
            </p>
          </div>

          {/* Ratio de CC por Gol */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Ratio CC por Gol
              </label>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                  Fonte Única 3:1
                </span>
                <span className="text-xs font-mono font-bold text-amber-300">{td.chancesPerGoalRatio.toFixed(1)}:1</span>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              min={1.0}
              max={5.0}
              value={td.chancesPerGoalRatio}
              onChange={(e) => updateTD({ chancesPerGoalRatio: parseFloat(e.target.value) || 3.0 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[2.5, 3.0, 3.5, 4.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTD({ chancesPerGoalRatio: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    td.chancesPerGoalRatio === val
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}:1
                </button>
              ))}
            </div>
            <p className="text-[10px] text-amber-300/80 leading-tight">
              Sincronizado com o <strong>Parâmetro Central do Radar</strong> (Fonte Única: Diagnóstico & Dívidas).
            </p>
          </div>

          {/* CC Mínimo Unilateral */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> CC Mínimo Solo
              </label>
              <span className="text-xs font-mono font-bold text-emerald-300">≥ {td.minUnilateralCc} CC</span>
            </div>
            <input
              type="number"
              min={1}
              max={6}
              value={td.minUnilateralCc}
              onChange={(e) => updateTD({ minUnilateralCc: parseInt(e.target.value) || 2 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[2, 3, 4].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTD({ minUnilateralCc: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    td.minUnilateralCc === val
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  ≥ {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Chances claras mínimas criadas por um único time. (Padrão: <strong>3</strong>)
            </p>
          </div>

          {/* CC Mínimo Bilateral */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> CC Combinado (Ambos)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-300">≥ {td.minBilateralCc} CC</span>
            </div>
            <input
              type="number"
              min={2}
              max={8}
              value={td.minBilateralCc}
              onChange={(e) => updateTD({ minBilateralCc: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTD({ minBilateralCc: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    td.minBilateralCc === val
                      ? "bg-cyan-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  ≥ {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Soma de chances claras criadas por ambos os times. (Padrão: <strong>3</strong>)
            </p>
          </div>

          {/* Minuto Mínimo de Jogo */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Minuto Mínimo
              </label>
              <span className="text-xs font-mono font-bold text-sky-300">≥ {td.minMinute}&apos;</span>
            </div>
            <input
              type="number"
              min={5}
              max={60}
              value={td.minMinute}
              onChange={(e) => updateTD({ minMinute: parseInt(e.target.value) || 15 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[10, 15, 20, 25].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateTD({ minMinute: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    td.minMinute === val
                      ? "bg-sky-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}&apos;
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Minuto inicial para verificação da dívida. (Padrão: <strong>15&apos;</strong>)
            </p>
          </div>

          {/* Ativação da Regra */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Ativação da Regra 2</label>
            <button
              type="button"
              onClick={() => updateTD({ enabled: td.enabled === false })}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition border ${
                td.enabled !== false
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900"
              }`}
            >
              {td.enabled !== false ? "✓ Regra 2 Ativa" : "✕ Regra 2 Pausada"}
            </button>
            <p className="text-[10px] text-slate-500 leading-tight">
              Habilita ou pausa o motor da Trinca de Dívidas.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="p-2.5 bg-purple-500/15 border border-purple-500/40 rounded-xl text-purple-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-purple-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 3. REGRA 3: SUPER BACK DOMINANTE (UNIFICAÇÃO REAÇÃO CONFIRMADA & PRESSÃO VENDÁVEL)
  // --------------------------------------------------------------------------
  if (isSuperBackRule) {
    const sbd: SuperBackDominanteConfig =
      rulesConfig.superBackDominanteConfig || DEFAULT_SUPER_BACK_DOMINANTE_CONFIG;

    const updateSBD = (patch: Partial<SuperBackDominanteConfig>) => {
      const updated = { ...sbd, ...patch };
      saveConfigPatch({
        superBackDominanteConfig: updated,
        enableSuperBackDominante: updated.enabled !== false,
      });
    };

    const resetSBDDefaults = () => {
      updateSBD({ ...DEFAULT_SUPER_BACK_DOMINANTE_CONFIG });
    };

    return (
      <div className="p-4 bg-slate-950/80 border border-emerald-500/40 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Super Back Dominante (Reação Confirmada & Pressão Vendável)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
              Regra 3
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateSBD({ enabled: sbd.enabled === false ? true : false })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                sbd.enabled !== false
                  ? "bg-emerald-950 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900"
                  : "bg-rose-950/80 text-rose-300 border-rose-500/50 hover:bg-rose-900"
              }`}
              title={sbd.enabled !== false ? "Clique para pausar este motor" : "Clique para reativar este motor"}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{sbd.enabled !== false ? "Ativo" : "Desativado"}</span>
            </button>
            <button
              type="button"
              onClick={resetSBDDefaults}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Restaurar Padrões</span>
            </button>
            <button
              type="button"
              onClick={() => updateSBD({})}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Salvando..." : "Salvar no Disco"}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Identifica favorito ou dominante em empate ou desvantagem por até 1 gol, com superioridade estatística e pressão viva agressiva:
        </p>

        {/* Quadros com Valores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* xG Mínimo Dominante */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <Target className="w-4 h-4" /> xG Mínimo Dominante
              </label>
              <span className="text-xs font-mono font-bold text-emerald-300">≥ {sbd.minXg.toFixed(2)}</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.5}
              max={2.5}
              value={sbd.minXg}
              onChange={(e) => updateSBD({ minXg: parseFloat(e.target.value) || 0.95 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[0.80, 0.95, 1.10, 1.30].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateSBD({ minXg: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    sbd.minXg === val
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val.toFixed(2)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              xG acumulado mínimo da equipe dominante no jogo. (Padrão: <strong>0.95</strong>)
            </p>
          </div>

          {/* Chances Claras Mínimas */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> CC Mínimas Dominante
              </label>
              <span className="text-xs font-mono font-bold text-amber-300">≥ {sbd.minCc} CC</span>
            </div>
            <input
              type="number"
              min={1}
              max={6}
              value={sbd.minCc}
              onChange={(e) => updateSBD({ minCc: parseInt(e.target.value) || 2 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[1, 2, 3, 4].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateSBD({ minCc: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    sbd.minCc === val
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  ≥ {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Chances claras mínimas criadas pelo favorito. (Padrão: <strong>2</strong>)
            </p>
          </div>

          {/* xG Máximo do Adversário */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> xG Máx. Adversário
              </label>
              <span className="text-xs font-mono font-bold text-rose-300">≤ {sbd.maxOppXg.toFixed(2)}</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.3}
              max={2.0}
              value={sbd.maxOppXg}
              onChange={(e) => updateSBD({ maxOppXg: parseFloat(e.target.value) || 0.85 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[0.50, 0.70, 0.85, 1.00].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateSBD({ maxOppXg: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    sbd.maxOppXg === val
                      ? "bg-rose-500 text-white font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  ≤ {val.toFixed(2)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Teto de perigo do oponente para confirmar controle defensivo. (Padrão: <strong>0.85</strong>)
            </p>
          </div>

          {/* Pressão Mínima de Reação */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Pressão de Reação
              </label>
              <span className="text-xs font-mono font-bold text-cyan-300">≥ {sbd.minPressure}%</span>
            </div>
            <input
              type="number"
              min={45}
              max={90}
              value={sbd.minPressure}
              onChange={(e) => updateSBD({ minPressure: parseInt(e.target.value) || 65 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[55, 60, 65, 70].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateSBD({ minPressure: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    sbd.minPressure === val
                      ? "bg-cyan-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Pressão ao vivo mínima para autorizar a entrada em Back. (Padrão: <strong>65%</strong>)
            </p>
          </div>

          {/* Perigo Recente (10 min) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Perigo Recente (10m)
              </label>
              <span className="text-xs font-mono font-bold text-teal-300">≥ {sbd.minDangerousAttacksLast10} atq</span>
            </div>
            <input
              type="number"
              min={2}
              max={15}
              value={sbd.minDangerousAttacksLast10}
              onChange={(e) => updateSBD({ minDangerousAttacksLast10: parseInt(e.target.value) || 6 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[4, 5, 6, 8].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateSBD({ minDangerousAttacksLast10: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    sbd.minDangerousAttacksLast10 === val
                      ? "bg-teal-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  ≥ {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Ataques perigosos produzidos nos últimos 10 minutos. (Padrão: <strong>6</strong>)
            </p>
          </div>

          {/* Janela de Minutos */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Janela de Minutos (2T)
              </label>
              <span className="text-xs font-mono font-bold text-sky-300">{sbd.minMinute ?? 55}&apos; a {sbd.maxMinute ?? 78}&apos;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={45}
                max={75}
                value={sbd.minMinute ?? 55}
                onChange={(e) => updateSBD({ minMinute: parseInt(e.target.value) || 55 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-2 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-slate-500 text-xs font-bold">a</span>
              <input
                type="number"
                min={60}
                max={85}
                value={sbd.maxMinute ?? 78}
                onChange={(e) => updateSBD({ maxMinute: parseInt(e.target.value) || 78 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-2 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Exclusivamente no 2T, entre 55' e 78' (Cutoff no minuto 78'). (Padrão: <strong>55&apos; a 78&apos;</strong>)
            </p>
          </div>

          {/* Odds Alvo Match Odds */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Odds Alvo Match Odds
              </label>
              <span className="text-xs font-mono font-bold text-amber-300">
                Empate ≥ {sbd.targetOddDraw ?? 1.75} | 0x1 ≥ {sbd.targetOddLosing ?? 2.20}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Odd Empate</label>
                <input
                  type="number"
                  step="0.05"
                  min={1.40}
                  max={3.00}
                  value={sbd.targetOddDraw ?? 1.75}
                  onChange={(e) => updateSBD({ targetOddDraw: parseFloat(e.target.value) || 1.75 })}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1 text-xs text-center font-mono text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Odd Perdendo (0x1)</label>
                <input
                  type="number"
                  step="0.05"
                  min={1.80}
                  max={4.50}
                  value={sbd.targetOddLosing ?? 2.20}
                  onChange={(e) => updateSBD({ targetOddLosing: parseFloat(e.target.value) || 2.20 })}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1 text-xs text-center font-mono text-white font-bold"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Pisos mínimos de cotação para valor esperado positivo (EV+). (Padrão: <strong>1.75</strong> / <strong>2.20</strong>)
            </p>
          </div>

          {/* Finalizações Mínimas (Min Chutes) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Finalizações Mínimas (10m)
              </label>
              <span className="text-xs font-mono font-bold text-emerald-300">≥ {sbd.minShotsInWindow ?? 2} chutes</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={5}
                value={sbd.minShotsInWindow ?? 2}
                onChange={(e) => updateSBD({ minShotsInWindow: parseInt(e.target.value) || 2 })}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
              />
              <span className="text-xs text-slate-400 font-bold">chutes</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Elimina favorito estéril exigindo finalizações reais recentes. (Padrão: <strong>≥ 2 chutes</strong>)
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 5. DIAGNÓSTICO CLÁSSICO (DÍVIDA DE GOLS & DIVERGÊNCIA xG)
  // --------------------------------------------------------------------------
  if (isGoalDebtClassicRule) {
    const gdc: GoalDebtClassicConfig = rulesConfig.goalDebtClassicConfig || {
      ...DEFAULT_GOAL_DEBT_CLASSIC_CONFIG,
      enabled: rulesConfig.enableGoalDebtClassic !== false,
      chancesPerGoalRatio: rulesConfig.chancesPerGoalRatio || 3.0,
    };

    const updateGDC = (patch: Partial<GoalDebtClassicConfig>) => {
      const unifiedRatio = patch.chancesPerGoalRatio !== undefined ? patch.chancesPerGoalRatio : (gdc.chancesPerGoalRatio || rulesConfig.chancesPerGoalRatio || 3.0);
      const updated = { ...gdc, ...patch, chancesPerGoalRatio: unifiedRatio };
      saveConfigPatch({
        chancesPerGoalRatio: unifiedRatio,
        goalDebtClassicConfig: updated,
        enableGoalDebtClassic: updated.enabled !== false,
        debtMarginXG: updated.minDebtGoals,
        tripleDebtConfig: rulesConfig.tripleDebtConfig
          ? { ...rulesConfig.tripleDebtConfig, chancesPerGoalRatio: unifiedRatio }
          : undefined,
      });
    };

    const resetGDCDefaults = () => {
      updateGDC({
        enabled: true,
        minDebtGoals: 1.0,
        minTotalXg: 1.2,
        minXgDiff: 0.80,
        minDominantDebt: 0.70,
        minMinute: 20,
        chancesPerGoalRatio: 3.0,
      });
    };

    return (
      <div className="p-4 bg-slate-950/80 border border-amber-500/40 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Diagnóstico Clássico & Dívida de Gols
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-950 text-amber-300 border border-amber-700/60">
              Dívida Tradicional
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetGDCDefaults}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Restaurar Padrões</span>
            </button>
            <button
              type="button"
              onClick={() => updateGDC({})}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Salvando..." : "Salvar no Disco"}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Gatilhos da análise tradicional de volume vs placar real:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Dívida Mínima de Gols */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> Dívida Mínima de Gols
              </label>
              <span className="text-xs font-mono font-bold text-amber-300">≥ {gdc.minDebtGoals.toFixed(1)}</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={3.0}
              value={gdc.minDebtGoals}
              onChange={(e) => updateGDC({ minDebtGoals: parseFloat(e.target.value) || 1.0 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[0.8, 1.0, 1.2, 1.5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateGDC({ minDebtGoals: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    gdc.minDebtGoals === val
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  ≥ {val}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Gols devidos pela produção de chances em relação ao placar. (Padrão: <strong>1.0</strong>)
            </p>
          </div>

          {/* Ratio Central CC por Gol */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-teal-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Razão CC / Gol Esperado
              </label>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-950/80 text-teal-300 border border-teal-700/60">
                  Fonte Única 3:1
                </span>
                <span className="text-xs font-mono font-bold text-teal-300">{(gdc.chancesPerGoalRatio || 3.0).toFixed(1)}:1</span>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              min={1.5}
              max={5.0}
              value={gdc.chancesPerGoalRatio || 3.0}
              onChange={(e) => updateGDC({ chancesPerGoalRatio: parseFloat(e.target.value) || 3.0 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-teal-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {[2.5, 3.0, 3.5, 4.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateGDC({ chancesPerGoalRatio: val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    gdc.chancesPerGoalRatio === val
                      ? "bg-teal-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {val}:1
                </button>
              ))}
            </div>
            <p className="text-[10px] text-teal-300/80 leading-tight">
              Sincronizado com o <strong>Parâmetro Central do Radar</strong> (Fonte Única: Diagnóstico & Dívidas).
            </p>
          </div>

          {/* xG Total Mínimo */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> xG Total Mínimo
              </label>
              <span className="text-xs font-mono font-bold text-cyan-300">≥ {gdc.minTotalXg.toFixed(1)}</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={4.0}
              value={gdc.minTotalXg}
              onChange={(e) => updateGDC({ minTotalXg: parseFloat(e.target.value) || 1.2 })}
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
            />
            <p className="text-[10px] text-slate-500 leading-tight">
              Soma de xG gerada na partida. (Padrão: <strong>1.2</strong>)
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-amber-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    );
  }



  // --------------------------------------------------------------------------
  // 8. AMBAS MARCAM (BTTS: SIM) - RITMO BILATERAL
  // --------------------------------------------------------------------------
  if (isAmbasMarcamRule) {
    const btts: AmbasMarcamConfig = rulesConfig.ambasMarcamConfig || DEFAULT_AMBAS_MARCAM_CONFIG;
    const isGloballyEnabled = rulesConfig.enableAmbasMarcamBTTS !== false && btts.enabled !== false;

    const updateBtts = (patch: Partial<AmbasMarcamConfig>) => {
      const updated: AmbasMarcamConfig = {
        ...btts,
        ...patch,
      };
      saveConfigPatch(
        {
          ambasMarcamConfig: updated,
          enableAmbasMarcamBTTS: updated.enabled,
        },
        "Parâmetros de Ambas Marcam (BTTS Sim) salvos no disco!"
      );
    };

    const resetToDefaults = () => {
      saveConfigPatch(
        {
          ambasMarcamConfig: DEFAULT_AMBAS_MARCAM_CONFIG,
          enableAmbasMarcamBTTS: true,
        },
        "Parâmetros de Ambas Marcam restaurados para o padrão de fábrica!"
      );
    };

    return (
      <div className="p-4 bg-slate-950/90 border border-emerald-500/40 rounded-2xl space-y-4">
        {/* Header com Toggle e Reset */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Ambas Marcam (BTTS: Sim) - Ritmo Bilateral
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Terminal Python Transferido
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-700/60 rounded-lg hover:border-slate-600 transition"
              title="Restaurar valores de fábrica do algoritmo"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Padrão
            </button>
            <button
              type="button"
              onClick={() => updateBtts({ enabled: !isGloballyEnabled })}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-lg border transition ${
                isGloballyEnabled
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              {isGloballyEnabled ? "✓ Regra Ativa" : "✕ Regra Pausada"}
            </button>
          </div>
        </div>

        {/* Feedback visual de salvamento */}
        {statusMessage && (
          <div className="flex items-center gap-2 p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Informações Táticas do Algoritmo */}
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[11px] text-slate-300 leading-relaxed">
          <p>
            <strong className="text-emerald-400">Algoritmo Aprimorado Bilateral:</strong> Avalia
            a confluência de volume recente dos últimos minutos (ataques perigosos, finalizações no alvo e pressão)
            ajustada dinamicamente ao cenário de placar (<code className="text-amber-300">0-0</code>: volume mútuo aberto,{" "}
            <code className="text-cyan-300">1-0</code>: reação com perigo do visitante,{" "}
            <code className="text-emerald-300">0-1</code>: mandante sufocando em busca do empate). Calcula probabilidade real,
            odd justa matematicamente e bloqueia mercados encerrados ou goleadas sem resposta.
          </p>
        </div>

        {/* Quadros de Configuração em Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Quadro 1: Janela Temporal e Intervalo de Minutos */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <label className="text-emerald-400 font-bold text-xs">Janela & Minutos</label>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {btts.minMinute}' - {btts.maxMinute}'
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Janela Retrospectiva:</span>
                <span className="font-mono font-bold text-white">{btts.windowMinutes ?? 10} min</span>
              </div>
              <input
                type="number"
                min={5}
                max={20}
                value={btts.windowMinutes ?? 10}
                onChange={(e) => updateBtts({ windowMinutes: parseInt(e.target.value) || 10 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-center font-mono text-white font-bold"
              />
              <p className="text-[10px] text-slate-500">
                Extensão de minutos passados no timeline para auditar ataques e chutes mútuos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Minuto Mínimo</label>
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={btts.minMinute}
                  onChange={(e) => updateBtts({ minMinute: parseInt(e.target.value) || 18 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Minuto Máximo</label>
                <input
                  type="number"
                  min={20}
                  max={90}
                  value={btts.maxMinute}
                  onChange={(e) => updateBtts({ maxMinute: parseInt(e.target.value) || 86 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Quadro 2: Produção Ofensiva Bilateral na Janela */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <label className="text-cyan-400 font-bold text-xs">Produção na Janela</label>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Últimos {btts.windowMinutes ?? 10}m</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Ataques Mandante</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={btts.minHomeAttacks10m}
                  onChange={(e) => updateBtts({ minHomeAttacks10m: parseInt(e.target.value) || 3 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Ataques Visitante</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={btts.minAwayAttacks10m}
                  onChange={(e) => updateBtts({ minAwayAttacks10m: parseInt(e.target.value) || 3 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Chute Mandante</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={btts.minHomeShots10m}
                  onChange={(e) => updateBtts({ minHomeShots10m: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Chute Visitante</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={btts.minAwayShots10m}
                  onChange={(e) => updateBtts({ minAwayShots10m: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Pressão Mútua Combinada:</span>
              <span className="font-mono font-bold text-cyan-300">≥ {btts.minCombinedPressure}%</span>
            </div>
            <input
              type="number"
              min={60}
              max={160}
              step={5}
              value={btts.minCombinedPressure}
              onChange={(e) => updateBtts({ minCombinedPressure: parseInt(e.target.value) || 100 })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white"
            />
          </div>

          {/* Quadro 3: xG Bilateral & Qualidade */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <label className="text-amber-400 font-bold text-xs">xG & Probabilidade</label>
              </div>
              <span className="text-[10px] font-mono text-amber-300">
                Total ≥ {btts.minTotalXg.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">xG Mín Mandante</label>
                <input
                  type="number"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={btts.minHomeXg}
                  onChange={(e) => updateBtts({ minHomeXg: parseFloat(e.target.value) || 0.35 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">xG Mín Visitante</label>
                <input
                  type="number"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={btts.minAwayXg}
                  onChange={(e) => updateBtts({ minAwayXg: parseFloat(e.target.value) || 0.35 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white font-bold"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Probabilidade Mínima:</span>
                <span className="font-mono font-bold text-purple-300">≥ {btts.minProbabilityPct}%</span>
              </div>
              <input
                type="number"
                min={50}
                max={95}
                value={btts.minProbabilityPct}
                onChange={(e) => updateBtts({ minProbabilityPct: parseInt(e.target.value) || 68 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-center font-mono text-white font-bold"
              />
              <p className="text-[10px] text-slate-500">
                Limiar estatístico mínimo para sugerir a entrada em Ambas Marcam SIM.
              </p>
            </div>
          </div>
        </div>

        {/* Quadro 4: Inteligência de Proteção e Filtros de Mercado */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-800">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <label className="text-slate-300 font-bold text-xs">
              Inteligência de Mercado & Filtros de Proteção
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={btts.blockIfBothScored !== false}
                onChange={(e) => updateBtts({ blockIfBothScored: e.target.checked })}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-white block">Bloquear se Ambos Já Marcaram</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Evita alertas inúteis em partidas onde o placar já é 1-1, 2-1, etc. (Mercado BTTS já batido).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={btts.blockIfBlowout !== false}
                onChange={(e) => updateBtts({ blockIfBlowout: e.target.checked })}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-white block">Bloquear em Goleadas Sem Reação</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  Protege contra entradas aos 70'+ com 3+ gols de desvantagem quando o perdedor está passivo.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 8. REGRA GENÉRICA / CUSTOMIZADA & CONFIGURAÇÃO GLOBAL DE COOLDOWNS
  // --------------------------------------------------------------------------
  const postGoalCooldown = rulesConfig.postGoalCooldownMinutes ?? 3;
  const alertCooldown = rulesConfig.alertCooldownMinutes ?? 5;

  const updateGlobalCooldowns = (patch: { postGoalCooldownMinutes?: number; alertCooldownMinutes?: number }) => {
    saveConfigPatch(patch, "Cooldowns globais (Pós-Gol e Alertas) atualizados com sucesso!");
  };

  return (
    <div className="p-4 bg-slate-950/90 border border-purple-500/40 rounded-2xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-xs text-white">Resguardo Pós-Gol (Cooldown) & Cooldown Geral de Alertas</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700/60">
          Centralizado no Motor
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Configuração unificada aplicável a todas as regras do motor para evitar disparos repetitivos e resguardar o sistema pós-gols:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Bloco 1: Cooldown Pós-Gol */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Resguardo Pós-Gol
            </label>
            <span className="text-xs font-mono font-bold text-rose-300">{postGoalCooldown} min ({postGoalCooldown * 60}s)</span>
          </div>
          <input
            type="number"
            min={1}
            max={15}
            value={postGoalCooldown}
            onChange={(e) => updateGlobalCooldowns({ postGoalCooldownMinutes: parseInt(e.target.value) || 3 })}
            className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
          />
          <div className="flex items-center gap-1 flex-wrap pt-1">
            {[1, 2, 3, 5, 10].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => updateGlobalCooldowns({ postGoalCooldownMinutes: val })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  postGoalCooldown === val
                    ? "bg-rose-500 text-slate-950 font-black"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {val} min
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Congela novos alertas de Back/Pressão por {postGoalCooldown} minuto(s) após qualquer gol na partida. (Padrão: <strong>3 min</strong>)
          </p>
        </div>

        {/* Bloco 2: Cooldown Geral de Alertas */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-cyan-400 font-bold text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Cooldown Geral de Alertas
            </label>
            <span className="text-xs font-mono font-bold text-cyan-300">{alertCooldown} min</span>
          </div>
          <input
            type="number"
            min={1}
            max={30}
            value={alertCooldown}
            onChange={(e) => updateGlobalCooldowns({ alertCooldownMinutes: parseInt(e.target.value) || 5 })}
            className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-center font-mono text-white font-bold"
          />
          <div className="flex items-center gap-1 flex-wrap pt-1">
            {[3, 5, 10, 15].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => updateGlobalCooldowns({ alertCooldownMinutes: val })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  alertCooldown === val
                    ? "bg-cyan-500 text-slate-950 font-black"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {val} min
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Intervalo mínimo unificado entre repetições de alertas na mesma partida. (Padrão: <strong>5 min</strong>)
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-2.5 bg-purple-500/15 border border-purple-500/40 rounded-xl text-purple-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-purple-400" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
