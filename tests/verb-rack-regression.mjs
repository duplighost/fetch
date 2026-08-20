// verb-rack-regression.mjs -- ONE reverb character convolves at a time, and a
// zone change never drops a tail.
//
// His oldest unsolved complaint is the Underfalls: "that area's sound can
// completely go bad", reported twice at DIFFERENT severities. A stuck gain or a
// frozen loop reproduces identically every time; something whose severity varies
// is a margin failure, and margin failures are district-scoped because load is
// district-scoped.
//
// What audio.js was doing: all three ConvolverNodes (interior 0.6s, outdoor
// 1.4s, cave 2.4s) wired to verbBus at init, never disconnected, with setZone
// silencing the two inactive ones at the WET GAIN -- which is downstream of the
// convolution. From the cave onward the engine convolved 4.4 seconds of impulse
// response and multiplied 2.0 of those seconds by 0.0001. Measured cost of the
// waste, in this game's own 24 kHz Chrome: 61% of the district's convolution
// work (tools/probe-verb-cost.mjs).
//
// Two invariants, and the second is the dangerous one:
//
//  1. EXACTLY ONE character is fed in steady state, and it is the one the zone
//     asks for. Never two. Never three.
//  2. THE OUTGOING CHARACTER KEEPS ITS INPUT ACROSS THE WHOLE CROSSFADE. A
//     convolver whose input is cut mid-tail is a reverb that stops dead. This
//     gate polls until the input is actually cut and then checks the release
//     against the AudioContext clock the crossfade itself runs on: the cut must
//     land at or after its scheduled deadline, and that deadline must be at
//     least six time constants of the wet ramp.
//
//     A TRAP, PAID FOR ONCE: do not try to prove this by reading a wet gain's
//     .value. When nothing feeds verbBus, Chrome skips the whole idle
//     convolver -> wet chain and every AudioParam on it freezes at its last
//     computed sample, so the reading is stale by seconds. (That same skip is
//     why the cave was the district that paid: it is the only one that holds a
//     send open continuously, so it never gets the skip.) The AUDIBLE proof
//     that nothing changed lives in tools/probe-verb-ab.mjs, which renders the
//     real GameAudio twice and subtracts one render from the other.
//
// Real audio, not ?mute=1: the whole point is the live node graph.
//
//   node tests/verb-rack-regression.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
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
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 120000, polling: 100 });

  const report = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.5, {}, false);
    if (!g.audio._ready && g.audio.init) { try { g.audio.init(); } catch { /* no gesture */ } }
    F.stepWith(0.5, {}, false);
    if (!g.audio._ready) return { fatal: 'audio never initialised' };
    if (typeof g.audio.verbStats !== 'function') return { fatal: 'no verbStats() instrument' };

    // The release deadline lives in AudioContext time, so this test has to spend
    // REAL seconds, not simulated ones. Every settle drives update() the way the
    // frame loop does.
    const tick = () => g.audio.update(0.04, g.camera.position, g.camera);
    const settle = async (seconds) => {
      const end = performance.now() + seconds * 1000;
      while (performance.now() < end) {
        await new Promise((r) => setTimeout(r, 40));
        tick();
      }
    };
    const wetOf = (kind) => g.audio._wet[kind]?.gain.value ?? 0;

    const out = { samples: [], acts: [] };

    // --- the opening room -------------------------------------------------
    await settle(0.4);
    out.bedroom = g.audio.verbStats();

    // --- interior -> outdoor: watch the handover, do not assume it ---------
    F.teleport('graveyard');
    F.stepWith(1 / 120, {}, false);
    const t0 = performance.now();
    let cut = null;
    while (performance.now() - t0 < 12000) {
      await new Promise((r) => setTimeout(r, 50));
      tick();
      const s = g.audio.verbStats();
      const row = {
        t: +((performance.now() - t0) / 1000).toFixed(2),
        now: s.now, fed: s.fed.slice(), deadline: s.releaseAt.interior ?? null,
        // recorded, never asserted on -- see the trap note at the top
        wetOut: wetOf('interior'), wetIn: wetOf('outdoor'),
      };
      out.samples.push(row);
      if (out.deadline == null && row.deadline != null) out.deadline = row.deadline;
      if (!s.fed.includes('interior')) { cut = row; break; }
    }
    out.cut = cut;
    out.hold = g.audio.verbStats().holdSeconds;
    out.xfadeTau = g.audio.verbStats().xfadeTau;
    await settle(0.5);
    out.graveyardSettled = g.audio.verbStats();

    // --- the district the complaint is about -------------------------------
    F.teleport('clearing');
    F.stepWith(0.5, {}, false);
    const waterfall = g.world.fetchTargets.find((t) => t.id === 'waterfall');
    if (waterfall?.onHit?.call(waterfall, g.skull, waterfall.pos, {}) === 'gone') g.skull.vanish();
    F.teleport('cave');
    F.stepWith(0.5, {}, false);
    out.caveImmediate = g.audio.verbStats();
    await settle(4.6);
    for (let i = 0; i < 60; i++) F.stepWith(1 / 60, {}, false);
    await settle(1.2);
    out.caveSettled = g.audio.verbStats();
    out.caveChoirAlive = !!g.enemies?.choir;
    out.caveVoices = g.audio.voiceStats?.() ?? null;

    // --- there and back: a character about to be wanted again is not cut ----
    F.teleport('house');
    F.stepWith(0.25, {}, false);
    await settle(0.6);
    F.teleport('basement');       // also 'interior' -- must stay fed throughout
    F.stepWith(0.25, {}, false);
    out.interiorHeldA = g.audio.verbStats();
    await settle(4.6);
    out.interiorHeldB = g.audio.verbStats();

    // --- every district, settled -------------------------------------------
    for (const act of ['bedroom', 'house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
      F.teleport(act);
      F.stepWith(0.5, {}, false);
      await settle(4.4);
      out.acts.push({ act, stats: g.audio.verbStats() });
    }
    return out;
  });

  if (report.fatal) {
    check(false, 'the probe could run at all', report.fatal);
  } else {
    const one = (s) => s.fed.length === 1 && s.fed[0] === s.character;

    check(one(report.bedroom), 'the opening room convolves exactly one character',
      JSON.stringify(report.bedroom));

    // --- invariant 2: the tail survives the crossfade ---------------------
    check(!!report.cut, 'the outgoing character is eventually released',
      report.cut ? 'at ' + report.cut.t + ' s' : 'still fed after 9 s');
    check(report.hold >= report.xfadeTau * 6,
      'the release hold is at least six time constants of the wet crossfade',
      'hold ' + report.hold + ' s vs tau ' + report.xfadeTau + ' s (e^-6 = 0.25%)');
    check(!!report.cut && report.deadline != null && report.cut.now >= report.deadline,
      'the input is never cut before its scheduled deadline',
      report.cut && report.deadline != null
        ? 'cut at ctx ' + report.cut.now + ' s, deadline ' + report.deadline + ' s'
        : 'no cut observed');
    check(report.samples.every((s) => s.fed.includes('outdoor')),
      'the incoming character is fed for the whole crossfade',
      report.samples.length + ' samples');

    // --- invariant 1: never more than one, anywhere ------------------------
    check(one(report.graveyardSettled), 'the graveyard settles to one character',
      JSON.stringify(report.graveyardSettled));
    check(one(report.caveSettled) && report.caveSettled.character === 'cave',
      'THE CAVE convolves exactly one character', JSON.stringify(report.caveSettled));
    check(report.caveSettled.convolvingSeconds === 2.4,
      'the cave convolves 2.4 s of impulse response, not 4.4',
      report.caveSettled.convolvingSeconds + ' s');
    check(report.caveSettled.builtSeconds === 4.4,
      'and it is not cheating: all three impulses are still built',
      report.caveSettled.builtSeconds + ' s built');

    check(report.interiorHeldA.fed.includes('interior')
      && report.interiorHeldB.fed.length === 1 && report.interiorHeldB.fed[0] === 'interior',
      'house -> basement never cuts the character it is about to want again',
      JSON.stringify(report.interiorHeldA.fed) + ' -> ' + JSON.stringify(report.interiorHeldB.fed));

    const bad = report.acts.filter((a) => !one(a.stats));
    check(bad.length === 0, 'every district settles to exactly one convolver',
      bad.length ? bad.map((a) => a.act + ':' + a.stats.fed.join('+')).join(' ')
        : report.acts.map((a) => a.act + '=' + a.stats.convolvingSeconds).join(' '));

    const worst = Math.max(...report.acts.map((a) => a.stats.convolvingSeconds));
    check(worst <= 2.4, 'no district ever convolves more than the cave needs', worst + ' s');
  }

  const fatalErrors = errors.filter((e) => !/voice cap/i.test(e));
  check(fatalErrors.length === 0, 'no page errors', fatalErrors.slice(0, 3).join(' | '));

  writeFileSync(resultsPath('verb-rack.json'), JSON.stringify({ checks, report }, null, 2));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.log('\nFAILED ' + failures.length + ' check(s):\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('\nverb rack: one character at a time, no dropped tails.');
