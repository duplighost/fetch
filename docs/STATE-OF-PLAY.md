# FETCH — state of play, for a new model with zero context

**Read in this order:** `docs/BRIEFING.md` (what the game is + the sacred laws)
→ `AGENTS.md` (team playbook, gates, lanes) → `docs/DESIGN.md` (the authored
spine, beats verbatim from Alex) → **this file** (what is actually true right
now, what is broken, and what the plan is).

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
land on game main with four green gates
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

**The four gates. All must be green before anything lands.**

```sh
node tests/smoke.mjs         # boots every act, asserts budgets, zero console errors
node tests/autotest.mjs      # 24 named checks incl. the feel laws
node tests/regressions.mjs   # 23 checks — irreversible-state traps
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
| `outside.js` | graveyard, the forest spline corridor, clearing, cave |
| `atmosphere.js` | a *decorative-only* dressing layer. Owns no progression, no colliders, no audio. Can be removed without changing a single gameplay result |
| `director.js` | acts, beats, fog/ambient per act, death and respawn, enemy direction |
| `enemies.js` | the Resident, walkers, the Kneeler |
| `finale.js` / `mirrors.js` | the mirror room; pooled planar reflections ported from Alex's THE LAG |
| `audio.js` | HRTF-spatialised synthesis. No audio files |
| `textures.js` | every texture, painted on canvas at boot |

Sculpt variants `skull-variant-{a,b,c,d,e}.js` are alternative skull meshes.
**`e` is the newest and best.** The default skull is still the old inline one.

---

## 5. What is broken — Alex's live test, verbatim, with diagnosis

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

## 8. The plan, condensed

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

## 9. The backlog Alex is carrying in his head

His instinct was right: *"there are probably many ideas in old threads too we
never got to that i said"* and *"probably many glitches that i mentioned that
haven't been fixed."* I went and read the old transcripts. He is right on both
counts, and some of these he has now raised **three separate times**.

**The single most important pattern in this project: when Alex repeats himself,
it is because we did not do it the first time.** Treat a repeat as a priority
signal, not as new information.

### Asked for repeatedly, never built

| | times asked | status |
|---|---|---|
| **Window puzzles** — throw the skull out one window and have it come back in another, by angle or by moving | **3×** — first playtest, again in PLAYTEST-3 ("there still is no window puzzle i guess?"), again today | **never built.** A proposal sits in `docs/PLAYTEST-3.md`. His original words: *"if there were puzzles where it had to go out one window and come in another by some kind of angle or player movement, it would be cool"* |
| **The unreachable stairway door / lamp** | **2×** — *"Does that door on the stair way thats just out of reach ever get used? it looks cool."* and today: *"what does that lamp that lights up on the stair way from the second floor through the jump door even do?"* | **never given a purpose.** It reads as interactive and is not. Either use it or remove it — a thing that looks meaningful and is not teaches the player the game lies |
| **Basement stairs clip through wood / walk through them sideways** | **2×** | **still broken.** Same root cause: a ramp is walkable everywhere in its x/z rect and has no side walls |
| **Reuse the traversal verbs after teaching them** | today | *"there is no reason not to use the fun mechanics like the rope swing once the player learns them... if the player has to traverse through the woods on those things"* — this is exactly the canopy-chain lane in §8, and his saying it unprompted is the strongest possible endorsement of it |
| **A leading pass** — *"things can very visually lead the player in an intuitive way"* | 2× | parked, never done |

### Raised today, all outstanding

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

### Older, still unverified against the current build

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
