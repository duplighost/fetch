# THE TRUE ENDING — the game that attaches after FETCH's ending

He sent `Downloads/fetch-game.zip` on 2026-08-19 with:

> "also, i made this game with grok. I don't know how we do it, but after our
> games finale, i want it to go to this cheeky ending game. i figure its
> possible. we just have to make sure the transition between the other stuff
> doesn't like, lag into this part or something."

and, on the scaffolding that came with it:

> "lol, p2p multipleayer. we dont need that stuff"

**A working copy of the zip is extracted at**
`%TEMP%/claude/.../scratchpad/fetch-game` — but treat the zip in `Downloads` as
the source of truth. Per [[claude-ai-zip-bundles]] these bundles arrive damaged;
this one looks intact but has not been diffed against anything.

---

## What it actually is

`FETCH — The True Ending`. A **DDR-style rhythm game**: a photorealistic man
dances with a chomping skull on a video backdrop while you hit falling arrows.

Four movements play as one set from the title screen, with a bridge card
between each, then a results screen with a grade per movement plus a total:

| # | id | title | bpm | difficulty | bars | stage clip |
|---|---|---|---|---|---|---|
| 1 | `grin-machine` | Grin Machine | 108 | easy | 20 | stage |
| 2 | `jawbone-jig` | Jawbone Jig | 128 | normal | 24 | stage |
| 3 | `marrow-march` | Marrow March | 140 | hard | 24 | spin |
| 4 | `last-chomp` | Last Chomp | 160 | expert | 28 | spin |

Taglines are already written and they are in his voice — "The jaw never closes.
Neither should you." Keep them verbatim.

Desktop input is arrow keys or WASD; phone gets four pads at the bottom.
Empty grin does **not** end the run — you always reach the results.

## The one fact that makes this easy

**It is not a Three.js game.** It is a 2D `<canvas>` playfield over three
`<video>` elements, with procedurally synthesised music from the Web Audio API.
Nothing in the game logic touches React except the screen shell.

That means the port to FETCH's idiom (vanilla ES modules, no build step) is
mostly *deleting* rather than *rewriting*.

### Keep, near-verbatim (strip the TypeScript types and it runs)

| file | ~size | what it is |
|---|---|---|
| `src/game/types.ts` | 1.8 K | `LANE_COLORS`, `WINDOWS` (perfect .046 / great .092 / good .148), `TRAVEL` 1.55 |
| `src/game/songs.ts` | 4.3 K | the four songs + `generateChart()` — a seeded mulberry32 chart generator, deterministic |
| `src/game/engine.ts` | 6.0 K | `Engine` class: timing windows, scoring, combo multiplier, the grin meter, grades S/A/B/C/D/F |
| `src/game/audio.ts` | 9.9 K | the whole soundtrack, synthesised — kick, snare, hat, clap, acid bass, lead, per-style scales, a 16th-note lookahead scheduler. **Zero React, zero deps.** |
| `src/game/render.ts` | 6.5 K | canvas playfield, arrows, receptors, particles, responsive layout |

### Rewrite (React → plain DOM; this is the actual work, ~400 lines)

| file | ~size | what it does |
|---|---|---|
| `src/game/ChompGame.tsx` | 16.8 K | screen flow, RAF loop, key/pointer input, the three video layers, HUD |
| `src/game/overlays.tsx` | 12.1 K | title, pause, results, touch pads, key guide |

### Delete outright — this is the "we dont need that stuff"

`src/lib/multiplayer/p2p.ts` (20.6 K), all of `src/lib/auth/` (9 files),
`src/lib/db.ts`, `src/lib/scores.ts`, `migrations/`, `src/routes/`,
`routeTree.gen.ts`, the PWA scripts (`grok-pwa-*.mjs`), `vite.config.ts`,
Tailwind, TanStack Start, Better Auth, PGLite. **None of it is the game.**

Personal bests can stay if he wants them — they are already mirrored to
`localStorage` (`loadBests`/`saveBests` in `ChompGame.tsx`), so drop the server
half and keep the local half. No sign-in, ever.

---

## The transition — his actual worry, and the answer

> "we just have to make sure the transition between the other stuff doesn't
> like, lag into this part or something."

He is right to worry, and the number is **7.18 MB of media**:

| file | size |
|---|---|
| `dancer-club.mp4` | 2.39 MB |
| `dancer-stage.mp4` | 1.67 MB |
| `dancer-spin.mp4` | 1.36 MB |
| `dancer-club.jpg` | 0.46 MB |
| `dancer-stage.jpg` | 0.44 MB |
| `dancer-spin.jpg` | 0.39 MB |
| `skull-close.jpg` | 0.47 MB |

On top of that, FETCH at the ending is holding a full Three.js scene, ~261
linked shader programs and every district's geometry. Starting a video-backed
rhythm game *inside that process* is the worst version of this.

**The recommended shape is: a separate page, warmed early.**

1. **The coda is its own page** — `qualiacology.com/fetch/ending/` (or a route
   the site already understands). Navigating to it drops the entire Three.js
   scene, every program and every texture, in one go. There is no perf
   interaction between the two games at all, because they never coexist.
2. **FETCH warms the cache during its final act.** Kick off the media fetches
   when the player enters the last act — not at the cut. By the time the ending
   plays out, the browser has them and the navigation is instant. This is the
   same discipline as round ten's first-draw warm pass: *pay the cost while the
   player is busy, never at the seam.*
3. **Poster-first inside the coda.** The four jpgs are 1.76 MB against the
   videos' 5.42 MB. `<video poster>` shows the still the moment the page opens
   and swaps to motion when it is buffered, so the coda is never blank.
4. **Re-encode before shipping.** Nothing here has been measured yet — the mp4
   headers did not yield duration or resolution to a hand parser. If these are
   1080p loops of a few seconds, they can very likely be cut by more than half
   with no visible loss. **Measure first.** This is the single biggest lever on
   his stated worry and it costs nothing but an encode.

### Alternative if he wants it seamless with no page load

Same-page, but tear the Three.js world down first: dispose the renderer,
release every geometry and material, drop the scene, *then* build the coda into
the same canvas host. Riskier — FETCH's disposal path has never been exercised
because the game has never needed to stop — and it buys only the page load,
which the warm-fetch already makes cheap. **Do not do this first.**

---

## Two laws to raise with him before building

Neither is a blocker. Both are his call, and he should make it knowingly.

1. **"One ending"** (AGENTS.md). A rhythm game after the ending is either a
   violation or a coda, depending on how it is framed. Its own title is *The
   True Ending*, which reads as him deliberately extending the fiction rather
   than forgetting the law. Worth one sentence of confirmation.
2. **"NO HUD, no on-screen text in play."** A DDR game is *made of* HUD —
   score, combo, grade, judgement text. The sane reading is that FETCH's laws
   govern FETCH, and the coda is a different game with its own idiom. But the
   seam between them will feel wrong if the coda's UI is a different visual
   language than everything before it, so the HUD should be dressed in FETCH's
   palette and type, not the scaffold's Tailwind defaults.

---

## Order of work

1. Measure the videos (duration, resolution, bitrate) and re-encode. **First,
   because it changes every number below it.**
2. Stand the coda up as a standalone vanilla page and get it playing — no
   FETCH involvement at all. This is a self-contained deliverable and he can
   test it on its own.
3. Wire the ending: the warm fetch in the final act, then the hand-off.
4. Gate it: a boot check like the site's `fetch-boot-check.mjs`, plus a
   transition check that asserts the media is warm before the seam.
