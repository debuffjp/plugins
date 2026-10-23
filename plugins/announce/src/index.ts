import type { Plugin } from "@debuffjp/core";

export type Politeness = "polite" | "assertive";

/** A fixed message, or one built from the event's detail. Return undefined to stay quiet. */
export type Message = string | ((detail: unknown) => string | undefined);

export interface AnnounceOptions {
  /** Read when a scene starts, keyed by scene id: `{ title: "Title screen. Press Enter to start." }`. */
  scenes?: Record<string, string>;
  /** Read when the game calls `game.emit(name, detail)`: `{ hurt: (d) => \`\${d.hp} health left\` }`. */
  events?: Record<string, Message>;
  /** The canvas's accessible name, e.g. the game's title. Left alone when omitted. */
  label?: string;
  /** Default `"polite"`: waits for the screen reader to finish. `"assertive"` interrupts. */
  politeness?: Politeness;
}

export interface AnnouncePlugin extends Plugin {
  /** Read `text` now. Repeating the same text is read again. */
  say(text: string, politeness?: Politeness): void;
}

// Visually hidden but still read: the usual "sr-only" recipe.
const HIDDEN =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0";

export function announce({ scenes = {}, events = {}, label, politeness = "polite" }: AnnounceOptions = {}): AnnouncePlugin {
  const regions = new Map<Politeness, HTMLElement>();
  const said: string[] = [];
  let flip = false;

  const plugin: AnnouncePlugin = {
    name: "announce",
    install(game) {
      const host = game.canvas.parentElement ?? document.body;
      for (const p of ["polite", "assertive"] as const) {
        const el = document.createElement("div");
        el.setAttribute("aria-live", p);
        el.setAttribute("aria-atomic", "true");
        el.dataset.debuffAnnounce = p;
        el.style.cssText = HIDDEN;
        host.append(el);
        regions.set(p, el);
      }
      const previousLabel = game.canvas.getAttribute("aria-label");
      if (label !== undefined) game.canvas.setAttribute("aria-label", label);

      const offScene = game.hooks.sceneChange((next) => {
        const text = scenes[next.id];
        if (text) plugin.say(text);
      });
      const offEvent = game.hooks.gameEvent((name, detail) => {
        const message = events[name];
        const text = typeof message === "function" ? message(detail) : message;
        if (text) plugin.say(text);
      });
      const offInspect = game.inspect.register("announce", () => ({ said: said.slice(-10) }));

      return () => {
        offScene();
        offEvent();
        offInspect();
        for (const el of regions.values()) el.remove();
        regions.clear();
        if (label !== undefined) {
          if (previousLabel === null) game.canvas.removeAttribute("aria-label");
          else game.canvas.setAttribute("aria-label", previousLabel);
        }
      };
    },
    say(text, p = politeness) {
      const el = regions.get(p);
      if (!el) return;
      // Screen readers skip a live region whose text didn't change, so alternate a trailing no-break space.
      flip = !flip;
      el.textContent = flip ? text : `${text} `;
      said.push(text);
      if (said.length > 50) said.shift();
    },
  };
  return plugin;
}
