// shot-shore.mjs -- the shore, from the places he stood.
//
// Round five, notes 2 and 3. His screenshot was taken from the centre stream
// looking left, and it showed two clusters of pale grey blocks standing in the
// open field: the "raised bank masses" whose maths lost CLEARING_BASIN.centerZ.
// They belong at the water. These are the poses that prove it — the vantage
// that showed them, the lip they became, the bar across the crossing, and the
// stream's own new ending.
//
// OPEN THE PNGs AND LOOK. Every wrong call in this repo came from reasoning
// about a frame instead of opening it, and "it reads" is not a number: the
// lantern is 91% of what any near prop is lit by, so a pale mass two metres
// from it blows to white and stops being rock.
//
//   node tools/shot-shore.mjs [--thawed]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const THAWED = process.argv.includes('--thawed');
const outDir = 'scratch-shore';
mkdirSync(outDir, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async (thawed) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('clearing');
    F.stepWith(1.0, {}, false);
    g.skull.holdNow();
    F.stepWith(0.3, {}, false);
    if (thawed) {
      g.flag('fallsThawed');            // the ice comes down before the bargain
      F.stepWith(0.3, {}, false);
      g.director.waterfallTaken();
      for (let t = 0; t < 12; t += 0.1) F.stepWith(0.1, {}, false);
    }
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
    // "It reads" is not a number. Measure the near band of every frame: a
    // stone lit by the lantern from two metres has to stay STONE, and clipping
    // to white is how rock stops being rock (the round-four kin lesson, and
    // the standing note about trunks at the far streams).
    const measure = () => {
      const canvas = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 100;
      const ctx = cv.getContext('2d');
      ctx.drawImage(canvas, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0, max = 0, clipped = 0, n = 0;
      for (let y = Math.floor(cv.height * 0.55); y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
          sum += v; n++;
          if (v > max) max = v;
          if (v > 232) clipped++;
        }
      }
      return { mean: +(sum / n).toFixed(1), max: Math.round(max), clippedPct: +(100 * clipped / n).toFixed(2) };
    };
    const shoot = async (name) => {
      F.stepWith(0.2, {}, false);
      g.render();
      shots.push({ name, png: g.renderer.domElement.toDataURL('image/png'), band: measure() });
    };

    // 1. HIS VANTAGE: standing in the centre stream, looking left. This is the
    //    frame the grey blocks were in. They must be gone from it.
    look(C.x - 4, C.z + 2, C.x - 14, 1.2, C.z - 4);
    await shoot('01-his-vantage-looking-left');

    // 2. The same stand, looking SOUTH down the stream: the water must END in
    //    something instead of ceasing.
    look(C.x - 4, C.z + 2, C.x - 7.5, 0.2, C.z - 13);
    await shoot('02-the-stream-runs-south');

    // 3. Standing at the pond it now ends in.
    look(C.x - 5.4, C.z - 7.6, C.x - 7.1, 0.1, C.z - 13.2);
    await shoot('03-the-pond-it-ends-in');

    // 4. The approach to the crossing: the lip either side, the bar across it.
    look(C.x, C.z + 1.5, C.x, 1.0, C.z + 12);
    await shoot('04-the-crossing-approach');

    // 5. At the bar itself, close enough for the lantern to be most of the light.
    look(C.x + 0.4, C.z + 4.6, C.x + 0.2, 0.3, C.z + 7.4);
    await shoot('05-the-bar-under-the-lantern');

    // 5b. WHO OWNS THOSE PIXELS? Hide one thing at a time from the same pose
    //     and read the near band back. Reasoning about a frame is how this
    //     project gets things wrong; this asks the frame instead.
    const attribution = {};
    {
      const byName = (name) => {
        let found = null;
        g.scene.traverse((o) => { if (!found && o.name === name) found = o; });
        return found;
      };
      const talus = byName('waterfall talus and basin rim');
      const sill = g.basinSill?.mesh;
      const base = measure();
      const test = (label, object) => {
        if (!object) { attribution[label] = 'not found'; return; }
        const was = object.visible;
        object.visible = false;
        g.render();
        const m = measure();
        object.visible = was;
        attribution[label] = `mean ${base.mean} -> ${m.mean}`;
      };
      test('the talus/lip instances', talus);
      test('the sill', sill);
      g.render();
    }

    // 6. The lip along the east shore, from the walk to the locket.
    look(C.x + 11.5, C.z + 14.5, C.x + 4, 0.4, C.z + 15.2);
    await shoot('06-the-east-lip');

    // 7. And the west shore, wide, so the ring reads as a shore and not a wall.
    look(C.x - 15, C.z + 6, C.x - 2, 1.0, C.z + 15);
    await shoot('07-the-shore-wide');

    return {
      shots,
      attribution,
      draws: g.lastRender.drawCalls,
      geometries: g.renderer.info.memory.geometries,
      sill: {
        y: +g.basinSill.mesh.position.y.toFixed(2),
        home: +g.basinSill.homeY.toFixed(2),
        barred: g.basinSill.collider.max.y > g.basinSill.collider.min.y,
      },
    };
  }, THAWED);

  for (const s of out.shots) {
    const file = join(outDir, `${THAWED ? 'thawed-' : ''}${s.name}.png`);
    writeFileSync(file, Buffer.from(s.png.split(',')[1], 'base64'));
    console.log(`wrote ${file}   near band: mean ${s.band.mean}, max ${s.band.max}, clipped ${s.band.clippedPct}%`);
  }
  console.log(`draws ${out.draws}, geometries ${out.geometries}, sill ${JSON.stringify(out.sill)}`);
  console.log('near-band attribution at pose 05:', JSON.stringify(out.attribution, null, 1));
  if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 5).join('\n  '));
} finally {
  await browser.close();
  server.stop();
}
