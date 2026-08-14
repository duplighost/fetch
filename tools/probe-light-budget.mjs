// probe-light-budget.mjs — every light in the game, ranked by how hard it hits
// a surface one metre away. A point light's irradiance is intensity / d^decay,
// and a surface clips to white once albedo x irradiance passes ~1. With this
// kit's albedos (0.03-0.06 linear, deliberately, because the carried lantern is
// fierce) anything delivering more than ~20 at a metre bleaches whatever it is
// standing next to — which is exactly what makes close-up props read as white
// plastic no matter how they are textured.
//   node tools/probe-light-budget.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const out = await page.evaluate(() => {
    const g = window.__game;
    const rows = [];
    const p = new (g.player.pos.constructor)();
    g.scene.traverse((o) => {
      if (!o.isLight) return;
      o.getWorldPosition(p);
      const decay = o.decay ?? null;
      const irr1 = decay != null && o.intensity ? o.intensity / Math.pow(1, decay) : null;
      const irr05 = decay != null && o.intensity ? o.intensity / Math.pow(0.5, decay) : null;
      rows.push({
        type: o.type,
        name: o.name || o.parent?.name || '',
        intensity: +(o.intensity ?? 0).toFixed(2),
        distance: o.distance ?? null,
        decay,
        pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
        irr1m: irr1 != null ? +irr1.toFixed(1) : null,
        irr50cm: irr05 != null ? +irr05.toFixed(1) : null,
        visible: o.visible,
      });
    });
    const pool = (g.world.candlePool || []).length;
    return {
      rows: rows.filter((r) => r.irr1m != null).sort((a, b) => b.irr1m - a.irr1m).slice(0, 24),
      totalLights: rows.length,
      ambient: g.world.ambient ? +g.world.ambient.intensity.toFixed(2) : null,
      hemi: g.world.hemi ? +g.world.hemi.intensity.toFixed(2) : null,
      candlePool: pool,
    };
  });

  console.log(`lights in scene: ${out.totalLights}   ambient ${out.ambient}  hemi ${out.hemi}  candlePool ${out.candlePool}`);
  console.log('irr@1m  irr@50cm  int    dist  decay  vis  type                 name / position');
  for (const r of out.rows) {
    console.log(
      String(r.irr1m).padStart(6),
      String(r.irr50cm).padStart(9),
      String(r.intensity).padStart(6),
      String(r.distance).padStart(6),
      String(r.decay).padStart(6),
      String(r.visible).padStart(5),
      ' ', String(r.type).padEnd(20),
      (r.name || JSON.stringify(r.pos)));
  }
  console.log('\n=> with this kit at ~0.045 albedo, irr@1m above ~22 clips the surface white');
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
