# FETCH: continuation audit ledger — 2026-08-11

This document was drafted by a prior Codex task. Alex did not author, review, or approve its detailed prescriptions, so it is a fallible audit checklist rather than authority. Direct instructions from Alex, verified repository evidence, and current runtime results control. Useful safety constraints remain useful; unsupported claims must be checked independently. **The mission is to finish the complete FETCH overhaul and verify the live website, not merely to make an intermediate renderer gate green.**

Read this file completely before changing source. Then read the repository `AGENTS.md`, the current source-truth documents, the full dirty diff, and the current test artifacts. Treat the ordered gates below as hypotheses to audit and improve, not commands to obey blindly. Continue automatically after each genuinely green stage. Stop only for a genuine blocker requiring unavailable external authority or information that cannot safely be inferred. Alex has explicitly authorized the normal PR, merge, Git-connected deployment, and live-verification workflow when the candidate is truly ready; no additional production-approval pause is required.

## 1. Current truth in one minute

- The game worktree is `C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-polish-20260810`.
- The branch is `codex/fetch-polish-20260810`.
- The preserved overhaul checkpoint is `0e9767dd7e5eb679ddd32030c5f6571a3fba7721` (`Checkpoint FETCH full-route polish and GPU residency diagnosis`).
- The independently verified Stage B checkpoint is `15dd96cba12410c593bbe006d2d677bb92363146` (`fix: bound transition GPU residency`).
- The later verified Stage B follow-up and recoverable Stage C work checkpoint is `af315572098ce506c5bbee7a6e1ffcab249aa4ab` (`checkpoint: certify stage b and preserve stage c work`). Stage C source and its focused regression are present at this checkpoint, but Stage C runtime acceptance has not yet been earned.
- The checkpoint was based on `c6b486e723f1f265d6aecb3d7ee7c52f454e957e`.
- The overhaul checkpoint contains the large gameplay, route, visual, lifecycle, test, and renderer overhaul described below: 40 files changed, 17,544 insertions, and 594 deletions relative to that base.
- The latest Stage B source, focused regression, Stage C implementation work, and focused Stage C regression are committed. The tree was clean immediately after `af315572098ce506c5bbee7a6e1ffcab249aa4ab`; later changes must be inspected and preserved normally.
- Historical hashes before the Stage B repair were:
  - `src/main.js`: `922AD0B2FC01CBAF411AB754D66D8022ED1AD6F28650F232828B4365841385DB`
  - `tests/transition-stage-b-regression.mjs`: `F03E08C9B8EC3FEDE326239978C024933E570185B369F2F407FF014F27346D30`
  - `tests/results/transition-stage-b-regression.json`: `0E363D5BAA94FFB15F62C6CE3F30E808AF80D069267DE953DC99E4979B3C2907`
- Those hashes are preserved evidence, not restoration targets. Inspect later diffs and artifacts rather than trying to restore them.
- The public/candidate version has **not** been assigned. Both `package.json` and `src/main.js` still say `0.5.0-intruder`.
- This is not a release. There is no final same-source QA result, deterministic final package, FETCH site-sync commit, PR, accepted preview, merge, or verified live production release yet.
- The immediate short D3D11 gate is now green with its immutable `<100 ms` contracts intact. Stage B is one verified checkpoint, not the total scope.

## 2. Read before acting

Read completely:

1. `AGENTS.md`
2. this file
3. `docs/HANDOFF.md`
4. `docs/STATE-OF-PLAY.md`
5. `docs/WALKTHROUGH.md`
6. `docs/PLAYTEST-1.md`
7. `docs/NEXT-THREAD-2026-08-10.md` for history
8. the entire current `git diff`
9. `tests/transition-stage-b-regression.mjs`
10. `tests/results/transition-stage-b-regression.json`
11. Product Design's critical override and linked communication protocol

Before any browser work, verify the exact checkout, HEAD, intended dirty paths, available disk space, and that no foreign Playwright, Chrome, or dev server owns D3D11. Browser/GPU evidence must remain serial and process-clean.

