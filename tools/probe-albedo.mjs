// probe-albedo.mjs -- the PRODUCT, for every material that owns a large
// surface. Never eyeball a painter value; never read one either.
//
// Trap: canvasTexture sets NoColorSpace, so the bytes a painter writes ARE
// linear albedo — but the material's `color` is sRGB-decoded and MULTIPLIES
// that map, and main.js's grade pass sets those colours late, long after the
// painter ran. Judging a surface by its painter alone overstates it by however
// much the grade took out; judging it by its hex alone ignores the map. What
// the renderer actually samples is map x colour, and that is what this prints,
// next to the district's own stated ceiling of ~0.03-0.05 linear for anything
// the player can walk up to.
//
// Also prints per-channel spread, because the player is colourblind: a surface
// whose read lives in its green channel is a surface he cannot read at all.
//
//   node tools/probe-albedo.mjs [name ...]
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const WANT = process.argv.slice(2);

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async (want) => {
    const g = window.__game;
    const names = want.length ? want : Object.keys(g.mats);
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const rows = [];
    for (const name of names) {
      const m = g.mats[name];
      if (!m || !m.color) continue;
      const map = m.map;
      let mapMean = null, mapChannels = null, mapMin = null, mapMax = null;
      if (map?.image) {
        const img = map.image;
        cv.width = img.width; cv.height = img.height;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let sr = 0, sg = 0, sb = 0, lo = 255, hi = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2];
          const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
          if (l < lo) lo = l; if (l > hi) hi = l;
          n++;
        }
        mapChannels = [sr / n / 255, sg / n / 255, sb / n / 255];
        mapMean = mapChannels[0] * 0.2126 + mapChannels[1] * 0.7152 + mapChannels[2] * 0.0722;
        mapMin = lo; mapMax = hi;
      }
      // material.color is authored in sRGB and three decodes it into linear
      const c = m.color;
      const colLinear = [c.r, c.g, c.b];
      const colLum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
      const productChannels = mapChannels
        ? [mapChannels[0] * c.r, mapChannels[1] * c.g, mapChannels[2] * c.b]
        : colLinear;
      const product = productChannels[0] * 0.2126 + productChannels[1] * 0.7152
        + productChannels[2] * 0.0722;
      // How much of this surface's read is hue rather than value? Max channel
      // over min channel, on the product: 1.0 is neutral, >1.4 is a colour cue.
      const chroma = Math.max(...productChannels) / Math.max(1e-6, Math.min(...productChannels));
      rows.push({
        name, hasMap: !!map, mapMean, mapMin, mapMax, mapChannels,
        colorHex: c.getHexString(), colLum, product, productChannels, chroma,
        repeat: map ? [map.repeat.x, map.repeat.y] : null,
        emissive: m.emissive ? m.emissive.getHexString() : null,
        emissiveIntensity: m.emissiveIntensity ?? null,
        roughness: m.roughness ?? null, metalness: m.metalness ?? null,
        type: m.type,
      });
    }
    return rows;
  }, WANT);

  const f = (v, n = 4) => (v == null ? '  --  ' : v.toFixed(n));
  out.sort((a, b) => (b.product || 0) - (a.product || 0));
  console.log('material          map mean   colour     PRODUCT   chroma  repeat   emissive');
  for (const r of out) {
    console.log(
      `${r.name.padEnd(16)} ${f(r.mapMean).padStart(8)}  #${r.colorHex}  ${f(r.product).padStart(8)}`
      + `  ${f(r.chroma, 2).padStart(5)}  ${(r.repeat ? r.repeat.join('x') : '-').padStart(6)}`
      + `  ${r.emissive && r.emissive !== '000000' ? `#${r.emissive}@${r.emissiveIntensity}` : ''}`);
  }
  console.log('\nnote: PRODUCT is linear albedo as the shader samples it.');
  console.log('anything the player walks up to lives near 0.03-0.05 or the lantern clips it.');
  console.log('chroma > ~1.4 means the surface is carrying its read in hue.');
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
  writeFileSync(resultsPath('albedo.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close();
  server.stop();
}
