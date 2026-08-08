# PLAYTEST 2 — Alex's second real playthrough (2026-08-08)

Raw feedback, translated into work items. Status marks who owns each lane.
`[SHIPPED 2026-08-08]` = Claude is actively fixing on branch `playtest-2` — do NOT
duplicate. `[OPEN]` = free lane for Sol or a Pro instance. `[DESIGN]` = needs
Alex's direction before anyone builds.

## The held skull + hands (composite verdict: not there yet)

Alex: "it looks more like those hovering hands are part of the skull and it's
making a gesture where it's putting hands around its eyes to make glasses.
It's not directly facing the player and making eye contact. And it needs to
be a bigger skull."

- `[SHIPPED 2026-08-08]` Composition rework in `skull.js`: skull scaled up (~+40%),
  per-frame `root.lookAt(camera)` for true eye contact, hands dropped to a
  cradle-from-below grip (fingertips reach mid-skull at most, never the eyes),
  forearms extending off the bottom of the frame so they read as YOUR arms.
- `[OPEN]` Skull sculpt round 3 under the new composition. Variants a/b
  (`?skull=a|b`, files `src/skull-variant-a.js` / `-b.js`) both got a "not so
  great" — a fresh sculpt or a heavy revision of either is welcome. Contract
  is in BRIEFING.md §Courier contract.

## Door language (top confusion of the session)

Alex: "It should be abundantly clear if a door is locked, if it has a door
knob, and if it will open when you see it. Pump a sound effect for a locked
door. Make doorknobs and locks really clear."

He opened the cellar door and never understood why: the three break-boards are
nailed on the FAR side of the door (z +0.16 relative to the door plane, the
stair side) — invisible from the kitchen where the player stands. He was
breaking them through the door without ever seeing them.

- `[SHIPPED 2026-08-08]` Boards move to the kitchen-visible face, lighter wood so they
  read in the dark.
- `[SHIPPED 2026-08-08]` Door grammar in `world.js`: knob = will open; knob + keyhole
  escutcheon = needs a key; NO knob at all = never opens (the front door
  having no knob is the story told in one prop); boards on your side = throw
  the skull at them. Knobs/keyholes visible from BOTH faces of every door.
- `[SHIPPED 2026-08-08]` Locked interaction gets physical: knob jiggle + panel shudder
  animation, beefed-up rattle SFX. Knobless doors give a dead thud instead —
  nothing to rattle.

## The Resident + nursery

- Liked: shutting doors on it; its hands reaching through the wall (accidental
  mesh penetration — now canon, do not "fix").
- `[SHIPPED 2026-08-08]` It gets stuck when a door is shut on it: no pathfinding to
  the other doorway. Adding door-node steering (reroute through open doors)
  + the Resident slowly opens closed unlocked doors after a beat — you shut
  the door, silence, then the knob turns.
- `[DESIGN]` The crib mobile's role isn't landing. Current mechanic: the stair
  key hangs from the mobile on a string (skull-throw fetches it); the mobile's
  turning is cover-noise — while it turns, the nursery is "safe". Alex found
  the noise/threat link unreadable. Needs a telegraphing pass designed with
  Alex, not more mechanics.

## Furniture placement (Sol's overhaul, placement bugs)

- `[SHIPPED 2026-08-08]` Painting hovering inside the scullery doorway hole
  (`framedArt` on the x=4 wall at z 2.35, ground). Bookcase parked in front
  of the study's west window (`bookshelf` at z 1.1 on the x=-12 wall).
  Second bookcase oddly placed beside it. All being re-seated.
- `[OPEN]` Systematic audit: walk every `framedArt`/furniture placement against
  the door/window hole tables in `house.js` (`HOUSE_TABLES.doors/windows` —
  wall plane = cell*2-12 for x, cell*2-14 for z, holes span the cell). Flag or
  fix anything overlapping a hole or blocking a window/door approach.

## Guidance

- Alex: "things can very visually lead the player in an intuitive way."
  `[DESIGN]` A leading pass (light, sightlines, prop arrows) act by act, with
  Alex. Quick wins welcome but the philosophy is his UI law: no words, no HUD;
  the world itself points.
- `[DESIGN]` Window puzzles (throw out one window, steer, in through another).
  Alex wants them; he's designing puzzles with docs/WALKTHROUGH.md in hand.
  Prototype only after his ground-floor puzzle designs land.

## Answered questions

- The stairwell door that hangs out of reach over the stair void: the guest
  room's second door (`['first', 8, 3, 'W']`). Currently decorative/accidental
  — it opens onto air above the shaft. Candidate for a skull-through-the-void
  secret later. It never gets used today.
