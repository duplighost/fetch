# AGENTS.md — how to work on FETCH

Read this before changing anything. It is the playbook for every AI working
this repo (Claude Code, Codex/Sol, anything else). Trust it over your own
assumptions. Keep it true: if you change the workflow, update this file in
the same commit.

## What this is

FETCH — first-person browser horror. You wake holding a skull you cannot get
rid of; thrown, it comes back. It is the key, the weapon, the only light, and
the threat radar. Route: bedroom → house → basement → graveyard → physical
under-yard ossuary → sealing forest → waterfall (it doesn't come back — the
one broken promise) → Underfalls → shrinking mirror room (the reflection wears
it). Design spine: docs/DESIGN.md.
Owner: Alex (alexdguitar@gmail.com). His word beats this file; this file
beats your instincts.

## Active 2026-08-10 polish candidate

The current integration candidate is the isolated worktree
`C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-polish-20260810` on
branch `codex/fetch-polish-20260810`, based on
`c6b486e723f1f265d6aecb3d7ee7c52f454e957e`. It is an implemented, uncommitted
candidate under final QA. It is **not** the canonical source release, a package,
a preview, or production. Production remains the separately verified
`0.5.0-intruder` site copy until the complete release chain finishes.

For responsibilities, do not duplicate prose across files:

- `docs/WALKTHROUGH.md` owns the exact spoiler route and optionality.
- `docs/STATE-OF-PLAY.md` owns the compact implementation/release boundary.
- The newest `docs/HANDOFF.md` section owns commands, evidence, identities, and
  remaining release work.
- `docs/PLAYTEST-1.md` owns Alex's human-readability reports and their status.

## The laws (violating these is a regression, not a style choice)

1. **The throw grammar is sacred.** Press LMB = throw. HOLD = it stays out
   (flies to your aim, then treads air, facing you). RELEASE = it zips home.
   Tap RMB / E = call (backup). No charge meter. The button is the tether.
   FEEL_PROFILE at the top of src/skull.js is the law; return legs NEVER
   decelerate on approach; clocks are monotonic; recall is duration-only.
2. **Flawless handling.** No input lag, no random refusal, no terror-adaptive
   controls, no control theft — ever, including the ending.
3. **NO HUD.** No words or meters on screen during active play. State lives in
   the skull (jaw chatter = proximity, grown eyes track threats), in audio, in
   light. Text belongs only to non-playing overlays: title, pause, and retry.
4. **Never hue-only meaning.** Alex is colorblind. Threat/state = brightness,
   motion, shape, timing, sound. (Time-stop = you hurt it.)
5. **Audio-first horror.** HRTF spatial. You hear things before you see them.
   Enemies own a sound before they own a mesh.
6. **Quiet vs loud is the economy.** Stun is quiet and temporary; popping is
   loud and permanent and invites company. Post-hit iframes (0.6s) are what
   make the quiet option exist — do not remove them.
7. **Growth is never witnessed.** The skull gains its face off-screen only.
8. **One ending.** The oasis is sincere. Do not foreshadow the twist.

## Gates — all four must be green before any merge

```sh
node tests/autotest.mjs      # 24 named checks (feel laws, fetch chain, stun/pop)
node tests/regressions.mjs   # release invariants, checkpoints, progression, finale
node tests/smoke.mjs         # per-act boot, budgets, screenshots
node tests/playthrough.mjs   # plays the ENTIRE game via real inputs (10+ min)
```

Current baseline cardinalities are `autotest` **24**, `regressions` **50**,
`smoke` **eight acts**, and `playthrough` **38 milestones**. A count is not a
pass: the frozen source must complete each command with zero browser errors.

The 2026-08-10 polish candidate also changes causal readability, physical
traversal, reflection/context recovery, and first-use GPU behavior. Run these
focused gates before the four canonical gates; do not substitute them for the
full playthrough:

```sh
node tests/house-critical-path-regression.mjs    # 21 route/crawler/error checks
node tests/basement-causality-regression.mjs     # 16 visible-causality/error checks
node tests/backhalf-traversal-polish.mjs         # physical ossuary, 3-knot chain, Kneeler, 8 stones
node tests/underfalls-wayfinding-regression.mjs  # 19 shell/route/hatch/error checks
node tests/pause-title-regression.mjs             # 25 pause/title/pointer-lock checks
node tests/window-relay-lifecycle-regression.mjs  # 10 relay lifecycle checks
node tests/dead-flight-interaction-regression.mjs # 6 dead-state interaction checks
node tests/mirror-failure-regression.mjs          # 6 fail-closed/recovery checks
node tests/flame-transfer-perf-regression.mjs     # normal/restored guest + pilot paths
node tests/audio-startup-regression.mjs           # live WebAudio Wake slicing/idempotence/teardown
node tests/transition-warmup-regression.mjs       # D3D11 first-use/context-loss matrix
node tests/render-perf.mjs                        # real GPU render budgets
node tests/district-culling-regression.mjs        # district ownership/draw budget
```

