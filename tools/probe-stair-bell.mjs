// probe-stair-bell.mjs -- WHICH bell is the one at the foot of the cellar stairs?
//
// Screenshot 3: "can we make this bell at the bottom of the stairs at the first
// basement look like its wired to the rest of the puzzle" -- a gold bell in a
// bracket on a stone stairwell wall, a gold rod beside it, steps to the left.
// house.js has more than one bell and the obvious candidate (the study window
// receiver) is on the ground floor behind wallpaper, not stone. Rather than
// guess, stand where he stood and list what is actually there.
//
//   node tools/probe-stair-bell.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const g = window.__game;
  const V = g.skull.pos.constructor;                    // THREE.Vector3, via a live one
  const BOX = { x0: 2, x1: 13, y0: -3.1, y1: -0.4, z0: 1.5, z1: 6.5 };  // the basement corridor, foot of the stair to before the webs
  const near = [];
  const seen = new Set();
  g.scene.traverse((o) => {
    if (!o.isMesh && !o.isGroup) return;
    const p = o.getWorldPosition(new V());
    if (p.x < BOX.x0 || p.x > BOX.x1 || p.y < BOX.y0 || p.y > BOX.y1 || p.z < BOX.z0 || p.z > BOX.z1) return;
    const d = Math.hypot(p.x - 8, p.y + 2.4, p.z - 4);
    const label = o.name || o.parent?.name || o.material?.name || o.geometry?.type || '(anon)';
    const key = label + '|' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ',' + p.z.toFixed(1);
    if (seen.has(key)) return;
    seen.add(key);
    near.push({
      d: +d.toFixed(2), label, kind: o.isMesh ? 'mesh' : 'group',
      geo: o.geometry?.type || '', mat: o.material?.name || o.material?.type || '',
      colorHex: o.material?.color ? '#' + o.material.color.getHexString() : '',
      at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
    });
  });
  near.sort((a, b) => a.d - b.d);

  // and every fetch target within reach of that spot, since "wired to the
  // puzzle" means the player must be able to tell it IS a target
  const targets = (g.world.fetchTargets || []).map((t) => {
    let p = null;
    try { p = t.object ? t.object.getWorldPosition(new V()) : t.pos; } catch (e) { p = null; }
    if (!p) return null;
    const d = Math.hypot(p.x - 8, p.y + 2.4, p.z - 4);
    return d < 9 ? { id: t.id, d: +d.toFixed(2), enabled: t.enabled !== false, at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] } : null;
  }).filter(Boolean).sort((a, b) => a.d - b.d);

  return { near: near.slice(0, 120), targets };
});

console.log('Inside the basement corridor box x2..13 y-3.1..-0.4 z1.5..6.5:');
for (const n of out.near) console.log(`  ${String(n.d).padStart(5)}m  ${n.kind.padEnd(5)} ${n.label.slice(0, 40).padEnd(40)} ${n.geo.padEnd(18)} ${n.colorHex.padEnd(8)} @ ${n.at.join(',')}`);
console.log('\nFetch targets within 14 m:');
for (const t of out.targets) console.log(`  ${String(t.d).padStart(5)}m  ${t.id.padEnd(26)} enabled=${t.enabled} @ ${t.at.join(',')}`);
if (errors.length) console.log('\nPAGE ERRORS:', errors.slice(0, 5));
await browser.close();
await server?.close?.();
