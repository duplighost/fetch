# CHANGE ORDER — 2026-08-16 (Alex's live-play notes, verbatim)

Alex played the live build (claude/aug15-notes, deployed via site PRs #63–65)
and sent these notes plus six screenshots. His words below are the spec; the
numbered section headers are ours. The execution plan lives in the newest
section of `docs/HANDOFF.md`.

## The screenshots he sent

1. Skull held at a paned window at night, city-block silhouettes beyond, mostly
   empty dark ground — the void read past the glass.
2. Skull + red powerup held at the graveyard fence, empty dark space and bare
   ground beyond the rails — the "drops off onto nothing" read.
3. Underground corridor with white angel statues on brick plinths, a marionette-
   like enemy with white orbs, and a gold key floating on a brick pedestal —
   the marrow / special-enemies district key spot.
4. Browser shot of qualiacology.com/fetch: the key tree at night with white
   balls hanging on strings at descending heights, skull held below — the
   current key-3 presentation he wants replaced.
5. Looking through floor-to-ceiling bars at a device (a ring resting on a
   tined cradle) with a ring/keyring hanging on a hook above, brick room, an
   open wooden door to the left — the area he says he cannot enter.
6. Graveyard gate area: spiked iron fence sections, plain box shapes hanging
   in mid-air over a bench, and a tall cabinet with a lit interior and three
   pale pegs at the right — the "things hanging in front of the gate" plus a
   contraption.

## §1 — Basement contraption still not required

> "One of the basement contraptions in the picture is still not required for
> the puzzle for some reason."

## §2 — Perimeter: fence + house sides read as void

> "The area around the fence viewable from the graveyard would do better dense
> with shrubbery/trees around because it still looks like empty space that
> drops off onto nothing. same with areas of the graveyard when looking
> alongside the sides of the house."

## §3 — Key tree: replace the balls with a hittable hanging branch

> "I wanted one of the graveyard keys to be literally on top of the tree.
> right now colorful light balls on strings come down, but you cant interact
> with them and the come in and out of visibility. and right now you can just
> throw the skull to get the key, which might not be on the tree, but along
> side. my original plan was rather complex though. what if instead of those
> balls coming down, something else came down that was obvious you could hit.
> like some kind of large branch hanging down. if you hit it with the skull,
> the key and the bones of a skeleton fall down. but not the skull of the
> skeleton, just bones."

## §4 — Marrow key spot: remove the powerup, consolidate both powerups at the gravestone

> "the area with one key in the graveyard in the marrow/special enemies areas
> still has the second powerup on top of it, which you get if you throw the
> skeleton to pick it up, then a key appears beneath. Might as well remove
> that powerup and put both powerups in the same spot as the first powerup is
> in now that comes out of that destroyed gravestone. definitely take it out
> of the underground marrow/special enemy area so just the key is there."

## §5 — The ossuary mausoleum: entrance broken, key at the end, no far exit

> "I wanted the second mausoleum thing with the underground path to still
> exist. pretty much the same as before. except with a key you get at the end
> instead of an opening/hatch at the end to the forest. as of now, that area
> isn't able to be entered even though the hatch is one the ground inside it.
> right now i could only use the other hatch in the graveyard to the
> marrow/newer enemy zone which i explained in the last paragraph."

## §6 — The gate must take exactly three keys; clear the floating things

> "It seems like the gravyard gate partly opened after hitting the key area
> with to keys, maybe i had a third and never saw it or a third is on top of
> the second in the skeletons mouth from one of the spots or it only takes 2
> or i'm really not sure where the bug is to be hones. it should take all
> three (although i guess we never did finish the third key if you cant get
> into the area i last mentioned in the second mausoleum thing and it doesn't
> have a key at the end.) But after i thought i got two and used them, at some
> point, i noticed the gate was open and it looked like three. but things
> were still hanging in front of the gate in the air that you could walk past
> - which seems simple to fix - the harder part is the three keys existing
> how i've described them and the logic working. it should take three. the
> one in the underground marrow/newer enemies area, the one that happens when
> a tree branch hangs down from the tree and you can hit it with the skull to
> make a key and bones drop, and the one in the other mausoleum area that has
> the hatch in there, but you can't go in and we would also need to make sure
> that area doesn't have a way out at the end, just the key and then you go
> back and leave to the graveyard."

## §7 — Past the woods: paths to the gong and wheel, trees, popup bugs, maybe a stream

> "past the woods, I didn't see any boss battles. But that gong and the wheel
> thing work fine. We just need to keep in mind what that area looks like
> right now. walking too far past it brings you to nothingness. Maybe we
> could add more trees and a little path to the gong on one side and more
> trees and a little path to the turn wheel thing on the other. we could just
> put some of those odd bug type enemies we used from marrow there that don't
> hurt you but pop up and you have to walk through. keep in mind the vision
> of the player in terms of what those path on both sides will look like to
> them, and we don't want them seeing the end of the world either. we could
> have a little stream past there if the trees don't completely block it on
> the far sides of both paths - not in front of the things that create the
> two things on each side that allow you to go under the waterfall of course.
> Make sure to think this all through to be intuitive for the player."

## §8 — Underfalls: the old unique enemies are missing

> "I still do not see any of those old enemies that used to be unique to the
> area under the waterfall. i wish we could get those in there. maybe there
> was just one before."

## §9 — Finale: raise the hands earlier, and they must be real bone

> "In the final room of the game, have the player raise their hands earlier.
> they must be actually bones like a skeleton. right now they don't look like
> that."

## §10 — Deploy

> "he should update the game on my website when he's done."
