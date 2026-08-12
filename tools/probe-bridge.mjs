// probe-bridge.mjs -- where exactly is the gap Alex marked "one more stone
// here is needed"? Raises the bridge, then reports every stone's risen top
// alongside the ground either side, so the missing step shows up as a number.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';
const server = await ensureServer();
const browser = await launchBrowser();
const { page } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 60000 });
const r = await page.evaluate(() => {
  const g = window.__game, F = window.__FETCH;
  F.start(); F.teleport('clearing'); F.stepWith(0.5, {});
  const t = g.world.fetchTargets.find(x => x.id === 'waterfall');
  t.enabled = true;
  const p = t.pos;
  F.setSkull(p.x, p.y, p.z, 0, 0, 0, 'outbound');
  F.stepWith(14, {});                      // the rise is staggered 0.7s/stone and takes ~7.6s
  const C = g.clearingCenter;
  const stones = g.bridgeStones.map(s => ({
    z: +(s.position.z - C.z).toFixed(2), y: +s.position.y.toFixed(2),
    x: +(s.position.x - C.x).toFixed(2),
  }));
  const ground = [];
  for (let dz = 4; dz <= 24; dz += 1) {
    ground.push({ dz, y: +g.world.groundHeightAt(C.x, C.z + dz, 6).toFixed(2) });
  }
  g.player.pos.set(C.x, 0.37, C.z + 14.2); g.player.yaw = 0; g.player.pitch = -0.12; g.player._sync(0); F.stepWith(0.1, {}); g.render();
  const shot = g.renderer.domElement.toDataURL('image/png');
  return { shot, stones, ground, barrier: {
    minZ: +(g.waterfallBarrier.min.z - C.z).toFixed(2),
    maxZ: +(g.waterfallBarrier.max.z - C.z).toFixed(2),
    maxY: +g.waterfallBarrier.max.y.toFixed(2),
  }, caveEnd: g.caveEnd ? [+(g.caveEnd.z - C.z).toFixed(2)] : null };
});
await browser.close(); server.stop();
writeFileSync('tests/shots/bridge.png', Buffer.from(r.shot.split(',')[1],'base64'));
console.log('stones (dz from clearing centre, risen y):');
for (const s of r.stones) console.log(`   dz ${String(s.z).padStart(6)}  y ${String(s.y).padStart(6)}  x${String(s.x).padStart(6)}`);
console.log('\nground height along the crossing line:');
for (const gr of r.ground) console.log(`   dz ${String(gr.dz).padStart(3)}  y ${String(gr.y).padStart(7)}`);
console.log('\nbarrier:', JSON.stringify(r.barrier));
