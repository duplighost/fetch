# ROUND EIGHT — THE HANDS. The record.

Written 2026-08-18 by Opus 5, against `claude/aug18-round7-look`, four commits
on top of round seven (`d0c0698` → `6b79a01`). `ROUND-EIGHT-HANDS.md` was the
brief; this is what happened. **Not pushed, not deployed** — the game branch
stays where round seven left it until Alex says otherwise.

His standard was one sentence: *when he says the hands look human, stop.* He
has not seen these yet. Before/after: `scratch-hands/R8-before-after.png` and
`-down.png`; full sets in `scratch-hands-r8-before/` (round seven) and
`scratch-hands-r8-c4/` (now).

---

## The brief's ranking was wrong, and the measurement says why

`ROUND-EIGHT-HANDS.md` ranked skin painting first and contact darkening
second. Both were real, and both are in — but neither was the biggest gap, and
the reason nobody had found the biggest gap is that nobody had measured it.

**His sentence was literal.** *"It doesn't look like he's holding the skull"* —
because he is not. `tools/probe-grip-contact.mjs` walks every finger to the
nearest bone and the round-seven cradle came back **12 to 70 mm out, mean 38**.
A finger's length of air between the hands and the thing they hold. Three
rounds had read that sentence as an orientation bug and turned the hands over,
rolled them, re-aimed them.

**The old gate certified the float.** `shot-grip-sweep.mjs` scores a candidate
on the percentage of hand vertices inside *an ellipsoid inscribed in the
skull's AABB*. That box is tall because the jaw hangs off the bottom, so the
inscribed ellipsoid pinches in exactly where the fingers pass. **Zero buried
against it is compatible with floating in mid air**, and for three rounds that
is what it said. Any future gate on this rig has to measure against the skull's
own surface, which is what `sweep-grip-contact.mjs` and
`tests/grip-contact-regression.mjs` now do.

The general lesson, which is this project's own law arriving somewhere new:
**when he describes what he sees, measure the thing he described.** Not the
thing you assume causes it.

---

## What landed, in order

