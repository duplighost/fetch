// probe-audio-live.mjs -- the same hunt as probe-audio-storm, but with a REAL
// AudioContext, because "loud sound until it just stops playing sound" is a
// graph symptom and not a call-count one. Chrome is launched with
// --mute-audio, so the whole node graph is built and run for real while
// nothing comes out of the speakers.
//
// What it watches, once a second:
//   - live BufferSourceNodes (created minus ended). A looping source never
//     ends, so loops that are created and not stopped show up here as a
//     staircase, and a staircase is exactly what "keeps getting louder" is.
//   - total nodes created, which catches a one-shot storm.
//   - ctx.state and the master gain, which is what "and then it stops" is.
//
//   node tools/probe-audio-live.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 120000, polling: 100 });

  const report = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game, U = g.underfalls;
    F.start();
    F.stepWith(0.5, {}, false);
    if (!g.audio._ready && g.audio.init) { try { g.audio.init(); } catch { /* no gesture */ } }
    F.stepWith(0.5, {}, false);
    const ctx = g.audio.ctx;
    if (!ctx) return { fatal: 'no AudioContext — audio never initialised' };

    const made = { buffer: 0, gain: 0, panner: 0, osc: 0 };
    let live = 0;
    const wrap = (name, key) => {
      const original = ctx[name].bind(ctx);
      ctx[name] = (...a) => {
        const node = original(...a);
        made[key]++;
        if (key === 'buffer' || key === 'osc') {
          live++;
          node.addEventListener('ended', () => { live--; });
        }
        return node;
      };
    };
    wrap('createBufferSource', 'buffer');
    wrap('createGain', 'gain');
    wrap('createPanner', 'panner');
    wrap('createOscillator', 'osc');

    const series = [];
    // THE TRAP THIS PROBE FELL INTO ONCE: page.evaluate runs one synchronous
    // block, and an 'ended' event cannot be dispatched inside one. The first
    // version therefore watched a live count that could only ever go up and
    // read it as a thousand-node leak. Every sample now yields for real
    // seconds first, so scheduled stops actually land and the count is honest.
    const settle = (ms) => new Promise((r) => setTimeout(r, ms));
    const sample = async (label, waitMs = 2600) => {
      await settle(waitMs);
      series.push({
        label,
        live,
        made: { ...made },
        state: ctx.state,
        master: +(g.audio.master?.gain?.value ?? -1).toFixed(3),
        t: +ctx.currentTime.toFixed(1),
        act: g.act,
      });
    };

    const run = async (seconds, label, controls = {}) => {
      for (let t = 0; t < seconds; t += 0.5) F.stepWith(0.5, controls, false);
      await sample(label);
    };

    F.teleport('clearing');
    await run(2, 'clearing: arrived');
    g.flag('fallsThawed');
    g.director.waterfallTaken();
    g.skull.vanish();
    await run(14, 'clearing: the stones rise');

    const C = g.clearingCenter;
    g.player.pos.set(C.x, g.world.groundHeightAt(C.x, C.z + 2, 2) + 0.05, C.z + 2);
    g.player.yaw = Math.PI; g.player._sync(0);
    for (let t = 0; t < 16; t += 0.1) {
      g.player.yaw = Math.atan2(-(C.x - g.player.pos.x), -(C.z + 19 - g.player.pos.z));
      F.stepWith(0.1, { moveZ: 1 }, false);
      if (g.dead) break;
    } await sample('clearing: crossed');

    F.teleport('cave');
    await run(2, 'cave: arrived');

    // walk the route, sampling every ~10 s, three laps so the choir gets to
    // do everything it does
    const total = U.mainPointAt(1e9).total;
    for (let lap = 0; lap < 3; lap++) {
      const seat = U.mainPointAt(1.5);
      g.dead = false; g.player.frozen = false;
      g.player.pos.set(seat.x, U.groundAt(seat.x, seat.z), seat.z);
      g.player.vel.set(0, 0, 0); g.player.grounded = true; g.player._sync(0);
      let mark = 0;
      for (let s = 0; s < 80; s += 0.1) {
        const p = g.player.pos;
        const here = U.projectMain(p.x, p.z);
        const wp = U.mainPointAt((here?.routeDistance ?? 0) + 3.0);
        if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
        F.stepWith(0.1, { moveZ: 1 }, false);
        if (s - mark >= 10) { mark = s; await sample('cave lap ' + lap + ' @' + Math.round(s) + 's'); }
        if (g.dead) { await sample('cave lap ' + lap + ' DIED'); break; }
        if ((here?.routeDistance ?? 0) > total - 2.5) break;
      } await sample('cave lap ' + lap + ' end');
    }
    await run(20, 'cave: standing still');
    return { series, fatal: null };
  });

  if (report.fatal) {
    console.log('FATAL: ' + report.fatal);
  } else {
    console.log('label'.padEnd(30) + 'live  bufs  gains  panners  oscs  state      master  ctxT   act');
    for (const s of report.series) {
      console.log(s.label.padEnd(30)
        + String(s.live).padStart(4) + String(s.made.buffer).padStart(6)
        + String(s.made.gain).padStart(7) + String(s.made.panner).padStart(9)
        + String(s.made.osc).padStart(6) + '  ' + s.state.padEnd(10)
        + String(s.master).padStart(6) + String(s.t).padStart(7) + '   ' + s.act);
    }
  }
  console.log('errors:', errors.slice(0, 6).join(' | ') || 'none');
  writeFileSync(resultsPath('audio-live.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
