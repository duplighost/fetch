// Reports the exact visible light set that drives Three.js program keys in each
// district. System Chrome/D3D11 is used so the result describes the shipping
// renderer rather than a static guess from scene ownership.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1&warmup=1`);
  await page.waitForFunction(() => window.__FETCH?.ready && window.__game?.renderer,
    null, { timeout: 90000, polling: 100 });
  await page.evaluate(() => window.__FETCH.start());
  await page.evaluate(() => { window.__game._selfStep = false; });
  await page.waitForFunction(() => window.__game.shaderWarmup?.status === 'ready',
    null, { timeout: 90000, polling: 25 });
  for (const act of ['house', 'graveyard', 'ossuary', 'forest', 'clearing', 'cave', 'mirror']) {
    const result = await page.evaluate(async (nextAct) => {
      const g = window.__game, F = window.__FETCH;
      const before = {
        programs: g.renderer.info.programs?.length || 0,
        textures: g.renderer.info.memory.textures,
      };
      if (nextAct === 'cave' && !g.flags.has('waterfallTaken')) {
        g.director.waterfallTaken();
        g.skull.vanish();
      }
      if (nextAct === 'mirror') g.el.fade.style.opacity = '1';
      if (nextAct === 'ossuary') {
        const ossuary = g.ossuary;
        ossuary.unlock('light-variant-audit');
        g.enemies.clear();
        g.skull.holdNow();
        const connector = ossuary.entranceConnector;
        g.player.pos.set(
          g.ritualMausoleum.x,
          ossuary.origin.floor + 0.34,
          connector.portalZ + 0.08,
        );
        g.player.vel.set(0, 0, 0);
        g.player.fallV = 0;
        g.player.grounded = true;
        g.player._sync(0);
        F.stepWith(1 / 120, {}, false);
        if (!ossuary.inOssuary) throw new Error('physical ossuary entry did not cross');
      } else {
        F.teleport(nextAct);
        F.stepWith(0.05, {}, false);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const worldLights = [];
      const heldLights = [];
      g.scene.traverseVisible((object) => {
        if (!object.isLight) return;
        const light = {
          id: object.id,
          name: object.name || object.parent?.name || object.type,
          type: object.type,
          intensity: object.intensity,
          layers: object.layers.mask,
        };
        // Physical world camera renders WORLD(0) plus MAIN_ONLY(1). The latter
        // owns Finale's three zero-energy point slots; reflection cameras omit
        // it because the exact head supplies those same three slots instead.
        if ((object.layers.mask & 3) !== 0) worldLights.push(light);
        // mirrors.js exports LAYER_HELD as layer index 2, so the mask bit is 4.
        if ((object.layers.mask & 4) !== 0) heldLights.push(light);
      });
      const result = {
        requestedAct: nextAct,
        act: g.act,
        inOssuary: !!g.ossuary?.inOssuary,
        before,
        after: {
          programs: g.renderer.info.programs?.length || 0,
          textures: g.renderer.info.memory.textures,
        },
        worldLights,
        heldLights,
        worldTypes: Object.fromEntries(Object.entries(worldLights.reduce((out, light) => {
          out[light.type] = (out[light.type] || 0) + 1;
          return out;
        }, {})).sort()),
        heldTypes: Object.fromEntries(Object.entries(heldLights.reduce((out, light) => {
          out[light.type] = (out[light.type] || 0) + 1;
          return out;
        }, {})).sort()),
      };
      if (nextAct === 'ossuary') {
        g.ossuary.inOssuary = false;
        F.stepWith(0.03, {}, false);
      }
      return result;
    }, act);
    console.log(`\n${act}: ${result.worldLights.length} world + ${result.heldLights.length} held lights`, {
      renderedAct: result.act,
      physicalOssuary: result.inOssuary,
      programDelta: result.after.programs - result.before.programs,
      textureDelta: result.after.textures - result.before.textures,
      worldTypes: result.worldTypes,
      heldTypes: result.heldTypes,
    });
    console.log('world layer');
    console.table(result.worldLights);
    console.log('held layer');
    console.table(result.heldLights);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