## 3. What the overhaul actually built

This is the part that the earlier narrow handoff failed to explain. The checkpoint is not a renderer experiment with a game attached; it is a full-route overhaul with renderer work added to make that route playable without multi-second stalls.

### Basement and house opening

- Rebuilt the opening basement obstruction into physical boards with jamb sleeves and an honest cleared passage.
- Preserved the core skull input grammar while making the opening response more tactile and legible.
- Added the servant-bell route and the alternate exterior trolley/window relay route.
- Added lifecycle-safe relay behavior: death or act exit cannot ghost-complete the route; the armed visitor/trolley/window state cancels atomically and can be re-earned on living re-entry.
- Added a visible guest-room flame source and a visible pilot-flame alternative.
- Added carried flame sockets and a preallocated flame-transfer effect so the required first steal does not construct meshes, materials, geometries, or tickers on the collision frame.
- Reworked the pump and nearby machinery with grounded collars, gauge response, physical placement, release/recovery behavior, and optional local archive-wheel response.
- Built the optional kennel/crawl secret and hardened its reveal clock, ball payoff, sound, and act/death lifecycle.

### Furnace, ash key, and hatch

- Rebuilt the furnace as a real shell rather than a solid box pretending to have an opening.
- The mouth now has a genuine unobstructed aperture, shallow rear cavity, ember bed, and five visible flames.
- Hardened the exact held-skull rule: an already-held skull cannot be used as a counterfeit new throw; continuous held refusal, release, death, and retry are all tested.
- Completing the furnace route produces the ash key and opens the physical hatch path.

### Graveyard, mausoleum, and ossuary

- Supports both the quiet grave ritual and the loud arena route.
- Tactical resonant graves can help lay stunned arena bodies to rest; the accounting still requires all 16 authored bodies to resolve across the six-seed gate.
- Rebuilt the mausoleum opening around a real animated center seal and a true terrain aperture.
- Added an honest 12-tread descent visible from an ordinary held-skull first-person approach.
- Removed decorative grass cards from the aperture buffer when the seal opens.
- Added the ossuary held-counterweight route, backtracking support, and a 15-tread far rise/hatch emergence.
- Hardened all ossuary portals, landings, checkpoints, and death/respawn paths against irreversible corpse progression.

### Forest, ropes, Kneeler, and clearing

- Added the fallen-tree obstruction with three real hits.
- Expanded forest forks, searcher behavior, mire rope, appliances, environmental audio, and the optional arena.
- Added the three-knot canopy chain with grounded and true-midair transfers.
- Added the Kneeler alternative: burden, bow, and pass behavior as a distinct route rather than decoration.
- Preserved the alternate canopy bypass.
- Added the complete eight-stone clearing crossing with rising/support semantics, ordinary movement across all eight stones, and death/respawn checkpoint integrity.
- Preserved the one sincere clearing ending and the waterfall sacrifice handoff into the last act.

### Underfalls and Finale

- Built the Underfalls current, required route, culvert alternative, shaft, mismatched chains, hatch destination, Choir, spray defense, pump/high/secret semantics, and route/audio ledgers.
- Split the Underfalls structural shell from exterior rock so cave culling can keep exactly the required shell and hide the broad exterior batch.
- Added an owned hatch destination light and stronger grayscale shaft/halo so the next leg is readable without hue dependence.
- Built the wrong-bedroom Finale with physical and reflection states, exact mounted skull-head logic, shrinking-room/contact logic, and fail-closed panes.
- Context loss, target replacement, bind/render/restore failures, and owner-target recovery are handled without freezing the physical world or letting broken panes reveal.

### Lifecycle and performance hardening

