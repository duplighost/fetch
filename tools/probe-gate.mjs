// THE GATE'S ONLY COUNTER. One latch weight lets go per banked key, and at the
// moment the iron gives they are all drawn up flush into the header — because
// the previous pose left three chainless boxes dangling at chest height in the
// walkway forever, which is what Alex walked past and reported.
// Reports: the weight pose after each bank, and the walk band at open.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);
    const gate = g.graveyardGate;
    const pose = () => gate.weights.map((w) => +w.position.y.toFixed(3));
    const chainLen = () => {
      const el = gate.chains.instanceMatrix.array;
      const out = [];
      for (let i = 0; i < 3; i++) out.push(+el[i * 16 + 5].toFixed(3)); // y scale = length
      return out;
    };
    const log = [{ at: 'rest', pose: pose(), chain: chainLen() }];

    for (let n = 0; n < 3; n++) {
      const rec = g.gateKeys.list[n];
      rec.reveal(g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z + 1.2);
      rec.giveToJaw();
      g.gateKeys.sockets[n].bank();
      F.stepWith(1.1, {}, false);
      log.push({ at: `banked ${n + 1}`, banked: g.gateKeys.banked(), pose: pose(), chain: chainLen() });
    }
    F.stepWith(4.0, {}, false);
    log.push({ at: 'open', open: gate.open, pose: pose(), chain: chainLen() });

    // is anything left in the doorway with no collider under it?
    const band = gate.weights.map((w, i) => ({
      i, y: +w.position.y.toFixed(3), inWalkBand: w.position.y - 0.25 < 2.2 && w.position.y + 0.25 > 0.3,
    }));

    // and the header: is it carried now?
    const jambs = g.world.colliders.filter((c) => c.max.y > 2.4 && c.min.z > 41.7 && c.max.z < 42.2
      && c.max.x - c.min.x < 0.3);
    return { log, band, jambs: jambs.length };
  });
  console.log(JSON.stringify(out, null, 1));
  if (errors.length) console.log('BROWSER ERRORS:', errors);
  const bad = out.band.filter((b) => b.inWalkBand);
  console.log(bad.length ? `\nFAIL: ${bad.length} weight(s) in the walkway` : '\nPASS: the walkway is clear');
} finally {
  await browser.close();
  server.stop();
}
