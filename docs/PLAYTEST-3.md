# PLAYTEST 3 — Alex played both builds (2026-08-08)

Alex played the repo build ("yours") and Sol's courier iteration
(`fetch-courier-codex`, 0.2.0-codex, now merged — see below). Verdict:
"yours feels more crisp. but codex's looks better." Raw feedback → lanes.
`[SHIPPED]` = done on a merged branch, do not redo. `[OPEN]` = free lane.
`[DESIGN]` = needs Alex before building. `[PROPOSAL]` = a concrete design
drafted for Alex to approve/kill — do not build until he reacts.

## The merge (context for everything below)

Codex's build was a fork of main (pre-#5/#6) with better-looking exteriors
and real systemic fixes. Direction: keep OUR feel core (it's the one Alex
called crisp), take THEIR looks and repairs. Their skull-variant-c.js was a
default-swap shim colliding with our `?skull=c` mount — the skull-off is
Alex's call, so no default change ships until he judges.

## Alex's calls, verbatim-ish

1. "That basement key i have no idea how i got. It just appeared."
   — key discovery is illegible (a glint on the boiler tank).
2. "the player should try to burn the skull in an incinerator down there
   but it doesn't work." — [DESIGN, Alex-authored] the basement beat: an
   incinerator you CAN feed the skull to; the burn fails; the failed burn
   is where the hatch key turns up (in the ash) — fixes #1, gives the
   basement its identity ("the basement is surprisingly boring on both
   builds"), and foreshadows the waterfall: fire refuses it, water takes it.
3. "there still is no window puzzle i guess?" — see PROPOSAL below.
4. "that random door is also perfect for a puzzle... the one you can open
   but not get into." — the guest room's second door over the stair void.
5. "not everything has to be a fucking key lmao." — LAW for new puzzles:
   rewards are things, moments, upgrades — not keys.
6. "combat needs work. like a lot of work. i want the game to haev combat,
   but like a horror game. and i need it to feel good. this feels like
   'plunk'" — combat-feel overhaul lane.
7. "teeth chattering was cool." — protect the chatter radar; build on it.
8. "i got stuck in your forest... locked in to one place and my player
   couldn't move any direction" — seal closed ON the player. Hard bug.
9. "i was able to walk off the back off the map into the darkness on the
   other side of the house." — missing world bounds.
10. "the basement hatch doesn't look like its locked at all." — door
    grammar violation; the padlock is a 16cm nothing.
11. "coming down those basement stairs, it all gets a bit fucked with
    seeing outside of the house because it isn't put together right."
    — stair shaft seams let you see out of the world. (Codex's build has
    the same class of bug, plus floating/misplaced objects of its own.)
12. "i have a game where literally all it is is walking through a forest...
    the forest closes behind you. learn from that shit." — THE EATEN PATH
    (Projects\eaten-path) is the donor for forest look + seal behavior.
    General standing order: "you have to familiarize yourself with what you
    have access to" — the donor catalog across Alex's games.

## Lanes

- `[SHIPPED 2026-08-08]` Codex merge: their enemies/finale/director/
  outside/atmosphere/world/main/player improvements folded into main with
  the feel core kept ours. See the codex-merge PR for the hunk-by-hunk
  adopt/reject log.
- `[SHIPPED 2026-08-08]` Forest seal trap + world bounds + stair-shaft
  seams + hatch lock legibility (fed by the eaten-path study).
- `[SHIPPED 2026-08-08]` Incinerator refusal beat (Alex's design, #2
  above) with the hatch key moved into the ash pan.
- `[SHIPPED 2026-08-08]` Void-door puzzle (#4): the door you open but can
  never enter is a throwing lane. Non-key reward per #5.
- `[SHIPPED 2026-08-08]` Combat feel pass v1 (#6): hit-stop, impact audio
  layers, directional stagger, hot returns, whiff audio — ported from
  PARTY ANIMAL / kick-ball feel DNA. Chatter (#7) untouched.
- `[SHIPPED 2026-08-08]` THE LOCKET (new, Claude-authored): a second glint
  hangs deep in the tree canopy, chiming faintly — visible from the bedroom
  window all game, but the front boughs knock every throw back. The moment
  you climb out of the basement into the graveyard, the tree is above you
  and the line is clear. The skull clamps the chain and WEARS it on its jaw
  for the rest of the game. At the waterfall, the falls take the skull — but
  a few breaths later the locket is lying on the shore, chain snapped. Pick
  it up (E) and it rides in your empty hands to the very end; the
  reflection's skull, when you meet it, still wears its own. Non-key,
  wordless, colorblind-safe. Both beats covered in the playthrough gate.
- `[PROPOSAL — needs Alex]` Window puzzle (throw out one window, in through
  another): engine truth learned building the locket — a HELD throw chases a
  guide that always sits ~7m beyond your aim, so steering sweeps DIRECTION,
  never range. Window-to-window sweeps at range fit the grammar (park it
  out, sweep it across the far window's plane); mid-range point-snatches
  don't. Concrete v1 when you want it: the sealed guest room's east window
  as the entry, sweep across at ~15m, snatch something off the guest bed.
- `[PROPOSAL — needs Alex]` The foyer mirror (THE LAG DNA): the black-glass
  foyer mirror turns true mirror for ONE beat mid-game — your reflection's
  skull lags half a second behind yours. Pure finale foreshadowing; the
  pooled mirror machinery already exists.
- `[OPEN]` Forest look polish from the eaten-path kit: trunk lean, overhead
  canopy closure, shrub walls, two-ribbon ground, fog-matched background
  (seal mechanics + witnessing shipped; this is the visual layer).
- `[DESIGN]` Nursery mobile telegraphing (carried from PLAYTEST-2).
- `[DESIGN]` The leading pass (light/sightlines/prop arrows), act by act.
