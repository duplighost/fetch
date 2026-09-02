// probe-cave-bell.mjs -- the one thing in the Underfalls that literally rings,
// driven as hard as a player can drive it, in real time.
//
// probe-cave-realtime walked the whole district for five wall-clock minutes and
// never fired bellRing once: the secret's cistern is off the main route and the
// toll needs amplitude the probe's wander never built. So the loudest, longest,
// most narrow-band voice in the district went unmeasured, and it is the one
// that matches Alex's words -- "it sounds like a ringing", from a fixed point
// off to one side, "eventually it gets so loud it crashes the sound".
//
// This one stands in the cistern and leans on the bell for two real minutes,
// shoving it every frame the way a player pinned against it would, and reports
// the toll rate, the level, and whether the ring is a narrow tone standing over
// the bed.
//
//   node tools/probe-cave-bell.mjs [seconds]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const SECONDS = Number(process.argv[2]) || 120;
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1`);
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[bell]')) console.log(t); });
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

    const split = ctx.createChannelSplitter(2);
    const anL = ctx.createAnalyser(); anL.fftSize = 4096; anL.smoothingTimeConstant = 0;
    const anR = ctx.createAnalyser(); anR.fftSize = 4096; anR.smoothingTimeConstant = 0;
    A.comp.connect(split);
    split.connect(anL, 0); split.connect(anR, 1);
    const bufL = new Float32Array(anL.fftSize), bufR = new Float32Array(anR.fftSize);
    const freq = new Float32Array(anL.frequencyBinCount);
    const level = (an, buf) => {
      an.getFloatTimeDomainData(buf);
      let s = 0, peak = 0;
      for (let i = 0; i < buf.length; i++) {
        s += buf[i] * buf[i];
        const a = Math.abs(buf[i]);
        if (a > peak) peak = a;
      }
      return { rms: Math.sqrt(s / buf.length), peak };
    };
    const tone = () => {
      anL.getFloatFrequencyData(freq);
      let bi = 0, bv = -Infinity;
      const sorted = [];
      for (let i = 2; i < freq.length; i++) {
        if (freq[i] > bv) { bv = freq[i]; bi = i; }
        sorted.push(freq[i]);
      }
      sorted.sort((a, b) => a - b);
      return {
        hz: Math.round(bi * ctx.sampleRate / anL.fftSize),
        over: +(bv - sorted[sorted.length >> 1]).toFixed(1),
      };
    };

    let tolls = 0, oscMade = 0, liveOsc = 0;
    const realBell = A.bellRing.bind(A);
    A.bellRing = (...a) => { tolls++; return realBell(...a); };
    const realOsc = ctx.createOscillator.bind(ctx);
    ctx.createOscillator = (...a) => {
      const n = realOsc(...a);
      oscMade++; liveOsc++;
      n.addEventListener('ended', () => { liveOsc--; });
      return n;
    };

    F.teleport('clearing');
    F.stepWith(2, {}, false);
    g.flag('fallsThawed');
    g.director.waterfallTaken();
    g.skull.vanish();
    F.stepWith(8, {}, false);
    F.teleport('cave');
    F.stepWith(1, {}, false);

    const S = U.secret || null;
    if (!S || !S.position) return { fatal: 'no secret/bell in this build' };
    g.player.pos.set(S.position.x, U.groundAt(S.position.x, S.position.z), S.position.z);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.5, {}, false);

    const series = [];
    let lastTolls = 0;
    const sample = () => {
      const L = level(anL, bufL), R = level(anR, bufR);
      const row = {
        t: +ctx.currentTime.toFixed(1), state: ctx.state,
        L: +L.rms.toFixed(4), R: +R.rms.toFixed(4),
        pk: +Math.max(L.peak, R.peak).toFixed(3),
        tolls, perSec: tolls - lastTolls, tone: tone(),
        liveOsc, oscMade, amp: +Math.hypot(S.ax || 0, S.az || 0).toFixed(3),
        stats: A.voiceStats(),
      };
      lastTolls = tolls;
      series.push(row);
      if (series.length % 10 === 0) {
        console.log('[bell] ' + row.t + 's L=' + row.L + ' R=' + row.R + ' pk=' + row.pk
          + ' tolls=' + row.tolls + '(+' + row.perSec + ') lean=' + row.amp
          + ' tone=' + row.tone.hz + 'Hz+' + row.tone.over + 'dB liveOsc=' + row.liveOsc
          + ' drop=' + row.stats.droppedVoices + ' ' + row.state);
      }
    };
    const meter = setInterval(sample, 1000);

    // LEAN ON IT. Every frame, a shove toward the far side plus a slow orbit, so
    // the swing is fed continuously the way a player pinned against the crown
    // would feed it -- the worst case the toll gate can actually be handed.
    await new Promise((resolve) => {
      let last = performance.now();
      const t0 = last;
      let a = 0;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        a += dt * 1.4;
        g.player.yaw = a;
        g.player.pos.x = S.axis.x + Math.cos(a) * 0.9;
        g.player.pos.z = S.axis.z + Math.sin(a) * 0.9;
        g.player.vel.set(-Math.cos(a) * 6, 0, -Math.sin(a) * 6);
        g.player._sync(0);
        F.stepWith(dt, { moveZ: 1 }, true);
        if ((now - t0) / 1000 >= SECONDS) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    clearInterval(meter);
    sample();
    return { series, tolls, fatal: null };
  }, SECONDS);

  if (report.fatal) {
    console.log('FATAL: ' + report.fatal);
  } else {
    const s = report.series;
    const mean = (rows, k) => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(4);
    console.log('\nsamples ' + s.length + ', tolls ' + report.tolls
      + ' (one per ' + (s.length / Math.max(1, report.tolls)).toFixed(1) + ' s)');
    console.log('first 15 s  L=' + mean(s.slice(0, 15), 'L') + ' R=' + mean(s.slice(0, 15), 'R'));
    console.log('last  15 s  L=' + mean(s.slice(-15), 'L') + ' R=' + mean(s.slice(-15), 'R'));
    const worst = s.reduce((a, b) => (b.pk > a.pk ? b : a));
    console.log('loudest peak ' + worst.pk + ' at ' + worst.t + 's, tone ' + worst.tone.hz + 'Hz');
    const end = s[s.length - 1];
    console.log('end: state=' + end.state + ' liveOsc=' + end.liveOsc + ' oscMade=' + end.oscMade
      + ' stats=' + JSON.stringify(end.stats));
  }
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('cave-bell.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
