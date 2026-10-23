import { afterEach, describe, expect, it, vi } from "vitest";
import { makeGame } from "../../../test/helpers.js";
import { type AnalyticsEvent, analytics } from "../src/index.js";

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

describe("analytics", () => {
  afterEach(() => vi.useRealTimers());

  it("records start, scenes and only the chosen events, then flushes on dispose", async () => {
    const batches: AnalyticsEvent[][] = [];
    const game = makeGame();
    game.use(analytics({ send: (b) => void batches.push(b), events: ["death"] }));
    game.add({ id: "play" }).go("play");
    game.emit("death", { x: 3 });
    game.emit("coin");
    game.dispose();
    await flushPromises();
    const types = batches.flat().map((e) => (e.type === "event" ? `event:${e.name}` : e.type));
    expect(types).toEqual(["start", "scene", "event:death", "end"]);
    expect(new Set(batches.flat().map((e) => e.session)).size).toBe(1);
  });

  it("flushes on the interval and when the batch fills", async () => {
    vi.useFakeTimers();
    const batches: AnalyticsEvent[][] = [];
    const game = makeGame();
    game.use(analytics({ send: (b) => void batches.push(b), events: () => true, interval: 5, maxBatch: 3 }));
    game.emit("a");
    game.emit("b");
    await vi.advanceTimersByTimeAsync(0);
    expect(batches.length).toBe(1);
    game.emit("c");
    await vi.advanceTimersByTimeAsync(5000);
    expect(batches.flat().length).toBe(4);
  });

  it("sends nothing without consent and survives a failing sink", async () => {
    let ok = false;
    let calls = 0;
    const failing = () => {
      calls++;
      return Promise.reject(new Error("offline"));
    };
    const game = makeGame();
    game.use(analytics({ send: failing, consent: () => ok, events: ["x"] }));
    game.emit("x");
    game.dispose();
    await flushPromises();
    expect(calls).toBe(0);
    ok = true;
    const g2 = makeGame();
    g2.use(analytics({ send: failing, consent: () => ok }));
    expect(() => g2.dispose()).not.toThrow();
    await flushPromises();
    expect(calls).toBe(1);
  });
});
