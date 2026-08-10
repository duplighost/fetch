# FETCH — current state of play, 2026-08-10 bell/pilot/intruder recovery

> **CURRENT SOURCE AND PRODUCTION TRUTH; DEPLOYED.** Alex's live
> `0.4.0-ossuary` playtest found that the human house route was unclear and
> could strand a player below the house without a legible flame. The current
> release repairs that route, adds the exact scullery-window intrusion requested,
> adds authoritative pause/checkpoint restart, and replaces the title/catalog
> art. Source PR #17 merged as
> `d66c4a682b21f02fefa6eaaaf6e2ffaa10ab406d`; Qualiacology PR #35 merged as
> `77c24f86abc1074d71d802172021df67167a0175`; Netlify production deploy
> `6a79a4b384c0e400081ad376` published `0.5.0-intruder` on
> `2026-08-10T10:15:22.317Z`.

The repaired house dependency is a partial order:

```text
bedroom key + nursery key
  -> servant bell and three cellar boards (either order once downstairs)
servant bell
  -> optional early upstairs flame
servant bell + all boards
  -> cellar -> alternate basement-pilot flame + pump
either flame + latched pump
  -> incinerator refusal -> ash key -> hatch
```

The primary bell is now one visible ordinary outbound throw. The exterior held-
trolley return is a valid advanced alternate. Either flame source produces the
same required `ateFlame` state and disables the other. The tiny scullery window
owns a watched crawler, but that scare does not gate escape; close approach
makes every visible stage recoil/dissolve before player overlap. Escape/P freeze
simulation and WebAudio; a clickable icon is shown only when pointer lock is
unavailable, and Restart from Checkpoint preserves solved flags. The forest arena is honestly optional because reaching the clearing
cancels it; the graveyard resolution and ossuary are not optional.