The flame-transfer, audio-startup, transition, render-performance, and
district-culling gates are real-browser/GPU evidence. Run browser/GPU gates
serially on system Chrome with D3D11, close every test-owned browser, and record
the final counts from the frozen source. Historical green JSON or screenshots
from an earlier working edit do not certify the release candidate.

Environment traps (hard-won — do not relearn):
- The playthrough runs muted (`?test=1&mute=1`); native WebAudio wedges
  headless Chrome under arena load. Real browsers are unaffected.
- `page.screenshot` composites the WebGL canvas BLACK headless — read
  `canvas.toDataURL` instead. No mid-run snapshots in long sim runs.
- Tests run on real GPU (system Chrome, `--use-angle=d3d11`), never swiftshader.
- Sim-only stepping never renders: call `camera.updateMatrixWorld()` before
  any raycast you add (already done in `_crosshairTarget`).
- Serve: `node serve.mjs 8711`. Debug: `window.__FETCH` (step/stepWith/state/
  teleport/setSkull/setStage); `?test=1` stops self-stepping.

## Map

- `src/skull.js` — the skull: throw/return law, growth stages, threat gaze.
- `src/main.js` — boot, input, fixed-step loop (1/120), debug API, autotest.
- `src/player.js` — controller (capsule-vs-AABB, stairs as ground height).
- `src/world.js` — house compiler (rooms/doors/colliders from tables), Door.
- `src/house.js` — Acts 0–2 tables + furnishing + act props.
- `src/outside.js` — graveyard, spline forest + seal, clearing, cave entrance.
- `src/underfalls.js` — the skull-less waterfall undercroft and cave route.
- `src/enemies.js` — walkers / Resident / Kneeler / Standing Kind.
- `src/director.js` — acts, beats (dt-driven, no setTimeout), scares, arena.
- `src/finale.js` — mirror room, closing walls, the reflection.
- `src/mirrors.js` — pooled planar reflections (ported from THE LAG).
- `src/audio.js` — all-procedural WebAudio engine (HRTF, beds, one-shots).
- `src/textures.js` — procedural material kit. `src/util.js` — RNG/math.
- `docs/DESIGN.md` — the spine + idea-bank triage. `docs/PLAYTEST-1.md` —
  Alex's human playtest ledger. `docs/WALKTHROUGH.md` — spoiler route and
  optionality. `docs/HANDOFF.md` — release evidence and session diary.

## Cloud agents & the gates

The four gates need Alex's machine: a real GPU (system Chrome, d3d11 ANGLE —
never swiftshader) and playwright-core resolved from a local npx cache. If you
are running in a cloud sandbox (Codex/Sol): you cannot run them, and that's
expected. Instead: (1) `node --check` every file you touched, (2) keep changes
inside your lane, (3) say plainly in the PR body that gates weren't run and
why. The reviewing agent on Alex's machine runs all four gates against your
branch before merge — a PR is not mergeable until someone has. Never weaken,
skip, or edit the gates themselves to get green.

## Team protocol

- `main` is canonical. Anything non-trivial: branch + PR, gates green, then
  merge. Two agents must never edit the same files concurrently — check
  `git status`/open PRs first; if the tree has changes you didn't make, STOP.
- **Lanes.** The feel core (skull.js throw law, main.js input grammar,
  FEEL_PROFILE values) changes only with Alex's explicit direction — it is
  calibrated against his hands. Open lanes for parallel work (PLAYTEST-1
  Phase 2): furniture/prop overhaul (port uninvited/blackthorn kits), skull
  resculpt, player hands, walker resculpt, window-aim affordance, textures.
  Claim a lane in your PR title.
- **Deploying is a separate repo.** The live game is a shelled COPY at
  `fetch/` inside the qualiacology site repo, which has its own AGENTS.md
  (read it; its rules differ). Sync flow: land here on main with green gates
  → copy `src/` and any referenced runtime `assets/` (+ `index.html` if
  changed, keeping the site shell: meta, favicon, home pill) into the site repo
  → push there. Never deploy from this repo; never edit the site copy
  directly except to sync.
- Commit identity: the repo default (Alex's). Tag your model in the commit
  body (`Co-Authored-By:`) so history stays legible across the team.
