# ROUND FOURTEEN — the record

**This is what round fourteen did. The brief it was built from is kept below the
line. `ROUND-FIFTEEN.md` is the say-fetch doc now.**

**SHIPPED 2026-08-20. Site PR #82 merged (site main `20e40ce`); game `main`
fast-forwarded to `0cf8a11`, so main IS the live game again.** Production
verified: all 22 src files fetched back off qualiacology.com and diffed
byte-identical, `fetch-boot-check` PASSED (hand-lit 44.8%, zero errors).
**HE HAS NOT PLAYED IT — tell him to hard-refresh.**

## Where it came from

Round thirteen shipped, and forty minutes later — without having played it — he
answered the bell question from memory of an older build, at 4am, and went to
sleep:

> "sure, hang it. if you can make it swing and stuff sure, let it swing or
> whatever if it's interactable by hitting it with the skull. make sure that's
> not what is causing the sound bug where that areas sound can completely go bad
> though. that last area really needed some walk through last time with all the
> walls you had to walk through even though you basically just had to walk
> straight forward. I don't remember when the walls came back. probably at the
> same time as that bell a wall came back that you have to walk through. I dont
> remember that being a side room. I remember it being more of a straight walk
> through through the cave since there are just two walls you can walk through
> ane one of them is at the end of the path after the bell. maybe it's all
> redone now. I don't know. I have to got to sleep anyway"

Three instructions, one condition, and a description of the cave that disagreed
with the code. All four were taken literally.

## HE WAS RIGHT ABOUT THE CAVE AND THE CODE WAS WRONG ABOUT THE PLAYER

He said the cave is *"more of a straight walk through"*, that he does **not**
remember the bell being in a side room, and that there are *"just two walls you
can walk through and one of them is at the end of the path after the bell."*

Every part of that checks out, and it took measuring the route tables to see it:

* **The culvert IS the straight-ahead read.** Arriving at the fork your heading
  is 60.3 deg. The culvert leaves at 45.0 deg — a 15.3 deg drift. The MAIN route
  leaves at 11.3 deg, a **48.9 deg turn**. Walking forward puts you in the
  culvert.
* **It is also objectively the straighter route**: 54.30 m, 5 legs, sinuosity
  1.093, largest turn 45 deg — against the main route's 66.70 m containing a
  **135.6 deg hairpin**.
* **No "side room" is ever drawn.** The culvert's first 22.3 m lies inside the
  drowned pump chapel's disc, so the flank-wall loop skips it and the atmosphere
  pass only dresses the main route. The "culvert mouth" is a name, not a hole in
  a wall.
* **And his count of two is exactly right.** Pre-round-thirteen, only five legs
  had drawn flank pieces. A player who branches at the fork and rejoins later
  never walks three of them. That leaves **precisely two**: the first leg inside
  the falls (0.163 m) and **the last culvert leg, at the end of the path after
  the bell** (0.045 m — the worst face in the district). His count and his
  placement only reconcile if he took the culvert. He did.

Both are fixed and live as of round thirteen (0.753 m and 0.774 m). **He was
describing a build he had not played.**

## What landed

| item | what a player gets |
|---|---|
| **the bell** | It hangs on its chain again, on a two-legged sling whose feet sit on the rim ring and whose apex meets the vault the cave actually draws. Walk into it and it swings; the loose clapper strikes at the bottom of the swing, so the motion makes the sound. |
| **doorjambs + turn markers** | The pale stones that tell you which way to go stop being walls you walk through. |
| **mica + pump iron** | The glowing trail and the pump's iron stop being things you stand inside. |
| **shelf + benches + the pin** | The shelf, the bell and the benches stop being things you stand inside — and the gate that missed them can see them now. |
| **reverb** | The Underfalls stops paying for reverb it can't hear. |
| **the playthrough** | It stops shutting the boiler door in its own face. |

## The five that were still walk-through, in numbers

Round thirteen fixed the flank walls and gate posts and pinned them. **Five more
drawn objects in the same district were never covered by anything**, and the
audit under-counted two of them:

| object | before | after |
|---|---|---|
| three doorjambs | **0.000 m** — the post's own centre was a legal stand | 0.442 m (four dropped) |
| two turn markers | **−0.337 m** — the pose is inside the cone | 0.449 m |
| mica trail | **all 71** on occupiable floor, 15 inside the near plane | 57 crystals, worst 0.501 m |
| pump flywheel | 0.100 m camera gap | 0.440 m |
| **the piston** | **no collider at all** — camera 0.257 m inside it | 0.430 m |

The piston was not in the audit. It was found by auditing the colliders around
the flywheel rather than taking the list as complete.

