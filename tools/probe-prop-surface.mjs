// probe-prop-surface.mjs — is the map actually reaching the prop, and what is
// the surface worth in linear albedo before any light touches it? Answers the
// two questions that a screenshot cannot: whether the texture is bound at all
// (uv attribute + map present) and what the painted canvas actually averages.
//   node tools/probe-prop-surface.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1280, height: 800 });
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const out = await page.evaluate(() => {
    const g = window.__game;
    const rows = [];
    const seen = new Set();

    const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

    const meanOfTexture = (tex) => {
      try {
        const img = tex.image;
        if (!img) return null;
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let s = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
          s += l; n++;
        }
        const mean = s / n;
        return {
          meanSrgb: +mean.toFixed(4),
          // NoColorSpace maps are read as linear already (see textures.js header)
          meanLinear: +(tex.colorSpace === 'srgb' ? srgbToLinear(mean) : mean).toFixed(4),
          colorSpace: tex.colorSpace || 'none',
          size: `${img.width}x${img.height}`,
          repeat: `${tex.repeat.x}x${tex.repeat.y}`,
        };
      } catch (e) { return { error: String(e.message || e) }; }
    };

    const inspect = (needle, label) => {
      g.scene.traverse((o) => {
        if (!o.isMesh || !(o.name || '').toLowerCase().includes(needle)) return;
        const m = o.material;
        if (!m || seen.has(label + o.name)) return;
        seen.add(label + o.name);
        const tex = m.map ? meanOfTexture(m.map) : null;
        const col = m.color ? m.color.clone() : null;   // three stores color LINEAR
        rows.push({
          label, mesh: o.name,
          material: m.type,
          hasUV: !!o.geometry.attributes.uv,
          hasMap: !!m.map,
          hasBump: !!m.bumpMap,
          colorLinear: col ? [+col.r.toFixed(3), +col.g.toFixed(3), +col.b.toFixed(3)] : null,
          roughness: m.roughness ?? null,
          metalness: m.metalness ?? null,
          map: tex,
          effectiveAlbedo: tex && col
            ? +(tex.meanLinear * (col.r * 0.2126 + col.g * 0.7152 + col.b * 0.0722)).toFixed(4)
            : (col ? +(col.r * 0.2126 + col.g * 0.7152 + col.b * 0.0722).toFixed(4) : null),
        });
      });
    };

    // after batchStaticGroup the car's meshes are renamed 'wrecked wagon material N'
    inspect('wrecked wagon', 'car');
    inspect('graveyard body', 'body');
    inspect('dragged body', 'body');
    inspect('boiler-tank', 'boiler');
    inspect('boiler-shoulder', 'boiler');
    // and a control: something that already reads correctly
    inspect('mourning statue', 'control-statue');

    // What irradiance does the carried lantern actually deliver at range?
    const L = g.skullLight;
    const falloff = [0.6, 0.8, 1.2, 2, 3, 5, 8, 11].map((d) => ({
      d, irr: +(L.intensity / Math.pow(d, L.decay)).toFixed(2),
    }));
    return { rows, light: { intensity: L.intensity, distance: L.distance, decay: L.decay }, falloff };
  });

  for (const r of out.rows) {
    console.log(`${r.label.padEnd(16)} ${String(r.mesh).padEnd(18)} uv=${r.hasUV} map=${r.hasMap} bump=${r.hasBump}`);
    console.log(`   colorLinear=${JSON.stringify(r.colorLinear)} rough=${r.roughness} metal=${r.metalness}`);
    console.log(`   map=${JSON.stringify(r.map)}`);
    console.log(`   EFFECTIVE ALBEDO (map x color, linear) = ${r.effectiveAlbedo}`);
  }
  console.log('\ncarried lantern:', JSON.stringify(out.light));
  console.log('irradiance by distance:', out.falloff.map((f) => `${f.d}m:${f.irr}`).join('  '));
  console.log('=> anything whose albedo x irradiance exceeds ~1.0 is clipping to white');
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
