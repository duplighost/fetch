# ROUND SEVEN — THE RECORD

The graphics pass. Branch `claude/aug18-round7-look`, stacked on
`claude/aug17-round6-notes`. Eight commits, one per phase of
`ROUND-SEVEN-PLAN.md`, full gate suite green after every one.

**Nothing in this round touched gameplay.** No throw, no catch, no `FEEL_PROFILE`,
no enemy constant, no puzzle, no checkpoint, no verb, no light added or removed
or visibility-flipped. The three places where a look change met a gameplay
structure are named below and each one preserved the behaviour exactly.

---

## The numbers

| frame | draws | near-band mean | max |
| --- | --- | --- | --- |
| 01 arrival from the house | 413 → **399** | 10.8 → 16.9 | 209 → 194 |
| 02 arrival wide east | 331 → **324** | 6.8 → 7.0 | 50 → 50 |
| 03 the car approaching | 312 → **305** | 35.8 → 35.4 | 164 → 160 |
| 04 the car beside it | 808 → **337** | 42.9 → **32.5** | 159 → **181** |
| 05 the car from its beam | 709 → **259** | 9.6 → 9.0 | 146 → 50 |
| 06 the first body ahead | 355 → **347** | 20.3 → 21.2 | 146 → **68** |
| 07 standing over a body | 298 → **293** | 28.2 → **25.8** | 93 → 83 |
| 08 mid-yard looking SOUTH | **1203 → 327** | 6.9 → 7.4 | 65 → 50 |
| 09 mid-yard looking north | 247 → 250 | 33.3 → 25.5 | 182 → 160 |
| 10 east mausoleum approach | 196 → **192** | 13.4 → 11.0 | 160 → 138 |
| 11 east mausoleum close | 260 → **254** | 42.1 → **31.2** | 230 → 231 |
| 12 west mausoleum | 203 → **202** | 15.7 → 16.4 | 244 → 243 |
| 13 the gate approach | 365 → 370 | 21.0 → 18.1 | 227 → 229 |
| 14 among the stones low | 266 → **264** | 9.3 → 8.5 | 111 → 91 |

Total across the fourteen poses: **5966 → 4123 draws, 31% less.** Worst single
frame **1203 → 399**, under the 450 ceiling for the first time.

Geometry, mirror act (the tightest): **1448 → 1377** of 1500. Headroom 52 → 123.
Shader programs: **257 → 256**.

---

## The one finding that mattered most

Three surfaces in this game have now had the same disease, and two of them were
diagnosed as albedo problems and "fixed" by recolouring, twice each.

**Set the material to pure black and see what is left.**

- the dead: **79%** of what you see survives a pure-black albedo
- the wreck: **52%**
- the basement boiler (round five, already recorded): same story

`MeshStandardMaterial`'s dielectric specular uses a fixed F0 of 0.04 *regardless
of albedo*. Cloth at 0.004 linear under the ~30 irradiance of the wreck's
headlight plus the lantern in your hands gets 0.12 of diffuse and 1.2 of
specular. Ten to one, and the ten is the part no recolour can reach — which is
exactly why `outside.js` carries a correct, carefully argued comment about
dropping the skin to `0x241f1c` above a body that still read as a shop mannequin.

The fix is to stop being MeshStandard. Lambert has no specular term and is
already this kit's workhorse (stone, brick, grass, wallpaper, headstones), so
the programs existed: the count went **down**, and the hitch walk attributes
**0 ms** of stall to shader compiles.

`tools/probe-body-specular.mjs` answers this in one render. Run it before
recolouring anything, ever again.

---

## What the plan got wrong, and how it was caught

The plan was written from a code survey and was right about most things. Two
diagnoses did not survive measurement, and the tool that caught both is new.

1. **"The grass is ~6× the district's albedo law; normalise it to 0.055."**
   It is at **0.0124 linear** — comfortably *under* the ceiling. The plan read
   `grassPaint`'s canvas mean (0.198) and did not multiply by the grade
   `main.js` applies late (`#3d4a3c`, ×0.0624). Normalising as instructed would
   have taken the district's largest surface **four times darker** and answered
   "no mids, no focal" by deleting the last of the mids. What was actually wrong
   was **chroma 2.03** — twice as much read in hue as in value, in the one
   channel he cannot see. Fixed by neutralising, at matched luminance.

