// Focused regression for the Drowned Choir's Underfalls navigation contract.
// Proves that close walls are not attack shortcuts, the optional culvert is a
// real lure route, multi-height pursuit stays on the visible floor, and the
// outdoor sky subtree cannot render inside the cave.
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
    () => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const U = g.underfalls;
    const L = U.layout;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : n;
    const pose = (p) => ({ x: round(p.x), y: round(p.y), z: round(p.z) });
    const placePlayer = (p) => {
      g.player.pos.set(p.x, U.groundAt(p.x, p.z), p.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
    };

    F.start();
    F.teleport('clearing');
    F.stepWith(1 / 120, {}, false);
    const waterfall = g.world.fetchTargets.find((target) => target.id === 'waterfall');
    const directive = waterfall?.onHit?.call(waterfall, g.skull, waterfall.pos, {});
    if (directive === 'gone') g.skull.vanish();
    F.teleport('cave');
    F.stepWith(1 / 60, {}, false);

    const sky = g.atmosphere.group.getObjectByName('moon sky');
    const caveAtmosphere = new Set([
      'cave broken wall skin', 'underfalls chamber ceiling vaults', 'cave stalactites',
      'cave mica trail (grows toward the way out)', 'underfalls interior cataracts',
      'underfalls displaced spray',
    ]);
    const visibleCaveAtmosphere = g.atmosphere.group.children
      .filter((child) => child.visible).map((child) => child.name);
    const exteriorAtmosphereLeaks = visibleCaveAtmosphere
      .filter((name) => !caveAtmosphere.has(name));
    const hiddenInCave = !!sky && !sky.visible && U.visibility.active;
    const shell = L.shell;
    F.teleport('house');
    F.stepWith(1 / 60, {}, false);
    const restoredOutside = !!sky && sky.visible && !U.visibility.active;
    check(
      'Underfalls hides the entire outdoor sky subtree behind continuous structural overburden',
      hiddenInCave && restoredOutside
        && exteriorAtmosphereLeaks.length === 0
        && visibleCaveAtmosphere.some((name) => caveAtmosphere.has(name))
        && shell?.routeRoofs === L.segments.length
        && shell?.chamberCaps === L.chambers.length,
      {
        hiddenInCave, restoredOutside, visibleCaveAtmosphere, exteriorAtmosphereLeaks,
        shell, segments: L.segments.length, chambers: L.chambers.length,
      },
    );

    F.teleport('cave');
    F.stepWith(1 / 60, {}, false);
    g.enemies.endDrownedChoir('focused-reset');
    // The focused test owns its Choir. Prevent the authored cave trigger from
    // replacing that entity on the first simulated frame and turning a stale,
    // one-tick object into a false-positive movement result.
    if (g.director._caveEcology) g.director._caveEcology.choirArmed = true;

    // Build legal shoulder samples from the authored segments, then locate two
    // points that are physically close but separated by cave wall. Keeping the
    // candidate search data-driven makes the test survive harmless coordinate
    // nudges while still proving the actual shipped layout has this topology.
    const shoulderSamples = [];
    for (let si = 0; si < L.segments.length; si++) {
      const seg = L.segments[si];
      const tx = seg.dx / seg.length, tz = seg.dz / seg.length;
      const nx = tz, nz = -tx;
      for (let k = 1; k < 10; k++) {
        const t = k / 10;
        const centerX = seg.a.x + seg.dx * t;
        const centerZ = seg.a.z + seg.dz * t;
        const y = seg.a.y + (seg.b.y - seg.a.y) * t;
        const width = seg.a.w + (seg.b.w - seg.a.w) * t;
        for (const side of [-1, 1]) {
          shoulderSamples.push({
            x: centerX + nx * side * Math.max(0.32, width - 0.32),
            y,
            z: centerZ + nz * side * Math.max(0.32, width - 0.32),
            segment: si,
          });
        }
      }
    }
    let wallPair = null;
    for (let i = 0; i < shoulderSamples.length; i++) {
      for (let j = i + 1; j < shoulderSamples.length; j++) {
        const a = shoulderSamples[i], b = shoulderSamples[j];
        if (Math.abs(a.segment - b.segment) <= 1 || Math.abs(a.y - b.y) > 0.45) continue;
        const direct = Math.hypot(b.x - a.x, b.z - a.z);
        if (direct < 0.7 || direct >= 1.78 || U.lineOfSight(a, b, { pad: 0.16 })) continue;
        const route = U.route(a, b, { pad: 0.16 });
        if (!route?.reachable || route.distance < 5.5) continue;
        if (!wallPair || route.distance > wallPair.route.distance) wallPair = { a, b, direct, route };
      }
    }

    let wallBehavior = null;
    if (wallPair) {
      placePlayer(wallPair.b);
      const choir = g.enemies.beginDrownedChoir({ pos: wallPair.a, heardPos: wallPair.b });
      choir.state = 'stalk';
      choir.stateT = 0.35;
      choir.heardStrength = 1.25;
      choir.memoryT = 3;
      choir.wetT = 0;
      const before = choir.pos.clone();
      F.stepWith(0.12, {}, false);
      wallBehavior = {
        state: choir.state,
        moved: before.distanceTo(choir.pos),
        remainsActive: g.enemies.choir === choir && g.enemies.list.includes(choir),
        clearance: U.project(choir.pos.x, choir.pos.z)?.clearance,
        floorError: Math.abs(choir.pos.y - U.groundAt(choir.pos.x, choir.pos.z)),
      };
      g.enemies.endDrownedChoir('wall-complete');
    }
    check(
      'a player inside attack range but across rock cannot trigger Euclidean Choir pressure',
      !!wallPair
        && wallPair.direct < 1.78
        && wallPair.route.distance > 5.5
        && wallBehavior?.state === 'stalk'
        && wallBehavior.moved > 0.01
        && wallBehavior.remainsActive
        && wallBehavior.clearance <= 0
        && wallBehavior.floorError < 0.01
        && !g.dead,
      wallPair ? {
        a: pose(wallPair.a), b: pose(wallPair.b),
        direct: round(wallPair.direct), route: round(wallPair.route.distance),
        behavior: wallBehavior,
      } : { candidate: null },
    );

    // postClamp's legal shoulder is 0.08m inside the union, while a route asks
    // for a wider interior footprint. The route must project only its query
    // endpoints inward: otherwise two ordinary same-segment legal poses leave
    // the Choir frozen even though there is no wall between them.
    const shoulderSegment = L.mainSegments[0];
    const shoulderTx = shoulderSegment.dx / shoulderSegment.length;
    const shoulderTz = shoulderSegment.dz / shoulderSegment.length;
    const shoulderNx = shoulderTz, shoulderNz = -shoulderTx;
    const shoulderPoint = (t) => {
      const width = shoulderSegment.a.w
        + (shoulderSegment.b.w - shoulderSegment.a.w) * t;
      return {
        x: shoulderSegment.a.x + shoulderSegment.dx * t + shoulderNx * (width - 0.08),
        y: shoulderSegment.a.y + (shoulderSegment.b.y - shoulderSegment.a.y) * t,
        z: shoulderSegment.a.z + shoulderSegment.dz * t + shoulderNz * (width - 0.08),
      };
    };
    const shoulderA = shoulderPoint(0.42);
    const shoulderB = shoulderPoint(0.58);
    const shoulderRoute = U.route(shoulderA, shoulderB, {
      pad: 0.2,
      edgeAllowed: (a, b) => g.enemies._choirRouteEdgeClear(null, a, b),
    });
    placePlayer(shoulderB);
    const shoulderChoir = g.enemies.beginDrownedChoir({ pos: shoulderA, heardPos: shoulderB });
    shoulderChoir.state = 'stalk';
    shoulderChoir.stateT = 0.35;
    shoulderChoir.heardStrength = 1.25;
    shoulderChoir.memoryT = 3;
    shoulderChoir.wetT = 0;
    const shoulderBefore = shoulderChoir.pos.clone();
    F.stepWith(0.3, {}, false);
    const shoulderBehavior = {
      state: shoulderChoir.state,
      moved: shoulderBefore.distanceTo(shoulderChoir.pos),
      active: g.enemies.choir === shoulderChoir && g.enemies.list.includes(shoulderChoir),
    };
    g.enemies.endDrownedChoir('shoulder-complete');
    check(
      'legal same-segment clamp shoulders remain routable and can trigger Choir pressure',
      Math.abs(U.project(shoulderA.x, shoulderA.z)?.clearance + 0.08) < 0.002
        && Math.abs(U.project(shoulderB.x, shoulderB.z)?.clearance + 0.08) < 0.002
        && U.lineOfSight(shoulderA, shoulderB, { pad: 0.16 })
        && shoulderRoute?.reachable
        && shoulderRoute.direct
        && shoulderBehavior.moved > 0.01
        && shoulderBehavior.active
        && shoulderBehavior.state === 'pressure'
        && !g.dead,
      {
        a: pose(shoulderA), b: pose(shoulderB),
        aClearance: round(U.project(shoulderA.x, shoulderA.z)?.clearance),
        bClearance: round(U.project(shoulderB.x, shoulderB.z)?.clearance),
        routeDistance: round(shoulderRoute?.distance), behavior: shoulderBehavior,
      },
    );

    // This exact long pursuit formerly selected west-aisle -> east-ambulatory,
    // hit the chapel's eastern pillar, and stayed there forever. Inspect every
    // route returned during the live pursuit, including the cached acoustic
    // distance route, so a clear initial path cannot hide a bad replan.
    placePlayer(L.hatch);
    const pillarTarget = L.main[6];
    const pillarChoir = g.enemies.beginDrownedChoir({ pos: L.main[0], heardPos: pillarTarget });
    pillarChoir.state = 'stalk';
    pillarChoir.stateT = 0.35;
    pillarChoir.heardStrength = 1.25;
    pillarChoir.memoryT = 3;
    pillarChoir.wetT = 0;
    const originalRoute = U.route;
    let routeSolves = 0;
    let colliderCheckedEdges = 0;
    let colliderEdgeViolation = false;
    let missingEdgeFilter = false;
    U.route = function checkedChoirRoute(from, to, options = {}) {
      routeSolves++;
      if (typeof options.edgeAllowed !== 'function') missingEdgeFilter = true;
      const route = originalRoute.call(this, from, to, options);
      let previous = from;
      for (const point of route?.points || []) {
        colliderCheckedEdges++;
        if (!options.edgeAllowed?.(previous, point)) colliderEdgeViolation = true;
        previous = point;
      }
      return route;
    };
    const initialPillarNav = g.enemies._choirRoute(pillarChoir, pillarTarget, 0);
    const originalBlockedChord = g.enemies._choirRouteEdgeClear(
      pillarChoir, L.main[4], L.main[6],
    );
    let pillarDistance = Math.hypot(
      pillarChoir.pos.x - pillarTarget.x, pillarChoir.pos.z - pillarTarget.z,
    );
    let bestPillarDistance = pillarDistance;
    let maxPillarBackslide = 0;
    let stallFrames = 0;
    let longestStall = 0;
    const remainingMovementRoute = () => {
      const points = pillarChoir.nav?.route?.points || [];
      const index = pillarChoir.nav?.index || 0;
      if (!points[index]) return 0;
      let remaining = Math.hypot(
        pillarChoir.pos.x - points[index].x, pillarChoir.pos.z - points[index].z,
      );
      for (let i = index; i < points.length - 1; i++) {
        remaining += Math.hypot(
          points[i + 1].x - points[i].x, points[i + 1].z - points[i].z,
        );
      }
      return remaining;
    };
    let bestRouteRemaining = remainingMovementRoute();
    let maxRouteBackslide = 0;
    let routeStallFrames = 0;
    let longestRouteStall = 0;
    let pillarFrames = 0;
    for (; pillarFrames < 2400 && bestPillarDistance > 0.62; pillarFrames++) {
      pillarChoir.heardStrength = 1.25;
      pillarChoir.memoryT = 3;
      F.stepWith(1 / 120, {}, false);
      pillarDistance = Math.hypot(
        pillarChoir.pos.x - pillarTarget.x, pillarChoir.pos.z - pillarTarget.z,
      );
      if (pillarDistance < bestPillarDistance - 0.001) {
        bestPillarDistance = pillarDistance;
        stallFrames = 0;
      } else {
        stallFrames++;
        longestStall = Math.max(longestStall, stallFrames);
      }
      maxPillarBackslide = Math.max(maxPillarBackslide, pillarDistance - bestPillarDistance);
      const routeRemaining = remainingMovementRoute();
      if (routeRemaining < bestRouteRemaining - 0.001) {
        bestRouteRemaining = routeRemaining;
        routeStallFrames = 0;
      } else {
        routeStallFrames++;
        longestRouteStall = Math.max(longestRouteStall, routeStallFrames);
      }
      maxRouteBackslide = Math.max(maxRouteBackslide, routeRemaining - bestRouteRemaining);
    }
    U.route = originalRoute;
    const pillarSeconds = pillarFrames / 120;
    const routeSolvesPerSecond = routeSolves / Math.max(1 / 120, pillarSeconds);
    const pillarNames = initialPillarNav?.route?.points
      ?.flatMap((point) => point.names || []) || [];
    const pillarBehavior = {
      minDistance: bestPillarDistance,
      finalDistance: pillarDistance,
      maxBackslide: maxPillarBackslide,
      maxRouteBackslide,
      longestStall,
      longestRouteStall,
      frames: pillarFrames,
      routeSolves,
      routeSolvesPerSecond,
      colliderCheckedEdges,
      colliderEdgeViolation,
      missingEdgeFilter,
      names: pillarNames,
      active: g.enemies.choir === pillarChoir && g.enemies.list.includes(pillarChoir),
    };
    g.enemies.endDrownedChoir('pillar-complete');
    check(
      'live Choir clears the pump pillar on collider-safe authored edges without route-solve churn',
      initialPillarNav?.route?.reachable
        && pillarNames.includes('chapel north transept')
        && !originalBlockedChord
        && colliderCheckedEdges > 0
        && !colliderEdgeViolation
        && !missingEdgeFilter
        && bestPillarDistance < 0.72
        && maxRouteBackslide < 0.12
        && longestRouteStall < 24
        && routeSolvesPerSecond <= 15
        && pillarBehavior.active
        && !g.dead,
      {
        minDistance: round(bestPillarDistance), finalDistance: round(pillarDistance),
        maxBackslide: round(maxPillarBackslide), maxRouteBackslide: round(maxRouteBackslide),
        longestStall, longestRouteStall,
        frames: pillarFrames, routeSolves,
        routeSolvesPerSecond: round(routeSolvesPerSecond),
        colliderCheckedEdges, colliderEdgeViolation, missingEdgeFilter,
        originalBlockedChordClear: originalBlockedChord,
        names: pillarNames, active: pillarBehavior.active,
      },
    );

    const culvertRoute = U.route(L.main[3], L.main[9], { pad: 0.18 });
    const culvertNames = culvertRoute?.points.flatMap((point) => point.names) || [];
    check(
      'the deterministic shortest path can lure the Choir through the optional dry-return culvert',
      culvertRoute?.reachable
        && culvertRoute.usesSecret
        && culvertNames.some((name) => name === 'bell cistern' || name === 'pump undercroft')
        && culvertRoute.distance < L.mainLength,
      {
        reachable: culvertRoute?.reachable,
        usesSecret: culvertRoute?.usesSecret,
        distance: round(culvertRoute?.distance),
        names: culvertNames,
      },
    );

    // Exercise the live entity over the complete 0 -> 3.2m sluice climb. It
    // receives one fixed sound target and must follow the route without a
    // through-floor teleport or a frame spent above/below its visible tread.
    placePlayer(L.entrance);
    const climbStart = L.lowerSluice;
    const climbEnd = L.overflow;
    const climbing = g.enemies.beginDrownedChoir({ pos: climbStart, heardPos: climbEnd });
    climbing.state = 'stalk';
    climbing.stateT = 0.35;
    climbing.wetT = 0;
    let maxFloorError = 0;
    let maxVerticalStep = 0;
    let minTargetDistance = Math.hypot(climbing.pos.x - climbEnd.x, climbing.pos.z - climbEnd.z);
    let previousY = climbing.pos.y;
    let routeViolation = false;
    for (let frame = 0; frame < 960 && minTargetDistance > 0.62; frame++) {
      climbing.heardStrength = 1.25;
      climbing.memoryT = 3;
      F.stepWith(1 / 60, {}, false);
      const floor = U.groundAt(climbing.pos.x, climbing.pos.z);
      maxFloorError = Math.max(maxFloorError, Math.abs(climbing.pos.y - floor));
      maxVerticalStep = Math.max(maxVerticalStep, Math.abs(climbing.pos.y - previousY));
      previousY = climbing.pos.y;
      minTargetDistance = Math.min(minTargetDistance,
        Math.hypot(climbing.pos.x - climbEnd.x, climbing.pos.z - climbEnd.z));
      if (!U.contains(climbing.pos.x, climbing.pos.z, 0.02)) routeViolation = true;
    }
    const climbResult = {
      minTargetDistance,
      maxFloorError,
      maxVerticalStep,
      routeViolation,
      pos: pose(climbing.pos),
      expectedY: climbEnd.y,
      state: climbing.state,
    };
    g.enemies.endDrownedChoir('climb-complete');
    check(
      'live Choir pursuit follows the rising route with no wall, floor, or vertical-storey mismatch',
      minTargetDistance < 0.72
        && maxFloorError < 0.01
        && maxVerticalStep < 0.12
        && !routeViolation
        && Math.abs(climbing.pos.y - climbEnd.y) < 0.08
        && !g.dead,
      {
        minTargetDistance: round(climbResult.minTargetDistance),
        maxFloorError: round(climbResult.maxFloorError),
        maxVerticalStep: round(climbResult.maxVerticalStep),
        routeViolation,
        pos: climbResult.pos,
        expectedY: climbResult.expectedY,
        state: climbResult.state,
      },
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
  writeFileSync(resultsPath('choir-route-occlusion-regression.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
