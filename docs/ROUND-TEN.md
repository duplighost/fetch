# ROUND TEN — POLISH. The brief.

**Read this first when Alex says "fetch."** Written 2026-08-19 by the
round-nine thread, against `main` at `aeeee13`. Alex's word for this round is
**polish**, and he said plainly that he does not know what that requires — so
this file defines it, and his played notes override every line of it the
moment they arrive.

## Where the game stands

Round nine (his five notes: destructible car with alarm, instant ossuary
hatch, the basket arms the wheel, the dropcloth walker survives death, the
pump latch fires on arrival, vermin everywhere) is **LIVE** at
qualiacology.com/fetch/ — site PR #76, production boot-checked, bytes
verified. **`main` of this repo IS the live game** (caught up 2026-08-19;
zero open PRs; the `claude/*`/`codex/*` branches are finished history, not
choices). As of writing **he had not yet played round nine.**

## Do not wait on Alex

**His instruction, verbatim (2026-08-19): "you should just have them do it
without my notes. if i have notes ill give them notes."** So: start working
the agenda below immediately. If notes arrive mid-round, they outrank
everything here — reprioritize around them without ceremony. Do not open the
round by asking him questions.

Two decisions round nine parked as "his call" are therefore YOURS now, with
these defaults (each cheap to reverse if he objects):

1. **The graveyard fight got harder.** A basement enemy had been silently
   eating the arena's attack tokens since forever; fixing his dropcloth bug
   removed it, and the fight now runs at authored pressure for the first time
   (seed 583 dies at wave 2 where it used to scrape through — that is why
   `grave-arena-regression` is red). **Default: restore the difficulty he
   actually PLAYED.** Every live playtest he ever did was with the leak, and
   he never called the fight too easy — so the pressure he approved is the
   leaked pressure. Tune the token budget/pacing until the six seeds behave
   about as they did pre-fix, re-pin the test, and say plainly in the record
   that full authored pressure is one knob away if he wants it.
2. **The pump bridge still retracts under a player standing on it** when the
   hold rewinds. **Default: freeze the rewind while the player is on the
   bridge segments.** A bridge leaving under your feet is the same
   working-but-confusing shape he already reported about this exact
   mechanism; the hazard reading is available later if he asks for it.

## How to get going

```
git fetch origin
git worktree add C:\Users\Alex\Projects\fetch-aug20-round10 -b claude/aug20-round10 origin/main
```

Work there. Never in `Projects\fetch-claude` (stale, shared). One change per
commit, **full suite after every commit**, open the PNGs — every wrong
conclusion this project has ever made came from reasoning instead of looking.

**The suite** (redirect to files, never pipe through tail): smoke, autotest,
regressions, playthrough (COMPLETE), warm-start, basin-shore, choir-surfacing,
district-culling, render-perf, grip-contact, plus after graveyard work
grave-arena + probe-graveyard. Known flakes: warm-start's "press answered in
the same task" (CDP race — re-run before suspecting a commit) and any
Playwright NAVIGATION error under machine load. Known-red, PRE-EXISTING, do
not chase as your own: `underfalls-expansion` ×2, `horror-expansion` ×1
(chapel displacement), `house-expansion` ×1 (asserts a foyer mirror that
house.js line 6 says was deliberately removed — retiring that assertion IS a
polish item, see below), and `grave-arena-regression` pending his verdict
above.

## The default polish agenda, ranked

What "polish" means when his notes don't say otherwise. Each item is real,
already diagnosed, and carries its evidence.

1. **THE LOADING HITCH — his oldest unfixed complaint.** "Loading new areas
   just about always freezes it." First entry past the house costs a **7–8
   second frame** — ~191 geometry uploads in one gulp, ZERO shader compiles
   (the shader half was fixed in round five; this is the buffer-upload half of
   the same disease). Attribution floats between `enter:basement` and
   `enter:graveyard`; pre-existing since round six. `tools/probe-hitch.mjs`
   reproduces it in one run; `?hitch=1` logs every frame over 150 ms with
   geometry deltas. The fix shape that already worked once: the round-five
   warm pass pre-compiled every shader at boot — do the same for geometry
   (render each district's meshes once behind the title, or chunk the uploads
   across frames). This is the single highest-value polish item in the game.
