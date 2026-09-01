// Real-GPU visual probe for Round Eighteen's player-facing additions.
// It reads the WebGL canvas itself (not the HTML page), at the game's ordinary
// 71-degree FOV, and leaves a compact report beside the frames.
//   node tools/probe-round18-horror.mjs [output-directory] [house]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const outDir = resolve(process.argv[2] || 'scratch-round18-horror');
const focus = process.argv[3] || 'all';
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
      && window.__game?.frontDoorKnock
      && window.__game?.wreck?.passenger
      && window.__game?.forest?.storyProps
      && window.__game?.underfalls?.dread,
    null,
    { timeout: 60000, polling: 100 },
  );

  const result = await page.evaluate((focus) => {
    const F = window.__FETCH;
    const g = window.__game;
    const frames = {};
    const vistas = [];
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;

    const renderFrame = () => {
      // Manual frames live between RAF callbacks. Neutralize only stale camera
      // residue; the authored fear overlay remains visible in the dread shots.
      g._lastShakeDt = 1 / 60;
      g.fovKick = 0;
      g._shake = 0;
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.render();
    };
    const groundAt = (x, z, act, hint = 12) => {
      if (act === 'forest') return g.forest.heightAt(x, z);
      if (act === 'cave') return g.underfalls.groundAt(x, z);
      return g.world.groundHeightAt(x, z, hint);
    };
    const setPose = (point, target, act = g.act, hint = 12) => {
      if (act === 'forest') g.forest.reseat(point.x, point.z);
      const y = Number.isFinite(point.y) ? point.y : groundAt(point.x, point.z, act, hint);
      g.player.pos.set(point.x, y, point.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.frozen = false;
      g.player.movementLocked = false;
      const dx = target.x - point.x;
      const dz = target.z - point.z;
      const eyeY = y + 1.62;
      const targetY = target.y ?? eyeY;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.15, Math.min(1.15,
        Math.atan2(targetY - eyeY, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const capture = (name, note, state = {}) => {
      for (let i = 0; i < 5; i++) renderFrame();
      frames[name] = g.renderer.domElement.toDataURL('image/png');
      vistas.push({
        name,
        note,
        act: g.act,
        pos: [g.player.pos.x, g.player.pos.y, g.player.pos.z].map(round),
        fear: round(g.fx.fear),
        render: { ...g.lastRender },
        state,
      });
    };

    F.start();
    g.director.scareT = 9999;

    // The door remains shut. The impossible answer is beside the player: the
    // coat stand drops and exposes the returned Resident on the foyer boards.
    F.teleport('basement');
    g.flag('ateFlame');
    g.enemies.clear();
    g.director.resident = null;
    setPose({ x: -1, y: 0, z: -12.7 }, { x: -1, y: 1.15, z: -14 }, 'basement', 1);
    g.frontDoorKnock.onKnock();
    F.stepWith(0.32, {}, false);
    g.frontDoorKnock.onKnock();
    F.stepWith(0.32, {}, false);
    g.frontDoorKnock.onKnock();
    F.stepWith(1.46, {}, false);
    setPose({ x: -1, y: 0, z: -12.7 }, { x: -1, y: 1.15, z: -14 }, 'basement', 1);
    F.stepWith(0.08, {}, false);
    setPose({ x: -1, y: 0, z: -12.7 }, { x: -1, y: 1.15, z: -14 }, 'basement', 1);
    const resident = g.enemies.list.find((enemy) => enemy.kind === 'resident');
    capture('00-house-return-answer', 'three post-basement knocks answer from the fallen coat stand', {
      returnDone: g.frontDoorKnock.returnDone,
      coatFall: round(g.frontDoorKnock.coatFall),
      resident: resident ? [resident.pos.x, resident.pos.y, resident.pos.z].map(round) : null,
    });
    setPose({ x: -1, y: 0, z: -12.7 }, { x: -1.45, y: 1.35, z: -10.4 }, 'basement', 1);
    capture('00b-house-return-turn', 'turning toward the interior knock exposes the fallen stand and Resident', {
      coatFall: round(g.frontDoorKnock.coatFall),
      residentVisible: !!resident?.mesh.visible,
    });
    const heldVisibleAtHouse = g.skull.root.visible;
    g.skull.root.visible = false;
    capture('00c-house-return-diagnostic', 'diagnostic world-only view of the same authored pose', {
      residentVisible: !!resident?.mesh.visible,
    });
    g.skull.root.visible = heldVisibleAtHouse;
    if (focus === 'house') {
      return {
        frames,
        vistas,
        renderer: g.renderer.getContext().getParameter(g.renderer.getContext().RENDERER),
        browserErrors: [],
      };
    }

    // The body is still folded through the dark passenger cabin at this frame;
    // the existing open door makes the route out physically legible.
    F.teleport('graveyard');
    g.enemies.clear();
    g.director.resident = null;
    g.wreck.reset();
    const wagon = g.world.fetchTargets.find((target) => target.id === 'wreckedWagon');
    const impact = wagon.pos.clone();
    const outbound = { mode: 'outbound' };
    wagon.onHit.call(wagon, outbound, impact);
    wagon.onHit.call(wagon, outbound, impact);
    F.stepWith(0.62, {}, false);
    setPose({ x: -7.8, z: 8.55 }, { x: -9.25, y: 2.05, z: 12.5 }, 'graveyard', 2);
    F.stepWith(0.06, {}, false);
    setPose({ x: -7.8, z: 8.55 }, { x: -9.25, y: 2.05, z: 12.5 }, 'graveyard', 2);
    const passenger = g.wreck.passenger.actor;
    capture('01-wreck-passenger', 'impact two unfolds a real walker through the passenger cabin', {
      phase: g.wreck.passenger.active ? 'emerging' : 'spent',
      passenger: passenger ? [passenger.pos.x, passenger.pos.y, passenger.pos.z].map(round) : null,
    });

    // Resolve this isolated body without combat, finish the car, and wait past
    // the anti-scoop breath so the keepsake is judged in its reachable state.
    if (passenger) {
      passenger.state = 'dying';
      g.enemies.clear((enemy) => enemy === passenger);
      g.wreck.passenger.update(1 / 60);
    }
    wagon.onHit.call(wagon, outbound, impact);
    wagon.onHit.call(wagon, outbound, impact);
    F.stepWith(1.36, {}, false);
    F.stepWith(0.95, {}, false);
    const relic = g.graveyardCarRelic;
    setPose({ x: -7.8, z: 8.55 }, { x: relic.home.x + 0.8, y: relic.home.y + 0.25, z: relic.home.z }, 'graveyard', 2);
    F.stepWith(0.18, {}, false);
    setPose({ x: -7.8, z: 8.55 }, { x: relic.home.x + 0.8, y: relic.home.y + 0.25, z: relic.home.z }, 'graveyard', 2);
    capture('02-wreck-relic-landed', 'the moved keepsake rests beyond the destroyed car under its own pooled light', {
      phase: relic.phase,
      enabled: relic.target.enabled,
      home: [relic.home.x, relic.home.y, relic.home.z].map(round),
    });

    F.teleport('forest');
    g.enemies.clear();
    const rope = g.forest.optionalRopes.find((line) => line.id === 'searchers-line');
    setPose(rope.start, rope.pivot, 'forest');
    F.stepWith(0.18, {}, false);
    setPose(rope.start, rope.pivot, 'forest');
    capture('03-forest-swing-read', 'the optional knot is readable from the walking route without HUD guidance', {
      pivot: [rope.pivot.x, rope.pivot.y, rope.pivot.z].map(round),
      emissive: round(rope.target.object.material.emissiveIntensity),
    });

    const hiderProp = g.forest.storyProps.find((prop) => prop.kind === 'washer' && prop.hider)
      || g.forest.storyProps.find((prop) => prop.hider);
    const hiderView = g.forest.posAt(hiderProp.s - 3.8, hiderProp.side * 0.7);
    hiderView.y = g.forest.heightAt(hiderView.x, hiderView.z);
    setPose(hiderView, { ...hiderProp.targetPos, y: hiderProp.targetPos.y + 0.6 }, 'forest');
    const forestActor = hiderProp.hider.trigger();
    F.stepWith(0.43, {}, false);
    setPose(hiderView, { ...hiderProp.targetPos, y: hiderProp.targetPos.y + 0.6 }, 'forest');
    capture('04-forest-appliance-hider', 'the selected appliance unfolds a body halfway through its reveal', {
      prop: hiderProp.id,
      phase: hiderProp.hider.phase,
      actor: forestActor ? [forestActor.pos.x, forestActor.pos.y, forestActor.pos.z].map(round) : null,
    });

    // Enter the cave through the same progression flag used by the real
    // waterfall bargain. No puzzle or hatch state is advanced by these views.
    g.flag('waterfallTaken');
    F.teleport('cave');
    g.enemies.clear();
    const U = g.underfalls;
    const L = U.layout;
    const overflow = L.named['overflow gallery'];
    const bend = L.named['procession bend'];
    const forkView = {
      x: overflow.x + (bend.x - overflow.x) * 0.68,
      z: overflow.z + (bend.z - overflow.z) * 0.68,
    };
    setPose(forkView, { x: bend.x + 2.2, y: bend.y + 1.2, z: bend.z + 1.3 }, 'cave');
    F.stepWith(0.12, {}, false);
    capture('05-underfalls-procession-fork', 'the longer procession resolves into a required bend and a real dead arm', {
      mainLength: round(L.mainLength),
      blindLength: round(L.blindLength),
    });

    const H = L.hatch;
    const approach = { x: H.x - 2.75, z: H.z - 2.75 };
    setPose(approach, { x: H.x, y: H.y + 3.55, z: H.z }, 'cave');
    F.stepWith(0.12, {}, false);
    capture('06-hatch-witness-approach', 'the only exit requires a voluntary walk toward the harmless Witness', {
      approach: U.dread.approachTriggered,
      close: U.dread.closeTriggered,
      harmless: U.dread.harmless,
    });
    const heldVisibleAtHatch = g.skull.root.visible;
    g.skull.root.visible = false;
    capture('06b-hatch-witness-diagnostic', 'diagnostic world-only view of the same authored pose', {
      guardianVisible: U.dread.guardian.visible,
      presenceVisible: U.dread.witnessPresence.group.visible,
    });
    g.skull.root.visible = heldVisibleAtHatch;

    const close = { x: H.x - 1.42, z: H.z - 1.42 };
    setPose(close, { x: H.x, y: H.y + 3.55, z: H.z }, 'cave');
    F.stepWith(0.12, {}, false);
    capture('07-hatch-witness-close', 'inside arm reach, fear and flicker peak while movement and damage remain untouched', {
      approach: U.dread.approachTriggered,
      close: U.dread.closeTriggered,
      frozen: g.player.frozen,
      movementLocked: g.player.movementLocked,
      dead: g.dead,
    });

    const blind = L.chambers.find((chamber) => chamber.blind);
    const blindView = { x: blind.x - 1.45, z: blind.z - 3.0 };
    setPose(blindView, { x: blind.x, y: blind.y + 1.72, z: blind.z + 0.35 }, 'cave');
    F.stepWith(0.16, {}, false);
    capture('08-blind-witness-lunge', 'the dead arm answers curiosity with one harmless forward lunge', {
      revealed: U.dread.blind.revealed,
      lunging: U.dread.blind.lunging,
      progress: round(U.dread.blind.t),
      harmless: U.dread.harmless,
    });

    return {
      frames,
      vistas,
      renderer: g.renderer.getContext().getParameter(g.renderer.getContext().RENDERER),
      browserErrors: [],
    };
  }, focus);

  for (const [name, dataUrl] of Object.entries(result.frames)) {
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  delete result.frames;
  result.browserErrors = errors;
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
