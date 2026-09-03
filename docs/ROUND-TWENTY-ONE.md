# ROUND TWENTY-ONE — say "fetch" and start here

**Read this before `ROUND-TWENTY.md`.** Twenty and nineteen describe code that
is no longer in the game. They are the record of what was tried; this doc is
what is actually on the site.

Alex, 2026-09-03: *"is there anyway to revert the game fetch to before it got
messed up?"* — and then, on which build broke it: *"one was codex and one was
claude code fixing things id seen in codex. but both added problems."*

So the game went back to the last build before Codex touched it: **`e166da4`,
2026-08-20, "the locket hangs below the leaves"** — the round fifteen build.
Asked whether the four still-good fixes should be carried forward, he chose
**clean revert only**. They were not carried forward. That was deliberate.

## What the revert is

Thirteen files. `src/`, `index.html` and `tests/` back to `e166da4` in the game
repo; `fetch/src/` and `fetch/index.html` back to `fdac77a` on the site, plus
`build/qa/fetch-boot-check.mjs`, which Codex had rewritten along with the game.

No files were added or removed anywhere in the reverted span, so it is a
straight restore, not a reconstruction.

Two things did NOT go back, on purpose:

- **The og:image fix** (`a9efbf2`, #142). Reverting `index.html` wholesale would
  have restored a URL that is genuinely dead — `assets/games/fetch-card-keyart-5ab7c65b.webp`
  is not in the repo — and re-broken every link preview. Those three meta tags
  were restored by hand.
- **`docs/` and `tools/`.** The docs are the record. The probes are diagnostics
  no gate runs.

**`index.html` and `main.js` had to move together.** The Codex-era title ships
the Wake up button `disabled` and only the newer `main.js` re-enables it via
`_markBootReady`. Reverting one without the other is a hard softlock on the
title screen. Both went back, and the reverted pair has neither half. If you
ever revert this game again, check that pair first.

## Gates on this build

Green, measured on system Chrome and the real GPU:

| Gate | Result |
|---|---|
| `tests/autotest.mjs` | 26/26, 0 browser errors |
| `tests/regressions.mjs` | 157/157, 0 skipped |
| `tests/smoke.mjs` | ALL PASS, 8 acts |
| `tests/playthrough.mjs` | 81/81 beats, reaches the ending |
| `build/qa/fetch-boot-check.mjs` | 10/10, world on screen 123 ms |

**Expected red, do not chase:** `tests/underfalls-expansion.mjs` is 16/18. Both
reds are test-side, not product. Round eighteen did not fix them — Codex edited
the test to arm the falls (`0809c23`, a five-line hunk), which moved the reds
without touching the game. `ROUND-TWENTY.md` records this wrongly; it is wrong.

**Dead probes.** Four of the r18–r20 diagnostics in `tools/` call APIs this
revert deleted: `probe-round18-horror` (entirely dead), `probe-grave-passenger`,
`probe-mire-rail`, and `probe-house-echo`. The last one is the trap — it fails
*silently*, reporting `indoors: false` forever instead of throwing. Do not read
a green from it.

## What this build does NOT have, and what that costs

Four fixes went with the revert. Three were measured failing on this build.
They are **not** Codex regressions — they are older bugs that rounds nineteen
and twenty had fixed, and the revert brings them back. Alex knows and chose it.
Do not "discover" them as new:

1. **Pausing does not suspend the AudioContext.** The watchdog resumes a context
   the game deliberately suspended. Not audible — the master ramp still silences
   a pause — but every pause burns phantom `resumes`, the exact field to read
   back when the cave ringing recurs. ~8 lines to re-apply.
2. **The mire has no hazard rail.** Alex asked for this on 2026-09-01 in his own
   words. The pit is pre-Codex; only the fix was new.
3. **The house keeps its own dead.** A Resident and a walker can survive the walk
   out to the graveyard still inside the house, still holding the full presence
   floor. This is Alex's 2026-09-01 "an enemy that looks like it is still in the
   house making sounds when you get to the graveyard." ~20 lines.
4. **The mixer is half-blind again.** `_bus` one-shots are uncounted and
   uncapped; `voiceStats()` loses `worstReduction` and `stormSeconds`.

**The cave ringing is still open.** It always was — it is older than Codex, and
the revert does not fix it. If it recurs, ask for `__game.audio.voiceStats()`
first, and know that it is now measuring roughly half the game's one-shots.

## The one measurement that argues for the revert

On the live Codex build the Wake up press was held **13.7 seconds** before the
world appeared. On this build the press enters in well under a millisecond and
the world is on screen in ~104–123 ms.

## Where to pick up

He has not played this build yet. Wait for his report — his reports beat every
instrument here, and the recurring failure mode in this game is
working-but-illegible, not broken. See `FETCH legibility law` in memory.

If he wants any of the four fixes above back, they are small, localized
forward-ports. They do not depend on any Codex work.
