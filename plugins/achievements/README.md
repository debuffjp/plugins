# @debuffjp/plugin-achievements

Achievements for debuff games. Unlock them by counting `game.emit` events or by calling `unlock()`. Progress is saved in localStorage and survives reloads.

```ts
import { achievements } from "@debuffjp/plugin-achievements";

const trophies = achievements({
  list: [
    { id: "FIRST_COIN", title: "First coin", when: { event: "coin" } },
    { id: "HOARDER", title: "Hoarder", description: "Collect 100 coins", when: { event: "coin", count: 100 } },
    { id: "PACIFIST", title: "Pacifist", secret: true },
  ],
});
game.use(trophies);

trophies.onUnlock((a) => showToast(a.title)); // you draw the toast, in your game's style
if (wonWithoutKills) trophies.unlock("PACIFIST");
trophies.list(); // [{ id, title, unlocked, progress, target }...] for an achievements screen
```

- Each unlock also fires `game.emit("achievement", { id })`, so analytics, platform adapters and scenarios can see it.
- `debuff inspect` and `__DEBUFF_DEV__.state().plugins.achievements` show unlocked ids and event counts.
- Ids use letters, digits, `_` and `-`, matching portal conventions like `FIRST_BLOOD`.
- Pass `storageKey` if several games share an origin (itch.io embeds, a local dev server).
