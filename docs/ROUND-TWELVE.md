# Round twelve — what is in this branch

Branch `claude/aug22-round12`, seven commits off `origin/main`.

Everything here answers his notes of 2026-08-19 (both rounds, see
`HIS-NOTES-2026-08-19.md` and `HIS-NOTES-2026-08-19b.md`).

| commit | what a player gets |
|---|---|
| `2009c9c` | **The furnace stops telling you it is ready.** The gauge tested `pump && archive` — two of the conditions — and swung to READY while the furnace was still cold. It reads `hasDraft` now, the real condition. The cold pilot also breathes instead of sitting dead, so an unlit furnace looks unlit rather than broken. |
| `4a2d5fd` | **The cave walls follow the lane, and the bell sits down.** Flank walls are rebuilt per-tread at local width, with a 9-point footprint test that drops any piece falling inside the walkable union. The bell that floated 1.18 m above its cistern is on it. |
| `515ebef` | **The ossuary ceiling stops flickering, and the ravine knot joins the family.** A coplanar plate was z-fighting; the ravine knot got the legibility kit — its own material, geometry, scale and a corona sprite — so it reads as a thing rather than a smudge. |
| `df5f472` | **NO FURNACE, on the one door every player has to stand in front of.** His idea, verbatim: a furnace pictogram in a circle-with-slash, so the rule is learned before the basement. New `furnaceSignPaint` in `textures.js`. |
| `de8eb10` | **The plate moves to the door with the fire behind it.** He corrected the door — it is `voidDoor`, the one over the stair void that opens during the puzzle and that you throw the skull at to hit the candle. Not `stairDoor`. |
| `4ed6bc4` | **More webs, more spiders, and a cheaper house than before.** 19 webs where there were 5, 9 spiders where there were 3, for 47 draw calls against the old kit's 64. |

## The spider merge, because it is the reusable lesson

A spider was **eighteen draw calls** — an abdomen, a head and sixteen leg
segments, every one its own mesh, all on the same material. That is why there
were only three of them, in the house, which is the tightest district in the
game.

The ticker had never touched a leg. It moves the whole spider. So the pose is
rigid, and rigid poses bake: composed by hand and merged, a spider is **one**
draw and the same silhouette to the pixel.

That is what paid for the other thirteen webs. **The house district measures
335 where it measured 339** — it got cheaper while gaining fourteen webs and
six spiders.

The corridor keeps its five: the curtain kind, full height, in your way. The
new ones are the corner kind, tucked into the angle where two walls meet the
ceiling — storeroom, crawl, hatchbay, boiler, blind archive, pump gallery,
scullery, over the cellar stair, back hall, study, nursery, guest room, stair
shaft. Above head height on the ground and first floors, so those are pure
decor; the basement ceiling is 2.45 m, so those you can still walk into.

Every site is tested against the colliders before it is built, because a web
grown through a crate reads as a bug and `furnish()` puts down enough that a
hand-picked corner cannot be trusted to stay empty. All nineteen cleared.

Two things the new sizes broke, and this fixed:
* the "brushed away, so the spider is gone" test was an absolute
  `scale.y < 0.5`, and a corner web **starts** at half scale — every new spider
  would have been invisible from the first frame.
* the tear radius was a flat 0.7 m, wider than a small web is, so you could
  tear one you never touched.

Both are relative to the site's own scale now.

## New tools

* `tools/probe-webs.mjs` — placed-vs-skipped sites and per-district cost
* `tools/probe-stair-bell.mjs` — box-scan of the basement corridor
* `tools/run-gates.mjs` — run a named list of gates, one verdict line each

---

# Gate results, 2026-08-19 evening — and what is still unknown

The full battery was run in four parallel batches (`tools/run-gates.mjs`).
**Every failure below was A/B'd against `origin/main` in a separate worktree**,
because a failure nobody has baselined is not information.

## Green

`autotest` · `regressions` · `smoke` · `warm-start` · `pause-title` ·
`legibility` · `playthrough` · `house-critical-path` · `house-expansion` ·
`house-return-horror` · `basement-foundations` · `window-scare` ·
`district-culling` · `basin-shore` · `choir-surfacing` · `choir-route-occlusion` ·
`grave-arena` · `grip-contact` · `horror-expansion` · `exterior-expansion` ·
`forest-hardening` · `forest-nervous-system` · `enemy-stain` ·
`enemy-standing-postclear` · `creature-audio` · `failure-state` ·
`pump-release-recovery` · `render-perf`

Note `house-critical-path` passed here. It was flaky in an earlier round
(1 red / 2 green); it has not been pinned, only observed green this time.

## Pre-existing, confirmed identical on `origin/main` — i.e. the LIVE game

These are **not** round-twelve regressions. They are also not "fine": they fail
against the build that is on the site right now, and nobody has looked at them.

* `house-chase-doors-regression` — *"the Resident walks the house early,
  unprompted"*, `{before:false, after:false}`. Identical on main, reproduced
  twice on each.
* `underfalls-expansion` — two checks: *"the broken promise still gates the
  expanded district and leaves controls live"* and *"the live hatch enters the
  mirror room with its reflected body still visible on the next frame"*.
  Identical on main.
* `perf-pool-regression` — *"the title answers the press in the same frame"*
  (412.9 ms). Fails on main. This one looks load-sensitive and may be a
  contention artefact rather than a real defect; not established either way.

## Caused by round twelve, cause NOT yet established

`perf-pool-regression` → *"GPU geometry count plateaus after the first burst
(831 → 833)"*.

Established by measurement:
* It is **not** a gore-pool leak. `tools/probe-geo-lazy.mjs` reproduces the
  burst pair and the delta is 0; every other pool check in that suite passes
  (same pool object, same Vector3s, scene-object count flat).
* Bisected to the web commit exactly: a worktree at `de8eb10` (round twelve
  *minus* the webs) passes the whole suite, 727 → 727.
* **32 of the 47 web geometries have never been drawn at boot** — they sit in
  rooms the boot camera cannot see, so Three has not counted them yet. Forcing
  every web to draw moves the counter +32.

So the shape is: two decorative web `LineSegments` upload late, inside the
window the gate measures, and the gate attributes it to the fragment pool.

**What is NOT established:** *why* those two upload at that moment. The obvious
hypothesis — a gore burst shakes the camera and a corner web enters the frustum
— was **tested and refuted**: `tools/probe-perfpool-camera.mjs` shows the camera
pose, `_shake` and `fovKick` all identical across both samples, and a delta of
0. The gate's real sequence does more setup than that probe reproduces, and
whatever moves the count lives in the part not yet reproduced.

**Do not "fix" this by loosening the gate until the cause is known.** Two
plausible endings, neither yet earned:
1. it is a benign late upload of decoration, and the gate's settle needs to
   cover it the way `legibility-regression`'s `settle()` does (that one zeroes
   `_shake` and `fovKick` and renders until two frames are byte-identical); or
2. it is a real ordering effect worth understanding, in which case the gate is
   doing its job and the webs need warming.

The next step that would settle it is a probe that reproduces the gate's *whole*
sequence — including its enemy-trace and cave-light steps — and diffs which
geometry uuids gained GPU buffers between the two samples.

## A finding about the parallel gate method itself

Running four Chrome batches at once made `forest-nervous-system-regression`
fail; run alone it passes. The parallel batches are much faster in wall-clock
but **timing-sensitive gates can flake under that load**, so a failure seen in a
parallel batch should be re-run alone before it is believed. The 412.9 ms title
latency above is likely the same effect.
