import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('scratch-hands', { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });
  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('mirror');
    F.stepWith(3.0, {}, false);
    const shots = [];
    for (let i = 0; i < 3; i++) {
      F.stepWith(2.5, {}, false);
      g.render();
      shots.push(g.renderer.domElement.toDataURL('image/png'));
    }
    return { shots, act: g.act };
  });
  out.shots.forEach((png, i) => {
    const f = `scratch-hands/mirror-${i}.png`;
    writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
    console.log('wrote', f);
  });
  console.log('act', out.act, errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : '(clean)');
} finally { await browser.close().catch(() => {}); server.stop(); }
