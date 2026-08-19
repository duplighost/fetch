// probe-foyer-freeze.mjs -- reproduce HIS remaining freeze: "in the beginning
// after you unlock the first stairs to the first floor. There is a mirror
// showing a reflection."
//
// The foyer lag-mirror only activates when it has been LOOKED AT from within
// 4.8 m (watched > 0.38 s) and the player is near — which no warm pass and no
// act-tour probe ever does. So its first live render is exactly the round-five
// freeze class with one instance left standing: unwarmed work paid mid-play.
// This walks a warm boot to the mirror, stares at it the way a player does,
// and reads the hitch log. Believe the log, not the theory.
//
//   node tools/probe-foyer-freeze.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1&hitch=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });
// the warm gate, exactly as a patient player gets it
await page.waitForFunction(
  () => ['created', 'ready', 'degraded'].includes(window.__game.shaderWarmup.status),
  null, { timeout: 120000, polling: 100 },
);
await page.evaluate(() => window.__FETCH.start());
await page.waitForFunction(() => window.__game.started === true, null, { timeout: 120000, polling: 50 });
await page.waitForTimeout(1200);

const report = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  g.teleport('house');
  for (let i = 0; i < 30; i++) await frame();
  await wait(300);

  const mirror = g.houseMirror;
  const mirrorPos = mirror?.pos ? { x: mirror.pos.x, y: mirror.pos.y, z: mirror.pos.z } : null;
  const hitchMark = window.__FETCH.hitches().length;
  const before = {
    programs: g.renderer.info.programs.length,
    geometries: g.renderer.info.memory.geometries,
    textures: g.renderer.info.memory.textures,
  };

  // Stand where a player stands coming off the stairs, and LOOK at it.
  const steps = [];
  const lookFrom = async (label, px, pz) => {
    g.player.pos.set(px, g.world.groundHeightAt(px, pz, 2) + 0.05, pz);
    g.player.vel.set(0, 0, 0);
    if (mirrorPos) {
      g.player.yaw = Math.atan2(-(mirrorPos.x - px), -(mirrorPos.z - pz));
      g.player.pitch = 0;
    }
    g.player._sync(0);
    const b = g.renderer.info.programs.length;
    const t0 = performance.now();
    // real frames, so watched accumulates and the pool actually renders
    for (let i = 0; i < 90; i++) await frame();
    await wait(200);
    steps.push({
      label,
      ms: +(performance.now() - t0).toFixed(0),
      awakened: !!mirror?.awakened,
      active: !!mirror?.active,
      linked: g.renderer.info.programs.length - b,
    });
  };

  await lookFrom('far approach (6m)', -3.765 + 6.0, -11.25);
  await lookFrom('stair distance (4m)', -3.765 + 4.0, -11.25);
  await lookFrom('close (2.2m)', -3.765 + 2.2, -11.25);
  // walk past it the way the route does
  for (let i = 0; i < 60; i++) await frame();

  return {
    mirrorPos,
    steps,
    before,
    after: {
      programs: g.renderer.info.programs.length,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
    },
    hitches: window.__FETCH.hitches().slice(hitchMark),
  };
});

await browser.close();
server.stop();

console.log('mirror at', JSON.stringify(report.mirrorPos));
for (const s of report.steps) {
  console.log(`  ${s.label.padEnd(22)} ${String(s.ms).padStart(6)}ms  awakened=${s.awakened} active=${s.active}  +${s.linked} programs`);
}
console.log(`programs ${report.before.programs} -> ${report.after.programs};`
  + ` geometries ${report.before.geometries} -> ${report.after.geometries};`
  + ` textures ${report.before.textures} -> ${report.after.textures}`);
console.log('\nhitches during the approach:');
for (const h of report.hitches) {
  console.log(`  ${String(h.ms).padStart(5)}ms  +${h.programs}p +${h.geometries}g +${h.textures}t  @${h.pos}`);
}
if (!report.hitches.length) console.log('  (none)');
if (errors.length) console.log('\npage errors:\n  ' + errors.slice(0, 5).join('\n  '));
writeFileSync(resultsPath('foyer-freeze.json'), JSON.stringify(report, null, 2));
