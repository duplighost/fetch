# FETCH — complete current walkthrough (designer's copy)

This is the spoiler-complete route for the **2026-08-09 masterpiece integration
worktree**, not the older live release. It describes what the current source
expects the player to learn, what is mandatory, what is optional, how failure
recovers, and which pieces of apparent scenery are actually systemic.

## Controls and universal rules

- WASD moves, mouse looks, Shift runs, Space jumps, and E uses the world object
  under the crosshair.
- Press LMB to throw immediately. Keep LMB held and the skull stays out, flies
  toward the aim, then treads air. Release LMB and it returns. There is no
  charge-up. RMB calls it; E also calls it when there is no nearby usable object.
- A fetched object rides visibly in the jaw. A key can be delivered by throwing
  the carrying skull at its lock; walking close and pressing E is the fallback.
- The skull is the player's light and threat radar. Throwing it also throws the
  useful light away. Jaw chatter accelerates with danger; later eyes look toward
  the most important threat.
- Against ordinary walkers, the first hit is a quiet stun and the second hit
  pops the stunned body permanently. The pop is loud: it can wake or invite
  pressure elsewhere. The Resident and Kneeler can be interrupted but not
  killed this way.
- Combat attacks visibly commit to a fixed ground point. Moving or sprinting
  out of that footprint is valid counterplay; the attack does not keep tracking
  the player's new coordinate through its tell.
- Required state is communicated by locks, moving mechanisms, silhouettes,
  light value, animation, and spatial sound. Hue is never the only answer.

The mandatory chain in one line:

`bedroom key → nursery key → window relay → flame → pump → incinerator`
`→ hatch key → grave resolution → ossuary → forest → waterfall`
`→ Underfalls hatch → mirror contact`

## Act 0 — locked bedroom

The game begins with control already live. The open window frames a tree branch
and a hanging key.

1. Throw the skull through the window and hit the key. The jaw closes around it
   and the skull returns with the key visibly held.
2. Throw the key-carrying skull at the bedroom-door lock. The lock consumes the
   key and the door opens after the key turns. Walking to the door and pressing
   E while the skull carries the correct key also works.
3. A throw with no key or the wrong key produces one locked impact and rattle;
   its returning path does not hit the lock a second time.

Optional: a locket hangs deeper in the canopy behind the front boughs. After
fetching the bedroom key, throw out, **hold**, steer beneath/around the leaves,
and touch the locket. This is not another key. The skull keeps it on its jaw for
the journey, and it receives a small ending in the clearing.

This room teaches the entire game without a tutorial: aim, outbound contact,
fetch, return, physical locks, and the held-flight possibility.

## Act 1 — upstairs house

### Nursery and stair door

The nursery mobile turns above the crib. The stair key hangs from the mobile
with the toys.

1. Throw at the stair key and let the skull return with it.
2. Throw the carrying skull at the stair-door lock, or use the lock at arm's
   length. Descend to the ground floor.

The mobile is also a threat clock. While wound, it turns and the thing below the
floor recedes. Hit the mobile with an outbound skull to wind it. If it runs down
while the player remains in the nursery, the actual walker rises through the
floor rather than swapping in from a placeholder. The player can leave, rewind
the mobile, stun the result, or accept the chase.

The guest room and upper landing are no longer empty future-work flags. They
become part of the mandatory flame route and the later return-horror path.

## Act 1 — ground-floor house

The front door remains a dead end. The real progression is split across the
living room and study, with its mechanism visible outside both west windows.

### Required puzzle: the two-window relay

1. Go to the living room and face the open west window. Outside it is a toothed
   iron mooring connected to a long rail.
2. Throw through the living-room window and hit the mooring. **Keep LMB held.**
   The skull anchors into the trolley instead of returning.
3. While still holding LMB, walk through the house toward the study. The trolley
   and skull travel along the exterior rail beside the player's progress.
4. From the study end, release LMB. The return leg enters through the study
   window and rings the servant-bell receiver from its valid outside face.
5. The bell drops the blocker, opens the upstairs door above the stair void, and
   wakes the house lag mirror. An interior throw at the receiver cannot fake the
   solution because its physical backplate is in the way.

