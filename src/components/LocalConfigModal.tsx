// src/components/LocalConfigModal.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  FolderArchive,
  Download,
  Upload,
  Save,
  FileJson,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  ShieldCheck,
  User,
  Zap,
  Bell,
  Terminal,
  Activity,
  SlidersHorizontal,
  Flame,
  Target,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Filter,
  Layers,
  HelpCircle,
  Clock,
  Radio,
  CheckSquare,
  Square,
  Play,
  RotateCcw,
  ListOrdered,
  ListFilter,
  Compass,
  Cpu,
  Gauge,
  Pencil,
  Bug,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { safeFetchJson } from "../api";
import { useAuth } from "../context/AuthContext";
import { setViteDebugMode, isViteDebugEnabled, triggerTestViteLog } from "../utils/viteConsoleManager";
import {
  OperationalRulesConfig,
  AlertRule,
  CustomWebhookEndpoint,
  AlertMetric,
  AlertOperator,
  AlertSeverity,
  DEFAULT_MODAL_CONFIG,
  SuperPressureTrendConfig,
  DEFAULT_SUPER_PRESSURE_CONFIG,
  PressaoVendavelConfig,
  TripleDebtConfig,
  DominantTrailingConfig,
  DEFAULT_PRESSAO_VENDAVEL_CONFIG,
  DEFAULT_TRIPLE_DEBT_CONFIG,
  DEFAULT_DOMINANT_TRAILING_CONFIG,
  GoalDebtClassicConfig,
  DEFAULT_GOAL_DEBT_CLASSIC_CONFIG,
  HalfTimeValueConfig,
  DEFAULT_HALFTIME_VALUE_CONFIG,
} from "../types";

type TabType = "rules_engine" | "crawler" | "backup_profile";

interface LocalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigReloaded?: () => void;
  initialTab?: TabType;
  onNavigateToAlerts?: () => void;
}

export type { TabType };

