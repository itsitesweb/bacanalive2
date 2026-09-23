// src/utils/viteConsoleManager.ts
/**
 * Controlador de logs e interceptador do console para o modo DEBUG do Vite.
 *
 * Requisito:
 * - Quando DEBUG estiver DESATIVADO: nenhuma mensagem do Vite / WebSocket / HMR deve poluir o console.
 * - Quando DEBUG estiver ATIVADO: liberar e exibir todas as mensagens do Vite no console,
 *   mesmo as suprimidas no código do aplicativo.
 */

const STORAGE_KEY = "bacanalive_vite_debug_mode";

let isDebugActive = false;
let isInitialized = false;

// Preservar métodos originais do console
export const rawConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: (console.debug || console.log).bind(console),
};

/**
 * Detecta se a chamada partiu de scripts internos do Vite (ex: @vite/client)
 */
function isFromViteClientStack(): boolean {
  try {
    const err = new Error();
    const stack = err.stack || "";
    return (
      stack.includes("@vite/client") ||
      stack.includes("/@vite/") ||
      stack.includes("vite/dist/client") ||
      stack.includes("vite/client")
    );
  } catch {
    return false;
  }
}

/**
 * Detecta se os argumentos passados contêm strings/padrões característicos do Vite / HMR / Dev Server
 */
function isViteMessage(args: any[]): boolean {
  if (!args || args.length === 0) return false;

  const text = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");

  const lower = text.toLowerCase();

  return (
    lower.includes("[vite]") ||
    lower.includes("vite:ws") ||
    lower.includes("vite:hmr") ||
    lower.includes("failed to connect to websocket") ||
    lower.includes("cannot connect to websocket") ||
    lower.includes("connecting...") ||
    lower.includes("connected.") ||
    lower.includes("[hmr]") ||
    lower.includes("hot module replacement") ||
    lower.includes("websocket connection to") ||
    lower.includes("ws://") ||
    lower.includes("wss://")
  );
}

/**
 * Inicializa a interceptação do console do navegador
 */
export function initViteConsoleManager(initialEnabled?: boolean): void {
  if (typeof window === "undefined") return;

  // Carrega preferência persistida
  if (initialEnabled !== undefined) {
    isDebugActive = !!initialEnabled;
    try {
      localStorage.setItem(STORAGE_KEY, isDebugActive ? "true" : "false");
    } catch {}
  } else {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      isDebugActive = saved === "true";
    } catch {
      isDebugActive = false;
    }
  }

  if (isInitialized) return;
  isInitialized = true;

  console.log = (...args: any[]) => {
    const fromVite = isViteMessage(args) || isFromViteClientStack();
    if (fromVite) {
      if (isDebugActive) {
        rawConsole.log(...args);
      }
      // Se DEBUG estiver desativado, suprime 100%
      return;
    }
    rawConsole.log(...args);
  };

  console.info = (...args: any[]) => {
    const fromVite = isViteMessage(args) || isFromViteClientStack();
    if (fromVite) {
      if (isDebugActive) {
        rawConsole.info(...args);
      }
      return;
    }
    rawConsole.info(...args);
  };

  console.warn = (...args: any[]) => {
    const fromVite = isViteMessage(args) || isFromViteClientStack();
    if (fromVite) {
      if (isDebugActive) {
        rawConsole.warn(...args);
      }
      return;
    }
    rawConsole.warn(...args);
  };

  console.error = (...args: any[]) => {
    const fromVite = isViteMessage(args) || isFromViteClientStack();
    if (fromVite) {
      if (isDebugActive) {
        rawConsole.error(...args);
      }
      return;
    }
    rawConsole.error(...args);
  };

  console.debug = (...args: any[]) => {
    const fromVite = isViteMessage(args) || isFromViteClientStack();
    if (fromVite) {
      if (isDebugActive) {
        rawConsole.debug(...args);
      }
      return;
    }
    rawConsole.debug(...args);
  };

  if (isDebugActive) {
    rawConsole.info(
      "%c[Vite DEBUG ATIVO]%c Modo DEBUG do Vite está ativado. Todas as mensagens do Vite e console estão visíveis.",
      "background: #10b981; color: #ffffff; font-weight: bold; padding: 2px 8px; border-radius: 4px;",
      "color: #34d399; font-weight: 500; margin-left: 6px;"
    );
  }
}

/**
 * Atualiza o status do modo debug em tempo de execução
 */
export function setViteDebugMode(enabled: boolean): void {
  isDebugActive = !!enabled;
  try {
    localStorage.setItem(STORAGE_KEY, isDebugActive ? "true" : "false");
  } catch {}

  if (isDebugActive) {
    rawConsole.info(
      "%c[Vite DEBUG ATIVO]%c Modo DEBUG do Vite ativado via CONFIG. Exibindo mensagens de [vite], HMR e WebSocket no console.",
      "background: #10b981; color: #ffffff; font-weight: bold; padding: 3px 8px; border-radius: 4px;",
      "color: #34d399; font-weight: 600; margin-left: 6px;"
    );
  } else {
    rawConsole.info(
      "%c[Vite DEBUG DESATIVADO]%c Modo DEBUG do Vite desativado. Mensagens do Vite, WebSocket e HMR suprimidas.",
      "background: #64748b; color: #ffffff; font-weight: bold; padding: 3px 8px; border-radius: 4px;",
      "color: #94a3b8; font-weight: 500; margin-left: 6px;"
    );
  }
}

/**
 * Retorna se o modo debug está ativo atualmente
 */
export function isViteDebugEnabled(): boolean {
  return isDebugActive;
}

/**
 * Dispara mensagens de teste no console para validação imediata pelo usuário
 */
export function triggerTestViteLog(): void {
  console.log("[vite] connecting...");
  console.log("[vite] connected.");
  console.info("[vite] hot updated: /src/App.tsx");
  console.warn("[vite] failed to connect to websocket. your current setup: ws://localhost:3000/");
  console.log("[vite:ws] ping received from dev server.");
}
