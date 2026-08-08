# FETCH 0.2.0-codex — iteration record

## Intent

This pass treats FETCH as a complete, playable horror short rather than a
collection of promising set pieces. It preserves the project laws: immediate
player control, no gameplay HUD, press/hold/release throw grammar, the Mass Law,
growth that is never witnessed, audio-led threat communication, forward-only
story progression, and the waterfall's single broken promise.

## What changed

### Skull, input, and feedback

- Ships a new anatomical variant C by default: 8,644 triangles against a
  declared 9,000-triangle budget. Variants A and B remain query-selectable.
- Defers skull growth while held or visibly in flight and applies a requested
  stage exactly once after it becomes unseen or gone.
- Removes the hidden crosshair and makes the skull's own cyan-violet light a
  systemic state cue: strong at range, dim in hand, absent after the bargain.
- Converts focus loss into a one-shot release edge, preventing stuck throws or
  movement when pointer lock or the browser focus disappears.
- Keeps camera look responsive during death and finale transitions while feet
  may be locked; the game never wrestles the player's view into a canned pan.

### Progression and recovery

- Story zones can only advance, never roll the act backward when zones overlap.
- The cave zone is disabled and physically barred until the waterfall takes
  the skull; the ceiling hatch independently checks the same story condition.
- The rope launch creates a far-side spatial checkpoint. Death restores that
  exact pose with the rope still spent and the route still traversable.
- The waterfall state, missing skull, open cave, collapsed barrier, and rising
  bridge survive death/recall. Bridge-rise callbacks are global to the set piece
  so a death cannot silently cancel its remaining stones.
- Director timers are scoped to the act and life that scheduled them, stopping
  stale scares from leaking into later rooms or across respawns.

### Threats and collision

- Repairs the Standing Kind scratch-vector alias that could corrupt its test for
  whether the player was looking.
- Adds cached wall/door line-of-sight rejection, better character separation,
  center-inside collision resolution, and swept skull hits across high-speed
  movement so thin targets are not skipped between frames.
- Resculpts Walker, Resident, and Kneeler silhouettes with shared geometry and
  more legible poses while retaining their original behaviors and audio roles.

### Environment and composition

- Reframes the opening so the amber key/window problem reads immediately.
- Adds a graded night dome, 540 deterministic colored stars, moon and halo,
  carved grave silhouettes, forest arches/roots/canopy/ferns, and cyan foxfire
  wayfinding that remains distinguishable without red/green discrimination.
- Rebuilds the waterfall as a continuous vertical veil with layered talus,
  plunge pool, foam, mist, fireflies, ferns, staged bridge stones, and a real
  pre-bargain barrier instead of a flat curtain on an empty rectangle.
- Turns the cave's backing slabs into a dense irregular rock skin with ceiling
  breaks, stalactites, candles, and high-luminance cyan mica marking the route.
- Rebuilds the finale's echo bedroom with furniture, door, window, rug, lamp,
  peeling veil, mirrors, and an articulated human reflection carrying the
  evolved skull's head—while the player's look remains live through the close.

### Rendering, accessibility, and maintenance

- Preserves the drawing buffer only in deterministic test mode, avoiding the
  shipping cost of retaining every frame solely for screenshots.
- Reuses gore geometry/materials, forest scratch objects, and batched/instanced
  environment sets; atmosphere animation uses one ticker fan-out.
- Reduces grain/vignette obstruction, adapts motion for `prefers-reduced-motion`,
  and exposes meaningful title/death states to assistive technology without
  turning play into a stream of noisy announcements.
- Corrects the playthrough's vacuous Resident assertion and JPEG extension bug.
- Relabels smoke's render-free loop measurement as simulation throughput and
  adds a separate rendered rAF/GPU timing gate.

## Final source verification — 2026-08-07

Machine and browser observed by the test harness:

- Windows 10.0.19045
- Node.js 24.18.0
- Chrome 151.0.7922.108
- Visible 1280 × 800 WebGL2 drawing buffer
- ANGLE / NVIDIA GeForce GTX 980M / Direct3D 11 (not a software renderer)

Results:

- Syntax: 26 JavaScript/MJS files passed `node --check`.
- Original deterministic API suite: 23/23 checks, zero browser errors.
- New regression suite: 23/23 checks, zero skipped and zero browser errors.
- All-act smoke: eight acts rendered, zero page/console errors; representative
  mirror state reported 49 draw calls, 5,610 triangles, 752 geometries, and 29
  textures. The render-free burst is reported only as simulation throughput.
- Full playthrough: 24/24 authored beats through the ending, including real
  key throws, door breaks, Resident arrival, one-use rope traversal, three arena
  waves, waterfall bargain, bridge rise, cave, mirror room, and final close.
- Render performance: all four heavy acts delivered rAF p50 16.7 ms and p95
  16.8 ms with 1.01 render coverage. Ten valid non-disjoint WebGL timer-query
  samples per act measured GPU p95 at 3.304 ms (forest), 4.719 ms (clearing),
  5.870 ms (cave), and 10.199 ms (mirror), with no query/API errors.

## Honest limits

The deterministic playthrough uses the game's white-box companion API for
state setup and rapid stepping, although progression callbacks and interaction
directives are the shipping ones. Automated gates run muted, so they verify
audio calls and absence of runtime errors but do not replace a human listening
pass. This release has one real Windows/NVIDIA/Chrome performance sample, not a
mobile, integrated-GPU, or cross-browser matrix. It is a substantially more
coherent and polished horror vertical slice, not a claim of infinite content or
literal big-studio production scale.
