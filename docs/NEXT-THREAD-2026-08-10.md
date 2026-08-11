# FETCH polish: next-thread checkpoint

This is a deliberately preserved WIP seam, not a release claim. The gameplay
overhaul is substantially implemented, the focused back-half and broader
gameplay suites were green before the newest transition-residency work, and the
remaining release blocker is now concentrated in GPU first-use residency and
its final regression matrix.

## Exact checkout

- Worktree: `C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-polish-20260810`
- Branch: `codex/fetch-polish-20260810`
- Original base: `c6b486e723f1f265d6aecb3d7ee7c52f454e957e`
- Production remains the prior `0.5.0-intruder`; nothing in this checkpoint is
  merged, packaged, previewed, or deployed.
- The Qualiacology release worktree is separately staged and untouched at
  `C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-polish-site-20260810-173729`.

At this seam the audited A-stage runtime hashes are:

```text
3BB30AADC3B1A23701AE5EF46159239063C5309B6BFD4FC23A75EEFCF8E1BA21  src/main.js
C7544A3AA1A9F6D34069FC1CEA46FD0B1FA1F772DAB42909A054B75F1891206F  src/finale.js
436888A3B2C1E2BB4602C61DC1BBE74579E6B1FAA2365517417D30AB92E3ABB0  src/mirrors.js
1D2E811B5A3DEF8589FB1DCC7E86FC49FF4621ABE1913CDFD3BAEBA5413E5ED3  tests/transition-warmup-regression.mjs
8CFD4A31BA38A677B2BD2FCBFEB31838455199EEAAC050E4FC367C7DB6E632F9  tests/transition-identity-diagnostic.mjs
```

The diagnostic-test hash differs from the earlier A-stage audit only because
its final light census was corrected from the combined camera mask (`WORLD +
HELD`) to the actual physical world mask (`WORLD + MAIN_ONLY`). No Stage B
runtime edits landed before this checkpoint.

## User-visible work already implemented

### Basement causality

- The opening cellar obstruction retires into an actually open throat.
- The pilot flame, skull-socket flame transfer, pump, gauge, wheels, archive
  payoff, and furnace/key chain now share one readable cause-and-effect law.
- The furnace requires a continuous held throw; release or death cancels it.
- The furnace body is a true shell with a real aperture, not a solid slab with
  flame tips poking through.
- The optional kennel sequence has a visible, recoverable payoff.

### Graveyard, ossuary, forest, and clearing

- The mausoleum now opens onto a physical 12-tread descent; the route exits by
  a separate 15-tread far rise and supports honest backtracking.
- Terrain, slab, collider, and decorative foliage retire from the opened stair
  aperture without removing the authored roof/seal read.
- The counterweight has continuous-hold, release-decay, death-cancel, respawn,
  and retry semantics.
- The forest has a real three-rope canopy chain with midair transfer.
- The Kneeler has a burden-specific hit/bow/pass response, plus a legitimate
  alternate canopy route.
- The clearing has an eighth near-shore stepping stone and physical support
  across the complete eight-stone crossing.

### Underfalls and lifecycle hardening

- The cave current, culvert alternative, hatch destination, shaft, and chains
  are spatially distinct and readable without HUD exposition.
- Cave/ossuary visibility is edge-triggered and district-owned rather than a
  full-scene hot-loop scan.
- Route cues, optional one-shots, held interactions, portals, arena timers,
  mirror tableaux, and several delayed scares no longer progress while dead or
  in the wrong act.
- WebGL context loss invalidates generation-owned warm state and fails mirror
  consumers closed while the physical world remains playable.

## Evidence already earned (but requiring final same-source rerun)

Before the newest transition-residency edits, the broad gameplay matrix was
green:

- focused back half: 39/39
- back-half visual plates: 10/10 reviewed at original resolution
- district culling: 12/12
- full playthrough: all 38 milestones and ending
- failure state: 21/21
- grave arena: 8/8 across six seeds with all 16 authored bodies accounted for
- forest hardening: 4/4
- exterior expansion: 12/12
- forest nervous system: 9/9
- perf pool: 26/26
- autotest: 24/24
- canonical regressions: 50/50
- smoke: all acts, zero browser errors

Those results demonstrate the gameplay work, but they do not certify the final
shipping candidate because `src/main.js`, `src/finale.js`, `src/mirrors.js`,
`src/world.js`, `src/atmosphere.js`, and transition tests changed afterward.
They must be rerun after transition performance is green.

Accepted plates already exist for the back half and Underfalls. Fresh final
plates are still mandatory, especially the furnace aperture; the older furnace
plate predates the true shell/aperture correction.

## Current A-stage GPU truth

Focused artifact:

`tests/results/transition-identity-diagnostic.json`

The run used system Chrome / ANGLE D3D11 on the NVIDIA GTX 980M and closed with
zero browser errors and a clean process postflight. The artifact itself still
contains one failed assertion from the old combined-camera light mask; that
harness assertion has been corrected but was intentionally not rerun merely to
turn the file green.

The important runtime evidence is unambiguous:

- Wake handler: 1.4 ms.
- Fresh legal P16 first throw: 12.7 ms max render, 16.7 ms max rAF,
  `+0 programs / +0 textures / +0 geometries`, exact count unchanged.
- Fresh legal P16 flame absorb: 14.5 ms max render, 33.3 ms max rAF,
  `+0 / +0 / +0`, exact count unchanged.
- The previous +5-program throw and +32-program flame cliffs were test
  contamination: the old monolith resurrected the skull after the waterfall
  and created an impossible P18 state. Do not add a P18 shipping warm variant.
- Same-generation house and Finale render-target replacement now changes the
  pool epoch and ordered `target.texture.uuid` identity, retires old owner and
  target readiness, and leaves every pane dark.
