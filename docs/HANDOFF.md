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
