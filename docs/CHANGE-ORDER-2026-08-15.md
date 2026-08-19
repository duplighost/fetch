# FETCH - Change Order Only

**Audience:** Claude, who built the current game and already knows its systems, layout, progression, and code.

This is **only the requested delta from the current build**, organized in player-route order. It is not a design explanation and does not restate systems that are staying the same.

## 1. Bedroom opening

- **Rug reveal:** rehinge the rug so it folds outward without passing through the floor or folding into the bed. Do not use the simple sign-flip version that sends it into the mattress area.
- **Loose floorboard:** reverse/correct the reveal rotation so the free end rises above the floor instead of passing through it.
- **Incoming skull:** replace the unrestricted camera-pitch destination with an authored window-to-chest/hand route that stays inside the room and clear of the floor, ceiling, walls, and furniture. Keep the timeout only as an emergency fallback, not the normal catch.
- **Furniture collision:** make the major solid-looking furniture physically solid: bed, wardrobe, dresser, nightstands, and similarly large props. Move the wake position before making the bed solid so the player does not begin inside it.
- **Ceilings:** add player/head and skull collision to the rendered house ceilings/roof slabs.
- **Bell:** once the bell is visible, E should work immediately. Remove the visible-but-inert interval.
- **Discovery help:** keep it subtle, but allow the hidden-bell/rug guidance to escalate if the player has searched extensively without finding the required route.
- **Bedroom window:** do not show the open-route glint while the strong glass is still intact.
- **E targeting:** nearer physical geometry should block interaction with something behind it.
- **Before skull arrival:** give throw/call inputs a small authored response so they do not feel dead.

## 2. House exterior sightlines

- Dress the vacant exterior views visible from the house with convincing scenery: tree masses, graveyard silhouettes where useful, fences, terrain, vegetation, fog, stonework, distant structures, or blocked sightlines.
- Keep the original key tree recognizable from the graveyard.
- **Do not create a playable house-side return path, house-roof route, or mandatory later return into the house.** Those older ideas are discarded.

![House-side exterior view - scenery and blocked sightlines, not a playable return path.](images/figure-05-house-side-area.png)

## 3. Kitchen-to-basement stairs

- Make the visible stair mass and the physical stair mass agree. The broad sloped stone skirt currently reads as solid masonry while allowing the player to pass through it.
- Either make that visible stone mass physical or redesign it so the pass-through corridor clearly reads as open.
- A small landing/platform at the turn is fine if it improves the space, but the important change is visual/physical agreement.

![Kitchen-to-basement stairs - the broad stone mass reads as solid but can be entered.](images/figure-01-kitchen-to-basement-stairs.png)

## 4. Basement furnace and graveyard transition

- The pictured furnace/wheel-like contraption should not look required while being functionally unnecessary. Either make it genuinely control the furnace or change/remove the misleading presentation.
- Make the initial basement-to-graveyard transition feel spatially connected where practical instead of like an arbitrary pop between adjacent spaces.
- Do not turn later house re-entry into required progression.

![Basement furnace contraption - the visible step appeared unnecessary even though the scene presents it as meaningful.](images/figure-02-basement-furnace-contraption.png)

## 5. Graveyard entry - optional combined upgrade

- Reuse the **same gravestone that previously produced the mausoleum key**.
- Hitting/breaking that gravestone now reveals one optional pickup available **at any time after entering the graveyard**, including before the main battle.
- Combine both effects in that pickup:
  - Iron Canine / stronger skull;
  - the danger-sense effect currently associated with MARROW.
- Upgrade Iron Canine so a qualifying powered hit **tears through ordinary enemies**, kills decisively, retains useful momentum, and can continue into another ordinary enemy behind the first when alignment supports it.
- Do not apply that piercing behavior indiscriminately to bosses, puzzle actors, the Presence, or other special encounter logic.
- Keep the danger-sense visual behavior on the skull ornament.
- Carrying a key in the skull's mouth must not weaken a strong enough hit.

## 6. Graveyard main battle

- Tighten the fight so living enemies stay engaged and locatable instead of leaving the player hunting passive stragglers.
- Defeating the battle is the event that reveals the three gate-key routes.
- Make the post-battle transformation obvious. The three routes may appear together or sequentially, but each opening should be unmistakable when it becomes available.

## 7. Gate Key #1 - first mausoleum

- After the graveyard battle, open the first mausoleum **without requiring a key to enter**.
- Keep its compact existing challenge substantially intact.
- Put **Gate Key #1** at the end as the reward.

## 8. Gate Key #2 - second mausoleum / MARROW

- Move the existing MARROW encounter **under the second mausoleum**.
- Remove/retire the old grave-adjacent MARROW surface entrance entirely.
- The second mausoleum opens after the graveyard battle without requiring a key to enter.
- Keep MARROW's existing Presence -> relic theft -> statue-hunt phase change substantially intact.
- Keep the Presence as a special body-approach interaction rather than turning it into an ordinary skull-damage target.
- Keep statues moving while unobserved, freezing while watched, and being shoved by skull impacts.
- Keep the later Presence return as the scare/escort beat.
- Do not add a statue-placement puzzle against the wall.
- Remove danger sense as MARROW's reward because that ability now belongs to the optional combined gravestone pickup.
- The endpoint reward is **Gate Key #2**.

