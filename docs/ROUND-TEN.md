# ROUND TEN — THE RECORD. Polish.

**Built 2026-08-19 on `claude/aug20-round10`, worktree
`C:\Users\Alex\Projects\fetch-aug20-round10`, off `main` at `ad94ca3`. NOT
pushed, NOT deployed.** He gave no notes for this round — his standing
instruction is to work the agenda without waiting for them — so this is the
brief's ranked list, and **the brief is kept below unchanged because it named
the right jobs. It was wrong about the CAUSE of both of its first two items,
and those two corrections are most of the round.**

## What landed

1. **The districts stop freezing when you walk into them.** His oldest unfixed
   note. Entering the basement cost a **9017 ms** frame; it costs **87 ms**, and
   every other district is 26–138 ms. It was never the geometry.
2. **The graveyard fight stops depending on what spawned somewhere else.** The
   horde did not "get harder" in round nine — every arena walker took its
   circling angle and direction from the global spawn counter, so any spawn
   anywhere re-rolled the whole fight. Nothing was tuned; the coupling was cut.
3. **The tree keeps asking until you hit it.** The key-under-the-branch reveal
   dropped 30 m behind the player and could not be heard at that distance. It
   now creaks on a slow cycle and swings when it speaks, until it is hit.
4. **`tests/legibility-regression.mjs`** — the class of bug this project
   actually ships (working, and invisible) finally has a gate.
5. **Two permanently-red assertions stop lying.** A gate that is always red
   teaches every thread that red is normal.

## The numbers

| | |
|---|---|
| Entering the basement, cold profile | **9017 ms → 87 ms** |
| Every district's first frame | house 37, basement 87, graveyard 28, forest 26, clearing 28, cave 35, mirror 138 ms |
| The first-draw warm pass itself | 531 draws, **1173 ms total over 165 frames, worst frame 8.3 ms** |
| What the driver needs after the warm compile | **10.1 s** to finish linking 261 programs |
| Arena determinism | two runs of six seeds, identical guards (77/77/64/42/77/62) — it had never repeated before |
| The limb at the moment it falls | **30.4 m away, 53.9° off-centre**, against a 48.8° half-frame |
| A 30 m sound at the default 2.4 m reference | **1/44 of its gain** |
| The limb, looked at | 2.69x contrast from the top of the lane; the key in the grass 9x |
| The ossuary wire, re-measured by the new gate | 1.64% of frame at 6.49x (round nine measured 1.64% / 6.2x) |

## The two corrections

**It was never the geometry.** The stalling frame carries +191 geometries, so
the brief called it 191 uploads in one gulp. The same run puts 162 geometries
into the forest in 48 ms — two hundred times cheaper per geometry, which is not
a difference in geometry. `compile()` links a program and `initTexture()`
uploads pixels, but **ANGLE/D3D11 does the rest of its work when a program is
first USED in a draw**, and the game only ever does that in a district's first
frame, forty at once. Round five fixed the compile half of this disease; this is
the other half, and the fix is the same shape: do it early, in slices, behind
the title.

**There were never any attack tokens.** Round nine removed a boot-spawned
basement walker, watched the graveyard fight change, and concluded that walker
had been eating the arena's attack-token budget. The arena's eight sites and
their jitter are fully authored — no `Math.random()` anywhere in the wave
spawner — so the ONLY variation the fight had was `serial`, the global spawn
counter, which set every walker's `orbitAngle` and `orbitSign`. Changing
`this._spawnSerial = 0` to `= 1` and nothing else changed all six seeded
outcomes and made the losing seed survive again. One extra spawn anywhere in the
run re-rolled the horde. That is the whole of "it got harder".

**And the first fix for it was half right, which the deploy audit caught before
this shipped.** Cutting the coupling by hashing the spawn point kept the fight
stable and threw away the thing the old code was actually for: 2.399963 rad is
the GOLDEN ANGLE, and consecutive integers times it are the most evenly spread
set of angles there is. That is what keeps a horde AROUND you. Measured over the
arena's eight authored sites, the hash left a **222-degree hole** in the ring at
wave two and 154- and 120-degree holes at wave three, where the golden angle's
worst gap is 85. So the wave now hands each walker its ring index out of its own
loop counter (`director.js`), golden angle and alternating direction: the
authored spread back, still immune to whatever spawned earlier in the run. The
spawn-point hash stays as the default for everything outside the arena.

## What the deploy audit changed, before any of it went live

Round ten was audited adversarially on the way to the site, and it came back
with real defects in this round's own code — the kind the fourteen gates cannot
see, because every one of them runs `?test=1`, which skips the warm passes
entirely. All fixed before the sync:

- **The horde's formation** (above): a 222-degree hole in the ring.
- **A throw in the warm pass would have frozen the game permanently.**
  `_warmDrawTick` is called from the frame loop AHEAD of every
  `requestAnimationFrame` re-arm, and its two gate calls sat outside the try
  block. One exception and the loop never re-arms — no frames, no recovery. It
  is wrapped now, and it stands down instead of taking the game with it.
- **The per-frame budget could not bound a single render call.** The only thing
  keeping a blocking draw out of a frame was the link poll, and on a driver with
  no `KHR_parallel_shader_compile` there is no poll — only the guess that such a
  driver linked synchronously inside `compile()`. Chrome on ANGLE always has the
  extension, so that guess is the one thing no measurement on this machine can
  test, and Safari/Metal is where it is least likely to hold. The pass now
  watches its own cost: a batch over 120 ms drops it to one draw at a time and
  stands it down for four times the overrun.