## The bell, and what the merge caught

Two branches edited `buildBellCistern` concurrently without knowing about each
other, and they disagreed about the bell. The walk-through branch had widened
its collider "to the width of the mouth" and shoved it 0.25 m further out —
correct for a bell lying on the floor presenting its 1.105 m mouth at body
height, **wrong for one hanging overhead**. It had also published the bell into
`layout.solids` as **one disc at the mouth's width for the object's whole
height**: a metre-wide lie about a hanging bell, which the widened gate would
then have measured and passed.

Resolved to four stacked discs plus the sling, rungs placed at the tops of real
head windows. And re-deriving it found the bell branch's own headline number was
wrong **in the unsafe direction**: `BELL_HALF` was derived from a head window at
the *node's* height, but the chamber floor is a ramp and the nearest legal stand
is 0.12 m higher. True capsule clearance **13.6 mm, not 42**. The box still
holds — nothing ever touches it — but every quotation of the wrong figure was
corrected.

## Sound: his condition was treated as a gate

He said *"make sure that's not what is causing the sound bug."* It is not — the
toll postdates every report he has filed. But round thirteen **had** made that
district louder into the reverb, so rather than defend it, it was cut:

* the paired `caveDrip` that fired at the same instant deleted (it was fiction —
  the nearest real drip site is 8.55 m away through rock);
* the toll's reverb send **0.96 → 0.34**;
* the free-running cadence replaced by an amplitude gate plus an inelastic
  strike, so the sound costs the bell its own swing energy and the rate
  self-regulates;
* round thirteen's 7.3 s minimum kept as a hard floor.

Reverb drive per second **down 64.6% worst case, 82.1% ordinary**, and the
single-event proxy fell from 2.4x the previous cave maximum to below it. Pinned
with thresholds written as literals in the test, so widening them in `src` turns
the gate red.

## Gates

Run **serially**. `playthrough` **0 failures in 25 runs** (was 6 in 50).
`underfalls-expansion` 18 checks with the 2 known pre-existing reds, verified
byte-identical against `origin/main` in a separate worktree. Everything else
green, including the new `verb-rack-regression` (13/13) and every probe both
branches shipped.

---
---

# The brief this round was built from

# ROUND FOURTEEN — say "fetch" and start here

**Read this first, then `ROUND-THIRTEEN.md` for what round thirteen actually
did, then get to work. Do not wait for his notes** — his standing instruction:
*"you should just have them do it without my notes. if i have notes ill give
them notes."*

## STATUS: ROUND THIRTEEN IS LIVE (2026-08-20)

**Site PR #80 merged** (squash, site main `5f6367e`). qualiacology.com/fetch/
serves it, and the coda is live at qualiacology.com/fetch/ending/.

Verified on production, not assumed:

* **fetch-boot-check PASSED** -- world on screen, skull lit in hand for 44.2%
  of tail frames, zero page/console errors.
* **All 22 src files byte-identical** to this tree, fetched back off
  qualiacology.com and diffed.
* **All 7 coda modules byte-identical**, and all 7 media files the exact
  shipped byte counts.
* The coda media serves as `video/mp4` / `image/jpeg` with
  `Cache-Control: public,max-age=86400` -- which is what keeps the warm fetch
  free at the seam in production, not just on localhost.

The game repo's `main` was **fast-forwarded to `e3d4d53`**, so main IS the live
game again and a fresh clone is what the site serves.

**HE HAD NOT PLAYED IT at the time of writing -- tell him to hard-refresh.**

Round thirteen answered **every item** in his 2026-08-19 notes plus the coda.
See `ROUND-THIRTEEN.md` for the item-by-item record and the honest gate table.

## ROUND FOURTEEN WAS BUILT ON THREE BRANCHES AT ONCE, AND INTEGRATED

`claude/r14-bell` (the hung bell), `claude/r14-walkthrough` (jambs, turn
markers, mica, the pump's iron, the keepsake shelf, the benches, and the widened
ledger gate) and `claude/r14-cave-audio` (the verb rack) were all cut from
`bf7df75` without knowing about each other. Two of them edited
`buildBellCistern` and disagreed about the bell. The integration is on
`claude/aug24-round14`, and the rule was: **the bell's own geometry is the bell
branch's; everything else is the walkthrough branch's.**

The one thing that could not simply be picked: the walkthrough branch published
the bell to `layout.solids` as ONE DISC AT THE 1.03 LIP for the object's whole
height, which is correct for a bell lying on the floor and a lie about a bell
hanging over your head. Left alone it would have handed the widened gate an
object that is not there. The bell goes on the ledger as **four discs and a
sling** now, rungs at the tops of head windows, radii read off the drawn
geometry rather than typed. Measured: body 0.327 against the 0.32 a
collider-guarded face owes, camera 0.308 against the 0.24 the near plane eats.

