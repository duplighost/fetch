# ROUND NINE — THE RECORD. All five notes are built.

**Built 2026-08-19 on `claude/aug19-round9`, worktree
`C:\Users\Alex\Projects\fetch-aug19-round9`, stacked on
`claude/aug18-round7-look` at `749f471`. NOT pushed, NOT deployed.** Six
commits, one per note. The brief this was built from is kept below, unchanged,
because it was researched to root cause and it was right about every mechanism
it named.

**Alex has not played any of it.** His notes outrank everything written here.

## What landed, in his order

1. **The car can be destroyed, and it screams while you do it.** Four hits.
   First hit wakes a two-tone alarm on a dead battery, strobing the wreck's own
   dying headlight on the wail's period; it pins player noise and calls the dead
   every cycle, and there is no way to stop it except finishing the job. Then
   the glasshouse, then the door and the peeled hood, then it dies — the alarm
   sagging out from under itself rather than stopping, the lamp out, the roof
   down, the collider dropped so you can walk over what is left.
2. **The ossuary hatch is instant, both ways, like the marrow.** E and you are
   down; E and you are up. The stone still slides — it finishes behind you. The
   way out refuses out loud now too, which it never did.
3. **The weighted basket turns the wheel on.** The counterweight starts visibly
   locked (a pawl standing in the rim, the core dark) and knocks when thrown at.
   Solving the kennel runs cause down a visible wire, knock by knock, thirteen
   metres north, and the pawl lets go. The hold itself is unchanged. Both
   residents moved out of the corridor and into the rooms.
4. **The basement's best scare stops dying with you**, and the three decoy
   sheets topple when hit, with nothing underneath.
5. **The pump-gallery latch cannot be missed any more**, and the gallery floor
   is crawling.

## The numbers

| | |
|---|---|
| His pump bug, driven as he described it | arrives on the far bank at **progress 0.787** — the old rule latched at 0.9 |
| Ossuary E, press to being underground | **one tick** (was ~0.9 s of lid) |
| The kennel wire on screen, from where he walks | **1.64%** of the frame, **6.2x** the floor's luminance |
| Each car stage's change to the frame | **11.4 / 6.0 / 6.9 / 5.5 %** (varies a little with the strobe phase) |
| Intact car vs finished car | **9.6%** of the frame |
| Alarm strobe, phase to phase | **3.6%** of the frame |
| Gallery vermin on screen, standing look | **0.19%** of the frame |
| Playthrough, five consecutive runs | **5/5 COMPLETE** (4/5 before the tether) |
| Alarm audio, 20 s of continuous wailing | peak **5 voices of a 40 cap**, 0 dropped, settles when the wreck dies |
| Draw cost added | 1 mesh in the ossuary (the wire), 1 in the basement (the vermin), 4 unbatched car pieces |

## THE FINDING OF THE ROUND, and it is a question for him

**The graveyard fight has been quietly easier than it was written, because a
basement enemy was eating its attack tokens.** `tests/grave-arena-regression`
never clears the enemy list — it only clears `graveArena` enemies — so the
boot-spawned basement dropcloth walker was in `enemies.list` for the entire
seeded fight, holding attack-token budget that the graveyard therefore never
spent on you. Item 4 removes that walker from boot. The fight is now at the
pressure it was authored with, for the first time, and **seed 583 loses at wave
2 (guard 38) where it used to survive (guard 61)**.

Proved rather than argued, three ways: disabling the new car target changes
nothing; reverting `src/outside.js` to base entirely changes nothing (so it is
not the car); and re-adding a boot-spawned basement walker to my tree makes
seed 583 pass again, along with every other seed. A global-`Math.random()`
phase-shift experiment on the base tree ruled that out too — the arena is
completely insensitive to it.

**So this is his call, and it is a design question, not a bug:** the graveyard
fight got harder because a bug that was making it easier is gone. Tune it back
down, or is it right that the fight finally runs at full pressure? Nothing has
been tuned either way — the gate is left red and honest.

