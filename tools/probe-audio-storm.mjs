// probe-audio-storm.mjs -- "a major sound problem in the next area that
// triggers loud sound until it just stops playing sound."
//
// That description is the signature of a call storm: something fires a sound
// every frame, the graph floods, and then the context gives up. So count the
// CALLS. Every method on game.audio gets wrapped, and the counts are reported
// per phase — the crossing, the arrival, and the cave walk — so a storm shows
// up next to the act it belongs to. Runs muted on purpose: with ?mute=1 the
// audio never initialises and every method no-ops, but the CALLS still happen,
// which is exactly what is being measured.
//
//   node tools/probe-audio-storm.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 90000, polling: 100 });

  const report = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game, U = g.underfalls;
    const counts = {};
    const audio = g.audio;
    // own + prototype methods, wrapped once
    const names = new Set();
    for (const k of Object.keys(audio)) if (typeof audio[k] === 'function') names.add(k);
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(audio))) {
      if (k === 'constructor') continue;
      try { if (typeof audio[k] === 'function') names.add(k); } catch { /* getter */ }
    }
    for (const k of names) {
      const original = audio[k].bind(audio);
      audio[k] = (...args) => { counts[k] = (counts[k] || 0) + 1; return original(...args); };
    }
    const snap = () => JSON.parse(JSON.stringify(counts));
    const diff = (a, b) => {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const d = (b[k] || 0) - (a[k] || 0);
        if (d > 0) out[k] = d;
      }
      return out;
    };

    F.start();
    F.teleport('clearing');
    F.stepWith(1.0, {}, false);
    const phases = {};

    // ---- 1. the bargain and the crossing -------------------------------
    let mark = snap();
    g.flag('fallsThawed');
    F.stepWith(0.3, {}, false);
    g.director.waterfallTaken();
    g.skull.vanish();
    for (let t = 0; t < 14; t += 0.1) F.stepWith(0.1, {}, false);
    phases['1-the-bargain-and-the-stones'] = diff(mark, snap());

    // ---- 2. walking the crossing, including a fall off it --------------
    mark = snap();
    const C = g.clearingCenter;
    const place = (x, z, yaw) => {
      g.dead = false; g.player.frozen = false;
      g.player.pos.set(x, g.world.groundHeightAt(x, z, 2) + 0.05, z);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      g.player.yaw = yaw; g.player._sync(0);
    };
    place(C.x, C.z + 2, Math.PI);
    for (let t = 0; t < 16; t += 0.1) {
      g.player.yaw = Math.atan2(-(C.x - g.player.pos.x), -(C.z + 19 - g.player.pos.z));
      F.stepWith(0.1, { moveZ: 1 }, false);
      if (g.dead) break;
    }
    phases['2-the-crossing'] = diff(mark, snap());

    // ---- 3. standing IN the water, which is the new state --------------
    mark = snap();
    place(C.x + 1.9, C.z + 14.2, 0);
    for (let t = 0; t < 8; t += 0.1) F.stepWith(0.1, { moveX: 1 }, false);
    phases['3-wading-in-the-lane'] = diff(mark, snap());

    // ---- 4. the arrival, and the cave walk ------------------------------
    mark = snap();
    F.teleport('cave');
    F.stepWith(1.0, {}, false);
    phases['4-arriving-in-the-cave'] = diff(mark, snap());

    mark = snap();
    const total = U.mainPointAt(1e9).total;
    const seatP = U.mainPointAt(1.5);
    g.dead = false; g.player.frozen = false;
    g.player.pos.set(seatP.x, U.groundAt(seatP.x, seatP.z), seatP.z);
    g.player.vel.set(0, 0, 0); g.player.grounded = true; g.player._sync(0);
    let seconds = 0;
    for (; seconds < 70; seconds += 0.1) {
      const p = g.player.pos;
      const here = U.projectMain(p.x, p.z);
      const wp = U.mainPointAt((here?.routeDistance ?? 0) + 3.0);
      if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
      F.stepWith(0.1, { moveZ: 1 }, false);
      if (g.dead) break;
      if ((here?.routeDistance ?? 0) > total - 2.5) break;
    }
    phases['5-the-cave-walk'] = diff(mark, snap());

    // ---- 6. standing still in the cave, which is where he heard it ------
    mark = snap();
    for (let t = 0; t < 20; t += 0.1) F.stepWith(0.1, {}, false);
    phases['6-standing-in-the-cave'] = diff(mark, snap());

    return { phases, seconds: +seconds.toFixed(1), dead: g.dead, act: g.act, total: snap() };
  });

  for (const [phase, counts] of Object.entries(report.phases)) {
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('\n=== ' + phase + ' ===');
    for (const [name, n] of rows.slice(0, 12)) {
      console.log('   ' + String(n).padStart(6) + '  ' + name + (n > 200 ? '   <-- STORM?' : ''));
    }
    if (!rows.length) console.log('   (silence)');
  }
  console.log('\ncave walk seconds ' + report.seconds + ', dead ' + report.dead + ', act ' + report.act);
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('audio-storm.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
