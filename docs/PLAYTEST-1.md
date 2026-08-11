# Playtest ledger — current 2026-08-10 polish candidate

This is the human-readability queue, not a release ledger. `docs/WALKTHROUGH.md`
owns the exact spoiler route and optionality; the newest `docs/HANDOFF.md`
section owns test/package/preview/production evidence.

The route the candidate must make readable is:

```text
ring servant bell
  -> take the guest flame now or later
ring bell + break all 3 boards
  -> open cellar -> alternate basement pilot flame
either flame + pump latched by one continuous hold/cross
  -> open furnace -> hold the skull through refusal -> ash key -> hatch
```

## Alex's current reports and candidate response

- [CANDIDATE] **“That door still looks blocked, even once you open it.”**
  Detached boards now clatter briefly and retire completely. The released bell
  bolt and rings fold into jamb sleeves, and the open-door collider drops out of
  the player throat. Final original-resolution doorway plate and final frozen-
  source regression rerun are still required.
- [CANDIDATE] **“There was never any fire… somehow this time the key came out.”**
  The basement pilot is raised above the stair guard, moves against a reflector,
  has an open cage center, and owns a physical conduit toward the furnace. One
  outbound hit transfers fire visibly into two carried socket flames. The open,
  drafted furnace now fills a real cavity with five large moving flames; one
  continuously held offer owns burn → choke → backdraft → pan kick → key. Early
  release or death rearms it, so neither waiting nor a second random throw can
  mint the key. The fresh final pilot/furnace plates remain a release blocker.
- [CANDIDATE] **The cage, floating wheel, and back-room machinery did not explain
  themselves.** The required pump wheel now has a grounded frame/bearings/feet,
  a sweeping pressure gauge, and travelling pressure collars that answer at the
  furnace. Archive wheels answer locally but remain explicitly optional; the
  kennel/cage remains an optional local secret and does not feed the hatch key.
- [CANDIDATE] **The graveyard ending was disorienting and felt like a teleport
  past the gate.** The opened mausoleum now owns a real terrain aperture and
  twelve-tread descent. The solved ossuary ends in a separate fifteen-tread rise
  to a hatch beyond the gate. View, movement, backtracking, and skull state stay
  live across both seams.
- [CANDIDATE] **The huge forest enemy had no readable answer.** A high-value
  burden with three prongs and a ring is now the ground target. One outbound hit
  produces a full-body bow and a usable pass window; the Kneeler remains
  immortal. A three-knot canopy route crosses over and beyond it as an alternate.
- [CANDIDATE] **“It would be really cool if you could swing from rope to rope.”**
  The three knots use real press/hold/release at every stage. The player can land
  on the marked recovery shelves or catch and rethrow while still airborne; the
  route never auto-grabs the next knot.
- [CANDIDATE] **The water needed one nearer stone.** The bridge now has eight
  stones. The new first stone begins near the dry lip and gains collision only
  when its visible rise clears the same threshold.
- [CANDIDATE] **Underfalls felt odd and hard to read.** A bright animated calcite
  current points along the required route; five dark crosswise slates distinguish
  the optional dry culvert; a distant vertical shaft/ring marks the real hatch.
  All are wordless, non-colliding, non-interactive, and progression-neutral.
- [IN FINAL GPU QA] **New areas froze or slowed for several seconds.** Act-aware
  program/texture/FBO preparation, fixed light signatures, current-act physical
  residency, preallocated flame/impact resources, and fail-closed mirror recovery
  are implemented. This
  item is not closed until the full serial D3D11 transition/context-loss matrix
  passes on the frozen source with bounded frames and zero first-visible resource
  growth.
- [PRESERVED FROM `0.5.0-intruder`] **Pause, better title/thumbnail, and the thing
  crawling through the scullery window.** Escape/P and the pointer-lock fallback
  button pause simulation and WebAudio; the content-addressed intruder key art
  remains; the watched figure advances through the window and recoils before
  overlap. These are existing production features, not proof that this newer
  polish candidate has shipped.

## Current closure rule

No item above is a release-level **DONE** until the current source is frozen,
the focused tests and four canonical gates pass serially, the human-review plates
are inspected at original resolution, a deterministic clean-booted package is
recorded, and the separately shelled Qualiacology preview and production route
are each verified. See `docs/HANDOFF.md` for the exact remaining placeholders.

---

# Historical playtest 1 — Alex, 2026-08-07 (house section)

The labels in this archived section describe that 2026-08-07 pass; they do not
override the current candidate statuses above.

The first human playthrough. Machine verification got every door open;
this list is about what it FEELS like. Items marked NOW are fixed in this
pass; PHASE-2 items are the art/feel overhaul (next major work).

## The skull (the whole game lives here)

- [NOW] **More control.** Alex: "keep it stopped and then zip it back…
  aim it a little while it's far away." → new POISED verb: hold RMB in
  flight and the skull brakes and HANGS there; keeps hanging after release;
  hold RMB again to drift it toward your aim; tap RMB/E to zip it home.
  Auto-return windows lengthened so uncalled throws linger.
- [NOW] Flight facing: it faces YOU while returning and while poised.
- [NOW] Key-grab moment: jaw-clamp animation, spin flourish, hit-pause,
  brighter chime — grabbing must read through sound + visuals + motion.
- [NOW] Bounce audio wreckage: SFX cooldown + a pinball-guard (3 bounces
  in 0.4s = come home) so ricochets can't max out and crater the mix.
- [PHASE-2] **The skull looks terrible.** Needs a real sculpt: proper
  cranium/brow/zygomatic/mandible silhouette, realistic bone shading,
  reads as a SKULL at a glance, ultra-real bar. This is the single most
  important art task in the game.
- [PHASE-2] Held sounds must visibly come FROM it (jaw sync on every
  chatter/moan, micro-motion when it vocalizes).

## Feel calibration

- Alex: kick-ball's throw/impact feel is the reference ("had it so well").
  PHASE-2: side-by-side cadence session against kick-ball's numbers;
  port its impact language more faithfully (hit-stop scale, bounce audio).

## Readability / attachment

- [NOW] Tree key hangs from the BRANCH on a string (was hovering).
- [NOW] Nursery key hangs from the crib MOBILE on a string (was floating
  by the wall — "doesn't look attached to that baby thing").
- [PHASE-2] Boiler key staging (nail + tag, glint pass).

## The house

- [PHASE-2 DONE] **"Filled with ugly little blocks."** Real furniture pass —
  port the furnishing kits from uninvited/blackthorn (beds with posts,
  wardrobes with doors, chairs with legs, framed art, rugs, curtains,
  clutter). Alex explicitly offers reuse from the existing games.
- [PHASE-2] **Player hands are orbs.** Real hands with fingers gripping
  the skull. Realism bar across the board.
- [PHASE-2] Walker model "pretty lame once it fully comes out" — resculpt.
  (The slow rise-from-the-floor reveal WORKED — keep that staging.)

## Windows & puzzles

- Windows are cool. Aim clarity issue: hard to tell if a throw clears the
  opening or clips the frame. → PHASE-2: subtle aim affordance (skull gaze,
  frame glint when your line is clean — no HUD).
- ALEX PUZZLE PITCH (adopt): throws that go OUT one window and IN another
  via angles/player movement. Design these together.
- Progression gap: after the stair door he didn't know what to do
  (cellar boards not discoverable enough). → the bent-knives-point-to-
  the-basement guidance beat + light cues. Design session.

## Combat

- Barely seen yet. Alex wants deep involvement in puzzle + combat design.
  Next session with him = design the encounter list together.