Throwing at the locked upstairs void door before solving the relay does not open
it. The door rattles, the rail answers beside the player, and the distant bell
knocks to point toward the mechanism without a HUD prompt.

### What enters while the light is outside

The relay's missing-light interval is also an authored invasion:

- Hands, shoulder/head, crawl, and inside-floor poses advance at the living-room
  aperture as the trolley travels.
- Looking directly at the visitor freezes its current pose. The game never
  moves the camera to show it.
- Completing the return bell dismisses the visible body, but wet prints and
  smears remain. A later guest-window crossing can be seen if the player gives
  that window a real look.

The mirror awakened by the relay is a real planar reflection. Its wrong human
inhabitant follows the player's recorded pose about a second late, then catches
up. It cannot hurt the player and does not steal input; its purpose is to teach
the house's observation grammar before the finale.

### Required puzzle: steal the flame

Return upstairs. The relay-opened room contains a tall iron candle stand.

1. Throw the skull into the visible flame.
2. The flame dies into the sockets. Two small embers become part of the skull,
   and its carried light becomes brighter/longer-reaching. The `ateFlame` state
   is now physically visible and will power the basement firebox.

The flame cannot be taken before the window relay because the door remains a
real locked panel. Pressing E does not counterfeit that state.

### Deterministic return horror

Completing both the relay and flame arms a nine-beat path through the house. It
is not random ambience: spatial footsteps travel from the living aperture, past
the living door and stair foot, to the guest threshold and landing, down the
stairs, through dining, into the kitchen, and finally to the cellar boards.

- A beat advances only when the player has reached the appropriate floor/area
  and is not staring at its source.
- If the rocking chair or dining composition was genuinely visited and later
  left, it can move permanently between looks at the corresponding route beat.
- The backhall/scullery door may creep open a few inches. The crack remains
  collidable until the player uses the knob; visual motion is not fake passage.
- Death or leaving the house pauses the exact prefix and clears pending timing.
  Re-entry resumes it once, with no duplicate visitor.
- The final cellar footfall tells the existing Resident where the noise came
  from. It does not bypass the board puzzle.

### Cellar boards and the Resident

The kitchen cellar door is visibly nailed shut by three boards. Hit each board
once with an outbound skull. The planks tear loose with loud impacts.

The first break brings the Resident. It is large and permanent: one hit buys a
short stun, but it cannot be popped. Closed doors, alternate room connections,
and fixed-point attack tells are the player's route-making tools. Breaking the
last board unlocks the cellar; open it and descend. The Resident does not follow
into the basement.

## Act 2 — basement and under-house works

The old straight boiler-key solution is gone. The hatch key exists in the ash,
but the player must make the whole house breathe before the incinerator will
refuse the skull and expose it.

### Existing basement threats and optional crawl secret

- The storeroom's covered figures still include a Standing One chosen at boot.
  It moves while unobserved.
- Webs brush and muffle as the player crosses them.
- The crawl-room skull counterweight remains optional. Holding the skull in its
  barred cradle raises and latches the shutter; early release resets it. Beyond
  is the dog skeleton curled around the ball it never fetched.

### Required puzzle: pump-gallery hold and cross

Enter the old pump works through the crawl-side heavy door.

1. Throw the skull into the ring/cradle beside the winch and keep LMB held. The
   skull becomes the counterweight.
2. Five bridge leaves pay out across the sealed water channel as the hold
   continues. Move while holding and cross under normal player control.
3. Releasing before the far side rewinds the bridge and re-enables the winch.
   Nothing is banked by repeated short attempts.
4. Reach the far bank while the bridge is fully paid out. The physical pawl
   drops and `pumpGalleryLatched` becomes permanent. Release LMB; the skull
   returns and the route remains open.

The blind archive beyond the bridge contains six generations of mismatched pump
hardware. It is environmental history and a safe place to inspect the result,
not another hidden key requirement. Deep-basement culling hides the upper house
behind the floor while preserving the real cellar sightline.

### Required puzzle: incinerator refusal

Return to the boiler-room incinerator and use its fire door.

