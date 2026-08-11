// Focused human-read regression for Alex's 0.5 basement playtest:
//   node tests/basement-causality-regression.mjs
//
// This does not accept state flags as sufficient proof. It checks the visible
// pilot/carried-fire/furnace chain, grounded winch and travelling pressure
// sentence, locally responsive archive valves, and the timing that exposes the
// ash key while the one qualified throw is still inside the firebox.
import {
  ensureServer, launchBrowser, openPage, URL_BASE, resultsPath, shotPath,
} from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const report = {
  url: `${URL_BASE}/?test=1&mute=1`, checks: [], errors: [], diagnostics: {},
};
const failures = [];
const check = (passed, name, details = null) => {
  const row = { name, passed: !!passed, details };
  report.checks.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name}`
    + (details == null ? '' : ` -- ${JSON.stringify(details)}`));
  if (!row.passed) failures.push(name);
};

const server = await ensureServer();
const browser = await launchBrowser();
let page;

async function freshPage() {
  if (page) await page.close();
  const opened = await openPage(browser, report.url, { width: 1600, height: 900 });
  page = opened.page;
  report.errors.push(...opened.errors);
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );
}

async function canvasShot(name) {
  const data = await page.evaluate(() => {
    const g = window.__game;
    g.render();
    return g.renderer.domElement.toDataURL('image/png');
  });
  writeFileSync(shotPath(name), Buffer.from(data.split(',')[1], 'base64'));
}

try {
  await freshPage();
  const missingDependencies = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start(); F.teleport('basement'); g.enemies.clear();
    const aimAt = (p) => {
      const dx = p.x - g.player.pos.x;
      const dy = p.y - (g.player.pos.y + 1.62);
      const dz = p.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    const throwAt = (p) => {
      aimAt(p);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      for (let t = 0; t < 0.7; t += 1 / 60) F.stepWith(1 / 60, { throwHeld: true }, false);
      F.stepWith(1 / 120, { throwReleased: true }, false);
      for (let t = 0; t < 3 && g.skull.mode !== 'held'; t += 0.05) F.stepWith(0.05, {}, false);
    };
    const fireDoor = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');
    fireDoor.userData.inter.action();
    F.stepWith(0.35, {}, false);
    g.player.pos.set(9, -3, -1.5); g.player.vel.set(0, 0, 0); g.player._sync(0);
    throwAt(g.incineratorPosition);
    const cold = {
      refused: g.incinerator.refused,
      key: g.incinerator.key.visible,
      pilotPulse: g.basementPilot.pulse,
      pilotTarget: g.basementPilot.target.enabled,
    };
    // Isolate the second dependency without granting a free real route: this
    // page is only proving the furnace's physical refusal language.
    g.flag('ateFlame');
    g.incinerator.fireRoot.visible = false;
    throwAt(g.incineratorPosition);
    const noDraft = {
      refused: g.incinerator.refused,
      key: g.incinerator.key.visible,
      needsDraft: g.flags.has('incineratorNeedsDraft'),
      pumpClue: g.pumpGallery.clue,
    };
    return { cold, noDraft };
  });
  report.diagnostics.missingDependencies = missingDependencies;
  check(!missingDependencies.cold.refused && !missingDependencies.cold.key
      && missingDependencies.cold.pilotPulse > 0 && missingDependencies.cold.pilotTarget,
    'a cold firebox exposes no key and physically calls attention back to the live pilot',
    missingDependencies.cold);
  check(!missingDependencies.noDraft.refused && !missingDependencies.noDraft.key
      && missingDependencies.noDraft.needsDraft && missingDependencies.noDraft.pumpClue > 0,
    'a flame-bearing but unpressurised firebox exposes no key and answers at the required winch',
    missingDependencies.noDraft);

  await freshPage();
  const releaseRetry = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start(); F.teleport('basement'); g.enemies.clear();
    g.flag('ateFlame'); g.flag('pumpGalleryLatched');
    const door = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');
    door.userData.inter.action();
    F.stepWith(0.35, {}, false);
    g.player.pos.set(9, -3, -1.5); g.player.vel.set(0, 0, 0);
    const aim = () => {
      const p = g.incineratorPosition;
      const dx = p.x - g.player.pos.x;
      const dy = p.y - (g.player.pos.y + 1.62);
      const dz = p.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    const beginOffer = () => {
      aim();
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      for (let t = 0; t < 1.2 && !g.incinerator.offered; t += 1 / 120) {
        F.stepWith(1 / 120, { throwHeld: true }, false);
      }
    };
    beginOffer();
    F.stepWith(0.36, { throwHeld: true }, false);
    const beforeRelease = {
      offered: g.incinerator.offered, refused: g.incinerator.refused,
      key: g.incinerator.key.visible, mode: g.skull.mode,
      puzzleId: g.skull.anchor?.puzzleId, attempts: g.incinerator.qualifiedThrows,
    };
    F.stepWith(1 / 120, { throwReleased: true }, false);
    F.stepWith(0.08, {}, false);
    const afterRelease = {
      offered: g.incinerator.offered, refused: g.incinerator.refused,
      key: g.incinerator.key.visible, mode: g.skull.mode,
      target: g.world.fetchTargets.find((t) => t.id === 'firebox').enabled,
      attempts: g.incinerator.qualifiedThrows,
    };
    for (let t = 0; t < 4 && g.skull.mode !== 'held'; t += 0.05) F.stepWith(0.05, {}, false);
    beginOffer();
    F.stepWith(1.5, { throwHeld: true }, false);
    const retry = {
      refused: g.incinerator.refused, key: g.incinerator.key.visible,
      keyTarget: g.world.fetchTargets.find((t) => t.id === 'hatchKey').enabled,
      mode: g.skull.mode, attempts: g.incinerator.qualifiedThrows,
    };
    return { beforeRelease, afterRelease, retry };
  });
  report.diagnostics.releaseRetry = releaseRetry;
  check(releaseRetry.beforeRelease.offered && !releaseRetry.beforeRelease.refused
      && !releaseRetry.beforeRelease.key && releaseRetry.beforeRelease.mode === 'anchored'
      && releaseRetry.beforeRelease.puzzleId === 'incineratorOffer'
      && !releaseRetry.afterRelease.offered && !releaseRetry.afterRelease.refused
      && !releaseRetry.afterRelease.key && releaseRetry.afterRelease.mode === 'returning'
      && releaseRetry.afterRelease.target,
    'releasing an unfinished furnace hold immediately returns the skull and visibly rearms the same attempt',
    releaseRetry);
  check(releaseRetry.retry.refused && releaseRetry.retry.key && releaseRetry.retry.keyTarget
      && releaseRetry.retry.mode === 'anchored' && releaseRetry.retry.attempts === 2,
    'an early-release furnace attempt can be retried and only the later continuous hold exposes the key',
    releaseRetry.retry);

  await freshPage();
  const deathDuringOffer = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start(); F.teleport('basement'); g.enemies.clear();
    g.flag('ateFlame'); g.flag('pumpGalleryLatched');
    const door = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');
    door.userData.inter.action(); F.stepWith(0.35, {}, false);
    g.player.pos.set(9, -3, -1.5); g.player.vel.set(0, 0, 0);
    const p = g.incineratorPosition;
    const dx = p.x - g.player.pos.x;
    const dy = p.y - (g.player.pos.y + 1.62);
    const dz = p.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    for (let t = 0; t < 1.2 && !g.incinerator.offered; t += 1 / 120) {
      F.stepWith(1 / 120, { throwHeld: true }, false);
    }
    F.stepWith(0.58, { throwHeld: true }, false);
    const beforeDeath = { offered: g.incinerator.offered, key: g.incinerator.key.visible };
    g.director.death(null);
    F.stepWith(1.7, { throwHeld: true }, false);
    const whileDead = {
      offered: g.incinerator.offered, refused: g.incinerator.refused,
      key: g.incinerator.key.visible,
      keyTarget: g.world.fetchTargets.find((t) => t.id === 'hatchKey').enabled,
    };
    g.director.respawn();
    F.stepWith(1.8, {}, false);
    const afterRespawn = {
      act: g.act, mode: g.skull.mode, offered: g.incinerator.offered,
      refused: g.incinerator.refused, key: g.incinerator.key.visible,
      firebox: g.world.fetchTargets.find((t) => t.id === 'firebox').enabled,
      keyTarget: g.world.fetchTargets.find((t) => t.id === 'hatchKey').enabled,
    };
    return { beforeDeath, whileDead, afterRespawn };
  });
  report.diagnostics.deathDuringOffer = deathDuringOffer;
  check(deathDuringOffer.beforeDeath.offered && !deathDuringOffer.beforeDeath.key
      && !deathDuringOffer.whileDead.offered && !deathDuringOffer.whileDead.refused
      && !deathDuringOffer.whileDead.key && !deathDuringOffer.whileDead.keyTarget
      && deathDuringOffer.afterRespawn.act === 'basement'
      && deathDuringOffer.afterRespawn.mode === 'held'
      && !deathDuringOffer.afterRespawn.offered && !deathDuringOffer.afterRespawn.refused
      && !deathDuringOffer.afterRespawn.key && deathDuringOffer.afterRespawn.firebox
      && !deathDuringOffer.afterRespawn.keyTarget,
    'death during the furnace hold cancels the attempt with no late ghost key and rearms it after respawn',
    deathDuringOffer);

  await freshPage();
  const latchSettlement = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start(); F.teleport('house'); g.enemies.clear();
    const latch = g.cellarRelayLatch;
    latch.release();
    F.stepWith(0.84, {}, false);
    return {
      engaged: latch.engaged,
      mounts: latch.guideMounts.map((mount) => ({ name: mount.name, position: mount.position.toArray() })),
      guides: latch.guideStates.map(({ guide, sx }) => ({
        name: guide.name,
        sx,
        position: guide.position.toArray(),
        scale: guide.scale.toArray(),
        mountDistance: guide.position.distanceTo(latch.guideMounts[sx < 0 ? 0 : 1].position),
      })),
    };
  });
  report.diagnostics.latchSettlement = latchSettlement;
  check(!latchSettlement.engaged && latchSettlement.mounts.length === 2
      && latchSettlement.guides.length === 2
      && latchSettlement.guides.every((guide) => guide.scale[0] <= 0.25
        && Math.abs(Math.abs(guide.position[0]) - 0.86) < 0.01
        && guide.mountDistance < 0.14),
    'the released cellar-bolt guides visibly fold into jamb sleeves instead of hovering across the open throat',
    latchSettlement);

  await freshPage();
  const pilotAndCarry = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start(); F.teleport('basement'); g.enemies.clear();
    const calls = { steal: 0 };
    const original = g.audio.flameSteal;
    g.audio.flameSteal = (...args) => { calls.steal++; return original?.apply(g.audio, args); };
    const pilot = g.basementPilot;
    const pilotPos = pilot.flame.getWorldPosition(g.player.pos.clone());
    g.player.pos.set(7, -3, 3.55); g.player.vel.set(0, 0, 0);
    const aim = () => {
      const dx = pilotPos.x - g.player.pos.x;
      const dy = pilotPos.y - (g.player.pos.y + 1.62);
      const dz = pilotPos.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    aim();
    g.render();
    const before = {
      flameVisible: pilot.flame.visible && pilot.flameOuter.visible && pilot.flameHalo.visible,
      glow: pilot.source.glow.intensity,
      targetRadius: pilot.target.radius,
      conduitPieces: pilot.conduit.length,
      reflectorDiameter: pilot.reflector.geometry.parameters.radius * 2,
      outerHeight: pilot.flameOuter.geometry.parameters.height,
      flameY: pilot.flame.getWorldPosition(g.player.pos.clone()).y,
    };
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    let hitT = 0;
    while (!g.flags.has('ateFlame') && hitT < 1.5) {
      F.stepWith(1 / 120, { throwHeld: true }, false); hitT += 1 / 120;
    }
    F.stepWith(0.16, { throwHeld: true }, false);
    const during = {
      hitT,
      source: g.flameCircuit.source,
      transferVisible: g.flameCircuit.transferSparks.filter((spark) => spark.visible).length,
      emberCount: g.flameCircuit.embers.length,
      emberScale: g.flameCircuit.embers.map((ember) => ember.group.scale.y),
      flag: g.flags.has('carriedFlameVisible'),
      stealCalls: calls.steal,
    };
    F.stepWith(1 / 120, { throwReleased: true }, false);
    for (let t = 0; t < 4 && g.skull.mode !== 'held'; t += 0.05) F.stepWith(0.05, {}, false);
    F.stepWith(0.65, {}, false);
    g.render();
    const after = {
      skullHeld: g.skull.mode === 'held',
      pilotDead: !pilot.flame.visible && !pilot.flameOuter.visible && !pilot.target.enabled,
      emberCount: g.flameCircuit.embers.length,
      embersVisible: g.flameCircuit.embers.every((ember) => ember.group.visible),
      emberScale: g.flameCircuit.embers.map((ember) => ember.group.scale.toArray()),
      emberPositions: g.flameCircuit.embers.map((ember) => ember.group.position.toArray()),
      emberLayers: g.flameCircuit.embers.map((ember) => [ember.group.layers.mask, ember.socket.layers.mask]),
      emberShapes: g.flameCircuit.embers.map((ember) => [
        ember.outer.geometry.parameters.radius,
        ...ember.outer.scale.toArray(),
        ember.lick.geometry.parameters.radius,
        ...ember.lick.scale.toArray(),
      ]),
      light: [g.skullLight.intensity, g.skullLight.distance],
    };
    g.audio.flameSteal = original;
    return { before, during, after };
  });
  report.diagnostics.pilotAndCarry = pilotAndCarry;
  check(pilotAndCarry.before.flameVisible && pilotAndCarry.before.glow >= 2
      && pilotAndCarry.before.targetRadius >= 0.75
      && pilotAndCarry.before.conduitPieces === 3
      && pilotAndCarry.before.reflectorDiameter >= 0.48
      && pilotAndCarry.before.outerHeight >= 0.38
      && pilotAndCarry.before.flameY >= -1.4,
    'the landing presents a raised moving flame before the smaller bell, against a reflector with a physical furnace conduit',
    pilotAndCarry.before);
  check(pilotAndCarry.during.source === 'basement-pilot'
      && pilotAndCarry.during.transferVisible >= 5
      && pilotAndCarry.during.emberCount === 2
      && pilotAndCarry.during.emberScale.every((scale) => scale > 0.2)
      && pilotAndCarry.during.flag && pilotAndCarry.during.stealCalls === 1,
    'the one outbound pilot hit visibly and audibly transfers fire into two carried socket flames',
    pilotAndCarry.during);
  check(pilotAndCarry.after.skullHeld && pilotAndCarry.after.pilotDead
      && pilotAndCarry.after.emberCount === 2 && pilotAndCarry.after.embersVisible
      && pilotAndCarry.after.emberScale.every((scale) => scale[1] > 0.75)
      && pilotAndCarry.after.emberPositions.every((position) => Math.abs(position[0]) > 0.03
        && position[1] < -0.005 && position[2] > 0.09)
      && pilotAndCarry.after.emberLayers.every(([group, socket]) => group === socket && group !== 1)
      && pilotAndCarry.after.emberShapes.every(([
        outerRadius, outerScaleX, outerScaleY, , lickRadius, lickScaleX, lickScaleY,
      ]) => outerRadius * outerScaleX * 2 <= 0.012
        && outerRadius * outerScaleY * 2 <= 0.019
        && lickRadius * lickScaleX * 2 <= 0.007
        && lickRadius * lickScaleY * 2 <= 0.014)
      && pilotAndCarry.after.light[0] === 62 && pilotAndCarry.after.light[1] === 12.5,
    'the source stays extinguished while two small two-lobe socket flames preserve most of each dark aperture after the catch',
    pilotAndCarry.after);
  await canvasShot('basement-causality-carried-flame.png');

  const pumpAndFurnace = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const calls = { pressure: 0, ash: 0, fire: 0, steam: 0 };
    const originals = {};
    for (const [method, key] of [
      ['pressureSurge', 'pressure'], ['ashEject', 'ash'], ['fireRoar', 'fire'], ['steamSpit', 'steam'],
    ]) {
      originals[method] = g.audio[method];
      g.audio[method] = (...args) => { calls[key]++; return originals[method]?.apply(g.audio, args); };
    }
    const route = g.pumpGallery;
    let frameParts = 0;
    route.winch.traverse((o) => { if (o.name?.startsWith('pump-winch-')) frameParts++; });
    g.player.pos.set(-14.3, -3, -3); g.player.vel.set(0, 0, 0);
    const aimAt = (p) => {
      const dx = p.x - g.player.pos.x;
      const dy = p.y - (g.player.pos.y + 1.62);
      const dz = p.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
    };
    const pumpAim = route.cradle.getWorldPosition(g.player.pos.clone());
    aimAt(pumpAim);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.5, { throwHeld: true }, false);
    let frames = 0;
    while (!route.latched && frames < 700) {
      F.stepWith(1 / 120, { throwHeld: true, moveX: -1 }, false); frames++;
    }
    F.stepWith(0.16, { throwHeld: true }, false);
    const earlyPulse = route.pressurePulseCollars.map((c) => c.material.opacity);
    F.stepWith(1.58, { throwHeld: true }, false);
    const terminalAt = route.terminalPiston.position.z;
    const latePulse = route.pressurePulseCollars.map((c) => c.material.opacity);
    F.stepWith(0.42, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true }, false);
    for (let t = 0; t < 4 && g.skull.mode !== 'held'; t += 0.05) F.stepWith(0.05, {}, false);
    const pump = {
      frameParts,
      frames,
      latched: route.latched,
      gateOpen: route.gateOpen,
      progress: route.progress,
      gauge: route.winchGaugeNeedle.rotation.z,
      pressureT: route.pressureT,
      earlyBright: earlyPulse.filter((opacity) => opacity > 0.3).length,
      lateBright: latePulse.filter((opacity) => opacity > 0.3).length,
      terminalAt,
      pressureCalls: calls.pressure,
      fireCalls: calls.fire,
      skullHeld: g.skull.mode === 'held',
    };

    // Enter the archive and strike one visible valve. This must be a strong
    // local answer without another route flag or remote furnace event.
    const archive = route.archivePumps[2];
    g.player.pos.set(-16.7, -3, 3.75); g.player.vel.set(0, 0, 0); g.player._sync(0);
    F.stepWith(0.1, {}, false);
    const valvePos = archive.wheel.getWorldPosition(g.player.pos.clone());
    const beforeAngle = archive.wheel.rotation.z;
    const beforeRemoteFire = calls.fire;
    aimAt(valvePos);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    let manualPeak = 0;
    for (let t = 0; t < 0.9; t += 1 / 60) {
      F.stepWith(1 / 60, { throwHeld: true }, false);
      manualPeak = Math.max(manualPeak, archive.manualKick);
    }
    F.stepWith(1 / 120, { throwReleased: true }, false);
    F.stepWith(0.22, {}, false);
    const archiveResult = {
      visible: archive.group.visible,
      answeredFlag: g.flags.has('archiveValveAnswered'),
      manualKick: archive.manualKick,
      manualPeak,
      delta: Math.abs(archive.wheel.rotation.z - beforeAngle),
      steamCalls: calls.steam,
      remoteFireDelta: calls.fire - beforeRemoteFire,
      stillLatched: route.latched,
      targetEnabled: archive.target.enabled,
    };

    // Return to the already-open, visibly burning firebox. One qualified throw
    // must expose the key before this anchored skull comes home.
    const fireDoor = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');
    fireDoor.userData.inter.action();
    F.stepWith(0.35, {}, false);
    // Walk straight into the visible shell before throwing. The player capsule
    // must stop at its west face while the skull-only pass-through below still
    // reaches the firebox target in the very same shipped geometry.
    g.player.pos.set(9.5, -3, -1.5); g.player.vel.set(0, 0, 0);
    g.player.yaw = -Math.PI / 2; g.player.pitch = 0; g.player._sync(0);
    for (let t = 0; t < 0.8; t += 1 / 60) F.stepWith(1 / 60, { moveZ: 1 }, false);
    const playerStopX = g.player.pos.x;
    g.player.pos.set(9, -3, -1.5); g.player.vel.set(0, 0, 0); g.player._sync(0);
    aimAt(g.incineratorPosition);
    const beforeOffer = {
      visibleFire: g.incinerator.fireRoot.visible,
      tongues: g.incinerator.fireTongues.length,
      tongueHeights: g.incinerator.fireTongues.map((tongue) =>
        tongue.outer.geometry.parameters.height),
      tongueScales: g.incinerator.fireTongues.map((tongue) =>
        tongue.group.scale.y),
      frameRails: g.incinerator.doorFrame.children.length,
      frameCenterBlocked: g.incinerator.doorFrame.children.some((rail) => {
        const { width, height } = rail.geometry.parameters;
        return Math.abs(rail.position.x) <= width * 0.5
          && Math.abs(rail.position.y) <= height * 0.5;
      }),
      shellPanels: g.incinerator.bodyShell.children.length,
      shellMouthBlocked: g.incinerator.bodyShell.children.some((panel) => {
        const { width, height } = panel.geometry.parameters;
        return Math.abs(panel.position.x) <= width * 0.5
          && Math.abs(panel.position.y - 0.9) <= height * 0.5;
      }),
      cavityFrontZ: g.incinerator.cavity.position.z
        + g.incinerator.cavity.geometry.parameters.depth * 0.5,
      fireZ: g.incinerator.fireRoot.position.z,
      bodyCollider: {
        id: g.incinerator.bodyCollider.id,
        skullPass: g.incinerator.bodyCollider.skullPass,
        min: { ...g.incinerator.bodyCollider.min },
        max: { ...g.incinerator.bodyCollider.max },
      },
      playerStopX,
      key: g.incinerator.key.visible,
      target: g.world.fetchTargets.find((t) => t.id === 'hatchKey').enabled,
    };
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    let offerT = 0;
    while (!g.incinerator.offered && offerT < 1.5) {
      F.stepWith(1 / 120, { throwHeld: true }, false); offerT += 1 / 120;
    }
    F.stepWith(1.02, { throwHeld: true }, false);
    const choke = {
      state: g.incinerator.sequence,
      key: g.incinerator.key.visible,
      skull: g.skull.mode,
    };
    F.stepWith(0.48, { throwHeld: true }, false);
    const eject = {
      state: g.incinerator.sequence,
      refused: g.incinerator.refused,
      key: g.incinerator.key.visible,
      keyTarget: g.world.fetchTargets.find((t) => t.id === 'hatchKey').enabled,
      keyPosition: g.incinerator.key.position.toArray(),
      panZ: g.incinerator.pan.position.z,
      skull: g.skull.mode,
      qualifiedThrows: g.incinerator.qualifiedThrows,
      ashCalls: calls.ash,
    };
    F.stepWith(1 / 120, { throwReleased: true }, false);
    for (let t = 0; t < 4 && g.skull.mode !== 'held'; t += 0.05) F.stepWith(0.05, {}, false);
    const settled = {
      skull: g.skull.mode,
      key: g.incinerator.key.visible,
      keyTarget: g.world.fetchTargets.find((t) => t.id === 'hatchKey').enabled,
      qualifiedThrows: g.incinerator.qualifiedThrows,
      ashCalls: calls.ash,
      proofOpacity: g.incinerator.keyProof.material.opacity,
    };
    for (const [method] of [
      ['pressureSurge'], ['ashEject'], ['fireRoar'], ['steamSpit'],
    ]) g.audio[method] = originals[method];
    return { pump, archive: archiveResult, beforeOffer, offerT, choke, eject, settled };
  });
  report.diagnostics.pumpAndFurnace = pumpAndFurnace;
  check(pumpAndFurnace.pump.frameParts >= 10
      && pumpAndFurnace.pump.latched && pumpAndFurnace.pump.gateOpen
      && pumpAndFurnace.pump.progress === 1
      && pumpAndFurnace.pump.gauge < 0
      && pumpAndFurnace.pump.earlyBright >= 1
      && pumpAndFurnace.pump.lateBright >= 1
      && pumpAndFurnace.pump.terminalAt < -0.03
      && pumpAndFurnace.pump.pressureCalls >= 2
      && pumpAndFurnace.pump.fireCalls >= 1
      && pumpAndFurnace.pump.skullHeld,
    'the grounded winch, retained bridge, sweeping gauge and travelling pressure line visibly answer at the furnace',
    pumpAndFurnace.pump);
  check(pumpAndFurnace.archive.visible && pumpAndFurnace.archive.answeredFlag
      && pumpAndFurnace.archive.manualPeak > 0.8
      && pumpAndFurnace.archive.delta > 0.15
      && pumpAndFurnace.archive.steamCalls >= 1
      && pumpAndFurnace.archive.remoteFireDelta === 0
      && pumpAndFurnace.archive.stillLatched && pumpAndFurnace.archive.targetEnabled,
    'each archive wheel answers a throw locally without pretending to be another hidden route switch',
    pumpAndFurnace.archive);
  check(pumpAndFurnace.beforeOffer.visibleFire
      && pumpAndFurnace.beforeOffer.tongues === 5
      && pumpAndFurnace.beforeOffer.tongueHeights.every((height) => height >= 0.48)
      && pumpAndFurnace.beforeOffer.tongueScales.filter((scale) => scale >= 0.72).length >= 3
      && Math.max(...pumpAndFurnace.beforeOffer.tongueScales) >= 0.9
      && pumpAndFurnace.beforeOffer.frameRails === 4
      && !pumpAndFurnace.beforeOffer.frameCenterBlocked
      && pumpAndFurnace.beforeOffer.shellPanels === 4
      && !pumpAndFurnace.beforeOffer.shellMouthBlocked
      && pumpAndFurnace.beforeOffer.cavityFrontZ
        <= pumpAndFurnace.beforeOffer.fireZ - 0.2
      && pumpAndFurnace.beforeOffer.bodyCollider.id === 'incineratorBody'
      && pumpAndFurnace.beforeOffer.bodyCollider.skullPass
      && pumpAndFurnace.beforeOffer.bodyCollider.min.x === 10.725
      && pumpAndFurnace.beforeOffer.bodyCollider.max.x === 11.675
      && pumpAndFurnace.beforeOffer.bodyCollider.min.z === -2.075
      && pumpAndFurnace.beforeOffer.bodyCollider.max.z === -0.925
      && pumpAndFurnace.beforeOffer.playerStopX <= 10.39
      && !pumpAndFurnace.beforeOffer.key && !pumpAndFurnace.beforeOffer.target,
    'the solid furnace blocks the player while its open mouth admits the skull to five cavity-filling animated flames',
    pumpAndFurnace.beforeOffer);
  check(pumpAndFurnace.choke.state === 'choking'
      && !pumpAndFurnace.choke.key && pumpAndFurnace.choke.skull === 'anchored',
    'the first qualified throw visibly burns then chokes while the skull remains in the mouth',
    pumpAndFurnace.choke);
  check(pumpAndFurnace.eject.state === 'ejected' && pumpAndFurnace.eject.refused
      && pumpAndFurnace.eject.key && pumpAndFurnace.eject.keyTarget
      && pumpAndFurnace.eject.panZ > 0.55
      && pumpAndFurnace.eject.keyPosition[2] > 0.05
      && pumpAndFurnace.eject.skull === 'anchored'
      && pumpAndFurnace.eject.qualifiedThrows === 1 && pumpAndFurnace.eject.ashCalls === 1,
    'that same throw backdrafts the pan and physically exposes the key before the skull returns',
    pumpAndFurnace.eject);
  check(pumpAndFurnace.settled.skull === 'held' && pumpAndFurnace.settled.key
      && pumpAndFurnace.settled.keyTarget
      && pumpAndFurnace.settled.qualifiedThrows === 1
      && pumpAndFurnace.settled.ashCalls === 1
      && pumpAndFurnace.settled.proofOpacity > 0.1,
    'the visible ash key persists after the catch without a second incinerator throw or duplicate ejection',
    pumpAndFurnace.settled);
  await canvasShot('basement-causality-ash-key.png');

  check(report.errors.length === 0, 'all basement-causality scenarios produce zero browser errors', report.errors);
} finally {
  writeFileSync(resultsPath('basement-causality-regression.json'), JSON.stringify(report, null, 2));
  if (page) await page.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL PASS');
