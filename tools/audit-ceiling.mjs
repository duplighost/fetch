// Find small rendered meshes that cross an authored room ceiling plane.
// This is a geometry-forensics probe, not a gameplay shortcut:
//   node tools/audit-ceiling.mjs [URL]
import { launchBrowser, openPage, URL_BASE, ensureServer } from '../tests/lib/harness.mjs';

const requested = process.argv[2] || `${URL_BASE}/?test=1&mute=1`;
const local = !process.argv[2];
const server = local ? await ensureServer() : null;
const browser = await launchBrowser();

try {
  const { page, errors } = await openPage(browser, requested);
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null,
    { timeout: 60000, polling: 100 },
  );
  const rows = await page.evaluate(() => {
    const g = window.__game;
    const F = window.__FETCH;
    F.start();
    F.teleport('basement');
    F.stepWith(0.2, {}, false);
    // Vector3's constructor is exposed through game objects, but Box3 is not.
    // Use each geometry's local bounding box and transform its eight corners.
    const out = [];
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((node) => {
      if (!node.isMesh || !node.geometry || node === g.renderer?.domElement) return;
      const geo = node.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const b = geo.boundingBox;
      if (!b) return;
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const p = g.player.pos.clone().set(x, y, z).applyMatrix4(node.matrixWorld);
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); minZ = Math.min(minZ, p.z);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); maxZ = Math.max(maxZ, p.z);
      }
      // Basement ceiling is y=-0.55. Ignore broad slabs; retain small objects
      // that physically straddle or hang within 18 cm of the visible plane.
      const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ;
      const nearCeiling = minY < -0.37 && maxY > -0.73;
      const small = sx < 4 && sy < 4 && sz < 4;
      if (!nearCeiling || !small) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const colors = mats.filter(Boolean).map((m) => m.color ? `#${m.color.getHexString()}` : null);
      out.push({
        name: node.name || '(unnamed)',
        parent: node.parent?.name || node.parent?.type || '',
        geometry: geo.type,
        bounds: [minX, minY, minZ, maxX, maxY, maxZ].map((v) => +v.toFixed(3)),
        size: [sx, sy, sz].map((v) => +v.toFixed(3)),
        colors,
        visible: node.visible,
        renderOrder: node.renderOrder,
      });
    });
    return out.sort((a, b) => (a.bounds[1] - b.bounds[1]) || a.name.localeCompare(b.name));
  });
  console.log(JSON.stringify({ url: requested, errors, count: rows.length, rows }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server?.stop();
}
