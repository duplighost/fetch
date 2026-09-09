# FETCH

First-person browser horror. You wake holding a skull you cannot get rid of; thrown, it comes
back. It is the key, the weapon, the only light and the threat radar. Route: bedroom → house →
basement → graveyard → sealing.

## Where things are

- **`main` is the game** — exactly what is live at https://qualiacology.com/fetch/.
- **Work in a fresh `git worktree`.** `C:\Users\Alex\Projects\fetch-claude` is stale and shared;
  do not use it. The `claude/*` and `codex/*` branches are finished rounds kept as record.
- **Nothing here deploys.** The site is a separate repo, `duplighost/qualiacology`, which keeps
  its own copy of this `src/` under `fetch/`. Shipping = copy the changed `src/` files there
  (LF endings), then follow that repo's `AGENTS.md`. Never deploy from here.
- Serve: `node serve.mjs 8711`. Debug hook: `window.__FETCH`.

## The laws (breaking one is a regression, not a style choice)

1. **The throw grammar is sacred.** LMB = throw. HOLD = it stays out (flies to your aim, then
   treads air, facing you). RELEASE = it zips home. RMB/E = call. No charge meter; the button
   is the tether. `FEEL_PROFILE` at the top of `src/skull.js` is the law. Return legs NEVER
   decelerate on approach; clocks are monotonic; recall is duration-only.
2. **Flawless handling.** No input lag, no random refusal, no terror-adaptive controls, no
   control theft — ever, including the ending.
3. **No HUD.** No words or meters during play. State lives in the skull (jaw chatter =
   proximity, grown eyes track threats), in audio, in light. Text belongs to the title, the
   pause card and the retry screen only.
4. **Never hue-only meaning.** Threat and state read as brightness, motion, shape, timing,
   sound. **Alex is not colorblind — he corrected that directly on 2026-08-18.** The law stands
   on its own: these are dark rooms lit by one carried light, so hue is the channel the game
   itself destroys.
5. **Audio-first horror.** HRTF spatial. Enemies own a sound before they own a mesh.
6. **Quiet vs loud is the economy.** Stun is quiet and temporary; popping is loud, permanent and
   invites company. The 0.6 s post-hit iframes are what make the quiet option exist.
7. **Growth is never witnessed.** The skull gains its face off-screen only.
8. **One ending.** The oasis is sincere. Do not foreshadow the twist.

## Gates

```bash
node tests/autotest.mjs      # feel laws, fetch chain, stun/pop
node tests/regressions.mjs   # release invariants, checkpoints, progression, finale
node tests/smoke.mjs         # per-act boot, budgets, screenshots
node tests/playthrough.mjs   # the whole game via real inputs (10+ min)
```

They need Alex's machine: a real GPU (system Chrome, d3d11 ANGLE, never swiftshader) and
playwright-core from the local npx cache. In a cloud sandbox you cannot run them — say so
plainly in the PR body rather than weakening a gate to get green. Never edit a src file while a
gate is running.
