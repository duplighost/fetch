# FETCH — session handoff (2026-08-07)

## ⭑ PLAYTHROUGH COMPLETE — all 23 beats green (2026-08-07)

The simulated player finishes the ENTIRE game through real inputs: wake →
key/tree → house → Resident → basement → graveyard → forest → rope → arena
(3 staggered waves, real fight) → Kneeler → waterfall (skull gone) → bridge →
cave → hatch → mirror room → walls close to 0.37m → catch-click → gasp → end.

Balance/correctness fixes the playtest forced (all in-game, all load-bearing):
post-hit iframes 0.6s (stun exists; quiet play possible), staggered arena
spawns + pending-counter (kills the wave-gate race that spawned 'phantoms'),
company cap 2, Standing Kind territory leash 24m, spawn storey hints,
forest mouth release + along-preserving wall slide, cave spine clamp
(replaced elbow-pinching box walls), camera.updateMatrixWorld before the
interact raycast (sim-mode staleness).

## Where things stand (older notes below still accurate)

- Game is fully built: all 7 acts, skull verb kit, enemies, director, mirror
  finale, idea-bank adoption pass (mimic-step, Standing Kind, dropcloths,
  crib mobile, Approach lag finale, void-call, gasp ending). Design + triage
  in docs/DESIGN.md.
- Gates:
  - `node tests/smoke.mjs` — GREEN (acts, budgets, zero errors, per-act shots
    in tests/shots/*.png — canvas-read, NOT page.screenshot).
  - `node tests/autotest.mjs` — GREEN 23/23 (feel laws, fetch chain, stun/pop).
  - `node tests/playthrough.mjs` — **17/23** and one blocker from done.
    PASSES through arena-survived (waves 3, guard 59, no deaths).
    FAILING: reached-the-clearing — the walk from forest path-end into the
    clearing stalls (act stays 'forest'); everything after cascades from it.

## Next action (was mid-probe when session paused)

Probe the forest→clearing seam: teleport forest, set `__FETCH`/`__game`:
`f._lastIdx = f.length - 6`, place player at `f.posAt(f.length - 3)`, walk +z
toward `game.clearingCenter` with a per-step trace of pos + groundHeightAt +
whether `forest.clampPlayer` repositioned. Suspects: clampPlayer jurisdiction
bail margin (halfW+3) vs the gap between path end and clearing bowl; or a
terrain-height seam swallowing the walker. Fix, then rerun playthrough.

## Hard-won environment facts

- Playthrough gate MUST run muted (`?test=1&mute=1`): native WebAudio under
  arena load (scream + 12 enemy loops) wedges headless Chrome with ~0 CPU.
  Real browsers are unaffected; audio verified live in the pane.
- No mid-run canvas snapshots in long headless runs (earlier wedge class).
- page.screenshot composites the WebGL canvas BLACK headless — always read
  canvas.toDataURL (smoke.mjs does this).
- Server: `node serve.mjs 8711`. Debug: `window.__FETCH` (+ `__game`).
  stepWith(seconds, controls, render=false) for sim-only stepping.
- Three transposed-collider-arg bugs were fixed in world.js (V-wall/sill/door);
  scratch-vector aliasing bug fixed in skull.js (_checkTargets uses W pool).

## After the blocker falls

1. Rerun all three gates green.
2. Restore a couple of playthrough beat screenshots via SHORT sessions
   (teleport + snap immediately — long-run snaps wedge).
3. Final report to Alex with shots; consider qualiacology hub deploy next
   session (memory: any site change reads AGENTS.md first).
