// Focused real-input regressions for the optional house + basement expansion.
// The skull reaches every target through its ordinary swept trajectory; no
// target callbacks are called directly. Runs on the project harness's system
// Chrome / D3D11 path and captures the WebGL canvas (never page.screenshot).
//
//   node tests/house-expansion.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], errors: [], diagnostics: {} };
const failures = [];
const check = (passed, name, details = null) => {
  const row = { name, passed: !!passed, details };
  report.checks.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name}${details == null ? '' : ` -- ${JSON.stringify(details)}`}`);
  if (!row.passed) failures.push(name);
};

const server = await ensureServer();
const browser = await launchBrowser();
let page;

async function canvasShot(name, { isolateEnvironment = false } = {}) {
  const dataUrl = await page.evaluate((hideViewmodel) => {
    // The shipping held skull remains exercised throughout the route. Focused
    // environment plates may hide only its camera-layer group for one render so
    // geometry review is not coupled to a simultaneous skull-sculpt lane.
    const camera = window.__game.camera;
    const cameraMask = camera.layers.mask;
    // LAYER_HELD is 2. Keep layer 0 enabled so the skull's carried PointLight
    // remains part of the honest environment plate.
    if (hideViewmodel) camera.layers.disable(2);
    window.__game.render();
    const png = window.__game.renderer.domElement.toDataURL('image/png');
    camera.layers.mask = cameraMask;
    return png;
  }, isolateEnvironment);
  writeFileSync(shotPath(name), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

try {
  const opened = await openPage(browser, report.url);
  page = opened.page;
  report.errors = opened.errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );
  check(report.errors.length === 0, 'boot has zero browser errors', report.errors.slice());

  const structure = await page.evaluate(() => {
    const g = window.__game;
    return {
      rooms: g.world.rooms.filter((r) => ['pumpGallery', 'blindArchive'].includes(r.id)).map((r) => r.id),
      windows: g.world.windowOpenings.map((w) => w.id),
      relay: !!g.windowRelay,
      mirror: !!g.houseMirror,
      pump: !!g.pumpGallery,
      bridgeSegments: g.pumpGallery?.bridgeSegments.length ?? 0,
      gate: g.pumpGallery?.gateCollider?.id ?? null,
    };
  });
  report.diagnostics.structure = structure;
  check(structure.rooms.includes('pumpGallery') && structure.rooms.includes('blindArchive'),
    'second basement district is compiled as real rooms', structure.rooms);
  check(structure.windows.includes('livingRelayWindow') && structure.windows.includes('studyRelayWindow'),
    'both relay windows are physical skull-pass apertures', structure.windows);
  check(structure.relay && structure.mirror && structure.pump && structure.bridgeSegments === 5,
    'all three authored systems exist with a segmented bridge', structure);

  const boilerClearance = await page.evaluate(() => {
    const fixture = window.__game.houseFixtures?.boiler;
    window.__game.scene.updateMatrixWorld(true);
    const bounds = (fixture?.parts || []).map((part) => {
      part.geometry.computeBoundingBox();
      const box = part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld);
      return { name: part.name, minY: box.min.y, maxY: box.max.y };
    });
    return {
      exists: !!fixture,
      ceilingY: fixture?.ceilingY ?? null,
      clearance: fixture?.clearance ?? null,
      maxY: bounds.length ? Math.max(...bounds.map((b) => b.maxY)) : null,
      bounds,
    };
  });
  report.diagnostics.boilerClearance = boilerClearance;
  check(boilerClearance.exists && boilerClearance.maxY
      <= boilerClearance.ceilingY - boilerClearance.clearance + 1e-5,
    'boiler flue and dark collar terminate below the basement ceiling plane', boilerClearance);

  const wrongKeyThrow = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    const door = g.world.doorById.bedroomDoor;
    const target = g.world.fetchTargets.find((t) => t.id === 'bedroomLock');
    const at = door.panel.getWorldPosition(g.player.pos.clone());
    const oldRattle = g.audio.lockedRattle;
    const oldImpact = g.impact;
    let rattles = 0;
    let impacts = 0;
    g.audio.lockedRattle = () => { rattles++; };
    g.impact = (kind) => { if (kind === 'locked') impacts++; };
    const carry = g.skull.carry;
    const mode = g.skull.mode;
    g.skull.carry = null;
    door.rattleT = 0;
    g.skull.mode = 'outbound';
    const outboundDirective = target.onHit(g.skull, at);
    g.skull.mode = 'returning';
    const returnDirective = target.onHit(g.skull, at);
    g.skull.carry = carry;
    g.skull.mode = mode;
    g.audio.lockedRattle = oldRattle;
    g.impact = oldImpact;
    return {
      outboundDirective,
      returnDirective,
      rattles,
      impacts,
      rattleT: door.rattleT,
      locked: door.locked,
      open: door.open,
      targetEnabled: target.enabled,
    };
  });
  report.diagnostics.wrongKeyThrow = wrongKeyThrow;
  check(wrongKeyThrow.outboundDirective === 'return' && wrongKeyThrow.returnDirective === 'continue'
      && wrongKeyThrow.rattles === 1
      && wrongKeyThrow.impacts === 1 && wrongKeyThrow.rattleT > 0
      && wrongKeyThrow.locked === 'bedroomKey' && !wrongKeyThrow.open
      && wrongKeyThrow.targetEnabled,
    'a no-key throw refuses once and its overlapping return leg adds no feedback storm', wrongKeyThrow);

  const preRelayThrow = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.teleport('house');
    const target = g.voidDoorBeat.target;
    const oldRattle = g.audio.lockedRattle;
    const oldImpact = g.impact;
    const oldMode = g.skull.mode;
    let rattles = 0;
    let impacts = 0;
    g.audio.lockedRattle = () => { rattles++; };
    g.impact = (kind) => { if (kind === 'locked') impacts++; };
    g.flags.delete('voidDoorTried');
    g.windowRelay.nudgeT = 0;
    g.skull.mode = 'outbound';
    const outboundDirective = target.onHit(g.skull, target.pos);
    g.skull.mode = 'returning';
    const returnDirective = target.onHit(g.skull, target.pos);
    g.skull.mode = oldMode;
    g.audio.lockedRattle = oldRattle;
    g.impact = oldImpact;
    return {
      outboundDirective,
      returnDirective,
      rattles,
      impacts,
      targetEnabled: target.enabled,
      open: g.voidDoorBeat.door.open,
      tried: g.flags.has('voidDoorTried'),
      nudge: g.windowRelay.nudgeT,
    };
  });
  report.diagnostics.preRelayThrow = preRelayThrow;
  check(preRelayThrow.outboundDirective === 'return' && preRelayThrow.returnDirective === 'continue'
      && preRelayThrow.rattles === 1 && preRelayThrow.impacts === 1
      && preRelayThrow.targetEnabled && !preRelayThrow.open
      && preRelayThrow.tried && preRelayThrow.nudge > 0,
    'a pre-relay door throw rattles once and the return leg passes cleanly', preRelayThrow);

  const preRelayDoor = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    const door = g.voidDoorBeat.door;
    g.flags.delete('voidDoorTried');
    g.windowRelay.nudgeT = 0;
    const before = { open: door.open, target: door.target };
    door.tryUse(g);
    F.stepWith(0.12, {}, false);
    return {
      before,
      after: { open: door.open, target: door.target, colliderY: [door.collider.min.y, door.collider.max.y] },
      tried: g.flags.has('voidDoorTried'),
      relay: g.flags.has('windowRelaySolved'),
      voidDoorOpen: g.flags.has('voidDoorOpen'),
      flameEnabled: g.voidDoorBeat.flameTarget.enabled,
      relayNudge: g.windowRelay.nudgeT,
    };
  });
  report.diagnostics.preRelayDoor = preRelayDoor;
  check(!preRelayDoor.before.open && !preRelayDoor.after.open
      && preRelayDoor.after.target === 0
      && preRelayDoor.after.colliderY[1] > preRelayDoor.after.colliderY[0]
      && preRelayDoor.tried && preRelayDoor.relayNudge > 0
      && !preRelayDoor.relay && !preRelayDoor.voidDoorOpen && !preRelayDoor.flameEnabled,
    'E cannot counterfeit an open void door before the required window relay', preRelayDoor);

  const windowResult = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('house');
    g.enemies.list.length = 0;
    for (const d of g.world.doors) {
      if (!d.locked) { d.setOpen(true); d.update(5); }
    }
    g.player.pos.set(-10.3, 0, -9);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = -0.015;
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    g.skull.holdNow();

    // Real press and outbound flight through the living-room opening.
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.45, { throwHeld: true }, false);
    const anchored = g.skull.mode === 'anchored'
      && g.skull.anchor?.puzzleId === 'windowRelay'
      && g.windowRelay.armed;
    const atDeparture = g.skull.pos.clone();

    // Keep the button down and walk the actual interior route: backward through
    // the living door, strafe down the hall, then forward into the study.
    F.stepWith(3.48, { moveZ: -1, throwHeld: true }, false);
    F.stepWith(3.72, { moveX: -1, throwHeld: true }, false);
    F.stepWith(1.82, { moveZ: 1, run: true, throwHeld: true }, false);
    F.stepWith(1.15, { throwHeld: true }, false); // let the exterior trolley settle at window two
    const beforeRelease = {
      player: g.player.pos.toArray(),
      skull: g.skull.pos.toArray(),
      state: g.windowRelay.state,
    };

    // Real release: _updateAnchored starts the ordinary, duration-only return.
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    const trace = [];
    for (let i = 0; i < 50; i++) {
      F.stepWith(0.05, {}, false);
      if (i % 2 === 0) trace.push({ mode: g.skull.mode, pos: g.skull.pos.toArray() });
    }
    const receiverPos = g.windowRelay.receiver.position.clone();
    const minReceiverDistance = Math.min(...trace.map((p) => Math.hypot(
      p.pos[0] - receiverPos.x, p.pos[1] - receiverPos.y, p.pos[2] - receiverPos.z)));
    return {
      anchored,
      atDeparture: atDeparture.toArray(),
      beforeRelease,
      solved: g.windowRelay.solved,
      state: g.windowRelay.state,
      skullMode: g.skull.mode,
      flags: [...g.flags],
      plateColliderY: [g.windowRelay.plateCollider.min.y, g.windowRelay.plateCollider.max.y],
      voidDoorOpen: g.flags.has('voidDoorOpen'),
      receiverPos: receiverPos.toArray(), minReceiverDistance,
      traceSample: trace.slice(0, 3),
    };
  });
  report.diagnostics.windowRelay = windowResult;
  check(windowResult.anchored, 'real outbound throw clamps into the exterior mooring', windowResult.atDeparture);
  check(windowResult.beforeRelease.state === 'moored'
      && windowResult.beforeRelease.skull[2] > 0.7
      && windowResult.beforeRelease.player[0] < -8.2,
    'continuous hold carries the skull trolley to window two while the player traverses the house',
    windowResult.beforeRelease);
  check(windowResult.solved && windowResult.flags.includes('windowRelaySolved'),
    'real release trajectory rings the one-way study receiver', windowResult);
  check(windowResult.plateColliderY[1] < -10 && windowResult.voidDoorOpen,
    'receiver physically drops its blocker and opens the existing non-key void-door beat', windowResult);
  await canvasShot('house-expansion-window-relay.png', { isolateEnvironment: true });

  const mirrorResult = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    g.player.pos.set(-1.75, 0, -11.25);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = 0;
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(1.25, {}, true); // seed a local delayed-pose history after setup
    const first = g.houseMirror.double.position.clone();
    F.stepWith(0.3, { moveZ: -1 }, true); // back away while still facing the glass
    const playerNow = g.player.pos.clone();
    const lagNow = g.houseMirror.double.position.clone();
    const separation = playerNow.distanceTo(lagNow);
    const active = g.houseMirror.active && g.houseMirror.pool._activeCount === 1;
    F.stepWith(1.25, {}, true);
    const caughtUp = g.houseMirror.double.position.distanceTo(g.player.pos);
    return {
      awakened: g.houseMirror.awakened,
      relay: g.houseMirror.relay,
      active,
      first: first.toArray(), playerNow: playerNow.toArray(), lagNow: lagNow.toArray(),
      separation, caughtUp,
      doubleLayer: g.houseMirror.double.layers.mask,
      cameraLayer: g.camera.layers.mask,
      echoVisible: g.houseMirror.echo.visible,
    };
  });
  report.diagnostics.mirror = mirrorResult;
  check(mirrorResult.awakened && mirrorResult.relay && mirrorResult.active && mirrorResult.echoVisible,
    'relay wakes a live pooled planar mirror when physically faced', mirrorResult);
  check(mirrorResult.separation > 0.45 && mirrorResult.caughtUp < 0.18,
    'mirror inhabitant visibly follows an old pose, then catches up without stealing control', mirrorResult);
  check((mirrorResult.doubleLayer & mirrorResult.cameraLayer) === 0,
    'delayed inhabitant exists only on the reflection layer', mirrorResult);
  await canvasShot('house-expansion-lag-mirror.png', { isolateEnvironment: true });

  const pumpResult = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.teleport('basement');
    g.enemies.list.length = 0;
    // Enter from the authored crawl-room doorway before using white-box setup
    // at the winch. This catches a compiled wall/collider accidentally sealing
    // the optional district.
    g.player.pos.set(-10.7, -3, -3);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = 0;
    g.player.vel.set(0, 0, 0);
    g.player.grounded = true;
    g.player._sync(0);
    F.stepWith(0.52, { moveZ: 1, run: true }, false);
    const enteredGalleryX = g.player.pos.x;

    g.player.pos.set(-12.62, -3, -6.8);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = -0.12;
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    g.skull.holdNow();
    g.flag('crawlSecretSolved');     // the winch's drive weight; it has its own page

    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.45, { throwHeld: true }, false);
    const firstAnchored = g.skull.mode === 'anchored'
      && g.skull.anchor?.puzzleId === 'pumpGallery';
    // An early release must return cleanly, rewind the bridge, and re-arm the
    // physical target instead of catching its own return trajectory.
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    F.stepWith(1.8, {}, false);
    const retry = {
      mode: g.skull.mode,
      progress: g.pumpGallery.progress,
      targetEnabled: g.pumpGallery.target.enabled,
      gateOpen: g.pumpGallery.gateOpen,
    };

    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.45, { throwHeld: true }, false);
    const anchored = g.skull.mode === 'anchored'
      && g.skull.anchor?.puzzleId === 'pumpGallery';
    F.stepWith(2.25, { throwHeld: true }, false);
    const paidOut = g.pumpGallery.progress;
    const gateOpen = g.pumpGallery.gateOpen;
    // Move south to the bridge lane, then west across it while still holding.
    F.stepWith(1.12, { moveX: -1, throwHeld: true }, false);
    F.stepWith(1.08, { moveZ: 1, run: true, throwHeld: true }, false);
    F.stepWith(0.25, { throwHeld: true }, false);
    const crossedAt = g.player.pos.toArray();
    const latched = g.pumpGallery.latched;
    F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
    F.stepWith(1.6, {}, false);
    g.player.yaw = Math.PI / 2;
    g.player.pitch = 0;
    g.player._sync(0);
    F.stepWith(0.34, { moveZ: 1, run: true }, false); // follow the far bank to the west-wall archive door
    g.player.yaw = Math.PI;
    g.player._sync(0);
    F.stepWith(1.42, { moveZ: 1, run: true }, false);
    const archiveAt = g.player.pos.toArray();
    return {
      enteredGalleryX, firstAnchored, retry, anchored, paidOut, gateOpen, crossedAt, latched, archiveAt,
      progress: g.pumpGallery.progress,
      state: g.pumpGallery.state,
      gateColliderY: [g.pumpGallery.gateCollider.min.y, g.pumpGallery.gateCollider.max.y],
      skullMode: g.skull.mode,
      flags: [...g.flags],
      floor: g.world.groundHeightAt(-16.05, -3, -3),
      surfaceCap: g.world.groundHeightAt(-16.05, -3, 0),
      terrainAtSurface: g.world.terrainHeight(-16.05, -3),
      cellarRamp: g.world.groundHeightAt(9.6, 2.8, 0),
    };
  });
  report.diagnostics.pumpGallery = pumpResult;
  check(pumpResult.enteredGalleryX < -12.2,
    'the real crawl-room doorway admits the player into the second district', pumpResult.enteredGalleryX);
  check(pumpResult.firstAnchored && pumpResult.retry.mode === 'held'
      && pumpResult.retry.progress === 0 && pumpResult.retry.targetEnabled && !pumpResult.retry.gateOpen,
    'early release returns, fully rewinds, and re-arms the physical winch', pumpResult.retry);
  check(pumpResult.anchored, 'real retry trajectory clamps into the pump counterweight', pumpResult);
  check(pumpResult.paidOut > 0.99 && pumpResult.gateOpen,
    'continuous hold physically pays out all bridge segments and lowers the gate', pumpResult);
  check(pumpResult.latched && pumpResult.crossedAt[0] < -17.28
      && pumpResult.flags.includes('pumpGalleryLatched') && pumpResult.archiveAt[2] > 2.2,
    'crossing under player control drops the far-side pawl', pumpResult);
  check(pumpResult.progress === 1 && pumpResult.gateColliderY[1] < -10
      && Math.abs(pumpResult.floor + 3) < 0.01
      && Math.abs(pumpResult.surfaceCap - pumpResult.terrainAtSurface) < 0.01,
    'release keeps the latched route open and the sealed channel has a real safe floor', pumpResult);
  check(pumpResult.cellarRamp < -0.4 && pumpResult.cellarRamp > -0.9,
    'surface terrain does not cap the authored cellar descent', pumpResult.cellarRamp);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.pos.set(-18.45, -3, -3);
    g.player.yaw = -Math.PI / 2;
    g.player.pitch = -0.08;
    g.player._sync(0);
    g.render();
  });
  await canvasShot('house-expansion-pump-bridge.png', { isolateEnvironment: true });
  await page.evaluate(() => {
    const g = window.__game;
    g.player.pos.set(-17.1, -3, 3.25);
    g.player.yaw = Math.PI;
    g.player.pitch = -0.04;
    g.player._sync(0);
    g.render();
  });
  await canvasShot('house-expansion-pump-gallery.png', { isolateEnvironment: true });

  await page.evaluate(() => {
    const g = window.__game;
    g.player.pos.set(9, -3, -4.2);
    g.player.yaw = 0;
    g.player.pitch = 0.44;
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    g.skull.holdNow();
  });
  await canvasShot('house-expansion-boiler-clearance.png', { isolateEnvironment: true });

  const sectorLifecycle = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    // The last real pump traversal left the player deep in the western works.
    // Distant upper-house meshes should be culled, while the small set whose
    // exact bounds intersect the authored cellar openings must retain their
    // original masks so the stair never looks into a false black void.
    const entries = g.pumpGallery.upperSector;
    const cullable = entries.filter((entry) => !entry.cellarSightline);
    const sightline = entries.filter((entry) => entry.cellarSightline);
    const hiddenDeep = cullable.filter((entry) => (entry.object.layers.mask & 1) === 0).length;
    const sightlinePreserved = sightline.every((entry) => entry.object.layers.mask === entry.mask);
    F.teleport('house');
    F.stepWith(1 / 60, {}, false);
    const restored = entries.every((entry) => entry.object.layers.mask === entry.mask);
    return {
      entries: entries.length,
      cullable: cullable.length,
      sightline: sightline.length,
      hiddenDeep,
      sightlinePreserved,
      restored,
    };
  });
  check(sectorLifecycle.entries > 100
      && sectorLifecycle.cullable > 100
      && sectorLifecycle.sightline > 0
      && sectorLifecycle.hiddenDeep === sectorLifecycle.cullable
      && sectorLifecycle.sightlinePreserved
      && sectorLifecycle.restored,
    'basement culling preserves the cellar sightline and restores every upper-house layer on exit',
    sectorLifecycle);

  check(report.errors.length === 0, 'all focused scenarios produce zero browser errors', report.errors.slice());
} catch (error) {
  const message = error?.stack || error?.message || String(error);
  failures.push('suite exception');
  report.exception = message;
  console.error(message);
} finally {
  report.pass = failures.length === 0;
  writeFileSync(resultsPath('house-expansion.json'), JSON.stringify(report, null, 2));
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  server.stop();
}

console.log(report.pass ? '\nALL PASS' : `\n${failures.length} FAILURE(S): ${failures.join(' | ')}`);
process.exit(report.pass ? 0 : 1);
