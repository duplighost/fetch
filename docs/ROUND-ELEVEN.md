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