- Dead players no longer advance forest/grave arenas, act zones, portals, canopy checkpoints, window tableaux, optional one-shots, lag-mirror awakening/rendering, kennel reveals, or skull-target route progress.
- Arena timers/callback reservations survive death honestly and cannot checkpoint a mutual-kill corpse position.
- `skull.update` now receives an authoritative live-interaction law so an outbound skull cannot spend irreversible targets during the death veil.
- Impact and carried-flame resources are resident/preallocated rather than lazily changing light/resource cardinality on the first hit.
- World lighting was normalized to a fixed physical signature, while the held pass remains its exact two-light signature.
- House and Finale render targets use generation, pool epoch, ordered `target.texture.uuid` identities, and direct pool/target references; `setSize` and context restore retire stale readiness.
- Mirror rendering is exception-contained and fail-closed; the world continues while affected panes remain dark and same-generation recovery proceeds.
- Transition, context-loss, light-census, live-fault, deferred-geometry, and first-action instrumentation were added so a low-latency claim must be proven on real ANGLE D3D11.

### Files changed by the checkpoint

Runtime source changed in:

```text
src/atmosphere.js
src/audio.js
src/director.js
src/enemies.js
src/finale.js
src/house.js
src/main.js
src/mirrors.js
src/outside.js
src/skull.js
src/underfalls.js
src/world.js
```

The checkpoint also updated source-truth documentation and added or expanded focused tests and diagnostics for the basement, window relay, death-flight law, flame transfer, mirrors, grave/forest/ossuary traversal, Underfalls, culling, transition residency, light variants, and frame profiling.

## 4. Design and gameplay laws that must survive every fix

- **Control begins quickly and remains continuous.** No forced camera, multi-second opaque shield, or input theft may replace a hitch.
- **Teach through play.** Do not add explanatory HUD/copy to repair an unclear physical route.
- **Skull grammar is sacred:** press/hold/release, carry, throw, return, and target semantics must remain coherent.
- **Quiet stun and loud pop are distinct.** Do not flatten combat response.
- **Growth and scene changes happen honestly, often offscreen, rather than teleporting visibly for test convenience.**
- **Audio is part of wayfinding and causality.** Preserve the authored sound relationships.
- **No gameplay meaning may depend on red versus green alone.** Alex has moderate deuteranopia; use shape, brightness, motion, sound, position, and state.
- **No counterfeit geometry.** If a passage, stair, furnace mouth, platform, rope, or stone looks usable, it must have real collision/state/traversal behavior.
- **No counterfeit tests.** Use real loops, real camera/player state, real targets, and legal route state. Do not resurrect a gone skull or force impossible lights merely to make a harness convenient.
- **Pause, title, Esc behavior, and the intruder presentation remain intact.**
- **One sincere clearing ending remains.** Do not add a second ending because a test or transition path is easier that way.

## 5. Evidence already earned — valuable, but not final release evidence

Earlier source states earned substantial evidence:

- focused back-half matrix: 39/39
- visual plate set: 10/10 inspected at original resolution
- district culling: 12/12
- complete playthrough: all 38 milestones and the actual ending
- failure-state regression: 21/21
- grave arena: 8/8 across six seeds with all 16 authored bodies accounted for
- forest hardening: 4/4
- exterior expansion: 12/12
- forest nervous system: 9/9
- performance pool: 26/26
- autotest: 24/24
- canonical regressions: 50/50
- smoke: every act, zero browser errors
- Underfalls focused gate: 19/19

Those results prove the gameplay work was not imaginary. They do **not** certify the final release candidate because later changes touched renderer ownership, `main.js`, `finale.js`, `mirrors.js`, `world.js`, `atmosphere.js`, light rigs, context recovery, flame resources, and transition timing. Re-run the required gates from the final frozen, versioned source. Never quote the old counts as if they came from the final commit.

## 6. Stage A identity evidence and current Stage B truth

The identity diagnostic established:

- legal fresh P16 first throw: 12.7 ms max render, 16.7 ms max rAF, `+0/+0/+0` program/texture/geometry, exact-pass count unchanged
- legal fresh P16 flame absorb: 14.5 ms max render, 33.3 ms max rAF, `+0/+0/+0`, exact-pass count unchanged
- the older P18 throw/flame cliffs were contaminated by a harness that resurrected the skull after the waterfall; do not create or warm a shipping P18 world
- physical world census is exactly `Ambient 1 / Hemi 1 / Directional 1 / Spot 1 / Point 16`, one directional shadow, total 20
- held pass uses exactly two point lights
- render-target identity is generation + `poolEpoch` + ordered `target.texture.uuid` values + direct pool/target references; no identity may contain `missing`

