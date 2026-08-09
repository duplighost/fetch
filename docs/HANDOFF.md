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
