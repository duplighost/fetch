# FIRST LIGHT — why 0.6.0 shipped black, and what fixed it

Written 2026-08-11, the night `0.6.0-broken-promise` went to production and
Alex clicked Wake up into a black screen with the game audibly running
underneath. Diagnosed jointly: Claude ran the pixel forensics and found the
scheduling race; Codex found the compositor defect. Both were real. Each alone
was enough to blind a player; together they were airtight.

## The symptom

Click Wake up → screen stays black. The center reticle (DOM) is visible,
footsteps and the skull throw/return sounds play, input works. No console
errors, no WebGL errors, context healthy. Eventually — sometimes — the
bedroom appears out of nowhere.

## Why every gate was green anyway

- All canonical suites (`smoke`, `autotest` 24, `regressions` 50,
  `playthrough`) boot `?test=1`, and `_scheduleShaderWarmup` **skips the
  entire warmup system in test mode** (`status: 'skipped'`, main.js ~5257).
  The machinery that broke was never exercised by a single deterministic test.
- Those suites assert **renderer counters** (draw calls, triangles, budgets),
  never presented pixels. 0.6.0 faithfully drew 284 calls / 113k triangles of
  world into frames that reached the screen as pure black — every counter
  assertion passed.
- The production "boot" verification checked HTTP 200, the `<title>`, the
  version string, and `ready: true` — nobody clicked Wake and looked.

## Bug 1 — the reduced compositor erased its own frame (Codex's find)

`render()` draws reduced-detail frames via `_renderReducedCurrentWorld()` —
the "playable silhouette" (measured luma ~26: dim, visible, by design). But
the grain pass that follows runs with `renderer.autoClear` still `true`, so
it **cleared the completed silhouette to black** and composited film grain
over nothing. The full-detail branch was immune only because it sets
`autoClear = false` for its own held-view pass.

Repair: one line — after the reduced world pass, `autoClear = false`, same
contract as the full branch; the end-of-frame cleanup already restores it.

## Bug 2 — the one-shot view capture lost a race with the player (Claude's find)

Certification out of reduced detail requires the `current-view-exact` variant.
The warmup itinerary captured the live view **exactly once, at a fixed
position in its chapter sequence** (main.js ~6600). The itinerary starts on
the title screen via `requestIdleCallback`; the player's Wake click creates
the live residency at an arbitrary time relative to it:

- Wake **before** the capture point → captured → certification lands
  (~90 s cold on the GTX 980M / ANGLE D3D11 path).
- Wake **after** the capture point → capture silently skipped → certification
  waits forever on a variant nobody is ever going to compile. The recovery
  path (`_ensureCurrentExactShaderWarmup`) refuses to reschedule while the
  itinerary status is `'pending'` — and the overall status never leaves
  `'pending'`, so the deadlock was total.

This is why the bug appeared "intermittent": it depended on how long you sat
on the title screen before clicking. Alex's first test (shortly after the
0.6.0 deploy) hit the survivable window; his second didn't.

Repair: the capture is now a re-armable helper — retried at every chapter
boundary and from a post-itinerary tail that stays armed (250 ms poll, ends
with invalidation/generation change) until a live view exists to capture.

## The third question — boot bypass, or trust the fallback?

With both repairs in, the remaining question was whether the opening bedroom
should additionally force a full authored render on first Wake
(`bootFirstLight`), accepting a one-time synchronous compile stall, or trust
the now-visible silhouette until certification lands. Measured head-to-head
(matrix below) rather than argued.

## The measurement matrix

Variants × Wake timings, passive in-page rAF observer (never forces a
render), cold profiles, GTX 980M / ANGLE D3D11 under agent load:

- **A** = 0.6.0 exactly as shipped
- **C** = compositor repair only
- **D** = compositor + re-armable capture
- **E** = D + bootFirstLight forced full first render

Cells: first visible frame / first authored-world frame / longest event-loop
stall after Wake.

