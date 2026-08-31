// warm-start-regression.mjs -- THE FREEZES. Round five's §5, pinned.
//
// What this is protecting, in Alex's words: "many many areas of the game freeze
// for a few seconds". The cause was never one bug; it was one CLASS of bug —
// work paid at first sight — with three distinct sources, all measured before
// they were fixed:
//
//   1. startGame() CANCELLED the scheduled shader warmup. He spams the title
//      button, so on his machine the warmup never ran and every program the
//      game uses compiled mid-play: 2149 ms in the bedroom, 816 house, 716
//      basement, 566 forest, 1350 cave, 2399 entering the mirror room.
//   2. The warm pass compiled the world with the camera at its RESTING layer
//      mask. render() drops the camera to layer 0 for the world pass, so the
//      whole warm pass was spent on 32-point-light keys that no frame ever
//      draws, while the real 29-light programs linked one district at a time
//      at ~600 ms each.
//   3. The mirror pass has its own census again, and the double's cloned lamps
//      only joined it at the climax — so every reflected material relinked in
//      the last act of the game: 26 programs, 8.8 seconds, once, at the end.
//
// The gate is therefore not a stopwatch. It is: after a real, spam-clicked
// start, walking the whole game links ZERO new shader programs. A program that
// links during play IS the freeze.
//
// Runs WITHOUT ?test=1 on purpose — test mode skips the warmup, which is the
// exact blindness that let this ship (the site's boot-check was written after
// the same lesson). ?mute=1 only keeps headless WebAudio out of it.
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const failures = [];
const checks = [];
const check = (condition, message, detail = '') => {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}${suffix}`);
  checks.push({ message, detail, passed: !!condition });
  if (!condition) failures.push(`${message}${suffix}`);
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);
  // THE BUSY MACHINE. His is slow, and the warm-up is scheduled on idle time a
  // slow machine does not have — which is exactly the race the old start lost.
  // Idle never arrives here, so the press itself has to force the warm work.
  await page.addInitScript(() => {
    window.requestIdleCallback = () => 0;      // never calls back
    window.cancelIdleCallback = () => {};
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
  const scheduled = await page.evaluate(() => window.__game.shaderWarmup.status);
  check(scheduled === 'scheduled',
    'on a machine that never goes idle the warm-up is still waiting when he clicks',
    scheduled);

  // ---- his start: hammer the button with real, trusted clicks -------------
  const box = await page.locator('#title [data-action="start"]').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const pressedAt = Date.now();
  await page.mouse.click(cx, cy);
  const answered = await page.evaluate(() => ({
    waking: document.getElementById('title').classList.contains('waking'),
    disabled: !!document.querySelector('#title [data-action="start"]')?.disabled,
    started: window.__game.started,
    warm: window.__FETCH.warm(),
  }));
  check(answered.waking && answered.disabled && !answered.started,
    'the press is answered on the title in the same task, before any warm work',
    JSON.stringify({ waking: answered.waking, disabled: answered.disabled, started: answered.started }));

  for (let i = 0; i < 9; i++) await page.mouse.click(cx, cy, { delay: 5 });
  await page.waitForFunction(() => window.__game.started === true, null, { timeout: 120000, polling: 50 });

  const entry = await page.evaluate(() => {
    const warm = window.__FETCH.warm();
    return {
      status: warm.shader.status,
      reason: warm.shader.reason || null,
      createdMs: warm.shader.createdMs || null,
      timings: warm.shader.timings || null,
      textures: warm.textures,
      programsAtEntry: warm.programsAtEntry,
      programsNow: warm.programsNow,
      links: warm.links,
      renderReady: warm.renderReady,
      bootReadyMs: warm.bootReadyMs,
      paused: window.__game.paused,
      pauseReason: window.__game.pauseReason,
      titleHidden: window.__game.el.title.classList.contains('hidden'),
    };
  });
  check(entry.reason !== 'game-started',
    'clicking start does not cancel the warm-up (the round-five bug)',
    `status=${entry.status} reason=${entry.reason}`);
  check(['created', 'ready', 'degraded'].includes(entry.status),
    'every program the game uses was handed to the driver before it entered',
    `${entry.status} in ${entry.createdMs?.toFixed(0)}ms`);
  check(entry.textures && (entry.textures.status === 'ready' || entry.textures.status === 'degraded')
      && entry.textures.uploaded > 0,
    'every boot-painted texture is uploaded before the game entered',
    JSON.stringify(entry.textures));
  check(entry.renderReady && entry.links?.status === 'settled'
      && entry.links.linked === entry.links.total,
    'the first world draw waits for every asynchronous driver link to settle',
    JSON.stringify(entry.links));
  check(!entry.paused && entry.titleHidden,
    'spam-clicking the title arrives in play, never in a pause it never asked for',
    `paused=${entry.paused} reason=${entry.pauseReason}`);
  // RECORDED, NOT ASSERTED at a tight bound: this is the cost that moved out of
  // mid-play and onto the title, and it belongs in the log of every run. The
  // ceiling only catches a warm pass that has grown into a hang.
  const heldMs = await page.evaluate(() => window.__FETCH.warm().entryLatencyMs);
  console.log(`     press-to-play: ${heldMs?.toFixed(0)}ms in-page (${Date.now() - pressedAt}ms wall)`);
  console.log(`     compile: ${JSON.stringify(entry.timings)}  textures: ${entry.textures?.durationMs?.toFixed(0)}ms`);
  // A ceiling, not a stopwatch: cold ANGLE link time varies wildly. It is now
  // intentionally paid behind a painted, compositor-animated title rather
  // than coerced into a frozen first WebGL frame. This catches a true hang.
  check(heldMs != null && heldMs < 35000,
    'the animated title eventually hands over without a boot hang',
    `${heldMs?.toFixed(0)}ms`);

  // ---- the gate: walk the whole game and link nothing ---------------------
  const tour = await page.evaluate(async () => {
    const g = window.__game;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(900);                                    // let the arrival settle
    const before = g.renderer.info.programs.length;
    const hitchMark = window.__FETCH.hitches().length;
    const steps = [];
    for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
      const b = g.renderer.info.programs.length;
      g.teleport(act);
      const t0 = performance.now();
      await frame(); await frame();
      const firstDrawMs = performance.now() - t0;
      for (let i = 0; i < 40; i++) await frame();
      await wait(200);
      steps.push({
        act,
        firstDrawMs: +firstDrawMs.toFixed(0),
        linked: g.renderer.info.programs.length - b,
      });
    }
    // The two beats that used to cost the most outside an act change: the
    // waterfall target (the throw that does not come back) and re-entering the
    // cave behind it.
    const target = g.world.fetchTargets.find((t) => t.id === 'waterfall');
    if (target) {
      g.teleport('clearing');
      for (let i = 0; i < 20; i++) await frame();
      const b = g.renderer.info.programs.length;
      target.enabled = true;
      // No THREE global in here: read the world position off the matrix.
      const node = target.object || target.mesh;
      let p = target.pos;
      if (node) {
        node.updateMatrixWorld(true);
        const e = node.matrixWorld.elements;
        p = { x: e[12], y: e[13], z: e[14] };
      }
      if (p) window.__FETCH.setSkull(p.x, p.y, p.z, 0, 0, 0, 'outbound');
      for (let i = 0; i < 60; i++) await frame();
      await wait(400);
      steps.push({ act: 'hit:waterfall', firstDrawMs: 0, linked: g.renderer.info.programs.length - b });
    }
    return {
      steps,
      before,
      after: g.renderer.info.programs.length,
      hitches: window.__FETCH.hitches().slice(hitchMark),
    };
  });

  for (const step of tour.steps) {
    check(step.linked === 0,
      `${step.act} links no new shader program`,
      `+${step.linked} programs, first draws ${step.firstDrawMs}ms`);
  }
  check(tour.after === tour.before,
    'a warmed boot walks the entire game without linking a single program',
    `${tour.before} -> ${tour.after}`);
  const worst = tour.hitches.reduce((n, h) => Math.max(n, h.ms), 0);
  check(worst < 500,
    'no district costs the player a visible freeze on arrival',
    `worst frame ${worst}ms; ${tour.hitches.length} frames over 150ms`);
  check(errors.length === 0, 'warm start produces zero page/console errors', errors.slice(0, 4).join(' | '));

  // ---- what the held press LOOKS like ------------------------------------
  // Its own page, with the gate stubbed to never resolve, because a screenshot
  // of a live WebGL page costs seconds and would land inside the measurement
  // above. Value and motion only: he is colourblind, and there are no new
  // words on this screen — the button holds its pressed state, the art falls
  // back, and the return mark keeps turning so the tab cannot read as hung.
  const shot = await openPage(browser, `${URL_BASE}/?mute=1`);
  await shot.page.addInitScript(() => {
    window.requestIdleCallback = () => 0;       // the gate must still be closed
    window.cancelIdleCallback = () => {};
  });
  await shot.page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await shot.page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
  await shot.page.evaluate(() => { window.__game._warmGate = () => new Promise(() => {}); });
  await shot.page.click('#title [data-action="start"]');
  await shot.page.waitForTimeout(700);
  await shot.page.screenshot({ path: shotPath('warm-start-title-waking.png') });
  const look = await shot.page.evaluate(() => {
    const title = document.getElementById('title');
    const button = title.querySelector('[data-action="start"]');
    const art = getComputedStyle(title, '::before');
    const mark = title.querySelector('.return-mark');
    return {
      started: window.__game.started,
      artFilter: art.filter,
      buttonBg: getComputedStyle(button).backgroundColor,
      buttonEvents: getComputedStyle(button).pointerEvents,
      markAnimation: getComputedStyle(mark).animationName,
      markDuration: getComputedStyle(mark).animationDuration,
    };
  });
  check(!look.started && /brightness\(0\.4/.test(look.artFilter) && look.buttonEvents === 'none'
      && look.markAnimation === 'waking-turn',
    'the held press reads as held: art down, control lit and inert, mark still moving',
    JSON.stringify(look));
  await shot.page.close();

  // ---- and the ordinary machine: warm before he ever clicks --------------
  // Most sessions read the title for a few seconds, so the warm pass is long
  // finished and the press must cost NOTHING. A gate that always holds is a
  // slow title screen, which is the complaint next door to the freezes.
  const calm = await openPage(browser, `${URL_BASE}/?mute=1`, { width: 1024, height: 700 });
  await calm.page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
  await calm.page.waitForFunction(
    () => window.__game._bootReady === true && window.__game._bootRenderReady(),
    null, { timeout: 90000, polling: 100 },
  );
  await calm.page.click('#title [data-action="start"]');
  const instant = await calm.page.evaluate(() => ({
    started: window.__game.started,
    latency: window.__FETCH.warm().entryLatencyMs,
    titleHidden: window.__game.el.title.classList.contains('hidden'),
  }));
  check(instant.started && instant.titleHidden && instant.latency < 50,
    'a title that was already warm starts the instant it is pressed',
    `${instant.latency?.toFixed(1)}ms`);
  check(calm.errors.length === 0, 'the warm-before-click path produces zero errors',
    calm.errors.slice(0, 3).join(' | '));
  await calm.page.close();

  writeFileSync(resultsPath('warm-start-regression.json'), JSON.stringify({ entry, tour, checks }, null, 2));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.log(`\nWARM START REGRESSIONS FAILED (${failures.length})`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll warm-start regressions passed.');
