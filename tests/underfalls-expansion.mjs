// Focused deterministic coverage for the waterfall interior and underfalls.
// Complements the full real-input playthrough with dense floor/bounds checks:
//   node tests/underfalls-expansion.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  // openPage keeps appending to this array for the lifetime of the page. Keep
  // the live reference so errors raised during the route are not lost.
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.underfalls,
    null, { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const U = g.underfalls;
    const L = U.layout;
    const round = (n) => +n.toFixed(3);
    const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
    const pathLength = (path, from = 0, to = path.length - 1) => {
      let d = 0;
      for (let i = from; i < to; i++) d += distance(path[i], path[i + 1]);
      return d;
    };
    const samplePath = (path, spacing = 0.55) => {
      const out = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        const len = distance(a, b);
        const n = Math.max(1, Math.ceil(len / spacing));
        const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
        const nx = tz, nz = -tx;
        for (let k = 0; k < n; k++) {
          const t = k / n;
          out.push({
            x: a.x + (b.x - a.x) * t,
            z: a.z + (b.z - a.z) * t,
            y: a.y + (b.y - a.y) * t,
            w: a.w + (b.w - a.w) * t,
            nx, nz, segment: i, t,
          });
        }
      }
      const end = path[path.length - 1];
      out.push({ ...end, nx: 1, nz: 0, segment: path.length - 2, t: 1 });
      return out;
    };

    check(
      'underfalls replaces the short tube with a materially longer authored route',
      L.mainLength > 110 && L.main.length >= 11 && L.chambers.length >= 5,
      { mainLength: round(L.mainLength), nodes: L.main.length, chambers: L.chambers.length },
    );
    const maxY = Math.max(...L.main.map((p) => p.y));
    const minY = Math.min(...L.main.map((p) => p.y));
    check(
      'main route owns a real multi-elevation sluice without a lethal negative floor',
      maxY >= 3.19 && minY >= -0.001 && L.main.some((p) => p.y > 1 && p.y < 3),
      { minY, maxY, elevations: [...new Set(L.main.map((p) => p.y))] },
    );

    const allFeatures = [...L.main, ...L.secret, ...L.chambers];
    check(
      'cave story zone encloses every route node and chamber before the forest fallback',
      allFeatures.every((p) => p.x >= g.caveZone.min.x && p.x <= g.caveZone.max.x
        && p.z >= g.caveZone.min.z && p.z <= g.caveZone.max.z),
      { zone: { min: g.caveZone.min, max: g.caveZone.max }, featureCount: allFeatures.length },
    );

    const mainSamples = samplePath(L.main);
    const secretSamples = samplePath(L.secret);
    const floorFailures = [];
    for (const s of [...mainSamples, ...secretSamples]) {
      for (const lateral of [0, -s.w * 0.62, s.w * 0.62]) {
        const x = s.x + s.nx * lateral, z = s.z + s.nz * lateral;
        const y = g.world.groundHeightAt(x, z, 12);
        if (!Number.isFinite(y) || y < -0.01 || Math.abs(y - s.y) > 0.34) {
          floorFailures.push({ x: round(x), z: round(z), expected: round(s.y), actual: round(y), segment: s.segment });
          if (floorFailures.length >= 12) break;
        }
      }
      if (floorFailures.length >= 12) break;
    }
    check(
      'dense center-and-shoulder samples agree with visible floors and contain no pits',
      floorFailures.length === 0,
      { samples: (mainSamples.length + secretSamples.length) * 3, failures: floorFailures },
    );

    F.start();
    F.teleport('clearing');
    F.stepWith(1 / 120, {}, false);
    const waterfall = g.world.fetchTargets.find((target) => target.id === 'waterfall');
    const directive = waterfall?.enabled ? waterfall.onHit.call(waterfall, g.skull, waterfall.pos, {}) : null;
    if (directive === 'gone') g.skull.vanish();
    F.teleport('cave');
    F.stepWith(1 / 120, {}, false);
    check(
      'the broken promise still gates the expanded district and leaves controls live',
      directive === 'gone' && g.flags.has('waterfallTaken') && g.skull.mode === 'gone'
        && g.caveZone.enabled && g.act === 'cave'
        && !g.player.frozen && !g.player.movementLocked,
      {
        directive, waterfallTaken: g.flags.has('waterfallTaken'), skullMode: g.skull.mode,
        caveEnabled: g.caveZone.enabled, act: g.act,
        frozen: g.player.frozen, movementLocked: g.player.movementLocked,
      },
    );

    // Asserted by EMISSION, not by scene-graph visibility. The shader light
    // census is pinned (World.pinLightCensus) because changing the number of
    // visible lights makes three.js recompile every lit material in the game,
    // so a hidden light is now a black light that stays in the scene rather
    // than one that leaves it. This predicate is strictly stronger than the
    // old `!light.visible`: it fails both for a light that is left in the
    // scene AND for one that is left burning.
    const emits = (light) => light.color.getHex() !== 0 && light.intensity > 0;
    const caveLightsOn = U.lights.length === 9 && U.lights.every(emits);
    const wheelBeforeHouse = U.pump.wheel.rotation.z;
    const pistonBeforeHouse = U.pump.piston.position.y;
    F.teleport('house');
    F.stepWith(1.0, {}, false);
    const houseLightsOff = U.lights.every((light) => !emits(light));
    const hiddenMachinesPaused = U.pump.wheel.rotation.z === wheelBeforeHouse
      && U.pump.piston.position.y === pistonBeforeHouse;
    F.teleport('cave');
    F.stepWith(1 / 120, {}, false);
    const caveLightsRestored = U.lights.every(emits);
    check(
      'Underfalls lights and machine ambience exist only while the cave act owns them',
      caveLightsOn && houseLightsOff && hiddenMachinesPaused && caveLightsRestored,
      {
        lights: U.lights.length,
        caveLightsOn,
        houseLightsOff,
        hiddenMachinesPaused,
        caveLightsRestored,
      },
    );

    const clampFailures = [];
    for (const s of mainSamples.filter((_, i) => i % 17 === 0)) {
      const p = g.player.pos.clone().set(s.x + s.nx * (s.w + 5.5), s.y, s.z + s.nz * (s.w + 5.5));
      U.clamp(p, 1 / 120);
      const q = U.project(p.x, p.z);
      if (!q || q.clearance > 0.02 || p.y !== s.y) {
        clampFailures.push({ before: [round(s.x), round(s.z)], after: [round(p.x), round(p.z)], clearance: q && round(q.clearance) });
      }
    }
    check(
      'district clamp returns large lateral escapes to authored floor without moving the player vertically',
      clampFailures.length === 0,
      { probes: Math.ceil(mainSamples.length / 17), failures: clampFailures.slice(0, 8) },
    );

    // LEGIBILITY, NOT FUNCTION: not "is there a wall" but "can the player
    // stand inside it, or close enough that the near plane deletes it". The
    // camera's near plane is 0.2 (main.js); the clamp permits a stable pose at
    // clearance -0.04, and the head bob adds up to 0.02 of world X on top that
    // the clamp never sees (player.js _sync). A drawn face nearer than the pad
    // is a wall you walk through — and every one of the 81 flank pieces round
    // twelve drew was one. Nothing in this district is a collider, so this is
    // the only test that can catch it. layout.solids carries the drawn FACES,
    // not AABBs: a 35-degree yawed wall box's AABB is 0.22 m fatter into the
    // lane than the box, and believing that number is the old forest trap.
    const NEAR = 0.2;
    const PAD = 0.42;
    const solids = L.solids || [];
    const wallFailures = [];
    for (const s of [...mainSamples, ...secretSamples]) {
      for (const lateral of [-1, 1]) {
        // the outermost pose the clamp will hold...
        const sx = s.x + s.nx * lateral * (s.w - 0.04);
        const sz = s.z + s.nz * lateral * (s.w - 0.04);
        if (!U.contains(sx, sz, -0.039)) continue;
        // ...and only then the bob, which moves world X and is never clamped.
        // Adding it before the filter silently drops both probes on every leg
        // with nx > 0, which is most of them.
        for (const bob of [-0.02, 0, 0.02]) {
          const px = sx + bob, pz = sz;
          for (const q of solids) {
            const dx = px - q.x, dz = pz - q.z;
            const u = Math.abs(dx * q.nx + dz * q.nz) - q.halfN;
            const v = Math.abs(dx * q.tx + dz * q.tz) - q.halfT;
            const gap = Math.hypot(Math.max(0, u), Math.max(0, v));
            if (gap < PAD - 1e-3) {
              wallFailures.push({ at: [round(px), round(pz)], gap: round(gap), clipped: gap < NEAR });
              break;
            }
          }
        }
      }
      if (wallFailures.length >= 8) break;
    }
    check(
      'no pose the clamp accepts stands inside a drawn cave wall, or near enough for the near plane to delete it',
      solids.length > 0 && wallFailures.length === 0,
      { solids: solids.length, near: NEAR, pad: PAD, failures: wallFailures.slice(0, 8) },
    );

    const routeColliders = g.world.colliders.filter((c) => c.underfalls);
    const blockedCenters = [];
    for (const s of [...mainSamples, ...secretSamples]) {
      const hit = routeColliders.find((c) => c.max.y > s.y + 0.55 && c.min.y < s.y + 1.75
        && s.x >= c.min.x - 0.32 && s.x <= c.max.x + 0.32
        && s.z >= c.min.z - 0.32 && s.z <= c.max.z + 0.32);
      if (hit) {
        blockedCenters.push({ x: round(s.x), z: round(s.z), role: hit.role });
        if (blockedCenters.length >= 8) break;
      }
    }
    check(
      'authored landmark colliders never counterfeit or clip either centerline',
      routeColliders.length >= 8 && blockedCenters.length === 0,
      { colliderCount: routeColliders.length, blockedCenters },
    );

    const placeAt = (p) => {
      g.player.pos.set(p.x, g.world.groundHeightAt(p.x, p.z, 12), p.z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
    };
    const walkTo = (p, maxS = 16) => {
      let elapsed = 0;
      while (elapsed < maxS) {
        const dx = p.x - g.player.pos.x, dz = p.z - g.player.pos.z;
        if (Math.hypot(dx, dz) < 0.62) return true;
        g.player.yaw = Math.atan2(-dx, -dz);
        F.stepWith(0.08, { moveZ: 1, run: true }, false);
        elapsed += 0.08;
      }
      return Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z) < 1.1;
    };

    placeAt(L.secret[0]);
    const secretWalk = [];
    for (const p of L.secret.slice(1)) secretWalk.push(walkTo(p, 12));
    F.stepWith(0.3, {}, false);
    const sameXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.01;
    const mainJoinA = L.main.findIndex((p) => sameXZ(p, L.secret[0]));
    const mainJoinB = L.main.findIndex((p) => sameXZ(p, L.secret[L.secret.length - 1]));
    const mainBetweenJoins = pathLength(L.main, mainJoinA, mainJoinB);
    check(
      'the optional culvert is physically reachable, discovers the bell cistern, and rejoins as a shortcut',
      secretWalk.every(Boolean) && U.secret.discovered && g.flags.has('underfallsSecret')
        && L.secretLength < mainBetweenJoins,
      {
        legs: secretWalk, discovered: U.secret.discovered,
        flag: g.flags.has('underfallsSecret'), secretLength: round(L.secretLength),
        mainBetweenJoins: round(mainBetweenJoins), pos: [round(g.player.pos.x), round(g.player.pos.y), round(g.player.pos.z)],
      },
    );

    const sprayCalls = [];
    const realCaveSpray = g.enemies.caveSpray.bind(g.enemies);
    g.enemies.caveSpray = (pos, radius, strength) => {
      sprayCalls.push({ name: U.sprayZones.find((z) => z.pos === pos)?.name, radius, strength });
      return 0;
    };
    const spray = U.sprayZones[0];
    placeAt({ x: spray.pos.x - spray.radius - 1, z: spray.pos.z, y: spray.pos.y });
    F.stepWith(0.08, {}, false);
    placeAt(spray.pos);
    F.stepWith(0.08, {}, false);
    F.stepWith(0.45, {}, false);
    const heldCount = sprayCalls.length;
    placeAt({ x: spray.pos.x - spray.radius - 1, z: spray.pos.z, y: spray.pos.y });
    F.stepWith(0.9, {}, false);
    placeAt(spray.pos);
    F.stepWith(0.08, {}, false);
    g.enemies.caveSpray = realCaveSpray;
    check(
      'named spray volumes emit discrete guarded Choir pulses instead of a per-frame aura',
      L.sprayZones === U.sprayZones && U.sprayZones.length >= 2
        && heldCount === 1 && sprayCalls.length === 2
        && sprayCalls.every((c) => c.name && c.radius > 4 && c.strength > 0),
      { zones: U.sprayZones.map((z) => z.name), heldCount, sprayCalls },
    );

    placeAt(L.main[0]);
    const mainWalk = [];
    for (const p of L.main.slice(1)) mainWalk.push(walkTo(p, 18));
    F.stepWith(0.3, {}, false);
    check(
      'real movement traverses every main-route leg, rises, descends, and arrives grounded at the hatch',
      mainWalk.every(Boolean) && !g.dead
        && Math.hypot(g.player.pos.x - g.caveEnd.x, g.player.pos.z - g.caveEnd.z) < 1.2
        && Math.abs(g.player.pos.y - g.caveEnd.y) < 0.12,
      {
        legs: mainWalk, dead: g.dead,
        pos: [round(g.player.pos.x), round(g.player.pos.y), round(g.player.pos.z)],
        caveEnd: [round(g.caveEnd.x), round(g.caveEnd.y), round(g.caveEnd.z)],
      },
    );

    const hatch = g.world.interactables.find((o) => o.userData.inter?.id === 'caveHatch');
    check(
      'expanded route retains one guarded ceiling-hatch exit and a physical stone seal behind the player',
      !!hatch && U.hatch?.post === hatch && U.veilSeal?.mesh?.name === 'waterfall stone seal silhouette',
      { hatch: hatch?.userData.inter?.id, seal: U.veilSeal?.mesh?.name || null },
    );

    // Prove the same physical use that the full playthrough performs. Reaching
    // caveEnd is not enough: the off-centre first-person ray must acquire the
    // ceiling post within the ordinary 2.9m interaction reach, and E must drive
    // the real fade/Director transition into a live finale.
    walkTo({ x: g.caveEnd.x - 1.2, z: g.caveEnd.z }, 4);
    const dx = g.caveEnd.x - g.player.pos.x;
    const dy = 3.7 - (g.player.pos.y + 1.62);
    const dz = g.caveEnd.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
    g.player._sync(0);
    const hatchTarget = g._crosshairTarget()?.id || null;
    F.stepWith(1 / 120, { interactPressed: true }, false);
    F.stepWith(2.0, {}, false);
    F.stepWith(1 / 60, {}, false);
    check(
      'the live hatch enters the mirror room with its reflected body still visible on the next frame',
      hatchTarget === 'caveHatch' && g.act === 'mirror' && g.finale.active
        && g.finale.figure.visible
        && !g.underfalls.visibility.active
        && g.underfalls.visibility.saved.size === 0,
      {
        hatchTarget,
        act: g.act,
        finaleActive: g.finale.active,
        figureVisible: g.finale.figure.visible,
        caveVisibilityActive: g.underfalls.visibility.active,
        savedVisibilityCount: g.underfalls.visibility.saved.size,
      },
    );
    return checks;
  });

  for (const c of report.checks) {
    console.log(`  ${c.passed ? 'PASS' : 'FAIL'} ${c.name}`
      + (c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`));
    if (!c.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(`  browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('underfalls-expansion.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
