// probe-verb-ab.mjs -- does the one-convolver-at-a-time rack CHANGE WHAT YOU HEAR?
//
// The acceptance bar for the Underfalls reverb fix is not "it costs less". It is
// "the cave sounds the same and costs less". So this renders the REAL GameAudio
// class twice, sample for sample, and subtracts one from the other.
//
// Both renders use the shipped src/audio.js. The difference is one line of
// setup: the "before" render forces the old wiring back on by connecting all
// three convolver inputs to verbBus at init and stubbing out the release tick,
// which is exactly what main did. Everything else -- impulse responses, noise
// beds, wind wander, the crossfade ramps -- is identical, because Math.random is
// replaced by a seeded LCG for the duration of each render and both renders
// consume the same sequence.
//
// The route rendered is the one the complaint is about: an interior start, out
// to the outdoor character, then into the cave, with a send held open the whole
// time the way the Drowned Choir holds one open (audio.js:2221-2222).
//
//   node tools/probe-verb-ab.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => !!window.__game?.audio, null, { timeout: 90000, polling: 100 });

  const report = await page.evaluate(async () => {
    const SR = 24000, DUR = 12, QUANTUM = 128;
    const GA = window.__game.audio.constructor;
    const realAC = window.AudioContext;

    // quantize a time to a render-quantum boundary; OfflineAudioContext.suspend
    // only accepts those, and only one suspend per quantum
    const q = (t) => Math.round((t * SR) / QUANTUM) * QUANTUM / SR;

    const seedRandom = (seed) => {
      let s = seed >>> 0;
      Math.random = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    };
    const realRandom = Math.random;

    const render = async (oldWiring) => {
      seedRandom(0x5eed1234);
      const oc = new OfflineAudioContext(2, SR * DUR, SR);
      const realResume = oc.resume.bind(oc);
      oc.resume = () => Promise.resolve();       // init() resumes a suspended ctx
      window.AudioContext = function () { return oc; };
      window.webkitAudioContext = window.AudioContext;

      const a = new GA();
      a._queueForestStoryPrewarm = () => {};     // no async baking to desync the PRNG
      a.init();

      if (oldWiring) {
        // main's behaviour: every convolver input wired at init, nothing ever
        // disconnected. Buffers stay lazy, exactly as they were.
        for (const k of Object.keys(a._convolvers)) {
          a.verbBus.connect(a._convolvers[k]);
          a._verbFed.add(k);
        }
        a._updateVerbRack = () => {};
      }

      // stimulus: a dry bed plus a send held open for the whole render, which is
      // the load shape the cave actually has
      const noise = oc.createBuffer(1, Math.floor(SR * 1.5), SR);
      const d = noise.getChannelData(0);
      let b = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b = 0.98 * b + 0.02 * w;
        d[i] = b * 3 + w * 0.15;
      }
      const src = oc.createBufferSource(); src.buffer = noise; src.loop = true;
      const dry = oc.createGain(); dry.gain.value = 0.2;
      src.connect(dry).connect(a.master);
      const send = oc.createGain(); send.gain.value = 0.68;
      dry.connect(send).connect(a.verbBus);
      src.start();

      // the route, plus a frame tick every 250 ms so the release actually runs
      const events = new Map();
      const at = (t, fn) => { const k = q(t); if (!events.has(k)) events.set(k, fn); };
      at(0.5, () => a.setZone('graveyard'));
      at(4.0, () => a.setZone('cave'));
      for (let t = 0.25; t < DUR - 0.1; t += 0.25) at(t, null);
      for (const [t, fn] of Array.from(events).sort((x, y) => x[0] - y[0])) {
        if (t <= 0) continue;
        oc.suspend(t).then(() => { if (fn) fn(); a.update(0.25); realResume(); });
      }

      const out = await oc.startRendering();
      Math.random = realRandom;
      window.AudioContext = realAC;
      window.webkitAudioContext = realAC;
      return {
        buf: out,
        stats: a.verbStats(),
      };
    };

    const before = await render(true);
    const after = await render(false);

    const chans = [0, 1].map((c) => ({
      a: before.buf.getChannelData(c),
      b: after.buf.getChannelData(c),
    }));
    const n = before.buf.length;
    let peak = 0, sumRef = 0, sumDiff = 0, maxDiff = 0, maxDiffAt = 0;
    for (const { a, b } of chans) {
      for (let i = 0; i < n; i++) {
        const r = a[i], dd = Math.abs(a[i] - b[i]);
        if (Math.abs(r) > peak) peak = Math.abs(r);
        sumRef += r * r;
        sumDiff += (a[i] - b[i]) * (a[i] - b[i]);
        if (dd > maxDiff) { maxDiff = dd; maxDiffAt = i / SR; }
      }
    }
    const rmsRef = Math.sqrt(sumRef / (n * 2));
    const rmsDiff = Math.sqrt(sumDiff / (n * 2));
    const db = (x, ref) => (x <= 0 ? -Infinity : 20 * Math.log10(x / ref));

    // per-window levels, so a dropped tail shows up as a hole rather than an
    // average. A truncated reverb tail is a WINDOW that lost energy.
    const W = Math.floor(SR * 0.1);
    const windows = [];
    for (let start = 0; start + W <= n; start += W) {
      let ea = 0, eb = 0;
      for (const { a, b } of chans) {
        for (let i = start; i < start + W; i++) { ea += a[i] * a[i]; eb += b[i] * b[i]; }
      }
      const ra = Math.sqrt(ea / (W * 2)), rb = Math.sqrt(eb / (W * 2));
      windows.push({ t: +(start / SR).toFixed(2), before: ra, after: rb,
        deltaDb: ra > 0 && rb > 0 ? +(20 * Math.log10(rb / ra)).toFixed(6) : null });
    }
    const scored = windows.filter((w) => w.deltaDb !== null);
    let worst = scored[0];
    for (const w of scored) if (Math.abs(w.deltaDb) > Math.abs(worst.deltaDb)) worst = w;
    // a dropped tail is a window that LOST energy after the change
    let worstDrop = scored[0];
    for (const w of scored) if (w.deltaDb < worstDrop.deltaDb) worstDrop = w;

    return {
      sampleRate: SR, seconds: DUR,
      route: 'bedroom(interior) -> t=0.5 graveyard(outdoor) -> t=4.0 cave',
      peak: +peak.toFixed(6),
      rmsRef: +rmsRef.toFixed(6),
      maxSampleDiff: +maxDiff.toExponential(3),
      maxSampleDiffAtSeconds: +maxDiffAt.toFixed(3),
      maxSampleDiffDbBelowPeak: +db(maxDiff, peak).toFixed(1),
      rmsDiffDbBelowSignal: +db(rmsDiff, rmsRef).toFixed(1),
      worstWindowDeltaDb: worst.deltaDb, worstWindowAtSeconds: worst.t,
      worstDropDb: worstDrop.deltaDb, worstDropAtSeconds: worstDrop.t,
      windows: windows.map((w) => ({ t: w.t, deltaDb: w.deltaDb })),
      verbStatsBefore: before.stats,
      verbStatsAfter: after.stats,
    };
  });

  console.log('');
  console.log('A/B of the real GameAudio, ' + report.seconds + 's @ ' + report.sampleRate + ' Hz');
  console.log('route: ' + report.route);
  console.log('');
  console.log('reference peak            ' + report.peak);
  console.log('reference rms             ' + report.rmsRef);
  console.log('max sample difference     ' + report.maxSampleDiff
    + '  (' + report.maxSampleDiffDbBelowPeak + ' dB below peak, at t='
    + report.maxSampleDiffAtSeconds + 's)');
  console.log('rms of the difference     ' + report.rmsDiffDbBelowSignal + ' dB below the signal');
  console.log('worst 100 ms window       ' + report.worstWindowDeltaDb + ' dB at t='
    + report.worstWindowAtSeconds + 's');
  console.log('worst energy LOSS         ' + report.worstDropDb + ' dB at t='
    + report.worstDropAtSeconds + 's   <-- a dropped tail would live here');
  console.log('');
  console.log('rack at the end, old wiring: ' + JSON.stringify(report.verbStatsBefore));
  console.log('rack at the end, new wiring: ' + JSON.stringify(report.verbStatsAfter));
  if (errors.length) console.log('\npage errors:\n' + errors.join('\n'));

  writeFileSync(resultsPath('verb-ab.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}