## Three findings worth carrying

**The ossuary's district seal has been hiding every wire ever laid in it.**
`keepInOssuary`/`syncOssuaryVisibility` hides every scene child that is not
`routeRoot` while the player is underground — and `world.box` merges into the
world SHELL, which is a scene child. So a floor conduit laid with `world.box`
down there is drawn nowhere, and always has been: the exit-slab wiring, its
"the basement's blessed vocabulary" comment and all, has never been visible to
anybody. Found by toggling the merged mesh off and diffing the frame. **The
first two cuts of the kennel wire measured 0.00% of pixels and I would have
shipped both of them.** Anything that must be seen inside the ossuary goes in
`routeRoot` as a real mesh — merged, so it is still one draw.

**An InstancedMesh is classified by its base geometry at the origin.** The
pump gallery's upper-sector culler files every scene mesh by
`Box3.setFromObject(object, false)`, which for an InstancedMesh reads the base
geometry through the object's own matrix and never looks at an instance matrix.
A vermin mesh sitting at the origin with 150 instances in the basement measures
as a thing at y ≈ 0 — ground-floor house — and gets its layer mask zeroed the
moment the player goes downstairs, which is exactly when it should be crawling.
It was `visible`, `frustumCulled = false`, parented to the scene, matrices
correct, and drawn nowhere; `layers.mask` was `0`. The mesh lives at the
basement floor now and its instances are local to it. **If something is not on
screen and every obvious property is right, print `layers.mask`.**

**`world.finishStatic()` clones the material it merges under.** Toggling your
own material's `.visible` to measure a merged thing does nothing — the drawn
object is the shell's clone (`<name>:shell`). Cost half an hour before the seal
above was found.

**And the playthrough flake is diagnosed, not merely re-rolled.** Seeding the
dropcloth index made it deterministic — which immediately exposed what the
`Math.random()` was hiding: the real walker is a Standing One with **no
tether**, and enemies.js's own comment says an unbounded one "would convert
every look-away into a corridor-length pursuit". It could follow the player out
of the storeroom and stand in the boiler doorway, and the bot's route to the
boiler runs straight past sheet spot 0. One run in four used to pick that spot;
seeding pinned it. It has a 4.5 m tether now — the storeroom — so it still
crosses the room behind you, still reaches the crawl door, and cannot leave
with you. Five playthrough runs after the tether: **5/5 COMPLETE**. Five before it: 4/5.

## What I changed that was pinned, and why

- **`tests/failure-state-regression.mjs`** — the counterweight is armed by the
  kennel now, so its hold-commitment page takes the same silent `restoreArm()`
  a respawn takes, and asserts the locked answer first (new check).
- **`tests/playthrough.mjs`** — pays the kennel cradle before the wheel. The
  kennel scare is on the critical path now; that is the point of item 3, not a
  cost of it.
- **`tools/probe-ossuary.mjs`** — stopped asserting "the first press moves the
  stone and nothing else", which is the contract he asked us to delete.

## Gates

Green on the final tree: smoke, autotest, regressions (157), playthrough
(COMPLETE), warm-start, basin-shore, choir-surfacing, district-culling (max
365 of 450; the occupied ossuary 142), render-perf, grip-contact,
failure-state, pump-release-recovery, house-critical-path,
enemy-standing-postclear, basement-foundations, window-scare,
house-return-horror, exterior-expansion, perf-pool, creature-audio,
enemy-stain.

Not green, all three explained:

- **`grave-arena-regression`** — the token finding above. One check was already
  red on the base tree ("quiet stuns and deliberate loud pops"); the other
  three are seed 583 losing at wave 2 and its downstream checks. His call.
- **`horror-expansion` ×1** — PRE-EXISTING, verified identical on the untouched
  base tree (`749f471`): "the chapel displacement is visibly first and remains
  non-attacking", choirCount 1. Nothing this round went near the Choir.
