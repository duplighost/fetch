# HANDOFF — 2026-08-10, bell/pilot/intruder recovery (CURRENT, DEPLOYED)

Read `AGENTS.md` first. This section supersedes every release-state claim below.
Alex's public playtest of `0.4.0-ossuary` exposed a real human-route failure:
the cellar boards admitted the player before the old fussy exterior-return bell
and upstairs flame were understood, while the incinerator still required a
flame. The supposed bell payoff used a generic metal-drop sound. The result was
a basement full of convincing valves with no legible critical flame.

The `0.5.0-intruder` repair landed through source
[PR #17](https://github.com/duplighost/fetch/pull/17) as merge
`d66c4a682b21f02fefa6eaaaf6e2ffaa10ab406d`. Its deterministic standalone
artifact, Qualiacology preview, site merge, and production deployment were then
verified independently below. No one state is inferred from another.

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

## Release identity and production evidence

- Frozen source verification is complete: **67/67** JavaScript modules parse;
  focused house/progression/crawler **21/21**; pause/title/pointer-lock fallback
  **25/25**; all 23 formal browser/simulation modules green; canonical
  autotest **24/24**, regressions **50/50**, eight-act smoke, and complete
  playthrough **38/38**; zero browser errors. Real D3D11 render p95 peaks at
  **10.701 ms** against the 45 ms gate, and district culling peaks at **420**
  draws against 450. An unmuted system-Chrome direct-bell throw committed once,
  kept AudioContext running, and scheduled the four scaled inharmonic partials
  plus strike source once; the return leg added no second ring.
- Deterministic standalone package `fetch-netlify-2026-08-10-intruder.zip` is
  complete: two builds matched exactly at **25 entries**, **1,953,010 raw
  bytes**, **578,074 ZIP bytes**, SHA-256
  `71521a2bff1f9290cd1cb39034b22e1171d786cd28993e60ae44c15ed3e89db3`.
  The verifier extracted to a unique clean directory, exact-compared every byte
  to current shipping roots, decoded the 1280x720 title art, and booted
  `0.5.0-intruder` / skull variant E with zero browser errors. Release-integrity
  negatives passed **7/7**, and the old ossuary ZIP is explicitly rejected for
  lacking the required content-addressed title artwork.
- Source [PR #17](https://github.com/duplighost/fetch/pull/17) merged as
  `d66c4a682b21f02fefa6eaaaf6e2ffaa10ab406d`.
- Qualiacology [PR #35](https://github.com/duplighost/qualiacology/pull/35)
  passed its release probe on preview deploy `6a79a1e6b620fa00075f97c3` at
  `https://deploy-preview-35--classy-strudel-55444b.netlify.app` with
  **29/29 + 5/5** checks and zero browser errors, then merged as
  `77c24f86abc1074d71d802172021df67167a0175`.
- Netlify production deploy `6a79a4b384c0e400081ad376`, published
  `2026-08-10T10:15:22.317Z`, serves `0.5.0-intruder` at
  `https://qualiacology.com/fetch/`. The fresh production probe again passed
  **29/29 + 5/5** with zero browser errors, including the bell, pilot-flame,
  crawler, pause, title, catalog-card, and shell behavior exercised in preview.
- The live title master at
  `/fetch/assets/fetch-title-keyart-5ab7c65b.webp` and card master at
  `/assets/games/fetch-card-keyart-5ab7c65b.webp` each return **200**,
  `image/webp`, and **66,346 bytes**, and each exact-matches SHA-256
  `5AB7C65B0E3ECC50D96454EE5F3393284D02D521ED7F1AF2DCFC2691B1CFF998`.
  Both content-addressed art responses use
  `Cache-Control: public,max-age=31536000,immutable`; the mutable `/fetch/`
  document and `/fetch/src/main.js` correctly use
  `Cache-Control: public,max-age=0,must-revalidate`.

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
