// probe-scene-growth.mjs -- tests/perf-pool-regression asserts that a gore
// burst adds no scene objects and that repeated bursts keep the count flat.
// Both went red somewhere in rounds 17-18 and shipped that way. The assertion
// only reports a NUMBER, which names nothing; this names the objects.
//
//   node tools/probe-scene-growth.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1&warmup=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 180000, polling: 100 });

  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    // THE BASELINE THE GATE ACTUALLY USES is taken BEFORE the title is clicked
    // (it asserts !initial.started two lines later), so anything the START
    // legitimately adds is counted as a gore leak. Measure that gap.
    const preStart = g.scene.children.length;
    const preLabels = g.scene.children.map((o) => (o.name || '') + ' [' + o.type + ']');
    F.start();
    await (F.started ? F.started() : Promise.resolve());
    while (['scheduled', 'created', 'compiling'].includes(g.shaderWarmup.status)) {
      await new Promise((r) => setTimeout(r, 100));
    }
    F.stepWith(0.4, {}, false);
    await new Promise((r) => setTimeout(r, 400));
    g.render(); g.render();
    const postLabels = g.scene.children.map((o) => (o.name || '') + ' [' + o.type + ']');
    const startSeen = new Map();
    for (const x of preLabels) startSeen.set(x, (startSeen.get(x) || 0) + 1);
    const addedByStart = [];
    for (const x of postLabels) { const n = startSeen.get(x) || 0; if (n > 0) startSeen.set(x, n - 1); else addedByStart.push(x); }

    const label = (o) => (o.name || '')
      + ' [' + o.type + (o.isInstancedMesh ? ' x' + o.count : '')
      + (o.material ? ' ' + (o.material.type || '') : '') + ']';
    const snap = () => g.scene.children.map(label);
    const diff = (a, b) => {
      const seen = new Map();
      for (const s of a) seen.set(s, (seen.get(s) || 0) + 1);
      const added = [];
      for (const s of b) {
        const n = seen.get(s) || 0;
        if (n > 0) seen.set(s, n - 1); else added.push(s);
      }
      return added;
    };

    const before = snap();
    g.gore(g.player.pos, 100, 40);
    g.render();
    const afterFirst = snap();
    g._updateGore(1.8);
    g.gore(g.player.pos, 100, 40);
    g.render();
    const afterSecond = snap();
    // and a third, to tell one-time lazy init from a per-burst leak
    g._updateGore(1.8);
    g.gore(g.player.pos, 100, 40);
    g.render();
    const afterThird = snap();

    return {
      preStart, postStart: before.length, addedByStart, warm: g.shaderWarmup.status, draw: { ...g.warmDraw, work: undefined },
      counts: [before.length, afterFirst.length, afterSecond.length, afterThird.length],
      addedByFirst: diff(before, afterFirst),
      addedBySecond: diff(afterFirst, afterSecond),
      addedByThird: diff(afterSecond, afterThird),
    };
  });

  console.log('pre-start ' + out.preStart + ' -> post-start ' + out.postStart
    + '  (the gate compares bursts against PRE-START)');
  console.log('scene children: ' + out.counts.join(' -> ')
    + '   (before, after burst 1, 2, 3)');
  console.log('shaderWarmup:', out.warm, ' warmDraw.status:', out.draw && out.draw.status, 'drawn', out.draw && out.draw.drawn, 'of', out.draw && out.draw.total);
  console.log('added by START+warmup:', JSON.stringify(out.addedByStart, null, 2));
  console.log('added by burst 1:', JSON.stringify(out.addedByFirst, null, 2));
  console.log('added by burst 2:', JSON.stringify(out.addedBySecond, null, 2));
  console.log('added by burst 3:', JSON.stringify(out.addedByThird, null, 2));
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('scene-growth.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
