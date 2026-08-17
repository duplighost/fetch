// PAST THE WOODS. "walking too far past it brings you to nothingness... we
// don't want them seeing the end of the world either." Seven poses a player
// actually takes in the clearing, plus the erupting kin and the far streams.
// Open the PNGs and LOOK — that is the project law, and every wrong call in
// this repo came from reasoning about a frame instead of opening it.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'scratch-falls';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('clearing');
    F.stepWith(1.0, {}, false);
    g.skull.holdNow();
    F.stepWith(0.3, {}, false);
    const C = g.clearingCenter;
    const shots = [];
    const look = (px, pz, tx, ty, tz) => {
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3), pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
      g.player._sync(0);
    };
    const shoot = async (name) => {
      F.stepWith(0.2, {}, false);
      g.render();
      shots.push({ name, png: g.renderer.domElement.toDataURL('image/png') });
    };

    look(C.x, C.z - 12, C.x, 3, C.z + 18);
    await shoot('01-into-the-field');
    look(C.x - 6, C.z + 3, C.x - 13.5, 2.2, C.z + 12.4);
    await shoot('02-the-path-to-the-wheel');
    look(C.x + 6, C.z + 3, C.x + 13.5, 2.2, C.z + 12.4);
    await shoot('03-the-path-to-the-gong');
    look(C.x - 13.5, C.z + 9.6, C.x - 34, 6, C.z + 9.6);
    await shoot('04-past-the-wheel-outward');
    look(C.x + 13.5, C.z + 9.4, C.x + 34, 6, C.z + 9.4);
    await shoot('05-past-the-gong-outward');
    look(C.x, C.z + 2, C.x, 4, C.z - 30);
    await shoot('06-back-the-way-you-came');
    // the stream, seen through the trunks from the wheel path
    look(C.x - 17, C.z + 2, C.x - 24, 0.4, C.z + 2);
    await shoot('07-the-far-stream');

    // and one of the kin, met head on
    const site = g.fallsField.kinSites[0];
    g.player.pos.set(site.x, g.world.groundHeightAt(site.x, site.z + 7, 3), site.z + 7);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    for (let i = 0; i < 40; i++) F.stepWith(0.1, {}, false);
    look(site.x, site.z + 4.2, site.x, 1.9, site.z);
    await shoot('08-something-came-up');
    // control frame: same pose with the kin hidden, so "is that pale thing
    // mine?" is answered by a diff and not by squinting
    g.fallsField.kin.visible = false;
    g.fallsField.eyes.visible = false;
    await shoot('09-control-kin-hidden');
    g.fallsField.kin.visible = true;
    g.fallsField.eyes.visible = true;

    return {
      shots,
      state: {
        draws: g.lastRender ? g.lastRender.drawCalls : null,
        kin: g.fallsField.kinSites.map((k) => ({ state: k.state, rise: +k.rise.toFixed(2) })),
        C: [+C.x.toFixed(1), +C.z.toFixed(1)],
      },
    };
  });
  for (const s of out.shots) {
    writeFileSync(join(outDir, `${s.name}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
  }
  console.log('wrote', out.shots.length, 'shots to', outDir);
  console.log(JSON.stringify(out.state, null, 1));
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : '(clean)');
} finally {
  await browser.close();
  server.stop();
}
