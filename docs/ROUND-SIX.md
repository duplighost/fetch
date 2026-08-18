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

## READ THIS FIRST: the state (2026-08-18 — PHASE ONE IS DONE)

**All four of his notes are built, committed and green.** Phase one is closed.
The only thing left in round six is PHASE TWO, the graphics pass, and its
section is at the bottom of this file. Do not re-open phase one.

- **Note 1, the foyer mirror** — done in the previous session (`5476383`,
  `ec9d35c`). Details below.
- **Note 2, falling off the crossing** (`5717391`). `terrainHeightFn` raises a
  rubble bar under the lane once `waterfallTaken` is set — upward only, eased
  at every edge, post-bargain only. Measured with `tools/probe-causeway.mjs`:
  24 of 40 step-offs used to drown, now every WALK survives at worst y −0.98
  against the −1.5 line. Only a sustained 1.6 s sideways SPRINT — five and a
  half metres out, which is leaving the crossing, not slipping off it — still
  finds the deep, and the bar's edge is marked with broken water so you can
  see where the shallow ends. `basin-shore-regression` gained two checks.
- **Note 3, the Choir surfacing ahead** (`3c4bd6c`). Up to three times, ten to
  fourteen metres further along the main route, announced by the loop going
  SILENT and then a call. New gate: `tests/choir-surfacing-regression.mjs`,
  which also pins all seven DROWNED_CHOIR numbers.
- **Note 4, the held hands** (`e9b0efa`). `cradle` is now aimed palm-INWARD:
  `{ y −0.130, rx −1.942, ry 0.253, rz −1.060 }`. `empty` and `lowered` are
  untouched, because he said so ("its fine after the skull goes").

**Two things worth knowing before phase two:**

- **The bedroom in the reference image is the game's own opening bedroom.**
  `tools/shot-grip.mjs` shoots it: lantern on the dresser at frame left, window
  dead ahead with the moon in it, wardrobe right, peeling floral wallpaper. So
  the reference is not only a direction — it is a BEFORE/AFTER of a frame this
  game already has, and it is the cheapest place to test the four properties.
