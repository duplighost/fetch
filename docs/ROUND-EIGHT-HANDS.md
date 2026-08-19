# ROUND EIGHT — THE HANDS. MAKE THEM HUMAN. BREAK NOTHING.

**Read this first when Alex says "fetch."** Written 2026-08-18 by the previous
thread (Fable 5), against the tree at `claude/aug18-round7-look`, for the next
thread (Opus 5). It supersedes `ROUND-SEVEN-PLAN.md` as the entry point; the
laws in `ROUND-SEVEN-LOOK.md` all still bind, and `ROUND-SEVEN.md` is the
record of what just shipped.

**Every number and line citation in this document was re-verified on the final
tree (commit `841267e`) after the deploy, same day:** the full ten-gate suite
fresh-run green; site `fetch/src` 22/22 byte-identical to this branch;
production serving round seven (grain + car-Lambert markers confirmed by
fetch); AABB, sweep, bone-hands and viewmodel-light probes re-measured; the
hitch walk re-run; and the open items below re-probed rather than carried on
faith. Trust these numbers over any earlier log in `tests/results/r7/`.

---

## Where the game is

**Round seven — the graphics pass — is LIVE.** Site PR #74 merged to
qualiacology.com (main `01a8ab6`), production boot-checked green. The
graveyard, car, mausoleums, bodies, arrival, screen grain/vignette/dither and
a first hands pass all landed. The record, with every number, is
`docs/ROUND-SEVEN.md`.

- **Work here:** `C:\Users\Alex\Projects\fetch-aug18-round7`, branch
  `claude/aug18-round7-look`. Ten commits, **NOT pushed to the game repo**
  (`duplighost/fetch`) — only the shelled `src/` copy went to the site, which
  is the normal split. Pushing the game branch is Alex's call; if he wants a
  new round on top, stack a worktree on this branch the same way this one was
  stacked on round six.
