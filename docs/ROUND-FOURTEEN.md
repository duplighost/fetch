# ROUND FOURTEEN — say "fetch" and start here

**Read this first, then `ROUND-THIRTEEN.md` for what round thirteen actually
did, then get to work. Do not wait for his notes** — his standing instruction:
*"you should just have them do it without my notes. if i have notes ill give
them notes."*

## STATUS: ROUND THIRTEEN IS BUILT AND NOT DEPLOYED

Branch `claude/aug23-round13`, worktree
`C:\Users\Alex\Projects\fetch-aug23-round13`, **16 commits off `origin/main`**
(503dfce), 45 files, +7.7k lines. **It has NOT been pushed and NOT shipped to
the site** — he was asked and had not answered at the time of writing. `main`
is still round twelve, which is what qualiacology.com/fetch/ serves.

Round thirteen answered **every item** in his 2026-08-19 notes plus the coda.
See `ROUND-THIRTEEN.md` for the item-by-item record and the honest gate table.

## What is still open, in the order it matters

### 1. Three things need HIS answer, not more work

* **Does the fallen bell hang or lie?** Round twelve dropped it to the floor on
  the strength of *"what is this, it doesn't move or do anything"* — but that is
  a complaint about PURPOSE, not height, and the original was deliberately
  authored as suspended and inverted with the chain meeting its rim (0.086 m
  from the ring centre-line — it was hung ON it, not missing it by half a metre
  as round twelve's commit message claimed). It now lies on the stone, rocks,
  tolls, and is solid, and it has moved 1.95 m off the walking line. Re-hanging
  it is one constant and is written into the source comment.
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
