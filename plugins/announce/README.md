# @debuffjp/plugin-announce

Screen reader announcements for canvas games. A canvas is invisible to assistive tech, so this plugin reads scene changes and game events aloud through an ARIA live region.

```ts
import { announce } from "@debuffjp/plugin-announce";

const speech = announce({
  label: "Coin Rush",
  scenes: { title: "Coin Rush. Press Enter to start.", over: "Game over." },
  events: {
    hurt: (d) => `${(d as { hp: number }).hp} health left`,
    "level-clear": "Level clear!",
  },
});
game.use(speech);

speech.say("Boss incoming", "assertive"); // interrupts; default is polite
```

- Messages are keyed by scene id and `game.emit` name, so most games need no other code changes.
- Saying the same text twice reads it twice.
- Adds two visually hidden `aria-live` elements next to the canvas and removes them on `game.dispose()`.
- `debuff inspect` shows the last 10 messages, which makes announcements testable in scenarios.

This covers announcements. It doesn't make menus navigable by screen reader on its own; pair it with keyboard-operable menus (`@debuffjp/ui`) and say the focused item.
