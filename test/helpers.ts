import { Game } from "@debuffjp/core";
import { vi } from "vitest";

// Swap for createTestGame() from @debuffjp/core/testing once a core release ships it.
/** happy-dom has no canvas backends: return no WebGL2 and a no-op 2D context so `Game` runs on Canvas 2D. */
export function makeGame(): Game {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const noop = () => {};
  const ctx = new Proxy({ canvas, fillStyle: "", globalAlpha: 1 } as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : noop),
  });
  vi.spyOn(canvas, "getContext").mockImplementation(((type: string) => (type === "2d" ? ctx : null)) as typeof canvas.getContext);
  return new Game({ canvas, width: 100, height: 100, scale: "none" });
}
