# ROUND FIFTEEN — say "fetch" and start here

**Read this first, then `ROUND-FOURTEEN.md` for what round fourteen did, then
get to work. Do not wait for his notes** — his standing instruction: *"you
should just have them do it without my notes. if i have notes ill give them
notes."*

## STATUS

**Round thirteen is LIVE** at qualiacology.com/fetch/ (site PR #80/#81, game
`main` = `bf7df75`), including the coda at /fetch/ending/. **He has not played
it.**

**Round fourteen is BUILT AND NOT DEPLOYED** on `claude/aug24-round14`
(worktree `C:\Users\Alex\Projects\fetch-aug24-round14`), 7 commits off
`origin/main`. It answers what he asked for after playing nothing yet — he gave
the instruction from memory of round eleven/twelve, at 4am, then went to sleep.

## What round fourteen holds

1. **The bell hangs again** — his instruction, verbatim: *"sure, hang it. if you
   can make it swing and stuff sure, let it swing or whatever."* Authored pose
   restored (crown `C.y+1.18`, rim `C.y+2.62`), a two-legged sling from the
   chamber vault whose feet land on the rim ring, a real pendulum you swing by
   walking into it, and the clapper strikes at the swing reversal so the motion
   makes the sound. **Kept 1.95 m off the lane** — at the node the crown bottoms
   out 0.57 m inside the head window, which would just rebuild the walk-through
   complaint.
2. **Five more things you could stand inside are closed.** Three doorjambs whose
   own centres were legal stands, two turn markers, the keepsake shelf the
   source calls "the actual secret", the mica trail (worse than reported: **all
   71** crystals stood on occupiable floor, 15 inside the near plane), and the
   pump flywheel — plus a **piston nobody had noticed with no collider at all**,
   which let the camera stand 0.257 m inside it.
3. **The pin that missed all five is widened** — props publish into
   `layout.solids`, and probe poses come from the walkable union instead of each
   segment's own `w`, which is the hole every one of them slipped through.
4. **The cave stops paying for reverb it cannot hear** (see the open question
   below).
5. **The playthrough stops shutting the boiler door in its own face** — see
   "The gate was lying to us" below. This one matters beyond this round.

## THREE THINGS NEED HIS ANSWER — do not decide these for him

* **Does the hung bell read right?** He asked for it hung from memory, without
  having played round thirteen where it was already made to toll, rock and be
  solid on the floor. He is answering about a build he has not seen. The re-hang
  is one separately revertable commit.
* **Should the drowned pump chapel have doorjambs at all?** Round fourteen
  dropped four (both its crossings) because its rim is not a pinch — the
  corridor simply widens into the room, and every offset that clears the floor
  puts a post 8-9 m off the centreline. Both chapel-aisle turn cones now stand
  at its walls instead. If he wants a literal doorway there it needs a different
  construction (slide the pair back ALONG the route until the union is corridor
  again), not a wider offset.
* **Ship the reverb change or not?** It is measured, inaudible and gated — but
  its benefit is a CPU saving that has never been tied to his actual bug. See
  below.

## The one item that measurably did not meet its own bar

**The basement feed line reads 1.14x and 1.11x at rest against the ossuary
conduit's 6.39x.** The mechanism is known and is NOT dimness: the conduit is a
**lit** material in a **dark** room so the lantern lifts it off its background;
the feed line is an **unlit `MeshBasicMaterial`** in a **lantern-lit** corridor,
so the wall out-brightens the brass. Brightening the basic colour moves the wire
*through* the wall's value on the way up, so the escalation ladder written for
this case points the wrong way. **Making it lit is the fix.** It is a look call,
so it was recorded rather than applied. The pulse — the authored payoff —
already reads at 2.45x.

## THE REVERB CHANGE, and the honest state of the sound bug

His oldest complaint: the Underfalls district's audio "completely goes bad".

**What was found, and it is a real mechanism.** All three ConvolverNodes (0.6 s
interior, 1.4 s outdoor, 2.4 s cave) were wired to `verbBus` at init and never
disconnected; the two inactive ones were silenced **downstream** at the wet gain,
so their convolution still ran. From the cave onward the game convolved 4.4 s of
impulse to hear 2.4 of it. **Chrome skips a convolver whose input is silent** —
which is why this was district-scoped: the Underfalls is the only district that
has all three impulses loaded **and** holds a send open continuously (the Choir),
and that continuous send is what denies the cave the skip.

**Measured** (`tools/probe-verb-cost.mjs`, OfflineAudioContext at the game's own
24 kHz in the same Chrome the gates use): cave convolution work per 40 s of
audio **1628 ms → 632 ms, −61%**. The same rack with a silent send costs 287 ms;
that 6.3x gap is the skip, and it is the district explanation.

