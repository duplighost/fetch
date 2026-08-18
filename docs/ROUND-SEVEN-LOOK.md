# ROUND SEVEN — MAKE IT BEAUTIFUL. DO NOT BREAK IT.

**Read this first when Alex says "fetch". This round is the graphics pass and
nothing else.** The four gameplay notes of round six are built, gated and LIVE
on qualiacology.com/fetch/; the record of that work is in `docs/ROUND-SIX.md`
and you do not need to re-open it.

---

## The brief, in his words

> "i want them to make the game look stunning, but make sure it still runs
> great"

> "they should not mess with function"

> "i don't want the graphical pass to fuck anything up. i just need it to look
> great." … "maybe theres an easy way to make the game look better without
> making it slow."

**He will post the reference image again.** Ask for it if it is not in the
thread — it is the single most useful artefact in this round, and the read
below was written while looking at the actual pixels, so trust it if you cannot
see them.

Those two sentences are the whole job description, and they are in tension on
purpose. Every instinct that says "while I'm in here I'll just fix…" is the
thing he is telling you not to do. **You are not being asked to improve the
game. You are being asked to improve how it LOOKS, and to leave everything
else exactly as it is.**

---

## What "do not mess with function" means, concretely

These are not preferences. Every one of them has been violated at least once
and shipped.