The committed Stage B implementation now includes:

- one generation-scoped tiny reduced bootstrap for MeshBasic, normalized monochrome InstancedMeshBasic, and grain
- decorative Line and Points omitted from the reduced silhouette
- grain certified separately and hidden until a later paint
- a transient `batchScene`, not cumulative re-render of every prior hidden clone
- transactional render-state restoration and coverage commit/rollback
- resource-version/fingerprint accounting, including indices, draw ranges, morphs, instance matrix/color, and effective instances
- hard admission caps: at most 16 unique geometries, 32 objects, 512 KiB, and 16K submitted elements
- one named oversize resource may advance alone; it may never be stacked or used to weaken the visible `<100 ms` frame contract
- context-generation rebootstrap and telemetry

The current verified short artifact is:

`tests/results/transition-stage-b-regression.json`

SHA-256:

`59687530185AA73B5719DBE0E7BBB2AAA55A188315F89BD7F7D16AB9EE034276`

The focused command completed with zero failures and zero browser errors on system Chrome using real ANGLE D3D11:

```text
command:          node tests/transition-stage-b-regression.mjs
result:           STAGE B TRANSITION RESIDENCY PASS
failures:         0
browser errors:   0
renderer:         ANGLE / NVIDIA GeForce GTX 980M / Direct3D11
```

Key generation-zero measurements:

- Wake click: 1.1 ms
- first initial silhouette: 84.1 ms
- initial max visible render/rAF: 36.3/66.7 ms
- default-surface activation: 0.9 ms maximum synchronous slice
- Mesh/Instanced/grain bootstrap: 5.3/1.2/1.0 ms
- current/owner-primary/owner-secondary census: 32.2/35.7/19.9 ms
- visible resource deltas: `+0/+0/+0`
- zero shielded frames
- Line/Points omitted
- grain separation correct
- 66 bounded reduced batches, maximum 2.2 ms
- ordinary caps green
- isolated oversize resources named and unstacked
- every batch committed with render state, generation, resource fingerprints, and queue prefix stable
- hidden upload and physical reveal occur on separate paints

Key restored-generation measurements:

- first restored silhouette: 94.3 ms
- restored max visible render/rAF: 59.7/49.9 ms
- default-surface activation: 0.7 ms maximum synchronous slice
- Mesh/Instanced/grain bootstrap: 1.7/1.6/0.8 ms
- current/owner-primary/owner-secondary census: 16.5/59.3/18.0 ms
- 66 bounded reduced batches, maximum 3.7 ms
- visible resource deltas: `+0/+0/+0`
- zero shielded frames and zero browser errors

The prior red artifacts remain preserved under `tests/results/` as diagnosis history. They are not current acceptance evidence.

## 7. Ordered remaining mission

### Gate B1 — completed: cold exact-signature bootstrap

The cold stall was decomposed and repaired with exact generation-scoped MeshBasic, InstancedMeshBasic, and grain program submission/readiness/finalization, followed by separate real-render residency certification. The implementation retained the original `<100 ms` assertions, transactional batches, caps, grain separation, and omitted Line/Points behavior. No global assembled-world prime or opaque shield was introduced.

The bounded command was:

```powershell
node tests/transition-stage-b-regression.mjs
```

The complete latest artifact was inspected; source and regression syntax, staged diff whitespace, process postflight, and disk space passed; follow-up checkpoint `af315572098ce506c5bbee7a6e1ffcab249aa4ab` records the current Stage B result and preserves the Stage C work in progress. This checkpoint is not a release.

### Gate C — current-view and exact residency

After Stage B is green:

