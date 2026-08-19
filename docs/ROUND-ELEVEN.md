# ROUND ELEVEN — THE RECORD. His notes on the live build.

**Built 2026-08-19 on `claude/aug21-round11`, worktree
`C:\Users\Alex\Projects\fetch-aug21-round11`, off `main` at `5705777`.** This
round is not the brief below — it is **his notes**, kept verbatim in
`docs/HIS-NOTES-2026-08-19.md`, which arrived after he played round ten live
(including a pass in incognito, i.e. a cold GPU program cache). His notes
outrank the brief and the brief is kept underneath.

**What he said first, and it frames the whole round:** *"this game feels really
good. I mean, there is a few things we could fix, but it's good enough that I
kind of worry about asking lol."* And: *"first priority is not to ruin what we
have."*

**Round ten is confirmed by the person it was for.** No freezes anywhere in
play. The graveyard fight "seems to work fine". Only the title-click freeze
survives, and he asked for it to be left where it is.

## The finding of the round: THE CAVE HAD NO FLOOR

He reported it as *"the path on the ground looked kind of boring."* The path was
the only thing being drawn.

`installCaveVisibility` spares the world's shared rock batch from the district
hide with `child.material === game.mats.rock`. `finishStatic` merges every
`world.box` under `mat.clone()`, and a clone is never identical to its source —
so that question has been answering NO since the clone landed. The batch it was
written to protect carries the cave's floor: 208 route treads, 12 route roofs,
the side-wall backing, five chamber caps, the hatch cistern. For the whole cave
act the player walked a lit ribbon with an unlit gutter either side.

Git dates it exactly: the clause is `7a59ea6` (2026-08-09), the clone is
`8d4c5a2` (2026-08-14, THE VISUAL PASS), and the clone is not an ancestor of the
clause. **It has been live through rounds seven, eight, nine and ten.** No gate
saw it — district-culling asserts that exteriors are hidden, that draws stay
under 450, and that visibility restores on exit, never what a floor is made of.

Proved by A/B on the shipped tree, not by argument: reverting `world.js` and
`underfalls.js` alone brings the black gutters back at the same camera and pose
(`tools/probe-cave-floor.mjs`; `scratch-r11/cave-BEFORE.png` vs `cave-AFTER.png`).

**The trap in the fix, for whoever touches this next:** do NOT tag
`M.rock.userData`. The cliff, the ten bridge stones and the basin sill are
top-level meshes on that same material and would leak into the cave. The shell
remembers what it was cloned from instead (`world.shellFor`).

## What else landed

| his note | what it actually was |
|---|---|
| the car is odd to hit, and you walk through it | ONE cause: a 5.0×2.1 m body rotated 55° inside an AXIS-ALIGNED collider, 4.39×5.08 m, blocking 24 m² where the car is 10.4. The 2.35 m hit sphere sat INSIDE that box on both broad faces and all four corners, and skull.js collides before it tests targets — **86% of throw bearings bounced off nothing**, and only ±11° due east and ±14° due west landed. Sphere → 3.0; the destroyed wreck's collider 0.62 → 0.98 (step-up 0.5 over terrain at +0.18 was clearing it). |
| "another key at the top of the tree" | **the locket** — act 0's optional keepsake, authored, not a gate key, and it pays off on the waterfall shore. Nothing broken. What was real: it chimed at a 2.4 m reference distance so it was inaudible anywhere he would meet it, and once worn it hung 8 mm from the marrow relic. Both fixed; the pickup is untouched (playthrough pins taking it from the graveyard). |
| the thing under the waterfall can kill you | his call: it catches you and lets you go now. The apparition he asked for in round six is intact — it still rises, still teleports ahead of you — and the second catch is the same recoil as the first, then `spent`. **There is a second figure in that district that never attacked in the first place** (the passive spray sighting in the chapel); it is what he was asking whether we could have, and it was always there. |
| the sound glitch | **not solved, and two rounds of our own advice about it were wrong.** `voiceStats()` is structurally blind to the cave: `VOICE_CAP`/`_voices` live only in `_play()`, and every cave sound goes through `_bus()`. Stop asking him to run it there. The frozen-loop theory was refuted (every enemy loop has the identical shape, so it would not be one district). Real lead: the cave carries the highest wet send in the game, 0.32 against 0.18/0.22, on the longest impulse. Meanwhile a pause is now silent regardless of cause. |
| walking back sees the edge of the world | one rule — `clearOf` keeps trees out of the corridor you arrive through, which is right for the arrival and wrong for the walk back once the forest has sealed. Flanks planted, centre lane left open, no colliders. Zero new draws. |
| the title freeze | left alone, at his word and on the evidence. |
| the ossuary walk-in | left alone. There is no hole — the throat is paint on solid terrain — and the walk-over cannot rescue a stuck player anyway, because it only fires after E has already worked once. |