- **`house-expansion` ×1** — PRE-EXISTING, verified identical on base. It
  asserts a foyer lag mirror that `house.js` line 6 says was deliberately
  removed; the test was never updated. Somebody should retire that assertion.

`house-critical-path-regression` red-flagged once during the full run with a
Playwright NAVIGATION error, not an assertion — it was sharing the machine with
five concurrent playthroughs. Green on its own re-run. Same class as the
warm-start flake in ROUND-EIGHT.md: a red that means "no machine looked at the
code" is never a code failure.

New tools, all four of which are the evidence for their item:
`probe-wreck-destruction`, `probe-ossuary-arming`, `probe-pump-crossing`,
`probe-basement-dropcloth`. Shots in `tests/shots/r9-*.png` (gitignored, so
they live on this machine only); side-by-sides for him in
`scratch-r9-shots/car-before-after.png` and `wheel-dead-vs-armed.png`.

The six commits were split out of one verified tree rather than built up one at
a time, so the tree the suite went green on is exactly the tree at the tip —
but every intermediate file content was parsed with `node --check` before it
was written, and commit 3 of 6 (`74d5e90`) was smoke-tested in a throwaway
worktree. The history bisects.

## Still open

- **The graveyard fight's difficulty** — the token finding above. His call, and
  the only thing in this round that changes how hard the game is.
- The alarm never times out. It is destruction-or-nothing on purpose (his
  design: the noise is what hitting it costs), but if he finds it exhausting,
  the mercy knob is the resonance pulse, not the sound.
- The bridge still retracts under a player who crosses on a rewinding hold. The
  brief said to ask rather than decide, so it is untouched: **should the rewind
  freeze while you are standing on the bridge, or is a bridge going away under
  your feet a hazard he wants?**
- `docs/ROUND-EIGHT.md`'s two known flakes are unchanged in kind, but the
  playthrough's `Math.random()` basement is gone — it is seeded now, so if that
  flake returns it is something else.

---
---

# ROUND NINE — HIS FIVE NOTES. The brief (kept: it was right).

**Read this first when Alex says "fetch."** Written 2026-08-19 by the
round-eight thread (Fable 5), against `claude/aug18-round7-look` at `79cb927`,
for the next thread. Alex dictated five changes and asked for instructions,
not implementation — everything below was RESEARCHED against the live tree
(files read, root causes traced, line numbers current at `79cb927`), but no
code has been written. His words are quoted at the top of each item; his words
are the spec, and if a note here contradicts what he says in the thread, he
outranks this document.

**Where the game stands:** the hands round is LIVE (site PR #75, production
boot-checked). `docs/ROUND-EIGHT.md` is the record of it and carries the
skinned-hand traps (SkinnedMesh tools must use `applyBoneTransform`; the
grip-contact gate). **This branch is NOT pushed to `duplighost/fetch`** — the
worktree is the only git home of the live code. Work the same way this round
was worked: **stack a new worktree on `claude/aug18-round7-look`**
(`git worktree add C:\Users\Alex\Projects\fetch-aug19-round9 -b
claude/aug19-round9 claude/aug18-round7-look` from any fetch worktree), full
suite after every commit, one change per commit, open the PNGs.

**The suite** (output to files, never piped through tail alone): smoke,
autotest, regressions, playthrough (COMPLETE), warm-start, basin-shore,
choir-surfacing, district-culling, render-perf, **grip-contact-regression**
(new since round eight — run it with the others). Known flakes, both
documented in ROUND-EIGHT.md: playthrough (random basement walker — item 4
here may CURE it, see below) and warm-start's "press answered in the same
task" check (races a CDP round-trip; re-run before suspecting a commit).
Known permanently-red: `underfalls-expansion` ×2, `grave-arena-regression` ×1
(seeds 145/583).

---

## 1. DESTROY THE CAR, WITH AN ALARM

> "I want to be able to destroy the hell out of the car in the graveyard by
> throwing the skull at it. maybe it even has a car alarm going off before
> you destroy it."