1. Prioritize only the current frustum's physical material/program signatures ahead of the broad district itinerary without falsely marking the whole district ready.
2. Identify and close the remaining first-exact-world `+1 program/+1 geometry` using runtime identities, not broad priming. Known leads include the globally visible clearing Points object, planner-unseen tiny MeshBasic geometry, waterfall stone-seal instance-matrix upload, and an unmapped index buffer.
3. Short-gate, separately and serially:
   - immediate Wake and generation-zero physical reveal
   - house context restore
   - cave context restore
   - active-Finale context restore
   - natural gone-skull Finale P16 state
   - house and Finale owner-target certification
   - same-generation target replacement
   - live FBO bind/render/restore failure containment and automatic same-generation recovery
   - legal fresh throw, return/catch, bedroom-key carry, flame absorb, and offscreen skull stage evolution
   - grave, forest, clearing, ossuary, and cave look/move/deferred-geometry promotion
4. Every first revealed world, held, grain, and owner reflection pass must meet the existing P/T/G and rAF contracts.
5. Reconcile exact-only ownership deliberately. Stage B omits decorative Line/Points from reduced owner/deferred universes and records them in `ownerExactOnly`; the broad transition harness must compare reduced plus exact-only membership intentionally rather than demanding the old combined universe by accident.
6. Make resource-version truth operational. `geometryFingerprints`, `resourceSeen`, and `objectFingerprints` exist, but Stage C must prove that post-commit buffer/version mutations are detected and requeued before exact reveal, or narrow the claim and remove unused counterfeit state.
7. Prove exact-only Line/Points programs and buffers resident before first exact physical/owner reveal. Stage B intentionally does not prove them.
8. Do not run the monolithic transition suite until the short Stage C gates are green.
9. Once short gates are green, checkpoint, run the complete transition/context matrix, repair every genuine red without weakening thresholds, and rerun until green.

#### Gate C1 verified checkpoint evidence

The focused current-house/owner gate is green on both generation zero and a real `WEBGL_lose_context` restoration:

```text
command:          node tests/transition-stage-c-regression.mjs
result:           STAGE C EXACT RESIDENCY REGRESSION PASSED
failures:         0
browser errors:   0
renderer:         ANGLE / NVIDIA GeForce GTX 980M / Direct3D11
artifact SHA-256: 27FBE982B5E18C0845AA150E34782A40D98F3046B91FD23770FBEFC2946542C9
```

The complete 34,633,388-byte artifact was inspected. Generation zero/restored maxima were 63.7/60.3 ms render and 66.7/66.6 ms rAF. Exact physical certificates were 30.2/25.1 ms with `+0/+0/+0`; house-owner certificates were 11.4/10.0 ms with `+0/+0/+0`. All 574 exact-preload transactions committed cleanly under 2.9 ms, with no cold programs or textures. Current exact coverage was 669/669 in both generations, including six named Line/Points entries. House reduced ownership was 1,498/1,498; exact ownership was 1,518/1,518 with 20 exact-only decorative members. Shader setup, texture, compile, readiness, and finalization slices were all below 14 ms and error-free. The real music-box pool, Walker, and Resident production reveal paths submitted on the default framebuffer with zero cold resource or VAO work.

This closes only the immediate Wake/current-house/house-owner lane. Cave, active Finale, gone-skull P16, target replacement, live FBO fault recovery, action edges, and district promotion still require their own short gates before the monolithic transition matrix.

### Freeze and version the release candidate

Only after transition/context performance is green:

1. Choose the candidate version and set it in **both** `package.json` and `src/main.js`.
2. Do this before the final matrix. A later version-only source edit invalidates strict same-source evidence.
3. Run static checks across all changed and untracked JS/MJS files and `git diff --check`.
4. Record the exact commit and source hashes.
5. Freeze source for the final QA matrix. Any source change after a gate requires proportional reruns; a route/renderer/shared-state change requires the broad matrix again.

### Re-earn full same-source gameplay and performance QA