- `WebGLRenderTarget.uuid` is undefined in bundled Three; all readiness now uses
  GL generation + explicit pool epoch + ordered texture UUIDs + direct pool and
  target references.

The remaining cold work is also named:

- Reduced batch 1: 117 ms, +2 Basic programs, 16 geometries, 48,050 currently
  counted bytes / 1,336 base vertices.
- Reduced batch 2: 34.6 ms, +1 instancing-family Basic program, 658,776 bytes /
  18,858 base vertices.
- Reduced batch 3: 614.7 ms, +1 Points program (`pathside foxfire`), 770,630
  bytes / 22,132 base vertices.
- First Line fallback: 22.8 ms, +1 program (`shattered windshield star`).
- Some late owner batches reached 118.1 and 139.4 ms despite only about 30–35
  KiB of newly counted base geometry. The hidden pass is rerendering the entire
  accumulated reduced scene instead of only the staged batch.
- First exact world: 180.9 ms, +1 program / +1 geometry. The new program is an
  exact P16 `PointsMaterial` on an unnamed Points object. Upload tracing also
  found one planner-unseen, Box-like MeshBasic geometry, an instance-matrix
  upload for `waterfall stone seal silhouette`, and one unmapped index buffer.
  HELD and grain exact subpasses were already +0.

## Next implementation stage: B

Do not rerun the full monolithic transition matrix yet. Implement and short-gate
the reduced fallback first.

The agreed minimal direction is:

1. A generation-scoped tiny real-render bootstrap for the monochrome reduced
   Mesh and InstancedMesh signatures, with exact grain as its own later paint.
2. Reduced mode may omit decorative Lines and Points instead of paying their
   cold fallback programs. Normalize reduced InstancedMesh clones to
   `instanceColor = null`; exact/predictive residency remains responsible for
   the real colored/particle/line programs.
3. Never draw production grain until the same GL generation has hidden-rendered
   the exact grain material and quad. The first visible grain frame must be
   `+0P/+0T/+0G`.
4. Use a transient hidden `batchScene`; only successfully submitted physical
   clones move into the persistent playable silhouette. Owner/deferred/skull
   preload clones never persist there.
5. Keep the 16-geometry and 32-object limits, adding initial admission caps of
   512 KiB and 16K submitted elements. Account index, drawRange, ordinary and
   morph attributes, instanceMatrix, instanceColor, and effective instance
   count. Track resource versions, not only geometry UUIDs.
6. A single oversize entry may advance alone with explicit identity/reason
   telemetry; it may never be stacked with a neighbor. If that one object still
   exceeds 100 ms, name it and move it to title/previous-act idle or split the
   authored resource—do not relax the threshold.
7. Commit coverage and resource-version state only after the hidden render and
   restoration of target, viewport, scissor, camera layers, and autoClear all
   succeed. Failure requeues the complete batch in order.

Short B acceptance, using one fresh page without `gpuidentity=1`:

- click handler under 50 ms
- first nonzero physical silhouette within 150 ms
- no opaque shader/DOM shield
- all visible render/rAF samples at or below 100 ms
- visible reduced frames `+0P/+0T/+0G`
- every hidden batch `programDelta === 0`, `textureDelta === 0`, duration at or
  below 100 ms, within caps or one explicitly isolated oversize entry
- transient submitted-object count exactly equals the current batch, never the
  accumulated persistent silhouette
- grain absent before certification; first visible grain +0/+0/+0
- context restore invalidates and rebuilds the small bootstrap exactly once for
  the new generation

If either tiny Mesh bootstrap signature alone exceeds 100 ms, stop and report
its exact program key; do not hide it behind a longer blackout.

## Stage C after B is green

- Split current-frustum shader/material signatures ahead of the broad district
  itinerary without falsely marking the whole district ready.
- Fix the exact-world +1P/+1G using the named identity evidence; likely inspect
  the globally visible clearing Points object and the planner-unseen tiny
  MeshBasic object before adding any broader warm registry.
- Short-gate house and cave restore, natural gone-skull Finale P16, staged owner
  RT certification, runtime FBO recovery, and real grave/forest/cave motion.
- Only then rerun `tests/transition-warmup-regression.mjs` in full.

## Final release sequence (not yet authorized by evidence)

1. Freeze source and assign the candidate version in both `package.json` and
   `src/main.js` before the final same-source matrix.
2. Run static checks across every changed/untracked JS/MJS file.
3. Run focused basement, house, back-half, Underfalls, transition, flame, and
   context-loss gates serially in system Chrome/D3D11.
4. Rerun the complete broad/canonical matrix, including playthrough twice.
5. Recapture and inspect fresh basement, back-half, and Underfalls plates.
6. Build two deterministic Netlify archives and verify equal SHA-256.
7. Recompute the site sync manifest; it currently contains 12 runtime files and
   includes `fetch/src/atmosphere.js`.
8. Preserve the Qualiacology-specific `fetch/index.html`; never overwrite it
   with the standalone shell.
9. Run site build/validate/route-smoke/npm QA in the isolated site worktree.
10. Feature branch + PR + preview + explicit Alex approval + merge + live URL
    verification. No manual production deploy.

## Process and communication law

- System Chrome/D3D11 tests run serially, with explicit process preflight and
  postflight. Never count overlapped GPU evidence.
- Do not touch or kill unrelated browser/game processes.
- Local green, an archive, a PR, a preview, and production are distinct facts.
- Keep the next task staged and bounded; report each short gate before paying
  for another monolithic matrix.
- Before every second user-facing design update, reread:
  `C:\Users\Alex\.codex\plugins\cache\openai-curated-remote\product-design\0.1.52\references\critical-overrides.md`.