- **Nothing below the plunge pool's surface can ever be drawn.** The pool has
  an opaque murk body (round four's fix for "you can see under the water which
  is odd"), so the doc's old "shoot the shallow rubble under your feet" was not
  achievable; the surface is the only place a signal can live there.

New tools this round: `probe-causeway`, `probe-choir-surfacing`,
`shot-crossing`, `shot-grip`, `shot-grip-sweep`, `shot-mirror-hands`.

---

## The state as it stood when phase one began (2026-08-17, late)

Round six was started by Fable, handed to Opus mid-flight, and then re-verified
by Fable in a fresh session against the tree and the gates on this exact tip.
**The state below was checked, not remembered — trust it over anything anyone
said in chat.**

**DONE, committed, pushed, and GATED:**

- **Note 1, the foyer mirror.** Reproduced first (a single 9980 ms frame
  linking +34 shader programs, because the lag mirror only builds its planar
  reflection once a human has stared at it, so no boot warm pass could ever
  reach it). Deleted whole — pool, pane, delayed inhabitant, silver echo,
  tickers, the `signalRelay` hookup, the render/dispose calls in main.js, and
  house.js's now-dead `mirrors.js` import; zero references survive in src.
  Replaced with the family photograph painted on canvas at boot. The same
  probe now reports **zero hitches and 257 → 257 programs** across the walk
  that used to freeze for ten seconds.
- **The photograph reads now — verified by eye against the committed shots**
  (`scratch-photo/01`/`03`): a dark print, a cluster of small pale faces at
  wrong heights, same face whatever the body, one smear, one turned away. It
  clears the bar — *a family photograph with something wrong about it*, not a
  grey rectangle. `ec9d35c` got there the right way: value SEPARATION
  (backdrop and clothes down, faces and collars up), not a fourth pass of
  global darkening. Judge it only at the stairs and oblique poses;
  nose-to-glass puts the 58-cd lantern a metre from the wall and tells you
  nothing. One residual, recorded not fixed: the white frame and its hanger
  are now the palest things in the shot and pull the eye before the print
  does. If Alex wants the print stranger or the frame quieter when he plays
  it, that is his call, not a defect.
- **The full gate suite is green on this tip** (re-run 2026-08-17 by Fable):
  smoke, autotest 26, regressions 157, playthrough COMPLETE, warm-start,
  basin-shore, district-culling, render-perf, plus the foyer probe. The game
  runs and finishes after the mirror removal.
- New and working: `tools/probe-foyer-freeze.mjs`,
  `tools/shot-family-photo.mjs`.

**REMAINING — build in this order, gating each:** *(all four are now DONE —
kept for the plans, which record what was asked and why)*

1. ~~Fix 2 — the crossing stones' side-fall.~~
2. ~~Fix 3 — the Choir surfaces ahead.~~
3. ~~Fix 4 — the held hands' half-turn.~~
4. **PHASE TWO — the graphics pass. This is the whole of what is left.**

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
He POSTED the reference image (2026-08-17; the read is the next section). His
words: *"i don't want the graphical pass to fuck anything up. i just need it
to look great."* Named targets, called out in advance:
- **the car in the graveyard**
- **the bodies in the graveyard**
- **the mausoleum EXTERIORS in the graveyard**

And his caveat when he posted it: *"it might be too hard to do something like
that. but maybe theres an easy way to make the game look better without making
it slow."* So: the image is a **direction**, not a spec. The read below was
written while looking at the pixels — it is the brief even if you cannot see
the image yourself. If a frame decision genuinely needs the pixels and you do
not have them, ask Alex to re-post rather than guessing for an hour.

### The reference image — the read (posted 2026-08-17)

The frame: first-person, both hands holding the skull at chest height, in a
ruined bedroom at night. A lit lantern on a dresser at frame-left paints the
left wall warm; a window dead ahead with a key hanging from a string in front
of it, cold night forest beyond; a big dark wardrobe; a framed picture on the
right wall showing the moonlit falls; peeling floral wallpaper; plank floor,
worn rug. Two facts first:

- **The hands in it are the fix-4 target made visible.** Fingers wrapped
  around the skull's SIDES, backs of the fingers to the camera, thumbs
  behind. When you tune `cradle`, this image is the judge, held next to
  `tools/shot-held.mjs` output.
- **It is a value image, not a hue image.** Everything it does survives
  greyscale, which is exactly this project's law. Port it entirely in value,
  shape and texture terms.

The four properties that make it read, in porting order:

1. **Value structure: black corners, one warm pool, one bright focal.** The
   room dies to near-black in the corners and at the ceiling. The lantern
   owns ONE pool with believable falloff. The skull is the brightest thing
   in frame and sits against dark mid-ground; the window is a cool second
   source that silhouettes rather than fills. Nothing sits in fog-grey mids
   — which is FETCH's one recurring value failure. This property, not any
   object, is what should generalise to the graveyard targets: judge the
   car, the bodies and the mausoleums by whether their FRAMES have it.
2. **A vignette and fine grain over everything.** All four corners darkened,
   low-amplitude noise across the frame. Most of the "photograph" feel is
   these two, and they are screen-space cheap — but read the warm-law trap
   below before building either.
3. **Wear on every surface, at LOW contrast.** Damage patches in the
   wallpaper, grain and a specular sheen on the boards, the rug threadbare.
   The noise is fine and never fights the value read. Every FETCH surface is
   a boot-painted canvas, so wear is free where it matters: zero draws, zero
   programs, just more honest painting in the texture functions.
4. **Chunky dark masses, thick frames, one pale thing per frame.** The
   furniture is heavy, soft-edged, dark; openings wear thick trim; each
   frame holds a single bright subject. A composition rule, not an object
   rule.

Buying 1–3 without breaking the laws:

- **Any new material is a new shader program, and an unwarmed program is the
  round-five freeze born again.** A vignette/grain overlay wants to be ONE
  unlit fullscreen quad with a boot-painted canvas texture — but whatever
  form it takes, it must exist and be compiled by the boot warm pass, inside
  the pinned light census. After adding one: warm-start gate, plus a
  `?hitch=1` walk. This is the single likeliest way phase two breaks the
  game. Respect it in every polish commit.
- **A game-wide overlay moves every measured number.** Near-band means and
  any pinned luminance shift under a vignette and grain. Tune strength
  against the legibility gates; if a pinned number reddens, the argument is
  with the vignette's strength, not with the pin.
- **The floor sheen is roughness/metalness VALUES on materials that already
  exist** — value tweaks are free. ADDING a map where none existed flips a
  shader define: that is a new program, same warm law.
- **The corners and the mids are albedo and ambient values, never lights.**
  Law 4 stands whole. Moonlight through a window is painted glow on the
  glass or an emissive value — never a light.

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

### THE POSE LIST AND THE BEFORE SET — DONE (2026-08-18). This is the queue.

`tools/shot-graveyard-frames.mjs` shoots fourteen poses covering the yard the
way a player moves through it, each with its near band and its draw count.
Numbers in `tests/results/graveyard-frames.json`, frames in
`scratch-graveyard/before/`. **They were opened and looked at**, and they say
something more useful than "the car needs work":

**His three named targets are not three art problems. They are ONE value
problem with three faces** — every one of them is a large, untextured, PALE
mass sitting in a frame that is otherwise 40-80% near-black. That is exactly
the trap already written down twice in this file (a lit MeshStandard blows to
white near the lantern whatever its albedo) and exactly the reference image's
first property inverted: black corners with no warm pool and no focal, and then
one enormous fog-grey object owning every pale pixel.

Ranked worst-first. **This list is the work queue and the stopping condition.
Do not add to it mid-pass.**

1. **THE CAR IS A WHITE SLAB** (04, 03, 05). Near band mean 42.9 standing
   beside it. It reads as an unpainted plastic model of a car, not wrecked
   steel — flat panels, no wear, no value break. AND: 808 draws standing
   beside it, 709 from inside its beam. Nobody had recorded that; the car is
   the second-worst draw cost in the district after the south view.
2. **THE MAUSOLEUM EXTERIORS ARE WHITE BOXES** (11, 12). Four untextured pale
   planes and a cone roof, every line straight and unbroken, palest thing in
   frame (max 230), and 12 is the ONLY frame in the whole set that clips.
3. **THE BODIES ARE PALE MANNEQUINS** (07, 06). outside.js:3641 says this was
   fixed by dropping the skin to 0x241f1c and explains the maths — and standing
   over one still gives a near-white figure on near-black ground. So whatever
   is pale is NOT the skin. Measure which material owns those pixels (the
   hide-one-thing-at-a-time attribution pass in `shot-shore.mjs` does exactly
   this) before changing a single colour.
4. **MID-YARD LOOKING SOUTH: 1203 DRAWS** (08) against the 450 ceiling. Not a
   beauty problem — a headroom problem. Nothing can be SPENT in this yard
   until some of this is taken back.
5. **NO MIDS, NO FOCAL** (02, 14, 10, 01). 70-80% of the near band is
   near-black with nothing to look at. The reference image's first property is
   black corners AND one warm pool AND one bright focal; these frames have
   only the corners. 01 is the arrival — the district's first frame — and it
   is a dark nothing at 413 draws.
6. **The north views already read** (09, 13: mean 33.3 and 21, and the gate
   lanterns give them a real focal). Bottom of the queue. Leave them.

One more thing the frames show that is not on his list: **the grass carries its
read in hue** — a flat saturated green — which is the one channel he cannot
use. It is also the single largest surface in every frame, so its value is what
every pale object is being judged against.

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