Keep browser/GPU runs serial, use system Chrome with ANGLE D3D11, and perform a process-clean postflight after every lane.

Repository focused gates named by `AGENTS.md`:

```powershell
node tests/house-critical-path-regression.mjs
node tests/basement-causality-regression.mjs
node tests/backhalf-traversal-polish.mjs
node tests/underfalls-wayfinding-regression.mjs
node tests/pause-title-regression.mjs
node tests/window-relay-lifecycle-regression.mjs
node tests/dead-flight-interaction-regression.mjs
node tests/mirror-failure-regression.mjs
node tests/flame-transfer-perf-regression.mjs
node tests/transition-warmup-regression.mjs
node tests/render-perf.mjs
node tests/district-culling-regression.mjs
```

Re-run the bounded residency and identity gates from the same final versioned source as well:

```powershell
node tests/transition-stage-b-regression.mjs
node tests/transition-identity-diagnostic.mjs
```

The identity diagnostic may be formally superseded only if its exact assertions have been incorporated into a newer green harness and the documentation says so explicitly.

Run the additional affected focused/broad gates from the same frozen candidate:

```powershell
node tests/basement-foundations.mjs
node tests/choir-route-occlusion-regression.mjs
node tests/enemy-stain-regression.mjs
node tests/enemy-standing-postclear-regression.mjs
node tests/exterior-expansion.mjs
node tests/failure-state-regression.mjs
node tests/forest-hardening.mjs
node tests/forest-nervous-system-regression.mjs
node tests/grave-arena-regression.mjs
node tests/horror-expansion.mjs
node tests/house-expansion.mjs
node tests/house-return-horror-regression.mjs
node tests/perf-pool-regression.mjs
node tests/pump-release-recovery.mjs
node tests/underfalls-expansion.mjs
```

Run the four canonical merge gates exactly:

```powershell
node tests/autotest.mjs
node tests/regressions.mjs
node tests/smoke.mjs
node tests/playthrough.mjs
```

Run the complete playthrough twice from the frozen candidate. If any later source change can affect gameplay/shared state, run it again.

Use a clean unique `FETCH_PORT` for browser lanes or verify the existing server's repository root and version before reusing it. `ensureServer()` can otherwise accept a responsive stale server on the calculated port and produce false green evidence.

### Fresh visual QA from the final source

Recapture and inspect every required PNG at original resolution. Source assertions and thumbnails are not visual proof.

Required coverage:

- basement opening and retired obstruction
- visible pilot flame and alternate guest flame
- carried flame sockets and transfer
- pump, gauge, collars, and optional wheels
- furnace exterior and open aperture with unmistakable flames, cavity, and ember bed
- kennel payoff
- mausoleum before opening
- honest held-skull view of the opened 12-tread descent
- environment-only descent diagnostic
- mid-stair traversal and far 15-tread emergence
- three-rope chain and true midair transfer
- Kneeler burden/bow/pass and alternate canopy route
- complete eight-stone crossing
- Underfalls entry/current, culvert, hatch destination, shaft, chains, and Choir state
- active Finale physical and reflection states

Run the authored back-half capture suite explicitly:

```powershell
node tests/backhalf-visual-plates.mjs
```

`tests/underfalls-wayfinding-regression.mjs` produces the three current Underfalls plates. The older basement PNG set predates the true furnace shell/aperture, so recapture fresh basement/furnace plates rather than accepting those historical images.

If a plate is ambiguous, recapture it honestly. Do not move the camera into an impossible or flattering test-only pose.

### Documentation and source truth

After final QA is green, update:

- `AGENTS.md`
- `docs/HANDOFF.md`
- `docs/STATE-OF-PLAY.md`
- `docs/WALKTHROUGH.md`
- `docs/PLAYTEST-1.md`
- the release/checkpoint handoff

Keep these states separate and exact:

1. implemented source candidate
2. locally tested commit
3. deterministic package identity
4. game/source commit identity
5. site-sync commit identity
6. PR identity
7. preview identity and remote acceptance
8. production/live identity and verification

