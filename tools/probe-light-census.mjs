// probe-light-census.mjs -- does the VISIBLE light count move during play?
//
// Why this exists: after the start gate stopped cancelling the shader warmup,
// 2-5 programs still linked per act, each costing 350-700 ms at first sight.
// Diffing their three.js cacheKeys against the nearest warmed key named the
// difference, and it was not a new material — it was `numPointLights: 29` on a
// program whose neighbour was compiled at 32. The light census is the FIRST
// number in every program key, so a census that moves invalidates every lit
// material in the game and pays for it one district at a time.
//
// This counts what the renderer counts: a light is visible only if it and every
// ancestor up to the scene is visible. It names every light that changes state
// across an act change, so the offending line can be found and killed.
//
//   node tools/probe-light-census.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
await page.waitForFunction(() => ['ready', 'degraded'].includes(window.__game.shaderWarmup.status),
  null, { timeout: 90000, polling: 100 });

const report = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const path = (object) => {
    const chain = [];
    for (let p = object; p && p !== g.scene && chain.length < 5; p = p.parent) chain.push(p.name || p.type);
    return chain.join(' < ');
  };
  // The renderer's own rule: projectObject returns early on an invisible
  // object, so a light under a hidden group is not in the census.
  const census = () => {
    const lights = [];
    g.scene.traverse((object) => {
      if (!object.isLight) return;
      let live = object.visible;
      for (let p = object.parent; p && live; p = p.parent) if (!p.visible) live = false;
      lights.push({
        key: `${object.type}|${object.name || path(object)}|${object.id}`,
        name: object.name || '(unnamed)',
        type: object.type,
        path: path(object),
        live,
        intensity: +object.intensity.toFixed(3),
      });
    });
    const counts = {};
    for (const l of lights) if (l.live) counts[l.type] = (counts[l.type] || 0) + 1;
    return { lights, counts, total: lights.filter((l) => l.live).length };
  };

  const snapshots = [];
  const take = (label) => {
    const c = census();
    snapshots.push({ label, counts: c.counts, total: c.total, map: new Map(c.lights.map((l) => [l.key, l])) });
    return c;
  };

  // PER-FRAME watch. Snapshots between beats cannot see a census that dips and
  // comes back — and a dip is enough: every lit material drawn during the dip
  // links a whole new program set keyed on the smaller count. three's own rule
  // is visible AND layers.test(camera.layers), so use exactly that.
  const pointCount = () => {
    let n = 0;
    const camLayers = g.camera.layers;
    g.scene.traverse((object) => {
      if (!object.isPointLight) return;
      if (!object.layers.test(camLayers)) return;
      let live = object.visible;
      for (let p = object.parent; p && live; p = p.parent) if (!p.visible) live = false;
      if (live) n++;
    });
    return n;
  };
  const timeline = [];
  let lastCount = pointCount();
  timeline.push({ at: 0, count: lastCount, note: 'title' });
  const watch = () => {
    const n = pointCount();
    if (n !== lastCount) {
      const changed = [];
      g.scene.traverse((object) => {
        if (!object.isPointLight) return;
        let live = object.visible && object.layers.test(g.camera.layers);
        for (let p = object.parent; p && live; p = p.parent) if (!p.visible) live = false;
        changed.push({ path: path(object), live, intensity: +object.intensity.toFixed(2) });
      });
      timeline.push({
        at: +(performance.now() / 1000).toFixed(2),
        count: n, was: lastCount, act: g.act,
        dark: changed.filter((c) => !c.live).map((c) => c.path),
      });
      lastCount = n;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);

  take('title (warm compile ran here)');
  window.__FETCH.start();
  await g.entryPromise;
  await wait(600);
  take('entered: bedroom');

  for (const act of ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror']) {
    g.teleport(act);
    for (let i = 0; i < 30; i++) await frame();
    await wait(200);
    take('act: ' + act);
  }

  // Diff consecutive snapshots.
  const diffs = [];
  for (let i = 1; i < snapshots.length; i++) {
    const before = snapshots[i - 1];
    const after = snapshots[i];
    const changed = [];
    for (const [key, light] of after.map) {
      const was = before.map.get(key);
      if (!was) { changed.push({ what: 'appeared', name: light.name, path: light.path, live: light.live }); continue; }
      if (was.live !== light.live) changed.push({ what: light.live ? 'lit' : 'went dark', name: light.name, path: light.path });
    }
    for (const [key, light] of before.map) {
      if (!after.map.has(key)) changed.push({ what: 'removed', name: light.name, path: light.path, live: light.live });
    }
    diffs.push({ from: before.label, to: after.label, before: before.total, after: after.total, changed });
  }
  return {
    diffs,
    timeline,
    snapshots: snapshots.map((s) => ({ label: s.label, total: s.total, counts: s.counts })),
    programs: g.renderer.info.programs.length,
  };
});

await browser.close();
server.stop();

console.log('visible-light census, step by step:');
for (const s of report.snapshots) {
  console.log(`  ${s.label.padEnd(34)} ${String(s.total).padStart(3)} live   ${JSON.stringify(s.counts)}`);
}
console.log('\nPOINT-LIGHT COUNT, three\'s own rule (visible + layers), every frame it moved:');
for (const t of report.timeline) {
  console.log(`  t=${String(t.at).padStart(7)}s  ${String(t.was ?? '-').padStart(3)} -> ${String(t.count).padStart(3)}  ${t.act || 'title'}`
    + (t.dark?.length ? `   dark now: ${t.dark.slice(0, 5).join(' | ')}` : ''));
}

console.log('\nwhat changed:');
for (const d of report.diffs) {
  if (!d.changed.length && d.before === d.after) continue;
  console.log(`\n  ${d.from}  ->  ${d.to}   (${d.before} -> ${d.after})`);
  for (const c of d.changed.slice(0, 24)) console.log(`     ${c.what.padEnd(11)} ${c.name}   [${c.path}]`);
  if (d.changed.length > 24) console.log(`     ... ${d.changed.length - 24} more`);
}
if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
writeFileSync(resultsPath('light-census.json'), JSON.stringify(report, null, 2));