**The car:** `src/outside.js` ~3499–3730. Group named `'wrecked station
wagon'` at position (-9, -0.02, 14), rotation y -0.96, in the graveyard.
It already has: a dying headlight — `game.wreckLens`, a lamp whose flicker
beat is driven at ~line 304–321 (`wreckLens.color.setScalar(0.055 + beat *
0.30)`) — a hanging door, window cracks, ejected-belongings debris group, and
a tight AABB collider built from `Box3.setFromObject`.

**The model to copy:** the breakable graves, same file ~900–990
(`breakableGrave:N` fetch targets). That is the game's blessed destructible
pattern: an `addFetchTarget` with an `onHit` that counts hits, fires POOLED
debris (fixed-size array, `d.active` recycling — never allocate per hit),
lowers the collider on the final hit, sets a `game.flag(...)` so the state
survives checkpoint restores, calls `game.impact`, `game.audio.stoneGrind`,
`game.player.noise = 1`, and `game.enemies.resonancePulse` (noise draws the
dead — keep that; it is his kind of consequence, and an alarm should crank it
harder).

**Suggested shape (his call on the details):** multi-stage. First hit — the
car ALARM starts: a two-tone siren plus the wreckLens strobing on the alarm
period (reuse the lamp — it is already in the light census; do NOT add a new
light, see traps). More hits — panels dent, `glassShatter` (already exists in
audio.js, used for the house window), belongings scatter. Final hits — the
alarm dies MID-WAIL (pitch sag into silence, the game's dying-machine
grammar), wreckLens to zero, settle thud, flag set. The alarm should also be
stoppable BY destruction only — that is the loop: noise draws walkers, the
only way to shut it up is to finish the job.

**Traps, all verified in the source:**
- **`batchStaticGroup(car, 'wrecked wagon')` at ~3717.** The car body is
  MERGED into pooled static batches. A batched mesh cannot move, dent, or
  vanish per-piece. Any panel that must animate or disappear has to be kept
  OUT of the batch (`userData.noBatch = true` before the batch call, or built
  after it) — decide the destructible pieces FIRST, then split them from the
  batch in the same commit that adds the target. Check draw cost after: the
  graveyard poses sit ~330–400 against the 450 ceiling
  (district-culling prints per-pose numbers).
- **No alarm sound exists.** audio.js is a synth kit (zero asset files by
  law): build `carAlarm()` alongside `bellRing`/`lockedRattle` — two
  alternating oscillator tones, spatialized at the car, ducked under dialogue
  beats, and HARD-CAPPED in duration/voices (check `__game.audio.voiceStats()`
  — the cave sound failure is still an open item; do not add an unbounded
  looping voice). Latch it off a flag so a checkpoint restore mid-alarm
  resumes or kills it deliberately, never doubles it.
- **Debris budget:** copy the graves' pooled debris, do not clone the pattern
  into a second pool if the graves' pool can be shared/enlarged.
- The car sits in the grave-arena fight space — run `grave-arena-regression`
  and `probe-graveyard` after; the arena's known-red seeds are pre-existing.
- Persistence: every visual stage must be derivable from flags/state so a
  director restore seats the pose (the exit-slab and lid tickers in
  outside.js are the model: pose derived from a scalar, sounds latched on
  thresholds so a forced restore skips the noise).

---

## 2. OSSUARY IN/OUT SHOULD WORK LIKE THE MARROW'S

> "The other you hit e to get in, and e to get out on the right things. but
> in this one you hit e, and it opens slowly, then you can walk over it and
> be teleported... the other one under the graveyard is perfect."

**Which is which:** the area with the two destroyable standing enemies, the
counterweight wheel, the sinking wall and the key at the top of the stairs is
the **OSSUARY** (`src/outside.js`, build starts ~1990). The one he calls
perfect is the **MARROW** (`src/marrow.js`): its `descend` (~659) just sets
`state._pendingDescend = true` — E, and you are down, next district tick; its
exit is E on the `'marrow way up'` toggle (~673–678). Instant both ways.

