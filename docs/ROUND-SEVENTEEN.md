# ROUND SEVENTEEN — patient boot, late pull, creature polish

This round is a polish-only pass over the shipped game. It does not change the
throw grammar, collision, damage, puzzle commits, checkpoints, encounter
counts, route geometry or ending. Its three bounded changes are:

1. The parsed HTML title paints before world construction. Shader programs and
   textures are still warmed once, but no WebGL world draw is allowed to force
   unresolved ANGLE links onto the main thread. The return mark is a compositor
   animation during that wait. The moon shadow is armed for its first real
   frame instead of causing a constructor-time render.
2. A held skull can lean toward one mandatory, currently actionable objective
   only after 72 seconds with the same objective set. The lean lasts at most six
   seconds, rests for twelve, locks one nearest choice in order-free clusters,
   routes cross-floor targets through the house stairs, and is suppressed by
   combat, threat, charging, throwing, anchoring, death and the arrival flicker.
   It is viewmodel presentation only; aim and all throw constants are untouched.
3. The bedroom hatch-board has a wider outline and physical hinges. Walkers and
   the Resident use more legible material values and stronger dimensional faces
   while retaining the same hit volumes, animation contracts and AI.

## Exact mandatory player path

### Bedroom

The rug must be searched, then the loose board, then the bell under it must be
struck. The skull arrives through the window only after that bell sequence. The
player then fetches `treeKey`, carries `bedroomKey` in the jaw, strikes
`bedroomLock`, and leaves through `bedroomDoor`. There is deliberately no skull
guidance before the bell because the skull does not exist in the player's hand.

### House

Fetch `stairKey`, carry it to `stairLock`, and open the stair route. The sealed
`voidDoor` must first answer a throw; that response discloses the window relay.
Throw the skull to `livingWindowMooring`, hold/carry the route, and release so
the returning skull rings `studyWindowReceiver`. The relay opens the void door
and exposes `guestFlame`; fetching that flame gives the skull the ember state.
All three cellar boards (`board0..2`, with edge hit points sharing each board's
single commit) must be broken. The relay circuit and boards release
`cellarDoor`, which leads to the basement. The Resident is pressure, not a
progression target.

### Basement

Two early jobs may be approached in either order: carry the guest ember to
`basementPilotFlame`, and hold the skull in `crawlCounterweightCradle` until the
crawl mechanism latches. The crawl weight enables the meaningful pump job;
hold `pumpWinchCradle`, then hold `archiveDraftLamp` to complete the two-part
draft. With pilot, pump and archive active, open `incineratorDoor` and throw the
skull into `firebox`. The furnace refuses it and exposes `hatchKey`. Fetch that
key, strike `hatchLock`, then use the hatch to enter the graveyard.

### Graveyard

The funeral may be resolved by surviving the authored combat waves or by
striking each of the three `resonantGrave` targets once. Either resolution opens
three key errands. The errands can be completed and banked in any order, one key
in the jaw at a time:

- Ossuary: use `ossuaryDescend`, hold `ossuaryKennelCradle`, then hold
  `ossuaryCounterweight`; fetch `gateKey1` and climb back.
- Marrow: use `marrowDescend`, approach the guardian until it yields, receive
  `gateKey2`, then use `marrowAscend` while escaping the awakened statues.
- Tree: strike `keyTreeBranch` once, then fetch the dropped `gateKey3`.

Each carried key goes to `gateSockets`. Three banked keys open the forest gate.

### Forest, clearing, cave and mirror

Strike `fallenTree` until its authored break completes, cross the ravine by
anchoring to `ravineRope`, survive the forest arena, and follow the physical path
to the clearing. At the frozen falls, the west `fallsWheel` hold and three east
`fallsPlate` tolls may be completed in either order. Together they thaw the
falls. Throw the skull into `waterfall`; it does not return. The remaining cave
route and hatch are deliberately skull-less and linear. The mirror sequence owns
the finale from there.

## Guidance objective policy

Optional searches, relics, destructible side graves, the wreck, powerups,
ambient props and enemies are never guidance candidates. An objective-set
change resets the full 72-second grace. In a multi-job cluster the nearest
candidate is selected once and held until progress changes the cluster; this is
what prevents flicker between floors or between two valid machines. The forest
fallback follows a point twelve samples ahead on the authored spline rather
than pulling through trees toward the distant endpoint.
