// shot-enemy.mjs -- LOOK at the creatures. docs/STATE-OF-PLAY notes the walker
// was resculpted after Alex's "the visuals of it were simple and pretty lame"
// and that nobody has ever actually rendered it to check. Alex has since said
// "enemy design doesn't look good or scary", so the question is whether the
// sculpt is weak or whether the staging never shows it.
//
// Shot two ways on purpose: lit up close (is the sculpt good?) and at the edge
// of the skull's light where the player really meets it (does it READ?).
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const grab = async (name, fn, arg) => {
  const url = await page.evaluate(fn, arg);
  writeFileSync(`tests/shots/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote tests/shots/' + name + '.png');
};
for (const [kind, dist] of [['walker', 2.6], ['walker', 6.5], ['resident', 3.0], ['kneeler', 3.0]]) {
  await grab(`enemy-${kind}-${String(dist).replace('.', 'p')}m`, ({ kind, dist }) => {
    const g = window.__game, F = window.__FETCH;
    if (!g.started) F.start();
    F.teleport('house'); F.stepWith(0.3, {});
    g.enemies.clear();
    const p = g.player.pos;
    const e = g.enemies.spawn(kind, p.x, p.z - dist, 'stalk');
    e.pos.set(p.x, g.world.groundHeightAt(p.x, p.z - dist, p.y + 2), p.z - dist);
    g.player.yaw = 0; g.player.pitch = 0.02; g.player._sync(0);
    F.stepWith(0.6, {});
    e.pos.set(p.x, e.pos.y, p.z - dist);
    e.mesh.position.copy(e.pos);
    e.mesh.visible = true;
    F.stepWith(1 / 120, {});
    g.render();
    return g.renderer.domElement.toDataURL('image/png');
  }, { kind, dist });
}
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
await browser.close(); server.stop();
