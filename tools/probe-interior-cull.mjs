// probe-interior-cull.mjs -- who survives syncHouseInteriorCulling, and why.
//
//   node tools/probe-interior-cull.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(async () => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    F.stepWith(0.2, {}, false);
    const roots = g.houseInteriorRoots || [];
    const inHouse = roots.map((r) => r.visible);
    F.teleport('graveyard');
    F.stepWith(0.05, {}, false);
    const afterOneStep = roots.filter((r) => r.visible).length;
    F.stepWith(0.5, {}, false);
    g.enemies.clear();
    g.render();
    const afterMore = roots.filter((r) => r.visible).length;
    const stragglers = roots.map((r, i) => ({ i, r })).filter(({ r }) => r.visible).slice(0, 12)
      .map(({ i, r }) => ({
        i,
        renderIndex: g.houseRenderRoots.indexOf(r),
        name: r.name || `(unnamed ${r.type})`, type: r.type,
        pos: r.position.toArray().map((v) => +v.toFixed(2)),
        geo: r.geometry?.type, params: r.geometry?.parameters,
        mat: r.material?.type, matName: r.material?.name,
        color: r.material?.color?.getHexString?.(),
        parentIsScene: r.parent === g.scene,
        wasVisibleInHouse: inHouse[i],
        inMap: g.forest.houseInteriorVisibility.has(r),
        children: r.children.length,
        childNames: r.children.slice(0,8).map((c)=>c.name || c.type),
        worldPos: r.getWorldPosition(new (r.position.constructor)()).toArray().map((v)=>+v.toFixed(2)),
      }));
    return {
      total: roots.length,
      visibleInHouse: inHouse.filter(Boolean).length,
      afterOneStep, afterMore,
      cullActive: g.forest.houseInteriorCullActive,
      mapSize: g.forest.houseInteriorVisibility.size,
      act: g.act,
      stragglers,
    };
  });
  console.log(JSON.stringify(out, null, 2));
  console.log('errors:', errors.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
  server.stop();
}