2. **"The mausoleum shell is ≈0.43 linear, fourteen times the ceiling."**
   It is **0.102** — three times, not fourteen. Same cause: the raw painter
   value, without `tint('headstone', 0x7b898f)`. The direction was right and the
   fix stands; the magnitude was 4× out.

3. **"Frame 12 must stop clipping."** It cannot and should not. The clipped
   pixels are the **skull in your hands** — the reference image's own first
   property. `tools/probe-clip-owner.mjs` settles it by hiding every scene
   object in turn. Two rounds blamed two different objects; nobody should chase
   it a fourth time.

`tools/probe-albedo.mjs` prints map × colour for every material with the
per-channel spread beside it. **Never judge a surface from one half of that
product.** Every wrong call in this area, in both directions, has been that.

---

## Where a look change met a structure, and what protected it

1. **Batching the mausoleums** broke `enemies.js`, which identified a hollow
   room by counting a group's children (`>= 6`; the merge makes it two). The
   identity moved onto an explicit `userData.mausoleumRoom` flag and matches
   exactly the same two groups.
2. **The house-interior culler** found an enemy mesh in its ledger — the
   basement dropcloths hide one real walker, spawned during the house build.
   Nothing that can move, chase or be fought belongs in a static culling ledger
   at any price; excluded by identity.
3. **The drag-mark count** is asserted in `exterior-expansion`. It moved 4 → 7
   (the three extra are the wreck's ground contact) with the reason written next
   to the number.

Three pre-existing bugs surfaced and were fixed because they fought the culler,
all of the same shape — something writing `visible` after the district cullers
had run: the crawl-space counterweight ticker (runs every frame in every act),
the mirror reflection pass (restored its pane to `true` rather than to what was
there), and the enemy mesh above.

---

## Still open, and measured on the way past

- **Entering the basement costs a 7.1-second frame.** 191 geometry uploads,
  zero shader compiles. The untouched round-six tree does the same in 6.4s. This
  is a real instance of his "loading new areas just about always freezes it"
  with a cause attached, and it is nobody's round yet.
- **`playthrough.mjs` is non-deterministic.** It failed twice in a ten-minute
  window on a tree with no changes in it — the same commit passed its own gate
  run half an hour before and has passed every run since (6 for 6), alongside
  four clean runs of the untouched baseline. The game spawns one of four
  basement dropcloths as a real walker from `Math.random()`, sitting directly on
  the route that failed. Look there first if it recurs.
- The two documented pre-existing failures are untouched and identical:
  `underfalls-expansion` fails two checks, `grave-arena-regression` one.

---

## New tools

| tool | what it answers |
| --- | --- |
| `probe-albedo.mjs` | map × colour for every material, with per-channel chroma |
| `probe-albedo-ab.mjs` | what darkening this surface would actually buy, live |
| `probe-body-specular.mjs` | how much of this survives a pure-black albedo |
| `probe-clip-owner.mjs` | which object owns the clipped pixels in this frame |
| `shot-cull-audit.mjs` | which render roots a district can actually see |
| `probe-house-root-bounds.mjs` | where every house render root is |
| `probe-interior-cull.mjs` | who survives the interior culler, and why |

Two of them exist because the first version of `shot-cull-audit` measured
nothing: `render()` decays `fovKick`, the impact light and the impact ring on
every call, so two renders of an unchanged scene differ and the diff reported a
false ~16915 delta for every root in the house. **Render until two frames come
back byte-identical before measuring anything.** Every new tool here settles.

---

## Not done, and why

Deliberately out of scope, both flagged in the plan as his call: render-to-texture
post (split-tone and halation would be a real architecture change against this
two-pass, `toDataURL`-captured renderer), and the dust motes in the lantern
radius. The north frames (09, 13) were left alone — they already read.

The bodies' cloth folds are in the loft geometry rather than in a map, because
`sectionGeometry` and `limbGeometry` carry position and nothing else — no `uv`
survives, and `batchStaticGroup` intersects attributes anyway. A cloth map was
never available at any price on those surfaces.

*Written 2026-08-18. Deploy is his call and has not been made; nothing here has
been pushed.*
