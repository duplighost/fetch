// probe-untextured-props.mjs — which props are flat-coloured primitives?
// Walks the built scene and reports every material with NO map, ranked by how
// much world volume wears it, with the mesh names that use it. That is the
// list of things that will read as untextured plastic no matter how well the
// room is lit, ordered by how much of the frame they own.
//   node tools/probe-untextured-props.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const report = await page.evaluate(() => {
    const g = window.__game;
    const THREE = window.__THREE || null;
    const rows = new Map();
    const box = { min: null, max: null };
    const tmp = [];

    const volumeOf = (o) => {
      try {
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        const s = o.getWorldScale(o.userData._s || (o.userData._s = { x: 1, y: 1, z: 1, set(a, b2, c) { this.x = a; this.y = b2; this.z = c; return this; } }));
        const dx = (b.max.x - b.min.x) * Math.abs(s.x || 1);
        const dy = (b.max.y - b.min.y) * Math.abs(s.y || 1);
        const dz = (b.max.z - b.min.z) * Math.abs(s.z || 1);
        const count = o.isInstancedMesh ? o.count : 1;
        return Math.max(0, dx * dy * dz) * count;
      } catch (e) { return 0; }
    };

    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.map) continue;                       // textured: not our problem
        if (m.isMeshBasicMaterial && m.transparent) continue;   // glows/veils
        const key = `${m.type}#${m.color ? m.color.getHexString() : 'none'}#${m.name || ''}`;
        if (!rows.has(key)) {
          rows.set(key, {
            type: m.type,
            color: m.color ? '#' + m.color.getHexString() : null,
            roughness: m.roughness ?? null,
            metalness: m.metalness ?? null,
            basic: !!m.isMeshBasicMaterial,
            transparent: !!m.transparent,
            volume: 0, meshes: 0, names: new Set(),
          });
        }
        const r = rows.get(key);
        r.volume += volumeOf(o);
        r.meshes++;
        const n = o.name || o.parent?.name || '';
        if (n && r.names.size < 8) r.names.add(n);
      }
    });

    return [...rows.values()]
      .map((r) => ({ ...r, names: [...r.names], volume: +r.volume.toFixed(2) }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 30);
  });

  console.log('vol(m3)  meshes  type                     colour    rough  named examples');
  for (const r of report) {
    console.log(
      String(r.volume).padStart(8),
      String(r.meshes).padStart(6), ' ',
      String(r.type).padEnd(24),
      String(r.color).padEnd(9),
      String(r.roughness ?? '-').padEnd(6),
      r.names.slice(0, 3).join(' | '));
  }
  writeFileSync('scratch-props.json', JSON.stringify(report, null, 2));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