**The ossuary today** (this is the part he does not like): `descend()` at
~3025–3055 — first E starts the entry lid sliding (~0.9 s stone grind), and
`_descendOnOpen` auto-fires the teleport when the lid seats
(ticker ~3185–3187). So: press E, wait a second, get swallowed. The exit
(`climbBack`, ~2914–2929) is the same two-phase via `_ascendOnOpen`. There is
also a legacy walk-over trigger band inside `doDescendOssuary` (~2960–2968).

**The fix he wants:** E teleports IMMEDIATELY, both directions, exactly like
the marrow. Concretely: in `descend()`, when the verb is accepted (skull
held, lid unlocked), set `state._pendingDescend = true` right away — start
the lid slide too, as flavor that finishes behind you, but never gate the
teleport on it. Same for `climbBack` → `_pendingAscend`. Remove or ignore the
walk-over band (the E verb is the whole grammar now).

**Keep, verbatim — these are authored and asserted:**
- The empty-handed REFUSAL (lockedRattle + impact) in both `descend` and
  `doDescendOssuary` — a hole that refuses out loud is his fix from a
  previous round.
- The verb ARMS and the district ticker EXECUTES (`_pendingDescend` is
  consumed at ~3216) — the cullers must run on the surface pose. Do not
  teleport inside the interact callback.
- Everything inside `doDescendOssuary` after the teleport: enemy clears,
  `game.flag('ossuaryEntered')`, checkpoint, the facing-down-the-corridor yaw
  (`player.yaw = Math.PI` — he screenshotted the wall-facing arrival once).
- The lid tickers' restore property (pose derived from a scalar, `open` a
  threshold on it) — a director restore seats t = 1 in one assignment.
- The throat and exit-hatch fetch targets (`ossuaryThroat`,
  `ossuaryExitHatch`) — everything answers a throw.

**Gates that watch this exactly:** `district-culling-regression` asserts the
ossuary enter/exit visibility restore diffs and draw ceilings;
`tests/playthrough.mjs` walks the whole district. `probe-ossuary.mjs` and
`shot-ossuary-hatches.mjs` exist for shots.

---

## 3. THE BASKET ARMS THE WHEEL, AND THE ENEMIES LIVE IN THE ROOMS

> "there is a weighted basket thing you can use that does nothing in terms of
> gameplay. maybe it should be the thing that turns on that wheel/activates
> it at the end. make sure it looks deactivated and the basket thing that you
> throw the skull into clearly wires back to activate it. The area would also
> be cooler if the enemies in it were in some of those rooms."

**The basket** is the KENNEL CRADLE: `src/outside.js` ~2630–2683 — a hanging
ring-and-dish on the west wall at (OX-4.75, +1.02, OZ+12), fetch target
`'ossuaryKennelCradle'`, puzzle id `'ossuaryKennel'`. You throw the skull IN,
it anchors and weighs for 1.25 s, and a shutter opens on the lunger cell (the
scripted thing that throws itself at the bars, ~2686–2725). That is a scare
with no progression — which is exactly his "does nothing in terms of
gameplay."

**The wheel** is the COUNTERWEIGHT MECHANISM: ~2286–2360 (wheel, spokes,
axle, bearing, plinth, corbel, weight, chain — group `'ossuary gate
counterweight'` at OZ+26.2) with fetch target `'ossuaryCounterweight'`
(~3137–3149): skull anchors on the wheel 1.7 s (`state.progress` ticker
~3240), wall sinks, `gateKey1.reveal(...)` puts the key at the stair top,
resident lays itself to rest.

**His design, translated:**
1. The counterweight target starts DISABLED and the mechanism must LOOK dead
   — e.g. the pawl visibly engaged / no glow descriptor on the wheel; a
   thrown skull answers with the locked knock (grammar: everything answers,
   nothing is silent — see the throat target for the exact idiom).