2. **The graveyard difficulty verdict** (question 1 above), then either tune
   or re-pin `grave-arena-regression`'s seeds deliberately.
3. **The key-under-the-tree reveal is illegible.** The MECHANISM is proven
   fine (`tools/probe-key-tree.mjs`: hit branch → key drops → fetch works) —
   he just never SAW it happen. Classic working-but-illegible
   ([[fetch-legibility-law]]): measure the reveal (view-cone integral,
   key-vs-ground luminance ratio), then make it announce — travelling knocks,
   a beat of light, whatever reads. Do not re-fix the mechanism. NEARBY: the
   under-tree canopy pose renders ~582 draws against the 450 ceiling,
   unclaimed; start attribution at the canopy and sky pass.
4. **Pin the legibility suite.** The project's dominant failure mode ships
   working-but-illegible because the gates test function, not reading. The
   measurements exist (ON/OFF luminance ratio ≥ ~1.6x, % of frame changed,
   view-cone reveal integrals — round nine measured its wire at 1.64% / 6.2x
   and its alarm strobe at 3.6% this way). Turn them into
   `tests/legibility-regression.mjs` so this class can't ship again.
5. **The hands' leftovers** (ROUND-EIGHT.md): tendon relief on the back of
   the hand (do it as bump in the skinPaint sheet, NOT geometry — 8 draws vs
   16 headroom bought ~2px), the knuckle arcs (`rootArc` in mkHand, free),
   the cradle lamps. Respect the SkinnedMesh traps in ROUND-EIGHT.md.
6. **The cave pair:** the sound failure (if he hits it, get
   `__game.audio.voiceStats()` from him) and the back wall you "can go
   through a bit" — both reported, both unexamined.
7. **Retire the stale assertions:** house-expansion's foyer-mirror check
   (asserts a deleted feature), horror-expansion's chapel check if
   investigation shows it stale too. A permanently-red gate trains threads to
   ignore red.
8. **The car alarm's mercy**, only if he finds it exhausting live: the knob
   is the resonance-pulse rate, never the sound (the
   destruction-is-the-off-switch loop is the design).

## Laws and traps — pointers, not repeats

- `AGENTS.md` — the laws. Throw grammar sacred, no HUD, his copy only,
  value/shape/motion never hue alone (NOT because he's colorblind — he isn't;
  it's the one-lantern rule).
- `docs/ROUND-NINE.md` — the newest record. Its three findings will bite
  polish work directly: the ossuary seal hides everything outside `routeRoot`
  (world.box wiring is invisible there); an InstancedMesh is culled by its
  base geometry at the origin (if a thing won't draw, print `layers.mask`);
  `finishStatic()` clones materials (toggle the `:shell` copy, not yours).
- `docs/ROUND-SEVEN.md` — before recoloring ANY surface:
  `tools/probe-body-specular.mjs` (black-albedo test) and
  `tools/probe-albedo.mjs` (canvas × material product). Render until two
  frames are byte-identical before measuring anything.
- Measure what he describes, not what you assume causes it — round eight's
  38 mm of air was found by taking his sentence literally.
- Raid his other games (`C:\Users\Alex\Projects\`) before writing anything
  fresh. Every strong thing in FETCH has been a port.
- **Deploying:** never from this repo. The site is `duplighost/qualiacology`
  — read ITS `AGENTS.md`, copy changed `src/` files (LF), verify 22/22
  identical, build → validate → browser-qa → `fetch-boot-check` local, PR,
  boot-check the Netlify preview, **his explicit approval**, merge, boot-check
  production. Exercised three times in one week; it works exactly as written.

## The standing brief

Unchanged, and it is the law: he funds ambition, plays live, forgives rough
but not broken. When he repeats himself it is because we did not do it the
first time. An object is never finished; a frame is. Polish means the game he
already has, made to read and land and never stutter — not new features
invented on his dime.
