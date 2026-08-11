// Player-height review plates for the back-half traversal pass.
// These are deterministic live-game poses, including real skull latches and
// a genuine release/catch/rethrow transfer.  Each plate records its render
// cost beside the image so visual approval never hides a performance cliff.
//   node tests/backhalf-visual-plates.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath, shotPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const report = { url: `${URL_BASE}/?test=1&mute=1`, plates: [], browserErrors: [] };
let exit = 0;

try {
  const { page, errors } = await openPage(browser, report.url, { width: 1440, height: 900 });
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready && window.__game?.forest?.canopyChain?.stages?.length === 3,
    null,
    { timeout: 60000, polling: 100 },
  );

  await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    const H = {};
    H.round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
    H.aim = (point) => {
      const dx = point.x - g.player.pos.x, dz = point.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(point.y - (g.player.pos.y + 1.62), Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    H.placeForest = (point) => {
      const f = g.forest;
      g.dead = false;
      g.player.abortSwing();
      f.reseat(point.x, point.z);
      g.player.pos.set(point.x, f.heightAt(point.x, point.z) + 0.025, point.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.frozen = false;
      g.player.movementLocked = false;
      g.player.noise = 0;
      g.player._sync(0);
      g.skull.holdNow();
    };
    H.resetForest = () => {
      F.teleport('forest');
      F.stepWith(0.1, {}, false);
      g.enemies.clear();
      g.director.kneeler = null;
      g.director._kneelerGrace = 999;
      g.flags.delete('kneelerPassed');
    };
    H.resetChain = () => {
      const chain = g.forest.canopyChain;
      g.player.abortSwing();
      g.skull.holdNow();
      chain.progress = 0;
      chain.completed = false;
      for (const stage of chain.stages) {
        g.flags.delete(stage.latchedFlag);
        g.flags.delete(stage.landedFlag);
        stage.target.enabled = stage.index === 0;
      }
      g.flags.delete('forestCanopyCleared');
    };
    H.latch = (stage, max = 1.5) => {
      H.aim(stage.pivot);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true, moveZ: 1, run: true }, false);
      let t = 0;
      while (!g.player.swing && t < max) {
        H.aim(stage.pivot);
        F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
        t += 1 / 120;
      }
      return !!g.player.swing;
    };
    H.airTransfer = (withKneeler = false) => {
      H.resetForest();
      H.resetChain();
      const f = g.forest, chain = f.canopyChain;
      let kneeler = null;
      if (withKneeler) {
        g.director._kneelerGrace = 0;
        f.reseat(chain.startS, 0);
        g.director._placeKneeler();
        kneeler = g.director.kneeler;
      }
      H.placeForest(chain.stages[0].start);
      const first = H.latch(chain.stages[0]);
      let hold = 0;
      while (g.player.swing && hold < 0.82) {
        H.aim(chain.stages[0].landing.clone().setY(g.player.pos.y + 1.62));
        F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
        hold += 1 / 120;
        if (g.player.pos.y > chain.stages[0].landing.y + 1.15 && hold > 0.32) break;
      }
      F.stepWith(1 / 120, { throwReleased: true, throwHeld: false, moveZ: 1, run: true }, false);
      let catchT = 0;
      while (g.skull.mode !== 'held' && catchT < 2.4) {
        H.aim(chain.stages[1].pivot);
        F.stepWith(1 / 120, { moveZ: 1, run: true }, false);
        catchT += 1 / 120;
      }
      const caughtAirborne = g.skull.mode === 'held' && !g.player.grounded;
      if (caughtAirborne) {
        H.aim(chain.stages[1].pivot);
        F.stepWith(1 / 120, { throwPressed: true, throwHeld: true, moveZ: 1, run: true }, false);
      }
      let secondT = 0;
      while (!g.player.swing && g.skull.mode !== 'held' && secondT < 1.4) {
        H.aim(chain.stages[1].pivot);
        F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
        secondT += 1 / 120;
      }
      return {
        first, caughtAirborne,
        second: !!g.player.swing && g.flags.has(chain.stages[1].latchedFlag),
        kneeler,
      };
    };
    H.finish = (proof = {}) => {
      g.render();
      return {
        ...proof,
        act: g.act,
        player: g.player.pos.toArray().map(H.round),
        grounded: g.player.grounded,
        skull: g.skull.mode,
        swing: !!g.player.swing,
        drawCalls: g.lastRender.drawCalls,
        triangles: g.lastRender.triangles,
      };
    };
    H.restorePlateMeshes = [];
    H.setup = (name) => {
      const o = g.ossuary, f = g.forest, chain = f.canopyChain;
      for (const [object, visible] of H.restorePlateMeshes) object.visible = visible;
      H.restorePlateMeshes.length = 0;
      g.skull.root.visible = true;
      g.skull.hold.visible = true;
      if (name === 'ossuary-opened-descent'
        || name === 'ossuary-opened-descent-environment') {
        F.teleport('graveyard');
        g.enemies.clear();
        o.unlock('visual-plates');
        F.stepWith(1.65, {}, false);
        // Ordinary standing height at the opened threshold.  Aim into the
        // first third of the physical descent instead of at its far floor so
        // the capture proves several consecutive tread noses and the downward
        // volume are visible from the player's actual approach.
        const c = o.entranceConnector, x = g.ritualMausoleum.x + 0.38, z = c.z0 - 0.9;
        g.player.pos.set(x, g.world.groundHeightAt(x, z, 2), z);
        g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
        const lookZ = c.breakZ;
        H.aim({ x: g.ritualMausoleum.x - 0.28,
          // At ordinary eye height the first tread is already about 58deg
          // below the horizon from this honest 0.9m approach.  A roughly
          // 40deg downward pitch keeps the view recognisably first-person
          // while putting the shallow four-step cadence inside the frame;
          // the old 27deg aim photographed over it and proved nothing.
          y: 0.05,
          z: lookZ });
        const environmentOnly = name === 'ossuary-opened-descent-environment';
        if (environmentOnly) {
          // Remove only the viewmodel geometry. Keeping the held skull's
          // world-layer lantern live makes this an honest occlusion diagnostic
          // for what the player can illuminate, rather than a second scene
          // with a mechanically impossible missing light source.
          g.skull.hold.traverse((object) => {
            if (!object.isMesh && !object.isLine) return;
            H.restorePlateMeshes.push([object, object.visible]);
            object.visible = false;
          });
        }
        return H.finish({ visibleTreads: c.treadCount, environmentOnly });
      }
      if (name === 'ossuary-mid-stair') {
        const c = o.entranceConnector, x = g.ritualMausoleum.x;
        const z = c.z0 + (c.z1 - c.z0) * 0.48;
        g.player.pos.set(x, g.world.groundHeightAt(x, z, 1), z);
        g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
        H.aim({ x, y: o.origin.floor + 1.15, z: c.z1 + 0.2 });
        return H.finish({ connectorGround: H.round(g.world.groundHeightAt(x, z, g.player.pos.y + 0.2)) });
      }
      if (name === 'ossuary-far-emergence-lookback') {
        o.solved = true;
        o.exitCollider.max.y = o.exitCollider.min.y;
        F.stepWith(2.2, {}, false);
        // Cross the real climbed seam so the same fixed step commits the act,
        // checkpoint and completed-district culler. A debug forest teleport
        // can photograph one uncullled frame that ordinary play never exposes.
        o.inOssuary = true;
        o.portalCooldown = 0;
        g.director.setAct('graveyard', true);
        const far = o.farConnector;
        const z = far.z1 - 0.2;
        g.player.pos.set(o.origin.x, g.world.groundHeightAt(o.origin.x, z, 1), z);
        g.player.vel.set(0, 0, 1.8); g.player.fallV = 0; g.player.grounded = true;
        g.player.yaw = Math.PI; g.player.pitch = 0; g.player._sync(0);
        g.skull.holdNow();
        const firstRenderedFrames = [];
        for (let i = 0; i < 3; i++) {
          F.stepWith(1 / 120, { moveZ: i === 0 ? 1 : 0 }, false);
          g.render();
          firstRenderedFrames.push(g.lastRender.drawCalls);
        }
        const mouth = o.farConnector.surface.children[0].position.clone().setY(0.58);
        H.aim(mouth);
        return H.finish({
          hatch: o.farConnector.surface.name,
          lidOpen: o.exitT > 0.92,
          exited: g.flags.has('ossuaryExited'),
          backDistrictCulled: f.backDistrictCullActive,
          firstRenderedFrames,
        });
      }
      if (name === 'canopy-three-knots-approach') {
        H.resetForest(); H.resetChain();
        // A normal-height half-step toward the outer shoulder separates the
        // three alternating knots in perspective without inventing a survey
        // camera or leaving the playable approach.
        H.placeForest(f.posAt(chain.startS - 0.85, -0.65));
        const middle = chain.stages[0].pivot.clone().lerp(chain.stages[2].pivot, 0.46);
        H.aim(middle);
        return H.finish({ knots: chain.stages.length, route: chain.root.name });
      }
      if (name === 'canopy-true-midair-transfer') {
        const transfer = H.airTransfer(false);
        H.aim(chain.stages[1].pivot);
        const ground = f.heightAt(g.player.pos.x, g.player.pos.z);
        return H.finish({
          first: transfer.first, caughtAirborne: transfer.caughtAirborne, second: transfer.second,
          aboveGround: H.round(g.player.pos.y - ground),
        });
      }
      if (name === 'kneeler-burden-approach') {
        H.resetForest(); H.resetChain();
        g.director._kneelerGrace = 0;
        H.placeForest(f.posAt(chain.kneelerS - 7.2, 0));
        f.reseat(g.player.pos.x, g.player.pos.z);
        g.director._placeKneeler();
        const e = g.director.kneeler;
        const K = e.mesh.userData.kneeler;
        const burden = K.burden.getWorldPosition(K.basePosition.clone());
        H.aim(burden);
        return H.finish({ burden: burden.toArray().map(H.round), state: e.state });
      }
      if (name === 'kneeler-bowed-passage') {
        H.resetForest(); H.resetChain();
        g.director._kneelerGrace = 0;
        H.placeForest(f.posAt(chain.kneelerS - 7.2, 0));
        f.reseat(g.player.pos.x, g.player.pos.z);
        g.director._placeKneeler();
        const e = g.director.kneeler, K = e.mesh.userData.kneeler;
        let burden = K.burden.getWorldPosition(K.basePosition.clone());
        H.aim(burden);
        F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
        let hitT = 0;
        while (e.state !== 'stunned' && hitT < 1.5) {
          H.aim(burden);
          F.stepWith(1 / 120, { throwHeld: true }, false);
          hitT += 1 / 120;
        }
        for (let t = 0; t < 0.38; t += 1 / 120) {
          const pr = f.project(g.player.pos.x, g.player.pos.z);
          const ahead = f.posAt(pr.s + 5, 0);
          H.aim(ahead.clone().setY(g.player.pos.y + 1.62));
          F.stepWith(1 / 120, { moveZ: 1, run: true }, false);
        }
        burden = K.burden.getWorldPosition(K.basePosition.clone());
        H.aim(burden);
        return H.finish({
          hitT: H.round(hitT), state: e.state,
          burdenCollapsed: K.burden.scale.y < 0.75,
          bodyBowed: K.upper.rotation.x > 0.32 && K.head.position.y < K.headBase.y - 0.12,
        });
      }
      if (name === 'canopy-bypass-over-kneeler') {
        const transfer = H.airTransfer(true);
        for (let t = 0; t < 0.28 && g.player.swing; t += 1 / 120) {
          H.aim(chain.stages[1].landing.clone().setY(g.player.pos.y + 1.62));
          F.stepWith(1 / 120, { throwHeld: true, moveZ: 1, run: true }, false);
        }
        const K = transfer.kneeler?.mesh.userData.kneeler;
        const burden = K?.burden.getWorldPosition(K.basePosition.clone());
        if (burden) H.aim(burden.clone().lerp(chain.stages[2].pivot, 0.38));
        return H.finish({
          first: transfer.first, caughtAirborne: transfer.caughtAirborne, second: transfer.second,
          kneelerState: transfer.kneeler?.state,
        });
      }
      if (name === 'clearing-near-shore-stone') {
        F.teleport('clearing');
        if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
        F.stepWith(8.2, {}, false);
        const near = g.bridgeStones[0];
        g.player.pos.set(g.clearingCenter.x, g.world.groundHeightAt(g.clearingCenter.x,
          g.clearingCenter.z + 5.45, 2), g.clearingCenter.z + 5.45);
        g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
        H.aim(near.position.clone().setY(near.position.y + 0.32));
        return H.finish({ stones: g.bridgeStones.length, near: near.position.toArray().map(H.round), physical: H.round(g.world.groundHeightAt(near.position.x, near.position.z, 1)) });
      }
      throw new Error(`unknown plate ${name}`);
    };
    window.__BACKHALF_PLATES = H;
  });

  // startGame's opening veil advances in real CSS time rather than fixed-step
  // simulation. Let the normal 2.4s fade finish once before any plate so the
  // first descent capture cannot accidentally grade a black overlay.
  await page.waitForTimeout(2500);

  const names = [
    'ossuary-opened-descent',
    'ossuary-opened-descent-environment',
    'ossuary-mid-stair',
    'ossuary-far-emergence-lookback',
    'canopy-three-knots-approach',
    'canopy-true-midair-transfer',
    'kneeler-burden-approach',
    'kneeler-bowed-passage',
    'canopy-bypass-over-kneeler',
    'clearing-near-shore-stone',
  ];
  const requested = process.argv.slice(2);
  const selectedNames = requested.length ? names.filter((name) => requested.includes(name)) : names;
  if (requested.length && selectedNames.length !== requested.length) {
    throw new Error(`unknown plate name(s): ${requested.filter((name) => !names.includes(name)).join(', ')}`);
  }
  for (const name of selectedNames) {
    const details = await page.evaluate((plate) => window.__BACKHALF_PLATES.setup(plate), name);
    const path = shotPath(`${name}.png`);
    await page.screenshot({ path });
    report.plates.push({ name, path, ...details });
    console.log(`PLATE ${name}: ${details.drawCalls} draws / ${details.triangles} tris -- ${path}`);
    if (!(details.drawCalls > 0 && details.drawCalls < 450) || !(details.triangles > 0)) exit = 1;
    if (name === 'canopy-true-midair-transfer'
      && !(details.first && details.caughtAirborne && details.second && details.aboveGround > 0.15)) exit = 1;
    if (name === 'ossuary-far-emergence-lookback'
      && !(details.exited && details.backDistrictCulled && details.lidOpen
        && details.firstRenderedFrames?.length === 3
        && details.firstRenderedFrames.every((draws) => draws > 0 && draws < 450))) exit = 1;
    if (name === 'kneeler-bowed-passage'
      && !(details.state === 'stunned' && details.burdenCollapsed && details.bodyBowed)) exit = 1;
  }
  for (const error of report.browserErrors) console.log(`browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  writeFileSync(resultsPath('backhalf-visual-plates.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
