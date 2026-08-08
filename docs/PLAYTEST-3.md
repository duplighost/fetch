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
- `[PROPOSAL — needs Alex]` Window puzzle v1: after the tree key, a second
  thing hangs on the FAR side of the canopy, visible from the bedroom
  window but unreachable by a straight throw — throw OUT the window, HOLD
  to poise, steer around the canopy, snatch it, release. Teaches
  poise-steering with zero new systems. Reward (non-key, per #5): TBD by
  Alex — candidates: a story object, a skull "toy", a light upgrade.
- `[DESIGN]` Nursery mobile telegraphing (carried from PLAYTEST-2).
- `[DESIGN]` The leading pass (light/sightlines/prop arrows), act by act.