- **A mesh with two materials was listed twice**, and two entries in one batch
  made the second capture the `frustumCulled` the first had already set false —
  restoring it false forever. One entry per object now; a multi-material mesh is
  drawn once per group anyway, so a single draw still warms all of them.
- **`degraded` was not terminal**: the early return knew `done` and `skipped`
  only, so a failed pass re-entered every frame for the rest of the session with
  its staging group still in the scene.
- **The audio `ref` comment was wrong about the near field.** Widening
  refDistance alone does not merely stop a far sound vanishing — it flattens
  everything inside it, and ref 15 meant the limb's creak was at full strength
  whether you stood fifteen metres away or touched it. It is 4.5 m with a 0.55
  rolloff now: the same 0.35 of source gain at thirty metres, and still falling
  from 1.0 at three metres to 0.52 at fifteen, so walking toward it reads as
  approach. The legibility gate pins the carry and the falloff, not the number.

## Findings to carry

- **A draw issued while the driver is linking waits for the QUEUE, not for its
  own program.** The first warm draw, issued the instant `compile()` returned,
  cost 6867 ms in one frame. `KHR_parallel_shader_compile` is the one question
  you can ask about link state without waiting for the answer to be yes — the
  warm pass polls a few programs a frame (85 ms total) and starts only when the
  driver is done.
- **Chrome keeps a GPU program cache per profile, so an A/B in one browser is
  not an A/B.** The second scenario gets every program back from disk in
  milliseconds and reads as "fixed". Fresh browser per scenario, always.
- **`refDistance` is a design parameter, not a default.** Exponential rolloff at
  the kit's 2.4 m puts a 30 m event at 1/44 of its gain. Any sound that is meant
  to be heard from across a district needs its own reference distance.
- **Legibility is CONTRAST, not brightness.** A silhouette is as readable as a
  lamp. Scored on brightness alone, a limb that reads as a black diagonal
  against the sky (0.37x) scores below a key that reads as nothing (1.02x).
- **Render until two frames are byte-identical before measuring** — round
  seven's law, re-learned the hard way. `render()` decays the impact light and
  jitters the camera while `_shake` is alive; measured un-settled, the key in
  the grass reported 6.97% of frame at 1.03x. Settled, it is 0.02% at 9x: the
  opposite conclusion.
- **A global counter is a hidden coupling.** `serial` looked like an id and was
  actually the graveyard's dice. If a system's behaviour must be reproducible,
  derive it from that system's own facts — here, the spawn point.
- **When a measurement's units are wrong the check is decorative.** The
  announce's motion was first sampled as the arm quaternion's `w`, which moves
  0.0014 for a swing whose far end travels 0.76 m.

## Still open, and nobody's round yet

- **One cold-profile stall survives, and it is not per-district.** About seven
  seconds after the warm compile the page stops receiving frames for ~7 s, once.
  No JavaScript call owns it — `tools/probe-bedroom-block.mjs` wraps step,
  render, compile, initTexture and the warm pass and none of them account for
  it — and **the untouched tree does the same thing in the same place** (7292 ms
  against 6978 ms). It is the driver finishing ~261 program links, and the only
  levers on it are fewer programs or a longer title hold. Both are somebody's
  deliberate decision, not a polish item.
- **Seed 583 dies at wave two** of the graveyard, to a committed claimed strike,
  and gets back up. Nothing was tuned to prevent it, because there is no longer
  a "leaked pressure" to restore. If he wants the fight gentler the honest knob
  is the wave-2 claim budget in `enemies.js` (`graveWave >= 2 ? 2 : 1`).
- **Brief items 5, 6 and 8 are untouched**: the hands' tendon relief and knuckle
  arcs, the cave pair (the sound failure and the back wall you can walk into),
  and the car alarm's mercy. The under-tree canopy pose still renders ~582 draws
  against the 450 ceiling and is still unclaimed.

## The gates

**All fourteen green on the finished tree, including the playthrough.** No
known-red left in anything this round touched — `house-expansion` and
`horror-expansion` were red before it and are green now.

| | |
|---|---|
| smoke, autotest, regressions | PASS |
| **playthrough** | **COMPLETE — the game can be finished** |
| warm-start | PASS (+0 programs across the whole game; press-to-play 725 ms; basement first draws 85 ms) |
| basin-shore, choir-surfacing, district-culling, render-perf, grip-contact | PASS |
| **legibility (new)** | PASS |
| **grave-arena** | **PASS — first time; re-pinned to what the fight actually promises** |
| house-expansion, horror-expansion | PASS (both were permanently red) |

`underfalls-expansion` ×2 is still known-red and PRE-EXISTING; nothing this
round went near it.

## The commits

| | |
|---|---|
| `ede29a9` | six instruments that take the loading hitch apart |
| `ffb015a` | the districts stop freezing when you walk into them |
| `a6e377b` | the graveyard fight stops depending on what spawned somewhere else |
| `dd9d26c` | two permanently-red assertions stop lying |
| `157e608` | the tree keeps asking until you hit it |
| `7271cca` | the warm pass covers the skull too |

---

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