2. Solving the kennel cradle ARMS it: on `puzzle.solved`, run a
   cause–wire–effect sentence to the wheel — travelling knocks along a
   conduit, then the wheel's glow/pawl releases and the target enables. The
   game already speaks this sentence twice: `openArchiveDraft()` in house.js
   (thunks travelling east to the furnace) and the exit-slab wiring right
   there in the ossuary (~2354–2358, "the basement's blessed vocabulary" —
   floor conduits via `world.box`, zero draws).
3. Lay a VISIBLE wire from the cradle back along the corridor to the
   mechanism plinth (world.box conduit segments, merged, zero draws), so the
   causality is readable before it is ever used.
- This puts the kennel scare on the critical path — the shutter beat now
  happens to everyone. That is a feature, not a cost.
- KEEP the counterweight hold itself (throw into the wheel, 1.7 s) as the
  second act; the cradle arms it, it does not replace it.

**The enemies into the rooms:** the two standing residents spawn inside
`doDescendOssuary` (~2993–3016) at corridor posts — west of the route at
(OX-1.6, OZ+20.4) and leaning from the east niche at (OX+2.1, OZ+18.6). The
niche/pocket geometry is authored at ~2150–2185 (`niches` array — real
recesses with bone stacks). Move the spawn posts INTO pockets (and keep
`home` matching so the tether math holds). **Keep:** `standing: true`,
`ossuaryResident: true`, `tether`, `mesh.userData.keepInOssuary = true` (the
district seal spares them by that marker), and the deliberate NO-POST ZONE
between z+15.4 and z+18.2 — that is the counterweight hold, where the player
stands still for 1.7 s with no skull in hand; nothing may be posted there.

---

## 4. THE DROPCLOTH ENEMY MUST SURVIVE A CHECKPOINT — ROOT CAUSE FOUND

> "if you die in the beginning and checkpoint, i don't think the enemy
> appears behind that thing in the basement... it would also be cool if those
> other dummies in the basement could be hit in the same way even if they
> arent enemies."

**He is right, and here is the exact mechanism.** `src/house.js` ~1410–1432:
the four dropcloths are built at HOUSE BUILD TIME (boot). One index is chosen
by `Math.random()` and that one spawns a real standing walker immediately —
`game.enemies.spawn('walker', ...)` at line ~1423 — wearing its sheet.
`src/director.js` `respawn()` at ~1141–1160 calls **`g.enemies.clear()`** —
ALL enemies. So any death before the player reaches the basement deletes the
dropcloth walker forever; nothing ever respawns it. Die in the opening, and
the basement's best scare is simply gone. That is precisely his report.

