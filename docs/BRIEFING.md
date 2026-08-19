# FETCH — Full briefing for any new collaborator (AI or otherwise)

You are looking at the complete source of FETCH, a first-person browser horror
game by Alex (game designer, qualiacology.com). This document is everything you
need to contribute with zero other context. Read it before touching anything.

## What the game is

You wake in a locked bedroom holding a cursed skull. You cannot get rid of it:
thrown, it zips back to your hand like a boomerang. It is your only tool —
it fetches keys in its teeth, stuns the things in the house (quiet) or pops
them (loud — the house hears), latches ropes to launch you. It is also your
carried light source and your threat radar: its jaw chatters faster as danger
closes, and the eyes it grows track what's hunting you.

Route: locked bedroom → the house (find keys, reach the ground floor) →
boarded cellar door → basement → hatch → graveyard backyard → a forest that
seals behind you (one-way) → a beautiful waterfall clearing where you throw
the skull through the falls and IT DOES NOT COME BACK (the game's one broken
promise) → a rock bridge rises → candlelit cave → a room like your bedroom
whose walls become mirrors and close in — your reflection has the skull for
a head. One ending. The skull grows a face stage by stage (0 = bare bone …
5 = full head) across the acts.

The full beat-by-beat state of every act: `docs/WALKTHROUGH.md`.
The design spine + idea triage: `docs/DESIGN.md`.
Known issues / active work: `docs/PLAYTEST-1.md`, `docs/PLAYTEST-2.md`.

## The laws (violating these gets your work rejected)

1. **Throw grammar (Alex-defined, sacred):** press LMB = throw (no charge-up).
   HOLD the button = the skull stays out — flies to where you aim, then treads
   air facing you. RELEASE = it snaps home. Duration-only recall. Never change
   this without Alex's direct instruction.
2. **FEEL_PROFILE in `skull.js` is frozen** — exponential velocity-bend
   return, never decelerates on approach, monotonic clocks. It is the ported
   feel of Alex's kick-ball game and it is the law.
3. **NO HUD, no on-screen words.** State lives in the world: the skull's face,
   the jaw chatter, light, sound. (Alex's UI philosophy.)
4. **The value law** (long mis-called the "colorblind law"): **Alex is NOT
   colorblind — he corrected that on 2026-08-18.** The law is unchanged and it
   is load-bearing, it just has a truer reason: this game is dark rooms lit by
   one carried light, which is the thing that destroys hue. Never encode
   meaning in hue alone —
   use shape, brightness, motion, timing.
5. **No control theft.** The game never takes the camera or moves the player.
6. **Sounds come from things** — especially the skull. Spatialized (HRTF),
   not abstract UI noises.
7. **Copy is Alex's voice.** Never invent taglines or flavor text.

## Run it

- `node serve.mjs 8711` in the repo root, then http://localhost:8711/
  (any static server works; no build step — ES modules + vendored Three.js
  r161 via importmap).
- Controls: WASD + mouse, LMB throw (hold/release per the grammar), E interact,
  Space jump, Shift run.
- URL flags: `?skull=a|b|c|d` (skull sculpt variants), `?mute=1` (no audio init),
  `?test=1` (harness mode, no self-stepping), `?autotest=1` (in-page suite).

## Architecture map (src/)

- `main.js` — boot, fixed-timestep loop (1/120), input edges, debug API.
- `skull.js` — THE file: FEEL_PROFILE, throw/outbound/poised/return state
  machine, viewmodel (hands + hold), face stages, jaw/eye life, fetch targets.
- `skull-variant-a.js` / `-b.js` — swappable skull sculpts (see contract below).
- `player.js` — capsule movement, collision, footsteps, noise level.
- `world.js` — static geometry merger, colliders, `Door` class (knob/lock
  language), windows, interact registry, fetch-target registry, lights.
- `house.js` — the manor: `HOUSE_TABLES` (rooms/doors/windows as cell tables,
  cell size 2m; world x = cellx*2-12, world z = cellz*2-14), furniture kit,
  act scripting for bedroom/house/basement, cellar boards, hatch.
- `outside.js` — graveyard, sealing forest (spline corridor), waterfall
  clearing, rope launch, cave.
- `enemies.js` — walkers / kneelers / the Resident; states dormant → stalk →
  wind → chase; stun/pop via skull hits (0.6s iframes); Standing Kind move
  only while unobserved.
- `director.js` — act state machine, spawns, scares, checkpoints, mimic echo.
- `finale.js` + `mirrors.js` — the closing mirror room (pooled planar
  reflections, reflection lag).
- `audio.js` — procedural WebAudio, HRTF panners, threat scoring with a
  rear-danger term, skull chatter radar.
- `textures.js` — canvas-painted materials. `util.js` — clamp/lerp/damp.

## Debug + tests (gates — ALL must be green before merging anything)

- `window.__FETCH` in-page: `{ start, step(dt,n,render), stepWith(seconds,
  controls,render), state(), teleport(act), setSkull(mode), setStage(n),
  shot() }`.
- `node tests/autotest.mjs` — 23 named checks (feel laws included).
- `node tests/smoke.mjs` — acts, budgets, screenshots.
- `node tests/playthrough.mjs` — plays the ENTIRE game via real inputs.
  Headless notes: system Chrome with `--use-angle=d3d11` (never swiftshader);
  screenshots must read `canvas.toDataURL` (page.screenshot composites black);
  always run muted (`?mute=1`) — native WebAudio wedges headless Chrome.

## Team + workflow

- Alex is the designer. His word beats this document.
- Claude Code (Anthropic) and Sol (GPT-5.6, Codex) each work on their OWN
  clone/branch, land via PR to github.com/duplighost/fetch, gates green first.
  One agent per working tree, ever. `AGENTS.md` at repo root is the playbook.
- GPT-5.6 Pro instances work as COURIERS: no repo access. Alex hands them this
  bundle; they hand back complete files; whoever has a bench mounts them.

### Courier contract (for Pro instances)

- Return WHOLE files, not diffs, plainly named (e.g. `skull-variant-c.js`).
- A skull sculpt exports `buildSkullMesh(boneMaterial)` returning
  `{ root, jaw, jawMount, sockets, eyeL, eyeR, stageSets }` where `stageSets`
  is an array [1..5] of mesh-arrays revealed per face stage, `jaw` is the
  mandible group hinged at its pivot, `jawMount` is where carried keys clamp,
  `eyeL/eyeR` are eye pivots (rotate to aim). Triangle budget: throw if the
  total exceeds 9000. Pure Three.js r161 core, no external assets, one
  material family derived from the passed bone material.
- Other lanes: state the contract you're honoring in a comment at the top of
  the file. If you're inventing a new module, define its exports and where it
  mounts, and keep it self-contained.
- NEVER touch: FEEL_PROFILE, the throw grammar, main.js's loop, the laws.

### Open lanes right now (pick from PLAYTEST-2.md)

Walker/enemy body resculpt (visual, high value), skull sculpt round 3,
furniture-vs-openings audit, nursery mobile telegraphing (design first),
window-puzzle prototypes (after Alex's designs), audio texture passes.
Claude has already SHIPPED (2026-08-08, on main): viewmodel composition, door
language, cellar-board staging, reported furniture fixes, Resident
pathfinding. Don't redo those — build on them.

## Live deployment

The game is live at https://qualiacology.com/fetch/ (hub: game #38). Deploys
happen by syncing this repo into the qualiacology site repo — that step is
Claude's or Alex's; couriers and Sol never deploy.