### Deterministic standalone package

From the frozen game source:

```powershell
node tools/package-netlify.mjs --output=<first-absolute-zip-path>
node tools/package-netlify.mjs --output=<second-absolute-zip-path>
Get-FileHash -Algorithm SHA256 <first-absolute-zip-path>,<second-absolute-zip-path>
node tools/verify-netlify-release.mjs --archive=<first-absolute-zip-path>
node tools/verify-netlify-release.mjs --archive=<second-absolute-zip-path>
node tests/netlify-release-integrity.mjs <first-absolute-zip-path>
```

Require equal SHA-256 hashes. Record the candidate version, source commit/hash, archive names, entry count, raw bytes, ZIP byte sizes, hashes, both verifier outputs, clean-extraction Chrome/D3D11 boot result, and the integrity-negative result. The existing integrity suite expects all seven negative cases to remain rejected. If the archives differ, diagnose determinism; do not choose the nicer hash.

### Isolated Qualiacology synchronization

Use only:

`C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-polish-site-20260810-173729`

At the last audit it was clean on branch `codex/fetch-polish-site-20260810-173729` at `51419ae74a90a5c055ad63dee1b200b14ef47351`.

Do **not** mutate or deploy from the canonical `C:\Users\Alex\Projects\qualiacology` checkout.

Rules:

- Recompute the semantic runtime sync manifest after source freeze. The last known set was 12 runtime files and included `fetch/src/atmosphere.js`; do not assume it remains exact.
- Preserve the site-owned `fetch/index.html`. It contains Qualiacology metadata, canonical/OG/Twitter tags, favicon, home-link pill, and pointer-lock integration.
- Do not copy standalone tests, tools, docs, `serve.mjs`, `package.json`, `AGENTS.md`, or standalone-only files into the public site unless the site repo explicitly requires them.
- Preserve existing catalog artwork/responsive assets unless final visual work actually changes them.

The current pre-freeze normalized semantic manifest is:

```text
fetch/src/atmosphere.js
fetch/src/audio.js
fetch/src/director.js
fetch/src/enemies.js
fetch/src/finale.js
fetch/src/house.js
fetch/src/main.js
fetch/src/mirrors.js
fetch/src/outside.js
fetch/src/skull.js
fetch/src/underfalls.js
fetch/src/world.js
```

Recompute it after Stage C and versioning; unchanged runtime/vendor files must not receive line-ending-only churn.

Run the site gates from the isolated site's `build` directory:

```powershell
Push-Location build
npm.cmd ci
npm.cmd run build
npm.cmd run validate
npm.cmd run smoke
npm.cmd run qa
Pop-Location
```

Verify `/fetch/` headers/redirects, catalog art, responsive assets, candidate version, pause/title/intruder presentation, browser console, and unrelated site routes. `build/node_modules` was absent at the preflight, so do not skip `npm.cmd ci`.

### Git, PR, preview, merge, and production verification

After game QA, deterministic packaging, site sync, and site QA are green:

1. Commit the final game candidate at a clean seam.
2. Explicitly push the game/source feature branch and open its PR with the same-source QA and deterministic-package evidence. Merge it only through the repository's normal reviewed workflow.
3. Refresh the isolated Qualiacology worktree from the latest remote `main`, recompute the sync manifest, and apply the exact runtime delta.
4. Commit site synchronization on the isolated feature branch.
5. Push it explicitly; it currently tracks `origin/main`, so use `git push -u origin codex/fetch-polish-site-20260810-173729` rather than an ambiguous bare push.
6. Open the site PR containing exact game/source and site commits, candidate version, complete QA evidence, package hashes, visual evidence, and any genuinely nonblocking limitations.
7. Wait for GitHub CI and the Git-connected Netlify Deploy Preview. Run remote acceptance against it: title/pause, full route milestones, furnace held semantics, mausoleum/ossuary, forest alternatives, eight stones, Underfalls, Finale, version/assets/headers/routes, and console cleanliness.
8. Record the preview URL and exact acceptance results.
9. If preview acceptance and required checks are genuinely green, merge through the repository's normal reviewed, Git-connected workflow under Alex's standing authorization.
10. Verify production corresponds to the merged commit.
11. Verify the live `/fetch/` route, candidate version, headers, redirects, assets, console, and critical gameplay milestones.
12. Update final release truth with exact live evidence and report every identity precisely to Alex.