- Without the stolen flame, an outbound throw produces a cold choke and points
  back to the upstairs dependency.
- With the flame but no latched pump, the dead pressure gauge and pump response
  point back to the under-house draft.
- With both `ateFlame` and `pumpGalleryLatched`, throw the skull into the open
  firebox. The furnace roars, tries, fails to burn it, and commits the refusal.
  The jammed ash pan opens and the hatch key becomes fetchable.

Fetch the key from the ash pan. Throw the carrying skull at the hatch padlock;
the lock/chain visibly release. Then press E on the hatch panel. The committed
opening survives a quick death/respawn and exits to the graveyard rather than
leaving a consumed key and a shut door.

## Act 3 — graveyard

The wrecked station wagon, dragged bodies, drag marks, open graves, varied
stones, and two mausoleums establish the yard before the central commitment.
The bodies point away from the forest. Open graves are visible tactical obstacles
but do not kill through an unreadable fall. Standing Kind move only while they
are not being watched.

The iron forest gate is shut. Crossing the central row begins the funeral. There
are two valid ways to resolve it; both lead to the same required under-yard
chapter.

### Route A: the three-grave ritual

Three tall split-crown graves are placed around the yard.

1. Hit each resonant grave with its own **outbound** throw.
2. Every credited stone bows into a permanent new silhouette, emits a spatial
   resonance pulse, and stuns nearby pressure.
3. A returning skull that curves through another stone cannot credit it. One
   deliberate throw equals one ritual statement.
4. Crediting all three resolves the funeral and cancels the remaining loud
   clear requirement.

This is the lower-kill route, not a claim that the yard stays literally silent:
the stones are instruments and the risen bodies remain dangerous while the
player reaches them.

### Route B: loud three-wave clear

If the player fights instead, the grave arena runs three authored waves:

- Wave 1: 4 risen bodies.
- Wave 2: 5 risen bodies.
- Wave 3: 6 risen bodies.

There is a real pause after each wave so the skull can return and the player can
choose ground. One attacker owns a strike claim early; later waves may sustain
two, never an unbounded pile of simultaneous one-hit contacts. Use quiet first
hits to control space and make deliberate loud pops when the consequence is
worth it.

### Tactical hero graves

Six larger headstones can be altered during either route:

1. First outbound hit: stone chips and rocks; bounded debris leaves the fixed
   pool.
2. Second outbound hit: the marker visibly topples, collision drops to a
   walkable low obstruction, and a short resonance stuns nearby enemies.

These stones are tactical cover/control, not required ritual credits. If the
player dies before grave resolution, their visuals, collision, targets, and
debris reset together. Once the yard is resolved, progress is irreversible.

### Required puzzle: mausoleum and ossuary

Finishing either grave route does **not** magically open the forest gate. The
left/west mausoleum's false doorway clears, its floor slab sinks, and a stair
throat appears.

1. Enter while holding the skull. The game moves directly into the enclosed
   under-yard route without a camera pan or input lock.
2. Follow the dirty center track through three alternating baffles. Two shallow
   pockets contain atmosphere, not alternate solution keys. A standing witness
   turns only between looks.
3. At the far mechanism, throw the skull into the counterweight wheel and keep
   holding. Short pulls decay when released; progress cannot be banked.
4. One uninterrupted hold lowers the weight, drops the far exit slab, sinks the
   witness, and opens the surface iron gate with a proper gate creak.
5. Walk through the far opening and climb the hatch. It emerges just beyond the
   graveyard gate, faces the player into the trees, commits the forest act, and
   takes a forest checkpoint in the same fixed step.

Before solving the counterweight, walking back out of the entrance returns to
the mausoleum safely. Inside the ossuary, exterior districts are hidden for
performance and restored exactly on a backtrack; the far hatch intentionally
retires the completed house/yard district.

## Act 4 — the forest that makes choices permanent

The forest is a 208 m authored route with dense side belts, canopy closure,
landmark chapters, two braided forks, optional rope pockets, and a cumulative
seal. The path behind the player physically knits shut. Progress is forward, but
the two fork mouths allow limited examination before commitment.

