# FETCH

Throw it. It comes back.

First-person horror. You wake up holding a skull you cannot get rid of. It is the
worst thing you own and the only tool you have. Over the course of the game it
grows a face. At the end you find out whose.

Source: Alex's brainstorm, 2026-08-06, verbatim beats preserved below. This doc is
the spine — when in doubt during the build, this wins.

## The law

- **NO HUD.** Nothing on screen but the world and your hands. State lives in the
  skull itself (what it's carrying, what it looks like, what it's doing), in audio,
  and in light. (Kick-ball design contract, carried over.)
- **Colorblind-safe.** Never hue-only meaning. Threat = motion, brightness, sound
  direction, timing.
- **Audio is half the game.** HRTF spatial. Footsteps you can point to with your
  eyes closed. The skull moans in flight — doppler on the way out, close and wet
  on the return.
- **Puzzles are "you have to be looking," not "you have to be smart."** Isolate
  the player per section so they can't get lost.
- **Partly linear except a few points.** Secret paths exist and are stunning, not
  mandatory.
- **The player should always have something to fuck around with.** The skull is
  fun to throw even when nothing needs it. Idle throws are legal everywhere.

## The skull

- Thrown with the mouse, zips back fast — kick-ball ball feel, reskinned as a
  horror object. Surreal idle animations in the hands. You don't want to be
  holding it. You are always holding it.
- Cannot be discarded. Throw it out a window, off a cliff, into a grave — it
  returns. This is taught in the first 60 seconds and never contradicted, until
  the one moment at the waterfall when it doesn't come back, which lands like a
  gut punch BECAUSE it was never contradicted.
- **Fetch:** hits a key/small object → returns carrying it in its teeth. Throw it
  at the lock → uses the key → returns empty-mouthed.
- **Stun/pop:** hits a chaser → stun. Second hit (or a charged hit) → pops them
  apart. Popping is LOUD → nearby things rush you. Risk economy: quiet stuns vs
  loud kills.
- **Latch:** thrown at a rope/anchor point → bites on → YOU are launched to it.
  Traversal verb, used sparingly, feels incredible.
- **Scream:** at scripted open arenas the skull screams on its own → footsteps
  converge from all directions → horde round.
- **Transformation:** stage by stage across the acts —
  0 bare skull → 1 patches of muscle → 2 skin + one eye → 3 both eyes → 4 hair →
  5 a complete head by the clearing. It watches you more as it grows. Animations
  get less object, more person.

## Beat sheet

### Act 0 — The bedroom