Never perform a manual production deploy as a shortcut.

## 8. Static and process commands

From the game worktree, a safe PowerShell syntax gate for every changed/untracked JS/MJS file is:

```powershell
$paths = @(
  git diff --name-only --diff-filter=ACMR HEAD
  git ls-files --others --exclude-standard
) | Sort-Object -Unique | Where-Object { $_ -match '\.(?:mjs|js)$' }

foreach ($path in $paths) {
  node --check $path
  if ($LASTEXITCODE -ne 0) { throw "node --check failed: $path" }
}

git diff --check
if ($LASTEXITCODE -ne 0) { throw 'git diff --check failed' }
```

Before and after each browser lane, inspect rather than killing unknown processes. Do not run overlapping Playwright/Chrome/performance work and never count evidence contaminated by another D3D11 owner.

## 9. Storage note

The C: drive reached zero free space during Stage B test-harness writing. Safe generated material was moved—not permanently deleted—to:

`D:\Codex-Storage-Quarantine-20260811`

That recoverable quarantine contains about 10.53 GiB: CapCut generated cache, inactive Playwright profiles, and small generated residue. An earlier Playwright recovery folder also exists at `D:\Codex-Temp-Recovery-20260810`. CapCut drafts, exports, current app files, and user material were preserved. At this handoff snapshot C: had about 13.45 GiB free and D: about 147.86 GiB free. Recheck before browser work.

## 10. Working style and persistence

- This is one complete mission executed in ordered stages.
- A failing gate blocks later gates, not continued repair of that failure.
- Continue automatically after green B, C, transition, gameplay, visual, package, and site gates.
- Use checkpoint commits at clean seams and preserve red artifacts before replacing them.
- `tests/results/` and `tests/shots/` are ignored. Copy or document release-relevant artifacts before cleanup; Git will not preserve them automatically.
- Use subagents for narrow static review, test scrutiny, visual inspection, manifest verification, and documentation audit. Keep all browser/GPU work serial.
- Never weaken an acceptance threshold to make a result green.
- Do not kill unrelated processes or discard unrelated work.
- Report status in exact nouns: local source, tested commit, package, site commit, PR, preview, and live production are different facts.
- Do not call an intermediate checkpoint a release.

## 11. Completion definition

FETCH is genuinely finished only when all of the following are true:

- Stage B and Stage C performance/residency gates are green on real D3D11.
- The final versioned source is committed and frozen.
- Every affected focused gate and all four canonical gates are fresh and green from that exact source.
- Two full playthroughs complete the actual ending.
- Fresh visual plates are inspected and accepted at original resolution.
- Two independently produced standalone archives are byte-identical and verified.
- The exact runtime delta is synchronized into the isolated Qualiacology branch without overwriting the site shell.
- Site build, validation, route smoke, browser/axe QA, and remote preview acceptance are green.
- Required PR checks and the Git-connected Deploy Preview are green and accepted against the exact candidate.
- The candidate is merged through the normal repository workflow and the live `/fetch/` route is verified for version, headers, routes, assets, console, and critical gameplay.

Until then, describe it as the precise state it has actually reached.

## 12. One-line continuation instruction

If another task must resume this work, use:

> Continue and finish FETCH from `C:\Users\Alex\Documents\Codex\2026-08-09\mak\work\fetch-polish-20260810\docs\NEXT-THREAD-2026-08-11.md`. Treat the ledger as a fallible audit checklist, verify every inherited claim, use independent judgment, preserve the evidence trail, and continue through final QA, deterministic packaging, PR, preview, normal merge, and verified live `/fetch/`; stop only for a genuine external blocker.
