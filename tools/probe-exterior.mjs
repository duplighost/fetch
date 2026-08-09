// Corrected-FOV, real-GPU composition probe for the graveyard and forest.
// Saves WebGL canvas readbacks (never page.screenshot), including both optional
// skull-line pockets and the ordinary combat/navigation views between them.
//   node tools/probe-exterior.mjs [output-directory]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const outDir = resolve(process.argv[2] || 'scratch-exterior-final');
mkdirSync(outDir, { recursive: true });
const server = await ensureServer();
const browser = await launchBrowser();

try {
  const { page, errors } = await openPage(
    browser,
    `${URL_BASE}/?test=1&mute=1`,
    { width: 1440, height: 900 },
  );
  await page.waitForFunction(
    () => window.__FETCH?.ready === true
      && window.__game?.forest?.optionalRopes?.length === 2
      && window.__game?.graveyardVisualLayout,
    null,
    { timeout: 60000, polling: 100 },
  );

  const result = await page.evaluate(() => {
    const g = window.__game;
    const F = window.__FETCH;
    const forest = g.forest;
    const frames = {};
    const vistas = [];
    const profiles = {};

    const renderFrame = () => {
      // Manual test-mode renders occur between RAF callbacks. Neutralize stale
      // shake/FOV state so every frame represents the live 71-degree camera.
      g._lastShakeDt = 1 / 60;
      g.fovKick = 0;
      g._shake = 0;
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.render();
    };
    const setPose = (p, target, act = g.act) => {
      if (act === 'forest') forest.reseat(p.x, p.z);
      const ground = act === 'forest'
        ? forest.heightAt(p.x, p.z)
        : g.world.groundHeightAt(p.x, p.z, 12);
      g.player.pos.set(p.x, Number.isFinite(ground) ? ground : (p.y || 0), p.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.frozen = false;
      g.player.movementLocked = false;
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const eyeY = g.player.pos.y + 1.62;
      const targetY = target.y ?? eyeY;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.15, Math.min(1.15,
        Math.atan2(targetY - eyeY, Math.hypot(dx, dz))));
      g.player._sync(0);
      g.enemies.clear();
    };
    const forestPoint = (s, lat = 0, y = null) => {
      const p = forest.posAt(s, lat);
      p.y = y == null ? forest.heightAt(p.x, p.z) : y;
      return p;
    };
    const landmark = (id) => forest.landmarks.find((item) => item.id === id);
    const line = (id) => forest.optionalRopes.find((item) => item.id === id);
    const profileRender = () => {
      const counts = new Map();
      const restore = [];
      g.scene.traverse((object) => {
        if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite)) return;
        const before = object.onBeforeRender;
        object.onBeforeRender = function (...args) {
          let top = object;
          while (top.parent && top.parent !== g.scene) top = top.parent;
          const key = `${top.name || top.type || 'unnamed'} :: ${object.name || object.type || 'unnamed'}`;
          counts.set(key, (counts.get(key) || 0) + 1);
          return before.apply(this, args);
        };
        restore.push(() => { object.onBeforeRender = before; });
      });
      renderFrame();
      for (const fn of restore) fn();
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    };
    const capture = (name, note) => {
      for (let i = 0; i < 5; i++) renderFrame();
      frames[name] = g.renderer.domElement.toDataURL('image/png');
      const ray = g._ray;
      const oldMask = ray.layers.mask;
      ray.layers.set(0); // exclude the held skull and hands from shell clearance
      const origin = g.camera.getWorldPosition(g.player.pos.clone());
      const direction = g.camera.getWorldDirection(g.player.pos.clone());
      ray.set(origin, direction);
      ray.near = 0.02;
      ray.far = 40;
      const forwardHit = ray.intersectObjects(g.scene.children, true).find((hit) => {
        let object = hit.object;
        while (object && object !== g.scene) {
          if (!object.visible) return false;
          object = object.parent;
        }
        return hit.object.material?.visible !== false;
      });
      ray.layers.mask = oldMask;
      const projection = g.act === 'forest'
        ? forest.project(g.player.pos.x, g.player.pos.z)
        : null;
      vistas.push({
        name,
        note,
        act: g.act,
        pos: [g.player.pos.x, g.player.pos.y, g.player.pos.z].map((v) => +v.toFixed(3)),
        camera: { fov: g.camera.fov, near: g.camera.near, far: g.camera.far },
        route: projection ? {
          s: +projection.s.toFixed(3),
          lat: +projection.lat.toFixed(3),
          width: +forest.halfW[projection.i].toFixed(3),
          inwardClearance: +(forest.halfW[projection.i] - Math.abs(projection.lat)).toFixed(3),
        } : null,
        forwardHit: forwardHit ? {
          distance: +forwardHit.distance.toFixed(3),
          object: forwardHit.object.name || forwardHit.object.parent?.name || forwardHit.object.type,
        } : null,
        render: { ...g.lastRender },
      });
      if (g.lastRender.drawCalls >= 450) profiles[name] = profileRender();
    };

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.25, {}, false);
    g.enemies.clear();
    setPose({ x: -7.8, z: 8.55 }, { x: 1.8, y: 1.45, z: 39.8 }, 'graveyard');
    capture('00-graveyard-arrival', 'funeral walk, stone rows, and gate share one readable axis');
    setPose({ x: -3.7, z: 12.7 }, { x: -8.9, y: 1.05, z: 14.15 }, 'graveyard');
    capture('01-wrecked-wagon', 'crumpled wreck, open door, interior, glass, and ejected belongings');
    setPose({ x: -3.0, z: 18.0 }, { x: 0.2, y: 0.35, z: 22.4 }, 'graveyard');
    capture('02-dragged-bodies', 'directional drag marks and bodies point the route toward the shut gate');
    setPose({ x: 1.7, z: 26.3 }, { x: 15.6, y: 1.45, z: 31.5 }, 'graveyard');
    capture('03-combat-mausoleum', 'central combat loop retains a strong open mausoleum landmark');
    setPose({ x: 10.2, z: 16.4 }, { x: 13.3, y: 1.05, z: 22.7 }, 'graveyard');
    capture('04-stone-families', 'varied stone silhouettes, mounds, grass, and the outer mourning figure');
    setPose({ x: 2.0, z: 34.1 }, { x: 2.0, y: 1.45, z: 42.0 }, 'graveyard');
    capture('05-forest-gate', 'lantern rationing and pale gate silhouette close the graveyard route');

    F.teleport('forest');
    F.stepWith(0.2, {}, false);
    g.enemies.clear();
    setPose(forestPoint(10), { ...landmark('split-gate').pos, y: 4.5 }, 'forest');
    capture('06-split-gate', 'the first landmark breaks the corridor into a remembered opening chapter');

    const search = line('searchers-line');
    setPose(search.start, search.pivot, 'forest');
    capture('07-searchers-line-approach', 'pale knot is readable from the ordinary route without text or hue');
    setPose(forestPoint(search.centerS - 2.2, search.side * 3.55),
      { ...search.secretPos, y: search.secretPos.y + 0.55 }, 'forest');
    capture('08-searchers-blind', 'optional pocket rewards the swing with an abandoned search camp');

    setPose(forestPoint(82), { ...landmark('lightning-snag').pos, y: 6.2 }, 'forest');
    capture('09-lightning-snag', 'high-value broken snag foreshadows the ravine without a HUD cue');
    setPose(forestPoint(115), { ...landmark('old-waystones').pos, y: 1.55 }, 'forest');
    capture('10-old-waystones', 'post-ravine stones make the far side spatially distinct');
    setPose(forestPoint(141), { ...landmark('arena-ring').pos, y: 2.0 }, 'forest');
    capture('11-arena-ring', 'standing stones compose the mandatory combat clearing while preserving its lanes');

    const bell = line('bell-line');
    setPose(bell.start, bell.pivot, 'forest');
    capture('12-bell-line-approach', 'second repeatable knot is a different-side read late in the run');
    setPose(forestPoint(bell.centerS - 2.0, bell.side * 3.55),
      { ...bell.secretPos, y: bell.secretPos.y + 0.8 }, 'forest');
    capture('13-bell-copse', 'marker stones and bell face back toward the house');
    setPose(forestPoint(187), { ...landmark('crooked-exit').pos, y: 4.3 }, 'forest');
    capture('14-crooked-exit', 'last arch frames the sincere clearing without foreshadowing the twist');

    const sideFrom = forestPoint(163, 0);
    const sideTarget = forestPoint(163, -(forest.halfW[163] + 4.3), 2.3);
    setPose(sideFrom, sideTarget, 'forest');
    capture('15-sealed-side-belt', 'eye-level side view proves no open-space void between regular trunks');
    setPose(forestPoint(163, 0), forestPoint(163.5, 0, 8.6), 'forest');
    capture('16-layered-canopy', 'overhead closure has layered leaf edges instead of a near-plane polygon lid');

    F.teleport('clearing');
    F.stepWith(0.2, {}, false);
    const C = g.clearingCenter;
    setPose({ x: C.x - 11.5, z: C.z + 3.0 },
      { x: C.x, y: 8.2, z: C.z + 19.7 }, 'clearing');
    capture('17-waterfall-cascade', 'rock crowns and buttresses hide every authored curtain seam');

    const gl = g.renderer.getContext();
    return {
      frames,
      vistas,
      browserRenderer: gl.getParameter(gl.RENDERER),
      maxDrawCalls: Math.max(...vistas.map((vista) => vista.render.drawCalls)),
      maxTriangles: Math.max(...vistas.map((vista) => vista.render.triangles)),
      forestStats: forest.floraStats,
      graveyardLayout: g.graveyardVisualLayout,
      profiles,
    };
  });

  for (const [name, dataUrl] of Object.entries(result.frames)) {
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  delete result.frames;
  result.browserErrors = errors;
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = errors.length || result.maxDrawCalls >= 450 ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