**AND ONE MEASUREMENT WAS WRONG ON THE BELL BRANCH, IN THE DIRECTION THAT
MATTERS.** Its collider derivation scanned the iron from the crown to
`C.y + HEAD` — the head window of a player standing at the cistern node's own
height. This chamber's floor is a ramp: across the three metres around the bell
it runs C.y − 0.405 to C.y + 0.315, and the nearest stand the box allows is on
ground 0.12 m ABOVE the node. So the widest swept iron in a real head window is
**0.6075 m, not 0.578**, and the swept bell clears the player capsule by
**0.0136 m, not 0.042**. The box still holds — nothing touches — but with a
third of the air it was credited with, and the source, the gate and
`tools/probe-bell-cistern.mjs` all say 0.0136 now. `BELL_HALF` was left at
0.62 (it is the bell branch's number and it works); if a future round wants the
0.042 back, that is 0.65 and the Choir cost is bounded by round thirteen's 0.75
box having lost only the one chord.

## What is still open, in the order it matters

### 1. One of these is answered and built; two still need HIS answer

* **ANSWERED, AND DONE — the bell hangs again.** He said, 2026-08-19: "sure,
  hang it. if you can make it swing and stuff sure, let it swing or whatever if
  it's interactable by hitting it with the skull. make sure that's not what is
  causing the sound bug where that areas sound can completely go bad though."
  Round fourteen restores the authored height (crown C.y+1.18, rim C.y+2.62),
  gives the chain two legs so it actually holds the bell — feet on the rim ring,
  apex on the vault atmosphere.js draws — and keeps round thirteen's 1.95 m
  offset, because hanging it does NOT make the node safe: the crown still
  bottoms out **0.685 m** inside the head window of the nearest stand the
  collider allows. (0.57 was the answer for a player standing at the node's own
  height, and nobody does — this chamber's floor is a ramp. See the integration
  note below.) The false "floated unattached /
  inherited the +1.18 offset" comment is deleted; four authored parts contradict
  it, and `tools/probe-bell-cistern.mjs` prints why. There is no skull in this
  act, so the interaction is your shoulder: walk into it and it swings, and the
  loose clapper strikes at the bottom of the swing. **His sound condition is a
  gate now**: the toll's reverb send drops 0.96 -> 0.34, the paired `caveDrip`
  (a water sound with no drop within 8.55 m) is deleted, the strike is inelastic
  so the swing pays for the sound, and `tests/underfalls-expansion.mjs` pins
  send <= 0.34 and a 7.3 s floor with literals that live in the test.

* **The cave is more enclosed than it was.** Legs with a wall on both hands went
  5 → 15. That is the fix working, but it is a look change he will notice, so it
  is a **separate, revertable commit** (`f5762c7`, steps 3+3b). Reverting it
  leaves the district at 80 drawn pieces with the closest reachable face still
  0.751 m — i.e. his three wall reports stay closed either way.
* **Is the wet path wet stone or a lit runway?** The physics is right and every
  number is printed; the gloss level is taste. `uGain` (0.9) is the single dial.

### 2. The one item that measurably did not meet its own bar

**The basement feed line reads 1.14x and 1.11x at rest against the ossuary
conduit's 6.39x**, and the mechanism is known and is NOT dimness:

* the conduit is a **lit** material (`ironMat` clone, pale `0x9aa09b`) in a
  **dark** room, so the carried lantern lifts it off its background;
* the feed line is an **unlit `MeshBasicMaterial`** in a **lantern-lit**
  corridor, so the wall out-brightens the brass and the wire sinks into it.

Brightening the basic colour cannot fix it — it moves the wire *through* the
wall's value on the way up, so the escalation ladder written for this case
(`FEED_SECTION` 0.09→0.12, then `feedMat` 0x8c6d31→0xa9853d) points the wrong
way. **Making it lit, the way the conduit is, is the fix.** It is a look call,
so it was recorded rather than applied. The pulse — the authored payoff —
already reads at 2.45x, so the beat lands; it is the resting wire that is
context rather than a line.

### 3. The coda ships nowhere until the SITE repo learns the route

`ending/` exists, plays, and is warmed. But **nothing in this repo deploys.**
A page at `fetch/ending/` has to be registered in `duplighost/qualiacology`,
whose `route-smoke` gate asserts a fixed route count with a fixed number of
intentional 404s and will fail until it is taught the new one. Its `AGENTS.md`
is canonical. **Also: the live server must send a cacheable header for
`fetch/ending/media/`** or the warm fetch gets a revalidation round-trip per
file instead of the measured zero bytes.

### 4. Smaller, carried forward honestly

* **`tools/probe-hitch.mjs`, `probe-light-census.mjs` and `probe-programs.mjs`
  will now pay for the coda warm.** They boot `?mute=1` alone — neither
  TEST_MODE nor HITCH_LOG — and tour through `cave`, so they issue the 6.0 MB
  fetch. None is a gate. Root cause is pre-existing: probe-hitch measures
  hitches without passing `?hitch=1`. One-line fix, deliberately not taken.
* **`tools/probe-webs.mjs` must be re-run and its placed/skipped line recorded
  as the new baseline.** Round twelve's collider check ran eleven builders too
  early, so it was decorative; it is real for the first time, and sites may now
  be SKIPPED that were previously placed. That is the check working.
* **The coda's module graph is not warmed, only its media.** `index.html` plus
  seven ES modules is ~63 KB discovered progressively, so up to three sequential
  round trips at the seam on a slow link. Cheap to add.
* **A skirt on secret#2 reaches 0.428 m into the drowned pump chapel's disc**
  and stands 0.677 m proud of its floor. Left because the existing route floor
  boxes already put 2006 sample points inside chamber discs there with a worst
  lip of 0.781 m at the same leg — one more of a thing already present, not a
  new kind. Clipping the skirt at the chamber rim loses nothing.
* **The video re-encode was never done** — there is no ffmpeg on this machine
  and none was installed. The three clips are 90.3% of the remaining 6.01 MB.
  Halving their bitrate would take total media to ~3.3 MB; whether they still
  look right at that is unmeasured and can only be settled by encoding and
  watching. The posters were already cut 1.18 MB (16.4%) with measured PSNR.
* **The ending click is invisible.** `showEnd()` blanks `.tag` and `.go`, so
  nothing tells the player the screen is clickable — and now a player who never
  clicks never sees the coda at all. Law 3 governs play and `DESIGN.md:211` says
  "Screen text ok" for the ending, so one quiet word is permitted. His call.

## Traps this project has already paid for

Everything in `ROUND-THIRTEEN.md`'s trap list still applies. Three that were
re-confirmed or newly learned in round thirteen:

* **`grep -c $'\r'` DOES NOT DETECT CRLF in this Git Bash** — it matches every
  line regardless and will tell you a pure-LF file is CRLF. Count bytes instead:
  read the file as a buffer and count `10` preceded by `13`. `tools/` has no
  helper for this; write four lines of Node.
* **The blobs are LF, the working tree is CRLF.** `core.autocrlf=true`, so git
  stores LF and checks out CRLF. That is why cherry-picks and merges across all
  these files stayed clean, and why the shipping copy (LF) is already correct.
  The CRLF warning matters for *editing* (an LF-joined anchor matches zero times
  against the working file), not for git.
* **Never edit a `src/` file while a gate is running** — this round proved it
  again the expensive way. A cherry-pick landed mid-battery and
  `choir-route-occlusion-regression` went red; run alone on the same tree it
  passes. The whole battery had to be re-run to get numbers worth trusting.
* **Gates flake under concurrent Chrome load, and it is not always the same
  gate.** Round twelve saw `forest-nervous-system-regression`; round thirteen
  saw `warm-start-regression` fail in a batch and pass 21/21 alone. **Run the
  battery serially when the numbers have to be believed**, and never trust a
  parallel-batch failure without a solo re-run.

## The gate baseline, measured 2026-08-20 on the live build

Run these to know what was already broken before blaming yourself. On
`origin/main` (= what the site serves), run **serially**:

* **29 of 30 green.**
* `underfalls-expansion` — 2 checks red: the broken-promise gate and the live
  hatch's reflected body. Pre-existing, reproduced on main.
* `house-chase-doors-regression` — 1 check red. Pre-existing.
* `netlify-release-integrity` — red **only because a fresh worktree has no
  `release/fetch-netlify.zip`.** Run `node tools/package-netlify.mjs` first and
  it is **7/7 green**. Not a defect.
* `perf-pool-regression` — **green.** Round twelve shipped it knowingly red (the
  831 → 833 geometry plateau); it does not reproduce. Either intermittent or the
  original measurement was taken under contention. Do not call it fixed.

## District draw-call budget (ceiling 450)

cave 137 → **143** (+3 walkway, +3 water; walls and cone cost zero) ·
house 335 → **~329** (bell −7, audit −2, jailcell +3) · forest unchanged.
**The cave still has the most headroom, and the house got cheaper again.**