| Variant | immediate Wake | mid-itinerary Wake | late Wake |
| --- | --- | --- | --- |
| **A** shipped 0.6.0 | black 76.5 s, then world | **nothing within 110 s** | black 88 s, then world |
| **C** compositor only | visible 0.07 s / world 59 s | visible 0.07 s / world 66 s | visible 0.05 s / world 99 s |
| **D** compositor + capture | visible 0.23 s / world 71 s / stall 174 ms | visible 0.08 s / world 45 s / stall 82 ms | visible 0.13 s / world 26 s / stall 74 ms |
| **E** D + boot bypass | **rejected** — 7–14 s synchronous main-thread seizure at Wake on cold caches (wall-clock); input, simulation, and audio all frozen | | |

Caveats kept honest: browser process shared across cells within a variant run
(each variant's first cell is its coldest); the D row is from the final gate
run with `PerformanceObserver('longtask')` stall measurement. An earlier
passive matrix printed E as "0.01 s / 10 ms" — an instrumentation artifact
(rAF timestamps are stamped before callbacks execute, so a synchronous
compile inside the first frame is invisible to them; and E ran on a warm GPU
process). E's real cold cost was measured wall-clock at 7.2–14.4 s.

**Shipped: D.** It restores the architecture Codex built — a playable
silhouette in under a quarter second, no seizure, guaranteed eventual exact
certification in every click regime. Known follow-up: cold time-to-authored-
world (26–71 s under agent load, silhouette visible and playable throughout)
could shrink if the itinerary jumped the current view to the front of the
queue at Wake, the way context restore already does with `priorityAct`.

## The missing gate

`tests/first-light.mjs` now exists: boots the real player path (no test
flag), clicks Wake at immediate / mid-itinerary / late timings, and asserts
with wall-clock deadlines that (a) the authored world reaches the presented
canvas, (b) the reduced fallback composes non-black in the frame class where
it legitimately runs (context restore), and (c) no disqualifying event-loop
stall occurred. It samples pixels from a passive rAF observer registered
after the game's own loop — the harness never drives the renderer itself.

## Epilogue — the same night, after 0.6.1 went live

0.6.1 passed the strengthened gate and a production pixel verify, and then
failed the only test that has never lied: Alex playing his own game.

- The reduced silhouette **cannot draw the HELD pass** — the world pass and
  the held-view pass are separate depth passes, and
  `_renderReducedCurrentWorld` only renders the former. The skull — the
  player's light, weapon, and key-fetcher — was invisible in his own hands
  for the entire certification window. For this game specifically, the
  fallback hides the one object that cannot be hidden.
- A follow-up probe then "proved" a fourth failure mode (full detail black
  under input). **Retracted.** That probe read the canvas outside the frame
  task, which with `preserveDrawingBuffer: false` is black by construction —
  it read known-good 0.5.0 as black too. Tonight produced three invalid
  instruments alongside four real bugs; treat every new probe as guilty
  until it correctly measures a known-good build.
- Alex called the revert. Production returned to `0.5.0-intruder`
  (site merge `e6df546`), play-verified with a valid same-task probe:
  world visible 2.17 s after Wake, 100 % of played seconds visible while
  walking and throwing. **That is the acceptance bar 0.6.x must now meet:
  the play-during-boot pixel gate green AND Alex's hands on a preview.**
- The `full-wake` candidate (render the authored world from the first
  started frame at generation 0; machinery governs restored contexts only)
  is parked on `claude/full-wake-parked` with the v4 gate. It is untested
  against the acceptance bar. Whoever picks it up: your gate must first
  read known-good 0.5.0 as visible and shipped 0.6.0 as black, or your gate
  is the next invalid instrument.

## Lessons this repo should keep

1. **A counters-green renderer can be pixels-black.** Any gate that certifies
   "the player can see" must read the presented canvas.
2. **Test mode that skips a subsystem cannot certify that subsystem.** The
   warmup ran in zero of the 74+ green checks cited in the release handoff.
3. **"Boot reached ready:true" is not "a person clicked the button and saw
   the game."** The brutally simple human gate would have caught this in
   fifteen seconds.
4. **Timing-dependent bugs masquerade as flaky hardware.** The release's two
   "timing-only reds" were adjacent to a real scheduling race in the same
   machinery.