**1. `7b98579` The fingers stop being beads on a string.**
`probe-finger-profile.mjs` prints the silhouette half-width along a finger and
the answer was in one column: the proximal capsule ENDED at 0.045 s and the
middle one BEGAN at 0.046 s — butted end to end, never overlapping — so every
joint had a waist, and the only thing hiding the seam was a knuckle ball **33%
wider than the shaft**. Capsule, bead, capsule, bead, capsule: a wooden
artist's mannequin.
Segments now interpenetrate by about a third of their length (free — hidden
geometry costs nothing and a silhouette that cannot pinch cannot bead), the
knuckles swell 12% and keep the shaft's own elliptical cross-section, and the
PIP knuckle — the one that actually shows on a curled finger — exists for the
first time.
**And the fingernails were on the palm.** Fingers curl toward local +y, so +y
is the palm side, and the nails had been sitting on it face-down against the
skull for the whole game. Dorsal now, and visible. (Note `shot-bone-hands.mjs`
calls +y "the DORSUM" in its comment — that label is wrong; its assertions are
about the finale's roll and are unaffected.)

**2. `6b7a2d0` The hands touch the skull.** Seat `0.156/-0.118/0.122` →
`0.124/-0.118/0.100`; the aim barely moved. Mean fingertip gap **38.3 → 10.4
mm**, five of eight fingers within 6 mm, two under 1.5. Thumbs tucked back and
swung less far across — aimed at a cradle 32 mm wider than this one they met in
the middle and crossed the jaw as a pair of blobs under the chin.
Two findings from the sweep worth keeping: the gap was mostly in **Z** (seated
at z 0.122 against a skull whose front face is at 0.117, the hands were never
beside the skull, they were in front of it reaching back); and the fingers must
**splay very slightly outward** as they rise, because the cranium widens toward
the brow — every inward lean drove the fingertips through the eye sockets
(10–20% buried, 20 mm deep) on the way to closing the gap. More curl is not the
answer either: it hooks the tips over the cheekbone and reads as clutching a
face.

**3. `13c3372` The hand stops being a mitten.** Calibrating off the skull (0.166
wide in hold space, a human cranium ~145 mm → **1 hold unit = 874 mm**, and
every number in `mkHand` can now be checked against a hand), the palm measured
**116 mm across and 52 mm thick**. A real one is 90 × 28. Thickness is what
decides whether the thing at the bottom of the screen is a hand or a sock with
fingers sewn on. Palm 94 × 33 × 111, wrist 63 × 26, cuff in to match.
Free extras: the finger fan came down by a third (19° of spread let the room
show through between every pair, and four separated tubes read as a rake), and
the fingertip pads took the `crease` colour — the pad is the one part pressed
against bone and a pressed pad is in its own shadow. That is the chat brief's
contact darkening, and on this rig it costs **nothing**: the mesh and the
material both already existed.

**4. `6b79a01` Skin that has been somewhere.** The hands were the last flat
materials in a game where every surface is a boot-painted canvas. `skinPaint`
in `textures.js`: mottle, transverse creases in two dense bands at the joints,
clustered pores, dry nicks, grain. It **multiplies** rather than replaces —
authored around white, pulled to mean 0.85, both hand colours lifted by the
reciprocal — so round seven's value work survives intact. It is the `bumpMap`
too, which is the point.

---

## Two things the skin pass cost a rewrite to learn

**SCALE.** One capsule serves every phalanx, so the whole 256² sheet wraps ONE
finger segment — about **forty screen pixels** of it at cradle distance.
Anything finer than ~8 px in the sheet is gone to the mip chain before the
player sees it. The first pass painted hairline creases and one-pixel pores at
**1.39× contrast** and came back invisible on the hands. `tools/shot-texture.mjs`
writes any boot-painted sheet out as a PNG with its histogram — use it before
concluding a painter is fine. Second pass: coarse, dark, **2.15×**.

**DIRECTION.** That pass also had three longitudinal veins, and they were the
only feature that came back *wrong* rather than weak. One sheet serves capsules
and spheres both: a line that runs helpfully down a phalanx runs across the
palm as a smear, and the render read as woodgrain. Everything but the rings is
isotropic now. **Anything directional has to survive being wrapped on geometry
it was not aimed at.**

---

## New tools and gates

- **`tests/grip-contact-regression.mjs`** — the gate that says whether the hands
  still hold anything. Mean finger gap, a count that actually touch, burial
  against the skull's own star-shaped surface, at **both growth stages**
  (`setStage(0)` is the bare cranium of the opening bedroom, `setStage(5)` adds
  cheekbones and jaw), plus the hand AABB envelope. Add it to the standard run.
- `tools/probe-grip-contact.mjs` — per-finger distance to bone, in millimetres.
- `tools/sweep-grip-contact.mjs` — seat/aim candidates scored on gap AND burial,
  per stage, with a PNG each. Aims by finger-direction and palm-normal vectors
  and solves the Euler, so candidates are describable.
- `tools/probe-finger-profile.mjs` — silhouette half-width along a finger.
- `tools/shot-texture.mjs` — write a boot-painted texture out with its histogram.
- `tools/crop.mjs`, `tools/compare.mjs` — cut and pair frames. At 1280×800 a
  knuckle is four pixels; this project judges by opening the PNGs and there was
  no way to open them close enough.

## Gates

All green on every commit: smoke, autotest 26, regressions 157,
**grip-contact**, playthrough COMPLETE, warm-start, basin-shore,
choir-surfacing, district-culling **434/450**, render-perf, grip-clip,
bone-hands (`dorsalZ 0.951 / fingersY 0.904`, mirrors still blind to the
viewmodel). After the map change: warm-start reports **40/40 textures uploaded
and 256 → 256 programs**, and a `?hitch=1` walk shows **0 ms of stall
attributable to shader compiles** across the whole game.

**A SECOND KNOWN FLAKE, alongside playthrough.** `warm-start-regression`'s check
*"the press is answered on the title in the same task, before any warm work"*
went red once and green on two immediate re-runs. It reads the title state over
a **separate CDP round-trip** after `page.mouse.click`, so it is racing the
window between the press being acknowledged and the warm work finishing — and
that window closes early on a loaded machine. Re-run before suspecting a
commit. Not a game defect.

## Still open — not this round

Everything `ROUND-EIGHT-HANDS.md` carried is still carried, unchanged: the
7–8 second first-entry frame (this round's hitch walk measured **8558 ms across
20 frames with ZERO shader compiles** — first-touch geometry upload, exactly as
described, and still nobody's round); playthrough's non-determinism; the
graveyard key-under-the-tree **legibility** (the mechanism passes clean) and the
~582-draw canopy pose behind it; the cave sound failure; the cave back wall.
Known permanently-red: `underfalls-expansion` ×2, `grave-arena-regression` ×1.

And on the hands specifically, if he wants more: the back of the hand still has
no tendon structure (four dorsal ridges per hand would be ~8 draws against 16
of headroom, and at this camera distance they would be ~2 px of relief, so the
honest version is more bump in the sheet, not more meshes); the knuckle line and
fingertip line could be tuned into arcs (`rootArc` in `mkHand`, free); and the
cradle lamps have not been touched (`probe-viewmodel-light.mjs` prints the
balance).

**HE IS NOT COLORBLIND.** He said so directly this session. Earlier notes across
this project asserted it from one hedged aside, and it was wrong. The
value-first design law stands on its own merits — these are dark rooms lit by
one carried light, where a hue difference at 20 lux is no difference — but stop
citing a reason that is not true.

---

# ADDENDUM, same day: THE SKINNED REBUILD (commit `1ab6a2f`)

Alex posted the reference image and his verdict on the capsule hands: *"These
are definitely not human hands holding a skull"* — and the diagnosis that
mattered: *"we keep just making hands that have all these weird giant joints
and balls that don't look like hands."*

That sentence named the disease structurally. We were **assembling** hands out
of separate solids, and an assembly of solids cannot stop reading as an
assembly of solids: every capsule shades as its own tube, and every knuckle
ball exists to hide the seam between two capsules — the balls ARE the
seam-hiding, which is why the joints kept inflating across four rounds of
tuning. Everything earlier in this document (contact, proportions, texture)
was real and survives; it had just hit the ceiling of primitive assembly.

**The rebuild: one continuous skin per hand.** A procedural BufferGeometry —
tapered elliptical tube per finger, sculpted palm blob — skinned to the SAME
rig, because `THREE.Bone` is a plain Object3D, so **k1/k2 ARE the bones** and
the whole animation contract (update()'s assignments, pose blends, sink/raise,
finale capture, becomeBone's twin as plain children of the same bones)
survives verbatim. Zero assets, no build step, core three r161.

Landed knowledge, for whoever touches this next:

- **Bind-pose trap:** anything set on the bones BEFORE `Skeleton` creation is
  bind pose and cancels out of the flesh (the thumb's scale is authored this
  way on purpose — flesh girth comes from `rf` instead, while the nail and
  twin, plain children, still inherit the scale like the old rig).
- **Measurement trap:** a SkinnedMesh's raw `position` attribute is the BIND
  pose. Every vertex-reading tool now goes through `applyBoneTransform` (reads
  live bone matrixWorlds; no render needed) and groups per-finger via
  `skinIndex` + `userData.fingerOfBone`. Updated: grip-contact-regression,
  probe-grip-contact, sweep-grip-contact, shot-grip-sweep,
  probe-finger-profile (which also STRAIGHTENS the fingers first — binning a
  curled finger along a straight axis prints phantom beads).
- **Texture-v trap:** the sheet's crease bands tile every 1.0 of v, so the
  ring stations author v explicitly to pin the bands ON the hinges;
  free-running v wrapped every finger in seven bands like a bandage.
- **His live note, mid-build:** the flat-ellipsoid palm read as "a flat circle
  instead of the palm part of a hand" — the blob is now domed toward the
  knuckles and tapered into the wrist. A palm is not a disc.
- **Budget:** flesh went ~56 draws → 2 per hand; worst district pose
  **434 → 370** against the 450 ceiling. One new shader variant (skinning),
  compiled by the warm pass; every district still enters at +0 programs.
- His glove/electric-shock idea (a diegetic excuse for non-human hands) is
  parked, his own preference: it would dilute the bare-hands bone reveal. A
  lighter version — the first catch SCARS the hands — remains a free texture
  beat if he ever wants it.

All thirteen gates green. Before/afters: `scratch-hands/R9-vs-live.png`
(production vs branch) and `R9-vs-r8.png` (capsule vs skin).

---

# ADDENDUM 2 (2026-08-19, commit `5fdf1d6`): his two live notes on the skinned hands

He called the rebuild "likely a huge improvement" and gave two notes from the
frames, both landed:

1. **"An odd little square thing sticking out."** The NAILS — flat BLOCK chips
   sized for the old capsule fingertips, corners standing off the curved
   skinned tube; the thumbs' sat visible under the skull. His call: ditch
   them. Deleted, all ten. If nails ever return they are a painted patch in
   the skin sheet, never geometry.
2. **"Are those black boxes under the hands supposed to be sleeves?"** Yes —
   and they are load-bearing story (playtest 2: without arms rooted off the
   bottom of the frame, the hands read as the SKULL's own). Fixed as cloth:
   curtain-sheet folds + lifted base on the sleeve, open-ended DoubleSide
   tubes (a capped cylinder shows its end disc as a flat dark polygon), and a
   further-lifted clone for the FOREARMS, which sit outside the cradle lamps'
   reach and can never be lit — their value is baked in. `probe-black-quad.mjs`
   is the method: toggle parts in a fixed pose instead of guessing; it also
   proved the remaining dark wedge in the steep-down pose is the bedroom
   desk's unlit side (world furniture, same as production, not the arms).

Warm pass now uploads 41 textures (the forearm cloth clone). All gates green.

---

# DEPLOYED (2026-08-19): site PR #75 MERGED

The hands round is LIVE. Site PR
[#75](https://github.com/duplighost/qualiacology/pull/75) squash-merged to
main `0e8c94a`; qualiacology.com/fetch/ serves it and **production
fetch-boot-check PASSED** (world lit, skull visible in hand 44% lit-frac, zero
errors). Two files shipped: `fetch/src/skull.js`, `fetch/src/textures.js` —
22/22 src files byte-identical to this branch at `85a590e`.

Deploy notes for the next thread:
- The PR's `static-site` CI run sat in GitHub's runner queue 30+ minutes
  (Actions API also 500'd on cancel — GitHub-side degradation). Merged on
  local + preview evidence; the MERGE push's own run then completed green in
  18 s, so the workflow did validate main. A queued run means no machine ever
  looked at the code — do not read it as failure.
- Alex mentioned he accidentally asked ANOTHER thread to deploy first and
  stopped it. Audited before merging: origin/main untouched, no stray
  branches/PRs, game worktree clean. The stop worked; nothing raced us.
- **The game branch `claude/aug18-round7-look` is still NOT pushed** to
  duplighost/fetch — eleven commits live only in this worktree. Normal split,
  but the deployed site now runs code whose only git home is this machine.
