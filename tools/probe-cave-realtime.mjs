// probe-cave-realtime.mjs -- the cave sound bug, hunted in REAL TIME.
//
// Alex, 2026-09-01: "in the last area of the game under the waterfall there is
// still an odd sound. eventually it gets so loud it crashes the sound. it
// starts out in my left ear. it sounds like a ringing."
//
// Every previous probe stepped the sim as fast as Chrome would go, which
// compresses minutes of game into seconds of AudioContext and can only make
// overlap WORSE -- and still found nothing. So the missing variable is not
// speed. This one paces the sim off requestAnimationFrame so one game second
// costs one wall second, renders every frame so the audio thread competes with
// the real GPU load, and covers the route he covered: the walk, the secret with
// the bell in it, a death and a respawn, and the Choir.
//
// It watches the only thing that can be "louder" -- the signal on the master
// bus, per channel, off a real AnalyserNode -- with a per-second call census
// beside it, so a rising level names the calls that made it.
//
//   node tools/probe-cave-realtime.mjs [seconds]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const SECONDS = Number(process.argv[2]) || 300;
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1`);
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[ring]')) console.log(t); });
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

    // ---- the meter, per channel, after the compressor -------------------
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
    // A RING is a narrow peak that stays put. Report the loudest bin and how far
    // it stands over the median -- a tone shows as a large margin.
    const tone = () => {
      anL.getFloatFrequencyData(freq);
      let bi = 0, bv = -Infinity;
      const sorted = [];
      for (let i = 2; i < freq.length; i++) {
        if (freq[i] > bv) { bv = freq[i]; bi = i; }
        sorted.push(freq[i]);
      }
      sorted.sort((a, b) => a - b);
      const med = sorted[sorted.length >> 1];
      return {
        hz: Math.round(bi * ctx.sampleRate / anL.fftSize),
        db: +bv.toFixed(1),
        over: +(bv - med).toFixed(1),
      };
    };

    // ---- the census ------------------------------------------------------
    const calls = {};
    const seen = new Set();
    for (let o = A; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      for (const k of Object.getOwnPropertyNames(o)) {
        if (seen.has(k) || k === 'constructor') continue;
        seen.add(k);
        let d;
        try { d = Object.getOwnPropertyDescriptor(o, k); } catch { continue; }
        if (!d || typeof d.value !== 'function' || !d.writable) continue;
        const fn = d.value;
        calls[k] = 0;
        try { A[k] = function (...a) { calls[k]++; return fn.apply(this, a); }; } catch { /* frozen */ }
      }
    }
    // ...and live source nodes: the staircase probe-audio-live watches for.
    let liveSrc = 0, madeSrc = 0, madeOsc = 0, madeGain = 0;
    const wrapMade = (name, onMade) => {
      const original = ctx[name].bind(ctx);
      ctx[name] = (...a) => {
        const node = original(...a);
        onMade();
        if (name !== 'createGain') {
          liveSrc++;
          node.addEventListener('ended', () => { liveSrc--; });
        }
        return node;
      };
    };
    wrapMade('createBufferSource', () => { madeSrc++; });
    wrapMade('createOscillator', () => { madeOsc++; });
    wrapMade('createGain', () => { madeGain++; });

    // ---- get to the cave the way the game does ---------------------------
    F.teleport('clearing');
    F.stepWith(2, {}, false);
    g.flag('fallsThawed');
    g.director.waterfallTaken();
    g.skull.vanish();
    F.stepWith(8, {}, false);
    F.teleport('cave');
    F.stepWith(1, {}, false);

    // ---- real-time driving ----------------------------------------------
    const series = [];
    let lastCalls = { ...calls };
    let phase = 'walk';
    const sample = () => {
      const L = level(anL, bufL), R = level(anR, bufR);
      const delta = {};
      for (const k of Object.keys(calls)) if (calls[k] !== lastCalls[k]) delta[k] = calls[k] - lastCalls[k];
      lastCalls = { ...calls };
      const row = {
        t: +ctx.currentTime.toFixed(1), phase, state: ctx.state,
        L: +L.rms.toFixed(4), R: +R.rms.toFixed(4),
        pk: +Math.max(L.peak, R.peak).toFixed(3),
        tone: tone(), live: liveSrc, loops: A._loops.size,
        stats: A.voiceStats(), delta,
      };
      series.push(row);
      if (series.length % 15 === 0) {
        console.log('[ring] ' + row.t + 's ' + phase + ' L=' + row.L + ' R=' + row.R
          + ' pk=' + row.pk + ' tone=' + row.tone.hz + 'Hz+' + row.tone.over + 'dB'
          + ' live=' + row.live + ' drop=' + row.stats.droppedVoices + ' ' + row.state);
      }
      return row;
    };
    const meter = setInterval(sample, 1000);

    const total = U.mainPointAt(1e9).total;
    const seatMain = (d) => {
      const p = U.mainPointAt(d);
      g.dead = false; g.player.frozen = false;
      g.player.pos.set(p.x, U.groundAt(p.x, p.z), p.z);
      g.player.vel.set(0, 0, 0); g.player.grounded = true; g.player._sync(0);
    };
    let routeD = 1.5;
    let dir = 1;
    const steerMain = () => {
      const p = g.player.pos;
      const here = U.projectMain(p.x, p.z);
      routeD = here?.routeDistance ?? routeD;
      if (routeD > total - 3) dir = -1;
      if (routeD < 2) dir = 1;
      const wp = U.mainPointAt(routeD + dir * 3);
      if (wp) { g.player.yaw = Math.atan2(-(wp.x - p.x), -(wp.z - p.z)); g.player.pitch = 0; }
    };
    let steer = steerMain;
    const realtime = (seconds) => new Promise((resolve) => {
      let last = performance.now();
      const t0 = last;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        try { steer(); } catch { /* keep the clock honest */ }
        F.stepWith(dt, { moveZ: 1 }, true);
        if ((now - t0) / 1000 >= seconds) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const share = Math.max(30, Math.floor(SECONDS / 4));
    seatMain(1.5);
    phase = 'walk';
    await realtime(share);

    // the secret, and the bell that hangs in it: lean on it and keep it tolling
    phase = 'secret';
    const S = g.underfalls?.state?.secret || null;
    if (S && S.position) {
      g.player.pos.set(S.position.x, U.groundAt(S.position.x, S.position.z), S.position.z);
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      let lean = 0;
      steer = () => { lean += 0.02; g.player.yaw = lean; };
    }
    await realtime(share);

    // a death and a respawn, which is how he plays it
    phase = 'death';
    steer = steerMain;
    seatMain(total * 0.5);
    g.director.death(null);
    await realtime(6);
    g.director.respawn();
    await realtime(Math.max(10, share - 6));

    phase = 'choir';
    if (g.enemies.beginDrownedChoir) g.enemies.beginDrownedChoir({ pos: g.player.pos });
    await realtime(Math.max(20, SECONDS - share * 3));

    clearInterval(meter);
    sample();
    return { series, totals: calls, made: { madeSrc, madeOsc, madeGain }, fatal: null };
  }, SECONDS);

  if (report.fatal) {
    console.log('FATAL: ' + report.fatal);
  } else {
    const s = report.series;
    const mean = (rows, k) => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(4);
    console.log('\nsamples: ' + s.length);
    console.log('first 20 s  L=' + mean(s.slice(0, 20), 'L') + ' R=' + mean(s.slice(0, 20), 'R'));
    console.log('last  20 s  L=' + mean(s.slice(-20), 'L') + ' R=' + mean(s.slice(-20), 'R'));
    const worst = s.reduce((a, b) => (b.pk > a.pk ? b : a));
    console.log('loudest peak ' + worst.pk + ' at ' + worst.t + 's (' + worst.phase + '), tone '
      + worst.tone.hz + 'Hz +' + worst.tone.over + 'dB');
    const ended = s[s.length - 1];
    console.log('end: state=' + ended.state + ' live=' + ended.live + ' loops=' + ended.loops
      + ' stats=' + JSON.stringify(ended.stats));
    console.log('nodes made: ' + JSON.stringify(report.made));
    const t = report.totals;
    console.log('\ncall totals (non-zero):');
    for (const k of Object.keys(t).sort((a, b) => t[b] - t[a])) if (t[k]) console.log('  ' + k.padEnd(24) + t[k]);
  }
  console.log('errors:', errors.slice(0, 6).join(' | ') || 'none');
  writeFileSync(resultsPath('cave-realtime.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
