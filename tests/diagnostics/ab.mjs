// A/B the reported black screen across two built copies of the game.
// Serves each root with the repo's own serve.mjs, boots it the way a PLAYER
// does (no ?test=1), renders real frames, and reads the framebuffer back.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { launchBrowser, openPage, ROOT } from './lib/harness.mjs';

const roots = process.argv.slice(2); // label=path pairs
const browser = await launchBrowser();

for (const spec of roots) {
  const [label, root] = spec.split('=');
  const port = 9700 + Math.floor(Math.random() * 200);
  const proc = spawn(process.execPath, ['C:/Users/Alex/Projects/qualiacology/build/scripts/static-server.mjs', `--root=${root}`, `--port=${port}`], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));

  const url = `http://localhost:${port}/fetch/`;
  const { page, errors } = await openPage(browser, url, { quiet: true });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 }).catch(() => {});

  // Start exactly as a player: click the title button.
  await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());
  await page.waitForTimeout(2000);
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => { try { window.__game?.render?.(); } catch {} });
    await page.waitForTimeout(40);
  }

  const out = await page.evaluate(() => {
    const g = window.__game, r = g?.renderer, c = r?.domElement;
    let px = null;
    try {
      g?.render?.();
      const o = document.createElement('canvas'); o.width = 160; o.height = 90;
      const cx = o.getContext('2d'); cx.drawImage(c, 0, 0, o.width, o.height);
      const d = cx.getImageData(0, 0, o.width, o.height).data;
      let sum = 0, max = 0, nb = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722;
        sum += l; if (l > max) max = l; if (l > 4) nb++;
      }
      px = { meanLuma: +(sum / (d.length / 4)).toFixed(2), maxLuma: +max.toFixed(1), nonBlackPct: +(100 * nb / (d.length / 4)).toFixed(1) };
    } catch (e) { px = { error: String(e) }; }
    return {
      version: (document.documentElement.innerHTML.match(/0\.\d+\.\d+[a-z-]*/) || [])[0] || '?',
      drawCalls: r?.info?.render?.calls, triangles: r?.info?.render?.triangles,
      sceneChildren: g?.scene?.children?.length,
      visibleMeshes: (() => { let n = 0; try { g.scene.traverse(o => { if (o.isMesh && o.visible) n++; }); } catch {} return n; })(),
      camNear: g?.camera?.near, camFar: g?.camera?.far,
      camPos: g?.camera?.position ? [+g.camera.position.x.toFixed(1), +g.camera.position.y.toFixed(1), +g.camera.position.z.toFixed(1)] : null,
      camLayers: g?.camera?.layers?.mask,
      px,
    };
  });

  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(out, null, 1));
  console.log(`errors(${errors.length}): ` + errors.slice(0, 6).join(' | '));

  await page.close();
  proc.kill();
}
await browser.close();
