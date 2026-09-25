// src/components/AlertRuleEditor.tsx
import React, { useState } from "react";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Edit3,
  Volume2,
  VolumeX,
  X,
  Sliders,
  SlidersHorizontal,
  Flame,
  Target,
  Sparkles,
  TrendingUp,
  Clock,
  Layers,
  Activity,
} from "lucide-react";
import {
  AlertRule,
  AlertSeverity,
  AlertMetric,
  AlertOperator,
  OperationalRulesConfig,
} from "../types";
import { RuleParametersEditor } from "./RuleParametersEditor";

export const METRIC_OPTIONS: { value: AlertMetric; label: string; unit: string }[] = [
  { value: "minute", label: "Minuto de Jogo", unit: "min" },
  { value: "pressureHome", label: "Pressão Mandante (Atual)", unit: "%" },
  { value: "pressureAway", label: "Pressão Visitante (Atual)", unit: "%" },
  { value: "pressureHomeAvgWindow", label: "Pressão Média Mandante (Janela)", unit: "%" },
  { value: "pressureAwayAvgWindow", label: "Pressão Média Visitante (Janela)", unit: "%" },
  { value: "pressureTrendWindow", label: "Super Pressão Contínua (Timeline)", unit: "%" },
  { value: "tripleDebtFormed", label: "Trinca de Dívidas Ativa (CC+xG+xGOT)", unit: "flag" },
  { value: "superBackDominanteQualified", label: "Super Back Dominante (Reação/Pressão)", unit: "flag" },
  { value: "v12OverBackQualified", label: "V12 Over/Back Sinais Clássicos", unit: "flag" },
  { value: "ambasMarcamQualified", label: "Ambas Marcam (BTTS Sim) Qualificado", unit: "flag" },
  { value: "imminentGoalQualified", label: "Gol Iminente / Surto 5m Qualificado", unit: "flag" },
  { value: "debtGoals", label: "Dívida de Gols (Diagnóstico)", unit: "gols" },
  { value: "totalXg", label: "xG Total Combinado", unit: "xG" },
  { value: "xgDiff", label: "Diferença de xG Favorito", unit: "xG" },

  { value: "chancesVariation5m", label: "Surto de Pressão 5m (Gol Iminente)", unit: "%" },
];

export function getMetricLabel(metric: AlertMetric): string {
  const found = METRIC_OPTIONS.find((m) => m.value === metric);
  return found ? found.label : metric;
}

export function renderSeverityBadge(severity: AlertSeverity) {
  switch (severity) {
    case "critical":
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
          Crítico
        </span>
      );
    case "warning":
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
          Aviso
        </span>
      );
    case "opportunity":
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          Oportunidade
        </span>
      );
    case "info":
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
          Info
        </span>
      );
  }
}

