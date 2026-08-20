# ROUND FIFTEEN — superseded, read ROUND-SIXTEEN.md instead

> **SUPERSEDED 2026-08-20.** Alex cancelled the work list below the same day
> ("Read the notes as history. They are not a task list."), the last bug (the
> phantom key — it was the locket) was root-fixed and shipped, and **the game
> is finished**. `ROUND-SIXTEEN.md` is the say-fetch doc now. This file stays
> as the record it became.

## READ THIS PARAGRAPH BEFORE ANYTHING ELSE

**Do not open with questions. He is out of patience for being consulted.** His
words, 2026-08-20, after a very long session:

> "who ever is in the next thread i want to just finish this. i cant keep plying
> this. do whatevr you need to so it can just say fetch and it will owrk in the
> next one"

Everything below has a **DEFAULT already decided**. Take the defaults, do the
work, ship it, and tell him what you did. Ask him only if something is genuinely
destructive, genuinely irreversible, or a pure taste call with no defensible
default — and there is nothing in that category on this list.

His older standing instruction still holds: *"you should just have them do it
without my notes. if i have notes ill give them notes."*

## STATUS: EVERYTHING IS SHIPPED. NOTHING IS PENDING.

* **Game `main` = `0cf8a11`** — round fourteen, and main IS the live game.
* **Site `main` = `20e40ce`** (PR #82) — qualiacology.com/fetch/ serves it, plus
  his rhythm-game coda at qualiacology.com/fetch/ending/.
* Production verified: all 22 src files fetched back off the site and diffed
  **byte-identical**, `fetch-boot-check` **PASSED** (hand-lit 44.8%, zero
  errors).
* **HE HAS NOT PLAYED ROUND THIRTEEN OR FOURTEEN. Tell him to hard-refresh.**

There is no parked branch, no unmerged work, no open PR. Start clean.

## THE WORK LIST, in order, with defaults already taken

### 1. The basement feed line does not read — FIX IT, do not ask

Measured on a GPU: **1.14x and 1.11x** contrast at rest against the ossuary
conduit's **6.39x**. The conduit is the thing it was modelled on, so it misses
its own bar by 5x.

**The mechanism is known and it is NOT dimness.** The conduit is a **lit**
material (`ironMat` clone, pale `0x9aa09b`) in a **dark** room, so the carried
lantern lifts it off its background. The feed line is an **unlit
`MeshBasicMaterial`** in a **lantern-lit** corridor, so the wall out-brightens
the brass and the wire sinks into it. **Brightening the basic colour moves the
wire THROUGH the wall's value on the way up** — the escalation ladder written
for this case points the wrong way and must not be followed.

**DEFAULT: make it lit, the way the conduit is.** Keep the pulse's base/warm
lerp working (it works identically on a lit material; consider lerping emissive
too). Then **re-run `node tests/legibility-regression.mjs`, read the measured
pair off the console, and raise the three feed-line floors** — they are pinned
at the old failing numbers deliberately, as a regression guard, not a target.
The pulse already reads at 2.45x and is fine.

### 2. The drowned pump chapel has no doorjambs — DEFAULT: leave it

Round fourteen dropped four, because its rim is not a pinch: the corridor simply
widens into the room, so there is no doorway to frame, and every offset that
clears the floor puts a post 8-9 m off the centreline. Both chapel-aisle turn
cones now stand at its walls instead, which is a taller and brighter
announcement than a 2.6 m post.

**Only revisit this if HE raises it.** If he wants a literal doorway there it
needs a different construction — slide the pair backwards ALONG the route until
the union is corridor again — not a wider offset. That was measured to work for
the main#3 crossing (at t=0.3 both sides clear).

### 3. The cave/Underfalls is still "the area that needs the most work"

That is his own framing and it predates all of this. Rounds thirteen and
fourteen fixed what was BROKEN there — walls you walk through, a floor that was
hidden for four rounds, a bell that did nothing, no steam, no wet, a flat
walkway. **What has never been done is making it GOOD rather than correct.**
That is the open creative brief, and it is where he said he wanted to get to.

### 4. His sound bug is a candidate fix, not a closed one

Round fourteen removed the real waste (see the record), measured at −61% of the
cave's convolution work. **It is NOT proven to be his bug.** If he reports the
cave's sound going bad again, that is the single most valuable datum in the
project — get the circumstances, and note that
`AudioContext.renderCapacity`, the instrument that would settle it, does not
exist in the Chrome on this machine.

## LAWS THIS PROJECT LEARNED THE HARD WAY — these are not optional

### Measure your own conclusions, not just other people's

**Five confident claims died to measurement in a single session**, every one
written by someone who had read the code carefully:

| the claim | what measuring found |
|---|---|
| the bell "floated unattached" from an inherited offset | four parts agreed and the chain met the rim at 2.6 cm |
| brighten the brass so the feed line reads | it is DARKER than the wall; brightening goes the wrong way |
| widen the bell's collider to the width of its mouth | that is a fallen bell; this one hangs |
| the hung bell's collider has 42 mm of clearance | 13.6 mm — the chamber floor is a ramp |
| the playthrough flake is the Resident killing the bot | zero enemies, `dead` false, believed for several rounds |

**Reading code tells you what it MEANS. Only measuring tells you what it DOES.**

### Never explain his memory away without measuring it first

He described the cave from memory at 4am — a straight walk-through, two
walk-through walls, one after the bell, no side room — and **the route tables
agreed with him on every point** while the code's own comments did not. At the
fork the culvert drifts 15.3 deg off your heading while the main route turns
48.9 deg away, so walking forward puts you in the culvert; it is shorter and
straighter; its first 22 m is open chapel floor so no side room is ever drawn.

It would have been very easy, and completely wrong, to tell him he misremembered.

### Sample sizes matter at low rates

The playthrough flake was called a round-fourteen regression off **4 runs per
branch**; 10 runs each showed the rates identical, and 50 runs found the real
cause. At a ~10% failure rate a single PASS is weak evidence — and a single PASS
had been read as proof for eleven rounds.

## The method that works

**Fan out: one agent per item, each in its own git worktree and branch**, then
cherry-pick onto one branch. Two rules make it work:

1. **Hand each agent an already-challenged plan** so nobody re-derives what is
   known.
2. **Forbid every agent from launching Chrome.** Browser work contends and
   flakes; source reading and pure-node arithmetic parallelise perfectly. Run the
   gate battery centrally and **serially** afterwards.

The cost of that trade, and you must pay it: **agents can measure geometry but
cannot SEE anything**, so every visual claim needs checking in a real browser
afterwards. And **when two items might touch one object, say so in BOTH
prompts** — two agents independently fixed the same bell, and one had reasoned
from geometry the other had deleted.

## Traps — all measured, all still true

* **`grep -c $'\r'` AND `cat -A` BOTH LIE about CRLF in this Git Bash.** The
  first matches every line regardless; the second prints `$` for a CRLF line.
  Count bytes in Node: a byte 10 preceded by a byte 13. The src files are CRLF in
  the working tree while git stores LF (`core.autocrlf=true`), so this matters
  for **editing anchors**, not for git.
* **Inline `node -e` with parentheses or backticks gets mangled by bash.** Write
  the script to a file with a quoted heredoc.
* **Never edit a `src/` file while a gate is running** — it cost a whole re-run
  of the battery when a cherry-pick landed mid-battery.
* **Gates flake under concurrent Chrome, and not always the same gate.** Round
  twelve: `forest-nervous-system`. Round thirteen: `warm-start` (red in a batch,
  21/21 alone). **Run serially when the numbers must be believed.**
* **`netlify-release-integrity` is red on any fresh worktree** purely because
  there is no `release/fetch-netlify.zip`. Run `node tools/package-netlify.mjs`
  first and it is 7/7. Not a defect.
* **`tools/probe-district-walls.mjs` discards poses below clearance −1.2** — a
  sound shortcut for flank walls on the lane edge, and WRONG for any object that
  can land mid-lane. It reports a comfortable 0.727 m for a jamb that has 0.000.
* `world.finishStatic()` merges under `mat.clone()`, so a material-identity
  comparison against the source can never match. `world.box()` never adds a
  collider. `groundHeightAt` never reads colliders. `addColliderCylinder` builds
  a **square AABB** — radius r reaches r·√2 at the corners.
* **Do NOT add a PointLight in the cave** — the light census is pinned at boot
  and a new one recompiles every lit material in the game.

## Known red, and pre-existing

`underfalls-expansion` fails 2 of its 18 checks — *"the broken promise still
gates the expanded district"* and *"the live hatch enters the mirror room with
its reflected body still visible"*. **Verified identical on the live build** by
running the same gate against `origin/main` in a separate worktree. Nobody has
looked at them. They are the oldest untouched thing in the gate set.

## Shipping

`duplighost/fetch` is the game and publishes NOTHING. `duplighost/qualiacology`
is the site and keeps its own copy of the 22 src files at `fetch/src/`, plus the
coda at `fetch/ending/`. Shipping is a COPY (LF), never a deploy from the game
repo, and the site's own `AGENTS.md` is canonical. The sequence that has worked
three times: copy → `build-site` (no drift) → `validate-site` → `route-smoke` →
`npm run qa` → **`fetch-boot-check` against a local serve** → branch, PR,
**boot-check the Netlify preview**, merge → verify production byte-identical and
boot-check it → fast-forward the game's `main`.

## District draw-call budget (ceiling 450)

cave 143 · house ~329 · forest unchanged. The cave still has the most headroom,
which is convenient, because the cave is where the work is.
