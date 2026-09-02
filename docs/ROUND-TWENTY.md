# ROUND TWENTY — say "fetch" and start here

Alex, 2026-09-02, two words: **"finish it and ship it."** Round nineteen had
shipped the graveyard repair and left four gates red on the board with a note
saying they were pre-existing and not asked for. This round is that board,
cleared — and one more elimination on the cave sound.

**Read `ROUND-NINETEEN.md` for the graveyard, the mire and the house-echo
story.** It is still the substance; this doc is the state on top of it.

## The board, cleared

Every one of the four turned out to be a different animal, and only one of them
was the test's fault in the way it looked.

### `perf-pool-regression` — the gate was racing a pass it did not know about

Two checks, "a full burst adds no scene objects" and "repeated bursts keep
scene-object count flat", both comparing against `initial` — a baseline captured
**before the title is ever clicked** (the file asserts `!initial.started` two
lines later). Between that baseline and the burst lives the whole boot, and in
particular the warm-**draw** pass: a different pass from the shader warm-up this
file already waits on, with its own status on `__FETCH.warm().draw`. It parks one
invisible Group, `warm-draw staging`, in the scene while it runs, and once the
game has started it draws **one item per frame**.

Measured (`tools/probe-scene-growth.mjs`): at the moment those checks fire, the
draw pass is `running` at **4 of 561**, and its staging group is legitimately in
the scene. The fragment pool is not leaking at all — three consecutive bursts
hold the scene at **723, 723, 723, 723**.

Each check now takes its own before/after inside one `page.evaluate`, a
synchronous block no rAF pass can interleave with. It measures the sentence it is
named after and nothing else.

### `pause-title-regression` — a REAL bug, and the code already knew

This one looked like the same shape (assert `ctx.state === 'suspended'` without
waiting for the 420 ms suspend timer, where its passing sibling — the Escape
scenario — does wait). Adding the wait took it from 3/3 red to 4-of-7 flaky,
**which is the tell that the wait was not the whole story.**

`_setAudioPaused` in `main.js` names the real one in its own comment:

> *"Suspending an AudioContext is a request with a promise attached, and the
> engine's own watchdog resumes on any non-running state without asking who asked
> for it (audio.js) — so a pause is a race, and the thing that loses it is
> silence."*

The audio watchdog exists for exactly one case: **the browser** suspending us
under CPU or memory pressure, after which FETCH is silent for the rest of the run
because `init()` is the only thing that ever resumed the context. It could never
tell that case from a pause. So pausing the game suspended the context and the
watchdog put it straight back on the next tick. A previous round worked around it
by ramping the master to zero — which is why a paused game *sounds* silent — and
left the fight underneath.

A deliberate hold is now announced (`audio.holdSuspended(true)`, set by
`_setAudioPaused` and by `stopAll({ suspend: true })`) and the watchdog leaves it
alone. The gain ramp stays; it is still what makes a pause silent whatever is
playing. **5/5 clean after the fix, from 3/3 red.**

This is a real product change: pausing FETCH now actually suspends its audio
context instead of the engine undoing its own request.

### `house-chase-doors-regression` — the gate was failing the game for obeying its design

"The Resident walks the house early, unprompted": teleport to the house, step
19.5 s against an 18 s constant, expect a body. `_updateResident` holds that
clock for the whole landing window-entry scare, on purpose — *"a Resident
arriving mid-fold does not stack, it steps on the only scare in the room… The
constant stays exactly as Alex dialled it."*

Measured (`tools/probe-resident-clock.mjs`): the clock runs 17.8 → 5.3 by twelve
seconds, then holds through `press / sash / fold / skitter / done`, and the body
arrives at **26.5 s**, deterministically. A flat 19.5 s budget was written
against the bare constant and has been red since the hold was added.

The gate waits for the arrival now and asserts **both** halves — it comes
unprompted, and it does not come before the constant Alex dialled. 3/3, all
reporting `arrivedAt: 26.5`.

### `underfalls-expansion` — already fixed, the note was stale

ROUND-SIXTEEN listed two known reds here ("the broken-promise gate", "the hatch
entering the mirror room") and called them the oldest untouched thing in the gate
set. They are **18/18 PASS**. Round eighteen's Underfalls work fixed them and
nobody re-ran it. The note outlived the bug by two rounds.

## The cave ringing — one more hypothesis retired

Still not reproduced, and still the thing to carry. Round nineteen retired
**level** (five wall-clock minutes with a real AudioContext held the master flat,
the context never leaving `running`). This round retires the other fork it named.

`tools/probe-audio-finite.mjs` wraps every `AudioParam` automation setter, the
`value` accessor, and the legacy `PannerNode`/`AudioListener` position writers —
the ones that do **not** throw on NaN — then runs the district hard in real time.
A non-finite value fits every word of his report: it poisons everything
downstream, the output goes silent and stays silent ("it crashes the sound"), and
one bad panner takes one ear first ("it starts out in my left ear").

Three real minutes on the main route: **no non-finite value reached the graph and
no non-finite player pose**, context running, zero dropped voices, zero storm
seconds.

So two of the three hypotheses are now dead by measurement rather than by
argument. **What is left is the districts and inputs neither probe covers**: the
optional culvert and the blind gallery, a real mouse-and-keyboard session rather
than a scripted one, and a long tail — his sessions are longer than any probe has
run. When he reports it again, `__game.audio.voiceStats()` is still the first
thing to ask for, and now `droppedVoices`/`stormSeconds`/`resumes` all being zero
means something specific: it is not level, it is not NaN, and the next round
should go after the districts the probes have never walked.

## Gates

Every gate in `tests/` except `playthrough` and `render-perf`, run serially:
**33/33 green**, including all four that were red on the board.
`playthrough` **6/6**. `netlify-release-integrity` needs
`node tools/package-netlify.mjs` first — that is not a defect, it is a missing
artifact on a fresh worktree.

New probes this round, all in `tools/`:
`probe-scene-growth.mjs` · `probe-resident-clock.mjs` · `probe-audio-finite.mjs`.

**There are no known red gates.** If one goes red, it is new.

## Laws

Everything in ROUND-NINETEEN still holds. One earned here:

**A partial fix that makes a red gate FLAKY has not found the bug.** Adding the
missing wait to the pause check took it from 3/3 red to 4-of-7 — and it was the
remaining flakiness, not the initial redness, that pointed at the watchdog
resuming a context the game had deliberately suspended. Determinism is the
signal; a gate that passes *sometimes* is still telling you something.

**A stale "known red" is worse than a red.** Two of the four were not bugs at
all by the time anyone looked, and one of those had been quoted forward through
four round docs as the oldest untouched thing in the project.
