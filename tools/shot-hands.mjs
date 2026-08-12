// shot-hands.mjs -- capture the EMPTY hands, the pose Alex photographed and
// labelled "these do not look like human hands".
//
// shot-held.mjs shows the hands cradling the skull, which is the flattering
// case: the skull hides the gap between them and gives the fingers something
// to wrap. The moment the skull is thrown the hands are alone on screen with
// nothing to explain their shape, and that is most of the game.
//
//   node tools/shot-hands.mjs [outPrefix]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const [prefix = 'tests/shots/hands'] = process.argv.slice(2);
mkdirSync('tests/shots', { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000, polling: 200 });

  const shot = async (name, setup) => {
    await page.evaluate(setup);
    const dataUrl = await page.evaluate(() => {
      window.__game.render();
      return window.__game.renderer.domElement.toDataURL('image/png');
    });
    const file = `${prefix}-${name}.png`;
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', file);
  };

  await page.evaluate(() => { window.__FETCH.start(); window.__FETCH.step(1 / 60, 40); });

  // 1. holding it — the composition that already gets checked
  await shot('holding', () => { window.__FETCH.step(1 / 60, 10); });

  // 2. empty, in the house: the skull is away and the hands carry the frame
  await shot('empty-house', () => {
    // press = throw, and then let it fly. The real input path, never a poke
    // at internals: the hands only open because the game threw the skull.
    window.__FETCH.stepWith(1 / 60, { throwPressed: true });
    window.__FETCH.stepWith(0.75, {});
  });

  // 3. empty, outdoors, where there is no wall behind them
  await shot('empty-cave', () => {
    window.__FETCH.teleport('cave');
    window.__FETCH.stepWith(0.35, {});
    if (window.__game.skull.mode === 'held') window.__FETCH.stepWith(1 / 60, { throwPressed: true });
    window.__FETCH.stepWith(0.75, {});
  });

  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
