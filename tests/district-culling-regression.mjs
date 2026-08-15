// Focused visibility contract for FETCH's resident districts.
//
// Uses the shared dynamic-port/system-Chrome harness.  The assertions exercise
// real act changes and rendering rather than merely checking for culling code:
//   node tests/district-culling-regression.mjs
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], browserErrors: [] };
let exit = 0;

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true
      && window.__game?.forest?.detailRoots?.length > 0
      && window.__game?.underfalls?.renderRoots?.length > 0
      && window.__game?.ossuary?.root,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const forest = g.forest;
    const cave = g.underfalls;
    const ossuary = g.ossuary;
    const atmosphere = g.atmosphere.group;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : n;
    const CAVE_ATMOSPHERE = new Set([
      'cave broken wall skin',
      'underfalls chamber ceiling vaults',
      'cave stalactites',
      'cave mica trail (grows toward the way out)',
      'underfalls interior cataracts',
      'underfalls displaced spray',
    ]);
    const FOREST_CLOSE_ATMOSPHERE = new Set(['forest understory', 'pathside foxfire']);
    const label = (object) => object?.name || `${object?.type || 'Object'}:${object?.uuid?.slice(0, 8)}`;
    const visibleCount = (roots) => roots.filter((root) => root.visible).length;
    const expectedCount = (roots, visibility) => roots
      .filter((root) => visibility.get(root) !== false).length;
    const caveAtmosphereVisible = () => atmosphere.children
      .filter((child) => child.visible && CAVE_ATMOSPHERE.has(child.name));
    const exteriorAtmosphereVisible = () => atmosphere.children
      .filter((child) => child.visible && !CAVE_ATMOSPHERE.has(child.name));
    const snapshotVisibility = () => ({
      scene: g.scene.children.map((object) => [object, object.visible]),
      atmosphere: atmosphere.children.map((object) => [object, object.visible]),
    });
    const visibilityDiff = (snapshot) => {
      const diff = [];
      for (const [object, visible] of snapshot.scene) {
        if (object.parent !== g.scene) diff.push(`${label(object)}:removed`);
        else if (object.visible !== visible) diff.push(`${label(object)}:${visible}->${object.visible}`);
      }
      for (const [object, visible] of snapshot.atmosphere) {
        if (object.parent !== atmosphere) diff.push(`atmosphere/${label(object)}:removed`);
        else if (object.visible !== visible) {
          diff.push(`atmosphere/${label(object)}:${visible}->${object.visible}`);
        }
      }
      return diff;
    };
    const settle = (seconds = 0.05) => {
      F.stepWith(seconds, {}, false);
      g.enemies.clear();
      g.render();
    };
    const enter = (act) => {
      F.teleport(act);
      settle();
      return {
        act: g.act,
        pos: g.player.pos.toArray().map(round),
        drawCalls: g.lastRender.drawCalls,
        forestVisible: visibleCount(forest.detailRoots),
        caveVisible: visibleCount(cave.renderRoots),
        // Counted by EMISSION, not scene-graph visibility. The shader light
        // census is pinned (World.pinLightCensus) because changing the number
        // of visible lights recompiles every lit material in the game, so a
        // sleeping district light is now black and resident rather than
        // absent. Emission is the stronger test: it fails for a light left in
        // the scene AND for one left burning.
        caveLights: cave.lights.filter((light) => light.color.getHex() !== 0 && light.intensity > 0).length,
        caveCullActive: cave.visibility.active,
      };
    };

    F.start();
    const expectedForestVisible = expectedCount(forest.detailRoots, forest._detailBaseVisibility);
    const expectedCaveVisible = expectedCount(cave.renderRoots, cave.renderVisibility);
    check(
      'district registries are bounded, disjoint, and retain authored base visibility',
      forest.detailRoots.length >= 20
        // Was >= 8 when renderRoots still swept up the district's nine point
        // lights along with its geometry. They are now excluded (a light
        // sleeps by going black, not by leaving the scene), so the real
        // geometry-root count is 6. The guard's job is unchanged: catch a
        // registry that has silently collapsed to nothing.
        && cave.renderRoots.length >= 5
        && cave.renderRoots.every((root) => !root.isLight)
        && !forest.detailRoots.some((root) => cave.renderRoots.includes(root))
        && expectedForestVisible > 0
        && expectedCaveVisible > 0
        && CAVE_ATMOSPHERE.size === 6
        && [...CAVE_ATMOSPHERE].every((name) => atmosphere.getObjectByName(name)),
      {
        forestRoots: forest.detailRoots.length,
        expectedForestVisible,
        caveRoots: cave.renderRoots.length,
        expectedCaveVisible,
        caveAtmosphereBatches: CAVE_ATMOSPHERE.size,
      },
    );

    const house = enter('house');
    const houseSnapshot = snapshotVisibility();
    const caveDressAtHouse = caveAtmosphereVisible().map(label);
    check(
      'house render keeps both distant forest detail and the Underfalls district asleep',
      house.act === 'house'
        && house.forestVisible === 0
        && house.caveVisible === 0
        && house.caveLights === 0
        && !house.caveCullActive
        && caveDressAtHouse.length === 0
        && !ossuary.root.visible
        && g.houseReturnProps.rockingChair.visible
        && house.drawCalls > 0 && house.drawCalls < 450,
      { ...house, caveDressAtHouse, ceiling: 450 },
    );

    const graveArrival = enter('graveyard');
    const caveDressAtGrave = caveAtmosphereVisible().map(label);
    check(
      'grave arrival defers close forest detail until the composed gate approach',
      graveArrival.act === 'graveyard'
        && graveArrival.pos[2] < 31.5
        && graveArrival.forestVisible === 0
        && graveArrival.caveVisible === 0
        && graveArrival.caveLights === 0
        && caveDressAtGrave.length === 0
        && graveArrival.drawCalls > 0 && graveArrival.drawCalls < 450,
      { ...graveArrival, caveDressAtGrave, ceiling: 450 },
    );

    g.player.pos.z = 32;
    g.player.pos.y = g.world.groundHeightAt(g.player.pos.x, g.player.pos.z, 3);
    g.player._sync(0);
    settle();
    const graveGate = {
      drawCalls: g.lastRender.drawCalls,
      forestVisible: visibleCount(forest.detailRoots),
      expectedForestVisible,
      pos: g.player.pos.toArray().map(round),
    };
    check(
      'the grave gate approach restores the exact authored forest-detail set without waking the cave',
      graveGate.forestVisible === expectedForestVisible
        && visibleCount(cave.renderRoots) === 0
        && cave.lights.every((light) => light.color.getHex() === 0 || light.intensity === 0)
        && graveGate.drawCalls > 0 && graveGate.drawCalls < 450,
      { ...graveGate, ceiling: 450 },
    );

    const forestState = enter('forest');
    check(
      'forest arrival restores its complete authored district and leaves all cave assets dormant',
      forestState.act === 'forest'
        && forestState.forestVisible === expectedForestVisible
        && forest.detailRoots.every((root) =>
          root.visible === (forest._detailBaseVisibility.get(root) !== false))
        && forestState.caveVisible === 0
        && forestState.caveLights === 0
        && caveAtmosphereVisible().length === 0
        && forestState.drawCalls > 0 && forestState.drawCalls < 450,
      { ...forestState, expectedForestVisible, ceiling: 450 },
    );

    const clearingState = enter('clearing');
    const closeForestInClearing = atmosphere.children
      .filter((child) => child.visible && FOREST_CLOSE_ATMOSPHERE.has(child.name)).map(label);
    check(
      'clearing retires close-reading forest and cave layers while preserving the oasis foreground',
      clearingState.act === 'clearing'
        && clearingState.forestVisible === 0
        && clearingState.caveVisible === 0
        && clearingState.caveLights === 0
        && caveAtmosphereVisible().length === 0
        && closeForestInClearing.length === 0
        && g.clearingPool.visible
        && clearingState.drawCalls > 0 && clearingState.drawCalls < 450,
      { ...clearingState, closeForestInClearing, clearingPool: g.clearingPool.visible, ceiling: 450 },
    );

    const caveState = enter('cave');
    const caveVisibleNames = caveAtmosphereVisible().map(label);
    const exteriorAtmosphereLeaks = exteriorAtmosphereVisible().map(label);
    const representativeExterior = {
      houseRocker: g.houseReturnProps.rockingChair.visible,
      graveCar: g.graveCar.visible,
      graveDebris: g.graveCarDebris.visible,
      sky: atmosphere.getObjectByName('moon sky')?.visible,
    };
    check(
      'cave render is isolated to its authored roots, lights, and six atmosphere batches',
      caveState.act === 'cave'
        && caveState.forestVisible === 0
        && caveState.caveVisible === expectedCaveVisible
        && cave.renderRoots.every((root) =>
          root.visible === (cave.renderVisibility.get(root) !== false))
        && caveState.caveLights === cave.lights.length
        && caveState.caveCullActive
        && caveVisibleNames.length === CAVE_ATMOSPHERE.size
        && exteriorAtmosphereLeaks.length === 0
        && !representativeExterior.houseRocker
        && !representativeExterior.graveCar
        && !representativeExterior.graveDebris
        && !representativeExterior.sky
        && caveState.drawCalls > 0 && caveState.drawCalls < 450,
      {
        ...caveState,
        expectedCaveVisible,
        caveVisibleNames,
        exteriorAtmosphereLeaks,
        representativeExterior,
        ceiling: 450,
      },
    );

    const houseAfterCave = enter('house');
    const caveRestoreDiff = visibilityDiff(houseSnapshot);
    check(
      'leaving the cave restores every pre-cave scene and atmosphere visibility bit exactly',
      !cave.visibility.active
        && caveRestoreDiff.length === 0
        && houseAfterCave.forestVisible === 0
        && houseAfterCave.caveVisible === 0
        && houseAfterCave.caveLights === 0
        && houseAfterCave.drawCalls > 0 && houseAfterCave.drawCalls < 450,
      { ...houseAfterCave, visibilityDiff: caveRestoreDiff, ceiling: 450 },
    );

    // Exercise the actual unlocked mausoleum entry and its authored backtrack
    // exit.  Snapshot at the exact surface pose the exit returns to, so any
    // difference is the ossuary culler rather than a positional forest rule.
    enter('graveyard');
    ossuary.unlock('culling-regression');
    g.skull.holdNow();
    const mausoleum = g.ritualMausoleum;
    g.player.pos.set(mausoleum.x, g.world.groundHeightAt(mausoleum.x, mausoleum.z - 1.2, 3), mausoleum.z - 1.2);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    settle();
    const beforeOssuary = snapshotVisibility();

    g.player.pos.set(mausoleum.x, 0.04, mausoleum.z + 0.4);
    g.player._sync(0);
    F.step(1 / 120, 1, false);
    g.enemies.clear();
    const ossuaryDrawSamples = [];
    for (let i = 0; i < 3; i++) {
      g.render();
      ossuaryDrawSamples.push(g.lastRender.drawCalls);
    }
    const allowedOssuaryRoot = (child) => child === g.camera
      || child === g.skull.root
      || child === ossuary.root
      || child === g._impactRing
      || child === g._impactLight
      || child.isLight
      // mirrors src keepInOssuary: the pinned light census container stays
      // visible (hiding it re-triggered whole-scene recompiles), and marked
      // residents (the district's Standing One) are legitimate occupants
      || child === g.world.lightRoot
      || child.userData?.keepInOssuary === true;
    const ossuaryLeaks = g.scene.children
      .filter((child) => child.visible && !allowedOssuaryRoot(child)).map(label);
    const ossuaryInside = {
      inOssuary: ossuary.inOssuary,
      routeVisible: ossuary.root.visible,
      drawCalls: g.lastRender.drawCalls,
      drawSamples: ossuaryDrawSamples,
      visibleTopLevel: g.scene.children.filter((child) => child.visible).length,
      leaks: ossuaryLeaks,
    };
    check(
      'the occupied ossuary hides every exterior top-level root and stays below the render ceiling',
      ossuaryInside.inOssuary
        && ossuaryInside.routeVisible
        && ossuaryInside.leaks.length === 0
        && ossuaryInside.drawCalls > 0 && ossuaryInside.drawCalls < 450,
      { ...ossuaryInside, ceiling: 450 },
    );

    g.player.pos.set(ossuary.origin.x, ossuary.origin.floor, ossuary.origin.z + 0.1);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    F.step(1 / 120, 1, false);
    F.step(1 / 120, 1, false);
    g.enemies.clear();
    const backtrackDrawSamples = [];
    for (let i = 0; i < 3; i++) {
      g.render();
      backtrackDrawSamples.push(g.lastRender.drawCalls);
    }
    const ossuaryRestoreDiff = visibilityDiff(beforeOssuary);
    const ossuaryAfter = {
      inOssuary: ossuary.inOssuary,
      routeVisible: ossuary.root.visible,
      pos: g.player.pos.toArray().map(round),
      drawCalls: g.lastRender.drawCalls,
      drawSamples: backtrackDrawSamples,
      visibilityDiff: ossuaryRestoreDiff,
    };
    check(
      'the real ossuary backtrack exit restores every saved exterior visibility bit exactly',
      !ossuaryAfter.inOssuary
        && !ossuaryAfter.routeVisible
        && ossuaryAfter.visibilityDiff.length === 0
        && ossuaryAfter.drawCalls > 0 && ossuaryAfter.drawCalls < 450,
      { ...ossuaryAfter, ceiling: 450 },
    );

    // THE MARROW: the third sealed district obeys the same law — occupied,
    // it hides every exterior top-level root; exited, it restores exactly.
    g.enemies.clear();
    const beforeMarrow = snapshotVisibility();
    g.flag('graveyardResolved');
    g.skull.holdNow();
    // descent is a USED verb now: stand at the lip and take it directly. The
    // lip moved under the sealed mausoleum — read it off game.marrowPit.
    g.player.pos.set(g.marrowPit.x, 0.05, g.marrowPit.z - 1.2);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    g.marrow.descend();
    F.step(1 / 120, 40, false);
    const marrow = g.marrow;
    const marrowDrawSamples = [];
    for (let i = 0; i < 3; i++) {
      g.render();
      marrowDrawSamples.push(g.lastRender.drawCalls);
    }
    const marrowDraws = g.lastRender.drawCalls;
    const allowedMarrowRoot = (child) => child === g.camera
      || child === g.skull.root
      || child === marrow.root
      || child === g._impactRing
      || child === g._impactLight
      || child.isLight
      || child === g.world.lightRoot
      || child.userData?.keepInMarrow === true;
    const marrowLeaks = g.scene.children
      .filter((child) => child.visible && !allowedMarrowRoot(child)).map(label);
    check(
      'the occupied marrow hides every exterior top-level root and stays below the render ceiling',
      marrow.inMarrow && marrow.root.visible && marrowLeaks.length === 0
        && marrowDraws > 0 && marrowDraws < 450,
      { inMarrow: marrow.inMarrow, drawCalls: marrowDraws, samples: marrowDrawSamples,
        leaks: marrowLeaks, ceiling: 450 },
    );
    g.player.pos.set(marrow.origin.x, marrow.origin.floor, marrow.origin.z + 0.4);
    g.player._sync(0);
    marrow.ascend();
    F.step(1 / 120, 40, false);
    // The crypt now spits you out inside the sealed mausoleum at z 30.7, a
    // metre south of the forest's detail-pop threshold — so the forest going
    // back to sleep is the pop system doing its job, not the seal leaking. The
    // seal's own contract (every OTHER exterior bit restored exactly) is what
    // this pin is for, and that is still asserted.
    const forestDetail = new Set(forest.detailRoots || []);
    const marrowRestoreDiff = visibilityDiff(beforeMarrow)
      .filter((entry) => ![...forestDetail].some((root) => entry.startsWith(label(root) + ':')));
    check(
      'the marrow exit restores every saved exterior visibility bit exactly',
      !marrow.inMarrow && !marrow.root.visible && marrowRestoreDiff.length === 0,
      { count: marrowRestoreDiff.length, first: marrowRestoreDiff.slice(0, 5) },
    );

    // Repeat through the intended far hatch as well. This is a one-way chapter
    // boundary: the ossuary snapshot must restore first, then the completed
    // house/yard district is intentionally retired as the forest act begins.
    const beforeForwardExit = snapshotVisibility();
    const beforeLookbackVisibility = new Map(
      (g.graveyardLookbackRoots || []).map((root) => [root, root.visible]),
    );
    g.player.pos.set(mausoleum.x, 0.04, mausoleum.z + 0.4);
    g.player._sync(0);
    F.step(1 / 120, 1, false);
    ossuary.solved = true;
    ossuary.exitT = 1;   // mirror the director restore: one number seats slab, hatch, arrival
    // the far exit now fires at the TOP of the shaft climb, on the hatch
    // platform under the open lid — place the player there, as the stairs do
    g.player.pos.set(ossuary.origin.x - 2.45, ossuary.origin.floor + 3.25,
      ossuary.origin.z + 34.65);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    ossuary.climbOut();   // the far exit is a USED verb now: E under the open lid
    F.step(1 / 120, 1, false);
    g.enemies.clear();
    const forwardDrawSamples = [];
    for (let i = 0; i < 3; i++) {
      g.render();
      forwardDrawSamples.push(g.lastRender.drawCalls);
    }
    const forwardRestoreDiff = visibilityDiff(beforeForwardExit);
    const allowedRetired = new Set(forest.backDistrictRoots || []);
    // The marrow's mouth moved under the sealed mausoleum, which puts the
    // player at z 30.7 when they come back up instead of 34.6 — below the
    // forest's detail-pop threshold. So the snapshot is now taken with the
    // forest asleep, and it waking as the forest act begins is exactly right.
    const allowedWake = new Set(forest.detailRoots || []);
    const unexpectedForwardDiff = [];
    for (const [object, visible] of beforeForwardExit.scene) {
      if (object.parent !== g.scene) {
        unexpectedForwardDiff.push(`${label(object)}:removed`);
      } else if (object.visible !== visible) {
        const intentionalRetirement = visible && !object.visible && allowedRetired.has(object);
        const intentionalWake = !visible && object.visible && allowedWake.has(object);
        if (!intentionalRetirement && !intentionalWake) {
          unexpectedForwardDiff.push(`${label(object)}:${visible}->${object.visible}`);
        }
      }
    }
    for (const [object, visible] of beforeForwardExit.atmosphere) {
      if (object.parent !== atmosphere) {
        unexpectedForwardDiff.push(`atmosphere/${label(object)}:removed`);
      } else if (object.visible !== visible) {
        unexpectedForwardDiff.push(`atmosphere/${label(object)}:${visible}->${object.visible}`);
      }
    }
    const visibleBackDistrictRoots = [...allowedRetired]
      .filter((root) => root.parent === g.scene && root.visible)
      .map(label);
    const changedLookbackRoots = [...beforeLookbackVisibility]
      .filter(([root, visible]) => root.parent !== g.scene || root.visible !== visible)
      .map(([root, visible]) => `${label(root)}:${visible}->${root.visible}`);
    const ossuaryForward = {
      act: g.act,
      inOssuary: ossuary.inOssuary,
      routeVisible: ossuary.root.visible,
      exitedFlag: g.flags.has('ossuaryExited'),
      pos: g.player.pos.toArray().map(round),
      drawCalls: g.lastRender.drawCalls,
      drawSamples: forwardDrawSamples,
      forestVisible: visibleCount(forest.detailRoots),
      sceneVisible: g.scene.children.filter((child) => child.visible).length,
      visibilityDiff: forwardRestoreDiff,
      unexpectedVisibilityDiff: unexpectedForwardDiff,
      visibleBackDistrictRoots,
      changedLookbackRoots,
      backDistrictCullActive: forest.backDistrictCullActive,
      checkpoint: g.lastCheckpoint,
    };
    check(
      'the solved far-hatch exit commits the forest and retires only completed back-district roots',
      ossuaryForward.act === 'forest'
        && !ossuaryForward.inOssuary
        && !ossuaryForward.routeVisible
        && ossuaryForward.exitedFlag
        && ossuaryForward.backDistrictCullActive
        && ossuaryForward.checkpoint === 'forest'
        && ossuaryForward.visibleBackDistrictRoots.length === 0
        && ossuaryForward.changedLookbackRoots.length === 0
        && ossuaryForward.unexpectedVisibilityDiff.length === 0,
      { ...ossuaryForward, ceiling: 450 },
    );

    const renderSamples = [
      ['house', house.drawCalls],
      ['grave-arrival', graveArrival.drawCalls],
      ['grave-gate', graveGate.drawCalls],
      ['forest', forestState.drawCalls],
      ['clearing', clearingState.drawCalls],
      ['cave', caveState.drawCalls],
      ['house-after-cave', houseAfterCave.drawCalls],
      ['ossuary', ossuaryInside.drawCalls],
      ['grave-after-ossuary', ossuaryAfter.drawCalls],
      ['marrow', marrowDraws],
      ['grave-after-far-hatch', ossuaryForward.drawCalls],
    ];
    const maxRender = Math.max(...renderSamples.map(([, calls]) => calls));
    check(
      'every exercised district remains below the robust 450-draw ceiling',
      renderSamples.every(([, calls]) => calls > 0 && calls < 450),
      { samples: renderSamples, maxRender, ceiling: 450 },
    );

    return checks;
  });

  for (const check of report.checks) {
    console.log(`  ${check.passed ? 'PASS' : 'FAIL'} ${check.name}`
      + (check.details == null ? '' : ` -- ${JSON.stringify(check.details)}`));
    if (!check.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(`  browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('district-culling-regression.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
