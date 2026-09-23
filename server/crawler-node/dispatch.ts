// server/crawler-node/dispatch.ts
/**
 * Fila Assíncrona de Despacho e Heartbeat (server/crawler-node/dispatch.ts)
 * Portado 1:1 da lógica de despacho assíncrono, retries e heartbeat do bridge_web.py.
 * Processamento via async loop sem sobrecarga de threads.
 */

export interface DispatcherOptions {
  localServerUrl?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  sessionId?: string;
  maxQueueSize?: number;
  getActiveMatchesCount?: () => number;
}

export class Dispatcher {
  public localServerUrl: string;
  public webhookUrl: string;
  public webhookSecret: string;
  public sessionId: string;
  public maxQueueSize: number;
  public headers: Record<string, string>;

  private queue: string[] = [];
  private isRunning: boolean = false;
  private notifyWait: (() => void) | null = null;
  private workerPromise: Promise<void> | null = null;
  private heartbeatPromise: Promise<void> | null = null;
  private getActiveMatchesCount: () => number;

  constructor(options?: DispatcherOptions) {
    this.localServerUrl =
      options?.localServerUrl ||
      process.env.BACANALIVE_LOCAL_URL ||
      "http://127.0.0.1:3000";

    this.webhookUrl =
      options?.webhookUrl ||
      process.env.BACANALIVE_WEBHOOK_URL ||
      `${this.localServerUrl}/api/crawler/webhook/flashscore-live`;

    this.webhookSecret =
      options?.webhookSecret ||
      process.env.BACANALIVE_WEBHOOK_SECRET ||
      "sec_flashscore_982a17f";

    const timestampSec = Math.floor(Date.now() / 1000);
    const randomHex = Math.random().toString(36).substring(2, 10);
    this.sessionId = options?.sessionId || `sess_${timestampSec}_${randomHex}`;
    this.maxQueueSize = options?.maxQueueSize || 3000;
    this.getActiveMatchesCount = options?.getActiveMatchesCount || (() => 0);

    this.headers = {
      "Content-Type": "application/json",
      "x-webhook-token": this.webhookSecret,
      "x-crawler-session-id": this.sessionId,
      "x-crawler-engine": "node",
      "User-Agent":
        "BacanaLive-NodeCrawler/1.0 (Node.js; Chrome/120.0.0.0)",
    };
  }

  public setActiveMatchesProvider(provider: () => number): void {
    this.getActiveMatchesCount = provider;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.workerPromise = this.processQueueLoop();
    this.heartbeatPromise = this.heartbeatLoop();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Acorda o loop de fila se estiver esperando
    if (this.notifyWait) {
      const wake = this.notifyWait;
      this.notifyWait = null;
      wake();
    }

    try {
      await Promise.all([this.workerPromise, this.heartbeatPromise]);
    } catch {
      // Ignora erros no shutdown
    }
  }

