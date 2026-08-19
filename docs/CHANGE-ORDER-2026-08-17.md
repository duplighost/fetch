# CHANGE ORDER — 2026-08-17 (Alex's live-play notes, verbatim)

Alex played the live build (claude/aug16-notes = Round Three, deployed via
site PR #68) and sent these notes plus fourteen screenshots. His words below
are the spec; the numbered section headers are ours. He organized the notes
himself after playing; the middle block (§4–§7) is one area — the stair
mausoleum's under-path (the ossuary). The execution plan lives in the newest
section of `docs/HANDOFF.md`.

He flagged one thing specially before the list: "the graveyard still has one
important odd thing happening" — that is §3, the gate re-locking after a
marrow death. Treat it as the bug of the round.

## The screenshots he sent

Fourteen, captured while playing, in his order. Decodes are ours — where a
decode conflicts with code reality, trust the code and his words.

1.  Night, between two spiked-fence rows at the graveyard gate: a large plain
    white slab sits square in the walk band, skull held above it — the §8
    block he has to walk around after the gate opens.
2.  The opened waterfall from the stepping-stone approach: rock walls, the
    tall water curtain, orange braziers on the rails, blue motes — where the
    §11 throw-here glow belongs.
3.  Mausoleum interior, three white candle stands in the window openings,
    skull + gold ring in hand — the ossuary surface interior (§4–§7 area).
4.  Night forest edge past a pale path slab: sparse distant silhouettes, a
    thin treeline, visible empty ground — the §10 "vacant spot / end of map"
    read.
5.  Beige-tiled underground room: wooden ceiling panel hung with metal rings,
    a pale-gold rectangular weight hanging from it, a white post beside — the
    §7 side weight, as it stands today.
6.  Dark bedroom under a ceiling light: a figure with a pale skull face
    standing at the door, window at right — the §1 scare's room, mid-beat.
7.  Night clearing with a wooden totem, the waterfall and wheel visible far
    left with braziers burning, a stream and rocks — the across-from-falls
    view for §9/§10.
8.  Basement: a white block with a row of downward tines at the walkway edge
    by the stair rail, the pump wheel on the ledge above — the §2 "spikey
    thing."
9.  The graveyard gate fence with three brown plates hanging on the bars and
    the lock-stone pillar lit beside a headstone — the §3 "three locks on it
    again" state, after his respawn.
10. Wallpapered room, big window over the graveyard, gold curl handles on the
    walls — the window side of the §1 room.
11. Near-black frame: a skeletal figure looming over raised player hands —
    the marrow death that triggered §3.
12. Stone corridor with a barred cell (a ring-cradle prop and bones inside),
    a ribcage on the floor outside — the §5 side rooms.
13. Bright white room with a dark doorway on a brick threshold, white slabs
    flanking, dead leaves — the ossuary throat area (§4).
14. A stone-brick room whose far side is a flat, featureless dark-blue plane
    — the §4 "wall at the beginning [that] feels weird."

## §1 — The window thing flashes for under a second

> "the thing that is supposed to come in the window in the second room of the
> game only flashes for less than a second."

## §2 — Basement: the spikey lock should sit at the walkway's end, low or in the floor

> "slightly slide the spikey thing in the basement that locks the gate into
> place so its at the end of the walkway and either make it less veryically
> tall, or put it in the floor so the player walks over it automatically."

## §3 — THE BUG: died in marrow, respawned, gate had three locks again and the key did nothing

> "in one round i tried, i died in the marrow area of the gravyard and
> respawned. I noticed the gate had three locks on it again and i couldn't
> make the key do anything to it."

## §4 — Ossuary: hatch in with E, hatch out the same way

> "to get into the the stair mausoleum in the underground graveyard area, you
> shouldn't just walk into it and be teleported. a hatch should open with e.
> and getting out of that area with the wall at the beginning feels weird.
> have a similar hatch to come out."

## §5 — Ossuary: enemies in the side rooms

> "(same area) in the path under the masoleum in the graveyard (the one with
> the stairs), a few of these side rooms would be perfect places to put
> enemies"

## §6 — Ossuary: kill the fake hatch + permalock at the stair top; the key spawns up there

> "(same area) at the end of the underground graveyard area in the masoleum
> with the stairs, get rid of the unopenable hatch and permalock at the top
> of the stairs and it should just be cieling like the rest. The key in that
> area should spawn at the top of the stairs."

## §7 — Ossuary: the side weight should lower a wall; bugs on the ground

> "(sam area) under the mausoleum in the graveyard, the one with the stairs,
> a little side weight exists that you can activate. it doesn't do much of
> anything. there should be a simple wall that comes down when you use it to
> keep progressing. Also, on the same area, there should be bugs crawling all
> over the ground."

## §8 — The block in the walkway after the gate opens

> "after opening the gate out of the graveyard, there is a block on the
> ground that blocks part of the walk way so you end up haveing to walk
> around it. it shouldn't be there. i don't know if its part of the gate, but
> after you open it it should be gone."

## §9 — Falls field: scarier popups, everywhere around the openers

> "make the enemies outside the waterfall scarier. they can be the same exact
> ones as the ones in the marrow area under the graveyard where they pop up
> out of the ground but you can walk through them and they pop back in. put
> them everywhere around the things to open the waterfall."

## §10 — Close the far edge with trees, end the stream in a pond, make the crossing legible

> "area across from main waterfall you can see vacant spot and end of map -
> cover that end of map area in trees, and have this stream end in a pond -
> also make it clear you can walk across the river somehow, because some
> water close to the waterfall you cant walk across."

## §11 — Once open, glow where the skull goes

> "after you open the waterfall with both sides, make a glowing area to show
> the player where in it to throw the skull."

## §12 — The choir: harder, and way in front

> "The enemy inside the waterfall should be more difficult and should spawn
> way in front of you."

## §13 — Finale: the raised hands must read as the player's own

> "in the last room when the player raises the skull hands they need to be
> rotated the other way so they look like they're coming from the player. the
> hands look fine against the mirrors though."

## §14 — Deploy

> "we will update the website in opus 5 instructions like at the end of last
> round like it said there"

(That is the explicit deploy authorization, given in chat this round: merge
the site PR once every gate and the boot-check are green, then verify
production boot — same law as last round.)
