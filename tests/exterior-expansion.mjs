// Focused deterministic coverage for the authored graveyard and forest pass.
// This uses the same player/skull input frames as the live game: the optional
// lines only count when a real held throw bites, pulls, releases, and returns.
//   node tests/exterior-expansion.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true
      && window.__game?.forest?.optionalRopes?.length === 2
      && window.__game?.graveyardVisualLayout,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(3) : null;
    F.start();
    F.teleport('forest');
    F.stepWith(0.2, {}, false);
    g.enemies.clear();
    const forest = g.forest;

    const ropeIds = forest.optionalRopes.map((line) => line.targetId);
    check(
      'two repeatable optional lines reuse stable skull targets',
      forest.optionalRopes.length === 2
        && new Set(ropeIds).size === 2
        && forest.optionalRopes.every((line) => line.target?.enabled
          && g.world.fetchTargets.includes(line.target)
          && [line.start, line.pivot, line.landing, line.secretPos]
            .every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))),
      { ropeIds, enabled: forest.optionalRopes.map((line) => line.target.enabled) },
    );

    check(
      'one batched foliage belt seals both sides for the full route',
      forest.sideBeltMesh?.isInstancedMesh
        && forest.sideBeltMesh.name === 'sealed forest side belts'
        && forest.sideBeltMesh.count >= forest.length * 5
        && forest.floraStats?.sideBeltInstances === forest.sideBeltMesh.count,
      { length: forest.length, ...forest.floraStats, meshCount: forest.sideBeltMesh?.count },
    );

    const landmarkS = forest.landmarks.map((landmark) => landmark.s).sort((a, b) => a - b);
    const separations = landmarkS.slice(1).map((s, i) => s - landmarkS[i]);
    check(
      'authored silhouettes divide the forest into remembered chapters',
      forest.landmarks.length >= 5
        && new Set(forest.landmarks.map((landmark) => landmark.id)).size === forest.landmarks.length
        && landmarkS[0] > 8 && landmarkS.at(-1) < forest.length - 3
        && separations.every((d) => d >= 12),
      { landmarks: forest.landmarks.map((landmark) => ({ id: landmark.id, s: round(landmark.s) })), separations },
    );

    const pocketSafety = forest.optionalRopes.map((line) => {
      forest.reseat(line.landing.x, line.landing.z);
      const projection = forest.project(line.landing.x, line.landing.z);
      const ground = forest.heightAt(line.landing.x, line.landing.z);
      return {
        id: line.id,
        s: round(projection?.s),
        lat: round(projection?.lat),
        width: projection ? round(forest.halfW[projection.i]) : null,
        ground: round(ground),
        safe: !!projection
          && Math.abs(projection.lat) <= forest.halfW[projection.i] - 0.35
          && Number.isFinite(ground) && ground > -1,
      };
    });
    check(
      'both optional landings are real widened ground with a walk-out',
      pocketSafety.every((pocket) => pocket.safe),
      pocketSafety,
    );

    const placeAt = (p) => {
      if (g.player.swing) g.player.abortSwing();
      g.dead = false;
      forest.reseat(p.x, p.z);
      const y = forest.heightAt(p.x, p.z);
      g.player.pos.set(p.x, y + 0.025, p.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player.movementLocked = false;
      g.player.frozen = false;
      g.player._sync(0);
    };
    const aimAt = (p) => {
      const dx = p.x - g.player.pos.x, dz = p.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(p.y - (g.player.pos.y + 1.62), Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const tryPocketOnFoot = (line) => {
      placeAt(forest.posAt(line.centerS, 0));
      g.skull.holdNow();
      let elapsed = 0;
      let minSecret = Infinity;
      let maxSignedLat = -Infinity;
      let maxBoundaryOverrun = -Infinity;
      while (elapsed < 4.8) {
        aimAt(line.secretPos.clone().setY(g.player.pos.y + 1.62));
        F.stepWith(0.08, { moveZ: 1, run: true }, false);
        g.enemies.clear();
        const projection = forest.project(g.player.pos.x, g.player.pos.z);
        if (projection) {
          const signedLat = line.side * projection.lat;
          const boundary = forest.baseHalfW?.[projection.i] - 0.38;
          maxSignedLat = Math.max(maxSignedLat, signedLat);
          if (Number.isFinite(boundary)) {
            maxBoundaryOverrun = Math.max(maxBoundaryOverrun, signedLat - boundary);
          }
        }
        minSecret = Math.min(minSecret,
          Math.hypot(g.player.pos.x - line.secretPos.x, g.player.pos.z - line.secretPos.z));
        elapsed += 0.08;
      }
      const projection = forest.project(g.player.pos.x, g.player.pos.z);
      return {
        id: line.id,
        elapsed: round(elapsed),
        minSecret: round(minSecret),
        maxSignedLat: round(maxSignedLat),
        maxBoundaryOverrun: round(maxBoundaryOverrun),
        finalS: round(projection?.s),
        finalLat: round(projection?.lat),
        discovered: g.flags.has(line.flag),
        latched: g.flags.has(`${line.flag}:latched`),
        controlsLive: !g.player.swing && !g.player.frozen && !g.player.movementLocked,
        dead: g.dead,
      };
    };

    const noRopeAttempts = forest.optionalRopes.map(tryPocketOnFoot);
    check(
      'ordinary real movement cannot enter either optional pocket before its skull latch',
      noRopeAttempts.every((attempt) => attempt.minSecret > 2.6
        && attempt.maxBoundaryOverrun <= 0.08
        && !attempt.discovered && !attempt.latched
        && attempt.controlsLive && !attempt.dead),
      noRopeAttempts,
    );
    const waitForHeld = (maxSeconds = 3) => {
      let elapsed = 0;
      while (g.skull.mode !== 'held' && elapsed < maxSeconds) {
        F.stepWith(0.04, { throwHeld: false }, false);
        g.enemies.clear();
        elapsed += 0.04;
      }
      return g.skull.mode === 'held';
    };
    const takeLine = (line, linger = true) => {
      placeAt(line.start);
      g.skull.holdNow();
      aimAt(line.pivot);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      let latchT = null;
      let minSecret = Infinity;
      for (let elapsed = 0; elapsed < 1.8; elapsed += 0.04) {
        F.stepWith(0.04, { throwHeld: true, moveZ: 1, run: true }, false);
        g.enemies.clear();
        if (g.player.swing && latchT == null) latchT = elapsed + 0.04;
        minSecret = Math.min(minSecret,
          Math.hypot(g.player.pos.x - line.secretPos.x, g.player.pos.z - line.secretPos.z));
        if (latchT != null) break;
      }
      if (latchT != null && linger) {
        for (let elapsed = 0; elapsed < 2.65 && g.player.swing; elapsed += 0.04) {
          aimAt(line.secretPos);
          F.stepWith(0.04, { throwHeld: true, moveZ: 1, run: true }, false);
          g.enemies.clear();
          minSecret = Math.min(minSecret,
            Math.hypot(g.player.pos.x - line.secretPos.x, g.player.pos.z - line.secretPos.z));
        }
      }
      F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
      F.stepWith(0.2, { throwHeld: false }, false);
      const releaseLive = !g.player.swing && !g.player.frozen && !g.player.movementLocked;
      const returned = waitForHeld();
      let walkedOut = null;
      if (linger && latchT != null && returned) {
        let elapsed = 0;
        while (elapsed < 6) {
          const projection = forest.project(g.player.pos.x, g.player.pos.z);
          if (projection && Math.abs(projection.lat) < 0.7) break;
          const route = forest.posAt(line.centerS, 0).setY(g.player.pos.y + 1.62);
          aimAt(route);
          F.stepWith(0.08, { moveZ: 1, run: true }, false);
          g.enemies.clear();
          elapsed += 0.08;
        }
        const projection = forest.project(g.player.pos.x, g.player.pos.z);
        walkedOut = !!projection && Math.abs(projection.lat) < 0.7
          && !g.dead && !g.player.frozen && !g.player.movementLocked;
      }
      const projection = forest.project(g.player.pos.x, g.player.pos.z);
      return {
        latchT: round(latchT),
        minSecret: round(minSecret),
        discovered: g.flags.has(line.flag),
        releaseLive,
        returned,
        walkedOut,
        skullMode: g.skull.mode,
        dead: g.dead,
        y: round(g.player.pos.y),
        enabled: line.target.enabled,
        finalS: round(projection?.s),
        finalLat: round(projection?.lat),
        inBounds: !!projection && Math.abs(projection.lat) <= forest.halfW[projection.i] - 0.2,
      };
    };

    const ropeRuns = [];
    for (const line of forest.optionalRopes) {
      const first = takeLine(line, true);
      const second = takeLine(line, false);
      ropeRuns.push({ id: line.id, first, second });
    }
    check(
      'real held throws reach both secret pockets and release without control theft',
      ropeRuns.every(({ first }) => first.latchT != null && first.latchT < 1.2
        && first.minSecret < 2.15 && first.discovered
        && first.releaseLive && first.returned && first.walkedOut
        && first.enabled && first.inBounds && !first.dead),
      ropeRuns,
    );
    check(
      'optional knots remain available on a second real throw',
      ropeRuns.every(({ second }) => second.latchT != null
        && second.releaseLive && second.returned && second.enabled),
      ropeRuns.map(({ id, second }) => ({ id, ...second })),
    );

    const walkSegment = (fromS, toS) => {
      placeAt(forest.posAt(fromS, 0));
      let elapsed = 0;
      let lowestY = g.player.pos.y;
      let pinnedFor = 0;
      let previous = g.player.pos.clone();
      while (elapsed < 28) {
        const projection = forest.project(g.player.pos.x, g.player.pos.z);
        if (projection.s >= toS) break;
        const target = forest.posAt(Math.min(toS, projection.s + 5), 0);
        aimAt(target.clone().setY(g.player.pos.y + 1.62));
        F.stepWith(0.08, { moveZ: 1, run: true }, false);
        g.enemies.clear();
        lowestY = Math.min(lowestY, g.player.pos.y);
        const moved = previous.distanceTo(g.player.pos);
        pinnedFor = moved < 0.018 ? pinnedFor + 0.08 : 0;
        previous = g.player.pos.clone();
        elapsed += 0.08;
        if (g.dead) break;
      }
      const end = forest.project(g.player.pos.x, g.player.pos.z);
      return {
        fromS, toS,
        endS: round(end?.s),
        endLat: round(end?.lat),
        lowestY: round(lowestY),
        pinnedFor: round(pinnedFor),
        elapsed: round(elapsed),
        dead: g.dead,
        passed: !!end && end.s >= toS - 0.8
          && Math.abs(end.lat) <= forest.halfW[end.i] - 0.25
          && lowestY > -3.5 && pinnedFor < 0.8 && !g.dead,
      };
    };
    const routeSegments = [[3, 38], [53, 96], [113, 136], [165, 203]].map(([a, b]) => walkSegment(a, b));
    check(
      'real movement crosses every safe forest chapter without pins or side escape',
      routeSegments.every((segment) => segment.passed),
      routeSegments,
    );

    F.teleport('graveyard');
    F.stepWith(0.15, {}, false);
    g.enemies.clear();
    const visual = g.graveyardVisualLayout;
    const familyMeshes = [];
    g.atmosphere.group.traverse((object) => {
      if (object.isInstancedMesh && /headstone|grave cross|grave obelisk/.test(object.name)) {
        familyMeshes.push({ name: object.name, count: object.count });
      }
    });
    check(
      'graveyard replaces repeated slabs with four stone families and crosses',
      visual.stoneCount >= 45
        && ['gothic', 'shouldered', 'broken', 'obelisk', 'cross']
          .every((kind) => visual.stoneFamilies.includes(kind))
        && familyMeshes.length >= 6
        && familyMeshes.reduce((sum, mesh) => sum + mesh.count, 0) >= visual.stoneCount,
      { stoneCount: visual.stoneCount, families: visual.stoneFamilies, meshes: familyMeshes },
    );
    check(
      'wreck, bodies, and directional aftermath are authored as a coherent scene',
      g.graveCar?.name === 'wrecked station wagon'
        && g.graveCarDebris?.children.length >= 4
        && g.graveBodies?.length === 4
        && g.graveDragMarks?.isInstancedMesh && g.graveDragMarks.count === 4,
      {
        car: g.graveCar?.name,
        debris: g.graveCarDebris?.children.length,
        bodies: g.graveBodies?.length,
        dragMarks: g.graveDragMarks?.count,
      },
    );

    const pathSamples = [];
    for (let i = 0; i < visual.funeralPath.length - 1; i++) {
      const a = visual.funeralPath[i], b = visual.funeralPath[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / 0.45));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        pathSamples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    const pathBlocks = [];
    for (const p of pathSamples) {
      const hit = g.world.colliders.find((c) => c.max.y > 0.2 && c.min.y < 1.78
        && p.x >= c.min.x - 0.34 && p.x <= c.max.x + 0.34
        && p.z >= c.min.z - 0.34 && p.z <= c.max.z + 0.34);
      if (hit) {
        pathBlocks.push({ x: round(p.x), z: round(p.z), min: hit.min, max: hit.max });
        if (pathBlocks.length >= 8) break;
      }
    }
    check(
      'the broken funeral walk preserves a full capsule-wide combat route to the gate',
      pathBlocks.length === 0,
      { samples: pathSamples.length, blocks: pathBlocks },
    );

    const atmosphereCanvasTextures = new Set();
    g.atmosphere.group.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const texture = material?.map;
        if (texture?.isCanvasTexture && texture.name.startsWith('atmosphere graveyard')) {
          atmosphereCanvasTextures.add(texture);
        }
      }
    });
    let disposedCanvasTextures = 0;
    for (const texture of atmosphereCanvasTextures) {
      texture.addEventListener('dispose', () => { disposedCanvasTextures++; });
    }
    const atmosphereWasMounted = g.atmosphere.group.parent === g.scene;
    g.atmosphere.dispose();
    check(
      'atmosphere disposal releases both owned procedural canvas textures',
      atmosphereWasMounted && atmosphereCanvasTextures.size === 2
        && disposedCanvasTextures === atmosphereCanvasTextures.size
        && g.atmosphere.group.parent == null,
      {
        atmosphereWasMounted,
        textures: [...atmosphereCanvasTextures].map((texture) => texture.name),
        disposedCanvasTextures,
        groupRemoved: g.atmosphere.group.parent == null,
      },
    );

    return checks;
  });

  for (const c of report.checks) {
    console.log(` ${c.passed ? 'PASS' : 'FAIL'} ${c.name}`
      + (c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`));
    if (!c.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(` browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('exterior-expansion.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
