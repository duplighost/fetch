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
shipping entries, 443,522 bytes, SHA-256
`a5fcebc204d1b62be2155a14fbbf34c0d49d2e867073630d25733780605d622d`.
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
