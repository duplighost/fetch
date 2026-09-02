# ROUND NINETEEN — say "fetch" and start here

## THE BRIEF, VERBATIM (2026-09-01)

> Goal: Make the graveyard work correctly again in fetch (sometimes it seems
> like it takes a respawn and then the second keyt of the gate works.) There is
> an enemy that looks like it is still in the house making sounds when you get
> to the graveyard. And also, make the pit you can fall into the forest moor
> clear. maybe even block it off so you have to use the thing to swing in the
> air (but make sure that thing actually doesn't stop you from going over
> however we block it. Also in the last area of the game under the water fall.
> there is still an odd sound. eventually it gets so loud it crashes the sound.
> it starts out in my left ear. it sounds like a ringing.

Four items. Three are fixed and measured. The fourth — the ringing — is **not
reproduced**, and the honest state of it is below; do not let a later thread
tell him it is fixed.

## THE GAME WAS NOT FINISHED AFTER ALL

ROUND-SIXTEEN closed with "THE GAME IS FINISHED". It was, at `e166da4`. Three
Codex PRs landed on `main` after that — #32 boot/guidance/creatures, #33 skull
guidance removal, #34 the round-eighteen horror pass — and they went to the live
site. **They took the graveyard with them.**

Matched worktrees, same machine, same Chrome, `tests/playthrough.mjs`:

| build | survived the funeral |
|---|---|
| `e166da4` (ROUND-SIXTEEN's "finished") | **4 / 4** |
| `ffe02ed` (`main`, what he is playing) | **2 / 6** |
| this branch | **6 / 6** |

Every failure is the same shape: the bot reaches wave three of the funeral and
dies, and every beat after it fails behind the death — no keys, no marrow, no
gate, no forest, no cave, no ending. That is what "make the graveyard work
correctly again" is describing from the inside.

## What was actually wrong, in the order he hit it

### 1. The wreck's passenger was a third hand nobody budgeted for

Round eighteen folds a body into the station wagon's cargo well and lets it out
on the car's second hit. Good beat. But it is spawned with **none** of the
graveyard's flags — not `graveArena`, not `gravePressure` — and every list the
fight is built on filters on exactly those. So while the funeral ran it closed
and struck whenever it liked, on top of the one or two attackers the arena had
budgeted, and the authored fight stopped being the authored fight.

It cannot be wave bookkeeping either: `alive` gates wave progression, so
counting it there lets one unkilled body freeze the funeral forever.

**Fix:** one predicate, `graveCrowd(e)`, now owns it *while the funeral is
running only*. It walks the ring like the Standing Kind — present, lit, audible,
never a hand. The instant the waves are done the predicate lets go and it comes
for you with nothing in its way. Break the car over a quiet yard and that is
immediate, which is the beat exactly as round eighteen wrote it.

Pinned by `tools/probe-grave-passenger.mjs`, which wakes it on purpose (the
playthrough only wakes it by a stray throw, about one run in six):

* during the funeral — **0 strike frames**, closest approach 4.05 m, 627 frames
  out on the ring;
* after the funeral — closest **0.71 m**, striking, against a control walker
  spawned on the same grass at **0.68 m**.

### 2. A fight body could walk itself into the house and stay there

This is his "an enemy that looks like it is still in the house making sounds."

The chase's stall handler routes a stuck body through the house door graph. The
guard that keeps graveyard bodies out of it — and its comment says exactly why:
*"House doorway nodes are poison for outdoor enemies: a risen body stalled
against the rear wall used to route south into the house and leave the arena
forever"* — tested an arena **flag** rather than where the body was standing.

The wreck passenger wakes *stalled*, pressed against the very car it climbed out
of. So it took the house branch. Measured, before the fix: it ends 8.92 m from a
standing player at (-1, 6.5) — the house's south wall — while a plain walker
started on the same grass closes to 0.68 m and strikes.

**Fix:** the rule is physical, so it asks a physical question. `yardBody` is now
`graveArena || gravePressure || (act === 'graveyard' && !inHouseShell(pos))`.
The act stays in the test because the in-yard leg's clamps are the graveyard's
own bounds and would drag a forest body back into the yard.

### 3. And the house never cleared its own dead

The other half of the same report, and older than round eighteen.

`_enterBasement`'s `_removeResident` only fires if a Resident happens to exist
at that instant, and round eighteen let `residentHeard` spawn one whenever the
player is *physically* upstairs — basement act included. Nothing else ever
removed one. Walk out to the graveyard and the body is still standing in the
kitchen: frozen (`_updateResident` refuses to run outdoors), invisible, and
**still driving a presence loop at `ENEMIES[kind].floor` from twenty metres
away** — and still wakeable by a pop.

Measured before the fix: teleport house → graveyard and both a Resident and a
house walker survive, 15 m and 19.7 m from the player, each with a live loop.

Two changes, and both are worth keeping:

* `_enterGraveyard` clears bodies standing inside the house shell, the same
  sentence `_enterForest` already says about the Standing Kind.
* **The floor is for the room you are in.** `enemyLoop.setThreat` takes a fourth
  argument, `carry`, which multiplies the FLOOR only; `enemies.js` passes 0 when
  the body and the ears are in different buildings. The threat/near/rear terms
  keep their own distance falloff either way, so a creature in the building you
  just left is still faintly there — it is simply no longer pinned to the
  audible minimum. Default 1, so every existing caller is byte-identical.

`tools/probe-house-echo.mjs` measures all of it, with a real AudioContext
(muted runs return a no-op loop stub and can prove nothing).

### 4. The forest mire — clear, and blocked, with his caveat honoured

The pit is the sucking mire at `ravineS()`. It was a dark quad at y = −0.075
with reeds, breath rings and a half-swallowed chair, and it read as ground.

A hazard rail now crosses the near lip: four posts, sagging bars, one post
snapped off with its head face-down in the peat past the lip. It is the only
straight horizontal line in a forest of leaning trunks, its caps are the one
pale material out there, and past it the rope knot is already lit across the
gap. **The rail says stop, the knot says how, and nothing on screen says either
out loud.** (`tools/shot-mire.mjs` shoots the three reads.)

His caveat — *"make sure that thing actually doesn't stop you from going over"* —
is answered by construction, not by arithmetic about arc heights:

* the colliders carry **`skullPass`**, the flag the open bedroom window wears,
  so the throw that latches the rope has never met them;
* their tops drop to their own floors for as long as `player.swing` is live —
  the graveyard gate's own idiom — so no arc can catch on one.

`tools/probe-mire-rail.mjs`, 7/7: a ten-second run straight at the bog stops
4.0 route-metres short and never sinks; neither side wall gets round it; the
throw still latches; the rail is down for the whole swing and solid again the
moment it ends; and the swing lands you at s 111.35 (the authored landing is
rs+7 = 111), alive.

## THE RINGING — NOT REPRODUCED, and what that is worth

His best datum yet: **a ringing, starting in the left ear, growing until the
sound dies.** It is the fourth round this report has survived.

What was measured this time, all with a REAL AudioContext on the real GPU:

| probe | what it did | result |
|---|---|---|
| `probe-cave-realtime.mjs` | 5 **wall-clock** minutes in the Underfalls, rendered every frame: the walk, the secret, a death, a respawn, the Choir | level flat (L 0.077 → 0.109, inside its own oscillation), `ctx.state` never left `running`, 0 dropped voices, 0 resumes, no source-node staircase |
| `probe-cave-bell.mjs` | 2 wall-clock minutes leaning on the bell, shoving it every frame | tolls at the authored 7.7 s floor, level **dead flat** (0.0741 first 15 s, 0.0741 last 15 s) |
| `probe-audio-live.mjs` | the old fast-stepped walk | live sources pinned at 2 |

Note that fast-stepping makes overlap **worse**, not better — a game second
costs a fifth of an AudioContext second — so speed was never the missing
variable, and the real-time runs confirm it.

**What was found instead is why nobody could see it.**

`_play` — the BUFFER one-shot path — has a voice cap and voice accounting, both
added in round seven expressly so that "loud sound until it just stops playing
sound" would report itself and so that a stacking graph would drop sounds
instead of getting louder until the context gives up. Every **synthesized**
one-shot in the game goes through `_bus` instead: bellRing, caveDrip, whisper,
stoneGrind, splash, drownedCall, thud, creak, carAlarm, the lot. Measured over
five real minutes in the Underfalls, `_bus` opened 296 voices to `_play`'s 423
— **and not one of them was counted, capped, or visible in the numbers he was
asked to read back.** The watchdog has been watching half the mixer.

So, this round, on the same terms:

* `_bus` is counted and capped. Over the cap the caller still gets a GainNode
  (nothing throws, no call site changes) — it is simply not wired to the master.
* `voiceStats()` gained `worstReduction` and `stormSeconds`, read straight off
  `DynamicsCompressorNode.reduction`, which is already in the chain and costs
  nothing — no analyser, no FFT, no new node. Ordinary Underfalls play: worst
  **11.6 dB**, storm seconds **0**. The storm threshold is 18 dB, and the
  compressor's own knee is at −18 dB / ratio 4, so 18 dB of reduction means the
  mix is roughly 24 dB over: nothing the game does gets there.
* With both paths finally counted, ordinary play peaks at **14** voices against
  a ceiling of 40. The old comment claiming "0–2 live sources plus a handful"
  was measuring half the mixer and has been corrected.

**IF HE HITS IT AGAIN, ASK FOR THIS AND NOTHING ELSE FIRST:**

```
__game.audio.voiceStats()
```

`droppedVoices > 0` = something stormed the mixer and the cap caught it.
`stormSeconds > 0` = the master was genuinely being driven into the compressor.
`resumes > 0` = the browser suspended the context and the watchdog caught it.
All three zero = **it is not level, and the next round should look at the
listener/panner geometry rather than at the mix.** That is a real fork in the
road, and it is the first time it has existed.

## Gates

Run **serially**. `23/23` green on this branch:

`autotest · regressions · smoke · grave-arena · creature-audio ·
enemy-standing-postclear · horror-polish-round18 · house-critical-path ·
house-return-horror · forest-hardening · forest-nervous-system · legibility ·
district-culling · warm-start · window-scare · coda-seam · basin-shore ·
failure-state · verb-rack · grip-contact · choir-surfacing ·
pump-release-recovery · enemy-stain`

Plus `playthrough` **6/6**, and every probe:

* `probe-gate-respawn` — ALL GREEN, six bank orders with a death after every
  bank, plus the corrupt-session heal and the walkway.
* `probe-grave-passenger` — 5/5 (new this round).
* `probe-house-echo` — 7/7 (new this round).
* `probe-mire-rail` — 7/7 (new this round).
* `probe-key-tree` — PASS, one hit then the key off the grass.

**Known red on `main` BEFORE this branch — verify before blaming yourself:**

* `perf-pool-regression` — 2 checks ("a full burst adds no scene objects",
  "repeated bursts keep scene-object count flat"). Fails identically with this
  branch's `src/` stashed. A round-eighteen regression that is live right now.
* `pause-title-regression` — 1 check ("when pointer lock is unavailable, the
  visible pause button is physically clickable and freezes audio/gameplay":
  `audioState` stays `running`). **3/3 fail on unmodified `main`**; this branch
  passed it 1/3, so it is flaky-red, not new. Also live right now.
* `house-chase-doors-regression` — 1 check ("the Resident walks the house early,
  unprompted"). Red at `e166da4` too. Older than both.
* `underfalls-expansion` — the 2 pre-existing reds ROUND-SIXTEEN already named.

`legibility-regression` failing with `EADDRINUSE` is an infrastructure flake
(a leftover server on the port); re-run it alone and it passes. Set
`FETCH_PORT=<free port>` when running probes beside a sweep.

## Laws — unchanged and re-earned this round

* **Measure your own conclusions.** The gate machinery reads like the obvious
  suspect for "the second key" and `probe-gate-respawn` is green on all six
  bank orders with a death after every bank. What was actually broken was the
  fight around it. Reading told the wrong story twice; the bot told the right
  one.
* **A control makes a number mean something.** "The passenger ends 8.9 m away"
  was worthless until a plain walker on the same grass closed to 0.68 m.
* **Look at the PNG.** The mire rail was shot before it was believed.
* **`grep -c $'\r'` and `cat -A` both LIE about CRLF in this Git Bash.** Count
  bytes in Node. `src/` is CRLF in the working tree, LF in git.
* **Inline `node -e` with parentheses gets mangled by bash** — and so does a
  quoted heredoc past a certain size. Write patch scripts to a file and run
  them, or use the editor tool.
* **Never edit a `src/` file while a gate is running** — a different worktree is
  fine, the same one is not.
* **Gates flake under concurrent Chrome.** Run serially when the numbers must be
  believed.

## Still open, and NOT started

* **The ringing.** See above. This is the one to carry.
* The three pre-existing reds listed under Gates, all of which are live.
* Alex has not played any of this. He needs to hard-refresh (Ctrl+Shift+R).

## Shipping (unchanged, and NOT done this round)

`duplighost/fetch` publishes NOTHING; `duplighost/qualiacology` serves its own
copy of the 22 `src/` files at `fetch/src/` (repo `.gitattributes` forces LF).
Copy (CRLF→LF) → `build-site` (no drift) → `validate-site --root=..` →
`route-smoke --root=..` → `cd build && npm run qa` → `fetch-boot-check` against
a local serve → branch, PR → **boot-check the Netlify deploy preview** → **his
approval** → merge → verify production byte-identical and boot-check it →
fast-forward the game's `main`. The site's `AGENTS.md` is canonical for anything
site-side.

**He did not say "ship it" this round.** The game branch is pushed and the PR is
open; the live site has not been touched.

## Where old context lives

`ROUND-SIXTEEN.md` was the say-fetch doc and its status section is now stale in
one important way: `main` moved three PRs past `e166da4` and the graveyard broke.
Its laws and traps all still hold. `ROUND-SEVENTEEN.md` / `ROUND-EIGHTEEN.md`
are Codex's records of the work that caused the regressions this round repairs —
read EIGHTEEN before touching the wreck, the passenger or the mire. Work off
`main` in a fresh worktree; `Projects/fetch-claude` is STALE.
