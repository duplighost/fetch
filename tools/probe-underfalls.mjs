// Real-GPU visual/performance probe for the waterfall and underfalls district.
// Saves WebGL canvas readbacks (never page.screenshot) and reports per-vista
// render calls so an attractive cave cannot quietly blow the shared budget.
//   node tools/probe-underfalls.mjs [output-directory]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const outDir = resolve(process.argv[2] || 'scratch-underfalls');
mkdirSync(outDir, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();

try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`, { width: 1440, height: 900 });
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 60000, polling: 100 });

  const result = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH, U = g.underfalls, L = U.layout;
    const frames = {};
    const vistas = [];
    const breakdown = {};
    const profiles = {};
    const renderFrame = () => {
      // Manual test-mode renders happen between RAF callbacks. Reusing a stale
      // negative RAF delta makes the cosmetic FOV decay run backwards and can
      // manufacture a fisheye that never occurs in live play.
      g._lastShakeDt = 1 / 60;
      g.render();
    };
    const lookFrom = (p, target, lift = 0) => {
      const y = g.world.groundHeightAt(p.x, p.z, 12);
      g.player.pos.set(p.x, y, p.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      const dx = target.x - p.x, dz = target.z - p.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.15, Math.min(1.15,
        Math.atan2((target.y ?? y + 1.3) - (y + 1.62 + lift), Math.hypot(dx, dz))));
      g.fovKick = 0;
      g._shake = 0;
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.player._sync(0);
    };
    const profileRender = () => {
      const counts = new Map();
      const restore = [];
      g.scene.traverse((o) => {
        if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
        const before = o.onBeforeRender;
        o.onBeforeRender = function (...args) {
          let top = o;
          while (top.parent && top.parent !== g.scene) top = top.parent;
          const topName = top.name || top.type || 'unnamed';
          const objectName = o.name || o.type || 'unnamed';
          const key = `${topName} :: ${objectName}`;
          counts.set(key, (counts.get(key) || 0) + 1);
          return before.apply(this, args);
        };
        restore.push(() => { o.onBeforeRender = before; });
      });
      renderFrame();
      for (const fn of restore) fn();
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    };
    const capture = (name) => {
      // Settle viewmodel transforms, instanced bounds, and the frozen moon
      // shadow before reading the preserved WebGL backbuffer.
      for (let i = 0; i < 5; i++) renderFrame();
      frames[name] = g.renderer.domElement.toDataURL('image/png');
      const ray = g._ray;
      const origin = g.camera.getWorldPosition(g.player.pos.clone());
      const direction = g.camera.getWorldDirection(g.player.pos.clone());
      ray.set(origin, direction);
      ray.near = 0.02;
      ray.far = 24;
      const forwardHit = ray.intersectObjects(g.scene.children, true).find((hit) => {
        let object = hit.object;
        while (object && object !== g.scene) {
          if (!object.visible) return false;
          object = object.parent;
        }
        return hit.object.material?.visible !== false && hit.object.layers.test(g.camera.layers);
      });
      vistas.push({
        name,
        act: g.act,
        pos: [+g.player.pos.x.toFixed(2), +g.player.pos.y.toFixed(2), +g.player.pos.z.toFixed(2)],
        camera: {
          fov: g.camera.fov,
          near: g.camera.near,
          far: g.camera.far,
          projection: g.camera.projectionMatrix.elements.map((v) => +v.toFixed(5)),
        },
        forwardHit: forwardHit ? {
          distance: +forwardHit.distance.toFixed(3),
          object: forwardHit.object.name || forwardHit.object.parent?.name || forwardHit.object.type,
          point: [forwardHit.point.x, forwardHit.point.y, forwardHit.point.z].map((v) => +v.toFixed(2)),
        } : null,
        render: { ...g.lastRender },
      });
      if (g.lastRender.drawCalls >= 450) profiles[name] = profileRender();
    };
    const measureWithHidden = (name, object) => {
      if (!object) return;
      const visible = object.visible;
      object.visible = false;
      renderFrame();
      renderFrame();
      breakdown[name] = { ...g.lastRender };
      object.visible = visible;
    };

    F.start();
    F.teleport('clearing');
    const C = g.clearingCenter;
    lookFrom({ x: C.x - 11.5, z: C.z + 3.0 }, { x: C.x, y: 8.2, z: C.z + 19.7 });
    F.stepWith(0.25, {}, false);
    capture('00-waterfall-cascade');

    const target = g.world.fetchTargets.find((q) => q.id === 'waterfall');
    const directive = target?.enabled ? target.onHit.call(target, g.skull, target.pos, {}) : null;
    if (directive === 'gone') g.skull.vanish();
    F.stepWith(8, {}, false);
    F.teleport('cave');
    F.stepWith(0.35, {}, false);
    lookFrom({ x: L.entrance.x, z: L.entrance.z + 1.4 },
      { x: L.named['intake apse'].x, y: 1.65, z: L.named['intake apse'].z });
    capture('01-stone-veil-throat');

    lookFrom({ x: L.named['chapel west aisle'].x, z: L.named['chapel west aisle'].z },
      { x: U.pump.position.x, y: 2.15, z: U.pump.position.z });
    F.stepWith(0.6, {}, false);
    capture('02-drowned-pump-chapel');

    lookFrom({ x: L.lowerSluice.x, z: L.lowerSluice.z - 1.4 },
      { x: L.upperSluice.x, y: L.upperSluice.y + 1.8, z: L.upperSluice.z });
    F.stepWith(0.35, {}, false);
    capture('03-vertical-sluice');
    breakdown.repeated = [];
    for (let i = 0; i < 16; i++) {
      renderFrame();
      breakdown.repeated.push({ ...g.lastRender });
    }
    breakdown.shadowState = {
      rendererNeedsUpdate: g.renderer.shadowMap.needsUpdate,
      rendererAutoUpdate: g.renderer.shadowMap.autoUpdate,
      moonAutoUpdate: g.world.moon?.shadow?.autoUpdate,
      finaleActive: g.finale?.active,
      houseMirrorActive: g.houseMirror?.active,
    };
    measureWithHidden('without-atmosphere', g.atmosphere?.group);
    measureWithHidden('without-pump', U.pump?.group);
    measureWithHidden('without-sluice', U.sluice?.group);
    measureWithHidden('without-secret', U.secret?.group);
    measureWithHidden('without-displacement', U.displacement?.root);
    measureWithHidden('without-hatch', U.hatch?.group);
    const enemyMeshes = (g.enemies?.list || []).map((e) => e.mesh).filter(Boolean);
    const enemyVisibility = enemyMeshes.map((mesh) => mesh.visible);
    for (const mesh of enemyMeshes) mesh.visible = false;
    renderFrame();
    renderFrame();
    breakdown['without-enemies'] = { ...g.lastRender };
    enemyMeshes.forEach((mesh, i) => { mesh.visible = enemyVisibility[i]; });
    renderFrame();

    lookFrom({ x: L.overflow.x, z: L.overflow.z + 0.5 },
      { x: L.sluiceRise.x, y: L.sluiceRise.y + 0.7, z: L.sluiceRise.z });
    F.stepWith(0.35, {}, false);
    capture('04-overflow-lookback');

    lookFrom({ x: L.bellCistern.x - 2.35, z: L.bellCistern.z - 1.75 },
      { x: L.bellCistern.x, y: L.bellCistern.y + 2.15, z: L.bellCistern.z });
    F.stepWith(0.35, {}, false);
    capture('05-bell-cistern-secret');

    lookFrom({ x: L.hatch.x - 1.8, z: L.hatch.z - 1.8 },
      { x: L.hatch.x, y: 3.75, z: L.hatch.z });
    F.stepWith(0.35, {}, false);
    capture('06-hatch-cistern');

    const scene = { meshes: 0, instanced: 0, points: 0, castShadow: 0, visible: 0 };
    g.scene.traverse((o) => {
      if (!o.visible) return;
      scene.visible++;
      if (o.isMesh) scene.meshes++;
      if (o.isInstancedMesh) scene.instanced++;
      if (o.isPoints) scene.points++;
      if (o.castShadow) scene.castShadow++;
    });
    return {
      frames,
      vistas,
      browserRenderer: g.renderer.getContext().getParameter(g.renderer.getContext().RENDERER),
      layout: {
        mainLength: L.mainLength,
        secretLength: L.secretLength,
        mainNodes: L.main.length,
        chambers: L.chambers.map((c) => c.name),
      },
      state: {
        waterfallTaken: g.flags.has('waterfallTaken'),
        secretDiscovered: U.secret.discovered,
        veilSeal: U.veilSeal?.progress ?? null,
      },
      scene,
      breakdown,
      profiles,
    };
  });

  for (const [name, dataUrl] of Object.entries(result.frames)) {
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  delete result.frames;
  result.browserErrors = errors;
  result.maxDrawCalls = Math.max(...result.vistas.map((v) => v.render.drawCalls));
  result.maxTriangles = Math.max(...result.vistas.map((v) => v.render.triangles));
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = errors.length || result.maxDrawCalls >= 450 ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
