// shot-held.mjs — boot the real game with a given ?skull= variant and capture
// the held-viewmodel composition (hands + skull, bedroom light) exactly as the
// player sees it. node tools/shot-held.mjs <variant|default> <outPng>
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const [variant = 'default', out = 'tests/shots/held.png'] = process.argv.slice(2);
const q = variant === 'default' ? '' : `&skull=${variant}`;

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1${q}`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  await page.evaluate(() => { window.__FETCH.start(); return window.__FETCH.step(1 / 60, 40); });
  // look slightly down so the held skull sits well in frame
  const dataUrl = await page.evaluate(() => {
    window.__game.render();
    return window.__game.renderer.domElement.toDataURL('image/png');
  });
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', out, errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
  process.exit(errors.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