## The method that found it

Every one of his seven notes was investigated independently and then
**adversarially refuted**, which is what caught the two mistakes in this round's
own analysis: the sound-glitch mechanism (refuted) and the first version of the
graveyard orbit fix in round ten (a 222° hole in the horde's ring, found on the
way to the deploy). The cave floor came out of that pass as a claim its own
author flagged as unrendered — *"I did not render this; falsify it in one line
before acting."* It was rendered. It was true.

**Neither the gates nor a screenshot would ever have caught it**, and that is
the lesson worth keeping: every gate runs `?test=1`, every cave screenshot shows
the lit ribbon, and the ribbon looks fine.

## The gates

All green on the finished tree: smoke, autotest, regressions, **playthrough
(COMPLETE)**, warm-start, basin-shore, choir-surfacing, district-culling,
render-perf, grip-contact, legibility, grave-arena (six of six), house-expansion,
horror-expansion, pause-title (25 checks). Cave holds 137 draws, clearing 149,
both unchanged — the floor and the screen cost nothing.

## Still open

- **The sound glitch.** Cause not found. Do not ask him for `voiceStats()` in
  the cave; it cannot see that district. Look at the wet send.
- **The title freeze**, by his decision, and the reasoning is in ROUND-TEN.md.
- **His cave ideas not taken this round:** lens droplets when you pass under
  falling water (feasible on the existing grain pass, but as non-refractive
  marks only — there is no scene render target), a wet-rock path (re-judge it
  now that there IS a path to judge), ceiling drips and edge steam (+1 draw
  call, carriers already exist). Cost notes for all three are in the triage.

---

# ROUND ELEVEN — the brief.

**Read this first when Alex says "fetch."** Written 2026-08-19 by the round-ten
thread, against `claude/aug20-round10`. Round ten's record is
`docs/ROUND-TEN.md` — read that second; its findings will bite this work
directly.

## Where the game stands

Round nine (his five notes) is **LIVE** at qualiacology.com/fetch/ and `main`
IS the live game. **Round ten is BUILT, NOT PUSHED, NOT DEPLOYED**: the loading
hitch, the graveyard's hidden coupling, the key tree's announce, a legibility
gate, and two red assertions retired. Deploying is his call and it is a separate
repo (`duplighost/qualiacology`) — never from here.

## Do not wait on Alex

**His instruction, verbatim (2026-08-19): "you should just have them do it
without my notes. if i have notes ill give them notes."** Start on the agenda
below. Notes outrank every line of this file the moment they arrive.

## The agenda, ranked