> **ADDENDUM 2026-08-14 — Alex's new spec, verbatim (his words are the spec;
> this supersedes the original beat kept below):**
>
> "window is originally strong glass that can't be broken.
> (the player has to look around the room. opening stuff and getting feedback
> visually and sound effects. Make room more interesting and detailed with
> more creepy stuff but some of it being stuff that would be a room and a lot
> of stuff you can search and make a small change in it with an animation when
> you search. and make the new improve room foreshadowing somehow a bit too.
> though I'm not sure how, but you could figure something out.) Eventually you
> find a bell you can activate (Hide it in a clever place. when you activate
> it and in loudly dings in a realistic but kind of spooky bell sound).
> Suddenly you hear a lot of clicking of bones in the distance in the
> direction of the glass window. the bones sounds and soar sounds get closer
> and closer unthil the skull bursts through the window, shattering it, and
> landing in your hands. For a few secibds it flockers back and forth between
> a human head while mashing and meacingly chattering its jaw bones befire it
> becomes that skull be know and love from the rest of the game. Then you can
> throw it to get the key. Make sure it doesn't get the key on the way in when
> you firs meet it shattering the window."
>
> Shipped 2026-08-14 (branch claude/feedback-aug14-2): wake empty-handed at
> the bed edge, nine searchables, the bell hidden under a floorboard behind
> the rug search (it is a dog's collar-bell — leash in the dresser, claw
> gouges under the rug: the crawl secret's animal), the bone-click approach,
> the shatter, the catch, the flicker, throws gated until the settle, and the
> key guard (the inbound flight runs in mode `gone`, so no fetch target can
> fire). WALKTHROUGH.md Act 0 is the current player-facing truth.

**Original beat (2026-08-06 brainstorm, superseded above):** Wake holding the skull.
Extremely detailed, wrong-feeling bedroom. Door locked
FROM THE INSIDE, no key. Window open onto a terrifying forest. A key hangs in the
tree, out of reach. Teach: throw (it returns; try to throw it away — it returns).
Throw at key → skull brings it back in its teeth. Throw at door → unlock, skull
returns without the key. Out into the house.

### Act 1 — The house
Sectioned; each section gates until solved. The most horrifying stuff possible —
the kind that makes you want to quit but you're too curious. Footsteps where no
one is. First chasers; teach stun. Puzzles: look, throw, fetch. The realization:
the only way out is down. Basement door.

### Act 2 — The basement
Disgusting webs dragging across the camera. Shapes in the dark that are
absolutely creatures about to grab you (staged near-misses; some ARE). Hatch
door out.

### Act 3 — The backyard graveyard
Crashed car. Disfigured bodies. Rows of graves you have to cross. Things standing
still that shouldn't be. The tree line ahead.

### Act 4 — The forest
Dense, dark, closes around you the moment you enter — path SEALS behind you,
only forward through the overgrown path. Fallen trees cleared with the skull.
The rope: throw the skull at it, it bites, you're launched across the ravine.
Chasers here are faster than you — pop or be caught, but popping is loud.
One big open arena: the skull screams, footsteps from every direction, survive
the horde.

### Act 5 — The clearing
A forest oasis. Waterfalls and streams flowing into each other, one giant fall
at the end. Beautiful on purpose — the first place that doesn't want you dead.
The skull (a full head now) gestures at the waterfall: throw me. You throw it
through. **It doesn't come back.** A bridge of rocks emerges. You walk into the
waterfall; it turns to stone behind you. Candles light a cave path.

The cave is now the **Underfalls**, a full skull-less district rather than a
short tube: stone veil, drowned pump chapel, vertical sluice, overflow walk,
optional bell cistern, and the final hatch chamber. Water pressure reveals and
repels the thing following you. Empty hands are the verb here; movement and
listening replace combat.

### Act 6 — The room
A hatch above. Through it: a bedroom, much like the first. Locked. No skull.
Window closed. No key. The walls begin to move in — and they're mirrors now.
As they get close you make out your reflection: your head is the skull from the
beginning. The walls do not stop. They close until you can't move, until all you
see is your own reflection with that skull for a head, and then darkness.

## Creative pass (Alex: "get creative. i want to be scared to death")

### The skull is the threat detector
It's in frame the whole game, so it IS the UI. Before it has eyes: the jaw
**chatters** when something is near — soft tick for far, rattle for close.
After Act 3, the grown eyes **track threats** — something behind you and the
skull stares past your shoulder. Proximity = sound, direction = gaze. No HUD,
no hue, maximally upsetting. The more human it grows, the better it protects
you: you end up needing the thing you can't stand to look at.

### Scare craft rules
- Dread first, jumps second. Every jump is paid for with at least two minutes
  of wrongness. Silence is a weapon: the moment constant background sound
  STOPS should be the scariest in each act.
- Teach a rule, then break it once. (The skull ALWAYS returns — until the
  waterfall. Footsteps always mean something coming — until the one time they
  mean something leaving, which is worse.)
- The game notices the player. Things that only move when you're not looking,
  or only when the skull is in flight and your hands are empty.

### House set-pieces (Act 1)
- **The long hall.** A figure at the far end that only advances while the
  skull is in flight. The fetch puzzle at YOUR end forces you to throw. Terror
  of your own verb.
- **The phone.** A phone rings deep in the house. Following it is optional.
  Answering it stops the upstairs footsteps — which had been pacing the whole
  time — and the house is silent from then on. Silence is worse.
- **The nursery.** A music box winds down; while it's silent, something in the
  room inches closer. Re-wind it by hitting it with the skull from across the
  room while backing toward the door.
- **The house mirror.** One mirror in the house shows the skull one growth
  stage AHEAD of what you hold. Never explained. (Cheap reuse of the finale's
  planar mirror tech; foreshadows everything.)

### Antagonists
- **Walkers** — the standard chasers. Announced by footsteps long before
  they're seen. Faster than you. Stun = quiet, pop = loud → more come.
- **The Resident** (house boss) — cannot be popped, only stunned. Hunts you
  through the gated section while you fetch three fuses to open the basement
  door. Hanging-by-a-thread pacing: it is always somewhere, and the skull's
  chatter never fully stops.
- **The Congregation** (forest arena) — the scream horde. Open ground, waves
  converging by sound from all directions.
- **The Kneeler** (forest boss, before the clearing) — something huge between
  the trunks, seen only in pieces. Weak point reachable only by rope-latch
  launches past it: throw, bite, launch, strike, survive the fall, again.
- **The Drowned Choir** (Underfalls predator) — one legless corpse-mass beneath
  a torn burial veil, carrying three drowned faces at different depths. It
  follows the last place it heard you, commits to a fixed pressure point rather
  than steering through its strike, and is exposed/repelled by authored spray.
  The first catch hurts without killing; a moving player can always escape.

### Basement staging (Act 2)
Webs drag across the camera and muffle audio until wiped. The "definitely
creatures": most are still until you have PASSED them — then footsteps behind
you, and nothing there when you turn. One is real. You learn this exactly once.

### Secrets
A few stunning optional paths, one per act (crawlspace behind the pantry, a
mausoleum with a false back, a dry streambed under the rope ravine). Each holds
a vista or a wrongness, never a mechanic — rewards for looking, per the law.

## Idea-bank triage (2026-08-06, adjudicated against the build)

Sources: Claude-twin idea bank + triage, GPT-Pro sort. They agree on the beams:
flawless handling, growth never witnessed, noise debt, sincere oasis, one ending.
Rulings where they differ, decided by what the code already is:

- **The Mass Law is THE law** (movable comes to you; immovable brings you to it).
  Already true: keys ride the teeth, the rope launches the player. Observation
  ("moves only unobserved") is an ENEMY CLASS — the Standing Kind — not physics.
- **Auto-return stays.** "You can't get rid of it" is the founding sentence and
  the kick-ball cadence. Manual influence exists: tap calls early, hold extends.
- **Ending: catch-click + a stranger's gasp.** No whispered word. Screen text ok.
- **Music box is dead** (both AIs banned it): the nursery beat is now the crib
  MOBILE turning with no wind. Same wind-down/rewind mechanic, cliché removed.

BUILT (this pass): the Approach scalar (per-act) + mimic-step (your footfalls
echoed behind you, offset shrinking act by act; silent in bedroom/clearing/
mirror); finale reflection lag that closes with the walls and CROSSES at the
last half-meter (the double moves first); Standing Kind (graveyard pair +
basement dropcloths, one of which is real — chosen at boot); bodies posed
crawling AWAY from the forest gate; graveyard fear changes expression only and
never throw handling; calling into nothing in the cave answers with a distant
candle flare and far-off stone; the end plays the catch you know, then someone
else's gasp.

NEXT SESSION (adopted, real scope): the telephone that rehearses you; dining
room headless guests (move only while the skull is in flight — reseated facing
you); portrait hall (eyes follow the skull; after it grows an eye, they follow
you); canopy grapple chain; the cabin that heals the mix while an audience
gathers; the Pallbearers; the swallowed-skull Mass-Law-inverted boss; open-grave
launch-from-below; tuned gravestones + mausoleum (RETURNED); eyes-vs-fireflies;
the second thrower; flesh-theft evidence (portrait loses an eye, etc.); bells /
restraint secrets; NG+ deltas; the corruption ladder (the key comes back wet).

CUT (agreed): fridge mystery, talking/lying skull, control theft ever, morality
endings, "dead all along", fake oasis, mouth-inventory, tech trees, microphone
gimmicks, three-second silence stopwatch, tombstone rail-grinding (incredible;
illegal).

## Tech skeleton (filled in after recon)

- Build-free ES modules, Three.js vendored locally, `node serve.mjs` on **8711**.
- Donors: kick-ball (throw feel — FEEL_PROFILE is the law), eaten-path (forest,
  path-seal, VHS grade), uninvited/blackthorn (house bones — NOT the glitches),
  hall-of-mirrors (pooled planar reflections + pose buffer for the finale's
  head-swap), chamber (interaction/beat scripting, r161 vendor, smoke-test gate),
  Behind You (HRTF recipe).
- Debug API: `window.__FETCH` — step(), teleport(act), state dump.
- Gate: `node tests/smoke.mjs` green before anything is called done.
