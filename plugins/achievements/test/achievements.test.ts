import { beforeEach, describe, expect, it } from "vitest";
import { makeGame } from "../../../test/helpers.js";
import { achievements } from "../src/index.js";

const defs = () =>
  achievements({
    list: [
      { id: "FIRST_COIN", title: "First coin", when: { event: "coin" } },
      { id: "HUNDRED", title: "Hoarder", when: { event: "coin", count: 100 } },
      { id: "SECRET", title: "Shh", secret: true },
    ],
  });

describe("achievements", () => {
  beforeEach(() => localStorage.clear());

  it("unlocks from counted game events and emits achievement", () => {
    const game = makeGame();
    const a = defs();
    game.use(a);
    const emitted: unknown[] = [];
    game.hooks.gameEvent((name, d) => name === "achievement" && emitted.push(d));
    for (let i = 0; i < 99; i++) game.emit("coin");
    expect(a.isUnlocked("FIRST_COIN")).toBe(true);
    expect(a.isUnlocked("HUNDRED")).toBe(false);
    expect(a.list().find((s) => s.id === "HUNDRED")?.progress).toBe(99);
    game.emit("coin");
    expect(a.isUnlocked("HUNDRED")).toBe(true);
    expect(emitted).toEqual([{ id: "FIRST_COIN" }, { id: "HUNDRED" }]);
  });

  it("keeps progress across sessions and unlocks once", () => {
    const g1 = makeGame();
    const a1 = defs();
    g1.use(a1);
    for (let i = 0; i < 60; i++) g1.emit("coin");
    g1.dispose();
    const g2 = makeGame();
    const a2 = defs();
    g2.use(a2);
    const seen: string[] = [];
    a2.onUnlock((x) => seen.push(x.id));
    for (let i = 0; i < 40; i++) g2.emit("coin");
    expect(seen).toEqual(["HUNDRED"]);
    expect(a2.unlock("HUNDRED")).toBe(false);
  });

  it("hides secrets until unlocked, exposes inspect state, and resets", () => {
    const game = makeGame();
    const a = defs();
    game.use(a);
    expect(a.list().map((s) => s.id)).toEqual(["FIRST_COIN", "HUNDRED"]);
    a.unlock("SECRET");
    expect(a.list().map((s) => s.id)).toContain("SECRET");
    expect(game.inspect.snapshot().achievements).toEqual({ unlocked: ["SECRET"], counts: {} });
    a.reset();
    expect(a.isUnlocked("SECRET")).toBe(false);
  });

  it("rejects bad definitions and unknown ids", () => {
    expect(() => achievements({ list: [{ id: "a b", title: "x" }] })).toThrow(/letters/);
    expect(() =>
      achievements({
        list: [
          { id: "A", title: "x" },
          { id: "A", title: "y" },
        ],
      }),
    ).toThrow(/twice/);
    const a = defs();
    expect(() => a.unlock("FIRST_COIN")).toThrow(/game.use/);
    makeGame().use(a);
    expect(() => a.unlock("NOPE")).toThrow(/unknown/);
  });
});
