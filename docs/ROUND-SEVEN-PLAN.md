# ROUND SEVEN — THE PLAN

**Read `docs/ROUND-SEVEN-LOOK.md` first. Its laws all still bind** — the warm
law, the light census, the draw and geometry budgets, the colourblind law, the
gates, the one-hour-per-frame rule, "an object is never finished; a frame is."
This document does not repeat them; it is the HOW. It was written after mapping
the actual code and opening the actual frames, and several of the brief's
open questions are now closed. Where this document and the brief disagree on a
diagnosis, this document is later and is measured — trust it, but re-verify
cheaply where it says to.

**He will post the reference image again. Ask for it if it is not in the
thread.** The bedroom read in the LOOK brief was written from the actual
pixels and stands.

Work in a fresh worktree stacked on this branch:

```
git worktree add ..\fetch-aug18-round7 -b claude/aug18-round7-look claude/aug17-round6-notes
```

(`claude/aug17-round6-notes` is ahead of origin — that is expected; pushing is
Alex's call, not yours.)

---

## THE DIAGNOSIS — read this before touching anything

The brief said the car, the bodies and the mausoleums are "ONE value problem
with three faces." The code says otherwise: **they are three different
diseases that happen to photograph the same**, and two of them cannot be fixed
by darkening anything.

### 1. The car and the bodies are already dark. They are being floodlit.

Every body material is near-black — clothes `0x12191e/0x211317/0x111b19/0x1d1c14`,
trousers darker still, skin `0x241f1c` (`outside.js:3667-3684`). The car's
paint map is normalised to 0.032 linear (`textures.js:672`, `toMeanValue`).
**Nothing on either is pale.**

What owns the pale pixels is irradiance: the wreck's headlight is a
`SpotLight(0xcfd6d0, 300, 26, 0.4, 0.6, 1.4)` aimed at `(-2, 0.4, 24)` —
straight across the body field; sites 0 and 1 (`outside.js:3693`) sit inside
its cone (`outside.js:306-317`). Add the carried `skullLight` (58 cd, decay
1.6 — ~19 irradiance at the two metres you stand over a body,
`main.js:200`, and the code comment at `outside.js:3672-3676` states exactly
this). Near-black albedo × 20 irradiance × ACES = pale. The colour of the
paleness is the light (cool cyan skull-lamp over reddish cloth = the "pink
shirt"), not the material.

**Therefore: do not darken the car or the bodies. It has been done, twice, and
the measured result on the shore lip was a fivefold albedo cut for a 1.4×
pixel cut.** What a floodlit surface needs is *value structure inside itself*:
high-contrast texture at constant mean, folds and creases that shade, and
unlit near-black cavities that no light can lift. That is what Phases 2 and 4
build.

### 2. The mausoleums are a genuine albedo crime — fully diagnosed, no mystery.

`outside.js:337-344`: the shell material is `M.headstone.clone()` with
`color ×0.64`. The headstone map's base is `rgb(172,170,162)` — and because
every canvas texture in this game is `NoColorSpace` (`src/util.js:61-74`),
those bytes ARE linear: 0.674. Times 0.64 → **≈0.43 linear albedo, fourteen
times the project's own stated ceiling** ("anything you walk up to lives at
0.03 linear or it clips", `outside.js:1655-1658`). On top of that:

- The map is 256², **repeat 1×1**, stretched across a 3.6 × 2.65 m wall
  (`textures.js:951` passes no repeat args; BoxGeometry UVs are 0..1 per
  face). ~71 px/m. There is no course structure in `headstonePaint` at all —
  it was painted to be a *headstone*, deliberately pale (`textures.js:675`).
- `emissive 0x343a3c @ 0.38` puts an unconditional ≈0.014-linear floor under
  every surface. The comment says why — a distant mausoleum must stay a
  room-shaped value landmark after the skull light falls off — and that
  purpose is legitimate. The near-field blowout is not.
- West only: four ossuary-throat slabs of **raw, untinted `M.headstone`**
  (0.674 linear, the palest material in the game) lie flat inside the doorway
  (`outside.js:390-407`). That is a large part of frame 12's glow.
- The pair was **never batched**: 9 meshes each, 18 draws for two buildings
  (`outside.js:357-378` — `batchStaticGroup` is never called on them).

MARROW's mausoleum — the ancestor — reads correctly with ONE material:
map mean 0.14 × tint 0.69 ≈ 0.097 sRGB albedo, brick courses at repeat 4×4
(~569 px/m), zero emissive, and a pure-black doorway plane
(`marrow/src/world/graveyard.js:55, 213-232`; `marrow/src/textures.js:227-251`).
It is not more detailed. It is denser, darker, and coursed. Port the numbers,
not more objects.

### 3. The grass is the wrong value floor for the whole district.

`grassPaint` base is `rgb(52,50,38)` — **≈0.20 linear** — and it is one of the
only large-surface painters with **no `toMeanValue` call**
(`textures.js:406-428`; compare `carPaintPaint → 0.032`,
`machineIronPaint → 0.018`). It is the largest surface in the yard
(`PlaneGeometry(48,38)`, one mesh, `outside.js:175-188`), it is ~6× the
district's albedo law, its per-blade strokes write `(v+8, v+12, v*0.72)` — a
green bias, the one channel Alex cannot read — and every pale object in every
frame is being judged against it. Fix the floor first and every later
judgment call happens against the finished stage.

### 4. The 1203-draw south view is the un-culled house.

Nothing hides `houseRenderRoots` (93 roots, `main.js:178-184`) while the
player is in the graveyard. `syncBackDistrictCulling`
(`outside.js:5902-5923`) only engages past the forest gate (z > 42.55). Look
south from mid-yard and the 260 m far plane holds the entire furnished house —
walls do not occlude anything in three.js. The draw counts split cleanly by
bearing, not content: south 1203, north 247-298. The car itself, for the
record, is ~13 draws — it is batched (`outside.js:3617`); the brief's "the car
costs 808" was the frustum behind it.

### 5. The hands are measurably ~2× too thick, and the fix frees geometry.

Proximal radius 0.0145 × HOLD scale 1.34 → a **39 mm-wide finger** on screen
(human: 16-20 mm). Taper across three segments is only 24%
(0.0145→0.0125→0.011). Root spacing is a uniform 0.028, yaw a uniform
(i−1.5)×0.105 fan, cross-sections perfectly round (`skull.js:366-419,
469-486`). Thick + even + round = sausages, exactly as he said. And each
`mkFinger` call creates 6 unique geometries × 10 digits = ~60; the mirror act
sits at **1449 of the 1500 geometry cap**. Sharing 6 base geometries across
all digits (scale via `mesh.scale`, not constructor args) both fixes the look
and buys back ~54 geometries.

---

## THE TRAPS LEDGER — pin this next to the editor

1. **Painted canvas bytes are LINEAR.** `canvasTexture` sets `NoColorSpace`;
   `rgb(52,50,38)` is 0.2 linear, not "dark grey". Material hex colours ARE
   sRGB-decoded. Never eyeball a painter value — compute it.
2. **Adding a `map` where none existed flips `USE_MAP` — a new shader
   program.** Safe ONLY if the material exists on a scene-reachable object at
   constructor time: the warm pass is `renderer.compile(scene, …)` across all
   four passes (`main.js:483-677`) and `scene.traverse` ignores `visible`.
   Textures warm automatically if on a standard slot and reachable via
   scene/`game.mats` (`main.js:686-712`). After ANY define-flipping change:
   warm-start gate + a `?hitch=1` walk. Changing colour/roughness/emissive
   VALUES, or repainting an existing canvas, is free.
3. **Geometry headroom is 51.** Mirror act 1449/1500 (`tests/results/smoke.log`).
   Net-new unique geometries are effectively banned; share or instance.
4. **`world.box` is a silent no-op after `finishStatic()`** (`world.js:90-112`)
   — it was drained at boot. New static dressing must be instances on existing
   InstancedMeshes or real meshes you account for.
5. **`batchStaticGroup` skips LineSegments, InstancedMesh, and multi-material
   meshes** (`outside.js:35-90`), and it **intersects attribute sets** — if one
   geometry in a group lacks `uv`, the merged mesh loses `uv` and any map on
   that material silently stops mattering. Check attributes before adding maps
   to batched groups.
6. **The rust-clone trap**: `rust = M.carPaint.clone(); color.setHex(0xb08c6a)`
   (`outside.js:3449-3451`) — a hex set over a mapped material multiplies the
   map. Tint via `multiplyScalar`/computed values, and always compute the
   product.
7. **District cullers spare lights by parent check** (`parent !== scene` skip,
   `outside.js:5913`) because every pinned light lives under `world.lightRoot`.
   Any new visibility toggle must use the same save/restore pattern and must
   never touch `world.lightRoot`.
8. **The emissive floors are load-bearing at distance** (mausoleum landmark,
   headstone dressing `emissive 0x101923 @ 0.11`). Re-tune, don't zero, and
   check a far frame after.
9. **`page.screenshot` composites the WebGL canvas black.** Every shot goes
   through `canvas.toDataURL` inside the frame task. Copy an existing tool.
10. **Never pipe a test through `tail`/`grep`** — redirect to a file.
11. The two known pre-existing failures (`underfalls-expansion` ×2,
    `grave-arena-regression` ×1, seeds 145/583) stay failed. Do not chase, do
    not weaken.

---

## THE PHASES

Run the full gate suite after EVERY commit. Re-shoot
`node tools/shot-graveyard-frames.mjs` after every phase that touches the
yard, into a NEW directory (`scratch-graveyard/after-phaseN/`), open the PNGs,
re-rank, and compare against `tests/results/graveyard-frames.json`. A change
that does not move its frame up the ranking gets reverted, not defended.

### Phase 0 — Take the headroom back (draws only, zero look change)

*Queue item 4. "Nothing can be SPENT in this yard until some of this is taken
back." Do it first so every later phase has room.*

1. **Batch the mausoleums.** `batchStaticGroup(group, 'mausoleum')` before
   `scene.add` at `outside.js:378`, exactly as the car does at `:3617`. Both
   use 3 materials (stone/void/soil) → 18 draws become ~6. Colliders are
   separate objects (`:381-385`) and unaffected. Verify `game.sealedMausoleum`
   / `game.ritualMausoleum` references still resolve to what the ossuary and
   marrow routes expect — they gate `visible` flips on interiors.
2. **Build the house-interior cull ledger empirically.** Write
   `tools/shot-cull-audit.mjs` (copy the shot-frames skeleton): stand at the
   five worst graveyard poses PLUS two look-back poses (yard's south edge
   looking at the house door; gate line looking back over the yard), and for
   each of the 93 `houseRenderRoots`: hide it, render, pixel-diff against the
   reference frame, restore. Every root with **zero pixel delta at all seven
   poses** goes into a new `game.houseInteriorRoots` list.
3. **Toggle it with the existing pattern.** New sync in `outside.js` beside
   `syncBackDistrictCulling`: when act is `graveyard` (and not in the
   ossuary), save-and-hide `houseInteriorRoots`; restore on returning to
   `house`/`basement`. Remove those roots from `backDistrictRoots` at build
   (`outside.js:4219-4225`) so exactly one culler owns them. Lights are
   already immune (parent check), but assert it in the tool anyway.
4. **Measure and pin.** Expect south to fall from 1203 toward ~500-600 (the
   world static shell — one mesh per material across all districts — is not
   cullable and sets the floor). Record the new number in
   `district-culling-regression` and promote the south view from `RECORDED`
   to asserted, with sane margin.

Gate emphasis: `playthrough.mjs` COMPLETE (act transitions exercise the
toggle), `district-culling-regression`, `warm-start`.

### Phase 1 — The value floor: grass and fog (changes every frame; do it before judging anything else)

1. **Normalise `grassPaint`** (`textures.js:406-428`): end with
   `toMeanValue(g, w, h, 0.055)` (start there; 0.04-0.07 is the test range).
   Keep the wide per-blade VALUE spread — that comment's instinct is right,
   the mean is what's wrong. Kill the green bias: blades at `(v, v+3, v*0.9)`
   or flatter — moss-grey, not billiard felt. Keep the pale dead tufts as
   value accents.
2. **Check every consumer.** `M.grass` also feeds the zero-draw horizon
   masses (`outside.js:204-262`) and possibly forest floors — the shell
   clones the material but SHARES the texture, so the repaint propagates
   everywhere at once. Re-shoot forest and clearing spots
   (`tools/shot-forest.mjs`, `tools/shot-crossing.mjs`) and confirm no
   navigation read got darker than its law.
3. **Lift the graveyard fog toward a readable haze.** `director.js:44,62`:
   fog and background are `0x050b16` — near-black, so pale objects pop out of
   nothing. MARROW's yard silhouettes against `0x14262b`. Test the range
   `0x0a141a`-`0x0d1a20`, fog == background (that equality is the district's
   own documented law — keep it), density 0.034 as-is or a click down. The
   far treeline instancing (`atmosphere.js:663-690`) should read as LAYERS
   against the haze — that is the success criterion, frames 01/02/08.
4. **Re-shoot all 14. This is the new baseline.** Expect: near-band means
   drop on 03-07 (darker floor), horizon frames gain structure. darkPct may
   RISE — that is fine, black is the look; what must improve is the
   *ranking question*: "what is wrong with this picture at a glance?"

### Phase 2 — The car (frames 04, 03, 05)

The car is 13 draws and already crushed, ribbed, and batched. Its failure is
uniform response under floodlight, plus glass that reads as body panel.

1. **Repaint `carPaintPaint` for variance at constant mean**
   (`textures.js:617-674`): keep `toMeanValue 0.032` as the LAST call, but
   raise the contrast inside — rust blooms 3-4× darker than the chalk field
   (they currently sit close to it), hard-edged panel-line grime, a genuine
   near-black lower third (road filth gradient exists — deepen it), scratch
   strokes that go BRIGHT (bare metal) not mid. Under floodlight, variance IS
   the read. Repaint = same texture object, zero programs.
2. **Fix the rust clone** (`outside.js:3449-3451`): `0xb08c6a` over the map —
   compute what it lands at and re-aim so rust parts sit visibly DARKER than
   painted parts at 2 m. Trap #6.
3. **Darken the glasshouse.** `glass` (`:3455-3458`): roughness 0.55 gives a
   broad pale specular sheet under the skull-lamp. Push roughness up
   (0.75-0.85), opacity down toward 0.7, colour toward `0x0a0f14` — the cabin
   behind it is upholstered in `0x17191a`, so what shows through goes dark.
   The windshield crack star (`LineSegments`, `0xaeb8b5`) then reads AGAINST
   dark glass — that is the money detail; brighten its opacity if needed.
4. **Ground it with shadow, for free.** The drag-marks InstancedMesh
   (`outside.js:3705-3721`, `Plane(0.86,3.2)`, unlit `0x030405`) has 4
   instances; add 2-3 more scaled/rotated under the car body and wheel line —
   per-instance transform makes the same quad an under-car shadow. Zero new
   draws, zero new materials. An unlit near-black anchor under the pale mass
   is the single highest-value pixel change on this object.
5. **Cheap silhouette breaks if the frame still needs them**: the existing
   crumple ribs and torn hood are paint/rust — a few degrees more rotation
   asymmetry costs nothing (they are batched; edit before batch at build
   time).

Success: frame 04 near-band mean toward ~30 with HIGHER max-min spread inside
the car's own pixels (variance up, mean down); 05 keeps its beam drama —
the beam and lens flicker (`:310-317`) are grammar, do not touch the light.
Verify first with one attribution probe (hide shell / glass / debris one at a
time at pose 04 — `shot-shore.mjs` pattern) so the fix lands on the mesh that
owns the pixels.

### Phase 3 — The mausoleums (frames 11, 12, 10)

1. **Give them a real material.** Build a dedicated painted texture at boot —
   reuse `stonePaint` (`textures.js:288-370`, already coursed masonry) via a
   new `T(512, 512, salt, stonePaint-derived, 3, 2)` — repeat ~3×2 on the
   walls (~430 px/m). Set it as the `.map`/`.bumpMap` of the EXISTING cloned
   Lambert (`outside.js:337`) — same program shape (Lambert+map+bump), zero
   define flips. Tint the product to **0.06-0.10 linear** on the flats, with
   mortar lines a further 3-4× darker — the courses do the near-field work.
2. **Re-tune, don't kill, the emissive.** Its job is the distant landmark.
   Try 0.38 → 0.18-0.25 and verify BOTH ends: frame 12 must stop clipping
   (max ≤ ~200, clippedPct 0), and a far pose (frame 01/02 background) must
   still show a room-shaped mass. If both can't hold, bias toward the far
   read and let courses carry the near.
3. **Kill the doorway glow.** The west throat slabs (`outside.js:390-407`)
   drop from raw `M.headstone` to the same treated stone or a dark clone
   (~0.05 linear). The `voidMat 0x010204` doorway planes are correct — they
   are the "absolute black doorway" of the reference — leave them.
4. **Roof**: same material treatment; the cone's 4 segments at repeat 1 will
   smear — either accept (it reads as slate at night) or give the roof its
   own darker unmapped tint ~0.05 linear. Judge in the frame.
5. **Break the box, for free.** The pair are identical mirrored assemblies
   with every line straight. Before batching: 1-2° yaw on individual wall
   boxes, sink one corner 3-4 cm, overlap the plinth asymmetrically —
   reads as settled masonry, costs zero (batched anyway). Add nothing new;
   deform what exists.

Success: 11 mean ≤ ~30 with visible course texture in the PNG; 12 no clip,
interior no longer the brightest thing; 10's approach silhouette unchanged
at distance (emissive check).

### Phase 4 — The bodies (frames 07, 06)

The beam across the bodies is authored drama — keep it. Make what it reveals
read as the dead, not as mannequins.

1. **First, 15 minutes of attribution** at pose 07: hide torso / limbs /
   sheet / ground contact one at a time (the bodies are
   `game.graveBodies`). Confirm which meshes own the palest pixels before
   painting anything. The diagnosis says "cloth under floodlight" — verify.
2. **Decide maps vs geometry by checking UVs.** The bodies use custom lofts
   (`sectionGeometry`/`limbGeometry`, `outside.js:3727-3822`) and are batched
   (trap #5): if those geometries lack proper `uv`, maps are off the table.
   - **If UVs exist**: give the four `clothes` and four `trousers` materials
     a shared 256² painted cloth map — weave grain, fold shading along the
     drag axis, grime gradient darkening toward the ground contact. Boot-built
     → warm pass covers the new programs automatically (trap #2); then
     warm-start gate + `?hitch=1` walk, non-negotiable.
   - **If not**: work in geometry and light instead — deepen the existing
     ground-contact planes (`contactMat`, opacity 0.58 → 0.7), add fold
     ridges to the `seam` panels (already dark), and trim the spot.
3. **Trim the floodlight LAST and least.** `head.intensity` rides
   `beat * (280 + sin·50)` (`outside.js:313`) — try 280 → 220 and re-shoot 07
   AND 05 (the beam is frame 05's drama; do not flatten it). Intensity
   changes are census-safe.
4. **Per-body variance is already authored** (4 cloth hexes, poses, skews) —
   if one body still reads as the "pale one", it is the sheet
   (`sheetMat 0x353834` ≈ 0.035 linear, right at the ceiling, index 3 only).
   Grime it down with the same cloth treatment or a multiplied tint.

Success: 07's figure reads as CLOTHED DEAD — folds, dirt, weight — with mean
staying in the high-20s (it is lit by design); the "white mannequin at a
glance" verdict flips in the PNG. 06's approach silhouette must not go
mushy — check both.

### Phase 5 — The arrival focal (frames 01, 02, 14)

Property 1 of the reference: black corners, one warm pool, one focal.
Arrival (01) is the district's first frame and has none. The rules: no new
lights, no new meshes if an instance will do.

1. **Extend the funeral-walk lanterns toward the arrival line.** The lantern
   posts / cages / pale embers are InstancedMeshes of 3
   (`atmosphere.js:502-504`); the embers are unlit `0xe4e7d6` — the gate
   lanterns already prove this focal works (frames 09/13 "already read").
   Add ONE more instance of each, placed to catch the arrival sightline
   `(0,7.5)→(0,20)`. Zero new draws, zero new materials, zero lights.
2. **Give the eye a route.** The drag-marks trail already points from the
   yard toward the house; one more instanced drag quad angled across the
   arrival lane makes cause point at effect (bodies were DRAGGED this way —
   it is also the game's story doing the work).
3. **Frame 14 (among the stones, low)**: per-instance `setColorAt` already
   varies stones 0.36-0.84 (`atmosphere.js:368`) — widen the bottom of that
   range slightly (0.30) so more stones sink into the dark, and let the one
   pale ember do the focal work.

Success: 01 gains a focal (max jumps toward ~180+ at the ember; mean lifts a
little; the PNG answers "what do I look at" instantly). If one instance
doesn't do it, STOP — do not start adding objects. Re-rank and move on.

### Phase 6 — The hands (independent — can run any time; pairs well with a
yard-phase gate wait)

Constraints that must survive, verbatim (mapped from `skull.js` and the
tools): `_fingers[]` entries keep `.k1` (Group), `.k2` (Group), `.phase`,
`.thumb`; update writes ONLY `k1.rotation.x`/`k2.rotation.x`
(`skull.js:752-771`) — so any static per-finger droop must be baked into
MESH transforms inside the groups, never into group rotation; fingers grow
+Z, curl +Y (`shot-grip-sweep` and `shot-bone-hands` assert
`dorsalZ > 0.6 && fingersY > 0.5`); `hold.children[0]/[1]` stay the hands
(`finale.js:883-884`); every new mesh registers via `fleshy()`/`bony()`;
everything exists by end of constructor (`setLayers` runs once,
`main.js:194`); zero % buried on the sweep; hand AABB must not grow.

1. **Share the geometry.** Hoist the 6 flesh geometries (s1/s2/s3 capsules,
   knuckle+pad spheres, nail box) to module consts built ONCE at base size;
   apply per-digit `scale` (and the new proportions below) via `mesh.scale`.
   Capsule local axes: Y is the length axis pre-rotation — so
   `mesh.scale.set(width, length, depth)` with `rotation.x = π/2` already
   applied gives elliptical cross-sections for free. Result: ~60 unique
   geometries → 6. **Geometry count must go DOWN in `smoke` — assert it.**
2. **Slim and taper.** Proximal radius 0.0145 → ~0.0100, middle → ~0.0080,
   distal → ~0.0066 (taper 24% → ~35%, on-screen width ~39 mm → ~27 mm).
   Squash cross-sections: width×1.05, height×0.82 — fingers are wider than
   tall. Lengths stay (lengths are right; girth is the disease).
3. **Break the evenness.** Root spacing 0.028 uniform → per-finger
   [0.0235, 0.0245, 0.0245, 0.0230]-ish accumulated (tighter overall — thin
   fingers at old spacing read splayed); yaw fan (i−1.5)×0.105 → hand-tuned
   asymmetry (index out a touch more, ring nearly straight); bake 0.04-0.09
   rad of per-finger droop/roll into the FLESH MESH transforms inside
   k1/k2 (not the groups — trap above). Vary which knuckle sphere sits
   proudest: scale knuckles (1.15, 0.75, 0.9), offset +Y 0.001-0.002 —
   knuckles are the "human hand" tell at this camera distance.
4. **Nails**: shared box scaled per digit, narrower than the new fingertip
   (~0.8× tip width), slight per-finger yaw jitter. The thumb keeps its
   `k1.scale.set(1.22, 1.12, 0.72)` subtree scale — retune only if the sweep
   stays at zero buried.
5. **Palm web**: with tighter spacing, narrow the web's x-scale (2.05 →
   ~1.75) so no gap opens at the finger roots.
6. **Verify**: `node tools/shot-grip.mjs` (open all six frames),
   `shot-grip-sweep.mjs` (zero % buried, and note it OVERWRITES the cradle
   during its run — shoot grip AFTER a clean reboot), `probe-grip-clip.mjs`
   (AABB ≤ current 0.245×0.441×0.193), `shot-bone-hands.mjs` (orientation
   asserts + the bone twin must still sit inside the slimmer flesh —
   bone shaft radii 0.0066/0.0057/0.0046 fit under the new flesh radii, but
   CHECK the knuckle condyles), `probe-viewmodel-light.mjs` (cradle 1.5-3×
   world mean), full playthrough (`_handsBone` beat), and the mirror-room
   geometry count.

Success: shot-grip frames next to the reference — fingers taper, sit
close, break silhouette; "sausage" verdict flips. One hour per shot session;
proportions are taste — when Alex says the hands look human, STOP.

### Phase 7 — The finish: the screen itself (LAST, because it moves every number)

All in the existing grain quad (`main.js:356-384`) — an existing program,
warmed at `main.js:622`, inside every measurement. Small, separate commits.

1. **Dither.** Add `+ (hash(vUv*resolution+t)-0.5)/255` before output. The
   game is 70-80% near-black; ACES + sRGB in an 8-bit swapchain WILL band in
   the fog gradients, and MARROW ships exactly this fix (`marrow/post.js:83`).
   Invisible to means, kills banding.
2. **Grain**: sample at actual resolution (the fixed 1280×720 scale is why it
   can read as screen-door at other sizes) — pass a resolution uniform;
   amplitude stays ~0.075. Keep `REDUCED_MOTION` freezing `uTime`.
3. **Vignette**: current curve starts at 0.18 — the reference's corners die
   harder. Try `smoothstep(0.14, 0.95, …)` base (fear ramp unchanged), and
   re-shoot the BEDROOM (`tools/shot-grip.mjs` is the reference pose) to
   judge — this is the frame the reference image is a before/after of.
4. **Optional, his call: dust motes** in the skull-lamp radius —
   camera-parented additive `Points`, MARROW's recipe (`marrow/main.js:95-111`),
   ~150-250 motes. +1 draw, +1 program (boot-built → warmed), +1 geometry.
   Sells the light as LIGHT. Skip if any gate so much as twitches.
5. **Re-baseline**: re-run every shot tool once, store as the new `before/`
   for whatever comes next, and note in the commit that measured means moved
   by the overlay delta (expect ~1-3 units down at corners, ~0 at centre).

NOT in this round (his explicit ask required): render-to-texture post
(split-tone/halation — MARROW has it, FETCH's two-pass + toDataURL harness
makes it a real architecture change), exposure changes (raising exposure
worsens the exact near-lantern blowout this round fights), any new
PointLight/SpotLight, anything in the north frames (09/13 already read), and
new queue items. When a frame reads, stop.

---

## THE LOOP (every phase, every commit)

```
edit → node tools/shot-graveyard-frames.mjs (or the phase's tool)
     → OPEN THE PNGS and look                → not better? revert now.
     → full gate suite, output redirected to files
     → any red that is not the two known pre-existing? revert, re-think.
     → commit small, message says WHAT CHANGED IN THE FRAME
```

Full suite, every commit:
```
node tests/smoke.mjs
node tests/autotest.mjs
node tests/regressions.mjs
node tests/playthrough.mjs            (must print COMPLETE)
node tests/warm-start-regression.mjs  (CRITICAL after any material/map change)
node tests/basin-shore-regression.mjs
node tests/choir-surfacing-regression.mjs
node tests/district-culling-regression.mjs
node tests/render-perf.mjs
```

Deploy only after his explicit approval, via the qualiacology shell copy —
the LOOK brief has the checklist. Never deploy from the game repo.

---

*Written 2026-08-18 after four deep code surveys (graveyard build, renderer +
warm pass + textures, hand rig + its probes, MARROW/uninvited/blackthorn
comparison) and after opening all fourteen before-frames. The line numbers
were spot-checked against the tree at `claude/aug17-round6-notes` (346e396).
If the tree has moved, re-verify before editing blind.*
