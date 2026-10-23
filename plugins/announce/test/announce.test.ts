import { afterEach, describe, expect, it } from "vitest";
import { makeGame } from "../../../test/helpers.js";
import { announce } from "../src/index.js";

const region = (p: string) => document.querySelector<HTMLElement>(`[data-debuff-announce="${p}"]`);

describe("announce", () => {
  afterEach(() => document.body.replaceChildren());

  it("reads scene and event messages into a live region", () => {
    const game = makeGame();
    game.use(
      announce({
        label: "Coin Rush",
        scenes: { title: "Title screen. Press Enter." },
        events: { hurt: (d) => `${(d as { hp: number }).hp} health left`, quiet: () => undefined },
      }),
    );
    expect(game.canvas.getAttribute("aria-label")).toBe("Coin Rush");
    expect(region("polite")?.getAttribute("aria-live")).toBe("polite");
    game.add({ id: "title" }).go("title");
    expect(region("polite")?.textContent?.trim()).toBe("Title screen. Press Enter.");
    game.emit("hurt", { hp: 2 });
    expect(region("polite")?.textContent?.trim()).toBe("2 health left");
    game.emit("quiet");
    expect(region("polite")?.textContent?.trim()).toBe("2 health left");
  });

  it("changes the text when the same message repeats, and supports assertive", () => {
    const game = makeGame();
    const a = announce();
    game.use(a);
    a.say("Pause");
    const first = region("polite")?.textContent;
    a.say("Pause");
    expect(region("polite")?.textContent).not.toBe(first);
    a.say("Boss!", "assertive");
    expect(region("assertive")?.textContent?.trim()).toBe("Boss!");
    game.dispose();
  });

  it("removes its regions and restores the label on dispose", () => {
    const game = makeGame();
    game.canvas.setAttribute("aria-label", "old");
    game.use(announce({ label: "new" }));
    game.dispose();
    expect(region("polite")).toBeNull();
    expect(game.canvas.getAttribute("aria-label")).toBe("old");
  });
});