### Fallen tree

An uprooted bole is knitted across the route in three layers.

1. First outbound hit tears one branch/collider layer away.
2. Second outbound hit tears the next layer and twists the root mass.
3. Third outbound hit removes the last layer and drags the full log lengthwise
   into the shoulder.

Each throw removes exactly one layer; the returning skull cannot score another.
The log remains collidable until the visible mass has actually cleared the
player-width path. Clearing it schedules a forest chaser farther ahead rather
than spawning one on top of the player.

### First braid: switchboard fork

The path visibly divides. The left branch carries a radio abandoned on a chair;
the right carries a telephone mounted on a stump.

- The player may enter either branch for up to almost six metres, inspect/listen,
  and retreat to try the other.
- Crossing six metres on one ribbon commits that side. Roots rise behind the
  parent mouth and across the rejected route while the selected path remains
  open.
- A checkpoint made after commitment restores on the chosen ribbon with the
  same closure. A checkpoint behind the mouth dissolves it so a respawn cannot
  appear trapped.

### Optional searchers' line

A side knot beyond the first braid leads to a search blind and empty swing.
The side wall is a visible deadfall until an outbound skull catches its rope.
Hold through the swing, release normally, land, and then walk out through the
opening the forest has swallowed. The pack, boots, lamp, and swing are a small
wordless search story; this pocket is optional and repeatable.

### Forest story objects

Eight objects sound from exact coordinates:

1. Radio-chair — first-fork left.
2. Stump telephone — first-fork right.
3. Searchers' swing — optional pocket.
4. Ditch CRT — between the first fork and mire.
5. Washer — second-fork left.
6. Refrigerator — second-fork right.
7. Arena generator — outside the combat ring.
8. Copse bell — late optional pocket.

The nearest two active objects use continuous HRTF loops and can be heard from
more than twice their clear visual-read distance. This makes sound part of path
choice rather than ambience smeared over the whole forest. Hit an object to
break/silence it permanently. That action also creates a loud event at the
object's position; nearby sleepers turn toward it and bounded extra company may
answer. Unchosen branches and sealed-behind objects stop speaking.

### Mire and required ravine rope

The old apparent map edge is now black peat with reeds, suction rings, and a
half-swallowed chair. Walking in slows momentum and sinks the player by visible
depth while controls remain live. Remaining in it kills only after the body has
actually sunk.

Throw to the pale knot on the far-side rope and keep holding. The bite arrests
the mire, converts current motion into a controllable swing/pull, and preserves
the normal release verb. Release to carry the arc onto firm ground. The rope is
not considered spent and no checkpoint is taken until the player is grounded
past the far lip with the mire depth cleared. A chaser approaches from behind a
few seconds later.

### Second braid: washhouse fork

The second physical fork follows the same six-metre trial/commit law. The left
branch contains a washer; the right contains a refrigerator. Both are complete
walkable ribbons that rejoin the shared progress clock. Their distinct localized
sounds announce the decision before either appliance is fully visible.

### Forest arena

The arena generator and standing-stone ring mark the next commitment. The skull
screams on its own and the fight runs three waves: 3, 4, and 4 walkers, with
staggered arrivals and silence between waves. Stun to control, pop deliberately,
and keep moving out of committed strikes. Clearing it grants total quiet, grows
the skull, and places a post-arena checkpoint.

### Bell copse and Kneeler

The second optional rope pocket leads to a bell frame and marker stones all
turned back toward the house. It uses the same visible-deadfall and held-swing
law as the searchers' line.

Near the end, the Kneeler waits beside the route. Walk quietly past it. Loud
movement inside its wake radius makes it rise; it is faster than a walker and
cannot be killed. After a forest death/respawn, the encounter has a 3.25-second
grace window before the Kneeler can exist again, so the player can see, move,
aim, or throw instead of being re-caught before input begins.

The crooked final arch opens into the clearing. The Kneeler and forest pressure
do not follow into the sincere space.

## Act 5 — waterfall clearing

The clearing is a real place: closed forest edges behind, streams feeding a
visible plunge basin, shore plants and stones, drifting motes, rock-framed water,
and a layered waterfall ahead. Nothing hunts here.

