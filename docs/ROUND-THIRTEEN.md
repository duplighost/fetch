# ROUND THIRTEEN — say "fetch" and start here

**Read this first, then `THE-TRUE-ENDING.md`, then get to work. Do not wait for
his notes** — his standing instruction: *"you should just have them do it
without my notes. if i have notes ill give them notes."*

## SHIPPED — round twelve is LIVE (2026-08-19, evening)

Site PR #79 merged (squash, site main `0a582c6`). **Production serves it, and
all five changed files were fetched back off qualiacology.com and verified
byte-identical to the repo.** The game repo's `main` was fast-forwarded to
`438a665`, so main IS the live game again — worktree off `origin/main` as usual.

Site gates on the branch: build-site (no generated-page drift), validate-site
(4 hub pages, 25 games, 11 releases), route-smoke (44 routes, 21 intentional
404s), `npm run qa` (10 viewports, 8 routes, zero serious/critical Axe
violations), and **fetch-boot-check PASSED** — world on screen 8175 ms, 512
contiguous lit frames, hand-lit 44.7%, zero errors.

**He had not played it at the time of writing. Tell him to hard-refresh.**

One gate is knowingly RED — see the bottom of `ROUND-TWELVE.md`. It is a
geometry-accounting failure in `perf-pool-regression` caused by this round,
proven *not* to be a gore-pool leak, with the mechanism NOT established and the
obvious hypothesis refuted by measurement. It shipped red rather than loosened
to fit a story, because nothing about it reaches a player. That judgement is
worth revisiting with fresh eyes.

### Verified by screenshot, at his request

He asked: *"we sshould actually take a screenshot or something to make sure you
put the sign in the right place on the door and that it goes away when the door
opens"*. `tools/probe-door-sign.mjs` does that (WebGL readback — never
`page.screenshot`, which composites the canvas black headless). Four frames in
`shots/door-sign/`. Result: the plate is centred on the panel (0.92 m from the
hinge on a 1.9 m door), sits at eye height, is legible from the stairs, and
swings away with the panel when the door opens — edge-on and tiny in the open
frames. Caveat recorded honestly: those frames pose the camera directly and so
carry no lantern, meaning real play is brighter than they look.

## Where things stand

* `claude/aug22-round12` — six fixes, all his notes from 2026-08-19. See
  `ROUND-TWELVE.md`. **Deploy status: see the bottom of this file.**
* The site is `duplighost/qualiacology` with its own copy of the 22 src files at
  `fetch/src/`. **The game repo deploys NOTHING.** Shipping is a copy
  (CRLF→LF), never a deploy from here. `AGENTS.md` at the site repo root is the
  canonical playbook — read it before touching the site.
* `Projects/fetch-claude` is STALE. Worktrees only.

## THE DIAGNOSIS IS DONE — read `analysis/ROUND-THIRTEEN-PLANS.md`

A parallel triage run (22 agents, 4.55M tokens, 66 minutes, zero failures) produced
a challenged patch plan for **every** item in his notes. Each plan was then handed
to a second agent whose only job was to refute it. **That pass found 23 blockers
across 10 of the 11 plans** — including one plan that walked straight into the exact
trap it claimed to have designed around.

`docs/analysis/ROUND-THIRTEEN-PLANS.md` (429 KB) has the whole thing: findings with
file/line/evidence, raw steps with verbatim anchors, cost, risk, and — the part that
matters — a **"Execute THIS"** corrected plan per item. **Apply the corrected plan,
not the raw steps.**

### One trap that applies to applying ANY of them

`src/underfalls.js` uses **CRLF** line endings (1671 CR characters across 1672
lines). Multi-line anchors written with LF joins match **zero** times against the
raw bytes. The challenger reproduced this. Normalise before matching, or the patch
will silently do nothing and look like a failed edit.

### What each plan actually concluded

