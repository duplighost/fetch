# ROUND SIXTEEN — say "fetch" and start here

## THE GAME IS FINISHED

Alex declared it, 2026-08-20: *"The game works very well. I want to finish
it"* — one last bug, root-fixed and shipped the same day — *"Then the game
ships."* It shipped. His sign-off: *"aawesome! thanks so much."*

**There is no work list.** He cancelled ROUND-FIFTEEN's list in his own brief:
*"Read the notes as history. They are not a task list. Anything in them not
named in this message is cancelled or out of scope."* That killed the basement
feed line, the chapel doorjambs, the cave/Underfalls creative brief, and the
waterfall sound bug. Do not resurrect any of it unless HE reopens it. If he
does reopen the feed line: it is an unlit `MeshBasicMaterial` in a lantern-lit
corridor, and brightening it moves it THROUGH the wall's value — wrong way;
make it lit.

His standing law still holds: **do not open with questions.**

## STATUS

* Game `main` = `58ed380` — the locket legibility fix, and main IS the live game.
* Site `main` = `fdac77a` (PR #83) — qualiacology.com/fetch/ plus the
  rhythm-game coda at qualiacology.com/fetch/ending/.
* Production fetched back **22/22 byte-identical**, `fetch-boot-check` PASSED
  against qualiacology.com itself (hand-lit 45.3%, zero errors).
* **He has not played anything newer than ~round twelve (Aug 19). Tell him to
  hard-refresh (Ctrl+Shift+R).** The round-13/14 cave work, the locket chime,
  and the locket redesign are all new to him.

## The last bug — the phantom key (resolved 2026-08-20)

His report: a key visible at the top of the graveyard tree before the fight,
which sank inside the skull when grabbed; and once, after dying in the marrow,
one more gate lock open than he had earned.

What it actually was, all three observations:

1. **The canopy "key" was the LOCKET** — the keepsake from Playtest 3, gold
   (`0xb9a06a`), glinting, yaw-turning, flush against the canopy underside
   (which sits at y≈7.50 at its bough; the pendant hung at 7.39). A key's
   exact visual signature under one lantern. He had reported it once before
   ("there actually looks like another key all the way up against the top of
   the tree"); round eleven answered with the jewellery chime and left the
   visual untouched.
2. **"Sinks into the skull" was the locket being WORN** — by design it skips
   the carry clamp and rides the jaw as a 2.4 cm charm, forever.
3. **The extra lock was the round-four gate bug** ("Alex hit it dying in the
   marrow") — key NUMBER replayed onto SOCKET INDEX on respawn. Root-fixed
   Aug 17; `probe-gate-respawn` re-run this round: **ALL GREEN**, all six bank
   orders with a death after every bank seat exactly `[100 110 111]`.

The branch-drop key was also verified live: `probe-key-tree` **PASS — one
hit, then the key off the grass**.

**The fix (`58ed380`, one file, `src/house.js`):** every channel the locket
owns now says necklace, never key — moon-silver (`0xd8dbe6` / cool emissive)
on both the hanging locket and the worn charm; a visible chain of eight merged
links hanging BELOW the leaves; a pendulum swing about its hang point (keys
yaw in place); a sharp cool twinkle at the ends of the arc (keys glow warm and
steady); the chime kicks the swing on the same beat. Draw calls unchanged
(3 before, 3 after). `tools/shot-locket.mjs` re-shoots the read from four
player poses if it is ever in question again.

**If he reports a key in the canopy again after actually playing this build,
the locket read needs another pass — it is NOT the key code.** The full key
inventory, for reference: `bedroomKey` (window branch), `stairKey` (nursery
mobile), `hatchKey` (incinerator ash), `gateKey1` (ossuary stairs, off the
counterweight solve), `gateKey2` (marrow altar, takeable when the guardian
yields), `gateKey3` (key tree, hangs under the felled branch) — all six use
the standard jaw clamp. The locket is the only hanging glint that is not a
key, and the marrow relic is the only other jaw ornament.

## Gates run this round, all serial, all green

`autotest · regressions · smoke · house-critical-path · window-scare ·
grave-arena · failure-state · pause-title · warm-start · coda-seam ·
legibility-regression · playthrough` — 12/12, plus `probe-gate-respawn` and
`probe-key-tree`. Site: build (no drift), validate, route-smoke (45 routes),
browser QA (zero serious axe), boot-check local, boot-check the deploy
preview, boot-check production.

## Known red, pre-existing, out of scope

`underfalls-expansion` fails 2 of 18 (the broken-promise gate; the hatch
entering the mirror room). Identical on the live build since before round
thirteen. Alex has not raised it.

## If the cave sound goes bad for him again

That report is the single most valuable datum in the project — get the
circumstances. Round fourteen removed −61% of the cave's convolution work but
it is NOT proven to be his bug, and `AudioContext.renderCapacity` does not
exist in the Chrome on this machine.

## Laws — still not optional

* **Measure your own conclusions, not just other people's.** Five confident
  claims died to measurement in one session (ROUND-FIFTEEN.md has the table).
  Reading code tells you what it MEANS; only measuring tells you what it DOES.
* **Never explain his memory away without measuring it first.** The route
  tables agreed with his 4am description on every point.
* **Sample sizes matter at low rates.** A single PASS at a ~10% failure rate
  was read as proof for eleven rounds.
* **Look at the PNG.** Every wrong visual conclusion came from reasoning
  instead of opening the screenshot. Tools read `canvas.toDataURL`, never
  `page.screenshot`.

## Traps — all measured, all still true

* **`grep -c $'\r'` AND `cat -A` both LIE about CRLF in this Git Bash.** Count
  bytes in Node. src files are CRLF in the working tree, LF in git.
* **Inline `node -e` with parentheses gets mangled by bash** — write the
  script to a file with a quoted heredoc. (It claimed another victim this
  round.)
* **Never edit a `src/` file while a gate is running.**
* **Gates flake under concurrent Chrome — run serially** when the numbers
  must be believed. (This includes long probes: `probe-gate-respawn` streams
  `[probe]` lines; run it unpiped or the buffering makes it look hung.)
* **`netlify-release-integrity` is red on any fresh worktree** until
  `node tools/package-netlify.mjs` has run. Not a defect.
* **Do NOT add a PointLight in the cave** — the light census is pinned at boot.
* `world.finishStatic()` merges under `mat.clone()`; `world.box()` never adds
  a collider; `addColliderCylinder` builds a square AABB (r reaches r·√2).

## Shipping (worked a fourth time, unchanged)

`duplighost/fetch` publishes NOTHING; `duplighost/qualiacology` serves its own
copy of the 22 src files at `fetch/src/` (repo `.gitattributes` forces LF).
Copy (CRLF→LF) → `build-site` (no drift) → `validate-site --root=..` →
`route-smoke --root=..` → `cd build && npm run qa` → `fetch-boot-check`
against a local serve (`static-server.mjs --root=. --port=4173`) → branch,
PR → **boot-check the Netlify deploy preview** → merge → verify production
byte-identical and boot-check it → fast-forward the game's `main`. The site's
`AGENTS.md` is canonical for anything site-side.

## Where old context lives

`ROUND-FIFTEEN.md` (superseded; its work list is cancelled) →
`ROUND-FOURTEEN.md` and earlier are the records. Work off `main` in a fresh
worktree; `Projects/fetch-claude` is STALE.
