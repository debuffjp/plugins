import { type Game, type Plugin, Storage } from "@debuffjp/core";

/** One achievement. Ids follow the portal convention (`FIRST_BLOOD`) so platform adapters can pass them through. */
export interface Achievement {
  id: string;
  title: string;
  description?: string;
  /** Hidden from `list()` until unlocked. */
  secret?: boolean;
  /** Unlock after `game.emit(event)` has fired `count` times (default 1), counted across sessions. */
  when?: { event: string; count?: number };
}

export interface AchievementStatus extends Achievement {
  unlocked: boolean;
  /** Times `when.event` has fired, capped at the target. */
  progress: number;
  target: number;
}

export interface AchievementsOptions {
  list: Achievement[];
  /** localStorage key. Default `"achievements"`; set one per game when several share an origin. */
  storageKey?: string;
}

export interface AchievementsPlugin extends Plugin {
  /** Unlock by id. Returns false if it was already unlocked. Emits `game.emit("achievement", { id })`. */
  unlock(id: string): boolean;
  isUnlocked(id: string): boolean;
  /** Every achievement with its state, secret ones only once unlocked. */
  list(): AchievementStatus[];
  /** Called on every new unlock, for your own toast or sound. */
  onUnlock(fn: (achievement: Achievement) => void): () => void;
  /** Forget all progress (a "reset save" menu item). */
  reset(): void;
}

interface Saved {
  unlocked: string[];
  counts: Record<string, number>;
}

const ID = /^[A-Za-z0-9_-]+$/;

export function achievements({ list, storageKey = "achievements" }: AchievementsOptions): AchievementsPlugin {
  const byId = new Map<string, Achievement>();
  for (const a of list) {
    if (!ID.test(a.id)) throw new Error(`achievements: id "${a.id}" may only use letters, digits, _ and -`);
    if (byId.has(a.id)) throw new Error(`achievements: "${a.id}" is listed twice`);
    if (a.when && (a.when.count ?? 1) < 1) throw new Error(`achievements: "${a.id}" needs when.count of at least 1`);
    byId.set(a.id, a);
  }
  // Event name → achievements it counts towards, so each game event costs one map lookup.
  const watchers = new Map<string, Achievement[]>();
  for (const a of list) if (a.when) watchers.set(a.when.event, [...(watchers.get(a.when.event) ?? []), a]);

  const listeners = new Set<(a: Achievement) => void>();
  let save: Storage<Saved> | undefined;
  let game: Game | undefined;

  const store = () => {
    if (!save) throw new Error("achievements: call game.use() before using the plugin");
    return save;
  };

  const plugin: AchievementsPlugin = {
    name: "achievements",
    install(g) {
      game = g;
      save = new Storage<Saved>(storageKey, { unlocked: [], counts: {} });
      const offEvent = g.hooks.gameEvent((name) => {
        const targets = watchers.get(name);
        if (!targets) return;
        const counts = { ...store().get("counts") };
        counts[name] = (counts[name] ?? 0) + 1;
        store().set("counts", counts);
        for (const a of targets) if (counts[name] >= (a.when?.count ?? 1)) plugin.unlock(a.id);
      });
      const offInspect = g.inspect.register("achievements", () => ({
        unlocked: store().get("unlocked"),
        counts: store().get("counts"),
      }));
      return () => {
        offEvent();
        offInspect();
        listeners.clear();
        game = undefined;
      };
    },
    unlock(id) {
      const a = byId.get(id);
      if (!a) throw new Error(`achievements: unknown id "${id}"`);
      const unlocked = store().get("unlocked");
      if (unlocked.includes(id)) return false;
      store().set("unlocked", [...unlocked, id]);
      for (const fn of listeners) fn(a);
      game?.emit("achievement", { id });
      return true;
    },
    isUnlocked: (id) => store().get("unlocked").includes(id),
    list() {
      const unlocked = new Set(store().get("unlocked"));
      const counts = store().get("counts");
      return list
        .filter((a) => !a.secret || unlocked.has(a.id))
        .map((a) => {
          const target = a.when?.count ?? 1;
          const done = unlocked.has(a.id);
          const progress = done ? target : a.when ? Math.min(counts[a.when.event] ?? 0, target) : 0;
          return { ...a, unlocked: done, progress, target };
        });
    },
    onUnlock(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset: () => store().reset(),
  };
  return plugin;
}