| item | the finding |
|---|---|
| **walls** (4/5/6) | Round twelve fixed the **wrong half**. Walls follow the local lane now, but sit 0.15 m outside a lane the clamp lets you enter by 0.04–0.08 m — against a 0.34 m capsule and a 0.2 m near plane. All 81 flank boxes are reachable; 3 are in the walking line. They have **no colliders at all**. Fix costs **zero draws** and *fewer* vertices. |
| **walkway** (9) | 145 butted boxes, 125 m long, each wearing **one stretched 256 px tile** over a constant unmapped emissive, in a district with no shadow-casting light. It is flat because *nothing modulates it*. Cut into ~0.6 m flags — which fixes the UV scale and revives the bump map for free. **Not** a brightness problem. Net +3 draws. |
| **furnace** | **There is no ordering bug in the fire.** The condition is recomputed every frame and no flag can be lost. But the furnace's *voice* is latched to the hinge — the E handler returns on its first line once the door is open — and the exact state he stood in (draft whole, pilot dark) is **the one state on the whole scoreboard with no pointer at all**. The machine went silent in precisely the situation that needed it to speak. Zero draws to fix. |
| **bell** (3) | It IS the pilot, but its brass line runs 1.35 m east and dies **inside the ground slab**, 9.5 m short of the furnace. Lay the feed along the route the player walks. Net **−6 draws** (the pilot fixture merges 20 meshes to 13). |
| **jailcell** (2) | The free wall is the crawl's −Z wall east of the cage. Now *proven* why west breaks `playthrough`: the bot jams in the pocket at (−11.53, −5.84) and the pump beat only passes because the skull spawns **inside** the west wall and the collider ejects it into the pump gallery. +3 draws. |
| **ball** (11) | It is `Forest.ravineKnot`. Round twelve gave it 3 of the key-tree kit's 5 parts; it still has a raw `M.curtain` line, **no motion and no voice**. +0 draws. |
| **water** (7/10) | All four effects are cheap. Steam and drips are one reused Points shader under existing batches (+3 cave draws, 0 new programs); the lens droplets hang off `grainScene`, the only camera-space surface, summed *after* `lastRender` — effectively free. |
| **cone** (8) | The fallen bell in the optional bell-cistern shortcut. One behaviour in the whole codebase, and it can never be a fetch target because **the skull does not exist in that district**. |
| **ossuary** (1) | Already fixed by round twelve (`515ebef`). He was on the old live build. Should be gone now. |
| **postgame** | The brief was stale — the coda is already in hand. And the attachment point **already exists**: `main.js:1231` answers a click on the ending screen with `location.reload()`. The whole hand-off is a one-line change of destination plus a prefetch. **Do not add an act. Do not hook `_finishEnd`.** |

### THE AUDIT — three things round twelve got wrong, two of them mine

The adversarial audit cleared the round on the things that matter most (no runtime
throw, no light-census change, and the spider merge is **mathematically exact**),
but it found three real defects:

1. **A 2.06 m walk-through iron bell sits on the secret route's centre-line** — in
   the one district he had just complained about walking through walls. Round
   twelve dropped that bell 1.18 m to stop it floating and put it in the lane.
2. **The new webs' collider clearance check runs eleven builders too early**, so the
   check is *decorative*. All nineteen sites "cleared" — against an incomplete
   collider set. That was my check and my claim, and it did not mean what the
   commit message said it meant.
3. **The shipped screenshots contradict two of the round's own claims**: the sign
   plate's contrast polarity, and the "lit candle behind the opened door", which
   **does not exist**. The second was written into a commit message as fact.

None of these reach a player as a crash, and round twelve is live and fine to play.
But #1 is a genuine instance of the very complaint being fixed, and #2 and #3 are
claims that outran their evidence — which is the failure mode this project keeps a
law about.

### Suggested order, if it helps

Nothing here is binding — this is what seemed sensible from the diagnosis, not a
directive. **walls** first: it is the thing that is actually broken for him, it costs
zero draws, and it closes three screenshots at once. Then **furnace** (zero draws,
and it explains the confusing session he reported), then the **audit**'s bell-on-the-
lane and the web-check ordering, since both belong to the same "walking through
things" family. **walkway**, **bell**, **water**, **ball**, **jailcell** after that
in whatever order suits. **postgame** last, and cheaper than expected.

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

---

## One more trap, learned the hard way this session

**CRLF.** `src/underfalls.js` (and others) use CRLF. Anchors written with LF joins
match zero times. Normalise before matching or the edit silently does nothing.

**Backticks in shell heredocs.** Writing these docs, an inline `node -e "..."` with
backticks in the string got them expanded by bash, producing a mangled file twice.
Write the script to a file with a quoted heredoc (`<<'EOF'`), or build fences with
`String.fromCharCode(96)`. Cost about fifteen minutes across two occurrences.

**`page.screenshot` composites the canvas black headless.** Use WebGL canvas
readback — `tools/probe-door-sign.mjs` is the pattern.

**Parallel gate batches flake.** Four Chrome batches at once made
`forest-nervous-system-regression` fail; alone it passes. Re-run any parallel-batch
failure alone before believing it.
