// probe-verb-cost.mjs -- what does FETCH's reverb rack actually COST?
//
// The Underfalls sound complaint ("that area's sound can completely go bad",
// twice, at DIFFERENT severities) has the shape of a real-time DSP margin
// failure, not a stuck gain: a stuck gain reproduces identically every time.
// Margin failures are district-scoped because load is district-scoped.
//
// audio.js wires all three ConvolverNodes (interior 0.6s, outdoor 1.4s,
// cave 2.4s) to verbBus at init and never disconnects any of them. setZone
// silences the two inactive characters at their WET GAIN, which sits
// DOWNSTREAM of the convolution -- so in the cave the engine convolves 4.4
// seconds of impulse response and then throws 2.0 of those seconds away.
//
// This probe does not model that. It renders it, in the same Chrome the game
// runs in, at the game's own 24 kHz, and times it. OfflineAudioContext runs
// the identical Blink DSP code as the realtime graph, just unthrottled, so
// wall-clock render time IS the convolution work. Honest caveat: a REALTIME
// context may spread a long impulse's tail across background threads, so this
// measures total DSP work, not audio-thread time. Total DSP work is still what
// a loaded machine has to find.
//
//   node tools/probe-verb-cost.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);

  const report = await page.evaluate(async () => {
    const SR = 24000;          // the rate audio.js asks Chrome for
    const SECONDS = 40;        // audio rendered per repetition
    const REPS = 7;
    // audio.js:120 and audio.js:29, verbatim
    const SPECS = { interior: [0.6, 4.5], outdoor: [1.4, 2.8], cave: [2.4, 2.2] };
    const WET = { interior: 0.18, outdoor: 0.22, cave: 0.32 };

    const impulse = (ctx, dur, decay) => {
      const n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
      return buf;
    };
    const noise = (ctx, seconds) => {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b = 0.98 * b + 0.02 * w;
        d[i] = b * 3 + w * 0.15;
      }
      return buf;
    };

    // one rendered run of a graph shaped like audio.js's master + verb rack
    const run = async ({ loaded, active, feed = 'continuous' }) => {
      const ctx = new OfflineAudioContext(2, SR * SECONDS, SR);
      const master = ctx.createGain(); master.gain.value = 0.9;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4; comp.knee.value = 12;
      master.connect(lp).connect(comp).connect(ctx.destination);

      const verbBus = ctx.createGain(); verbBus.gain.value = 1;
      for (const k of loaded) {
        const conv = ctx.createConvolver();
        conv.buffer = impulse(ctx, SPECS[k][0], SPECS[k][1]);
        const wet = ctx.createGain();
        wet.gain.value = k === active ? WET[k] : 0.0001;
        verbBus.connect(conv); conv.connect(wet).connect(master);
      }

      // the dry signal, and the send. 'continuous' is the cave: the Drowned
      // Choir holds a send open for the whole district (audio.js:2221-2222).
      const src = ctx.createBufferSource();
      src.buffer = noise(ctx, 1.5); src.loop = true;
      const dry = ctx.createGain(); dry.gain.value = 0.2;
      src.connect(dry).connect(master);
      const send = ctx.createGain();
      send.gain.value = feed === 'silent' ? 0 : 0.68;
      dry.connect(send).connect(verbBus);
      src.start();

      const t0 = performance.now();
      await ctx.startRendering();
      return performance.now() - t0;
    };

    const bench = async (label, cfg) => {
      const times = [];
      for (let i = 0; i < REPS; i++) times.push(await run(cfg));
      times.sort((a, b) => a - b);
      return {
        label,
        loaded: cfg.loaded.join('+') || 'none',
        active: cfg.active || 'none',
        feed: cfg.feed || 'continuous',
        impulseSeconds: +cfg.loaded.reduce((s, k) => s + SPECS[k][0], 0).toFixed(2),
        medianMs: +times[(times.length / 2) | 0].toFixed(1),
        minMs: +times[0].toFixed(1),
        maxMs: +times[times.length - 1].toFixed(1),
      };
    };

    const rows = [];
    rows.push(await bench('no reverb rack at all (floor)', { loaded: [], active: 'none' }));
    rows.push(await bench('basement TODAY (interior loaded)', { loaded: ['interior'], active: 'interior' }));
    rows.push(await bench('graveyard TODAY (interior+outdoor)', { loaded: ['interior', 'outdoor'], active: 'outdoor' }));
    rows.push(await bench('CAVE TODAY (all three loaded)', { loaded: ['interior', 'outdoor', 'cave'], active: 'cave' }));
    rows.push(await bench('CAVE FIXED (only the active one)', { loaded: ['cave'], active: 'cave' }));
    rows.push(await bench('cave rack, SILENT send', { loaded: ['interior', 'outdoor', 'cave'], active: 'cave', feed: 'silent' }));
    rows.push(await bench('cave-only rack, SILENT send', { loaded: ['cave'], active: 'cave', feed: 'silent' }));

    // does a buffer-less ConvolverNode cost anything? (this is what the
    // outdoor/cave convolvers are BEFORE setZone first reaches their district)
    const nullConv = await (async () => {
      const times = [];
      for (let i = 0; i < REPS; i++) {
        const ctx = new OfflineAudioContext(2, SR * SECONDS, SR);
        const master = ctx.createGain();
        master.connect(ctx.destination);
        const verbBus = ctx.createGain();
        for (let k = 0; k < 3; k++) {
          const conv = ctx.createConvolver();       // buffer left null
          const wet = ctx.createGain(); wet.gain.value = 0.0001;
          verbBus.connect(conv); conv.connect(wet).connect(master);
        }
        const src = ctx.createBufferSource();
        src.buffer = noise(ctx, 1.5); src.loop = true;
        const dry = ctx.createGain(); dry.gain.value = 0.2;
        src.connect(dry).connect(master);
        dry.connect(verbBus);
        src.start();
        const t0 = performance.now();
        await ctx.startRendering();
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return +times[(times.length / 2) | 0].toFixed(1);
    })();

    return {
      sampleRate: SR, secondsRendered: SECONDS, reps: REPS,
      rows, threeNullConvolversMedianMs: nullConv,
      hasRenderCapacity: typeof AudioContext !== 'undefined'
        && 'renderCapacity' in AudioContext.prototype,
    };
  });

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  console.log('OfflineAudioContext @ ' + report.sampleRate + ' Hz, ' + report.secondsRendered
    + 's rendered, ' + report.reps + ' reps, median');
  console.log('');
  console.log(pad('config', 38) + pad('loaded', 28) + pad('IR s', 7) + pad('median ms', 11) + 'min..max');
  for (const r of report.rows) {
    console.log(pad(r.label, 38) + pad(r.loaded + (r.feed === 'silent' ? ' [silent]' : ''), 28)
      + pad(r.impulseSeconds, 7) + pad(r.medianMs, 11) + r.minMs + '..' + r.maxMs);
  }
  const floor = report.rows[0].medianMs;
  const caveNow = report.rows.find((r) => r.label.startsWith('CAVE TODAY')).medianMs - floor;
  const caveFix = report.rows.find((r) => r.label.startsWith('CAVE FIXED')).medianMs - floor;
  console.log('');
  console.log('convolution-only (floor subtracted): cave today ' + caveNow.toFixed(1)
    + ' ms, cave fixed ' + caveFix.toFixed(1) + ' ms');
  console.log('saving ' + (caveNow - caveFix).toFixed(1) + ' ms of ' + caveNow.toFixed(1)
    + ' = ' + (100 * (caveNow - caveFix) / caveNow).toFixed(1) + '% of the cave convolution work');
  console.log('three buffer-less convolvers: ' + report.threeNullConvolversMedianMs
    + ' ms median (compare floor ' + floor + ' ms)');
  console.log('AudioContext.renderCapacity available: ' + report.hasRenderCapacity);

  writeFileSync(resultsPath('verb-cost.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.stop();
}