- **Deploying:** the recipe in `ROUND-SEVEN-LOOK.md` §Deploying is current and
  was just exercised: copy changed `src/` files (LF) into
  `C:\Users\Alex\Projects\qualiacology\fetch\src\`, verify all 22
  byte-identical, `build-site` + `validate-site` + `browser-qa` +
  `fetch-boot-check` against a local serve, feature branch, PR, boot-check the
  Netlify preview, **his approval**, merge, boot-check production. Never
  deploy from the game repo. Site `index.html` is its own shell — port game
  `index.html` changes by hand (round seven had none).
- **His verdict on round seven has not arrived.** He deployed it without
  playing it. Expect notes; his notes outrank this document.

**Open items that are NOT this round unless he says so** (carry the list, do
not silently adopt any of it — each was RE-PROBED on the final tree, so the
descriptions below are current, not inherited):
- **A ~7-8 second frame on first entry past the house** — and note the
  attribution FLOATS: one hitch walk pins it on `enter:basement` (+191
  geometries), the next on `enter:graveyard` (+46), always with ZERO shader
  compiles. Same disease either way — a first-touch geometry/buffer upload
  burst — and pre-existing (6.4 s on the untouched round-six tree). The real
  "loading freezes" complaint, cause attached, unclaimed. `probe-hitch.mjs`
  reproduces it in one run.
- **`tests/playthrough.mjs` is non-deterministic** — failed twice in one
  ten-minute window on an unchanged tree; green on every run since (6+ on
  this tree, 4/4 on the baseline). One of the four basement dropcloths spawns
  as a real walker from `Math.random()`, right on the failing route. If it
  reds on a commit that couldn't have caused it, re-run before reverting, and
  suspect this first.
- **The graveyard key-under-the-tree reveal.** Re-probed: the MECHANISM
  passes clean (`probe-key-tree.mjs`: one hit on the branch → key and bones
  drop, the fetch retrieves it, `gotgateKey3` sets). So the open item is
  purely LEGIBILITY — he opened the latch and never SAW the reveal happen.
  Measure the reveal (view-cone integral, luminance ratio vs the ground it
  lands on), don't re-fix the working mechanism. NEW, found while re-probing:
  the probe's final pose — under the tree, pitched up into the canopy —
  renders **~582 draws** (593 pre-round-seven), over the 450 ceiling at a
  pose the 14-frame set never covers. Pre-existing, unclaimed; if a future
  round takes it, start attribution at the canopy and the sky pass.
- The cave sound failure (if he hits it, ask for
  `__game.audio.voiceStats()`); the cave back wall "you can go through a
  bit" — still unexamined.
- Known permanently-red gates, do not chase: `underfalls-expansion` ×2,
  `grave-arena-regression` ×1 (seeds 145/583).

---

## The job: the hands

His last words on them: *"the hands are at least on the right angle now. they
still don't look like human hands though."* Round seven then slimmed and
tapered the fingers, broke the even spacing/yaw, varied the knuckles, and
freed ~60 geometries doing it. That helped — open `scratch-hands/` next to
`scratch-hands-before/` and see — but he has not called them human yet.

**The standard is his sentence, not a number: when he says they look human,
STOP.** Proportions are taste. Budget one shot session per change, open the
PNGs, and put the pairs side by side with his reference.

**The reference image: ask him to post it if it is not in the thread.** It is
an AI render of the game's own opening bedroom — both hands cradling the
skull, weathered skin, veins, dirt, fingers up the sides of the cranium.
`tools/shot-grip.mjs` shoots the exact matching pose. Save his post to
`scratch-hands/reference.png` (scratch dirs are gitignored) so you can diff
against it all round. **There is no reference image checked into the repo** —
a chat-mode brief claimed `reference/hands_ref.png` exists; it does not.

---

## THE CONTRACT — what the hands are wired into. Violate nothing here.

The hands are not a viewmodel decoration. They are load-bearing across the
whole game, and each of these is asserted by a tool or a playthrough beat:

1. **They are two rigs in one.** Every finger carries flesh meshes AND a bone
   twin (phalanx shafts, condyles, metacarpals, carpal block) inside the SAME
   `k1`/`k2` groups, bones hidden until the last room. `becomeBone(boneMat)`
   (`skull.js:887`) retints `_handSkin.{skin,crease,nail}` to the skull's own
   bone colour, copies the skull's map/bump onto the bone mats, hides
   `_handFlesh`, shows `_handBone`. The playthrough beat
   `the-hands-were-bone-all-along` compares skin hex to bone hex — **the
   ending of the game lives in this function.** Any new flesh mesh must
   register via `fleshy()`, any new bone via `bony()`, or the reveal strands
   it.
2. **The animation contract.** `_fingers[]` entries keep `.k1` (Group), `.k2`
   (Group), `.phase`, `.thumb`. `update()` ASSIGNS `k1.rotation.x` /
   `k2.rotation.x` every frame (`skull.js:825-826`) — grip curl, threat
   tremble, graveyard fear, idle micro-life. Static droop/roll must be baked
   into MESH transforms inside the groups, never onto the groups.
3. **The hands go DOWN and come back.** Pose blends held↔empty via
   `_applyHandPose(t, g)`; when mode is `'gone'` they sink out of frame
   (`goneBlend`), and `raiseHands(seconds)` lifts them for authored beats
   (the finale shows you your empty hands). The finale also captures and
   restores them directly: `hold.children[0]` and `[1]` MUST remain the two
   hands (`finale.js:883-884`).
4. **Everything exists by end of constructor.** `setLayers` runs once
   (`main.js:195`) to put the rig on LAYER_HELD; a mesh added later never
   joins the held pass.
5. **Geometry is shared.** One capsule (`FSEG`), one ball (`FBALL`), one box
   for nails, three bone primitives — scaled per mesh. Mirror act sits at
   ~1377-1378/1500 (drifts ±1 between runs); round seven's commit asserts the
   count went down. Do not un-share.
6. **The measured gates** (all re-verified on the final tree). `probe-grip-
   clip.mjs`: hand AABB must stay ≤ 0.245 × 0.441 × 0.193 in hold space
   (currently 0.241 × 0.439 × 0.190). `shot-grip-sweep.mjs`: ~zero % buried
   in the skull (current worst 0.2%; it mutates the live cradle while it
   runs, but every tool boots its own browser, so this only matters if you
   drive sweep and grip inside one page — separate invocations are safe in
   any order). `shot-bone-hands.mjs`: fingers grow +Z, curl +Y (`dorsalZ >
   0.6 && fingersY > 0.5`), the bone twin must sit inside the flesh, and
   **the mirrors must not see the viewmodel**. `probe-viewmodel-light.mjs`:
   the cradle's calibrated lamps.
7. **The render path.** There is no separate viewmodel camera: `render()`
   runs the ONE camera twice — layer 0 for the world, depth cleared, then
   LAYER_HELD for the cradle, which is lit by its own three lamps
   (`holdLight`, `holdFillLight`, `holdRimLight`, `main.js:226-243`) because
   the 58-cd skull lantern at point-blank was bleaching every finger white.
8. **Forearms are load-bearing story.** The sleeves running off the bottom
   corners exist because of playtest 2 ("hands making glasses around its
   eyes") — the hands must read as YOURS. Keep wrists exiting frame.

---

## The chat-mode brief: what to keep, what would break the game

Alex received a hands brief from a chat instance that had never seen this
codebase. Its **visual instincts are good and are adopted below**. Its
**implementation orders would break the game** and are overruled. Be specific
with him if asked why.

**ADOPT (translated into this rig):**
- *The grip is the model; the skull occludes the palms.* Already this rig's
  architecture — palms are simple spheres because the skull hides them. Keep
  spending polygons only where the camera looks.
- *Contact is what sells holding.* Its single best note. See lever 2 below.
- *Knuckles/fingertips form arcs, not lines; hands are not perfect mirrors.*
  Partially done in round seven (per-finger scale, yaw, droop, knuckle
  prominence, mirrored asymmetrically). Push further per lever 3.
- *Value hierarchy: skull brightest, hands one-two stops darker.* Already
  measured true (probe-clip-owner: the skull owns the frame's clip). Preserve.
- *The empty hands get the same care.* Correct and already sacred — the empty
  pose is "the pose he says already works," and the ending shows it to you.
- *Silhouette-first judging.* This project's own law: open the PNGs.

**OVERRULED, with reasons you can repeat:**
- *"The old hands are dead; build new from this spec."* The old hands are the
  ending of the game (contract #1-3). A from-scratch rig that does not
  rebuild the bone twin inside the same groups, the pose blends, the sink,
  the raise, and the finale's capture breaks beats the playthrough asserts.
  Round seven already proved the productive path: **reproportion the rig that
  works, under its gates.**
- *"Source a CC0 GLB hand model."* This game ships zero asset files by law —
  every surface is painted at boot, there is no build step, and the vendored
  three r161 has no GLTF pipeline wired. Also: the bone twin, the AABB gate,
  and the 123-geometry headroom all say no.
- *"Layered sprite fallback (the Doom move)."* Kills the bone reveal, the
  threat tremble, the pose blends, the sink/raise, and the lighting the
  cradle lamps do. A sprite cannot become a skeleton.
- *"Metaballs/MarchingCubes."* The addon is not vendored; verify before even
  considering. Baked-once fields could fit the budget, but the bone twin must
  nest inside whatever flesh exists, and smooth blobs make that seat
  unverifiable. Not worth it this round.
- *"Dedicated 45° viewmodel camera is non-negotiable."* There is no second
  camera (contract #7) — the held pass reuses the main camera with depth
  cleared, and mirror cameras key programs off MASK_DOUBLE. Adding a
  narrow-FOV pass is a real architecture change that re-calibrates every
  measured pose and probe. If perspective distortion on the hands is ever the
  actual complaint, raise it with Alex as its own project; do not smuggle it
  into a look round.
- *"Skin ~#8a6a55, roughness 0.55-0.7."* That is the exact disease round
  seven just cured three times: mid-roughness MeshStandard under a close lamp
  wears a fixed-F0 specular sheen no albedo can remove (79% of the pale on
  the dead survived a pure-black albedo). Lighter+glossier skin is how the
  hands become wax. Current skin is 0x452e28 at roughness 0.97 —
  if anything, test the OPPOSITE direction (lever 1).
- *"Cylinder/box construction is banned."* The current rig is shared capsules
  and spheres with elliptical cross-sections, and it passed every gate while
  freeing sixty geometries. The failure was proportion and evenness, not
  primitive choice — and most of that was fixed last round.

---

## The levers, ranked — measured cost, measured risk

Shoot `tools/shot-grip.mjs` FIRST (clean reboot) as the round's before-set.
One lever per commit. Full suite after every commit. Revert what does not
move the PNG toward the reference.

**1. Skin that is skin, not rubber.** The single biggest remaining gap vs the
reference: his hands are weathered — knuckle creases, tendon lines, colour
variation, dirt. Every FETCH surface is a boot-painted canvas, so this is a
`textures.js` painter (256² is plenty) applied to the skin/crease materials.
**Traps, all three:** (a) adding a `map` where none existed flips `USE_MAP` —
new program; safe because the hands exist at constructor time and the warm
pass compiles the whole scene, but the warm-start gate + a `?hitch=1` walk
are non-negotiable after. (b) CapsuleGeometry HAS uvs, but every segment
shares FSEG — the same texture wraps every finger segment; paint accordingly
(generic knuckle-band + grain, not landmarks). (c) `becomeBone` retints these
materials and copies the SKULL's map over the bone mats — read it before and
after, and re-run the playthrough for `the-hands-were-bone-all-along`. Also
probe the specular while in there: if the hand skin shows the F0 sheen under
the cradle lamps (adapt `probe-body-specular.mjs`), the skin wants Lambert —
but then `becomeBone`'s `skin.roughness = ...` line needs a matching edit;
Lambert has no roughness.

**2. Contact darkening where fingertips meet bone.** The chat brief's best
idea, and this rig can do it for near-nothing: flattened `FBALL` instances in
the existing `crease` material (or a darker clone made at boot), tucked at
each distal pad's contact line inside the `d` group. Shared geometry (zero
new), registered `fleshy()`, a handful of held-pass draws. It reads as the
shadow of a grip because that is what it is. Check the sweep still measures
~zero buried and the AABB has not grown.

**3. The arcs.** Knuckle line and fingertip line should each read as an arc
(index high, pinky low), never a row. The root `y` values and per-finger
scales in `mkHand` already vary; tune the root-Y arc a millimetre or two and
re-check the silhouette against the reference. Free, constructor-only.

**4. Cradle-pose flatness.** In the reference the fingers lie nearly straight
along the cranium. `update()` already flattens the held pose via `held01`
(`skull.js:824-826`); the rest-bend constants there are look-only and were
tuned by eye once before. Small moves, re-shoot, re-sweep — flatter fingers
sit closer to the bone and the buried% gate is the guardrail.

**5. The cradle lamps.** Warm key / cool fill / rim already exist as three
LAYER_HELD lights. Colour and intensity changes are census-safe. If the hands
read flat or waxy after lever 1, shape the light before touching geometry
again — `probe-viewmodel-light.mjs` prints the balance.

**6. Micro-asymmetry between the hands.** A few degrees of baked global
offset between L and R (mesh/root transforms, not the groups). Cheap; verify
with `shot-bone-hands.mjs` orientation asserts and the sweep.

The chat brief's anatomy numbers (segment ratios 1 : 0.65 : 0.45, MCP 30-45° /
PIP 45-60° / DIP 20-30°, nails as the top third of the distal) are reasonable
*taste candidates* to test against the reference — current rig is
1 : 0.8 : 0.53 with a gentler curl because the reference's fingers are
near-straight on the cranium. The PNG next to his image decides, not either
document.

---

## The loop and the gates (unchanged, and they are the whole safety story)

```
edit → node tools/shot-grip.mjs   (clean reboot first if the sweep ran)
     → OPEN THE PNGS next to the reference   → not closer? revert now.
     → probe-grip-clip / shot-grip-sweep / shot-bone-hands / probe-viewmodel-light
     → full suite, output redirected to files, never piped through tail/grep:
       smoke, autotest, regressions, playthrough (COMPLETE), warm-start,
       basin-shore, choir-surfacing, district-culling, render-perf
     → any red that is not the two known pre-existing failures? re-run
       playthrough once (it flakes), then revert, re-think.
     → commit small; message says what changed IN THE FRAME
```

After any material/map change: warm-start gate plus a `?hitch=1` walk, and
re-run the playthrough specifically for the bone-reveal beat.

Measurement law, learned the hard way this round: **any tool that reads
pixels must render until two consecutive frames are byte-identical before
measuring** — `render()` decays fovKick and the impact light every call.
Every tool in `tools/` from round seven already settles; copy one.

---

## The standing brief

He funds this generously, plays live, wants ambition, forgives rough but not
broken. **When he repeats himself it is because we did not do it the first
time** — he has now said the hands twice. He is colourblind: value, shape,
motion, never hue. No HUD, no words, no control theft; copy is his voice.
Raid his other games (`C:\Users\Alex\Projects\`) before writing anything
fresh. And an object is never finished; a frame is — when he says the hands
look human, stop, even if you can see one more improvement.