![Old grave-adjacent MARROW entrance - retire this entrance after moving MARROW beneath Mausoleum #2.](images/figure-03-old-marrow-entrance.png)

## 9. Gate Key #3 - original key tree

- After the graveyard battle, make one or several of the glowing balls on shiny hanging strings descend from the **original key tree**.
- Use them to create a readable traversal climb up the same tree from the opening of FETCH.
- At the top place:
  - **Gate Key #3**;
  - the bones/body of a skeleton;
  - **no skull on that skeleton**.
- Make the missing skull visually deliberate.
- Give the player a clear safe way back down while carrying the key.
- Do not extend this into the house roof or a house-return route.

## 10. Three-key graveyard gate

- Give the graveyard gate three visible key positions/sockets.
- Keys are banked at the gate rather than requiring the skull to carry multiple keys at once.
- Each installed key stays visibly present.
- Key routes may be completed in any order.
- The gate opens only after all three keys are installed.

## 11. Graveyard world presentation

- Dress the naked-looking graveyard perimeter with graves, walls, trees, fencing, terrain variation, rocks, fog, vegetation, architecture, and blocked sightlines.
- Preserve the visual relationship between graveyard, house, and the original key tree without turning that relationship into forced backtracking.
- The house-side vacant edge remains scenery, **not** the discarded playable return path.

![Graveyard perimeter - the edge currently reads as the end of the authored map.](images/figure-04-graveyard-map-edge.png)

## 12. Graveyard-to-forest transition

- Replace the ambiguous current transition with one coherent player-facing entrance.
- Use a visible lid/hatch/gate state with the interaction point on the side the player naturally approaches from.
- Do not let ordinary walking over the area drop the player underground.
- Make the visible opening and collision agree.
- If the new three-key gate makes the old transition geometry unnecessary, remove/rebuild the obsolete pieces rather than layering the new route over them.

![Forest transition - no clear player-facing entrance and walking over it can drop the player underground.](images/figure-07-forest-route-no-handle.png)

![Forest hatch - the lid/handle currently read from the wrong approach side.](images/figure-08-forest-route-hatch-wrong-side.png)

## 13. Forest approach

- Populate the currently sparse graveyard-to-forest path with selected newer enemies that emerge from the ground.
- Add enough scenery and staging that the route feels authored rather than like empty connective tissue.
- Keep it a transition route, not another huge detour.

![Forest approach - add scenery and selected ground-emerging enemies here.](images/figure-06-path-to-forest-enemies.png)

## 14. Forest collision and world boundaries

- Fix the pictured large solid-looking object so its physical footprint matches its visible mass, or redesign the visible form so the enterable space reads as open/ruined.
- Close the accidental routes that let the player leave the authored level and wander through empty terrain toward the graveyard/house.
- Preserve geography through intentional sightlines and landmarks rather than accidental out-of-bounds travel.
- Dress the left and right waterfall/forest edges so they read as authored branches rather than unfinished perimeter.

![Forest prop - the visible mass is much larger than the part that currently stops the player.](images/figure-09-forest-prop-collision.png)

## 15. Frozen waterfall - required left and right branches

- Start this region with the waterfall frozen/blocked.
- Turn the currently vacant left and right spaces into **two required side routes**.
- Each side gets:
  - a compact authored path;
  - an environmental combat encounter or small boss;
  - a creepy shed/mechanical structure;
  - a skull-operated wheel or related mechanism.
- Completing the left side permanently activates a visible left-side fire system blasting the frozen waterfall.
- Completing the right side permanently activates a visible right-side fire system.
- The waterfall thaws only after **both** fire systems are active.
- After thawing, continue into the existing central waterfall progression/sacrifice.
- The two fights should use their spaces and machinery rather than being generic HP arenas, and the left/right encounters should not be copies of one another.

## 16. Cave / post-waterfall skull state

- After the waterfall takes the skull, no transition/helper should silently restore it before the story intends it to return.
- Leave the existing cave / Underfalls route otherwise alone unless a change above directly requires an adjustment.

## 17. Ending

- In the final room, raise the player's hands into view.
- Reveal unmistakably that the hands are skeletal.
- Give the visual enough room to land without over-explaining it in text.

## Do not resurrect these older alternatives

- No playable side path from the house.
- No house-roof route.
- No mandatory return into the house after the graveyard.
- No separate grave-adjacent MARROW entrance.
- No danger-sense reward inside MARROW.
- No powerup attached to any of the three gate-key routes.
- No key required to enter either mausoleum.
- No fixed order for the three post-battle key routes.
- No gate opening before all three keys are installed.
- No statue-placement puzzle against the wall.
- No third key on a generic side path or house roof; it belongs on the original tree.
- No assumption that carrying a key globally disables skull damage.