1. **Do not touch gameplay code to make something look better.** No changes to
   the throw grammar (press = throw, HOLD = it stays out, RELEASE = it zips
   home; no charge), `FEEL_PROFILE` in `skull.js`, throw arcs, catch timing,
   enemy constants (`DROWNED_CHOIR`'s seven numbers are pinned by a test),
   puzzle logic, verbs, or checkpoints. If a frame needs an object moved and
   that object is a collider, a fetch target or a route node, **stop and ask.**
2. **Never add, remove, or visibility-flip a LIGHT at runtime.** The visible
   light count keys every shader program; changing it recompiles the entire
   game mid-play. Use pooled `world.candles` or
   `world.reserveLoanLights`/`loanLight`. Moonlight through a window is painted
   glow or an emissive value — never a light. (`World.pinLight` intercepts
   `.visible` on pinned lights, which is why district light flips are already
   safe. Do not "improve" that.)
3. **Any NEW material is a new shader program, and an unwarmed program is the
   round-five freeze born again** — that bug cost ten-second stalls mid-play
   and took a whole round to kill. If you add a material, it must exist and be
   compiled by the boot warm pass, inside the pinned light census. Adding a
   MAP where none existed flips a shader define: also a new program. Changing
   roughness/metalness/colour VALUES on an existing material is free.
   **After any new material: the warm-start gate, plus a `?hitch=1` walk.**
4. **He is colourblind.** No read may depend on hue. Value, shape, motion,
   timing. This matters more in this round than in any other.
5. **No HUD, no on-screen words, no control theft.** Copy is his voice, never
   invented.
6. **Draw budget: hard 450 per district**, geometry 1500. Both are gates. The
   graveyard has NO headroom (see below).

---

## The reference image — the read (seen 2026-08-18)

First-person, both hands holding the skull at chest height, in a ruined bedroom
at night. **That bedroom is the game's own opening bedroom** — same lantern on
the dresser at frame left, same window dead ahead with the key on a string,
same wardrobe right, same floral wallpaper. So the image is not only a
direction; it is a before/after of a frame FETCH already has, and it is the
cheapest place in the game to test whether a change is working.
`tools/shot-grip.mjs` shoots that exact pose.

**It is a value image, not a hue image.** Everything it does survives
greyscale. Port it entirely in value, shape and texture terms.

The four properties that make it read, in porting order:

1. **Value structure: black corners, one warm pool, one bright focal.** The
   room dies to near-black in the corners and at the ceiling. The lantern owns
   ONE pool with believable falloff. The skull is the brightest thing in frame
   and sits against dark mid-ground; the window is a cool second source that
   silhouettes rather than fills. **Nothing sits in fog-grey mids — that is
   FETCH's one recurring value failure**, and it is what the graveyard's car,
   bodies and mausoleums all are. This property, not any object, is what
   generalises: judge every target by whether its FRAME has it.
2. **A vignette and fine grain over everything.** All four corners darkened,
   low-amplitude noise across the frame. Most of the "photograph" feel is these
   two and they are screen-space cheap — but read the warm law (#3 above)
   before building either, and note that a game-wide overlay moves every
   measured number in every legibility test.
3. **Wear on every surface, at LOW contrast.** Damage in the wallpaper, grain
   and a specular sheen on the boards, the rug threadbare. Fine noise that
   never fights the value read. **Every FETCH surface is a boot-painted canvas
   — there are no image files in this game — so wear is free where it matters:
   zero draws, zero programs, just more honest painting in the texture
   functions.** This is the highest value-per-risk lever in the whole round.
4. **Chunky dark masses, thick frames, one pale thing per frame.** The
   furniture is heavy, soft-edged, dark; openings wear thick trim; each frame
   holds a single bright subject.

---

## His named targets

He called these out himself, twice.

- **The bodies in the graveyard.**
- **The car in the graveyard.**
- **The mausoleum EXTERIORS in the graveyard.**
- **The hands.** His latest: *"the hands are at least on the right angle now.
  they still don't look like human hands though."* The pose is solved and
  measured — fingers rise near-vertically up the sides of the cranium, backs
  and knuckles to the camera, and the seat measures ZERO percent of hand
  vertices inside the skull (`tools/probe-grip-clip.mjs`,
  `tools/shot-grip-sweep.mjs`). **What is left is the GEOMETRY, not the
  orientation**: next to the reference the fingers read thick, evenly spaced
  and sausage-like, where his taper and sit closer together. That is `mkHand`
  in `skull.js`. Changing finger proportions is a look change and is in scope;
  changing `_grip`, the catch feel or the throw is not.

**The first three are not three art problems. They are ONE value problem with
three faces** — every one of them is a large, untextured, PALE mass in a frame
that is otherwise 40–80% near-black.

---

## The work queue — measured, ranked, and it is also the stopping condition

`tools/shot-graveyard-frames.mjs` shoots fourteen poses covering the yard the
way a player moves through it, each with its near-band luminance and its draw
count. Numbers in `tests/results/graveyard-frames.json`, frames in
`scratch-graveyard/before/`. **They were opened and looked at.** Ranked
worst-first by one question — *what is wrong with this picture at a glance?*

1. **THE CAR IS A WHITE SLAB** (frames 04, 03, 05). Near-band mean 42.9
   standing beside it; it reads as an unpainted plastic model, not wrecked
   steel — flat panels, no wear, no value break. **AND it costs 808 draws
   standing beside it, 709 from inside its beam.** Nobody had recorded that:
   the car is the second-worst draw cost in the district.
2. **THE MAUSOLEUM EXTERIORS ARE WHITE BOXES** (11, 12). Four untextured pale
   planes and a cone roof, every line straight and unbroken, palest thing in
   frame (max 230), and 12 is the only frame in the set that clips.
3. **THE BODIES ARE PALE MANNEQUINS** (07, 06). `outside.js:3641` says this was
   fixed by dropping the skin to `0x241f1c` and explains the maths — and
   standing over one still gives a near-white figure on near-black ground. So
   whatever owns those pale pixels is NOT the skin. **Measure which material it
   is before changing a colour** — the hide-one-thing-at-a-time attribution
   pass in `tools/shot-shore.mjs` does exactly this.
4. **MID-YARD LOOKING SOUTH: 1203 DRAWS** (08) against the 450 ceiling. Not a
   beauty problem — a headroom problem. **Nothing can be SPENT in this yard
   until some of this is taken back.**
5. **NO MIDS, NO FOCAL** (02, 14, 10, 01). 70–80% of the near band is
   near-black with nothing to look at: the corners of property 1 without its
   warm pool or its focal. 01 is the ARRIVAL — the district's first frame — and
   it is a dark nothing at 413 draws.
6. **The north views already read** (09, 13: mean 33.3 and 21, and the gate
   lanterns give them a real focal). Bottom of the queue. Leave them.

Not on his list but visible in every frame: **the grass carries its read in
hue** — a flat saturated green — which is the one channel he cannot use, and it
is the largest surface in the district, so its value is what every pale object
is being judged against.

**Do not add to this list mid-pass.** When a frame reads, stop. An object is
never finished; a frame is.

---

## The tactic that keeps this from eating the week

**You are not improving a car. You are improving the FRAMES a player stands
in.** Objects get improved as a side effect, and — critically — you stop when
the FRAME reads, not when the object is finished.

1. The pose list and the before-set already exist for the graveyard. For any
   other district, build them first: copy `tools/shot-graveyard-frames.mjs`,
   which does pose → PNG → near-band measurement → draw count.
2. **Open every PNG and look at it.** Project law: every wrong call in this
   repo came from reasoning about a frame instead of opening it. "It reads" is
   not a number; the shot tools print the numbers so you have both.
3. Fix the top frame. Re-shoot. Re-rank. **If a change does not move a frame up
   the list, revert it.**
4. **One hour per frame, maximum.** If it is not better in an hour, commit what
   helped, write down what did not, move on.

## The four cheap levers, in order of value-per-draw-call

1. **Silhouette variety through instancing.** Repeated identical shapes in a
   row is the single biggest "cheap 3D" tell. `InstancedMesh` gives per-instance
   scale, rotation and colour for free — jitter them. Round five's entire basin
   lip is 52 instances on a mesh that already existed: zero new draws, and it
   fixed the read completely.
2. **Value separation.** Nearly every "it looks bad" in this game has been a
   value problem: things that should be dark reading pale, or two objects at the
   same value merging into one blob. Push ground and bulk DOWN, keep one or two
   things pale. `setColorAt` per instance is free.
3. **Breaking straight lines.** Rotating a box a few degrees, sinking it into
   the ground, overlapping two of them reads as masonry. `world.box` into a
   material the shell ALREADY batches costs nothing at all.
4. **Grouping detail where the eye goes.** Detail near the path and at eye
   height pays; detail on a roof 12 m up does not.

## The three traps this project has already fallen into

- **A lit MeshStandard blows to white near the lantern, whatever its albedo.**
  Measured on the shore lip: `0x46535d`, `0x232c33` and `0x0e1318` gave
  near-band means of 50.9, 44.7 and 36.5 — a fivefold albedo cut for a 1.4×
  pixel cut. If something must stay dark at two metres it has to be unlit
  (`MeshBasicMaterial`), or accept that pale IS this game's near-lantern look.
- **A new material through `world.box`, or any new `Mesh`, is +1 draw call
  forever in every act** unless it is act-gated into a district root array.
  Prefer instances on meshes that already exist.
- **Working-but-illegible is the recurring failure**, not broken. Measure
  (near-band mean/max/clipped, luminance ratios, view-cone reveal integrals),
  do not eyeball it alone.

---

## Gating — this is how "it still runs great" gets proved

**Run the FULL suite after EVERY polish commit, not at the end.** A commit that
reddens a gate gets reverted, not argued with. Small commits make that cheap.

```
node tests/smoke.mjs
node tests/autotest.mjs                     (26 checks)
node tests/regressions.mjs                  (157 checks)
node tests/playthrough.mjs                  (must print COMPLETE)
node tests/warm-start-regression.mjs        (the freeze gate — CRITICAL here)
node tests/basin-shore-regression.mjs
node tests/choir-surfacing-regression.mjs
node tests/district-culling-regression.mjs  (the draw ceiling: max 438/450)
node tests/render-perf.mjs                  (the frame-time gate)
```

- **Never pipe a test through `tail`/`grep`** — it buffers to EOF and a
  40-second run looks like a hang. Redirect to a file.
- `stepWith(seconds, controls)` — seconds FIRST; movement is `moveZ`.
- Debug: `?hitch=1` logs every frame over 150 ms with its program/geometry/
  texture deltas. `__FETCH.warm()` reports the warm state and press-to-play.
- Screenshots: Playwright + system Chrome (D3D11, never swiftshader), captured
  with `canvas.toDataURL` INSIDE the frame task — `page.screenshot` on this
  renderer is black by construction. Every tool in `tools/` already does it
  right; copy one.

**Known PRE-EXISTING failures — do not chase them, do not "fix" them by
weakening the suite:**

- `tests/underfalls-expansion.mjs` fails TWO checks (verified identical on the
  untouched round-four tree).
- `tests/grave-arena-regression.mjs` fails ONE — "every fight uses quiet stuns
  and deliberate loud pops", because two of six seeds miss the bar (seed 145
  pops 15 against a required 16; seed 583 quietStuns 9 against pops 18).
  Verified identical, same seeds and same numbers, on the round-five tip.

---

## The tools you will want

| tool | what it gives you |
| --- | --- |
| `tools/shot-graveyard-frames.mjs` | the 14 graveyard poses, near-band luminance, draw count each |
| `tools/shot-shore.mjs` | pose → PNG → near-band, plus a hide-one-thing attribution pass |
| `tools/shot-grip.mjs` | the held hands in the reference bedroom, and the blend samples |
| `tools/shot-grip-sweep.mjs` | aim a hand pose from a finger + palm direction; reports % buried in the skull |
| `tools/probe-grip-clip.mjs` | the held rig measured in hold space |
| `tools/shot-crossing.mjs` | the falls crossing, before and after the bargain |
| `tools/probe-audio-live.mjs` | a REAL AudioContext: live sources, context state, master gain |

---

## What is live, and what is still open

**LIVE** on qualiacology.com/fetch/ (production boot-checked green): all four
round-six notes — the foyer mirror replaced by the odd family photograph, the
crossing you can fall off and survive, the Choir surfacing in front of you, and
the re-aimed hands — plus the audio watchdog and the one-press hatch.

**STILL OPEN, and none of it is this round's job unless he says so:**

- **The graveyard key under the tree.** He opened a latch and never saw the key
  reveal. Untouched. This is the legibility class exactly: measure the reveal
  (view-cone integral, luminance ratio) rather than assuming it reads.
- **The cave sound failure.** "loud sound until it just stops playing sound."
  NOT reproduced by three probes; a watchdog and a voice cap now make it
  non-permanent and self-reporting. **If he hits it again, ask him for
  `__game.audio.voiceStats()`** — `dropped > 0` means something stormed the
  mixer, `resumes > 0` means the browser suspended us.
- **"The back wall that you can go through a bit"** in the cave. Unexamined.
- **The graveyard's south view at 1203 draws.** Queue item 4 above.

---

## Deploying (only with his explicit approval to merge)

Two repos. The game is `duplighost/fetch`; the live site is a shelled copy at
`fetch/` inside `C:\Users\Alex\Projects\qualiacology` — **read ITS `AGENTS.md`
first.** Land the game branch green → copy the changed `src/` files in with LF
endings → verify all 22 byte-identical → port any `index.html` change by hand
(the site keeps its own head) → branch, PR → local
`node build/scripts/static-server.mjs --root=. --port=4173` +
`node build/qa/fetch-boot-check.mjs http://localhost:4173/fetch/` →
`cd build && node scripts/build-site.mjs && node scripts/validate-site.mjs --root=..`
+ `node qa/browser-qa.mjs` → boot-check the Netlify deploy preview → **his
approval** → merge → boot-check production. Never deploy from the game repo.

---

## And the standing brief

He funds this generously, plays live, and wants ambition — *"surprise the hell
out of me and terrify me."* He forgives rough, not broken. **When he repeats
himself it is because we did not do it the first time.** And the instruction
every model under-uses: **raid his other games** in `C:\Users\Alex\Projects\`.
`marrow` is where this graveyard came from — its car, its bodies, its
buildings — so look there first for all three named targets. Every strong thing
in FETCH has been a port; every weak thing was written fresh.