1. **THE LAST STALL, and it is the only one left.** About seven seconds after
   the warm compile, on a cold GPU program cache, the page stops receiving
   frames for ~7 s — once, in the bedroom, right after the press. It is
   PRE-EXISTING (the untouched tree does 7292 ms where round ten's does 6978)
   and it owns no JavaScript call: `tools/probe-bedroom-block.mjs` wraps step,
   render, compile, initTexture and the warm pass and none of them account for
   it. It is the driver finishing ~261 program links. **Two honest levers, and
   both are decisions rather than fixes:** (a) fewer programs — 261 is a lot for
   a game with a pinned light census, and `renderer.info.programs[].cacheKey`
   will say what they differ by; (b) hold the title until
   `KHR_parallel_shader_compile` says the driver is done (round ten already has
   the non-blocking poll: `_warmLinksSettled` in main.js), which trades a 7 s
   freeze in an authored beat for a longer, honest wait on a loading screen.
   Measure (a) first: if fifty of those programs are variants nothing draws,
   this stops being a decision.
2. **The cave pair, both reported by him, both still unexamined.** The sound
   failure (if he hits it again, get `__game.audio.voiceStats()` from him) and
   the back wall you "can go through a bit". The second is a collider gap and
   `tests/basin-shore-regression.mjs` is the pattern for pinning it: drive
   bearings at the wall and assert nobody ends up behind it.
3. **The hands' leftovers** (ROUND-EIGHT.md): tendon relief as BUMP in the
   skinPaint sheet, never geometry; the knuckle arcs (`rootArc` in mkHand,
   free); the cradle lamps. Respect the SkinnedMesh traps in that file.
4. **The under-tree canopy pose renders ~582 draws against the 450 ceiling**,
   still unclaimed. Start attribution at the canopy and the sky pass;
   `tools/shot-cull-audit.mjs` and the district culler in house.js are the
   tools. Round seven took the graveyard's south view from 1203 to 327 the same
   way.
5. **Extend `tests/legibility-regression.mjs`.** It pins four things today (the
   ossuary wire, two limb poses, the key in the grass) plus the key tree's
   announce. Every authored reveal deserves a line in it: the car alarm's
   strobe, the kennel wire, the pump-gallery latch, the marrow's payout. The
   instrument is in the file and the traps are in its header.
6. **The car alarm's mercy**, only if he finds it exhausting live: the knob is
   the resonance-pulse rate, never the sound.

## Laws and traps — pointers, not repeats

- `AGENTS.md` — the laws. Throw grammar sacred, no HUD, his copy only,
  value/shape/motion never hue alone.
- `docs/ROUND-TEN.md` — newest record. Its findings, short: a draw issued while
  the driver is linking waits for the whole QUEUE; Chrome's GPU program cache is
  per profile, so an A/B in one browser is not an A/B; `refDistance` is a design
  parameter (the kit's 2.4 m default puts a 30 m sound at 1/44 gain); legibility
  is CONTRAST, not brightness; render until two frames are byte-identical before
  measuring anything; a global counter is a hidden coupling.
- `docs/ROUND-NINE.md` — the ossuary seal hides everything outside `routeRoot`;
  an InstancedMesh is culled by its base geometry at the origin (print
  `layers.mask`); `finishStatic()` clones materials.
- `docs/ROUND-SEVEN.md` — before recolouring ANY surface,
  `tools/probe-body-specular.mjs` (the black-albedo test) and
  `tools/probe-albedo.mjs` (canvas × material product).
- Measure what he DESCRIBES, not what you assume causes it. Round eight found
  38 mm of air by taking his sentence literally; round ten found a limb nobody
  could hear by measuring the thing he said he never saw.
- Raid his other games (`C:\Users\Alex\Projects\`) before writing anything
  fresh. Every strong thing in FETCH has been a port.
- **Audit your own round before it ships.** Round ten's deploy audit found a
  222-degree hole in the horde's ring, a throw path that would have frozen the
  game permanently, and an unbounded blocking draw on any GPU without
  `KHR_parallel_shader_compile` — none of which any of the fourteen gates could
  see, because they all run `?test=1` and `?test=1` skips the warm passes. If
  your round adds a code path that only real players take, no gate covers it.
- **Never edit a src file while a gate is running.** The server reads from disk;
  a half-finished edit is a syntax error in somebody's page and a red gate you
  will spend twenty minutes explaining.

## The suite

Redirect to files, never pipe through tail: smoke, autotest, regressions,
playthrough (COMPLETE), warm-start, basin-shore, choir-surfacing,
district-culling, render-perf, grip-contact, legibility, plus grave-arena after
any enemy work (FETCH_ARENA_SEEDS=583 narrows it to one fight while tuning).
Known flakes: warm-start's "press answered in the same task" (CDP race — re-run
before suspecting a commit) and any Playwright NAVIGATION error under load.
Known-red and pre-existing: `underfalls-expansion` ×2.

## The standing brief

Unchanged, and it is the law: he funds ambition, plays live, forgives rough but
not broken. When he repeats himself it is because we did not do it the first
time. An object is never finished; a frame is. Polish means the game he already
has, made to read and land and never stutter — not new features invented on his
dime.
