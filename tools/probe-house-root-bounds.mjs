// probe-house-root-bounds.mjs -- world bounds of every house render root.
//
// Companion to tools/shot-cull-audit.mjs. The audit says WHICH roots the
// graveyard can see; this says WHERE they are, so the culler can be written as
// a rule the house build maintains for itself rather than a list of 425 array
// indices that rots the first time someone adds a chair.
//
//   node tools/probe-house-root-bounds.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.4, {}, false);
    const roots = g.houseRenderRoots || [];
    // THREE is not on window, so walk the corners by hand: every mesh's
    // geometry bounding box, its eight corners through matrixWorld.
    const rootBounds = (root) => {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      root.traverse((o) => {
        const geo = o.geometry;
        if (!geo || !(o.isMesh || o.isLine || o.isPoints)) return;
        if (!geo.boundingBox) geo.computeBoundingBox();
        const b = geo.boundingBox;
        if (!b || !Number.isFinite(b.min.x)) return;
        const e = o.matrixWorld.elements;
        for (let c = 0; c < 8; c++) {
          const x = (c & 1) ? b.max.x : b.min.x;
          const y = (c & 2) ? b.max.y : b.min.y;
          const z = (c & 4) ? b.max.z : b.min.z;
          const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
          const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
          const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
          if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
          if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
        }
      });
      if (!Number.isFinite(minX)) return null;
      return [+minX.toFixed(2), +minY.toFixed(2), +minZ.toFixed(2),
        +maxX.toFixed(2), +maxY.toFixed(2), +maxZ.toFixed(2)];
    };
    const rows = roots.map((root, i) => {
      root.updateWorldMatrix(true, true);
      const bounds = rootBounds(root);
      let meshes = 0;
      root.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) meshes++; });
      return {
        i, name: root.name || '', type: root.type, visible: root.visible,
        isLight: root.isLight === true, meshes, bounds,
      };
    });
    // The house's own zones/rooms, for reference: what does the build itself
    // think the building's footprint is?
    const rooms = (g.world.rooms || []).map((r) => ({
      id: r.id, level: r.level, floorY: r.floorY,
      x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1,
    }));
    return { rows, rooms };
  });

  writeFileSync(resultsPath('house-root-bounds.json'), JSON.stringify(out, null, 2));
  console.log(`roots ${out.rows.length}, rooms ${out.rooms.length}`);
  console.log('rooms by level:');
  const byLevel = {};
  for (const r of out.rooms) (byLevel[r.level] ||= []).push(r);
  for (const [level, list] of Object.entries(byLevel)) {
    const x0 = Math.min(...list.map((r) => r.x0)), x1 = Math.max(...list.map((r) => r.x1));
    const z0 = Math.min(...list.map((r) => r.z0)), z1 = Math.max(...list.map((r) => r.z1));
    console.log(`  ${level.padEnd(10)} ${list.length} rooms   x ${x0} .. ${x1}   z ${z0} .. ${z1}`);
  }
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
  server.stop();
}