// Retorna resumo dos parâmetros editáveis em formato amigável para os pills do card
export function getRuleParameterSummaryPills(
  rule: AlertRule,
  rulesConfig?: OperationalRulesConfig | null
): { label: string; value: string; color: string }[] {
  const id = rule.id.toLowerCase();
  const name = rule.name.toLowerCase();

  if (id.includes("trend") || name.includes("super pressão")) {
    const trend = rulesConfig?.superPressureConfig;
    const minAvg = trend?.minAvgPressure ?? rulesConfig?.trendAlertMinAvgPressure ?? 68;
    const minCons = trend?.minConsistencyPct ?? rulesConfig?.trendAlertMinConsistencyPct ?? 65;
    const win = trend?.windowMinutes ?? rulesConfig?.trendAlertWindowMinutes ?? 15;
    const minM = trend?.minMinute ?? rulesConfig?.trendAlertMinMinute ?? 15;
    return [
      { label: "Média", value: `≥ ${minAvg}%`, color: "border-emerald-500/30 text-emerald-300" },
      { label: "Consistência", value: `≥ ${minCons}%`, color: "border-teal-500/30 text-teal-300" },
      { label: "Janela", value: `${win} min`, color: "border-amber-500/30 text-amber-300" },
      { label: "Minuto", value: `≥ ${minM}'`, color: "border-sky-500/30 text-sky-300" },
    ];
  }

  if (id.includes("trinca") || name.includes("trinca de dívidas")) {
    const td = rulesConfig?.tripleDebtConfig;
    const debtMargin = td?.debtMarginXG ?? 1.0;
    const ratio = td?.chancesPerGoalRatio ?? rulesConfig?.chancesPerGoalRatio ?? 3.0;
    const minCc = td?.minUnilateralCc ?? 2;
    const minM = td?.minMinute ?? 15;
    return [
      { label: "Dívida xG", value: `+${debtMargin.toFixed(1)}`, color: "border-purple-500/30 text-purple-300" },
      { label: "Ratio CC", value: `${ratio.toFixed(1)}:1`, color: "border-amber-500/30 text-amber-300" },
      { label: "CC Solo", value: `≥ ${minCc} CC`, color: "border-emerald-500/30 text-emerald-300" },
      { label: "Minuto", value: `≥ ${minM}'`, color: "border-sky-500/30 text-sky-300" },
    ];
  }

  if (id.includes("super-back") || id.includes("back-dominante") || name.includes("super back")) {
    const sbd = rulesConfig?.superBackDominanteConfig;
    const minXg = sbd?.minXg ?? 0.95;
    const minCc = sbd?.minCc ?? 2;
    const maxOpp = sbd?.maxOppXg ?? 0.85;
    const minPress = sbd?.minPressure ?? 65;
    const postGoal = sbd?.postGoalCooldownMinutes ?? 3;
    const range = `${sbd?.minMinute ?? 20}'-${sbd?.maxMinute ?? 82}'`;
    return [
      { label: "xG Dom", value: `≥ ${minXg.toFixed(2)}`, color: "border-emerald-500/30 text-emerald-300" },
      { label: "CC Dom", value: `≥ ${minCc} CC`, color: "border-amber-500/30 text-amber-300" },
      { label: "xG Opp", value: `≤ ${maxOpp.toFixed(2)}`, color: "border-rose-500/30 text-rose-300" },
      { label: "Pressão Reação", value: `≥ ${minPress}%`, color: "border-cyan-500/30 text-cyan-300" },
      { label: "Cooldown Gol", value: `${postGoal} min`, color: "border-purple-500/30 text-purple-300" },
      { label: "Janela", value: range, color: "border-sky-500/30 text-sky-300" },
    ];
  }

  if (id.includes("v12") || name.includes("v12")) {
    return [
      { label: "Over Premium", value: "36'-50' (CC ≥ 3)", color: "border-cyan-500/30 text-cyan-300" },
      { label: "Over Bilateral", value: "36'-65' (CC ≥ 4)", color: "border-amber-500/30 text-amber-300" },
      { label: "Gol Limite", value: "76'-83' (CC ≥ 7)", color: "border-rose-500/30 text-rose-300" },
      { label: "Back T1", value: "36'-50' (CC ≥ 3)", color: "border-emerald-500/30 text-emerald-300" },
    ];
  }

  if (id.includes("diagnostico") || name.includes("diagnóstico")) {
    const gdc = rulesConfig?.goalDebtClassicConfig;
    const minDebt = gdc?.minDebtGoals ?? 1.0;
    const minXg = gdc?.minTotalXg ?? 1.2;
    const ratio = gdc?.chancesPerGoalRatio ?? rulesConfig?.chancesPerGoalRatio ?? 3.0;
    return [
      { label: "Dívida Gols", value: `≥ ${minDebt.toFixed(1)}`, color: "border-amber-500/30 text-amber-300" },
      { label: "Ratio CC", value: `${ratio.toFixed(1)}:1`, color: "border-teal-500/30 text-teal-300" },
      { label: "xG Total", value: `≥ ${minXg.toFixed(1)}`, color: "border-cyan-500/30 text-cyan-300" },
    ];
  }



  if (id.includes("iminente") || name.includes("iminente") || id.includes("surto")) {
    return [
      { label: "Janela Fixa", value: "5 min", color: "border-amber-500/30 text-amber-300" },
      { label: "Pressão Média", value: "≥ 72%", color: "border-rose-500/30 text-rose-300" },
      { label: "Consistência", value: "≥ 60%", color: "border-teal-500/30 text-teal-300" },
      { label: "Agressividade", value: "Alta / Extrema", color: "border-emerald-500/30 text-emerald-300" },
    ];
  }

  if (id.includes("ambas-marcam") || id.includes("btts") || name.includes("ambas marcam") || name.includes("btts")) {
    const amc = rulesConfig?.ambasMarcamConfig;
    const minXg = amc?.minHomeXg ?? 0.35;
    const totalXg = amc?.minTotalXg ?? 1.10;
    const attacks10m = amc?.minHomeAttacks10m ?? 3;
    const minProb = amc?.minProbabilityPct ?? 68;
    const win = amc?.windowMinutes ?? 10;
    return [
      { label: "Janela", value: `${win} min`, color: "border-emerald-500/30 text-emerald-300" },
      { label: "Ataques 10m", value: `≥ ${attacks10m}`, color: "border-cyan-500/30 text-cyan-300" },
      { label: "xG Bilateral", value: `≥ ${minXg} / ${totalXg}`, color: "border-amber-500/30 text-amber-300" },
      { label: "Prob Mínima", value: `≥ ${minProb}%`, color: "border-purple-500/30 text-purple-300" },
    ];
  }

  // Fallback: mostra condições legíveis sem códigos técnicos
  return rule.conditions.map((c) => ({
    label: getMetricLabel(c.metric),
    value: `${c.operator} ${c.value}`,
    color: "border-slate-800 text-slate-300",
  }));
}

