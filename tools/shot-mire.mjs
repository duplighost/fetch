// shot-mire.mjs -- what the near lip of the forest mire actually looks like.
//   node tools/shot-mire.mjs [outDir]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const dir = process.argv[2] || 'shots/mire';
const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.forest, null,
    { timeout: 120000, polling: 200 });
  const shots = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game, f = g.forest;
    const out = {};
    F.start();
    F.teleport('forest');
    F.stepWith(0.2);
    g.flag('treeCleared');
    const rs = f.ravineS();
    const look = (name, s, lat, pitch, aheadS) => {
      const p = f.posAt(s, lat);
      g.player.abortSwing();
      g.player.pos.set(p.x, f.heightAt(p.x, p.z) + 0.05, p.z);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      f.recentre(g.player.pos);
      const a = g.player.pos, b = f.posAt(aheadS, 0);
      g.player.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      g.player.pitch = pitch;
      g.player._sync(0);
      F.stepWith(0.12);
      g.render();
      out[name] = g.renderer.domElement.toDataURL('image/png');
    };
    look('approach', rs - 9, 0, -0.06, rs + 6);     // coming up the trail
    look('lip', rs - 5.2, 0, -0.16, rs + 6);        // at the rail
    look('across', rs - 4.2, 0.8, -0.02, rs + 8);   // the gap and the knot beyond
    out.render = JSON.stringify(g.lastRender);
    return out;
  });
  for (const k of ['approach', 'lip', 'across']) {
    writeFileSync(`${dir}/${k}.png`, Buffer.from(shots[k].split(',')[1], 'base64'));
  }
  console.log('wrote', dir, shots.render, errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
