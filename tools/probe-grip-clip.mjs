// probe-grip-clip.mjs -- "those hands look nasty. and clip through."
// Measure the held rig in HOLD space: what the skull actually occupies, what
// each hand occupies, and how deep the hands are buried in it. Numbers first;
// the shot tools judge the look afterwards.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });
  const report = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.5, {}, false);
    const hold = g.skull.hold;
    hold.updateWorldMatrix(true, true);
    const inv = hold.matrixWorld.clone().invert();
    const box = (obj) => {
      const b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
      obj.updateWorldMatrix(true, true);
      obj.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const geo = o.geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        const bb = geo.boundingBox;
        for (const sx of [bb.min.x, bb.max.x]) for (const sy of [bb.min.y, bb.max.y]) for (const sz of [bb.min.z, bb.max.z]) {
          const v = new o.position.constructor(sx, sy, sz);
          v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          b.min[0] = Math.min(b.min[0], v.x); b.max[0] = Math.max(b.max[0], v.x);
          b.min[1] = Math.min(b.min[1], v.y); b.max[1] = Math.max(b.max[1], v.y);
          b.min[2] = Math.min(b.min[2], v.z); b.max[2] = Math.max(b.max[2], v.z);
        }
      });
      const r = (a) => a.map((n) => +n.toFixed(3));
      return { min: r(b.min), max: r(b.max), size: r([b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]) };
    };
    const children = hold.children.map((c, i) => ({
      i, name: c.name || c.type, box: box(c),
      pos: [+c.position.x.toFixed(3), +c.position.y.toFixed(3), +c.position.z.toFixed(3)],
      visible: c.visible,
    }));
    return {
      children,
      pose: { ...g.skull._handPose.cradle },
      t: g.skull._handPose.t, g: g.skull._handPose.g,
      grip: +(g.skull._grip ?? -1).toFixed(3),
      holdPos: [+hold.position.x.toFixed(3), +hold.position.y.toFixed(3), +hold.position.z.toFixed(3)],
      holdScale: [+hold.scale.x.toFixed(3), +hold.scale.y.toFixed(3), +hold.scale.z.toFixed(3)],
    };
  });
  console.log('hold at', report.holdPos, 'scale', report.holdScale, 'grip', report.grip,
    't', report.t, 'g', report.g);
  console.log('cradle', JSON.stringify(report.pose));
  for (const c of report.children) {
    console.log(`[${c.i}] ${String(c.name).padEnd(28)} pos ${JSON.stringify(c.pos)} `
      + `box min ${JSON.stringify(c.box.min)} max ${JSON.stringify(c.box.max)} size ${JSON.stringify(c.box.size)}${c.visible ? '' : ' (hidden)'}`);
  }
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
  writeFileSync(resultsPath('grip-clip.json'), JSON.stringify(report, null, 2));
} finally { await browser.close().catch(() => {}); server.stop(); }