// ----------------------------------------------------------------------------
// COMPONENTE DO CARD DA REGRA
// ----------------------------------------------------------------------------
export interface RuleCardProps {
  key?: React.Key;
  rule: AlertRule;
  isEditing: boolean;
  rulesConfig?: OperationalRulesConfig | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onToggle: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onSaveRule?: (rule: AlertRule) => Promise<void>;
  onUpdateRulesConfig?: (config: OperationalRulesConfig) => Promise<void>;
}

export function RuleCard({
  rule,
  isEditing,
  rulesConfig,
  onStartEdit,
  onCancelEdit,
  onToggle,
  onDelete,
  onSaveRule,
  onUpdateRulesConfig,
}: RuleCardProps) {
  // Estado local para metadados da regra durante edição
  const [editedName, setEditedName] = useState(rule.name);
  const [editedDescription, setEditedDescription] = useState(rule.description || "");
  const [editedSeverity, setEditedSeverity] = useState(rule.severity);
  const [editedSound, setEditedSound] = useState(rule.soundEnabled ?? true);
  const [editedBrowserNotify, setEditedBrowserNotify] = useState(rule.browserNotification ?? true);
  const [editedMinFrequencyMinutes, setEditedMinFrequencyMinutes] = useState(rule.minFrequencyMinutes ?? 15);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataSuccess, setMetadataSuccess] = useState(false);

  const pills = getRuleParameterSummaryPills(rule, rulesConfig);

  const handleSaveMetadata = async () => {
    if (!onSaveRule) return;
    setIsSavingMetadata(true);
    try {
      await onSaveRule({
        ...rule,
        name: editedName,
        description: editedDescription,
        severity: editedSeverity,
        soundEnabled: editedSound,
        browserNotification: editedBrowserNotify,
        minFrequencyMinutes: Math.max(1, parseInt(String(editedMinFrequencyMinutes), 10) || 15),
      });
      setMetadataSuccess(true);
      setTimeout(() => setMetadataSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar metadados da regra:", err);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isEditing
          ? "bg-slate-900/95 border-cyan-500 shadow-2xl ring-1 ring-cyan-500/40"
          : rule.enabled
          ? "bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-md"
          : "bg-slate-950/60 border-slate-800/60 opacity-80"
      }`}
    >
      {/* Header do Card */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {renderSeverityBadge(rule.severity)}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-cyan-300 border border-slate-700/60 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Cooldown: {rule.minFrequencyMinutes || 15}m
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {rule.name}
              </h4>
            </div>
            {rule.description && (
              <p className="text-xs text-slate-400 leading-relaxed">{rule.description}</p>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
            {/* Ativar/Pausar */}
            <button
              type="button"
              onClick={onToggle}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                rule.enabled
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  rule.enabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {rule.enabled ? "Ativa" : "Pausada"}
            </button>

            {/* Editar / Fechar Edição */}
            <button
              type="button"
              onClick={isEditing ? onCancelEdit : onStartEdit}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isEditing
                  ? "bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20"
                  : "bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 border border-slate-700"
              }`}
            >
              {isEditing ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Concluir</span>
                </>
              ) : (
                <>
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Editar Parâmetros</span>
                </>
              )}
            </button>

            {/* Excluir */}
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
              title="Excluir regra"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pills de Parâmetros Operacionais (Substitui as antigas 'condições de disparo' técnicas) */}
        <div className="pt-1">
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
            <span>Parâmetros Ativos da Regra:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pills.map((pill, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-950 border flex items-center gap-1.5 shadow-sm ${pill.color}`}
              >
                <span className="text-slate-400">{pill.label}:</span>
                <span className="font-bold">{pill.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Rodapé informativo */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Disparos acumulados: <strong className="text-slate-300">{rule.triggerCount || 0}</strong>
            </span>
            <span>•</span>
            <span>
              {rule.soundEnabled ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Som Ativo
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1">
                  <VolumeX className="w-3 h-3" /> Silencioso
                </span>
              )}
            </span>
          </div>

          <div>
            {rule.lastTriggered ? (
              <span>Último disparo: {new Date(rule.lastTriggered).toLocaleTimeString()}</span>
            ) : (
              <span>Nenhum disparo nesta sessão</span>
            )}
          </div>
        </div>
      </div>

      {/* ÁREA DE EDIÇÃO EXPANDIDA ('Transferência para editável' com os quadros com valores) */}
      {isEditing && (
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 space-y-5">
          {/* 1. Metadados Básicos da Regra */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                Identificação & Notificações
              </span>

              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={isSavingMetadata}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition flex items-center gap-1 disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                <span>{isSavingMetadata ? "Salvando..." : "Salvar Texto & Alertas"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Nome da Regra</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Severidade</label>
                <select
                  value={editedSeverity}
                  onChange={(e) => setEditedSeverity(e.target.value as AlertSeverity)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="opportunity">✨ Oportunidade (Verde)</option>
                  <option value="critical">🔥 Crítico (Vermelho)</option>
                  <option value="warning">⚠️ Aviso (Amarelo)</option>
                  <option value="info">ℹ️ Informativo (Azul)</option>
                </select>
              </div>



              <div className="md:col-span-12 space-y-1">
                <label className="text-[11px] font-bold text-slate-400">Descrição Operacional</label>
                <input
                  type="text"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                />
              </div>

              <div className="md:col-span-12 flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedSound}
                    onChange={(e) => setEditedSound(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500"
                  />
                  <span>Tocar Sinal Sonoro</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedBrowserNotify}
                    onChange={(e) => setEditedBrowserNotify(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500"
                  />
                  <span>Notificação Push no Navegador</span>
                </label>
              </div>
            </div>

            {metadataSuccess && (
              <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Identificação e alertas atualizados!</span>
              </div>
            )}
          </div>

          {/* 2. QUADROS COM VALORES (RuleParametersEditor) */}
          <RuleParametersEditor
            rule={rule}
            rulesConfig={rulesConfig}
            onUpdateRulesConfig={onUpdateRulesConfig}
            onSaveRule={onSaveRule}
            isInsideModal={false}
          />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// FORMULÁRIO DE NOVA REGRA
// ----------------------------------------------------------------------------
interface NewRuleFormProps {
  onSave: (rule: Partial<AlertRule>) => Promise<void>;
  onCancel: () => void;
}

export function NewRuleForm({ onSave, onCancel }: NewRuleFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("opportunity");
  const [minFrequencyMinutes, setMinFrequencyMinutes] = useState(15);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotification, setBrowserNotification] = useState(true);
  const [metric, setMetric] = useState<AlertMetric>("pressureHome");
  const [operator, setOperator] = useState<AlertOperator>(">=");
  const [value, setValue] = useState(70);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Insira o nome da regra.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        id: `custom-rule-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        severity,
        minFrequencyMinutes: Math.max(1, minFrequencyMinutes),
        soundEnabled,
        browserNotification,
        enabled: true,
        logic: "AND",
        matchId: "all",
        conditions: [{ metric, operator, value }],
        messageTemplate: `🚨 ALERTA: ${name.trim()} disparado aos {minute}'!`,
        triggerCount: 0,
      });
      onCancel();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar nova regra.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border-2 border-emerald-500/40 shadow-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">Criar Nova Regra de Alerta</h3>
            <p className="text-xs text-slate-400">Configure o limiar inicial para monitoramento contínuo</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 space-y-1">
            <label className="text-xs font-bold text-slate-300">Nome da Regra *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              placeholder="Ex: Blitz de Pressão Final 75'-90'"
            />
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-bold text-slate-300">Severidade</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="opportunity">✨ Oportunidade</option>
              <option value="critical">🔥 Crítico</option>
              <option value="warning">⚠️ Aviso</option>
              <option value="info">ℹ️ Info</option>
            </select>
          </div>



          <div className="md:col-span-12 space-y-1">
            <label className="text-xs font-bold text-slate-300">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              placeholder="Explicação da tese operacional"
            />
          </div>

          {/* Condição Inicial */}
          <div className="md:col-span-6 space-y-1">
            <label className="text-xs font-bold text-slate-300">Métrica Monitorada</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as AlertMetric)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-bold text-slate-300">Operador</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as AlertOperator)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            >
              <option value=">=">&gt;= (Maior ou Igual)</option>
              <option value="<=">&lt;= (Menor ou Igual)</option>
              <option value="==">== (Igual)</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-bold text-slate-300">Valor Limiar</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono text-center"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-50"
          >
            {isSaving ? "Salvando..." : "Criar Regra"}
          </button>
        </div>
      </form>
    </div>
  );
}
