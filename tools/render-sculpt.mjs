// render-sculpt.mjs — capture the standard skull-off shot set for one sculpt
// module. Renders through tools/sculpt-harness.html on the real GPU (same
// Chrome/ANGLE stack as the gates) and writes PNGs + a report.json.
//   node tools/render-sculpt.mjs <moduleUrlRelativeToToolsPage> <outDir> [label]
// e.g. node tools/render-sculpt.mjs ../src/skull-variant-a.js tests/shots/sculpt-a a
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [mod, outDirArg, label = 'sculpt'] = process.argv.slice(2);
if (!mod || !outDirArg) {
  console.error('usage: node tools/render-sculpt.mjs <moduleUrl> <outDir> [label]');
  process.exit(2);
}
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

// the standard set: identity, silhouette, jaw life, growth, darkness
const SHOTS = [
  ['front', { stage: 0 }],
  ['held', { stage: 0 }],
  ['threeq', { stage: 0 }],
  ['profile', { stage: 0 }],
  ['jaw', { stage: 0, jawOpen: 0.45 }],
  ['front', { stage: 2 }, 'front-s2'],
  ['front', { stage: 3 }, 'front-s3'],
  ['front', { stage: 5 }, 'front-s5'],
  ['front', { stage: 0, dark: true }, 'dark'],
  ['held', { stage: 0, dark: true }, 'held-dark'],
];

const server = await ensureServer();
const browser = await launchBrowser();
let failed = false;
try {
  const url = `${URL_BASE}/tools/sculpt-harness.html?mod=${encodeURIComponent(mod)}`;
  const { page, errors } = await openPage(browser, url, { width: 660, height: 660 });
  await page.waitForFunction(() => window.__H && window.__H.ready === true, null, { timeout: 30000, polling: 100 });

  const buildError = await page.evaluate(() => window.__H.error);
  if (buildError) throw new Error('harness/module error: ' + buildError);

  const info = await page.evaluate(() => window.__H.info());
  for (const [pose, opts, name] of SHOTS) {
    const dataUrl = await page.evaluate(
      ([p, o]) => window.__H.shoot(p, o), [pose, opts]);
    writeFileSync(join(outDir, `${label}-${name || pose}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }

  const report = { label, mod, info, errors, pass: errors.length === 0 && info.tris <= 9000 && Object.values(info.keys).every(Boolean) };
  writeFileSync(join(outDir, `${label}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  failed = !report.pass;
} catch (e) {
  console.error('RENDER FAILED: ' + (e && e.message || e));
  writeFileSync(join(outDir, `${label}-report.json`), JSON.stringify({ label, mod, error: String(e && e.message || e), pass: false }, null, 2));
  failed = true;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
process.exit(failed ? 1 : 0);