  /**
   * Serializa e enfileira a partida para envio assíncrono ao Dashboard.
   */
  public emitMatchUpdate(matchData: Record<string, any>, tierTag: string = "T1"): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Fila cheia - descarta o payload mais antigo ou ignora como no Python
      return;
    }

    try {
      matchData.engine = "node";
      matchData.crawlerEngine = "node";

      const body = JSON.stringify({
        action: "batch_update",
        matches: [matchData],
        tier_tag: tierTag,
        session_id: this.sessionId,
        sessionId: this.sessionId,
        engine: "node",
        crawlerEngine: "node",
        timestamp: new Date().toISOString(),
      });

      this.queue.push(body);

      // Desperta o worker assíncrono caso esteja ocioso
      if (this.notifyWait) {
        const wake = this.notifyWait;
        this.notifyWait = null;
        wake();
      }
    } catch (err) {
      console.warn("⚠️ [Dispatcher] Erro ao serializar match update:", err);
    }
  }

  /**
   * Consumidor assíncrono da fila de despacho de payloads.
   */
  private async processQueueLoop(): Promise<void> {
    while (this.isRunning) {
      if (this.queue.length === 0) {
        // Aguarda a chegada de novo item ou checagem a cada 500ms
        await new Promise<void>((resolve) => {
          this.notifyWait = resolve;
          setTimeout(resolve, 500);
        });
        continue;
      }

      const payload = this.queue.shift();
      if (!payload) continue;

      // Executa até 3 tentativas com backoff exatamente como no Python
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(this.webhookUrl, {
            method: "POST",
            headers: this.headers,
            body: payload,
            signal: AbortSignal.timeout(3500),
          });

          if (res.status === 200 || res.status === 201) {
            break;
          }
        } catch {
          if (attempt < 2 && this.isRunning) {
            await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          }
        }
      }
    }
  }

  /**
   * Worker de Heartbeat que envia o sinal vital para o servidor a cada 8 segundos.
   */
  private async heartbeatLoop(): Promise<void> {
    const hbUrl = `${this.localServerUrl}/api/crawler/heartbeat`;

    while (this.isRunning) {
      try {
        const activeCount = this.getActiveMatchesCount();
        await fetch(hbUrl, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            crawlerId: "BacanaLive_Bridge",
            version: "2.5",
            activeMatches: activeCount,
            status: "running",
            session_id: this.sessionId,
            sessionId: this.sessionId,
          }),
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        // Ignora falhas de conexão no heartbeat exatamente como no Python
      }

      // Intervalo de 8 segundos dividido em fatias curtas para desligamento imediato se solicitado
      const steps = 16;
      for (let i = 0; i < steps && this.isRunning; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * Notifica o servidor web local no início da execução para vincular a sessão.
   */
  public async notifyCrawlerStartupReset(): Promise<void> {
    try {
      const baseUrl = this.webhookUrl.split("/api/")[0] || this.localServerUrl;
      const url = `${baseUrl}/api/crawler/startup-reset`;
      console.log(`🧹 [Startup] Notificando servidor web com Session ID: ${this.sessionId}...`);

      const resp = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          status: "started",
          reason: "crawler_startup",
          session_id: this.sessionId,
          sessionId: this.sessionId,
        }),
        signal: AbortSignal.timeout(2000),
      });

      if (resp.status === 200) {
        console.log("✨ [Startup Web] Servidor web confirmou zeramento de todas as partidas e vinculou a nova sessão.");
      } else {
        const urlFallback = `${baseUrl}/api/crawler/disconnect`;
        await fetch(urlFallback, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            status: "reset",
            reason: "crawler_startup",
            session_id: this.sessionId,
          }),
          signal: AbortSignal.timeout(1500),
        });
      }
    } catch {
      try {
        const baseUrl = this.webhookUrl.split("/api/")[0] || this.localServerUrl;
        const urlFallback = `${baseUrl}/api/crawler/disconnect`;
        await fetch(urlFallback, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            status: "reset",
            reason: "crawler_startup",
            session_id: this.sessionId,
          }),
          signal: AbortSignal.timeout(1500),
        });
      } catch {
        // Silencioso
      }
    }
  }

  /**
   * Notifica o servidor web local que o crawler foi encerrado, zerando a grade de partidas instantaneamente.
   */
  public async notifyCrawlerShutdown(): Promise<void> {
    try {
      const baseUrl = this.webhookUrl.split("/api/")[0] || this.localServerUrl;
      const url = `${baseUrl}/api/crawler/disconnect`;
      console.log("🧹 Zerando grade de partidas ao vivo no servidor web...");
      await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ status: "stopped", reason: "user_exit" }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // Silencioso
    }
  }
}

// Instância padrão para conveniência
export const defaultDispatcher = new Dispatcher();

export function emitMatchUpdate(matchData: Record<string, any>, tierTag: string = "T1"): void {
  defaultDispatcher.emitMatchUpdate(matchData, tierTag);
}

export async function notifyCrawlerStartupReset(): Promise<void> {
  await defaultDispatcher.notifyCrawlerStartupReset();
}

export async function notifyCrawlerShutdown(): Promise<void> {
  await defaultDispatcher.notifyCrawlerShutdown();
}
