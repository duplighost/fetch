# ROUND EIGHTEEN — the house answers, the woods conceal, the water witnesses

This is a bounded horror and readability pass over the completed FETCH route.
It does not add an objective resolver, skull guidance, a new required item,
damage, puzzle commits, checkpoints, control locks or a changed ending.

## Retained changes

### The house still exists when the act clock says basement

FETCH progression is intentionally monotonic. Returning upstairs after entering
the basement therefore leaves `game.act === 'basement'`. Old upstairs systems
incorrectly treated that progression label as a physical floor test, which
silenced the knock-back door and made the existing return horror unreachable.

`isPhysicalHouseInterior(game)` is now the shared physical predicate for the
Resident, cross-storey pursuit, return-horror observer and front-door answer.
Three fresh knocks after the stolen flame make the foyer coat stand fall and
lazily disclose one already-standing Resident down the foyer runner. The door
remains locked, the camera and controls remain the player's, and no progression
system reads the scare flag. The reveal bypasses the generic underground-rise
entrance because this body was hiding in the house, not being summoned through
its floor.

### Bodies belong to their reveal, not to boot

No new walker is created during world construction. The wreck passenger appears
folded inside the wagon only on its second hit and pulls itself through the rear
cargo opening toward the player's arrival side; a washer or refrigerator can
disclose one walker only after the player commits to the corresponding forest
branch.
Each scare detects a normal enemy-list clear and reconstructs an unspent reveal,
while an actually dying body stays spent. This follows the basement dropcloth
scare's ownership law and avoids bodies vanishing because a later act or arena
clears a boot-created list.

### The wreck keeps the keepsake

The Iron Canine remains above the sixth hero grave and still improves the skull.
The separate marrow keepsake no longer appears there. Four outbound hits destroy
the station wagon and eject the keepsake through a deterministic visible arc.
It lands beyond the wagon collider, remains lit on ordinary ground, and waits
0.9 seconds before becoming fetchable so the destroying throw cannot collect it
accidentally. Its original `relicKept` meaning is unchanged.

### A more readable, less vacant forest

Forest ambient scale rises from 0.54 to 0.60. Both optional swing pivots now
carry pale high-value knots, stronger emissive rope and one pooled candle
descriptor lighting the knot, support and landing. This adds no shader light.
The existing two commitment braids and two optional dead pockets remain the
route; the new appliance reveals give those decisions authored danger without
turning the forest into another combat gate.

### Underfalls takes longer and gets worse on purpose

The required wet route gains a real procession bend rather than a decorative
wall. A second analytic branch leads to a dead witness gallery. Main, secret and
blind paths share the same floor sampler, shell, clamp, line-of-sight and enemy
navigation union, preserving the district's no-pits/no-walk-through-rock
contract.

The final hatch approach places a drowned clone of MARROW's Presence directly
under the exit. Its too-long arms open around the held skull, its stop-motion
body tracks the player's voluntary approach, and proximity drives existing
fear, light flicker, positional sound and brief screen shake. It is not an enemy
or collider and cannot hurt, trap, steer or freeze the player. The dead arm
contains a smaller one-shot harmless lunge. Presence clones share geometry but
own their materials and animation handles; their inherited MARROW transform is
reset before mounting so neither can animate invisibly below the cave floor.

### The patient boot remains the load answer

Round Seventeen's parsed-HTML title, compositor return mark and background
shader-link wait remain intact. This pass adds no live PointLight and does not
introduce a first-use shader signature: all new illumination is represented by
descriptors borrowed from the boot-built light pool, all enemy bodies are lazy,
and both Presence figures share already-built geometry. The production warm-
start gate recorded an immediate title, 218 programs / 42 textures on the
hostile no-idle start, no frame over 150 ms across every act plus the waterfall
transition, 223 programs before and after that traversal, and a 0.2 ms already-
warm start.

## Verification order

Alex requested a full implementation handoff before expensive testing. The
pre-QA source ZIP was therefore created after cheap syntax/diff checks and before
the focused browser regression:

`FETCH-HORROR-POLISH-R18-PRE-QA-SOURCE-20260901.zip`

SHA-256: `0F10039053EA42DB0FD4931816D52CD78908768E4E94FD8623587DDBB187E4DB`

Final serial gates:

- Round Eighteen horror/lifecycle contract: 7/7, zero browser errors. The
  returned Resident is asserted fully above-floor and the hatch Presence at
  local y=0, preventing state-only "visible" regressions.
- Existing affected suites: house return 12/12, Underfalls 18/18, forest
  hardening 4/4, horror expansion 17/17, forest nervous system 9/9. Total:
  67/67, zero browser errors.
- `npm test`: autotest 26/26, regressions 157/157, smoke across every act,
  zero browser/console errors.
- Grave arena: all six deterministic seeds clear all three waves; token,
  control and death/respawn contracts pass.
- Full real-input playthrough: complete from the empty-handed bedroom through
  the mirror ending. If funeral throws awaken the new car passenger, the route
  now plays and resolves that persistent authored consequence before turning
  toward the mausoleum.
- Real NVIDIA GTX 980M / D3D11 GPU gate at 1280x800: 60 Hz delivered rAF p50
  and p95 in forest, clearing, cave and mirror. Explicit `Game.render` GPU p95:
  forest 10.770 ms, clearing 6.585 ms, cave 8.465 ms, mirror 24.478 ms, all
  beneath the 45 ms gate with zero disjoint samples or console errors.
- Canvas-read visual probe at ordinary 71-degree FOV: the returned Resident,
  rear-cargo passenger, landed relic, swing knot, appliance hider, procession
  fork, both hatch distances and blind-gallery lunge are all present in real
  WebGL pixels. `tools/probe-round18-horror.mjs` reproduces those frames.
