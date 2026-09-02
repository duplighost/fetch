// probe-audio-finite.mjs -- the OTHER fork of the cave sound bug.
//
// Round nineteen established that the ringing is not level: five wall-clock
// minutes in the Underfalls held the master flat and the context running. The
// note it left for the next round was that the remaining suspect is geometry
// rather than the mix -- and the sharpest version of that suspicion is a
// non-finite value reaching the graph.
//
// It fits every word of the report. A NaN in a panner position or an AudioParam
// poisons everything downstream of it: the output goes silent and STAYS silent,
// which is "it crashes the sound", and a single bad panner takes one ear first,
// which is "it starts out in my left ear". Chrome throws on a non-finite
// AudioParam value but the legacy PannerNode.setPosition path does not, and a
// filter driven toward an illegal frequency can ring up before it gives out.
//
// So: wrap every AudioParam setter and every panner/listener position write, run
// the district hard in real time, and report the FIRST non-finite argument with
// the stack that produced it. Silence here is a real result -- it retires the
// hypothesis instead of leaving it to a sixth round.
//
//   node tools/probe-audio-finite.mjs [seconds]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const SECONDS = Number(process.argv[2]) || 180;
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1`);
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[finite]')) console.log(t); });
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 180000, polling: 100 });

  const report = await page.evaluate(async (SECONDS) => {
    const F = window.__FETCH, g = window.__game, U = g.underfalls;
    F.start();
    F.stepWith(0.5, {}, false);
    if (!g.audio._ready && g.audio.init) { try { g.audio.init(); } catch { /* no gesture */ } }
    F.stepWith(0.5, {}, false);
    const A = g.audio, ctx = A.ctx;
    if (!ctx) return { fatal: 'no AudioContext' };

    const bad = [];
    const note = (what, args) => {
      if (bad.length >= 12) return;
      const stack = (new Error().stack || '').split('\n').slice(2, 6).join(' | ');
      bad.push({ what, args: args.map((v) => (typeof v === 'number' ? String(v) : typeof v)), stack });
      console.log('[finite] NON-FINITE ' + what + ' (' + args.join(', ') + ') ' + stack);
    };
    const finite = (v) => typeof v !== 'number' || Number.isFinite(v);

    // every AudioParam automation setter
    const P = (window.AudioParam || {}).prototype;
    if (P) {
      for (const name of ['setValueAtTime', 'linearRampToValueAtTime',
        'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
        const original = P[name];
        if (typeof original !== 'function') continue;
        P[name] = function (...a) {
          if (!a.every(finite)) note('AudioParam.' + name, a);
          return original.apply(this, a);
        };
      }
      const valueDesc = Object.getOwnPropertyDescriptor(P, 'value');
      if (valueDesc && valueDesc.set) {
        Object.defineProperty(P, 'value', {
          ...valueDesc,
          set(v) { if (!finite(v)) note('AudioParam.value =', [v]); return valueDesc.set.call(this, v); },
        });
      }
    }
    // and the legacy position/orientation writers, which do NOT throw on NaN
    for (const [Ctor, names] of [
      [window.PannerNode, ['setPosition', 'setOrientation']],
      [window.AudioListener, ['setPosition', 'setOrientation']],
    ]) {
      if (!Ctor) continue;
      for (const name of names) {
        const original = Ctor.prototype[name];
        if (typeof original !== 'function') continue;
        Ctor.prototype[name] = function (...a) {
          if (!a.every(finite)) note(Ctor.name + '.' + name, a);
          return original.apply(this, a);
        };
      }
    }
    // ...and the player's own position, which is what feeds all of the above
    let badPose = 0;

    F.teleport('clearing');
    F.stepWith(2, {}, false);
    g.flag('fallsThawed');
    g.director.waterfallTaken();
    g.skull.vanish();
    F.stepWith(8, {}, false);
    F.teleport('cave');
    F.stepWith(1, {}, false);

    const total = U.mainPointAt(1e9).total;
    const seat = (d) => {
      const p = U.mainPointAt(d);
      g.dead = false; g.player.frozen = false;
      g.player.pos.set(p.x, U.groundAt(p.x, p.z), p.z);
      g.player.vel.set(0, 0, 0); g.player.grounded = true; g.player._sync(0);
    };
    seat(1.5);
    let routeD = 1.5, dir = 1;
    await new Promise((resolve) => {
      let last = performance.now();
      const t0 = last;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const p = g.player.pos;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) badPose++;
        const here = U.projectMain(p.x, p.z);
        routeD = here?.routeDistance ?? routeD;
        if (routeD > total - 3) dir = -1;
        if (routeD < 2) dir = 1;
        const wp = U.mainPointAt(routeD + dir * 3);
        if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
        F.stepWith(dt, { moveZ: 1 }, true);
        if ((now - t0) / 1000 >= SECONDS) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    return {
      bad, badPose, fatal: null,
      state: ctx.state,
      stats: A.voiceStats(),
    };
  }, SECONDS);

  if (report.fatal) {
    console.log('FATAL: ' + report.fatal);
  } else if (report.bad.length) {
    console.log('\nNON-FINITE VALUES REACHED THE AUDIO GRAPH:');
    for (const b of report.bad) console.log('  ' + b.what + ' (' + b.args.join(', ') + ')\n    ' + b.stack);
  } else {
    console.log('\nno non-finite value reached the audio graph, and no non-finite player pose'
      + ' (badPose ' + report.badPose + ')');
    console.log('the geometry fork is RETIRED for the main route: ctx ' + report.state
      + ', stats ' + JSON.stringify(report.stats));
  }
  console.log('errors:', errors.slice(0, 6).join(' | ') || 'none');
  writeFileSync(resultsPath('audio-finite.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