export function LocalConfigModal({ isOpen, onClose, onConfigReloaded, initialTab, onNavigateToAlerts }: LocalConfigModalProps) {
  const { userProfile, regenerateCrawlerToken, refreshLocalProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (initialTab && (initialTab === "rules_engine" || initialTab === "crawler" || initialTab === "backup_profile")) {
      return initialTab;
    }
    return "rules_engine";
  });

  useEffect(() => {
    if (initialTab && isOpen) {
      if (initialTab === "rules_engine" || initialTab === "crawler" || initialTab === "backup_profile") {
        setActiveTab(initialTab);
      } else {
        setActiveTab("rules_engine");
      }
    }
  }, [initialTab, isOpen]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>("data/bacanalive_config.json");
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Core Config States
  const [displayNameInput, setDisplayNameInput] = useState<string>("Trader Local Pro");
  const [rulesConfig, setRulesConfig] = useState<OperationalRulesConfig>({ ...DEFAULT_MODAL_CONFIG });
  const [customKeywordsText, setCustomKeywordsText] = useState<string>("");
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [customWebhooks, setCustomWebhooks] = useState<CustomWebhookEndpoint[]>([]);
  const [noiseReduction, setNoiseReduction] = useState({
    hideFinishedMatches: true,
    mutedMatchIds: {} as Record<string, boolean>,
    enabledCategories: {
      imminent_goal: true,
      back_dominant: true,
      triple_debt: true,
      goal_debt_over: true,
      corners: true,
      btts_ambas: true,
      pressao_blitz: true,
      cards: true,
      under_value: true,
      virada_turnaround: true,
      cashout: true,
    } as Record<string, boolean>,
    selectedMatchFilter: "all",
  });

  // New Alert Rule Form
  const updateV12SubConfig = (
    signalKey: "overPremium" | "overBilateralForte" | "overGolLimite" | "backT1Main",
    patch: any
  ) => {
    setRulesConfig((prev) => ({
      ...prev,
      v12Config: {
        ...(prev.v12Config || DEFAULT_MODAL_CONFIG.v12Config),
        [signalKey]: {
          ...((prev.v12Config as any)?.[signalKey] || (DEFAULT_MODAL_CONFIG.v12Config as any)?.[signalKey]),
          ...patch,
        },
      },
    }));
  };

  const handleResetV12Defaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      v12Config: DEFAULT_MODAL_CONFIG.v12Config,
    }));
    setSaveStatus("Parâmetros do V1.2 restaurados para os valores padrão!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // State & Handlers para Parâmetros da Regra 1 (Super Pressão Contínua)

  const updateSuperPressureConfig = (patch: Partial<SuperPressureTrendConfig>) => {
    let nextSp: SuperPressureTrendConfig;
    setRulesConfig((prev) => {
      const current: SuperPressureTrendConfig = prev.superPressureConfig || {
        enabled: prev.enableTrendAlert !== false,
        minAvgPressure: prev.trendAlertMinAvgPressure ?? 68,
        minConsistencyPct: prev.trendAlertMinConsistencyPct ?? 65,
        windowMinutes: prev.trendAlertWindowMinutes ?? 15,
        minMinute: prev.trendAlertMinMinute ?? 15,
        pointThreshold: prev.trendAlertPointThreshold ?? 60,
      };
      nextSp = { ...current, ...patch };
      return {
        ...prev,
        enableTrendAlert: nextSp.enabled !== false,
        trendAlertMinAvgPressure: nextSp.minAvgPressure,
        trendAlertMinConsistencyPct: nextSp.minConsistencyPct,
        trendAlertWindowMinutes: nextSp.windowMinutes,
        trendAlertMinMinute: nextSp.minMinute,
        trendAlertPointThreshold: nextSp.pointThreshold,
        superPressureConfig: nextSp,
      };
    });

    setAlertRules((prev) =>
      prev.map((r) => {
        if (
          r.id === "rule-trend-super-pressure" ||
          r.id === "python-trend-alert" ||
          r.name.toLowerCase().includes("trend alert") ||
          r.name.toLowerCase().includes("super pressão")
        ) {
          const minAvg = nextSp.minAvgPressure ?? 68;
          const winMin = nextSp.windowMinutes ?? 15;
          const minMin = nextSp.minMinute ?? 15;
          const consPct = nextSp.minConsistencyPct ?? 65;
          return {
            ...r,
            enabled: nextSp.enabled !== false,
            description: `Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=${minAvg}% de média com consistência >=${consPct}%) no histórico do momentum em ${winMin}m.`,
            conditions: [
              { metric: "pressureTrendWindow", operator: ">=", value: minAvg, windowMinutes: winMin },
              { metric: "minute", operator: ">=", value: minMin },
            ],
          };
        }
        return r;
      })
    );
  };

  const handleResetSuperPressureDefaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      enableTrendAlert: true,
      trendAlertMinAvgPressure: 70,
      trendAlertMinConsistencyPct: 70,
      trendAlertWindowMinutes: 10,
      trendAlertMinMinute: 10,
      trendAlertPointThreshold: 65,
      superPressureConfig: DEFAULT_SUPER_PRESSURE_CONFIG,
    }));
    setAlertRules((prev) =>
      prev.map((r) => {
        if (
          r.id === "rule-trend-super-pressure" ||
          r.id === "python-trend-alert" ||
          r.name.toLowerCase().includes("trend alert") ||
          r.name.toLowerCase().includes("super pressão")
        ) {
          return {
            ...r,
            enabled: true,
            description: "Alerta unificado quando qualquer equipe sustenta blitz e super pressão contínua (>=70% de média com consistência >=70%) no histórico do momentum em 10m.",
            conditions: [
              { metric: "pressureTrendWindow", operator: ">=", value: 70, windowMinutes: 10 },
              { metric: "minute", operator: ">=", value: 10 },
            ],
          };
        }
        return r;
      })
    );
    setSaveStatus("Parâmetros da Regra 1 (Super Pressão) restaurados para os padrões (70% / 70% / 10m)!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // State & Handlers para Parâmetros da Regra 3 (Pressão Vendável & Ineficiência / Back Favorito)
  const updatePressaoVendavelConfig = (patch: Partial<PressaoVendavelConfig>) => {
    setRulesConfig((prev) => {
      const current: PressaoVendavelConfig = prev.pressaoVendavelConfig || DEFAULT_PRESSAO_VENDAVEL_CONFIG;
      const updated: PressaoVendavelConfig = { ...current, ...patch };
      return {
        ...prev,
        pressaoVendavelConfig: updated,
      };
    });
  };

  const handleResetPressaoVendavelDefaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      pressaoVendavelConfig: DEFAULT_PRESSAO_VENDAVEL_CONFIG,
    }));
    setSaveStatus("Parâmetros da Regra 3 (Pressão Vendável) restaurados para os padrões!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // State & Handlers para Parâmetros da Regra 2 (Trinca de Dívidas: CC + xG + xGOT)
  const updateTripleDebtConfig = (patch: Partial<TripleDebtConfig>) => {
    setRulesConfig((prev) => {
      const current: TripleDebtConfig = prev.tripleDebtConfig || DEFAULT_TRIPLE_DEBT_CONFIG;
      const updated: TripleDebtConfig = { ...current, ...patch };
      const unifiedRatio = patch.chancesPerGoalRatio !== undefined ? patch.chancesPerGoalRatio : (current.chancesPerGoalRatio ?? prev.chancesPerGoalRatio ?? 3.0);
      return {
        ...prev,
        chancesPerGoalRatio: unifiedRatio,
        tripleDebtConfig: { ...updated, chancesPerGoalRatio: unifiedRatio },
        goalDebtClassicConfig: prev.goalDebtClassicConfig
          ? { ...prev.goalDebtClassicConfig, chancesPerGoalRatio: unifiedRatio }
          : undefined,
        debtMarginXG: updated.debtMarginXG ?? prev.debtMarginXG,
      };
    });
  };

  const handleResetTripleDebtDefaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      chancesPerGoalRatio: DEFAULT_TRIPLE_DEBT_CONFIG.chancesPerGoalRatio,
      tripleDebtConfig: DEFAULT_TRIPLE_DEBT_CONFIG,
      goalDebtClassicConfig: prev.goalDebtClassicConfig
        ? { ...prev.goalDebtClassicConfig, chancesPerGoalRatio: DEFAULT_TRIPLE_DEBT_CONFIG.chancesPerGoalRatio }
        : undefined,
      debtMarginXG: DEFAULT_TRIPLE_DEBT_CONFIG.debtMarginXG,
    }));
    setSaveStatus("Parâmetros da Trinca de Dívidas restaurados para os padrões (Ratio Central: 3.0:1)!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // State & Handlers para Parâmetros da Regra 4 (Back Dominante em Desvantagem: Reação Confirmada)
  const updateDominantTrailingConfig = (patch: Partial<DominantTrailingConfig>) => {
    setRulesConfig((prev) => {
      const current: DominantTrailingConfig = prev.dominantTrailingConfig || DEFAULT_DOMINANT_TRAILING_CONFIG;
      const updated: DominantTrailingConfig = { ...current, ...patch };
      return {
        ...prev,
        dominantTrailingConfig: updated,
      };
    });
  };

  const handleResetDominantTrailingDefaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      dominantTrailingConfig: DEFAULT_DOMINANT_TRAILING_CONFIG,
    }));
    setSaveStatus("Parâmetros do Back Dominante (Regra 4) restaurados para os padrões!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // State & Handlers para Parâmetros de Dívida de Gols Tradicional
  const updateGoalDebtClassicConfig = (patch: Partial<GoalDebtClassicConfig>) => {
    setRulesConfig((prev) => {
      const current: GoalDebtClassicConfig = prev.goalDebtClassicConfig || DEFAULT_GOAL_DEBT_CLASSIC_CONFIG;
      const updated: GoalDebtClassicConfig = { ...current, ...patch };
      const unifiedRatio = patch.chancesPerGoalRatio !== undefined ? patch.chancesPerGoalRatio : (current.chancesPerGoalRatio ?? prev.chancesPerGoalRatio ?? 3.0);
      return {
        ...prev,
        chancesPerGoalRatio: unifiedRatio,
        goalDebtClassicConfig: { ...updated, chancesPerGoalRatio: unifiedRatio },
        tripleDebtConfig: prev.tripleDebtConfig
          ? { ...prev.tripleDebtConfig, chancesPerGoalRatio: unifiedRatio }
          : undefined,
      };
    });
  };

  const handleResetGoalDebtClassicDefaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      chancesPerGoalRatio: DEFAULT_GOAL_DEBT_CLASSIC_CONFIG.chancesPerGoalRatio,
      goalDebtClassicConfig: DEFAULT_GOAL_DEBT_CLASSIC_CONFIG,
      tripleDebtConfig: prev.tripleDebtConfig
        ? { ...prev.tripleDebtConfig, chancesPerGoalRatio: DEFAULT_GOAL_DEBT_CLASSIC_CONFIG.chancesPerGoalRatio }
        : undefined,
    }));
    setSaveStatus("Parâmetros da Dívida de Gols restaurados para os padrões (Ratio Central: 3.0:1)!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // State & Handlers para Parâmetros do Sinal de Valor HT
  const updateHalfTimeValueConfig = (patch: Partial<HalfTimeValueConfig>) => {
    setRulesConfig((prev) => {
      const current: HalfTimeValueConfig = prev.halfTimeValueConfig || DEFAULT_HALFTIME_VALUE_CONFIG;
      const updated: HalfTimeValueConfig = { ...current, ...patch };
      return {
        ...prev,
        halfTimeValueConfig: updated,
      };
    });
  };

  const handleResetHalfTimeValueDefaults = () => {
    setRulesConfig((prev) => ({
      ...prev,
      halfTimeValueConfig: DEFAULT_HALFTIME_VALUE_CONFIG,
    }));
    setSaveStatus("Parâmetros do Sinal de Valor HT restaurados para os padrões!");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // New Custom Webhook Form
  const [isAddingWebhook, setIsAddingWebhook] = useState<boolean>(false);
  const [newWebhookName, setNewWebhookName] = useState<string>("");
  const [newWebhookSlug, setNewWebhookSlug] = useState<string>("");

  // Faxina State
  const [isExecutingFaxina, setIsExecutingFaxina] = useState<boolean>(false);
  const [faxinaStatus, setFaxinaStatus] = useState<string | null>(null);

  const handleExecuteFaxina = async () => {
    setIsExecutingFaxina(true);
    setFaxinaStatus(null);
    try {
      const res = await fetch("/api/matches/faxina", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data?.success) {
        setFaxinaStatus(`✅ ${data.message || `Faxina concluída! ${data.removedFinishedCount} jogos removidos. Restam ${data.remainingMatchesCount} jogos no app.`}`);
        if (onConfigReloaded) {
          onConfigReloaded();
        }
      } else {
        setFaxinaStatus(`⚠️ Não foi possível concluir: ${data?.message || "Erro desconhecido"}`);
      }
    } catch (err: any) {
      setFaxinaStatus(`❌ Erro na execução da faxina: ${err.message || "Falha na requisição"}`);
    } finally {
      setIsExecutingFaxina(false);
      setTimeout(() => setFaxinaStatus(null), 8000);
    }
  };

  // Vite Debug Mode State & Handlers
  const [testedLogCount, setTestedLogCount] = useState<number>(0);

  // Node Crawler Engine Telemetry & Control
  const [nodeEngineStatus, setNodeEngineStatus] = useState<{
    isRunning: boolean;
    cycleCount: number;
    catalogCount: number;
    activeCount: number;
    queueLength: number;
    lastDiscoveryTime: number;
  } | null>(null);
  const [nodeCrawlerActionLoading, setNodeCrawlerActionLoading] = useState<boolean>(false);
  const [isRestartingNodeEngine, setIsRestartingNodeEngine] = useState<boolean>(false);

  const fetchCrawlerTelemetry = async () => {
    try {
      const res = await fetch("/api/crawler/status");
      if (res.ok) {
        const data = await res.json();
        if (data?.nodeEngine) {
          setNodeEngineStatus(data.nodeEngine);
        }
      }
    } catch {}
  };

  const handleToggleNodeEngine = async () => {
    setNodeCrawlerActionLoading(true);
    try {
      const action = nodeEngineStatus?.isRunning ? "stop" : "start";
      const res = await fetch(`/api/crawler/node/${action}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data?.status) {
          setNodeEngineStatus(data.status);
        }
      }
    } catch (e) {
      console.error("Erro ao alternar Node Crawler:", e);
    } finally {
      setNodeCrawlerActionLoading(false);
      setTimeout(fetchCrawlerTelemetry, 800);
    }
  };

  const handleRestartNodeEngine = async () => {
    setNodeCrawlerActionLoading(true);
    setIsRestartingNodeEngine(true);
    try {
      const res = await fetch("/api/crawler/node/restart", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data?.status) {
          setNodeEngineStatus(data.status);
        }
        setSaveStatus("Motor Node reiniciado com sucesso! Nova sessão e grade sincronizando.");
        setTimeout(() => setSaveStatus(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveStatus(`Erro ao reiniciar Motor Node: ${err.error || "Falha na requisição"}`);
        setTimeout(() => setSaveStatus(null), 4000);
      }
    } catch (e: any) {
      console.error("Erro ao reiniciar Motor Node:", e);
      setSaveStatus("Erro ao comunicar com o servidor para reiniciar o Motor Node.");
      setTimeout(() => setSaveStatus(null), 4000);
    } finally {
      setIsRestartingNodeEngine(false);
      setNodeCrawlerActionLoading(false);
      setTimeout(fetchCrawlerTelemetry, 800);
      setTimeout(fetchCrawlerTelemetry, 2500);
    }
  };

  const handleToggleViteDebug = (enabled: boolean) => {
    const updated = {
      ...rulesConfig,
      viteDebugMode: enabled,
    };
    setRulesConfig(updated);
    setViteDebugMode(enabled);
    handleSaveToDisk(
      { operationalConfig: updated },
      enabled
        ? "Modo DEBUG do Vite ATIVADO! Todas as mensagens do Vite agora aparecerão no console."
        : "Modo DEBUG do Vite DESATIVADO. Todas as mensagens do Vite foram suprimidas do console."
    );
  };

  const handleTestViteLog = () => {
    triggerTestViteLog();
    setTestedLogCount((c) => c + 1);
    setSaveStatus("Mensagens de teste do Vite disparadas! Abra o Console (F12) para conferir.");
    setTimeout(() => setSaveStatus(null), 3500);
  };

  const fetchFullConfig = async () => {
    setLoading(true);
    try {
      const data = await safeFetchJson<{ config: any; filePath?: string }>("/api/config");
      if (data?.config) {
        const c = data.config;
        if (c.userProfile?.displayName) setDisplayNameInput(c.userProfile.displayName);
        if (c.operationalConfig) {
          setRulesConfig({
            ...DEFAULT_MODAL_CONFIG,
            ...c.operationalConfig,
            v12Config: {
              ...DEFAULT_MODAL_CONFIG.v12Config,
              ...(c.operationalConfig.v12Config || {}),
              overPremium: {
                ...DEFAULT_MODAL_CONFIG.v12Config?.overPremium,
                ...((c.operationalConfig.v12Config && c.operationalConfig.v12Config.overPremium) || {}),
              },
              overBilateralForte: {
                ...DEFAULT_MODAL_CONFIG.v12Config?.overBilateralForte,
                ...((c.operationalConfig.v12Config && c.operationalConfig.v12Config.overBilateralForte) || {}),
              },
              overGolLimite: {
                ...DEFAULT_MODAL_CONFIG.v12Config?.overGolLimite,
                ...((c.operationalConfig.v12Config && c.operationalConfig.v12Config.overGolLimite) || {}),
              },
              backT1Main: {
                ...DEFAULT_MODAL_CONFIG.v12Config?.backT1Main,
                ...((c.operationalConfig.v12Config && c.operationalConfig.v12Config.backT1Main) || {}),
              },
            },
          });
          if (c.operationalConfig.viteDebugMode !== undefined) {
            setViteDebugMode(c.operationalConfig.viteDebugMode);
          }
          const kws = c.operationalConfig.crawlerConfig?.customExcludedKeywords;
          setCustomKeywordsText(Array.isArray(kws) ? kws.join(", ") : "");
        }
        if (Array.isArray(c.alertRules)) setAlertRules(c.alertRules);
        if (Array.isArray(c.customWebhooks)) setCustomWebhooks(c.customWebhooks);
        if (c.noiseReduction) {
          setNoiseReduction((prev) => ({
            ...prev,
            ...c.noiseReduction,
            enabledCategories: {
              ...prev.enabledCategories,
              ...(c.noiseReduction.enabledCategories || {}),
            },
          }));
        }
      }
      if (data?.filePath) setFilePath(data.filePath);
    } catch (err) {
      console.error("Erro ao carregar configurações locais:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFullConfig();
      fetchCrawlerTelemetry();
      const interval = setInterval(fetchCrawlerTelemetry, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Master Save Handler
  const handleSaveToDisk = async (customPayload?: any, successMessage?: string) => {
    try {
      setLoading(true);
      const payload = customPayload
        ? {
            userProfile: {
              ...userProfile,
              displayName: displayNameInput.trim() || "Trader Local Pro",
              role: "admin",
              status: "approved",
              crawlerToken: userProfile?.crawlerToken || "footstats-crawler-live-key-99",
              mode: "local_standalone",
              ...(customPayload.userProfile || {}),
            },
            operationalConfig: {
              ...rulesConfig,
              ...(customPayload.operationalConfig || {}),
            },
            alertRules: customPayload.alertRules || alertRules,
            customWebhooks: customPayload.customWebhooks || customWebhooks,
            noiseReduction: customPayload.noiseReduction || noiseReduction,
          }
        : {
            userProfile: {
              ...userProfile,
              displayName: displayNameInput.trim() || "Trader Local Pro",
              role: "admin",
              status: "approved",
              crawlerToken: userProfile?.crawlerToken || "footstats-crawler-live-key-99",
              mode: "local_standalone",
            },
            operationalConfig: {
              ...rulesConfig,
            },
            alertRules,
            customWebhooks,
            noiseReduction,
          };

      const res = await safeFetchJson<{ success: boolean; config: any }>("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        setSaveStatus(successMessage || "Configurações salvas e gravadas no disco com sucesso!");
        if (onConfigReloaded) onConfigReloaded();
        setTimeout(() => setSaveStatus(null), 3500);
      }
    } catch (err: any) {
      setSaveStatus(`Erro ao salvar no disco: ${err.message || "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  // Preset Ratio Buttons - Fonte Única da Verdade: Regra 3:1
  const applyRatioPreset = (val: number) => {
    const updated = {
      ...rulesConfig,
      chancesPerGoalRatio: val,
      tripleDebtConfig: {
        ...(rulesConfig.tripleDebtConfig || DEFAULT_TRIPLE_DEBT_CONFIG),
        chancesPerGoalRatio: val,
      },
      goalDebtClassicConfig: {
        ...(rulesConfig.goalDebtClassicConfig || DEFAULT_GOAL_DEBT_CLASSIC_CONFIG),
        chancesPerGoalRatio: val,
      },
    };
    setRulesConfig(updated);
    handleSaveToDisk(
      {
        operationalConfig: {
          ...updated,
        },
      },
      `Índice Central ${val.toFixed(1)}:1 aplicado em todo o Radar, Diagnóstico e Dívidas!`
    );
  };

  // Custom Webhook Management
  const handleToggleWebhook = (whId: string) => {
    const updated = customWebhooks.map((w) => (w.id === whId ? { ...w, active: !w.active } : w));
    setCustomWebhooks(updated);
    handleSaveToDisk({ customWebhooks: updated }, "Webhook atualizado no disco!");
  };

  const handleDeleteWebhook = (whId: string) => {
    if (window.confirm("Deseja excluir este endpoint de webhook?")) {
      const updated = customWebhooks.filter((w) => w.id !== whId);
      setCustomWebhooks(updated);
      handleSaveToDisk({ customWebhooks: updated }, "Webhook excluído do disco!");
    }
  };

  const handleCreateWebhook = () => {
    if (!newWebhookName.trim()) return;
    const cleanSlug = (newWebhookSlug || newWebhookName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-");

    const newWh: CustomWebhookEndpoint = {
      id: `wh-${Date.now()}`,
      name: newWebhookName.trim(),
      slug: cleanSlug || `wh-${Date.now()}`,
      secretToken: `sec_${Math.random().toString(36).substring(2, 12)}`,
      description: "Endpoint webhook customizado para ingestão em tempo real.",
      active: true,
      asyncMode: true,
      autoTriggerAlerts: true,
      autoComputeMomentum: true,
      targetLeague: "Todas as Ligas",
      createdAt: new Date().toISOString(),
      totalCalls: 0,
      lastStatus: "ok",
    };

    const updated = [newWh, ...customWebhooks];
    setCustomWebhooks(updated);
    setIsAddingWebhook(false);
    setNewWebhookName("");
    setNewWebhookSlug("");
    handleSaveToDisk({ customWebhooks: updated }, "Novo endpoint Webhook gravado no disco!");
  };

  // Export / Import
  const handleExportDownload = () => {
    try {
      const full = {
        version: "2.5.0-standalone-local",
        savedAt: new Date().toISOString(),
        userProfile: {
          displayName: displayNameInput.trim() || "Trader Local Pro",
          role: "admin",
          status: "approved",
          crawlerToken: userProfile?.crawlerToken || "footstats-crawler-live-key-99",
          mode: "local_standalone",
        },
        operationalConfig: {
          ...rulesConfig,
        },
        alertRules,
        customWebhooks,
        noiseReduction,
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(full, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `bacanalive_config_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setSaveStatus("Arquivo bacanalive_config.json exportado com sucesso!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (e: any) {
      setSaveStatus(`Erro ao exportar: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const res = await safeFetchJson<{ success: boolean; message?: string; config?: any }>("/api/config/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          });
          if (res?.success) {
            setSaveStatus("Configurações importadas e salvas com sucesso no disco!");
            await fetchFullConfig();
            await refreshLocalProfile();
            if (onConfigReloaded) onConfigReloaded();
          } else {
            setSaveStatus(`Falha na importação: ${res?.message || "Erro desconhecido"}`);
          }
        } catch (err: any) {
          setSaveStatus(`Arquivo JSON inválido: ${err.message}`);
        }
        setTimeout(() => setSaveStatus(null), 4000);
      };
    }
  };

  const handleResetToDefaults = async () => {
    if (window.confirm("Atenção: Deseja restaurar todas as configurações para o padrão de fábrica?")) {
      try {
        const res = await safeFetchJson<{ success: boolean }>("/api/config/reset", { method: "POST" });
        if (res?.success) {
          setSaveStatus("Configurações restauradas para o padrão com sucesso!");
          await fetchFullConfig();
          if (onConfigReloaded) onConfigReloaded();
          setTimeout(() => setSaveStatus(null), 3500);
        }
      } catch (err: any) {
        setSaveStatus(`Erro ao resetar: ${err.message}`);
      }
    }
  };

  const copyToken = () => {
    const token = userProfile?.crawlerToken || "footstats-crawler-live-key-99";
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleRegenerateToken = async () => {
    if (window.confirm("Gerar um novo Token Local para seus Crawlers? Você precisará atualizar seus scripts Python.")) {
      const newToken = await regenerateCrawlerToken();
      await fetchFullConfig();
      setSaveStatus("Novo token gerado e salvo no arquivo de configuração!");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const renderTrendSuperPressureSubEditor = (isInsideEditModal = false) => {
    const sp = rulesConfig.superPressureConfig || {
      enabled: rulesConfig.enableTrendAlert !== false,
      minAvgPressure: rulesConfig.trendAlertMinAvgPressure ?? 68,
      minConsistencyPct: rulesConfig.trendAlertMinConsistencyPct ?? 65,
      windowMinutes: rulesConfig.trendAlertWindowMinutes ?? 15,
      minMinute: rulesConfig.trendAlertMinMinute ?? 15,
      pointThreshold: rulesConfig.trendAlertPointThreshold ?? 60,
    };

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-emerald-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Super Pressão Contínua (Momentum Timeline)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
              Regra 1
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSuperPressureDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              <span>Restaurar Padrões (68% / 65%)</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Alerta unificado quando qualquer equipe (mandante ou visitante) sustenta blitz e super pressão contínua no histórico do momentum. Modifique os limiares matemáticos abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Pressão Média Contínua */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Pressão Média Mínima</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">{sp.minAvgPressure}%</span>
            </div>
            <input
              type="number"
              min={40}
              max={95}
              value={sp.minAvgPressure}
              onChange={(e) => updateSuperPressureConfig({ minAvgPressure: parseInt(e.target.value) || 68 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Média de pressão sustentada pela equipe dominante durante a janela. (Padrão: <strong>68%</strong>)
            </p>
          </div>

          {/* Consistência no Ataque */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Consistência Mínima</span>
              </label>
              <span className="text-[10px] font-mono text-teal-300 font-bold">{sp.minConsistencyPct}%</span>
            </div>
            <input
              type="number"
              min={30}
              max={95}
              value={sp.minConsistencyPct}
              onChange={(e) => updateSuperPressureConfig({ minConsistencyPct: parseInt(e.target.value) || 65 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              % de minutos em que o time manteve pressão instantânea ≥ limiar. (Padrão: <strong>65%</strong>)
            </p>
          </div>

          {/* Janela Temporal */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Janela Temporal</span>
              </label>
              <span className="text-[10px] font-mono text-amber-300 font-bold">{sp.windowMinutes} min</span>
            </div>
            <input
              type="number"
              min={5}
              max={30}
              value={sp.windowMinutes}
              onChange={(e) => updateSuperPressureConfig({ windowMinutes: parseInt(e.target.value) || 15 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Minutos retrospectivos minuto a minuto no momentumTimeline. (Padrão: <strong>15 min</strong>)
            </p>
          </div>

          {/* Minuto Mínimo de Jogo */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>Minuto Mínimo de Jogo</span>
              </label>
              <span className="text-[10px] font-mono text-sky-300 font-bold">{sp.minMinute}&apos;</span>
            </div>
            <input
              type="number"
              min={5}
              max={70}
              value={sp.minMinute}
              onChange={(e) => updateSuperPressureConfig({ minMinute: parseInt(e.target.value) || 15 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Minuto a partir do qual a regra começa a avaliar a blitz. (Padrão: <strong>15&apos;</strong>)
            </p>
          </div>

          {/* Limiar Instantâneo por Minuto */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Limiar por Ponto</span>
              </label>
              <span className="text-[10px] font-mono text-purple-300 font-bold">≥ {sp.pointThreshold}%</span>
            </div>
            <input
              type="number"
              min={40}
              max={85}
              value={sp.pointThreshold}
              onChange={(e) => updateSuperPressureConfig({ pointThreshold: parseInt(e.target.value) || 60 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Pressão mínima no minuto para contabilizar consistência no ataque. (Padrão: <strong>60%</strong>)
            </p>
          </div>

          {/* Status Ativo / Pausado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Ativação da Regra 1</label>
            <button
              type="button"
              onClick={() => {
                const next = sp.enabled === false;
                updateSuperPressureConfig({ enabled: next });
                setRulesConfig((prev) => ({ ...prev, enableTrendAlert: next }));
              }}
              className={`w-full py-2 rounded-lg font-bold text-xs transition border ${
                sp.enabled !== false
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {sp.enabled !== false ? "✓ Regra 1 Ativa" : "✕ Regra 1 Pausada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Habilita ou desativa a avaliação contínua em todas as partidas.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderV12SubEditor = (isInsideEditModal = false) => {
    const v12 = rulesConfig.v12Config || {
      overPremium: { enabled: true, minMinute: 36, maxMinute: 50, minTotalCc: 3, maxCcRate: 15.0, minTeamCc: 1 },
      overBilateralForte: { enabled: true, minMinute: 36, maxMinute: 65, minTotalCc: 4, maxCcRate: 15.0, minTeamCc: 2 },
      overGolLimite: { enabled: true, minMinute: 76, maxMinute: 83, minTotalCc: 7, minTeamCc: 2, minScoreDiff: 1 },
      backT1Main: { enabled: true, minMinute: 36, maxMinute: 50, minDomCc: 3, maxOppCc: 0, minDomXgot: 0.50 },
    };

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-cyan-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Ocultos V1.2 (4 Sinais Clássicos Unificados)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
              Regra 5
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetV12Defaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          A Regra 5 opera de forma unificada avaliando simultaneamente estes 4 sinais clássicos. Altere qualquer limite analítico abaixo:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Sinal 1: OVER PREMIUM */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-cyan-300">1. OVER PREMIUM (36&apos; a 50&apos;)</span>
              <button
                type="button"
                onClick={() => updateV12SubConfig("overPremium", { enabled: v12.overPremium.enabled === false })}
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  v12.overPremium.enabled !== false
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {v12.overPremium.enabled !== false ? "Ativo" : "Pausado"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="text-slate-400 block text-[10px]">Min. Início/Fim</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={v12.overPremium.minMinute}
                    onChange={(e) => updateV12SubConfig("overPremium", { minMinute: parseInt(e.target.value) || 36 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                  <span className="text-slate-600">-</span>
                  <input
                    type="number"
                    value={v12.overPremium.maxMinute}
                    onChange={(e) => updateV12SubConfig("overPremium", { maxMinute: parseInt(e.target.value) || 50 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block text-[10px]">CC Total Mín.</label>
                <input
                  type="number"
                  value={v12.overPremium.minTotalCc}
                  onChange={(e) => updateV12SubConfig("overPremium", { minTotalCc: parseInt(e.target.value) || 3 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block text-[10px]">Taxa min/CC</label>
                <input
                  type="number"
                  step="0.5"
                  value={v12.overPremium.maxCcRate}
                  onChange={(e) => updateV12SubConfig("overPremium", { maxCcRate: parseFloat(e.target.value) || 15.0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span>CC Mín. por Equipe:</span>
              <input
                type="number"
                value={v12.overPremium.minTeamCc}
                onChange={(e) => updateV12SubConfig("overPremium", { minTeamCc: parseInt(e.target.value) || 1 })}
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono text-white text-xs"
              />
            </div>
          </div>

          {/* Sinal 2: OVER BILATERAL FORTE */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-cyan-300">2. OVER BILATERAL FORTE (36&apos; a 65&apos;)</span>
              <button
                type="button"
                onClick={() => updateV12SubConfig("overBilateralForte", { enabled: v12.overBilateralForte.enabled === false })}
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  v12.overBilateralForte.enabled !== false
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {v12.overBilateralForte.enabled !== false ? "Ativo" : "Pausado"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="text-slate-400 block text-[10px]">Min. Início/Fim</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={v12.overBilateralForte.minMinute}
                    onChange={(e) => updateV12SubConfig("overBilateralForte", { minMinute: parseInt(e.target.value) || 36 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                  <span className="text-slate-600">-</span>
                  <input
                    type="number"
                    value={v12.overBilateralForte.maxMinute}
                    onChange={(e) => updateV12SubConfig("overBilateralForte", { maxMinute: parseInt(e.target.value) || 65 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block text-[10px]">CC Total Mín.</label>
                <input
                  type="number"
                  value={v12.overBilateralForte.minTotalCc}
                  onChange={(e) => updateV12SubConfig("overBilateralForte", { minTotalCc: parseInt(e.target.value) || 4 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block text-[10px]">Taxa min/CC</label>
                <input
                  type="number"
                  step="0.5"
                  value={v12.overBilateralForte.maxCcRate}
                  onChange={(e) => updateV12SubConfig("overBilateralForte", { maxCcRate: parseFloat(e.target.value) || 15.0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span>CC Mín. por Equipe:</span>
              <input
                type="number"
                value={v12.overBilateralForte.minTeamCc}
                onChange={(e) => updateV12SubConfig("overBilateralForte", { minTeamCc: parseInt(e.target.value) || 2 })}
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono text-white text-xs"
              />
            </div>
          </div>

          {/* Sinal 3: OVER GOL LIMITE */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-300">3. OVER GOL LIMITE (76&apos; a 83&apos;)</span>
              <button
                type="button"
                onClick={() => updateV12SubConfig("overGolLimite", { enabled: v12.overGolLimite.enabled === false })}
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  v12.overGolLimite.enabled !== false
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {v12.overGolLimite.enabled !== false ? "Ativo" : "Pausado"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="text-slate-400 block text-[10px]">Min. Início/Fim</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={v12.overGolLimite.minMinute}
                    onChange={(e) => updateV12SubConfig("overGolLimite", { minMinute: parseInt(e.target.value) || 76 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                  <span className="text-slate-600">-</span>
                  <input
                    type="number"
                    value={v12.overGolLimite.maxMinute}
                    onChange={(e) => updateV12SubConfig("overGolLimite", { maxMinute: parseInt(e.target.value) || 83 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block text-[10px]">CC Total Mín.</label>
                <input
                  type="number"
                  value={v12.overGolLimite.minTotalCc}
                  onChange={(e) => updateV12SubConfig("overGolLimite", { minTotalCc: parseInt(e.target.value) || 7 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block text-[10px]">Dif. Placar Mín.</label>
                <input
                  type="number"
                  value={v12.overGolLimite.minScoreDiff ?? 1}
                  onChange={(e) => updateV12SubConfig("overGolLimite", { minScoreDiff: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span>CC Mín. por Equipe:</span>
              <input
                type="number"
                value={v12.overGolLimite.minTeamCc}
                onChange={(e) => updateV12SubConfig("overGolLimite", { minTeamCc: parseInt(e.target.value) || 2 })}
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono text-white text-xs"
              />
            </div>
          </div>

          {/* Sinal 4: BACK T1 MAIN (Domínio Unilateral Absoluto) */}
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-300">4. BACK T1 MAIN — Domínio Unilateral</span>
              <button
                type="button"
                onClick={() => updateV12SubConfig("backT1Main", { enabled: v12.backT1Main.enabled === false })}
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  v12.backT1Main.enabled !== false
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {v12.backT1Main.enabled !== false ? "Ativo" : "Pausado"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="text-slate-400 block text-[10px]">Min. Início/Fim</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={v12.backT1Main.minMinute}
                    onChange={(e) => updateV12SubConfig("backT1Main", { minMinute: parseInt(e.target.value) || 36 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                  <span className="text-slate-600">-</span>
                  <input
                    type="number"
                    value={v12.backT1Main.maxMinute}
                    onChange={(e) => updateV12SubConfig("backT1Main", { maxMinute: parseInt(e.target.value) || 50 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-emerald-400 font-bold block text-[10px]">CC Dominante</label>
                <input
                  type="number"
                  value={v12.backT1Main.minDomCc}
                  onChange={(e) => updateV12SubConfig("backT1Main", { minDomCc: parseInt(e.target.value) || 3 })}
                  className="w-full bg-slate-950 border border-emerald-500/60 rounded px-1.5 py-1 text-center font-mono text-emerald-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-emerald-400 font-bold block text-[10px]">CC Adversário</label>
                <input
                  type="number"
                  value={v12.backT1Main.maxOppCc ?? 0}
                  onChange={(e) => updateV12SubConfig("backT1Main", { maxOppCc: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-emerald-500/60 rounded px-1.5 py-1 text-center font-mono text-emerald-200 text-xs font-bold"
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span className="text-emerald-300 font-medium">xGOT Mín. Dominante:</span>
              <input
                type="number"
                step="0.05"
                value={v12.backT1Main.minDomXgot}
                onChange={(e) => updateV12SubConfig("backT1Main", { minDomXgot: parseFloat(e.target.value) || 0.50 })}
                className="w-20 bg-slate-950 border border-emerald-500/60 rounded px-1.5 py-0.5 text-center font-mono text-emerald-200 text-xs font-bold"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPressaoVendavelSubEditor = (isInsideEditModal = false) => {
    const pv = rulesConfig.pressaoVendavelConfig || DEFAULT_PRESSAO_VENDAVEL_CONFIG;

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-amber-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Pressão Vendável & Ineficiência (Back Favorito / Lay Zebra)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
              Regra 3
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetPressaoVendavelDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Identifica equipe dominante em empate ou desvantagem por até {pv.maxDeficitGoals ?? 1} gol com alta pressão ofensiva e adversário nulo para entrada em Back e saída no gol (Lay). Edite os parâmetros abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* xG Mínimo Dominante */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>xG Mínimo Dominante</span>
              </label>
              <span className="text-[10px] font-mono text-amber-300 font-bold">≥ {pv.minXg.toFixed(1)}</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={3.5}
              value={pv.minXg}
              onChange={(e) => updatePressaoVendavelConfig({ minXg: parseFloat(e.target.value) || 1.0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              xG acumulado mínimo do time com pressão. (Padrão: <strong>1.0</strong>)
            </p>
          </div>

          {/* Chances Claras (CC) Mínimas */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chances Claras (CC)</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">≥ {pv.minCc}</span>
            </div>
            <input
              type="number"
              min={1}
              max={8}
              value={pv.minCc}
              onChange={(e) => updatePressaoVendavelConfig({ minCc: parseInt(e.target.value) || 2 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Grandes oportunidades criadas pela equipe dominante. (Padrão: <strong>2</strong>)
            </p>
          </div>

          {/* xGOT Mínimo Dominante */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>xGOT Mínimo</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">≥ {pv.minXgot.toFixed(2)}</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.3}
              max={3.0}
              value={pv.minXgot}
              onChange={(e) => updatePressaoVendavelConfig({ minXgot: parseFloat(e.target.value) || 0.8 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              xGOT (Gols Esperados no Alvo) mínimo dominante. (Padrão: <strong>0.8</strong>)
            </p>
          </div>

          {/* xG Máximo do Adversário (Adversário Nulo) */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-rose-400 font-bold text-xs flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>xG Máximo Adversário</span>
              </label>
              <span className="text-[10px] font-mono text-rose-300 font-bold">≤ {pv.maxOppXg.toFixed(1)}</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.2}
              max={2.0}
              value={pv.maxOppXg}
              onChange={(e) => updatePressaoVendavelConfig({ maxOppXg: parseFloat(e.target.value) || 0.7 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Teto de perigo do oponente para considerá-lo nulo. (Padrão: <strong>0.7</strong>)
            </p>
          </div>

          {/* Desvantagem Máxima de Gols */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Desvantagem Máx. Gols</span>
              </label>
              <span className="text-[10px] font-mono text-purple-300 font-bold">
                {pv.maxDeficitGoals === 0 ? "Apenas Empate" : `Empate ou -${pv.maxDeficitGoals} Gol`}
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={3}
              value={pv.maxDeficitGoals ?? 1}
              onChange={(e) => updatePressaoVendavelConfig({ maxDeficitGoals: parseInt(e.target.value) ?? 1 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              0 = Somente empate | 1 = Empate ou perdendo por 1 gol. (Padrão: <strong>1</strong>)
            </p>
          </div>

          {/* Janela de Minutos */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Minuto Início / Fim</span>
              </label>
              <span className="text-[10px] font-mono text-teal-300 font-bold">{pv.minMinute}&apos; - {pv.maxMinute}&apos;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={10}
                max={60}
                value={pv.minMinute}
                onChange={(e) => updatePressaoVendavelConfig({ minMinute: parseInt(e.target.value) || 25 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
              <span className="text-slate-500 text-xs">a</span>
              <input
                type="number"
                min={40}
                max={90}
                value={pv.maxMinute}
                onChange={(e) => updatePressaoVendavelConfig({ maxMinute: parseInt(e.target.value) || 70 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Faixa de minutos operacionais para Back Favorito. (Padrão: <strong>25&apos; a 70&apos;</strong>)
            </p>
          </div>

          {/* Posse de Bola Mínima */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>Posse Mínima (%)</span>
              </label>
              <span className="text-[10px] font-mono text-sky-300 font-bold">≥ {pv.minPossessionPct}%</span>
            </div>
            <input
              type="number"
              min={40}
              max={80}
              value={pv.minPossessionPct}
              onChange={(e) => updatePressaoVendavelConfig({ minPossessionPct: parseInt(e.target.value) || 60 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Posse mínima (ou toques na área ratio ≥ 2.0x e toques ≥ 8). (Padrão: <strong>60%</strong>)
            </p>
          </div>

          {/* Chutes no Alvo % */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-indigo-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Chutes no Alvo (%)</span>
              </label>
              <span className="text-[10px] font-mono text-indigo-300 font-bold">≥ {(pv.minSotPct * 100).toFixed(0)}%</span>
            </div>
            <input
              type="number"
              min={15}
              max={60}
              value={Math.round(pv.minSotPct * 100)}
              onChange={(e) => updatePressaoVendavelConfig({ minSotPct: (parseInt(e.target.value) || 35) / 100 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Taxa de pontaria (finalizações certas / finalizações totais). (Padrão: <strong>35%</strong>)
            </p>
          </div>

          {/* Status Ativo / Pausado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Ativação da Regra 3</label>
            <button
              type="button"
              onClick={() => {
                const next = pv.enabled === false;
                updatePressaoVendavelConfig({ enabled: next });
                setRulesConfig((prev) => ({ ...prev, enablePressaoVendavel: next }));
              }}
              className={`w-full py-2 rounded-lg font-bold text-xs transition border ${
                pv.enabled !== false
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {pv.enabled !== false ? "✓ Regra 3 Ativa" : "✕ Regra 3 Pausada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Habilita ou pausa as entradas em Back Favorito / Pressão Vendável.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTripleDebtSubEditor = (isInsideEditModal = false) => {
    const td = rulesConfig.tripleDebtConfig || DEFAULT_TRIPLE_DEBT_CONFIG;

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-purple-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Trinca de Dívidas (CC + xG + xGOT Confluentes)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-700/60">
              Regra 2
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTripleDebtDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-purple-400" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Confluência de 3 métricas de gols atrasados (Chances Claras, xG acumulado e xGOT no alvo). Configure os limiares de acionamento abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Margem Dívida xG */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Margem de Dívida xG</span>
              </label>
              <span className="text-[10px] font-mono text-purple-300 font-bold">+{td.debtMarginXG.toFixed(1)} gol</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={3.0}
              value={td.debtMarginXG}
              onChange={(e) => updateTripleDebtConfig({ debtMarginXG: parseFloat(e.target.value) || 1.0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Excesso de xG e xGOT sobre os gols reais para caracterizar dívida. (Padrão: <strong>1.0</strong>)
            </p>
          </div>

          {/* Ratio de Chances por Gol */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-amber-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Ratio de CC por Gol</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
                  Fonte Única 3:1
                </span>
                <span className="text-[10px] font-mono text-amber-300 font-bold">{(td.chancesPerGoalRatio || rulesConfig.chancesPerGoalRatio || 3.0).toFixed(1)}:1</span>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              min={1.0}
              max={5.0}
              value={td.chancesPerGoalRatio || rulesConfig.chancesPerGoalRatio || 3.0}
              onChange={(e) => updateTripleDebtConfig({ chancesPerGoalRatio: parseFloat(e.target.value) || 3.0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-amber-300/80 leading-tight">
              Sincronizado com o <strong>Parâmetro Central do Radar</strong> (Diagnóstico, Dívidas & Trinca).
            </p>
          </div>

          {/* CC Mínimo Unilateral */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CC Mínimo Unilateral</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">≥ {td.minUnilateralCc}</span>
            </div>
            <input
              type="number"
              min={1}
              max={6}
              value={td.minUnilateralCc}
              onChange={(e) => updateTripleDebtConfig({ minUnilateralCc: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Mínimo de CC da equipe dominante para focar em Próximo Gol do Time. (Padrão: <strong>3</strong>)
            </p>
          </div>

          {/* CC Mínimo Bilateral */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>CC Mínimo Bilateral</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">≥ {td.minBilateralCc}</span>
            </div>
            <input
              type="number"
              min={2}
              max={8}
              value={td.minBilateralCc}
              onChange={(e) => updateTripleDebtConfig({ minBilateralCc: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Mínimo de chances claras somadas da partida para escopo Bilateral. (Padrão: <strong>3</strong>)
            </p>
          </div>

          {/* xG & xGOT Mínimos Bilaterais */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>xG / xGOT Bilateral</span>
              </label>
              <span className="text-[10px] font-mono text-teal-300 font-bold">{td.minBilateralXg.toFixed(1)} / {td.minBilateralXgot.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min={0.5}
                max={3.0}
                value={td.minBilateralXg}
                onChange={(e) => updateTripleDebtConfig({ minBilateralXg: parseFloat(e.target.value) || 1.0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
              <span className="text-slate-500 text-xs">/</span>
              <input
                type="number"
                step="0.1"
                min={0.5}
                max={3.0}
                value={td.minBilateralXgot}
                onChange={(e) => updateTripleDebtConfig({ minBilateralXgot: parseFloat(e.target.value) || 1.0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              xG total e xGOT total mínimos do jogo para escopo Bilateral. (Padrão: <strong>1.0 / 1.0</strong>)
            </p>
          </div>

          {/* Minuto Mínimo de Jogo */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Minuto Mínimo de Jogo</span>
              </label>
              <span className="text-[10px] font-mono text-sky-300 font-bold">{td.minMinute}&apos;</span>
            </div>
            <input
              type="number"
              min={5}
              max={60}
              value={td.minMinute}
              onChange={(e) => updateTripleDebtConfig({ minMinute: parseInt(e.target.value) || 15 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Minuto a partir do qual a Trinca de Dívidas pode disparar alertas. (Padrão: <strong>15&apos;</strong>)
            </p>
          </div>

          {/* Status Ativo / Pausado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Ativação da Regra 2</label>
            <button
              type="button"
              onClick={() => {
                const next = td.enabled === false;
                updateTripleDebtConfig({ enabled: next });
                setRulesConfig((prev) => ({ ...prev, enableTripleDebt: next }));
              }}
              className={`w-full py-2 rounded-lg font-bold text-xs transition border ${
                td.enabled !== false
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {td.enabled !== false ? "✓ Regra 2 Ativa" : "✕ Regra 2 Pausada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Habilita ou pausa o monitoramento da Trinca de Dívidas.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderDominantTrailingSubEditor = (isInsideEditModal = false) => {
    const dt = rulesConfig.dominantTrailingConfig || DEFAULT_DOMINANT_TRAILING_CONFIG;

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-emerald-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Back Dominante em Desvantagem (Reação Confirmada)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
              Regra 4
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDominantTrailingDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Detecta quando a equipe estatisticamente superior está perdendo por até {dt.maxTrailingGoals ?? 1} gol(s), porém demonstrando reação viva e agressiva (Pressão ≥ {dt.minPressure ?? 65}%, Perigo Recente ≥ {dt.minDangerousAttacksLast10 ?? 6} ou Chutes a Gol ≥ {dt.minShotsOnTarget ?? 3}). Edite os parâmetros abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Desvantagem Máxima de Gols */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Desvantagem Máx. no Placar</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">≤ {dt.maxTrailingGoals ?? 1} gol(s)</span>
            </div>
            <input
              type="number"
              min={1}
              max={3}
              value={dt.maxTrailingGoals ?? 1}
              onChange={(e) => updateDominantTrailingConfig({ maxTrailingGoals: parseInt(e.target.value) || 1 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Déficit máximo de gols para autorizar entrada. (Padrão: <strong>1 gol</strong>. 2+ gols requer Pressão Brutal).
            </p>
          </div>

          {/* Pressão Mínima de Reação */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>Pressão Mínima Reação (%)</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">≥ {dt.minPressure ?? 65}%</span>
            </div>
            <input
              type="number"
              min={40}
              max={90}
              value={dt.minPressure ?? 65}
              onChange={(e) => updateDominantTrailingConfig({ minPressure: parseInt(e.target.value) || 65 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Pressão mínima da equipe dominante para comprovar reação ativa. (Padrão: <strong>65%</strong>)
            </p>
          </div>

          {/* Perigo Recente (Últimos 10 min) */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Perigo Recente (10 min)</span>
              </label>
              <span className="text-[10px] font-mono text-amber-300 font-bold">≥ {dt.minDangerousAttacksLast10 ?? 6} atq</span>
            </div>
            <input
              type="number"
              min={1}
              max={15}
              value={dt.minDangerousAttacksLast10 ?? 6}
              onChange={(e) => updateDominantTrailingConfig({ minDangerousAttacksLast10: parseInt(e.target.value) || 6 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Ataques perigosos nos últimos 10 minutos produzidos pela equipe. (Padrão: <strong>6</strong>)
            </p>
          </div>

          {/* Chutes no Alvo Mínimos */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Chutes a Gol Mínimos</span>
              </label>
              <span className="text-[10px] font-mono text-teal-300 font-bold">≥ {dt.minShotsOnTarget ?? 3}</span>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={dt.minShotsOnTarget ?? 3}
              onChange={(e) => updateDominantTrailingConfig({ minShotsOnTarget: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Finalizações no alvo acumuladas do time dominante. (Padrão: <strong>3 chutes</strong>)
            </p>
          </div>

          {/* Combinação dos Critérios de Reação */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Lógica de Confirmação</span>
              </label>
              <span className="text-[10px] font-mono text-purple-300 font-bold">
                {dt.requireOnlyOneReactionCriteria !== false ? "Critério OU" : "Critério E"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateDominantTrailingConfig({ requireOnlyOneReactionCriteria: true })}
                className={`py-1 rounded text-[10px] font-bold border transition ${
                  dt.requireOnlyOneReactionCriteria !== false
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                OU (Qualquer 1)
              </button>
              <button
                type="button"
                onClick={() => updateDominantTrailingConfig({ requireOnlyOneReactionCriteria: false })}
                className={`py-1 rounded text-[10px] font-bold border transition ${
                  dt.requireOnlyOneReactionCriteria === false
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                E (Todos os 3)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              OU: Dispara se Pressão ≥ {dt.minPressure ?? 65}% OU Perigo ≥ {dt.minDangerousAttacksLast10 ?? 6} OU Chutes ≥ {dt.minShotsOnTarget ?? 3}. (Padrão: <strong>OU</strong>)
            </p>
          </div>

          {/* Janela de Minutos */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-blue-400 font-bold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Janela de Minutos</span>
              </label>
              <span className="text-[10px] font-mono text-blue-300 font-bold">{dt.minMinute ?? 15}&apos; a {dt.maxMinute ?? 85}&apos;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={5}
                max={45}
                value={dt.minMinute ?? 15}
                onChange={(e) => updateDominantTrailingConfig({ minMinute: parseInt(e.target.value) || 15 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
              <span className="text-slate-500 text-xs">a</span>
              <input
                type="number"
                min={55}
                max={90}
                value={dt.maxMinute ?? 85}
                onChange={(e) => updateDominantTrailingConfig({ maxMinute: parseInt(e.target.value) || 85 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Faixa de minutos para validar a reação e disparar alerta. (Padrão: <strong>15&apos; a 85&apos;</strong>)
            </p>
          </div>

          {/* Limiar de Pressão Brutal */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-rose-400 font-bold text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Pressão Brutal (%)</span>
              </label>
              <span className="text-[10px] font-mono text-rose-300 font-bold">≥ {dt.brutalPressureThreshold ?? 85}%</span>
            </div>
            <input
              type="number"
              min={70}
              max={95}
              value={dt.brutalPressureThreshold ?? 85}
              onChange={(e) => updateDominantTrailingConfig({ brutalPressureThreshold: parseInt(e.target.value) || 85 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Pressão extrema que autoriza recuperação até mesmo com 2+ gols de desvantagem. (Padrão: <strong>85%</strong>)
            </p>
          </div>

          {/* Métrica de Superioridade */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sky-400 font-bold text-xs flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Critério de Domínio</span>
              </label>
              <span className="text-[10px] font-mono text-sky-300 font-bold">
                {dt.superiorityMetric === 'cc_only' ? 'Apenas CC' : dt.superiorityMetric === 'xg_only' ? 'Apenas xG' : 'CC ou xG'}
              </span>
            </div>
            <select
              value={dt.superiorityMetric || 'cc_or_xg'}
              onChange={(e) => updateDominantTrailingConfig({ superiorityMetric: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-medium"
            >
              <option value="cc_or_xg">CC ou xG Superior (Padrão)</option>
              <option value="cc_only">Apenas Chances Claras (CC)</option>
              <option value="xg_only">Apenas Gols Esperados (xG)</option>
            </select>
            <p className="text-[10px] text-slate-400 leading-tight">
              Métrica utilizada para definir qual time é estatisticamente dominante. (Padrão: <strong>CC ou xG</strong>)
            </p>
          </div>

          {/* Status Ativo / Pausado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Ativação da Regra 4</label>
            <button
              type="button"
              onClick={() => {
                const next = dt.enabled === false;
                updateDominantTrailingConfig({ enabled: next });
                setRulesConfig((prev) => ({ ...prev, enableDominantTrailing: next }));
              }}
              className={`w-full py-2 rounded-lg font-bold text-xs transition border ${
                dt.enabled !== false
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {dt.enabled !== false ? "✓ Regra 4 Ativa" : "✕ Regra 4 Pausada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Habilita ou pausa o monitoramento de Back Dominante em Desvantagem.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderGoalDebtClassicSubEditor = (isInsideEditModal = false) => {
    const gdc = rulesConfig.goalDebtClassicConfig || DEFAULT_GOAL_DEBT_CLASSIC_CONFIG;

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-amber-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Dívida de Gols & Diagnóstico Clássico
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
              Dívida Tradicional
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetGoalDebtClassicDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Detecta discrepâncias entre o volume real produzido (Chances Claras & xG) e o placar, calculando a dívida matemática de gols para entradas em Over ou Back Dominante. Edite os limiares abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Dívida Mínima de Gols */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Dívida Mínima de Gols</span>
              </label>
              <span className="text-[10px] font-mono text-amber-300 font-bold">≥ {gdc.minDebtGoals ?? 1.0} gol(s)</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={3.0}
              value={gdc.minDebtGoals ?? 1.0}
              onChange={(e) => updateGoalDebtClassicConfig({ minDebtGoals: parseFloat(e.target.value) || 1.0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Dívida mínima calculada (Gols Esperados - Gols Reais). (Padrão: <strong>1.0 gol</strong>)
            </p>
          </div>

          {/* xG Total Combinado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>xG Total Mínimo</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">≥ {gdc.minTotalXg ?? 1.2} xG</span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0.5}
              max={4.0}
              value={gdc.minTotalXg ?? 1.2}
              onChange={(e) => updateGoalDebtClassicConfig({ minTotalXg: parseFloat(e.target.value) || 1.2 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Soma do xG gerado por ambas as equipes na partida. (Padrão: <strong>1.2 xG</strong>)
            </p>
          </div>

          {/* Divergência Mínima de xG */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Diferença xG Dominante</span>
              </label>
              <span className="text-[10px] font-mono text-purple-300 font-bold">≥ +{gdc.minXgDiff ?? 0.80} xG</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.3}
              max={2.5}
              value={gdc.minXgDiff ?? 0.80}
              onChange={(e) => updateGoalDebtClassicConfig({ minXgDiff: parseFloat(e.target.value) || 0.80 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Divergência mínima de xG entre o dominante e o adversário. (Padrão: <strong>0.80 xG</strong>)
            </p>
          </div>

          {/* Dívida Unilateral do Dominante */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Dívida Solo Dominante</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">≥ {gdc.minDominantDebt ?? 0.70} xG</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.3}
              max={2.5}
              value={gdc.minDominantDebt ?? 0.70}
              onChange={(e) => updateGoalDebtClassicConfig({ minDominantDebt: parseFloat(e.target.value) || 0.70 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Gols devidos unilateralmente pelo time superior (xG - Gols). (Padrão: <strong>0.70 xG</strong>)
            </p>
          </div>

          {/* Razão Chances Claras por Gol */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-teal-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Razão CC / Gol Esperado</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-950 text-teal-300 border border-teal-700/60">
                  Fonte Única 3:1
                </span>
                <span className="text-[10px] font-mono text-teal-300 font-bold">{(gdc.chancesPerGoalRatio ?? rulesConfig.chancesPerGoalRatio ?? 3.0).toFixed(1)} : 1</span>
              </div>
            </div>
            <input
              type="number"
              step="0.1"
              min={1.5}
              max={5.0}
              value={gdc.chancesPerGoalRatio ?? rulesConfig.chancesPerGoalRatio ?? 3.0}
              onChange={(e) => updateGoalDebtClassicConfig({ chancesPerGoalRatio: parseFloat(e.target.value) || 3.0 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-teal-300/80 leading-tight">
              Sincronizado com o <strong>Parâmetro Central do Radar</strong> (Diagnóstico, Dívidas & Trinca).
            </p>
          </div>

          {/* Janela de Minutos */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-blue-400 font-bold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Janela de Minutos</span>
              </label>
              <span className="text-[10px] font-mono text-blue-300 font-bold">{gdc.minMinute ?? 20}&apos; a {gdc.maxMinute ?? 85}&apos;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={5}
                max={45}
                value={gdc.minMinute ?? 20}
                onChange={(e) => updateGoalDebtClassicConfig({ minMinute: parseInt(e.target.value) || 20 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
              <span className="text-slate-500 text-xs">a</span>
              <input
                type="number"
                min={50}
                max={92}
                value={gdc.maxMinute ?? 85}
                onChange={(e) => updateGoalDebtClassicConfig({ maxMinute: parseInt(e.target.value) || 85 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Período do jogo para monitoramento da dívida. (Padrão: <strong>20&apos; a 85&apos;</strong>)
            </p>
          </div>

          {/* Bloqueio se Vencendo por 2+ gols */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <label className="text-rose-400 font-bold text-xs">Bloqueio Vencendo 2+</label>
              <span className="text-[10px] font-mono text-slate-300">
                {gdc.blockIfWinningBy2Plus !== false ? "Ativo" : "Desativado"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateGoalDebtClassicConfig({ blockIfWinningBy2Plus: gdc.blockIfWinningBy2Plus === false })}
              className={`w-full py-1.5 rounded text-xs font-bold border transition ${
                gdc.blockIfWinningBy2Plus !== false
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {gdc.blockIfWinningBy2Plus !== false ? "✓ Bloquear se Dominante 2+ Gols à frente" : "✕ Permitir Alerta mesmo em Goleada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Evita entradas quando a equipe dominante já está em ritmo de controle. (Padrão: <strong>Ativo</strong>)
            </p>
          </div>

          {/* Bloqueio se Dívida Quitada */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <label className="text-indigo-400 font-bold text-xs">Bloqueio Dívida Quitada</label>
              <span className="text-[10px] font-mono text-slate-300">
                {gdc.blockIfDebtPaid !== false ? "Ativo" : "Desativado"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateGoalDebtClassicConfig({ blockIfDebtPaid: gdc.blockIfDebtPaid === false })}
              className={`w-full py-1.5 rounded text-xs font-bold border transition ${
                gdc.blockIfDebtPaid !== false
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {gdc.blockIfDebtPaid !== false ? "✓ Bloquear se Dominante já marcou >= xG" : "✕ Não Bloquear se Dívida Quitada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Ignora alertas se o dominante já converteu gols igual ou acima do seu xG. (Padrão: <strong>Ativo</strong>)
            </p>
          </div>

          {/* Ativação do Módulo */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Status da Dívida de Gols</label>
            <button
              type="button"
              onClick={() => {
                const next = gdc.enabled === false;
                updateGoalDebtClassicConfig({ enabled: next });
                setRulesConfig((prev) => ({ ...prev, enableGoalDebtClassic: next }));
              }}
              className={`w-full py-2 rounded-lg font-bold text-xs transition border ${
                gdc.enabled !== false
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {gdc.enabled !== false ? "✓ Dívida de Gols Ativa" : "✕ Dívida de Gols Pausada"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Habilita ou pausa o diagnóstico da Dívida Tradicional de Gols.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderHalfTimeValueSubEditor = (isInsideEditModal = false) => {
    const ht = rulesConfig.halfTimeValueConfig || DEFAULT_HALFTIME_VALUE_CONFIG;

    return (
      <div className="mt-3 p-3.5 bg-slate-950/80 border border-cyan-500/40 rounded-xl space-y-3 text-left">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs text-white">
              Parâmetros Editáveis: Sinal de Valor HT (Gols no 1º Tempo 30&apos;-45&apos;)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
              Valor HT
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetHalfTimeValueDefaults}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-[10px] transition"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Monitora pressão extrema acumulada nos últimos 15 minutos do 1º Tempo ({ht.minMinute ?? 30}&apos; a {ht.maxMinute ?? 45}&apos;) com placares baixos (≤ {ht.maxTotalGoals ?? 1} gol) para antecipar entradas de alto valor em Over 0.5 HT ou Over 1.5 HT. Edite os parâmetros abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Janela de Minutos do 1T */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-cyan-400 font-bold text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Janela 1º Tempo</span>
              </label>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">{ht.minMinute ?? 30}&apos; a {ht.maxMinute ?? 45}&apos;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={20}
                max={40}
                value={ht.minMinute ?? 30}
                onChange={(e) => updateHalfTimeValueConfig({ minMinute: parseInt(e.target.value) || 30 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
              <span className="text-slate-500 text-xs">a</span>
              <input
                type="number"
                min={40}
                max={48}
                value={ht.maxMinute ?? 45}
                onChange={(e) => updateHalfTimeValueConfig({ maxMinute: parseInt(e.target.value) || 45 })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-white text-xs font-bold"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Janela de minutos do 1º tempo para disparar alerta. (Padrão: <strong>30&apos; a 45&apos;</strong>)
            </p>
          </div>

          {/* Pressão Combinada Mínima */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-amber-400 font-bold text-xs flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>Pressão Combinada (%)</span>
              </label>
              <span className="text-[10px] font-mono text-amber-300 font-bold">≥ {ht.minCombinedPressure ?? 110}%</span>
            </div>
            <input
              type="number"
              min={80}
              max={150}
              value={ht.minCombinedPressure ?? 110}
              onChange={(e) => updateHalfTimeValueConfig({ minCombinedPressure: parseInt(e.target.value) || 110 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Soma da pressão mandante + visitante nos instantes do 1T. (Padrão: <strong>110%</strong>)
            </p>
          </div>

          {/* Pressão Dominante Mínima */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Pressão Dominante (%)</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-300 font-bold">≥ {ht.minDominantPressure ?? 65}%</span>
            </div>
            <input
              type="number"
              min={50}
              max={90}
              value={ht.minDominantPressure ?? 65}
              onChange={(e) => updateHalfTimeValueConfig({ minDominantPressure: parseInt(e.target.value) || 65 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Pressão mínima do time que está atacando ativamente. (Padrão: <strong>65%</strong>)
            </p>
          </div>

          {/* Chances Claras Mínimas */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-purple-400 font-bold text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chances Claras (1T)</span>
              </label>
              <span className="text-[10px] font-mono text-purple-300 font-bold">≥ {ht.minTotalCc ?? 1} CC</span>
            </div>
            <input
              type="number"
              min={0}
              max={5}
              value={ht.minTotalCc ?? 1}
              onChange={(e) => updateHalfTimeValueConfig({ minTotalCc: parseInt(e.target.value) || 1 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Chances Claras acumuladas criadas até o momento no 1T. (Padrão: <strong>1 CC</strong>)
            </p>
          </div>

          {/* xG Mínimo Acumulado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-blue-400 font-bold text-xs flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>xG Mínimo no 1T</span>
              </label>
              <span className="text-[10px] font-mono text-blue-300 font-bold">≥ {ht.minTotalXg ?? 0.70} xG</span>
            </div>
            <input
              type="number"
              step="0.05"
              min={0.3}
              max={2.0}
              value={ht.minTotalXg ?? 0.70}
              onChange={(e) => updateHalfTimeValueConfig({ minTotalXg: parseFloat(e.target.value) || 0.70 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Volume mínimo de Gols Esperados no primeiro tempo. (Padrão: <strong>0.70 xG</strong>)
            </p>
          </div>

          {/* Perigo Recente (10 min) */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-teal-400 font-bold text-xs flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Perigo Recente (10 min)</span>
              </label>
              <span className="text-[10px] font-mono text-teal-300 font-bold">≥ {ht.minDangerousAttacksLast10 ?? 5} atq</span>
            </div>
            <input
              type="number"
              min={1}
              max={15}
              value={ht.minDangerousAttacksLast10 ?? 5}
              onChange={(e) => updateHalfTimeValueConfig({ minDangerousAttacksLast10: parseInt(e.target.value) || 5 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Ataques perigosos totais nos últimos 10 minutos do 1T. (Padrão: <strong>5</strong>)
            </p>
          </div>

          {/* Teto Máximo de Gols no HT */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-rose-400 font-bold text-xs flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                <span>Teto de Gols no Placar</span>
              </label>
              <span className="text-[10px] font-mono text-rose-300 font-bold">≤ {ht.maxTotalGoals ?? 1} gol(s)</span>
            </div>
            <input
              type="number"
              min={0}
              max={3}
              value={ht.maxTotalGoals ?? 1}
              onChange={(e) => updateHalfTimeValueConfig({ maxTotalGoals: parseInt(e.target.value) || 1 })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white text-xs font-bold"
            />
            <p className="text-[10px] text-slate-400 leading-tight">
              Placar máximo para buscar valor no 1T (0x0 ou 1x0/0x1). (Padrão: <strong>1 gol</strong>)
            </p>
          </div>

          {/* Mercado Alvo */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-indigo-400 font-bold text-xs flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Mercado Alvo</span>
              </label>
              <span className="text-[10px] font-mono text-indigo-300 font-bold">
                {ht.targetMarket || 'OVER_HT'}
              </span>
            </div>
            <select
              value={ht.targetMarket || 'OVER_HT'}
              onChange={(e) => updateHalfTimeValueConfig({ targetMarket: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-medium"
            >
              <option value="OVER_HT">Over Gols HT (0.5 HT ou 1.5 HT)</option>
              <option value="BACK_HT">Back Favorito HT</option>
              <option value="BOTH">Ambos (Over HT & Back HT)</option>
            </select>
            <p className="text-[10px] text-slate-400 leading-tight">
              Mercado de recomendação tática gerado pelo alerta. (Padrão: <strong>Over Gols HT</strong>)
            </p>
          </div>

          {/* Status Ativo / Pausado */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 flex flex-col justify-between">
            <label className="text-slate-300 font-bold text-xs">Status do Sinal HT</label>
            <button
              type="button"
              onClick={() => {
                const next = ht.enabled === false;
                updateHalfTimeValueConfig({ enabled: next });
                setRulesConfig((prev) => ({ ...prev, enableHalfTimeValue: next }));
              }}
              className={`w-full py-2 rounded-lg font-bold text-xs transition border ${
                ht.enabled !== false
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {ht.enabled !== false ? "✓ Sinal Valor HT Ativo" : "✕ Sinal Valor HT Pausado"}
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Habilita ou pausa as recomendações de gols no fim do 1º Tempo.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 shadow-sm">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-white text-base tracking-tight">Central de Configuração Local & Motor</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Standalone Local
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                  data/bacanalive_config.json
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle unificado de regras de Diagnóstico, casas de apostas, alertas, ruído e ingestão Python.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Vite Debug Toggle */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-900/90 border border-slate-800 rounded-xl">
              <Bug className={`w-3.5 h-3.5 ${rulesConfig.viteDebugMode ? "text-purple-400 animate-pulse" : "text-slate-500"}`} />
              <span className="text-[11px] font-medium text-slate-300">Vite Debug:</span>
              <button
                type="button"
                onClick={() => handleToggleViteDebug(!rulesConfig.viteDebugMode)}
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rulesConfig.viteDebugMode ? "bg-purple-600" : "bg-slate-700"
                }`}
                title={rulesConfig.viteDebugMode ? "Vite DEBUG Ativo (logs liberados no console)" : "Vite DEBUG Desativado (logs suprimidos)"}
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rulesConfig.viteDebugMode ? "translate-x-3" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => handleSaveToDisk()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salvar Tudo no Disco</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-950/90 border-b border-slate-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("rules_engine")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "rules_engine"
                ? "bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Motor de Regras & 3:1</span>
          </button>

          <button
            onClick={() => setActiveTab("crawler")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "crawler"
                ? "bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>Crawler Python & Webhooks</span>
          </button>

          <button
            onClick={() => setActiveTab("backup_profile")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === "backup_profile"
                ? "bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-slate-400" />
            <span>Backup, Perfil & Debug Vite</span>
            {rulesConfig.viteDebugMode && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" title="Vite Debug Ativo" />
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {saveStatus && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-center gap-2 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveStatus}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: MOTOR DE REGRAS & PARÂMETROS 3:1                   */}
          {/* ======================================================== */}
          {activeTab === "rules_engine" && (
            <div className="space-y-6">
              {/* Notificação / Central de Alertas */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white">Centralização de Alertas:</span>
                    <span className="text-slate-300 ml-1">
                      Todas as regras e condições operacionais de alerta foram unificadas exclusivamente no <strong>Alert Manager</strong>.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToAlerts) {
                      onNavigateToAlerts();
                    } else {
                      onClose();
                      window.dispatchEvent(new CustomEvent("navigate-to-tab", { detail: "alerts" }));
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition whitespace-nowrap shadow-sm text-xs shrink-0 flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Ir para Alert Manager</span>
                </button>
              </div>

              {/* Parâmetro Central do Radar */}
              <div className="p-4 bg-slate-950/70 border border-amber-500/40 rounded-2xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-sm">Parâmetro Central do Radar (Diagnóstico & Dívida de Gols & Trinca)</h4>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
                          Fonte Única 3:1
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Proporção central de Chances Claras (CC) necessárias para justificar 1 gol na dívida. Governa simultaneamente o Diagnóstico Clássico, Dívida de Gols e Trinca de Dívidas.
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      {(rulesConfig.chancesPerGoalRatio || 3.0).toFixed(1)}:1
                    </span>
                  </div>
                </div>

                {/* Ratio Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { ratio: 2.5, label: "2.5:1 (Ultra Agressivo)", desc: "1 gol a cada 2.5 CC" },
                    { ratio: 3.0, label: "3.0:1 (Oficial / Padrão)", desc: "1 gol a cada 3.0 CC" },
                    { ratio: 3.5, label: "3.5:1 (Conservador)", desc: "1 gol a cada 3.5 CC" },
                    { ratio: 4.0, label: "4.0:1 (Ultra Seguro)", desc: "1 gol a cada 4.0 CC" },
                  ].map((p) => {
                    const isSelected = Math.abs(rulesConfig.chancesPerGoalRatio - p.ratio) < 0.05;
                    return (
                      <button
                        key={p.ratio}
                        onClick={() => applyRatioPreset(p.ratio)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="font-bold text-xs">{p.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Manual Ratio Slider */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Ajuste Fino Manual do Ratio Central:</span>
                    <span className="font-mono text-amber-300 font-bold">{rulesConfig.chancesPerGoalRatio.toFixed(1)}:1</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="6.0"
                    step="0.1"
                    value={rulesConfig.chancesPerGoalRatio}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setRulesConfig({
                        ...rulesConfig,
                        chancesPerGoalRatio: val,
                        tripleDebtConfig: {
                          ...(rulesConfig.tripleDebtConfig || DEFAULT_TRIPLE_DEBT_CONFIG),
                          chancesPerGoalRatio: val,
                        },
                        goalDebtClassicConfig: {
                          ...(rulesConfig.goalDebtClassicConfig || DEFAULT_GOAL_DEBT_CLASSIC_CONFIG),
                          chancesPerGoalRatio: val,
                        },
                      });
                    }}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1.0:1 (Mínimo)</span>
                    <span>3.0:1 (Padrão Oficial)</span>
                    <span>6.0:1 (Máximo)</span>
                  </div>
                </div>
              </div>

              {/* Taxas de Ritmo e Janelas de Minutos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                  <h5 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Taxas Máximas de Ritmo (min/CC)
                  </h5>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Taxa Máxima Geral de Ritmo (min/CC)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="5"
                        max="30"
                        value={rulesConfig.ccRateMaxMinutes}
                        onChange={(e) => setRulesConfig({ ...rulesConfig, ccRateMaxMinutes: parseFloat(e.target.value) || 15.0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap">min/CC</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Padrão: 15.0 min/CC para qualificar como jogo ativo</span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Taxa Máxima Forte / Premium (min/CC)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="3"
                        max="20"
                        value={rulesConfig.ccRateForteMaxMinutes}
                        onChange={(e) => setRulesConfig({ ...rulesConfig, ccRateForteMaxMinutes: parseFloat(e.target.value) || 12.0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap">min/CC</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Padrão: 12.0 min/CC para disparar alertas Over/Back Premium</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                  <h5 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-emerald-400" />
                    Janela de Minutos para Alertas
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Minuto Inicial</label>
                      <input
                        type="number"
                        min="1"
                        max="80"
                        value={rulesConfig.minMinuteAlert}
                        onChange={(e) => setRulesConfig({ ...rulesConfig, minMinuteAlert: parseInt(e.target.value) || 10 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Minuto Final</label>
                      <input
                        type="number"
                        min="50"
                        max="95"
                        value={rulesConfig.maxMinuteAlert}
                        onChange={(e) => setRulesConfig({ ...rulesConfig, maxMinuteAlert: parseInt(e.target.value) || 88 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Margem de Dívida xG</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.2"
                      max="3.0"
                      value={rulesConfig.debtMarginXG}
                      onChange={(e) => setRulesConfig({ ...rulesConfig, debtMarginXG: parseFloat(e.target.value) || 1.0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Resguardo Global Pós-Gol (Cooldown) */}
              <div className="p-4 bg-slate-950/70 border border-purple-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Resguardo Global Pós-Gol (Cooldown)</h4>
                      <p className="text-xs text-slate-400">
                        Tempo de congelamento de alertas após qualquer gol marcado no jogo (Padrão: <strong>{rulesConfig.postGoalCooldownMinutes ?? 3} min</strong>).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={rulesConfig.postGoalCooldownMinutes ?? 3}
                      onChange={(e) => setRulesConfig({ ...rulesConfig, postGoalCooldownMinutes: parseInt(e.target.value) || 3 })}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-purple-300 font-mono font-bold text-center"
                    />
                    <span className="text-xs text-slate-400 font-bold">min</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[1, 2, 3, 4, 5, 8].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRulesConfig({ ...rulesConfig, postGoalCooldownMinutes: val })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        (rulesConfig.postGoalCooldownMinutes ?? 3) === val
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {val} min
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CRAWLER NODE.JS & WEBHOOKS                      */}
          {/* ======================================================== */}
          {activeTab === "crawler" && (
            <div className="space-y-6">
              {/* Status e Controle do Motor Node.js Nativo */}
              <div className="p-4 bg-slate-950/70 border border-emerald-500/30 rounded-xl space-y-3 shadow-md">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-white">Motor Node.js Integrado (TypeScript HTTP Feed)</h5>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                            nodeEngineStatus?.isRunning
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {nodeEngineStatus?.isRunning ? "● ATIVO & SINCRONIZANDO" : "○ PAUSADO"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Coleta dados em tempo real via Flashscore HTTP Feed, dispensa navegador e despacha eventos diretamente para o comparador e a grade ao vivo.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      id="btn-restart-node-engine"
                      onClick={handleRestartNodeEngine}
                      disabled={nodeCrawlerActionLoading || isRestartingNodeEngine}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow border border-cyan-500/40 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 hover:text-white ${
                        (nodeCrawlerActionLoading || isRestartingNodeEngine) ? "opacity-50 cursor-wait" : ""
                      }`}
                      title="Reinicia completamente o Motor Node.js (limpa cache temporário, zera catálogo em memória e inicia nova sessão)"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestartingNodeEngine ? "animate-spin text-cyan-400" : ""}`} />
                      <span>{isRestartingNodeEngine ? "Reiniciando..." : "Reiniciar Motor Node"}</span>
                    </button>

                    <button
                      id="btn-toggle-node-engine"
                      onClick={handleToggleNodeEngine}
                      disabled={nodeCrawlerActionLoading || isRestartingNodeEngine}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                        nodeEngineStatus?.isRunning
                          ? "bg-amber-600/80 hover:bg-amber-600 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      } ${(nodeCrawlerActionLoading || isRestartingNodeEngine) ? "opacity-50 cursor-wait" : ""}`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {nodeCrawlerActionLoading && !isRestartingNodeEngine
                        ? "Processando..."
                        : nodeEngineStatus?.isRunning
                        ? "Pausar Motor Node"
                        : "Iniciar Motor Node"}
                    </button>

                    <button
                      id="btn-refresh-telemetry"
                      onClick={fetchCrawlerTelemetry}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                      title="Atualizar telemetria"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Ciclos Realizados</span>
                    <span className="text-xs font-bold text-cyan-300 font-mono">
                      {nodeEngineStatus?.cycleCount ?? 0}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Catálogo de Jogos</span>
                    <span className="text-xs font-bold text-white font-mono">
                      {nodeEngineStatus?.catalogCount ?? 0} ({nodeEngineStatus?.activeCount ?? 0} ativos)
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Fila de Despacho</span>
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {nodeEngineStatus?.queueLength ?? 0} itens
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Última Descoberta</span>
                    <span className="text-xs font-bold text-slate-300 font-mono">
                      {nodeEngineStatus?.lastDiscoveryTime
                        ? new Date(nodeEngineStatus.lastDiscoveryTime).toLocaleTimeString()
                        : "Aguardando"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Endpoints Webhooks */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Endpoints de Webhook Ativos ({customWebhooks.length})
                  </h5>
                  <button
                    onClick={() => setIsAddingWebhook(!isAddingWebhook)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Novo Webhook
                  </button>
                </div>

                {isAddingWebhook && (
                  <div className="p-4 bg-slate-900 border border-emerald-500/40 rounded-xl space-y-3 animate-in fade-in">
                    <h6 className="font-bold text-xs text-emerald-300">Cadastrar Novo Webhook de Ingestão</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Nome do Webhook</label>
                        <input
                          type="text"
                          value={newWebhookName}
                          onChange={(e) => setNewWebhookName(e.target.value)}
                          placeholder="Ex: Playwright Flashscore Live"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Slug da URL (/api/crawler/webhook/:slug)</label>
                        <input
                          type="text"
                          value={newWebhookSlug}
                          onChange={(e) => setNewWebhookSlug(e.target.value)}
                          placeholder="Ex: flashscore-live"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsAddingWebhook(false)}
                        className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateWebhook}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow"
                      >
                        Criar Endpoint no Servidor
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {customWebhooks.map((wh) => (
                    <div
                      key={wh.id}
                      className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${wh.active ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                          <span className="font-bold text-xs text-white">{wh.name}</span>
                          <code className="text-[10px] text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                            /api/crawler/webhook/{wh.slug}
                          </code>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-mono">
                          <span>Status: {wh.lastStatus || "ok"}</span>
                          <span>Chamadas: {wh.totalCalls || 0}</span>
                          {wh.lastCallTimestamp && (
                            <span>Último pacote: {new Date(wh.lastCallTimestamp).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleWebhook(wh.id)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                            wh.active
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {wh.active ? "Ativo" : "Pausado"}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabela de TTLs do Cacheamento Adaptativo por TIER */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Gauge className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Cacheamento por TIER (Redução de Requisições)</h4>
                      <p className="text-xs text-slate-400">
                        Cadência adaptativa inteligente que bloqueia requisições redundantes de acordo com a urgência da partida.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    -75% a -90% Requisições Redundantes
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  <div className="p-2.5 bg-slate-900/90 border border-amber-500/30 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Tier 0 (Sinais)</span>
                    <span className="text-sm font-black text-white font-mono mt-0.5 block">12s TTL</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Alta frequência</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 border border-cyan-500/30 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">Tier 0.5 (Premium)</span>
                    <span className="text-sm font-black text-white font-mono mt-0.5 block">25s TTL</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Grandes ligas</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Tier 1/2 (20-83')</span>
                    <span className="text-sm font-black text-white font-mono mt-0.5 block">35s-45s</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Janela ativa</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 border border-blue-500/30 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Tier 3 (Rodízio)</span>
                    <span className="text-sm font-black text-white font-mono mt-0.5 block">80s TTL</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Ligas menores</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 border border-purple-500/30 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">HT (Intervalo)</span>
                    <span className="text-sm font-black text-white font-mono mt-0.5 block">150s TTL</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Economia máxima</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 border border-rose-500/30 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">No Stats</span>
                    <span className="text-sm font-black text-white font-mono mt-0.5 block">10 min</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Backoff auto</span>
                  </div>
                </div>
              </div>

              {/* Catálogo de Jogos & Descoberta Assíncrona (live_daemon / bridge_web) */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Catálogo Persistente & Descoberta em Background</h4>
                      <p className="text-xs text-slate-400">
                        Otimizações de descoberta de jogos ao vivo desacopladas do ciclo principal de varredura estatística.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    Node.js Native Engine + Catalog
                  </span>
                </div>

                {/* Motor Ativo do Crawler (Produção 100% Node.js) */}
                <div className="p-3.5 bg-slate-900/90 border border-emerald-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-semibold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      <span>Motor Ativo do Crawler (CRAWLER_ENGINE)</span>
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-bold">
                      Node.js Nativo (Produção Oficial)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Motor Node.js / TypeScript HTTP Feed ativo em tempo real. Comunicação direta de alta velocidade sem necessidade de scripts Python ou workers externos.
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Recuperação rápida e re-sincronização do catálogo:</span>
                    <button
                      id="btn-restart-node-engine-secondary"
                      onClick={handleRestartNodeEngine}
                      disabled={nodeCrawlerActionLoading || isRestartingNodeEngine}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-cyan-500/40 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 hover:text-white transition shadow-sm ${
                        (nodeCrawlerActionLoading || isRestartingNodeEngine) ? "opacity-50 cursor-wait" : ""
                      }`}
                      title="Reinicia o processo do Motor Node.js, limpando o catálogo em memória e reconectando o feed em tempo real"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestartingNodeEngine ? "animate-spin text-cyan-400" : ""}`} />
                      <span>{isRestartingNodeEngine ? "Reiniciando..." : "Reiniciar Motor Node"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Intervalo de Descoberta */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Intervalo de Descoberta (s):</span>
                      <span className="font-mono text-cyan-400">{rulesConfig.crawlerConfig?.discoveryIntervalSeconds || 180}s</span>
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={600}
                      step={30}
                      value={rulesConfig.crawlerConfig?.discoveryIntervalSeconds || 180}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            discoveryIntervalSeconds: val,
                          },
                        });
                      }}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Varre a grade completa do Flashscore para descobrir novos jogos.</p>
                  </div>

                  {/* Faxina do Catálogo (Prune Stale) */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Faxina do Catálogo (min):</span>
                      <span className="font-mono text-cyan-400">{rulesConfig.crawlerConfig?.autoPruneMinutes || 30} min</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={5}
                      value={rulesConfig.crawlerConfig?.autoPruneMinutes || 30}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            autoPruneMinutes: val,
                          },
                        });
                      }}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Remove partidas não vistas do catálogo para economizar memória.</p>
                  </div>

                  {/* Backoff de Jogos sem Stats */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Backoff Sem Stats (min):</span>
                      <span className="font-mono text-cyan-400">{rulesConfig.crawlerConfig?.noStatsBackoffMinutes || 10} min</span>
                    </label>
                    <input
                      type="range"
                      min={3}
                      max={30}
                      step={1}
                      value={rulesConfig.crawlerConfig?.noStatsBackoffMinutes || 10}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            noStatsBackoffMinutes: val,
                          },
                        });
                      }}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Cooldown para partidas sem suporte a xG/chutes detalhados.</p>
                  </div>

                  {/* Concorrência de Workers */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Workers Paralelos:</span>
                      <span className="font-mono text-cyan-400">{rulesConfig.crawlerConfig?.concurrentWorkers || 4} threads</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      step={1}
                      value={rulesConfig.crawlerConfig?.concurrentWorkers || 4}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            concurrentWorkers: val,
                          },
                        });
                      }}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Número de leituras simultâneas na watchlist ativa.</p>
                  </div>

                  {/* Timeout Leitura da Partida */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Timeout Jogo (ms):</span>
                      <span className="font-mono text-cyan-400">{(rulesConfig.crawlerConfig?.matchReadTimeoutMs || 5000)}ms</span>
                    </label>
                    <input
                      type="range"
                      min={2000}
                      max={10000}
                      step={500}
                      value={rulesConfig.crawlerConfig?.matchReadTimeoutMs || 5000}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            matchReadTimeoutMs: val,
                          },
                        });
                      }}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Tempo limite para extração de estatísticas de cada partida.</p>
                  </div>

                  {/* Timeout Varredura de Descoberta */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Timeout Descoberta (ms):</span>
                      <span className="font-mono text-cyan-400">{(rulesConfig.crawlerConfig?.discoveryTimeoutMs || 12000)}ms</span>
                    </label>
                    <input
                      type="range"
                      min={5000}
                      max={25000}
                      step={1000}
                      value={rulesConfig.crawlerConfig?.discoveryTimeoutMs || 12000}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            discoveryTimeoutMs: val,
                          },
                        });
                      }}
                      className="w-full accent-cyan-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Tempo limite para o scan da grade geral de jogos.</p>
                  </div>
                </div>

                {/* Toggles de Bloqueio de Recursos e Background Discovery */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h6 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Bloqueio de Recursos Pesados (Route Filter)
                      </h6>
                      <p className="text-[10px] text-slate-400">Aborta o carregamento de imagens, fontes e analytics no Playwright.</p>
                    </div>
                    <button
                      onClick={() => {
                        const curr = rulesConfig.crawlerConfig?.routeResourceBlock ?? true;
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            routeResourceBlock: !curr,
                          },
                        });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                        (rulesConfig.crawlerConfig?.routeResourceBlock ?? true)
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {(rulesConfig.crawlerConfig?.routeResourceBlock ?? true) ? "Ativado" : "Desativado"}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <h6 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        Descoberta em Thread Paralela Desacoplada
                      </h6>
                      <p className="text-[10px] text-slate-400">Não trava o loop de atualização ao vivo durante a descoberta de jogos.</p>
                    </div>
                    <button
                      onClick={() => {
                        const curr = rulesConfig.crawlerConfig?.enableBackgroundDiscovery ?? true;
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            enableBackgroundDiscovery: !curr,
                          },
                        });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                        (rulesConfig.crawlerConfig?.enableBackgroundDiscovery ?? true)
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {(rulesConfig.crawlerConfig?.enableBackgroundDiscovery ?? true) ? "Ativado" : "Desativado"}
                    </button>
                  </div>
                </div>

                {/* Faxina Manual do Catálogo e Jogos Encerrados */}
                <div className="p-3.5 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex items-center justify-between flex-wrap gap-3 mt-2">
                  <div className="max-w-xl">
                    <h6 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Faxina Geral de Catálogo & Partidas Encerradas
                    </h6>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Remove todas as partidas encerradas/FT da memória e reseta as supressões manuais para uma nova rodada limpa. <i>(O intervalo de descoberta de rotina preserva o catálogo e as exclusões manuais sem resetá-las).</i>
                    </p>
                  </div>
                  <button
                    onClick={handleExecuteFaxina}
                    disabled={isExecutingFaxina}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-950/40 transition disabled:opacity-50"
                  >
                    {isExecutingFaxina ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{isExecutingFaxina ? "Executando Faxina..." : "Executar Faxina do Catálogo"}</span>
                  </button>
                </div>
                {faxinaStatus && (
                  <div className="p-2.5 bg-cyan-950/80 border border-cyan-500/50 rounded-xl text-xs text-cyan-200 font-medium animate-in fade-in">
                    {faxinaStatus}
                  </div>
                )}
              </div>

              {/* Watchlist por Tiers de Prioridade (Gestão de Capacidade & Velocidade) */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Watchlist Priorizada por Tiers de Jogo</h4>
                      <p className="text-xs text-slate-400">
                        Distribuição inteligente dos slots de escaneamento para focar em oportunidades de alto valor com máxima frequência.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    Tier 0 → 0.5 → 1/2 → 3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Tamanho Máximo da Watchlist */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Capacidade Watchlist:</span>
                      <span className="font-mono text-emerald-400">{rulesConfig.crawlerConfig?.maxWatchlistSize || 15} jogos</span>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={40}
                      step={1}
                      value={rulesConfig.crawlerConfig?.maxWatchlistSize || 15}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            maxWatchlistSize: val,
                          },
                        });
                      }}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Total de jogos prioritários escaneados a cada ciclo.</p>
                  </div>

                  {/* Slots Reservados Tier 3 */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Slots Rodízio (Tier 3):</span>
                      <span className="font-mono text-emerald-400">{rulesConfig.crawlerConfig?.tier3ReservedSlots || 2} slots</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={rulesConfig.crawlerConfig?.tier3ReservedSlots || 2}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            tier3ReservedSlots: val,
                          },
                        });
                      }}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Garante que ligas alternativas passem por varredura contínua.</p>
                  </div>

                  {/* Janela de Minutos (Entrada Watchlist) */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Janela Watchlist:</span>
                      <span className="font-mono text-emerald-400">
                        {rulesConfig.crawlerConfig?.minEntryMinute || 20}' a {rulesConfig.crawlerConfig?.maxEntryMinute || 83}'
                      </span>
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min={0}
                        max={45}
                        value={rulesConfig.crawlerConfig?.minEntryMinute || 20}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setRulesConfig({
                            ...rulesConfig,
                            crawlerConfig: {
                              ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                              minEntryMinute: val,
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                      />
                      <span className="text-slate-500 text-xs">até</span>
                      <input
                        type="number"
                        min={45}
                        max={95}
                        value={rulesConfig.crawlerConfig?.maxEntryMinute || 83}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 90;
                          setRulesConfig({
                            ...rulesConfig,
                            crawlerConfig: {
                              ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                              maxEntryMinute: val,
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">Minuto inicial e final para entrada de partidas na lista ativa.</p>
                  </div>

                  {/* Anti-Spam Cooldown */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Anti-Spam Sinais (min):</span>
                      <span className="font-mono text-emerald-400">{rulesConfig.crawlerConfig?.antiSpamCooldownMinutes || 5} min</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      step={1}
                      value={rulesConfig.crawlerConfig?.antiSpamCooldownMinutes || 5}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            antiSpamCooldownMinutes: val,
                          },
                        });
                      }}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Mantém o jogo fixo no Tier 0 para monitorar evolução pós-sinal.</p>
                  </div>

                  {/* Cooldown Geral Pós-Gol (3 min) */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Cooldown Geral Pós-Gol:</span>
                      <span className="font-mono text-purple-400">{rulesConfig.postGoalCooldownMinutes ?? 3} min (180s)</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={rulesConfig.postGoalCooldownMinutes ?? 3}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          postGoalCooldownMinutes: val,
                        });
                      }}
                      className="w-full accent-purple-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Suprime novos alertas táticos por 3 minutos após qualquer gol para evitar ruído precoce.</p>
                  </div>

                  {/* Cooldown Inicial do Crawler (3 min) */}
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Cooldown Inicial do Crawler:</span>
                      <span className="font-mono text-amber-400">{rulesConfig.crawlerStartupCooldownMinutes ?? 3} min (180s)</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={rulesConfig.crawlerStartupCooldownMinutes ?? 3}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerStartupCooldownMinutes: val,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            startupCooldownMinutes: val,
                          },
                        });
                      }}
                      className="w-full accent-amber-500 h-1.5 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">Resguardo na primeira inicialização do crawler para consolidação da grade sem alertas falsos.</p>
                  </div>
                </div>

                {/* Habilitação dos Níveis de Tiers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { key: "enableTier0Signals", label: "Tier 0 (Sinais & Posições)", desc: "Prioridade Absoluta" },
                    { key: "enableTier05PremiumLeagues", label: "Tier 0.5 (Ligas Premium A/B/C)", desc: "Grandes Campeonatos" },
                    { key: "enableTier12Window", label: "Tier 1 & 2 (Janela 20-83' & Stats)", desc: "Oportunidades em Curso" },
                    { key: "enableTier3Rotation", label: "Tier 3 (Rodízio de Ligas)", desc: "Exploração FIFO" },
                  ].map((tf) => {
                    const active = (rulesConfig.crawlerConfig?.tierFilter as any)?.[tf.key] ?? true;
                    return (
                      <button
                        key={tf.key}
                        onClick={() => {
                          const currentTiers = rulesConfig.crawlerConfig?.tierFilter || {
                            enableTier0Signals: true,
                            enableTier05PremiumLeagues: true,
                            enableTier12Window: true,
                            enableTier3Rotation: true,
                          };
                          setRulesConfig({
                            ...rulesConfig,
                            crawlerConfig: {
                              ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                              tierFilter: {
                                ...currentTiers,
                                [tf.key]: !active,
                              },
                            },
                          });
                        }}
                        className={`p-2.5 rounded-xl text-left border transition ${
                          active
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-900/60 border-slate-800 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold">{tf.label}</span>
                          {active ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{tf.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Filtros Excludentes do Crawler */}
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Filtros Excludentes do Crawler
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Ignora automaticamente categorias de partidas indesejadas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        key: "excludeWomen",
                        label: "Excluir Futebol Feminino",
                        desc: "Women / Feminino / Dames",
                        active: rulesConfig.crawlerConfig?.excludeWomen !== false,
                      },
                      {
                        key: "excludeEsoccer",
                        label: "Excluir E-Soccer / Simulados",
                        desc: "eSports, GT League, FIFA, 8x8",
                        active: rulesConfig.crawlerConfig?.excludeEsoccer !== false,
                      },
                      {
                        key: "excludeYouthUnder",
                        label: "Excluir Categorias de Base",
                        desc: "Sub-17/19/20/21/23, Youth, Under",
                        active: rulesConfig.crawlerConfig?.excludeYouthUnder !== false,
                      },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setRulesConfig({
                            ...rulesConfig,
                            crawlerConfig: {
                              ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                              [item.key]: !item.active,
                            },
                          });
                        }}
                        className={`p-3 rounded-xl text-left border transition ${
                          item.active
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                            : "bg-slate-900/60 border-slate-800 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{item.label}</span>
                          {item.active ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">{item.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Termos & Palavras-chave Adicionais para Bloqueio (separados por vírgula):
                    </label>
                    <input
                      type="text"
                      placeholder="ex: amador, regional, masters, 3x3"
                      value={customKeywordsText}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomKeywordsText(raw);
                        const terms = raw.split(",").map((s) => s.trim()).filter(Boolean);
                        setRulesConfig({
                          ...rulesConfig,
                          crawlerConfig: {
                            ...(rulesConfig.crawlerConfig || (DEFAULT_MODAL_CONFIG.crawlerConfig as any)),
                            customExcludedKeywords: terms,
                          },
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: BACKUP & PERFIL                                   */}
          {/* ======================================================== */}
          {activeTab === "backup_profile" && (
            <div className="space-y-6">
              {/* Local File Path Banner */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-emerald-400" />
                    Arquivo de Persistência em Disco:
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    JSON UTF-8
                  </span>
                </div>
                <div className="bg-slate-900 px-3 py-2 rounded-lg font-mono text-xs text-emerald-300 border border-slate-800/80 break-all select-all">
                  {filePath}
                </div>
              </div>

              {/* MODO DEBUG DO VITE (Dev Server / Console logs) */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-xl space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      rulesConfig.viteDebugMode
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                        : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}>
                      <Bug className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Modo DEBUG do Vite (Console & Dev Server)
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          rulesConfig.viteDebugMode
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rulesConfig.viteDebugMode ? "bg-purple-400 animate-ping" : "bg-slate-500"}`} />
                          {rulesConfig.viteDebugMode ? "DEBUG ATIVADO (TODOS OS LOGS LIBERADOS)" : "DEBUG DESATIVADO (ZERO MENSAGENS)"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {rulesConfig.viteDebugMode
                          ? "Todas as mensagens do Vite, conexões WebSocket, HMR e logs internos estão liberados no console."
                          : "DEBUG desativado: nenhuma mensagem do Vite, WebSocket ou HMR é exibida no console do navegador."}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleViteDebug(!rulesConfig.viteDebugMode)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rulesConfig.viteDebugMode ? "bg-purple-600" : "bg-slate-800"
                      }`}
                      role="switch"
                      aria-checked={rulesConfig.viteDebugMode}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rulesConfig.viteDebugMode ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className={`text-xs font-bold ${
                      rulesConfig.viteDebugMode ? "text-purple-300" : "text-slate-500"
                    }`}>
                      {rulesConfig.viteDebugMode ? "LIGADO" : "DESLIGADO"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs space-y-1.5">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Quando DESATIVADO (Padrão):
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      O console fica 100% limpo. Nenhuma mensagem ou erro do Vite é exibido (avisos como <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded font-mono text-[10px]">[vite] connecting...</code>, falhas de websocket e HMR são interceptadas e suprimidas).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-lg border border-purple-500/20 text-xs space-y-1.5">
                    <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      Quando ATIVADO:
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Deixa aparecer todas as mensagens do console do Vite, inclusive as que estavam suprimidas no código do aplicativo. Permite inspecionar logs de HMR, reconexão de WebSocket e diagnósticos em tempo real.
                    </p>
                  </div>
                </div>

                {/* Interactive Test Button & Instructions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span>Inspecione no navegador:</span>
                    <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">F12</kbd>
                    <span>&rarr; Console</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleTestViteLog}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm"
                  >
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    <span>Testar Emissão de Logs do Vite</span>
                    {testedLogCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-300 rounded text-[10px] font-mono">
                        {testedLogCount}x
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Perfil do Administrador Local */}
              <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  Perfil do Administrador Local
                </h4>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nome de Exibição</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Ex: Trader Local Pro"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => handleSaveToDisk(undefined, "Nome de exibição salvo no disco!")}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>

              {/* Backup / Export / Import */}
              <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                  Backup Manual & Transferência
                </h4>
                <p className="text-xs text-slate-400">
                  Exporte o arquivo de configuração para salvar em pen-drive ou importar em outra máquina.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={handleExportDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/30 transition active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Backup (.JSON)
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition active:scale-95"
                  >
                    <Upload className="w-4 h-4 text-cyan-400" />
                    Importar Backup JSON
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json,application/json"
                    className="hidden"
                  />

                  <button
                    onClick={handleResetToDefaults}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrão de Fábrica
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Ratio Ativo: <b className="text-amber-400">{rulesConfig.chancesPerGoalRatio.toFixed(1)}:1</b></span>
            <span>•</span>
            <span>Casas: <b className="text-cyan-400">{rulesConfig.enabledBookmakers?.length ?? 8}/9</b></span>
            <span>•</span>
            <span>Regras: <b className="text-emerald-400">{alertRules.length}</b></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSaveToDisk()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Gravar Alterações
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