**Audibility** (`tools/probe-verb-ab.mjs`, the real `GameAudio` rendered twice,
old wiring vs new, identical seeded impulses): worst sample **−82.9 dB below
peak**, RMS of the difference **−91 dB**, worst 100 ms window anywhere differs by
**0.000065 dB**. No tail is cut — the outgoing convolver keeps receiving signal
through the crossfade and is released only once it is 52 dB down.

**WHAT IT DOES NOT DO: prove it fixes his bug.** `AudioContext.renderCapacity` —
the one instrument that reports realtime audio-thread load and underruns — is
**not available** in the Chrome on this machine (measured), so there is no
before/after of the actual realtime margin. There is no repro. The saving is
~2.5 percentage points of one core on this machine; his is unknown. It removes
real, provable waste. It is a strong candidate, not a confirmed fix, and it
should be described to him that way.

## THE GATE WAS LYING TO US — the most important thing in this round

`tests/playthrough.mjs` — the gate that proves the game can be finished — failed
about **1 run in 8** (6 in 50, measured), always at `fire-refused-the-skull`.
**For several rounds `docs/HANDOFF.md` recorded the cause as "the Resident chase
kills the bot, ~1 in 3". That was false**: `dead` is false and there are zero
enemies in every failing run. Rounds have been re-running against a wrong
explanation of the most important gate in the repo.

The real chain: `director.js` `_updateScares` drifts *"the nearest closed door on
your floor"* open on a ~28 s cycle; the basement has **exactly one** closed
unlocked door (every other is authored ajar and opened at build); both
`playthrough.mjs` and `house-critical-path-regression.mjs` then pressed E on it
**blind**, and `Door.tryUse` **TOGGLES** — so on the runs where the scare got
there first, the bot shut the door on itself, wedged in the storeroom, and threw
the skull at a shut firebox. `walkTo`'s under-1.5 m timeout fallback returned
true and swallowed the block, so the failure surfaced three steps later wearing
someone else's name.

Both presses are state-checked now, the beat carries its own preconditions, and
it is **0 failures in 25 runs** (was 6 in 50). **No player was ever affected** —
the door is never locked, so a human who shuts it simply presses again.

**The lesson to keep:** a single playthrough PASS was being read as proof for
eleven rounds. At a 12% failure rate it was much weaker evidence than that, in
both directions. And `house-critical-path-regression.mjs` already carried a
comment describing this exact trap from its own setup — **the knowledge existed
and never travelled to the file that needed it.**

## THE PATTERN THIS PROJECT KEEPS PAYING FOR

Five confident claims were falsified by measurement in a single session, every
one written by someone who had read the code carefully:

| the claim | what measuring found |
|---|---|
| the bell "floated unattached" from an inherited offset | four parts agreed and the chain met the rim at 2.6 cm |
| brighten the brass so the feed line reads | it is DARKER than the wall; brightening goes the wrong way |
| widen the bell's collider to the width of its mouth | that is a fallen bell; this one hangs |
| the hung bell's collider has 42 mm of clearance | 13.6 mm — the chamber floor is a ramp and the derivation used the node's height |
| the playthrough flake is the Resident killing the bot | zero enemies, `dead` false, for several rounds |

Reading code tells you what it MEANS. Only measuring tells you what it DOES.
The law already existed; what was missing was applying it to our own conclusions.

## Traps — all still true, plus what was learned this round

* **`grep -c $'\r'` AND `cat -A` BOTH LIE about CRLF in this Git Bash.** The
  first matches every line regardless; the second shows `$` for a CRLF line.
  Count bytes in Node: a byte 10 preceded by a byte 13. This cost a wrong census
  that was reported before it was checked.
* **Blobs are LF, the working tree is CRLF** (`core.autocrlf=true`). That is why
  cherry-picks across these files stay clean and why the shipping copy is already
  correct. CRLF matters for EDITING anchors, not for git.
* **Never edit a `src/` file while a gate is running** — cost a whole re-run of
  the battery this round when a cherry-pick landed mid-battery.
* **Gates flake under concurrent Chrome, and not always the same gate.** Round
  twelve: `forest-nervous-system`. Round thirteen: `warm-start` (red in a batch,
  21/21 alone). **Run the battery serially when the numbers must be believed.**
* **`netlify-release-integrity` is red on any fresh worktree** purely because
  there is no `release/fetch-netlify.zip`. Run `node tools/package-netlify.mjs`
  first and it is 7/7. Not a defect.
* **When two items might touch one object, say so in BOTH agent prompts.** Two
  agents independently fixed the same bell this session and had to be reconciled
  by hand, and one of them had reasoned from geometry the other had deleted.
* **`tools/probe-district-walls.mjs` discards poses below clearance −1.2** — a
  sound shortcut for flank walls, which sit on the lane edge, and WRONG for any
  object that can land mid-lane. It reports a comfortable 0.727 m for a jamb that
  actually has 0.000.

## District draw-call budget (ceiling 450)

cave 143 · house ~329 · forest unchanged. The cave still has the most headroom.
