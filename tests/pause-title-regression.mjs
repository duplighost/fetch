// Focused contract for the only two text-bearing gameplay surfaces: title and
// pause. This deliberately exercises held throw/rope state, dt-driven beats,
// checkpoint restart, focus loss, death, and finale ownership.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, resultsPath, shotPath, URL_BASE,
} from './lib/harness.mjs';

const failures = [];
const checks = [];
const check = (condition, message, detail = '') => {
  const row = { passed: !!condition, message, detail };
  checks.push(row);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures.push(row);
};
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, {
    width: 1440, height: 900,
  });
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.el?.pause);
  await page.waitForLoadState('networkidle');

  const title = await page.evaluate(() => {
    const overlay = document.getElementById('title');
    const shell = overlay.querySelector('.title-shell').getBoundingClientRect();
    const start = overlay.querySelector('[data-action="start"]');
    return {
      heading: document.getElementById('fetchTitle').textContent.trim(),
      tag: document.getElementById('fetchTag').textContent.trim(),
      start: start.textContent.replace(/\s+/g, ' ').trim(),
      keyArt: getComputedStyle(overlay, '::before').backgroundImage,
      shell: { x: shell.x, y: shell.y, right: shell.right, bottom: shell.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      pauseHidden: document.getElementById('pauseButton').hidden,
      describedBy: overlay.getAttribute('aria-describedby'),
    };
  });
  check(title.heading === 'FETCH' && title.tag === 'Throw it. Hold on. Let go.',
    'the title opens on one strong premise instead of a gameplay spoiler wall');
  check(/fetch-title-keyart-5ab7c65b\.webp/.test(title.keyArt),
    'the authored skull-and-window key art is the title image');
  check(/Wake up/i.test(title.start) && title.describedBy === 'fetchTag fetchKeys',
    'the primary action and concise controls are keyboard/screen-reader described');
  check(title.pauseHidden && title.shell.x >= 0 && title.shell.right <= title.viewport.width
      && title.shell.y >= 0 && title.shell.bottom <= title.viewport.height,
    'title hierarchy fits the desktop viewport and gameplay pause stays hidden before start');
  await page.screenshot({ path: shotPath('pause-title-desktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(80);
  const mobile = await page.evaluate(() => {
    const shell = document.querySelector('.title-shell').getBoundingClientRect();
    const go = document.querySelector('#title .go').getBoundingClientRect();
    return {
      shell: { left: shell.left, right: shell.right, top: shell.top, bottom: shell.bottom },
      go: { left: go.left, right: go.right, height: go.height },
      width: innerWidth, height: innerHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      artPosition: getComputedStyle(document.getElementById('title'), '::before').backgroundPosition,
    };
  });
  check(mobile.shell.left >= -0.5 && mobile.shell.right <= mobile.width + 0.5
      && mobile.shell.top >= -0.5 && mobile.shell.bottom <= mobile.height + 0.5
      && mobile.go.left >= 0 && mobile.go.right <= mobile.width && mobile.go.height >= 44
      && mobile.overflowX <= 0,
    'title remains legible, touch-sized, and overflow-free at 390x844', JSON.stringify(mobile));
  await page.screenshot({ path: shotPath('pause-title-mobile.png') });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.click('#title [data-action="start"]');
  const start = await page.evaluate(() => ({
    started: window.__game.started,
    titleHidden: window.__game.el.title.classList.contains('hidden'),
    pauseVisible: !window.__game.el.pauseButton.hidden,
    label: window.__game.el.pauseButton.getAttribute('aria-label'),
  }));
  check(start.started && start.titleHidden && start.pauseVisible && start.label === 'Pause game',
    'starting hands control to the player and exposes a visible labelled pause control');

  // THE NEW OPENING: the room boots skull-less; the skull arrives only after
  // the bedroom bell is found and rung. This suite is about pause/title
  // ownership, not the arrival — jump through the canonical test contract (a
  // hard teleport completes the arrival silently and hands over the skull) so
  // every skull-handling assertion below exercises the post-arrival game.
  // Without this, the checkpoint-restart check would respawn into a
  // pre-arrival room and correctly find the skull absent.
  await page.evaluate(() => {
    window.__FETCH.teleport('bedroom');
    window.__FETCH.stepWith(0.3, {}, false);
  });

  const armed = await page.evaluate(() => {
    const g = window.__game;
    // A lightweight deterministic context proves suspend/resume ownership
    // without initializing native WebAudio in the long-running test harness.
    g.audio.ctx = {
      state: 'running', suspendCalls: 0, resumeCalls: 0,
      suspend() { this.suspendCalls++; this.state = 'suspended'; return Promise.resolve(); },
      resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); },
    };
    g.flag('pause-test-progress');
    g.after(0.25, () => g.flag('pause-test-fired'), { global: true });
    const beat = g.director.beats.at(-1);
    window.__pauseBeat = beat;
    const anchor = g.player.pos.clone();
    anchor.x += 2.2; anchor.y += 2.8;
    window.__FETCH.setSkull(anchor.x, anchor.y, anchor.z, 0, 0, 0, 'outbound');
    g.skull.anchorAt(anchor, { swing: true, maxHold: 7 });
    g.player.beginSwing(anchor, { maxT: 6 });
    g.input.throwHeld = true;
    return {
      gameTime: g.time, beatT: beat.t, swingT: g.player.swing.t,
      anchorT: g.skull.anchor.t, player: g.player.pos.toArray(), skull: g.skull.pos.toArray(),
    };
  });

  await page.click('#pauseButton');
  await page.waitForFunction(() => window.__game.audio.ctx.state === 'suspended');
  const pausedBefore = await page.evaluate(() => ({
    paused: window.__game.paused,
    reason: window.__game.pauseReason,
    overlay: !window.__game.el.pause.classList.contains('hidden'),
    pauseButtonHidden: window.__game.el.pauseButton.hidden,
    audio: { ...window.__game.audio.ctx },
    focusAction: document.activeElement?.dataset?.action || null,
  }));
  check(pausedBefore.paused && pausedBefore.reason === 'button' && pausedBefore.overlay
      && pausedBefore.pauseButtonHidden && pausedBefore.audio.state === 'suspended',
    'the visible pause button owns overlay, simulation, pointer UI, and WebAudio suspension',
    JSON.stringify(pausedBefore));

  await page.evaluate(() => window.__FETCH.stepWith(2, { throwHeld: true }));
  const frozen = await page.evaluate(() => {
    const g = window.__game;
    const beat = window.__pauseBeat;
    return {
      gameTime: g.time, beatT: beat?.t ?? null,
      timerFired: g.flags.has('pause-test-fired'),
      swingT: g.player.swing?.t ?? null, anchorT: g.skull.anchor?.t ?? null,
      player: g.player.pos.toArray(), skull: g.skull.pos.toArray(), mode: g.skull.mode,
    };
  });
  check(close(frozen.gameTime, armed.gameTime) && close(frozen.beatT, armed.beatT)
      && !frozen.timerFired && close(frozen.swingT, armed.swingT) && close(frozen.anchorT, armed.anchorT)
      && frozen.player.every((v, i) => close(v, armed.player[i]))
      && frozen.skull.every((v, i) => close(v, armed.skull[i])) && frozen.mode === 'anchored',
    'pause freezes fixed-step time, director beats, player, skull, and held rope without fabricating release',
    JSON.stringify(frozen));
  await page.screenshot({ path: shotPath('pause-overlay.png') });

  // A physical release during pause is preserved, but cannot mutate the rope
  // until the game resumes.
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  const releasedWhilePaused = await page.evaluate(() => ({
    held: window.__game.input.throwHeld,
    queued: window.__game.input.pending.throwReleased,
    swing: !!window.__game.player.swing,
    skull: window.__game.skull.mode,
  }));
  check(!releasedWhilePaused.held && releasedWhilePaused.queued
      && releasedWhilePaused.swing && releasedWhilePaused.skull === 'anchored',
    'a real mouse-up is queued while the frozen anchor itself remains untouched');

  await page.waitForTimeout(190);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__game.paused && window.__game.audio.ctx.state === 'running');
  // Anchors intentionally require 0.06 s before release can detach them. The
  // queued edge lands on step one; the remaining fixed steps honor that guard.
  await page.evaluate(() => window.__FETCH.step(1 / 120, 10, false));
  const resumed = await page.evaluate(() => ({
    paused: window.__game.paused,
    swing: !!window.__game.player.swing,
    skull: window.__game.skull.mode,
    timerFired: window.__game.flags.has('pause-test-fired'),
    audio: { ...window.__game.audio.ctx },
    pauseVisible: !window.__game.el.pauseButton.hidden,
  }));
  check(!resumed.paused && !resumed.swing && resumed.skull === 'returning'
      && resumed.audio.state === 'running' && resumed.pauseVisible,
    'Escape resumes exactly once and pays the queued release on the first fixed step',
    JSON.stringify(resumed));
  await page.evaluate(() => window.__FETCH.stepWith(0.4));
  check(await page.evaluate(() => window.__game.flags.has('pause-test-fired')),
    'paused director time continues from its remainder instead of catching up from wall time');

  const checkpoint = await page.evaluate(() => {
    const g = window.__game;
    g.skull.holdNow();
    g.checkpoint(g.act, {
      pos: g.player.pos.clone(), yaw: g.player.yaw, pitch: g.player.pitch,
    });
    const cp = { ...g.checkpointPose };
    g.player.pos.x += 5; g.player.pos.z += 3; g.player._sync(0);
    window.__FETCH.pause('restart-test');
    return { cp, moved: g.player.pos.toArray(), flag: g.flags.has('pause-test-progress') };
  });
  await page.click('#pause [data-action="restart-checkpoint"]');
  const restarted = await page.evaluate(() => {
    const g = window.__game;
    return {
      paused: g.paused, pos: g.player.pos.toArray(), checkpoint: { ...g.checkpointPose },
      flag: g.flags.has('pause-test-progress'), skull: g.skull.mode,
      swing: !!g.player.swing, titleHidden: g.el.title.classList.contains('hidden'),
    };
  });
  check(!restarted.paused && restarted.flag && restarted.skull === 'held' && !restarted.swing
      && close(restarted.pos[0], checkpoint.cp.x, 0.02)
      && close(restarted.pos[1], checkpoint.cp.y, 0.02)
      && close(restarted.pos[2], checkpoint.cp.z, 0.02)
      && restarted.titleHidden,
    'restart returns to the exact checkpoint while preserving progression and never reloads a new game',
    JSON.stringify({ checkpoint, restarted }));

  await page.evaluate(() => {
    const g = window.__game;
    const anchor = g.player.pos.clone();
    anchor.x += 1.8;
    anchor.y += 2.2;
    window.__FETCH.setSkull(anchor.x, anchor.y, anchor.z, 0, 0, 0, 'outbound');
    g.skull.anchorAt(anchor, { swing: true, maxHold: 7 });
    g.player.beginSwing(anchor, { maxT: 6 });
    g.input.throwHeld = true;
    window.dispatchEvent(new Event('blur'));
  });
  const focusPause = await page.evaluate(() => ({
    paused: window.__game.paused, reason: window.__game.pauseReason,
    audio: window.__game.audio.ctx.state,
    held: window.__game.input.throwHeld,
    queuedRelease: window.__game.input.pending.throwReleased,
    skull: window.__game.skull.mode,
  }));
  check(focusPause.paused && focusPause.reason === 'focus-loss' && focusPause.audio === 'suspended'
      && !focusPause.held && focusPause.queuedRelease && focusPause.skull === 'anchored',
    'focus loss pauses and queues a safe release when the page may never receive mouse-up',
    JSON.stringify(focusPause));
  await page.evaluate(() => {
    window.__FETCH.resume();
    window.__FETCH.step(1 / 120, 10, false);
  });
  const focusResume = await page.evaluate(() => ({
    paused: window.__game.paused,
    held: window.__game.input.throwHeld,
    swing: !!window.__game.player.swing,
    skull: window.__game.skull.mode,
  }));
  check(!focusResume.paused && !focusResume.held && !focusResume.swing
      && focusResume.skull === 'returning',
    'focus-loss resume cannot resurrect a phantom held throw or rope',
    JSON.stringify(focusResume));

  // Browsers may report pointer-lock loss before the stronger blur signal.
  // The second event must still repair the mouse-up edge even though pause is
  // already active.
  const lockThenBlur = await page.evaluate(() => {
    const g = window.__game;
    g.skull.holdNow();
    const anchor = g.player.pos.clone();
    anchor.z += 2.1;
    window.__FETCH.setSkull(anchor.x, anchor.y, anchor.z, 0, 0, 0, 'outbound');
    g.skull.anchorAt(anchor, { swing: true, maxHold: 7 });
    g.player.beginSwing(anchor, { maxT: 6 });
    g.input.throwHeld = true;
    window.__FETCH.pause('pointer-lock');
    window.dispatchEvent(new Event('blur'));
    return {
      reason: g.pauseReason,
      held: g.input.throwHeld,
      queuedRelease: g.input.pending.throwReleased,
      skull: g.skull.mode,
    };
  });
  await page.evaluate(() => {
    window.__FETCH.resume();
    window.__FETCH.step(1 / 120, 10, false);
  });
  const lockThenBlurResume = await page.evaluate(() => ({
    paused: window.__game.paused,
    held: window.__game.input.throwHeld,
    swing: !!window.__game.player.swing,
    skull: window.__game.skull.mode,
  }));
  check(lockThenBlur.reason === 'pointer-lock' && !lockThenBlur.held
      && lockThenBlur.queuedRelease && lockThenBlur.skull === 'anchored'
      && !lockThenBlurResume.paused && !lockThenBlurResume.held
      && !lockThenBlurResume.swing && lockThenBlurResume.skull === 'returning',
    'blur arriving after pointer-lock pause still repairs the otherwise lost release edge',
    JSON.stringify({ lockThenBlur, lockThenBlurResume }));

  // Death must own its own overlay and must not leave a second pause dialog or
  // a suspended context underneath it.
  await page.evaluate(() => {
    const g = window.__game;
    window.__FETCH.pause('death-handoff');
    g.dead = true;
    g.showDeath();
  });
  const death = await page.evaluate(() => ({
    paused: window.__game.paused,
    pauseHidden: window.__game.el.pause.classList.contains('hidden'),
    deathHidden: window.__game.el.die.classList.contains('hidden'),
    pauseButtonHidden: window.__game.el.pauseButton.hidden,
  }));
  check(!death.paused && death.pauseHidden && !death.deathHidden && death.pauseButtonHidden,
    'death cleanly supersedes pause with one overlay');
  await page.click('#die .go');

  // The finale remains pausable before its terminal image, then terminal title
  // ownership rejects every new pause request.
  const finaleFrozen = await page.evaluate(() => {
    const g = window.__game;
    window.__FETCH.teleport('mirror');
    const before = { time: g.time, t: g.finale.t, half: g.finale.half, phase: g.finale.phase };
    window.__FETCH.pause('finale-test');
    window.__FETCH.stepWith(2);
    const after = { time: g.time, t: g.finale.t, half: g.finale.half, phase: g.finale.phase };
    return { before, after, paused: g.paused };
  });
  check(finaleFrozen.paused && JSON.stringify(finaleFrozen.before) === JSON.stringify(finaleFrozen.after),
    'the playable finale obeys pause without advancing walls or contact time', JSON.stringify(finaleFrozen));
  await page.evaluate(() => {
    const g = window.__game;
    window.__FETCH.resume();
    g.showEnd();
  });
  const ending = await page.evaluate(() => ({
    pauseAccepted: window.__FETCH.pause('too-late'),
    paused: window.__game.paused,
    endingTitle: window.__game.el.title.classList.contains('ending'),
    pauseHidden: window.__game.el.pause.classList.contains('hidden'),
    pauseButtonHidden: window.__game.el.pauseButton.hidden,
    titleArtOpacity: getComputedStyle(window.__game.el.title, '::before').opacity,
  }));
  check(!ending.pauseAccepted && !ending.paused && ending.endingTitle
      && ending.pauseHidden && ending.pauseButtonHidden && ending.titleArtOpacity === '0',
    'terminal handoff rejects pause and returns to a clean black title instead of promotional art',
    JSON.stringify(ending));

  check(errors.length === 0, 'focused pause/title lifecycle produces zero browser errors', errors.join(' | '));

  // A second, self-stepping page verifies the actual browser contract that
  // test mode intentionally bypasses: Escape exits pointer lock, that loss
  // opens pause exactly once, and Resume reacquires lock from its click gesture.
  const live = await openPage(browser, `${URL_BASE}/`, { width: 1024, height: 700 });
  const livePage = live.page;
  await livePage.waitForFunction(() => window.__FETCH?.ready === true);
  await livePage.click('#title [data-action="start"]');
  await livePage.waitForFunction(() => document.pointerLockElement === window.__game.renderer.domElement,
    null, { timeout: 5000 });
  await livePage.waitForFunction(() => window.__game.audio.ctx?.state === 'running',
    null, { timeout: 5000 });
  const lockedUi = await livePage.evaluate(() => ({
    locked: document.pointerLockElement === window.__game.renderer.domElement,
    pauseButtonHidden: window.__game.el.pauseButton.hidden,
  }));
  await livePage.keyboard.press('Escape');
  await livePage.waitForFunction(() => window.__game.paused && document.pointerLockElement === null
      && window.__game.audio.ctx?.state === 'suspended',
    null, { timeout: 5000 });
  const escaped = await livePage.evaluate(() => ({
    paused: window.__game.paused, reason: window.__game.pauseReason,
    locked: document.pointerLockElement === window.__game.renderer.domElement,
    audioState: window.__game.audio.ctx?.state,
  }));
  await livePage.waitForTimeout(190);
  await livePage.keyboard.press('Escape');
  await livePage.waitForFunction(() => !window.__game.paused
      && document.pointerLockElement === window.__game.renderer.domElement
      && window.__game.audio.ctx?.state === 'running',
    null, { timeout: 5000 });
  const keyRelocked = await livePage.evaluate(() => ({
    paused: window.__game.paused,
    locked: document.pointerLockElement === window.__game.renderer.domElement,
    audioState: window.__game.audio.ctx?.state,
  }));
  await livePage.waitForTimeout(190);
  await livePage.keyboard.press('p');
  await livePage.waitForFunction(() => window.__game.paused && document.pointerLockElement === null
      && window.__game.audio.ctx?.state === 'suspended',
    null, { timeout: 5000 });
  await livePage.click('#pause [data-action="resume"]');
  await livePage.waitForFunction(() => !window.__game.paused
      && document.pointerLockElement === window.__game.renderer.domElement
      && window.__game.audio.ctx?.state === 'running',
    null, { timeout: 5000 });
  const buttonRelocked = await livePage.evaluate(() => ({
    paused: window.__game.paused,
    locked: document.pointerLockElement === window.__game.renderer.domElement,
    audioState: window.__game.audio.ctx?.state,
  }));
  check(escaped.paused && ['keyboard', 'pointer-lock'].includes(escaped.reason) && !escaped.locked
      && escaped.audioState === 'suspended'
      && !keyRelocked.paused && keyRelocked.locked && keyRelocked.audioState === 'running',
    'real Escape toggles pointer lock and native WebAudio in both directions',
    JSON.stringify({ escaped, keyRelocked }));
  check(lockedUi.locked && lockedUi.pauseButtonHidden,
    'desktop pointer lock hides the otherwise unclickable pause icon instead of presenting a false affordance',
    JSON.stringify(lockedUi));
  check(!buttonRelocked.paused && buttonRelocked.locked && buttonRelocked.audioState === 'running',
    'the visible Resume action also restores pointer lock and native WebAudio',
    JSON.stringify({ buttonRelocked }));
  check(live.errors.length === 0, 'self-stepping pointer-lock scenario produces zero browser errors',
    live.errors.join(' | '));
  await livePage.close();

  // When Pointer Lock is unavailable or rejected, the mouse remains a valid UI
  // device. The same visible pause button must then be genuinely clickable in
  // the ordinary non-test runtime, not merely under the deterministic harness.
  const fallback = await openPage(browser, `${URL_BASE}/`, { width: 1024, height: 700 });
  const fallbackPage = fallback.page;
  await fallbackPage.waitForFunction(() => window.__FETCH?.ready === true);
  await fallbackPage.evaluate(() => {
    window.__game.renderer.domElement.requestPointerLock = () => Promise.reject(new Error('probe rejection'));
  });
  await fallbackPage.click('#title [data-action="start"]');
  await fallbackPage.waitForFunction(() => window.__game.started
      && document.pointerLockElement === null && !window.__game.el.pauseButton.hidden);
  await fallbackPage.click('#pauseButton');
  // AND WAIT FOR THE SUSPEND, the way the Escape scenario above already does:
  // the pause fades the buses and parks the context behind a 420 ms timer, so
  // `paused && overlay` is true a third of a second before ctx.state can be
  // 'suspended'.
  //
  // The wait alone was NOT the bug. It took this check from 3/3 red to 4-of-7
  // flaky, and the remaining flakiness is what found the real one: audio.js's
  // watchdog resumed on any non-running state without asking who asked, so the
  // engine undid its own suspend on the next tick. A deliberate hold is
  // announced now (audio.holdSuspended) and the watchdog leaves it alone, which
  // is what makes this deterministic. Both halves are needed: the fix stops the
  // engine fighting itself, this wait stops the harness reading the clock early.
  await fallbackPage.waitForFunction(() => window.__game.paused
      && !window.__game.el.pause.classList.contains('hidden')
      && window.__game.audio.ctx?.state === 'suspended',
    null, { timeout: 5000 });
  const fallbackButton = await fallbackPage.evaluate(() => ({
    paused: window.__game.paused,
    reason: window.__game.pauseReason,
    locked: document.pointerLockElement === window.__game.renderer.domElement,
    overlay: !window.__game.el.pause.classList.contains('hidden'),
    audioState: window.__game.audio.ctx?.state,
  }));
  check(fallbackButton.paused && fallbackButton.reason === 'button'
      && !fallbackButton.locked && fallbackButton.overlay
      && fallbackButton.audioState === 'suspended',
    'when pointer lock is unavailable, the visible pause button is physically clickable and freezes audio/gameplay',
    JSON.stringify(fallbackButton));
  check(fallback.errors.length === 0,
    'pointer-lock fallback pause produces zero browser errors', fallback.errors.join(' | '));
  await fallbackPage.close();

  writeFileSync(resultsPath('pause-title-regression.json'), JSON.stringify({
    checks, errors: [...errors, ...live.errors, ...fallback.errors],
  }, null, 2));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} pause/title regression(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nALL ${checks.length} PAUSE/TITLE CHECKS PASSED`);
}
