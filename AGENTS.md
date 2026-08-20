# AGENTS.md — how to work on FETCH

Read this before changing anything. It is the playbook for every AI working
this repo (Claude Code, Codex/Sol, anything else). Trust it over your own
assumptions. Keep it true: if you change the workflow, update this file in
the same commit.

## Where things are (read this before you go looking)

- **`main` is the game.** It holds exactly what is live at
  https://qualiacology.com/fetch/ . If you clone this repo and run it, that is
  the real thing. (This was not true until 2026-08-19: main had been frozen on
  the 0.6.1 "first light" build since 2026-08-11 while nine rounds of work
  happened on branches. If you are reading an old note that says otherwise,
  the note is stale.)
- **Nothing in this repo deploys.** There is no CI here and no Netlify or
  Vercel config. The live site is a SEPARATE repository,
  `duplighost/qualiacology`, which keeps its own copy of this `src/` under
  `fetch/`. Shipping = copy the changed `src/` files into that repo (LF
  endings), verify all 22 identical, then follow ITS `AGENTS.md`. Never try to
  deploy from here.
- **The `claude/*` and `codex/*` branches are history, not choices.** Each is
  one finished round, stacked on the one before. They are kept so the record
  survives; you do not need any of them. Older round PRs were closed as
  superseded once main caught up — closed, not deleted.
- **Work in a fresh `git worktree`, never in a shared checkout.**
  `C:\Users\Alex\Projects\fetch-claude` is stale and shared; do not use it.
- **When Alex says "fetch," read `docs/ROUND-FOURTEEN.md` first and follow it.**
  It carries what is still open, what needs his answer rather than more work,
  the measured gate baseline, and the traps. `docs/ROUND-THIRTEEN.md` is the
  newest record — what round thirteen did, in numbers, with the brief it was
  built from kept underneath. His own words on the live build
  (`docs/HIS-NOTES-2026-08-19.md`) outrank every brief in this repo, and every
  item in them was answered by round thirteen. The older round records carry
  what was measured, what was wrong, and what is still open; each brief
  supersedes this line when a new round starts — update this pointer in the same
  commit that adds the next brief.

## What this is

FETCH — first-person browser horror. You wake holding a skull you cannot get
rid of; thrown, it comes back. It is the key, the weapon, the only light, and
the threat radar. Route: bedroom → house → basement → graveyard → sealing
forest → waterfall (it doesn't come back — the one broken promise) → cave →
shrinking mirror room (the reflection wears it). Design spine: docs/DESIGN.md.
Owner: Alex (alexdguitar@gmail.com). His word beats this file; this file
beats your instincts.

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
4. **Never hue-only meaning.** Threat/state = brightness, motion, shape,
   timing, sound. (Time-stop = you hurt it.) **NOT because Alex is colorblind
   — he is not, and he corrected that directly on 2026-08-18; older notes
   across these docs still get it wrong.** The law stands on its own: these are
   dark rooms lit by one carried light, so hue is the channel the game itself
   destroys. Value, shape and motion are what survive a lantern.
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

Plus the focused regressions the rounds left behind — warm-start, basin-shore,
choir-surfacing, district-culling, render-perf, grip-contact, grave-arena,
**`tests/coda-seam-regression.mjs`** (the hand-off to the coda at `ending/`), and
**`tests/legibility-regression.mjs`**, which asks the question the other gates
cannot: not "did it work" but "could it be seen or heard".

Environment traps (hard-won — do not relearn):
- **Never edit a src file while a gate is running.** The dev server reads from
  disk on every request; a half-finished edit is a syntax error in somebody's
  page and a red gate you will spend twenty minutes explaining.
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
  Alex's playtest punch list = the current work queue. `docs/HANDOFF.md` —
  session diary.

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
