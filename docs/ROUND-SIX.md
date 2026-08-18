# ROUND SIX — the step-by-step, written for the next model

Alex asked for this to be written out properly, because the failure mode he has
seen is not "can't do the work" — it is drifting off the task, or disappearing
into one object for an hour. So: what to do, in what order, how to know when
each piece is DONE, and when to stop.

Read this file first. Then read `docs/HANDOFF.md` (round-five section) for the
laws and the numbers. Do not read the whole of house.js/outside.js — they are
7000+ lines each and reading them end-to-end is itself a way to lose the day.

**Worktree:** `C:\Users\Alex\Projects\fetch-aug17-round6`, branch
`claude/aug17-round6-notes`, already pushed. PR when done: base
`claude/aug17-round5-notes` (it will be #32 in the stack). Never rebase.

---

## READ THIS FIRST: where the work actually stopped (2026-08-17, late)

This round was started by Claude Fable in a session that kept getting cut off,
and the thread was handed to Opus mid-flight. Nobody was finished. **If you are
Fable picking this back up, or Opus starting fresh, the state below is the
truth — trust it over anything either of us said in chat.**

**DONE and committed (`5476383`, pushed to origin):**

- **Note 1, the foyer mirror.** Reproduced first (a single 9980 ms frame
  linking +34 shader programs, because the lag mirror only builds its planar
  reflection once a human has stared at it, so no boot warm pass could ever
  reach it). Deleted whole — pool, pane, delayed inhabitant, silver echo,
  tickers, the `signalRelay` hookup, the render/dispose calls in main.js, and
  house.js's now-dead `mirrors.js` import. Replaced with the family photograph
  painted on canvas at boot. The same probe now reports **zero hitches and
  257 → 257 programs** across the same walk.
- New and working: `tools/probe-foyer-freeze.mjs`,
  `tools/shot-family-photo.mjs`.

**UNFINISHED — pick these up in this order:**

1. **The photograph is not visually settled.** It is correct, cheap and
   freeze-free, but it still reads washed out. Three darkening passes are
   already in (print values, material tint `0x6a665f`, silver wash 0.05,
   foxing 0.38) and the near-band numbers barely moved: 54.5 from the stairs,
   116.1 nose-to-glass, 74.5 oblique.

   What has NOT been tried, and is probably the answer: stop darkening
   everything together and give the FIGURES real value separation from the
   backdrop — right now the bodies and the ground are close in value, so the
   whole print greys out into fog. Also check whether the white wooden frame
   is now the palest thing in the shot and is stealing the eye.

   Run `node tools/shot-family-photo.mjs`, open all three PNGs in
   `scratch-photo/`, and judge the **stairs** and **oblique** poses. Do not
   tune against the nose-to-glass pose: the 58-cd skull lantern is a metre
   from the wall there and blows out the wallpaper too, so it flatters
   nothing and tells you nothing.

   The bar: at the stairs pose it should read instantly as *a family
   photograph with something wrong about it*, not as a grey rectangle.

2. **No gates have been run since the mirror came out.** Do this before
   writing anything new. The removal touched `src/house.js` and `src/main.js`.
   House draw counts should have gone DOWN (one fewer render target pass and a
   pool of meshes gone); nothing has confirmed that yet. Full set: smoke,
   autotest, regressions, playthrough, warm-start-regression,
   basin-shore-regression, district-culling-regression, render-perf.

3. **Notes 2, 3 and 4 are untouched.** Their step-by-step plans are below.

**Also true right now:** round five is LIVE on qualiacology.com and FETCH is
the first card on the homepage. Game PR #31 (round five) is still open and
needs #30 to land first. This branch will be PR #32, base
`claude/aug17-round5-notes`.

---

## The shape of the round

**PHASE ONE — the four fixes.** They are small, defined, and testable. Do them
first, in this order, gating each. Phase one is NOT a beauty exercise; resist
improving anything you happen to walk past.

**PHASE TWO — the graphics polish.** Only after phase one is committed and
green. He will post a REFERENCE IMAGE. Wait for it. Tactics are at the bottom
of this file and they matter more than taste.

**Note 1 is already done** (committed `5476383`). Three fixes remain.

---

## The five things you must not break

These have all been violated at least once and shipped, which is why they are
written as laws rather than preferences.

1. **The throw grammar is sacred.** press = throw, HOLD = it stays out,
   RELEASE = it zips home. No charge. `FEEL_PROFILE` in skull.js is frozen.
2. **He is colourblind.** No read may depend on hue. Value, shape, motion,
   timing. This applies to the graphics pass more than anything else in it.
3. **No HUD, no on-screen words, no control theft.** Copy is his voice; never
   invent it.
4. **Never add, remove, or visibility-flip a light at runtime.** The visible
   light count keys every shader program; changing it recompiles the whole
   game mid-play. Use `world.candles` or `world.reserveLoanLights`/`loanLight`.
   (`World.pinLight` intercepts `.visible` on pinned lights, which is why
   district light flips are already safe — do not "improve" that.)
5. **Draw budget: hard 450 per district**, and the graveyard already spends
   ~1130 looking south. Geometry budget 1500. Both are gates.

---

## PHASE ONE, FIX 2 — falling off the crossing stones

### His words
"you can still fall off the sides of the rocks into the water when crossing
them into the waterfall."

### What is actually true right now
Round five made the SHORE safe: a lip of stone all the way round the plunge
pool, and a weir barring the bridge lane until the stones rise. What round five
deliberately left alone was the water BESIDE the stones, mid-crossing. He is
telling you that was the wrong call. When he repeats himself it is because we
did not do it the first time; treat this as priority, not as debate.

The relevant facts, already verified:
- The kill is `director.js`, act `clearing`: `player.pos.y < -1.5` → death.
- The basin is `CLEARING_BASIN` in `outside.js` (centerZ 15.2, innerR 5.4,
  outerR 8.2, depth 3.15). The floor formula is in `terrainHeightFn`, same
  file — that function is the ONLY authority on ground height out there.
- Ten bridge stones at `bridgeZ = [7.35 … 20.42]`, tops resolve as ground
  within 1.03 m of each centre, so the walkable path is a chain of 2 m discs
  with deep water between and beside them.
- **`world.groundHeightAt` reads ramps, rooms and TERRAIN — never colliders.**
  A floor must be terrain. A collider is only a wall. (Round five lost an hour
  to this: a perfectly good collider blocked nothing and the probe drowned.)

### The fix
When the crossing becomes real, the riverbed comes up with it. In
`terrainHeightFn`'s clearing branch, gated on `game.flags.has('waterfallTaken')`,
raise the floor inside the lane band to shin depth — a submerged causeway of
rubble under the stones. Suggested shape (tune with the probe, do not trust
these numbers blind):

- Band: `|lx| <= 3.0`, `lz` from about 6.5 to 20.5 — the same lane the weir and
  the stones already own.
- Raised floor around `-0.85` to `-1.05`: comfortably above the −1.5 kill,
  clearly BELOW the stone tops (0.37) so the stones still read as stepping
  stones and stepping back up onto one is a real step (under STEP_UP 0.5).
- Pre-thaw: change NOTHING. The weir still bars the lane, the deep water still
  kills, and `tests/basin-shore-regression.mjs` must stay green — it drives a
  player at the water from 24 bearings and asserts they never get below −1.5.

Then dress it so the shallow is visible rather than invisible luck: rubble
under the lane, instanced, rooted in `game.frozenFallsRoots` (that array is the
falls district's act gate). Water shader stays as-is.

### Done when
- New regression (extend `basin-shore-regression.mjs`): post-thaw, step off
  EVERY stone to both sides — never below −1.5, and the crossing still
  completes afterwards. Pre-thaw checks unchanged and still green.
- `tests/playthrough.mjs` still COMPLETE. That suite walks the real crossing;
  if the causeway is too high it will change how the stones read but it must
  not change whether the walk works.
- A screenshot standing mid-crossing looking down: you can see you are above
  shallow rubble, not black depth.

### Do not
Do not touch the stones' positions or heights, the weir, or the shore lip. All
three are his, from round five, and all three are pinned by tests.

---

## PHASE ONE, FIX 3 — the Choir surfaces in front of you

### His words
"in the under waterfall cave area make that enemy teleport in front of you, a
few times. but not so close that it instantly gets you."

### THIS IS A REPEAT. Read this part twice.
`src/enemies.js` already carries his EARLIER instruction, in a comment above
the constants: *"The enemy inside the waterfall should be more difficult and
should spawn way in front of you."* That was implemented as a far spawn ONCE,
at the start of the act. He is now asking for it **a few times, during the
run.** The law of this project applies: when he repeats himself it is because
we did not do it the first time. Do not re-litigate it, build it.

### The numbers you may not touch (enemies.js, `DROWNED_CHOIR`, ~line 39)
```
warning: 2.20   drySpeed: 2.60   heardSpeed: 4.35   attackRange: 2.30
attackCommit: 0.92   attackRadius: 1.30   recovery: 0.95
```
`heardSpeed: 4.35` is **UNTOUCHABLE** — it sits under RUN (4.7) and the comment
in the file explains why: running away has to work or the chapter becomes a
coin flip. The fairness proof the walking bot re-verifies every playthrough:
WALK (2.7) × attackCommit (0.92) = 2.48 m of travel inside the commit window
against a 1.30 m strike radius — a **1.9× margin**. Your surfacing must not
erode it. Surface far enough out that the player still has that margin, i.e.
**never inside attackRange (2.30) and never closer than ~10 m.**

### The pieces already in the file
- `beginDrownedChoir({ pos, heardPos })` — enemies.js ~1018. It calls
  `endDrownedChoir('replace')` first, builds the body, and clamps into the
  Underfalls. **This is your reposition primitive; you probably do not need a
  new one.** Note it resets `state:'warning'` and `memoryT`, which is exactly
  the "it surfaces and starts again" beat you want.
- `drownedChoirHear(pos, intensity, source)` — enemies.js ~1079. `source:'call'`
  raises `revealT` and plays `drownedCall`. Use it for the surface moment.
- The Underfalls route: `game.underfalls.project/route/groundAt/clamp` and
  `layout.segments` (each with a width `w`). **Place by route, never by raw XZ**
  — a raw offset will eventually put it inside rock.

### Build it like this
Add a small state block to the choir entity (`surfacings: 0`, `nextSurfaceAt`).
Each tick in the cave act, trigger when ALL of:
- `game.act === 'cave'` and the Choir exists and is not `'spent'`;
- `surfacings < 3`;
- at least ~25 s since the last one;
- the Choir is genuinely BEHIND: its route distance is at least ~12 m back
  along the player's direction of travel, and the player is moving forward.

On trigger: go quiet for a beat (the silence is the tell — do not add a new
sound, the absence of the loop IS the signal), then reposition to a route node
**10–14 m ahead of the player's own route position**, and call
`drownedChoirHear(playerPos, …, 'call')` so it announces itself as it surfaces.
Skip the node and take the next one if its width `w` is so narrow the body
would fully plug the corridor — he must always be able to get past it, because
running past is the escape.

### Done when
- New regression: over a scripted cave run, `surfacings <= 3`, every surface
  point projects onto the route, and the player-to-Choir distance at each
  surfacing is `>= 10` m.
- `heardSpeed === 4.35` asserted in that test so a future tune cannot drift it.
- `tests/choir-route-occlusion-regression.mjs` still green.
- `tests/playthrough.mjs` still COMPLETE — that bot WALKS, and its survival is
  the fairness proof.

### Do not
Do not raise any speed, do not widen `attackRadius`, do not shorten `warning`.
He asked for placement, not lethality. If the playthrough bot starts dying, the
change is wrong even if it feels scarier.

---

## PHASE ONE, FIX 4 — the hands are holding the skull backwards

### His words
"in this whole game, the hands are facing so the palm side is against the
skull, so it doesn't look like he's holding the skull. its fine after the skull
goes and we got it right in the last room of the game."

### The answer is already written down in this repo
`src/finale.js`, lines 13–21, above `RAISED_L`/`RAISED_R` — the pose he says is
RIGHT — documents the whole trick:

> "Roughly (-PI/2, 0, ±PI) — fingers up, backs of the hands to the camera,
> thumbs lateral… **The ±PI about each hand's own local Z is the finger axis:
> it turns the hand over without mirroring it**, which matters because mkHand
> puts the handedness in the GEOMETRY (right thumb at local -X, left at +X).
> Negating thumb offsets instead would put a left hand on the right wrist."

```
RAISED_L = { x: -1.24, y:  0.30, z:  (Math.PI - 0.10) }
RAISED_R = { x: -1.24, y: -0.30, z: -(Math.PI - 0.10) }
```

Now compare the held pose, `src/skull.js` ~line 529, `this._handPose`:

```
cradle:  { x: 0.114, y: -0.168, z: 0.052, rx: -0.58, ry: 0.71, rz: 0.27 }
empty:   { x: 0.133, y: -0.147, z: 0.043, rx: -0.33, ry: 0.50, rz: 0.15 }
lowered: { x: 0.152, y: -0.56,  z: 0.028, rx: -0.06, ry: 0.34, rz: 0.05 }
```

**`cradle.rz` is 0.27. The finale's is ±(PI − 0.10). The held hands never got
the half-turn about the finger axis.** That is the bug he is describing, and it
explains why only the held pose is wrong: `lowered` is out of frame so nobody
sees it, and the finale sets its own rotations every frame from RAISED_L/R.

### The fix
Roll `cradle` (and check `empty`) about the finger axis by ~π and re-tune. In
`_applyHandPose` (skull.js ~642) the rotation is applied as
`rotation.set(rx, -side * ry, -side * rz)`, so the sign is already mirrored per
hand — change the magnitude, not the mirroring. Start at `rz: 0.27 - Math.PI`,
shoot it, and expect to adjust `rx`/`ry` by a few hundredths afterwards, because
turning the hand over changes which way the thumbs read.

### Verify
`tools/shot-held.mjs` already photographs the held pose. Change → shoot → LOOK
→ adjust. Two or three iterations. Also shoot: looking down, and mid-throw
(hands open) — the `empty` pose blends from the same constants, so a fix that
only looks right while cradling is half a fix.

### Done when
The skull reads as HELD from the default pose and looking down, the empty pose
still reads as open hands, and the finale room is untouched (it is: it writes
its own rotations).

### Do not
Do not touch `FEEL_PROFILE`, throw arcs, catch timing, `HOLD_POSE`, or the
grip/bob animation. Orientation constants only. There is a warning at skull.js
~525 saying a pose fix aimed at the finale changes nothing on screen — read it
before you edit, so you edit the right file.

---

## PHASE TWO — the graphics polish

This is the part where he is worried you will disappear. Read this whole
section before touching anything.

### The brief
He will post a REFERENCE IMAGE. His words: *"i don't want the graphical pass to
fuck anything up. i just need it to look great."* Named targets, called out in
advance:
- **the car in the graveyard**
- **the bodies in the graveyard**
- **the mausoleum EXTERIORS in the graveyard**

His own worry, verbatim: *"I don't know if the picture i'll give him for the
graphics is a way he'll actually be able to improve stuff."* So: treat the
image as a **direction**, not a spec. Extract from it three or four concrete,
nameable properties — the value structure (where is it dark, where is the one
bright thing), the silhouette language (chunky? spindly? broken?), the amount
of visual noise, the palette's VALUE spread — and write those down in the
handoff as your read of it before you start. If the image cannot be translated
into properties like those, say so to Alex and ask, rather than guessing for an
hour.

### The tactic that keeps this from eating the week: work FRAMES, not objects

The single most useful reframing: **you are not improving a car. You are
improving the frames a player actually stands in.** Objects get improved as a
side effect, and — critically — you stop when the FRAME reads, not when the
object is finished. An object is never finished. A frame is.

Concretely:

1. **Build the pose list first, before any art change.** Twelve to twenty
   camera poses covering the graveyard the way a player moves through it:
   arriving from the house, the gate approach, beside the car, the mausoleum
   row, standing where the bodies are, and the notorious SOUTH-facing view.
   Put them in one shot tool (copy `tools/shot-shore.mjs`, which already does
   pose → PNG → near-band luminance measurement).
2. **Shoot the "before" set and actually look at every frame.** Rank them worst
   to best by one question: *what is wrong with this picture at a glance?*
   Write the ranked list down. That list is your work queue and your stopping
   condition. Do not add to it mid-pass.
3. **Fix the top frame. Re-shoot. Re-rank.** If a change does not move a frame
   up the list, revert it. This is the discipline that stops per-object
   rabbit-holing: the question is never "is this car good" but "is this frame
   better than it was".
4. **Time-box: one hour per frame, maximum.** If a frame is not better in an
   hour, commit what helped, write what did not, move on. Two mediocre frames
   fixed beats one perfect car.

### The four cheap levers (in order of value-per-draw-call)

Every one of these is nearly free in draw calls, which is the constraint:

1. **Silhouette variety through instancing.** The single biggest "cheap 3D"
   tell is repeated identical shapes in a row. `InstancedMesh` gives you
   per-instance scale and rotation for free — jitter them. Round five's whole
   basin lip is 52 instances on a mesh that already existed: zero new draws,
   and it fixed the read completely.
2. **Value separation.** Nearly every "it looks bad" in this game has been a
   value problem: things that should be dark reading pale, or two objects at
   the same value merging into one blob. Push the albedo of ground and bulk
   DOWN, keep one or two things pale, and let the lantern do the rest. Per
   instance colour (`setColorAt`) is free.
3. **Breaking straight lines.** Boxes read as boxes. Rotating a box a few
   degrees, sinking it into the ground, or overlapping two of them reads as
   masonry. `world.box` into a material the shell ALREADY batches costs
   nothing at all.
4. **Grouping detail where the eye goes.** Detail near the player's path and at
   eye height pays; detail on a roof 12 m up does not. Spend the geometry where
   the frames say the eye lands.

### The three traps this project has fallen into before

- **A lit MeshStandard blows to white near the lantern, whatever its albedo.**
  Measured on the shore lip: 0x46535d, 0x232c33 and 0x0e1318 gave near-band
  means of 50.9, 44.7 and 36.5 — a fivefold albedo cut for a 1.4× pixel cut.
  If something must stay dark at two metres, it has to be unlit
  (`MeshBasicMaterial`) or accept that pale IS this game's near-lantern look
  (the bridge stones are just as bright, and they are fine).
- **New material through `world.box`, or any new `Mesh`, is +1 draw call
  forever in every act** unless it is act-gated into a district root array.
  Prefer instances on existing meshes and boxes in existing materials.
- **Working-but-illegible is the recurring failure**, not broken. Measure
  legibility (the near-band mean/max/clipped numbers the shot tools print),
  don't eyeball it alone.

### Gating during phase two

Run the FULL suite after **every** polish commit, not at the end:
`smoke`, `autotest`, `regressions`, `playthrough`, `warm-start-regression`,
`basin-shore-regression`, plus `district-culling-regression` and `render-perf`
(the two that catch a polish that costs frames). A polish commit that reddens a
gate gets reverted, not argued with. Small commits make that cheap.

**The graveyard is the tight district.** 450-draw ceiling, and looking south
already measures ~1130 (`RECORDED, NOT ASSERTED` in district-culling — a
pre-existing problem, not yours, but it means the south view has no headroom at
all). If you want to spend draws there, you must first take some back.

### Raid, don't invent
`C:\Users\Alex\Projects\marrow` is where this graveyard came from — its car,
its bodies, its buildings. Every strong thing in FETCH has been a port and
every weak thing was written fresh. Look there first for all three named
targets.

---

## Running the game and the tests

- Gates: `node tests/smoke.mjs`, `tests/autotest.mjs`, `tests/regressions.mjs`,
  `tests/playthrough.mjs`, `tests/warm-start-regression.mjs`,
  `tests/basin-shore-regression.mjs`; plus `district-culling-regression.mjs`
  and `render-perf.mjs` after any dressing.
- **`tests/underfalls-expansion.mjs` fails TWO checks and both are
  PRE-EXISTING** — verified identical on the untouched round-four tree. Do not
  chase them and do not "fix" them by weakening the suite.
- `stepWith(seconds, controls)` — seconds FIRST; movement is `moveZ`.
- **Never pipe a test through `tail`/`grep`** — it buffers to EOF and a
  40-second run looks like a hang. Redirect to a file.
- Debug: `?hitch=1` logs every frame over 150 ms with its program/geometry/
  texture deltas. `__FETCH.warm()` reports the warm state and press-to-play.
- Screenshots: Playwright + system Chrome (D3D11, never swiftshader), and
  capture with `canvas.toDataURL` inside the frame task — `page.screenshot` on
  this renderer is black by construction. Every shot tool in `tools/` already
  does it correctly; copy one.

## Deploying (only with his explicit approval)

Two repos. Game is `duplighost/fetch`. The live site is a shelled copy at
`fetch/` inside `C:\Users\Alex\Projects\qualiacology` — read ITS `AGENTS.md`
first. Land the game branch green, copy the changed `src/` files in with LF
endings, verify all 22 byte-identical, **port any index.html change by hand**
(the site keeps its own head), then PR, local boot-check, build + validate +
browser-qa, preview boot-check, his approval, merge, production boot-check.
Round five is already live and FETCH is the first card on the homepage.
