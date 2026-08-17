# HANDOFF — 2026-08-17: ROUND FOUR (branch claude/aug17-notes)

Written by Claude Fable 5 for Claude Opus 5 — same arrangement as the last two
rounds: Fable plans, Opus builds, and it has worked twice. Work at a lean
spend: no agent fan-outs, batch edits, targeted probes between gate runs.

## Where you are

- Worktree `C:\Users\Alex\Projects\fetch-aug17`, branch `claude/aug17-notes`,
  branched off `4e33618` = the tip of `claude/aug16-notes` = game PR #29
  (OPEN, stacked on #28 → #27) = what is LIVE at qualiacology.com/fetch via
  site PR #68. Your PR will be #30, fourth storey of the same stack, base
  `claude/aug16-notes`. Do not rebase anything. The shared checkout
  `Projects\fetch-claude` is STALE — worktrees only.
- THE SPEC is `docs/CHANGE-ORDER-2026-08-17.md` — Alex's live-play notes
  verbatim (he HAS now played Round Three), plus his fourteen screenshots
  decoded. His words outrank this plan.
- THE RECON is `docs/analysis/recon-2026-08-17.json` — six subsystem reports
  (summary / code_map / diagnosis / edit_points / risks / tests) produced by
  parallel readers against THIS exact tree. The `code_map` entries carry the
  file:line anchors this plan deliberately does not repeat — read the matching
  key as you start each task. Line numbers drift as you edit; trust function
  and flag names over numbers as the build progresses.
- Read first: `AGENTS.md`, then the two round-three sections below this one,
  then the spec, then the recon key per task.
- DEPLOY AUTHORIZATION: Alex, in chat, this round: "we will update the
  website in opus 5 instructions like at the end of last round like it said
  there." Same law as last round: merge the site PR only once every gate and
  the boot-check are green, then verify production boot, and tell Alex to
  HARD-REFRESH before he plays.

## What the recon overturned (read this before building anything)

1. **Last round's "the gate's 3-key logic was airtight" was WRONG — reopen
   it.** The §3 respawn bug is real, reproduced in code, and verified
   verbatim by the planner: `gateKeys.restore()` (outside.js ~1427) replays
   the `gateKeyBanked:<n>` flag by KEY NUMBER onto SOCKET INDEX n-1, while
   `bankAny()` seats keys in the LOWEST EMPTY socket. Bank out of order, die
   anywhere (marrow is just the likeliest place), respawn → phantom filled
   sockets, `_opened` latches true WITHOUT opening, `graveyardCleared` never
   flags, all three weights drop across the gate, and every further bank
   refuses with the locked rattle. Permanent softlock. The same mismatch,
   one death earlier, opens the gate on TWO real keys — which is almost
   certainly what Alex actually saw last round when the previous recon closed
   his report as a miscount. No test ever calls restore(); the playthrough
   banks in ascending order, so the whole suite is structurally blind to it.
2. **The §8 walkway block is the ossuary's forest-side ARRIVAL HATCH** — a
   pale stone lid + curb ring + a solid 1.36 m collider planted dead centre
   of the gate gap, serving a climb-out route that `const hatchT = 0` seals
   forever. Orphan scenery. It gets DELETED, not retracted — it obstructs
   identically before the gate opens, and the walkway-band regression missed
   it because it only reads the three weight meshes, not colliders.
3. **The ossuary's "weight that does nothing" already lowers a real wall, and
   the "weird wall at the beginning" is a MISSING wall.** The counterweight
   already sinks `exitSlab` (a full-corridor stone) — but gateKey1 spawns
   2.75 m in FRONT of that wall, so the wall gates nothing the player wants;
   §6 and §7 are the same design bug seen from two ends. Moving the key to
   the stair top makes the existing mechanism load-bearing; no second wall is
   built. And the corridor's near end has NO cap mesh and NO collider — the
   flat dark-blue plane Alex photographed is the renderer's clear colour seen
   through the open end of the model.
4. **The §1 window scare is five compounding bugs, not a short timer.** The
   fully-risen figure exists for 0.85 s total; staring at it makes it leave
   FASTER (dt/3.1 watched vs dt/6 unwatched); walking toward it deletes it
   instantly and permanently; looking away for 0.55 s deletes it (the
   author's own guard at ~house.js:4509 is dead code — spawn sets w.t to
   exactly the value the strict `<` compares against); and the unwatched
   creep completes the whole beat off-camera in 3 s — recorded flag dumps
   prove it fires unseen in unrelated tests. Audio fires the same frame as
   the reveal, inverting the audio-first law. Zero tests pin any of it.
5. **The §13 hands are rolled exactly 180° about their own finger axis, and
   the fix must land in finale.js, not skull.js.** `_updatePressure`
   (finale.js ~921-938) rewrites both hand rotations EVERY frame after
   skull.update — a skull.js pose fix passes a probe and changes nothing on
   screen. The mirror is provably unaffected: the viewmodel lives on
   LAYER_HELD, which the mirror cameras' MASK_DOUBLE never renders; the
   hands in the glass are the reflection body's own authored hands.
6. **The binding budget is GEOMETRIES, not draws.** smoke.mjs caps
   `geometries < 1500` and the mirror act records 1472 — 28 free, cumulative
   game-wide, never written down until now. The falls-field spec spends ≤5.
   Run smoke first after adding any new BufferGeometry; if maxGeometries
   crosses 1490, cut the optional soil-burst mesh first. Draws are roomy:
   clearing 210/450, occupied ossuary 222/450; the tight frame remains
   house-after-cave at 448/450, which act-gated falls/ossuary work never
   touches as long as new objects ride `state.roots` / `routeRoot`.

## Decisions already taken (don't relitigate)

- **Gate restore() is rewritten in the count-derivation form** [recon:
  gate-respawn, edit 1]: derive n from the `gateKeyBanked:1..3` flags, fill
  the lowest n sockets, and if n ≥ 3 either latch `_opened` (when
  `graveyardCleared` already set) or call `openTheGate()` — which also
  self-heals a session already corrupted. Idempotent (restore runs TWICE per
  respawn). Do NOT rename the flag (makeGateKey reads it correctly by key
  number); do NOT re-key bankAny() to seat by key number — the bottom-up
  tally is the no-HUD progress read. Harden openTheGate()'s guard so
  `_opened` can never hold while the gate is shut.
- **The invariant is "progress survives death"** — flags never clear, the
  carried key survives, the ossuary force-restores solved. Do not invent a
  key-return mechanic.
- **The arrival hatch is deleted wholesale** [recon: gate-respawn, edits
  5-6; the ossuary recon's C7 defers to this]: geometry, collider,
  `state.arrival`, the lookback-roots push, and every dangling animation
  reference (`arrival.pivot`, `arrivalKick`) — leaving one behind throws in
  the ossuary ticker every frame. regressions' `ossuary-climb` pins the slab
  SHUT today (`arrival.pivot.rotation.x > -0.02`) — rewrite to assert-gone.
- **Basement = the pawl becomes a flush pressure plate** (Alex's option b)
  [recon: basement]: slide to the end of the bridge deck on the crossing
  centerline (-17.72, B, -3), lid sunk to a 10 cm plate, tines interlocking
  into a below-floor keeper, jaw drive re-aimed to sink the lid flush. THE
  LATCH LINE DOES NOT MOVE: `onFarLanding` (x < -17.28) stays byte-identical
  — two tests assert that threshold and two more use fixed-duration
  crossings with no slack. The new plate band (east edge -17.32) drives only
  a pre-latch visual/audio depress. Keep the throw door alive by switching
  the fetch target from `object: pawl` to a fixed `pos` at B+0.5 — sinking
  the group would silently drop the catch sphere to ankle height.
- **Ossuary entry and exit are E-verb hatches; the swap still executes in
  the ticker** [recon: ossuary, group A]: the entry reuses the EXISTING
  surfaceSlab slide pose driven by a new `entryLid` scalar instead of the
  funeral; a new near-end cap wall kills the dark-blue void AND the
  groundHeightAt fall-through, with a matching exit hatch cut into it.
  Verbs ARM, the district ticker EXECUTES — a swap called from an interact
  action corrupts the seal's save/restore maps. Every new state is a scalar
  the director restore can seat in one assignment. The lid opens regardless
  of skull state; only the swap requires the held skull. Exit arrival faces
  OUT (yaw 0), not the mausoleum's back wall.
- **Ossuary enemies**: the caged LUNGER behind the kennel bars (scripted
  mesh on a ticker, ONE merged geometry, never an Enemies-system walker — it
  would grind on the bars) + a second tethered Standing-Kind at the east
  pocket (tether 1.8, `ossuaryResident` + `keepInOssuary` or it survives the
  exit teleports as a phantom). The lunger retires when the kennel solves so
  the seated-witness reveal keeps its quiet beat. Nothing between z 15.4 and
  18.2 (the counterweight hold), nothing untethered in the corridor.
- **Top of stairs = plain ceiling; gateKey1 moves up there** [recon:
  ossuary, group C]: delete lid kit, permalock chains, mouth dressing; close
  the deck with one merged slab (check the 1.9 m headroom with a shot; raise
  DECK_Y if it reads low); reveal the key at world (-72.45, ~-0.75, 24.7) —
  beyond the exit slab, so the weight finally gates the thing the player
  wants. Keep the counted-take chord; do not switch to giveToJaw.
  tools/shot-lid.mjs and shot-aug14's pose 05 are orphaned — retire or
  retarget in the same commit. 'ossuaryExited' goes dead — grep it out of
  src and tests together.
- **Bugs on the ossuary floor = a new one-draw instanced scuttle patch**
  [recon: ossuary, D7-D10] — nothing exists to reuse (verified). Unlit
  near-black silhouettes (the spider look-law), stop-motion quantised
  twitch, dart-away + throttled skitter audio. No colliders, no targets, no
  lights. `noBatch`, routeRoot child.
- **Falls popups go full marrow** [recon: falls-field, group A]: KIN 6 → 22
  (instanced — zero extra draws), 16 new sites CLUSTERED on the wheel and
  gong approaches (all verified ≥2.4 m clear of every playthrough walk leg),
  ease-out under-floor breach + vertical stretch + lateral shudder + LOOM
  (40% taller as you close) + marrow's 0.32 s splay-fold + the two-thud
  under-your-feet tail + walkerRise layered under the crack-thud. Stagger
  arrivals (audio has no voice cap — 6-8 simultaneous breaches would clip
  the bus). Re-arm 'gone' sites at d > 14, capped ~3. NO colliders, NO
  fetch targets, NO damage, NO death — walk-through is the verb.
- **The map edge closes by APPENDING, not editing** [recon: falls-field,
  group B]: a fourth tree-placement pass on a NEW RNG seed (the 0x9f21
  stream is position-order-dependent — editing the existing loop moves all
  92 trees and invalidates every shot; same precedent as last round's
  perimeter masses), denser far-z mass rows, corner aprons, and silhouette
  masses closing the south sightline WITHOUT colliders (the arrival corridor
  must stay open).
- **The pond**: both far streams end in pooled termini at C-relative
  (±23.3, -22.5) — one 2-instance CircleGeometry InstancedMesh sharing the
  existing waterMat (the feederPoolMesh recipe), world.box bank rings,
  instanced reeds. +1 draw, +1 geometry, clear of walk legs, fire lines and
  brazier arrays ("not in front of the things that create the two things").
- **River crossing = stepping stones as pure signage** — the streams are
  ALREADY walkable (no collider, no terrain change); do not touch physics.
  One instanced flat-top stone set, ≥1.6× the stream's luminance + small
  emissive, three crossings per stream. And the basin gets the opposite
  read: a FOAM LINE moved out to the actual lethal edge (the ring today
  stops 2.5 m short), raised bank masses BESIDE the |x|<3.0 lip gap (never
  in it — the bridge stones rise through that lane), glassy-black centre.
  The learned rule: foam + stone lip = death; flat + stepping stones =
  cross. Value and shape, never hue.
- **The throw glow** [recon: falls-field, group C]: hang on `fallsThawed` +
  the 'waterfall' target's own enabled bit; three layers — ~90 converging
  kind-1 motes spiralling into the mouth, one corona sprite breathing at
  (C.x, 8.0, C.z+19.55), and the EXISTING dormant fallGlow PointLight
  repositioned/brightened (pinned at boot — animating intensity cannot
  recompile; never write its colour). NO new light, NO candle descriptor
  (the pool is 8/8 at the shore braziers — evicting one breaks the
  colorblind fire read). Gated absent-before-thaw, faded after
  'waterfallTaken' (a glow that outlives the bargain is a UI leftover).
  One placed audio cue as it arrives; tighten the skull's head-turn gesture
  to gaze at the exact target point.
- **The Choir** [recon: underfalls-finale, group A]: take variant A2a — the
  trigger moves to chapel.z - 4 and the spawn stands across the chapel
  ~16.5 m dead ahead in its own light ("way in front of you"); drySpeed
  1.55 → 2.60 (heardSpeed UNTOUCHED — it must stay under RUN or running
  stops being the escape); attackRange 2.30, attackCommit 0.92, attackRadius
  1.30, recovery 0.95, warning 2.20; spray slow 0.35 → 0.55 with the commit
  veto at wetT ≤ 0.4 and a shortened drench; dy gate 0.72 → 1.05 in BOTH
  places; and a lowerSluice RESEAT (never a second beginDrownedChoir — it
  restarts the audio loop and horror-expansion pins loops.length === 2).
  The survivability inequality (WALK × commit = 2.48 > radius 1.30, margin
  1.9×) is the contract — run the full playthrough after every constant
  change; do not let the walking bot die.
- **The hands** [recon: underfalls-finale, group B]: authored RAISED_L /
  RAISED_R constants in finale.js — the ±π roll about each hand's own local
  Z (finger axis) with base rx lifted to ~-1.24 — applied to BOTH lerp
  endpoints (rolling only one end spins the hand through palm-toward-camera
  during a press). Do NOT mirror the geometry (that makes a left hand on
  the right wrist). Add the relative-quaternion orientation check the recon
  specs — it fails today and passes after the fix — and re-run
  tools/shot-bone-hands.mjs: knuckles and metacarpal fan toward the lens,
  and NOTHING in the mirror may change between before/after.

## The plan, in build order

Each task: read `docs/analysis/recon-2026-08-17.json` → that key's
`code_map` + `edit_points` + `tests` first. They are the instructions; this
list is the order and the intent.

1. **GATE — fix restore(), delete the arrival hatch** [recon: gate-respawn]
   §3 + §8. The bug of the round, and the smallest diff. restore() rewrite,
   openTheGate() guard, reset() symmetry note, hatch deletion with all six
   dangling references, ossuary-climb rewrite. New pins: the out-of-order
   bank × respawn matrix (all 6 orders — the bug hides in 5 of them), the
   softlock invariant (banked ≥ 3 ⇒ gate open or opening), and the
   collider-scan + straight-walk walkway pin that replaces the weights-only
   band check. Do this first: everything else in the graveyard builds on a
   gate that can be trusted.

2. **FINALE HANDS — the π roll** [recon: underfalls-finale, group B]
   §13. Tiny, isolated, huge payoff. RAISED_L/RAISED_R, both endpoints,
   orientation pin, shot pair.

3. **WINDOW SCARE — let it be seen** [recon: window-scare]
   §1. All ten edit points are one beat in house.js: audio lead-in before
   pixels, unwatched creep capped at 0.82 (it can never complete unseen),
   watched advance slowed and made a HOLD (press state, ~3 s at the pane,
   view-cone proof with a real LOS test — cone widening and LOS ship
   together), look-away FREEZES instead of deleting (the crawler's law),
   close-approach recoils instead of vanishing, slower sash/fold/skitter,
   landing pose out of the floorboards, arm gated on landing presence.
   Watch the Resident-delay overlap (HOUSE_RESIDENT_DELAY = 18) and audit
   all five `root.visible` writers before adding states. New test modelled
   verbatim on the crawler's (house-critical-path:873) using the existing
   `windowWatcher.force(0)` hook, plus a playthrough landing beat.

4. **BASEMENT — the pawl earns its position** [recon: basement]
   §2. Relocate + flatten to the plate, re-aim the jaw drive (kill the
   hard-coded -17.48 slide), fetch target to fixed pos, plate band WEST of
   the latch line, conduit stub, no collider, no new light. New
   basement-foundations assertion pinning position + height so it can never
   drift back into a wall.

5. **OSSUARY — hatches, key, enemies, vermin** [recon: ossuary]
   §4-§7. The biggest task; take it in the recon's A → C → D → B order:
   entry lid first (A1-A5), near cap wall + exit hatch (A6-A11), then the
   stair-top deletion + key move (C1-C10), then the wall framing/wiring/
   sound (D1-D5) and the scuttle patch (D6-D10), then the lunger + the
   east-pocket walker (B1-B6). Five test files change (probe-ossuary,
   regressions ossuary-climb + ossuary-kennel, district-culling forward-exit
   block, playthrough ossuary leg) — rewrite them deliberately, never stub.
   The seal, batching, ordering and restore laws at the top of the recon's
   risks are the four ways this task goes wrong.

6. **FALLS FIELD — eruptors, edge, pond, stones, glow** [recon: falls-field]
   §9-§11. A (kin) is free in draws and mostly arithmetic; B (edge/pond/
   stones/basin) is world.box + two instanced meshes; C (glow) is three
   layers on existing anchors. Respect the RNG-append rule, the geometry
   budget, the candle pool, the wheel's 'anchor' contract, and the
   no-fetch-target trap. New falls-field-regression suite + the before/after
   thaw shot pair; extend probe-bounds' clearing rows to prove the world
   actually closed.

7. **CHOIR — harder, seen coming** [recon: underfalls-finale, group A]
   §12. Arc-length helpers, A2a trigger + spawn, the constants, the reseat,
   getDrownedChoirState extensions. horror-expansion's stand-point and
   warning literals move; choir-route-occlusion gets the new gate
   suppressed. Then run the playthrough TWICE — the walking-survivability
   beat is the acceptance test, and the known 'fire-refused-the-skull'
   flake (~1 in 3, unrelated) means one red run proves nothing. Last in the
   order because it is the only task that can destabilise the long gate.

## Gates, ship, deploy

- All four gates green before merge: autotest, regressions, smoke,
  playthrough — plus district-culling, render-perf, and the probes/tools
  named per task. Known pre-existing failure that is NOT yours:
  underfalls-expansion's mirror-room reflected-body check (the 1.6 s fade;
  documented last round). Known flake: playthrough 'fire-refused-the-skull'
  ~1 in 3 — re-run before believing it.
- Record the new clearing draw number and the new maxGeometries in this
  file when you close the round, the way 203→210 was recorded.
- Commit style: repo default identity, `Co-Authored-By:` your model tag,
  lane-scoped messages like the log below.
- PR #30 base `claude/aug16-notes`. Then the site: shell-copy `src/` +
  runtime assets into the qualiacology repo per ITS AGENTS.md (read it
  first), site PR, merge on green + boot-check, verify production, and the
  closing HANDOFF section here: what shipped, what was not what it looked
  like, numbers, and anything still open. Tell Alex to HARD-REFRESH.

---

# HANDOFF — 2026-08-17: ROUND THREE IS BUILT AND LIVE (branch claude/aug16-notes)

All nine of Alex's 2026-08-16 notes are built, gated and deployed.
Game PR **#29** (open, stacks on #28 → #27 — do not rebase).
Site PR **#68 MERGED**; production boot-checked green.
**HE HAS NOT PLAYED IT YET. Tell him to HARD-REFRESH before he does.**

## What shipped, by his numbered note

- **§1 basement contraption** — the crawl-wing cage is the pump winch's drive
  weight now. The winch refuses the skull until it hangs, with a locked rattle
  at the drum and three knocks walking back east to the cage; a conduit run
  joins the two so they read as one machine. Bonus: the decorative boiler
  answers a throw and hops two knocks toward the incinerator.
- **§2 perimeter** — two more M.dirt aprons close z 16..44 on both fence sides
  (the aug15 aprons stopped at 16 and its own 22 masses a side stood on
  blackness), 34 new masses, a nearer treeline ring at 26-42 m, grass past the
  rails. Zero draws: the gate header went into the metal batch to pay for the
  latch chains, so house-after-cave holds at 448/450.
- **§3 key tree** — one large limb hanging ACROSS the way in, key near its
  shoulder, body over its middle, one hit fells it. Balls gone.
- **§4 marrow** — altar keeps only gate key 2 (visible from the first frame,
  takeable on the guardian's yield); the relic moved to hero grave #6 as a
  second sequential fetch after the canine.
- **§5 ossuary** — see "what it actually was" below.
- **§6 gate** — weights count the sockets, hang on chains, retract at open.
  Every gate-key take now plays the lock-stone's chord.
- **§7 past the woods** — two tree-lined paths (92 trees, placed by a rejection
  test that keeps them off the basin, both fire lines, both brazier arrays and
  every playthrough walk line), the layer's first colliders, ground aprons and
  50 masses beyond them, a stream on each far side, and six merged marrow kin
  that rise, loom, and fold when you walk into them. No damage, no death.
- **§8 Drowned Choir** — arms in the chapel (was the lower sluice, ~60% in),
  stands across the room (was 3 m behind you), dry visibility floors raised
  from 0.001-0.02 to 0.018-0.19, reveals decay at 0.62×, spray slows it to a
  third instead of 8%.
- **§9 finale hands** — a real skeleton: phalanx shafts and condyles inside the
  same k1/k2 groups, four metacarpals and a carpal block, no webbing, no
  nails. Bone at `Finale.begin()`, raised at the 'still'→'closing' beat.

## The three things that were not what they looked like

1. **The ossuary "can't be entered" was ONE CENTIMETRE.** Its void plane sat at
   y 0.035 under the mausoleum's interior dirt slab (top face 0.045), so the
   way down rendered as unbroken floor and its five stair treads were inside
   solid geometry. The trigger had always worked. It wears the marrow mouth's
   grammar now — void at 0.07, broken slabs around it — because that is the
   hatch he DID find.
2. **The gate's 3-key logic was airtight.** His count was off because gateKey2
   rode into the jaw silently with the relic. The floating things were the
   latch weights.
3. **The Choir was never missing.** It was authored where he could not look.

## Traps this round added to the pile

- **Cutting a hole in a merged shell floor makes an AO seam.** Splitting the
  3×3 dirt slab into strips produced two bright pale-blue quads — same
  material, same y, different baked per-vertex occlusion. Reverted.
- **`mergeGeometries` returns null when the list mixes indexed and non-indexed
  geometry.** PolyhedronGeometry (Icosahedron/Dodecahedron) is non-indexed. It
  surfaces four frames later as a null read inside three's attribute cache, in
  a stack with none of your code in it.
- **A fetch target you did not think about eats the throw.** The key-tree
  payload landed 0.5 m from the destructible headstone at (7.2, 13.4) and that
  stone's target swallowed every throw at the key, a metre short, in silence.
  Wrap every `world.fetchTargets[].onHit` and print WHICH one fired.
- **A long prop pointed down the approach reads as a pole.** The branch had to
  be swung 90°.
- **Two suites were lying.** `horror-expansion` vanished the skull BEFORE
  teleporting (the settle-arrival path puts a gone skull back in your hands);
  `probe-bounds` set yaw without `_sync`, so every act past the graveyard
  reported "max walk 0m" and "no escapes" had never tested the clearing.

## Numbers and what is still open

Gates: smoke, autotest 26, regressions **135**, playthrough COMPLETE,
render-perf, district-culling 14 (max 448/450). Clearing 203→210 draws,
act-gated. New tools: `probe-gate`, `probe-key-tree`, `shot-falls-field`,
`shot-bone-hands`; `probe-ossuary` and `probe-bounds` rewritten.

**STILL FAILING, PRE-EXISTING, NOT THIS ROUND** (verified by reverting
src/enemies.js + src/director.js to HEAD~1 and reproducing): one check in
`tests/underfalls-expansion.mjs` — "the live hatch enters the mirror room with
its reflected body still visible on the next frame". `enterMirrorRoom` runs
behind a 1.6 s fade; the game itself is fine (the playthrough reaches the
mirror room). Same class as the horror-expansion staging bug fixed here.

**NOT TOUCHED, and worth knowing:** the west mausoleum interior still reads as
a bright box (mean luminance ~0.51 in the throat band, measured; nothing
clips). That is on Alex's aug14 list, not the aug16 one.

---

# HANDOFF - 2026-08-16: ROUND THREE (branch claude/aug16-notes)

Written by Claude Fable 5 for Claude Opus 5 — same arrangement as last round:
Fable plans, Opus builds, and it worked. Work at a lean spend: no agent
fan-outs, batch edits, targeted probes between gate runs.

## Where you are

- Worktree `C:\Users\Alex\Projects\fetch-aug16`, branch `claude/aug16-notes`,
  branched off `3ff1a78` = `claude/aug15-notes` = game PR #28 (OPEN, stacked on
  #27) = what is LIVE at qualiacology.com/fetch via site PRs #63-65. Your PR
  will be #29, third storey of the same stack. Do not rebase anything.
- THE SPEC is `docs/CHANGE-ORDER-2026-08-16.md` — Alex's live-play notes
  verbatim, plus his six screenshots decoded. His words outrank this plan.
- THE RECON is `docs/analysis/recon-2026-08-16.json` — eight subsystem reports
  (summary / code_map / diagnosis / edit_points / risks) produced by parallel
  readers against THIS exact tree on 2026-08-16. The `code_map` fields carry
  the file:line anchors this plan deliberately does not repeat — read the
  matching entry as you start each task. Line numbers drift as you edit; trust
  function and flag names over numbers as the build progresses.
- Read first: `AGENTS.md`, then the aug15 handoff section below this one (what
  just shipped), then the spec, then the recon entry per task.
- DEPLOY AUTHORIZATION: Alex, in chat, this round: "he should update the game
  on my website when he's done." That is the explicit approval the merge law
  requires. Merge the site PR once every gate and the boot-check are green,
  then verify production boot.

## What the recon overturned (read this before building anything)

Three of Alex's items are not what they look like. Each still gets real work —
but the work is legibility, not logic repair. This is the FETCH legibility law
again: the recurring failure mode is working-but-illegible.

1. **The gate logic is airtight.** Three banked sockets, no early-open path,
   no double-banking, no persistence to import stale state (recon: gate).
   What Alex lived: gateKey2 rides into the jaw SILENTLY with the marrow relic
   grab, so his key count was off by one, and the sockets can also bank a
   carried key on any grazing throw. His "partly opened" was the 2.1 s swing
   observed mid-arc. The FLOATING THINGS are real and confirmed: the three
   latch WEIGHTS (outside.js ~1030-1038) — an orphaned pre-aug15 "gate learns
   the ritual" visual — get lerped to torso height in the walkway by
   setRitualStage(3) and hang there chainless forever.
2. **The ossuary entrance is NOT broken on this branch.** The recon reader
   drove the live build headless and a WALKING player enters the west
   mausoleum under-yard, walks back out two-way, finds the far end sealed, and
   the counterweight pays out gateKey1 — fresh-resolution and restored-save
   paths both verified. Alex's words match the aug14 build he played before,
   OR the real live defect: the entrance is a silent walk-over trigger with NO
   E-verb, NO fetch answer, NO prompt, and it looks exactly like the four
   open-grave voids the game TEACHES are solid walls. Plus crossing without
   the skull held refuses silently. So the game itself tells him not to try.
   Fix the grammar, not the trigger. (Also tell Alex: hard-refresh — a stale
   tab across the deploy shows the aug14 behavior. HANDOFF trap #1.)
3. **The Drowned Choir exists, spawns, and is unchanged** — it is authored
   invisible: arms at ~60% through the district, spawns 3-4 m BEHIND you,
   chases your footstep breadcrumbs so it structurally stays in your rear
   180°, and its dry materials sit at opacity 0.001-0.02. A walking player
   hears ambience; a running player can never be caught. It was always "just
   one" — Alex remembers right. The fix is presence, visibility floor, and
   interception inside the view cone.

## Decisions already taken (don't relitigate)

- **Gate weights become the key tally**: re-key the weight ticker's `down`
  off `gateKeys.banked()` — one weight drops per banked key, a readable count
  — and at open they retract flush under the header, out of the walkway. Add
  the walkway-band regression (gate recon, edit point 6).
- **Key 2 must land audibly**: the auto-jaw at the marrow altar stays a single
  grab, but it gets the unlock/metalDrop + skull-flourish answer so the third
  key is a COUNTED event (gate recon, edit point 5) — except the relic is
  leaving the altar entirely (below), so the sound rides the key take itself.
- **Key tree**: ONE solid hit fells the payload — Alex's own words; do not
  port the fallen-tree 3-hit count. The key is visible at the canopy top but
  its fetch target enables only after the branch is hit. Gate the fetch at the
  target/reveal timing, NEVER by adding LOS/reach guards in skull.js —
  _checkTargets and FEEL_PROFILE are frozen.
- **Marrow altar**: the relic LEAVES the altar; only gateKey2 remains ("so
  just the key is there"). Reveal keys off guardian yield; the mourner hunt
  and the escort beat re-trigger on flag 'gotgateKey2' (the key take), so the
  room still turns on the frame the prize leaves it. With a single fetch there
  is no second aimed throw, so aug15 decision #1's death-trap reasoning stays
  satisfied without the silent auto-jaw.
- **"Both powerups in the same spot"** = sequential double fetch at hero grave
  #6's rubble: Iron Canine first (unchanged — pierce + danger sense), then the
  RELIC reveals as a keepsake second fetch (offset ~0.6 m, enabled after
  'skullSharpened', anti-scoop settle, jaw-dangle on take). The relic is
  mechanically empty in this build — danger sense already lives on the canine
  and skullPower has no level 3 — it is a keepsake and that is fine. Do not
  invent a new mechanic for it.
- **Basement = recon Proposal A**: the crawl-wing cage/counterweight is the
  pump-works drive weight. The pump winch cradle refuses the skull (locked
  rattle + impact + a knock-ladder nudge walking back to the cage) until
  'crawlSecretSolved'. Keep the flag NAME verbatim. Conduit dressing via
  world.box merged batches. Bonus while you are in the room (cheap, lawful):
  give the decorative K.boiler door a refusal voice — lockedRattle + a knock
  hop toward the real incinerator.
- **Falls field: NO boss fights.** Alex replaced that idea with harmless
  popups. Popups = the marrow walk-through-yield erupt/fold pattern in a
  MERGED low-draw body (≤10 draws each — a raw Presence is ~78, never port it
  as-is) plus Dark Eyes blink scares. No damage, no director.death, no
  enemies.spawn — they live outside the Enemies system like the Presence does.
- **Finale**: becomeBone at Finale.begin(); raiseHands(Infinity) at the
  'still'→'closing' mirrors-wake transition (keep the contact-time call as a
  no-op-safe reinforcement); REAL phalanx geometry grafted onto the existing
  mkFinger k1/k2 rig. Preserve the `_handSkin.skin` object identity and the
  color copy from g.mats.bone — the playthrough pin compares exactly that.

## The plan, in build order

Each task: read `docs/analysis/recon-2026-08-16.json` → that key's
`code_map` + `edit_points` first. They are the instructions; this list is the
order and the intent.

1. **GATE — ground the weights, make the count legible** [recon: gate]
   Weights re-keyed to banked(), retract at open, hanger geometry only if any
   suspended pose survives; keep graveyardLookbackRoots coherent (it spreads
   ...gate.weights); gate.reset() must stay symmetric with the new rest pose.
   New regression: after third bank + 2.2 s, gate.open AND no weight occupies
   the walk band. Small task, do it first, it removes a live embarrassment.

2. **KEY TREE — the hanging branch** [recon: key-tree]
   Replace the 13-ball climb inside buildKeyTreeClimb: on 'graveyardResolved'
   ONE large branch pays down out of the canopy (house.js branch-cylinder
   grammar, bigger; AABB collider; fetch target radius ~2.0-2.55 whose onHit
   returns 'return'). One powered hit: branch tears/sways, skeleton BONES
   (re-authored from the put() parts list as merged chunks or one instanced
   set — NO skull among them, keep the empty head-cradle) and gateKey3 fall
   via detachBoard-style tickers to the grass. Key target enables only
   post-hit; reveal at the ground rest point; keep makeGateKey's API
   untouched. Delete the tread ramps and step lamps; keep one candle
   descriptor on the payload. Keep climb.drop()'s name/flag contract
   (director calls it). The balls' flicker root cause (stale InstancedMesh
   bounding sphere — the one builder missing frustumCulled=false) dies with
   the balls; apply the idiom to any new InstancedMesh you make.
   Playthrough KEY THREE section rewritten (climb beats → branch-hit beats);
   'gate-takes-three-keys-in-any-order' survives untouched.

3. **OSSUARY — give the entrance a voice** [recon: ossuary]
   Factor the entry-swap body into doDescendOssuary(); register an
   'ossuaryDescend' E-verb on the throat (marrow's arm-then-ticker grammar),
   enabled when unlocked && !inOssuary && act graveyard; keep the walk-over
   trigger calling the same function. Answer the skull-not-held cross with
   the lockedRattle/knock refusal instead of silence. Brighten the throat
   read (value/motion — entryLamp exists) so "descend here" separates from
   the four solid grave voids. registerInteract adds an invisible hit mesh at
   scene top level — userData.noBatch it and check the ossuary seal's
   keepInOssuary set and district-culling. Rewrite tools/probe-ossuary.mjs
   (STALE: teleports in, demands the retired forest exit, exits 1 today) to
   walk the doorway and assert the aug15 truths.

4. **MARROW — just the key; both powerups at the gravestone** [recon: marrow]
   Remove the relic build/throb/take from the altar; gateKey2 reveals off
   guardian yield at the altar top; hunt (marrow.js ~721) and escort beat
   re-trigger on 'gotgateKey2'; keep the altar's skullPass collider; keep the
   pre-yield refusal beat pointed at the key (a pre-yield throw must still
   answer). At hero grave #6: clone the canine's proven reveal pattern for the
   relic keepsake as a second sequential fetch (enabled after
   'skullSharpened'), jaw-dangle built from the relic recipe so
   respawn/reload re-derives it. Flag 'marrow:relicKept' disappears — tests
   referencing it get rewritten (playthrough altar beats, 'marrow-descent'
   regression). Watch the silent-'continue' trap: a throw at the key while
   carry is occupied must answer.

5. **BASEMENT — the counterweight earns its look** [recon: basement]
   Proposal A exactly as specced: winch-cradle refusal + crawlSecret.nudge()
   + conduit dressing from shutter wall to winch mast; seed
   'crawlSecretSolved' in pump-release-recovery, house-critical-path,
   house-expansion setups; new playthrough crawl-solve beat between the pilot
   and pump legs; rename basement-foundations' 'optional reveal' wording.
   Plus the K.boiler refusal voice (probe-epick's interactable count moves).

6. **PERIMETER — close the void** [recon: perimeter]
   Two M.dirt ground boxes close the west/east strips (z 16..44), optional
   north band clear of the forest corridor mouth; extend the standing-mass
   block with a NEW RNG seed APPENDED after the existing loops (the 0x51de
   stream is position-order-dependent — inserting draws moves every existing
   mass); densify 'far treeline silhouette' instances (~156→220) with a
   nearer ring r 26..42 over the gaps; widen the grass-tuft scatter past the
   rails; 4-6 masses for the house-side corridors. All zero-draw moves except
   the optional +1-draw shrub-card mesh — check the 2-draw margin (448/450)
   before choosing it. No colliders outside the fence. Keep the key tree
   recognizable (≥6 m clear, below canopy height near it); keep clear of
   mausoleums, lock-stone, gate stones, funeralPath.

7. **FALLS FIELD — two paths, trees, popups, a stream, and no world's end**
   [recon: falls-area]
   Root EVERYTHING new in game.frozenFallsRoots (inherits act-gating and the
   district-culling whitelist). Tree-line the two paths to the wheel and the
   gong (extend/clone the instanced grove + fern batches); close the ground
   past |x-C.x|≈28-30 with M.dirt aprons + standing masses, and lay the
   layer's FIRST colliders as stepped AABB rows along the treeline curves —
   keeping the playthrough walk lines clear: (C.x-13.5, C.z+9.6),
   (C.x±11, C.z+4), (C.x+13.5, C.z+9.4). If ground widens, move
   terrainHeightFn's clearing branch and the rendered plane IN LOCKSTEP.
   Popups: 2-3 merged walk-through-yield eruptors per path + Dark Eyes
   blinks; harmless, no damage. Stream: clone addFeeder with C-relative
   points hugging x≈±(24..29), far sides only, clear of pipe runs and
   braziers ("not in front of the things that create the two things").
   'fallsWheel' onHit keeps returning 'anchor'. Stay C-relative — C is
   runtime-computed from the forest spline. Fix tools/probe-bounds.mjs's
   clearing walker (moves 0 m today — the "no escapes" verdict never tested
   this act), then re-probe.

8. **UNDERFALLS — let the Choir be seen** [recon: underfalls-finale, part A]
   Earlier armed trigger (chapel-side) via _caveEcology/_updateCaveHorror —
   beginDrownedChoir already enforces single-instance; give the early spawn a
   choirSource AHEAD/lateral so the reveal lands inside the view cone; raise
   the dry visibility floors (voidMat 0.02, droplet uOpacity 0.10 — value and
   motion, never hue); lengthen reveal decays; consider exempting the choir's
   pursuit from player-triggered spray slows. Respect the sluice |dy| gate —
   intercept on flat storeys. horror-expansion pins 'no choir before the
   displacement is visibly first' — update it deliberately. Add a choir-seen
   playthrough beat (getDrownedChoirState + spawnLog probes exist); the bot
   WALKS and the first catch is nonfatal only once — do not let the new
   pressure kill it.

9. **FINALE — hands of actual bone, raised when the mirrors wake**
   [recon: underfalls-finale, part B]
   becomeBone → Finale.begin(); raiseHands(Infinity) → the 'still'→'closing'
   transition; rebuild mkFinger/mkHand volumes as bone (thin phalanx shafts +
   condyle spheres at the k1/k2 joints, delete webbing + nails, 4-metacarpal
   fan + carpal block) while preserving the k1/k2 group animation contract;
   base the bone set on M.bone's map/bump; if too dark under the mirror-act
   key, raise legibility via the _vmKey path or small emissive — never a new
   light. The glass-press palms beat becomes visible for free once the raise
   is early — verify the pose blend still composes (finale runs last in the
   loop and wins). Keep the playthrough color-identity pin passing; add a
   timing beat asserting hands visible by 'closing'.

10. **GATES** — autotest 26 / regressions (110 + new pins − retired relic
    pins) / smoke / playthrough (48 beats will change; re-pin the count) plus
    district-culling and render-perf after the dressing tasks. Cadence: full
    four gates once after task 7 and once at the end; targeted probes
    between. Known flake: playthrough 'fire-refused-the-skull' fails ~1 in 3
    (Resident chase) — re-run before believing it.

11. **VISUAL VERIFICATION** — tools/shot-areas + shot-three-routes (route 3's
    money shot changed) + shot-opening on touched acts; OPEN THE PNGS AND
    LOOK. Legibility is measurable: ≥1.6x luminance ON/OFF at every new read.

12. **DEPLOY** — commit game branch → push → PR #29 on duplighost/fetch (note
    it stacks on #28) → copy src/ into site repo
    `C:\Users\Alex\Projects\qualiacology` fetch/src/ (read ITS AGENTS.md
    first; PowerShell 5.1: no &&, commit via -F file) → site feature branch +
    PR → `node build/qa/fetch-boot-check.mjs` against a local serve (it is
    TWO-PHASE) → Netlify preview → merge (Alex pre-approved this round, see
    top) → verify production boot. Then tell Alex to HARD-REFRESH before he
    retests (stale-tab trap).

## Traps still true from last round (the short list)

- Edit with the Edit tool; `node -e` multi-line replaces silently fail (CRLF).
- `stepWith(seconds, controls)` — seconds FIRST; movement key is `moveZ`.
- Never add/remove lights at runtime; candles are pooled descriptors; every
  district seal spares world.lightRoot.
- Fog rides fogColorTarget/bgColorTarget only.
- AABB-only colliders; angled shapes = stepped box rows.
- Headless screenshots: canvas.toDataURL only. Playthrough runs `?test=1&mute=1`.
- The shared checkout `Projects\fetch-claude` is stale/shared — never work there.
- `docs/SUBSYSTEM-MAP-2026-08-15.md` line numbers have DRIFTED — do not cite
  it over the recon.
- Back-district culler snapshot/restore stomps one-shot visibility writes made
  while roots are hidden — drive poses from state each tick where possible.

---

# HANDOFF - 2026-08-15: THE CHANGE-ORDER BUILD (branch claude/aug15-notes)

## STATUS — tasks 1, 3, 4, 5, 6-partial, 9, 10 are BUILT AND GREEN

Opus 5 executed the plan below. What is done, in commits on this branch:

- **Task 1, THE OPENING** (`93f5dcb`). Every item, plus three engine-level
  fixes the notes implied but did not name: the E-pick was cast against the
  interactables LIST alone (it selected, and grew the crosshair, through beds
  and walls); ceilings were render-only for both player and skull
  (`world.ceilingHeightAt` now exists); the arrival cradle followed camera
  PITCH with no collision in mode 'gone'. New tool `tools/shot-opening.mjs`.
- **Tasks 3/4/5/6, THE GRAVEYARD RESTRUCTURE.** Canine moved to hero grave #6
  and carries danger-sense too; PIERCE implemented at the hit-resolution branch
  in enemies.js (FEEL_PROFILE untouched); three-route reveal fires sequentially
  from `_completeGraveyard`; keys 1/2/3 from counterweight / marrow relic /
  key-tree climb; marrow entrance relocated under the sealed mausoleum; NE pit
  retired to choked scenery; ossuary far hatch chained shut and its entrance
  made two-way forever; three-keyhole lock-stone at the gate. New tool
  `tools/shot-three-routes.mjs`.
- **Task 9, SKELETAL HANDS.** `skull.becomeBone()` + `skull.raiseHands()`,
  fired at `Finale._beginContact`.
- **Task 10, GATES.** playthrough rerouted end to end (it now walks all three
  key routes and banks them); regressions 110 with three new scenarios;
  district-culling and the 450-draw ceiling held at 448 after a merge pass.

**Two decisions taken during the build that differ from the plan, both because
the plan's version was worse to play:**

1. The marrow's GATE KEY 2 goes straight into the jaw with the relic, in the
   same grab. The plan implied a second fetch at the altar — but the mourners
   begin hunting on the frame the relic leaves it, and a second aimed throw
   from a standing start there is a design that kills you for obeying it.
2. The tree climb is 13 steps, not as many as would reach the boughs: at 16 it
   topped out at 6.63 and put the skeleton INSIDE the canopy, where the payload
   of the whole staircase was invisible. A lamp descriptor sits on the top
   tread for the same reason.

- **Task 8, THE FROZEN FALLS** (§15/16). The falls arrive as ice and the
  sacrifice target is not armed until they run (`director.armWaterfall()`). A
  wheel west (the ossuary counterweight's contract — its fetch target MUST
  `return 'anchor'`, returning null lets the skull come straight home) and an
  iron plate tolled three times east (the resonant graves' contract). Each
  lights a fire line to a brazier array; both = thaw. Flags
  `fallsFireWest` / `fallsFireEast` / `fallsThawed`. They stand 200 m past the
  forest and still cost 21 draws in the HOUSE's view, so they are act-gated
  (`game.frozenFallsRoots`).
- **Task 2's sightlines.** The living room and study look WEST and west of the
  house was ground for 8 m then nothing. Ground to 40 m on three blind sides
  plus 70 standing masses, ALL via `world.box` into **M.dirt** — the shell
  already batches it, so the horizon costs zero draws. M.grass/M.bark cost two
  and that is the entire house-after-cave margin.
- **Task 12, DEPLOY: DONE.** Site PRs #63, #64 and #65 all merged; production
  boot-checked green each time.

**STILL UNBUILT:** the basement stair mass (§3), the approach dressing between
the gate and the forest spline (§13) and the yard-perimeter pass (§11).

**Task 7 (§14) is CLOSED BY MEASUREMENT, not by building:**
`node tools/probe-bounds.mjs` walks twelve compass directions out of every act
and reports *"no escapes: nobody left the world in any direction"*. Caveat for
whoever revisits it — forest/clearing/cave/mirror all report `max walk 0m`,
i.e. the walker never moved, so the probe only actually proves the graveyard.
Fix the probe before trusting it on the forest. And the "faceted boulder" the
change order names could not be found in `src/outside.js` at all; either it is
in atmosphere.js under another name or the note refers to something that has
since been resculpted. Ask Alex which rock he means before hunting further.

## Two more, from Alex play-testing the live build

- **The empty hand is silent — do not re-add the tick.** One soft sound was
  wired to LMB / RMB / E-into-air before the skull arrives, on the "silence
  reads as broken" law. That law came from the FIREBOX, which was a gameplay
  surface refusing a real throw — a promise broken. A button with no verb
  behind it and two visibly empty hands is not the same animal, and the tick
  actively misled: it cannot tell "pressed nothing at nothing" from "pressed
  the WRONG button at something", so it reassured in the one case that needed
  correcting. A refusal beat was written to replace it and cut too, on Alex's
  call: *"if it doesn't make a sound, that's better than even making a bad
  sound that says no... because it's obvious it does nothing."* There is a note
  in main.js where the function was.
- **Bedroom moonlight.** The rug flap / loose board / bell corner sits at
  z ~2.2 and was not dark, it was UNLIT — lamp at z 5.5 with a 4 m reach, moon
  patch with a 3.6 m range and the corner 5.2 m away, and no player lantern
  because the skull IS the lantern and has not arrived. A second moon light
  falls across the boards and dies with the glass like its sibling. Built at
  boot; the census is pinned.

## Traps that cost real time — rule these out before debugging

1. **A tab left open across a deploy** runs whatever it loaded and is
   indistinguishable from a bug. "Stuck, can't interact with anything" was
   this. Hard-refresh first, always.
2. **He may be CLICKING, not pressing E.** LMB has no meaning before the skull
   arrives. This is not a bug report, it is a controls question.
3. **KNOWN FLAKE:** `tests/playthrough.mjs` fails at `fire-refused-the-skull`
   in the basement roughly one run in three — the Resident chase kills the bot.
   It failed twice during this session and passed clean on re-run with no code
   change between. Re-run before believing a failure there.

`tools/probe-epick.mjs` aims the crosshair at all 43 interactables in turn and
reports which collider rejected any that fail — written for trap 1, kept for
the occlusion test it exercises.

**Known open, seen while shooting:** the mausoleum interiors still read as
clean bright boxes (Alex's own standing note). A merged dark floor slab went in
to kill the bright green ground showing through, but the walls are still hot —
that is a visual-pass item and it is on his list already.

---

## THE ORIGINAL PLAN (everything below was written before the work)

Written by Claude Fable 5 for Claude Opus 5 (Alex is nearly out of weekly
allowance on Fable — ~10% left — and will switch models; he asked for the whole
plan written down so "he'll know exactly how to do all the things"). Work at a
fast pace, lean spend: no agent fan-outs, batch your edits, run the four gates
once mid-build and once at the end, not per-edit.

## Where you are

- Worktree `C:\Users\Alex\Projects\fetch-aug15`, branch `claude/aug15-notes`,
  branched off `ca8ec27` = `claude/feedback-aug14-2` = game PR #27 (still OPEN)
  = what is LIVE on qualiacology.com/fetch via site PRs #61+#62. You are
  stacking on an unmerged PR; that is fine and deliberate. Do not rebase.
- THE SPEC IS `docs/CHANGE-ORDER-2026-08-15.md` (committed beside this file).
  It came from Alex via another AI that organized his notes ("mostly they just
  tried to organize my notes"). Treat it as spec, with the exceptions below.
- Alex's own words in chat (these outrank the change order where they differ):
  "you start out inside the bed, and can walk through the furniture. the
  animation with the covers coming off the bed is odd. and the area where the
  bell is really isn't even somewhere that looks like you can open it."
  "if something you know they said is wrong, don't bother. we don't need to
  run infinite tests on this to check it. i can always playtest. so lets fix a
  few things, add the new areas. and get it on the website!"
- Before anything: read `AGENTS.md` (laws + gates), skim newest section of the
  OLD handoff below this one (round-2, what just shipped), and
  `docs/WALKTHROUGH.md` (current route you are about to restructure).

## Spec exceptions (judgment already applied — don't relitigate)

- SKIP change-order §4's furnace-contraption bullet ("make it genuinely
  control the furnace"). The pictured cage/counterweight is the OPTIONAL
  crawl-room secret (shutter + dog skeleton + ball). Alex's own notes retract
  the complaint ("the photographed cage/counterweight is the optional basement
  secret, not a required furnace step"). Leave it alone.
- DO §17 (skeletal hands in the final room) even though Alex said the bottom
  of his HTML notes was unclear/ignorable — the zip's change order states it
  cleanly, it is small, and it pairs with §9's skull-less skeleton at the tree
  top (the player IS the body the skull came from; that is the twist landing).
- Every "Do not resurrect" bullet at the end of the change order is real and
  matches project history. Obey them.

## The plan, in build order

Task list already exists in the session task tracker (12 tasks); mirror here:

1. BEDROOM/OPENING (§1 + Alex chat). house.js/main.js.
   - Move wake position OUT of the bed footprint (notes say: move wake BEFORE
     making bed solid), then give bed/wardrobe/dresser/nightstands real
     colliders. Furniture colliders exist as a pattern elsewhere in house.js
     furnishings — copy the established box-collider idiom.
   - Fix the covers-off animation ("odd") — find the covers search in the
     nine-searchable table (round-2 opening, house.js). Simplest honest fix:
     covers slide off along bed axis and settle as a floor heap, no arcing
     through geometry.
   - Rug reveal: rehinge so it folds OUTWARD (away from bed), not into it.
   - Floorboard: reveal rotation must raise the free end ABOVE the floor
     (currently rotates down through it), and the cavity must READ as openable
     BEFORE it opens (Alex: "isn't even somewhere that looks like you can open
     it") — proud board end + gap shadow + the rug gouges pointing at it.
   - Bell: E works the instant the bell is visible (kill the inert interval).
   - Escalation cue: the existing mercy/escalation cue for the rug→board→bell
     chain is reportedly disabled — find it, re-enable restrained (one distant
     under-floor knock after long searchless wander; no HUD, no text).
   - No window glint until the strong glass is actually broken.
   - E targeting: nearer solid geometry must block selecting through it (the
     interact pick is likely distance/angle-based — add an occlusion raycast;
     remember camera.updateMatrixWorld() before any sim-only raycast).
   - Incoming-skull arrival: authored window→chest route (clamped spline, no
     camera-pitch-following into floor/ceiling); keep timeout as fallback only.
   - Pre-skull dead inputs: tiny authored response for LMB/RMB/E when empty-
     handed pre-arrival (a soft wrist/breath tick, positional, no words).
   - Ceilings: add head+skull collision for house ceilings (check how rooms
     compile in HOUSE_TABLES; ceiling slabs likely render-only). Skull-vs-
     ceiling should answer (dull wood knock), not pass through the roof.
2. HOUSE EXTERIOR SIGHTLINES (§2) + BASEMENT STAIRS (§3) + TRANSITION FEEL
   (§4 minus the skipped bullet).
   - Windows on the house's west/side: extend the EXISTING far-treeline
     silhouette + ground via world.box() into the merged grass batch — this
     was already scoped in the 08-14 session as ~0 draw cost (house-after-cave
     is at 445/450 draws — WATCH THAT CEILING). Keep the original key tree
     recognizable from the graveyard (§11 too).
   - Stair skirt: make the broad stone mass under the kitchen→basement flight
     physical to match its look — BUT the corridor under the cellar ramp is
     REAL WALKWAY holding the basement spawn; a previous "fix" bricked the
     spawn and playthrough caught it. Make the visible mass agree with a
     collider that stops OUTSIDE the walkway, or open up the underside
     visually. house.js ~575 region (skirt), HOUSE_TABLES.ramps.
   - Basement→graveyard: dress the hatch exit so the arrival reads connected
     (continuity props both sides, same masonry family), no new route.
3. COMBINED UPGRADE + PIERCE (§5). outside.js (hero grave #6 rubble + the old
   mausoleum-key flow) + skull.js + enemies.js + marrow.js.
   - The gravestone that used to yield the mausoleum key now reveals ONE
     optional pickup: Iron Canine (game.skullPower=2) + danger sense (the
     marrow relic heartbeat, moved here). Available from graveyard entry,
     any time. Keep the canine's post-unlock haloed-fang read; keep danger-
     sense pulse ON the skull ornament (pulse scales with nearest enemy).
   - MARROW no longer rewards danger sense; its endpoint reward becomes Gate
     Key 2 (see 5 below). Remove the relic-as-danger-sense grant, keep the
     relic take/statue-hunt phase change intact.
   - PIERCE: with skullPower>=2, a qualifying powered hit on an ORDINARY enemy
     (walkers/risen/ground-emergers) kills decisively, keeps momentum
     (no stop-and-pop interrupt of flight), and may continue into the NEXT
     ordinary enemy behind. DO NOT touch FEEL_PROFILE; hook at the hit-
     resolution branch in skull.js/enemies.js where stun-then-pop resolves —
     powered+ordinary = pop-through (no stun stage), specials (Resident,
     Kneeler, Presence, statues, Choir, window watcher, bosses) keep existing
     rules. Key-in-jaw must NOT weaken qualifying hits (there was a false
     suspicion; verify no code path actually does this — if none does, done).
4. GRAVEYARD BATTLE TIGHTEN + THREE-ROUTE REVEAL (§6). director.js/enemies.js.
   - Stragglers: wave enemies must stay engaged/locatable — give unengaged
     wave members a converge-on-player drive + audible tell so the fight
     doesn't end in hide-and-seek. Keep wave counts 4/5/6 and strike-claim
     bounds.
   - On battle resolution (either route — ritual resolution should reveal the
     routes too; the change order says "defeating the battle" but Route A
     ritual IS a valid resolution and must not dead-end): fire the THREE-ROUTE
     REVEAL — sequential is fine and cheaper to read: mausoleum 1 false door
     grinds clear, then mausoleum 2 seal cracks open, then the key-tree
     strings drop their glowing balls with a positional chime cascade. Each an
     unmistakable, watchable state change AT the object. No hue-only reads
     (brightness/motion/sound).
5. GATE KEYS 1-3 (§7/8/9). outside.js + marrow.js.
   - KEY 1: mausoleum 1 (the west/required one with the ossuary under-yard)
     opens keyless post-battle; the EXISTING under-yard route + counterweight
     hold stays intact but its payoff changes: instead of opening the surface
     gate, the counterweight lowers/reveals GATE KEY 1 (fetchable, rides the
     jaw). The far climb/deck-hatch exit is now OBSOLETE as a forest entrance
     (see 6) — seal the far end shut (collapsed rubble is fine) and let the
     player walk back out the way they came (entrance stays two-way pre- and
     post-solve; it already is).
   - KEY 2: relocate MARROW's entrance beneath mausoleum 2 (the east/sealed
     one that held the canine shrine — the canine moved to the gravestone in
     3). Mausoleum 2 opens keyless post-battle; descend to the existing
     marrow district (the district itself does NOT move — it is at (70,-10)
     and position-heavy; move only the ENTRANCE/EXIT plumbing: the pit-mouth
     E-verb, the placement step, the rope/bone exit toggle return point).
     SCRIPT TRAP from the marrow build: place-inside-pit-same-tick gets
     ejected by the not-yet-collapsed collider — step once after flagging
     before placement. Retire the old NE grave-pit mouth: collapse it to
     scenery (rubble-choked, ember dead, no E). Relic endpoint now also
     yields GATE KEY 2 (relic keepsake beat stays; key rides jaw after).
     Keep: Presence body-approach yield (skull passes THROUGH it — do not
     make it hittable), statues freeze-watched/hunt-unobserved/skull-shove,
     the escort/knock beat out. No statue-placement puzzle. District seal
     laws: every seal must spare world.lightRoot; per-tick visibility drives
     defer to district cullers.
   - KEY 3: the ORIGINAL key tree (the one outside the bedroom window that
     held the bedroom key — it must be visible/recognizable from the
     graveyard; if the yard-side sightline is weak, that's part of §2/§11
     dressing). Post-battle, glowing balls on shiny strings descend from its
     boughs = a readable climb (use the forest chain-knot ball grammar the
     player already learned; brightness ladder, ≤ courteous step gaps, jump-
     step or step-hold — NO new input). Top: GATE KEY 3 + a skeleton
     deliberately missing its skull (posed so the absence reads: intact spine
     ending at empty cervical cradle, maybe a hollow where a head would rest).
     Safe way down: descending ball path on the far side or a slide-pole —
     must be walkable while jaw carries the key (fetch-grab outbound guards!).
     Do NOT extend toward the house roof.
6. THREE-KEY GATE + TRANSITION + APPROACH (§10/12/13) + PERIMETER (§11).
   - Gate: three visible sockets on the iron forest gate posts. Throw the
     carrying skull at a socket (or E at arm's length — same grammar as door
     locks) to BANK that key; it stays visibly installed (key silhouette
     proud of the socket, catches the lantern). Any order. All three in →
     the gate swings with its existing proper creak + a three-clunk
     unlock cascade. This is now THE one forest entrance: walking through
     commits the forest act + checkpoint (reuse the far-hatch commit logic,
     relocated to the gate threshold).
   - Obsolete transition pieces (§12, figures 7/8): the under-yard far climb
     + chained deck hatch + forest-side arrival mouth stop being a forest
     entrance (sealed per 5-KEY1). Remove the walk-over drop-through on the
     surface side, remove/retire its handle verbs, keep the geometry as
     sealed scenery (cheap) rather than deleting the district. Playthrough
     and probe-ossuary must be rerouted accordingly.
   - Approach (§13): the surface stretch gate→forest-spline start gets
     staging (leaning stones, a dead lamp post family with ONE pre-created
     light or none — NEVER add/remove lights at runtime; borrow via
     world.reserveLoanLights if needed) + 2-3 ground-emerging enemies placed
     off-path as authored scares (the nursery-walker rise idiom / risen-body
     emergence), tuned as a transition, not an arena.
   - Perimeter (§11): dress the yard edges — wall/fence continuation, tree
     masses, terrain lift, fog — so edges stop reading as map end. Cost
     discipline: instanced/merged into existing batches (world.box into
     merged grass batch idiom; the far-treeline silhouette extension).
     WATCH draws: house-after-cave 445/450 ceiling; run district-culling
     tool after.
7. FOREST BOUNDS + BOULDER + EDGES (§14). outside.js.
   - Close the out-of-bounds walks back toward graveyard/house (probe with a
     bounds walker; candidates: terrainHeightFn region seams + corridor
     clamp edges). AABB-only engine: angled anything gets a fat hitbox —
     prefer stepped short boxes along an edge (the fallen-log lesson).
   - The faceted boulder: collider must match visible mass (stepped boxes).
   - Dress left/right waterfall/forest edges as authored (feeds §15 sides).
8. FROZEN WATERFALL LAYER (§15/16) — BUILD LEAN, REUSE EVERYTHING.
   - Arrival state: falls frozen/blocked — visually: the three noise ribbons
     stilled (freeze their scroll, whiten/brighten, add icicle teeth via
     merged boxes), sacrifice trigger DISARMED until thaw.
   - LEFT route: compact path (7) → creepy shed + skull-operated WHEEL (reuse
     the counterweight-wheel hold grammar verbatim) → environmental fight
     that uses the machinery (e.g. Standing-Kind pair among freeze-fog
     statuary where the wheel's moving chain is the safe lane). On wheel
     completion: fire system LIGHTS permanently (reuse pilot/riser
     fire-line language: flame runs a visible brass/iron line from shed to
     falls-side brazier array, ice near it slumps/darkens+drips).
   - RIGHT route: distinct — e.g. bell/resonance mechanism (reuse resonant-
     grave pulse) + a ground-emerger ambush arena where standing in the
     machine's vent-heat column is the counterplay. Its own fire line +
     brazier array on completion.
   - BOTH lit → thaw beat: ribbons restart dark-to-bright, icicle teeth
     calve off (dt-integrated falls, the detachBoard idiom), THEN the
     existing grown-skull-turns-toward-falls + sacrifice + stones + veil
     progression continues untouched. §16: verify no helper silently
     restores the skull post-sacrifice (mode 'gone' stays law; hands lower).
   - Persistence: both fire systems + thaw are permanent flags on game
     (checkpoint-safe, respawn-safe), same family as pilotLit/ateFlame.
9. ENDING SKELETAL HANDS (§17). finale.js/main.js hands rig.
   - In the final room (wrong bedroom / mirror contact), after the mirrors
     wake: raise the authored hands pose once (the rig already has authored
     poses: held/lowered/gone) and the hands ARE skeletal — swap the hand
     material/mesh to bone (reuse skull bone material family) for the finale
     act only. No text. Give it a quiet beat (stillness) to land. It rhymes
     with the tree-top skeleton missing its skull: the player is the body.
     Do not steal camera or input — the raise is a viewmodel pose, look/move
     stay live.
10. GATES (task 10). tests/.
   - playthrough.mjs: reroute — battle → (any authored order; pick
     tree-key LAST if the climb needs the most step-tuning) key routes →
     bank three keys at gate → gate walk-through commits forest → approach
     → forest → frozen-falls LEFT + RIGHT wheels → thaw → sacrifice →
     underfalls → finale (assert skeletal-hand material active). Known bot
     traps: pre-opening doors makes its own useAt toggle them shut; firebox
     staging needs pilotLit+archiveDraftOpened; statues hunt from the
     INSTANT of the relic grab — re-seat statues before staging checks;
     dead means verbsLive false (a kill two legs back surfaces as "throw
     never launched").
   - regressions.mjs: retire/replace pins that assert the OLD route (ossuary
     far hatch commits forest; marrow NE pit entrance; relic grants danger
     sense; gate opens from counterweight). Add pins: three sockets bank
     keys any order + gate only opens at 3; old pit mouth inert; pierce
     kills ordinary + passes through, specials immune; frozen falls block
     sacrifice until both fires; skeletal hands finale-only; covers/rug/
     floorboard reveal directions; bell E-live-when-visible; E occlusion;
     ceiling collision (skull answers, never exits roof).
   - autotest 26: feel laws must stay green UNTOUCHED (if pierce breaks a
     feel check, the pierce hook is in the wrong place — it must live in
     hit RESOLUTION, not flight).
   - smoke: new-geometry draw budgets under ceilings per act.
   - Run cadence (budget): full four gates ONCE after step 6, once after 9,
     final full pass before deploy. Use targeted probes in between.
11. VISUAL VERIFICATION (task 11): tools/shot-areas + shot-horizons +
   shot-visual-audit on changed acts; OPEN THE PNGS AND LOOK (project law:
   every wrong conclusion came from reasoning instead of looking). Legibility
   is measurable: luminance ratios ≥ ~1.6x ON/OFF at every new read.
12. DEPLOY (task 12). Site repo `C:\Users\Alex\Projects\qualiacology` — read
   its AGENTS.md first (its rules differ; PowerShell 5.1: no &&, commit via
   -F file). Flow: commit game branch → push → PR on duplighost/fetch (note
   in body it stacks on #27) → copy src/ into site fetch/src/ → site feature
   branch + PR → run `node build/qa/fetch-boot-check.mjs` against a local
   serve of the site tree (it is TWO-PHASE: lit skull-less room on the real
   path + held-pass via teleport contract) → inspect Netlify preview →
   **merge ONLY with Alex's explicit approval** → verify production boot.

## Traps that will bite you (all hard-won, all real)

- Edit files with the Edit tool; `node -e` multi-line replaces silently fail
  on this tree (CRLF).
- `stepWith(seconds, controls)` — SECONDS FIRST; movement key is `moveZ`.
- Never add/remove a light at runtime (shader recompile storm); pre-create or
  loan from world.reserveLoanLights. Never let a light sit in a subtree a
  culler hides; every district seal spares world.lightRoot.
- Fog: ride fogColorTarget/bgColorTarget (one weather system in main.js),
  never scene.fog directly; fog colour asserts compare via getHex().
- Derived-visibility lines must model EVERY legitimate state of their object
  (the carried-key-invisible saga); fetch-grabs need outbound guards.
- Every gameplay-looking surface must ANSWER a throw (silence reads as
  broken); every state change broadcasts AT the object; never hue-only (Alex
  is colorblind).
- Anything the player walks up to: albedo ≲0.03 linear; close props are fixed
  with GEOMETRY, not material tuning. Lantern falloff is DECIDED (58/1.6/11.5)
  — do not re-propose.
- AABB-only colliders: angled shapes need stepped box rows.
- Headless screenshots: canvas.toDataURL only (page.screenshot = black).
- Playthrough runs muted (`?test=1&mute=1`).
- The shared checkout `Projects\fetch-claude` main working tree is STALE and
  shared with Codex — never work there; this worktree is yours.
- Site repo on this machine: no `&&` in PowerShell 5.1; `git commit -F file`.

## Open decisions already made (don't reopen)

- Ossuary far exit: seal it, reroute forest entry through the three-key gate
  (change order §12 explicitly allows removing obsolete pieces).
- MARROW district geometry stays at (70,-10); only entrance plumbing moves.
- Waterfall layer is built LEAN from existing grammars (wheel-hold, fire
  lines, resonance, ground-emergers) — no new input verbs, no new enemy AI
  from scratch.
- Ritual (quiet) resolution ALSO reveals the three routes — both resolutions
  converge (the change order only says "defeating the battle"; do not strand
  the quiet player).

## Budget + working style (Alex's words)

"you only have 10 percent of your weekly allowance left... do the best you
can at a fast pace." So: no multi-agent fan-outs, no exploratory rewrites,
batch edits, gates at the cadence above, ship working > ship everything. If
budget forces triage, the priority order is: 1 (his chat asks) → 3/4/5/6
(the restructure) → 10/12 (gates+deploy) → 7 → 8 lean → 9 → 2/11 polish.
THE SUBSYSTEM MAP LANDED: `docs/SUBSYSTEM-MAP-2026-08-15.md` (committed
beside this file) — six dense reports (opening / collision / graveyard /
forest / gates / skullpower) with exact file:line anchors, flag names,
coordinates, and traps for every task above. READ THE RELEVANT MAP SECTION
BEFORE EACH TASK instead of re-exploring the source; it will save most of
your discovery spend. Highlights already confirmed by the map: the spawn
overlaps the bed footprint because ACT_SPAWNS.bedroom sits 0.135m from the
bed post with a 0.34m capsule (director.js:8-13 / house.js:950); NO
furnishing has a collider anywhere (furnish() never calls addCollider);
the covers "animation" is a rigid-group transform that sweeps through the
bed and floor then hard-swaps to a heap (house.js:1809-1820 + 951-986);
and the arrival/glint/E-pick/bell anchors are all in MAP: OPENING.

---

# HANDOFF - 2026-08-14, ROUND 2: SILENCE READS AS BROKEN (branch claude/feedback-aug14-2)

Alex's second live-play list of the day, plus a diagnosis that names the
project's recurring disease. Ten items investigated in parallel, 36 defects
pinned to file:line, all implemented. The through-line — and Alex later said
it himself ("the main problem we've had here is with implementing the puzzle
system so it works and a player would understand what to do and not just get
it by accident... most problems probably just get past a lot of that
testing"): almost nothing was BROKEN. It was working-but-illegible. The
verdict column of the investigation: 10/10 items "working-but-illegible" or
"partly-working", zero "broken". LAW MINTED THIS SESSION: **silence reads as
broken** — every non-qualifying interaction answers, every state change
broadcasts AT the object, cause points at effect. And legibility is
MEASURABLE (luminance ratios, pane pixel deltas, view-cone reveal integrals)
— the measurements below should graduate into a permanent legibility suite.

## The list, his words, what was actually wrong

- "I still don't see that thing crawling in the window in the second room"
  (2nd report): the scripted first haunting only RENDERED after ~1.4s of
  unbroken gaze within ~22 degrees of the pane (climb gated on watched; rig
  below the sill until t~0.45), and a shorter glance silently CONSUMED the
  event (vanish('away') counts any t>0, cooldown 33-42s, site hop). Measured:
  pixel-identical pane at 1.0s of perfect gaze; 3% of pane pixels changed at
  full climb (cloth 0x0c0e0f behind 85%-opaque glass). Now: first event
  arrives pre-crested and visible with a positional glassTink hook, creeps
  while unwatched, is only consumable once actually witnessed; skin/cloth
  brightened, head joined to the palm inside the glass plane. Later
  hauntings keep the stare-gated grammar.
- "the door on the side of the stairs... closes when you hit the candle. i
  hope that works the first time": IT NEVER CLOSES. Two visual lies: the
  fixed +1.9 rad swing parked the lit panel 19 degrees past perpendicular
  INSIDE the aperture — from the stair approach it reads as a shut door the
  moment the candle lights it; and a real state bug (Door.update's rattle
  block writes baseRy-relative wobble, pose write guarded by |d|>0.001) let a
  rattle landing in a ~0.16s window freeze the door pixel-perfect CLOSED
  forever while logically open — "skull through the closed door", exactly.
  Now: per-door openAngle (voidDoor 2.75 lies flat along the wall), pose
  computed every frame, rattle relative to pose. The beat itself was always
  first-hit-completable, infinitely retryable, death-proof (probe-verified).
- "you have to walk right through that thing in the doorway... it should
  maybe come apart": the bell-circuit latch assembly hung at face height
  INSIDE the cellar doorway (x 9.40 in an 8.35..9.65 aperture), colliderless,
  forever. Now circuitLatch.comeApart() fires at BOTH cellarOpen commit
  orders: the whole assembly tears off, falls dt-integrated in the
  detachBoard idiom, and settles in a heap at the east jamb base (x>=9.7,
  y<=0.35) — the fallen hardware IS the open read.
- "the bell at the bottom of the basement stairs. you have to hit that?":
  YES — it is the incinerator's pilot, and canon (WALKTHROUGH, comments,
  playthrough) says it is REQUIRED, but the requirement had been dropped in
  code when the draft was rewritten — he completed the furnace without ever
  striking it, which is WHY nothing was attributable. Restored: firebox,
  door-interact and wake all gate on pilotLit; the cold refusal now travels
  (choke at the mouth then knocks climbing the pilot's riser). Also fixed the
  early-door-open path that swallowed the wake announcement forever (interact
  set incin.awake with a stale two-flag condition; the ticker's !awake guard
  then never fired the knock+fire-breath). The furnace is now a scoreboard:
  pilot -> door slits breathe; pump -> gauge needle + missing-half duct
  knock; draft -> wake breath + standing flames; all + door open -> mouth
  2.4. The pilot fixture itself stood half-buried in the return-stair wedge
  ("looks kind of odd the way it is settled there") — moved to clear floor
  at (3.35, B, 5.72), backboard against the wall, line re-aimed EAST into
  the ceiling toward the furnace it feeds.
- "the basement was catching me again": reproduced — a diagonal descent of
  the hanging flight pins dead against an invisible side wall. DEVIATION
  from the diagnosis, probe-proven: the blocker is NOT the tagged stair
  guard but the untagged storey-wall AABB hanging into the head window 2cm
  in front of it; the shed is keyed on a side-boundary predicate (±0.15m of
  the flight edge, feet-on-treads only) and sheds blocked velocity along the
  flight axis downhill, with an uphill climb guard so it can never drag a
  climbing player back. Plus: basement respawn nudged (9,-3,4.5)->(9,-3,4.9)
  — the old point sat INSIDE tread 10's collider and every respawn frame-one
  shoved the player 0.35m. Stair guards also grew a mid-height rail so the
  collider volume reads filled, not invisible.
- "the room with all the contraptions is still a mess... i don't know which
  thing does it": measured ON/OFF frame-luminance ratio was 1.11x, the rev
  lasted 1.05s at ~10-24 deg/s wheel speed, and the strike collar sat
  DIRECTLY BEHIND the caged lamp on the approach sightline — pre-draft
  throws aimed at the collar were intercepted by the lamp's larger target
  sphere and PARKED instead ("i don't know which thing does it", literally).
  Now: collar moved 1.3m east and made the biggest/brightest ring in the
  room; the lamp cage rebuilt into a skull-sized cradle (the one shape that
  says PUT THE SKULL HERE); hold lengthened 1.05->2.6s with progress read at
  the fixture and in the room; ON is a different room — wheels at flywheel
  speed, every gauge face lit, work-lamps flooding the row; the walk-in
  sentence and the furnace nudge flare the dials so the room points at
  itself. (Playthrough beat timing updated for the longer hold.)
- "clear and consistent handles": the basement bilco hatch's handle bar +
  brackets EXISTED with the correct worn-bright material and had never
  rendered a pixel — hand-rolled offsets placed them ~1-3cm INSIDE the tilted
  panel's volume ("a slab of concrete with nothing on it"). Lifted out along
  the panel normal. The ossuary lid and underfalls hatch handles had the
  SAME bug in a different key: the pale diffuse hex transposed into the
  emissive slot (0x22282a diffuse = soot-black bar). Both now 0x8f9694.
  Every other openable audited clean (inventory in the session record).
  DEFERRED: one shared makeHandle() constructor so a handle can never be
  hand-derived wrong again — do it in a quiet pass.
- THE MARROW ("it doesn't seem like my skull can touch them... sometimes my
  skull goes right through the item"): truce-mode statues were hit-inert BY
  CONSTRUCTION (the hit path gated on hunting; plinth colliders answered
  with generic wall-thud), and a non-qualifying relic pass was perfectly
  silent (take requires yielded && outbound; no else branch anywhere). Now:
  truce hits answer (rotation-only shiver + marble crack + impact ring,
  never displacement — the truce holds); non-qualifying relic passes answer
  (dry dead knock + flinch, and when the gate is the guardian, the refusal
  points AT the guardian: eye-flare + whisper); once yielded the relic
  broadcasts takeable with the dangle's own heartbeat grammar (throb, rise,
  brightened glow) — the pulse he already loves, taught one scene earlier.
- "the gate for the path under the cemetery didn't have a very visible
  handle... at the end it just kind of was sky if you looked up": the lid's
  1.92 rad swing carried the handle 0.11m INSIDE the cap wall (open = handle
  entombed), and the up-view through the mouth was a measured 0.0-luminance
  void plane indistinguishable from the night sky — E on empty sky. Now:
  lid opens 1.62 rad (leans on the wall, bar proud and lit), handle
  worn-bright, and the mouth wears a throat — curbs + root beams the
  shaftGlow lights, black only between them; climbing out kicks a decaying
  settle on the arrival lid so you see the thing you just used still moving.
  (tools/probe-ossuary.mjs also un-broke: it now fires the real interact.)
- "some of those hanging balls should be glowing brighter or more
  distinctly": the chain knots peaked at RGB(77,116,139) over a few pixels
  — dimmer than the held skull — and the knit cross-branches were only
  discarded within 3 spline-metres of each knot, so the APPROACH sightline
  (eye at 1.65m to knot at 7m) always crossed branch height. Now: knot
  emissive ~2.4, a soft additive corona sprite per road knot (depthTest ON —
  partial occlusion leaves most of the glow; never through walls), a slow
  per-knot-phase breath, and the knit/canopy discard widened to the full run
  spans (seed 62-68, road 160-204) with RNG-consumption discipline preserved
  verbatim (every rng call still executes; only the push is withheld — the
  rest of the forest is pixel-identical).
- "still walking through rocks to get to the exit... i didn't see the enemy
  that used to be in there once": (1) cave dressing placed a full 360-degree
  rock ring around every chamber with no corridor gaps — audit found 219
  skin instances inside the walkable union, plus a 4.5m visual-only west
  wall crossing the hatch-cistern entry; now every dress instance is pushed
  radially clear of the route union (+0.35m margin) and the west wall is a
  north-only segment WITH a real collider, the southwest quadrant honestly
  open. (2) THE DROWNED CHOIR WAS NEVER GONE: an honest-walk sim showed it
  spawn on schedule, stalk, and commit a full attack — with a measured
  maximum forward-view-cone reveal of 0.000 over the entire walk; every
  reveal fires astern of a forward-walking player, and its dry opacity floor
  was 0.001. Now it drenches ITSELF crossing the same spray curtains the
  player walked through (reveal + positional sprayReveal only — pursuit
  math untouched) and carries a permanent faint water-glint column
  (dry floor ~0.10) so an honest walk meets it.

## Verification

All four gates green on the final source: smoke ALL PASS (436 draws / 1018
geometries in-sample, zero errors), autotest 24/24, regressions 78/78,
playthrough COMPLETE. Focused battery green: house-critical-path,
basement-foundations 8, house-chase-doors 10, house-return-horror 12,
house-expansion, failure-state 20, pump-release, horror-expansion 16,
choir-route-occlusion 6, creature-audio, underfalls-expansion 13,
district-culling 14 (max 445/450), exterior-expansion 12, forest-hardening,
grave-arena, enemy-stain 5, standing-postclear 2, perf-pool. Visual audit
(36 vantages) clean; archive cradle and bilco handle confirmed by eyeball.

THREE PRE-EXISTING FAILURES, NOT FROM THIS PASS — proven by running the
identical suites on the untouched claude/visual-pass tip in a separate
worktree, interleaved to control machine state:
- forest-nervous-system 'synchronous Start' — ~315ms vs the 250ms ceiling on
  BOTH trees (baseline 322, ours 314). Inherited boot cost, most likely the
  visual pass's occlusion-grid bake; fix by slicing the bake, not by raising
  the ceiling. All 8 of its behaviour checks pass; the prewarm-slice check
  passes on both trees when the machine is quiet (ours 32.6ms vs baseline
  40.3 — ours is actually faster).
- pause-title-regression — crashes at its live-mode boot-ready wait
  (line ~338) identically on BOTH trees. It passed in the visual-pass
  battery, so the machine's Chrome/driver state shifted since. Environmental.
- render-perf mirror cadence — 33.3ms p50 on BOTH trees when the machine has
  been under sustained GPU load (a locked 30Hz compositor state); identical
  16.7ms healthy cadence on both trees when quiet. Thermal, not scene cost.

RESOLVED, same day: Alex confirmed a Codex session was running ITS OWN test
battery on another game on this machine the whole time. Every "environmental"
failure above is contention on the shared GTX 980M: boots measured at 24-45s
under load (shader compile starvation), which also blew autotest's 90s goto
timeout after the pass-2a merge — with a long timeout the suite PASSES 24/24
on the combined tree, and the harness GPU was probe-verified as real D3D11
(ANGLE/NVIDIA, not swiftshader). LESSON FOR THE NEXT SESSION: before believing
a timing-flavoured red (goto timeouts, cadence, cold-start ceilings), check
for a concurrent agent's Chrome fleet — `Get-Process` for codex/cua_node — and
re-run on a quiet machine or A/B against the base tree, interleaved.

## Queue: pass 2, from Alex tonight, designs finished

His words verbatim in the session record (scratchpad alex-words-aug14-
round2.md; fold into this file with the pass-2 commit): the bedroom arrival
rework (searchable room, hidden bell, bone-click approach, the skull
SHATTERS the strong-glass window and lands in your hands, flickering human
head before it settles — replaces waking already holding it; playthrough
act-0 beats rewritten to the new truth), the knock-a-lot front door payoff
(ends with one small knock from INSIDE), the house chaser nav fix (stairs +
stalls; supersedes "deliberately left"), the window watcher ACTUALLY ENTERS
(sash up, folds through, drops inside, sash stays cracked), the archive
stands CHUG audibly while running, and the pump-gallery far pawl latches
ITSELF when you reach the far side ("unless you were really thinking about
it, you probably wouldn't realize that that is what locks the gate down").

Deliberately left: a held throw aimed out the open void doorway can poise
outside the roofless house shell (probe phase D; Alex has not flagged it).

## PASS 2 — LANDED (same night, this branch)

The queue above is done. Alex's words, verbatim, from the session record
(scratchpad alex-words-aug14-round2.md), folded in as promised:

> "For the first room of the game:
> window is originally strong glass that can't be broken.
> (the player has to look around the room. opening stuff and getting feedback
> visually and sound effects. Make room more interesting and detailed with
> more creepy stuff but some of it being stuff that would be a room and a lot
> of stuff you can search and make a small change in it with an animation
> when you search. and make the new improve room foreshadowing somehow a bit
> too. though I'm not sure how, but you could figure something out.)
> Eventually you find a bell you can activate (Hide it in a clever place.
> when you activate it and in loudly dings in a realistic but kind of spooky
> bell sound). Suddenly you hear a lot of clicking of bones in the distance
> in the direction of the glass window. the bones sounds and soar sounds get
> closer and closer unthil the skull bursts through the window, shattering
> it, and landing in your hands. For a few secibds it flockers back and
> forth between a human head while mashing and meacingly chattering its jaw
> bones befire it becomes that skull be know and love from the rest of the
> game. Then you can throw it to get the key. Make sure it doesn't get the
> key on the way in when you firs meet it shattering the window."

> "Rest of the house:
> If you knock a lot on that Spooky door on the first floor that lets you
> knock, it should have a terrifying effect."

> "You can fix the chasing monster in the house. He gets stuck on the stairs
> and often stuck a lot of places where he can't find his way to you."

> "And fix the second floor window enemy so it actually comes in the window?"

> "those machines should really start chugging whatever it is that is
> supposed to work."

> "But unless you were really thinking about it, you probably wouldn't
> realize that that is what locks the gate down. I'd probably just automate
> it somehow."

What shipped, all on claude/feedback-aug14-2:

- **THE NEW OPENING (Act 0 replaced).** The room boots skull-less
  (Skull.bootAbsent, vanish()'s census-safe light parking made recoverable);
  wake at the bed edge facing the window, covers thrown back off a body that
  isn't there, iron slide-latch on YOUR side of the door. Nine E-searchables
  (dresser/leash, wardrobe/child coat, covers/imprint, rug/claw gouges,
  floorboard/BELL, curtains, nightstand, framed falls painting over a
  mirror-shaped unfaded patch, door latch that slides and the door still
  holds), each one press -> one dt animation -> one HRTF synth -> one
  persistent change. The bell is a dog's collar-bell hidden under the
  floorboard, gated behind the rug search; E rings it where it lies
  (bellRing dark variant + duck), two seconds of silence, then
  boneApproachStart glides in from past the graveyard (click density and
  pitch ARE the approach), the moan joins late, the pane shatters inward
  (glassShatter, pooled burst, shard teeth stay forever, added collider
  collapses — the base skullPass collider is never touched), the scripted
  flight homes on the LIVE camera in mode 'gone' and lands in the hands;
  3.6s human-head/skull flicker with mashing jaw chatter (stage-5 sculpt,
  presentation only); throws gated by skull.introFlicker until the settle —
  then the tree-key beat proceeds exactly as it always did. KEY GUARD, his
  "Make sure" clause, is triple: mode-'gone' flight (no _checkTargets), a
  path authored wide of the branch, and regression traps asserting
  carry===null with the treeKey enabled after arrival. State plumbing:
  'skullArrived' flag; Game.teleport auto-completes the arrival silently
  (the canonical post-arrival test setup); director.respawn is three-way
  (waterfall -> vanish; pre-arrival -> re-assert absence, searches persist,
  bell back to found-but-unrung; else holdNow).
- **The front door answers** (frontDoorKnockAct): staged knock-back ladder
  through the boot-built under-door light seam, ending in the one-shot
  stage-3 answer — the blow, the walk around the house, and the last small
  knock from INSIDE, right behind you.
- **The house chaser fixed**: houseNav stair links + mid-flight cell
  fallback, cross-storey BFS routes, freeze gates retired (windT now means
  "genuinely failing", not "on another storey"), Marrow's best-approach
  stall clock + unseen-only relocate + face-of-travel, walker door-besiege
  paw. He climbs the stairs to you now.
- **The window watcher ACTUALLY ENTERS**: sash slides up with a creak, the
  figure folds through, drops inside, skitters into the house dark; the
  sash stays cracked open after.
- **The archive stands CHUG** while the draft runs — per-stand phase,
  pistons in time, positional.
- **The pump-gallery far pawl latches ITSELF** when you reach the far side
  with the bridge down — heavy clank, winch release; early-release
  rewind/retry unchanged.

GATES, run serially on the final combined source (FETCH_PORT=8834, system
Chrome D3D11): smoke ALL PASS (583 draws in-sample, zero errors); autotest
26/26 (was 24 — new 'act0-boots-skull-less' and 'teleport-grants-the-skull',
and the key->lock check now delivers by aiming the live camera and throwing,
because outbound guide steering follows the camera and the old synthetic
mid-air spawn behind the shut door predates the authored wake spawn);
regressions 97/97 (three new arrival scenarios: 'arrival-never-takes-the-key'
drives rug->floorboard->bell through the real interact dispatcher and traces
the whole flight carry-null; the two restart scenarios pin the
pre/post-arrival respawn truths; scenario 1 and finale-contact gained the
canonical teleport insert); playthrough COMPLETE at 48 beats (was 40 — act 0
now walks all nine searches by real input, proves the bell hidden until
found, rings it, and rides the arrival through 'the-window-broke-inward',
'it-landed-in-your-hands', 'it-did-not-take-the-key' and
'throws-wait-for-the-settle' before the key beats run unchanged).
pause-title-regression 25/25 — its checkpoint-restart block assumed a held
skull at boot and now completes the arrival via the teleport contract first.
WALKTHROUGH.md Act 0 rewritten to the new truth; DESIGN.md carries a dated
addendum with Alex's spec verbatim above the preserved original beat.

---

# HANDOFF - 2026-08-14, THE VISUAL PASS (branch claude/visual-pass)

Alex: "Let's do a complete visual pass on this game and make everything look
absolutely stunning." Whole game, every act, looked at rather than reasoned
about — new tool `tools/shot-visual-audit.mjs` shoots 36 posed vantages across
bedroom / house / basement / graveyard / forest / clearing / underfalls /
mirror in one pass and prints draws+tris per frame, so a prettier game cannot
quietly blow the budget. Seven rounds of shoot-look-fix.

Nothing about feel was touched: FEEL_PROFILE, the throw grammar, input, all
progression and every collider are byte-identical. This is light, surface and
frame only.

## The five things that were actually wrong

**1. THE VIEWMODEL NEVER LEARNED THE WORLD WENT DARK.** The hands and the held
skull draw in their own depth pass with their own lamps, so nothing about the
act reaches them — they carried the BEDROOM's lighting all the way into the
graveyard. Measured (`tools/probe-viewmodel-light.mjs`, new): hand region mean
**0.158 against a world mean of 0.032 — five times the brightness of the frame
they sit in.** That is the whole of "two salmon gloves floating in the dark".
The key now rides the act's own free-light floor (the same factor the director
eases world ambient by, `^1.25`), and a second term makes the game's premise
visible: while the skull is HELD it is the thing lighting your hands, so
throwing it dims the cradle with everything else, and `gone` dims it for good.
New back rim (`holdRimLight`, created at boot — the never-add-a-light-at-
runtime law is intact) keeps a silhouette alive against black. Graveyard hands:
0.158 → 0.069, ratio 5.0 → 2.2.

**2. THE GROWING TISSUE WAS BRIGHTER THAN THE BONE.** The stage 3+ patches on
skull-variant-e peaked at **0.96 luminance in a graveyard frame averaging
0.032** — a stripe of orange paint across the cranium, and to a colourblind
player only ever "a bright wrong thing". Wet tissue on dry bone is DARKER than
the bone. muscle/muscle2/skin/skinPale dropped and roughened (0.48→0.70 etc) so
they stop throwing the specular that lit them; the new rim finds their wet edge
instead. Value carries the read, hue carries none of it.

**3. THERE WAS NO OCCLUSION TERM ANYWHERE.** Corners read exactly as bright as
the middle of the wall they turned; ceilings came out brighter than the floors
under them. `World._buildOcclusionGrid` + `_bakeContactShading`: rasterise the
SHELL of every static collider into a sparse grid (a shell, not a volume, so a
200 m forest costs about what a cupboard does — 38,761 cells total), then
darken every merged vertex by how much of its own hemisphere is walled in.
`box()` now segments anything over ~0.85 m so there are vertices for a seam to
land on. Free at runtime: it is a colour attribute on geometry that was being
merged anyway. Ceiling albedo also dropped below the wallpaper's (0x808080 →
0x5e5e5a) — lamplight falls on what is UNDER it. Not one lumen was removed from
any room; "the house feels empty" was never this.

**4. EVERY WALL WAS PURE DIFFUSE.** The one light the player carries could
sweep across a brick wall and never find a brick. Every painted map already has
its own shading in it, which makes it a serviceable height field, so each is
fed back as its own `bumpMap` — no new texture, no new material, no new draw
call, and Lambert carries bumpMap per-fragment in the vendored r161 (verified).
`stonePaint` also stopped being a perfect 4-column grid with a half-offset:
jittered course widths, per-block value and bevel, chipped corners, one block
in 150 gone, and a whole-cycle macro field so no two square metres match.
(First attempt used 1-in-20 missing blocks and the cellar came back as a
black-and-white checkerboard — caught by looking, fixed to 1-in-150.)
New `M.stoneFloor`: a floor is a wall that gets walked on, and sharing one map
put pale wall stone underfoot where the hemisphere term hands floors the SKY's
share of the light — the cellar floor was the brightest plane in the room.

**5. THE OUTDOORS HAD NO SKY, NEON FOLIAGE AND A BARCODE WATERFALL.**
- Sky: the dome was an honest vertical gradient and nothing else, so every
  silhouette the game builds had nothing to be a silhouette against. Now
  drifting cloud on an overhead plane (foreshortens toward the horizon), a moon
  that lights the air around it in a tight corona and a broad wash, and one
  `MOON_DIR` the disc, the halo and the sky all agree on.
- Foliage: 120 fat ellipses on a 64 px canvas stretched over a four-metre
  thicket gave every bush half-metre pale clouds. 128 px, 340 leaves at half
  the relative size, each with a dark rim and a midrib. And night foliage is
  grey — a green-dominant albedo a metre from a 58-candela lantern clips the
  green channel by itself and returns neon mint. Albedo pulled off white
  (0xffffff → 0x93968f, canopy 0xd5ddd0 → 0x7f847c) so the leaves have headroom.
- The falls: one sine at 82 cycles across crossed with another at 58 down is a
  plaid, and it was the backdrop of the game's most important beat. Three
  ribbon widths of value noise, none periodic on screen, all FALLING — packets
  that accelerate as they drop, a glassy lip, foam by the basin. (v1 of this
  drew a chevron front across the sheet, which is the barcode on its side; two
  smeared runs at different rates fixed it.)

## Also

- **Grounded furniture** (`World.buildGroundContact`): the collider list
  already knows where everything solid is, so anything furniture-shaped with
  its feet on a room floor gets one soft multiply decal the size of its own
  footprint. 16 quads, ONE draw call, derived not authored. The AO bake works
  at 0.85 m, which is right for a wall/floor seam and completely wrong for the
  15 cm of dark that says a wardrobe is standing on something.
- **Torn wallpaper** was nine-sided polygons filled FLAT two value steps above
  the paper — a rotting wall wore pale pentagons that read as cut paper stuck
  to it. A tear is an EDGE: plaster only slightly lighter and actually
  textured, a dark undercut where the paper stands away, a lit lip on the
  paper side, lobed-and-nicked outline, fewer and smaller.
- **The frame**: the grain/vignette overlay reached 16% in the extreme corners,
  which is a vignette nobody sees. 30%, starting earlier, grain 0.055 → 0.075.
  Overlay constants only — the pass structure that shipped black in 0.6.x is
  untouched.

## Numbers

All four gates green: smoke ALL PASS, autotest 24, regressions 78, playthrough
COMPLETE. Plus render-perf (GPU p95 5.5 ms cave / 13.9 ms mirror against a
45 ms gate), district-culling 14, perf-pool. Zero console errors anywhere.
Triangles at the worst vantage 178k → 239k (+34%, the shell tessellation);
draw calls unchanged per act.

**WATCH THIS: house-after-cave is 445 against the 450 ceiling** (was 443).
+1 for `stoneFloor` splitting off the shared stone shell, +1 for the grounding
mesh. `dirtFloor` was built and then deliberately removed to give a draw back —
dirt is already the darkest map in the game and never appears as a wall, so it
bought nothing. Four draws of margin is not much; the next person adding a
merged material to the house should reclaim one first.

## Left deliberately

Props are still untextured flat-coloured primitives (the boiler is a grey box,
the mausoleum a pale slab) — that is a modelling lane, not a lighting one, and
it is the biggest remaining visual gap. The distant graveyard treeline is still
flat cards. The empty hands' finger silhouette is unchanged; it has been
iterated three times and the problem was always that they were lit wrong.

---

# HANDOFF - 2026-08-14, EVERYTHING OPENS THE SAME WAY (branch claude/feedback-aug14)

Alex's second live-play list of the day, all of it built. The through-line
was his own sentence: "everything you can open should kind of work the
same way." Every touch-teleport is now a USED verb with a visible handle.

THE BIG ROOT CAUSE — "i think the biggest problem is something with the
lighting isn't working" (Underfalls): he was right, it was BROKEN, not
dim. The cave's visibility seal spares `child.isLight` — but
World.pinLightCensus LIFTS every boot light into world.lightRoot, a plain
GROUP the seal didn't recognize. The seal hid the group, the renderer
skipped the entire light subtree, and the cave rendered with ZERO point
lights — only emissive/basic materials survived (the pale wet line he
could see). One line — spare `game.world.lightRoot` — relit the whole
district. This also fully explains his earlier "a better looking version
loads up before another version loads up": the first ticks after entry
rendered lit, then the seal killed the census. LAW REAFFIRMED: every
district seal spares world.lightRoot, no exceptions, and `child.isLight`
at scene level matches nothing after the census lift.

TRANSITIONS ARE VERBS NOW (marrow in/out, ossuary top):
- The marrow pit mouth: E while looking into the breathing grave (interact
  on the pit mesh, crosshair only offers it once the yard is resolved).
  The pit collider stays raised — the mouth is a hole you lean over, never
  fall into. The way out is a hanging rope + bone toggle at the entry wall
  (E). Both are armed verbs: the VERB sets a pending flag and the DISTRICT
  TICKER executes the swap. This ordering matters — E fires before
  forest.update in the step, and a teleport the forest cullers see before
  the seal snapshots poisons the save/restore maps (we shipped exactly
  that bug for one commit: forest detail saved as culled, restored as
  culled, gone until you re-crossed z 31.5). The ticker keeps the old
  walk-over ordering: cullers run on the surface pose, swap + seal land
  together.
- The ossuary top: the open lid wears a handle bar on its underside, and
  climbing out is E into the mouth under it (invisible interact box on the
  deck, enabled only at the top with skull held). Same pending-verb
  deferral — committing the forest act at _interact time made the
  back-district culler retire the yard while the ossuary seal still held
  it, and the seal's restore then undid the retirement.
- The underfalls end hatch already had its E — it now wears the same
  handle language (bar + brackets on the door underside, facing the
  upturned player).

THE MARROW GREW TEETH (Alex: "make it an actual challange where they
behave like the other enemies when the skull hits them and you cant let
them get you" + "What does that secret item do... make it do something
cool"):
- THE HUNT: the moment the relic leaves the altar, the Mourning Statues
  stop mourning. Watched, they freeze (the grammar the entry taught);
  unobserved, they DASH at 3.3 m/s with marble-scrape audio; a skull hit
  (outbound or returning, radius 1.0 — the boomerang arc bends off the aim
  line, don't tighten it) shoves them 1.9m (x skullPower) and staggers
  them shivering for 1.5s; their touch is death. Their plinth colliders
  collapse while hunting (the catch radius is the body). Death in the
  crypt respawns you at the entry checkpoint with every statue reposted
  home — grace, never an ambush. The crypt palette re-asserts itself every
  tick it owns the player, so a hard respawn can't leave graveyard air
  down there.
- THE RELIC'S GIFT: danger-sense. The dangle in the jaw beats like a
  heart — scale throb + emissive pulse, 0.9Hz calm to 6Hz with something
  close (nearest enemy within 14m scales it). Works everywhere it rides,
  every act. Value and motion only.
- The altar is solid now (collider, skullPass so low throws never clank)
  and the take window widened (rd < 0.72, |dy| < 0.9) — "i couldn't
  collect the item easily... i walked right through the pedestal".

THE REST OF THE LIST:
- KEY FLOATS ("it should be above the rubble... float standing straight
  up in the air"): bow-up blade-down at y 0.85, bobbing and slowly
  turning, glow descriptor raised with it. Carried pose untouched (grab
  owns the jaw).
- CELLAR STAIRS ("you can kind of go through a texture"): the flight is
  thin tread slats with rises taller than the slats are thick — you could
  see clean through it. One slope-matched skirt panel under the treads
  closes every gap. Visual only.
- POOL HAS A BODY ("you can see under the water which is odd"): the
  surface plane is single-sided; from inside the basin you saw a dry pit.
  An opaque murk cylinder fills the basin under the plane.
- Battery: full serial run green — smoke, autotest 24, regressions 78
  (marrow-descent now 13 checks: verbs, dash, freeze, skull-shove,
  lethal catch, respawn reseat), playthrough COMPLETE, district-culling
  14 (both verb deferrals proven by exact restore), house-critical-path,
  house-expansion, underfalls-expansion 13, failure-state 20,
  basement-foundations 8, grave-arena, chase-doors, return-horror,
  choir-occlusion, creature-audio, enemy-stain, postclear, exterior,
  forest-hardening, nervous-system, horror-expansion 16, pause-title 25,
  perf-pool, pump-release. Draw ceilings hold (max 443 house-after-cave).
- TEST AUTHORING NOTE (cost a full debug loop): the statues hunt from the
  INSTANT the relic is grabbed. A test that dawdles after the take gets
  its player killed by statue #0 closing from behind while it stages the
  next check — and the failure surfaces two legs later as "the throw never
  launched" (dead ⇒ verbsLive false). Re-seat all four statues before
  staging statue checks, and park the non-subject three far away.

Deliberately left: house chaser stuck on stairs (Alex uses it for
playtesting).

# HANDOFF - 2026-08-14, BASEMENT LEGIBILITY (branch claude/basement-legibility)

Alex, playing THE MARROW build live: "the puzzle in the basement of the
house doesn't seem to work anymore... i do all the things and the fire is
still not in the incinerator and the skull bounces right off. oh, if i say
restart from last checkpoint it somehow works?"

ROOT CAUSE FOUND: the firebox fetch target started DISABLED and was only
armed by the fire-door interact — a throw before using the handle bounced
off bare geometry with ZERO feedback. That silence read as "broken", and a
restart run that happened to re-use the door read as "fixed". Fix: the
target is always armed; a shut door answers with impact('locked') + its
own rattle. (The wake ticker no longer re-gates enabled on doorOpen.)

Also this pass:
- THE LAMP HOLD (Alex's design, verbatim): "the skull should actually have
  a place to land on the light where you could hold it to rev up all those
  contraptions." The caged archive lamp is a fetch anchor now
  ('archiveDraftLamp', swing hold 1.35s): the held weight revs every stand
  (surge pinned to hold progress), the lamp brightens with it, strain
  creaks rise, early release drops it all with a grind — and the committed
  hold opens the draft. The collar strike still opens it too (two honest
  doors to one flag; openArchiveDraft() shared).
- The furnace's no-draft refusal now TRAVELS: three knocks walk west along
  the ceiling main from the furnace toward the archive before the archive
  answers — the pointer is a path. The draft gauge only settles when BOTH
  halves (pump + archive) are done.
- FIRST WINDOW HAUNTING SCRIPTED: "the second room in the game" — the
  watcher's first appearance is now the landing window ~6s into the house
  act, so the first window you pass leaving the bedroom has something
  climbing into it.
- SECOND ROOT CAUSE, same session ("i never saw the key in the graveyard
  again... it is possible i collect i accidentally"): the mausoleum key
  grab had NO outbound guard — the throw that toppled grave #6 could scoop
  the key on its RETURN leg the second it appeared. Outbound-only now,
  plus a 0.9s settle before the key is takeable at all: it gets its
  breath in the rubble, glowing, before any throw can claim it.
- THE CANINE GLAM ("the actual object you collect should look cooler"):
  a real curved fang now — two-segment curve, brass root band, side
  serrations, bone cradle, additive halo, slow turn and bob on the
  plinth. The sharpened-skull outline he called cool is untouched.
- THE TWO-STAGE LOAD ("a better looking version loads up before another
  version") — REAL: act fog DENSITY eased while fog COLOUR snapped, so
  every act boundary showed a clear vivid frame before the haze arrived
  like a second load. Fog colour + background now ease with density
  (main.js lerp dt*1.1; hard teleports seed instantly for tests). The
  marrow palette rides the same targets instead of mutating scene.fog —
  the descent GRADES into wine-dark now.
- MARROW DISCOVERABILITY ("i didn't see any enemies from marrow"): the
  pit was too quiet. Once open: ember shimmer plane over the black mouth,
  glow 1.4 breathing, under-knocks carry 12 m on a 6-10s cadence, and a
  one-time three-knock announcement across the yard the moment
  graveyardResolved lands. (Note: the marrow only opens AFTER the yard
  resolves — his session may simply not have reached it.)
- NOTED, DELIBERATELY LEFT (Alex: "We can leave that for now lol"): the
  house chaser gets stuck on the stairs — he uses it for playtesting.
- His bell photo ("looks like there is two bells"): correct and by
  design — the gold room-side striker + the grey receiver in the reveal.
  With the real blocker fixed this should stop reading as suspect; if the
  cage still confuses, that is a future legibility pass.

---

# HANDOFF - 2026-08-14, THE MARROW (branch claude/marrow-area)

Alex: "the enemies in the game i made called 'marrow' ... are actually really
freaky and cool. I wish we could have an area with them." Then: "start
working on the next run you mentioned." Built: **src/marrow.js** — a sealed
optional district inhabited by MARROW's actual creatures, ported from the
shipped source at qualiacology/marrow (its entity.js, scares.js,
graveyard.js, crypt.js — see the full bestiary in this session's record).

## The area

- ENTRANCE: after `graveyardResolved`, the NORTHEAST open grave pit
  ([11.8, 36.2] — `game.marrowPit`, set in the graveSites loop) stops being
  a lie: it breathes warm light (gated descriptor) and knocks from below
  when stood near; its collider collapses (derived per tick) and stepping
  in swaps to the district at offset (70, -10), floor -5 — the ossuary's
  mirror. Level string 'marrow'; audio zone 'basement' (interior verb);
  scene fog/background SWAPPED to MARROW's crypt palette (0x160611) on
  entry and restored exactly on exit.
- THE MOURNING STATUES (marrow graveyard.js:182-210, scaled 1.4): four
  pale weepers along the walk that turn to face you ONLY while unseen —
  vicious against a weapon you have to watch fly.
- THE DARK EYES (scares.js:198-240): the slitted three-eyed apparition,
  unlit basic materials, 0.82s life, 38Hz buzz, spawning in the wall dark
  between candle clusters every 9-17s. New audio.eyeGlimpse() (ported).
- THE PRESENCE (entity.js whole file): the 78-mesh starved thing —
  malform() noise on every primitive, wrenched head, hanging jaw, third
  eye, second face in its shoulder, chest eyes, rib-halo, black rags,
  stop-motion jitter at held 14fps frames. NO lights ported (emissive
  carries it; census untouched). On first entry it ERUPTS from the floor
  ahead, stares, folds away — then waits at the altar in GUARD mode,
  growing 40% taller as you close, head bowing down at you.
  **The skull passes THROUGH it** (a flinch and a whisper — your verb is
  not from its game). The way past is MARROW's: walk into the loom to
  d<1.15 and it YIELDS — folds through the floor, the earth thuds under
  your feet. It did not leave.
- THE RELIC: MARROW's small wet thing on the altar. Outbound throw takes
  it once the guardian yields; it rides home as a dangle in the skull's
  JAW (locket precedent, opposite side). Then the WALLS TRAVEL beat: 5
  knocks circle nearer with shrinking gaps, and it rises one last time
  between you and the door — and lets you pass.
- Flags: marrow:entered/witnessed/guardianYielded/relicKept/escorted.
  State on game.marrow. Checkpoints as 'graveyard' (host act law).

## Also on this branch (Alex's live-play notes, same night)

- MAUSOLEUM LEGIBILITY: the key now GLOWS in grave #6's rubble (descriptor
  + breathing scale), keeps glowing IN THE SKULL'S MOUTH after the grab
  (emissive 2.4), the unlocked canine breathes light to invite the throw,
  and the sharpened skull wears an INVERTED-HULL pale-steel OUTLINE
  (BackSide shells over every solid skull mesh) — "some effect making the
  skull look stronger with a cool outline or glow."
- HANDS: the lowered-hands pose left the forearm sleeves behind as "a
  black outline at the bottom of the screen." The sleeves now sink WITH
  the gone-blend and everything hides fully at blend 0.985.

## Verification

- regressions 73 (marrow-descent: 9 checks — pit collapse, entry, palette,
  guardian at altar, throw-through, yield-by-walking, relic in jaw, exit
  with fog restored). district-culling 14 (marrow sealed at 202 draws,
  zero leaks, exact restore; sweep max 443/450). Full battery on the
  branch tip — see test results.
- KNOWN SCRIPT TRAP: placing a test player inside the pit footprint on the
  same tick the district opens gets ejected by the not-yet-collapsed
  collider — step once AFTER setting graveyardResolved before placement
  (real play is unaffected; the collider is long-collapsed by approach).

---

# HANDOFF - 2026-08-14, THE BIG FEEDBACK PASS (branch claude/feedback-aug13-night)

Alex's second feedback batch, same night, every item actioned. Two design
REVERSALS, one new secret, one new haunting, the Underfalls remake, and four
small trues. His directive: "Let's get to it! when you're done, update the
website with your best version."

## What changed (all src on this branch)

1. **THE TROLLEY IS NECESSARY** (reversal of the Aug-13 verification). A
   room-side iron lattice cages the study bell (`house.js` buildWindowRelay):
   direct throws clang off it, shiver the bell without ringing, and nudge
   toward the mooring. Only the carried trolley (or the basement-pilot
   stranded-save valve) commits. house-critical-path Blocks A/B/C rewritten
   to drive the trolley (door-open loop + the expansion test's choreography);
   playthrough already used the trolley.
2. **THE CANDLE GOES ON** (`voidDoorAct`): the door now opens on an UNLIT
   igniter; the outbound strike LIGHTS it (bloom + fireRoar + glassTink),
   the skull takes the heart of the flame (ateFlame unchanged), the candle
   keeps a residual burn (flameCircuit sources can be `residual`), and a
   NEW brass down-line beside the stand runs hot downward with three
   descending knocks — the fire visibly goes somewhere below.
3. **THE ARCHIVE IS NECESSARY**: the collar valve is the furnace's second
   draft half. `archiveDraftOpened` (flag) is now required by the firebox
   alongside `pumpGalleryLatched`, and `pilotLit` is enforced too (the tests
   always claimed it; the code now agrees). The strike surges the stands AND
   pins them awake (`route.draftOpen`), burns the caged lamp up, and runs a
   duct-thunk chain east to the furnace, which answers with fire. Refusals
   point at whichever half is missing (`game.blindArchive.nudge`).
4. **WIRES**: floor conduit winch→gate→jamb; archive ceiling-main extension
   dropping the shared hatchbay wall; the winch drum finally has an axle
   into the east wall, a bearing, a pedestal, a mast whose eye the cable
   actually hangs from (cableTop B+2.26), and spokes in the wheel's own
   plane (they were perpendicular to their rim).
5. **THE SEALED MAUSOLEUM** (`outside.js` buildSealedMausoleumSecret): the
   east mausoleum takes a barred grate + fat padlock; the key (makeKey) lies
   in the rubble of hero grave #6 once toppled (state-derived every tick,
   reset-proof, never a debris-pool entry); inside, an IRON CANINE on a
   plinth. Take it (outbound, after unlocking): `skullPower = 2` — stuns
   hold twice as long, knockback doubles, slower contacts count (speed gate
   8/power), longer hit flourish — and the skull's sockets deepen 13%. The
   two-tier stun-then-pop grammar is UNTOUCHED. Flags: gotMausoleumKey,
   mausoleumUnlocked, skullSharpened. enemies.js reads game.skullPower.
6. **WINDOW WATCHERS** (`house.js` buildWindowWatchers): one nine-mesh
   figure haunting the five glazed windows (landing, nursery, dining,
   kitchen, guest — the scullery crawler owns the open one). Climbs into
   view outside the glass while watched, palm+fingers to the pane at 78%,
   vanishes on look-away or approach, hops sites on a growing cooldown.
   `game.windowWatcher.force(i)` for deterministic tests.
7. **UNDERFALLS: WATERFALLS, NOT ROCKS**: six new route-SPANNING water
   curtains in the interior-cataracts instanced draw (entry throat, apse
   mouth, both sluice legs, hatch approach, secret dry return), each with a
   pooled candle descriptor; floor rock teeth moved OUT of the movement
   clamp (halfW+0.18→+0.62 — the literal "walking through rocks"); sluice
   gate posts out of the lane (w-0.34→w+0.12); cave fog 0.07→0.055 with the
   comment extended; cataract shader brightened. Zero new lights, zero new
   colliders, zero draw calls added.
8. **HANDS DOWN** (`skull.js`): a third authored hand pose (`lowered`) and a
   gone-blend — after the waterfall bargain the hands sink out of frame.
   Hands only; `hold` never moves (kept locket + finale capture safe).
   FEEL_PROFILE untouched.
9. **CHAIN, FOURTH ASK**: rope emissive 0x39423f @ 1.35, knots x1.28 /
   0x59666b @ 0.85. **TENTH STONE** at dz 7.35 — the true first step at the
   water's edge (basin outerR puts water at dz~7.0; the old first stone at
   8.8 left 1.8 m of shin-dip). Prepended in spatial order; stride check ok.

## Recorded, not built

- MARROW-enemies area ("probably not for this run"): an area with MARROW's
  actual creatures. Alex wish, future run.

---

# HANDOFF - 2026-08-13 night, Alex's website-build feedback (SUPERSEDED — every item above)

Alex played the LIVE Codex-pass build (site PR #52, pre-ossuary) and sent
notes. His words are the spec; quotes verbatim. He explicitly prefers playing
builds on the website — deploy verified work promptly rather than stockpiling.
Same message approved deploying the ossuary climb (site PR #53, now live).

## Done immediately (branch claude/chain-light-and-first-stone)

- "In the forest i think those swingy things need to be lit up more to see
  them better." — THIRD statement on chain visibility. ropeMat now carries
  emissive (0x2a3134 @ 0.85) so the line reads regardless of what light
  reaches it; knots up to color x1.18 / emissive 0x434d51 @ 0.6. Pixel A/B:
  the dropped-line window went 23.8 -> 36.8 mean luminance (bark was 12.0).
  Road stays brighter than pocket secrets.
- "the extra rock should be added closest to where the player has to step
  onto the first rock." — the 8th stone fixed the FAR-bank stride; the entry
  stride (shelf lip at dz~16.5 to the first load-bearing stone at 17.4, over
  the drop-off) was the same shape unfixed. A NINTH stone sits at dz 16.55.
  Inserted in spatial order so the stone-by-stone rise wave stays a wave
  (rise delay is index-based; cosmetic x-wobble of the last three stones
  shifts a few tens of cm, all strides verified <= 1.72 m).

## Open — needs design + in-game verification, not a quick patch

1. TROLLEY, THIRD TIME: "The basement/house puzzle on the website now is
   still unclear. I'm not sure if you have to use the window tool to do that
   part. the bell is exposed in the other window anyway and you can hit it."
   The BEHAVIOR is verified correct (bell throw is primary; trolley optional)
   — the problem is the trolley does not READ as optional. Make the machine
   say "shortcut, not lock". Repeat = priority.
2. ARCHIVE BACK ROOM: "That last room in the basement with all the dials and
   knobs and machines and the light. does that require you to do anything? i
   wasn't able to tell. things showed no effect that was clear enough." It is
   optional (non-key reward; the collar valve answers one hit). The answer
   effect must get much louder/clearer — current wake+needle answer did not
   land in his playthrough.
3. MACHINE GROUNDING: "The turning wheel to lower the gate in the basement
   still has a back part that just floats and isn't connected to a wall...
   The cage where you have to throw the skull into to raise the thing and
   activate a light would look better if... like all the stuff was attached
   by some wires on the floor or something across those basement puzzles."
   Find the floating rear piece in-game first; then run floor
   cables/conduit connecting cage -> lamp -> mechanism across the basement
   puzzles (the kennel/crawl-secret vocabulary already has the chain kit).
4. VOID-DOOR CANDLE ROOM: "that room has a candle or light you hit to turn
   out... I do like how this room plays the role. but it is unclear. you
   should probably be turning the candle/light on instead of off. and there
   should be some sign that the fire moves or is wired up to something in
   there." The flame-circuit fiction (fire has ONE home) is right but the
   transfer does not read — show the fire MOVING (skull visibly carries it,
   or a conduit/trail), and reconsider the on/off polarity of the read.
5. NEW CONTENT: "If you could add some more creepy things that climb into
   random windows when you look through, it would be pretty cool." Port the
   scullery-window watched-crawler pattern to more windows, randomized.

## Confirmed good (do not churn)

- "The graveyard stuff is working pretty well."
- "THe ending room is working perfectly as far as i can tell."
- He has NOT yet played: the ossuary climb/pockets (went live after these
  notes), the enemy resculpts/audio/scream in anger, the brighter chain.

---

# HANDOFF - 2026-08-13 late, THE OSSUARY CLIMB (MERGED - LIVE via site PR #53)

Read `AGENTS.md` first. Branch `claude/ossuary-climb` off `claude/to-fix-aug12`.
The one remaining unbuilt item from Alex's list is built: the ossuary far exit
is a real climb, and the empty pockets are inhabited. Alex approved building it
("the next task sounds excellent — do both") the same day the Codex pass went
live via site PR #52.

## What exists now (src/outside.js unless noted)

- **THE CLIMB.** Past the sinking slab the corridor becomes a 6.9 m-tall
  shaft: flight A (11 treads, east side) to a solid landing, a 90° turn,
  flight B (6 treads, under the cap wall) to a hatch platform — hand-authored
  treads + colliders in `routeRoot`, plus plain `world.ramps` records
  (`ossuaryFlightA`/`B`) and three new `world.rooms` rects for ground truth.
  The old three decorative rungs are gone. Parapets are stepped visuals with
  solid collider bands. The swap to the forest fires only at the TOP
  (`p.y > FLOOR+3.05`, on the platform, `exitT > 0.98`, skull held), masked
  by the deck mouth exactly like the entry throat.
- **THE HATCH.** A deck at `FLOOR+5.25` with one mouth over the platform; an
  iron lid, chain X, hasp and fat brass padlock beneath (the basement bilco
  language). Everything — slab, chain drop, lid swing, mouth glow, forest-side
  arrival — derives parametrically from `state.exitT`, so the director restore
  seats the whole far end with `exitT = 1` (`director.js` now forces it; the
  old restore left the exit re-sealing for a second).
- **THE ARRIVAL.** A stone curb-and-lid mouth at the forest gate
  (`FOREST_GATE.z + 0.3`), flush and shut until the payout, standing open
  over a voidMat throat after. The player lands past it facing the forest and
  can turn around and see the hole. Registered in `graveyardLookbackRoots` so
  back-district culling keeps it; a `skullPass` collider walks the player
  around the hole. Relocation target moved to `FOREST_GATE.z + 1.35`.
- **THE WEST POCKET (kennel false-back).** Bars the skull passes and the
  player never (instanced bars + `skullPass` collider), a cradle fetch-target
  (`ossuaryKennelCradle`, outbound-only, `anchorAt` swing), hold-to-weigh
  1.25 s with 1.8× bleed, strain creaks that rise with progress, a slam +
  shake on early release, a shutter that rises on smoothstep, and behind it
  the SEATED ONE — the old capsule witness moved into the wall, head tilted,
  one bone arm reaching — under a cold pre-created PointLight (intensity 0 at
  birth, census-safe) with a pre-solve light seam. `game.ossuaryKennel`,
  flag `ossuaryKennelSolved`.
- **THE EAST POCKET (resonant niches).** Three quarter-scale minis of the
  resonant graves in voidMat-backed niches, wearing the surface graves'
  settled/bowed silhouettes LIVE off `game.resonantGraves[i].credit` —
  silhouette and value only, no hue.
- **THE RESIDENT.** The corridor's witness is now a real Standing Kind
  (`spawn('walker', …, 'standing')`, `e.ossuaryResident`), posted west of the
  last baffle's forced east gap. New opt-in `e.tether` (enemies.js) bounds its
  unobserved creep to 2.2 m of its post: it closes while your back is turned
  but never leaves its station — a walk of glances, not a corridor pursuit,
  and deterministically safe for the playthrough bot. It is spared from the
  district visibility seal by `mesh.userData.keepInOssuary`, cleared on
  backtrack, and LAID TO REST (`enemies._layToRest`) when the counterweight
  pays out.
- **LIGHT CENSUS FIX.** `keepInOssuary` now spares `world.lightRoot`: the
  pinned census container is a Group, not a light, and hiding it dropped the
  entire census out of `traverseVisible` — re-triggering the exact
  whole-scene shader recompile the pin exists to prevent, and unlighting the
  district's own candles. The district-culling whitelist mirrors this.

## Verification (all uncontended, this branch)

- `smoke` all acts green; graveyard 424 draws (arrival hatch +10), zero errors.
- `autotest` 24/24. `regressions` **64/64** (two NEW scenarios: ossuary-climb
  — throat swap, resident law, forced-restore seating, grounded input-driven
  climb with monotone ascent; ossuary-kennel — anchor through bars, hold
  latches, skull returns, bars still stop the player).
- `playthrough` 40/40 — the bot now slaloms the baffles and CLIMBS both
  flights for real (`ossuary-exits-up-the-shaft-climb`, climbPeakY proof).
- `district-culling` 12/12 (far-hatch drive updated to the platform; zero
  leaks with the sealed shaft void). `failure-state` 20/20 untouched.
- `tools/probe-ossuary.mjs` rewritten end-to-end: real counterweight solve
  (throw/anchor/hold), real kennel solve, input-driven climb, arrival — and
  nine framed screenshots in `tests/shots/ossuary-*.png`. Exit code is real.

## Not done / next

- Alex's play pass. Then the site lane for this branch: merge to
  `claude/to-fix-aug12`, copy `src/` to qualiacology, parity audit,
  `fetch-boot-check`, preview, **his approval**, merge. Production currently
  = the Codex pass (site PR #52) WITHOUT the ossuary climb.
- The ossuary side pockets' audio is reused stock (creak/grind/knock/whisper);
  if Alex wants bespoke voices there, that is a new ask.

---

# HANDOFF - 2026-08-13, Codex feedback pass (MERGED - LIVE via site PR #52)

Read `AGENTS.md` first. This section supersedes the completion and branch-state
claims below it. The implementation was written on `codex/fetch-aug13-handoff-pass`
(based on `3960e8f`), independently re-verified by Claude the same day, and is
now MERGED into `claude/to-fix-aug12` at `d559969` via game PR #21.

Claude's adversarial review (evening 2026-08-13) confirmed the pass clean on
the light-census, sacred-contract, audio-architecture, and perf dimensions,
and found ONE real defect: the chain's rope brightening was dead code —
`ropeMat` was cloned and brightened in `_buildChain` but every segment,
dropped aiming lines included, baked into the single `M.bark` InstancedMesh,
so the line still rendered canopy-dark. Fixed in `09bb34c`: the dropped lines
bake into their own InstancedMesh wearing the pocket ropes' material
(pixel-verified — the line's sampled luminance doubles; forest 318→319 draws).
All four canonical gates + creature-audio 11/11 + chain probe re-run green on
the merged tip.

Site lane: the six changed `src/` files are copied to qualiacology as
**site PR #52** (`fetch-aug13-codex-pass`), full-tree parity with `d559969`
verified. `build/qa/fetch-boot-check.mjs` PASSED locally (97ms to world,
skull visible in hand, zero errors). **Not merged to the site** — waiting on
Alex's play/listen pass on the Netlify deploy preview and his explicit
approval. The public site is still the August 12 build until then.

## Alex's six notes - current truth

1. **First-floor trolley:** verified before touching. The ordinary study-bell
   throw is the intended primary solution and completes the relay directly;
   the window trolley remains a working optional alternate. Both paths are
   independently covered, so no progression logic changed.
2. **Odd basement light:** rebuilt the kennel and archive presentations around
   their existing physical sources. The kennel's existing cold fixture now has
   a bracket, hood, visible seam, restrained pre-solve light, and a slow shared
   breath. The archive cage now hangs from a ceiling stem/canopy; the orphan
   collar glow is gone, the metal itself reads, and the real pooled source
   breathes slowly. The resident light census is unchanged.
3. **Awkward forest:** preserved every derived chain position, height, launch,
   and swing law. Rope and knot values now read by brightness/shape; each real
   road-knot catch gives one quiet positional rope creak toward the next knot.
   There is no HUD, magnetism, control theft, or hue-only instruction.
4. **Feel-around-dark waterfall cave:** raised the cave ambient floor from
   `0.30` to `0.42` (still below the forest), strengthened and widened the
   neutral wet route, raised turn/jamb value, and made the final hatch/frame/
   chains readable by material value. No light was added or toggled.
5. **Freakier enemies:** retained Walker gameplay and horde cost while giving
   it deterministic secondary-body snaps; rebuilt the Resident as an uneven
   doorway/yoke body with a physical sternum seam; rebuilt the sole Kneeler as
   a collapsed load-bearing animal with crooked planted forelimbs and a lateral
   jaw. Enemy loops and wind tells are now kind-specific, inharmonic, irregular,
   spatial sounds rather than interchangeable noise.
6. **Odd scream:** replaced the clean synth gliss with a sucked inhale,
   staggered inharmonic throats, moving formants, pitch breaks, tooth/tear
   transients, and collapsing body. Removed the redundant adjacent graveyard
   sting and shortened/softened the mix duck so the scream owns one beat.

`tools/shot-enemy.mjs` is now a real nine-frame presentation gate: all three
enemy kinds, three production states each, settled authored act ambient/fog
and skull light, deliberately neutral transient fear/vignette, no held-skull
model occlusion, exact projected mesh bounds, recorded lighting values, and
browser-error failure. It writes PNGs plus `report.json` under
`tests/shots/enemy-presentation/`.

## Verification on the final source

- `node tests/smoke.mjs` - all acts and budgets pass, zero browser errors.
- `node tests/autotest.mjs` - 24/24, zero browser errors.
- `node tests/regressions.mjs` - 54/54, zero skipped.
- `node tests/playthrough.mjs` - 40/40 milestones; bedroom through ending.
- `node tests/house-critical-path-regression.mjs` - direct bell path passes.
- `node tests/house-expansion.mjs` - trolley alternate and basement rooms pass.
- `node tests/basement-foundations.mjs` - 8/8.
- `node tests/underfalls-expansion.mjs` - 13/13.
- `node tests/horror-expansion.mjs` - 16/16.
- `node tests/creature-audio-regression.mjs` - 11/11; live WebAudio graph
  coverage for all creature loops/tells and the scream, plus exactly-once
  tell/fallback and arena scream/no-adjacent-sting routes (Chrome output device
  muted only).
- `node tests/forest-nervous-system-regression.mjs` - 9/9; cold start
  `181.2 ms`, audio bake `74.5 ms`.
- `node tests/render-perf.mjs` - real D3D11 pass; forest GPU p95 `11.12 ms`,
  delivered-frame p95 `16.8 ms`, zero context/browser errors.
- `node tools/probe-chain.mjs` - all five road knots caught, end to end.
- `node tools/probe-underfalls.mjs` - seven story-valid vistas, zero errors,
  maximum 179 draws / 71,837 triangles.
- `node tools/shot-enemy.mjs` - 9/9 fully framed, zero browser errors.

One early four-browser batch produced a harness navigation timeout and a cold
forest timing miss under GPU contention. Nothing was waived: the processes
were allowed to clear and the affected gates passed cleanly in serial. The
numbers above are the uncontended final runs.

## Still not done

- Human, unmuted speaker/headphone review of the new enemy loops, wind tells,
  and scream. The focused headless gate executes a live WebAudio graph while
  Chrome's output device is muted; it proves wiring and stability, not taste
  or listening comfort.
- One uninterrupted human forest/chain and cave traversal for final feel. The
  deterministic traversal and pixel gates are green, but they do not get the
  last word on awkwardness or delicious darkness.
- The planned real ossuary shaft climb and the empty ossuary side pockets.
- Alex's approval + merge of site PR #52, then canonical-domain verification.
  Copy, parity audit, and the local boot gate are done; do not call this live
  until the PR merges with his explicit approval and production is re-checked.

---

# HANDOFF — 2026-08-12, the to-fix sweep (CURRENT — LIVE ON THE SITE)

Read `AGENTS.md` first. Short version: Alex sent a to-fix list with
screenshots; all of it shipped to production today except what is under
"Not done" below. Production = site repo qualiacology `fetch/` = game branch
`claude/to-fix-aug12` (pushed to origin). **Game-repo `main` is OLDER than
the site now — work from the branch, not main.** Six site PRs (#46–#51),
each verified with the site repo's `build/qa/fetch-boot-check.mjs` — run it
before shipping anything; it exists because 74 green counter checks once
shipped a game you could hear but not see.

## Done today (do not redo)

- Every "freeze / lag when entering areas / hit-something-and-it-freezes"
  report was ONE bug: three.js recompiles every shader when the number of
  visible lights changes. The census is now pinned (`world.js`
  `pinLightCensus`). **Law: never add or remove a light at runtime.**
  Pre-create it, or borrow via `world.loanLight`/`returnLight`. Candle
  descriptors pushed to `world.candles` are always safe.
- Empty hands turn over and read as hands (`skull.js`).
- Firebox shows real fire; broken planks fall clear of the cellar doorway;
  the 8th stepping stone in the water IS in (`outside.js`, `bridgeZ` —
  Alex asked; it is done).
- House enemy comes out early and actually hunts: door-to-door routing,
  closing a door costs it time, slamming one staggers it
  (`enemies.js`/`director.js`; gate =
  `tests/house-chase-doors-regression.mjs`).
- Enemies emerge from the ground by default; the nursery reveal grows the
  real creature, no placeholder swap (`enemies.js`).
- THE CHAIN: five consecutive swing knots in the forest plus a teaching
  link (`outside.js`: `this.chain`, `_buildChain`). The pivot heights and
  spacing are DERIVED numbers with the law written beside the data — read
  that comment before moving anything.
- The bell beat is finally necessary: the guest candle is the only flame,
  the basement pilot is cold until the carried fire lights it, and the
  incinerator gates on `pilotLit` (`house.js`;
  `tests/house-critical-path-regression.mjs` holds the whole contract).
- Underfalls route legibility: pale wet ribbon on the main route only,
  chamber floor discs, flatter light falloff, turn markers, chamber
  doorjambs, dry lintel on the culvert mouth, wall value ladder
  (`underfalls.js`, `atmosphere.js`).
- Ossuary: entry faces down the corridor, counterweight is bolted to the
  wall, bone niches, a light rhythm per baffle, and the exit collider
  honestly follows the sinking slab (`outside.js`).
- The archive back room wakes when the player walks in and has one
  hittable collar-valve the whole room answers; the kennel counterweight
  has visible chain, a pre-solve light sliver, strain audio during the
  hold, and a slam on early release (`house.js`).

## Alex's fresh feedback — his words are the spec; none of this is done

1. "i don't think the contraption on the first floor that you need to move
   to the window needs to be moved in this version to ring the bell, but
   I'm not sure." — the window trolley relay vs the direct study bell.
   VERIFY what the trolley actually does now before touching it; it may
   just need to read as optional. Don't remove anything on a hunch.
2. "That light in the last room of the basement is still a bit odd." —
   deep-basement rooms (`house.js`, archive lamp / kennel lamp area). Look
   at it in-game first; decide what "odd" is before changing it.
3. "the forest feels better, but it is still a bit awkward." — open-ended.
   Play it. Small feel passes, not rework; the chain numbers are derived.
4. "Inside the waterfall is cool, but its kind of so dark you just have to
   feel around. there should be a method to the madness." — the route
   markers shipped, but the cave act may simply be too dark overall.
   Consider the act's ambient floor (`director.js`, `AMBIENT_BY_ACT`).
   Alex is colourblind — brightness/shape/motion only — and mind the
   light-census law above.
5. "we still need to make these enemies look freakier. some of the enemies
   we used in the game marrow actually looked really freaky. and sounded
   freaky." — raid MARROW for creature look AND sound (per his memory the
   hub copy at qualiacology `marrow/` is the only source). FETCH creatures
   live in `enemies.js` (`buildWalker` / `buildResident` / `buildKneeler`).
   Keep the animation contract (limbs arrays, head userData) intact.
6. "we still have some odd scream sound effect in this one." — `audio.js`,
   everything is synthesized, no files. He has called the scream lame
   before; it has never been fixed.

## Also not done (planned, never built)

- The ossuary far exit is honest but still a proximity swap past
  decorative rungs. The real climb (ramp flights up a shaft, a hatch the
  counterweight opens, a matching arrival hatch at the forest gate) was
  planned and not built.
- The ossuary side pockets are still empty rooms.

## Rules that get work rejected

Throw grammar is sacred (press = throw, hold = stays out, release =
returns; no charge). `FEEL_PROFILE` in `skull.js` is frozen. Alex is
colourblind — no read may depend on hue, ever. No HUD, no on-screen words,
no control theft. No `setTimeout` — dt-driven beats only (`game.after`).
Never add/remove lights at runtime. This checkout is shared — work in your
own worktree; never check out over someone else's tree.

## Gates (all green before any deploy; run from the game repo root)

`node tests/smoke.mjs` · `tests/autotest.mjs` · `tests/regressions.mjs`
(54) · `tests/playthrough.mjs` · `tests/house-critical-path-regression.mjs`
· `tests/render-perf.mjs`. Deploy = copy `src/` into qualiacology
`fetch/src/`, feature branch, PR, boot-check the Netlify preview
(`node build/qa/fetch-boot-check.mjs <preview-url>/fetch/`), merge only
with Alex's approval.

---

# HANDOFF — 2026-08-10, bell/pilot/intruder recovery (CURRENT, UNRELEASED)

Read `AGENTS.md` first. This section supersedes every release-state claim below.
Alex's public playtest of `0.4.0-ossuary` exposed a real human-route failure:
the cellar boards admitted the player before the old fussy exterior-return bell
and upstairs flame were understood, while the incinerator still required a
flame. The supposed bell payoff used a generic metal-drop sound. The result was
a basement full of convincing valves with no legible critical flame.

The in-progress `0.5.0-intruder` repair is on
`codex/fetch-masterpiece-2026-08-09` in the isolated worktree
`C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-masterpiece-dev`.
It is not live merely because focused tests are green. Its source commit,
standalone artifact identity, source PR, Qualiacology PR/deploy preview, merge,
and production verification must be recorded independently before this heading
can say deployed.

## Current repaired house contract

The house is a partial-order mechanism, not one misleading single-file queue:

```text
bedroom key + nursery key
  -> servant bell and three cellar boards (either order once downstairs)
servant bell
  -> upstairs guest flame becomes available
servant bell + three boards
  -> cellar opens -> basement pilot flame and pump become reachable
either flame + latched pump
  -> incinerator refusal -> ash key -> hatch
```

- The primary bell solution is one ordinary outbound throw at a plainly
  silhouetted study servant bell. It uses a dedicated long positional bell
  ring, releases the visible cellar circuit latch, opens the upstairs flame
  room, and wakes the lag mirror. The held living-window trolley and study-
  window return remain an advanced alternate solution to the same idempotent
  circuit, with a tolerant authored endpoint.
- The cellar requires both the servant-bell latch and all three boards. Bell-
  first and boards-first reconcile to the same state. Each board accepts only
  an outbound hit so a returning skull cannot tear a second plank for free.
- `ateFlame` has two intentional routes. The upstairs guest candle is the safer
  early source; the caged pilot on the first basement landing is an equally
  valid visible alternate. The first source atomically extinguishes/disables
  the other and seats the same persistent ember upgrade in the skull. One flame
  is required; neither individual source is secretly mandatory.
- The small graveyard-facing scullery window now owns a separate watched
  invasion. A genuine look starts a wet long-haired body outside; continuing
  to look pulls it across the sill in authored stages, while looking away
  freezes it. Approaching any visible stage triggers an authored recoil and
  dissolve before the body can overlap the player; the wet sill/floor proof
  remains. It never steals the camera or input and it gates no progression.
- Escape and P now pause fixed-step simulation, director
  beats, held skull/rope state, finale time, cosmetic animation, camera shake,
  and WebAudio. Resume drops paused wall time; Restart from Checkpoint preserves
  solved progression and cancels an in-flight basement exit transaction. A
  real clickable pause button remains available whenever pointer lock is not;
  locked desktop play hides that otherwise unclickable affordance.
- The standalone title uses the content-addressed 1280×720 intruder key art at
  `assets/fetch-title-keyart-5ab7c65b.webp`. The deterministic packer and clean-
  archive verifier now include and decode that asset rather than trusting a CSS
  reference to a missing file.

## Optionality truth for this revision

- Required: both opening keys; one servant-bell solution; either flame source;
  all cellar boards plus bell latch; pump hold/cross; incinerator refusal, ash
  key, and hatch; one graveyard resolution; ossuary counterweight/far hatch;
  fallen tree, two forest choices, mire rope, waterfall sacrifice, Underfalls
  hatch, and finale contact.
- Optional/alternate: locket; nursery mobile management; the bell solution not
  chosen; the flame source not chosen; both house visitors/lag mirror/return
  horror; kennel and blind archive; hero graves and the grave route not chosen;
  forest story objects, rope pockets, the three-wave forest arena, Kneeler
  combat, branch alternatives after commitment; Underfalls dry-return shortcut
  and bell-cistern exploration.

The forest arena's optionality is source truth, not euphemism: entering the safe
clearing cancels unfinished arena waves. If a later design makes that boss
mandatory, it needs a real physical gate and new failure-state tests; prose must
never pretend the current gate exists.

## Release gates still pending at this heading

- Frozen source verification is complete: **67/67** JavaScript modules parse;
  focused house/progression/crawler **21/21**; pause/title/pointer-lock fallback
  **25/25**; all 23 formal browser/simulation modules green; canonical
  autotest **24/24**, regressions **50/50**, eight-act smoke, and complete
  playthrough **38/38**; zero browser errors. Real D3D11 render p95 peaks at
  **10.701 ms** against the 45 ms gate, and district culling peaks at **420**
  draws against 450. An unmuted system-Chrome direct-bell throw committed once,
  kept AudioContext running, and scheduled the four scaled inharmonic partials
  plus strike source once; the return leg added no second ring.
- Deterministic standalone package is complete: two builds matched exactly at
  **25 entries**, **1,953,010 raw bytes**, **578,074 ZIP bytes**, SHA-256
  `71521a2bff1f9290cd1cb39034b22e1171d786cd28993e60ae44c15ed3e89db3`.
  The verifier extracted to a unique clean directory, exact-compared every byte
  to current shipping roots, decoded the 1280x720 title art, and booted
  `0.5.0-intruder` / skull variant E with zero browser errors. Release-integrity
  negatives passed **7/7**, and the old ossuary ZIP is explicitly rejected for
  lacking the required content-addressed title artwork.
- Source commit/PR/merge.
- Qualiacology isolated sync, generated-hub validation, deploy-preview browser
  inspection, production merge, and fresh live checks of bell, pilot, crawler,
  pause, title, catalog card, social image, version, and cache headers.

---

# HANDOFF — 2026-08-10, masterpiece integration (HISTORICAL OSSUARY RELEASE)

Read `AGENTS.md` first. This historical section records the ossuary source truth for the
isolated worktree at
`C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-masterpiece-dev`.
The integration work is on `codex/fetch-masterpiece-2026-08-09`, started from
`ea414a8`. The shipping-source integration is recorded at commit `c8a50c2`.
A deterministic standalone ZIP built from that source has been independently
clean-booted; its exact identity is recorded below. The existing Qualiacology
FETCH runtime was updated through site PR #34 and production merge `dc8555a`.
The public game at `https://qualiacology.com/fetch/` was independently verified
as `0.4.0-ossuary` after deployment. Verify Git, artifact, deploy, and live state
independently instead of inferring one state from another.

The older handoffs below remain as an append-only engineering diary. Their old
"release", "THIN", "not fixed", queue, hash, branch, and deployment statements
describe the snapshots that produced them; they do not override this section.
For the current spoiler route, use `docs/WALKTHROUGH.md`. For a compact current
engineering map plus the old forensic record, use `docs/STATE-OF-PLAY.md`.

## Current playable spine

The house and graveyard are no longer collections of suggestive but optional
props. The required route now has an explicit physical chain:

`bedroom key → nursery key → window relay → stolen flame → cellar → pump`
`→ incinerator refusal → hatch key → grave ritual/combat → ossuary`
`→ forest → clearing → Underfalls → mirror contact`

- **The opening door accepts the game's verb.** The skull fetches the key from
  the branch; an outbound throw at the lock consumes it and opens the door.
  Walking up and pressing E remains a valid accessibility/fallback interaction.
  Wrong-key throws answer with a real locked impact and rattle instead of
  silently passing through the door.
- **The window relay is required house progression.** Throw through the open
  living-room window into the exterior mooring, keep LMB held while walking the
  skull's trolley down the outside rail, then release so the returning skull
  enters through the study window and rings the one-way servant bell. That
  physical return opens the door above the stair void and wakes the lag mirror.
- **The house uses the relay as horror, not just wiring.** A staged body climbs
  through the living-room aperture while the skull's light is travelling away;
  direct observation freezes its poses, and the solved relay leaves wet proof
  and a later guest-window echo. The relay also wakes a pooled planar mirror
  whose inhabitant follows the player about a second late.
- **The flame is a real dependency.** The newly opened upstairs room exposes a
  candle. A skull hit extinguishes it, seats embers behind the skull's sockets,
  and increases the carried light by value as well as warmth. This is the
  `ateFlame` state the basement machinery reads.
- **The return through the house is deterministic.** Only the completed relay
  plus the stolen flame arms a nine-beat spatial footstep route from the window,
  through both floors, to the cellar boards. Previously visited furniture moves
  only after the player has left and is not looking. An ordinary scullery door
  creeps open only a crack and keeps its collider until the player uses it. The
  final beat hands the noise to the Resident rather than spawning an unrelated
  scare. Death and act changes pause the exact prefix without duplicating it.
- **The pump is now mandatory, not an optional side district.** In the old
  under-house works, an outbound skull clamps into the winch. Keep holding while
  five bridge leaves pay out and cross under player control; the far-bank pawl
  latches the route. Early release visibly rewinds and re-arms the mechanism.
  The incinerator requires its latched draft, so this is part of the critical
  path rather than optional basement dressing.
- **The incinerator closes the causal chain.** Its firebox accepts a throw but
  refuses to complete without both the stolen flame and the latched pump draft.
  With both prerequisites, it tries and fails to burn the skull, opens the ash
  pan, and exposes the hatch key. Fetch that key, throw it at the hatch lock,
  then use the visibly unchained hatch to leave. Death cannot consume the key or
  cancel an already committed hatch exit.

The old crawl-room counterweight, dog-and-ball secret, nursery mobile threat,
Resident, bedroom locket, and furnished rooms remain. Expansion was layered
onto the established game rather than reconstructing it.

## Graveyard: two resolutions, one required under-yard route

- The iron gate is shut from entry. Crossing the central grave row starts a
  three-wave arena of 4, 5, and 6 risen bodies, with a real breath between
  waves. One enemy may own a committed strike in the early fight and two in the
  later fight; attacks commit to fixed ground so sprinting out is valid
  counterplay. A first skull hit stuns quietly; a second pop is loud.
- Three resonant graves provide the alternate ritual resolution and function as
  crowd control. Each must receive its own outbound throw; a returning skull
  cannot credit a second stone backwards. Completing all three ends the funeral
  without requiring the remaining loud clear.
- Six hero graves are destructible tactical terrain. The first hit chips and
  rocks one; the second topples it, drops its collider to a walkable obstruction,
  emits a bounded resonance stun, and uses a fixed debris pool. An unresolved
  death restores the stones, targets, collision, and pool state.
- Resolving either grave route opens the left mausoleum, **not** the forest gate
  by magic. Its stair descends to a short, authored ossuary with alternating
  baffles, two shallow pockets, a watched/unwatched witness, and a counterweight.
  Short pulls decay; one uninterrupted hold lowers the far slab, opens the
  surface gate with the gate's own creak, and raises the forest-side hatch. The
  intended far hatch exits just beyond the gate and commits the forest act.
- The old orb/cylinder body placeholders have been replaced with dressed,
  jointed, asymmetric dragged figures and readable drag marks. The final close-
  body and exterior visual passes are green on the current source. The bodies
  have custom rib/waist/head volumes, tapered bent limbs, hands/fingers, wedge
  footwear, clothing folds, contact shadows, and directional drag poses. This
  remains a procedural low-poly game: the evidence establishes readable human
  anatomy and grounding, not photoreal scans.

## Forest: authored topology and a spatial nervous system

- The 208 m route now contains two actual braided forks, not painted signs.
  Both sides can be entered and examined. Six metres into a branch commits the
  choice: the forest visibly knits behind the parent path and across the rejected
  mouth while the chosen ribbon remains physically open. All four left/right
  combinations preserve one monotonic progress clock and respawn on the chosen
  ribbon instead of inside a closure.
- Eight deterministic objects occupy real forest coordinates: a radio on a
  chair, a telephone on a stump, the searchers' swing, a CRT in a ditch, a
  washer, a refrigerator, an arena generator, and a bell in the copse. Their
  HRTF loops are heard before the objects become visually legible, with a strict
  nearest-two continuous-voice cap. A skull hit visibly silences an object but
  makes a loud world event that may wake nearby sleepers or invite bounded
  company. Rejected branches, the advancing seal, death, act changes, and the
  terminal ending all retire unreachable voices and targets.
- The fallen tree is three knitted branch/collision layers around one uprooted
  bole. Each outbound hit removes exactly one visible and physical layer; a
  returning skull cannot double-count. The last hit tears the root mass and
  drags the full log lengthwise off the route while collision remains until its
  visible mass has cleared.
- The apparent pre-rope map hole is now a visible mire: peat, reeds, suction
  rings, and a half-swallowed chair. It slows and sinks the player by depth, not
  by an out-of-map fall. Catching the ravine rope arrests the sink and preserves
  the press/hold/release swing verb; the checkpoint is earned only on firm far
  ground.
- The earlier forest arena, quiet-stun/loud-pop economy, optional held-rope
  search blind and bell copse, landmark chapters, Kneeler, and one-way seal
  remain. Loud play accumulates bounded company debt and sustained quiet drains
  it. A forest respawn grants 3.25 seconds before the Kneeler can be authored
  again, preventing the reported spawn-catch loop.

## Clearing, Underfalls, and ending

- The clearing is now composed as a place rather than a transition pad: closed
  forest edges, streams, a visibly matched plunge basin, shore detail, motes,
  layered waterfall rock/water, and the locket's optional shore return. The one
  sacred exception remains: throw the skull through the falls and it does not
  return. Stone steps rise through the water and expose the cave route.
- Underfalls is a skull-less 125.158 m authored district with thirteen main
  nodes: stone veil, intake, drowned pump chapel, multi-height sluice, overflow,
  descent, and hatch cistern. A real dry-return culvert and bell-cistern shortcut
  rejoins the upper route. One route model owns floors, clamp, cover, line of
  sight, and enemy navigation, so adjacent corridors cannot become a through-
  wall shortcut or a vertical-storey mismatch.
- The Drowned Choir follows its last audible world position, not the player's
  live coordinates. It warns before moving, follows collider-safe authored
  routes, and commits attacks to a fixed point. A committed sprint can evade it;
  the first catch teaches the consequence without killing, while the next can.
  Authored spray reveals, washes back, and resets it. Opening the ceiling hatch
  retires the Choir before the mirror transition.
- The finale preserves look and movement through recognition, lag, wall motion,
  prop consumption, hand pressure, fractures, and contact. The reflection now
  has a tailored articulated human body and wears an exact clone of the selected
  opening skull. Hard black happens before control freezes. The delayed catch,
  title, and human gasp then run once, after which animation frames, cave/forest
  loops, mirrors, shader warm-up resources, and WebAudio are explicitly retired.

## Donor audit: direct, useful, and honest

Marrow, The Eaten Path, and Still were inspected directly in local source **and
at runtime**. FETCH synthesizes their useful design grammar; it does not clone a
map, asset set, plot, or puzzle wholesale.

- **The Eaten Path** contributed the idea of a forest as a graph of authored
  paths and of strange side objects whose sounds belong to exact positions.
  FETCH mutated that into two reversible-then-committed braids, cumulative
  physical closures, eight breakable HRTF story appliances, and the existing
  skull/noise economy. Its bog is atmospheric ground; it is **not** a true
  sinking/quicksand mechanic. FETCH's mire behavior is new synthesis.
- **Marrow** contributed landmark-led forest composition and the grammar of a
  readable crypt route with chambers, baffles, and a physical exit mechanism.
  FETCH mutated that into the required under-yard ossuary and combat yard.
  Marrow's gravestones are **not** destructible; FETCH's two-hit tactical hero
  graves and pooled debris are new.
- **Still** contributed observation, light, noise, and delayed-house-horror
  thinking. FETCH mutated that into the causal window visitor, lag mirror, and
  deterministic return route. Still does **not** contain the literal visitor
  climbing through this window. In fact, none of the three donors contains the
  finished window-invasion sequence now in FETCH.

This donor honesty matters: use Alex's library as a feature-and-feel vocabulary,
then make the result obey FETCH's verb, story, geography, and failure laws.

## Laws preserved

1. Press LMB throws immediately; hold keeps the skull out; release recalls it.
2. `FEEL_PROFILE` is unchanged.
3. No separate tutorial, HUD solution text, forced camera, or playable cutscene
   was added. Every new gate is taught by geometry, light/value, motion, sound,
   failure, and consequence while input stays live.
4. No required read depends on hue. Silhouette, brightness, motion, timing, and
   spatial audio carry state for Alex's deuteranopia.
5. Sounds come from the things and coordinates that caused them.
6. Gameplay-looking objects either act, communicate a causal dependency, or
   remain clearly environmental; they are not fake controls.

## Verification state — full local and artifact gates green

Final-source local evidence:

- Canonical `autotest`: **24/24**.
- Canonical `regressions`: **50/50**.
- Per-act `smoke`: all eight acts green with zero browser errors.
- Two consecutive real-input full `playthrough` runs: **38/38 beats** each,
  bedroom through terminal shutdown, with zero failures.
- `failure-state-regression.mjs`: **20/20**, including the resonant-grave
  return-leg guard plus death/respawn, tree, mire, ossuary, and lifecycle cases.
- `forest-hardening.mjs`: **4/4**; edge-biased restores start on the active
  authored route, remain grounded, clear the cumulative seal, and move forward.
- `forest-nervous-system-regression.mjs`: **9/9**, repeated; cold Start remained
  below 250 ms, eight story buffers prewarmed in bounded idle slices, and the
  first loop was hitch-free.
- `district-culling-regression.mjs`: **12/12**; sampled maximum **420 draws**
  under the 450-draw ceiling, far-hatch forest frame **330 draws**, and cave →
  house restored exact authored visibility (`[]` difference).
- `choir-route-occlusion-regression.mjs`: **6/6**.
- Underfalls expansion: **13/13**; horror expansion: **16/16**; house-return
  horror: **12/12**.
- House expansion, performance-pool, basement foundation, pump recovery,
  enemy-stain, and Standing Kind focused suites are green (respectively: all
  house checks, all pool checks, **8/8**, **10/10**, **5/5**, and **2/2**).
- The final system-Chrome/ANGLE-D3D11 `render-perf` gate is green with zero
  browser errors. GPU p95 stayed below 8.5 ms in forest, 4.0 ms in cave, and
  16.5 ms in the mirror room against the 45 ms ceiling.
- Final grave-body, exterior-composition, five-seed grave-arena, and district
  checks are green with zero browser errors.

The culling/pool work is structural, not a raised budget: completed house/yard
districts retire after the forest commitment; Underfalls and the ossuary isolate
and exactly restore their resident roots; deep basement hides upper-house detail
outside its sightline. Gore (64), enemy stains (48), grave debris (36), fork
closures (60), candles, and mirror render targets are fixed resident pools or
bounded instance sets rather than retry-grown scene graphs.

## Verified standalone artifact

- Archive: `fetch-netlify-2026-08-09-ossuary.zip`
- SHA-256: `e4edf64544352dd2d5d8760388c74102e66fc803bbcc0be07007bd89a95c73aa`
- Contents: **24** root-relative shipping files, **1,827,683** raw bytes,
  **495,884** ZIP bytes; only `index.html`, `src/`, and `vendor/` are shipped.
- Two independent packer runs produced the same SHA-256.
- The verifier checked paths, bounds, central-directory metadata, CRC-32, and
  clean-extracted every entry to a unique temp directory before serving it.
  System Chrome/ANGLE-D3D11 reached ready in the bedroom with the intended
  skull variant and zero browser errors.
- The negative release-integrity suite is **5/5**: corrupt content, truncated
  EOCD, broken central directory, oversized declared output, and an unsafe
  output path are all rejected.

## Production deployment

- Site repository PR: `duplighost/qualiacology#34`
- Site sync commit: `ad6a126`
- Production merge commit: `dc8555a`
- Live route: `https://qualiacology.com/fetch/`
- Live version: **`0.4.0-ossuary`**
- The site deployment preserved the existing Qualiacology index shell,
  canonical/OG metadata, favicon, home pill, redirects, cache rules, and vendor
  files. Exactly eleven semantically changed FETCH runtime modules shipped.
- PR and post-merge static-site CI passed. The deploy preview and production
  route both passed fresh system-Chrome/ANGLE-D3D11 boots with the correct
  version, 402 opening draw calls, correct shell/cache headers, and zero browser
  errors.
- An unrelated local `behind-you/index.html` edit appeared in the primary site
  checkout during deployment. It was neither touched nor included; the FETCH
  sync used an isolated worktree and GitHub merge.

---

# HANDOFF — 2026-08-09, Underfalls horror release (Codex)

Read `AGENTS.md` first. The canonical source checkout is
`C:\Users\Alex\Projects\fetch-claude`; the Desktop `Fetch` folder is only a
handoff snapshot. This release was developed on
`codex/fetch-underfalls-horror`, on top of the merged Opus 5 foundation
(`d613efe`). It does not discard or reconstruct that foundation.

## The production reports were treated as release blockers

- **Forest holes / tree respawns / movement pins:** reproduced with randomized
  edge-biased deaths. Reseat now destroys stale seal instances, chooses a
  centerline safe pad, and recomputes ground in the same frame after lateral
  correction. The intentional rope ravine still kills; the exact spent-rope
  far-side checkpoint still survives death.
- **Pale object through the basement ceiling:** identified by exact bounds as
  the boiler flue. The flue now ends below the ceiling inside a soot-dark collar;
  a focused assertion compares both real bounds against the ceiling plane.
- **House-to-basement failure:** terrain y=0 was winning over the negative
  cellar ramp inside an authored floor hole. Terrain no longer competes inside
  an above-ground storey; the full route descends normally again.
- **Cave-to-finale failure:** the old playthrough driver tried to walk directly
  through a new 125m cave. It now traverses every authored Underfalls leg and
  uses the real first-person ceiling-hatch ray. Runtime collision was not
  weakened to satisfy the test.
- **Distorted inverted camera frames:** a stale negative RAF delta could push
  FOV past 180 degrees. Render deltas are clamped and projection signs are now
  a regression assertion.
- **White skeletal-looking hands:** the 58-intensity world skull lamp was still
  lighting the foreground despite object layers. World and held content now use
  separate render passes. Living hands have varied finger lengths, opposing
  thumbs, palm mass, nails, creases, and a calibrated warm/cool view light.
- **Integration bugs found only during final audit:** ordinary footsteps were
  clearing persistent graveyard attack claims; post-clear Standing Kind still
  used the arena orbit instead of their watched/unwatched law; and the cave
  visibility culler could re-hide the finale figure one frame after the real
  hatch. All three lifecycle seams now have real-path regressions.
- **Optional rope pockets could be reached on foot:** reproduced with ordinary
  movement at both forest secrets. Each pocket now remains behind a visible
  deadfall and the narrow base corridor until its own outbound knot is latched;
  held traversal, return, walk-out, and repeat throws remain possible.
- **Cave systems leaked into every act:** all nine Underfalls lights and its
  machine animation now sleep outside the cave, then restore on re-entry. The
  focused test checks both light visibility and unchanged hidden transforms.

## What was added

- **Skull presentation without changing the feel law.** Variant E's continuous
  anatomical shell is now the default; `?skull=v0` retains the old courier for
  comparison. Sockets stay physically dark, growth tissue is smoother, fetched
  objects remain visible in the jaw, the last hand-span of every normal return
  visibly settles into the cradle, and a thin depth-tested filament makes the
  press/hold/release tether relationship physical. `FEEL_PROFILE`, return
  acceleration, and input grammar are unchanged. Ordinary catches never pause
  simulation.
- **More house.** A two-window relay makes one ordinary throw travel outside
  the house, then lets a held skull drag a weathered trolley along the exterior
  rail before release rings the study bell and physically removes the existing
  blocker. A pooled 1.05-second lag mirror shows a delayed, human-but-wrong
  inhabitant on the reflection layer only.
- **More basement.** The crawl-room counterweight secret remains. Beyond it is
  a flooded pump gallery: hold the skull in a real winch while moving across
  five bridge leaves, release early to rewind/retry, reach the far pawl to latch
  the route, then enter a blind archive of six differently built machines. This
  is an optional 90–180 second district, not another key door.
- **Graveyard combat and environment.** The yard has an opening/closing gate,
  a derelict station wagon, dragged bodies, two mausoleums, open graves that are
  visible but safe, 59 varied stones, three resonance instruments, and three
  authored combat waves. Walkers now use a split human funeral mask, winding
  sheet, asymmetric forearms, and hook hands. One lethal strike can commit at a
  time; later waves retain a second pressure claimant without overlapping
  instant kills. Permanent pop marks use one bounded 48-instance stain ring
  rather than growing the scene forever. Stun/pop, token recovery, miss
  recovery, post-clear watched behavior, death/respawn, and mausoleum egress
  are all covered.
- **Forest composition and verb reuse.** The safe spline is enclosed by dense
  side belts and a perforated layered canopy rather than open void. Five
  landmark chapters and two optional repeatable held-throw rope pockets add
  navigation and traversal. A visible deadfall prevents simply walking into a
  pocket before its matching outbound latch, while a returning skull can no
  longer accidentally relatch a spent knot.
- **Waterfall and Underfalls.** The visible plunge and mathematical basin agree.
  Multiple rock-framed curtains, foam, spray, mist, and side cataracts replace
  the exposed rectangular fall. Behind it is a 125.158m, 13-node skull-less
  district: stone veil, drowned pump chapel, multi-height sluice, overflow,
  optional 54.303m bell-cistern route, spray interactions, and hatch cistern.
- **The Drowned Choir.** A new audio-first cave predator follows the player's
  last audible position rather than reading coordinates. Its attack commits to
  a fixed point, so movement is the counterplay; sprint speed remains faster.
  The first catch is nonfatal. Authored spray reveals, repels, and resets it.
  Visually it is one legless soaked corpse-mass beneath a torn pall, with three
  recessed drowned faces, broken jaws, and a single asymmetric rib cage. Every
  warning and lifecycle event is finite-position HRTF audio.
- **Finale contact instead of a fade.** Props are consumed by the closing room;
  frames squeeze, empty hands press and squeak against glass, and deterministic
  fractures accumulate while movement/look remain live. At contact the exact
  reflected skull opens, an impossible recall moan accelerates from 78m away,
  the last playable image is contained between the real walls, and only then
  does a 0.045-second cut reach hard black. Black holds for 0.72 seconds before
  the catch/title, followed by a localized human gasp; the mirror renderer is
  retired behind black instead of running forever under the end screen.

## Release verification

The frozen source has passed `autotest` 24/24, `regressions` 50/50, and per-act
`smoke` with zero browser errors. Two consecutive fresh full runs then passed
all 31 real-input beats from bedroom to ending; the graveyard and forest fights
used different timings in each run. Focused suites additionally cover the house
relay/mirror/pump route, the worst attainable mid-cross pump release and retry
(9/9 twice), basement foundations, six seeded grave fights plus forced
death/respawn, bounded stain recycling, post-clear watched/unwatched Standing
Kind, forest edge/respawn soaks, both physically gated rope pockets, backup-call
rope release, the complete 13-node Underfalls route/hatch and act-local lights,
Drowned Choir walk/run/lifecycle with production HRTF nodes, and finale
visibility, containment, input, shutdown, and audio order. The smoke gate now
renders and budgets all eight acts individually instead of accidentally checking
only the final mirror frame; the current worst sampled act is the graveyard at
515 draw calls / 1,055 geometries, below the 700 / 1,500 budgets. Basement is
395 calls after the below-floor cull and the expanded cave is 124.

The standalone artifact is `release/fetch-netlify.zip`: 24 root-relative
shipping entries, 441,901 bytes, SHA-256
`d4725965b2c2a2a6b529baba43d9edaed2f31ba4fc76c8665a8db5251f73cd45`.
Two independent packer runs produced the same bytes. The malformed-archive
suite is 5/5 (body CRC, truncated EOCD, broken central directory, declared-size
inflation, and case-aliased output); a unique clean extraction then booted in
system Chrome / D3D11 with Variant E, 474 bedroom draw calls, and zero browser
errors.

This remains a deliberately stylized, procedural browser horror game—not a
claim of photoreal AAA production. The important release claim is narrower and
testable: every authored route is finishable, the reported blockers are covered
by reproductions, input is never intentionally stolen, and the new content is
inside the shipped runtime rather than only in screenshots or scratch files.

---

# HANDOFF — 2026-08-09, expansion foundations (Codex)

Read `AGENTS.md`, then this section, then the older diary below. Alex asked for
creative expansion across the whole game and explicitly wants his other games
treated as a feature-and-feel library. The canonical checkout is
`C:\Users\Alex\Projects\fetch-claude`; `C:\Users\Alex\Desktop\Fetch` is only a
timestamped handoff snapshot. Current work is on
`codex/fetch-expansion-foundations`, based on `1834c32`.

## What this tranche actually changed

- **Basement route and optional secret.** The false solid stair wedge is now a
  real open-under L stair: hanging flight, side landing, westbound return, thin
  tread collision, honest headroom, and open rails. The empty crawl wing is a
  non-key skull counterweight puzzle. Hold the skull in a barred cradle to lift
  and latch a shutter; release early and it resets. Behind it: a pale dog
  skeleton curled around the ball it never fetched. State hooks are
  `crawlCounterweightCradle`, `game.crawlSecret`, and `crawlSecretSolved`.
- **Graveyard rebuilt as combat ground.** The duplicated slab field is gone.
  The yard now has a closed/opening iron gate, two mausoleums, safe but visibly
  open graves, three resonant grave crowd-control instruments, a recognizable
  derelict station wagon, and four articulated bodies crawling away from the
  forest. The arena runs three waves (4/5/6 risen bodies plus the initial one).
- **Combat cadence is real now.** Grave attackers own persistent tokens: one in
  the early waves, two later. A token survives approach and the new 0.48-second
  visible/spatial strike commitment. Stun, pop, or a missed strike releases it
  and creates a short group recovery before reassignment. The Standing Kind
  orbit as pressure landmarks but never steal a wave token. Stalled outdoor
  bodies use in-yard avoidance rather than routing through house doors.
- **Forest safety.** The lateral clamp no longer gives up after a large escape;
  the clearing mouth releases only through its narrow forward opening; forest
  post-clamp owns only the forest act; and the failed ravine latch stays
  retryable until the player lands across it. The spent rope and exact far-side
  checkpoint survive death.
- **Waterfall integrity.** Rendered water, spray, rocks, and the mathematical
  plunge basin share `CLEARING_BASIN`; the visible water now covers the old
  invisible pit before the falls. The layered curtain itself remains the strong
  visual anchor, but the clearing sides and deep post-waterfall route still need
  a larger authored expansion.
- **Finale replaced, not faded.** The walls consume and squeeze the room's props;
  glass pressure raises empty hands; each pane owns localized grinding, flare,
  and deterministic fractures. At contact, the exact reflected skull clone
  opens its jaw while an impossible moan accelerates from 78m behind the viewed
  pane. Controls stay live through contact. Then: 0.06s hard black, catch at the
  hands, and a wordless HRTF human gasp just behind one ear. Freeze begins only
  after black. A forest ownership bug that teleported the mirror camera back to
  the outdoor spline is fixed.
- **Feel-core repairs.** Bounce audio uses a monotonic SFX clock; graveyard fear
  no longer shortens throw range; launch/catch/final sounds now originate from
  their physical positions. LMB hold/release grammar and `FEEL_PROFILE` values
  were not changed.

## Verification on the final source

- `node tests/autotest.mjs` — **24/24**, zero browser errors.
- `node tests/smoke.mjs` — all eight acts, zero errors, 74 draw calls / 1010
  geometries in the smoke sample, under budget.
- `node tests/playthrough.mjs` — **30/30 real-input beats**, bedroom through end.
- `node tests/regressions.mjs` — **41/41**, including persistent attack-token,
  rope retry/checkpoint, forest/mirror ownership, waterfall permanence, and
  finale contact/audio order.
- `node tests/basement-foundations.mjs` — **8/8**.
- Five consecutive randomized focused graveyard clears; focused finale contact
  reaches hard black with controls live and zero page errors.

## Do next — no bullshit completion claim

1. **Waterfall undercroft.** Build an explorable side-cataract ring and a larger
   skull-less under-falls district: drowned pump chapel, vertical sluice route,
   echo-based locket puzzle, and a wet enemy whose position is first legible as
   displaced spray. DUSKFALL's shared cave SDF is the structural donor.
2. **Forest authored chase chain.** Safety is fixed; composition is not done.
   Add EATEN PATH-style landmark pockets, hard silhouette closure behind dense
   vegetation, and two more held-skull traversal anchors used during pursuit.
3. **House puzzle density.** Preserve the already-polished house, then add the
   window-aim and lag-mirror beats from the playtest queue plus at least one
   non-key vertical route. Do not turn every locked beat into another fetch key.
4. **Basement second district.** The crawl secret is one strong room, not the
   promised dramatic expansion. Next: flooded storage where movement makes a
   wake, a blind archive that punishes loud pops, and a boiler/winch route using
   hold-to-anchor rather than key collection.
5. **Models.** The default courier skull is still deliberately not auto-replaced;
   Alex must crown a realistic variant in-game. Enemy silhouette and material
   work also remain a full pass, despite the improved arena behavior.

---

# HANDOFF — 2026-08-08, Fable 5 → Opus 5 (same thread)

Read AGENTS.md first (playbook + the laws + the four gates). This file is
what the previous session knows that the docs don't. Alex's standing brief:
Codex is off the project, you are the sole builder, budget is funded, he
wants creative ambition — "surprise the hell out of me and terrify me."
Deploys to qualiacology.com went out repeatedly tonight with his blessing
while he live-tested; keep that loop (merge fetch PR → sync src/ into
qualiacology repo fetch/ → push main = live in ~1 min; hard-refresh).

## IN FLIGHT RIGHT NOW (finish this first)

A background workflow ("fetch-skull-realism", run wf_10f4235b-cda) has two
sculptor agents + a judge building a REALISTIC skull — Alex rejected the
default and every variant: "looks silly... doesn't even look like a real
skull... ultra fucking realistic and creepy." Its completion notification
will land in this thread. Deliverables (may already exist):
- scratch-sculpts/real-field.js + out-real-field/*.png (+ report.json)
- scratch-sculpts/real-bones.js + out-real-bones/*.png
- scratch-sculpts/real-pro.js (GPT-Pro's courier drop, already rendered to
  out-real-pro/ — contract-clean, 8402 tris, but its mandible reads as a
  door-knocker ring like variant b; judge it, don't auto-crown it)

INTEGRATION (the winner becomes the DEFAULT — Alex's message IS the
judgment on the old one):
1. Look at every render yourself; trust the judge's verdict only if the
   anatomy holds (zygomatic arches standing off the skull, deep angular
   orbits, pear nasal aperture, U dental arch, real mandible + rami,
   sutures/stains/asymmetry — and it must read in the dark shots).
2. Copy winner → src/skull-default.js; in src/skull.js `_buildMesh`, make
   the no-variant path call it (keep the old inline sculpt reachable as
   variant 'v0' for comparison). Keep the VARIANTS map (a/b/c/d/a2).
3. tests/regressions.mjs check "default query ships the courier sculpt"
   asserts `skull.root.name === 'skull'` — name the new root 'skull' or
   update the check to the new identity.
4. house.js voidDoorAct ember-socket code and the locket jaw-dangle parent
   to skull.sockets / skull.jaw — the winner honors the same contract, so
   both should just work; verify with node tools/shot-held.mjs default.
5. tools/render-sculpt.mjs + tools/shot-held.mjs for renders; all four
   gates; ship + deploy; show Alex renders in chat.
6. After Alex approves in-game: delete losing variants + the ?skull=
   switch per the comment in skull.js (his call, ask first).

## THE QUEUE (Alex-ordered, tonight's live playtest)

1. FOREST VISUAL PORT — Alex twice pointed at his own THE EATEN PATH
   (C:/Users/Alex/Projects/eaten-path): "learn from that shit... i almost
   wish i could just attach one of the games onto the forest part."
   docs/analysis/eaten-path.json has the full extraction: per-portable
   donor file:line refs + how-to-port (tree-wall falloff w/ lean, overhead
   canopy closure, shrub walls, two-ribbon ground, fog==background,
   camera-borne light, landmark biomes, seal audio grammar). Seal
   MECHANICS already ported (fractional projection + witnessing) — this
   lane is the LOOK + wandering-path feel (turns, strange objects at the
   sides making sounds — his words).
2. GRAVEYARD CAR — "not even half passing lol." Real derelict sedan from
   the primitive kit (greenhouse, wheel arches + flat tires, door seams,
   sprung hood, rust). It's Codex's prop in src/outside.js graveyard.
3. CRAWL ROOM — designed proposal in docs/PLAYTEST-3.md (throw-your-light
   beat; something that stalks the light's shadow; non-key reward). Alex
   asked for the room to be used; pitch him the design before/while building.
4. COMBAT FEEL VERDICT — the whole impact language shipped tonight
   (carom, stagger, hit-stop tiers, chokes, corpse launch, stains); ask
   Alex if it still feels "plunk" and tune from his answer.
5. PARKED FOR ALEX: window puzzle + foyer lag-mirror proposals
   (PLAYTEST-3.md), nursery mobile telegraphing, leading pass.
6. docs/analysis/donor-inventory.json = the stealable-systems map of ALL
   his games (he keeps saying "familiarize yourself with what you have
   access to" — use it every time an area needs assets).

## ENGINE LAWS LEARNED THE HARD WAY (not in AGENTS.md yet)

- HELD throws chase a guide ~7m BEYOND the aim ray: steering sweeps
  DIRECTION, never range. Mid-range point-snatches are impossible; shape
  puzzles as fly-through or sweep-at-range (locket redesign happened
  because of this).
- Ramps are ground EVERYWHERE inside their x/z rect — the corridor under
  the cellar flight is real walkway and the basement spawn is in it.
  Never wall/fill under ramps (a "fix" tonight bricked the spawn; the
  playthrough gate caught it).
- world.box = merged VISUAL only; world.addCollider is separate; colliders
  also bounce the skull. registerInteract on a Group bakes a STATIC
  world-space hitbox at registration — position objects BEFORE registering.
- Viewmodel lighting is split: skullLight.layers = world only; holdLight
  (camera child, LAYER_HELD) lights hands+skull. Never let a strong light
  sit on the viewmodel layer — everything clips to white.
- world.candles entries are live-mutable ({x,y,z,intensity,r}) — animate
  intensity for fire/glow (incinerator does this).
- Alex plays LIVE and reports in chat with screenshots; small fix →
  gates → deploy loop, fast. He forgives rough, not broken.
- house.js imports from util.js are explicit — add TAU etc. when used
  (a missing import cost a boot timeout tonight).

## SHIPPED TONIGHT (PRs 5-8 merged, all live)

Furnishing audit + checker; skull-off c/d/a2 mounts; Codex merge (their
looks/systems, our feel core — fearHome + skull-lantern + default kept);
incinerator refusal beat; chained hatch; void-door flame steal (ember
sockets); forest seal fixed + witnessed + fall rescue; south fences;
foundation skirt; combat impact language; THE LOCKET (canopy chime →
graveyard claim → jaw keepsake → shore return → empty-hands carry →
reflection still wears its own); human-finger hands + viewmodel relight;
strand webs + fleeing spiders; stair skirt; anisotropy; teeth-sized keys.
Four gates: autotest 24 / regressions 23 / smoke / playthrough (29 beats).