The grown skull repeatedly turns toward the falls. Throw it into the waterfall.
This is the one time the game's promise breaks: it vanishes and cannot be
called. Stone steps rise one by one through the basin and the waterfall barrier
opens. Cross the visible stones and walk through the water/rock veil into the
cave.

If the optional bedroom locket was taken, it does not vanish with the skull.
After a few breaths it appears on the shore with a chime. Inspect/use it for the
optional keepsake resolution before leaving.

## Act 6 — Underfalls

The player is now skull-less: no weapon, carried light, or ordinary fetch
solution. Underfalls is a 125.158 m authored district whose visual floor,
collision clamp, line of sight, and enemy navigation all use the same route.

The main path has thirteen named beats:

1. Stone veil.
2. Undertow throat.
3. Intake apse.
4. Pump approach.
5. Chapel west aisle.
6. Chapel east aisle.
7. East ambulatory.
8. Lower sluice.
9. Sluice rise.
10. Upper sluice.
11. Overflow gallery.
12. Spill descent.
13. Hatch cistern.

The drowned pump chapel contains a real, progression-neutral dry-return
shortcut: look behind the central aisle for the culvert mouth, follow dry return
and pump undercroft into the bell cistern, then climb the service route to rejoin
the upper sluice. It saves distance and gives a different acoustic route; it is
not opened by a key.

### The Drowned Choir

After the chapel trigger, the Choir begins with a full audio warning behind the
player. It does not read the live player position. It follows the last world
position that made enough sound, can use the same legal culvert/route union, and
cannot cut through rock merely because two corridors are spatially close.

- Running is faster than its heard pursuit speed, but footsteps also update what
  it heard. Use route bends and committed attacks rather than expecting silence
  to make it disappear.
- At close range it enters a 1.05-second pressure tell and commits to the exact
  player position captured at the start. Sprint out of that footprint.
- The first successful catch is nonfatal: choking audio, camera fear, and the
  Choir's physical recoil teach the consequence. A later catch can kill.
- Lower-sluice and high-spill spray volumes reveal its fused drowned body,
  cancel a pressure strike, push it along the physical floor, and reset the
  first-catch mark. Water is the defensive verb after the skull is gone.

Follow the rising sluice and overflow route to the hatch cistern. Press E on the
ceiling-hatch interaction from below. The exit ends the Choir lifecycle before
the transition; no cave chase or audio loop should continue into the ending.

## Act 7 — wrong bedroom and mirror contact

The hatch enters a bedroom made from the opening room's memory: familiar bed,
dresser, door, window, lamp, and rug, wrong in their relationships. The player
still controls movement and look.

After the initial stillness, wallpaper drains from four already-live mirror
panes. The reflection is an articulated human body in worn tailored clothing,
but its head is an exact clone of whichever skull sculpt began this run. It
lags the player's recorded pose; the delay closes as the walls move.

There is no puzzle prompt and no hidden combat solution. The ending is contact:

- Mirrors advance while the room's furniture is physically consumed.
- Broken slats, rails, cloth, and frame remnants compress into the remaining
  square rather than simply popping away.
- Empty hands press and squeak against glass; pane pressure and deterministic
  fractures accumulate while the player still controls look and movement.
- At the final pane, the exact skull jaw opens and an impossible recall moan
  accelerates toward the room.
- The last playable image is contained between the real walls. Hard black occurs
  before movement/look freeze.
- After black: the familiar catch, title, and a localized human gasp. The ending
  fires once and then explicitly stops animation frames, audio, forest/cave
  loops, house/finale mirror targets, and retained warm-up resources.

That is the complete current route. There are no remaining **THIN** placeholders
in this walkthrough masquerading as implemented progression. Any future idea
belongs in a new, evidence-backed queue after this locally verified integration
is packaged, clean-booted, committed, and reviewed. That release chain is now
complete: Qualiacology PR #34 deployed `0.4.0-ossuary`, and the public FETCH
route passed an independent post-deploy browser boot. Future revisions begin a
new source → package → preview → production verification chain.
