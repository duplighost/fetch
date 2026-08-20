# ROUND THIRTEEN — say "fetch" and start here

**Read this first, then `THE-TRUE-ENDING.md`, then get to work. Do not wait for
his notes** — his standing instruction: *"you should just have them do it
without my notes. if i have notes ill give them notes."*

## Where things stand

* `claude/aug22-round12` — six fixes, all his notes from 2026-08-19. See
  `ROUND-TWELVE.md`. **Deploy status: see the bottom of this file.**
* The site is `duplighost/qualiacology` with its own copy of the 22 src files at
  `fetch/src/`. **The game repo deploys NOTHING.** Shipping is a copy
  (CRLF→LF), never a deploy from here. `AGENTS.md` at the site repo root is the
  canonical playbook — read it before touching the site.
* `Projects/fetch-claude` is STALE. Worktrees only.

## What he said about the pace

On 2026-08-19, mid-session:

> "like, we are crawling along slowly through these fixes lol. at this rate
> we'll never actually get to the area that needs the most work lol. i doin't
> know why we can't find better ways to do this lol"

He is right and the cause was diagnosable: one item at a time, each with its own
browser probe, serially. **Fan out.** Run the gate battery in parallel batches
(`tools/run-gates.mjs`), and diagnose independent items concurrently. Source
reading parallelises perfectly; only browser work contends.

**"The area that needs the most work" is the cave / Underfalls.** That is where
he wants to get to. Everything else on this list is smaller than it looks.

## The agenda, his words

### The cave — his priority

| # | his note | state |
|---|---|---|
| 7 | "im not seeing a steam effect in the air or the first person water on camera effect... it would be cool if the ground did have it" | **never built.** Costed in the round-eleven triage and deliberately deferred until the cave had a floor. It does now. |
| 10 | the Drowned Choir "still show up but we'll redo some of this area a lot. it would be cool if they are in steam" | expected — round eleven removed the Choir's *kill*, not the Choir. He is fine with it. Wants it in steam. |
| 9 | "walkway under waterfall doesn't look good" | one huge pale flat slab filling the frame. **A previous brightness diagnosis did NOT survive checking — do not repeat it.** He is seeing it properly lit for the first time since the missing-floor fix. |
| 8 | "what is this, it doesn't move or do anything" | a very large dark cone/funnel hanging from the cave ceiling, workbench below left. An object the player asks "what is this" about has already failed the legibility law. |
| 4,5,6 | "some of these walls you basically have to walk through" (×3) | round twelve rebuilt the flank walls per-tread with a footprint test. **Verify it actually closed all three** — #6 (standing inside a pinkish-tan surface) may be a different object entirely. |

Also from his first round of notes, and not yet built: droplets on the camera
when you get splashed, ceiling drips, a wet rock path, steam at the edges but
**not on the path**.

### The house

| # | his note | state |
|---|---|---|
| 3 | "can we make this bell at the bottom of the stairs at the first basement look like its wired to the rest of the puzzle" | **identified.** It is `basement-required-pilot-bell` in `house.js`, at world (3.35, −3.0…−0.9, 5.6) on the +Z wall of `bcorr`; fetch target `basementPilotFlame` at (3.35, −2.12, 5.55); the gold rod runs up to (4.71, −0.62, 5.8). **It already IS the pilot flame** — genuinely wired. Pure legibility. Precedent: round nine's ossuary conduit wire. |
| 2 | "the pully in the room... has an empty space next to it where the wall has nothing - i was thinking we could make another jailcell with the mosst freaky creature every just shaking the bars" | the basement `crawl` (world x −12..−4, z −10..2), the `crawlCounterweight` cage. Buildable at ~+2 draws but **on the SOUTH wall** — a west-wall version breaks `tests/playthrough.mjs`. Occupant should reuse `steppedJerk` and must never be able to leave or path to the player. |
| — | the furnace order glitch | round twelve fixed the *gauge*, which was lying. **That was not an order fix.** The open question is whether the furnace condition is evaluated continuously or only on an event — if only on the pilot-bell strike, satisfying the last precondition elsewhere leaves it cold, which is exactly the shape he described, and explains why a checkpoint reload appeared to fix it. |
| 1 | "texture above the key in the ostuary flashes in and out with a brick texrue" | round twelve fixed one ossuary z-fight (`515ebef`). Confirm whether that covers this panel or whether it is a second coplanar pair. He may simply have been playing the un-deployed build. |

### The forest

| # | his note |
|---|---|
| 11 | "if we could get this hanging ball to be even more visible above the sand trap in the forest, it would be great" — apply the announce kit built for the key tree (round ten) and extended for the ravine knot (round twelve): corona sprite, material/geometry/scale, periodic audio with `ref`/`roll`. Pin it in `tests/legibility-regression.mjs` the way the key tree is. |

### The coda

See `THE-TRUE-ENDING.md`. He sent a finished rhythm game to attach after the
ending and asked that the transition not lag.

## Traps this project has already paid for

* **Never edit a `src/` file while a gate is running.** An autotest died on
  `Unexpected token ')'` because of exactly this.
* `world.finishStatic()` merges under `mat.clone()`, so a material identity
  comparison against the source **can never match**. This hid the cave floor
  for four rounds.
* Every gate runs `?test=1`, and `?test=1` skips the warm passes. **A round
  that adds a code path only real players take has no gate on it by
  construction** — audit the diff adversarially before shipping. The last time
  that ran it found six real defects.
* Legibility is **contrast**, not brightness. Render until two frames are
  byte-identical before measuring — `render()` decays impact light and jitters
  the camera while `_shake` is alive, and un-settled frames gave the opposite
  conclusion once already.
* MeshStandardMaterial has a fixed 0.04 specular, and the carried lantern
  delivers ~131 irradiance at arm's length, so almost any albedo clips to white
  close up. The kit's workhorse is Lambert.
* `groundHeightAt` reads ramps/rooms/terrain, **never colliders**.
* Chrome's GPU program cache is per-profile — an A/B in one browser is not an
  A/B. Launch a fresh browser per scenario.
* The recurring failure mode here is **working-but-illegible**, not broken.
  Silence reads as broken. Measure legibility and pin it as a regression.

## District draw-call budget (ceiling 450)

house 339 · house-after-cave 365 · graveyard 327 · forest 299 · clearing 149 ·
cave 137 · ossuary 142 · marrow 140

The house is the tightest. **The cave has the most headroom** — which is
convenient, because the cave is where the work is.