Frozen-source evidence for this revision is complete: 67/67 syntax, focused
house **21/21**, pause/title **25/25**, all 23 formal browser/simulation modules,
canonical **24/24 + 50/50 + eight-act smoke + 38/38 playthrough**, and zero
browser errors. The reproducible 25-entry standalone ZIP is 578,074 bytes at
SHA-256 `71521a2bff1f9290cd1cb39034b22e1171d786cd28993e60ae44c15ed3e89db3`;
its unique clean extraction exact-matches current shipping source and boots with
the decoded title art, while integrity negatives pass 7/7. Source
[PR #17](https://github.com/duplighost/fetch/pull/17) and Qualiacology
[PR #35](https://github.com/duplighost/qualiacology/pull/35) are merged; preview
and production each passed **29/29 + 5/5** checks with zero browser errors.
The public route is `https://qualiacology.com/fetch/`. Its 66,346-byte title and
card masters exact-match SHA-256
`5AB7C65B0E3ECC50D96454EE5F3393284D02D521ED7F1AF2DCFC2691B1CFF998`
and return `public,max-age=31536000,immutable`; mutable `/fetch/` and
`/fetch/src/main.js` return `public,max-age=0,must-revalidate`.

For the exact required-versus-optional route, use the current
`docs/WALKTHROUGH.md`. For release status and evidence, use only the newest
section of `docs/HANDOFF.md`.

---

# FETCH — state of play, 2026-08-10 masterpiece integration (HISTORICAL OSSUARY RELEASE)

> **HISTORICAL OSSUARY RELEASE TRUTH; PACKAGED AND DEPLOYED.** Integration work was on the
> isolated branch `codex/fetch-masterpiece-2026-08-09`, started from `ea414a8`, in
> `C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-masterpiece-dev`.
> The shipping-source integration is commit `c8a50c2`.
> A deterministic standalone ZIP has passed clean-extraction verification; the
> exact artifact identity appears below. Site PR #34 merged as `dc8555a`, and
> `https://qualiacology.com/fetch/` was independently verified serving
> `0.4.0-ossuary` after the production deployment.
> Read the newest section of `docs/HANDOFF.md` for the feature/evidence ledger
> and `docs/WALKTHROUGH.md` for the exact spoiler route. Everything below the
> horizontal rule that closes this current section is retained historical
> forensics, not an active queue.

## What the game is now

FETCH remains a first-person browser-horror game whose entire relationship with
the player is one cursed skull: weapon, fetcher, remote light, threat radar,
counterweight, rope bite, and eventual absence. The game still teaches through
play and never inserts a separate tutorial or playable cutscene.

The current critical path is:

```text
bedroom key
  -> nursery key
  -> living-window mooring / study-window return bell
  -> upstairs flame
  -> cellar boards
  -> pump-gallery hold-and-cross
  -> incinerator refusal / hatch key
  -> grave ritual or three-wave clear
  -> required mausoleum ossuary / counterweight / far hatch
  -> two-fork sealing forest / tree / mire-rope / arena / Kneeler
  -> waterfall sacrifice
  -> Underfalls and Drowned Choir
  -> closing mirror room and terminal shutdown
```

The new house dependency is intentionally strict:

`windowRelaySolved + ateFlame + pumpGalleryLatched`
`→ fireRefused → gotHatchKey → hatchUnlocked → hatchOpen`

The new graveyard dependency is also strict:

`graveyardResolved (ritual or loud) → ossuaryOpened`
`→ uninterrupted counterweight → ossuaryCleared → forest checkpoint`

The forest gate no longer opens directly when combat or ritual resolves. The
mausoleum floor opens first; the counterweight at the end of the under-yard
route opens both the physical surface gate and the far hatch.

## Non-negotiable laws still in force

1. Press LMB throws immediately; holding keeps the skull out and steerable;
   releasing recalls it. RMB or E is the backup call when E is not using a
   nearby world interaction.
2. `FEEL_PROFILE` remains frozen.
3. No HUD instructions, solution text, forced camera, or control theft.
4. Required reads cannot depend on hue. Use value, silhouette, motion, timing,
   spatial structure, and sound together.
5. Audio must originate from the thing and world position that caused it.
6. The waterfall is the one authored broken promise: after that throw, the
   skull does not return.
7. A gameplay-looking object needs a behavior, a causal dependency read, or a
   clearly environmental role. Do not add decorative fake controls.
8. Do not erase the established game to install an expansion. Extend the same
   input grammar, geography, checkpoints, and consequences.

## Current subsystem ownership

| File | Current responsibility |
|---|---|
| `src/main.js` | fixed-step input, focus safety, throw/use dispatch, shader warm-up, bounded gore, scene lifecycle, ending shutdown |
| `src/house.js` | opening key locks, nursery, window relay/visitor, return horror, lag mirror, flame, cellar, pump gallery, incinerator, hatch |
| `src/outside.js` | grave arena props, destructible/resonant graves, gate and ossuary, forked forest, story objects, fallen tree, mire/ropes, clearing |
| `src/director.js` | act/checkpoint ownership, quiet/loud grave resolution, wave lifecycle, company debt, respawn grace, cave ecology |
| `src/enemies.js` | Resident/walkers/Kneeler/Standing Kind, bounded strike claims, stains, Drowned Choir navigation and fixed-point pressure |
| `src/underfalls.js` | one route union for floor, clamp, cover/LOS, main path, dry-return shortcut, spray, hatch |
| `src/finale.js` / `src/mirrors.js` | articulated human reflection, exact selected skull clone, closing-room contact, pooled planar mirrors |
| `src/audio.js` | procedural positional audio, 24 kHz interactive-context fallback, forest story prewarm/voice cap, finite loop cleanup |
| `src/atmosphere.js` | progression-neutral dressing and act-local visibility for house/outdoor/cave compositions |

## The old THIN and queue claims are superseded

| Historical claim below | Current truth |
|---|---|
| Guest/ground-floor rooms are purposeless | Required two-window relay, causal window visitor, delayed house mirror, flame room, and deterministic return route use them. |
| Basement is one straight key fetch | Relay-earned flame plus mandatory pump hold/cross power the incinerator refusal that reveals the hatch key. |
| Graveyard is a zero-puzzle traverse | It has a ritual-versus-loud resolution, 4/5/6 arena waves, three resonant graves, six destructible hero graves, and a required ossuary counterweight route. |
| Forest still needs wandering paths and localized objects | Two physical braids commit at six metres; eight world-anchored HRTF objects, two rope pockets, landmark chapters, and cumulative seals form the path system. |
| The pre-rope edge is a map hole | It is a visible depth-driven mire; the rope arrests sinking and preserves held/release control. |
| Cave is a short candle tunnel | Underfalls is a 125.158 m, 13-node district with a real shortcut, multi-height sluice, spray ecology, and a routed Drowned Choir. |
| Finale fades around a mannequin | Props crush inward, hands/glass/fractures make contact physical, and an articulated human reflection wears the exact opening skull before hard black. |
| Retry effects can grow forever | Gore, stains, grave debris, fork closures, candles, enemy geometry, and reflection targets are fixed pools/shared kits or otherwise bounded. |

The old queue is obsolete and this integration is locally verified, packaged,
recorded on its integration branch, merged into the canonical site repository,
and verified on production. Those facts do not pre-judge Alex's next live
playtest or turn it into permission for an unrelated parallel expansion.

## Donor provenance

Marrow, The Eaten Path, and Still were audited directly in both local source and
runtime. The current implementation is a synthesis:

- The Eaten Path supplied forest-graph and localized-object grammar. Its bog is
  not true sinking; FETCH's mire is new.
- Marrow supplied forest landmark and crypt/baffle grammar. Its gravestones are
  not destructible; FETCH's tactical stones are new.
- Still supplied observation/light/noise house-horror grammar. It does not have
  FETCH's literal window-climbing visitor; none of the three donor games does.

Do not call these ports or copied areas. No donor map, asset set, puzzle, or plot
was lifted whole. Continue to mine Alex's library, but mutate every useful idea
through FETCH's skull verb and narrative logic.

## Local and artifact verification complete; release-state gates remain

Final-source evidence is green: forest nervous system **9/9** (repeated);
forest hardening **4/4**; district culling **12/12** (newest sampled maximum
**420 draws** under the 450-draw ceiling; far-hatch forest **330**; exact
restoration difference `[]`); Choir routing **6/6**; Underfalls **13/13**;
horror expansion **16/16**; house return **12/12**; basement **8/8**; pump
recovery **10/10**; stain pool **5/5**; Standing Kind **2/2**; and all house-
expansion and performance-pool checks. Failure-state regression is **20/20**,
including the resonant-return guard. Canonical `autotest` is **24/24**,
canonical `regressions` is **50/50**, all eight per-act `smoke` cases are green,
and two consecutive real-input full `playthrough` runs completed **38/38** beats
with zero failures. System-Chrome/ANGLE-D3D11 `render-perf` is green, and final
grave-body, exterior, grave-arena, and district checks are green.

The standalone package is also verified:

1. `fetch-netlify-2026-08-09-ossuary.zip` contains 24 root-relative shipping
   files and is 495,884 bytes.
2. Two packer runs matched byte-for-byte at SHA-256
   `e4edf64544352dd2d5d8760388c74102e66fc803bbcc0be07007bd89a95c73aa`.
3. A unique clean extraction booted through system Chrome/ANGLE-D3D11 with zero
   browser errors; release-integrity rejection cases passed **5/5**.

Production deployment is complete through Qualiacology PR #34: site sync
`ad6a126`, merge `dc8555a`, and live `0.4.0-ossuary` verification on the public
FETCH route. The existing site shell and cache rules were preserved, and only
the eleven semantic runtime changes shipped. Older hashes, PRs, and "live"
notes below belong to historical snapshots.

---

# FETCH — state of play, for a new model with zero context

> **HISTORICAL FORENSIC SNAPSHOT — NOT CURRENT RELEASE TRUTH.** This file
> records the pre-Underfalls investigation and retains old diagnoses/backlog for
> provenance. Some later sections deliberately describe bugs or deployment
> states that have since changed. Read `AGENTS.md` for current laws/workflow,
> then the newest section of `docs/HANDOFF.md` for current code, gates, shipped
> features, and remaining risk. Verify `origin/main` and production rather than
> treating an uncrossed item below as live.

**Read in this order:** `docs/BRIEFING.md` (what the game is + the sacred laws)
→ `AGENTS.md` (team playbook, gates, lanes) → `docs/DESIGN.md` (the authored
spine, beats verbatim from Alex) → newest `docs/HANDOFF.md` section (current
release truth) → **this file** (historical diagnoses and idea provenance).

This document is written for GPT-5.6 joining a project that has been built by
several models in sequence. It is deliberately blunt about what does not work.

---

## 1. The shape of the thing

FETCH is a first-person browser horror game. ~16,000 lines of hand-written
JavaScript, no build step, no asset pipeline, no dependencies except a vendored
Three.js r161. **Every texture in the game is painted in code onto a canvas at
boot** (`src/textures.js`). There are no image files.

Route: locked bedroom → house → basement → graveyard → a forest that seals
behind you → waterfall clearing (you throw the skull through the falls and it
does not come back — the game's one broken promise) → cave → a shrinking
mirror room where your reflection wears the skull.

The skull does four jobs at once, and that overlap is the whole design:
it is your **weapon**, your **key-fetcher**, your **threat radar** (the jaw
chatters as things close), and **your only light**. Throwing it sends your
light away. Every mechanic has to pay that tax or it isn't a FETCH mechanic.

### The laws you cannot break

Full list in `docs/BRIEFING.md`. The four that get work rejected most often:

1. **Throw grammar is sacred.** press = throw, HOLD = it stays out, RELEASE =
   it zips home. No charge mechanic. Alex defined this by hand.
2. **`FEEL_PROFILE` in `skull.js` is frozen.** Ported from Alex's kick-ball.
3. **Alex is colourblind.** No read may depend on hue — brightness, shape,
   motion, timing only. This has been violated twice by previous contributors
   (see §5) and both times it shipped and both times it was invisible to him.
4. **No HUD, no on-screen words, and no control theft.** State lives in the
   world. The game never takes the camera or moves the player. (This one was
   also being violated — see §5, the rope.)

---

## 2. Two repos. Do not confuse them.

| | |
|---|---|
| **Game** | `C:\Users\Alex\Projects\fetch-claude` → `github.com/duplighost/fetch` |
| **Site** | `C:\Users\Alex\Projects\qualiacology` → `github.com/duplighost/qualiacology` |

The live game at **qualiacology.com/fetch/** is a *shelled copy* living at
`fetch/` inside the site repo. **Never deploy from the game repo.** Flow:

```
land on game main with the canonical gates and release regressions green
  -> copy src/ into the site repo's fetch/src/
  -> branch, PR, inspect the Netlify deploy preview
  -> merge ONLY with Alex's explicit approval (merging = production, ~1 min)
```

`C:\Users\Alex\Projects\fetch` is a *third* checkout — the original dev folder,
used by a different agent. Work in `fetch-claude`.

---

## 3. Running and proving it

```sh
node serve.mjs 8711          # then http://localhost:8711/
```

**The three canonical merge gates, plus the release regression catalog.** All
must be green before this release lands.

```sh
node tests/smoke.mjs         # boots every act, asserts budgets, zero console errors
node tests/autotest.mjs      # 24 named checks incl. the feel laws
node tests/regressions.mjs   # current catalog: 50 irreversible-state traps
node tests/playthrough.mjs   # plays the WHOLE game through the real input path
```

`playthrough.mjs` is the completability gate and the most valuable thing in the
repo. It has caught every serious regression. It must run muted
(`?test=1&mute=1`) — native WebAudio wedges headless Chrome at the arena.

**Debug hooks:** `window.__FETCH` — `{ step, stepWith, state, teleport(act),
setSkull, setStage, shot }`, plus `window.__game`. `?test=1` stops
self-stepping. `?autotest=1` runs the in-page suite. `?skull=<a|b|c|d|e>`
selects a sculpt variant.

**`stepWith(seconds, controls)` — note the argument order.** Controls are
`{ moveX, moveZ, run, lookX, lookY, throwPressed, throwHeld, throwReleased,
interactPressed, jumpPressed }`. Movement is `moveZ`, not `forward`. Getting
this wrong silently produces a player who never moves, and every measurement
you take afterwards is a lie. It cost this session two wrong conclusions.

**Tools** (all write PNGs you should actually open and look at):

| tool | what it answers |
|---|---|
| `tools/shot-areas.mjs` | four views of every act in one pass |
| `tools/shot-forest.mjs` | walk in, look back at the seal, look straight up |
| `tools/shot-held.mjs` | the in-game held-skull composition |
| `tools/render-sculpt.mjs` | the skull-off shot set for any sculpt module |
| `tools/probe-bounds.mjs` | walk out of every act 12 ways; did you fall out? |
| `tools/probe-ravine.mjs` | walk into the ravine on purpose; what happens? |
| `tools/audit-furnishings.mjs` | static furnishing-vs-openings checker |

**Screenshot trap:** `page.screenshot` composites the WebGL canvas BLACK in
headless. Read `canvas.toDataURL` instead. Every tool above already does.

---

## 4. Module map

| file | owns |
|---|---|
| `main.js` | boot, fixed-timestep loop (1/120), input, the material grade pass, teleport, debug contract |
| `skull.js` | the skull: throw / return / fetch / latch / grow. `FEEL_PROFILE` is here and is frozen |
| `player.js` | movement, capsule-vs-AABB collision, and the rope swing |
| `world.js` | static geometry, colliders, zones, surfaces, lights, candle pool |
| `house.js` | the whole house — compiled from `HOUSE_TABLES` (rooms/ramps/holes), furnishings, door grammar |
| `outside.js` | graveyard, the forest spline corridor, clearing, and the waterfall exterior |
| `underfalls.js` | the expanded skull-less cave district, route, chamber shell, spray zones, and hatch |
| `atmosphere.js` | a *decorative-only* dressing layer. Owns no progression, no colliders, no audio. Can be removed without changing a single gameplay result |
| `director.js` | acts, beats, fog/ambient per act, death and respawn, enemy direction |
| `enemies.js` | the Resident, walkers, the Kneeler, Standing Kind, and Drowned Choir |
| `finale.js` / `mirrors.js` | the mirror room; pooled planar reflections ported from Alex's THE LAG |
| `audio.js` | HRTF-spatialised synthesis. No audio files |
| `textures.js` | every texture, painted on canvas at boot |

Sculpt variants `skull-variant-{a,b,c,d,e}.js` are alternative skull meshes.
**`e` is the shipping default.** `?skull=v0` retains the old courier for comparison.

---

## 5. Historical bug ledger — statuses below are superseded

He played the deployed build and reported this list. Status is honest: some are
fixed, most are not.

> **"i fall into infinite abyss in the place before the rope and respawn walking through trees."**

**FIXED** (commit e0503a8). Reproduced with `tools/probe-ravine.mjs`. Death in
the ravine fired fine; *respawn* was the bug. It put the player at the forest
gate while `Forest` still believed they were at s=64 — **60 metres off the
trail** — with the seal frontier parked at s=94.9, ninety metres ahead. Ground
height, the corridor clamp and the wall of trees were all being computed for
somewhere the player was not. Two causes: `Forest.project()` only cold-scanned
when its warm-start index sat at an *end* of the spline, so any stale
mid-spline index returned garbage; and nothing re-seated forest state on a
position the player was *put* at rather than walked to. Added `Forest.reseat()`
and made the cold-scan unconditional on implausibility. After: respawn lands at
s=2, 0.34m off centre. **Alex should re-test — his "infinite abyss" may be a
second, separate hole I have not reproduced.**

> **"the car still looks like not a car."**

**NOT FIXED.** `src/outside.js` `buildGraveyard`, ~line 127. It is a box, a
smaller box, and three cylinders. Needs a real derelict sedan built from the
primitive kit: greenhouse, wheel arches, flat tyres, door seams, sprung hood,
rust. Alex has flagged this twice ("not even half passing").

> **"the basement way out has the lock. but needs a way to look like you actually activate it after to leave the basement."**

**NOT FIXED.** The hatch unlocks but nothing *reads* as having changed. Needs
the padlock to visibly fall/hang open, the chain to slacken, and the hatch to
shift — state told through the world, per the no-HUD law.

> **"the basement still has that empty room."**

**NOT FIXED.** `HOUSE_TABLES.rooms` in `house.js` defines four basement rooms:
`bcorr`, `storeroom`, `boiler`, `crawl`. `crawl` is designed but unused — there
is a whole authored proposal for it in `docs/PLAYTEST-3.md` (the throw-your-
light beat: something stalks the light's shadow). Alex has asked for that room
to be used. Confirm with him *which* room he means before building.

> **"the skull still looks like the old version."**

**NOT A BUG — a visibility problem, and my fault for not making it obvious.**
The new sculpt is live but mounted as a *variant*: **qualiacology.com/fetch/?skull=e**.
The default is deliberately unchanged until Alex approves the new one in game.
He cannot approve what he never sees. Either tell him the URL or promote `e` to
default — his call, one line in `skull.js` `_buildMesh`.

> **"walking down the basement steps still brings you through a piece of wood."**
> **"the steps let you go through them sideways."**

**NOT FIXED, and these are the same class of bug.** The cellar stairs are a
`ramp` from `HOUSE_TABLES.ramps` (`{x0:10,x1:11,z0:8,z1:9,axis:'z',y0:0,y1:-3.0}`)
plus a hand-built under-stair skirt at `house.js` ~line 575. A ramp is walkable
*everywhere inside its x/z rect* and has no side walls, so you can walk in from
the side and clip the skirt boxes. Needs proper side colliders down both edges
of the flight and the skirt geometry moved clear of the walking surface.
**Engine law worth knowing before you touch this: never wall or fill *under* a
ramp — the corridor beneath the cellar flight is real walkway and the basement
spawn is in it. A previous "fix" bricked the spawn and the playthrough gate
caught it.**

> **"what does that lamp that lights up on the stair way from the second floor through the jump door even do?"**

**NOT DIAGNOSED.** I could not identify it from a grep of `house.js` in the
time available. It is probably a candle-pool light or an atmosphere emissive
that reads as interactive but is not. Two acceptable outcomes: give it a
purpose, or remove it. A light that looks like it does something and does
nothing is worse than no light — it teaches the player that the game lies.

---

## 6. Other known problems, not on Alex's list

- **The skull's growth stages 2–5 are the weakest art in the game.** Stage 5 is
  a Muppet. Three passes have improved it; it still needs a rethink rather than
  another patch. See `scratch-sculpts/VERDICT-realism-round.md`.
- **The carried light casts no shadow.** Measured: enabling `castShadow` on
  `skullLight` takes the forest from 126 to 821 draw calls, through the 700
  gate, because a PointLight shadow is six cube faces against everything
  `world.box` already flags as a caster. The cheap version is a one-face
  SpotLight riding the skull, or a small proxy caster set.
- **`tools/probe-bounds.mjs` only produces movement in the first act it tries.**
  A separate diagnostic proves movement works in all five, so this is a harness
  bug, not a game bug. It means the bounds of forest/clearing/cave/mirror are
  **not yet verified**. The graveyard is verified closed.
- **The clearing is the emptiest place in the game.** The cave is, surprisingly,
  the best-looking.

---

## 7. What changed most recently, and why it mattered

**The back half had no darkness.** This was the root cause behind Alex's
"everything after the house is graphics poor". Three separate small things:

1. The material grade pass in `main.js` stopped at the front door — it tints
   ten materials and missed `dirt`, `grass` and `bark`, the three that own most
   of every post-house frame. Ungraded, they came out **brighter than the light
   the player carries**. The forest floor was outshining the skull.
2. Ambient 0.95 + hemisphere 0.75 were tuned for the house interior and carried
   outdoors unchanged. Now act-keyed (`AMBIENT_BY_ACT` in `director.js`).
3. `world.freezeMoonShadow()` switched `renderer.shadowMap.autoUpdate` off
   **globally, at boot, from the bedroom** — baking the house's shadow map
   forever so nothing later in the game could cast a shadow at all. It now
   freezes the moon light only.

**Both colourblind violations, found and fixed.** `atmosphere.js` had shipped
an instanced mesh named, in the source, `'cyan-value forest understory'`, and a
`'cyan cave mica trail'` whose own comment described it as a wayfinding read.
Both were hue carrying meaning. The mica now **grows and brightens** toward the
exit instead.

**The rope became a verb** (branch `rope-as-a-verb`, four gates green, **not yet
deployed**). It was a cutscene: `launchTo()` zeroed your fall, took your input
for up to three seconds and walked your position along a straight line to a
hardcoded landing pad — a straight violation of the no-control-theft law. Now
the bite does a **lossless grab**: your incoming speed is rotated onto the
tangent of the sphere around the anchor and handed back. Nothing is subtracted.
Hold and it pulls at 30 m/s² against gravity's 14; release and you keep the
entire arc. The ordinary integration and collision run underneath the whole
time, so you are never inside geometry and never not driving.

---

## 8. Historical plan, condensed

Seven steps, ordered so each makes the next cheaper and the game is shippable
after every one. Steps 1 and 2 are done.

1. ~~Value grade + act-keyed ambient + real shadow capability~~ **DONE**
2. ~~Latch as a verb: velocity-space pull + lossless grab~~ **DONE, undeployed**
3. **Draw the tether.** The game's central metaphor — you and the skull, joined
   — is currently invisible. One draw call. Also fixes the dead composition of
   every forest frame: a taut bright line gives the eye a diagonal.
4. **Reusable line anchors + the canopy chain.** A second rope is not "more
   traversal"; a rope you can *link* is. Chaining is where traversal stops
   being a set-piece.
5. **Canopy of gaps + a ground that is the ground.** The treeline is the
   biggest silhouette in the act and has no leaf edge.
6. **Air.** Moon shafts and a dust field that brightens toward the skull.
   FETCH's outdoors have air in exactly one place — 90 static motes.
7. **Make the clearing worth arriving at.** It is the emotional pivot the
   waterfall gut-punch is built on, and it is the most diorama-like place here.

### Six traversal verbs, all built from press / hold / release

No new input, no changed feel constant, and each one **costs you your light**,
because that tension is the game.

1. **THE PULL** (graveyard) — throw up out of an open grave, bite a root across
   the mouth, get hauled out. Installs the grammar.
2. **THE SWING** (forest, ravine) — the verb Alex already loves, made lossless.
3. **THE CHAIN** (forest canopy) — release at the forward end of the arc and
   press again into the next bough. The first verb that is a *route*.
4. **THE STRIKE** (the Kneeler) — release on the far side of a thing, and the
   skull's line home passes through it. The release becomes a weapon, and it is
   the same release it has always been.
5. **THE REEL** (clearing) — hold and the rope shortens, carrying you up the
   cliff beside the falls.
6. **THE THROW YOU DON'T GET BACK** (the waterfall) — same three inputs, one
   last time. The pull begins exactly as it has five times before. And then
   there is no arrival, no skull, no light coming back. The game teaches a verb
   for an entire act so it can break the contract once.

---

## 9. Historical backlog Alex was carrying in his head

His instinct was right: *"there are probably many ideas in old threads too we
never got to that i said"* and *"probably many glitches that i mentioned that
haven't been fixed."* I went and read the old transcripts. He is right on both
counts, and some of these he has now raised **three separate times**.

**The single most important pattern in this project: when Alex repeats himself,
it is because we did not do it the first time.** Treat a repeat as a priority
signal, not as new information.

### Asked for repeatedly, not built in this historical snapshot

| | times asked | status |
|---|---|---|
| **Window puzzles** — throw the skull out one window and have it come back in another, by angle or by moving | **3×** — first playtest, again in PLAYTEST-3 ("there still is no window puzzle i guess?"), again today | **never built.** A proposal sits in `docs/PLAYTEST-3.md`. His original words: *"if there were puzzles where it had to go out one window and come in another by some kind of angle or player movement, it would be cool"* |
| **The unreachable stairway door / lamp** | **2×** — *"Does that door on the stair way thats just out of reach ever get used? it looks cool."* and today: *"what does that lamp that lights up on the stair way from the second floor through the jump door even do?"* | **never given a purpose.** It reads as interactive and is not. Either use it or remove it — a thing that looks meaningful and is not teaches the player the game lies |
| **Basement stairs clip through wood / walk through them sideways** | **2×** | **still broken.** Same root cause: a ramp is walkable everywhere in its x/z rect and has no side walls |
| **Reuse the traversal verbs after teaching them** | today | *"there is no reason not to use the fun mechanics like the rope swing once the player learns them... if the player has to traverse through the woods on those things"* — this is exactly the canopy-chain lane in §8, and his saying it unprompted is the strongest possible endorsement of it |
| **A leading pass** — *"things can very visually lead the player in an intuitive way"* | 2× | parked, never done |

### Raised that day, outstanding in this historical snapshot

- **The graveyard battle is bad.** *"right now the graveyard is a lame battle that doesnt feel good or look good."* Combat feel plus staging, not just dressing.
- **The house should be much bigger.** *"this spooky home needs to be more gigantic."* `HOUSE_TABLES.rooms` in `house.js` is a compact grid — the house compiles from a table, so growing it is data, not code. That is the cheap way in.
- **The car** (see §5).
- **The hatch needs to look activated** (see §5).
- **The empty basement room** (see §5).
- **The incinerator beat is illegible.** *"the burning sound leading to the
  change of the skull. it needs to be more clear whats happening."* This is the
  best-written moment in the game and it does not read. The intent: you offer
  the skull to the fire, **the fire tries and the fire loses**, the hatch key is
  left in the ash, and later the skull steals the guest-room flame and gains
  ember sockets. Right now it is a sound and then a different skull. It lives in
  `house.js` (`incin` / `skullOffered`, ~line 1238) and the ember sockets are in
  the `guestFlame` `onHit` (~line 1435). Needs the fire visibly straining and
  failing, the skull visibly unharmed and *changed*, and a beat of silence in
  between so cause and effect are separable. **No HUD, no text** — this has to
  be told in light, sound and the object itself.

- **A hole at the waterfall.** *"it seems like there is a spot at the waterfall
  where you can just fall into nothing even before the water."* Not reproduced
  yet. `terrainHeightFn` in `outside.js` has several stacked special cases
  around the clearing — a cave-floor rectangle, the plunge-basin cone, the
  moving bridge stones — and the **order they are tested in** decides which one
  wins. A gap between two of those regions is the obvious suspect. There is a
  death catch at `g.act === 'clearing' && pos.y < -1.5` in `director.js`, so if
  he is falling and *not* dying, he is probably outside the clearing act at that
  moment, which narrows it further. Hunt it with a variant of
  `tools/probe-bounds.mjs` seeded around the basin rim.
- **The waterfall clearing should be the best place in the game.** *"that
  waterfall area should be beautiful. a whole area to explore."* Right now it is
  the emptiest. It is also the emotional pivot the whole broken-promise beat is
  built on — `docs/DESIGN.md` calls it *"the first place that doesn't want you
  dead"*. This is plan step 7 and it deserves more than dressing: somewhere to
  go, something to find, a reason to stay before the game takes the skull.
- **The scream is lame.** Alex's words. It is in `audio.js`, which synthesises
  everything — no audio files anywhere — so this is a synthesis problem, not an
  asset swap. `behind-you` is the donor to raid: HRTF spatial audio is that
  game's entire mechanic.
- **Textures flashing.** *"some of those glitchy textures that we caught
  flashing."* Almost certainly z-fighting: coplanar or near-coplanar surfaces
  with no depth separation. Prime suspects are the places where this codebase
  stacks flat geometry at nearly the same height — the two forest ground ribbons
  (`outside.js`, y = 0 and y = 0.03), the graveyard ground strips against the
  displaced plane (`outside.js` `buildGraveyard`), the roof/floor slabs in
  `house.js`, and the wide under-floor plane at y = −0.35. It was seen and never
  chased down. Fix by separating the offending pairs in y, or by giving the
  upper surface `polygonOffset`. **Find it by looking, not by reasoning** —
  `tools/shot-areas.mjs` from several positions per act.
- **The wide open basement room.** Raised twice now, alongside *"the basement
  still has that empty room."* `HOUSE_TABLES.rooms` gives the basement `bcorr`,
  `storeroom`, `boiler` and `crawl`; `crawl` has an authored proposal in
  `docs/PLAYTEST-3.md` that has never been built. **Ask him which room he means
  before building** — he has described it as both empty and as useful, and those
  point at different rooms.

### Older, then unverified against that snapshot

From his first playtest, none confirmed fixed:
- *"The sound can get absolutely wrecked sometimes when the skull gets stuck on stuff and hits stuff before it comes back... maxing out and then cutting and coming back."* An audio voice-stealing / gain-stacking bug. **Nobody has ever gone and looked.**
- Keys hovering rather than attached to the thing they hang from ("the key is hovering and not on a branch", "the second key doesn't look like its actually attached to that baby thing").
- *"It should be very obvious when it has the key in its mouth. And obvious when it connects with the key."*
- Enemy pathfinding too weak to make closing a door a real obstacle.

### Where the source material lives

The mining corpus is at
`%TEMP%/claude/.../scratchpad/alex-said/` — `idea-dump.txt` (a 40k-character
brainstorm pile Alex pasted in, pre-sorted by another model, containing far more
than has been built), `opening-brief.txt` (how he described the game before it
existed — worth reading for tone), `live-feedback.txt`, `context-summary.txt`.
Regenerate by extracting `role: 'user'` text blocks from the FETCH session
transcripts in `C:\Users\Alex\.claude\projects\C--Users-Alex--claude\*.jsonl`.

---

## 10. Fixed during this session, for the record

- **Ravine respawn** (§5). Stale spline projection; see `Forest.reseat`.
- **The forest log.** Alex: *"the big log in the forest that doesn't do anything
  except stop you, and then make a sound when you hit it to let you through, but
  doesn't animate, and doesn't look like it should stop you."* It was a bare
  1.1m cylinder with a **1.6m-tall invisible wall** in front of it, and its three
  hits were instant 5-degree snaps. Now a real trunk with a root plate and
  snapped limbs, a collider matched to its actual silhouette, and a dt-driven
  roll that settles instead of snapping.
- **Getting stuck in the forest.** Alex: *"the forest is easy to get stuck in
  and not be able to go anywhere."* Reproduced with `tools/probe-stuck.mjs`,
  which walks the corridor while steering down the trail and reports every place
  the player stops moving. It pinned at the same spot on **every run**.
  The cause was the fallen log. Its collider was a single axis-aligned box —
  and the log lies **diagonally** across the trail, at about 37° here. The tight
  AABB around a 7.4m diagonal log is roughly **six by seven metres**: it spans
  the entire 3m corridor *and* three and a half metres of its length, so you are
  stopped dead that far short of a log you can plainly see, with no way round
  it. Now a stepped row of nine short boxes along the log's own axis — same
  wall, a tenth of the footprint. After: no pins on any run.
  **The general lesson, and it almost certainly bites elsewhere: this engine has
  only axis-aligned colliders, and anything placed at an angle to the world axes
  gets a hitbox far larger than it looks.** Grep for `addCollider` beside
  anything rotated.
  Two smaller repairs found on the way, both real but neither the culprit: the
  corridor's wall-slide rebuilt the player's position from the *rounded* sample
  while measuring their lateral offset from the *fractional* foot of the
  projection — two different frames — and `Forest.recentre()` now puts a
  respawned player back on the trail rather than only fixing what the forest
  believes.
- **The forest was too dark** after the first darkness pass — his words, *"the
  woods is a little dark to see now"*. Forest ambient 0.40 → 0.54 and the
  carried light 50/10.5m → 58/11.5m. Note the shape of that fix: when it is too
  dark, raise the thing in the player's hands *along with* the floor, never
  instead of it.

---

## 11. Alex already built most of what this game needs. Go and take it.

**This is the instruction he repeats most often and the one every model has
under-used.** In his words: *"we have other games we have put on the website
with so many things that could go in haunted houses if that is easier than
making new things. we have made a lot"* — and again today: *"we have to
emphasize to look at all the other games i already have. so much of that could
be usable. specifically the horror ones i have and the ones with the kick ball
mechanics."*

Nothing in FETCH has to be invented from nothing. The strongest work in this
repo so far has all been portage, and the weakest has all been things somebody
wrote fresh. `docs/analysis/donor-inventory.json` maps stealable systems across
every one of his games; `docs/analysis/eaten-path.json` is a worked example of a
deep port, and everything FETCH's forest does well came out of it.

His games live in `C:\Users\Alex\Projects\`. The ones that matter here:

**The kick-ball family — the throw itself.**
`kick-ball` is where FETCH's `FEEL_PROFILE` came from and it is the reference
for how the throw should feel; he has said outright that its impact language
is better than FETCH's (*"The whole throw system and impact doesn't feel quite
right. that other game i had with the kick ball had it so well"*). `fetch`'s own
feel is a reskin of it. Re-read it whenever the throw feels off.

**The horror family — look, dread, and enclosed space.**
- `uninvited` — first-person horror; FETCH already borrows its house compiler
  and capsule collision. It has far more house furniture than FETCH uses.
- `blackthorn-manor` — a 3D haunted house. Rooms, props, mystery staging.
- `marrow` — a graveyard descent. **Directly adjacent to FETCH's weakest act.**
- `chamber` — a first-person thriller; beat scripting that is dt-driven, no
  `setTimeout` anywhere. FETCH's beat law came from here.
- `eaten-path` — the sealing forest. Already partly ported; more remains.
- `hall-of-mirrors` (THE LAG) — pooled planar reflections; the mirror room
  borrows them.
- `behind-you` — HRTF spatial audio as the entire mechanic. FETCH's threat math
  came from here and its audio could take much more.
- `the-lonely-haunter`, `eaten-path`, `wick`, `goodfire`, `cinderbloom` — more
  environment and atmosphere technique than FETCH currently uses anywhere.

**The traversal family — for the verbs in §8.**
`rocket-shoes` (grind rails, dash), `filament` (grind + glide), `lift`
(one-input pendulum climber), `reliquary` (committed arcs, chain-of-sockets).

Rule of thumb before writing any new system: **grep his other games for it
first.** If two of them already do it, port the better one.

---

## 12. How to work here

- **Alex plays live and deploys constantly.** Small change → four gates →
  deploy. He forgives rough; he does not forgive broken.
- **Look at the screenshots.** Every wrong conclusion in this project has come
  from reasoning about the game instead of opening a PNG of it. The harness
  lighting in `render-sculpt.mjs` is much more flattering than the game's —
  always confirm with `shot-held.mjs` or `shot-areas.mjs`.
- **Do not weaken a gate to make a change pass.** If a test asserts an
  implementation detail you legitimately removed, update it to assert the new
  mechanism and keep every behavioural assertion. Say that you did.
- **Copy is Alex's voice.** Never write taglines or flavour text.

---

## 12b. Verify what is shipped; this checkout is shared

Do not infer production state from an old hash, this document, or whichever
branch happens to be checked out. The source of truth for development is
`origin/main`. The live game is a separately shelled copy under `fetch/` in the
Qualiacology repository, so a source merge and a website sync are two distinct
events. The newest entry in `docs/HANDOFF.md` records the release candidate and
its verification evidence; production is current only after the matching site
PR is merged and `https://qualiacology.com/fetch/` is boot-checked.

The Opus 5 foundation, forest rope verb, collision/respawn corrections, and
darkness pass were merged before the Underfalls expansion began. Do not revive
the former warning that those fixes are stranded on `rope-as-a-verb`; that was
true only before the foundation PR landed.

`C:\Users\Alex\Projects\fetch-claude` is a shared working checkout. Before any
branch change, inspect `git status`, active PRs, and current collaborators. Never
discard or overwrite unfamiliar changes. If a clean baseline is needed while
another agent is working, create a separate worktree from `origin/main`.

---

## 13. Historical mined backlog — 44 candidates from the old source

Every one of these came out of Alex's own messages in the old FETCH threads,
and each was then checked against the current code before being listed. His
quote sits on every entry because his words are the specification.

### Ideas not built in the historical source audited here

#### One real puzzle that isn't a key — put it in front of him  *(whole-game)*

> i will also get very into helping design the puzzles and combat. i have just seen none of that yet.

He is right that there is nothing to react to. The whole puzzle surface is 16 addFetchTarget registrations (12 house.js, 3 outside.js, 1 world.js) and 15 of them are single-step 'hit this thing'; the only spatial one is the bedroom locket (house.js:937-958), where a hand-placed collider forces you to throw, HOLD and steer round the boughs. Build ONE non-key puzzle in the `crawl` basement room — it is already compiled with two ajar doors (house.js:36, :60-61) and furnish() puts nothing in it: from basementAct (house.js:1121) register a target reachable only by throwing the skull down the crawl and holding it there as your light while you walk the dark behind it. Smallest build that shows him a puzzle that is not a key. Also raise with him rather than fixing silently: main.js:422 prints `'It kept you.'` on the end card — model-authored on-screen words, against the no-words law and against his voice.

#### Killing is free in the house — and the scream arena only happens once  *(whole-game)*

> if you do that, its loud and you get rushed by a lot more in round of combat

Two halves of his combat economy, both cheap. (1) The two-tier kill is exactly his (enemies.js:484-524 stun then a deliberate second throw; _pop at :553-579 is a real burst with gore, a permanent stain and the corpse launched along the throw) but Director.onPop (director.js:636-651) only spawns company in the FOREST and caps it at two ever, plus one wakeAll in the graveyard. In the house and basement a pop summons nothing — the act that teaches you the skull is a weapon is the one act where violence costs nothing. Add a house/basement branch calling residentHeard(1) and spawning a walker at a _bestDoorNode-reachable spot (~10 lines, S). (2) He said the arena happens 'at certain points in the game' — plural. audio.skullScream (audio.js:1032) has exactly one call site and _startArena (director.js:457) is only reachable from _updateForestBeats (:453); the graveyard, his other open area, gets three walkers total (:153-161). Extract director.js:457-509 into startArena(center, waves, radius) and fire a second from _enterGraveyard (:148) — the wave logic, silence payoff and checkpoint are already act-agnostic; only f.posAt/arenaS are forest-specific (M).

#### There is no wake — you start standing in the middle of the floor  *(bedroom)*

> The player wakes up holding onto this skull.

startGame (main.js:307-312) hides the title, fades in over 2.4s and starts the director; SPAWNS.bedroom (director.js:9) drops you standing mid-room facing the window while the bed is across the room at house.js:624. So the cold open he wrote — wake already cursed, no explanation — is currently 'a fade-in while standing up'. Move the spawn to the bed's edge (~x 9.9, z 3.35, facing the window), lengthen the opening fadeIn to ~4s slow so the first thing that resolves out of black is your own hands and the skull at sitting-eye height, and put two wrong things in the room per DESIGN.md:55, which the bedroom currently has none of: the door boarded/latched on YOUR side, and the covers thrown back from a body that isn't there. The room is furnished (house.js:620-632) but nothing in it is wrong.

#### The cave never seals behind you  *(cave)*

> it turns to rock behind you after you walk in.

Three of his four cave beats are built: the rock bridge rises one stone at a time on the throw (director.js:557-563, outside.js:911-919), candles light the tunnel and chamber because you are empty-handed (outside.js:1023, :1062), and the ceiling hatch with its forgiving reach-post ends the act (outside.js:1064-1077). The seal is missing entirely — grep for seal in outside.js returns only the forest tree-seal machinery, and waterfallTaken (director.js:548-565) COLLAPSES the mouth barrier open (g.bridgeBarrier.max.y = min.y), with respawn re-collapsing it (:627). Nothing ever closes the way back. Add a scoped after() in waterfallTaken that restores g.waterfallBarrier.max.y once the player's z passes clearingCenter.z + 21, plus a small instanced rock plug and the stoneGrind that already exists. Small change, and it is the cave's entire premise.

#### Give the skull more to do — knockables, a second anchor, and LAND THE ROPE  *(whole-game)*

> the skull could be used for a lot.

Merges his founding complaint — 'I just feel like the player should be able to fuck around with something while they're walking through that is fun' — with his ask that the uses keep multiplying. Three moves. (1) Nothing incidental answers a throw: addFetchTarget is called 15 times in the whole game and skull.js:872-896 treats every other collider as a dumb AABB reflector, so between authored targets a throw is one thud and nothing moves. Add world.addKnockable() beside addFetchTarget (world.js:101) — same swept-segment test in _checkTargets, directive 'continue', handler just nudges a mesh (books, the oil lamps at house.js:628/637/662, curtains, gravestones); ~20 of them across house and graveyard. (2) The back half of the game has three uses of the verb total; the cheapest multiplier is a second swing anchor in Forest._buildFlora, copied from outside.js:803-819 (addFetchTarget + skull.anchorAt + player.beginSwing), placed so releasing at the forward end of the arc lands you within reach of the next. (3) URGENT: the rope verb he invented is not deployed — I verified origin/main is at faef4e3 and four commits sit unmerged on branch rope-as-a-verb, including 6920933 'Rope: make the latch a verb instead of a cutscene' plus two forest fixes. Alex has never played it. Also outside.js:806 sets this.enabled = false, so one missed swing kills the rope forever; gate on `if (game.player.swing) return 'return'` instead.

#### The catch is clean — he asked for surreal  *(skull)*

> lands back in your hands in a spooky and surreal way.

The moan half of this beat is fully delivered and is some of the best code in the repo (audio.js:936-986: hollow two-sine voice through a resonant cavity bandpass, breath noise through the sockets, a whoosh that only speaks on fast returns, rising to a scream with tension). The catch is not. _completeCatch (skull.js:820-827) calls holdNow(), which hard-sets root.position.set(0, 0, 0.02) in a single frame, and the entire arrival is one catchThud plus shake(0.1 + impact*0.15). That is a clean catch — the opposite of the ask. In holdNow set this._catchT = 0.28 and seed root.position from the skull's last world position converted into hold space, drive it home in _updateHeld on an overshoot curve, and keep this._grip low in _updateHands for the first ~0.12s so the skull is already in your hands before the fingers close on it. FEEL_PROFILE is untouched — this is presentation after the catch has resolved.

#### Nothing in the house would make you want to quit  *(house)*

> it should be the most horrifying stuff possible that makes you want to quit the game.

The entire house horror engine is director.js:276-312 _updateScares — five randomised AUDIO cues on a 26-46s timer (overhead pacing, knock, whisper, nearest door drifts open, creak). The only two authored, non-random beats are the music box (director.js:332-364) and the Resident (:368-395). The dressing does not carry the tone either: grep house.js for blood/remains/violence/bath/hooks returns nothing — furnish() (house.js:615+) is period furniture, a crib, a rocking chair and two black mirrors. He deliberately left the house beats blank for us to fill and set the bar at quit-but-curious; we filled it with a sound shuffler. Author one fixed, unrepeatable set piece in a room the player must pass through: a new act fn beside nurseryAct (house.js:1016), registered from buildHouse (house.js:538), keyed off room entry rather than the scare timer. _updateScares structurally cannot deliver this — it can only reshuffle sounds.

#### The crashed car is two boxes and the bodies are two capsules each  *(graveyard)*

> a crashed car and several disfigured bodies are in the backyard.

The crossing itself is genuinely built — buildGraveyard (outside.js:46) fences the yard with one gap at FOREST_GATE, 64 instanced headstones, dead trees. The crash is not: outside.js:127-142 is BoxGeometry(1.8,0.8,4.2) + BoxGeometry(1.6,0.55,2.0) + three cylinder wheels, and its only real idea is the dying headlight flicker (:144-151). The bodies (outside.js:153-168) are four groups of one capsule torso plus ONE capsule limb — correctly oriented crawling away from the gate, a good authored idea rendered as two capsules. atmosphere.js contributes nothing here (grep car/wreck/body/corpse → zero). Rebuild the car group in place using the same primitive vocabulary as createFurnitureKit (greenhouse with pillars, wheel arches, one flat/detached tyre, door seams, sprung hood) and move the collider at :143 to match the new silhouette. He has complained about box-props twice; this is the most visible survivor of that complaint.

#### Window puzzles: out one window and back in another  *(house)*

> if there were puzzles where it had to go out one window and come in another

He pitched this himself and repeated it a message later ('window puzzle would be nice too') — the repeat is the signal. It cannot happen today: HOUSE_TABLES.windows (house.js:63-71) has ten windows and I verified exactly one carries open:true (line 69, bedroomWindow). Every other window takes the !open branch at world.js:322 and gets a glass pane plus a collider with no skullPass, which skull.js:873 treats as solid — there is physically no second aperture to come back in through. Add `open: true, w: 1.7` to ['first', 11, 3, 'E'] (guest room, which pairs with the bedroom window around the house's east corner) and register one exterior fetch target positioned so the only line that reaches it is out-A, HOLD, steer, in-B. The poise grammar and the skullPass plumbing already exist; this is table data plus one target. Depends on the window aim read in list B — without it the throw is a coin flip.

#### The oasis is one puddle  *(clearing)*

> You throw it through the waterfall. It doesn't come back.

The broken promise itself is fully and correctly built — the waterfall target returns 'gone' (outside.js:922-929), skull.vanish() removes the root and stops its moan (skull.js:553-558), Director.waterfallTaken comments 'no failsafe fires' (director.js:548-565), respawn deliberately keeps it gone (:622-629), and the wordless gesture is a head-turn toward the falls every 5-9s (_updateGesture, director.js:535-546). What is thin is the place it happens in: he described a forest oasis of waterfalls and streams flowing into one another before a giant fall, and buildClearing (outside.js:824) has exactly one stream plane (:850), one circular pool (:855) and one fall (:877, itself hidden in favour of atmosphere.js's shader veil at :625). Nothing flows into anything; there are no cascades. Add two or three stepped basins above the pool with short spill planes feeding each other, reusing M.water and the existing map.offset.y scroll ticker at :859. Beauty is sincere here and it is what the gut-punch stands on.

#### Zero secret paths exist  *(whole-game)*

> definitely some stunningly cool secretpath ways

The realism half of this ask has had real work (material grade pass in main.js ~205, act-keyed AMBIENT_BY_ACT at director.js:36-42, the eaten-path flora port in outside.js:403+). The secret half was never started. Door.secret exists in world.js:474 with its own slow 0.5-speed reveal at :603-608, but HOUSE_TABLES.doors (house.js:40-63) contains zero secret:true entries, and grep for mausoleum/pantry/streambed/crawlspace across src/ returns nothing despite DESIGN.md:149-153 authoring one per act. Ship exactly one to prove the pattern, with no key and no target — just something to have found. The cheapest hook is marking a door {secret:true} in the table; note the storeroom→crawl door (house.js:58) is the obvious candidate but crawl is also the proposed site for the first real puzzle above, so pick one or use a graveyard mausoleum instead. Related realism gap worth queueing: skullLight is deliberately not a shadow caster (main.js:129-136), which is the single biggest remaining look problem.

#### Bosses: there is no thread to hang by  *(whole-game)*

> you feel like you're always hanging on by a thread.

Never built. Two things are called bosses in DESIGN.md:135,141 and neither is a battle: enemies.js:12-19 gives both resident and kneeler hp: Infinity so they can only be stunned; the Resident's entire boss logic is six lines (_updateResident, director.js:382-389 — if chasing for 9s, go back to stalking) and it is deleted outright on entering the basement (:134-142); the Kneeler spawns dormant (:511-517) and is enemies.clear-ed the moment you reach the clearing (:526-531). Critically there is no player health anywhere in the codebase — contact calls director.death (:582) instantly — so the sustained near-death feel he asked for is not expressible yet. Start with the Kneeler in _updateKneeler (director.js:519): a phase loop whose only opening is its existing 0.4s stun (enemies.js:17), so every throw buys you seconds and costs you your light while it is away. It is already staged in an open, authored spot 93% down the forest spline.

### Bugs still broken in the historical source audited here

#### The skull: wrong sculpt is shipping, and it is too small  *(skull)*

> The skull just looks silly. it doesn't even look like a real skull.

His single biggest complaint, raised twice ('The skull itself looks terrible. no way to even tell its a skill') and it is also what is left of his original ask for an object you hate having to carry. The realistic sculpt already exists and nobody ships it: src/skull-variant-e.js is a genuine answer — one continuous cranio-facial shell from a smooth-union radius field, orbits/nasal aperture/temporal fossae carved as radial pits, cranial landmarks in millimetres, baked crevice occlusion, value-only aging for colourblindness — but I verified skull.js:112-127 _buildMesh only uses a variant when ?skull= names one, and main.js:117 passes Q.get('skull') with no fallback. The default build is still the inline sculpt at skull.js:128-273: a SphereGeometry(0.095) cranium, two 0.028 cheek spheres, two flattened black spheres for sockets, a 4-sided cone nose and box teeth. grep -rn "skull=e" across the repo returns nothing. Fix is one line: `const v = this.variant || 'e';`. His second complaint — 'its not directly facing the player and making eye contact. and it needs to be a bigger skull' — is half fixed: facing is a hard lookAt every frame (skull.js:620-624, 601, 712, 795, deliberate tumble only on the outbound leg), but size was never touched — I verified skull.js:280-281 still reads hold.position.set(0.17,-0.31,-0.7) / hold.scale.setScalar(1.15) from the initial commit, about a fifth of screen height parked low-right. Go to (0.15,-0.28,-0.58) and 1.45 and re-seat the hands at skull.js:364-368. VERIFY WITH `node tools/shot-held.mjs`, not render-sculpt.mjs (STATE-OF-PLAY §11: its lighting flatters) — and in the same shot confirm the rebuilt forearms (skull.js:371-385) still exit the bottom of frame at the larger scale; they are the entire fix for his 'hands making glasses around its eyes' note, which is right in source but has never been checked on screen.

#### Skull audio: the catch and the moan aren't spatialised, and bounces clip then cut out  *(audio)*

> Some of the sounds that the skull makes just don't seem like they're coming from the skull.

Three concrete defects, all small, covering the two most-heard skull sounds — and they explain both of his audio reports. (1) skull.js:825 in _completeCatch calls audio.catchThud({gain, rate}) with NO pos; Audio._bus (audio.js:498-510) only builds the HRTF panner if opts.pos, so the most frequent skull sound in the game plays dry and dead-centre. grab() at skull.js:473 does pass pos, so this is an oversight, not policy. (2) audio.js:936-941 skullMoanStart builds its panner at {x:0,y:1.4,z:0} — world origin — and only skullMoanUpdate glides it to the skull (tau 0.03), so every throw's moan is born at 0,0,0 and takes ~90ms to arrive. Give skullMoanStart(pos) and seed it from skull.js:518. (3) His other report — 'the sound kind of maxing out and then cutting and coming back... when the skull gets stuck on stuff and hits stuff before it comes back' — is a sign bug I confirmed in source: _bounceFx (skull.js:899-915) computes `now = this.flightTime + this.returnTime`, and that clock runs BACKWARDS because tryThrow resets flightTime only (skull.js:504) and beginReturn resets returnTime only (:539). On every throw after the first, `now` drops the instant the skull turns for home, so the cooldown test `now - _lastBounceSfx < 0.1` sees a NEGATIVE difference and mutes every bounce on the return leg until the clock climbs back past the old stamp — literally cutting and coming back. The same flip makes the 0.4s _bounceTimes window never expire, and the pinball early-out is gated `&& this.mode === 'outbound'`, so a skull wedged in geometry on the RETURN has no bail-out and machine-guns audio.thud into a master compressor at threshold -18 / ratio 4 with no voice cap anywhere in _play/_bus — that is the maxing out. Fix: add this._sfxClock, advance it by dt at the top of update() (skull.js:566), use it as `now`, and drop the outbound-only gate. Second suspect for stacking: skullMoanStop (audio.js:988-999) nulls this._moan but leaves the oscillator chain alive 700ms, so a fast catch→rethrow runs two moan chains into the compressor — hold the dying chain in _dyingMoan and hard-stop it at the top of skullMoanStart.

#### The boarded door wears 'openable' hardware and its planks can't be hit  *(house)*

> I got a door open once and i still don't know how it works. it looked like it had some boards behind it.

He is describing the cellar door and he is right on both counts. world.js:498 gates knob creation on `this.locked !== 'never'`, which is TRUE for locked:'boards', while the keyhole escutcheon is only added when locked && locked !== 'boards' — so cellarDoor (house.js:51) wears exactly the hardware the door grammar reserves for 'this will open', and tryUse (world.js:570) can only rattle it. And the planks can genuinely fail to break, which is his follow-up ('the planks are behind it and they just dont break and you cant see them'): house.js:1094-1101 makes each board a BoxGeometry(1.7, 0.24, 0.08) but registers it as a point-and-radius fetch target with radius 0.55, and skull.js:921-925 measures distance from the swept segment to that single point — a plank is ±0.85m long, so the outer ~35% of every board is dead geometry with no collider that the skull flies straight through with no sound and no reaction. Fix: add a locked==='boards' branch in the Door constructor (world.js:496-523) that omits the knob and fits an iron hasp instead, and register three targets per plank at x -0.55/0/+0.55 (or raise radius to 0.9 and add a real collider). Merged in his general ask — 'it should be abundently clear if a door is locked and if it has a door knob and if it will open when you see it': the grammar and the lockedRattle SFX both already exist (world.js:493-495, :571, :614-621), what is missing is the at-a-distance read, since hardware is 5cm of brass on a dark panel and the only proximity cue is the crosshair inside _ray.far = 2.9. Push a tiny world.candles entry (world.js:29) at the knob of every door that CAN open — brightness only, no hue. The same move answers his other question, 'Does that door on the stair way thats just out of reach ever get used?': it does — voidDoorAct (house.js:1395-1471) makes it arm the guest flame, which transfers into the skull's sockets and permanently upgrades your light to intensity 62 / distance 12.5 — but it wears an ordinary knob that says walk up and turn me. Put a candle just behind the closed panel (~x 4.3, y F+1.2, z -7) so from the stairs below you see light leaking around a door you cannot reach.

#### The basement staircase has no colliders at all  *(basement)*

> for some reason you walk right through this wood thing

Two adjacent reports, one root cause — nothing about the cellar flight is solid. (a) house.js:575-577 builds four skirt boxes with World.box (world.js:49-55), which only pushes geometry into a merge list and NEVER creates a collider, so they are pure visuals. The comment above them claims their tops are held under the walking surface and that is arithmetically false: the cellar ramp (house.js:74, compiled at world.js:239-244) spans world z 2..6 / y 0..-3, so tread heights at the box centres are -0.375, -1.125, -1.875, -2.625 while the box top faces sit at +0.03, -0.72, -1.47, -2.22 — every box is 0.40m ABOVE its tread, spanning the full stair width (x 7.98..12.02), which is exactly the slab his legs pass through on every step. Key each box to the ramp (treadY = lerp(0,-3,(z-2)/4); centre + 0.45 <= treadY - 0.1) and add matching addCollider calls. (b) His second note, 'you can also walk through the stairs on the side', is World._buildStairs (world.js:365-386): the whole function body is this.box() calls with zero addCollider, so stairs exist only as merged visuals plus a height field in groundHeightAt (:126-146), while horizontal collision (player.js:141-142) tests world.colliders only. Concretely: standing in bcorr at y=-3 and walking east past x=8 at z=4, groundHeightAt rejects the ramp (it requires h <= curY + 0.55 and the ramp is at -1.5), so the player keeps floorY=-3 and strolls through the solid-looking stair mass. Emit flank colliders down both sides of the flight plus one per tread inside _buildStairs. Do NOT fill the volume under the flight — STATE-OF-PLAY §5 records that a previous attempt bricked the basement spawn and tests/playthrough.mjs caught it; gate on that test.

#### Nothing points anywhere after the second key door  *(house)*

> i didn't find what to do after the second key door.

The flags exist and nothing reads them: flag('bedroomOpen') (house.js:1009), 'gotStairKey' (:1029), 'stairsOpen' (:1044), 'cellarOpen' (:1111) are all written and never consumed — flags.has appears in director.js only at :431/:439/:446/:622, all forest and waterfall. _enterHouse (:119-127) schedules two ambient scare sounds and nothing directional, and _updateScares (:266+) picks uniformly at random. The guidance beat proposed in PLAYTEST-1.md:57-59 does not exist (grep knives|guidance|leading across src → zero hits). Add _updateGuidance(dt) beside _updateScares: once flags.has('stairsOpen') and until 'cellarOpen', every ~20s raise the kitchen candle (the world.candles entry pushed at house.js:713) for a beat and play a scrape or knock from world.doorById.cellarDoor.group.position — light and sound only, no words, and it fires exactly where he stopped. Bundle his anti-lost rule here too ('we could isolate them in sections of the house until they get out of those sections'): real gates exist (bedroomDoor, stairDoor, cellarDoor, frontDoor locked:'never' answering with a dead thud) but every ground-floor door at house.js:42-50 is {} or {ajar:true}, so ten rooms are mutually open at once — change the foyer→backhall door (house.js:47) to a locked id and hang its opener beside cellarBoards, table data only. And his nursery confusion ('i don't completely understand the thing in the babies room that makes noise and the enemy') is _updateMusicBox (director.js:332-365): while mb.wound > 0.03 you get a quiet tick, and only once it decays past 0.03 AND you are inside p.x<-4 && p.y>3 && p.z>-2 does the shape grow and become a walker — a causal rule you can only learn by dying to it.

#### Keys hang off nothing — both of them  *(house)*

> the key is hovering and not on a branch.

He reported this twice and the second time said 'again' — 'the second key again doesn't look like its actuall attached to that baby thing that makes sound' — so he wants a rule, not two patches. Tree key (house.js:904-924, untouched since the initial commit): at the string's z of 8.2 the branch axis passes through y ≈ 6.574 and its underside is ≈ 6.49, while the 0.5m string is centred at 5.98 so its top is 6.23 — a 0.26m gap of open air on a half-metre string. The key itself does meet the string; the string hangs off nothing. Worse, string and key are scene siblings and the sway ticker rotates each about its own centre instead of swinging them from the branch. Nursery key (house.js:1063-1073): better, since both are parented to the mobile, but keyString's bottom is at local -0.30 and the key's bow top is at ≈ -0.337 — a 3.7cm gap on a 0.7m bar — and the string's top sits at local x 0.35, exactly the END of the bar, so it appears to sprout off the tip; it also never swings, the mobile only spins in Y. Fix once as `hangFrom(anchor, localPos, item)` in house.js and call it at both sites: one Group at the anchor's underside, string and key parented into it with the string spanning exactly pivot→bow with no gap, and rotate the group so the whole assembly swings. world.addFetchTarget reads getWorldPosition (skull.js:923), so re-parenting is safe.

#### Impact has no camera feel — the kick-ball language exists but the skull can't reach it  *(skull)*

> The whole throw system and impact doesn't feel quite right. that other game i had with the kick ball had it so well.

The control half he settled himself and signed off on ('feels fine to me... that seeems fine'), so what is left is impact. skull.js:899-915 _bounceFx is the skull's entire response to hitting the world: set a flag, run the pinball guard, play audio.thud — no camera feedback of any kind. The game already owns a full kick-ball-style impact language: Game.impact(kind, pos) at main.js:333-343 does hitStop + shake + fovKick + a contact bloom via _impactFx. The skull cannot call it — I verified the ctx literal handed to it each frame (main.js:463-468) contains only playerVel, yawVel, pitchVel, callHeld, throwHeld, bobY and onCatch. Even the catch is thin: `onCatch: (impactV, hard) => { this.shake(0.1 + impactV * 0.15); }` — 0.1-0.25 of shake, against 0.13s of hitStop plus 0.6 shake plus 2.5 fovKick for a 'pop'. Fix: add `impact: (kind, pos) => this.impact(kind, pos)` to that ctx literal; call ctx.impact('break', this.pos) from _bounceFx for speeds above ~18, behind the same 0.1s cooldown so a pinball storm can't machine-gun hitstop; and in _completeCatch raise the arrival to `this.hitStop = max(this.hitStop, 0.04 + impact*0.05)` plus a small fovKick. Then tune by feel against kick-ball. Touch nothing in FEEL_PROFILE.

#### You can't see that the skull is carrying the key  *(skull)*

> It should be very obvious when it has the key in its mouth.

The CONNECT half is now sold on all three channels he named ('obvious when it connects with the key and gets it through sound and visuals and motion'): grab() (skull.js:462-475) snaps the jaw to 0.3, sets _flourishT = 0.45 for a proud spin with a 22% scale swell played out in _flightDress (:804-812), and fires a tooth CLACK plus a metal chime at the skull's position, with the tree key adding a glassTink (house.js:931). The CARRY half is still missing. skull.js:469 shrinks the key on pickup — `mesh.scale.setScalar(Math.min(mesh.scale.x, 0.9))` — so the tree key drops from 1.7 to 0.9 at the exact moment it becomes the thing you need to see, and it is then parked at jawMount (skull.js:186-188, local 0,-0.028,0.085) where the returning skull's own jaw and teeth occlude it. No light, no glint, nothing on the held skull. Fix: clamp to ~1.15 instead of 0.9, move jawMount a few cm forward and down so the key hangs clear of the teeth, park a small PointLight on jawMount while this.carry is set (brightness, never hue), and in _updateHeld (skull.js:626-643) hold the jaw slightly open with a periodic clamp-tick while carrying so the held skull visibly has something in its mouth.

#### No read on whether a window throw clears the frame  *(house)*

> sometimes it is hard to tell if your aim will send it out, or hit the edge

He likes the windows otherwise ('The windows are cool'). An open window is a plain AABB with skullPass:true covering exactly the opening rect (world.js:309, :332-334) and the four frame bars around it are drawn with world.box, which creates no collider — so the boundary between 'through' and 'clip the jamb' is an invisible edge against the neighbouring wall segments emitted at world.js:288/306. There is no aiming affordance to read it with: grep for reticle|crosshair|aimAssist|trajectory|glint in skull.js returns nothing, and the game's only one is index.html:21's crosshair dot, which grows 4px→8px solely for world.interactables inside _ray.far = 2.9 (main.js:544). PLAYTEST-1.md:52 still carries this as unstarted. Fix: push each open window's opening rect onto a new world.windowOpenings[] in _spawnWindow, then in Game.render (main.js:599, where the crosshair already syncs) raycast the camera forward against those rects and raise emissiveIntensity on that window's four frame bars when the line is clean — brightness only, no hue, no HUD; it reads as the moonlit sill catching your eye. This also blocks the out-one-window-in-another puzzle he asked for twice.

#### The house enemy: closing a door costs it nothing, and the reveal swaps models  *(house)*

> it didn't have enough path finding at first to make it an obstacle to find the other doorway

Two notes from his single encounter, and he loved the parts either side of them (shutting doors and watching its hands come through the wall; 'it ended up slowly coming up from the floor for me and i watched it before it expanded. that was cool'). (a) Routing is a single greedy hop, not pathfinding: chase now tracks e._stallT and calls _bestDoorNode after 0.8s of blocked progress (enemies.js:402, :581), but line 588 filters `passable = d.open || (e.kind === 'resident' && !d.locked)`, so an ordinary walker can only steer toward doors that are ALREADY open — the one you just shut is excluded, and so is every other closed door in the house. It then clears _via within 0.9m of the node (:392), beelines at the player, re-stalls, and with no exclusion memory can re-target the door it just came through (:591). Chain two hops: on reaching a node immediately pick the next passable node whose room (world.rooms, world.js:164) contains the player, and keep e._lastVia as a one-entry exclusion. (b) His 'the visuals of it were simple and pretty lame once it fully comes out': buildWalker was resculpted after that note (enemies.js:128, commit b829fcd — leaning capsule trunk, clavicle bar, hunched shoulder, angled head with jaw slab and eye glints, hands hanging below the knees), so it may now clear his bar and I cannot judge that from source — RUN IT: play to the nursery beat, or shoot the walker with the tools/shot-* harness, and look. What is certainly still wrong is that the silhouette he praised is not the creature: _updateMusicBox (director.js:346-363) grows a bare CapsuleGeometry(0.3, 1.5) for ~11s, then deletes it at scale 0.96 and spawns the real walker at full size — the reveal swaps objects at the punchline. Spawn the real walker dormant a body-length below the nursery floor and lerp its y up over the same 11s instead.
