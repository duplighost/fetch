# Round thirteen — the full diagnosis set

Generated from the parallel triage run: 22 agents, 4.55M tokens, 66 minutes, zero failures.

Every plan was challenged by a second agent whose only job was to REFUTE it.
**Read the Challenge section before applying anything** — several plans carry blockers,
and in at least one case the challenger caught the plan walking into the exact trap it
claimed to have designed around.

## Index

- [bell](#bell) — SOUND-WITH-CORRECTIONS — **2 blocker(s)**
- [jailcell](#jailcell) — SOUND-WITH-CORRECTIONS — **3 blocker(s)**
- [ossuary](#ossuary) — SOUND-WITH-CORRECTIONS — **1 blocker(s)**
- [walls](#walls) — SOUND-WITH-CORRECTIONS — **3 blocker(s)**
- [water](#water) — SOUND-WITH-CORRECTIONS — **1 blocker(s)**
- [cone](#cone) — SOUND-WITH-CORRECTIONS — **3 blocker(s)**
- [walkway](#walkway) — SOUND-WITH-CORRECTIONS — **2 blocker(s)**
- [ball](#ball) — SOUND-WITH-CORRECTIONS — **3 blocker(s)**
- [furnace](#furnace) — SOUND-WITH-CORRECTIONS
- [audit](#audit) — SOUND-WITH-CORRECTIONS — **2 blocker(s)**
- [postgame](#postgame) — SOUND-WITH-CORRECTIONS — **3 blocker(s)**


---

<a id="bell"></a>

## bell

**The bell IS the furnace's pilot, but its brass line runs 1.35 m east and dies inside the ground slab — nothing in the world connects it to the furnace 10 m away, so the fix is to lay the feed line along the route the player actually walks (round nine's ossuary-conduit vocabulary, one merged mesh, one draw), land it on matching brass hardware on the furnace crown, and let a travelling sleeve + a knock ladder carry the ignition down it.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **The `change` payloads in steps 1 and 6 are not literal replacements — they contain English prose that would be pasted straight into the file as a syntax error. Step 1's replacement ends with the parenthetical paragraph "(the hanger and the bell mouth move into the merged trim in step 2; the cup stays a mesh of its own — it is the hero object in his screenshot...)". Step 6's replacement ends with "(then: add `feedMinY` and `feedIsInterior: ...` to the object returned at the end of the page.evaluate ... and after the conduitInRouteRoot assertion at line 239 add: ...)". The brief for this plan is that someone applies it without re-deriving the reasoning; applied literally, both produce a parse error.**
  - _fix:_ Strip both parentheticals out of the `change` fields and into the `step` prose, and split step 6's trailing instruction into two additional explicit anchor/change pairs: (6b) anchor `  return { measured, shots, announce, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root };` (tests/legibility-regression.mjs:224) -> `  return { measured, shots, announce, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root, feedMinY, feedIsInterior: g.houseInteriorRoots.includes(pilotFeed) };`; and (6c) anchor `if (!result.conduitInRouteRoot) failures.push('the ossuary conduit is not inside routeRoot (the seal will hide it)');` (line 239), appending the two new failure pushes and the console.log after it.

- **The plan clears the upper-sector culler trap for the feed line and then walks straight into it with the sleeve. `feedSleeve` is constructed with no position, so at build time it sits at world (0,0,0) — which is also inside the ground-floor living room. buildPumpGallery runs AFTER basementAct (house.js:789 vs 788) and does `scene.traverse` with `upperBounds.setFromObject(object, false)`; the sleeve's bounds are min.y -0.075, and -0.075 > B+2.42 (-0.58), so it IS filed into upperSector. Its cellarSightline test also fails (max.x 0.075 < 5.8), so setUpperSectorCulled() will clear its world layer bit whenever the pump-gallery cull engages. This is exactly the trap finding[7] claims to have designed around, missed for the one object that is supposed to move.**
  - _fix:_ In step 3's inserted code, add one line immediately before `scene.add(feedSleeve);`:

  feedSleeve.position.copy(FEED[0]);

That puts its bounds at min.y -0.955, below the -0.58 cut, so the traverse never files it — and it removes a phantom root from the living-room floor. Optionally also seed `game.basementFeedLive = false;` beside it so the property exists before the first ticker runs.


### Execute THIS (the challenged, corrected plan)

The plan's diagnosis is true and verified from source, and all eight of its anchors match the files byte-for-byte, so execute it — with six corrections. Apply steps 1 and 2 as written but strip the English parenthetical out of step 1's replacement and drop its redundant line-number ordering note; the 9-meshes-to-2 merge is sound (Cylinder and Torus are both indexed, Dodecahedron is not) and genuinely frees 7 draws because brass currently carries cup plus five guards and brassEdge carries hanger, mouth, clapper and two rings. Apply step 3's feed line as written, with three edits inside it: rename the merged mesh from `feed` to `feedMesh` so it cannot collide with the `feed` travel-state object declared below it; add `feedSleeve.position.copy(FEED[0]);` immediately before `scene.add(feedSleeve);`, because a sleeve left at world (0,0,0) has bounds min.y -0.075, sits above buildPumpGallery's -0.58 upper-sector cut, fails the cellarSightline window, and gets its world layer zeroed by the very culler the plan claims to have cleared; and build a `FEED_CUM` arc-length table plus a `feedArrival(wp)` helper. Apply step 4 but drive its knock delays from `feedArrival` instead of the hand-typed 0.55/1.05/1.6/2.25/2.9, which currently land the furnace knock 0.44 s ahead of the light on the same wire, and move the closing metalDrop to FEED_TIME + 0.05. Apply step 5 unchanged, and keep `game.basementFeedLive` as a plain property rather than "tidying" it into a flag — house.js:4814 derives the window-scare site from `game.flags.size`, so a new flag would shift an authored rotation. Apply steps 6 and 7, but split step 6's trailing prose into two explicit anchor/change pairs against tests/legibility-regression.mjs:224 and :239, add a third read that measures the pulse itself (from the bell only 4.77 m of the 28 m run is in view, about 0.58 s of sleeve travel — the pulse's legibility is unmeasured and the wire's 1.22x lit-colour lift is below the ossuary conduit's own 1.6x floor, so the sleeve and the knocks must carry law 4), and record that if the four already-pinned floors shift under the new basement visit the fix is to move the block to the end of the evaluate, never to lower the floors. Apply step 8 unchanged. Correct the four clearance numbers in the risk text to 0.455 / 0.285 / 0.045 / 0.68, and ignore the findings' line numbers where they disagree with the anchors — findings 2, 3, 4, 5's world.js sub-cite, 7, 12, 13 and 14 are each off by 1 to 4 lines, while findings 0, 1, 6, 8, 9, 10 and 11 are exact.

### Findings

- **The fixture is at (3.35, -3.0, 5.72) on the corridor's south wall, west of the return-stair foot — exactly his screenshot ('gold bell in a bracket on a stone stairwell wall, gold rod beside it, steps to the left'). Facing the bell you look +z, so left is +x, which is where cellarReturn (x 4..8, z 4..6, y -3.0→-2.0) lands.**
  - `house.js:2780`
  - evidence: pilot.position.set(3.35, B, 5.72);   // preceded by: "Clear floor against the corridor's south wall (interior face z=5.8), just west of the return-stair foot (stair mass begins at x=4)."

- **THE ACTUAL DEFECT. The brass line is only four pieces: riser, elbow, a 1.35 m east header, and a 0.55 m stub that terminates inside the ground slab. World-space it goes (3.77,-2.88,5.80) up to (3.77,-0.88,5.80), east to (5.38,-0.62,5.80), then straight up to (5.38,-0.07,5.80) and stops. Nothing of it points at, reaches, or touches the furnace at (11.2,-3.0,-1.5). The code's own comment claims it 'runs toward the furnace' — it does not; it runs 1.35 m and exits the room upward.**
  - `house.js:2788`
  - evidence: const riser = ... CylinderGeometry(0.045, 0.055, 2.0, 8) ... riser.position.set(0.42, 1.12, 0.08);   const elbow = ... elbow.position.set(0.68, 2.12, 0.08);   const header = ... CylinderGeometry(0.045, 0.045, 1.35, 8) ... header.position.set(1.355, 2.38, 0.08); header.rotation.z = Math.PI / 2;   const headerStub = ... CylinderGeometry(0.045, 0.045, 0.55, 8) ... headerStub.position.set(2.03, 2.655, 0.08);

- **THE PRECEDENT, round nine, commit 424112f 'The weighted basket is what turns the wheel on'. His words there were the same complaint: the mechanism had to point at its effect BEFORE it was used. The answer was a wire laid at build time along the corridor the player walks, in ONE merged BufferGeometry on ONE material — one draw — with cleats for rhythm, its own material so its value is lifted clear of what it lies on, and a section thick enough to survive the mip chain at range. Two cuts of it measured 0.00% of the frame and would have shipped.**
  - `outside.js:2461`
  - evidence: // THE WIRE. His words: "the basket thing that you throw the skull into   // clearly wires back to activate it." Cause has to point at effect BEFORE   // it is ever used, so the conduit is laid at build time and is readable on   // the walk up ... AND IT HAS TO BE SEEN. The first cut used ironMat at 0.055 m and vanished   // into the floor at four metres ... So: its OWN material, value   // lifted well clear of the floor it lies on (one extra batch bucket, one   // draw), and a section thick enough to survive the mip chain at range.   // One merged BufferGeometry, one mesh, one draw, inside the route.

- **The ossuary wire's construction, verbatim — the shape to copy: straight box runs pushed into one array, cleats at a fixed rhythm, mergeGeometries, one mesh, exposed on `game` so a tool can toggle it and measure it.**
  - `outside.js:2515`
  - evidence: for (const cz of [OZ + 14.2, OZ + 16.6, OZ + 19.0, OZ + 21.4, OZ + 23.8]) {       run(WIRE_X, FLOOR + 0.1, cz, 0.26, 0.1, 0.09);     }     const conduit = new THREE.Mesh(mergeGeometries(parts), conduitMat);     conduit.name = 'ossuary kennel conduit';     ... game.ossuaryConduit = conduit;          // tools toggle this to measure it

- **The basement already speaks a 'wired to their effects' dialect: the blind archive's conduit continues east along the ceiling main and drops the shared wall, and the furnace's no-draft refusal fires a knock ladder that WALKS that imaginary ceiling main west at y = B+2.3 through (4.5,·,4.8) → (-4.5,·,5.2) → (-12.5,·,5.5). The corridor's ceiling main is currently an audio fiction with no geometry east of the archive. Extending the pilot line is the missing half of a run the game already sounds.**
  - `house.js:3218`
  - evidence: game.after(0.35, () => game.audio.knock({ pos: new THREE.Vector3(4.5, B + 2.3, 4.8), gain: 0.4, rate: 0.62 }));         game.after(0.7, () => game.audio.knock({ pos: new THREE.Vector3(-4.5, B + 2.3, 5.2), gain: 0.44, rate: 0.56 }));         game.after(1.1, () => game.audio.knock({ pos: new THREE.Vector3(-12.5, B + 2.3, 5.5), gain: 0.48, rate: 0.5 }));

- **GEOMETRY, derived from the tables (origin [-12,-14], CS=2, wx(c)=-12+2c, wz(c)=-14+2c, room x1/z1 are inclusive so world max uses c+1). bcorr = x -4..12, z 2..6. storeroom = x -4..4, z -6..2. boiler = x 4..12, z -6..2. Walls sit centred on the cell edge at WALL_T 0.26. Basement floor -3.0, ceiling -0.55, door heads at floor+DOOR_H = -0.75, door openings 1.3 wide centred on the cell. The corridor→storeroom door is centred at x -1.00 on the z=2 wall; the storeroom→boiler heavy door is centred at z -3.00 on the x=4 wall. That gives a wire route that crosses BOTH doorways dead on their centrelines.**
  - `world.js:38`
  - evidence: const DOOR_W = 1.3, DOOR_H = 2.25;   // and line 36: const WALL_T = 0.26;  line 10: export const CS = 2;  and world.js:438 x0: wx(x0), x1: wx(x1 + 1)

- **CEILING HOLES constrain the route east. The basement has no ceiling at x 8..12, z 2..6 (cellar shaft) or x 4..8, z 4..6 (return-flight headroom). A ceiling run east from the existing header would cross open shaft air for its whole length. West of x=4 the corridor ceiling is intact, which is why the run must turn WEST first and go around through the storeroom — which is also, exactly, the player's walking route to the boiler room.**
  - `house.js:107`
  - evidence: ['basement', 10, 8, 11, 9],  // bcorr east end looks up the cellar shaft     ['basement', 8, 9, 9, 9],    // headroom above the lower return flight

- **THE CULLER TRAP, and the new mesh clears it. buildPumpGallery zeroes the world layer of every scene mesh whose bounds sit entirely above B + 2.42 (= -0.58) while the player is deep in the western works. A run whose lowest point is the furnace-crown union at y -1.34 is never filed into upperSector, so it can never be blanked. This is the basement analogue of the ossuary seal that hid every wire ever laid down there.**
  - `house.js:6651`
  - evidence: upperBounds.setFromObject(object, false);     if (upperBounds.min.y > B + 2.42) {       ... upperSector.push({ object, mask: object.layers.mask, cellarSightline });

- **A scene child added during buildHouse is automatically a house render root AND (max.y < 5.5) a house INTERIOR root, so the graveyard cull retires it for free. No marker or registration is needed.**
  - `main.js:181`
  - evidence: const houseRenderStart = this.scene.children.length;     buildHouse(this);     this.houseRenderRoots = this.scene.children.slice(houseRenderStart);     this.houseInteriorRoots = this._findHouseInteriorRoots();

- **WHERE THE DRAW CALLS COME FROM. The pilot fixture is 20 separate meshes, of which 9 are rigid, never-animated brass that shares two materials: 5 guard bars (brass) and bellHanger + bellMouth + 2 cage rings (brassEdge). This is the identical waste the round-12 web commit just paid off on the spiders ('a spider was EIGHTEEN DRAW CALLS ... the pose is rigid: composed by hand and merged, a spider is one draw'). Merging them 9→2 frees 7 draws in the tightest district in the game, which is what buys the feed line.**
  - `house.js:2838`
  - evidence: for (let i = -2; i <= 2; i++) {     const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.66, 6), brass);     guard.position.set(i * 0.095, 1.0, -0.24);     pilot.add(guard);   }   for (const y of [0.67, 1.33]) {     const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 6, 18), brassEdge);

- **The ignition already has a per-segment travel idiom to extend, and its own restore hole: `travel` is a local starting at -1 and the ticker early-outs on it, so nothing seats the line's lit look from the flag. In-session respawn preserves both flags and materials so it is currently harmless, but any new state must be seatable in one assignment or the wire will read dead over a burning pilot — the same discipline as the ossuary's restoreArm().**
  - `house.js:2872`
  - evidence: const travel = { t: -1 };   game.tickers.push((dt) => {     if (travel.t < 0) return;     travel.t = Math.min(1, travel.t + dt / 2.2);     const seg = (mat, a, b) => { ... };     seg(riserFire, 0.0, 0.5);     seg(elbowFire, 0.5, 0.72);     seg(headerFire, 0.72, 1.0);   });

- **The furnace already answers pilotLit with a slit breath — motion + brightness, correct by law 4 — but it fires the instant the flag flips, two rooms away, with nothing between the two events. Delaying it to the arrival of the feed pulse completes the causal sentence, and it is cosmetic only: hasDraft/incineratorAwake/the whole flag chain key on pilotLit and are untouched.**
  - `house.js:3291`
  - evidence: const breath = game.flags.has('pilotLit') ? 0.5 + 0.5 * Math.sin(t * 1.6) : 0;     for (const slit of slits) slit.scale.y = 1 + breath * 0.9;

- **The route is clear of every prop and web. Corridor curtain webs sit at z 3.05/3.55 and y -1.8; basement corner webs at y -1.30 in room corners (boiler's is at 10.65,-1.30,-4.65); storeroom props (shelf top -1.28, crates, barrels) are all below -1.28; the boiler-room kit pieces sit at z -3.4 and z -5.0. A run at y -0.88/-0.66 along z 5.80 / x -1.00 / z -3.00 / z -1.90 touches none of them.**
  - `house.js:1653`
  - evidence: { at: [10.65, -1.30, -4.65], rotY: -Math.PI / 4, s: 0.5, seed: 0x2a55 },                 // boiler room  ... and house.js:1402 K.shelf(-2.55, B, -4.65, 0, 2.45, 1.72); K.crate(2.15, B, -2.05, 0.3, 0.82);

- **The furnace crown is the right landing pad. inc sits at (11.2,-3.0,-1.5) with rotation.y = -PI/2, so its local +z maps to world +x negated: the crown (BoxGeometry 1.23 x 0.1 x 1.03 at local y 1.6) occupies world x 10.685..11.715, z -2.115..-0.885, top face y -1.35. A drop at (11.05, ·, -1.90) lands inside that footprint, 0.62 m clear of the flue at (11.32, ·, -1.28).**
  - `house.js:2994`
  - evidence: inc.position.set(11.2, B, -1.5);   inc.rotation.y = -Math.PI / 2;             // mouth faces -x, into the room   ...   const crown = new THREE.Mesh(new THREE.BoxGeometry(1.23, 0.1, 1.03), sootDark);   crown.position.y = 1.6;

- **The measurement instrument for this already exists and names the ossuary conduit as its reason for existing. Any new wire gets a floor in the same file, measured then floored with room to move, plus a structural assertion (the ossuary's is 'lives inside routeRoot'; the basement's equivalent is 'sits below the upper-sector cut').**
  - `legibility-regression.mjs:45`
  - evidence: const FLOORS = {   'the ossuary conduit, from the walk-up': [0.35, 1.6],   ... };   // and line 239: if (!result.conduitInRouteRoot) failures.push('the ossuary conduit is not inside routeRoot (the seal will hide it)');


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. PAY FOR IT FIRST — merge the bell's rigid brass trim, 4 meshes to 1. Delete the standalone bellHanger and bellMouth; they are re-emitted inside the merged trim in step 2. (Do this edit before step 2 so the line numbers below stay valid: delete 2813-2816 first, then 2806-2808.) Nothing outside this function references either name — grep confirms the only other `bellMouth` in the file is the study window receiver at line 3926.** — `house.js`

_anchor:_
```js
  const bellHanger = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.023, 0.25, 6), brassEdge);
  bellHanger.position.set(0, 2.04, -0.11);
  pilot.add(bellHanger);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.205, 0.28, 14), brass);
  cup.name = 'basement-pilot-servant-bell';
  cup.position.set(0, 1.82, -0.11);
  pilot.add(cup);
  const bellMouth = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 6, 20), brassEdge);
  bellMouth.position.set(0, 1.675, -0.11);
  bellMouth.rotation.x = Math.PI / 2;
  pilot.add(bellMouth);
```

_change:_
```js
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.205, 0.28, 14), brass);
  cup.name = 'basement-pilot-servant-bell';
  cup.position.set(0, 1.82, -0.11);
  pilot.add(cup);

(the hanger and the bell mouth move into the merged trim in step 2; the cup stays
a mesh of its own — it is the hero object in his screenshot and the one piece of
this fixture a later round is likely to want to swing.)
```

**2. 2. Merge the guard cage and the brass trim: 9 meshes become 2. This is the spider fix from commit 4ed6bc4 applied to the fixture beside it, and it frees the 7 draw calls the feed line is charged against. Both merges are all-indexed (Cylinder + Torus), so mergeGeometries is safe; do NOT fold the clapper in — DodecahedronGeometry is non-indexed and would make mergeGeometries return null.** — `house.js`

_anchor:_
```js
  for (let i = -2; i <= 2; i++) {
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.66, 6), brass);
    guard.position.set(i * 0.095, 1.0, -0.24);
    pilot.add(guard);
  }
  for (const y of [0.67, 1.33]) {
    const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.018, 6, 18), brassEdge);
    cageRing.position.set(0, y, -0.2);
    cageRing.rotation.x = Math.PI / 2;
    pilot.add(cageRing);
  }
```

_change:_
```js
  // THE CAGE IS ONE OBJECT, AND SO IS THE TRIM. Five guard bars, two cage
  // rings, a hanger and a bell mouth were NINE draw calls for a rigid basket
  // that has never been animated by anything — the same eighteen-draw spider
  // the web pass just paid off. Composed by hand and merged: two draws, the
  // same silhouette to the pixel, and it is what buys the feed line below.
  {
    const bars = [];
    for (let i = -2; i <= 2; i++) {
      const g2 = new THREE.CylinderGeometry(0.012, 0.015, 0.66, 6);
      g2.translate(i * 0.095, 1.0, -0.24);
      bars.push(g2);
    }
    const cage = new THREE.Mesh(mergeGeometries(bars), brass);
    cage.name = 'basement-pilot-cage-bars';
    pilot.add(cage);
  }
  {
    // all indexed (Cylinder + Torus). The clapper stays its own mesh: a
    // DodecahedronGeometry is NON-indexed and mergeGeometries returns null on
    // a mixed list.
    const trimParts = [];
    for (const y of [0.67, 1.33]) {
      const g2 = new THREE.TorusGeometry(0.235, 0.018, 6, 18);
      g2.rotateX(Math.PI / 2);
      g2.translate(0, y, -0.2);
      trimParts.push(g2);
    }
    const hanger = new THREE.CylinderGeometry(0.018, 0.023, 0.25, 6);
    hanger.translate(0, 2.04, -0.11);
    trimParts.push(hanger);
    const mouth = new THREE.TorusGeometry(0.205, 0.025, 6, 20);
    mouth.rotateX(Math.PI / 2);
    mouth.translate(0, 1.675, -0.11);
    trimParts.push(mouth);
    const trim = new THREE.Mesh(mergeGeometries(trimParts), brassEdge);
    trim.name = 'basement-pilot-brass-trim';
    pilot.add(trim);
  }
```

**3. 3. THE FEED LINE ITSELF. Insert between the end of the existing ignition-travel ticker and the `riserTop` declaration, so BRASS_BASE/BRASS_WARM are already in scope and `feed` is in scope for the fetch target's onHit below. One merged BufferGeometry, one material, one mesh, one draw — the ossuary vocabulary — plus one sleeve that is only drawn while it is walking. Route table (world, B = -3.0): the run height is B+2.12 = -0.88 (the riser top, so the tee is a true right angle and the pipe hangs a hand's breadth above head height where a real one lives) and it steps up to B+2.34 = -0.66 to cross each doorway INSIDE its lintel, because basement door heads are at B+2.25 = -0.75. Both crossings land on the doorway centreline: the corridor→storeroom door is centred at x -1.00 on the z=2 wall, the storeroom→boiler heavy door at z -3.00 on the x=4 wall. So the wire goes over both doors you walk through.** — `house.js`

_anchor:_
```js
    seg(riserFire, 0.0, 0.5);
    seg(elbowFire, 0.5, 0.72);
    seg(headerFire, 0.72, 1.0);
  });

  const riserTop = new THREE.Vector3(3.77, B + 2.12, 5.8);
```

_change:_
```js
    seg(riserFire, 0.0, 0.5);
    seg(elbowFire, 0.5, 0.72);
    seg(headerFire, 0.72, 1.0);
  });

  // ------------------------------------------------------- THE FEED LINE
  // HIS NOTE, 2026-08-19: "can we make this bell at the bottom of the stairs at
  // the first basement look like its wired to the rest of the puzzle."
  //
  // It already IS the puzzle — this pilot is the flame the furnace refuses to
  // wake without. What was missing was the sentence. The brass line climbed the
  // wall, ran 1.35 m east and vanished into the ground slab, so a fixture that
  // gates the whole basement pointed at nothing a player can walk to.
  //
  // Round nine answered exactly this complaint in the ossuary ("the basket
  // thing that you throw the skull into clearly wires back to activate it"):
  // lay the wire at BUILD time, along the route the player actually walks, in
  // ONE merged geometry on ONE material — one draw — so the causality is
  // readable before it is ever used. Same vocabulary here, and its two traps:
  //   * NOT world.box. A merged shell strip has no runtime handle and can never
  //     change state, and the ossuary proved a wire nobody can read is not a
  //     wire. Its own mesh, its own material, one draw.
  //   * the run's lowest point (the union on the furnace crown, y -1.34) sits
  //     BELOW B + 2.42, so buildPumpGallery's upper-sector culler — which zeroes
  //     the world layer of everything whose bounds are entirely above the
  //     basement ceiling — never files it and can never blank it.
  //
  // It follows the walk, not the crow: west along the wall the bell hangs on,
  // over the storeroom door, across the storeroom, over the heavy boiler door,
  // and east to a union on the furnace crown. It cannot run east from the
  // header — the basement has no ceiling at x 8..12, z 2..6 or x 4..8, z 4..6
  // (the stair shaft), so an east run would float through open air the whole
  // way. Every doorway is crossed inside its lintel: door heads are B + 2.25.
  const FEED = [
    new THREE.Vector3(3.77, B + 2.12, 5.80),    // tee at the riser top
    new THREE.Vector3(-1.00, B + 2.12, 5.80),   // west along the bell's own wall
    new THREE.Vector3(-1.00, B + 2.34, 5.80),   // up to lintel height
    new THREE.Vector3(-1.00, B + 2.34, 1.80),   // over the storeroom door, through the wall
    new THREE.Vector3(-1.00, B + 2.12, 1.80),
    new THREE.Vector3(-1.00, B + 2.12, -3.00),  // south across the storeroom
    new THREE.Vector3(3.30, B + 2.12, -3.00),   // east to the heavy door
    new THREE.Vector3(3.30, B + 2.34, 
```

**4. 4. START THE PULSE ON IGNITION, AND LET IT ANNOUNCE ITSELF. Two walls hide most of the run from where the player is standing, so the travel has to be audible as well as visible: knocks walk the waypoints away from him and land at the furnace. This is the same ladder shape as answerCold above and the archive pointer in basementAct, `{ global: true }` so a scope change cannot swallow the tail. Leave answerCold ALONE — the cold refusal means 'you have no fire' and pointing it at the furnace would misdirect.** — `house.js`

_anchor:_
```js
      flame.visible = true;
      travel.t = 0;
      game.impact('break', at || pos);
      game.audio.fireRoar({ pos, gain: 0.34, rate: 1.2 });
      game.after(0.5, () => game.audio.metalDrop({ pos: riserTop, gain: 0.42, rate: 1.1 }), { global: true });
```

_change:_
```js
      flame.visible = true;
      travel.t = 0;
      feed.t = 0;
      game.impact('break', at || pos);
      game.audio.fireRoar({ pos, gain: 0.34, rate: 1.2 });
      game.after(0.5, () => game.audio.metalDrop({ pos: riserTop, gain: 0.42, rate: 1.1 }), { global: true });
      // THE LINE ANNOUNCES WHERE IT GOES. Knocks walk the run away from him —
      // over the storeroom door, across the storeroom, through the boiler door
      // — and the last one lands on the furnace. Two walls hide the pipe from
      // where he is standing; nothing hides the sound.
      [[1, 0.55], [3, 1.05], [5, 1.6], [8, 2.25], [11, 2.9]].forEach(([wp, delay], i) => {
        game.after(delay, () => game.audio.knock({
          pos: FEED[wp], gain: 0.5 - i * 0.03, rate: 0.9 - i * 0.06,
        }), { global: true });
      });
      game.after(3.45, () => game.audio.metalDrop({
        pos: FEED[FEED.length - 1], gain: 0.5, rate: 0.85,
      }), { global: true });
```

**5. 5. THE FURNACE ANSWERS THE BELL INSTEAD OF MERELY AGREEING WITH IT. The slits currently start breathing the instant the flag flips, two rooms away, with nothing between the two events. Gate them on the pulse's arrival. COSMETIC ONLY, and say so in the commit: hasDraft, incineratorAwake, the ready-glow and the whole flag chain still key on pilotLit and are not touched. The pilot's feed ticker is pushed inside buildBasementPilot, which basementAct calls before it builds the furnace, so within one frame the flag is set before this line reads it — zero-frame lag, and a restore seats it in the same assignment.** — `house.js`

_anchor:_
```js
    // furnace scoreboard, state 1: a lit pilot breathes in the door slits —
    // slow slit swell + ember brightness amplitude, readable before any
    // draft exists (motion + brightness, never hue alone)
    const breath = game.flags.has('pilotLit') ? 0.5 + 0.5 * Math.sin(t * 1.6) : 0;
```

_change:_
```js
    // furnace scoreboard, state 1: a lit pilot breathes in the door slits —
    // slow slit swell + ember brightness amplitude, readable before any
    // draft exists (motion + brightness, never hue alone)
    //
    // THE FAR END OF THE WIRE. This used to fire the instant pilotLit flipped,
    // two rooms away, with nothing connecting the two events — which is exactly
    // why he could not tell the bell was wired to anything. It waits for the
    // feed line's pulse to arrive now. Cosmetic only: hasDraft, the wake and
    // the ready-glow all still key on pilotLit and are untouched, and
    // basementFeedLive is seated by the pilot's own ticker on a restore.
    const breath = game.basementFeedLive ? 0.5 + 0.5 * Math.sin(t * 1.6) : 0;
```

**6. 6. PIN THE READING, not the function. Add two reads to the legibility gate — the corridor leg from his own screenshot's standing spot, and the furnace end from just inside the boiler door — plus the structural assertion that is the basement's equivalent of 'lives inside routeRoot': the mesh's lowest point must sit below the upper-sector cut at B + 2.42, or buildPumpGallery's culler will one day blank it. Insert the block immediately after F.start() and BEFORE the graveyard teleport. Clear the enemies after the teleport, the way district-culling's settle() does, so a wandering dropcloth walker cannot pollute the pixel diff.** — `legibility-regression.mjs`

_anchor:_
```js
  F.start();
  F.teleport('graveyard');
  F.stepWith(0.3, {}, false);
  g.skull.holdNow();
```

_change:_
```js
  F.start();

  // ---- 0. the basement pilot's feed line ---------------------------------
  // Screenshot 3: "can we make this bell at the bottom of the stairs at the
  // first basement look like its wired to the rest of the puzzle." The wire is
  // laid at build time and has to be readable BEFORE it is ever used, so both
  // poses below are cold-pilot poses: the walk-up in the corridor, and the far
  // end arriving on the furnace crown seen from inside the boiler door.
  F.teleport('basement');
  g.enemies.clear();
  F.stepWith(0.25, {}, false);
  g.skull.holdNow();
  const pilotFeed = g.basementPilotFeed;
  read('the pilot feed line, from the foot of the return flight', pilotFeed, () => {
    seat(4.30, 4.95, -3.0);
    lookAt(0.5, -0.86, 5.80);
    F.stepWith(0.05, {}, false);
  });
  snap('basement-feed-corridor');
  read('the pilot feed at the furnace, from the boiler door', pilotFeed, () => {
    seat(5.20, -3.00, -3.0);
    lookAt(11.05, -1.30, -1.90);
    F.stepWith(0.05, {}, false);
  });
  snap('basement-feed-furnace');
  pilotFeed.geometry.computeBoundingBox();
  const feedMinY = pilotFeed.geometry.boundingBox.min.y;

  F.teleport('graveyard');
  F.stepWith(0.3, {}, false);
  g.skull.holdNow();

(then: add `feedMinY` and `feedIsInterior: g.houseInteriorRoots.includes(pilotFeed)`
to the object returned at the end of the page.evaluate — the line that currently
reads `return { measured, shots, announce, conduitInRouteRoot: ... };` — and after
the conduitInRouteRoot assertion at line 239 add:

  if (!(result.feedMinY <= -0.58)) failures.push(`the basement feed line's lowest point is ${result.feedMinY} — above the upper-sector cut at -0.58, so buildPumpGallery's culler will blank it`);
  console.log(`\n  ${result.feedMinY <= -0.58 ? 'PASS' : 'FAIL'}  the basement feed line reaches below the upper-sector cut, where the culler cannot file it`);
  if (!result.feedIsInterior) failures.push('the basement feed line is not a house interior root (it will be drawn from the graveyard)');
)
```

**7. 7. FLOOR THE TWO NEW READS. Run the gate once, read the measured values off the console, and write them into FLOORS with room to move — the file's own convention, and the reason it is a regression gate and not a target. Do NOT invent these numbers; the ossuary wire is the cautionary tale (two cuts measured 0.00% and would have shipped). If the corridor read comes in under about 0.35% / 1.6x — the floor the ossuary conduit holds — lift the section from 0.09 to 0.12 and/or lift feedMat's colour from 0x8c6d31 toward 0xa9853d and re-measure, in that order; do not add a light.** — `legibility-regression.mjs`

_anchor:_
```js
const FLOORS = {
  'the ossuary conduit, from the walk-up': [0.35, 1.6],
  'the key-tree limb, from the top of the lane': [0.12, 1.8],
  'the key-tree limb, at throwing distance': [0.18, 1.15],
  'the key in the grass, from four metres': [0.01, 4.0],
};
```

_change:_
```js
const FLOORS = {
  'the pilot feed line, from the foot of the return flight': [<MEASURED>, <MEASURED>],
  'the pilot feed at the furnace, from the boiler door': [<MEASURED>, <MEASURED>],
  'the ossuary conduit, from the walk-up': [0.35, 1.6],
  'the key-tree limb, from the top of the lane': [0.12, 1.8],
  'the key-tree limb, at throwing distance': [0.18, 1.15],
  'the key in the grass, from four metres': [0.01, 4.0],
};
```

**8. 8. Update the fixture's own lying comment, so the next reader is not told the header runs to the furnace when it runs 1.35 m and stops.** — `house.js`

_anchor:_
```js
  // A waist-to-ceiling brass line visibly belongs to the house-wide bell and
  // furnace circuit rather than reading as one more anonymous basement prop.
  // It climbs the wall, turns EAST under the ceiling and runs toward the
  // furnace, ending in a stub that enters the ground slab (-0.22..0 world)
  // through the return-flight headroom gap — no more mid-air pipe ends.
```

_change:_
```js
  // A waist-to-ceiling brass line visibly belongs to the house-wide bell and
  // furnace circuit rather than reading as one more anonymous basement prop.
  // It climbs the wall and TEES: east and up into the ground slab (-0.22..0
  // world) through the return-flight headroom gap, which is the house's own
  // bell circuit, and west along the feed line below, which is the furnace's.
  // The east stub used to be the whole of it — 1.35 m and gone into the
  // ceiling — which is why he could not tell this fixture was wired to
  // anything (screenshot 3, 2026-08-19).
```


### Cost

DRAW CALLS. Removed: 7 (the pilot fixture goes from 20 meshes to 13 — five guard bars merge to one, and hanger + bell mouth + two cage rings merge to one). Added: 1 always (the merged feed line, one BufferGeometry on one material) plus 1 only while the ignition pulse is walking, ~3.4 s once per run (the sleeve, visible=false at rest). NET -6 at rest, -5 during the pulse, in the district with the least headroom in the game. Expect house 339 → 333 and house-after-cave 365 → 359 at the gate's own poses, against the 450 ceiling; the exact delta depends on whether the pilot fixture is inside the frustum at those poses, so the worst case at any pose is +1 at rest / +2 during the pulse and the best is -7. VERTICES: 39 boxes ≈ 940 vertices, one-time. PER-FRAME CPU: one extra ticker closure that early-outs on a single `feed.t < 0` test at rest; while the pulse walks, one colour lerp and a walk of a 12-segment polyline. No new lights (the pilot's glow is already a world.candles descriptor into the pooled rig, and nothing here adds to the pinned light census). No new colliders, no new materials in the static shell, no shader recompiles. EFFORT: one file for the game change (src/house.js, ~150 lines added / ~15 removed, all inside buildBasementPilot except a one-line change in basementAct's ticker), one file for the gate (tests/legibility-regression.mjs, ~30 lines), then one gate run to read the two floors and write them in.

### Risk

Low, and mostly confined to one function. Four things to watch. (1) mergeGeometries returns null on a mixed indexed/non-indexed list — both merges in steps 1-2 are Cylinder+Torus only, all indexed; if the clapper (DodecahedronGeometry) is ever folded in, the bell disappears silently. (2) The route's clearances are arithmetic from the tables, not rendered: the run at y -0.88 sits 0.37 m above a 1.75 m eye and 0.33 m below the -0.55 ceiling, and the two lintel crossings at -0.66 sit 0.09 m above the door heads at -0.75 — tight enough that a future DOOR_H change would put the wire across an open doorway. Worth a one-line comment at the FEED table saying so. (3) Step 5 delays a cosmetic tell by 3.4 s; if `game.basementFeedLive` is ever read by anything that gates progression it becomes a soft-lock, so it must stay cosmetic — the flag chain (pilotLit → pumpGalleryLatched → archiveDraftOpened → firebox) is deliberately untouched, and tests/failure-state-regression.mjs and tests/house-critical-path-regression.mjs which force-set those flags will still pass because the pilot ticker seats basementFeedLive from pilotLit on the next frame. (4) The feed mesh's bounding box spans roughly 15 x 0.5 x 9 m, so it is effectively never frustum-culled inside the house — that is the honest cost of making it one draw instead of three, and it is why step 1-2's saving has to land first. No collider, no light, no new material in the static shell, no change to the throw grammar, no text, no HUD.

### Open questions

- THE ONE MEASUREMENT THIS PLAN CANNOT MAKE, because I was forbidden to run anything: does the wire actually READ? Unlit brass 0x8c6d31 (MeshBasicMaterial, toneMapped false) against basement stone lit by one carried lamp at 2.1 m should clear the ossuary conduit's floor of 0.35% of frame at 1.6x contrast, but round nine's whole lesson is that this gets assumed and is wrong. Settle it with tests/legibility-regression.mjs at the two poses in step 6 BEFORE writing the floors. If it comes in short, the escalation order is section 0.09 → 0.12, then colour 0x8c6d31 → 0xa9853d, then cleat spacing 2.0 m → 1.4 m. Never a light.
- Does the run at y -0.88 visually intersect anything furnish() places that I checked only by coordinate? I verified the corridor curtain webs (z 3.05/3.55, y -1.8), the seven basement corner webs (y -1.30, all in room corners), the storeroom shelf/crates/barrels (all topping out below -1.28) and the boiler-room kit at z -3.4 and z -5.0. What I could not check is the basement dropcloths and anything furnish() places procedurally. tools/probe-stair-bell.mjs (already in the tree, uncommitted) does exactly this kind of box query — widen its BOX to the three basement rooms and list everything within 0.4 m of the FEED polyline before committing.
- Should the corridor leg run at -0.88 with two lintel jogs, as specified, or flat at -0.66 the whole way? -0.88 puts it at a legible height in the frame and makes the doorway steps a readable pipe-ism; -0.66 is simpler and matches the existing header's -0.62 exactly. This is Alex's eye, not a correctness question, and the two shots from step 6 would let him pick.
- His note also says he was unsure whether the bell mattered at all ("maybe i hit the light bell after the basement stairs and it activated"). This plan makes the bell's OUTPUT legible. It does not touch the cold-refusal read — the pilot struck without fire still answers with a rattle and a knock ladder climbing the riser. Worth asking whether the cold refusal should now also visibly run a DEAD pulse a metre down the new line and stop, which would say 'the wire is here, it has nothing to carry' — one more sleeve pose, no new draw. Deliberately left out of this plan because it changes the cold beat's meaning.
- Is the checkpoint 'reload' in his note an in-session respawn or a page reload? director.respawn() rebuilds nothing and clears no flags, so in-session the wire's warm state survives without the restore seat in step 3 — but the seat is one branch and costs nothing, and the ossuary's restoreArm() exists for exactly this. If FETCH ever persists a save across page loads, the seat becomes load-bearing.


---

<a id="jailcell"></a>

## jailcell

**The free wall is the crawl's −Z wall east of the existing cage (what house.js's own setpiece calls "south"), and I can now prove why a west-wall cell breaks tests/playthrough.mjs: the bot never actually reaches its own waypoint (−12.62, −6.8) — it jams in the pocket between the west wall and the cage's bar-line at (−11.53, −5.84), and the pump beat only passes because the skull's 0.55 m throw offset spawns it *inside* the 0.26 m west wall and the collider ejects it into the pump gallery.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **THE OCCUPANT WILL NOT RENDER — it hits the exact indexed/non-indexed mergeGeometries trap this codebase has already paid for and documented. Step 6 builds `parts` from CylinderGeometry/TorusGeometry/BoxGeometry (all INDEXED) and four IcosahedronGeometry calls (skull, two hands, two hind feet — PolyhedronGeometry is NON-INDEXED). vendor/jsm/utils/BufferGeometryUtils.js:63 reads `if ((geometry.index !== null) !== isIndexed) return null;` — this vendored copy does not even log. parts[0] is a Cylinder so isIndexed=true, the skull returns null, and `new THREE.Mesh(null, mat)` keeps geometry===null (the default parameter only fires on undefined). The renderer dereferences `object.geometry.boundingSphere` during frustum culling and throws — a hard crash on the first render after entering the house, in a stack with none of your code in it. src/outside.js:8170-8173 already carries this exact warning verbatim: "a SPHERE, not an icosahedron: PolyhedronGeometry is non-indexed, and mergeGeometries silently returns null when the list mixes indexed and non-indexed".**
  - _fix:_ Replace all four IcosahedronGeometry calls in step 6 with indexed SphereGeometry. Exactly: `put(new THREE.IcosahedronGeometry(0.20, 1), BONE, 0.05, 1.30, 0.02,` → `put(new THREE.SphereGeometry(0.20, 10, 8), BONE, 0.05, 1.30, 0.02,` ; `put(new THREE.IcosahedronGeometry(0.075, 0), HIDE, -0.18, 1.30, s * 0.34, 0, 0, 0, 0.8, 1.1, 0.8);` → `put(new THREE.SphereGeometry(0.075, 6, 5), HIDE, -0.18, 1.30, s * 0.34, 0, 0, 0, 0.8, 1.1, 0.8);` ; `put(new THREE.IcosahedronGeometry(0.10, 0), HIDE, 1.78, 0.06, s * 0.36, 0, 0, 0, 1.25, 0.4, 0.65);` → `put(new THREE.SphereGeometry(0.10, 6, 5), HIDE, 1.78, 0.06, s * 0.36, 0, 0, 0, 1.25, 0.4, 0.65);` . Then add a guard immediately after the merge so this can never fail silently again: `const bodyGeo = mergeGeometries(parts);` → `const bodyGeo = mergeGeometries(parts);\n  if (!bodyGeo) throw new Error('crawl-cell-two: mergeGeometries returned null (indexed/non-indexed mix)');`

- **THE BODY IS ROTATED 90 DEGREES WRONG AND HANGS A METRE OUT THROUGH THE BARS. Step 6 sets `pen.rotation.y = -Math.PI / 2 + 0.14;` with the comment '+x INTO the cell'. Three.js maps local (1,0,0) to (cos θ, 0, −sin θ); at θ = −1.4308 that is (0.140, 0, 0.990) — local +x becomes world +z, not +x. The pen sits at (−6.62, −3, −8.72) and the body runs from local x −0.27 to x 2.16, so the hind foot lands at world z = −8.72 + 2.16·0.990 + 0.30·0.140 = −6.54. The cell's +Z bar plane is z = −7.55 (collider −7.62..−7.48): the back half of the animal protrudes about one metre through the bars into the walkway. Meanwhile the head (local 0.05,1.30,0.02) lands at world x −6.61 — 0.29 m clear of the west bar plane at −6.90 — so it is not 'jammed sideways between two bars', and the hands land at x −6.98 and −6.31, i.e. 0.67 m apart across the bar line rather than both on it. Everything else in step 8 is authored for the WEST plane (barMid x = cellX = −6.90, GRIP = [2,3] which are barPoints[2] = [−6.90,−8.94] and barPoints[3] = [−6.90,−8.60], the fetch target at (−6.90,−1.70,−8.77)), so the staging, the grip, the shaken bars and the eye-line all miss. The plan's own containment test cannot catch this: it only checks that `pen.position` never moves and that `occupant.position.length()` stays small — it never asks whether the body is inside the cell.**
  - _fix:_ In step 6 replace `  pen.position.set(cellX + 0.28, B, -8.72);\n  pen.rotation.y = -Math.PI / 2 + 0.14;` with `  pen.position.set(cellX + 0.02, B, -8.77);\n  pen.rotation.y = 0.14;`. Re-derived: head sphere centre lands at world x −6.83 with a 0.20 m radius, so it straddles the bar plane at −6.90 between the bars at z −8.94 and −8.60 (jammed, as authored); fingertips reach x −7.15, curling 0.25 m out through the bars; the hind foot lands at x −4.70, 0.50 m clear of the east wall face at −4.20; lateral extent is z −9.13..−8.41, inside [−9.80, −7.55]. Then add a real containment assertion to step 9 alongside the excursion bound, because the excursion bound does not test this: `const bb = new THREE.Box3().setFromObject(cell.pen);` and require `bb.min.x >= -6.98 && bb.max.x <= -4.20 && bb.min.z >= -9.80 && bb.max.z <= -7.55`.

- **STEP 3 AND STEP 5 CONFLICT AND THE PLAN LISTS THEM IN THE ORDER THAT FAILS. Step 5's anchor is `  });\n}\n// ------------------------------------------------ window-to-window relay` (house.js:3831-3833). Step 3 rewrites 3831-3832 into `  });` + two comment lines + `  return { cageIron, wornIron, collarMat, coreMat };` + `}`. Applied 3-then-5, step 5's anchor no longer exists; a careless applier who searches for the nearest `  });\n}` will edit a different function.**
  - _fix:_ Either apply step 5 BEFORE step 3 (step 3's anchor — the sliver comment plus `  });` plus `}` — survives step 5 untouched and is unique), or re-anchor step 5 to the post-step-3 text: change step 5's anchor to `  return { cageIron, wornIron, collarMat, coreMat };\n}\n// ------------------------------------------------ window-to-window relay` and prefix its replacement with the same two lines. State the required order explicitly at the top of the plan: 1, 2, 5, 6, 7, 8, 3, 4, 9, 10.


### Execute THIS (the challenged, corrected plan)

Build the second stall in the crawl wing's −Z/east corner (x −6.90..−4.20, z −9.80..−7.55) exactly as planned — that placement is correct and I verified the geometry it rests on: the crawl is grid x0..3/z2..7 which maps through origin (−12,−14) and CS 2 to world x −12..−4, z −10..+2, floor −3.0; the −Z wall is exterior (EXT_T 0.4, world.js:37) with an interior face at −9.80; the east wall is exterior 0.40 for z −10..−6 (face −4.20) and interior 0.26 north of z=−6 (face −4.13); the kennel's front collider face is x −8.18 (house.js:3487-3518), leaving 3.98 m of blank stone. The naming trap the plan flags is real: world.js:469-470 maps door-table 'S' to the cz+1 edge, i.e. +z, while the setpiece at house.js:3488 calls z=−9.7 'zSouth' — so ROUND-THIRTEEN item 2's "SOUTH wall" means the setpiece's −Z wall, and the corner placement satisfies both readings. Apply the steps in the order 1, 2, 5, 6, 7, 8, 3, 4, 9, 10 (step 3 destroys step 5's anchor otherwise), matching and emitting CRLF throughout. Before writing step 6, swap all four IcosahedronGeometry calls for SphereGeometry — mixing non-indexed polyhedra with indexed primitives makes mergeGeometries return null (vendor BufferGeometryUtils.js:63, and the trap is already documented at outside.js:8170), which crashes the renderer — and add a null guard after the merge. Set `pen.position.set(cellX + 0.02, B, -8.77)` and `pen.rotation.y = 0.14`; the plan's −π/2 yaw lays the body along world z and pushes its hind quarters a metre out through the +Z bars while leaving the head and hands nowhere near the west bar plane that barMid, GRIP=[2,3] and the fetch target are all authored against. In step 9, face the seat at yaw 0.54 (yaw 0 is −z, so the plan's PI faces away from the cell), raise the excursion bound to 0.115 (the constructed maximum is 0.1133), clear enemies during the 30 s of stepping and add `&& !g.dead`, and add a Box3 containment assertion — the excursion bound alone would not have caught the rotation defect. In step 10, keep the FLOORS entries but also add the two `read()` calls and a basement pose inside page.evaluate anchored on `F.start();\n  F.teleport('graveyard');`, because the harness scores by iterating measured rows and silently ignores FLOORS keys that were never measured; then measure first and set the floors under the measurement. Make step 11 a pure run instruction with no change block. Everything else in the plan checks out and I confirmed it rather than assuming it: steppedJerk (enemies.js:462) and its amplitude vocabulary (2946) are quoted verbatim; enemies.list has exactly two writers (1048, 1118) and the only death path is 1812, so a body never handed to either cannot kill; _moveWithPush (3222) honours every collider while _segmentBlocked (3254) skips skullPass, so tagging the new colliders skullPass adds zero enemy sight-blockers and still keeps walkers out; `pos` is a supported fetch-target key (skull.js:1846); world.box merges per material (world.js:77-88, 97-131) so the rails, post, bracket and hood ride cageIron's existing bucket at zero draws; addCollider's signature matches; main.js:181-187 captures the new root automatically and its bbox keeps it in houseInteriorRoots so the cave seal hides it; district-culling-regression never enters 'basement' (grep: zero hits) and the house sample at (−1.5, 3.6, 3) yaw π faces +z with the stall behind the camera, so 339/365 genuinely do not move; smoke.mjs:77-80 is the 700/1500 budget; all four audio methods (whisper, lockedRattle, thud, gasp) exist and early-return on `!this._ready`, so the muted gates cannot throw inside the ticker; and getWorldDirection does call updateWorldMatrix, so it is safe under sim-only stepping. I also checked the one cost objection I expected to raise and it does not hold: castShadow on the bars and the occupant costs nothing measured, because three's info.reset() runs AFTER shadowMap.render (verified in vendor/three.module.min.js), so shadow-pass draws are not counted in lastRender.drawCalls. +3 in the crawl is honest. No law is broken: no on-screen text, no HUD, no hue-only meaning (HIDE 0x14171a against BONE 0x8d9692 is a value split that survives a lantern), the throw grammar is untouched (the new target returns 'continue'), the light census is unchanged and — importantly — putting a real PointLight in the stall group would have failed district-culling's interiorHoldsNoLight assertion, which the plan correctly avoids. The remaining unmeasured items the plan already lists honestly stand: the real in-room draw count with a camera in the crawl, the legibility numbers, Lambert vs Basic for the occupant, and whether furnish() left the deep end empty (I scanned house.js for authored coordinates in that box and found nothing at basement height, and furnish() runs before basementAct at house.js:777 so the new colliders cannot suppress the crawl web at (−10.65,−1.30,−8.65) either way).

### Findings

- **The room. 'crawl' is grid cells x0..3, z2..7 → world x −12..−4, z −10..+2, floor B=−3.0, ceiling −0.55. I reconstructed the wall compiler offline from HOUSE_TABLES and confirmed every bounding collider: WEST x=−12 interior (0.26 thick, faces −12.13/−11.87), shared with pumpGallery, with exactly ONE cut — the pumpGalleryDoor at z∈[−3.65,−2.35]. −Z wall z=−10 EXTERIOR (0.40 thick, interior face z=−9.80), no cuts, running the full width. EAST wall x=−4: exterior 0.40 for z∈[−10,−6] (interior face x=−4.20), interior 0.26 for z∈[−6,+2] (face −4.13), cut for the storeroom door at z∈[−3.65,−2.35]. +Z wall z=+2 interior (face +1.87), cut for the hatchbay door.**
  - `world.js:499`
  - evidence: const exterior = !a || !b;         const t = exterior ? EXT_T : WALL_T;   // EXT_T = 0.4, WALL_T = 0.26

- **The existing cage occupies the west/−Z corner: bars close the EAST face (x=−8.25) and the +Z face (z=−6.25); the room's west wall and −Z wall close the other two. NOTE THE NAMING TRAP: this setpiece calls z=−9.7 'zSouth' and z=−6.25 'zNorth', which is the OPPOSITE of the room table's compass (the door table's 'S' is +z — the bedroom window at gz 9 faces the +z backyard). The brief's 'SOUTH wall' means the setpiece's convention: the z=−10 wall. Its interior face is z=−9.80 and it is blank from x=−8.18 (cage front collider face) east to x=−4.20 — 3.98 m of empty stone. That is the 'large blank grey wall filling the right half' of his screenshot.**
  - `house.js:3487`
  - evidence:   const frontX = -8.25;   const zSouth = -9.7, zNorth = -6.25;   const xWest = -11.72;

- **WHY THE WEST WALL BREAKS THE PLAYTHROUGH — part 1: the bot never reaches its waypoint. I ported player.js's exact _moveAxis/update integration and walkTo's steering onto the reconstructed collider set and replayed the basement leg. walkTo(−12.62,−6.8,12) cannot succeed: the direct line is blocked by the cage's side collider (z=−6.18 face, spanning x −11.72..−8.25) and then by the west wall (face −11.87). The player (RADIUS 0.34) slides into the corner and stops at (−11.53, −5.84) — 1.45 m short, which is under walkTo's 1.5 m fallback so it returns true and nobody notices. The player only crosses into the pump gallery later, on the scripted legs: yaw=PI/2 then moveX:−1 for 1.12 s walks them to z=−3.20 (the doorway line), and the run legs carry them west through the pumpGalleryDoor.**
  - `playthrough.mjs:398`
  - evidence:     walkTo(-12.62, -6.8, 12);     const pumpAim = g.pumpGallery.cradle.getWorldPosition(g.player.pos.clone()); // simulated result: player ends at (-11.53, -5.84), never west of the wall

- **WHY THE WEST WALL BREAKS THE PLAYTHROUGH — part 2: the beat passes by accident. From (−11.53,−5.84) the aim to the pump cradle (−14.18,−1.38,−6.8) is (−0.940,0,−0.341). tryThrow spawns the skull 0.55 m along that ray at (−12.047, −1.46, −6.027) — INSIDE the west wall's expanded band (x −12.23..−11.77 with the skull's r=0.1). _collide ejects it out the far face into the pump gallery, the guide point (camPos + viewDir × ≥8 m) pulls it west, and it strikes the pumpWinchCradle sphere (radius 0.56) at t=0.067 s — comfortably inside the 0.55 s window before pumpAnchored is sampled. Simulated with the real _updateFlight/_collide/_checkTargets code paths: HIT at 0.067 s.**
  - `skull.js:1231`
  - evidence:     this.pos.copy(camPos).addScaledVector(dir, 0.55);     this.pos.y -= 0.08;

- **WHY THE WEST WALL BREAKS THE PLAYTHROUGH — part 3, the demonstration. I re-ran the same end-to-end sim with a hypothetical second cell hung on the west wall in its only free stretch (between the cage bar-line z=−6.25 and the pump doorway z=−3.65). Its outer bar-line stops the slide 2 m short: the bot ends at (−9.54, −5.84), the skull now spawns in OPEN AIR at x=−10.079, flies 2 m, slams the west wall, takes three bounces inside 0.4 s and auto-returns. pumpAnchored is FALSE and 'pump-restores-the-furnace-draft' fails — which fails the whole gate, since every failed beat sets `failed = true`. The same sim with a cell on the −Z wall (x −7.05..−4.55, z −9.8..−7.35) reproduces the baseline numbers digit for digit: bot at (−11.53,−5.84), spawn inside the wall, HIT at t=0.067.**
  - `playthrough.mjs:415`
  - evidence:     beat('pump-restores-the-furnace-draft', pumpAnchored       && g.flags.has('pumpGalleryLatched') && g.pumpGallery.gateOpen,

- **The bot's other crawl-room traffic, all of which the −Z cell is clear of: walkTo(−4.8,−3) → (−4.34,−2.88); walkTo(−9.8,−3) → (−9.19,−2.99); walkTo(−9.5,−6.2) → (−9.50,−5.72); the strafe/run legs along z≈−3.2; the return legs walkTo(−12.6,−3,14,true) → walkTo(−9.2,−3,8,true) → walkTo(−4.8,−3,8,true); then walkTo(−4.8,−3,6); walkTo(−8,−3,8) with fightNearbyWalkers(); then the hatchbay run at x≈−9 from z=−3 to z=+2.8. The bot never goes south of z≈−5.7 anywhere east of x=−8. The proposed cell (z −9.8..−7.55, x −6.9..−4.2) is 1.85 m clear of the deepest point the bot ever reaches there.**
  - `playthrough.mjs:455`
  - evidence:     walkTo(-4.8, -3, 6); walkTo(-8, -3, 8);          // crawl wing     fightNearbyWalkers();

- **steppedJerk is deterministic held stop-motion noise, and it is module-private. It quantises the clock into steps at `rate` Hz, hashes the step index together with a per-body `serial` and a per-bone `channel`, and returns a value in [−1,1] that HOLDS until the next step — so a bone snaps to a slightly wrong pose, sits there, and snaps again. No Math.random, so it is byte-reproducible across gate runs; different `channel` values give decorrelated tracks off one clock. It is NOT exported, and house.js does not import enemies.js at all (house.js imports only three, util.js, BufferGeometryUtils). enemies.js imports only three + util.js, so adding the edge creates no cycle.**
  - `enemies.js:462`
  - evidence: function steppedJerk(time, serial, rate, channel = 0) {   const step = Math.floor(time * rate + serial * 0.731 + channel * 3.17);   const n = Math.sin(step * 12.9898 + serial * 78.233 + channel * 37.719) * 43758.5453;   return (n - Math.floor(n)) * 2 - 1; }

- **How steppedJerk is actually driven, for the amplitude vocabulary to copy: the walker's twitchRate is 3.5 idle / 6 wind / 10 chase / 14 strike, and the returned value is always multiplied by a small fixed amplitude (0.012 m of head offset, 0.025–0.038 rad of rotation). Nothing it touches is a root position or an attack clock — 'Root movement and attack clocks never see this.' That is exactly the property that makes it safe to drive a caged body with.**
  - `enemies.js:2946`
  - evidence:     const twitchRate = e.state === 'strike' ? 14 : e.state === 'chase' ? 10 : e.state === 'wind' ? 6 : 3.5;     const twitch = awake ? steppedJerk(this.game.time, e.serial, twitchRate, 0) : 0;     const shoulderJerk = awake ? steppedJerk(this.game.time, e.serial, twitchRate * 0.72, 1) : 0;

- **CONTAINMENT, proven by exhaustion. The only path from an enemy to the player's death is enemies.js:1812 `game.director.death(e)`, reached from inside the enemy update loop over `this.list`. `this.list` is written in exactly two places — Enemies.spawn (1048) and the Resident spawn (1118). A body that is never handed to either is never routed, never chases, never strikes, and cannot kill. The scullery watched crawler is the precedent: a full articulated figure built in house.js, moved by a house.js ticker, never in enemies.list.**
  - `enemies.js:1812`
  - evidence:               game.director.death(e); // list writers, the only two: 1048 `this.list.push(e);` and 1118 `this.list.push(e);`

- **Collider tagging matters for enemy behaviour, and it is asymmetric. _moveWithPush honours EVERY world collider including skullPass ones, so no walker can enter either cell. But _segmentBlocked (enemy line-of-sight) SKIPS skullPass colliders — so the existing cage is transparent to enemy sight, and a SOLID new cell would introduce a brand-new sight blocker into the one room where playthrough.mjs runs fightNearbyWalkers() twice. Tag the new cell's colliders `skullPass: true` to match the existing cage exactly and add zero new LOS geometry.**
  - `enemies.js:3253`
  - evidence:   _segmentBlocked(ax, ay, az, bx, by, bz) {     const dx = bx - ax, dy = by - ay, dz = bz - az;     for (const c of this.game.world.colliders) {       if (c.skullPass || c.max.y <= c.min.y) continue;

- **Which gate actually sees the draw cost — and which does not. district-culling-regression samples `g.lastRender.drawCalls` at each act's TELEPORT SPAWN, and the basement spawn is (9, −3.0, 4.9) in bcorr, ~20 m east of the crawl behind three walls. So the published 450-ceiling numbers (house 339, house-after-cave 365) cannot move: no sampled camera ever sees the crawl. The budget that does bind is smoke.mjs's per-act sample — drawCalls < 700 and geometries < 1500 for act 'basement' — plus the real 450 ceiling as experienced by a player standing in the room, which no gate currently measures. Say this plainly rather than reporting 'no change'.**
  - `smoke.mjs:77`
  - evidence:       ok(actRender.drawCalls < 700,         `act ${act}: drawCalls ${actRender.drawCalls} < 700`);       ok(actRender.geometries < 1500,

- **The zero-cost building blocks already in this file. world.box() feeds the per-material merge and costs ZERO draws ('static mounts ride the global merged batch — zero extra draws'). mergeGeometries is already imported at house.js:7. finishStatic already proves the one-material/vertexColors idiom for value modelling inside a single draw. world.candles.push({x,y,z,intensity,r}) is a DESCRIPTOR for the fixed 8-slot pooled point-light rig, so a new lit cell changes the light census by nothing — the census is pinned because changing the visible light count recompiles every lit material. And main.js:181-187 captures every scene child created during buildHouse into houseRenderRoots automatically, so a new top-level group is picked up by the cave district seal with no registry work.**
  - `world.js:1129`
  - evidence:   _buildCandlePool() {     this.candlePool = [];     for (let i = 0; i < 8; i++) {       const l = new THREE.PointLight(0xff9540, 0, 9, 1.8);       // Keep the light count resident so crossing the eighth-candle boundary       // never invalidates every lit material's shader.


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. Export steppedJerk so the cage can reuse the enemies' held-noise clock instead of forking it. One keyword. (Alternative, if the lane rules make house.js→enemies.js unwelcome: move the function verbatim into src/util.js and import it in both files — same math, two extra import edits.)** — `enemies.js`

_anchor:_
```js
function steppedJerk(time, serial, rate, channel = 0) {
```

_change:_
```js
export function steppedJerk(time, serial, rate, channel = 0) {
```

**2. 2. Import it in house.js. Add one line after the BufferGeometryUtils import (line 7). No cycle: enemies.js imports only three + util.js.** — `house.js`

_anchor:_
```js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
```

_change:_
```js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// The second stall's occupant runs on the enemies' held stop-motion clock — the
// same deterministic snap-and-hold the walkers' heads use — so a caged body and
// a loose one share one vocabulary and one seed. It is never an enemy.
import { steppedJerk } from './enemies.js';
```

**3. 3. Let the kennel hand its materials to the next stall, so the new cell's rails join the SAME merged batch (zero extra draws, zero extra batches) and its bars share one shader program. buildCrawlCounterweightSecret currently returns undefined and nothing consumes its return value, so this is inert.** — `house.js`

_anchor:_
```js
    // A sliver of somewhere leaks under the shutter BEFORE the solve: the
    // player can see there is a place back there worth opening. Dim enough
    // that the opened room still lands as a reveal.
  });
}
```

_change:_
```js
    // A sliver of somewhere leaks under the shutter BEFORE the solve: the
    // player can see there is a place back there worth opening. Dim enough
    // that the opened room still lands as a reveal.
  });
  // The run has more than one stall. Hand the next one the same iron so its
  // rails merge into this batch and its bars share this program.
  return { cageIron, wornIron, collarMat, coreMat };
}
```

**4. 4. Call the new builder immediately after the kennel, inside basementAct, so it runs during buildHouse and is captured into main.js's houseRenderRoots automatically.** — `house.js`

_anchor:_
```js
  buildCrawlCounterweightSecret(game, B);
  buildBasementPilot(game, B);
```

_change:_
```js
  const crawlKennel = buildCrawlCounterweightSecret(game, B);
  buildCrawlCellTwo(game, B, crawlKennel);
  buildBasementPilot(game, B);
```

**5. 5. THE CELL — geometry. Insert a new function immediately after buildCrawlCounterweightSecret's closing brace (house.js:3832, the line before the '// ---- window-to-window relay' banner at 3833). It is on the −Z wall east of the kennel, i.e. the wall in his screenshot. Every measurement below was verified against the reconstructed compiler output: the −Z wall's interior face is z=−9.80 (exterior wall, 0.40 thick) and the east wall's interior face is x=−4.20 for z∈[−10,−6] (also exterior, 0.40 thick — it steps to −4.13 only north of z=−6, which this cell does not reach). The west bar plane at x=−6.90 leaves a 1.28 m walkable lane between it and the kennel's front collider face at x=−8.18, so the deep end stays enterable and the player can walk right up to both cells. Bars, rails, spacing, radii, heights and collider inset are copied verbatim from the kennel so the two stalls are visibly one run.** — `house.js`

_anchor:_
```js
  });
}
// ------------------------------------------------ window-to-window relay
```

_change:_
```js
  });
}

// ---------------------------------------------- the second stall
// "the pully in the room of the basement in the first house has an empty space
// next to it where the wall has nothing - i was thinking we could make another
// jailcell with the mosst freaky creature every just shaking the bars or trying
// to get out."
//
// The empty space is the crawl wing's −Z wall east of the kennel: 3.98 m of
// blank stone from the kennel's bars (x −8.18) to the east wall (x −4.20).
// This is the SAME wall the kennel closes with, and it MUST be this one. The
// west wall is the playthrough's lane: the bot's pump throw is taken flush
// against it at (−11.53, −5.84) and only lands because the skull's 0.55 m
// launch offset spawns it INSIDE that 0.26 m wall and the collider ejects it
// into the pump gallery. Put bars on the west wall and the bot stops two
// metres short, the skull spawns in open air, bounces three times, and
// 'pump-restores-the-furnace-draft' fails. Do not build here.
function buildCrawlCellTwo(game, B, kennel) {
  const { world, scene } = game;
  const cageIron = kennel.cageIron;          // same batch, same program

  const cellX = -6.90;        // WEST bar plane — the face you walk up to
  const cellZ = -7.55;        // +Z bar plane
  const backFace = -9.80;     // room −Z exterior wall, interior face (verified)
  const eastFace = -4.20;     // room east exterior wall, interior face (verified)
  const barY = B + 1.16;
  const barH = 2.32;

  const stall = new THREE.Group();
  stall.name = 'crawl-cell-two';
  scene.add(stall);

  const barPoints = [];
  for (let z = backFace + 0.18; z <= cellZ - 0.08; z += 0.34) barPoints.push([cellX, z]);
  for (let x = cellX + 0.22; x <= eastFace - 0.18; x += 0.34) barPoints.push([x, cellZ]);
  const barGeo = new THREE.CylinderGeometry(0.027, 0.034, barH, 7);
  const bars = new THREE.InstancedMesh(barGeo, cageIron, barPoints.length);
  bars.name = 'crawl-cell-two-bars';
  const barMatrix = new THREE.Matrix4();
  barPoints.forEach(([x, z], i) => {
    barMatrix.makeTranslation(x, barY, z);
    bars.setMatrixAt(i, barMatrix);
  });
  bars.instanceMatrix.needsUpdate = true;
  bars.castShadow = true;
  bars.receiveShadow = true;
  stall.add(bars);
  // rails + corner post ride the merged shell: zero draws
  for (const y of [B + 0.12, B + 1.14, B + 2.25]) {
    world.box(cageIron, cellX, y, (backFace + cellZ) / 2, 0.09, 0.09, cellZ - backFace + 0.12);
    world.box(cageIron, (cellX + eastFace) / 2, y, cellZ, eastFace - cellX + 0.12, 0.09, 0.09);
  }
  world.box(cageIron, cellX, B + 1.16, cellZ, 0.12,
```

**6. 6. THE OCCUPANT — one merged mesh, one draw. Continue inside buildCrawlCellTwo, before the return. Fiction: the run held a dog that died curled around a ball it was never allowed to fetch. This is the next stall, and it is still moving — dog-shaped the way a coat is person-shaped: a human-length spine on too many limbs, a head that is mostly jaw, and the SAME collar value as the kennel's dog, sunk into the neck. It reuses the kennel's authored vocabulary so it lands as one story, and its head is jammed sideways between two bars, which does three jobs: it explains the shaking, it gives a rigid body a fixed pivot so the jerk reads as straining rather than sliding, and it puts the worst part of the silhouette at the player's eye line at the bars. Every part's local transform is baked into its geometry and the lot is merged, so ~40 primitives become ONE BufferGeometry and ONE draw. Internal value modelling comes from a per-vertex colour attribute under a single vertexColors material — the same trick finishStatic already uses. EVERY part must carry the colour attribute or mergeGeometries will drop it and the mesh renders black. Material: MeshLambertMaterial (the brief's workhorse — MeshStandardMaterial's fixed 0.04 specular clips to white under the lantern at arm's length). The scullery crawler's unlit MeshBasicMaterial is the standing alternative and would make it visible from the doorway before your lantern arrives; pick between them with tests/legibility-regression.mjs, not by opinion.** — `house.js`

_anchor:_
```js
  // ... occupant, light and ticker: steps 6, 7 and 8 ...
```

_change:_
```js
  // THE THING IN THE NEXT STALL. One merged geometry, one material, ONE DRAW.
  // Value modelling lives in a vertex-colour attribute, the way finishStatic
  // does it — bone-pale on skull, ribs and fingers, near-black on hide and
  // limbs. Never hue: this reads as light bone against dark hide against pale
  // stone, and it survives being lit by one carried lamp or not lit at all.
  const HIDE = new THREE.Color(0x14171a);
  const BONE = new THREE.Color(0x8d9692);
  const parts = [];
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const paint = (geo, colour) => {
    const n = geo.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = colour.r; c[i * 3 + 1] = colour.g; c[i * 3 + 2] = colour.b; }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.deleteAttribute('uv');          // merge requires identical attribute sets
    return geo;
  };
  const put = (geo, colour, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    paint(geo, colour);
    M4.compose(new THREE.Vector3(x, y, z),
      Q.setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz));
    geo.applyMatrix4(M4);
    parts.push(geo);
    return geo;
  };
  const limb = (a, b, ra, rb, colour) => {
    const d = b.clone().sub(a);
    const geo = new THREE.CylinderGeometry(rb, ra, d.length(), 6);
    paint(geo, colour);
    M4.compose(a.clone().add(b).multiplyScalar(0.5),
      Q.setFromUnitVectors(UP, d.clone().normalize()),
      new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(M4);
    parts.push(geo);
  };
  // local frame: origin on the floor at the bars, +x INTO the cell (away from
  // the player), so the whole body's haul axis is −x.
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  limb(V(0.30, 1.02, 0), V(0.95, 0.86, 0.04), 0.115, 0.085, HIDE);      // chest
  limb(V(0.95, 0.86, 0.04), V(1.62, 0.74, -0.03), 0.085, 0.070, HIDE);  // spine
  limb(V(1.62, 0.74, -0.03), V(2.05, 0.55, 0.02), 0.070, 0.048, HIDE);  // hips
  for (let i = 0; i < 6; i++) {                                          // ribs — the kennel's own idiom
    put(new THREE.TorusGeometry(0.20 + i * 0.011, 0.017, 5, 13, Math.PI * 1.55), BONE,
      0.52 + i * 0.19, 0.92 - i * 0.015, 0.01, 0, Math.PI / 2, -0.72 + i * 0.05);
  }
  put(new THREE.IcosahedronGeometry(0.20, 1), BONE, 0.05, 1.30, 0.02,
    0.12, 1.42, -0.28, 1.02, 0.62, 1.55);                                // skull, edge-on between two bars
  put(new THREE.BoxGeometry(0.15, 
```

**7. 7. THE LIGHT — one pooled descriptor, one small core, zero census change. Adding a real PointLight would move the pinned light census and recompile every lit material in the game; world.candles is the descriptor path into the fixed 8-slot pool. Put it BEHIND the occupant in the far corner so the thing reads as a black silhouette moving inside a lit box: contrast, not brightness, and value carries it with no hue at all. The pump gallery already paid for the lesson that an invisible source reads as magic, so the bracket and hood go through world.box (zero draws) and exactly one small emissive core sphere makes the source visible.** — `house.js`

_anchor:_
```js
  pen.add(occupant);
  stall.add(pen);
```

_change:_
```js
  pen.add(occupant);
  stall.add(pen);

  // Backlight, not spotlight. A DESCRIPTOR for the pooled 8-light rig — the
  // light census never moves — dropped in the cell's far corner so the body
  // reads as a hole moving in front of a lit wall.
  world.candles.push({ x: -4.72, y: B + 1.82, z: -9.34, intensity: 0.8, r: 4.0 });
  world.box(cageIron, -4.42, B + 1.82, -9.34, 0.24, 0.05, 0.05);        // bracket, merged, 0 draws
  world.box(cageIron, -4.68, B + 1.96, -9.34, 0.22, 0.05, 0.22);        // hood, merged, 0 draws
  const lampCore = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffbe86, toneMapped: false }));
  lampCore.name = 'crawl-cell-two-lamp';
  lampCore.position.set(-4.72, B + 1.82, -9.34);
  stall.add(lampCore);
```

**8. 8. THE MOTION AND THE SOUND — steppedJerk on the body, the same clock on the two gripped bars, and audio first. The whole thing is bounded by construction: |steppedJerk| ≤ 1 and amp ≤ 0.10, so the body's maximum excursion is 0.10 m in x, 0.04 m in z, 0.035 m in y — the nearest bar plane is 0.28 m away and the cell's far wall is 2 m away, so it can never reach a collider, let alone leave. `pen.position` is never written after build. The bars answer the pull because the two instances the hands are on get their matrices rewritten from the SAME jerk value — that is free (the InstancedMesh is already one draw) and it is what turns a jerking body into a shaken cage. The whole ticker is gated on act === 'basement', so it costs nothing in seven of eight districts. It must never call director scare/pressure APIs, game.shake, or game.impact: the quiet-vs-loud economy says a caged thing is a quiet thing that gets loud only when you walk up to it.** — `house.js`

_anchor:_
```js
  lampCore.name = 'crawl-cell-two-lamp';
  lampCore.position.set(-4.72, B + 1.82, -9.34);
  stall.add(lampCore);
```

_change:_
```js
  lampCore.name = 'crawl-cell-two-lamp';
  lampCore.position.set(-4.72, B + 1.82, -9.34);
  stall.add(lampCore);

  // A FIXED serial: the jerk must be byte-identical every run or the gates
  // cannot pin it. Two channels for the body, one for the bars.
  const SERIAL = 0x2c;
  const REST_RATE = 1.6, FIT_RATE = 11;
  const HOME = occupant.position.clone();            // (0,0,0) — local rest
  const REST_ROT = occupant.rotation.clone();
  const GRIP = [2, 3];                               // the two west-run bars the hands hold
  const barMid = new THREE.Vector3(cellX, B + 1.30, -8.77);
  const mouth = new THREE.Vector3(cellX - 0.18, B + 1.34, -8.72);
  const state = { fit: 0, struck: 0, cd: 0, breath: 4.5, lastStep: -1 };
  game.cellTwo = { pen, occupant, bars, state, home: pen.userData.home };

  // A skull that reaches the bars is noticed. No flag, no reward, no puzzle —
  // the grammar answers and nothing is owed.
  world.addFetchTarget({
    id: 'crawlCellTwoBars', pos: barMid.clone(), radius: 0.7,
    onHit(skull) {
      state.struck = Math.max(state.struck, 1.6);
      return 'continue';                             // it is not a target, it is a wall with a thing behind it
    },
  });

  game.tickers.push((dt, time) => {
    if (game.act !== 'basement') return;
    const p = game.player.pos;
    const d = Math.hypot(p.x - barMid.x, p.z - barMid.z);
    // getWorldDirection updates its own world matrix, so this is safe under
    // sim-only stepping where nothing has rendered.
    const look = game.camera.getWorldDirection(new THREE.Vector3());
    const toCell = new THREE.Vector3(barMid.x - p.x, 0, barMid.z - p.z).normalize();
    const facing = look.x * toCell.x + look.z * toCell.z;
    state.struck = Math.max(0, state.struck - dt);
    const want = (d < 6.5 && facing > 0.35) || state.struck > 0 ? 1 : 0;
    state.fit += (want - state.fit) * Math.min(1, dt * (want ? 3.2 : 0.7));

    const rate = REST_RATE + state.fit * (FIT_RATE - REST_RATE);
    const haul = steppedJerk(time, SERIAL, rate, 0);
    const roll = steppedJerk(time, SERIAL, rate * 0.61, 1);
    const yaw = steppedJerk(time, SERIAL, rate * 0.43, 2);
    const amp = 0.028 + state.fit * 0.072;                    // <= 0.10 m, hard bound
    occupant.position.set(HOME.x - haul * amp, HOME.y + Math.abs(haul) * amp * 0.35, HOME.z + yaw * amp * 0.4);
    occupant.rotation.set(REST_ROT.x + roll * (0.03 + state.fit * 0.06),
      REST_ROT.y + yaw * (0.02 + state.fit * 0.05),
      REST_ROT.z + roll * (0.04 + state.fit * 0.09));

    // THE BARS ANSWER. Same jerk value, two instances, zero
```

**9. 9. PIN THE CONTAINMENT. Add to the file that already owns this room. It asserts the four things that must never drift: the pen's world position is byte-identical to its authored home after 30 s of stepping with the player at the bars; the occupant's local excursion never exceeds the constructed bound; nothing in the cell is registered as an enemy; and both cell colliders exist and are skullPass (so no new enemy sight blocker was introduced).** — `basement-foundations.mjs`

_anchor:_
```js
    const puzzle = g.crawlSecret;
    const target = g.world.fetchTargets.find((t) => t.id === 'crawlCounterweightCradle');
```

_change:_
```js
    // THE SECOND STALL NEVER LEAVES IT. Not a soft claim: the pen's position is
    // written once at build and never again, and the only animated transform is
    // the occupant's local one, bounded by construction at 0.10 m.
    {
      const cell = g.cellTwo;
      const home = cell?.home?.clone();
      g.player.pos.set(-5.6, -3, -6.6);
      g.player.yaw = Math.PI; g.player.pitch = 0; g.player._sync(0);
      let worst = 0;
      for (let i = 0; i < 300; i++) {
        F.stepWith(0.1, {}, false);
        worst = Math.max(worst, cell.occupant.position.length());
      }
      check(
        'the caged thing shakes its bars, is never an enemy, and never leaves the cell',
        !!cell && cell.pen.position.distanceTo(home) === 0
          && worst > 0.001 && worst <= 0.11
          && !g.enemies.list.some((e) => e.mesh === cell.pen || e.mesh === cell.occupant)
          && g.world.colliders.filter((c) => c.id === 'crawlCellTwoFront' || c.id === 'crawlCellTwoSide').length === 2
          && g.world.colliders.filter((c) => c.id === 'crawlCellTwoFront' || c.id === 'crawlCellTwoSide').every((c) => c.skullPass),
        { home: home?.toArray(), pen: cell?.pen.position.toArray(), worstExcursion: +worst.toFixed(4),
          enemies: g.enemies.list.length },
      );
    }

    const puzzle = g.crawlSecret;
    const target = g.world.fetchTargets.find((t) => t.id === 'crawlCounterweightCradle');
```

**10. 10. PIN THE READ, because the recurring failure here is working-but-illegible, not broken. Add one FLOORS entry and one pose to the legibility gate, measured first and then floored under the measurement. Toggle the OBJECT (cell.occupant), never a material — finishStatic clones materials, and that trap has already cost this project four rounds. Settle the frame before reading it (render until two frames are byte-identical) or the number is noise.** — `legibility-regression.mjs`

_anchor:_
```js
  'the key in the grass, from four metres': [0.01, 4.0],
};
```

_change:_
```js
  'the key in the grass, from four metres': [0.01, 4.0],
  // measure first, then floor UNDER the measurement — this is a regression
  // gate, not a target. The read is a silhouette: score it on contrast, which
  // is what `read` already returns, so a dark body on a backlit wall passes on
  // exactly the same terms a bright key does.
  'the second stall, from the crawl doorway': [0.20, 1.5],
  'the second stall, at the bars': [2.0, 1.4],
};
```

**11. 11. RUN THE GATE THAT DECIDES IT. `node tests/playthrough.mjs` is the one that proves the cell does not break the critical path: it is the completability gate, it crosses this room five times, and its 'pump-restores-the-furnace-draft' beat is the most geometry-sensitive assertion in the game (see the findings). It must stay green, and its `player` extra in that beat's payload must still show the bot at x ≈ −11.5, z ≈ −5.8 before the throw — if that number moved, the cell touched the lane. Then the rest of the battery: basement-foundations (owns this room), district-culling-regression (the 450 ceiling), legibility-regression (the new floors), smoke (the basement act's 700-draw / 1500-geometry budget), autotest and regressions.** — `playthrough.mjs`

_anchor:_
```js
    beat('pump-restores-the-furnace-draft', pumpAnchored
      && g.flags.has('pumpGalleryLatched') && g.pumpGallery.gateOpen,
```

_change:_
```js
    // (no edit — this is the gate. It must stay green, and the `player` extra
    // below must still read x ≈ -11.5, z ≈ -5.8: that is the bot standing in
    // the pocket against the WEST wall, which is why the second stall goes on
    // the -Z wall instead. See docs/ROUND-THIRTEEN.md item 2.)
    beat('pump-restores-the-furnace-draft', pumpAnchored
      && g.flags.has('pumpGalleryLatched') && g.pumpGallery.gateOpen,
```


### Cost

DRAW CALLS: +3 recommended — bars (1 InstancedMesh), occupant (1 merged vertex-coloured mesh), lamp core (1 small basic sphere). +2 is the honest minimum if the lamp core is dropped and the cell is lit only by the carried skull-light. Everything else — three rails per face, the corner post, the bracket, the hood — goes through world.box and merges into the static shell at ZERO draws, and the bars share the kennel's cageIron instance so there is no second shader program. A separately-jerking head would be a 4th draw; I left it out because the head is jammed between two bars and therefore should move WITH the body, not against it. GEOMETRIES: +3 resident (merged body, bar cylinder, lamp sphere) after disposing the ~40 merge inputs — against smoke.mjs's 1500 ceiling. LIGHTS: zero. world.candles is a descriptor into the fixed 8-slot pool, so the pinned light census does not move and no lit material recompiles. PER-FRAME CPU: the ticker returns immediately unless act === 'basement'; inside it, four steppedJerk calls (a floor, a sin, a fract each), two instance-matrix writes, one dot product. Negligible. HONEST CAVEAT ON THE PUBLISHED NUMBERS: district-culling-regression samples drawCalls at each act's TELEPORT SPAWN, and the basement spawn is (9, -3.0, 4.9) in bcorr — twenty metres east of the crawl behind three walls. So house 339 / house-after-cave 365 will not move, and neither will the basement smoke sample. That is not evidence the cell is free; it is evidence no gate looks. The +3 is a real cost only while the player stands in the crawl, and the only way to know the true in-room figure is to pose a camera there and read g.lastRender.drawCalls — see openQuestions. IMPLEMENTATION EFFORT: about 180 lines in house.js, one keyword in enemies.js, one import, one call-site line, ~25 lines of test. Half a day including measurement.

### Risk

Low for the cell itself; the real risk is the landmine it sits next to. (1) THE UNPINNED ACCIDENT: 'pump-restores-the-furnace-draft' currently passes because the bot fails to reach its waypoint, jams against the west wall, and the skull's launch offset buries it inside that wall so the collider ejects it into the pump gallery. Nothing in the repo records this. Any future change to the crawl's west wall, to the cage's side collider, to walkTo's 1.5 m fallback, to FEEL_PROFILE's 0.55 m launch offset, or to WALL_T will silently break the completability gate and the next agent will spend a day on it. Strongly recommend a separate one-line pin in tests/regressions.mjs asserting the bot's pre-throw position, or better, fixing the route honestly by inserting `walkTo(-11.4, -3, 6); walkTo(-12.62, -6.8, 12);` so the bot walks through the pumpGalleryDoor like a player — but that is a change to the gate itself and needs its own round and Alex's call. (2) Collider tagging: if the implementer 'hardens' the cell by dropping skullPass, they add a new enemy line-of-sight blocker (enemies.js:3253 skips skullPass) into the one room where the playthrough fights walkers twice — keep skullPass. (3) mergeGeometries drops the merge if attribute sets differ: every part must carry the colour attribute and have uv deleted, or the occupant renders black or vanishes. (4) A new collider changes webClear outcomes; the nearest basement web is at (-10.65,-1.30,-8.65), inside the kennel and 3.5 m clear of the new cell, so no web should be suppressed — but check the console for a missing web after the change.

### Open questions

- NOT MEASURED, and it should be before this ships: the actual draw-call count with the camera standing in the crawl looking at both cells. No existing gate poses a camera there. A ten-line probe modelled on tools/probe-key-tree-legibility.mjs — teleport('basement'), seat the player at (-5.6,-3,-6.6) facing -z, settle, read g.lastRender.drawCalls with the stall visible and hidden — settles it and gives the real headroom under 450. I could not run it: the instructions forbid launching a browser while the gate battery is running.
- NOT MEASURED: the legibility numbers. I have specified WHERE the FLOORS entries go and what pose to read, but the values [0.20, 1.5] and [2.0, 1.4] are placeholders. Measure first with tests/legibility-regression.mjs, print the console row, then floor under it. Legibility is contrast, not brightness — a black body on a backlit wall must be scored on the `contrast` column the harness already computes, not on `ratio`.
- UNSETTLED BY SOURCE: MeshLambertMaterial versus the scullery crawler's unlit MeshBasicMaterial for the occupant. Lambert obeys the lantern (the thing is invisible until you bring light, and the backlight candle carries the silhouette); Basic is a fixed dark value that can never blow out and is visible from the doorway before your lamp arrives. house.js:4941 chose Basic deliberately for the crawler, for a stated reason that applies here too. This is a taste call between two defensible reads and it should be decided by rendering both and looking, not by argument.
- MY COLLIDER RECONSTRUCTION COVERS THE COMPILED SHELL PLUS THE TWO CAGE COLLIDERS. It does not include furnishing colliders that basementAct or furnish() may add inside the crawl. Colliders can only ADD obstruction, and the baseline run reproduces the known-green outcome digit for digit (bot at -11.53,-5.84; skull spawn inside the wall; cradle hit at t=0.067), so the model is evidently faithful for this lane — but the real gate is still the only proof. Run tests/playthrough.mjs.
- NOT CHECKED: whether the cell's footprint (x -6.90..-4.20, z -9.80..-7.55) is clear of any prop placed by furnish() at the crawl's deep end. The setpiece comment calls the wing 'twelve metres of dirt with nothing to learn in it' and his screenshot shows blank wall, so it is almost certainly empty — but the implementer should assert it, e.g. by logging any collider intersecting that box at boot before adding the cell's own two.
- HIS OTHER NOTE, cheap and adjacent: 'oooo, also, can we have more spider webs with spiders in places.' A web site in the alcove between the two cells — around (-7.6, -1.30, -9.3) — is free (the kit exists, the sites are a table) and would dress the new corner. It must go OUTSIDE the cell: webClear tests against colliders and will reject any site inside the bars.


---

<a id="ossuary"></a>

## ossuary

**This is already fixed and already live — commit 515ebef deleted the exact plate he was looking at, and production's outside.js is byte-identical (modulo CRLF) to this worktree; there is no second coplanar pair anywhere above that key, so the only action left is telling him to hard-refresh.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **Step 3b DEPENDS on step 3a, but 3a is labelled "(Recommended, optional)". An applier who reads 3a as skippable and applies 3b/3c gets `THREE is not defined` inside page.evaluate — a ReferenceError, which makes the whole legibility gate THROW rather than report a failed check. There is nothing in step 3b's text that says it cannot stand alone.**
  - _fix:_ Relabel the group: "Step 3 is one atomic patch — 3a, 3b and 3c must all be applied or none of them." Better still, apply the fix in the next row, which deletes 3a entirely and removes the coupling.


### Execute THIS (the challenged, corrected plan)

The plan's conclusion is right and I verified it independently: commit 515ebef deleted `addMeshBox(wallMat, OX - 2.45, DECK_Y, OZ + 33.93, 0.9, 0.2, 0.46, 'hatch deck south')`, a 0.9 x 0.46 m plate nested whole inside the 5.9 x 2.0 m 'hatch deck' with its underside on y = 1.30 bit-for-bit, both in wallMat, and production's outside.js no longer contains that call (fetched read-only: HTTP 200, 427310 bytes vs the worktree's 436074 over 8764 lines — exactly CRLF vs LF). The tiling explanation is confirmed at src/textures.js:1199 (M.stone repeats 2,1; BoxGeometry lays 0..1 UVs per face, and batchStaticGroup transforms position/normal but not uv, so the small plate really did wear the same map 6.5x finer in x and 4.3x finer in z), and M.brick appears nowhere in outside.js. I enumerated every addMeshBox and routeRoot.add in the ossuary builder (src/outside.js:2072-3768) and confirmed nothing else in routeRoot occupies the shaft between y = 0.8 and the cap: the deck underside at 1.30 and the DoubleSide shaftVoid at 3.00, 1.70 m apart, with the side walls, cap wall and parapets all outside the ray footprint; the two surviving coplanar pairs are 10 mm floor nosings at y = -2.10 and y = -0.95, both below the rays. SO: apply step 1 (change nothing in src/) and step 4 (leave the nosings) exactly as written; apply step 2's doc row with the small "0.77 m in front of it" wording it already uses; tell Alex to hard-refresh. Step 3 is a good gate and breaks no law — no HUD, no in-play text, no hue, no throw-grammar change, no light-count change, no per-frame ticker, and it deliberately avoids the finishStatic material-identity trap by filtering on batchStaticGroup's `ossuary shell material N` names (batchStaticGroup reuses the source material; it is world.finishStatic that clones). Its physics check out: Three r161's raycast walker `lm()` does not test `.visible`, and Mesh raycast backface-culls for FrontSide, so an upward ray sees one hit per Lambert plate — 20 x-values x 6 z-values = 120 rays, all inside x[-73.00,-67.10] z[23.70,25.70], expected 120/120 covered at 0.50 m with a worst gap of 1.70. But apply step 3 only as one atomic patch with three corrections: DELETE step 3a and the dynamic `import('/vendor/three.module.min.js')` entirely, taking THREE from live objects instead (`g._crosshairTarget(); const Ray = g._ray.constructor; const V3 = g.player.pos.constructor;`) so the callback stays synchronous and no module resolution can throw the gate; guard step 3c with `const deck = result.deck || { rays: 0, covered: 0, worstGap: null, at: null };`; and write the census's two blind spots into its comment (a 0.3 m grid misses duplicates narrower than 0.3 m, and it cannot see anything authored with world.box). Fix four facts before this goes in a doc: the ossuary is a 142-draw district, not the graveyard's 327; the flight is walked by tests/regressions.mjs:597 `scenario('ossuary-climb')` and tests/playthrough.mjs, not by grip-contact-regression; the tread nudge is two conditional edits in two loops, not one line; and drop openQuestions #4 — the "1.9 m of headroom" comment at src/outside.js:2551-2554 is correct history describing the pre-raise FLOOR+5.25 state, not a stale number.

### Findings

- **The ossuary key hangs at world (-72.45, 0.25, 24.70). This is the anchor for everything below: OX=-70, OZ=-10, FLOOR=-4.2, so OX-2.45 = -72.45, FLOOR+4.45 = 0.25, OZ+34.70 = 24.70.**
  - `outside.js:3586`
  - evidence: gateKey1.reveal(OX - 2.45, FLOOR + 4.45, OZ + 34.7);

- **The ceiling over that key is now ONE plate. DECK_Y = FLOOR + 5.6 = 1.40, so the plate occupies x[-73.00,-67.10], y[1.30,1.50], z[23.70,25.70] in wallMat (M.stone.clone() darkened 0.47). It is the only surface in the whole builder at DECK_Y — `grep -n "DECK_Y" src/outside.js` returns only the const at 2555, the two comment lines, and this one call.**
  - `outside.js:2667`
  - evidence: addMeshBox(wallMat, OX - 0.05, DECK_Y, OZ + 34.7, 5.9, 0.2, 2.0, 'hatch deck');

- **Round twelve deleted the coplanar partner. The removed plate was centred (-72.45, 1.40, 23.93) at 0.9 x 0.2 x 0.46, i.e. x[-72.90,-72.00], y[1.30,1.50], z[23.70,24.16] — nested ENTIRELY inside the big plate, with its underside on y = 1.30 bit-for-bit and its -z face on z = 23.70 bit-for-bit. Both plates were wallMat, so the fight showed as a texture swap, not a colour swap.**
  - `outside.js:2667`
  - evidence: git show 515ebef: "-  addMeshBox(wallMat, OX - 2.45, DECK_Y, OZ + 33.93, 0.9, 0.2, 0.46, 'hatch deck south');"

- **The deleted plate was literally 'above the key', at the key's exact x. Same x (-72.45), 1.05 m of clear air above the key's centre to the shared underside at y=1.30, and 0.77 m toward the player in z. Standing on the platform at the stair top and looking up, it is the panel dead centre of frame.**
  - `outside.js:3586`
  - evidence: key (OX-2.45, FLOOR+4.45, OZ+34.7) vs deleted plate (OX-2.45, DECK_Y, OZ+33.93): dx = 0.000, dy = 1.15 to plate centre, dz = 0.77

- **His 'brick texrue' is the tiling, not a different material. M.stone carries repeat (2,1) and BoxGeometry lays 0..1 UVs PER FACE, so both plates showed exactly 2 x 1 tiles regardless of size: the 5.9 x 2.0 plate at 2.95 m x 2.00 m per tile, the 0.9 x 0.46 plate at 0.45 m x 0.46 m per tile — 6.5x finer in x, 4.3x finer in z. Packed mortar lines (rgb(30,28,26) on a [74,72,66] base) read darker and warmer, which is the 'browner'. M.brick itself never appears in outside.js at all — it exists only in house.js.**
  - `textures.js:1199`
  - evidence: M.stone = lam(bump(T(512, 512, 16, (g, w, h, r) => stonePaint(g, w, h, r, [74, 72, 66], 5, rgb(30, 28, 26)), 2, 1), 0.19));

- **Nothing else can enter the frame. While inOssuary, syncOssuaryVisibility hides every scene child that is not routeRoot, the camera, the skull, a light, world.lightRoot, or flagged keepInOssuary — so no graveyard or terrain surface can fight the deck even though DECK_Y=1.4 sits above the yard's ground plane.**
  - `outside.js:3374`
  - evidence: const syncOssuaryVisibility = () => { if (state.inOssuary) { ... for (const child of scene.children) { if (keepInOssuary(child)) continue; ... child.visible = false; } return; }

- **There is no second coplanar pair above the key. Between y=0.8 and the shaft cap there are exactly two surfaces in routeRoot: the deck underside at y=1.30 and shaftVoid (a DoubleSide MeshBasic black plane) at y = WALL_TOP - 0.05 = 3.00. They are 1.70 m apart. The side walls (x[-73.30,-73.00] and x[-67.00,-66.70]) and the cap wall (z[25.40,25.70]) never cross the shaft interior.**
  - `outside.js:2577`
  - evidence: shaftVoid.position.set(OX, WALL_TOP - 0.05, OZ + 32.85);  // WALL_TOP = DECK_Y + 1.65 = 3.05

- **Two genuine coplanar pairs DO survive elsewhere in the shaft, both on FLOORS, both 10 mm wide, neither above the key. (a) Flight-A tread 10 vs 'shaft landing': both top faces on y = -2.100 exactly, sharing x[-69.30,-67.15] and overlapping z[23.250,23.260]. (b) Flight-B tread 5 vs 'shaft platform': both top faces on y = -0.950 exactly, sharing z[23.90,25.40] and overlapping x[-72.010,-72.000]. Both pairs are wallMat/wallMat. They are a side effect of the deliberate `aStep + 0.01` / `bStep + 0.01` nosing overlap meeting a landing whose top is exactly flush.**
  - `outside.js:2610`
  - evidence: addMeshBox(wallMat, x1 - (bStep + 0.01) / 2, top - 0.06, (BF.z0 + BF.z1) / 2,       bStep + 0.01, 0.12, BF.z1 - BF.z0, 'shaft tread');   // i=5: top = FLOOR+2.1+1.15 = -0.95, x[-72.01,-71.55]

- **One more coplanar co-oriented pair exists and is unreachable: 'hatch deck' z-max = 25.700 is the same plane as 'shaft cap wall' z-max = OZ+35.7 = 25.700, both faces normal +z, both wallMat, overlapping x[-73.00,-67.10] by y[1.30,1.50]. Every viewpoint in play is at z < 25.40, so both faces are back-facing and culled. Leave it.**
  - `outside.js:2565`
  - evidence: addMeshBox(wallMat, OX, (FLOOR + WALL_TOP) / 2, OZ + 35.55, HALF_W * 2 + 0.6,     WALL_TOP - FLOOR, 0.3, 'shaft cap wall');   // z spans 25.40..25.70

- **PRODUCTION ALREADY HAS THE FIX. I fetched https://qualiacology.com/fetch/src/outside.js (HTTP 200, 427310 bytes, 8764 lines — the worktree file is 8764 lines and 436074 bytes, exactly one byte per line more, i.e. CRLF vs LF) and diffed it. It is identical. Live line 2667 is the single 'hatch deck' plate and there is no 'hatch deck south' addMeshBox anywhere in it.**
  - `outside.js:2667`
  - evidence: $ diff <(tr -d '\r' < src/outside.js) /tmp/live-outside.js  ->  IDENTICAL (modulo CRLF)

- **He was playing the old build. His notes are dated 2026-08-19 evening and are explicitly on the round-eleven build; round twelve (which contains 515ebef) shipped afterward as site PR #79, and the round-thirteen brief records that he had not played it yet.**
  - `ROUND-THIRTEEN.md:20`
  - evidence: **He had not played it at the time of writing. Tell him to hard-refresh.**


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. CHANGE NOTHING IN src/. This is the finished state of the fix. Do not add a polygonOffset, do not nudge the plate, do not delete anything else — there is no second plate to delete, and every remaining coplanar pair in the district is either a 10 mm floor nosing or a back-facing pair no camera can reach. Adding polygonOffset here would cost a material split out of the merged wallMat bucket and one extra draw call in a 327-draw district, to fix nothing.** — `outside.js`

_anchor:_
```js
addMeshBox(wallMat, OX - 0.05, DECK_Y, OZ + 34.7, 5.9, 0.2, 2.0, 'hatch deck');
```

_change:_
```js
UNCHANGED — leave verbatim. Line 2667 is correct as it stands.
```

**2. 2. Tell him how to confirm, and close the row. He needs a hard refresh (Ctrl+Shift+R) at https://qualiacology.com/fetch/ — the browser is almost certainly still serving the round-eleven src/outside.js from cache. Route to the panel: graveyard -> finish the funeral -> west mausoleum hatch -> down the ossuary corridor -> arm the kennel cradle -> throw at the counterweight -> the exit slab sinks -> up flight A, turn, up flight B -> stand on the platform at the stair top (world -72.5, -0.95, 24.65) and look up. The key hangs at (-72.45, 0.25, 24.70) under one continuous stone plate.** — `ROUND-THIRTEEN.md`

_anchor:_
```js
| 1 | "texture above the key in the ostuary flashes in and out with a brick texrue" | round twelve fixed one ossuary z-fight (`515ebef`). Confirm whether that covers this panel or whether it is a second coplanar pair. He may simply have been playing the un-deployed build. |
```

_change:_
```js
| 1 | "texture above the key in the ostuary flashes in and out with a brick texrue" | **DONE — `515ebef` is the fix and it is live.** The panel he photographed was `hatch deck south`, a 0.9 x 0.46 m leftover nested whole inside the 5.9 x 2.0 m `hatch deck` with its underside on y = 1.30 bit-for-bit, at the key's exact x and 0.77 m in front of it. Both plates wore `wallMat`, so the fight showed as a TEXTURE swap: BoxGeometry UVs are 0..1 per face and M.stone repeats (2,1), so the small plate tiled 6.5x finer — his "brick". Source audit says there is no second coplanar pair above that key: between y = 0.8 and the cap there are exactly two surfaces, the deck underside at 1.30 and `shaftVoid` at 3.00, 1.70 m apart. Production `outside.js` was fetched back and diffed: identical to the repo modulo CRLF. **He was playing the un-deployed build — tell him to hard-refresh.** |
```

**3. 3a. (Recommended, optional) Pin it so it cannot come back silently. Make the legibility evaluate async and pull THREE in by absolute URL — the page already loaded that exact URL through its import map, so this resolves to the cached module record and costs nothing.** — `legibility-regression.mjs`

_anchor:_
```js
const result = await page.evaluate(() => {
  const F = window.__FETCH, g = window.__game;
```

_change:_
```js
const result = await page.evaluate(async () => {
  // Absolute URL, not the bare "three" specifier: the import map belongs to the
  // document, and this module is already loaded under exactly this URL, so the
  // dynamic import resolves to the cached module record and costs nothing.
  const THREE = await import('/vendor/three.module.min.js');
  const F = window.__FETCH, g = window.__game;
```

**4. 3b. Add the coplanar-plate census over the stair top. Insert between line 222 (`snap('ossuary-conduit');`) and line 224 (`return {...}`), where OX/OZ/FLOOR from line 212 are already in scope and g.ossuary.descend() has already run. Measures the CAUSE, not the symptom — a settled frame cannot see this bug, because a settled frame shows whichever plate happened to win.** — `legibility-regression.mjs`

_anchor:_
```js
  snap('ossuary-conduit');

  return { measured, shots, announce, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root };
```

_change:_
```js
  snap('ossuary-conduit');

  // ---- 3. the ceiling over the ossuary key --------------------------------
  // Alex, on the round-eleven build: "texture above the key in the ostuary
  // flashes in and out with a brick texrue." Two wallMat plates at the same
  // DECK_Y sharing a plane bit-for-bit -- a leftover that used to frame the
  // deleted hatch mouth, nested whole inside the plate that replaced it. It
  // read as BRICK because BoxGeometry UVs are 0..1 PER FACE, so a 0.9 m panel
  // wears the same stone map at 6.5x the tiling of the 5.9 m one: same
  // material, same draw call, different texels.
  //
  // No settled-frame measurement can see this, because a settled frame shows
  // whichever plate happened to win. So measure the CAUSE. Fire a grid of
  // upward rays through the deck: backface culling means a +y ray sees only
  // the BOTTOM of each plate, so it is one hit per plate, and two hits within
  // 2 mm is a duplicate and nothing else. Raycaster ignores .visible in r161,
  // so the district seal never has to be lifted for this.
  const shell = g.ossuary.root.children.filter(
    (o) => o.isMesh && o.name.startsWith('ossuary shell material'));
  g.ossuary.root.updateWorldMatrix(true, true);
  const deckRay = new THREE.Raycaster(
    new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0, 4.0);
  const DECK_UNDER = 0.5;              // (FLOOR + 5.6 - 0.1) - (FLOOR + 5.0)
  let deckRays = 0, deckCovered = 0, deckWorstGap = null, deckWorstAt = null;
  for (let x = OX - 2.9; x <= OX + 2.86; x += 0.3) {
    for (let z = OZ + 33.8; z <= OZ + 35.31; z += 0.3) {
      deckRay.ray.origin.set(x, FLOOR + 5.0, z);
      deckRay.ray.direction.set(0, 1, 0);
      const hits = deckRay.intersectObjects(shell, false);
      deckRays++;
      if (hits[0] && Math.abs(hits[0].distance - DECK_UNDER) < 0.01) deckCovered++;
      for (let i = 1; i < hits.length; i++) {
        const gap = hits[i].distance - hits[i - 1].distance;
        if (deckWorstGap === null || gap < deckWorstGap) {
          deckWorstGap = gap;
          deckWorstAt = [+x.toFixed(2), +z.toFixed(2)];
        }
      }
    }
  }
  const deck = {
    rays: deckRays, covered: deckCovered,
    worstGap: deckWorstGap === null ? null : +deckWorstGap.toFixed(4),
    at: deckWorstAt,
  };

  return { measured, shots, announce, deck, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root };
```

**5. 3c. Report and gate on it. Insert immediately after the existing conduit-in-routeRoot line (240), before the ANNOUNCE block. Expected on a healthy build: 120 rays, 120 covered, worstGap 1.7000 (the deck underside at 0.50 m and shaftVoid at 2.20 m). A reintroduced nested plate reports a gap of 0.0000.** — `legibility-regression.mjs`

_anchor:_
```js
console.log(`\n  ${result.conduitInRouteRoot ? 'PASS' : 'FAIL'}  the ossuary conduit lives inside routeRoot, where the seal cannot hide it`);
```

_change:_
```js
console.log(`\n  ${result.conduitInRouteRoot ? 'PASS' : 'FAIL'}  the ossuary conduit lives inside routeRoot, where the seal cannot hide it`);

// THE CEILING OVER THE KEY -- a coplanar-plate census, not a pixel measurement.
// Round twelve deleted 'hatch deck south', a 0.9 x 0.46 m leftover nested whole
// inside the 5.9 x 2.0 m 'hatch deck' with its underside on the same plane and
// wearing the same stone map at 6.5x the tiling. This is the pin that stops it
// coming back, and it fires for ANY coplanar duplicate over that stair top.
const deck = result.deck;
const deckSealed = deck.rays >= 100 && deck.covered === deck.rays;
const deckSingle = deck.worstGap === null || deck.worstGap > 0.002;
console.log('');
console.log(`  ${deckSealed ? 'PASS' : 'FAIL'}  the ossuary stair top has an unbroken ceiling (${deck.covered}/${deck.rays} rays meet it at 0.50 m)`);
console.log(`  ${deckSingle ? 'PASS' : 'FAIL'}  and it is ONE plate: `
  + (deck.worstGap === null
    ? 'a single crossing per ray'
    : `closest pair of surfaces ${deck.worstGap} m apart at x ${deck.at[0]} z ${deck.at[1]}`));
if (!deckSealed) failures.push(`the ossuary stair-top ceiling has a hole: only ${deck.covered} of ${deck.rays} rays met it`);
if (!deckSingle) failures.push(`the ceiling over the ossuary key is z-fighting: two surfaces ${deck.worstGap} m apart at x ${deck.at[0]} z ${deck.at[1]}`);
```

**6. 4. Leave the two 10 mm floor nosings alone. If a shimmer ever IS reported at the ossuary stair top underfoot, the one-line fix is to drop each last tread's top by 1 mm — but do not do it pre-emptively: the tread meshes are authored in the same loop that emits the tread COLLIDERS and the ramp records, and tests/grip-contact-regression.mjs and tests/playthrough.mjs both walk that flight. A 10 mm strip at 1.7 m eye height is sub-pixel.** — `outside.js`

_anchor:_
```js
    addMeshBox(wallMat, x1 - (bStep + 0.01) / 2, top - 0.06, (BF.z0 + BF.z1) / 2,
      bStep + 0.01, 0.12, BF.z1 - BF.z0, 'shaft tread');
```

_change:_
```js
UNCHANGED — leave verbatim. (For the record, if it is ever wanted: `top - 0.06` becomes `top - 0.061` on the final tread only, which drops that top face 1 mm clear of the platform's y = -0.95 while leaving the collider at `top` untouched. Not recommended now.)
```


### Cost

Runtime: zero. No src change, no new geometry, no new material, no draw call, no per-frame CPU. The merged 'ossuary shell' bucket count is unchanged. Test time: +120 raycasts against two merged meshes inside a gate that already boots a browser — well under a second, no extra renders, no extra screenshots. Implementation effort: steps 1/2/4 are a doc edit and a message to Alex, ~10 minutes. Step 3 is three mechanical edits to one test file, ~30 minutes including one run of `node tests/legibility-regression.mjs` to record the baseline (expect 120/120 rays covered, worstGap 1.7000).

### Risk

Steps 1, 2 and 4 are zero-risk: no src change, so no draw-call movement (graveyard stays at 327), no collider, ramp, footing or headroom change, and no gate can move. Step 3 touches only tests/legibility-regression.mjs. Its one structural risk is making the page.evaluate callback async — Playwright awaits a returned promise, so this is mechanical, but if `import('/vendor/three.module.min.js')` ever failed the whole gate would throw rather than fail a check; the server serves the repo root (serve.mjs ROOT = repo dir) and the page already loads that exact URL through its import map, so it resolves from cache. Second risk: the ray grid is hardcoded to the ossuary's literal coordinates, so if DECK_Y or the shaft footprint ever moves, the `covered` check fires as a false alarm — which is the correct failure direction (loud, not silent). The real risk in this item is the opposite one: shipping an invented "second bug" fix to a plate that is already correct, which would have split wallMat out of the merged bucket and cost a draw call in a district that is policed at 450.

### Open questions

- The one thing source cannot settle: whether the panel in his screenshot is truly this plate. He warned the titles may be mismatched to the pictures. The evidence is strong — the deleted plate sat at the key's exact x, 1.15 m above it, nested whole inside the plate that replaced it with a bit-for-bit shared underside, at 6.5x the tiling, and M.brick appears nowhere in outside.js so the 'brick' can only be high-tiled M.stone. If he still sees it after a hard refresh, the measurement that settles it is `node tools/shot-ossuary-hatches.mjs`: frames 06-the-stair-top-is-ceiling.png and 07-the-key-at-the-stair-top.png already pose the camera at exactly the angle in his screenshot. Do not run it until the gate battery finishes.
- Worth asking him directly: did he hard-refresh? The site is a static copy of src/*.js served from the same URLs, so a warm browser cache will keep serving the round-eleven outside.js indefinitely. That single question probably closes this item.
- Disclosure, since the brief said touch nothing: the worktree is untouched and `git status --porcelain` is empty. To prove production matches I ran curl and wrote two files OUTSIDE the repo, in the Git-Bash temp dir — /tmp/live-outside.js and /tmp/repo-lf.js. Nothing under C:/Users/Alex/Projects/fetch-aug22-round12 was created, edited or deleted, and no browser was launched. Delete those two if you want the machine clean.
- Unrelated but noticed while auditing the shaft: the comment at src/outside.js:2551-2554 still says the stair top gives '1.9 m of headroom', but after DECK_Y was raised to FLOOR + 5.6 the real clearance from the platform top (y = -0.95) to the deck underside (y = 1.30) is 2.25 m. The comment is stale, not the geometry. Not worth a commit on its own.


---

<a id="walls"></a>

## walls

**Round twelve's rebuild fixed the average-vs-local width bug but not the reports: the flank pieces are still placed against their OWN leg (inner face at w+0.15) while the clamp lets the camera stand at w−0.04, leaving a 0.19 m gap against a 0.2 m near plane — so on every walled leg in the district, pressing into a wall clips it away and you see through it; at the lower-sluice corner it is 0.12 m, at the foot of the service climb 0.05 m, and the overflow-gallery sluice gate stands 1.93 m INSIDE the walkable floor across the only way out.

All coordinates below are OFFSETS FROM game.clearingCenter (the layout is built as center + local), matching MAIN_LOCAL/SECRET_LOCAL in src/underfalls.js.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **Step 4 says "Replaces lines 1046-1058" but its anchor text ends at line 1054. Lines 1055-1057 are the toothMatrices.push and line 1058 is the closing brace of `for (let localIndex = 0; localIndex < climb.length; localIndex++)`. An applier who trusts the stated range deletes the tooth bar AND the loop's closing brace, and src/underfalls.js no longer parses. This is precisely the failure mode the brief warns about.**
  - _fix:_ Change the range to "Replaces lines 1046-1054". Do not touch 1055-1058. State explicitly that toothMatrices.push at 1055-1057 and the `}` at 1058 remain.

- **Steps 2 and 4 seat the flank wall and the gate post against the SAME pad (0.42), so the posts end up inside the wall slab and stop being visible. I recomputed the sluice-rise node (40,69): main#7 and main#8 differ in heading by ~1.9 deg, so it is effectively a straight run. main#8's i=0 piece seats at push 0.30, putting its inner face at union clearance ~0.45; the plan's own required gate half of 3.06 puts the post's inner face at clearance 0.445. The post is 0.23 deep, the slab 0.54 thick, so the post is entirely inside the slab. Same at the upper sluice. This converts a legibility fix into a new working-but-illegible defect on 2 of the 3 surviving gates: the sluice climb loses its vertical iron read and keeps only a lintel and tooth bar with nothing under them.**
  - _fix:_ Two pads, not one. In step 1 also export `export const UNDERFALLS_WALL_PAD = UNDERFALLS_SOLID_PAD + 0.30;` with the comment "the flank wall stands one post-depth clear of the pad so the sluice gate's iron reads AGAINST stone, not inside it." In step 2, test `if (worst >= UNDERFALLS_WALL_PAD)` instead of UNDERFALLS_SOLID_PAD, and raise UNDERFALLS_WALL_MAX_PUSH to 1.55 so the same pieces can still seat. In step 6, compare `gap < 0.42 - 1e-3` still (the pad is the floor for everything drawn), but note in the check's details that walls are held to 0.72. Alternative if the extra 0.30 m of corridor width is unacceptable: keep one pad and instead skip flank pieces whose centre is within 0.6 m of a gate node along the leg tangent, so the post IS the wall locally. Re-measure the numbers in step 4's prose either way — they were derived against the 0.42 pad.

- **Step 2 opens an unfloored, unlit slot between the drawn floor and the new wall base, and the plan never mentions it. The route floor is `world.box(M.rock, x, y - 0.11, z, w * 2.0, 0.22, …)` at src/underfalls.js:510 — half-width exactly the LOCAL w. Today the wall's inner face is at w+0.15, so the slot is 0.15 m. After step 2 the minimum push is 0.30 (the inner sample sits 0.27 inboard of the box centre, so `worst >= 0.42` needs push >= 0.27, and the loop steps 0.05), which makes the slot 0.45 m, and up to 1.53 m at max push. Below the floor slab's 0.22 m side face there is nothing at all — the player standing at clearance -0.04 looks down past the floor edge into open void that renders as the 0x03050c background. On the district whose report is literally "the rest black", this widens the black by 3x to 10x at the shoulder of every walled leg.**
  - _fix:_ Bridge it in the same hunk — it is free, everything merges into the one M.rock shell. Capture the seating push (`let seatPush = 0;` outside the loop, `seatPush = push;` immediately before `seated = true; break;`), then after the wall box emit: `const skirt = 0.15 + seatPush;  world.box(M.rock, px + side * nx * (pw + skirt * 0.5), py - 0.11, pz + side * nz * (pw + skirt * 0.5), skirt + 0.06, 0.22, depth, yaw);`  That is +85 to +187 unsegmented boxes (~24 verts each, ~4.5k total), zero new draw calls, zero per-frame cost. Verify it does not fight the chamber discs where a leg's skirt overruns a chamber rim.


### Execute THIS (the challenged, corrected plan)

The diagnosis is right and unusually well grounded — this is the rare plan whose measurements survive re-derivation. I recomputed the leg census (exactly 5 walled legs: main#0, #6, #7, #8, secret#4; 12 skipped), the 118 candidate pieces, three quoted box coordinates to three decimals, all three roof-gap slots (0.43 / 0.44 / 0.065), the four gate clearances including the overflow gallery's -1.930 / -2.045, and the collider inventory — every one matched. The 0.19 m headline is stronger than the plan claims: it is provable from the intrusion threshold, since `clearance < 0` admits an inner face anywhere in [0, 0.15] and the clamp's `<= -0.04` early return makes clearance -0.04 a stable pose, so every drawn flank piece is 0.04-0.19 m from a reachable camera against a 0.2 m near plane. Nothing here breaks a law: no on-screen text or HUD, no hue-only meaning, the throw grammar and FEEL_PROFILE are untouched, no light is added or removed, no material-identity comparison against a finishStatic clone is introduced, nothing runs in a per-frame ticker, and no non-terminal state is created. Draw calls really are unchanged — finishStatic makes exactly one mesh per material with no spatial chunking, and it disposes the source geometries, so smoke's geometries < 1500 is unaffected too; the cave holds at 137/450. playthrough.mjs walks the route by node and nothing in this district is a collider, so it is untouched, and district-culling-regression only asserts < 450 draw calls plus the six named atmosphere batches, all of which survive.

Apply it with four corrections. FIRST, step 4 replaces lines 1046-1054, NOT 1046-1058 — the stated range eats the tooth push and the loop's closing brace and the file stops parsing. SECOND, do not seat the flank wall and the gate post against the same 0.42 pad: at the near-straight sluice-rise and upper-sluice nodes both land at clearance ~0.445 and the 0.23 m post ends up entirely inside the 0.54 m slab, so the gates go invisible. Export a second constant UNDERFALLS_WALL_PAD = UNDERFALLS_SOLID_PAD + 0.30, use it in step 2's seat test, and raise UNDERFALLS_WALL_MAX_PUSH to 1.55. THIRD, bridge the shoulder: the floor box at line 510 is exactly 2w wide, so pushing the wall out opens an unfloored, unlit slot of 0.45 m (up to 1.53 m) where today it is 0.15 m — on the district whose note is "the rest black", that is a regression. Capture the seating push and emit a 0.22 m skirt box from the floor edge to the wall face in the same hunk; it is free. FOURTH, rewrite steps 3 and 5 as real hunks rather than prose inside comments (as written, step 5 changes nothing at line 1617 and step 3 leaves a dead declaration), fix step 6's probe so the bob is added after the U.contains filter rather than before it (as written it silently drops both probes on every leg with nx > 0, including main#6), and push the gate posts into layout.solids so Defect 2 gets a pin too. Also simplify step 2's height to `const height = (avgY + 5.09) - bottom;` — dropping the Math.max(5.15, …) still covers the roof underside everywhere and guarantees no wall fin ever stands proud of the overburden on a descending leg, which step 3 would otherwise newly expose on main#10 and main#11. Treat steps 3 and 3b as one inseparable commit, and correct the prose errors that do not change the code: the overflow gallery posts flank the exit line rather than blocking it, the ceiling teeth reach 0.10 m into the lane not 1 m and bottom out at 3.5 m not 2.79 m, the boulder skin is 0.39 m from a reachable camera not 0.31 m (so step 5 is optional consistency, not a fix), and the build cost is tens of milliseconds not single digits.

### Findings

- **DEFECT 1 (his notes 4/5/6, the primary one). The flank pieces are offset from their OWN segment centre line by pw+0.42; the box is 0.54 thick, so its inner face sits at pw+0.15. The clamp (installClamp) declines to act until clearance > -0.04 and then snaps to w-0.08, so a walking camera stably reaches w-0.04. Gap = 0.19 m. The camera's near plane is 0.2 (main.js:365, PerspectiveCamera(71, aspect, 0.2, 260)). Facing the wall head-on puts the whole face at camera-space depth < near, so the entire slab is clipped and you look straight through it. I replayed the builder's own arithmetic over the real MAIN_LOCAL/SECRET_LOCAL tables: 118 pieces are generated, 37 dropped, 81 drawn, and ALL 81 are reachable to within 0.19 m or less. Worst three: secret#4 i=0 box@(38.03, 2.44, 73.26) reachable from (37.48, 73.41) = 0.051 m; main#6 i=13 box@(38.20, 0.00, 60.94) from (37.79, 61.47) = 0.124 m; main#8 i=12 box@(48.24, 3.14, 76.01) from (48.21, 76.65) = 0.127 m. The head bob adds a further ±0.02 m of world-X camera offset that the clamp never sees (player.js _sync), so the true worst is 0.031 m. The 9-point footprint test itself is sound — it samples the 4 corners, 4 edge midpoints and centre of the footprint, and a convex region overlapping a rectangle must contain a corner unless its boundary curvature exceeds ~9 mm of sagitta over the 0.49 m sample spacing, which no 2.9 m-wide corridor or 3.45 m-radius chamber can manage. It is not the test that is wrong; it is the THRESHOLD (clearance < 0, i.e. zero pad) and the fact that the offset is computed against one leg instead of the union.**
  - `underfalls.js:566`
  - evidence: const cx = px + side * nx * (pw + 0.42);         const cz = pz + side * nz * (pw + 0.42);         // nine points over the piece's own footprint, in its own frame         let intrudes = false;         ...             if (hit && hit.clearance < 0) intrudes = true;         ...         if (intrudes) continue;         world.box(M.rock, cx, py + 2.35, cz, 0.54, 5.15, depth, yaw);  // vs installClamp, src/underfalls.js:1340-1341:     if (!p || p.clearance <= -0.04) return;     const safeW = Math.max(0.35, p.w - 0.08);

- **They are VISUALS ONLY, confirmed. world.box pushes geometry into this._geo for the merged static shell and never calls addCollider; finishStatic merges under mat.clone(). The only colliders the whole district registers are the pump-chapel pillars (0.54 r), the pump altar (1.28 r) and three hatch-cistern boxes. So player._moveAxis never sees a flank wall, STEP_UP/HEAD never apply to one, and containment is entirely the lateral clamp — which slides you along instead of stopping you. That is why 'you can walk right through it' is literally true and not a figure of speech. Do NOT fix this by adding colliders: main#7's yaw is 35.5 degrees, so the AABB of a 0.54 x 0.95 rotated box is 0.99 m across — 0.22 m fatter into the lane than the true face — which is exactly the diagonal-wall-box forest trap the file's own comment warns about.**
  - `world.js:77`
  - evidence: box(mat, x, y, z, w, h, d, ry = 0) {     const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));     if (ry) g.rotateY(ry);     g.translate(x, y, z);     if (!this._geo.has(mat)) this._geo.set(mat, []);     this._geo.get(mat).push(g);   }   // <- no addCollider anywhere in this path

- **DEFECT 2 (his note 5, 'forced to walk through to get there' — this is the one that is literally forced). The sluice gate posts are offset by p.w + 0.12 from the NODE's own w, but the walkable lane at a node is the UNION's width there. At the overflow gallery the union is the 4.80 m chamber disc while p.w is 2.75, so BOTH posts stand at union clearance -1.930 (inner faces -2.045): two full-height 3.85 m iron posts standing nearly two metres inside the walkable floor, straight across the only line from the gallery to the spill descent. You cannot get out of the overflow gallery without walking through iron. Measured union clearance of each post's inner face: lower sluice side- +0.005, side+ -0.210 (post CENTRE at -0.104, i.e. the post is inside the lane); sluice rise -0.004/+0.005; upper sluice +0.005/-0.009; overflow gallery -2.045/-2.045. Even the +0.005 cases put the post face 0.045 m from a reachable camera — a quarter of the near plane. Required union-aware offsets (post face clearing 0.42): lower sluice 3.53 (now 2.77), sluice rise 3.06 (now 2.62), upper sluice 3.13 (now 2.67), overflow gallery 5.35 (now 2.87).**
  - `underfalls.js:1050`
  - evidence:       // posts stood at w-0.455 to their inner face — inside the clamp, so       // the player brushed through iron. They frame the lane now, not block it.       postMatrices.push(gateMatrix.clone().multiply(transformMatrix(         side * (p.w + 0.12), 1.9, 0, 0, 0, 0, 0.23, 3.85, 0.28)));

- **DEFECT 3 (his note 4, 'the rest black'). opensIntoChamber is tested on the leg's ENDPOINTS, so one endpoint touching a chamber kills the flank backing for the whole leg. 12 of the district's 17 legs get NO structural side wall at all: main#1,2,3,4,5,9,10,11 and secret#0,1,2,3. Only main#0, main#6, main#7, main#8 and secret#4 are walled. Worse, within the walled legs whole stretches are dropped, and they are asymmetric — main#8 (sluice rise -> upper sluice, the second flight of the climb) draws all 13 pieces on side+ and only the first 4 on side-, so you climb that flight with a wall on one hand and nothing on the other. main#6 draws nothing on side- for i=0..11; secret#4 draws nothing on side+ for i=2..10. Meanwhile the atmosphere pass dresses PER SAMPLE, not per leg (atmosphere.js:1652 tests inChamber at each centre-line point), so the visible low-poly skin and the structural backing disagree about where a wall exists. Switching the structural test to the same per-sample rule yields 187 drawn pieces instead of 81 with the min camera gap still 0.457 m.**
  - `underfalls.js:512`
  - evidence:     const opensIntoChamber = layout.chambers.some((chamber) =>       Math.hypot(seg.a.x - chamber.x, seg.a.z - chamber.z) < chamber.r * 0.94       || Math.hypot(seg.b.x - chamber.x, seg.b.z - chamber.z) < chamber.r * 0.94); ...     if (opensIntoChamber) continue;  // vs src/atmosphere.js:1652 (per sample, not per leg):       const inChamber = layout?.chambers?.some((chamber) =>         Math.hypot(x - chamber.x, z - chamber.z) < chamber.r * 0.94);

- **DEFECT 4 (contributes to 'the rest black'). The overburden roof is ONE flat slab per leg at avgY + 4.86 (0.46 thick, underside avgY + 4.63), while the wall pieces staircase with their own py (top py + 4.925). On a climbing leg the wall top falls BELOW the roof underside at the low end: main#7 (lower sluice -> sluice rise, y 0 -> 1.6) leaves a 0.43 m open slot; main#8 (sluice rise -> upper sluice, y 1.6 -> 3.2) leaves 0.44 m; secret#4 leaves 0.065 m. Since installCaveVisibility hides everything untagged, the slot reads as a black band running the length of both flights of the sluice climb, right where he photographed a stairwell whose upper half is black.**
  - `underfalls.js:521`
  - evidence:     world.box(M.rock,       (seg.a.x + seg.b.x) * 0.5, avgY + 4.86,       (seg.a.z + seg.b.z) * 0.5,       avgW * 2 + 1.25, 0.46, seg.length + 1.4, yaw);  // vs the per-piece wall, line 579:         world.box(M.rock, cx, py + 2.35, cz, 0.54, 5.15, depth, yaw);

- **WHAT SCREENSHOT 6 IS. The 'large smooth pinkish-tan surface filling the left half of frame, cave and white path visible past its right edge' is one of these flank-wall boxes at point-blank, not a chamber shell and not the broken-wall skin. Three things pin it: (a) it is the only flat, untextured-looking surface that can get within 0.2 m of the camera — the atmosphere skin is a faceted DodecahedronGeometry cleared to half+0.35 and the chamber caps/roofs are all above 4.6 m; (b) M.rock's map is T(256,256,...,2,2) — repeat 2,2 over a BoxGeometry face whose UVs are 0..1, so a 5.15 m tall face shows 2 tiles = 2.6 m per tile, and at 0.19 m from the camera with FOV 71 you see 0.33 m of it, about an eighth of one tile: a single smooth wash with no readable texture; (c) 'white path visible past its right edge' is the wet-stone ribbon (0xbcc8ca) which runs the MAIN route only, and the three walled main legs (main#6, #7, #8) all carry it. The pinkish-tan cast is the one part I cannot confirm from source — see open questions.**
  - `textures.js:1241`
  - evidence: M.rock = std({ ...bump(T(256, 256, 25, rockPaint, 2, 2), 0.26), roughness: 0.6, metalness: 0.05 }); // rockPaint base: g.fillStyle = rgb(60, 58, 60) — neutral, with '#c2c8cc' mineral speckle

- **MINOR / CONSISTENCY. The atmosphere skin clears the union by half + 0.35, so a boulder's surface can sit 0.31 m from a reachable camera and 0.03 m inside the player's own 0.34 m body radius. It is above the 0.2 near plane so it does not vanish, but it is a second, different number for the same law. Unify it on the same constant as the walls.**
  - `atmosphere.js:1617`
  - evidence:   const clearOfRoute = (x, z, half) => {     if (!layout) return { x, z };     const margin = half + 0.35;


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. Publish the one number the whole district has to obey. Insert immediately ABOVE the existing UNDERFALLS_METRICS export (line 55). Everything else in this plan references it.** — `underfalls.js`

_anchor:_
```js
export const UNDERFALLS_METRICS = Object.freeze({
```

_change:_
```js
// THE ONE PAD. No drawn surface in this district may stand closer than this
// to any pose the clamp will accept. It is the player's own radius (RADIUS
// 0.34, player.js) plus the clamp's 0.08 dead band. Below it the player's
// body is inside the rock; below 0.24 (the camera's near plane of 0.2 at
// main.js:365, plus the clamp's -0.04 slack) the surface is CLIPPED AWAY and
// you look straight through the wall, which is what he photographed.
export const UNDERFALLS_SOLID_PAD = 0.42;
// How far a flank piece may be pushed outward to find that pad before it is
// dropped instead. Beyond this the enclosure genuinely belongs to another
// region and shoving the flank out would read as a hole.
export const UNDERFALLS_WALL_MAX_PUSH = 1.25;

export const UNDERFALLS_METRICS = Object.freeze({
```

**2. 2. DEFECT 1 + DEFECT 4. Replace the flank piece placement so the offset is found against the UNION with the pad, and so the piece always grows to meet the roof. Replaces lines 566-579 in addFloorAndShell. avgY is already in scope (line 515). Measured result: 85 pieces drawn (was 81), 33 dropped (was 37), minimum camera-to-drawn-wall distance across the whole district 0.462 m (was 0.051 m). Draw calls unchanged — it is all one merged M.rock shell.** — `underfalls.js`

_anchor:_
```js
        const cx = px + side * nx * (pw + 0.42);
        const cz = pz + side * nz * (pw + 0.42);
        // nine points over the piece's own footprint, in its own frame
        let intrudes = false;
        for (let a = -1; a <= 1 && !intrudes; a++) {
          for (let b = -1; b <= 1 && !intrudes; b++) {
            const ox = side * nx * (a * 0.27) + tx * (b * depth * 0.5);
            const oz = side * nz * (a * 0.27) + tz * (b * depth * 0.5);
            const hit = projectUnderfalls(layout, cx + ox, cz + oz);
            if (hit && hit.clearance < 0) intrudes = true;
          }
        }
        if (intrudes) continue;
        world.box(M.rock, cx, py + 2.35, cz, 0.54, 5.15, depth, yaw);
```

_change:_
```js
        // ROUND TWELVE PUT THESE AT THE LOCAL WIDTH. THAT WAS HALF THE FIX.
        //
        // A piece at pw + 0.42 has its inner FACE at pw + 0.15, and the clamp
        // stably permits a camera at pw - 0.04 (installClamp declines to act
        // until clearance > -0.04, then snaps to w - 0.08). 0.19 m — and the
        // camera's near plane is 0.2 (main.js:365). So on EVERY walled leg in
        // the district, leaning into the wall clips the whole face away and
        // you look through it: "some of these walls you can walk right
        // through". At junctions the union is wider than this one leg and it
        // is worse: 0.124 m at the lower-sluice corner, 0.051 m at the foot of
        // the service climb. Nothing here is a collider, so nothing stops you.
        //
        // The offset is therefore found against the UNION, not against this
        // leg: push outward until the whole footprint clears the pad, and drop
        // the piece only if that would take it further than the max push — at
        // those places another region's lane is genuinely there and already
        // owns the enclosure.
        let cx = 0, cz = 0, seated = false;
        for (let push = 0; push <= UNDERFALLS_WALL_MAX_PUSH + 1e-9; push += 0.05) {
          cx = px + side * nx * (pw + 0.42 + push);
          cz = pz + side * nz * (pw + 0.42 + push);
          // nine points over the piece's own footprint, in its own frame
          let worst = Infinity;
          for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
              const ox = side * nx * (a * 0.27) + tx * (b * depth * 0.5);
              const oz = side * nz * (a * 0.27) + tz * (b * depth * 0.5);
              const hit = projectUnderfalls(layout, cx + ox, cz + oz);
              if (hit && hit.clearance < worst) worst = hit.clearance;
            }
          }
          if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
        }
        if (!seated) continue;
        // AND IT REACHES THE ROOF. The overburden above is ONE flat slab per
        // leg at avgY + 4.86 while these pieces staircase with py, so on a
        // rising leg the wall top (py + 4.925) fell below the roof underside
        // (avgY + 4.63): a 0.43 m open slot up the first flight of the sluice
        // climb and 0.44 m up the second, black all the way.
        const bottom = py - 0.225;
        const height = Math.max(5.15, (avgY + 5.09) - bottom);
        world.box(M.rock, cx, bottom + height * 0.5, cz, 0.54, height, depth, yaw);
        (layout.solids || (layout.solids = [])).p
```

**3. 3. DEFECT 3. Make the chamber exclusion per-piece instead of per-leg, so the structural backing uses the SAME rule the atmosphere skin already uses (atmosphere.js:1652). Delete the leg-level test and its skip; add the per-sample test inside the piece loop. Note opensIntoChamber has exactly two occurrences (512 and 530) and avgY/avgW at 515-516 must stay — they feed the roof at 521. Measured result with steps 2+3 together: 187 pieces drawn, min camera gap 0.457 m.** — `underfalls.js`

_anchor:_
```js
    // Chambers own their perimeter. Carrying corridor side-wall boxes through
    // them partitions the landmark into black slabs and makes a broad room
    // look like several accidental closets. The floor remains continuous;
    // the chamber's outer rock ring and cap provide the actual enclosure.
    if (opensIntoChamber) continue;
```

_change:_
```js
    // Chambers own their perimeter. Carrying corridor side-wall boxes through
    // them partitions the landmark into black slabs and makes a broad room
    // look like several accidental closets. The floor remains continuous;
    // the chamber's outer rock ring and cap provide the actual enclosure.
    //
    // BUT THAT IS A TEST ON THE PIECE, NOT ON THE LEG. It used to be checked
    // against the leg's two ENDPOINTS, so one endpoint brushing a chamber
    // deleted the backing for the whole leg — twelve of seventeen legs had no
    // structural side wall at all, including the entire spill descent and the
    // entire culvert, while the atmosphere pass went on dressing them per
    // sample (atmosphere.js:1652). The two layers disagreed about where a
    // wall existed. They agree now; the per-piece test lives in the loop below.

    // (also DELETE lines 512-514, the `const opensIntoChamber = ...` block:
    //  it now has no readers.)
```

**4. 3b. DEFECT 3, second half. Add the per-sample chamber skip at the top of the flank piece loop, immediately after `const depth = seg.length / n + 0.08;` and before `for (const side of [1, -1]) {`.** — `underfalls.js`

_anchor:_
```js
      const depth = seg.length / n + 0.08;
      for (const side of [1, -1]) {
```

_change:_
```js
      const depth = seg.length / n + 0.08;
      // the atmosphere skin's own rule, verbatim (atmosphere.js:1652)
      if (layout.chambers.some((chamber) =>
        Math.hypot(px - chamber.x, pz - chamber.z) < chamber.r * 0.94)) continue;
      for (const side of [1, -1]) {
```

**5. 4. DEFECT 2. Make the sluice gate union-aware, and skip it entirely at a node the union has swallowed. Replaces lines 1046-1058 in buildSluice (projectUnderfalls and layout are both already in scope). Result: gates at lower sluice (half 3.53), sluice rise (3.06) and upper sluice (3.13); the overflow-gallery gate, whose posts stood 1.93 m inside the walkable disc, is gone — that node IS a chamber and a flood gate across a room is the bell's mistake one district over. The tooth bar stays keyed to p.w because it hangs over the walking line by design at y >= 2.15, above HEAD 1.75.** — `underfalls.js`

_anchor:_
```js
    const gateMatrix = transformMatrix(p.x, p.y, p.z, 0, yaw, 0);
    for (const side of [-1, 1]) {
      // posts stood at w-0.455 to their inner face — inside the clamp, so
      // the player brushed through iron. They frame the lane now, not block it.
      postMatrices.push(gateMatrix.clone().multiply(transformMatrix(
        side * (p.w + 0.12), 1.9, 0, 0, 0, 0, 0.23, 3.85, 0.28)));
    }
    topMatrices.push(gateMatrix.clone().multiply(transformMatrix(
      0, 3.72, 0, 0, 0, 0, p.w * 2.1, 0.25, 0.36)));
```

_change:_
```js
    const gateMatrix = transformMatrix(p.x, p.y, p.z, 0, yaw, 0);
    // THE GATE HAS TO STAND OUTSIDE THE LANE IT FRAMES, AND THE LANE AT A NODE
    // IS THE UNION'S WIDTH THERE, NOT THIS NODE'S OWN w. At the overflow
    // gallery the union is the 4.80 m chamber disc while p.w is 2.75, so both
    // posts stood at clearance -1.930 — two full-height iron posts nearly two
    // metres inside the walkable floor, straight across the only way out of
    // the gallery. "some of these walls you basically are forced to walk
    // through to get there." At the other three nodes the post face cleared
    // the lane by 0.005 m, inside the camera's near plane, so brushing one
    // deleted it.
    const ax = Math.cos(yaw), az = -Math.sin(yaw);   // gateMatrix's local +X
    const bx = Math.sin(yaw), bz = Math.cos(yaw);    // and its local +Z
    let half = p.w + 0.12;
    let seated = false;
    for (; half <= p.w + 1.0 + 1e-9; half += 0.02) {
      let worst = Infinity;
      for (const side of [-1, 1]) {
        for (const u of [-0.115, 0.115]) {
          for (const v of [-0.14, 0.14]) {
            const hit = projectUnderfalls(layout,
              p.x + ax * side * (half + u) + bx * v,
              p.z + az * side * (half + u) + bz * v);
            if (hit && hit.clearance < worst) worst = hit.clearance;
          }
        }
      }
      if (worst >= UNDERFALLS_SOLID_PAD) { seated = true; break; }
    }
    // A gate that has to be that wide is not a gate: the union has swallowed
    // the node. Its lintel would hang unattached across a room.
    if (!seated) continue;
    for (const side of [-1, 1]) {
      postMatrices.push(gateMatrix.clone().multiply(transformMatrix(
        side * half, 1.9, 0, 0, 0, 0, 0.23, 3.85, 0.28)));
    }
    topMatrices.push(gateMatrix.clone().multiply(transformMatrix(
      0, 3.72, 0, 0, 0, 0, half * 2 + 0.34, 0.25, 0.36)));
```

**6. 5. MINOR. One law, one number: give the atmosphere skin the same pad. Two edits in atmosphere.js — the import at line 11 and the margin at line 1617.** — `atmosphere.js`

_anchor:_
```js
import { projectUnderfalls } from './underfalls.js';
```

_change:_
```js
import { projectUnderfalls, UNDERFALLS_SOLID_PAD } from './underfalls.js';

// (and at line 1617, inside clearOfRoute:)
//   const margin = half + 0.35;
// becomes
//   const margin = half + UNDERFALLS_SOLID_PAD;
// 0.35 left a boulder's surface 0.31 m from a reachable camera and 0.03 m
// inside the player's own body radius. Instance counts shift slightly; draw
// calls do not (still four InstancedMeshes).
```

**7. 6. PIN IT. Add a check to tests/underfalls-expansion.mjs, inside the existing page.evaluate block, next to the 'district clamp returns large lateral escapes' check (~line 152). It needs no rendering — it is pure geometry against the same layout the clamp uses, and it reads layout.solids, which step 2 now populates. Without this the next round re-introduces it, exactly as rounds 1-11 did.** — `underfalls-expansion.mjs`

_anchor:_
```js
    check(
      'district clamp returns large lateral escapes to authored floor without moving the player vertically',
      clampFailures.length === 0,
      { probes: Math.ceil(mainSamples.length / 17), failures: clampFailures.slice(0, 8) },
    );
```

_change:_
```js
    check(
      'district clamp returns large lateral escapes to authored floor without moving the player vertically',
      clampFailures.length === 0,
      { probes: Math.ceil(mainSamples.length / 17), failures: clampFailures.slice(0, 8) },
    );

    // LEGIBILITY, NOT FUNCTION: not "is there a wall" but "can the player
    // stand inside it, or close enough that the near plane deletes it". The
    // camera near plane is 0.2 (main.js); the clamp permits a stable pose at
    // clearance -0.04 and the head bob adds 0.02 of world X on top. A drawn
    // face nearer than SOLID_PAD is a wall you walk through.
    const NEAR = 0.2;
    const solids = L.solids || [];
    const wallFailures = [];
    for (const s of [...mainSamples, ...secretSamples]) {
      for (const lateral of [-1, 1]) {
        // the outermost pose the clamp will hold, plus the bob
        const px = s.x + s.nx * lateral * (s.w - 0.04) + lateral * 0.02;
        const pz = s.z + s.nz * lateral * (s.w - 0.04);
        if (!U.contains(px, pz, -0.039)) continue;
        for (const q of solids) {
          const dx = px - q.x, dz = pz - q.z;
          const u = Math.abs(dx * q.nx + dz * q.nz) - q.halfN;
          const v = Math.abs(dx * q.tx + dz * q.tz) - q.halfT;
          const gap = Math.hypot(Math.max(0, u), Math.max(0, v));
          if (gap < 0.42 - 1e-3) {
            wallFailures.push({ at: [round(px), round(pz)], gap: round(gap), clipped: gap < NEAR });
            break;
          }
        }
      }
      if (wallFailures.length >= 8) break;
    }
    check(
      'no pose the clamp accepts stands inside a drawn cave wall, or near enough for the near plane to delete it',
      solids.length > 0 && wallFailures.length === 0,
      { solids: solids.length, near: NEAR, pad: 0.42, failures: wallFailures.slice(0, 8) },
    );
```


### Cost

Draw calls: ZERO change. Every M.rock box in step 2/3 merges into the one static shell that finishStatic already builds, and the gate posts stay one InstancedMesh. Cave stays at 137 of 450. Vertices: AO_SEG is 0.85, so a 0.54 x 5.15 x 0.95 wall box segments to 1 x 6 x 1 = 64 vertices. Step 2 alone is +4 boxes (~256 verts); steps 2+3 together are +106 boxes (~6.8k verts) in a mesh that already carries the district. Per-frame CPU: zero — all of this is build-time. Build-time: the push loop costs at most 26 iterations x 9 projectUnderfalls calls per piece; at 236 candidate pieces that is ~55k projections, each scanning 16 segments + 5 chambers, so ~1.2M float ops — single-digit milliseconds, but worth measuring against the boot budget given round ten fought a 9017 ms loading hitch down to 87 ms. Implementation effort: ~90 lines across src/underfalls.js (3 hunks), 2 lines in src/atmosphere.js, ~35 lines of new gate. Half a session.

### Risk

Medium, and it is a LOOK risk, not a crash risk. (1) The flanks move outward 0.30-1.25 m, so every walled corridor reads perceptibly wider at the shoulder; the atmosphere skin already sits at halfW + 0.92..1.28, so the backing stops interpenetrating the skin, which should read better but is a visible change he will notice. (2) Step 3 adds backing to twelve legs that currently have none — the chapel approach, the spill descent, the whole hatch run and the culvert change silhouette. If that reads as too enclosed, ship steps 1, 2, 4, 5 and 6 alone: they close all three of his reports on their own (min camera gap 0.462 m) and step 3 is a separate, revertable commit. (3) Dropping the overflow-gallery gate removes one beat of the climb's four-gate rhythm; that is an authorial call and reversible by raising the p.w + 1.0 skip threshold, though anything above ~2.5 puts iron back in the walkable disc. (4) Do NOT be tempted to make the walls colliders instead — measured, a rotated 0.54 x 0.95 box on main#7's 35.5-degree yaw has a 0.99 m AABB, 0.22 m fatter into the lane than its true face, which is the forest trap bug the file already warns about. Re-run all four gates plus district-culling (cave must hold at 137/450 — it will, everything here merges into the existing shell or the existing InstancedMeshes), legibility-regression, and smoke for the screenshots. Nothing in the feel core, the throw grammar, the HUD, the hue law or the quiet/loud economy is touched.

### Open questions

- The 'pinkish-tan' in screenshot 6 is the one thing I cannot settle from source. M.rock's paint base is a neutral rgb(60,58,60); the only warm emitters in the district are the candle pool (0xff9540, range 9) and the bell-cistern light (0xd7a468, range 12), and neither reaches the three walled main legs — the sluice lights there are all cool (0x8aa9b1 / 0x9fbec4 / 0xd6eef0). Either the tone-mapped near-black rock reads warm on his display, or the surface he photographed is not the one I think. SETTLE IT BY: F.teleport('cave'), set the pose to the measured coordinates (clearingCenter + (37.79, 61.47) facing +x, and + (48.21, 76.65)), step once, then read canvas.toDataURL and sample the left-half pixels — page.screenshot composites the WebGL canvas black headless, so it must be toDataURL.
- Which stairwell screenshots 4 and 5 actually are. main#7/#8 (the sluice climb) fits everything except 'warm light right' — it has treads, the wet ribbon as 'pale steps', water runnel planes either side as the 'mist/waterfall wall', and it is the one stretch where a wall exists on one hand and nothing on the other (main#8 draws 13/13 on side+ and 4/13 on side-). SETTLE IT BY: dumping the live light census with positions and colours within 12 m of clearingCenter + (43, 73).
- main#8's lane and secret#4's lane OVERLAP. Their centre lines are 3.354 m apart at the midpoints while their half-widths sum to 4.14, and they share the node at (46, 78). So the 'secret' service climb and the public sluice climb are the same walkable space for their last several metres — which is why the walls between them are dropped and why the shortcut may not read as a shortcut. Their floors also differ by up to 0.8 m across that overlap, and underfallsGroundAt resolves it by NEAREST CENTRE LINE (d, not clearance), so a lateral step across the overlap can move the ground ~0.8 m and installClamp's reconciliation then snaps a grounded player's y hard. Whether that produces a felt jolt needs a walk probe along clearingCenter + (41,74) to (44,77); I could not measure it without running the game.
- Whether the 0.42 pad should also apply to the ceiling teeth in atmosphere.js:1784, which are placed at halfW + 0.18 with instance scales up to 1.15 — their inward reach is ~halfW - 0.97, roughly a metre inside the lane. They hang at floorY + 4.24 with heights 0.55-1.45, so their lowest point is ~2.79 above the floor and clear of HEAD (1.75) — overhead by design, like the gate teeth. I left them alone deliberately, but if he later reports 'walking through rocks' while looking up, that is where to look.
- Whether to keep four sluice gates or three. Step 4 drops the overflow-gallery one because the node is a chamber. If the four-beat rhythm of the climb matters more, the alternative is to move that gate off the node and down the corridor to where the union is still 2.75 wide — roughly clearingCenter + (51.5, 83.5) — rather than widening it.


---

<a id="water"></a>

## water

**All four effects fit in +3 cave draw calls and ~zero per-frame CPU, because three of them can be entirely GPU-driven off static buffers — but two source facts must be understood first: there is NO post-processing chain or render target anywhere in the game (the only camera-space surface is the single grain quad in `grainScene`, so lens water can be drawn beads but never refraction), and the existing "wet line" is a MeshLambertMaterial, which in this three build has no specular term at all, so it has never been able to read as wet — it is a pale line, which is exactly what he photographed.**

- confidence: likely
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **IDENTIFIER COLLISION — the game does not boot. Step 8 of 12 inserts `    const D = state.drips;` after src/underfalls.js:1518. src/underfalls.js:1582 already contains `    const D = state.displacement;` at the SAME indentation and the SAME block scope — both are top-level statements inside the single `game.tickers.push((dt, t) => { ... })` body that spans lines 1454-1612. Two `const D` in one block is `SyntaxError: Identifier 'D' has already been declared`. The module never parses, so buildUnderfalls never runs, so the whole game fails at boot and EVERY gate goes red — not just the cave ones. The plan's own risk section warns about the addFloorAndShell two-edit trap but never noticed this.**
  - _fix:_ Rename the new binding. In step 8's `change`, replace `const D = state.drips;` with `const DRIPS = state.drips;` and every subsequent `D.` in that inserted block with `DRIPS.` — i.e. `if (DRIPS) { DRIPS.cooldown -= dt; for (let i = 0; i < DRIPS.sites.length; i++) { const s = DRIPS.sites[i]; ... if (!stepped || DRIPS.cooldown > 0) continue; ... DRIPS.cooldown = 0.7; ... } }`. Do NOT rename the existing `const D = state.displacement;` at 1582 — it is referenced ten times between 1582 and 1610 and renaming it is a larger diff for no gain.


### Execute THIS (the challenged, corrected plan)

Apply the plan as written EXCEPT for the following, in this order. (1) BLOCKER, must be fixed or nothing boots: in step 8, rename `const D = state.drips;` to `const DRIPS = state.drips;` and every `D.` in that inserted block to `DRIPS.` — src/underfalls.js:1582 already declares `const D = state.displacement;` in the same block scope of the same ticker arrow function, and two `const D` in one block is a SyntaxError that kills the whole module. (2) Re-aim the corridor steam onto the drawn floor: in buildLowSteam, drop the `projectUnderfalls`/`clearance < STEAM_SIDE_CLEAR` rejection and the `off = w + 0.8 + k*0.72` line and place puffs between the wet ribbon's edge and the corridor's edge — `ribbonHalf = clamp(w*0.46, 0.94, 1.72)`, band `[ribbonHalf + 0.20, w - 0.15]` — because the corridor side walls occupy w+0.15..w+0.69 and the drawn floor stops at w, so as written 114 of 354 corridor puffs are behind 5.15 m of solid rock and the rest hang over an unfloored void. Leave the chamber annulus exactly as authored. (3) Fix the lens-bead composite so it stops hijacking the vignette: replace the `col = mix(...)` / two `alpha = max(...)` lines with a proper over-operation weighting each colour by its own alpha (code given in the problem entry), and rename the shadowed `vec2 c` to `vec2 cell`. (4) Small corrections that cost nothing: clamp each drip site's headroom to `(avgY + 4.63) - localY - 0.15` so no bead starts inside the route roof; change the sheen tread length from `(seg.length/n + 0.08) * 0.94` to `(seg.length/n) * 0.98` to remove the additive seam every 0.85 m; quantise drip periods to `600 / Math.round(600 / rng.range(2.6, 6.2))` so the ten-minute clock wrap does not pop; make the curtain lens test a ~1.8 m slab rather than a 3 m disc. (5) Correct two cost statements rather than the code: the clearing is +3 draws inside the nearMouth pre-dress window (152 against 450), not +0, and the three new ShaderMaterials cost up to nine programs, not three, because the light census is part of the program cache key and main.js warms the scene at three different censuses. Everything else in the plan verifies: all 15 anchors are verbatim and unique, every underfalls.js and main.js line number is exact, the Lambert-has-no-specular and dead-roughness-line findings are true against the vendored three, the +3 cave draw calls against the 450 ceiling are correct (137 → 140, independently corroborated by ROUND-ELEVEN.md), all three new roots land inside the renderRoots window at line 1662 AND carry `markUnderfalls`, the six-name atmosphere set and `renderRoots >= 5` floor in district-culling-regression are untouched, horror-expansion's drip assertions are only strengthened, playthrough.mjs is unaffected (no collider, no ground height, no interactable, no raycast target), and no law is broken — no text, no HUD, no new lights or candle descriptors, no hue-only meaning, no throw-grammar contact, no post-finishStatic material-identity comparison, and all new state is terminal across act change, checkpoint reload and the t%600 wrap. Before merge run render-perf (cave act), district-culling-regression, warm-start-regression, underfalls-expansion, horror-expansion; note that perf-pool-regression is already knowingly red (ROUND-THIRTEEN.md:23) and that the grain-shader change has NO gate on it by construction, so look at the house, the graveyard and the forest in a real browser.

### Findings

- **There is no post-processing pass, no EffectComposer and no WebGLRenderTarget for the main view. render() does exactly three draws to the default framebuffer: world pass (layer 0), held/viewmodel pass (LAYER_HELD, depth cleared, background nulled), then one fullscreen ortho quad. That quad is the ONLY camera-space surface in the game and is the only place first-person lens water can hang.**
  - `main.js:2083`
  - evidence: this.renderer.render(this.scene, this.camera); ... this.renderer.autoClear = false; this.renderer.clearDepth(); this.camera.layers.set(LAYER_HELD); ... this.renderer.render(this.scene, this.camera); ... this.renderer.render(this.grainScene, this.grainCam); this.renderer.autoClear = true;

- **The composite layer to hang lens droplets on is grainScene/grainCam/grainMat: one THREE.Scene holding a single PlaneGeometry(2,2) mesh with a raw ShaderMaterial (transparent, depthTest false, NormalBlending), an OrthographicCamera(-1,1,1,-1,0,1), and uniforms uTime/uFear/uResolution. Adding a uniform and a branch here costs no new draw call, no new program, and no new warm work.**
  - `main.js:407`
  - evidence: _buildGrain() { this.grainScene = new THREE.Scene(); this.grainCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.grainMat = new THREE.ShaderMaterial({ ... }); const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.grainMat); quad.position.z = -0.5; this.grainScene.add(quad); }

- **The grain scene is already covered by both warm passes — programs and textures — so anything added to it inherits the freeze work rather than reopening it. warm-start-regression asserts a whole-game tour links ZERO new programs, and this keeps that true.**
  - `main.js:688`
  - evidence: compile(this.grainScene, this.grainCam, 'grain');   // and _gatherWarmTextures(): walk(this.scene); walk(this.grainScene); walk(this.skull.root);

- **A true refractive lens droplet is off the table at any price. Introducing a render target for the main view would give every material a second, linear-colour-space program key — the exact cost the mirror pass already pays and the reason the finale needed its own warm pass. That would undo the freeze work, not add an effect.**
  - `main.js:665`
  - evidence: // The mirror room renders the scene into a linear-space render target, // and the colour space is part of the program key -- so every material // reflected in the finale needs a second program.

- **The 450 draw-call district ceiling counts only the world + held passes. renderer.info auto-resets at the top of every render() call, and lastRender is captured BEFORE the grain render, so a grain-scene change costs literally nothing against the budget the culling regression polices.**
  - `main.js:2102`
  - evidence: this.lastRender = { drawCalls: worldInfo.calls + heldInfo.calls, ... };  // vendor three: `!0===this.info.autoReset&&this.info.reset()` runs inside render()

- **THE WET PATH CANNOT CURRENTLY READ AS WET. wetStone is M.headstone.clone(), and M.headstone is built with lam(...) = MeshLambertMaterial. In this three build RE_Direct_Lambert is `irradiance * BRDF_Lambert(diffuseColor)` and nothing else — specularStrength is declared in the struct and never used. Wetness is a specular phenomenon; a Lambert surface has none. The ribbon is a PALE line, not a wet one, which is precisely screenshot 9 ('one huge pale flat slab').**
  - `underfalls.js:590`
  - evidence: const wetStone = M.headstone.clone();   // textures.js:1236  M.headstone = lam(bump(T(256,256,24,headstonePaint),0.14));  // three: void RE_Direct_Lambert(...) { reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ); }

- **The line that was supposed to make the ribbon glossy is dead code. MeshLambertMaterial has no `roughness` property, so the `'roughness' in wetStone` guard is false and the assignment never runs. Nobody has been looking at a roughness-0.16 surface.**
  - `underfalls.js:597`
  - evidence: if ('roughness' in wetStone) wetStone.roughness = 0.16;

- **The cave carries no lantern (the skull is gone) and runs at ambient 0.42 with FogExp2 0.055. The documented 'MeshStandard F0=0.04 washes out under a 131-irradiance lantern at arm's length' trap therefore does NOT apply here the way it does in the house — but there is also no light to build a specular from, which is why the wet read has to be a view-dependent term computed from cameraPosition rather than from a light.**
  - `director.js:55`
  - evidence: // Underfalls has no carried skull-light. At 0.30 its authored wet line and // far hatch disappeared between local fixtures ... forest: 0.54, clearing: 0.68, cave: 0.42, mirror: 0.6,

- **The existing particle kit is makeGlowPoints in atmosphere.js: a THREE.Points with static position/aPhase/aKind buffers, all motion in the vertex shader, and a ticker that writes ONE uniform. That is the pattern to copy. It is NOT importable from underfalls.js without creating a circular import — atmosphere.js already imports projectUnderfalls from underfalls.js — so the steam and drip batches must carry their own ~40-line shader locally.**
  - `atmosphere.js:2045`
  - evidence: function makeGlowPoints(position, phase, kind, own, opts) { ... }   // atmosphere.js:11  import { projectUnderfalls } from './underfalls.js';

- **Adding a top-level child to the atmosphere root would FAIL the culling gate. It hard-asserts the cave dressing is exactly six named batches, and anything visible in the cave that is not in that set is counted as an exterior leak. The same six-name set is duplicated in underfalls.js's installCaveVisibility. Building the new effects inside buildUnderfalls avoids both lists entirely.**
  - `district-culling-regression.mjs:112`
  - evidence: && CAVE_ATMOSPHERE.size === 6 && [...CAVE_ATMOSPHERE].every((name) => atmosphere.getObjectByName(name)),   ... && caveVisibleNames.length === CAVE_ATMOSPHERE.size && exteriorAtmosphereLeaks.length === 0

- **Anything scene.add()ed inside buildUnderfalls between renderStart and the renderRoots capture gets district sleep/wake for free, and installCaveVisibility.keep() spares it if userData.underfalls is set. Both are required: renderRoots hides it outside the cave, keep() stops the cave seal from hiding it inside. The chamber-floor discs are the working precedent.**
  - `underfalls.js:1662`
  - evidence: state.renderRoots = scene.children.slice(renderStart).filter((root) => !root.isLight);   // and installCaveVisibility keep(): || child.userData?.underfalls

- **Tickers run inside step() at the FIXED 1/120 timestep, not once per rendered frame — so at 60 Hz every line of per-frame ticker CPU is paid twice per displayed frame, and up to ten times after a hitch. This is the whole reason these effects must be GPU-phase-driven rather than CPU particle pools.**
  - `main.js:1831`
  - evidence: for (const t of this.tickers) t(dt, this.time);   // called from step(FIXED_DT, frame) inside `while (acc >= FIXED_DT)`, FIXED_DT = 1/120

- **The drip SOUND already exists and already cycles authored world points — director.js's _updateCaveHorror fires audio.caveDrip on a 2.7/4.05/3.25/4.8 s cadence around route nodes and chamber centres. Nothing has ever fallen. The visual drips are the thing that sound has been waiting for; the audio path needs no new function.**
  - `director.js:1074`
  - evidence: c.dripT -= dt; if (c.dripT <= 0 && c.sites.length) { const site = c.sites[c.site % c.sites.length]; g.audio.caveDrip({ pos: site, gain: 0.38 + (c.site % 3) * 0.07, ... }); const cadence = [2.7, 4.05, 3.25, 4.8];

- **There are SIX water curtains the player physically walks through (five main legs plus the culvert mouth), but only FOUR sprayZones, and only two of those coincide with a curtain. Four of the six crossings currently have no player-facing consequence of any kind. The curtain leg indices live only in atmosphere.js.**
  - `atmosphere.js:1938`
  - evidence: drops.push( curtainAt(layout.main[0], layout.main[1]), curtainAt(layout.main[1], layout.main[2]), curtainAt(layout.main[8], layout.main[9]), curtainAt(layout.main[9], layout.main[10]), curtainAt(layout.main[11], layout.main[12]), );

- **Raw ShaderMaterials get none of three's fog chunks. The existing cave spray/cataract shaders are therefore unfogged, and any new steam would be the one thing in a FogExp2 0.055 district that never fades — a corridor 40 m off would read as a lit tunnel. Every new shader here must carry a manual exp(-(fog*d)^2) term fed from scene.fog.density.**
  - `atmosphere.js:2050`
  - evidence: const material = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uTime ... } }))   // no <fog_pars_fragment>, no fogDensity uniform

- **The Drowned Choir's first stand is at chapel.x+7.5 / chapel.z+5.5 — 9.3 m from the chapel centre on a 10.5 m radius, i.e. 0.886r. A chamber-floor steam annulus covering 0.63r..1.07r puts it in steam without touching enemies.js at all, which keeps its pursuit contract bit-identical.**
  - `director.js:330`
  - evidence: choirSource = new THREE.Vector3( layout.chapel.x + 7.5, layout.chapel.y, layout.chapel.z + 5.5, );   // CHAMBERS_LOCAL: { x: 22, z: 54, r: 10.50, name: 'drowned pump chapel' }

- **Candle descriptors are census-free but the pool is only 8 lights, sorted by distance and refreshed every 0.4 s — and the cave already pushes 6 curtain descriptors plus 2 at the hatch. None of the four effects may add candle descriptors or real lights; doing so would either evict existing cave lighting or move the pinned shader light census and relink the whole game.**
  - `world.js:1130`
  - evidence: _buildCandlePool() { this.candlePool = []; for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xff9540, 0, 9, 1.8); ... } }

- **render-perf already gates the cave act specifically, which is the measurement that answers his 'i don't want it to slow down the game'. It is the only gate in the suite that can.**
  - `render-perf.mjs:29`
  - evidence: const ACTS = ['forest', 'clearing', 'cave', 'mirror']; ... const GATES = Object.freeze({ rafP50MsMax: 28, rafP95MsMax: 50, minRenderCoverage: 0.90, gpuP95MsMax: 45, });


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1 of 12 — WET PATH (rank 1). Import RNG, needed by steps 3 and 5. underfalls.js currently imports only math helpers.** — `underfalls.js`

_anchor:_
```js
import { clamp, lerp, smoothstep, TAU } from './util.js';
```

_change:_
```js
import { clamp, lerp, smoothstep, TAU, RNG } from './util.js';
```

**2. 2 of 12 — WET PATH. Give addFloorAndShell the district state object so it can register the sheen material for its one per-step uniform write. TWO edits, both required: miss the call-site and `state` is undefined and the game throws at boot.** — `underfalls.js`

_anchor:_
```js
function addFloorAndShell(game, layout) {
  const { world, mats: M } = game;
```

_change:_
```js
function addFloorAndShell(game, layout, state) {
  const { world, mats: M } = game;
```

**3. 3 of 12 — WET PATH. Update the call site (line 1645).** — `underfalls.js`

_anchor:_
```js
  addFloorAndShell(game, layout);
  buildRouteLights(game, layout, state);
```

_change:_
```js
  addFloorAndShell(game, layout, state);
  buildRouteLights(game, layout, state);
```

**4. 4 of 12 — WET PATH, the actual effect. Insert this block immediately AFTER the wet-ribbon loop that ends at line 613 and BEFORE the `// Chamber floors are broad and honest.` comment at line 615. It adds a sheen sheet 33 mm over the ribbon: a grazing-angle Fresnel band broken by slow rivulets, computed from cameraPosition (available as a built-in uniform in BOTH the vertex and fragment prefix in this three build — verified in vendor/three.module.min.js). It is brightest looking DOWN the corridor and ~zero at your own feet, which is how a wet floor behaves and which keeps the additive term out of the near field where a pale albedo would clip. One InstancedMesh, one draw call, 145 instances, 290 triangles, one uniform write per step. No collider; groundHeightAt never reads it.** — `underfalls.js`

_anchor:_
```js
        2 * clamp(w * 0.46, 0.94, 1.72), 0.06, (seg.length / n + 0.08) * 0.98, yaw);
    }
  }

```

_change:_
```js
        2 * clamp(w * 0.46, 0.94, 1.72), 0.06, (seg.length / n + 0.08) * 0.98, yaw);
    }
  }

  // ...AND IT HAS TO READ WET, WHICH A LAMBERT RIBBON CANNOT.
  //
  // Wetness is a specular phenomenon, and MeshLambertMaterial in this build
  // has NO specular term: RE_Direct_Lambert is irradiance * BRDF_Lambert and
  // nothing else (vendor/three.module.min.js, lights_lambert_pars_fragment).
  // M.headstone is lam(), so the clone above can only ever be a PALE line —
  // which is what Alex photographed: "walkway under waterfall doesn't look
  // good", "the path on the ground looked kind of boring". The
  // `wetStone.roughness = 0.16` line two blocks up is a no-op guarded into
  // silence: Lambert has no such property.
  //
  // This sheet supplies the missing term with no light, no lantern and no
  // render target: a grazing-angle band from cameraPosition (a three built-in
  // uniform in the fragment prefix), broken by two slow crossing rivulets. It
  // is brightest looking DOWN the corridor and nearly zero at your own feet —
  // exactly how a wet floor behaves, and it keeps the additive term out of the
  // near field where a pale albedo would clip to white. It therefore ADDS
  // contrast to the wayfinding read instead of washing it out.
  //
  // 33 mm above the ribbon's top face (which sits at y+0.042): far enough to
  // never z-fight down a 125 m corridor, invisible from standing height.
  {
    const sheenGeo = new THREE.PlaneGeometry(1, 1);
    sheenGeo.rotateX(-Math.PI / 2);
    const sheenMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, toneMapped: false,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uFog: { value: 0.055 },
        uGain: { value: 0.9 },
      },
      vertexShader: `
        varying vec3 vW;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        varying vec3 vW;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uFog;
        uniform float uGain;
        void main(){
          vec3 V = cameraPosition - vW;
          float d = length(V);
          V /= max(0.001, d);
          // the sheet is flat and faces up, so N = (0,1,0) and the grazing
          // term is just 1 - |V.y|. No light is consulted; there is none.
          float fres = pow(clamp(1.0 - abs(V.y
```

**5. 5 of 12 — CEILING DRIPS (rank 2) and STEAM (rank 3): two new builders. Insert BOTH functions immediately before `function buildHatchCistern(game, layout, state) {` at line 1221. Both are pure GPU-phase systems: static buffers, all motion in the vertex shader, and (drips only) 29 Math.floor calls per step on the CPU purely to place the landing tick. `gl_PointSize *= step(...)` is load-bearing — a zero point size rasterizes nothing, so the district's far half costs vertex work only.** — `underfalls.js`

_anchor:_
```js
function buildHatchCistern(game, layout, state) {
```

_change:_
```js
// -------------------------------------------------------------- low steam
// "a bit of steam towards the sides of the area but not on the path", and
// "the bottom of the level could be in [steam]" — with the Choir standing in
// it. One Points batch, one draw call, and NO per-frame CPU beyond two uniform
// writes: every puff is placed once at build time and animated entirely in the
// vertex shader from its own phase. Tickers run at the fixed 1/120 step
// (main.js run()), so anything per-particle here would be paid twice per
// displayed frame at 60 Hz. It is not paid at all.
//
// NOT ON THE PATH IS ENFORCED, NOT INTENDED. Corridor puffs are rejected
// unless projectUnderfalls() says they clear the whole walkable union (main +
// culvert + chambers) by STEAM_SIDE_CLEAR — the same guard atmosphere.js's
// clearOfRoute uses to keep wall rock out of the lane. Chamber puffs ARE
// allowed inside the disc, because that is where the Choir stands and where
// "the bottom of the level" is, but only in the outer annulus and only
// ankle-to-knee, so the walking line through a room stays clear air.
//
// FOG IS MANUAL. A raw ShaderMaterial gets none of three's fog chunks, so
// without uFog this would be the one thing in the district that never fades
// and a corridor forty metres off would read as a lit tunnel.
const STEAM_SIDE_CLEAR = 0.55;

function buildLowSteam(game, layout, state) {
  const rng = new RNG(0x57ea3fa1);
  const pos = [], phase = [], span = [], drift = [];
  const push = (x, y, z, h, s) => {
    pos.push(x, y, z);
    phase.push(rng.range(0, TAU));
    span.push(h);
    drift.push(s);
  };
  for (const seg of layout.mainSegments) {
    const stations = Math.max(2, Math.round(seg.length / 2.2));
    const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
    const nx = tz, nz = -tx;
    for (let i = 0; i < stations; i++) {
      const t = (i + 0.5) / stations;
      const cx = seg.a.x + seg.dx * t;
      const cz = seg.a.z + seg.dz * t;
      const cy = lerp(seg.a.y, seg.b.y, t);
      const w = lerp(seg.a.w, seg.b.w, t);
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const off = w + 0.8 + k * 0.72 + rng.range(-0.18, 0.18);
          const x = cx + nx * side * off + tx * rng.range(-0.9, 0.9);
          const z = cz + nz * side * off + tz * rng.range(-0.9, 0.9);
          const p = projectUnderfalls(layout, x, z);
          if (!p || p.clearance < STEAM_SIDE_CLEAR) continue;   // never on the path
          push(x, cy + rng.range(0.02, 0.30), z, rng.range(0.55, 1.25), rng.range(0.5, 1.0));
        }
  
```

**6. 6 of 12 — call the two new builders. Insert between buildSprayDisplacement (line 1650) and buildHatchCistern (line 1651), i.e. anywhere between addFloorAndShell and the renderRoots capture at 1662 — that window is what gives them district sleep/wake for free.** — `underfalls.js`

_anchor:_
```js
  buildSprayDisplacement(game, layout, state);
  buildHatchCistern(game, layout, state);
```

_change:_
```js
  buildSprayDisplacement(game, layout, state);
  buildLowSteam(game, layout, state);
  buildCeilingDrips(game, layout, state);
  buildHatchCistern(game, layout, state);
```

**7. 7 of 12 — drive the three new shaders. One shared wrapped clock, and the fog density read live so the effects ease with the act transition instead of snapping. Placed in the `dressed` branch rather than after `if (!inCave) return;` so the steam is already drifting during the nearMouth pre-dress (the entrance must never load in two stages again). Insert between the lightsActive block ending at line 1489 and the comment at line 1490.** — `underfalls.js`

_anchor:_
```js
    if (state.lightsActive !== dressed) {
      state.lightsActive = dressed;
      for (const light of state.lights) light.visible = dressed;
    }
```

_change:_
```js
    if (state.lightsActive !== dressed) {
      state.lightsActive = dressed;
      for (const light of state.lights) light.visible = dressed;
    }
    // Six uniform writes for three whole effects. The clock is wrapped the way
    // atmosphere.js wraps its own (t % 600) so a long session cannot lose float
    // precision in fract(); the drip tick below wraps identically so the audio
    // never drifts off the splash. Fog is read live rather than pinned, because
    // a raw ShaderMaterial gets none of three's fog chunks and the act change
    // eases scene.fog.density over about a second.
    const gt = t % 600;
    if (dressed) {
      const fogD = game.scene.fog?.density ?? 0.055;
      if (state.steam) {
        state.steam.material.uniforms.uTime.value = gt;
        state.steam.material.uniforms.uFog.value = fogD;
      }
      if (state.drips) {
        state.drips.material.uniforms.uTime.value = gt;
        state.drips.material.uniforms.uFog.value = fogD;
      }
      if (state.pathSheen) {
        state.pathSheen.material.uniforms.uTime.value = gt;
        state.pathSheen.material.uniforms.uFog.value = fogD;
      }
    }
```

**8. 8 of 12 — the drip's landing tick. Insert immediately after `const choir = game.enemies?.choir;` at line 1518 (it needs `player`, declared on 1517). Reuses audio.caveDrip, which already exists and already refuses to fire without a world position. Quieter and higher-pitched than the director's blind ecology on purpose: that one is the far, unseen cave; this one is the small drop you just watched land. Only ADDS caveDrip events, and only inside caveZone, so tests/horror-expansion.mjs's `drips.length >= 2` / in-bounds / distinct-position assertions are strengthened, never threatened.** — `underfalls.js`

_anchor:_
```js
    const player = game.player.pos;
    const choir = game.enemies?.choir;
```

_change:_
```js
    const player = game.player.pos;
    const choir = game.enemies?.choir;
    // THE DROP YOU JUST WATCHED LAND. The GPU owns the fall; the CPU only
    // re-evaluates the same wrap to place the tick. floor(u - fallFrac)
    // increments exactly at the landing, because the shader's splash begins at
    // fract(u) == fallFrac. 29 sites, one Math.floor each, per 1/120 step.
    const D = state.drips;
    if (D) {
      D.cooldown -= dt;
      for (let i = 0; i < D.sites.length; i++) {
        const s = D.sites[i];
        const cycle = Math.floor(gt / s.period + s.phase - s.fallFrac);
        if (cycle === s.lastCycle) continue;
        // fire only on a true +1 step: entering the district, and the t % 600
        // wrap, both jump the index and must stay silent
        const stepped = s.lastCycle >= 0 && cycle === s.lastCycle + 1;
        s.lastCycle = cycle;
        if (!stepped || D.cooldown > 0) continue;
        const ddx = player.x - s.x, ddz = player.z - s.z;
        if (ddx * ddx + ddz * ddz > 64) continue;      // 8 m — dial for chatter
        D.cooldown = 0.7;                              // dial for chatter
        game.audio.caveDrip({ pos: s.landing, gain: 0.19, rate: 1.26, verb: 0.82 });
      }
    }
```

**9. 9 of 12 — LENS WATER (rank 4), the trigger side. Wet the lens where the player is actually in water. Two insertions in installBeats. (a) In the sprayZone loop, between the crossing block closing at 1534 and `pulse.inside = inside;` at 1535: a burst on the crossing edge plus a top-up while inside. This is cosmetic only — it calls nothing on the enemies and reads nothing they own, so the Choir's pursuit contract stays bit-identical and no sprayZone is added (adding one would change caveSpray's reveal cadence and touch choir-surfacing-regression).** — `underfalls.js`

_anchor:_
```js
        sprayed = true;
        if (state.sluice) state.sluice.sprayKick = 1;
      }
      pulse.inside = inside;
```

_change:_
```js
        sprayed = true;
        if (state.sluice) state.sluice.sprayKick = 1;
      }
      // WATER ON THE LENS — cosmetic only, and deliberately NOT a new spray
      // zone: adding one would change caveSpray's reveal cadence for the Choir.
      if (inside && !pulse.inside) game.splashLens?.(0.55);
      if (inside) game.splashLens?.(dt * 0.6);
      pulse.inside = inside;
```

**10. 10 of 12 — LENS WATER, part (b): the four curtains that currently have no player-facing consequence at all. First add the curtain list to the layout, so there is one source of truth for where the player walks THROUGH water. Insert after the sprayZones array closes at line 130 and before `const bounds = {` at line 131, and add `curtains,` to the returned object next to `sprayZones,` on line 158.** — `underfalls.js`

_anchor:_
```js
      radius: 4.2,
      strength: 0.72,
    },
  ];
  const bounds = {
```

_change:_
```js
      radius: 4.2,
      strength: 0.72,
    },
  ];
  // THE CURTAINS YOU WALK THROUGH, by the leg each hangs across. Six of them
  // are drawn (atmosphere.js's curtainAt), and until now only two had any
  // player-facing consequence — the entry and hatch veils, which are also
  // sprayZones. The other four were scenery you passed through and nothing
  // happened. This list is the one source of truth; see the optional
  // de-duplication step for making atmosphere.js consume it too.
  const curtainLegs = [[0, 1], [1, 2], [8, 9], [9, 10], [11, 12]];
  const curtains = curtainLegs.map(([i, j]) => ({
    pos: new THREE.Vector3(
      (main[i].x + main[j].x) / 2,
      (main[i].y + main[j].y) / 2 + 1.3,
      (main[i].z + main[j].z) / 2),
    radius: (main[i].w + main[j].w) * 0.5 + 0.4,
  }));
  if (secret[0] && secret[1]) {
    curtains.push({
      pos: new THREE.Vector3(
        (secret[0].x + secret[1].x) / 2,
        (secret[0].y + secret[1].y) / 2 + 1.3,
        (secret[0].z + secret[1].z) / 2),
      radius: (secret[0].w + secret[1].w) * 0.5 + 0.4,
    });
  }
  const bounds = {
```

**11. 11 of 12 — LENS WATER, part (c): return `curtains` from createUnderfallsLayout, and wet the lens inside each. TWO edits. First add the field; second, insert the loop in installBeats immediately after the sprayZone `for` loop closes (the line after the `c.inside = true;` else-branch closes, just before the `if (!state.beats.pump ...)` block).** — `underfalls.js`

_anchor:_
```js
    overflow,
    sprayZones,
  };
}
```

_change:_
```js
    overflow,
    sprayZones,
    curtains,
  };
}
```

**12. 12 of 12 — LENS WATER, part (d): the curtain soak loop. Insert immediately before `if (!state.beats.pump && player.distanceToSquared(state.pump.position) < 11.5 * 11.5) {`.** — `underfalls.js`

_anchor:_
```js
    if (!state.beats.pump && player.distanceToSquared(state.pump.position) < 11.5 * 11.5) {
```

_change:_
```js
    // Every curtain wets you, not just the two that happen to be spray zones.
    for (const curtain of layout.curtains || []) {
      const wx = player.x - curtain.pos.x;
      const wz = player.z - curtain.pos.z;
      if (wx * wx + wz * wz <= curtain.radius * curtain.radius) game.splashLens?.(dt * 0.6);
    }
    if (!state.beats.pump && player.distanceToSquared(state.pump.position) < 11.5 * 11.5) {
```

**13. MAIN.JS 1 of 5 — LENS WATER state. Add the wetness scalar beside the other cosmetic FX state.** — `main.js`

_anchor:_
```js
    this.baseTension = 0;
    this.fx = { fear: 0 };
```

_change:_
```js
    this.baseTension = 0;
    this.fx = { fear: 0 };
    // 0..1 water on the first-person lens. Cosmetic only; nothing reads it but
    // the grain shader, and nothing writes it but splashLens() and step()'s
    // dry-off. Underfalls is the only district that currently sets it.
    this.lensWet = 0;
```

**14. MAIN.JS 2 of 5 — LENS WATER public hook, beside shake() at line 1478, which is the same kind of thing: a cosmetic camera verb any district may call.** — `main.js`

_anchor:_
```js
  shake(v) { this._shake = Math.max(this._shake, v); }
```

_change:_
```js
  shake(v) { this._shake = Math.max(this._shake, v); }
  // Water arrives on the lens. Accumulates, so standing under a fall saturates
  // while a brisk walk-through only beads it. step() dries it off.
  splashLens(amount = 1) { this.lensWet = clamp(this.lensWet + amount, 0, 1); }
```

**15. MAIN.JS 3 of 5 — LENS WATER dry-off, dt-driven in the fixed step (never a setTimeout, per the beats law). Insert after `this._updateGore(dt);` at line 1838.** — `main.js`

_anchor:_
```js
    this._updateGore(dt);
    for (const st of this.bridgeStones) {
```

_change:_
```js
    this._updateGore(dt);
    // The lens dries. In the cave it takes about seven seconds, so a curtain is
    // still beaded on the glass at the next corner; anywhere else it is gone in
    // half a second, so a death, an act change or a debug teleport can never
    // carry water out of the district.
    if (this.lensWet > 0) {
      this.lensWet = Math.max(0, this.lensWet - dt * (this.act === 'cave' ? 0.145 : 2.2));
    }
    for (const st of this.bridgeStones) {
```

**16. MAIN.JS 4 of 5 — LENS WATER shader. Two edits inside _buildGrain: add the uniform to the block at line 412-415, and add the declaration + droplet field to the fragment shader. Zero new draw calls, zero new programs, and the branch is uniform-coherent across the whole draw so a dry lens costs essentially nothing. Note the grain quad is drawn from the first frame of the game, so there is no first-draw hitch to pay at the first splash — which a separate quad WOULD have had, since _warmDrawList only traverses this.scene, not grainScene.** — `main.js`

_anchor:_
```js
      uniforms: {
        uTime: { value: 0 }, uFear: { value: 0 },
        uResolution: { value: new THREE.Vector2(1280, 720) },
      },
```

_change:_
```js
      uniforms: {
        uTime: { value: 0 }, uFear: { value: 0 }, uWet: { value: 0 },
        uResolution: { value: new THREE.Vector2(1280, 720) },
      },
```

**17. MAIN.JS 4b — the fragment shader itself. Replace the declaration line and the final two lines of main(). `hash()` is already defined in this shader and is reused.** — `main.js`

_anchor:_
```js
        varying vec2 vUv; uniform float uTime; uniform float uFear;
        uniform vec2 uResolution;
```

_change:_
```js
        varying vec2 vUv; uniform float uTime; uniform float uFear;
        uniform float uWet;
        uniform vec2 uResolution;
```

**18. MAIN.JS 4c — the droplet field. Replace the last two statements of the grain main().** — `main.js`

_anchor:_
```js
          float d = (hash(vUv*uResolution + 7.13) - 0.5) / 255.0;
          gl_FragColor = vec4(tint + d, clamp(a + d, 0., 0.88));
        }`,
```

_change:_
```js
          float d = (hash(vUv*uResolution + 7.13) - 0.5) / 255.0;
          vec3 col = tint + d;
          float alpha = clamp(a + d, 0., 0.88);
          // WATER ON THE LENS. There is no render target anywhere in this game
          // — render() draws the world pass, the held pass and this quad
          // straight to the default framebuffer — so a REFRACTIVE droplet is
          // not available at any price: introducing a target would give every
          // material a second linear-colour-space program key and undo the
          // whole freeze effort. These are drawn beads instead: a bright rim
          // and a slightly darkened body, which is what a bead on glass looks
          // like in a black cave anyway. One hashed cell per pixel, no
          // neighbourhood loop, guarded by a uniform branch that is coherent
          // across the entire draw — a dry lens costs a compare.
          if (uWet > 0.001) {
            float aspect = uResolution.x / max(1.0, uResolution.y);
            vec2 grid = vec2(vUv.x * aspect, vUv.y) * 9.0;
            vec2 cellId = floor(grid);
            vec2 f = fract(grid);
            float h1 = hash(cellId + 0.5);
            float h2 = hash(cellId + 11.7);
            float h3 = hash(cellId + 31.3);
            float live = step(h1, uWet * 0.72);   // wetter lens, more cells hold a bead
            float creep = fract(uTime * (0.012 + h2 * 0.02) + h3);
            vec2 c = vec2(0.22 + h2 * 0.56, 0.86 - creep * 0.72);
            float rad = (0.13 + h3 * 0.16) * (0.55 + 0.45 * uWet);
            float rr = length((f - c) * vec2(1.0, 1.15)) / max(0.02, rad);
            float rim = smoothstep(0.62, 0.97, rr) * (1.0 - smoothstep(0.97, 1.22, rr));
            float body = 1.0 - smoothstep(0.55, 1.0, rr);
            float ex = live * uWet * (1.0 - smoothstep(0.75, 1.0, creep));
            col = mix(col, vec3(0.60, 0.71, 0.75), clamp(rim * 0.85 * ex, 0.0, 1.0));
            alpha = max(alpha, rim * 0.52 * ex);
            alpha = max(alpha, body * 0.14 * ex);
          }
          gl_FragColor = vec4(col, alpha);
        }`,
```

**19. MAIN.JS 5 of 5 — feed the uniform. Insert after line 2107. Under prefers-reduced-motion the existing uTime is already pinned to 0, so beads stop drifting; they do not need to be removed as well.** — `main.js`

_anchor:_
```js
    this.grainMat.uniforms.uTime.value = REDUCED_MOTION ? 0 : this.time % 300;
    this.grainMat.uniforms.uFear.value = this.fx.fear;
```

_change:_
```js
    this.grainMat.uniforms.uTime.value = REDUCED_MOTION ? 0 : this.time % 300;
    this.grainMat.uniforms.uFear.value = this.fx.fear;
    this.grainMat.uniforms.uWet.value = this.lensWet;
```

**20. OPTIONAL de-duplication, do it or don't — but if you don't, write the coupling down. atmosphere.js currently owns the curtain leg indices in a literal call list, and step 10 duplicates them into layout.curtains. If they ever disagree, the lens gets wet where no sheet is drawn. atmosphere.js already imports from underfalls.js, so consuming layout.curtains creates no new cycle. The candle descriptor push must stay in atmosphere.js — it is the drawn sheet's lighting, not the layout's.** — `atmosphere.js`

_anchor:_
```js
    drops.push(
      curtainAt(layout.main[0], layout.main[1]),
      curtainAt(layout.main[1], layout.main[2]),
      curtainAt(layout.main[8], layout.main[9]),
      curtainAt(layout.main[9], layout.main[10]),
      curtainAt(layout.main[11], layout.main[12]),
    );
    if (layout.secret?.[0] && layout.secret?.[1]) {
      drops.push(curtainAt(layout.secret[0], layout.secret[1]));
    }
```

_change:_
```js
    // THE LEG LIST LIVES IN THE LAYOUT NOW (underfalls.js, layout.curtains),
    // because it is also what wets the first-person lens. Two copies of "where
    // does the player walk through water" is one copy too many.
    const CURTAIN_LEGS = [[0, 1], [1, 2], [8, 9], [9, 10], [11, 12]];
    for (const [i, j] of CURTAIN_LEGS) drops.push(curtainAt(layout.main[i], layout.main[j]));
    if (layout.secret?.[0] && layout.secret?.[1]) {
      drops.push(curtainAt(layout.secret[0], layout.secret[1]));
    }
```


### Cost

DRAW CALLS. +3 in the cave, +0 everywhere else. cave 137 -> 140 against the 450 ceiling; house 339, house-after-cave 365, graveyard 327, forest 299, clearing 149, ossuary 142, marrow 140 all unchanged, because all three batches are underfalls renderRoots and are `visible = false` outside the act. The lens droplets cost +0 draw calls in every district: they are extra ALU in the existing grain quad, and in any case the grain pass is a THIRD renderer.render() call, after which renderer.info has already auto-reset — lastRender.drawCalls is captured before it and has never counted it.

GEOMETRY. Steam: ~455 authored points before the route-clearance rejection, expect ~390-420 surviving (59 corridor stations x 2 sides x 3, plus 101 chamber puffs: chapel 61, overflow 13, intake 10, hatch 10, bell 7). Drips: 29 sites x 2 points = 58. Sheen: 145 instances (one per main tread; the main route is 125.16 m in 12 legs), 4 vertices and 2 triangles each = 290 triangles. Total added triangles in the cave: 290. Points contribute none.

PER-FRAME CPU. Tickers run inside step() at the FIXED 1/120 timestep, so everything below is paid twice per displayed frame at 60 Hz — which is exactly why none of it is a particle simulator. Per step: 6 uniform scalar writes + 1 fog read; 29 Math.floor + 29 squared-distance tests for the drip ticks; 6 squared-distance tests for the curtain soak; 1 subtraction for the lens dry-off. Order 100 float operations, ~12k/second. Unmeasurable against the existing installBeats body, which already does the pump, the sluice runnels, four spray zones and the displacement figure every step. ZERO allocation per frame: no Vector3, no Matrix4, no array. Nothing is written to a GPU buffer after boot — instanceMatrix is StaticDrawUsage and every Points buffer is written once.

PER-FRAME GPU. Steam is the only meaningful term. Worst case is bounded by the size clamp at 74 px and by `gl_PointSize *= step(0.004, vAlpha)`, which zeroes any sprite the fog has already killed — at FogExp2 0.055 that is everything past roughly 30 m, leaving perhaps 40-80 sprites rasterizing. 80 x 60^2 ~ 288k pixels, about 0.14 of a 1080p screen, through a fragment shader that is one length(), one pow() and a discard. Drips: at most ~6 beads mid-fall district-wide (duty cycle ~0.9 s of fall in a 2.6-6.2 s period), each under 30 px. Sheen: 145 quads, ~20 ALU each, but only the visible run of ribbon rasterizes and it occupies a small fraction of frame area. Lens: one extra fullscreen pass worth of ~25 ALU, and ONLY while wet — 3 hash() calls, 5 smoothsteps, one mix. Rough order 0.2-0.6 ms at 1080p while soaked, 0 when dry. I could not measure any of this (no browser this session); `node tests/render-perf.mjs` gates the cave act at rafP50 <= 28 ms, rafP95 <= 50 ms, gpuP95 <= 45 ms and is the instrument that answers his "i don't want it to slow down the game".

MEMORY / BOOT. Three new materials (3 programs, all linked inside the existing synchronous warm pass), three new geometries, ~1400 floats of attribute data. No textures. No lights — critically, none of this adds a real light or a candle descriptor, so the pinned shader light census does not move and nothing relinks.

IMPLEMENTATION EFFORT. Roughly 300 lines added, ~8 lines changed. underfalls.js carries about 280 of them in two new self-contained builders plus four small insertions; main.js carries about 30 across five insertions. No new files, no new imports beyond adding RNG to underfalls.js's existing util import, no build step. Realistically half a day including the two probes named below.

### Risk

RANKED BY (impact on how the area feels) / (risk of breaking something), best ratio first.

1. WET ROCK PATH — best ratio. The ribbon is in most cave frames, it is what screenshot 9 is a photograph of, and the fix is provably addressing a real defect (Lambert cannot do specular; the roughness line is dead code) rather than a taste change. Risk is near zero: no collider, no ground height, no light, no enemy contract, one new draw call, and the additive term is ~0 exactly where clipping would happen (looking down at your feet). Worst realistic failure is "reads as a glowing strip rather than a wet one", fixed by lowering uGain.

2. CEILING DRIPS — 1 draw call, all motion on the GPU, and it retro-justifies a drip SOUND that has been playing for rounds with nothing to see. Only real risk is audio chatter: 29 sites within an 8 m radius could tick more often than the district's quiet wants. Three dials in one place (radius 64 = 8 m², cooldown 0.7 s, gain 0.19). The CPU/GPU phase formulas must stay identical — if you edit `sqrt(2.0 * aFall / 9.81) / aPeriod` in the shader, edit `Math.sqrt(2 * headroom / 9.81) / per` in the same commit or the tick drifts off the splash.

3. STEAM — the loudest request and the biggest visual change, but the highest legibility risk in the set, and it is the project's recurring failure mode in its exact shape. It is ADDITIVE: it makes the sides of the district brighter, and the sides being darker than the pale ribbon is the value ladder four rounds of work built. Under-do it and he says "i might see a tiny steam effect" again; over-do it and the wayfinding read flattens. This one must be measured, not eyeballed, before it ships (see openQuestions). Secondary risk is fill rate — mitigated by `gl_PointSize *= step(0.004, vAlpha)`, which is not an optimisation nicety: without it every one of ~455 sprites rasterizes up to 5476 pixels whether or not its alpha survived the fog.

4. FIRST-PERSON WATER ON CAMERA — worst ratio, and it is the one he asked for first. Impact is capped by architecture: with no render target the beads cannot refract, so this can only ever be "drawn beads on glass", not the effect he has seen in other games. And it has by far the largest blast radius: the grain shader draws in EVERY frame of EVERY act, so a mistake there is not a cave bug, it is a game bug. Mitigations: the branch is uniform-guarded, uWet is only ever non-zero in the cave, and the quad is drawn from the first frame so there is no deferred first-draw hitch. Do this one last and look at the house, the graveyard and the forest before believing it.

GATE-SPECIFIC RISKS, all avoided by construction rather than by luck:
- district-culling-regression hard-asserts the cave atmosphere is EXACTLY six named batches and that nothing else is visible in the cave. Every new object here is built inside buildUnderfalls, so it lands in state.renderRoots (`>= 5`, a floor not a ceiling) and never touches that set, nor the duplicate six-name set inside installCaveVisibility. Do not be tempted to put the steam in atmosphere.js — that is a red gate.
- Every new root needs BOTH `markUnderfalls()` (so installCaveVisibility.keep() spares it while inside) AND to be added before the renderRoots capture at line 1662 (so it sleeps outside). One without the other gives you either a cave with no steam or steam visible from the graveyard.
- warm-start-regression asserts a whole-game tour links ZERO new programs. Three new scene materials are covered by `compile(this.scene, ...)`, whose traverse ignores visibility; the grain change is one program's source, not a new program.
- horror-expansion asserts caveDrip fires >= 2 times with >= 2 distinct in-bounds positions in 5.2 s. The new ticks only ADD events, all on the route and therefore inside caveZone. Do NOT move the director's drip cadence to be impact-driven — that test steps with the player teleported around, and an impact-driven cadence can legitimately produce zero.
- The addFloorAndShell signature change is two edits (steps 2 and 3). Land only the first and `state.pathSheen = ...` throws on a null and the game does not boot.
- perf-pool-regression is already knowingly RED for an unexplained geometry-accounting reason. These changes add geometries at boot (3 batches). If that gate's failure text changes shape, that is new information about the existing mystery, not necessarily a new bug — read it before assuming.

### Open questions

- THE STEAM'S OPACITY IS A GUESS AND MUST BE MEASURED, NOT EYEBALLED. uOpacity 0.085 with tint 0x4d616a is chosen from the existing spray batch's 0.34-at-size-14, not from a measurement. The question that matters is not 'is it visible' but 'does the pale wet ribbon still out-value the shoulders it runs between' — that ratio is the district's whole wayfinding read. What settles it: a WebGL-readback probe in the tools/probe-cave-floor.mjs idiom that poses the camera at three route points (the intake apse, the chapel west aisle, the spill descent), renders until two consecutive frames are byte-identical (render() decays impact light and jitters the camera while _shake is alive; un-settled frames have given this project the opposite conclusion once already), and prints the mean luminance of the ribbon band against the mean luminance of the 1-3 m shoulder band, with steam on and off. Ship only if the ratio does not fall. Never page.screenshot — it composites the canvas black headless; read canvas.toDataURL.
- AND THE OPPOSITE FAILURE IS EQUALLY LIKELY. His complaint was 'i might see a tiny steam effect', i.e. the failure mode he has already experienced is under-doing it. A ratio-preserving steam that he cannot see is a wasted round. The same probe should print the absolute added luminance in the shoulder band so both failure directions are visible in one number, and he should see a still from the chapel before it is called done.
- WHETHER THE FRESNEL SHEEN READS AS 'WET' OR AS 'A GLOWING STRIP' IS A TASTE CALL I CANNOT MAKE FROM SOURCE. The physics is right (grazing-angle reflectance, dark at your feet, bright down the corridor) and the numbers are dialled to be safe (uGain 0.9, alpha clamped at 0.62), but whether it lands as reflected wet stone or as a light-up runway needs his eyes on a still from the lower sluice looking up the rise. If it reads as glow rather than gloss, the first dial is uGain and the second is raising the Fresnel exponent from 3.4 toward 5.0, which narrows the band toward the horizon.
- I HAVE NOT VERIFIED THERE IS ACTUALLY CEILING ABOVE EVERY DRIP SITE. The route roof is one continuous box per leg at avgY + 4.86 including legs that open into chambers, and the chamber caps sit at chamber.y + 5.18 (5.72 at the chapel), so every site at floorY + 3.9..4.8 should be under solid rock. But the roof uses the leg's AVERAGE elevation while my sites use the interpolated LOCAL elevation, so on the sluice rise (a 1.6 m climb over 10.8 m) the local floor can be up to 0.8 m above the leg average and a site at +4.35 could be inside or above the roof slab. What settles it: an upward raycast from each of the 29 landing points in a browser probe, asserting a hit within 5.2 m. Cheap to add and worth pinning.
- THE CURTAIN LEG INDICES ARE READ, NOT OWNED. Step 10 duplicates [[0,1],[1,2],[8,9],[9,10],[11,12]] plus the culvert mouth out of atmosphere.js. If that list ever changes without the layout's copy changing, the lens gets wet where no water is drawn — a silent, ugly desync. The optional final step removes the class of bug entirely by making atmosphere.js consume layout.curtains. Take it if you have the appetite for one more file in the diff; if not, put the coupling in a comment on both sides.
- THE DROWNED CHOIR IS ONLY 'IN STEAM' WHERE IT STANDS STILL. The chamber annulus covers its first stand (0.886r at the chapel, inside the 0.63r-1.07r band) and the shoulders cover the corridors, but _surfaceChoirAt puts it ON the main route ahead of you, which is exactly the clear air the 'not on the path' rule creates. That may be correct — a thing that teleports in front of you has to be legible — but it is not literally what he asked for. The alternative is a small Points plume parented to the choir mesh, which is ~1 more draw call and one position write per step, but it lives inside a lifecycle that disposes five transparent materials on removal (enemies.js _remove) and would have to join that disposal. I would not build it this round; I would show him the ground steam first and ask.
- THE LENS BEADS CANNOT REFRACT AND HE MAY NOTICE. He described 'water droplets on the camera of the first person view', which in the games he is thinking of is a screen-space refraction sampling the frame behind it. That needs a render target for the main view, and a render target changes every material's colour space, which is part of the program key — the exact mechanism that made the finale need its own warm pass and that nine rounds of freeze work exist to avoid. If drawn beads are not enough for him, the honest next option is not 'add a render target', it is 'the effect is not affordable in this engine', and that is a conversation, not a patch.
- I RAN NO BROWSER AT ALL THIS SESSION (a gate battery was live against this tree). Every performance number above is derived from source and arithmetic, not measured. Before merge: node tests/render-perf.mjs (the cave act specifically), node tests/district-culling-regression.mjs (the cave draw count should read 140, and caveVisibleNames must still be exactly the six atmosphere batches), node tests/warm-start-regression.mjs (zero programs linked on the tour), node tests/underfalls-expansion.mjs and node tests/horror-expansion.mjs. And then the adversarial read the project has already paid for once: every gate runs ?test=1, ?test=1 skips the warm passes, so the grain-shader branch in particular has no gate on it by construction — look at the house and the graveyard in a real browser, not just the cave.


---

<a id="cone"></a>

## cone

**Screenshot 8 is the fallen bell in the bell cistern (`buildBellCistern`, src/underfalls.js:1085–1180) — authored dressing for the optional culvert whose entire behaviour is one proximity one-shot that plays a *dropped-spanner* sound; round twelve already fixed the "hanging" half by dropping it 1.18 m onto the floor, but it still has no ticker, no light animation, no voice of its own, and no collider, so it is now a 2.06 m iron object you walk straight through — and it can never be a fetch target, because the skull is gone before the player reaches it.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **LINE ENDINGS. src/underfalls.js and src/atmosphere.js are uniformly CRLF (CR=1671/LF=1671 and CR=2108/LF=2108 respectively; `od -c` confirms \r\n). All anchors and all replacement blocks in the plan are LF. The three multi-line anchors (Step 1 at 1128-1143, Step 5 at 1573-1577, Option B at 1128-1131) will fail an exact-match edit, and the LF replacement text would leave the file with mixed terminators.**
  - _fix:_ Before applying, convert every anchor and every replacement block to CRLF, or apply with a tool that normalizes on read and re-emits the file's existing terminator. Verify afterwards that CR count still equals LF count in both files.

- **STEP 2 PUTS THE DRY RING THROUGH THE FLOOR EDGE AND INTO THE WALL. The dry ring is RingGeometry(2.05, 2.28) — outer radius 2.28. Moving its centre to the bell at |offset| = hypot(1.63,1.47) = 2.195 m from the chamber centre puts its far edge 4.475 m from that centre. The chamber's walkable/visible floor there is the instanced disc at chamber.r * 1.02 = 3.519 m (src/underfalls.js:614-627), and the nearest lane-floor box only reaches ~3.09 m at that bearing (I projected the point onto both secret segments: d = 4.14 vs w = 3.09). Worse, atmosphere.js:1697-1717 rings each chamber with wall stones pushed to clearance >= half+0.35, i.e. inner faces around 3.8 m from the chamber centre. So roughly a metre of a 4.56 m pale annulus hangs over black nothing and clips the wall skin. This is precisely the project's named failure mode: a drawn thing that is not where it looks.**
  - _fix:_ Either (a) leave line 1171 unchanged so the dry ring stays the chamber's dry disc, or (b) move it AND shrink it in the same edit. If (b), also change line 1168-1169 from `new THREE.RingGeometry(2.05, 2.28, 28)` to `new THREE.RingGeometry(1.22, 1.40, 28)` and use the reduced offset in the fix for the next item — 1.95 + 1.40 = 3.35 m, which clears the 3.519 m floor disc. Do not move the ring at 2.28 outer radius at any offset above ~1.2 m.

- **STEP 5 SHIPS THE 22 m EARSHOT THE PLAN ITSELF SAYS MUST NOT SHIP. `openQuestions` MEASUREMENT NEEDED #3 says "do not leave 22 in place by default", and then the `change` block hardcodes `< 22`. I measured the straight-line distances from the proposed strike point to the MAIN route nodes: chapel east aisle 10.6 m, lower sluice 7.8 m, sluice rise 11.6 m, east ambulatory 19.0 m, chapel west aisle 20.8 m, upper sluice 20.8 m. At 22 m a dark bell tolls every 7.3-13.8 s from inside solid rock, 7.8 m from the main road, for most of the chapel-to-upper-sluice run, with no visible source and no way to reach it. That is a phantom lure, it inverts the quiet-vs-loud economy (a secret calling attention to itself along the public route), and it is the exact thing audio.js:1634 refuses to do ("A drip without a source is just a UI click").**
  - _fix:_ Replace the distance gate with a membership gate. `projectUnderfalls` is a module-level function already in scope in installBeats, and `segmentProjection`/`chamberProjection` both stamp `kind: 'secret'` for the culvert segments and the bell-cistern chamber. Change `if (Math.hypot(player.x - S.strikePos.x, player.z - S.strikePos.z) < 22) {` to:
      const where = projectUnderfalls(layout, player.x, player.z);
      if (where && where.kind === 'secret' && where.clearance <= 0) {
The toll then only sounds to someone standing in the culvert or the cistern. Accept the consequence: it rewards the player who went in rather than luring them in. If a lure is genuinely wanted, it needs a separate, quieter cue at the culvert MOUTH (layout.secret[0], which is main[3] 'pump approach'), not a louder radius on a sound that is 30 m away behind rock.


### Execute THIS (the challenged, corrected plan)

The plan's diagnosis is correct and unusually well-sourced. Screenshot 8 IS the fallen bell in buildBellCistern (src/underfalls.js:1085-1180); round twelve (commit 4a2d5fd) already fixed the floating half and Alex has not played it; the object genuinely has no ticker, no voice of its own beyond one metalDrop one-shot at 1573-1577, and no collider; it genuinely cannot be a fetch target because the skull vanishes at the waterfall; the 10-draw cost inside the cave's 137/450 is exactly right (I recounted the keepsake loop instance-by-instance); and none of the known traps are reintroduced — no finishStatic material-identity comparison, no new light against the pinned census, no scene-level renderRoot, no new geometry, no unguarded per-frame dereference, no HUD, no on-screen text, no hue-only meaning, and no touch on the throw grammar. Apply Option A, not Option B.

Before applying, convert every anchor and replacement block to CRLF — both target files are uniformly CRLF and the plan is written in LF, so the three multi-line anchors will not match verbatim.

Then apply Steps 1-5 with these five changes. (1) Reduce the offset and the collider: `const bx = C.x + 1.45, bz = C.z - 1.31;` and `addColliderCylinder(world, bx, bz, 0.75, C.y - 0.4, C.y + 1.44, 'fallen bell');`. At 2.195 m / 0.90 the box's far corner lands 3.467 m from the chamber centre against a 3.45 m walkable radius, which creates a per-frame fight between _moveAxis and installClamp; at 1.95 m / 0.75 it sits 3.01 m out and every gate margin roughly doubles. (2) In Step 2, either leave line 1171 alone or move the ring AND shrink it to `RingGeometry(1.22, 1.40, 28)` — at its current 2.28 outer radius, moved, about a metre of it overhangs the 3.519 m chamber floor disc and clips the wall-stone ring atmosphere.js builds at ~3.8 m. (3) In Step 5, replace the hardcoded `< 22` earshot with a membership test — `const where = projectUnderfalls(layout, player.x, player.z); if (where && where.kind === 'secret' && where.clearance <= 0)` — because at 22 m the toll is audible from the main route at 7.8 m through solid rock, which the plan's own open question forbids and which inverts the quiet-vs-loud economy. (4) Either delete the `S.clapper.position.x` line or drop its amplitude to 0.04; at 0.11 the 0.24-radius clapper pushes through a lathe wall whose inner radius at that height is ~0.287. (5) Propagate the new bx/bz into Step 3's bellLight and Step 4's strikePos, and pull the light back toward the shelf (`bx - 1.05, C.y + 2.4, bz + 0.85`) so the keepsakes — which the module's own comment calls the actual secret — do not lose ~44% of their light.

Keep Step 6 deferred; when it lands, its y is a BASE not a centre (atmosphere.js:1993 adds h*0.5), so the plan's tuple hangs the water 0.16 m above the bell mouth and 1.5 m below the vault — it needs `[cistern.x + 1.45, cistern.y + 1.30, cistern.z - 1.31, 0.16, 3.9, 0.7]`.

Correct the record in the patch comments: the pump chapel colliders are at underfalls.js:872 and 895 (not 873 and 886); the gate's collider filter is at underfalls-expansion.mjs:167 (not 168); cave enemy pathing DOES consult world.colliders through findUnderfallsRoute's edgeAllowed hook (enemies.js:2060, 2148, 2186), so say the collider clears the nav chords by arithmetic rather than claiming pathing ignores colliders; the chosen flank is the INSIDE of the bend, forced because the outside is the shelf; and "this was an omission, not a policy" contradicts commit 4a2d5fd's own statement that nothing in this district has a collider, so frame it as a judgement.

Gates: tests/underfalls-expansion.mjs decides (the collider/centreline test at 167-182 and the secret walk at 203-220), then tests/district-culling-regression.mjs (renderRoots >= 5, cave draw calls < 450, caveLights === 9), then the standing four. tests/legibility-regression.mjs is worth running but pins nothing in the cave, so it cannot answer whether the rock or the toll actually read — that still needs a rendered frame from the pump-undercroft approach via canvas.toDataURL, exactly as the plan's MEASUREMENT NEEDED #1 says.

### Findings

- **The object is the fallen bell in the 'bell cistern' — the payoff of the optional secret culvert. The authorial intent is stated outright: the district drips everywhere, and this is the one dry place. 'noticing is the reward' — there is deliberately no pickup and no key. The screenshot's 'workbench with tools below left' is the keepsake shelf at C.x-1.8 / C.z+2.0 with 13 instanced rings and rods on it; the 'lit rim' is the pale torus at the bell's mouth.**
  - `underfalls.js:1102`
  - evidence: // The bell is upside down and full of perfectly dry lost objects while the   // whole district drips. There is no pickup and no key: noticing is the reward.   // A lathed open bell reads as a bell from below. The previous clipped sphere   // became an enormous black egg at first-person distance and hid the dry   // keepsake shelf—the actual secret. Here the mouth faces upward, wrong-way,   // and a pale rim makes that inversion readable by value and silhouette.

- **The 'hanging from the ceiling' half of the complaint is ALREADY FIXED in this worktree, on commit 4a2d5fd ('The cave walls follow the lane, and the bell sits down'), which quotes his exact sentence. Alex has NOT played this. Before the fix the bell spanned world y 2.43→3.87 with a snapped chain above it — which is precisely 'a very large dark cone hanging from the cave ceiling'. Identification is therefore corroborated by two independent routes.**
  - `underfalls.js:1112`
  - evidence: // IT SITS ON THE FLOOR, WHICH IS WHERE A FALLEN BELL IS.   ... So a two-metre dark iron object   // floated unattached, dead centre of the walking line, over a marked ring,   // under a snapped chain that misses it by half a metre — mechanism grammar,   // in a district whose previous lesson was that a suspended dark metal disc is   // a thing you throw the skull at. Alex, on the live build: "what is this, it   // doesn't move or do anything."

- **BEHAVIOUR: none, beyond a single one-shot. `state.secret` is referenced in exactly one place in the whole codebase outside its own constructor — this block. It fires once, ever, sets a flag nothing reads outside a test, and plays `metalDrop` (a dropped-metal-object sound). Nothing rotates, swings, drips, or lights. `state.secret.bell` and `state.secret.clapper` are stored on state at line 1179 and never read again by anything.**
  - `underfalls.js:1573`
  - evidence: if (!state.secret.discovered && player.distanceToSquared(state.secret.position) < 3.05 * 3.05) {       state.secret.discovered = true;       game.flag('underfallsSecret');       game.audio.metalDrop({ pos: state.secret.position.clone().add(new THREE.Vector3(0, 2.4, 0)), gain: 0.36, rate: 0.44, verb: 0.95 });     }

- **It CANNOT be made a fetch target. The skull is destroyed at the waterfall, before the cave exists as a playable act. `underfalls.js` line 1 names the district 'skull-less'. Any plan that says 'throw the skull into it' is dead on arrival.**
  - `director.js:1240`
  - evidence: if (g.flags.has('waterfallTaken')) {       ...       g.skull.vanish();     }   // skull.js:1288 — vanish() { // the waterfall. it does not come back.  this.mode = 'gone';

- **POSITION / SIZE. Authored in cave-local coordinates: the chamber node is `{ x: 27, z: 68, y: 1.25, r: 3.45, name: 'bell cistern', secret: true }`, and `worldNode` adds only x/z from `game.clearingCenter`, leaving y absolute. The bell sits at exactly that node — its axis IS the secret route's centreline. Lathe profile spans radius 0.18→1.03 over height 0→1.44, so 2.06 m across the mouth and 1.44 m tall; the pale rim torus (R 1.03, tube 0.075) makes the widest read 2.21 m; the marked dry ring on the floor is an annulus 2.05→2.28 (4.56 m across); the snapped chain hangs at C+(0.48, 3.45, -0.20).**
  - `underfalls.js:1128`
  - evidence: const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);   bell.position.set(C.x, C.y, C.z);   ...   const bellRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.075, 7, 24), pale);   bellRim.position.set(C.x, C.y + 1.44, C.z);

- **MATERIAL. Two clones and one shared: `iron` = M.metal.clone() tinted 0x3d3c37, roughness 0.5, emissive 0x120b05 @ 0.28 (bell, clapper, chain, iron keepsakes); `pale` = M.bone.clone() darkened ×0.7 (rim, pale keepsakes); the shelf uses M.woodDark directly; the dry ring is its own MeshBasicMaterial 0xa6b0ad @ 0.27 opacity, DoubleSide. Because none of these go through `world.box`, `finishStatic()` never merges them — they are ten independent draws, and the shell-clone trap does not apply here.**
  - `underfalls.js:1092`
  - evidence: const iron = M.metal.clone();   iron.color.setHex(0x3d3c37);   ...   const pale = M.bone.clone();   if (pale.color) pale.color.multiplyScalar(0.7);

- **DRAW-CALL COST: 10 draws inside the cave's 137/450, plus one census-pinned PointLight and one pooled candle descriptor (free). Breakdown: bell, bellRim, clapper, snapped chain, shelf, dryRing = 6 Meshes; 4 InstancedMesh batches (2 pale rings, 3 iron rings, 2 pale rods, 6 iron rods — `addInstances` returns null on an empty array, and none are empty). Only the bell casts a shadow. The bell tableau proper (bell+rim+clapper+chain+dryRing) is 5 of the 10. The cave has 313 draws of headroom; cost is not the constraint here.**
  - `underfalls.js:1164`
  - evidence: addInstances(group, ringGeo, pale, lost.ringPale, { name: 'dry pale keepsake rings' });   addInstances(group, ringGeo, iron, lost.ringIron, { name: 'dry iron keepsake rings' });   addInstances(group, rodGeo, pale, lost.rodPale, { name: 'dry pale keepsake rods' });   addInstances(group, rodGeo, iron, lost.rodIron, { name: 'dry iron keepsake rods' });

- **NEW DEFECT INTRODUCED BY THE ROUND-TWELVE FIX: `buildBellCistern` adds no collider of any kind, and the bell now stands on the floor on the exact secret-route centreline. The pump chapel in the same file DOES add colliders (pillars, altar), so this is an omission, not a district policy. Result: the player walks through a 2.06 m iron bell — the same sentence as his screenshots 4, 5 and 6.**
  - `underfalls.js:873`
  - evidence: addColliderCylinder(world, x, z, 0.54, -0.5, 3.2, 'pump chapel pillar');   // ...and at 886: addColliderCylinder(world, altarX, altarZ, 1.28, -0.4, 1.1, 'pump altar');   — buildBellCistern (1085-1180) contains no addCollider* call at all

- **A collider CANNOT simply be added at the bell's current position: the gate walks the secret route node-to-node and requires arrival within 0.62 m of each node, and a separate check fails any underfalls collider within 0.32 m of a 0.55 m-spaced centreline sample. A 0.90-half-extent box centred on the node blocks the player at 1.24 m and sits 0 m from a sample. The bell must move off the lane before it can be solid.**
  - `underfalls-expansion.mjs:168`
  - evidence: const routeColliders = g.world.colliders.filter((c) => c.underfalls);     const blockedCenters = [];     for (const s of [...mainSamples, ...secretSamples]) {       const hit = routeColliders.find((c) => c.max.y > s.y + 0.55 && c.min.y < s.y + 1.75         && s.x >= c.min.x - 0.32 && s.x <= c.max.x + 0.32         && s.z >= c.min.z - 0.32 && s.z <= c.max.z + 0.32);

- **OPTION B IS NOT A DELETE. `state.secret` is dereferenced unguarded every frame the player is in the cave, and a gate asserts both `U.secret.discovered` and the `underfallsSecret` flag. Removing `buildBellCistern` throws a TypeError on line 1573 on the first cave frame and kills the district; removing only the meshes still requires keeping the `state.secret` object alive.**
  - `underfalls-expansion.mjs:213`
  - evidence: secretWalk.every(Boolean) && U.secret.discovered && g.flags.has('underfallsSecret')         && L.secretLength < mainBetweenJoins,

- **The tools this plan reuses already exist and are already used in this district. `audio.bellRing({ dark: true })` is a five-partial dark bell with a noise strike and full HRTF positioning; `audio.caveDrip` refuses to play without a position ('A drip without a source is just a UI click'); `pinLight` mutes by COLOUR specifically so that `light.intensity = ...` writers keep working — which is how `state.pump` and `state.sluice` already animate their lights.**
  - `world.js:1100`
  - evidence: // Muting by colour rather than by intensity leaves every existing     // `light.intensity = ...` writer in the codebase working untouched


### Raw steps (superseded by the corrected plan above where they conflict)

**1. OPTION A, step 1 of 5 — step the bell off the walking line onto its own pivot, and make it solid. The pivot is required because the pale rim and the clapper are currently SEPARATE world-positioned meshes: rotating `bell` alone would leave the rim behind, and the rim is the only part of the object that reads by value. A THREE.Group costs zero draw calls and is not a scene child, so `cave.renderRoots.length` is unchanged. The 2.2 m offset is along the lane's outward normal on the flank OPPOSITE the keepsake shelf, computed from the secret polyline (22,59)→(27,68)→(37,75): mean heading (0.6697, 0.7428), outward normal (0.7428, −0.6697), ×2.195 = (+1.63, −1.47).** — `underfalls.js`

_anchor:_
```js
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);
  bell.position.set(C.x, C.y, C.z);
  bell.castShadow = true;
  group.add(bell);
  const bellRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.075, 7, 24), pale);
  bellRim.position.set(C.x, C.y + 1.44, C.z);
  bellRim.rotation.x = Math.PI / 2;
  group.add(bellRim);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), iron);
  clapper.position.set(C.x, C.y + 0.28, C.z);
  group.add(clapper);
  const snapped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 5), iron);
  snapped.position.set(C.x + 0.48, C.y + 3.45, C.z - 0.2);
  snapped.rotation.z = 0.55;
  group.add(snapped);
```

_change:_
```js
  // ...AND IT STANDS BESIDE THE LANE, NOT ON IT, SO IT CAN BE SOLID.
  //
  // Sitting it down left a 2.06 m iron bell on the exact secret-route node
  // with no collider of any kind — this district contains the player with a
  // lateral clamp, and a clamp slides you instead of stopping you. So you
  // walk through it, which is the same sentence as his screenshots 4, 5 and
  // 6: a thing that is drawn and is not there. The pump chapel two hundred
  // lines up already gives its pillars and its altar real colliders; this was
  // an omission, not a policy.
  //
  // 2.2 m along the lane's outward normal, on the flank opposite the keepsake
  // shelf. That leaves 0.93 m of clear stone between the collider's nearest
  // corner and the centreline — tests/underfalls-expansion.mjs samples both
  // polylines every 0.55 m and fails any authored underfalls collider within
  // 0.32 m of a sample, and separately walks the secret route node to node
  // needing to arrive within 0.62 m of each. Both hold with margin. Moving
  // the ROUTE instead would change secretLength, which the same gate checks.
  //
  // Bell, rim and clapper hang off ONE pivot at the bell's base so the tick
  // in installBeats can rock the whole assembly and keep the pale rim — the
  // only part of this object that survives a lantern — attached to the dark
  // iron it belongs to. A Group is free: no draw call, no renderRoot.
  const bx = C.x + 1.63, bz = C.z - 1.47;
  const bellPivot = new THREE.Group();
  bellPivot.position.set(bx, C.y, bz);
  group.add(bellPivot);
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);
  bell.castShadow = true;
  bellPivot.add(bell);
  const bellRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.075, 7, 24), pale);
  bellRim.position.set(0, 1.44, 0);
  bellRim.rotation.x = Math.PI / 2;
  bellPivot.add(bellRim);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), iron);
  clapper.position.set(0, 0.28, 0);
  bellPivot.add(clapper);
  // The chain stays where it broke. Overhead, and now to the side, which is
  // the whole story in one silhouette: the bell hung there, and it is not
  // there any more.
  const snapped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 5), iron);
  snapped.position.set(C.x + 0.48, C.y + 3.45, C.z - 0.2);
  snapped.rotation.z = 0.55;
  group.add(snapped);
  addColliderCylinder(world, bx, bz, 0.90, C.y - 0.4, C.y + 1.44, 'fallen bell');
```

**2. OPTION A, step 2 of 5 — the dry ring is the bell's rain shadow, so it travels with the bell. Leaving it on the node would leave a marked circle with nothing standing in it, which is a second unexplained object.** — `underfalls.js`

_anchor:_
```js
  dryRing.position.set(C.x, C.y + 0.025, C.z);
```

_change:_
```js
  dryRing.position.set(bx, C.y + 0.025, bz);
```

**3. OPTION A, step 3 of 5 — aim the district's one cistern light at the bell so the pale rim keeps its value contrast against the dark iron after the move. Do NOT add a second PointLight: the shader light census is pinned at boot (World.pinLightCensus) and adding one recompiles every lit material in the game. The shelf keeps its own candle descriptor at C.x−2.4 / C.z+1.8, r 4.5, which still covers it, and this light at distance 12 / decay 1.15 still reaches the shelf at ~4.2 m.** — `underfalls.js`

_anchor:_
```js
  bellLight.position.set(C.x - 0.6, C.y + 2.25, C.z + 0.5);
```

_change:_
```js
  bellLight.position.set(bx - 0.55, C.y + 2.4, bz + 0.45);
```

**4. OPTION A, step 4 of 5 — hand the tick the handles it needs. `position` deliberately stays the CHAMBER NODE: it is the discovery trigger radius and the route point the gate walks to, and moving it would change what the gate measures. `strikePos` is the new acoustic origin — the mouth of the bell, where the water lands.** — `underfalls.js`

_anchor:_
```js
  state.secret = { group, bell, clapper, position: new THREE.Vector3(C.x, C.y, C.z), discovered: false };
```

_change:_
```js
  // `position` stays the CHAMBER NODE, not the bell: it is the discovery
  // radius and the route point the gate walks to. `strikePos` is where the
  // water lands, which is where the sound has to come from.
  state.secret = {
    group, bell, clapper, pivot: bellPivot, light: bellLight,
    position: new THREE.Vector3(C.x, C.y, C.z),
    strikePos: new THREE.Vector3(bx, C.y + 1.15, bz),
    discovered: false,
    rock: 0, ringT: 3.4, ringIndex: 0,
  };
```

**5. OPTION A, step 5 of 5 — the behaviour itself, inserted in the existing installBeats ticker (already gated by `if (!inCave) return;` at line 1494, so it costs nothing outside the cave and cannot perturb the bellRing counters in tests/house-critical-path-regression.mjs). Replace the whole discovery block. Zero new draw calls, zero new geometry, zero new lights, one existing audio one-shot, ~10 float ops a frame. Cadence is a fixed array indexed by a counter — no Math.random and no setTimeout, so a playthrough stays bit-identical.** — `underfalls.js`

_anchor:_
```js
    if (!state.secret.discovered && player.distanceToSquared(state.secret.position) < 3.05 * 3.05) {
      state.secret.discovered = true;
      game.flag('underfallsSecret');
      game.audio.metalDrop({ pos: state.secret.position.clone().add(new THREE.Vector3(0, 2.4, 0)), gain: 0.36, rate: 0.44, verb: 0.95 });
    }
```

_change:_
```js
    // THE FALLEN BELL IS THE ONE IRON THING IN A ROOM MADE OF WATER.
    //
    // Alex, on the live build: "what is this, it doesn't move or do anything."
    // Round twelve answered half of that — it was floating, and now it is on
    // the floor. This is the other half, and he was literally right: it had no
    // ticker, no target, no light of its own and no voice. The only line in
    // the whole codebase that ever named it was the one-shot below, and that
    // one-shot played metalDrop — a dropped spanner. The room's only bell made
    // the sound of something else falling over.
    //
    // It cannot be a fetch target. The skull is GONE by the time anyone stands
    // here (director.waterfallTaken -> skull.vanish, "the waterfall. it does
    // not come back"), so the answer cannot be a verb. It is the district
    // answering itself: water off the broken vault finds the iron, the iron
    // answers, and the bell rocks because a bell resting mouth-up on its crown
    // is not stable. That is what the dry ring underneath has always meant.
    //
    // The toll only sounds inside earshot, so it is a landmark you can walk
    // TOWARD in a district with no map and no HUD — audio-first, and quiet:
    // this is dressing on an optional shortcut, it must never call company.
    const S = state.secret;
    if (S.pivot) {
      if (Math.hypot(player.x - S.strikePos.x, player.z - S.strikePos.z) < 22) {
        S.ringT -= dt;
        if (S.ringT <= 0) {
          const cadence = [7.3, 11.6, 9.1, 13.8];
          S.ringT = cadence[S.ringIndex % cadence.length];
          S.ringIndex++;
          S.rock = 1;
          game.audio.caveDrip({ pos: S.strikePos, gain: 0.26, rate: 1.22, verb: 0.9 });
          game.audio.bellRing({
            pos: S.strikePos, gain: 0.17 + (S.ringIndex % 3) * 0.015,
            rate: 0.33, verb: 0.96, dark: true,
          });
        }
      }
      // It never fully stops. The idle wobble is what a two-tonne thing
      // balanced on its narrow end does; the struck rock is six times it and
      // decays over about three seconds. Value and motion carry it — the pale
      // rim swings against dark iron, which is all a lantern leaves behind —
      // and no part of the read is hue.
      S.rock = Math.max(0, S.rock - dt * 0.34);
      const amp = 0.012 + S.rock * S.rock * 0.075;
      S.pivot.rotation.z = Math.sin(t * 1.05) * amp;
      S.pivot.rotation.x = Math.cos(t * 0.83) * amp * 0.72;
      S.clapper.position.x = Math.sin(t * 2.9) * 0.11 * S.rock;
      S.light.intensity = 13.5 + S.rock * 10.5;
    }

    
```

**6. OPTION A, OPTIONAL step 6 — give the water you now hear a visible source, for zero extra draw calls, by appending one narrow instance to the existing underfalls cataract InstancedMesh. Place it directly over the bell mouth (the same +1.63/−1.47 offset). SIDE EFFECT TO ACCEPT OR AVOID: the mist loop twenty lines below seeds 132 glow points from `drops[i % drops.length]`, so growing the array from 13 to 14 redistributes the mist. No gate pins mist positions (district-culling only counts the batch by name, 'underfalls displaced spray'), but it is a visible change to the whole district's spray, so treat this step as separable from steps 1–5 and land it with the deferred steam/drip work (his note #7) rather than on its own.** — `atmosphere.js`

_anchor:_
```js
    if (layout.secret?.[0] && layout.secret?.[1]) {
      drops.push(curtainAt(layout.secret[0], layout.secret[1]));
    }
```

_change:_
```js
    if (layout.secret?.[0] && layout.secret?.[1]) {
      drops.push(curtainAt(layout.secret[0], layout.secret[1]));
    }
    // One thin line of water falling into the fallen bell, so the toll the
    // cistern makes has something you can see making it. Same instanced draw
    // as every other cataract: this costs nothing. Offset matches the bell in
    // underfalls.js buildBellCistern (bx/bz = C + 1.63 / -1.47).
    const cistern = layout.chambers.find((c) => c.name === 'bell cistern');
    if (cistern) {
      drops.push([cistern.x + 1.63, cistern.y + 1.6, cistern.z - 1.47, 0.16, 2.6, 0.7]);
    }
```

**7. OPTION B (documented, NOT recommended) — if it is cut anyway, cut ONLY the bell tableau and keep the shelf and the state object alive. Deleting `buildBellCistern` outright throws a TypeError on line 1573 on the first cave frame; deleting `state.secret` fails the gate at tests/underfalls-expansion.mjs:213. Frees 5 of the cave's 137 draws (bell, rim, clapper, chain, dry ring) against a 450 ceiling with 313 already spare — the saving buys nothing. What the district then looks like: the optional culvert becomes a corridor with a bulge in it, a wooden shelf holding thirteen small objects, one candle and one point light with nothing to light; the snapped chain overhead loses its referent and becomes the same unexplained-object defect one level down; and the module's own stated reward — 'noticing is the reward' — has nothing left to notice.** — `underfalls.js`

_anchor:_
```js
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);
  bell.position.set(C.x, C.y, C.z);
  bell.castShadow = true;
  group.add(bell);
```

_change:_
```js
  // CUT PATH ONLY — delete bell, bellRim, clapper, snapped and dryRing
  // (lines 1128-1142 and 1168-1172), and change the state assignment at 1179
  // to `state.secret = { group, position: new THREE.Vector3(C.x, C.y, C.z), discovered: false };`
  // so line 1573 still has an object to read and the gate still sees the
  // flag. Keep the shelf, the keepsakes, the candle and the point light.
  // Also delete the `snapped` chain in the same pass: a broken chain with
  // nothing under it is the identical defect at smaller scale.
```


### Cost

Draw calls: +0 for steps 1-5 (a THREE.Group renders nothing; the collider is not drawn; no new mesh, no new material, no new light). The cistern stays at its current 10 draws inside the cave's 137/450. Step 6 is also +0 draws — it grows an existing InstancedMesh's count from 13 to 14. Per-frame CPU, cave only: one Math.hypot, one subtract-and-compare, two Math.sin, one Math.cos, four property writes — call it under a microsecond, and strictly zero outside the cave act because the ticker returns early. Light census: unchanged, which is the point — `pinLightCensus` is why writing `light.intensity` is allowed and adding a PointLight is not. Colliders: +1 in a list that already holds at least 8 for this district. Implementation effort: one file, five contiguous edits, roughly 90 lines net (about 55 of them the comment block the codebase's own standard requires); step 6 is a further 5 lines in a second file and should be deferred. Gates to run: `tests/underfalls-expansion.mjs` (the collider and the secret walk — this is the one that decides), `tests/district-culling-regression.mjs` (renderRoots count and the 450 ceiling), `tests/legibility-regression.mjs`, then the standing four.

### Risk

Low-to-moderate, and every moderate part is in step 1. (1) The collider is the only genuinely new physics in the district's optional branch; the geometry says it clears the centreline by 0.93 m against a 0.32 m gate threshold and leaves the node standable with 0.59 m of margin against a 0.34 m player radius, but this is arithmetic from source, not a measured run — `tests/underfalls-expansion.mjs` is the gate that decides, and it must be run. (2) Enemy pathing in the cave uses `findUnderfallsRoute` over the layout graph, not colliders, so the Drowned Choir's route is unaffected in principle; whether its capsule collides with world colliders is not established here — `tests/playthrough.mjs` covers it, and the pump chapel's existing pillar colliders are the precedent that says this is safe. (3) Steps 2-5 are behaviour-only and carry near-zero risk: no draw calls, no lights, no geometry, no new material, no randomness, and the whole tick sits behind the existing `if (!inCave) return;` so no other act can see it. (4) The one thing that CANNOT be verified from source is whether the rock amplitude and the toll's gain read at lane distance — that is the project's own recurring failure mode (working-but-illegible) and it needs a rendered frame, not an argument. (5) Do NOT wire the toll into `director.forestNoise`, `_companyDebt`, or any Choir trigger: this is dressing on an optional shortcut, and making a secret summon company inverts the quiet-vs-loud economy.

### Open questions

- WHICH OPTION SERVES THE LAW — the answer is A, and not marginally. This codebase's standard is that an object the player asks 'what is this' about has already failed the legibility law, and the law names exactly which channels survive a dark room lit by one carried light: value, shape, motion, timing, sound. The bell currently offers shape only, in a district where the module's own comment says the reward for finding this room IS this object. Cutting it does not satisfy the law, it evacuates the question: the secret culvert exists in SECRET_LOCAL specifically so that 'looking closely saves a little distance and exposes the bell cistern', and with the bell gone the player who looked closely is rewarded with a wider bit of corridor and a shelf. Worse, cutting the bell leaves the snapped chain hanging with nothing under it — the same failure at smaller scale, which is how this project has repeatedly turned one unexplained object into two. Option A gives the object the three channels it was missing (motion, sound, a light that answers) using systems that already exist in this exact file, for zero draw calls, without a verb, without a HUD, without touching the critical path, and without making the optional shortcut into a puzzle step. It also repairs the walk-through, which is the failure category he complained about three separate times in the same set of notes.
- MEASUREMENT NEEDED #1 — is the rock visible from the lane? At the proposed amplitudes the rim (1.44 m above the pivot) travels ~0.017 m at idle and ~0.125 m struck. Idle is almost certainly a close-range read only. Settle it by rendering a frame from the secret route's approach (the 'pump undercroft' node) with the bell mid-strike and again at rest, reading `canvas.toDataURL` — page.screenshot composites the WebGL canvas black headless — and comparing the rim's pixel displacement and its luminance ratio against the iron behind it. If it does not read, raise the struck term from 0.075 toward 0.11 before touching the idle term; a large idle wobble on a two-tonne object reads as a balloon.
- MEASUREMENT NEEDED #2 — absolute world coordinates. Everything above is in cave-local terms because `worldNode` adds `game.clearingCenter.x/z` (itself derived at runtime from the forest spline endpoint plus 22 in `buildClearing`), and only y is absolute (1.25). Anyone who needs the real numbers should read `window.__game.underfalls.layout.bellCistern` in a live page rather than deriving them.
- MEASUREMENT NEEDED #3 — audible radius. The 22 m earshot gate is a guess sized to reach roughly from the culvert mouth; the real question is whether the toll is audible from the MAIN route (the pump chapel) and therefore becomes a lure toward a shortcut the player has not found. That may be desirable or may leak the secret. Settle it by measuring the straight-line distance from the chapel aisle to the cistern in the built layout and deciding deliberately; do not leave 22 in place by default.
- ALTERNATIVE IDENTIFICATION, considered and excluded — the only other upturned-bowl object in the district is the pump chapel's `bellJar` (src/underfalls.js:916), a clipped sphere r 0.58, y-scaled 1.32, at the top of the piston. It is PALE, roughly 1.16 m across, and already animates (`p.bellJar.rotation.y`). Screenshot 8 describes a very large DARK cone with a lit rim beside a bench of tools. Only the cistern matches on all four counts, and the round-twelve commit reached the same identification independently.
- NOT PROPOSED, deliberately — an E-interact to strike the bell. `world.registerInteract` is available and the cave already uses E for the hatch, so it would be grammatical. It is left out because a verb on an optional secret turns 'noticing is the reward' into a puzzle step, and because the fix he actually asked for is that the thing be alive, not that it be operable. Revisit only if a rendered check shows the passive read still fails.
- OUT OF SCOPE BUT ADJACENT — the keepsake shelf (3.8 x 0.18 x 0.75 at C.x-1.8 / C.z+2.0, top at C.y+0.81, above the 0.5 m STEP_UP) is also collider-less and also walk-through. It sits ~2.0 m off the node on the opposite flank, so a collider there faces the same centreline-clearance arithmetic. Fold it into the walk-through work for screenshots 4/5/6 rather than into this one.


---

<a id="walkway"></a>

## walkway

**The walkway is the "wet line" in src/underfalls.js:584-613 — 145 butted boxes, 125.16 m long and 2.12-3.44 m wide, each wearing ONE stretched 256 px headstone tile (BoxGeometry UVs are 0..1 per face) over a constant, unmapped emissive, in a district with no shadow-casting light and no colliders to bake contact shading from; it is one huge pale flat slab because literally nothing modulates its surface, and the fix is to cut it into ~0.6 m flags (which fixes the UV scale and revives the bump map for free), give it joints, a value ladder and a verge — not to change its brightness.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **Step 2's prose and its anchor disagree about what gets deleted. The prose says "Replace src/underfalls.js lines 584-613 IN FULL (the comment block from '// THE WET LINE.' through the closing '}')", but the anchor starts at line 590 (`const wetStone = M.headstone.clone();`). Lines 584-589 are the old six-line `// THE WET LINE.` comment, whose last sentence reads "One cloned material = one draw call for the entire ribbon (world.box merges by material)" — false the moment the patch lands. An applier following the anchor leaves that stale comment sitting directly above the new `// THE WET WALKWAY — PAVING NOW, NOT A RIBBON.` block; an applier following the prose deletes six lines the anchor never quoted. This is exactly the implicit thing the deliverable spec forbids.**
  - _fix:_ Extend the step-2 anchor upward by six lines so it begins at line 584 and is unambiguous. The exact text to prepend to the anchor (CRLF in the file):

  // THE WET LINE. One pale, slightly raised ribbon runs the whole MAIN route
  // and none of the culvert: the way forward is the wet way, told in value
  // and geometry, never in hue. This is the single strongest answer to
  // Alex's "just has you walking through rocks and random things" — the
  // route now draws itself on the floor. One cloned material = one draw
  // call for the entire ribbon (world.box merges by material).

The replacement text is unchanged; it already opens with its own comment block.

- **src/underfalls.js uses CRLF line endings (1671 CR characters across 1672 lines). The three multi-line anchors (steps 2, 4, 5) are written in the plan with LF joins. A literal string-replace with those anchors finds nothing — I reproduced this: steps 4 and 5 matched 0 times against the raw bytes and 1 time each after normalising CRLF to LF. Whoever applies this will either fail outright or, worse, hand-retype the anchor and edit the wrong span.**
  - _fix:_ State in the plan that the file is CRLF and that every anchor and every replacement block must use \r\n. Concretely: match with a CRLF-aware tool (or normalise the anchor to the file's endings before searching), and write the replacement with CRLF so the file does not end up with mixed endings and a spurious whole-file diff on the next commit.


### Execute THIS (the challenged, corrected plan)

The plan's diagnosis is right and is the most thoroughly source-verified analysis I have checked in this repo: I independently recomputed 145 boxes, 125.158 m, widths 2.116-3.440 m, 676 flags, 290 verge stones, 966 total, 2.075 m verge reach, and the sluice tread pitches 0.9558/0.9834/0.9791 against 0.76 m — every one matched. `if ('roughness' in wetStone)` really is dead code (vendored r161 MeshLambertMaterial has no `roughness`, verified in the ctor), the UV smear is real and is the same law commit 515ebef wrote down for the ossuary, the emissive really is an unmodulated constant, no light in the district casts a shadow, the AO really is ~1.0 because it is baked from colliders the route does not have, the moon really is never dimmed per act, and the chamber disc / corridor strip / hatch square really do all top out at exactly y. All seven code anchors exist verbatim and uniquely.

Ship it with these corrections, in this order.

FIRST, fix applicability. The file is CRLF (1671 CR / 1672 lines) — every multi-line anchor and every replacement must use \r\n or the edit will not find its target. And extend the step-2 anchor upward six lines to line 584 so the stale `// THE WET LINE.` comment (which claims "one draw call for the entire ribbon") is deleted with the code it describes, instead of being orphaned above the new comment.

SECOND, fix the one real geometry bug in step 2: the row `shift` moves the flags but not the verge, so on alternate courses the outer flag drives up to 104 mm through the kerb while the opposite shoulder opens a 214 mm gap. Add `const edge = side * (half + JOINT + width * 0.5) + shift;` and place both verge stones at `x + nx * edge` / `z + nz * edge`.

THIRD, correct the numbers that ship as source comments: the ribbon's self-overlap is ~61 mm, not 0.08 m and not 0.0584 m; the bump gradient returns ~4.5x ACROSS the route and only ~1.1x along it; and the boot-cost claim should say "a wash, unmeasured" rather than "goes DOWN".

FOURTH, split the commit. Steps 1-2 and 3a/3b/3c are the patch. Step 5 (quartering the sluice treads) is correct as written — the local-X trigonometry checks out and it costs no draw call — and can ride along. Step 4 (sleeping the moon) must NOT be in it: it contradicts director.js:55-58, which records that this exact district already lost its wet line between fixtures once its global light dropped, and it snaps the moon 1.3 to 0 in one frame at the act boundary Alex has already complained about. If the A/B says it helps, it ships separately and ramps with `damp()`, never as an assignment. Step 6 is prose, not a patch — its anchor is ambiguous (two hits) and the instrument it describes does not exist in that file; file it as its own task, and when it is written, use the file's existing `read()` toggle-and-diff against the three flag batches rather than inventing band sampling.

FIFTH, reorder the open questions. The screenshot-9 identification can be settled BEFORE any code moves: `material.userData.shellOf` (world.js:120) and `world.shellFor()` (world.js:95) already distinguish the walkway shell from the rock shell, contrary to what openQuestion 1 says, so raycast down from three route poses first and confirm the subject.

Two things to watch that the plan does not flag: the walkway moves out of the always-drawn world shell into renderRoots, so it now appears with the dressing rather than before it (check the mouth approach in a frame), and the three tiers drop the walkway's mean value to ~0.88 of today's with a 0.52 kerb — measure walkway-vs-shoulder contrast in the between-fixtures stretches after step 2 alone before anything else darkens.

Gate-wise nothing here breaks: cave 137 to ~140 against a 450 ceiling asserted six times in district-culling-regression; `renderRoots.length >= 5` is a floor and moves 6 to 10; playthrough and underfalls-expansion both resolve floors through analytic `underfallsGroundAt`, never a raycast; `_crosshairTarget`/`_occluded` use curated lists so 966 instances cost nothing per frame; and the boot shader warm-up covers the four new materials because `renderer.compile` walks with `scene.traverse` ignoring visibility (main.js:555, verbatim) and `_warmDrawProxy` handles hidden InstancedMeshes.

### Findings

- **The walkway under the waterfall IS the 'wet line' ribbon, and it is the only pale surface on the cave route. It is 145 world.box calls in ONE merged batch: 12 main segments, n = ceil(len/0.9) pieces each, 125.16 m total. Each piece is 2*clamp(w*0.46, 0.94, 1.72) wide (computed: 2.12-3.44 m), 0.06 m thick, (len/n + 0.08)*0.98 deep (0.887-0.956 m), sitting 0.012 m above an M.rock floor strip whose top is at the route y. Round eleven's own record names it: 'every cave screenshot shows the lit ribbon, and the ribbon looks fine.'**
  - `underfalls.js:602`
  - evidence: for (const seg of layout.mainSegments) {     const n = Math.max(2, Math.ceil(seg.length / 0.9));     const yaw = Math.atan2(seg.dx, seg.dz);     for (let i = 0; i < n; i++) {       const t = (i + 0.5) / n;       const w = lerp(seg.a.w, seg.b.w, t);       world.box(wetStone,         lerp(seg.a.x, seg.b.x, t), lerp(seg.a.y, seg.b.y, t) + 0.012,         lerp(seg.a.z, seg.b.z, t),         2 * clamp(w * 0.46, 0.94, 1.72), 0.06, (seg.length / n + 0.08) * 0.98, yaw);     }   }

- **THE MATERIAL IS LAMBERT, NOT STANDARD — so round seven's 0.04-specular blow-out law does NOT apply here and must not be used to explain this. M.headstone = lam(...) = MeshLambertMaterial. Verified against the vendored r161 build: the MeshLambertMaterial constructor has no roughness property at all. That makes underfalls.js:597 dead code — the 'wet sheen' it asks for has never once been assigned, in any build.**
  - `underfalls.js:597`
  - evidence: const wetStone = M.headstone.clone();   ...   if ('roughness' in wetStone) wetStone.roughness = 0.16; // textures.js:1236  M.headstone = lam(bump(T(256, 256, 24, headstonePaint), 0.14)); // textures.js:1163  const lam = (o) => new THREE.MeshLambertMaterial(o); // vendor/three.module.min.js: isMeshLambertMaterial=!0 ... this.emissive=new Zr(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1, ... (no `roughness` anywhere in the ctor)

- **THE TEXTURE REPEAT IS WRONG, EXACTLY AS SUSPECTED, AND WORSE THAN 1x1-ON-8M. world.box emits BoxGeometry with 0..1 UVs per face; M.headstone's map carries repeat (1,1). So ONE whole 256 px tile is stretched over each 2.12-3.44 m x 0.89-0.96 m piece: 8.3-13.4 mm per texel ACROSS against 3.5 mm ALONG, i.e. a 2.39:1 to 3.78:1 anisotropic smear (computed per segment). The map's only large features are three cracks and six lichen discs, and they repeat identically every ~0.9 m. Round twelve already found and wrote down this exact law when it fixed the ossuary flicker.**
  - `world.js:84`
  - evidence: const seg = (s) => Math.max(1, Math.min(8, Math.round(s / AO_SEG)));     const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)); // textures.js:1166  const T = (w, h, salt, painter, rx = 1, ry = 1) => { ... t.repeat.set(rx, ry); ... } // textures.js:1236  M.headstone = lam(bump(T(256, 256, 24, headstonePaint), 0.14));   // rx=ry=1 // outside.js @515ebef: "it read as BRICK rather than stone because BoxGeometry UVs are 0..1 PER FACE, so a 0.9 m panel wears the same map at four to six times the tiling of the 5.9 m one"

- **THAT UV STRETCH ALSO KILLS THE BUMP MAP, which is the only thing that could have put relief into this surface. M.headstone carries bumpMap = its own map at bumpScale 0.14. Three's perturbNormalArb reads dFdx/dFdy of the height texture; spreading a 256 px height field over 3.4 m collapses that gradient to almost nothing. Cutting the strip into ~0.55 m stones multiplies the UV gradient by roughly 4.5x and the relief comes back with it. This is why the fix is subdivision, not a material swap.**
  - `textures.js:1190`
  - evidence: const bump = (t, scale) => ({ map: t, bumpMap: t, bumpScale: scale });   ...   M.headstone    = lam(bump(T(256, 256, 24, headstonePaint), 0.14)); // textures.js:1188 "Lambert carries bumpMap per-fragment in r161 (verified in the vendored build)"

- **THE EMISSIVE IS A CONSTANT WITH NO emissiveMap, so in every stretch the point lights do not reach — most of a 125 m route lit by nine lights — the walkway is a mathematically uniform colour with zero texture in it. Lambert's outgoing light is diffuse + totalEmissiveRadiance, and totalEmissiveRadiance is emissive * emissiveIntensity unmodulated when emissiveMap is null. Also note the canvas kit is NoColorSpace, so the map's rgb(172,170,162) is a LINEAR albedo of 0.674, not 0.41 — the pale is real, and it is perfectly flat.**
  - `underfalls.js:598`
  - evidence: if ('emissive' in wetStone) {     wetStone.emissive = new THREE.Color(0x394548);     wetStone.emissiveIntensity = 0.72;   } // util.js:68  tex.colorSpace = THREE.NoColorSpace;   // canvas art treated as LINEAR albedo // textures.js:737  g.fillStyle = rgb(172, 170, 162);

- **NOTHING ELSE MODULATES IT EITHER. (a) No light in this district casts shadows: every PointLight in underfalls.js is constructed without castShadow, and the pooled candle lights are built the same way — so there is not one shadow anywhere on this surface. (b) The baked contact shading is derived from COLLIDERS, and this district deliberately has almost none (the file says so out loud), so the merged shell's vertex-colour AO is 1.0 along the whole walkway. Every channel that could have written variance into it is switched off.**
  - `world.js:233`
  - evidence: _buildOcclusionGrid(cell) {     const grid = new Set();     ...     for (const c of this.colliders) { // underfalls.js:543  "Nothing in this district has a collider, so there is nothing to stop you" // underfalls.js:806  const light = markUnderfalls(new THREE.PointLight(color, intensity, distance, 1.15));   // castShadow never set // world.js:1132     const l = new THREE.PointLight(0xff9540, 0, 9, 1.8);                                     // castShadow never set

- **AND AN OUTDOOR DIRECTIONAL LIGHT IS SHINING THROUGH FIVE METRES OF ROCK ONTO IT. world.moon is a DirectionalLight, intensity 1.3, castShadow true, with a 120x120 m ortho shadow camera centred on the origin. The Underfalls sits at z >= 215 (FOREST_GATE.z = 43, + at least 129 m of forest — 26 legs of 8 m with |heading| <= 0.9 so cos >= 0.62 — + 22 to clearingCenter + 20.35 to the stone veil), which is >150 m outside that box, and r161's shadow lookup returns shadow = 1.0 for anything outside the frustum. useLegacyLights is false in this build and main.js never overrides it, so that is ~1.05 of unoccluded irradiance on a flat floor at NdotL 0.81. A parallel light on a flat horizontal surface has NO spatial variation whatsoever — it is the one term that texture, geometry and value cannot be seen in, and between the route lights it is the dominant term.**
  - `world.js:975`
  - evidence: const moon = new THREE.DirectionalLight(0x8098c0, 1.3);     moon.position.set(35, 60, -25);     moon.castShadow = true;     moon.shadow.mapSize.set(2048, 2048);     moon.shadow.camera.left = -60; moon.shadow.camera.right = 60;     moon.shadow.camera.top = 60; moon.shadow.camera.bottom = -60; // vendor/three.module.min.js: float shadow = 1.0; ... bool frustumTest = inFrustum && shadowCoord.z <= 1.0; if ( frustumTest ) { ... } // vendor/three.module.min.js: _useLegacyLights=!1 // outside.js:13  export const FOREST_GATE = { x: 2, z: 43 };

- **THE TREAD THAT WORKS, AND THE DIFF THAT MATTERS. 'sluice climb treads' (underfalls.js:995-1011) is the one route surface in this district he did not complain about — it is the 'pale steps' of his screenshots 4/5, directly under two of the five route-spanning cataracts. It commits the SAME texture-scale sin, and worse: M.rock's map repeat is (2,2) over a unit box scaled to w*1.65 x 0.76, i.e. 2.06 m per tile across against 0.38 m along — 5.4:1, against the walkway's 3.8:1. The only structural differences are (1) pitch 0.956-0.983 m against a 0.76 m depth, so there is a 196-223 mm GAP of dark floor between every tread, where the walkway's pieces OVERLAP by 0.08 m and show not even a hairline; and (2) 0.11 m of thickness against 0.06 m. The joints are what makes it read. That is the whole case for subdivision over a material change.**
  - `underfalls.js:1001`
  - evidence: const treads = sampleUnderfallsPath(climb, 1.05);   const treadMatrices = [];   for (const s of treads) {     ...     treadMatrices.push(transformMatrix(s.x, s.y + 0.018, s.z,       0, yaw, 0, s.w * 1.65, 0.11, 0.76));   }   addInstances(group, new THREE.BoxGeometry(1, 1, 1), wetStone, treadMatrices,     { name: 'sluice climb treads', receiveShadow: true }); // underfalls.js:995  const wetStone = M.rock.clone();   wetStone.color.multiplyScalar(0.78); // textures.js:1241   M.rock = std({ ...bump(T(256, 256, 25, rockPaint, 2, 2), 0.26), roughness: 0.6, metalness: 0.05 });

- **THERE IS ZERO VARIATION PIECE TO PIECE, AND NO EDGE AT ALL. Every piece shares one width formula, one 0.06 m thickness, one +0.012 m lift, one yaw per segment, one material and one identical UV. Its exposed side face is 42 mm tall. So the pale field simply stops and black rock begins — which is exactly the frame he photographed: 'one huge pale flat slab filling almost the whole frame, black either side.'**
  - `underfalls.js:608`
  - evidence: world.box(wetStone,         lerp(seg.a.x, seg.b.x, t), lerp(seg.a.y, seg.b.y, t) + 0.012,         lerp(seg.a.z, seg.b.z, t),         2 * clamp(w * 0.46, 0.94, 1.72), 0.06, (seg.length / n + 0.08) * 0.98, yaw);

- **SEPARATE DEFECT FOUND ALONGSIDE: the chamber floor discs are exactly coplanar with two other opaque surfaces, and the comment above them claims the opposite. The disc spans chamber.y-0.28 .. chamber.y+0.000 (centre y-0.14, unit cylinder scaled 0.28). The corridor floor strips span y-0.22 .. y+0.000 and run THROUGH every chamber (the loop is over layout.segments with no chamber skip). The hatch cistern's own 8x8 m floor box spans y-0.30 .. y+0.000. All three tops are at exactly y = 0.000, all three derive from M.rock, and their tessellations differ wildly (a 16-gon cap fan against a 0.85 m quad grid), which is precisely the depth-interpolation mismatch that produces swimming z-fight speckle. The hatch cistern is the room you arrive in after walking through the last cataract; the chapel crossing is ~225 m2 of it.**
  - `underfalls.js:620`
  - evidence: // matches the clamp within 2%, with no coplanar overlaps to shimmer.   {     const discGeo = new THREE.CylinderGeometry(1, 1, 1, 16);     ...       m4.compose(         new THREE.Vector3(chamber.x, chamber.y - 0.14, chamber.z),         q0, sc.set(chamber.r * 1.02, 0.28, chamber.r * 1.02)); // underfalls.js:510   world.box(M.rock, x, y - 0.11, z, w * 2.0, 0.22, seg.length / n + 0.08, yaw); // underfalls.js:1226  world.box(M.rock, H.x, y - 0.15, H.z, r * 2, 0.3, r * 2);

- **THE WALKWAY ALSO Z-FIGHTS WITH ITSELF, every 0.9 m, along its entire length. Piece depth is seg.length/n + 0.08 while the pitch is seg.length/n, so consecutive pieces overlap by 80 mm with coplanar top faces at the same y — and because each piece carries the same 0..1 tile over a different footprint, the overlap band is two DIFFERENT parts of the texture competing for the same depth. Same merged batch, same material, so it resolves by low-bit depth rounding and swims with the camera.**
  - `underfalls.js:611`
  - evidence: 2 * clamp(w * 0.46, 0.94, 1.72), 0.06, (seg.length / n + 0.08) * 0.98, yaw); // pitch = seg.length / n ; depth = (seg.length / n + 0.08) * 0.98 ; depth - pitch = +0.0584 at the measured n values


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. Import the seeded RNG. The paving needs deterministic jitter — never Math.random in this repo; every probe and screenshot depends on the district being reproducible.** — `underfalls.js`

_anchor:_
```js
import { clamp, lerp, smoothstep, TAU } from './util.js';
```

_change:_
```js
import { clamp, lerp, RNG, smoothstep, TAU } from './util.js';
```

**2. 2. THE FIX. Replace src/underfalls.js lines 584-613 IN FULL (the comment block from '// THE WET LINE.' through the closing '}' of the mainSegments loop) with instanced paving. This deletes the 145-box ribbon, the dead roughness line and the 0.08 m self-overlap, and replaces them with 676 flags in three value tiers plus a 290-stone verge, sharing one BoxGeometry. Every stone's top face gets one whole 256 px tile at ~0.55 x 0.80 m — the scale the headstone map was painted for — which also multiplies the bump gradient ~4.5x. Nothing here is a collider and everything is <= 0.08 m thick; underfallsGroundAt is analytic (underfalls.js:248-269), so none of it can become a step, a ledge or a walk-through wall. Flag tops stay at route y + 0.042, exactly where the ribbon's top was.** — `underfalls.js`

_anchor:_
```js
  const wetStone = M.headstone.clone();
  wetStone.userData.underfalls = true;   // cave visibility keeps tagged materials
  // This must survive the stretches between fixtures: it is reflected wet
  // stone, not a coloured breadcrumb. A higher value, wider shoulder and a
  // restrained emissive floor keep the next physical tread present in every
  // vista while the unmarked culvert remains genuinely dark.
  wetStone.color.setHex(0xbcc8ca);
  if ('roughness' in wetStone) wetStone.roughness = 0.16;
  if ('emissive' in wetStone) {
    wetStone.emissive = new THREE.Color(0x394548);
    wetStone.emissiveIntensity = 0.72;
  }
  for (const seg of layout.mainSegments) {
    const n = Math.max(2, Math.ceil(seg.length / 0.9));
    const yaw = Math.atan2(seg.dx, seg.dz);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const w = lerp(seg.a.w, seg.b.w, t);
      world.box(w
```

_change:_
```js
  // THE WET WALKWAY — PAVING NOW, NOT A RIBBON.
  //
  // What stood here was ONE continuous strip: 145 boxes over 125.16 m, each
  // 2.12–3.44 m wide and ~0.9 m long, butted with an 0.08 m OVERLAP so not
  // even a hairline showed. BoxGeometry UVs are 0..1 per face — the law round
  // twelve turned on for the ossuary flicker (515ebef) — so ONE 256 px
  // headstone tile was stretched over each of those pieces: 8–13 mm per texel
  // across against 3.5 mm along, a 2.4:1 to 3.8:1 smear, with the map's only
  // large features (three cracks, six lichen discs) repeating identically
  // every 0.9 m. That stretch also killed the BUMP: perturbNormalArb reads
  // dFdx of the height map, and a height field spread over 3.4 m has no
  // gradient left to read — so the one channel that can put relief into a flat
  // floor was flattened with it. Nothing else was left: this district has no
  // shadow-casting light, the baked contact shading comes from COLLIDERS and
  // the route has none, and the emissive was a CONSTANT with no emissiveMap.
  // Alex, on the live build: "walkway under waterfall doesn't look good" —
  // one huge pale flat slab, black either side. It was never too bright.
  // There was no surface on it.
  //
  // The same UV law that flattened it makes flags right for free: cut the
  // strip into ~0.6 m stones and each stone wears ONE whole tile at the scale
  // the map was painted for, with the bump back at ~4.5x the gradient. Three
  // value tiers (the cave rocks' own ladder, atmosphere.js), a 55 mm joint
  // that shows the dark floor through it, a staggered course, per-stone tilt
  // and height, and a darker broken verge on both shoulders so the pale stops
  // ending in nothing.
  //
  // Instanced, not merged: four batches instead of one (cave 137 -> ~140
  // against the 450 ceiling) and LESS geometry than before — one 24-vertex box
  // shared by 966 instances against 145 merged boxes at ~5800 vertices, with
  // no boot merge to pay for. No new texture: the tiling came out of the
  // geometry. Nothing here is a collider and nothing is over 0.08 m thick;
  // underfallsGroundAt is analytic, so none of it can become a step or a wall.
  const FLAG = 0.62;                     // target stone, both ways
  const JOINT = 0.055;                   // the dark line between stones
  // NOT roughness. M.headstone is a MeshLambertMaterial and r161's Lambert has
  // no roughness property, so the `if ('roughness' in wetStone)` that used to
  // stand here never assigned anything — the wet sheen it asked for has never
  // existed in any buil
```

**3. 3a. Break the chamber-disc / corridor-strip coplanar pair (separate defect; apply or skip independently of step 2). Sink the corridor floor strips 12 mm so the chamber disc is unambiguously the top surface where a route crosses a chamber. 12 mm is ~100x the depth resolution at 20 m with near 0.2, and ground height is analytic, so nothing about movement changes.** — `underfalls.js`

_anchor:_
```js
      world.box(M.rock, x, y - 0.11, z, w * 2.0, 0.22, seg.length / n + 0.08, yaw);
```

_change:_
```js
      // 12 mm under the chamber discs (which top out at chamber.y exactly).
      // These strips run THROUGH every chamber, so at the same y they shared a
      // plane with the disc bit-for-bit over ~225 m2 at the chapel alone — and
      // two coplanar opaque surfaces with different tessellation is what
      // z-fight speckle is. Ground height here is analytic (underfallsGroundAt),
      // so a 12 mm cosmetic drop costs the player nothing.
      world.box(M.rock, x, y - 0.122, z, w * 2.0, 0.22, seg.length / n + 0.08, yaw);
```

**4. 3b. Same pair at the hatch cistern — the room you arrive in through the last cataract. Its 8x8 m floor box also tops out at exactly y = 0, coplanar with BOTH the disc and the corridor strip. Sink it 24 mm so the ladder is disc (y) > corridor strip (y-0.012) > hatch square (y-0.024), with no two surfaces sharing a plane anywhere in the district.** — `underfalls.js`

_anchor:_
```js
  world.box(M.rock, H.x, y - 0.15, H.z, r * 2, 0.3, r * 2);
```

_change:_
```js
  // 24 mm under the chamber disc and 12 under the corridor strip: this square
  // used to top out at exactly y, coplanar with both of them across the arrival
  // room. One surface per tier, no shared planes.
  world.box(M.rock, H.x, y - 0.174, H.z, r * 2, 0.3, r * 2);
```

**5. 3c. The comment above the discs currently asserts the opposite of the truth and will mislead the next reader. Correct it in the same commit.** — `underfalls.js`

_anchor:_
```js
  // matches the clamp within 2%, with no coplanar overlaps to shimmer.
```

_change:_
```js
  // matches the clamp within 2%. The disc is the TOP of a deliberate z-ladder:
  // it tops out at chamber.y, the corridor strips 12 mm under it and the hatch
  // cistern square 24 mm under that. It did not used to be — all three sat at
  // exactly chamber.y, sharing a plane bit-for-bit wherever a route crossed a
  // chamber, which is the same z-fight class as the ossuary deck (515ebef).
```

**6. 4. OPTIONAL, AND ONLY AFTER THE A/B BELOW — stop the moon lighting the inside of the cave. world.moon is an outdoor DirectionalLight at 1.3 whose 120x120 m shadow camera does not contain this district, and r161 returns shadow = 1.0 outside the frustum, so it lands on the walkway unoccluded at NdotL 0.81 with zero spatial variation. Sleep it by going BLACK, which is this codebase's own idiom for a sleeping light (the census is pinned, so visibility is not a lighting decision here). Insert immediately after the existing lightsActive block in installBeats and BEFORE the `if (!inCave) return;` on the next line. Do not ship this without measuring it first — it changes the value of the whole district and his first priority is not to ruin what is there.** — `underfalls.js`

_anchor:_
```js
    if (state.lightsActive !== dressed) {
      state.lightsActive = dressed;
      for (const light of state.lights) light.visible = dressed;
    }
```

_change:_
```js
    if (state.lightsActive !== dressed) {
      state.lightsActive = dressed;
      for (const light of state.lights) light.visible = dressed;
    }
    // THE MOON DOES NOT REACH IN HERE, AND UNTIL NOW IT DID.
    //
    // world.moon is a DirectionalLight at 1.3 with a 120 x 120 m ortho shadow
    // camera centred on the origin (world.js:975-981). This district sits at
    // z >= 215 — FOREST_GATE.z 43, plus at least 129 m of forest (26 legs of
    // 8 m at |heading| <= 0.9, so cos >= 0.62), plus 22 to the clearing centre
    // and 20.35 to the stone veil — more than 150 m outside that box. r161's
    // shadow lookup returns 1.0, i.e. UNSHADOWED, for anything outside the
    // frustum, and useLegacyLights is false, so ~1.05 of irradiance has been
    // landing on this floor through five metres of rock. A parallel light on a
    // flat floor has no spatial variation at all: it is the one term no
    // texture, bump or geometry can be seen in, and between the route lights
    // it is the dominant term. Black, not hidden — the census is pinned.
    if (state.moonAsleep !== inCave) {
      state.moonAsleep = inCave;
      const moon = game.world.moon;
      if (moon) {
        if (inCave) {
          state.moonIntensity = moon.intensity;
          moon.intensity = 0;
        } else if (state.moonIntensity !== undefined) {
          moon.intensity = state.moonIntensity;
        }
      }
    }
```

**7. 5. OPTIONAL, extends the same fix to the climb — the sluice treads carry a 5.4:1 UV smear (M.rock repeat (2,2) over 4.13 m x 0.76 m). They survive it only because their 196-223 mm gaps do the work. Splitting each tread into four stones across makes the climb and the walkway read as the same quarry. Same instanced batch, same draw call, 34 treads -> 136 stones.** — `underfalls.js`

_anchor:_
```js
    treadMatrices.push(transformMatrix(s.x, s.y + 0.018, s.z,
      0, yaw, 0, s.w * 1.65, 0.11, 0.76));
```

_change:_
```js
    // Four stones across, not one plank: at s.w*1.65 (4.13 m) with M.rock's
    // repeat (2,2), one tread wore 2.06 m per texture tile across against
    // 0.38 m along — a 5.4:1 smear, worse than the walkway's. Quartering it
    // brings both axes to ~0.5 m a tile and matches the paving next door.
    // Same InstancedMesh, same draw call.
    const treadW = s.w * 1.65;
    for (let q = 0; q < 4; q++) {
      treadMatrices.push(transformMatrix(
        s.x + Math.cos(yaw) * (-treadW / 2 + treadW * (q + 0.5) / 4),
        s.y + 0.018,
        s.z - Math.sin(yaw) * (-treadW / 2 + treadW * (q + 0.5) / 4),
        0, yaw, 0, treadW / 4 - 0.05, 0.11, 0.76));
    }
```

**8. 6. PIN IT, because nothing does. tests/legibility-regression.mjs has zero cave subjects (grep: no 'cave' or 'underfalls' hits in that file), which is why a 125 m featureless slab shipped through eleven rounds of green gates. Add a cave subject that measures CONTRAST, not brightness: pose the camera at a few route distances via underfallsMainPointAt, render until two frames are byte-identical (the file's own settling rule), read canvas.toDataURL — never page.screenshot — and assert (a) the walkway-to-shoulder luminance RATIO stays above a pinned floor, and (b) the standard deviation of luminance WITHIN the walkway band is above a pinned floor, which is the number that was zero and is the whole complaint. Also assert no two opaque surfaces in the district share a y: iterate game.underfalls and the shell batches and fail on an exact tie.** — `legibility-regression.mjs`

_anchor:_
```js
'the ossuary conduit, from the walk-up'
```

_change:_
```js
(add a new subject alongside it) 'the walkway under the falls, from three route distances' — asserting walkway/shoulder luminance ratio >= pinned floor AND within-walkway luminance sigma >= pinned floor (the flat-slab number), measured from canvas.toDataURL after two byte-identical frames.
```


### Cost

DRAW CALLS: −1 (the merged wetStone shell batch disappears entirely) +4 (three flag tiers + verge) = net +3. Cave 137 -> ~140 against the 450 ceiling policed by tests/district-culling-regression.mjs; the cave is the district with the most headroom. Step 5 adds none (same InstancedMesh). GPU GEOMETRY: goes DOWN. One shared 24-vertex BoxGeometry replaces 145 merged boxes at roughly 5,800 vertices; the cost moves to 966 instance matrices, about 62 KB of static-usage buffer. BOOT: goes DOWN — 966 Matrix4 compositions replace 145 BoxGeometry allocations plus their share of the finishStatic merge, which matters because the post-title hitch is a live complaint. PER FRAME: nothing. No ticker, no animation, no light, no texture upload, no new shader program. EFFORT: step 1 one line; step 2 one contained block replacement in one function, ~90 lines; step 3 three one-line edits plus a comment; step 4 ~25 lines in an existing ticker branch; step 5 ~8 lines; step 6 a new test subject, the largest single piece of work here. Steps 1-3 are an hour with the gate battery being the long pole.

### Risk

Low-to-moderate, and it is all contained in one function. (1) The four new InstancedMeshes are scene.add-ed inside addFloorAndShell, so buildUnderfalls sweeps them into state.renderRoots and they sleep outside the cave exactly like the chamber discs — verified against underfalls.js:1617/1662. (2) Shader warm-up is safe: renderer.compile walks materials with scene.traverse (confirmed in the vendored build: `t.traverse((function(t){const e=t.material;...`), which ignores visibility, so these compile during the warm pass and warm-start-regression's "zero new programs during play" holds. No new material class, no new define — clones of M.headstone with vertexColors off. (3) Cave visibility: markUnderfalls sets mesh.userData.underfalls, matched by keep() at underfalls.js:1394, AND the materials carry userData.underfalls, matched at 1414. Belt and braces. (4) No gameplay surface: nothing here is a collider, underfallsGroundAt is analytic (underfalls.js:248-269), and the verge reaches 2.08 m at its widest against a corridor half-width of 2.30 m minimum — inside the clamp, but it is 60 mm of trim, not a wall, and it is lower than the sluice treads already in that lane. (5) The one thing that WILL move is the district's look, and he said "first priority is not to ruin what we have" — so step 4 (the moon) must not ship on argument. (6) The z-ladder in step 3 changes floor heights by 12/24 mm, cosmetic only for the same analytic-ground reason, but it touches the merged rock batch so re-run district-culling and underfalls-expansion. (7) Determinism: RNG(0x57a1b0c9), no Math.random, so probes and screenshots repeat.

### Open questions

- Confirm screenshot 9 is this surface before touching anything. Every fact above is source-certain about the walkway, but the identification rests on round eleven's own record ('every cave screenshot shows the lit ribbon') plus his own habit of calling this district 'the area under the waterfall' in the 2026-08-19 notes. Settle it in one pass: extend tools/probe-underfalls.mjs or tools/probe-cave-floor.mjs to raycast straight down from a few poses on the main route and report the hit mesh name and material name. Note that today it cannot distinguish them — finishStatic names every shell 'shell:shell' because neither M.headstone nor M.rock has a .name. Step 2 fixes that by naming the walkway materials and meshes.
- THE MOON A/B, and step 4 must not ship without it. Teleport to the cave, render until two frames are byte-identical, read canvas.toDataURL, then set game.world.moon.intensity = 0 and repeat. Report mean and standard deviation of luminance over the walkway band and over the shoulders in both. tools/probe-albedo-ab.mjs is the precedent and the launcher already knows the fresh-browser-per-scenario rule. If the moon is contributing what the arithmetic says (~1.05 unoccluded irradiance at NdotL 0.81 on a 0.335 linear albedo), it is the single largest flattener and step 2 alone will only partly fix the frame. If it is not, drop step 4 and say why in the round record.
- Does the chamber-disc / corridor-strip coplanar pair (finding 10) actually shimmer on his machine, or is it resolving stably by draw order? Both surfaces are near-identical in appearance because the district's baked AO is ~1.0, so the fight may be invisible even where it exists. The cheap test: probe the chapel and hatch cistern from two camera positions 5 cm apart and diff the readbacks. Fix it either way — it is three one-line edits and it removes a whole class of future report — but knowing whether it is what he saw matters for the round record.
- Is 966 stones the right density, or does his 'a beautiful wet rock path' want finer? The patch keeps the existing 0.9 m row pitch, which gives stones of about 0.55 x 0.80 m — a 1.45:1 aspect, down from 3.78:1. Dropping the divisor from 0.9 to 0.70 gives ~1,260 stones at ~1.1:1 and costs nothing extra per frame (still four draw calls), only boot matrix work. Judge it on a rendered frame, not on the number.
- Should the walkway materials also take emissiveMap = m.map, so the self-lit term stops being a constant in the stretches no light reaches? It is one line per tier and it is the only remaining unmodulated channel. It adds USE_EMISSIVEMAP, i.e. one new shader program key — compiled during the warm pass, so it should be invisible, but tests/warm-start-regression.mjs is the specific gate that must be re-run, and it is the one gate that deliberately runs WITHOUT ?test=1. Left out of the patch on purpose; add it only if the frame still reads flat after step 2.
- #7 lands on this same surface and was deliberately deferred, not lost. His words: steam at the edges but NOT on the path, plus ceiling drips and camera droplets. The verge course added in step 2 is exactly the geometry the edge steam should hug, and the joints are where ceiling drips should pool. Whoever builds #7 should read this patch first so the two passes agree instead of fighting.
- The gate battery has not been run against any of this — this was a read-only source pass while gates were already running on the tree. All four gates plus district-culling, render-perf, underfalls-expansion, warm-start and legibility need to be green before this goes near main, and step 3 in particular touches the merged rock batch that four rounds of cave bugs have already lived in.


---

<a id="ball"></a>

## ball

**The "hanging ball above the sand trap" is `Forest.ravineKnot` — the knot on the rope over the mire at s≈108 in `src/outside.js:6936` — and round twelve already gave it three of the five things the key-tree kit has (material, geometry, corona); what it still has is a raw-`M.curtain` line carrying none of the value, no motion at all, and no voice at all, which is exactly the failure the key tree was built to fix.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **STEP 3 IS NOT MECHANICALLY APPLICABLE AND, APPLIED AS WRITTEN, THROWS INSIDE ravineRope.onHit. The step gives ONE anchor (src/outside.js:6976, `        audio.creak({ pos: rope.position, gain: 0.6 });`) but its `change` field bundles the replacement line, three prose lines dressed as `//` comments, AND `const knotAt = this.ravineKnotAt;` which belongs THIRTY LINES EARLIER at 6946. An applier following the instruction literally lands `const knotAt` inside `onHit` AFTER its own use, producing `ReferenceError: Cannot access 'knotAt' before initialization` on every ravine latch — and `this.ravineKnotAt` there is `undefined` anyway, because `this` inside onHit is the fetch target (the plan says so itself). That fires in tests/playthrough.mjs:928 (`throwAt(rope.x, rope.y, rope.z, 0.8)` at `g.forest.ropeAnchor`), tests/regressions.mjs:1140 (`directive = rope.onHit.call(rope, g.skull);`) and tests/failure-state-regression.mjs:174 (same call) — three of the gates the plan's own step 10 says to run.**
  - _fix:_ Split into two edits with their own anchors. EDIT 3a — anchor (unique, outside.js:6946): `    this.ropeAnchor = new THREE.Vector3(far.x + 0.9, 1.4, far.z);` ; replacement: that same line followed by `\n    // `this` inside onHit is the fetch target, not the Forest. The confirmation\n    // that a throw took has to come from the BALL: rope.position is y=0, 1.25 m\n    // below it and 0.9 m to the side, and at the panner's 2.4/1.5 default an\n    // 8 m latch retains 0.164 of source gain.\n    const knotAt = this.ravineKnotAt;`. EDIT 3b — anchor (unique, outside.js:6976): `        audio.creak({ pos: rope.position, gain: 0.6 });` ; replacement: `        audio.creak({ pos: knotAt, gain: 0.6, ref: RAVINE_REF, roll: RAVINE_ROLL });`. Nothing else. (Capturing the rest position rather than the swung one is correct and cheap — leave it.)

- **THE SILENCE GATE USES THE WRONG FLAG. Step 5 gates the voice on `!g.flags.has('ropeLatched')`, but `ropeLatched` is set inside onHit at outside.js:6975 — at the moment the skull LATCHES, before the player has gone anywhere. The crossing is a separate, later event: src/director.js:896-905 only sets `this._ravineCrossed = true` and `g.ravineRopeTarget.enabled = false` once `pr.s >= f.ravineS() + 3.25 && g.player.grounded && (f._mireDepth || 0) < 0.08`. Nothing ever clears `ropeLatched` (`restartFromCheckpoint` -> `director.respawn()` never touches `this.flags`; grep confirms only `flag()`/`has()`, no delete). So a player who latches, gets swung short, drowns in the mire (death at `_mireDepth >= 1.48`, outside.js:5246) and respawns at the pre-ravine checkpoint finds the ball PERMANENTLY silent and no longer kicking into its wide arc — exactly the player who failed the crossing and most needs the invitation. That is the project's own recurring failure mode (working-but-illegible) re-introduced by the patch that exists to cure it.**
  - _fix:_ Gate on the terminal, authoritative 'crossing spent' signal that tests/regressions.mjs:1157 already asserts (`rope.enabled === false`). In step 5 replace the `live` line with:\n      const live = g.act === 'forest' && !g.dead\n        && g.ravineRopeTarget?.enabled !== false\n        && g.player.pos.distanceTo(knotPos) < 30;\nand delete the `!g.flags.has('ropeLatched')` term. (`g.ravineRopeTarget` is assigned at outside.js:6981; `enabled` defaults true via world.js:336 and is set false only at director.js:904, never re-enabled by the game — terminal across checkpoint reload and act change. `!g.director._ravineCrossed` is equivalent but reaches into a private.) In the test (step 7) replace `g.director._chaser2 = 'suppressed-for-legibility-read';` + `g.flag('ropeLatched');` with the single line `g.ravineRopeTarget.enabled = false;` — with no `ropeLatched` there is no chaser2 to suppress, and director.js:896 stays inert. Update the plan's prose that says the voice stops 'once the rope has been taken' to 'once the crossing has been made'.

- **`f.entered = false` IN THE TEST'S faceBall DOES THE OPPOSITE OF WHAT THE PLAN CLAIMS. The plan comments it `// the seal frontier must not creep during a read`. But outside.js:5206 reads `if (!this.entered && pr.s > 4) { this.entered = true; this.game.flag('forestEntered'); this.sealS = Math.max(this.sealS, pr.s - 6); this._placeSeal(true); this.game.audio.brushCrash(...); this.game.audio.stoneGrind(...); this._lookWindow = 5.0; }`. Standing at s≈100 with `entered` forced false re-fires the whole gate-slam beat on the very next step: a hard seal placement 6 m behind the player, two loud one-shots and a 5-second look-window — once per pose, three times across the block. The creep it was meant to prevent lives at outside.js:5358 and is gated on `entered` being TRUE, so the line cannot suppress it.**
  - _fix:_ In `faceBall`, replace `    f.entered = false;                     // the seal frontier must not creep during a read` with `    f.entered = true; f._idleT = 0;        // already inside; do not re-fire the gate-slam beat`. Keep the `nearBall` position filter — it still earns its keep, because with `entered` true the idle-creep path can fire the seal creak at outside.js:6591 from `posAt(sealS)`, roughly 10 m behind the player and ~18 m from the ball.


### Execute THIS (the challenged, corrected plan)

The diagnosis is correct and the plan is worth executing after four fixes. The object Alex photographed really is `Forest.ravineKnot` (src/outside.js:6936), a 0.09 m sphere at local (0.9, 1.25, 0) inside the `rope` group placed at `posAt(ravineS() + 4)` — s=108 with length 208 and ravineS()=104, i.e. 0.75 m past the far lip of the mire that spans 100.75-107.25 (outside.js:5752). Round twelve (commit 515ebef) already gave it knotMat, the 0.19 dodecahedron and a 1.6 m corona and Alex has not seen it (docs/ROUND-THIRTEEN.md:20). What is genuinely missing is the line, the motion and the voice, and the plan's arithmetic for all three checks out: the beam axis crosses x=0.9 at y=2.9419, the old 2.2 m line overshot it by 0.458 m, 2.94-1.69=1.25 preserves `ravineKnotAt`/`ropeAnchor`/the fetch target exactly, carry30=0.352 and nearFalloff=1.94 transfer the pinned key-tree thresholds unchanged, and sqrt(9.81/1.69)=2.409 rad/s is right. No law is broken: no lights, no text, value+motion+sound rather than hue, throw grammar and the 1.1 m catch radius untouched. Draw calls are honestly +0 — three meshes on three materials before and after, `hang` is a Group, the halo already exists, forest stays 299 against 450 — and `rope` is `scene.add`-ed, never `world.box`-ed, so `finishStatic` (src/world.js:97) cannot clone-merge it. Apply it with these changes. FIRST, split step 3 into two edits: insert `const knotAt = this.ravineKnotAt;` after outside.js:6946 (`this.ropeAnchor = ...`), and separately replace outside.js:6976 with `audio.creak({ pos: knotAt, gain: 0.6, ref: RAVINE_REF, roll: RAVINE_ROLL });` — applied as the plan literally writes it, the declaration lands inside `onHit` after its own use and throws a TDZ ReferenceError on every ravine latch, breaking playthrough.mjs:928, regressions.mjs:1140 and failure-state-regression.mjs:174. SECOND, change the silence gate from `!g.flags.has('ropeLatched')` to `g.ravineRopeTarget?.enabled !== false`: `ropeLatched` is set at LATCH (outside.js:6975) while the crossing is only spent at director.js:896-905, and nothing clears the flag, so the plan as written silences the ball forever for a player who latched, drowned in the mire and respawned before the ravine — the exact illegibility this patch exists to fix. Change the test's `g.flag('ropeLatched')` to `g.ravineRopeTarget.enabled = false;` and drop the now-pointless `_chaser2` suppression. THIRD, in the test's `faceBall` replace `f.entered = false;` with `f.entered = true; f._idleT = 0;` — forcing `entered` false at s≈100 re-fires the gate-slam beat at outside.js:5206 (hard seal placement, brushCrash, stoneGrind, 5 s look-window) once per pose and does not suppress the creep it claims to. FOURTH, move both stationary poses from `RAVINE_S - 3.6` to `RAVINE_S - 5` (0.52 m of margin to the mire's 3.08 kill radius is too thin), rename both FLOORS rows to say 'the ravine ball and its line' since the toggle hides both, round the sample index (`Math.round(rs + 4)`), and do not hard-code the 0.15 delta floor for the swing — measure `swingRange` and `restRange` on the first run and floor at ~0.6x the measured delta, exactly as step 6 already does for the pixels, because the free-running `Math.sin(_chainPulseT * 2.41)` is not re-phased by a call and the quoted 0.77 m is an envelope maximum, not a measurement. Also correct three citations before handing it over: the dimming dial is outside.js:6103 (NOT 6064, which is fork-closure instancing code), `coronaTex` is 6213 (not 6210), and failure-state drives onHit at 174 (not 173). Then run the gates in the plan's stated order, with forest-nervous-system-regression alone.

### Findings

- **THE OBJECT HE MEANS. `knot` in `_setpieces` — a 0.09 m sphere (0.18 m across) at local (0.9, 1.25, 0) inside a `rope` group placed at `posAt(ravineS + 4)`, i.e. spline s≈108 with the forest length 208 and ravineS()=104. It hangs 0.9 m in world +X off the centreline and 1.25 m above y=0. It is `this.ravineKnot`; its rest world position is `this.ravineKnotAt`; the fetch target `ravineRope` sits 0.15 m above it at `this.ropeAnchor` with radius 1.1.**
  - `outside.js:6936`
  - evidence: const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), M.curtain);     knot.position.set(0.9, 1.25, 0);     rope.add(beam, line, knot);     rope.position.set(far.x, 0, far.z); ...     this.ravineKnot = knot;     this.ravineKnotAt = new THREE.Vector3(far.x + 0.9, 1.25, far.z);     this.ropeAnchor = new THREE.Vector3(far.x + 0.9, 1.4, far.z);

- **THE SAND TRAP is the 'sucking forest mire' — a peat skin spanning s = ravineS()±3.25 (100.75→107.25), surface y=-0.075, colour 0x17120d, which sinks and kills at depth 1.48. The hanging ball at s=108 sits 0.75 m past its far lip. That is the geometric proof that his 'hanging ball above the sand trap' is the ravine knot and not a chain knot (chain knots are at s=65,165,173,182,191,200) or a pocket knot (s=74, s=179).**
  - `outside.js:5752`
  - evidence: const mireS = this.ravineS();     const mirePos = [];     for (const s of [mireS - 3.25, mireS + 3.25]) { ...     mire.name = 'sucking forest mire';

- **THE 'PALE STAKES IN THE GROUND' are most likely the 24 'mire edge reeds' that bracket the mire from s=mireS-3 to mireS+3 at ±(halfW-0.15) — thin 0.018→0.032 m cylinders 0.55–1.4 m tall. Second candidate: the four 'old waystones' at s=ravineS()+18 (=122), 2.0–3.1 m tall, which would stand behind the ball in the same frame. I cannot settle which from source; a posed screenshot from the near lip would.**
  - `outside.js:5780`
  - evidence: reedMesh.name = 'mire edge reeds'; ...       const s = mireS - 3 + (i / (reedCount - 1)) * 6;       const lat = side * (this.halfW[si] - 0.15 - ((i * 17) % 5) * 0.11);

- **ROUND TWELVE ALREADY APPLIED THREE FIFTHS OF THE KIT and he has never seen it (ROUND-THIRTEEN.md: 'He had not played it at the time of writing. Tell him to hard-refresh.'). Commit 515ebef gave the ball knotMat (M.headstone ×1.28, emissive 0x59666b at 2.4), the 0.19 dodecahedron geometry scaled (1,1.5,1) → 0.38 m × 0.57 m, and one additive corona sprite 1.6 m across. Do NOT redo any of that.**
  - `outside.js:6254`
  - evidence: if (this.ravineKnot) {       this.ravineKnot.material = knotMat;       this.ravineKnot.geometry = knotGeo;       this.ravineKnot.scale.set(1, 1.5, 1);       const halo = new THREE.Sprite(new THREE.SpriteMaterial({         map: coronaTex, transparent: true, blending: THREE.AdditiveBlending,         depthWrite: false, opacity: 0.8,       }));       halo.scale.set(1.6, 1.6, 1);       halo.position.copy(this.ravineKnotAt);       coronas.add(halo);     }

- **WHAT ROUND TWELVE MISSED: THE LINE. Every chain knot reads as a hanging ASSEMBLY — a self-lit dropped line (radius 0.042, `ropeMat` = M.curtain ×1.48 with emissive 0x39423f at 1.35) running into a 2.4-emissive knot. The ravine ball's line is radius 0.025 in raw shared `M.curtain`: no brightening, no emissive. The line is 2.2 m tall against a 0.38 m ball — it is the majority of the silhouette and it carries none of the value.**
  - `outside.js:6934`
  - evidence: const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 4), M.curtain);     line.position.set(0.9, 2.3, 0);

- **THE LINE ALSO DOES NOT MEET ITS BEAM. The beam is a 3.4 m cylinder centred at local (0, 3.4, 0) rolled 1.1 rad about Z, so its ends are at (-1.5151, 4.1711) and (1.5151, 2.6289) and its axis crosses the hang lateral x=0.9 at y=2.9419. The line spans y 1.2→3.4, i.e. it overshoots the beam by 0.46 m and hangs in air above it. Nobody saw that while the line was unlit; everybody would see it once it is self-lit.**
  - `outside.js:6931`
  - evidence: const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), M.bark);     beam.rotation.z = 1.1;     beam.position.y = 3.4;

- **NOTHING IN THE RAVINE ROPE HAS EVER MOVED. `rope`, `beam`, `line` and `knot` are added to the scene once and never touched by any ticker. The only per-frame writes near them are the shared chain emissive pulse and the per-corona opacity pulse, which the ravine halo joins only because `_chainCoronas` is the live `coronas.children` array. Motion — the one channel a dark forest cannot destroy — is entirely absent.**
  - `outside.js:6678`
  - evidence: this._chainPulseT += dt;     if (this._chainKnotMat && this._chainKnotBase) {       this._chainKnotMat.emissiveIntensity =         this._chainKnotBase * (0.8 + 0.2 * Math.sin(this._chainPulseT * 2.4));     }     if (this._chainCoronas) {       for (let i = 0; i < this._chainCoronas.length; i++) {         this._chainCoronas[i].material.opacity =           0.66 + 0.18 * Math.sin(this._chainPulseT * 2.4 + i * 0.35);

- **THE ANNOUNCE KIT, PART 1 — the carry constants. `ref` widens the panner's reference distance and `roll` softens its exponential rolloff. 4.5/0.55 leaves 0.352 of source gain at 30 m (the kit default 2.4/1.5 leaves 0.023) while still being 1.94× louder at 3 m than at 15 m, so approach still reads as approach. Reuse these values verbatim so the pinned thresholds carry over unchanged.**
  - `outside.js:1638`
  - evidence: const KEY_TREE_REF = 4.5;   const KEY_TREE_ROLL = 0.55;

- **THE ANNOUNCE KIT, PART 2 — the periodic voice plus motion on the same beat. A dt countdown, a deterministic irregular reseed (never Math.random, never a metronome), one creak carrying ref/roll from the object's own position, and a `swing` impulse that decays so the object MOVES when it speaks. It stops the instant the invitation is spent.**
  - `outside.js:1899`
  - evidence: climb.callT -= dt;       if (climb.callT <= 0) {         climb.calls = (climb.calls || 0) + 1;         climb.callT = 5.4 + (Math.sin(climb.calls * 2.399963) * 0.5 + 0.5) * 3.2;         climb.swing = 1;         if (game.act === 'graveyard' && ...) {           game.audio.creak({ pos: hitAt, gain: 0.62, rate: 0.46 + (climb.calls % 3) * 0.05, verb: 0.8, ref: KEY_TREE_REF, roll: KEY_TREE_ROLL });         }       }       climb.swing = Math.max(0, (climb.swing || 0) - dt * 1.15);       const breath = climb.swing * climb.swing;

- **THE ANNOUNCE KIT, PART 3 — the corona idiom. One shared 64 px radial-gradient CanvasTexture, one additive Sprite per beacon, depthTest left TRUE so a glow never shines through a trunk, 1.6 m across. `coronaTex` and `knotGeo` and `knotMat` and `ropeMat` are all locals of `_buildChain`, which is why the ravine upgrade has to live inside `_buildChain` and not in `_setpieces`.**
  - `outside.js:6210`
  - evidence: const coronaTex = (() => {       const c = document.createElement('canvas');       c.width = c.height = 64; ...       halo.scale.set(1.6, 1.6, 1);

- **THE LATCH CREAK PLAYS FROM THE GROUND, NOT FROM THE BALL. `rope.position` is (far.x, 0, far.z) — y = 0, and 0.9 m to the side of the ball. The confirmation that your throw took is spatialised at the wrong place, and at the default 2.4/1.5 rolloff an 8 m latch retains only 0.164 of source gain.**
  - `outside.js:6976`
  - evidence:         audio.creak({ pos: rope.position, gain: 0.6 });

- **WHAT THE GATE PINS FOR THE KEY TREE, and therefore the shape the ball's pin must take. Note it also filters nothing — it asserts `calls.every(atTheLimb)` — which works only because nothing else creaks in the graveyard. In the forest the seal frontier (line 6591) and the fork closures (line 4950) both creak, so the ball's version must filter by position, not assume silence.**
  - `legibility-regression.mjs:247`
  - evidence: const announceChecks = [   ['the limb keeps calling while it hangs unhit (3+ times in 30 s)', a.calls >= 3],   ['it calls FROM the limb, so HRTF can point a head at it', a.atTheLimb],   ['it carries: a quarter of it survives the 30 m to where the player stands', a.carry30 >= 0.25],   ['and it still fades in the near field, so walking toward it reads as approach', a.nearFalloff >= 1.4],   ['and it MOVES when it speaks: the far end travels 15 cm+', a.swingRange >= 0.15], ];

- **HOW THE FLOORS WERE CALIBRATED, from the checked-in results — floors sit at roughly 0.5–0.6× the measured pctChanged and 0.5–0.7× the measured contrast. Use the same rule for the two new rows rather than inventing numbers.**
  - `legibility-regression.json:5`
  - evidence: "pctChanged": 0.21 ... floor 0.12   |   "pctChanged": 0.29 ... floor 0.18 "contrast": 2.69 ... floor 1.8      |   "contrast": 1.46 ... floor 1.15

- **THE PATCH COSTS ZERO DRAW CALLS. Before: `rope` holds three meshes on three materials (M.bark beam, M.curtain line, knotMat knot) = 3 draws, plus the already-existing halo sprite. After: the same three meshes on three materials (M.bark, ropeMat, knotMat) = 3 draws, plus the same halo. The added `hang` Group is never drawn. Forest stays at 299 against the 450 ceiling. Also note `rope` is `scene.add`-ed directly and never registered with `world.box`, so `finishStatic()`'s clone-merge cannot touch it — material reassignment on it is safe.**
  - `world.js:97`
  - evidence: finishStatic() {     const grid = this._buildOcclusionGrid(AO_CELL);     ...     for (const [mat, list] of this._geo) {


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. Add the ball's carry constants and one scratch vector at module scope, beside the forest's existing scratch vectors. Same values as the key tree so the pinned thresholds (carry30 ≥ 0.25, nearFalloff ≥ 1.4) transfer unchanged: (30/4.5)^-0.55 = 0.352 and (15/4.5)^0.55 = 1.94.** — `outside.js`

_anchor:_
```js
// ------------------------------------------------------------------- forest
const SEAL_TRAIL = 10;
const _lookA = new THREE.Vector3(), _lookB = new THREE.Vector3(), _lookC = new THREE.Vector3();
```

_change:_
```js
// ------------------------------------------------------------------- forest
const SEAL_TRAIL = 10;
const _lookA = new THREE.Vector3(), _lookB = new THREE.Vector3(), _lookC = new THREE.Vector3();
// How far the ball over the mire is allowed to be heard from, and how it fades
// getting there. Identical to KEY_TREE_REF/ROLL, deliberately: 4.5/0.55 leaves
// 0.352 of source gain at thirty metres (the panner's 2.4/1.5 default leaves
// 0.023) while still being 1.94x louder at three metres than at fifteen, so
// walking toward it still tells you that you are. A wide ref alone would have
// made every one of those distances identical.
const RAVINE_REF = 4.5;
const RAVINE_ROLL = 0.55;
const _ravineV = new THREE.Vector3();
```

**2. 2. Rebuild the rope's hanging half in `_setpieces` so (a) the line terminates on the beam instead of overshooting it by 0.46 m, (b) the line matches the chain's rope gauge, and (c) the line and the ball share ONE pivot group that can swing. The pivot is yawed onto the lane tangent so the swing crosses the corridor rather than running up and down it — and yawing is free, because both children sit ON the group's Y axis, so a Y rotation moves neither of them at rest. The ball's rest world position is unchanged at y = 2.94 - 1.69 = 1.25, so `ravineKnotAt`, `ropeAnchor` and the `ravineRope` fetch target are all untouched.** — `outside.js`

_anchor:_
```js
    const rope = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), M.bark);
    beam.rotation.z = 1.1;
    beam.position.y = 3.4;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 4), M.curtain);
    line.position.set(0.9, 2.3, 0);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), M.curtain);
    knot.position.set(0.9, 1.25, 0);
    rope.add(beam, line, knot);
    rope.position.set(far.x, 0, far.z);
    scene.add(rope);
    // ...and this is the ONE hanging knot in the forest that never got the kit
    // every other one wears. _buildChain runs after this and upgrades it there,
    // where the material, the geometry and the corona texture already exist.
    this.ravineKnot = knot;
    this.ravineKnotAt = new THREE.Vector3(far.x + 0.9, 1.25, far.z);
```

_change:_
```js
    const rope = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), M.bark);
    beam.rotation.z = 1.1;
    beam.position.y = 3.4;
    // WHERE THE LINE ACTUALLY MEETS THE BEAM, not where it used to stop. The
    // beam is a 3.4 m cylinder through local (0, 3.4) rolled 1.1 rad about Z,
    // so its ends are (-1.5151, 4.1711) and (1.5151, 2.6289) and its axis
    // crosses the hang lateral x=0.9 at y=2.9419. The old line ran 1.2 -> 3.4:
    // it overshot the beam by 0.46 m and hung in air above it. Nobody saw that
    // while the line was unlit and everybody would see it now that it is not.
    const HANG_Y = 2.94;                    // the beam's axis at x = 0.9
    const KNOT_Y = 1.25;                    // unchanged - ravineKnotAt/ropeAnchor depend on it
    const HANG_LEN = HANG_Y - KNOT_Y;       // 1.69
    // ONE PIVOT for the line and the ball, so the thing swings as one object
    // rather than a ball sliding off a static thread. Yawed onto the lane
    // tangent so the arc crosses the corridor - the widest screen-space motion
    // for a player walking toward it - and yawing costs nothing, because both
    // children sit ON this group's Y axis and a Y rotation cannot move them.
    const ropeSample = this.samples[clamp(rs + 4, 0, this.length - 1)];
    const hang = new THREE.Group();
    hang.position.set(0.9, HANG_Y, 0);
    hang.rotation.y = Math.atan2(ropeSample.tx, ropeSample.tz);
    // 0.042 and five sides: the exact gauge of the chain's dropped lines, so
    // the one hanging line in the forest that is not part of the chain stops
    // being visibly thinner than the six that are.
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, HANG_LEN, 5), M.curtain);
    line.position.set(0, -HANG_LEN / 2, 0);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), M.curtain);
    knot.position.set(0, -HANG_LEN, 0);
    hang.add(line, knot);
    rope.add(beam, hang);
    rope.position.set(far.x, 0, far.z);
    scene.add(rope);
    // ...and this is the ONE hanging knot in the forest that never got the kit
    // every other one wears. _buildChain runs after this and upgrades it there,
    // where the material, the geometry and the corona texture already exist.
    this.ravineKnot = knot;
    this.ravineLine = line;
    this.ravineHang = hang;
    this._ravineCallT = 2.2;
    this._ravineCalls = 0;
    this._ravineSwing = 0;
    this.ravineKnotAt = new THREE.Vector3(far.x + 0.9, KNOT_Y, far.z);
```

**3. 3. Make the latch creak play from the ball instead of from the ground 1.25 m below and 0.9 m to the side of it, and give it the same carry as the calls. `this.ravineKnotAt` must be captured into a local because `this` inside `onHit` is the fetch target, not the Forest. Insert the capture immediately after the `ropeAnchor` assignment (which is the line directly below the anchor edited in step 2), then change the creak itself.** — `outside.js`

_anchor:_
```js
        audio.creak({ pos: rope.position, gain: 0.6 });
```

_change:_
```js
        audio.creak({ pos: knotAt, gain: 0.6, ref: RAVINE_REF, roll: RAVINE_ROLL });

// ...and ABOVE the addFetchTarget call, immediately after the existing line
//     this.ropeAnchor = new THREE.Vector3(far.x + 0.9, 1.4, far.z);
// add:
    // `this` inside onHit is the fetch target, not the Forest. The confirmation
    // that a throw took has to come from the BALL: rope.position is y=0, 1.25 m
    // below it and 0.9 m to the side, and at the panner's 2.4/1.5 default an
    // 8 m latch retains 0.164 of source gain.
    const knotAt = this.ravineKnotAt;
```

**4. 4. Complete the kit in `_buildChain`: hand the line the same self-lit rope material every chain line already wears, and keep a direct reference to the ball's halo so the ticker can make it ride the swing. `ropeMat` is already in scope at this point (declared at the top of `_buildChain`).** — `outside.js`

_anchor:_
```js
    if (this.ravineKnot) {
      this.ravineKnot.material = knotMat;
      this.ravineKnot.geometry = knotGeo;
      this.ravineKnot.scale.set(1, 1.5, 1);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: coronaTex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: 0.8,
      }));
      halo.scale.set(1.6, 1.6, 1);
      halo.position.copy(this.ravineKnotAt);
      coronas.add(halo);
    }
```

_change:_
```js
    if (this.ravineKnot) {
      this.ravineKnot.material = knotMat;
      this.ravineKnot.geometry = knotGeo;
      this.ravineKnot.scale.set(1, 1.5, 1);
      // ...AND THE LINE IT HANGS ON, which round twelve left behind. Every
      // chain knot reads as a hanging ASSEMBLY - a 1.35-emissive dropped line
      // into a 2.4-emissive knot - and this one read as a lone dot with a dark
      // thread above it. The line is 1.69 m tall against a 0.38 m ball: it is
      // most of the silhouette, and it was carrying none of the value. No new
      // material, no new draw call; the mesh already existed.
      if (this.ravineLine) this.ravineLine.material = ropeMat;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: coronaTex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: 0.8,
      }));
      halo.scale.set(1.6, 1.6, 1);
      halo.position.copy(this.ravineKnotAt);
      coronas.add(halo);
      // it is a world-space sprite in the shared corona group, so once the ball
      // swings it has to be TOLD where the ball went, or the glow detaches from
      // the thing it is announcing. `coronas.children` is a live array, so it
      // still gets its pulse from _chainCoronas; this is only its position.
      this._ravineHalo = halo;
    }
```

**5. 5. Give the ball its voice and its swing, in `Forest.update`, immediately after the existing chain-corona pulse block and before the `const mtx = this._sealMtx` line. `update()` runs every frame in every act, so the act gate and the range gate are both load-bearing. Swing numbers: the pivot is 1.69 m, so a free pendulum's natural rate is sqrt(9.81/1.69) = 2.41 rad/s. Amplitudes are chosen against the pinned floor: at rest 0.035+0.045 = 0.08 rad gives 2*1.69*sin(0.08) = 0.27 m peak-to-peak (clears the 0.15 m floor on its own, so the gate cannot pass on a fluke beat), and on a call 0.185+0.045 = 0.23 rad gives 0.77 m, so the beat is unmistakably wider than the rest state.** — `outside.js`

_anchor:_
```js
    if (this._chainCoronas) {
      for (let i = 0; i < this._chainCoronas.length; i++) {
        this._chainCoronas[i].material.opacity =
          0.66 + 0.18 * Math.sin(this._chainPulseT * 2.4 + i * 0.35);
      }
    }
    const mtx = this._sealMtx, v = this._sealPos, sv = this._sealScale, q = this._sealQuat;
```

_change:_
```js
    if (this._chainCoronas) {
      for (let i = 0; i < this._chainCoronas.length; i++) {
        this._chainCoronas[i].material.opacity =
          0.66 + 0.18 * Math.sin(this._chainPulseT * 2.4 + i * 0.35);
      }
    }
    // THE BALL OVER THE MIRE SPEAKS AND SWINGS.
    //
    // Alex, screenshot 11: "if we could get this hanging ball to be even more
    // visible above the sand trap in the forest, it would be great."
    //
    // Round twelve gave it the LOOK half of the key-tree kit - knotMat, the
    // dodecahedron, the corona. This is the other half, and it is the half that
    // actually failed for the key tree: a thing the player has not looked at
    // yet cannot be helped by being brighter. Sound points the head; motion
    // holds it. Same idiom, same constants, nothing invented for this one:
    // a deterministic irregular call (never a metronome, never Math.random),
    // carried on RAVINE_REF/RAVINE_ROLL, and it MOVES when it speaks. It goes
    // quiet the moment the rope has been taken, because then the invitation is
    // spent - exactly like the limb the moment it is torn down.
    if (this.ravineHang && this.ravineKnot) {
      const g = this.game;
      // a hanging thing in a forest is never a fixture, so the sway never stops;
      // only the CALL kicks it into an arc a head turns for. 2.41 rad/s is the
      // natural rate of a 1.69 m pendulum, sqrt(9.81 / 1.69).
      this._ravineSwing = Math.max(0, (this._ravineSwing || 0) - dt * 0.55);
      const breath = this._ravineSwing * this._ravineSwing;
      const t = this._chainPulseT;
      this.ravineHang.rotation.z =
        Math.sin(t * 2.41) * (0.035 + 0.15 * breath) + Math.sin(t * 0.62) * 0.045;
      const knotPos = this.ravineKnot.getWorldPosition(_ravineV);
      if (this._ravineHalo) this._ravineHalo.position.copy(knotPos);
      const live = g.act === 'forest' && !g.dead && !g.flags.has('ropeLatched')
        && g.player.pos.distanceTo(knotPos) < 30;
      if (live) {
        this._ravineCallT -= dt;
        if (this._ravineCallT <= 0) {
          this._ravineCalls++;
          // 5.8-9.2 s. The 2.399963 stride is the key tree's, and it is
          // irrational against 2*PI, so the cycle never repeats audibly.
          this._ravineCallT = 5.8 + (Math.sin(this._ravineCalls * 2.399963) * 0.5 + 0.5) * 3.4;
          this._ravineSwing = 1;
          g.audio?.creak?.({
            pos: knotPos.clone(), gain: 0.5,
            rate: 0.88 + (this._ravineCalls % 3) * 0.07, verb: 0.7,
            ref: RAVINE_REF, roll: RAVINE_ROLL,
          });
        }
      }
   
```

**6. 6. Pin the pixels. Add two rows to FLOORS. Ship the placeholder pair on the FIRST run only, read the measured values off the console, then replace them in the SAME commit using this file's own rule (floor about 0.6x the measured pctChanged, about 0.7x the measured contrast, rounded down to two decimals). Do not guess these — the file's whole premise is 'measured, then floored with room to move'.** — `legibility-regression.mjs`

_anchor:_
```js
const FLOORS = {
  'the ossuary conduit, from the walk-up': [0.35, 1.6],
  'the key-tree limb, from the top of the lane': [0.12, 1.8],
  'the key-tree limb, at throwing distance': [0.18, 1.15],
  'the key in the grass, from four metres': [0.01, 4.0],
};
```

_change:_
```js
const FLOORS = {
  'the ossuary conduit, from the walk-up': [0.35, 1.6],
  'the key-tree limb, from the top of the lane': [0.12, 1.8],
  'the key-tree limb, at throwing distance': [0.18, 1.15],
  'the key in the grass, from four metres': [0.01, 4.0],
  // PLACEHOLDERS - replace with 0.6x measured pct / 0.7x measured contrast from
  // the first run's console output, in the same commit. These two only fire if
  // the ball disappears outright.
  'the ravine ball, from the top of the mire approach': [0.01, 1.10],
  'the ravine ball, from the near lip of the mire': [0.05, 1.30],
};
```

**7. 7. Measure the ball, between the key-tree block and the ossuary block. It goes here, not last, because the ossuary block seals every scene child that is not routeRoot and is not cheaply reversible from a test; and it teleports back to the graveyard on the way out so that block still starts where it expects to. Note three things it does that the key-tree block does not have to: it toggles the hang AND the halo together (the halo is a sprite in the shared corona group, not a child of the hang, so toggling the hang alone would leave the glow on in both frames and UNDER-report the read); it filters creaks by POSITION (the seal frontier at outside.js:6591 and the fork closures at outside.js:4950 both creak in the forest, so silence cannot be assumed); and it reuses the post-crossing window as a free at-rest baseline for the swing. Insert immediately after `snap('key-in-the-grass');` and before the `// ---- 2. the ossuary conduit` comment.** — `legibility-regression.mjs`

_anchor:_
```js
  snap('key-in-the-grass');

  // ---- 2. the ossuary conduit --------------------------------------------
```

_change:_
```js
  snap('key-in-the-grass');

  // ---- 1b. the ball over the mire ----------------------------------------
  // Alex, screenshot 11: "if we could get this hanging ball to be even more
  // visible above the sand trap in the forest, it would be great." Same kit as
  // the limb, same two questions: can it be READ from where you decide to
  // throw, and does it ANNOUNCE itself to a player who has not looked yet.
  F.teleport('forest');
  F.stepWith(0.3, {}, false);              // one forest.update reveals the detail roots
  const f = g.forest;
  const RAVINE_S = f.ravineS();
  const ballAt = () => f.ravineKnot.getWorldPosition(f.ravineKnotAt.clone());
  // The halo is a world-space sprite in the shared corona group, NOT a child of
  // the hang. Toggling the hang alone would leave the glow burning in both
  // frames and under-report the read. Toggle the whole announced object.
  const ballToggle = {
    get visible() { return f.ravineHang.visible; },
    set visible(v) { f.ravineHang.visible = v; if (f._ravineHalo) f._ravineHalo.visible = v; },
  };
  const faceBall = (s) => () => {
    const p = f.posAt(s);
    f._lastIdx = Math.round(s);
    f.entered = false;                     // the seal frontier must not creep during a read
    seat(p.x, p.z, f.heightAt(p.x, p.z) + 0.02);
    const b = ballAt();
    lookAt(b.x, b.y, b.z);
    F.stepWith(0.05, {}, false);
  };
  read('the ravine ball, from the top of the mire approach', ballToggle, faceBall(RAVINE_S - 22));
  snap('ravine-ball-approach');
  read('the ravine ball, from the near lip of the mire', ballToggle, faceBall(RAVINE_S - 3.6));
  snap('ravine-ball-near-lip');

  // ---- THE BALL'S ANNOUNCE -----------------------------------------------
  const spy = (sink) => (opts = {}) => {
    sink.push({ ref: opts.ref ?? 2.4, roll: opts.roll ?? 1.5, pos: opts.pos ? [opts.pos.x, opts.pos.z] : null });
    return realCreak(opts);
  };
  const ballCalls = [];
  faceBall(RAVINE_S - 3.6)();
  g.audio.creak = spy(ballCalls);
  const ballSwings = [];
  for (let i = 0; i < 60; i++) { F.stepWith(0.5, {}, false); ballSwings.push(ballAt()); }
  g.audio.creak = realCreak;
  const nearBall = (c) => {
    const b = ballAt();
    return !!c.pos && Math.hypot(c.pos[0] - b.x, c.pos[1] - b.z) < 1.5;
  };
  const spread = (list) => {
    let r = 0;
    for (const p of list) for (const q2 of list) r = Math.max(r, p.distanceTo(q2));
    return r;
  };
  // ...and it goes quiet once the invitation is spent. Suppress the rope chaser
  // first: a walker spawning behind a static player would end this window by
  // killing it, 
```

**8. 8. Return the new block from the page evaluate.** — `legibility-regression.mjs`

_anchor:_
```js
  return { measured, shots, announce, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root };
```

_change:_
```js
  return { measured, shots, announce, ballAnnounce, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root };
```

**9. 9. Report and pin the ball's announce, in the node half, immediately after the existing key-tree announce report (after the line beginning `console.log(`        measured: ${a.calls} calls, ...`). Six checks: the five the limb carries, plus the two this object needs that the limb does not - that the arc is genuinely WIDER on a beat than at rest (the limb's `swingRange >= 0.15` can be satisfied by idle sway alone; this pair cannot), and that the voice stops once the crossing is made.** — `legibility-regression.mjs`

_anchor:_
```js
console.log(`        measured: ${a.calls} calls, ref ${a.ref} m / roll ${a.roll}, ${a.carry30} of source gain left at 30 m, ${a.nearFalloff}x louder at 3 m than 15 m, far end travels ${a.swingRange} m`);
```

_change:_
```js
console.log(`        measured: ${a.calls} calls, ref ${a.ref} m / roll ${a.roll}, ${a.carry30} of source gain left at 30 m, ${a.nearFalloff}x louder at 3 m than 15 m, far end travels ${a.swingRange} m`);

// THE BALL OVER THE MIRE. His screenshot 11. The pixels were never the whole
// problem here either: it hangs 0.75 m past the far lip of a mire that kills
// you, so the read has to happen from the near bank, BEFORE the decision, and
// what reaches a player who has not looked yet is sound and motion.
const b = result.ballAnnounce || {};
const ballChecks = [
  ['the ball keeps calling while the crossing is unmade (3+ times in 30 s)', b.calls >= 3],
  ['it calls FROM the ball, so HRTF can point a head at it', !!b.atTheBall],
  ['it carries: a quarter of it survives 30 m of lane', b.carry30 >= 0.25],
  ['and it still fades in the near field, so walking toward it reads as approach', b.nearFalloff >= 1.4],
  ['and it MOVES: the ball travels 15 cm+', b.swingRange >= 0.15],
  ['and it moves MORE when it speaks: 15 cm+ wider on a beat than at rest', (b.swingRange - b.restRange) >= 0.15],
  ['and it goes quiet once the rope has been taken', b.afterCrossing === 0],
];
console.log('');
for (const [name, ok] of ballChecks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
}
console.log(`        measured: ${b.calls} calls, ref ${b.ref} m / roll ${b.roll}, ${b.carry30} of source gain left at 30 m, ${b.nearFalloff}x louder at 3 m than 15 m, ball travels ${b.swingRange} m on a beat and ${b.restRange} m at rest, ${b.afterCrossing} calls after the rope`);
```

**10. 10. Re-run the gates, in this order. `legibility-regression` first (it is the one this change exists for, and its first run supplies the FLOORS numbers for step 6). Then `district-culling-regression` (expect forest unchanged at 299 — the patch adds zero draw calls; a Group is not drawn and no material is created), `failure-state-regression` (it drives `ravineRope.onHit` directly at line 173 and asserts the mire/rope rescue), `regressions` (its ravine/checkpoint block at lines 1091-1216), `playthrough` (it throws at `g.forest.ropeAnchor` at line 928 — unchanged by this patch, which is the point), then `forest-hardening`, `forest-nervous-system-regression`, `render-perf`, `autotest`, `smoke`. Run `forest-nervous-system-regression` ALONE, not in a parallel batch — ROUND-TWELVE.md records it failing under four-way Chrome load and passing alone.** — `AGENTS.md`

_anchor:_
```js
node tests/autotest.mjs      # 24 named checks (feel laws, fetch chain, stun/pop)
```

_change:_
```js
(no edit — this step is the verification order, not a change. Do NOT edit any src file while a gate is running: an autotest has already died on `Unexpected token ')'` from exactly that.)
```


### Cost

Draw calls: +0 in every district. Before, `rope` submits three meshes on three materials (M.bark beam, M.curtain line, knotMat knot); after, three meshes on three materials (M.bark, ropeMat, knotMat). The `hang` Group is never drawn and the corona sprite already exists. Forest stays 299 against the 450 ceiling; no other district is touched. Per-frame CPU: one `getWorldPosition` (a three-node ancestor walk), two `Math.sin`, one `Vector3.copy`, one subtraction and one comparison — inside `Forest.update`, which already runs unconditionally every frame. Memory: one Group, one Vector3 at module scope, one geometry swapped for one of the same class (the old 2.2 m cylinder is replaced at construction, not leaked at runtime). Audio: one extra one-shot every 5.8-9.2 s, and only within 30 m of the ball, before the rope is taken — the voice cap is untouched. Implementation: about 70 lines in `src/outside.js` across four sites, about 80 lines in `tests/legibility-regression.mjs` across four sites, plus one measurement run to fill in the two FLOORS pairs. One session for someone with the gates on their machine.

### Risk

Low-to-moderate, and the risk is concentrated in two places. (1) The line's geometry and position change (step 2) is the only alteration to existing art. The arithmetic is exact — the beam's axis crosses x=0.9 at y=2.9419, so a 1.69 m line from 2.94 down to 1.25 terminates 0.06 m inside the beam's radius, i.e. flush, where the old one overshot by 0.46 m — but it is the one edit whose result I cannot see. Verify with the screenshots step 7 writes (`legibility-ravine-ball-near-lip`). (2) Test ordering: the new block sits between the key-tree block and the ossuary block. If `g.ossuary.descend()` then fails, move the whole 1b block to the very end of the evaluate and drop the trailing `F.teleport('graveyard')`; nothing in it depends on running early. Smaller risks: the announce could feel chatty if a player lingers on the near bank — the 5.8-9.2 s cadence is the key tree's, one notch slower, and the 30 m range gate means it is silent for the other 180 m of forest; and the ball is now the loudest-valued object in a district that already brightened its ropes four times at his request, so if he comes back saying it is too much, the single dial is `knotMat.emissiveIntensity` at outside.js:6064, which would also dim all six chain knots — dim the ravine ball alone by cloning knotMat inside the `if (this.ravineKnot)` block instead. NOT at risk: `ravineKnotAt`, `ropeAnchor`, the `ravineRope` fetch target's position or radius, the swing pivot at (landing.x, 6.9, landing.z), or any part of the throw grammar. The fetch target is deliberately NOT made to ride the ball the way `branchTarget` rides the limb — a 0.25 m swing inside a 1.1 m catch radius gains nothing and `regressions.mjs`, `failure-state-regression.mjs` and `playthrough.mjs` all aim at that target.

### Open questions

- Which object did he actually photograph? Everything above says the ravine knot (it is the only hanging ball anywhere near the mire; the chain knots are 57-92 m further on and 7 m up), but that is inference from geometry, not from the picture. A `tools/probe-ravine-ball.mjs` that poses the camera at s = ravineS-3.6 looking at `f.ravineKnot` and reads back `canvas.toDataURL` would settle it in one run — and would also settle whether the 'pale stakes in the ground' are the 24 mire edge reeds (outside.js:5775) or the four old waystones at s=ravineS+18 (outside.js:7048), which decides whether anything else in that frame wants attention.
- HE HAS NEVER SEEN THE ROUND-TWELVE BALL. Commit 515ebef gave it knotMat, the dodecahedron and the corona, and ROUND-THIRTEEN.md records that he had not played the shipped build. Part of his ask may already be answered. Tell him to hard-refresh and look again before assuming this patch is what he needed; if the shipped version already satisfies him, the announce and the swing are still worth landing, because they are what carries the object to a player who has not looked at it — which is the failure the key tree taught.
- Does the ball clip to white when you walk under it AFTER crossing? The corridor half-width at s=108 is about 1.32 m and the ball sits 0.9 m off the centreline at 1.25 m — you pass within about a metre of it. AGENTS/ROUND-THIRTEEN record that MeshStandardMaterial's fixed 0.04 specular plus the lantern's ~131 irradiance at arm's length blows almost any albedo out close up, and no chain knot is ever passed at that range (they hang at 7 m). Measurement that settles it: a third `read()` at 1.5 m in the same block. If pctChanged is large at a ratio above roughly 6, clone knotMat for the ravine ball and drop its emissiveIntensity to about 1.8 — do not touch the shared knotMat, which six chain knots depend on.
- The two FLOORS pairs are unknown until the gate runs once. My arithmetic predicts roughly 0.3-1.0% of frame at the near lip and roughly 0.03-0.1% at the approach (a 1.6 m sprite subtends 0.21 rad at 7.6 m and 0.061 rad at 26 m), with contrast likely 3-10x against the 0x17120d mire — but the canvas resolution and the vertical FOV are both unknown to me, so these are estimates and must not be committed as floors.
- Is `Forest.update` the right home for the announce, or should it be a `game.tickers` entry like the key tree's? `update` is called from main.js:1826 every frame in every act, which is why the act gate and the range gate are load-bearing; a ticker would be identical in behaviour. I chose `update` so the ball's motion sits beside the chain-knot pulse it is a sibling of. If a future round moves the chain pulse, move this with it.
- Should the call speed up while the player is actually sinking in the mire? It is the rescue, and urgency would read. I did not do it: the key tree has no such adaptation and the round-twelve note is explicit that this object gets 'the same three things, and nothing invented for it'. Worth asking him directly rather than deciding for him.


---

<a id="furnace"></a>

## furnace

**There is no ordering bug in the fire — `pilotLit && pumpGalleryLatched && archiveDraftOpened` is recomputed every single frame in a ticker that is never cleared until the ending, and no flag can be lost — but there IS a real order-dependent bug one level up: the furnace's *voice* is latched to the hinge (the E handler returns on its first line once the door is open) and the exact state he stood in (draft whole, pilot dark) is the one state on the whole scoreboard with no pointer at all, so the machine went silent in precisely the situation that needed it to speak.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### Execute THIS (the challenged, corrected plan)

The plan's diagnosis is correct and its anchors are clean — apply it, with four corrections.

What I confirmed independently, and what nobody needs to re-derive: the fire condition genuinely is order-free. `hasDraft` is recomputed at the top of the ticker at house.js:3260, that ticker is iterated unconditionally at main.js:1831 and emptied only by `_finishEnd()` at main.js:1716, `game.flag()` is a bare `Set.add` with no side effects (main.js:1465), and no furnace flag is ever deleted anywhere in src/. The real defect is the one the plan names: the E handler at house.js:3149-3170 returns on its first line once the door is open, so the mouth speaks once per game and latches its sentence to whatever the circuit was at hinge-time; and there is no scoreboard state at all for "draft whole, pilot dark", which is where Alex stood.

Apply step 1 verbatim (anchor exact, both locals in scope, pure observability, zero cost) — and add one line to its spirit in buildBasementPilot: `state.glow = pilotGlow;` after house.js:2942, so the pooled-light question can actually be measured.

Apply step 2 verbatim. Its anchor is exact and its two structural decisions are load-bearing and correct: `fireboxTarget.enabled = true` must stay INSIDE the `if (!incin.doorOpen)` branch or a repeat press re-arms the firebox after the refusal, and the `if (incin.offered || incin.refused) return;` guard is the only thing preventing a press from re-lighting a spent furnace to glowTarget 2.4 — a state the old one-shot made unreachable, so making the handler repeatable genuinely does create that new failure mode. I traced every existing caller of this interactable (playthrough.mjs:441, house-critical-path-regression.mjs:212, failure-state-regression.mjs:39): all three press exactly once, all three with the same flag state as before, all three unchanged.

Do NOT apply step 3 as written. Its gate is `game.act === 'basement'` alone, and the basement zone (house.js:770) spans x -20.5..12 — so the pointer can fire 27 m from the mouth, and its payload is the bare `nudge()` chime that this file's own comment at house.js ~2952-2957 already ruled "not a pointer" at ten metres. Replace the block body with the proximity-gated, travelling version given in the fix above: accumulate only inside `distanceToSquared(incPos) < 49`, reset `pilotCallT` in the trailing `else`, pass `{ global: true }` on every `game.after` so an act change cannot swallow half the beat, and walk `answerCold`'s brass ladder backwards (5.38, B+2.66, 5.8) then (3.77, B+2.12, 5.8) before the chime, so the answer is a path rather than a distant noise.

Apply step 4 with one insertion: put the player at the boiler-room stance (`g.player.pos.set(9.8, -3, -1.7); g.player.vel.set(0,0,0); g.player._sync(0);`) right after `g.enemies.clear()`. Without it the page proves the pointer fires from a stance no confused player occupies, and it will fail once the proximity gate lands. The rest of the test is sound: I checked that `stepWith(seconds)` really does run `Math.round(seconds/FIXED_DT)` fixed 1/120 steps (main.js:2258) so `runFor(11)` is 11 real seconds; that the needle thresholds (>0.9 empty at 1.18, <-0.9 full converging to -1.0188 over 192 steps at rate 4.6) and the slit thresholds (exactly 1.000 dark; the 1.6 s window sweeps 2.56 rad of a 1.96 rad dead arc so it cannot miss >1.2) are all reachable; that no other `audio.thud` caller in src/ lands within 0.6 m of incPos, so the position-filtered counter is clean; and that the only basement noise source over 37 s is `_updateScares` (director.js:508-543), which plays knock/whisper/creak/footstep and never thud.

Budget and traps: nothing here adds geometry, a material or a light, so the 450-draw ceiling is untouched at all seven districts — district-culling-regression only reads `g.lastRender.drawCalls` and top-level `scene.children` visibility, neither of which changes. No `finishStatic` identity trap: `inc` is `scene.add`-ed as a live Group at house.js:2992 and never enters `world._geo`, so the exposed slits and needle are real animated meshes, and step 1 exposes objects, not materials. No new exception path inside a ticker. The pilot pointer writes `state.pulse`, which feeds the existing `world.candles` descriptor into the fixed 8-slot pool — the light census does not move. Nothing added is non-terminal state that a checkpoint reload or act change could lose. No on-screen text, no HUD, no hue-only meaning, no change to the throw grammar, no flag writer touched.

Also fix, in the write-up only: finding #5's claim that the basement spawn looks at the pilot is false (it is 68 degrees off-axis); open question #1's "edge-on" premise is false (the swung door presents ~0.26 m^2 at 0.81 m and is aimable); the "zero gauge hits in tests/" grep claim is false (regressions.mjs:2000); and six line citations drift by one to four lines (voidDoorGlow 7070, nudge() 2936, registerInteract 3149, pumpGallery nudge 3219, _enterBasement 181, guestSource.target 7196). Re-run list: the four gates plus district-culling, legibility, and failure-state-regression.

### Findings

- **THE ANSWER TO THE BRIEF'S QUESTION: the furnace condition is evaluated CONTINUOUSLY, not on an event. `hasDraft` is recomputed at the top of a per-frame ticker and the wake commit is `if (!incin.awake && hasDraft)`. Satisfying the last precondition anywhere in the house wakes the furnace on the very next frame, with no return trip and no re-trigger.**
  - `house.js:3260`
  - evidence: game.tickers.push((dt, t) => {     // the mouth never glows 'ready' before the pilot burns     const hasDraft = game.flags.has('pilotLit')       && game.flags.has('pumpGalleryLatched')       && game.flags.has('archiveDraftOpened');     if (!incin.awake && hasDraft) {       incin.awake = true;       game.flag('incineratorAwake');

- **That ticker really does run every frame, unconditionally, for the whole game. `game.tickers` is iterated in `Game.step` with no act, zone, district or pause filter, and the array is emptied in exactly one place: `_finishEnd()` (main.js:1716), the ending. No district culler, act change, teleport or respawn touches it.**
  - `main.js:1831`
  - evidence: for (const t of this.tickers) t(dt, this.time);

- **Each of the three preconditions has exactly one writer, and none of them is ever deleted. `flags.delete` appears four times in the whole of src/ and none of them is a furnace flag (director.js:1248 deletes `skullArrived`; outside.js:4944-4971 delete forest-fork bookkeeping). So the state cannot be lost by leaving the basement, dying, or reloading.**
  - `house.js:2920`
  - evidence: src/house.js:2920:      game.flag('pilotLit'); src/house.js:6513:    game.flag('pumpGalleryLatched'); src/house.js:6582:    game.flag('archiveDraftOpened'); src/house.js:7126:      game.flag('ateFlame');

- **The checkpoint reload repaired nothing, and cannot. `restartFromCheckpoint()` calls `director.respawn()`, which does not clear or re-derive any flag, and `teleport()` does not rebuild the world (buildHouse runs once at boot, house.js:778-789). The only basement-entry hook, `_enterBasement`, re-checkpoints and arms the dropcloths — it never looks at the furnace.**
  - `director.js:182`
  - evidence: _enterBasement() {     const g = this.game;     g.checkpoint('basement');     g.baseTension = 0.25;     this.dread = 0.5;

- **His own alternative explanation is the correct one. The basement respawn puts him 5.69 m from the pilot bell, looking down the corridor at it, with fire already in the skull — so "or maybe i hit the light bell after the basement stairs and it activated" is exactly what happened. Basement spawn (9, -3.0, 4.9); pilot fetch target (3.35, -2.12, 5.55); dx 5.65, dz -0.65.**
  - `director.js:18`
  - evidence: basement: { x: 9, z: 4.9, yaw: 0.5, y: -3.0 },  // z >= 4.85 clears the last tread's collider — no frame-one shove

- **THE REAL ORDER BUG. The furnace's E handler returns on its first line once the door is open, so the mouth speaks exactly once in the entire game — at the instant the panel swings — and what it says is latched to the circuit state at that instant. Opening the obvious door EARLY (before the pilot is lit) is the natural order; after that the furnace is permanently mute to every press. `world.registerInteract` never removes the interactable and `_interact` calls `inter.action(this)` on every press, so this is a self-imposed one-shot, not a limitation.**
  - `house.js:3150`
  - evidence: world.registerInteract(fireDoor, 'incineratorDoor', () => {     if (incin.doorOpen) return;     incin.doorOpen = true;

- **The second half of that same order bug: the pointer the one-shot fires is itself guarded on a flag the player may not have yet. Opening the door cold schedules `basementPilot.nudge()`, but `nudge()` refuses without `ateFlame` — so a player who opens the door before carrying fire gets a bare thud and nothing else, and there is no second press to collect the pointer later. Two independent orderings decide whether the same action produces a pointer or silence.**
  - `house.js:2937`
  - evidence: nudge() {       if (!game.flags.has('ateFlame') || game.flags.has('pilotLit')) return;       this.pulse = 1.35;

- **THE SILENT STATE. The furnace scoreboard has a state for "pilot lit" (slit breath) and a state for "pump latched, archive missing" (a duct knock every 9 s that retires itself). It has NO state for "draft whole, pilot dark" — which is the exact state he stood in twice. Post-round-twelve the gauge correctly reads empty there, the slits do not breathe because breath IS pilotLit, and the duct knock has already retired. Everything is honest and everything is silent. Silence reads as broken.**
  - `house.js:3291`
  - evidence: const breath = game.flags.has('pilotLit') ? 0.5 + 0.5 * Math.sin(t * 1.6) : 0;     for (const slit of slits) slit.scale.y = 1 + breath * 0.9; ...     if (game.flags.has('pumpGalleryLatched') && !game.flags.has('archiveDraftOpened')) {       incin.ductKnockT = (incin.ductKnockT || 0) + dt;       if (incin.ductKnockT >= 9) {

- **His first step really did do nothing, and the code says why: the candle's fetch target is created disabled and is armed only inside `openDoor()`. "i tried to test by activating the candle through the cieling before the door was open... i doubt it worked" — correct. What he would have hit instead is the `voidDoor` target, which rattles and nudges the window relay.**
  - `house.js:7194`
  - evidence: guestSource.target = flameTarget;   flameCircuit.register(guestSource);   flameTarget.enabled = false; ...   const openDoor = (source = 'skull') => {     if (game.flags.has('voidDoorOpen')) return false;     ...     flameTarget.enabled = true;

- **Round twelve's gauge fix is pinned by NOTHING. No test in tests/ references the gauge, the needle, or the three-condition read. `grep -rn "gauge\|Gauge" tests/*.mjs` returns zero hits. The fix that answered his last report can silently regress.**
  - `house-critical-path-regression.mjs:598`
  - evidence: g.flags.delete('pilotLit');     throwAt(g.incineratorPosition.x, g.incineratorPosition.y, g.incineratorPosition.z, 0.35);     waitHeld(3);     const pilotGateRefused = !g.flags.has('skullOffered') && !g.incinerator.offered;   // <- the only furnace-state test; nothing reads the gauge, the slits, or the door press

- **Construction order is not a hazard and can be ruled out: every act builder runs in one synchronous pass at boot, in an order where each cross-reference is already defined (voidDoorAct before buildWindowRelay, so `game.voidDoorBeat` exists for the relay's 1.15 s open; basementAct before buildPumpGallery, so `game.incineratorPosition` exists for the pump latch). The relay's void-door open is also `{ global: true }`, so a death inside its 1.15 s window cannot cancel it.**
  - `house.js:778`
  - evidence: bedroomAct(game);   nurseryAct(game);   voidDoorAct(game);   frontDoorKnockAct(game);   buildWindowRelay(game); ...   basementAct(game);   buildPumpGallery(game);


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. Expose the gauge needle and the door slits on the incinerator handle so the scoreboard becomes testable. Pure observability, zero runtime cost, same precedent as `game.voidDoorGlow = glow;  // deterministic observability` at house.js:7074. Both locals are already declared above this point (slits at 3066, gaugeNeedle at 3089).** — `house.js`

_anchor:_
```js
  game.incinerator = incin;
  const incPos = new THREE.Vector3(11.0, B + 0.9, -1.5);
```

_change:_
```js
  game.incinerator = incin;
  // Deterministic observability: the gauge and the slits are the furnace's two
  // silent scoreboards, and round twelve's "the gauge stops lying" fix shipped
  // with nothing in tests/ able to read either of them. Handles only.
  incin.gaugeNeedle = gaugeNeedle;
  incin.slits = slits;
  const incPos = new THREE.Vector3(11.0, B + 0.9, -1.5);
```

**2. 2. THE ORDER FIX. Make the furnace mouth answer EVERY press instead of only the press that swung the panel. The hinge stays one-shot; the answer stops being one. Guarded so a furnace that has already refused the skull can never be re-lit to 'ready' by a press. Replace house.js:3149-3170 entirely.** — `house.js`

_anchor:_
```js
  world.registerInteract(fireDoor, 'incineratorDoor', () => {
    if (incin.doorOpen) return;
    incin.doorOpen = true;
    game.audio.creak({ pos: incPos, gain: 0.7 });
    // An open mouth always accepts the player's throw; the branches below
    // only decide how bright the answer is.
    fireboxTarget.enabled = true;
    // The wake commit (incin.awake + its announcement) belongs to the ticker
    // ALONE — a stale ateFlame+pump check here used to pre-set awake and
    // swallow the archive-draft wake beat forever. The mouth reads 'ready'
    // only when the full circuit holds: pilot, pump draft, archive draft.
    if (game.flags.has('pilotLit') && game.flags.has('pumpGalleryLatched')
        && game.flags.has('archiveDraftOpened')) {
      incin.glowTarget = 2.4;                    // the mouth recognizes what the skull carries
    } else {
      incin.glowTarget = 0.035;
     
```

_change:_
```js
  // THE ANSWER BELONGS TO THE PRESS, NOT TO THE HINGE. This handler used to
  // return on its first line once the door was open, so the furnace spoke
  // exactly ONCE in the whole game — at the instant the panel swung — and what
  // it said was latched to the circuit as it stood in that instant. The
  // natural order is to open the obvious door EARLY, before the pilot is lit;
  // after that the mouth was mute to every press forever. Alex did exactly
  // that, finished the rest of the basement, came back with fire in the skull,
  // and got nothing: "went back down to the basement, made sure everything was
  // active. still no fire." Nothing was broken — hasDraft is re-tested every
  // frame and no flag here can be lost — but the one thing he pressed had
  // already spent its voice on a state that no longer existed. The hinge is
  // still one-shot. The answer is not.
  world.registerInteract(fireDoor, 'incineratorDoor', () => {
    if (!incin.doorOpen) {
      incin.doorOpen = true;
      game.audio.creak({ pos: incPos, gain: 0.7 });
      // An open mouth always accepts the player's throw; the branches below
      // only decide how bright the answer is.
      fireboxTarget.enabled = true;
    }
    // The fire has already tried the skull and lost. A spent furnace has
    // nothing left to say, and a press must never re-light its mouth.
    if (incin.offered || incin.refused) return;
    // The wake commit (incin.awake + its announcement) belongs to the ticker
    // ALONE — a stale ateFlame+pump check here used to pre-set awake and
    // swallow the archive-draft wake beat forever. The mouth reads 'ready'
    // only when the full circuit holds: pilot, pump draft, archive draft.
    if (game.flags.has('pilotLit') && game.flags.has('pumpGalleryLatched')
        && game.flags.has('archiveDraftOpened')) {
      incin.glowTarget = 2.4;                    // the mouth recognizes what the skull carries
    } else {
      incin.glowTarget = 0.035;
      // If the circuit is incomplete the open door answers physically and
      // points back toward what is missing.
      game.audio.thud({ pos: incPos, gain: 0.42, rate: 0.56 });
      if (!game.flags.has('pilotLit')) game.after(0.18, () => game.basementPilot?.nudge?.());
    }
  });
```

**3. 3. THE SILENT-STATE FIX. Give the scoreboard its missing third state: draft whole, pilot dark. Same period (9 s) and same gain (0.3) as the existing state-2 duct knock, so it is the same voice aimed at a different place and cannot be called new noise. Gated on `ateFlame` so an empty-handed player is never beaconed to a fixture they cannot use (the same law `nudge()` already enforces), and on `game.act === 'basement'` so it can never leak into another district. Retires the instant the pilot lights. Append as an `else if` on the existing state-2 block at house.js:3298-3304.** — `house.js`

_anchor:_
```js
    if (game.flags.has('pumpGalleryLatched') && !game.flags.has('archiveDraftOpened')) {
      incin.ductKnockT = (incin.ductKnockT || 0) + dt;
      if (incin.ductKnockT >= 9) {
        incin.ductKnockT = 0;
        game.audio.knock({ pos: collar.getWorldPosition(_vDuct), gain: 0.3, rate: 0.45 });
      }
    }
```

_change:_
```js
    if (game.flags.has('pumpGalleryLatched') && !game.flags.has('archiveDraftOpened')) {
      incin.ductKnockT = (incin.ductKnockT || 0) + dt;
      if (incin.ductKnockT >= 9) {
        incin.ductKnockT = 0;
        game.audio.knock({ pos: collar.getWorldPosition(_vDuct), gain: 0.3, rate: 0.45 });
      }
    }
    // scoreboard, state 3: THE DRAFT IS WHOLE AND THE PILOT IS DARK. This was
    // the one state on the entire board with no voice at all, and it is the
    // exact state Alex stood in twice — the gauge reads empty (correctly, since
    // round twelve), the slits do not breathe because breath IS pilotLit, and
    // the state-2 duct knock has already retired itself. "made sure everything
    // was active. still no fire." Every part of the machine was honest and the
    // whole machine was silent, and silence reads as broken.
    //
    // So the cold furnace calls back along its own line at the same period and
    // gain as state 2: a dead thud at the mouth, then the pilot's chime where
    // the fire actually has to come from. Only while the skull already carries
    // fire — an empty-handed player is never beaconed to a fixture they cannot
    // use, the same law nudge() enforces — and only while the player is in the
    // basement, so it can never leak into another district. It retires the
    // instant the pilot lights, so it can never become ambience.
    else if (game.act === 'basement'
        && game.flags.has('pumpGalleryLatched') && game.flags.has('archiveDraftOpened')
        && game.flags.has('ateFlame') && !game.flags.has('pilotLit')) {
      incin.pilotCallT = (incin.pilotCallT || 0) + dt;
      if (incin.pilotCallT >= 9) {
        incin.pilotCallT = 0;
        game.audio.thud({ pos: incPos, gain: 0.3, rate: 0.5 });
        game.after(0.42, () => game.basementPilot?.nudge?.());
      }
    }
```

**4. 4. THE REGRESSION. Add a new page to the file that already owns the pilot/furnace contract, immediately BEFORE the final zero-errors check at line 1079. It pins four separate things: (a) the fire condition is continuous — three flags written straight into the Set with no handler, no interact and no throw still wake the furnace on the next frame, which is the assertion that would have answered this whole question in one run; (b) round twelve's gauge fix, which is currently pinned by nothing; (c) the mouth answers every press, not only the hinge; (d) the state-3 standing call fires and then retires. It uses the file's own idioms: `fireDoor.userData.inter.action()` (line 212) and the Set-level state withdrawal (line 598).** — `house-critical-path-regression.mjs`

_anchor:_
```js
  check(report.errors.length === 0, 'all critical-path scenarios produce zero browser errors', report.errors);
```

_change:_
```js
  // ---------------------------------------------------------------- THE
  // FURNACE ORDER PAGE. His report, docs/HIS-NOTES-2026-08-19b.md: "went down
  // the basement stairs and did all puzzles in the basement. the furnace did
  // not have fire... went back down to the basement, made sure everything was
  // active. still no fire. reloaded check point. and then the fire was there."
  //
  // The FIRE is not order-dependent and this page proves it: the flags go
  // straight into the Set with no handler, no interact and no throw, and the
  // furnace still wakes on the next frames. What WAS order-dependent is the
  // furnace's VOICE — the mouth answered once, at the instant the door swung,
  // and the one state where the draft is whole and the pilot is dark had no
  // pointer at all.
  await freshPage();
  const furnaceOrder = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('basement');
    g.enemies.clear();
    const incin = g.incinerator;
    const pilot = g.basementPilot;
    const incPos = g.incineratorPosition;
    // Count only the mouth's own thud. thud/glassTink are shared verbs across
    // the whole game; filtering by position keeps this deterministic.
    let mouthThuds = 0;
    const originalThud = g.audio.thud;
    g.audio.thud = function countMouthThud(opts) {
      const p = opts && opts.pos;
      if (p && Math.hypot(p.x - incPos.x, p.y - incPos.y, p.z - incPos.z) < 0.6) mouthThuds++;
      return originalThud.call(g.audio, opts);
    };
    // pilot.pulse is written by nudge() and by nothing else; it is the exact
    // signal for "the furnace called the pilot", with no audio dependency.
    const runFor = (seconds, chunk = 0.2) => {
      let peakPulse = 0, peakSlit = 0;
      for (let t = 0; t < seconds - 1e-6; t += chunk) {
        F.stepWith(chunk, {}, false);
        peakPulse = Math.max(peakPulse, pilot.pulse);
        for (const s of incin.slits) peakSlit = Math.max(peakSlit, s.scale.y);
      }
      return { peakPulse, peakSlit };
    };
    const fireDoor = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');

    // 1. The mouth is opened EARLY, cold and empty-handed: the natural order.
    const thudsBeforeFirst = mouthThuds;
    fireDoor.userData.inter.action();
    runFor(0.4);
    const firstPressSpoke = incin.doorOpen && mouthThuds > thudsBeforeFirst;

    // 2. The rest of the house happens SOMEWHERE ELSE. Written straight into
    //    the Set — no onHit, no interact, no timer, no act change. If the
    //    furnace needed an
```


### Cost

Draw calls: ZERO. No geometry, no material, no light is added — the state-3 pointer is two existing procedural audio one-shots plus a write to `basementPilot.pulse`, which feeds the `world.candles` descriptor that already exists (house.js:2859), not a new light. The house's 339/450 budget is untouched. Per-frame CPU: one extra `else if` in an already-running ticker, short-circuiting on `game.act === 'basement'` on every frame outside the basement, and at most four `Set.has` lookups inside it — unmeasurable. Build time: two property assignments. Implementation effort: three small edits in one file (about 45 lines of src/house.js, most of it comment) plus about 120 lines of new test. No new file, no new probe, no new gate. Gate cost: `node tests/house-critical-path-regression.mjs` grows by one page whose sim time is ~37 s of stepped game time at 1/120 (roughly 4400 fixed steps, no render) — call it a few seconds of wall clock on top of a suite that already runs 600-frame traversal loops.

### Risk

Low, and the two ways to get it wrong are both named in the patch. (1) Dropping the `if (incin.offered || incin.refused) return;` guard in step 2 would let a press re-light a furnace that has already choked on the skull back to glowTarget 2.4 — a state the old one-shot made unreachable, so it is a NEW failure mode introduced by making the handler repeatable. Assertion 5 in the test exists for exactly that. (2) Shortening the state-3 period below 9 s, raising the gain above 0.3, or dropping either the `ateFlame` or the `game.act === 'basement'` gate turns a pointer into ambience and breaks the quiet-vs-loud economy: the `ateFlame` gate is what keeps the game from beaconing an empty-handed player at a fixture they cannot use (the same law `nudge()` already enforces at house.js:2937), and the act gate is what keeps a basement one-shot from firing while the player is in the graveyard. Note the existing state-2 duct knock at house.js:3298 has NO act gate — a pre-existing inconsistency, deliberately left alone here to keep the patch minimal, worth a one-line follow-up. Nothing in the patch touches the throw grammar, adds on-screen text, encodes anything in hue, or changes a flag's writer. One behavioural change is worth flagging to Alex explicitly: the furnace now makes a quiet sound roughly every 9 s while he is in the basement carrying fire with the pilot dark, which is a state most runs pass through briefly.

### Open questions

- Is the swung-open fire door actually AIMABLE? `_crosshairTarget` casts `far = 2.9` and `registerInteract` used the fireDoor mesh directly (it is a Mesh, house.js:3058), so the E surface swings with the hinge to -1.85 rad and ends up a 0.58 x 0.64 x 0.05 slab roughly edge-on to a player standing square in front of the mouth. If it is not reliably aimable, patch step 2 helps less than it looks and patch step 3 is carrying the whole fix. MEASUREMENT: pose the camera at a spread of stances 1.0-2.5 m in front of (11, -2.1, -1.5), step until two frames are byte-identical, then read `g.__FETCH`-side `_crosshairTarget()?.id` and record the fraction of stances that return 'incineratorDoor' with the door open vs shut. If it is poor, the alternative is to register the repeat answer on the gauge (`draftGauge`, face-on at eye height, the thing he was actually reading) rather than the panel — but that adds an interactable and must be checked against `_crosshairTarget` stealing the `ashPan` press.
- Does round twelve's cold-pilot breath ever actually reach the screen? `pilotGlow` is a `world.candles` DESCRIPTOR competing for one of eight pooled light slots, and in the cold-with-fire state it sits at 0.20 +/- 0.08 with r 4.8. If the pool ranks by distance and the basement has nearer candles, that breath may never be assigned a light at all — in which case the fix shipped in 2009c9c is invisible and the standing call in patch step 3 is the only pointer that exists. MEASUREMENT: stand at the basement stair foot and at the furnace, settle, and read `world.candlePool` for a light whose `userData.c === game.basementPilot`'s glow descriptor; report intensity and whether the slot is held across a 10 s window.
- There is a FOURTH scoreboard hole this patch deliberately does not fill: archive drafted, pump NOT latched, pilot dark. State 2 requires `pumpGalleryLatched`, state 3 (as written) requires it too, so a player who opens the archive collar before crossing the pump bridge gets silence as well. It is not what he hit and the firebox throw still points at the pump (`game.pumpGallery?.nudge?.()`, house.js:3218), so it is left alone — but it is the same class of defect and someone should decide whether it wants the same treatment.
- Which build was he actually playing? docs/HIS-NOTES-2026-08-19b.md is his read of the ROUND ELEVEN build, and round twelve shipped the same evening with the gauge fix and the NO FURNACE plate on the voidDoor. Round thirteen's own brief says "He had not played it at the time of writing. Tell him to hard-refresh." So part of what he describes — the FULL DRAFT needle over a dead furnace — is already gone from what is live. Only he can settle whether the remaining silence is what he is still hitting; that is a question to ask, not to measure.
- Adjacent and already on the round-thirteen agenda: his screenshot #3, "can we make this bell at the bottom of the stairs at the first basement look like its wired to the rest of the puzzle." That is the same fixture and the same failure. Everything above makes the furnace SAY where the fire has to come from; making the bell LOOK like the furnace's pilot is the durable version of the fix, and would probably have prevented this report entirely. Worth doing in the same round.


---

<a id="audit"></a>

## audit

**Round twelve ships no runtime throw and no light-census change, and the spider merge is mathematically exact — but it puts a 2.06 m walk-through iron bell on the secret route's centre-line in the one district Alex just complained about walking through walls, it runs the new webs' collider check eleven builders too early so the check is decorative, and the shipped screenshots contradict two of the round's own central claims (the plate's contrast polarity, and the "lit candle behind the opened door", which does not exist).**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **Step 18's anchor does not exist in src/textures.js. `grep -c` returns 0. The file wraps that sentence across lines 1098-1100 starting with "// from, which is nothing at all. So it is a dark enamel works plate with a pale", and line 1100 continues into "Legibility is CONTRAST, not brightness:" — text the plan's replacement silently deletes.**
  - _fix:_ Replace the anchor with the exact three lines 1098-1100:
"// from, which is nothing at all. So it is a dark enamel works plate with a pale\n// glyph, which is period-correct anyway, and it reads as a dark shape on a\n// light door from across the landing. Legibility is CONTRAST, not brightness:"
and write the replacement so it ends by re-joining line 1101 ("// what the eye needs is a difference, in whichever direction the surface"). Note that the source ALREADY invokes the contrast law explicitly — the only defect is the direction claim, plus the mislabelled "// a dark border" at line 1112 whose strokeStyle is rgb(196,190,172). Keep the fix to those two, do not rewrite the paragraph.

- **Step 3 is wrong in both its premise and its direction, and it partially reverts the round's fix for Alex's notes #4/#5/#6. Premise: installClamp (underfalls.js:1338-1341) early-outs with `if (!p || p.clearance <= -0.04) return;` BEFORE it applies safeW, so a player centre inside the lane is never pulled at all and the reachable set for the centre tops out at clearance -0.04, not -0.08. Direction: `clearance < 0` → `clearance < -0.08` makes the test drop FEWER pieces, so wall boxes whose footprint stands 0 to 8 cm inside the walkable union are now kept — the player stands inside drawn rock, which is the exact complaint ("some of these walls you can walk right through"). The plan's own cost section concedes it keeps more pieces and calls that fine. It is not. Worse, player.js:7 RADIUS = 0.34, so the player's BODY reaches clearance +0.30 even where the centre stops at -0.04.**
  - _fix:_ Drop step 3 entirely. Leave `if (hit && hit.clearance < 0) intrudes = true;` at underfalls.js:575 exactly as it is. If the threshold is ever revisited it must move UP (toward +0.30, the body radius), never down, and that change needs a measurement, not an argument.


### Execute THIS (the challenged, corrected plan)

Execute the plan minus step 3, minus step 16, with step 18's anchor replaced by the real text at src/textures.js:1098-1100 and step 19 extended to all four probe poses. Order the work: (1) apply steps 4, 5, 6 — the web deferral — first, because it is the only edit with real structural reach and it is safe on the grounds that matter (game.webs' only runtime reader is main.js:1842, and houseRenderRoots/houseInteriorRoots are computed at main.js:187-188 after buildHouse returns, so a drain at the end of buildHouse keeps all 19 webs in the interior cull ledger); then run tools/probe-webs.mjs and record placed/skipped as the new baseline. (2) Then step 7, but only if Alex does not want the counterweight kennel dressed as the barred cell his note #2 asks for; step 8 (drop the guest web) is safe either way. (3) Then step 1 with the collider radius reduced to 0.72 and its comment corrected to state that an AABB of half-extent 0.72 is genuinely inscribed inside the 1.03 rim, plus step 2 as Option A with the chain arithmetic corrected (the low end is at C.x+0.948 / C.y+2.682 and sat ON the old rim ring, which is why Option B — reverting the drop — is a live alternative that needs Alex's answer); re-run choir-surfacing and choir-route-occlusion afterwards even though tests/playthrough.mjs walks only the MAIN cave route (lines 1044-1085) and never the secret one. (4) Then steps 13 (with a radial rather than axis clamp), 14 (safe: the orphaned SphereGeometry(0.09,6,5) at outside.js:6940 is used by nothing else, and the shared M.curtain material is correctly not disposed), 15, 17, 18-as-corrected and 19-as-corrected. (5) Hold steps 9-12 until one probe re-shoots the four door-sign poses with the skull HELD and reports web-vs-plate-vs-wall luminance — the shipped screenshots carry no lantern, so they cannot size the fix, and picking 0.13/0.24 without that number repeats the exact unmeasured-lever failure the plan itself indicts. (6) Step 20 stays as the merge gate but is retargeted from skyline to lateral enclosure, because the roof box at underfalls.js:521-524 is still unconditional and the moon/stars precedent at line 519 was a roof bug, not a flank bug. No step in this plan breaks a law: nothing adds on-screen text or HUD, nothing encodes meaning in hue alone, the throw grammar is untouched, and the visible light count is unchanged (world.js:1129-1141 keeps eight resident always-visible PointLights and the plan adds no THREE.Light). Draw-call accounting is honest — the house measures 335 against the 450 ceiling asserted per district in tests/district-culling-regression.mjs, step 8 removes 2 line draws, steps 9-12 add materials not draws, and step 1 adds a collider, not a draw. There is no finishStatic material-identity trap, no new per-frame throw (the appended ravine halo lands in an array iterated by its own length at outside.js:6683-6686), and no non-terminal state.

### Findings

- **SEVERITY 1 — The bell now stands on the floor across the secret route's walking line with no collider, so the player walks through 2.06 m of solid iron at chest height. `bell cistern` is both a chamber (r 3.45) AND `SECRET_LOCAL[3]`, i.e. a NODE on the secret path — the route passes through C exactly. The lathe profile runs [0.18,0.00] → [1.03,1.44], so after the drop the object occupies y = C.y … C.y+1.44 with a radius reaching 1.03, plus a pale rim torus at C.y+1.44 (r 1.03) — that is 0.18 m BELOW eye height (player.js EYE = 1.62, RADIUS = 0.34). Nothing in this district gives it a collider: `addColliderCylinder` is used only at underfalls.js:872 ('pump chapel pillar') and :895 ('pump altar'). Before the change the walk-through cross-section at body height was ~0.68 m wide; it is now ~2.06 m — a 2.6x increase in exactly the failure Alex reported ('some of these walls you can walk right through'). No gate catches this because no suite asserts that a visible solid owns a collider, and the cave suites that do run (`underfalls-expansion`) are already red for unrelated reasons.**
  - `underfalls.js:1129`
  - evidence: const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), iron);   bell.position.set(C.x, C.y, C.z);   ...   const bellRim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.075, 7, 24), pale);   bellRim.position.set(C.x, C.y + 1.44, C.z); // underfalls.js:34  Object.freeze({ x: 27, z: 68, y: 1.25, w: 1.55, name: 'bell cistern' }),   <-- SECRET path node // underfalls.js:41  Object.freeze({ x: 27, z: 68, y: 1.25, r: 3.45, name: 'bell cistern', secret: true })

- **SEVERITY 1 (same edit) — The commit's stated rationale for the drop is wrong, and it destroys an authored read written 20 lines above it in the same function. The comment at underfalls.js:1105-1110 says the bell is DELIBERATELY suspended and inverted: 'A lathed open bell reads as a bell from below … Here the mouth faces upward, wrong-way, and a pale rim makes that inversion readable by value and silhouette.' The new comment calls the +1.18 an inherited bug and says the object 'floated unattached … under a snapped chain that misses it by half a metre'. It misses by half a metre LATERALLY only: the snapped chain is a 1.8 m cylinder centred at (C.x+0.48, C.y+3.45) rotated z by 0.55, so its low end is at x = C.x+0.48-0.9·sin(0.55) = C.x+0.012 and y = C.y+3.45-0.9·cos(0.55) = C.y+2.684 — 0.06 m above the OLD rim at C.y+2.62 and dead over the axis. The chain was hung to meet the rim. The drop opens a 1.24 m vertical gap, so the chain now points at nothing and the object reads as a giant cone balanced on its point rather than a fallen bell (a fallen bell lies on its side or mouth-down; this one kept mouth-up).**
  - `underfalls.js:1139`
  - evidence: const snapped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 5), iron);   snapped.position.set(C.x + 0.48, C.y + 3.45, C.z - 0.2);   snapped.rotation.z = 0.55; // low end: y = 3.45 - 0.9*cos(0.55) = 2.684 ; x offset = -0.9*sin(0.55) = -0.468 -> C.x+0.012

- **SEVERITY 2 — `webClear` runs eleven builders too early, so 'every site is checked against the colliders before it is built' is false for exactly the rooms that matter. `buildHouse` calls `furnish(game)` at house.js:777 and only THEN bedroomAct, nurseryAct, voidDoorAct, frontDoorKnockAct, buildWindowRelay, buildSculleryCrawler, buildWindowWatchers, buildHouseReturnHorror, buildHouseFamilyPhoto, cellarBoards, basementAct and buildPumpGallery (778-789). Four of the seven new basement sites — boiler (0x2a55), blind archive (0x2a66), pump gallery (0x2a77), hatchbay (0x2a44) — sit in rooms whose entire contents are built by `basementAct` and `buildPumpGallery`, after the check. Worse, `webClear` only ever consults `game.world.colliders`, and almost all house decor (the whole incinerator assembly, the archive gauges, the ceiling brass line) is collider-free, so it is invisible to the check in any ordering. ROUND-TWELVE.md's 'All nineteen cleared' therefore means only 'nothing rejected them', not 'nothing is there'.**
  - `house.js:1689`
  - evidence:     if (site.curtain === undefined && !webClear(x, y, z, 0.62 * site.s + 0.12)) { // house.js:777-789   furnish(game);   bedroomAct(game); nurseryAct(game); voidDoorAct(game); frontDoorKnockAct(game);   buildWindowRelay(game); buildSculleryCrawler(game); buildWindowWatchers(game);   buildHouseReturnHorror(game); buildHouseFamilyPhoto(game); cellarBoards(game);   basementAct(game); buildPumpGallery(game);

- **SEVERITY 2 — Consequence of the above, computed statically: the 'crawl, deep end' web (0x2a33) is placed INSIDE the barred counterweight kennel, a locked mechanism cage the player can never enter. I reproduced mkWeb's RNG stream exactly (seed 0x2a33, same call order) — the web's world AABB is x[-11.32,-9.98] y[-1.93,-0.08] z[-9.30,-7.96]. The cage footprint from buildCrawlCounterweightSecret is xWest=-11.72, frontX=-8.25, zSouth=-9.7, zNorth=-6.25, bars from B to B+2.32. The web centre is inside it. It does NOT intersect anything (every bar is at x=-8.25 or z=-6.25; the cradle at x=-9.48±0.4 clears the web's max x of -9.98 by 0.10 m), so no gate and no probe would ever complain — but 'crawl, deep end' is not where it landed, nobody chose to put a web in the kennel, and the margin against the cradle is 10 cm decided by an RNG seed. The 'blind archive' web (0x2a66, AABB x[-19.10,-17.85] z[4.16,5.42]) similarly clears the west shelf collider x[-19.62,-19.28] by 0.18 m — again a seed-decided coin flip on a check that could not have caught it.**
  - `house.js:1655`
  - evidence: { at: [-10.65, -1.30, -8.65], rotY: Math.PI / 4, s: 0.55, seed: 0x2a33, spider: true },  // crawl, deep end // house.js:3488-3497 (buildCrawlCounterweightSecret, called from basementAct AFTER furnish)   const frontX = -8.25;   const zSouth = -9.7, zNorth = -6.25;   const xWest = -11.72;   const barY = B + 1.16;  const barH = 2.32;

- **SEVERITY 3 — The webs are UNLIT, and there are now 19 of them. `LineBasicMaterial` ignores lights entirely, so a strand is drawn at full authored brightness (0xb4bac0 @ 0.26, dew 0xd8dde2 @ 0.5) no matter how far the carried skull-light is, in a game whose whole premise is one carried light. The only attenuation is fog, and at the house's fog density (~0.028, exp2) the factor at 5 m is 1.9% — nothing. The round's own shipped screenshot proves it: in shots/door-sign/1-closed-from-stairs.png the stair-shaft web is the single brightest object in the frame — brighter than the wall it hangs on, and far more conspicuous than the NO FURNACE plate the screenshot exists to prove. Going 5 -> 19 puts a permanent constellation of self-luminous shapes on every floor of a house that is supposed to be dark. No gate sees this: legibility-regression asks whether authored things can be seen, never whether decor out-shouts them.**
  - `house.js:1536`
  - evidence: const strandMat = new THREE.LineBasicMaterial({ color: 0xb4bac0, transparent: true, opacity: 0.26, depthWrite: false });   const dewMat = new THREE.LineBasicMaterial({ color: 0xd8dde2, transparent: true, opacity: 0.5, depthWrite: false }); // evidence: shots/door-sign/1-closed-from-stairs.png and 3-open-from-stairs.png

- **SEVERITY 3 — The round's central claim about the NO FURNACE plate is false: nothing lights behind the void door when it opens. The new comment says 'when the beat finally knocks it open, the plate swings away with the panel and what is behind it is the lit candle you came for. The warning is replaced by the answer.' But `openDoor` deliberately leaves the candle DARK — the flame stays at scale 0.0001 (set at build) and the glow is driven to 0.08 + max(0,sin(t·1.7))·0.09 until the player STRIKES the wick with the skull. The code's own comment says so: 'The door now opens on an UNLIT igniter. The wick waits dark.' shots/door-sign/3-open-from-stairs.png confirms it — the opened doorway is completely black. Nobody is harmed at runtime, but the comment and ROUND-TWELVE.md both assert a beat that does not exist, and the next agent will build on it.**
  - `house.js:7007`
  - evidence: // open, the plate swings away with the panel and what is behind it is the lit // candle you came for. The warning is replaced by the answer // vs house.js:7212-7218 inside openDoor(): //   The door now opens on an UNLIT igniter. The wick waits dark; the glow //   barely breathes ...       game.tickers.push((dt, time) => {         if (game.flags.has('ateFlame') || ignite.t >= 0) return;         glow.intensity = 0.08 + Math.max(0, Math.sin(time * 1.7)) * 0.09;       });

- **SEVERITY 3 — The plate's contrast polarity in the shipped screenshots is the OPPOSITE of what the source comment claims, and the comment concedes contrast never moved. textures.js says 'it is a dark enamel works plate with a pale glyph … it reads as a dark shape on a light door from across the landing.' In shots 1 and 2 the plate reads as a LIGHT rectangle on a DARK door. The paint function explains why: after the dark ground it lays down a pale border stroke at lineWidth w·0.045 over 89% of the plate, a SOLID pale furnace body of 0.36w x 0.30w, a pale circle stroke of lineWidth w·0.075 at radius 0.353w, and a pale slash — roughly 35-40% pale coverage, which is what the mip chain averages toward at the read distance. The same comment also admits the measurement: 'a pale plate and a dark one measured the same … Frame share on the approach is what moved.' Under this project's law (legibility is CONTRAST, not brightness) that is an explicit statement that the lever chosen was size, not contrast — the working-but-illegible pattern. Additionally the strokeStyle labelled 'a dark border' is rgb(196,190,172), which is pale.**
  - `textures.js:1104`
  - evidence: // the same. So it is a dark enamel works plate with a pale // glyph, which is period-correct anyway, and it reads as a dark shape on a // light door from across the landing. // ...   g.strokeStyle = rgb(196, 190, 172); g.lineWidth = w * 0.045;   // comment says "a dark border"   g.fillStyle = rgb(206, 200, 182);   g.fillRect(cx - bw / 2, cy - bh * 0.34, bw, bh);               // solid pale body, 0.36w x 0.30w

- **SEVERITY 3 — The cave flank-wall dropout ships with no measurement that the enclosure survives. The loop drops any wall piece whose 9-point footprint touches the walkable union; the commit says 'About a third of them do … and every one of those places already owns its enclosure from another region's flanks, roofs or chamber cap.' Nothing in the diff measures that, and the identical failure — 'strips of moon and stars visible between the decorative chamber caps' — is documented 20 lines above as a bug that already shipped once. No gate looks at whether the skybox is visible from inside the cave. Separately, the threshold is slightly wrong: `installClamp` lets a legal player CENTRE reach clearance -0.08 (safeW = max(0.35, p.w - 0.08)), so a piece is outside the lane at clearance >= -0.08, not > 0. Using `< 0` drops marginally more pieces than the lane actually requires.**
  - `underfalls.js:575`
  - evidence:             const hit = projectUnderfalls(layout, cx + ox, cz + oz);             if (hit && hit.clearance < 0) intrudes = true; // vs underfalls.js:1341 (installClamp)     const safeW = Math.max(0.35, p.w - 0.08);

- **SEVERITY 4 — The spider's `home` is an unbounded accumulator that walks it off its own web. Each dart adds cos(a)·0.45 to `home.x` with no clamp (only `home.y` is capped at 0.9), and it re-arms every 6 s while the player is within 1.7 m. The web's own radius is R = 0.95-1.19 local, so a random walk of ±0.45 carries the spider clear of the silhouette after only 4-6 net steps — a near-black unlit mesh hanging in mid-air beside its web. This code is pre-existing, but round twelve triples the exposure (3 -> 9 spiders) and, crucially, moves four of them into rooms the player STANDS in (study, nursery, scullery, guest) rather than a corridor they pass through. Gates never idle a player next to a web for a minute.**
  - `house.js:1724`
  - evidence:         if (d < 1.7 && darted <= 0) {           darted = 6;                                          // it FLEES you — motion is the scare           const a = Math.random() * TAU;           home.set(home.x + Math.cos(a) * 0.45, Math.min(0.9, home.y + 0.3), 0.02);         }

- **SEVERITY 4 — One new web sits in the guest room, the one room in the house the player can never enter ('The guest room's only door hangs over the stair shaft, out of any hand's reach … The room itself you never get'). Site 0x4c22 is at (10.6, 5.65, -8.6); the guest room is cells (8,2)-(11,5) = world x 4..12, z -10..-2. Its world AABB is x[10.13,11.36] z[-9.04,-7.80], the far corner from the doorway at (4, -7). It is at best glimpsed at a glancing angle through the opened voidDoor, at worst never seen; either way it costs 2 line draws in the tightest district in the game, and if it IS seen it competes with the candle the void-door beat exists to reveal.**
  - `house.js:1667`
  - evidence: { at: [10.6, 5.65, -8.6], rotY: -Math.PI / 4, s: 0.55, seed: 0x4c22 },                   // guest room // house.js:6984  The guest room's only door hangs over the stair shaft, out of any hand's // reach ... The room itself you never get.

- **SEVERITY 4 — probe-door-sign.mjs shot the plate from a pose no player can occupy, so the four screenshots in this diff do not answer the question they were taken to answer. `look([2.6, 3.6, -4.4], ...)` puts the feet at y=3.6 (first-floor level) and the eye at 5.2. But (2.6, -4.4) is inside the main stair shaft (floorHole first 6,2-7,5 = world x 0..4, z -10..-2), and the mainStairs ramp interpolates y=0 at z=-10 to y=3.6 at z=-2, so a real player at z=-4.4 stands at y≈2.52 with an eye at 4.14 — 1.06 m lower and a materially steeper look-up at a plate whose centre is at y=5.025. The shots therefore overstate how square-on the plate is read.**
  - `probe-door-sign.mjs:73`
  - evidence:   look([2.6, 3.6, -4.4], [4.0, 4.75, -7.0]);   shoot('1-closed-from-stairs'); // HOUSE_TABLES.ramps: { id: 'mainStairs', x0: 6, x1: 7, z0: 2, z1: 5, axis: 'z', y0: 0, y1: 3.6 }

- **SEVERITY 5 — Small leaks and dead code introduced by the diff. (a) `this.ravineKnot.geometry = knotGeo` orphans the old SphereGeometry(0.09,6,5) without disposing it — one leak per forest build. (b) `const CEIL = HOUSE_TABLES.levels;` at house.js:1644 is never read. (c) `webClear`'s guards `c.disabled` and `c.enabled === false` are dead: World.addCollider spreads only the caller's flags and no caller sets either; `enabled === false` is a ZONE property (world.js:312), not a collider one. (d) nurseryAct gained a stray blank line at house.js:2513. None of these can fail; they are noise that will mislead.**
  - `outside.js:6256`
  - evidence:       this.ravineKnot.material = knotMat;       this.ravineKnot.geometry = knotGeo;      // old SphereGeometry(0.09,6,5) never disposed // house.js:1644  const CEIL = HOUSE_TABLES.levels;     (unused) // house.js:1678  if (c.door || c.disabled || c.enabled === false) continue;   (last two never set)

- **SEVERITY 5 — The gauge fix is correct but removes the only positive feedback for two solved puzzles. `gaugeGoal = hasDraft ? -1.02 : 1.18` is now binary on all three conditions, so a player who has latched the pump and opened the archive but not lit the pilot sees the needle sit exactly where it sat before they did anything. The lie is gone; so is the reward. The furnace still has its state-2 duct knock for the archive half, but nothing acknowledges the pump half at all. A three-detent needle would keep both properties.**
  - `house.js:3282`
  - evidence:     const gaugeGoal = hasDraft ? -1.02 : 1.18; // where hasDraft = pilotLit && pumpGalleryLatched && archiveDraftOpened

- **CLEARED — the spider merge is EXACT, to the matrix. Three's Euler default order is 'XYZ' and setting only .z and .y leaves it 'XYZ', so `new THREE.Euler(0, side*(k-1.5)*0.35, side*(0.7+k*0.12), 'XYZ')` is the identical rotation, and `Matrix4.compose(T,R,S)` = T·R·S is exactly what Object3D builds. seg1: old world = legM·T(0,0.034s,0); new = applyMatrix4(legM) after translate() gives legM·T·v — identical. seg2: old local = T(0,0.068s,0.01s)·Rx(1.25) because Object3D composes T·R·S; new does `rotateX(1.25)` THEN `translate(...)`, giving T·Rx·v, then legM — identical. (Translate-then-rotate would have been wrong; the author got the order right.) abdomen: old = T(0,0,-0.045s)·S(0.85,0.75,1.15), and the bake composes precisely that. Head: T only. mergeGeometries cannot return null here — SphereGeometry and CylinderGeometry both carry {position,normal,uv} and both are indexed — and the source geometries ARE disposed at house.js:1629.**
  - `house.js:1601`
  - evidence:       const legM = new THREE.Matrix4().compose(         new THREE.Vector3(side * 0.02 * scale, 0, (k - 1.4) * 0.02 * scale),         new THREE.Quaternion().setFromEuler(           new THREE.Euler(0, side * (k - 1.5) * 0.35, side * (0.7 + k * 0.12), 'XYZ')),         new THREE.Vector3(1, 1, 1));       seg2.rotateX(1.25); seg2.translate(0, 0.068 * scale, 0.01 * scale); seg2.applyMatrix4(legM);

- **CLEARED — no light-census change anywhere in the diff, and no new per-frame throw. (a) LIGHT CENSUS: `updateCandles` sorts descriptors by DISTANCE ONLY and always drives the same 8 resident PointLights, so raising pilotGlow from 0 to 0.12-0.28 cannot add, remove or reorder a light — the slot was already held at intensity 0. The diff adds no THREE.Light at all: the ravine halo is a Sprite, the plate a Mesh, the spiders Meshes. (b) THROWS: every changed ticker re-reads its inputs from game.flags / userData. `hasDraft` is declared at the TOP of its own ticker (house.js:3261), so no TDZ. The chain-corona loop indexes `_chainCoronas` positionally, and the appended ravine halo simply becomes index knots.length — no mismatch, no throw. `w.userData.scale0 || 1` and `game.flags.has(...)` cannot be undefined. (c) finishStatic IDENTITY: the diff adds no material or geometry identity comparison; `world.box(M.rock, ...)` in underfalls joins the pre-existing M.rock merge, and the ravine knot's material/geometry assignment targets a live Group child (`scene.add(rope)` in _setpieces), never a batch — and _setpieces() at outside.js:4866 provably runs BEFORE _buildChain() at 4869, so `this.ravineKnot` is always set. (d) The ossuary z-fight delete leaves no hole: the removed plate x[OX-2.9,OX-2.0] z[OZ+33.70,OZ+34.16] is fully inside the kept one x[OX-3.0,OX+2.9] z[OZ+33.7,OZ+35.7], and DECK_Y now has exactly one surface. (e) No web is visible from outside the house: every new site's bbox fails the `max.y>=5.5 && max.z>=5.5` exterior test in _findHouseInteriorRoots, so all 19 are in houseInteriorRoots and are held hidden every frame the act is not bedroom/house/basement. (f) The underfalls per-tread rebuild costs no draw calls (one merged M.rock batch) and no boot time worth measuring: _buildOcclusionGrid iterates COLLIDERS, and these boxes have none, so the grid is unchanged; _bakeContactShading grows by roughly 12k vertices x 26 lookups, well under 100 ms.**
  - `world.js:1147`
  - evidence:   updateCandles(dt, playerPos, t) {       const sorted = this.candles.slice().sort((a, b) =>         ((a.x - playerPos.x) ** 2 + (a.z - playerPos.z) ** 2) -         ((b.x - playerPos.x) ** 2 + (b.z - playerPos.z) ** 2)); // 8 fixed PointLights, l.visible = true always (world.js:1131-1138)

- **CLEARED (with the missing mechanism) — the NO FURNACE plate is mechanically sound, and the perf-pool 831->833 is benign. PLATE: the panel is `BoxGeometry(w-0.06, h-0.05, 0.09)` so panelDepth=0.09 is right; the plate spans z ±(0.046..0.058), i.e. its back face is 1 mm proud of the panel at 0.045 — no z-fight. `panel.position.set((w-0.06)/2, 0, 0)` means the panel's own origin is its CENTRE, so `plate.position.set(0, 0.30, ...)` is horizontally centred and 0.30 above centre (world y 5.025). Both faces get one, and closed the face=+1 plate points at world -x, i.e. straight at the stair shaft. It swings with the panel (child of door.panel) and at openAngle 2.75 the panel free edge lands at (5.70, -7.25) — the plate at hinge-radius 1.141 never reaches the far jamb at 1.93. It cannot block the door's E-verb: main.js:1942 uses `intersectObjects(this.world.interactables, false)` — non-recursive, so children of `panel` are never tested. PERF-POOL: the missing piece the round doc could not find is that `_warmDrawList` dedupes by `material.uuid|layout|kind`, so exactly ONE of the 19 webs' line geometries is ever warm-drawn no matter how many exist — and under ?test=1 the warm pass is skipped entirely (main.js:851-853), so the gate uploads none of them. Two entering view between the two samples is a benign lazy upload of decoration; the round doc's instruction not to loosen the gate is right, and the correct fix is a settle, not a warm.**
  - `house.js:7025`
  - evidence:     const PLATE_W = 0.44, PLATE_H = 0.34;     const panelDepth = 0.09;       plate.position.set(0, 0.30, face * (panelDepth / 2 + 0.007)); // world.js:1200  const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.05, 0.09), M.woodDark); // world.js:1201  panel.position.set((w - 0.06) / 2, 0, 0); // main.js:857    const key = `${material.uuid}|${layout}|${kind}`;


### Raw steps (superseded by the corrected plan above where they conflict)

**1. 1. Give the bell a collider. This is non-negotiable regardless of where it ends up standing — a 2 m visible solid on the walking line with no collision is the exact defect Alex reported in this district. Insert immediately after the clapper.** — `underfalls.js`

_anchor:_
```js
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), iron);
  clapper.position.set(C.x, C.y + 0.28, C.z);
  group.add(clapper);
```

_change:_
```js
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), iron);
  clapper.position.set(C.x, C.y + 0.28, C.z);
  group.add(clapper);
  // A TWO-METRE IRON OBJECT ON THE WALKING LINE IS NOT A HOLOGRAM.
  //
  // The bell cistern is a chamber (r 3.45) AND a node on the secret path, so
  // this stands dead centre of where the player walks. Nothing in this district
  // gave it collision, which is one more of "some of these walls you can walk
  // right through". Radius 0.78 rather than the rim's 1.03: the collider is an
  // AABB, and an inscribed box keeps the invisible corners inside the silhouette
  // instead of 30 cm proud of it. The chamber is 3.45 m of floor, so the lane
  // around it stays wider than the route ever was.
  addColliderCylinder(world, C.x, C.z, 0.78, C.y - 0.2, C.y + 1.5, 'fallen bell');
```

**2. 2. Decide the bell's pose deliberately, and make the dressing agree. TWO options — this is Alex's call, not the applier's. OPTION A (recommended, smaller): keep it on the floor and lower the snapped chain so it stops pointing at a 1.24 m gap. OPTION B: revert the drop (restore +1.18 / +2.62 / +1.46) — the authored comment at underfalls.js:1105 and the chain geometry both say it was meant to hang. Under Option B step 1's collider becomes `C.y + 1.0, C.y + 2.7`. The edit below is Option A.** — `underfalls.js`

_anchor:_
```js
  const snapped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 5), iron);
  snapped.position.set(C.x + 0.48, C.y + 3.45, C.z - 0.2);
  snapped.rotation.z = 0.55;
```

_change:_
```js
  // The chain's low end used to sit 0.06 m above the rim — it was HOLDING the
  // bell, not missing it, and dropping the bell opened a 1.24 m gap that reads
  // as a chain pointing at nothing. Shortened and lowered so its free end stops
  // just above the fallen rim: the chain now ends where the bell ends, which is
  // the only way "it fell" is a sentence and not two unrelated props.
  const snapped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.2, 5), iron);
  snapped.position.set(C.x + 0.48, C.y + 2.55, C.z - 0.2);
  snapped.rotation.z = 0.55;
```

**3. 3. Match the flank-piece intrusion threshold to the clamp's own margin, so the test drops exactly the pieces the lane needs dropped and no more.** — `underfalls.js`

_anchor:_
```js
            if (hit && hit.clearance < 0) intrudes = true;
```

_change:_
```js
            // -0.08, not 0: installClamp permits a legal player CENTRE at
            // clearance -0.08 (safeW = max(0.35, p.w - 0.08)), so that — not the
            // nominal route edge — is where the walkable union actually stops.
            if (hit && hit.clearance < -0.08) intrudes = true;
```

**4. 4. Defer the web placement until every builder has run, so the collider check is real. Part 1 of 2: wrap the placement loop in a closure and queue it.** — `house.js`

_anchor:_
```js
  const webReport = { placed: 0, skipped: [] };
  for (const site of webSites) {
```

_change:_
```js
  // DEFERRED UNTIL THE HOUSE IS FINISHED. This ran inside furnish(), which is
  // the FIRST of twelve builders — so the "checked against the colliders"
  // guarantee below could not see bedroomAct, nurseryAct, voidDoorAct,
  // frontDoorKnockAct, the window relay, the scullery crawler, the window
  // watchers, the return horror, the family photo, cellarBoards, basementAct or
  // buildPumpGallery. Four of the seven basement sites are in rooms those last
  // two build. buildHouse drains this queue after all of them.
  const webReport = { placed: 0, skipped: [] };
  const placeWebs = () => {
  for (const site of webSites) {
```

**5. 5. Defer the web placement — part 2 of 2: close the closure, queue it, and drain the queue at the end of buildHouse.** — `house.js`

_anchor:_
```js
  game.__webReport = webReport;
}
```

_change:_
```js
  game.__webReport = webReport;
  };
  (game.__deferredBuild || (game.__deferredBuild = [])).push(placeWebs);
}
```

**6. 6. Defer the web placement — drain point. Must be the last thing buildHouse does, before main.js:188 computes houseInteriorRoots from houseRenderRoots.** — `house.js`

_anchor:_
```js
  basementAct(game);
  buildPumpGallery(game);
}
```

_change:_
```js
  basementAct(game);
  buildPumpGallery(game);
  // Anything that needs the FINISHED collider set runs here — the corner webs
  // are checked against a house that is actually furnished, not a half-built one.
  for (const fn of game.__deferredBuild || []) fn();
  game.__deferredBuild = null;
}
```

**7. 7. Move the crawl web out of the counterweight kennel. Its current site is inside the barred cage (x[-11.72,-8.25] z[-9.7,-6.25]) which the player can never enter. The crawl room is x -12..-4, z -10..2; the north-west corner at (-10.65, 0.65) is 1.35 m from both walls (the same offset every other basement site uses) and clear of the crawl->hatchbay door aperture at x -9.65..-8.35.** — `house.js`

_anchor:_
```js
    { at: [-10.65, -1.30, -8.65], rotY: Math.PI / 4, s: 0.55, seed: 0x2a33, spider: true },  // crawl, deep end
```

_change:_
```js
    { at: [-10.65, -1.30, 0.65], rotY: Math.PI * 0.75, s: 0.55, seed: 0x2a33, spider: true }, // crawl, north-west corner (the deep end is INSIDE the counterweight kennel)
```

**8. 8. Drop the guest-room web. It is in the one room the game will never let the player enter, and if it is visible at all it is visible only through the opened voidDoor, competing with the candle that beat exists to reveal.** — `house.js`

_anchor:_
```js
    { at: [10.6, 5.65, -8.6], rotY: -Math.PI / 4, s: 0.55, seed: 0x4c22 },                   // guest room
```

_change:_
```js
    // (no guest-room web: that room is the one place the player can never stand,
    //  and the only sightline into it is the open voidDoor, where the candle wants
    //  the frame to itself)
```

**9. 9. Dim the corner webs. They are unlit LineBasicMaterial, i.e. full brightness at any range in a game lit by one carried skull — the shipped screenshot has one out-reading the sign it was taken to prove. The corridor five keep their authored value; the fourteen new ones become decor. Part 1 of 3: add the dim pair.** — `house.js`

_anchor:_
```js
  const strandMat = new THREE.LineBasicMaterial({ color: 0xb4bac0, transparent: true, opacity: 0.26, depthWrite: false });
  const dewMat = new THREE.LineBasicMaterial({ color: 0xd8dde2, transparent: true, opacity: 0.5, depthWrite: false });
```

_change:_
```js
  const strandMat = new THREE.LineBasicMaterial({ color: 0xb4bac0, transparent: true, opacity: 0.26, depthWrite: false });
  const dewMat = new THREE.LineBasicMaterial({ color: 0xd8dde2, transparent: true, opacity: 0.5, depthWrite: false });
  // A LINE IS UNLIT. LineBasicMaterial ignores every light in the game, so a web
  // is drawn at full authored value whether the skull is next to it or thirty
  // metres away, and fog at the house's density buys 2% at five metres. Five of
  // these were authored as a corridor you brush through; fourteen more at the
  // same value make a constellation of the brightest objects in a dark house,
  // and one of them out-reads the NO FURNACE plate in this round's own
  // screenshot. The corner kind is decor and is lit like decor.
  const strandMatDim = strandMat.clone(); strandMatDim.opacity = 0.13;
  const dewMatDim = dewMat.clone(); dewMatDim.opacity = 0.24;
```

**10. 10. Dim the corner webs, part 2 of 3: let mkWeb pick the pair.** — `house.js`

_anchor:_
```js
  const mkWeb = (seed) => {
```

_change:_
```js
  const mkWeb = (seed, dim = false) => {
```

**11. 11. Dim the corner webs, part 2b: use the chosen pair when building the LineSegments.** — `house.js`

_anchor:_
```js
    for (const [arr, mat] of [[main, strandMat], [dew, dewMat]]) {
```

_change:_
```js
    for (const [arr, mat] of (dim ? [[main, strandMatDim], [dew, dewMatDim]] : [[main, strandMat], [dew, dewMat]])) {
```

**12. 12. Dim the corner webs, part 3 of 3: the curtain five stay bright, everything else dims.** — `house.js`

_anchor:_
```js
    const w = mkWeb(site.seed);
```

_change:_
```js
    const w = mkWeb(site.seed, site.curtain === undefined);
```

**13. 13. Bound the spider's dart so it cannot walk off its own web. `home.y` is already capped; `home.x` is not, and a random walk of ±0.45 in web-local units clears the web (R = 0.95-1.19) after four to six net steps.** — `house.js`

_anchor:_
```js
          home.set(home.x + Math.cos(a) * 0.45, Math.min(0.9, home.y + 0.3), 0.02);
```

_change:_
```js
          // clamped to the web it lives on: home was an unbounded accumulator,
          // and a spider that random-walks past R is a black shape hanging in
          // the air next to its web
          home.set(clamp(home.x + Math.cos(a) * 0.45, -0.6, 0.6), Math.min(0.9, home.y + 0.3), 0.02);
```

**14. 14. Dispose the ravine knot's replaced geometry.** — `outside.js`

_anchor:_
```js
      this.ravineKnot.material = knotMat;
      this.ravineKnot.geometry = knotGeo;
```

_change:_
```js
      this.ravineKnot.material = knotMat;
      this.ravineKnot.geometry.dispose();      // the 0.09 sphere it was, orphaned otherwise
      this.ravineKnot.geometry = knotGeo;
```

**15. 15. Delete the dead const in the web block. It is never read.** — `house.js`

_anchor:_
```js
  const CEIL = HOUSE_TABLES.levels;
  const webSites = [
```

_change:_
```js
  const webSites = [
```

**16. 16. Delete webClear's dead guards. World.addCollider spreads only the caller's flags and no caller sets `disabled`; `enabled === false` is a ZONE property (world.js:312), not a collider one. Leaving them implies a disable mechanism that does not exist.** — `house.js`

_anchor:_
```js
      if (c.door || c.disabled || c.enabled === false) continue;
```

_change:_
```js
      if (c.door) continue;                 // doors swing; nothing else here is switchable
```

**17. 17. Correct the void-door comment. The candle behind that door is deliberately DARK when it opens — openDoor's own comment says so, and shots/door-sign/3-open-from-stairs.png shows a black doorway. Leaving the claim in place will have the next agent building on a beat that does not exist.** — `house.js`

_anchor:_
```js
  // every player sees it on the way down — and when the beat finally knocks it
  // open, the plate swings away with the panel and what is behind it is the lit
  // candle you came for. The warning is replaced by the answer, and it costs
  // nothing to say it that way: the plate is a child of the panel.
```

_change:_
```js
  // every player sees it on the way down — and when the beat finally knocks it
  // open, the plate swings away with the panel. What is behind it is NOT a lit
  // candle: openDoor deliberately opens on an unlit igniter (flame at scale
  // 0.0001, glow breathing at 0.08-0.17) and the wick only takes when the skull
  // strikes it. The plate is the warning; the strike is the answer. It costs
  // nothing to say it that way: the plate is a child of the panel.
```

**18. 18. Correct the plate's polarity claim in textures.js. The two shipped screenshots show a LIGHT plate on a DARK door — the opposite of what the comment asserts — because the pale border, the solid pale furnace body, the pale circle and the slash cover 35-40% of a 256 px sheet that mips toward its mean at the read distance. Also fix the mislabelled 'dark border' (it is rgb(196,190,172)).** — `textures.js`

_anchor:_
```js
// the same. So it is a dark enamel works plate with a pale glyph, which is
// period-correct anyway, and it reads as a dark shape on a light door from
// across the landing.
```

_change:_
```js
// the same. So it is a dark enamel ground carrying a pale border, a pale
// pictogram and a pale slash — and BE HONEST ABOUT WHAT THAT RENDERS AS: the
// pale strokes cover 35-40% of a 256 px sheet, so at the read distance the mip
// chain averages the plate ABOVE the door and it reads as a LIGHT rectangle on
// a dark door, not the other way round (see shots/door-sign/2-closed-close.png).
// That is still contrast, which is the only thing the law asks for. What it is
// NOT is a contrast win that was measured: the measurement said pale-vs-dark
// came back the same and only frame share moved. If this plate ever has to be
// defended, re-measure the luminance ratio from a pose on the ramp — not from
// the probe's current floating eye.
```

**19. 19. Fix the probe's camera so future shots are from a pose a player can occupy. The mainStairs ramp puts the feet at y≈2.52 at z=-4.4, not 3.6.** — `probe-door-sign.mjs`

_anchor:_
```js
  look([2.6, 3.6, -4.4], [4.0, 4.75, -7.0]);
  shoot('1-closed-from-stairs');
```

_change:_
```js
  // ON THE RAMP, not floating at first-floor level. mainStairs runs y 0 -> 3.6
  // across world z -10 -> -2, so a player at z=-4.4 stands at 2.52 and reads the
  // plate from 1.06 m lower and considerably steeper than this probe used to.
  const stairY = (z) => 3.6 * Math.min(1, Math.max(0, (z + 10) / 8));
  look([2.6, stairY(-4.4), -4.4], [4.0, 4.75, -7.0]);
  shoot('1-closed-from-stairs');
```

**20. 20. Add the missing measurement for the cave flank dropout before this ships. New probe: walk the whole main and secret route at the clamp's own limit (clearance -0.08) on both shoulders, render, and assert the skybox/moon is never in frame — the same class of failure the file already documents as having shipped once ('strips of moon and stars visible between the decorative chamber caps'). Also print, per segment, how many of the 2n pieces were dropped, so 'about a third' becomes a number that can regress.** — `probe-cave-skyline.mjs`

_anchor:_
```js
(new file)
```

_change:_
```js
// probe-cave-skyline.mjs -- can you see out of the cave now that a third of the
// flank pieces are gone? Boot, teleport('cave'), then for every layout segment
// step t in [0,1] and both shoulders at clearance -0.08, look outward along the
// segment normal and along +-45 degrees of it, render, and read canvas.toDataURL
// (never page.screenshot). Fail on any frame containing the sky colour or the
// moon. Print per-segment kept/dropped counts from a debug hook added next to
// world.box in addFloorAndShell. Run alone, not in a parallel batch.
```


### Cost

Draw calls: net negative or flat. Step 8 removes 2 line draws from the house (the tightest district, 339->335 after this round). Steps 9-12 add materials, not draws. Step 1 adds one AABB collider, which is a per-frame arithmetic test in player.js and nothing in the renderer. Step 2 shortens a cylinder. Per-frame CPU: unchanged everywhere except step 13, which adds one clamp() call inside a branch that fires at most once every 6 seconds per spider. Step 3 changes a build-time comparison and will keep marginally MORE flank pieces than the current code (clearance -0.08 rejects a slightly smaller set than clearance 0), all of it inside the single merged M.rock batch, so zero draw-call cost and a few hundred extra vertices. Boot time: unaffected — _buildOcclusionGrid iterates colliders, not boxes, and the one collider added is trivial. Implementation effort: steps 1-3 and 13-16 are ten minutes. Steps 4-6 are the only ones needing care (a closure wrap across ~50 lines and one drain call) — call it an hour with the gates. Steps 17-19 are documentation. Step 20 is a new probe, half a day, and it is the one that should gate the merge.

### Risk

Steps 1-3 (bell collider, chain, clamp threshold) are contained to the cave and cannot affect any other district; the one thing to watch is that the Drowned Choir surfaces on the MAIN route while the bell sits on the SECRET route, so the new collider should not be able to trap it — re-run choir-surfacing and choir-route-occlusion to confirm. Steps 4-6 (deferring the web placement) are the highest-risk edit in this plan: they change WHEN game.webs is populated, so anything that reads game.webs during a builder would break. Nothing does — the only readers are main.js:1842 (per-frame) and the probes — and the drain still happens inside buildHouse, before main.js:188 computes houseInteriorRoots, so the webs stay in the interior cull ledger and stay hidden outside the house. The real behavioural consequence is intended: with the check finally seeing basementAct's and buildPumpGallery's colliders, some sites may now be SKIPPED where they were previously placed, so probe-webs.mjs must be re-run and its placed/skipped line recorded as the new baseline. Steps 9-12 add two LineBasicMaterial clones: +2 programs, +2 entries in _warmDrawList, and zero draw calls (each web already owns its own LineSegments objects). Step 7 relocates a web into a corner the deferred check will now actually validate — if it reports 2a33 as skipped, that is the check working, not a failure. Steps 15-19 are comments and dead code and cannot change behaviour. The perf-pool 831->833 finding is deliberately NOT patched here: the round doc is right that loosening the gate before the cause is known is the wrong move, and the mechanism I added (warm-list dedupe by material|layout|kind) argues the delta is benign decoration, not a leak.

### Open questions

- Does the bell hang or lie? The comment at underfalls.js:1105 says it was authored as a SUSPENDED inverted bell read from below, and the snapped chain's low end computes to 0.06 m above the old rim — so the +1.18 was intent, not inherited. Round twelve reversed that on the strength of Alex's 'what is this, it doesn't move or do anything', which is a complaint about PURPOSE, not height. Ask him. Either answer needs step 1's collider; only the answer changes the y range.
- How many flank pieces actually get dropped, and does the cave still enclose? 'About a third' is asserted, never measured, and the same failure once shipped. tools/probe-cave-skyline.mjs (step 20) is the measurement. Until it runs, the claim that 'every one of those places already owns its enclosure from another region' is unverified.
- Is the NO FURNACE plate legible from the pose Alex will actually be in? The probe shot it from a floating eye 1.06 m above the ramp, and the source itself records that the contrast measurement did not move. Re-shoot from stairY(z) at three points down the flight, and measure the luminance ratio of plate-to-door rather than frame share.
- Is a web inside the barred counterweight kennel wanted? Step 7 moves it out on the grounds that nobody chose it. But Alex's screenshot note #2 asks for that exact area to become 'another jailcell with the mosst freaky creature every just shaking the bars' — if that room is about to be redressed, a web behind the bars may be worth keeping. His call.
- Why do exactly two web geometries upload between the perf-pool gate's two samples? I established that only ONE of the 19 webs' line geometries is ever warm-drawn (the list dedupes by material|layout|kind) and that ?test=1 skips the warm pass entirely, so the gate uploads none at boot — which makes a late upload expected rather than mysterious. What is still not established is which two, and the probe that would settle it is the one the round doc already specified: reproduce the gate's whole sequence and diff geometry uuids that gained GPU buffers between samples.
- Does the gauge need a middle detent? The lie is fixed, but pump+archive now produce no needle motion at all. A three-position needle (1.18 cold / 0.1 half / -1.02 ready) would keep both the honesty and the reward, at the cost of one more number.


---

<a id="postgame"></a>

## postgame

**The brief is stale — he already sent the coda (a DDR rhythm game, documented in docs/THE-TRUE-ENDING.md) — and the cheapest attachment point already exists and is untested: main.js:1231 already answers a click on the ending screen with `location.reload()`, so the whole hand-off is a one-line change of destination plus a prefetch in `_enterCave`; do NOT add an act and do NOT hook `_finishEnd`.**

- confidence: certain-from-source
- challenge verdict: **SOUND-WITH-CORRECTIONS**

### BLOCKERS — do not apply without these

- **THE PLAN'S CENTRAL PREMISE — that the prefetch is invisible to every gate because ?test=1 skips it — IS FALSE. tests/warm-start-regression.mjs:43 boots `${URL_BASE}/?mute=1&hitch=1`, which is NOT test mode, so TEST_MODE === false and the step-6 guard `if (TEST_MODE && !Q.has('warmup'))` does not fire. Its tour at line 127 iterates `['house','basement','graveyard','forest','clearing','cave','mirror']` calling `g.teleport(act)`, and main.js:1771 ends teleport with `this.director.setAct(act, true)` → director.js:303 `_enterCave()` → the plan's new `g._warmCoda()`. Because `ending/` does not exist in this worktree, all five fetches 404; Chrome logs 'Failed to load resource: the server responded with a status of 404' for each; tests/lib/harness.mjs:81 (`if (m.type() === 'error') errors.push('console.error: ' + m.text())`) collects them; and tests/warm-start-regression.mjs:183 `check(errors.length === 0, 'warm start produces zero page/console errors', ...)` goes RED. Even once ending/ exists, the same call site drops a real ~7 MB transfer plus five main-thread `arrayBuffer()` allocations inside the exact window line 180 measures with `check(worst < 500, 'no district costs the player a visible freeze on arrival')`. The plan's cost section says 'PER-FRAME CPU: zero in FETCH' — that is not true of the gate that exists to catch arrival freezes.**
  - _fix:_ Two changes. (1) In step 6, replace the guard line `    if (TEST_MODE && !Q.has('warmup')) { state.status = 'skipped'; state.reason = 'test-mode'; return; }` with:

    // NOT just TEST_MODE. tests/warm-start-regression.mjs boots ?mute=1&hitch=1
    // -- not test mode -- and its tour teleports through 'cave' (line 127), so an
    // unguarded fetch here 404s five times into its check(errors.length === 0)
    // at line 183 and lands 7 MB inside its `worst < 500` hitch window at 180.
    // HITCH_LOG (main.js:22) is exactly the flag that marks a measuring page.
    if ((TEST_MODE || HITCH_LOG) && !Q.has('warmup')) {
      state.status = 'skipped';
      state.reason = TEST_MODE ? 'test-mode' : 'hitch-mode';
      return;
    }

`HITCH_LOG` already exists at src/main.js:22 (`const HITCH_LOG = Q.has('hitch');`). (2) Do not land steps 3-8 in a commit that does not also create `ending/` with real media — otherwise the only path that ever runs is the 404 fallback and nothing is actually exercised. Re-run tests/warm-start-regression.mjs specifically after landing; it is not one of the four named gates and will be skipped if you only run the battery in AGENTS.md.

- **STEP 9 (`tools/package-netlify.mjs:26`) CHANGES ONLY ONE OF TWO IDENTICAL DECLARATIONS AND BREAKS RELEASE VERIFICATION. `tools/verify-netlify-release.mjs:30` holds the byte-identical line `const shippingRoots = ['index.html', 'assets', 'src', 'vendor'];`, and at lines 238-245 it computes the shipping file set from it and throws `'Archive entry set does not exactly match current shipping roots'` if the archive differs. Adding 'ending' to the packer alone makes every produced archive fail verification. Worse, both `collect()` (package-netlify.mjs:56, `lstatSync(path)`) and the verifier's `collectShippingFiles` throw ENOENT on a missing root, so adding 'ending' BEFORE the directory exists breaks the packer outright — and tests/netlify-release-integrity.mjs:243 spawns that packer, so that gate goes red too. Separately, tools/verify-netlify-release.mjs:39-48 has its own MIME map with no `.mp4`, so its in-process boot server would hand the coda's video back as application/octet-stream — the identical bug step 1 fixes in serve.mjs, left unfixed here. AND, most importantly: per AGENTS.md lines 18-21 and 141-147, 'Nothing in this repo deploys' — the live game ships by copying src/ into duplighost/qualiacology under fetch/. The zip packager is a standalone-build convenience, not the shipping path. The plan claims step 9 is what stops the coda being 'silently dropped'; it is not.**
  - _fix:_ Make step 9 a three-part change, and gate all of it on `ending/` existing first: (a) tools/package-netlify.mjs:26 → `const shippingRoots = ['index.html', 'assets', 'src', 'vendor', 'ending'];` (b) tools/verify-netlify-release.mjs:30 → the SAME replacement, byte-identical, in the same commit. (c) tools/verify-netlify-release.mjs:47, anchor `  '.svg': 'image/svg+xml',` → `  '.svg': 'image/svg+xml',\n  '.mp4': 'video/mp4', '.webm': 'video/webm',`. Then add a new step, ahead of everything: state plainly that the live hand-off requires a matching change in duplighost/qualiacology (a page at fetch/ending/), that that repo's AGENTS.md is canonical for it, and that ROUND-THIRTEEN.md records its route-smoke gate as asserting '44 routes, 21 intentional 404s' plus a validate-site pass — so a new route must be registered there or the site gate will fail. Until that is written down, the plan does not actually ship the coda.

- **THE WARM MANIFEST WARMS THE WRONG FILES. `CODA_WARM_FILES` in step 3 deliberately omits dancer-club.mp4 (2.39 MB) and dancer-club.jpg (476 KB) on the strength of finding 15 ('no song uses club'). But ChompGame.tsx:103 is `const [stageClip, setStageClip] = useState<"stage" | "spin" | "club">("club");` — the coda MOUNTS on club, and setStageClip("club") at 248 and 448 drives the title and results screens. So the media the coda touches at the exact instant of the hand-off is precisely the media the plan does not warm. Dropping club is step 12(b), which is ordered LAST and is explicitly conditioned on an unanswered question to Alex ('Does he want the motion on those two screens badly enough to pay for it?'). Applied in the order given, this plan ships a prefetch that misses the seam it exists to protect — a direct failure of his one stated worry, 'we just have to make sure the transition ... doesn't like, lag into this part'.**
  - _fix:_ Pick one, and say which in the step text so nobody has to infer it. EITHER (a) move step 12(b) — open the coda on skull-close.jpg, edit ChompGame.tsx:103/248/448 off club — to BEFORE step 3, and keep the manifest as written; OR (b) leave the coda as-sent and make the manifest match it:

const CODA_WARM_FILES = [
  'media/dancer-club.mp4', 'media/dancer-club.jpg',
  'media/dancer-stage.mp4', 'media/dancer-spin.mp4',
  'media/dancer-stage.jpg', 'media/dancer-spin.jpg', 'media/skull-close.jpg',
];

(b) is 7.19 MB across the cave walk; (a) is ~4.3 MB. Do not ship the current combination, which warms 4.3 MB and then downloads 2.9 MB at the seam.


### Execute THIS (the challenged, corrected plan)

The architecture is right and most of the plan's factual work is unusually good — I re-derived the media measurements independently from the zip and every byte, duration, resolution and bitrate matches, and 16 of 16 code anchors exist verbatim. Keep the shape: a separate page, not a new act; the seam is main.js:1231, the one line no gate touches; the prefetch fires from director.js:307-308 in `_enterCave`, one district before the mirror room; nothing hooks `_finishEnd`; zero draw calls added and no district-culling or smoke.mjs entry needed. But apply it in this corrected order. FIRST, stand up `ending/` with real media and decide the club question — either open the coda on skull-close.jpg (edit ChompGame.tsx:103/248/448) or add dancer-club.mp4 and dancer-club.jpg to the manifest, because as written the plan warms 4.3 MB and then downloads the 2.9 MB the coda actually mounts on, at the seam. THEN land the FETCH-side changes: serve.mjs:14 (add .mp4/.webm) and :41 (cacheable under /ending/media/) unchanged; main.js:21 constants unchanged; main.js:1231 becomes `this._leaveForCoda()`; `_leaveForCoda` inserted before `_finishEnd()` at 1709 but routed through an injectable `this._navigate` plus a `codaTarget()` helper, because `location.assign` is [LegacyUnforgeable] and cannot be stubbed by any gate; `_warmCoda` inserted before `_scheduleWarmDraw()` at 845 with its whole body wrapped in try/catch, using `r.blob()` not `r.arrayBuffer()`, and — the critical fix — guarded as `if ((TEST_MODE || HITCH_LOG) && !Q.has('warmup'))`, because tests/warm-start-regression.mjs boots `?mute=1&hitch=1` (NOT test mode) and tours through 'cave', so the plan as written 404s five times into that gate's `check(errors.length === 0)` at line 183 and drops 7 MB into its `worst < 500` hitch window at line 180; and the debug accessor at 2249 gains both `coda()` and `codaTarget()`. THEN the shipping changes as a matched set: 'ending' added to shippingRoots in BOTH tools/package-netlify.mjs:26 and tools/verify-netlify-release.mjs:30 (the verifier throws 'Archive entry set does not exactly match current shipping roots' otherwise, and both throw ENOENT if the directory does not yet exist), plus `.mp4`/`.webm` added to the verifier's MIME map at line 47 — and a new, explicit step saying that none of this is how the game ships: per AGENTS.md the live path is a copy into duplighost/qualiacology under fetch/, whose own route-smoke and validate-site gates must learn the new route. THEN the new gate, booted `?test=1&mute=1&warmup=1` and modelled on tests/perf-pool-regression.mjs:16 (not warm-start-regression, which does not use ?warmup=1), asserting the warm reaches 'ready' after `F.teleport('cave')` and that a click on `#title` with 'ended' set records the coda URL through the injected navigator. Drop step 10 (the AGENTS.md law edit) out of the plan into open questions. Correct three claims before anyone relies on them: `_finishEnd` does NOT fire inside tests/regressions.mjs (contactT ≤ ~1.21 of CONTACT_TIME 2.35 puts it at ~4.16 s against a 3.6 s step — playthrough.mjs:1116 alone is what makes the hook fatal); user activation does not survive a navigation, so the coda must keep its own press-to-begin; and the click seam is invisible, which is a real design question for Alex, not a virtue — law 3 and DESIGN.md:211 both permit text on the ending title, so 'one quiet word' is on the table and he should choose. Finally, add a return path from the coda back to `../`: today the ending click reloads FETCH and is the only exit, since restartFromCheckpoint is blocked once 'ended' is set, and the plan removes that without replacing it.

### Findings

- **THE BRIEF IS STALE. He has already told us what the short game is. He sent Downloads/fetch-game.zip on 2026-08-19 and a prior round already triaged it into a doc. It is `FETCH — The True Ending`, a DDR-style rhythm game: a photorealistic man dances with a chomping skull over video while you hit falling arrows. Four movements, then a results screen. Do not design a replacement for it.**
  - `THE-TRUE-ENDING.md:1`
  - evidence: "# THE TRUE ENDING — the game that attaches after FETCH's ending" ... > "also, i made this game with grok. I don't know how we do it, but after our games finale, i want it to go to this cheeky ending game. i figure its possible. we just have to make sure the transition between the other stuff doesn't like, lag into this part or something." and > "lol, p2p multipleayer. we dont need that stuff"

- **THE EXISTING HOOK — this is the answer. The ending screen ALREADY has a click handler that already navigates, already gated on the `ended` flag. Changing `location.reload()` to a coda navigation is the entire FETCH-side seam. Nothing else in main.js needs to move.**
  - `main.js:1231`
  - evidence: this.el.title.addEventListener('click', (event) => {   if (this.flags.has('ended')) { location.reload(); return; }   if (event.target.closest('[data-action="start"]')) this.startGame(); });

- **NOTHING TESTS THAT RELOAD. Grepping every test and tool for a click on #title or a reload: the only `#title` clicks are on `[data-action="start"]` (the pre-game button), and the only reloads are page-level reloads in warm-start/probe-cold-start. No gate exercises the ending click. The line is free to change.**
  - `pause-title-regression.mjs:75`
  - evidence: await page.click('#title [data-action="start"]');  // the only #title clicks in the suite are this one and its twins at 351 and 419, all on the start button; no test clicks the ending screen

- **THE ENDING CHAIN, exactly. finale._hardBlack() cuts to black in 45 ms, holds 0.72 s, sets phase='end', clears finale.active, and calls showEnd(). showEnd() sets endingTail, flags 'ended', plays catchThud, +1.1 s gasp, +1.15 s _finishEnd(). Between _hardBlack and _finishEnd is ~3.0 s of still-running game.**
  - `finale.js:1252`
  - evidence: g.after(0.72, () => {   if (this.phase !== 'black') return;   this.phase = 'end';   this.active = false;   g.showEnd(); });

- **WHERE CONTROL ENDS UP. _finishEnd() is a true quiesce: enemies cleared, audio stopped+suspended, mirrors disposed, shader-warm materials disposed, every ticker dropped, terminal=true. It is the safest possible moment in the process — nothing is running.**
  - `main.js:1709`
  - evidence: _finishEnd() {   if (this.terminal) return;   this.enemies.clear();   this.audio.stopAll({ suspend: true });   this.finale?.mirrors?.dispose?.();   for (const material of this._shaderWarmMaterials || []) material.dispose();   this._shaderWarmMaterials = null;   this.tickers.length = 0;   this.terminal = true;   this._syncPauseUi(); }

- **terminal=true KILLS THE FRAME LOOP PERMANENTLY. The RAF tick returns at its first line and every re-arm is guarded, so after _finishEnd there is no loop, no render, no input. Combined with restart being blocked, a page reload is the player's ONLY exit today.**
  - `main.js:2137`
  - evidence: const tick = (now) => {   if (this.terminal) return;   ...   if (!this.terminal) requestAnimationFrame(tick);

- **DO NOT HOOK _finishEnd — three gates step straight through it. regressions.mjs steps 3.6 s past contact and playthrough.mjs steps 7 s, both of which exceed the 1.1+1.15 s beat chain, so _finishEnd fires inside both. A navigation there destroys the page mid-assertion. (The showEnd() call in pause-title-regression.mjs:328 is safe only because it never steps, so the dt-driven beats never run.)**
  - `regressions.mjs:1414`
  - evidence: F.stepWith(3.6, {}, false); g.render(); const expectedAudio = ['skullMoanStart', 'skullMoanUpdate', 'skullMoanStop', 'catchThud', 'gasp']; const endTag = g.el.title.querySelector('.tag').textContent;

- **THE PLAYTHROUGH'S LAST BEAT runs past the ending too, and would be destroyed by any navigation in the ending tail.**
  - `playthrough.mjs:1116`
  - evidence: F.stepWith(7);                                    // the slow fade + showEnd ... beat('ended', g.flags.has('ended'));

- **THERE IS NO SAVE STATE ANYWHERE. Zero occurrences of localStorage, sessionStorage or indexedDB across all 22 src files, index.html and serve.mjs. `checkpoint()` writes two in-memory fields and nothing else. A player who finishes and closes the tab cannot reach the coda again without replaying the entire game — and cannot even replay from the ending, because restart is blocked once 'ended' is set. Persisting a single 'finished' flag is a NEW capability this game has never had.**
  - `main.js:1467`
  - evidence: checkpoint(act, pose = null) {   const p = pose || this.player;   const pos = p.pos || p;   this.lastCheckpoint = act;   this.checkpointPose = { act, x: pos.x, y: pos.y, z: pos.z, yaw: ..., pitch: ... }; }

- **RESTART IS BLOCKED AFTER THE ENDING, which is why the coda must be reachable by its own URL rather than by any in-game path.**
  - `main.js:1399`
  - evidence: restartFromCheckpoint() {   if (!this.paused || this.terminal || this.flags.has('ended')) return false;

- **WHAT A NEW ACT WOULD COST (the path NOT to take). setAct() reads five per-act tables — FOG_BY_ACT, FOG_COLOR_BY_ACT, AMBIENT_BY_ACT, BACKGROUND_BY_ACT, APPROACH_BY_ACT, plus STAGE_BY_ACT — and dispatches to a private _enterX; teleport() needs a getSpawn entry. Any new act must also be added to smoke.mjs's hardcoded ACTS list and hold under the 450-draw ceiling.**
  - `director.js:124`
  - evidence: setAct(act, hard) {   ...   g.fogTarget = FOG_BY_ACT[act] ?? 0.03;   g.ambientTarget = AMBIENT_BY_ACT[act] ?? 1;   g.fogColorTarget = new THREE.Color(FOG_COLOR_BY_ACT[act] ?? 0x070b12);   g.bgColorTarget = new THREE.Color(BACKGROUND_BY_ACT[act] ?? 0x03050a);   ...   this.approach = APPROACH_BY_ACT[act] ?? this.approach;

- **smoke.mjs enumerates acts by hand, so a new act is invisible to it unless added, and once added must pass its own per-act boot, error and budget assertions.**
  - `smoke.mjs:10`
  - evidence: const ACTS = ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];

- **The 450 ceiling is asserted per-district by explicit enter() calls plus one sweep over every sample, so a new district would need its own pinned entry. NONE of this applies if the coda is a separate page — its draw-call cost against FETCH's budget is exactly zero, because the two never coexist.**
  - `district-culling-regression.mjs:641`
  - evidence: 'every exercised district remains below the robust 450-draw ceiling', renderSamples.every(([, calls]) => calls > 0 && calls < 450), { samples: renderSamples, maxRender, ceiling: 450 },

- **THE 'ONE ENDING' LAW, read honestly. AGENTS.md law 8 states it in four words with no elaboration, but DESIGN.md carries its authored meaning twice: it is listed beside 'sincere oasis' as a design beam, and the CUT list bans 'morality endings' and 'fake oasis'. The law is an anti-BRANCHING law — one outcome for every player, not a limit on epilogue length. An unconditional coda that every player reaches does not create a second ending.**
  - `DESIGN.md:203`
  - evidence: line 203: "flawless handling, growth never witnessed, noise debt, sincere oasis, one ending."  line 211: "**Ending: catch-click + a stranger's gasp.** No whispered word. Screen text ok."  lines 234-235: "CUT (agreed): fridge mystery, talking/lying skull, control theft ever, morality endings, \"dead all along\", fake oasis, ..."

- **WHERE THE LAW WOULD ACTUALLY BREAK: if the coda's grade branched the final screen. The rhythm game already refuses to fail you out — an empty grin meter does not end the run, you always reach the results — so it is structurally non-branching already. Keep it that way and law 8 holds.**
  - `THE-TRUE-ENDING.md:40`
  - evidence: "Empty grin does **not** end the run — you always reach the results."

- **MEASURED THE MEDIA — the doc says nobody had, and called it the single biggest lever. Parsed the MP4 atom tree and JPEG SOF markers directly (no browser). All three clips are 10.04 s, and all three are SILENT — no audio track at all, which is why the soundtrack is synthesised. dancer-club is 1280x720 landscape at 2.00 Mbps; dancer-stage and dancer-spin are 720x1280 PORTRAIT at 1.40 and 1.14 Mbps.**
  - `THE-TRUE-ENDING.md:116`
  - evidence: The doc's open item: "**Re-encode before shipping.** Nothing here has been measured yet — the mp4 headers did not yield duration or resolution to a hand parser." Measured now: dancer-club.mp4 2.39 MB / 10.04 s / 1280x720 / 2.00 Mbps / no audio; dancer-stage.mp4 1.67 MB / 10.04 s / 720x1280 / 1.40 Mbps / no audio; dancer-spin.mp4 1.36 MB / 10.04 s / 720x1280 / 1.14 Mbps / no audio.

- **THE POSTERS ARE THE EASIEST WIN AND NOBODY HAS LOOKED. All four JPEGs are far larger than the video they stand in for — 1792x1008 and 1008x1792 against 1280x720/720x1280 sources, at ~400-490 KB each. They are 1.8 MB of the 7.19 MB total, standing in for 720p. Downscaling them to the video's own resolution at a sane quality is a pure win with no visible loss, before any video re-encode is attempted.**
  - `THE-TRUE-ENDING.md:88`
  - evidence: Doc table lists the jpgs at 0.46/0.44/0.39/0.47 MB. Measured dimensions: dancer-club.jpg 476 KB 1792x1008; dancer-stage.jpg 449 KB 1008x1792; dancer-spin.jpg 397 KB 1008x1792; skull-close.jpg 484 KB 1600x1200.

- **dancer-club.mp4 is the LARGEST file (2.39 MB) and never plays during a song. songs.ts assigns every one of the four movements stage:'stage' or stage:'spin'; the club clip is selected only for the title and results screens. If the coda opens on a still instead, 2.39 MB of the 7.19 MB budget disappears without touching gameplay.**
  - `THE-TRUE-ENDING.md:31`
  - evidence: Song table stage clips are stage, stage, spin, spin — no song uses club. In ChompGame.tsx the only setStageClip("club") calls are at lines 248 and 448 (title/results), while line 188 setStageClip(picked.stage) drives play.

- **THE DEV SERVER WILL DEFEAT THE WARM FETCH BY CONSTRUCTION. serve.mjs sends `cache-control: no-store` on every response, so a prefetch cannot populate the HTTP cache locally and any gate written to prove the warm works will fail for a reason that has nothing to do with the code. It also has NO Range-request support (plain readFile + 200), which the [[instead-of-the-goodbye-page]] memo already recorded as a trap for media.**
  - `serve.mjs:41`
  - evidence: res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });

- **serve.mjs HAS NO .mp4 MIME TYPE. Any mp4 served locally comes back as application/octet-stream and <video> will refuse it. This is a one-line fix that would otherwise cost an afternoon of blaming the coda.**
  - `serve.mjs:14`
  - evidence: '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',

- **THE RELEASE PACKAGER SHIPS FOUR ROOTS AND WOULD SILENTLY DROP THE CODA. A page at ending/ is not in shippingRoots, so it would be absent from the Netlify archive with no error.**
  - `package-netlify.mjs:26`
  - evidence: const shippingRoots = ['index.html', 'assets', 'src', 'vendor'];

- **SAME-PAGE TEARDOWN IS UNEXERCISED, confirming the doc's warning. stopAll({suspend:true}) ramps gains to near-zero and suspends but never closes the AudioContext — the beds stay allocated for a setZone() that will never come. There is no renderer.dispose() path anywhere. Building the coda into the live page would be the first time FETCH ever tried to stop.**
  - `audio.js:2446`
  - evidence: stopAll({ suspend = false } = {}) {   if (!this._ready) return;   ...   // clear any in-flight duck; beds stay alive but silent — the next setZone()   // brings them back without re-allocating anything

- **THE WARM-PASS PRECEDENT to copy exactly, including its test opt-out. Both existing warmups skip under ?test=1 unless ?warmup=1 is passed. A coda prefetch must do the same or every deterministic suite downloads 7 MB it never looks at.**
  - `main.js:845`
  - evidence: _scheduleWarmDraw() {   const state = this.warmDraw = { status: 'scheduled', ... };   // Same rule as the shader warmup: the deterministic suites start hundreds of   // times and must not pay for driver warmth they never use. ?warmup=1 opts in.   if (TEST_MODE && !Q.has('warmup')) { state.status = 'skipped'; state.reason = 'test-mode'; } }


### Raw steps (superseded by the corrected plan above where they conflict)

**1. Teach the dev server about video. Without this the coda's <video> gets application/octet-stream locally and refuses to play, and the failure will look like a coda bug.** — `serve.mjs`

_anchor:_
```js
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
```

_change:_
```js
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4v': 'video/mp4',
```

**2. Let the coda's media actually cache locally. `no-store` on every response makes the warm fetch a no-op on the dev server, so any gate asserting warmth fails for the wrong reason. Keep no-store for the game's own hot-reloaded source; allow caching only under the coda's media directory.** — `serve.mjs`

_anchor:_
```js
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
```

_change:_
```js
    // The game's own source stays no-store so a gate always reads from disk.
    // The coda's media MUST be cacheable or the warm fetch cannot be verified
    // locally at all -- it would populate nothing and every check would lie.
    const cacheable = path.startsWith('/ending/media/');
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': cacheable ? 'public, max-age=3600' : 'no-store',
    });
```

**3. Declare the coda's location and its warm manifest next to TEST_MODE, so the standalone build, the dev server and the site copy all resolve the same relative path.** — `main.js`

_anchor:_
```js
const TEST_MODE = Q.has('test') || Q.has('autotest');
```

_change:_
```js
const TEST_MODE = Q.has('test') || Q.has('autotest');
// THE CODA. A separate page, deliberately: navigating to it drops the entire
// Three.js scene, every linked program and every texture in one go, so the two
// games never coexist and there is no perf interaction to reason about.
// Relative so /fetch/ on the site and / on a standalone build both resolve.
const CODA_URL = './ending/';
const CODA_WARM_FILES = [
  'media/dancer-stage.mp4', 'media/dancer-spin.mp4',
  'media/dancer-stage.jpg', 'media/dancer-spin.jpg', 'media/skull-close.jpg',
];
```

**4. THE SEAM. Replace only the destination of the reload that the ending screen has always answered a click with. The click is load-bearing and must be kept: it is the user gesture the coda's AudioContext and its <video>.play() both require, which an automatic navigation would not carry. It also lets the player sit in the black for as long as they want -- wordless, no new affordance, no on-screen text.** — `main.js`

_anchor:_
```js
      if (this.flags.has('ended')) { location.reload(); return; }
```

_change:_
```js
      if (this.flags.has('ended')) { this._leaveForCoda(); return; }
```

**5. Add the hand-off itself, with a fallback that keeps the old behaviour if the coda could not be reached. A stranded player staring at a 404 is strictly worse than the reload we replaced.** — `main.js`

_anchor:_
```js
  _finishEnd() {
    if (this.terminal) return;
```

_change:_
```js
  // THE CODA HANDOFF. Deliberately NOT wired into _finishEnd: regressions.mjs
  // steps 3.6 s past contact and playthrough.mjs steps 7 s, both of which run
  // the 1.1 + 1.15 s beat chain to completion, so a navigation there would
  // destroy the page in the middle of two gates' assertions. The click is the
  // only safe seam, and it is the only one a player ever touches.
  _leaveForCoda() {
    if (this._leavingForCoda) return;
    // If the warm fetch could not reach the coda at all, do not walk the
    // player into a 404 -- keep the behaviour this line has always had.
    if (this.codaWarm && this.codaWarm.status === 'failed') { location.reload(); return; }
    this._leavingForCoda = true;
    try { location.assign(new URL(CODA_URL, location.href).href); }
    catch { location.reload(); }
  }

  _finishEnd() {
    if (this.terminal) return;
```

**6. Pay the coda's media cost while the player is still walking the Underfalls, never at the seam -- the same discipline as round ten's first-draw warm pass. Guarded exactly like the two existing warmups so the deterministic suites never fetch 7 MB they will not look at.** — `main.js`

_anchor:_
```js
  _scheduleWarmDraw() {
```

_change:_
```js
  // Fetch the coda's media one district before the mirror room so the
  // hand-off is a cache hit, never a download. His stated worry, answered:
  // "we just have to make sure the transition ... doesn't like, lag into this
  // part." Same test opt-out as the shader and draw warmups.
  _warmCoda() {
    if (this.codaWarm) return;
    const state = this.codaWarm = { status: 'scheduled', done: 0, failed: 0, total: 0, bytes: 0, errors: [] };
    if (TEST_MODE && !Q.has('warmup')) { state.status = 'skipped'; state.reason = 'test-mode'; return; }
    const base = new URL(CODA_URL, location.href);
    state.total = CODA_WARM_FILES.length;
    state.status = 'running';
    const settle = () => {
      if (state.done + state.failed < state.total) return;
      state.status = state.failed === 0 ? 'ready' : (state.done > 0 ? 'degraded' : 'failed');
    };
    for (const name of CODA_WARM_FILES) {
      fetch(new URL(name, base).href, { cache: 'force-cache', mode: 'same-origin' })
        .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + name); return r.arrayBuffer(); })
        .then((b) => { state.bytes += b.byteLength; state.done++; settle(); })
        .catch((e) => { state.failed++; state.errors.push(String(e?.message || e)); settle(); });
    }
  }

  _scheduleWarmDraw() {
```

**7. Call the warm from the last district before the mirror room. The Underfalls walk is minutes long, so the fetch has finished by the time the walls start closing.** — `director.js`

_anchor:_
```js
    g.checkpoint('cave');
    g.baseTension = 0.2;
```

_change:_
```js
    g.checkpoint('cave');
    // The coda's media is fetched HERE -- one district before the mirror room --
    // so the ending's hand-off is a cache hit. Pay the cost while the player is
    // busy, never at the seam.
    g._warmCoda();
    g.baseTension = 0.2;
```

**8. Expose the warm state to the debug API so a gate can assert it without reaching into private fields, matching how warm() already reports shader/texture/draw state.** — `main.js`

_anchor:_
```js
      hitches() { return g.longFrames.slice(); },
```

_change:_
```js
      coda() { return g.codaWarm ? { ...g.codaWarm, errors: g.codaWarm.errors.slice(0, 4) } : null; },
      hitches() { return g.longFrames.slice(); },
```

**9. Ship the coda. Without this the page is simply absent from the Netlify archive and no error is raised.** — `package-netlify.mjs`

_anchor:_
```js
const shippingRoots = ['index.html', 'assets', 'src', 'vendor'];
```

_change:_
```js
const shippingRoots = ['index.html', 'assets', 'src', 'vendor', 'ending'];
```

**10. Record the ruling on law 8 in the law itself, so the next agent does not re-litigate it or, worse, 'fix' the coda away. Only do this once Alex has confirmed (see open questions).** — `AGENTS.md`

_anchor:_
```js
8. **One ending.** The oasis is sincere. Do not foreshadow the twist.
```

_change:_
```js
8. **One ending.** The oasis is sincere. Do not foreshadow the twist. This is
   an anti-BRANCHING law, not a limit on epilogue length: DESIGN.md cut
   "morality endings" and "fake oasis" in the same breath that named it. THE
   CODA (`ending/`, see docs/THE-TRUE-ENDING.md) is lawful because every player
   reaches the same one and its grade is a score, never a different outcome. If
   a coda result ever changes which final screen a player sees, that is the
   violation.
```

**11. NEW GATE. Assert the seam without ever navigating: boot ?test=1&warmup=1, teleport to cave, wait for __FETCH.coda().status to leave 'running', and assert it reached 'ready' with the expected byte count. Then, separately, assert the click handler's destination by stubbing location.assign. This is the gate the project's own trap-list demands, because ?test=1 skips warm passes and a code path only real players take has no gate by construction.** — `coda-handoff.mjs`

_anchor:_
```js
(new file — model it on tests/warm-start-regression.mjs, which already boots with ?warmup=1 and polls window.__FETCH.warm())
```

_change:_
```js
Three checks: (1) 'the coda media is warm before the mirror room' -- after F.teleport('cave'), poll __FETCH.coda() until status !== 'running', assert status === 'ready' and bytes > 0; (2) 'the ending click leaves for the coda, not a reload' -- set g.flags.add('ended'), stub location.assign, dispatch a click on #title, assert the stub received a URL ending in '/ending/'; (3) 'a failed warm falls back to reload rather than a 404' -- force g.codaWarm.status='failed', repeat, assert reload was chosen. Zero browser errors.
```

**12. Re-encode before shipping, in this order, because it changes every number under it: posters first (pure win, no quality question), then drop the club clip from the warm manifest, then the videos. Measured baseline is now known: three silent 10.04 s clips, 1280x720 and 720x1280, at 2.00/1.40/1.14 Mbps, plus four oversized JPEGs.** — ``

_anchor:_
```js
7.19 MB total: dancer-club.mp4 2.39 MB, dancer-stage.mp4 1.67 MB, dancer-spin.mp4 1.36 MB, and four JPEGs at 476/449/397/484 KB sized 1792x1008, 1008x1792, 1008x1792, 1600x1200.
```

_change:_
```js
(a) Downscale each poster to its own video's resolution (1280x720 / 720x1280; skull-close to 1280x960) at quality ~78 -- these currently carry ~2x the linear resolution of the footage they stand in for, and should land near 60-90 KB each, cutting ~1.5 MB. (b) Open the coda on skull-close.jpg instead of the club video and drop dancer-club.mp4 from the warm manifest; no song uses it. (c) Only then re-encode the two play clips; they are silent, so strip audio explicitly and re-run at a lower bitrate. Re-measure after each step -- do not estimate.
```


### Cost

DRAW CALLS: zero. The coda is a separate document; FETCH's renderer never learns it exists. Every district budget (house 339, house-after-cave 365, graveyard 327, forest 299, clearing 149, cave 137, ossuary 142, marrow 140) is untouched, and `tests/district-culling-regression.mjs` needs no new entry. This is the main reason to prefer a page over an act: an in-engine coda would need its own sub-450 budget, its own culling registry entries, and a line in smoke.mjs's hardcoded ACTS.

PER-FRAME CPU: zero in FETCH. The prefetch is async `fetch()` — network only, no main-thread work, no allocation on the frame path, and it fires during the Underfalls walk where there is minutes of slack. After the seam, FETCH is not running at all: `terminal` has stopped the RAF loop.

MEMORY AT THE SEAM: the navigation drops the whole Three.js scene, ~261 linked programs and every texture in one go — strictly better than any same-page teardown could manage, and it costs no disposal code.

NETWORK: 7.19 MB today, moved off the seam and onto the cave entrance. Realistically ~3 MB after the poster downscale and dropping the unused club clip, before any video re-encode.

IMPLEMENTATION EFFORT, split honestly:
- FETCH side (this plan): ~45 lines across four files — main.js (constants, `_leaveForCoda`, `_warmCoda`, one debug accessor, one changed line), director.js (one call), serve.mjs (two small edits), package-netlify.mjs (one word). Half a day including the new gate.
- CODA side (already scoped in docs/THE-TRUE-ENDING.md, NOT re-derived here): ~400 lines rewriting `ChompGame.tsx` + `overlays.tsx` from React to plain DOM. `types.ts`, `songs.ts`, `engine.ts`, `audio.ts` and `render.ts` are kept near-verbatim once TypeScript types are stripped — they touch no React. The p2p/auth/db/PWA/Vite/Tailwind scaffold is deleted outright, which is what he asked for.
- MEDIA: one encode pass, measured not estimated.

The FETCH-side work is genuinely small. The honest cost is the coda port and the encode, and neither of those touches this repo's laws or gates.

### Risk

LOW, and deliberately so — the design is chosen to make the risky option unnecessary. The seam is a page navigation on a user click, so FETCH's renderer, audio graph and act system are untouched: no new act, no new district, no change to setAct/teleport/getSpawn, and zero effect on the 450-draw ceiling because the two games never coexist. The one line that changes behaviour (main.js:1231) is provably untested — no gate clicks the ending screen.

The three real risks, in order:

1. HOOKING THE WRONG PLACE. `_finishEnd()` is the tempting hook — it is the clean quiesce — and it is a trap. `tests/regressions.mjs:1414` steps 3.6 s and `tests/playthrough.mjs:1116` steps 7 s past contact; both exceed the 1.1 + 1.15 s beat chain, so both execute `_finishEnd` and would be navigated out from under mid-assertion. The click handler is the only seam a player touches and the only one no gate does.

2. THE WARM CANNOT BE VERIFIED ON THE DEV SERVER AS WRITTEN. `serve.mjs:41` sends `cache-control: no-store` on every response, so a prefetch populates nothing locally and a gate written against it fails for a reason unrelated to the code. Step 2 fixes this narrowly; without it, expect to lose an afternoon. Separately, serve.mjs has no Range support and no `.mp4` MIME entry — the memory note on the goodbye page already recorded the Range trap once.

3. STRANDING THE PLAYER. If `ending/` 404s (most likely: the site repo does not route it, or `package-netlify.mjs` drops it), the ending stops working entirely. Mitigated two ways — the packager change, and the `codaWarm.status === 'failed'` fallback that keeps the old `location.reload()`.

Not a risk but worth stating plainly: the SAME-PAGE alternative is the dangerous one. `audio.stopAll({suspend:true})` suspends and never closes, and there is no `renderer.dispose()` path anywhere in src/ — FETCH has never needed to stop, so its teardown is entirely unexercised. Doing it for the first time to save a page load the warm fetch has already made cheap is a bad trade. Do not do it first, and probably not at all.

### Open questions

- FOR ALEX — LAW 8, 'one ending'. My honest read from DESIGN.md is that it is an anti-BRANCHING law (it is listed beside 'sincere oasis', and 'morality endings' and 'fake oasis' are on the same CUT list), so an unconditional coda every player reaches does not create a second ending. That reading holds ONLY while the coda's grade stays a score. If a good run and a bad run ever produce different final screens, that IS the violation. One sentence of confirmation from him closes this, and AGENTS.md should not be edited until he gives it.
- FOR ALEX — LAW 3, 'NO HUD'. A DDR game is made of HUD: score, combo, grade, judgement text. The sane reading is that FETCH's laws govern FETCH and the coda is a different game with its own idiom — but he should say so, because the alternative reading makes the coda unbuildable as sent. Either way the coda's UI should be dressed in FETCH's palette and type rather than the scaffold's Tailwind defaults, or the seam will feel like two different products.
- FOR ALEX — the club clip. dancer-club.mp4 is the largest single file (2.39 MB) and no song uses it; it plays only behind the title and results screens. Opening the coda on skull-close.jpg instead removes a third of the media budget. Does he want the motion on those two screens badly enough to pay for it?
- FOR ALEX — persistence. This game has never written a single byte to localStorage. Reaching the coda a second time without replaying the whole game requires storing a 'finished' flag, which is a new capability and a new privacy surface, however small. Does he want the coda permanently unlocked once finished, reachable only by URL, or genuinely once-per-playthrough? The rhythm game already mirrors personal bests to localStorage, so if bests are kept, the flag is nearly free.
- NEEDS MEASUREMENT — does the prefetch actually serve the <video>? I have verified the warm fetch can populate the HTTP cache in principle and that serve.mjs currently prevents it, but I have NOT verified that a cached fetch() response is reused by a subsequent <video src> on a different page. That is a browser-behaviour question, not a source question. Settle it with the new tests/coda-handoff.mjs gate on a server sending real cache headers — never on serve.mjs as it stands today.
- NEEDS MEASUREMENT — the re-encode ceiling. I measured the inputs (three silent 10.04 s clips at 2.00/1.40/1.14 Mbps; four posters carrying ~2x their video's linear resolution) but ran no encoder, so the final size is an estimate. Encode, then re-measure. Do not let an estimate into a doc as a fact — that is how the last four rounds lost time.
- NOTED, NOT A QUESTION — two of the three clips are 720x1280 PORTRAIT, phone-shaped video used as a full-bleed backdrop. On a desktop 16:9 window `object-cover` will crop them hard top and bottom. Worth one look before the encode, since it may change what resolution is even worth keeping.
- SUGGESTION 1 of 3 — OFFERED ONLY AS A FALLBACK, TO ACCEPT OR DISCARD. He has already chosen the rhythm game; these exist only in case that port stalls or he wants a smaller thing instead. THE LAST THROW: the black ending screen stays, and one throw is still available. Throw into the dark and the skull does not come back — hold, and a second later it returns carrying something small and pale from somewhere in the house you already walked. Repeat until the house is empty. Cost: near-zero media, reuses skull.js and the existing throw grammar untouched, no new district (a single black room, well under any budget). Weakness: it is quiet where he asked for cheeky.
- SUGGESTION 2 of 3 — OFFERED ONLY AS A FALLBACK, TO ACCEPT OR DISCARD. THE STRANGER'S SIDE: the same mirror room, the same three seconds, played from behind the glass — you are whatever gasped, and the only verb is catching the skull that comes through at you. It ends the moment you catch it. Cost: reuses finale.js's mirror geometry and pose ring buffer wholesale, so this is minutes of content for very little new code, and it is the only proposal that would be cheaper in-engine than as a page. Weakness: it directly foreshadows nothing but it does EXPLAIN the ending, and law 8's neighbour clause is 'do not explain the image'.
- SUGGESTION 3 of 3 — OFFERED ONLY AS A FALLBACK, TO ACCEPT OR DISCARD. FETCH, LITERALLY: a flat bright lawn, a dog-shaped absence, and you throw the skull as far as you can, forever, while a counter you cannot see keeps score in the audio alone — the returns get faster and the sound gets happier until it is unbearable. Cost: one flat plane and the existing throw law; the entire budget goes to audio. Weakness: it is a joke that needs perfect audio to land, and audio is the most expensive thing in this project to get right.