**Fix direction:** make it a lazy, re-armable spawner instead of a boot
spawn. Keep a record `{ spots, realIdx, consumed: false }`; spawn the walker
(wearing its sheet, exactly as now) when the player ENTERS the basement act
and the record is unconsumed; mark consumed only when it has actually woken /
been destroyed. `respawn()` clearing enemies then costs nothing — the next
basement entry re-arms it. Decide `realIdx` ONCE per run with the game's
seeded RNG (`util.js` RNG, like the ossuary vermin's `new RNG(0x05a1)`)
rather than `Math.random()`.

**Do it and you probably cure the playthrough flake too:** ROUND-EIGHT.md
carries it — `tests/playthrough.mjs` fails intermittently because this
boot-time `Math.random()` walker lands on the tested route. A deterministic
seed makes the suite reproducible. After the change, run playthrough FIVE
times and record it.

**The hittable dummies:** the three decoy sheets are static Groups
(`scene.add(sheet)`, same block). Give each a small fetch target: an outbound
hit topples/slumps the sheet (a ticker-driven fall like the forest gate
`weights` at ~1259–1330 — rotation + settle, no physics system), with
`clothDrag` + a thud, one-shot, flagged so restores keep them down. Under the
cloth: NOTHING — an empty collapse. The relief IS the scare, and it teaches
the sheets answer throws, which makes the real one's answer worse.

**Gates that watch this:** `house-critical-path-regression`,
`enemy-standing-postclear-regression`, `window-scare-regression`,
`house-return-horror-regression`, playthrough (repeatedly, see above).

---

## 5. THE PUMP-GALLERY LATCH CAN MISS THE CROSSING — ROOT CAUSE FOUND

> "you can get the gateway down and walk across the walkway to the last room
> without the thing you step on activating. i think it only activates once
> the gate is down all the way or for long enough... that seems confusing if
> the player misses it. I like the idea of disgusting bugs on the ground in
> that basement area too."

**The mechanism** (`src/house.js` ~6055–6460): holding the skull on the
cradle pays `route.progress` toward 1 over ~2 s; the far gate opens at
`progress > 0.94` (`setGateOpen`, ~6447); arriving on the far landing latches
the route — but ONLY while `route.progress > 0.9` (~6397:
`if (onFarLanding && route.progress > 0.9) latchRoute()`). **And progress
REWINDS at 0.34/s the moment the hold ends** (~6384). So: player weighs the
cradle, gate opens, hold expires (maxHold is 4.5 s), player walks the bridge
while progress rewinds, arrives on the far landing with progress at 0.7 — no
latch, no `pumpGalleryLatched` flag, no clank, and every later furnace
refusal points at a crossing they believe they made. That is his bug,
line-exact.

**Fix direction:** being on the far landing IS proof of the crossing — the
code's own comment at ~6387 argues the west bank is unreachable except over
the bridge, and the `onFarLanding` box already guards act, height, x and z.
So latch on arrival regardless of the instantaneous progress value: either
drop the `progress > 0.9` clause entirely, or set a sticky
`route._crossedWhileDown = true` when the player enters the bridge lane with
the gate open and accept that on the landing check. Consider also freezing
the rewind while the player is ON the bridge segments (a bridge retracting
under your feet is its own wrongness, unless he wants that as a hazard — ask
him, do not decide).

**THE TEST TRAP, verbatim from the source comment at ~6398:** "two tests
assert that exact threshold and two more cross on fixed [positions]" — grep
`pumpGalleryLatched` and `pumpFarPawl` across `tests/` and update those
assertions DELIBERATELY in the same commit, or the suite will red on a fix
that is correct.

**Keep:** the pawl fetch target (`pumpFarPawl`, ~6167) as the second honest
door; the pre-latch plate depress/creak band (separate, tighter box below the
latch line); `latchRoute()`'s audio sentence exactly.

**The bugs:** port the ossuary floor vermin VERBATIM — `src/outside.js`
~2730–2800: `BUG_N` instanced capsule-and-legs bodies in ONE InstancedMesh,
one draw, `MeshBasicMaterial` near-black, motion quantised to ~14 Hz so they
twitch instead of glide, seeded RNG, no colliders/lights/enemies entries.
Seed them along the pump-gallery wall bases, around the barrels, at the water
channel lip. One draw, zero census impact; the pattern was BUILT to be
portable and the comment on it says whose idea it was. Check the basement
pose in district-culling after (~430s against 450 pre-round-nine; the
skinned hands bought ~64 draws of headroom back).

---

## The standing brief

Unchanged, and it is the law: he funds ambition, plays live, forgives rough
but not broken. When he repeats himself it is because we did not do it the
first time. Value, shape, motion — never hue alone (NOT because he is
colorblind; that memory was wrong and is corrected — it is because these are
dark rooms lit by one carried light). No HUD, no words, no control theft;
copy is his voice. **When he describes what he sees, measure the thing he
described** — round eight's 38 mm of air was found by finally taking his
sentence literally. Raid his other games before writing anything fresh. An
object is never finished; a frame is. And deploy nothing without his
approval: the recipe is in ROUND-EIGHT-HANDS.md §Deploying and it was
exercised twice this week — copy changed `src/` files (LF) into the site
repo, 22/22 byte-identical, boot-check local → PR → boot-check preview → his
word → merge → boot-check production.
