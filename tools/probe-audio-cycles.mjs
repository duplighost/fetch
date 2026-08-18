// probe-audio-cycles.mjs -- "loud sound until it just stops playing sound."
//
// probe-audio-live.mjs cleared the main cave walk: the graph settles to 0-2
// live sources and the context stays running. The remaining suspects are the
// paths that CREATE loops rather than the ones that play one-shots, because a
// loop that is started again without the old one being stopped is exactly a
// sound that gets louder every time until the graph gives up:
//
//   - leaving and re-entering the cave (the director re-arms the Choir);
//   - dying and respawning inside it (scoped beats are torn down and rebuilt);
//   - the Choir's own surfacing, which repositions in place and must NOT be
//     creating a second loop.
//
// Two live buffer sources is one Choir loop. Three cycles that each add two
// and never give them back is the bug; a flat line is not.
//
//   node tools/probe-audio-cycles.mjs
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
    const ctx = g.audio.ctx;
    if (!ctx) return { fatal: 'no AudioContext' };

    let live = 0, madeBuf = 0, madeOsc = 0, loops = 0;
    const origBuf = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = (...a) => {
      const n = origBuf(...a);
      madeBuf++; live++;
      n.addEventListener('ended', () => { live--; });
      // a looping source is the thing that never ends on its own
      const origStart = n.start.bind(n);
      n.start = (...s) => { if (n.loop) loops++; return origStart(...s); };
      const origStop = n.stop.bind(n);
      n.stop = (...s) => { if (n.loop) loops--; return origStop(...s); };
      return n;
    };
    const origOsc = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = (...a) => {
      const n = origOsc(...a);
      madeOsc++; live++;
      n.addEventListener('ended', () => { live--; });
      return n;
    };

    const settle = (ms) => new Promise((r) => setTimeout(r, ms));
    const series = [];
    const sample = async (label, waitMs = 2600) => {
      await settle(waitMs);
      series.push({
        label, live, loops, madeBuf, madeOsc,
        state: ctx.state,
        master: +(g.audio.master?.gain?.value ?? -1).toFixed(3),
        choir: !!g.enemies.choir,
        act: g.act,
      });
    };

    // get into the cave the real way
    F.teleport('clearing');
    F.stepWith(1, {}, false);
    g.flag('fallsThawed');
    g.director.waterfallTaken();
    g.skull.vanish();
    for (let t = 0; t < 12; t += 0.5) F.stepWith(0.5, {}, false);
    F.teleport('cave');
    for (let t = 0; t < 4; t += 0.5) F.stepWith(0.5, {}, false);
    await sample('baseline in the cave');

    const walkABit = (seconds) => {
      for (let s = 0; s < seconds; s += 0.1) {
        const p = g.player.pos;
        const here = U.projectMain(p.x, p.z);
        const wp = U.mainPointAt((here?.routeDistance ?? 0) + 3.0);
        if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
        F.stepWith(0.1, { moveZ: 1 }, false);
        if (g.dead) break;
      }
    };
    const seat = (d) => {
      const p = U.mainPointAt(d);
      g.dead = false; g.player.frozen = false;
      g.player.pos.set(p.x, U.groundAt(p.x, p.z), p.z);
      g.player.vel.set(0, 0, 0); g.player.grounded = true; g.player._sync(0);
    };

    // ---- 1. leave and come back, five times ----------------------------
    for (let i = 0; i < 5; i++) {
      seat(1.5);
      walkABit(25);
      F.teleport('house');
      for (let t = 0; t < 2; t += 0.5) F.stepWith(0.5, {}, false);
      F.teleport('cave');
      for (let t = 0; t < 3; t += 0.5) F.stepWith(0.5, {}, false);
      await sample('re-entry cycle ' + (i + 1));
    }

    // ---- 2. die and respawn, five times --------------------------------
    for (let i = 0; i < 5; i++) {
      seat(1.5);
      walkABit(12);
      g.director.death(null);
      for (let t = 0; t < 2; t += 0.5) F.stepWith(0.5, {}, false);
      g.director.respawn();
      for (let t = 0; t < 3; t += 0.5) F.stepWith(0.5, {}, false);
      await sample('death cycle ' + (i + 1));
    }

    // ---- 3. and a long stretch of surfacings ---------------------------
    for (let i = 0; i < 3; i++) {
      seat(1.5);
      walkABit(70);
      await sample('surfacing lap ' + (i + 1));
    }
    return { series, fatal: null };
  });

  if (report.fatal) console.log('FATAL: ' + report.fatal);
  else {
    console.log('label'.padEnd(24) + 'live  loops  bufs  oscs  choir  state    master  act');
    for (const s of report.series) {
      console.log(s.label.padEnd(24)
        + String(s.live).padStart(4) + String(s.loops).padStart(7)
        + String(s.madeBuf).padStart(6) + String(s.madeOsc).padStart(6)
        + String(s.choir).padStart(7) + '  ' + s.state.padEnd(9)
        + String(s.master).padStart(6) + '  ' + s.act);
    }
  }
  console.log('errors:', errors.slice(0, 6).join(' | ') || 'none');
  writeFileSync(resultsPath('audio-cycles.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
