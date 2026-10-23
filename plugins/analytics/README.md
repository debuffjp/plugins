# @debuffjp/plugin-analytics

Gameplay analytics for debuff games: session start and end, scene changes, errors, and the `game.emit` events you choose. Batched, sent to an endpoint you own.

```ts
import { analytics, postJson } from "@debuffjp/plugin-analytics";

game.use(
  analytics({
    send: postJson("https://example.com/collect"),
    events: ["death", "level-clear"], // nothing else from play is sent
    consent: () => settings.get("analytics"),
  }),
);
```

- Records nothing about play unless you list it in `events`. Errors and scene ids are always included.
- Sends one random session id per page load, and no user ids, cookies or fingerprints.
- Flushes every 15 seconds (`interval`), at 50 events (`maxBatch`), when the tab is hidden, and on close with `sendBeacon`.
- A failing endpoint never throws into your game. `debuff inspect` shows `queued`, `sent` and `failed` counts.
- `send` can be any function, so forwarding to PostHog, Plausible or your own Worker is a few lines.

Tell players what you collect. If you need consent where they live, gate it with `consent`.
