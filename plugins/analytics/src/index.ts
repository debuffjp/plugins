import type { Plugin } from "@debuffjp/core";

export type AnalyticsEvent =
  | { type: "start"; t: number; session: string }
  | { type: "scene"; t: number; session: string; scene: string }
  | { type: "event"; t: number; session: string; name: string; detail?: unknown }
  | { type: "error"; t: number; session: string; message: string; phase: string; scene?: string }
  | { type: "end"; t: number; session: string };

/** Delivers a batch. `final` is true for the last batch before the page goes away, when only a beacon gets through. */
export type AnalyticsSink = (batch: AnalyticsEvent[], final: boolean) => void | Promise<void>;

export interface AnalyticsOptions {
  send: AnalyticsSink;
  /** Which `game.emit` names to record. Default: none, so nothing about play is sent unless you choose it. */
  events?: readonly string[] | ((name: string) => boolean);
  /** Return false to drop everything (no consent yet, opted out). Checked on every event. Default: always true. */
  consent?: () => boolean;
  /** Seconds between flushes. Default 15. */
  interval?: number;
  /** Flush early once this many events are queued. Default 50. */
  maxBatch?: number;
}

/**
 * POST batches as JSON to `url`. Uses `sendBeacon` for the last batch so it survives the tab closing.
 * You own the endpoint and what it stores; the plugin sends no ids beyond a random per-page-load session.
 */
export function postJson(url: string): AnalyticsSink {
  return async (batch, final) => {
    const body = JSON.stringify(batch);
    if (final && navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  };
}

export function analytics({ send, events = [], consent = () => true, interval = 15, maxBatch = 50 }: AnalyticsOptions): Plugin {
  const wanted = typeof events === "function" ? events : (name: string) => events.includes(name);
  return {
    name: "analytics",
    install(game) {
      const session = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const started = performance.now();
      let queue: AnalyticsEvent[] = [];
      let sent = 0;
      let failed = 0;
      let ended = false;

      const flush = (final = false) => {
        if (queue.length === 0) return;
        const batch = queue;
        queue = [];
        sent += batch.length;
        // Analytics must never take the game down: a failing sink is counted, not thrown.
        Promise.resolve()
          .then(() => send(batch, final))
          .catch(() => failed++);
      };
      const record = (e: AnalyticsEvent) => {
        if (ended || !consent()) return;
        queue.push(e);
        if (queue.length >= maxBatch) flush();
      };
      const t = () => Math.round(performance.now() - started);

      record({ type: "start", t: 0, session });
      const offScene = game.hooks.sceneChange((next) => record({ type: "scene", t: t(), session, scene: next.id }));
      const offEvent = game.hooks.gameEvent((name, detail) => {
        if (wanted(name))
          record(detail === undefined ? { type: "event", t: t(), session, name } : { type: "event", t: t(), session, name, detail });
      });
      const offError = game.hooks.error((error, ctx) => {
        const base = {
          type: "error" as const,
          t: t(),
          session,
          message: error instanceof Error ? error.message : String(error),
          phase: ctx.phase,
        };
        record(ctx.scene === undefined ? base : { ...base, scene: ctx.scene });
        flush();
      });
      const offInspect = game.inspect.register("analytics", () => ({ session, queued: queue.length, sent, failed }));
      const timer = setInterval(() => flush(), interval * 1000);
      const onHide = () => {
        if (document.visibilityState === "hidden") flush(true);
      };
      const onPageHide = () => {
        record({ type: "end", t: t(), session });
        ended = true;
        flush(true);
      };
      document.addEventListener("visibilitychange", onHide);
      addEventListener("pagehide", onPageHide);

      return () => {
        offScene();
        offEvent();
        offError();
        offInspect();
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onHide);
        removeEventListener("pagehide", onPageHide);
        onPageHide();
      };
    },
  };
}
