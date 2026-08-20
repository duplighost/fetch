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
    // stand inside it, or close enough that the near plane deletes it". Round
    // thirteen added this after all 81 drawn flank pieces turned out to sit
    // within 0.045 m of a pose the clamp holds. It was then much too weak to
    // see the five fixtures round fourteen found one function away, in two
    // specific ways, and both of them are why they survived.
    //
    // 1. IT COULD ONLY SEE layout.solids, AND layout.solids HAD TWO PRODUCERS.
    //    The flank walls and the sluice gate posts published; nothing else this
    //    district draws did. So three pale doorjambs standing on open chapel
    //    floor with a 0.000 m gap, two turn markers you could stand inside, the
    //    keepsake shelf, the bell whose mouth swallowed the camera, and six
    //    benches were all invisible to the only gate that could have asked.
    //    Every drawn silhouette publishes now (src/underfalls.js publishSolid),
    //    and this gate asserts the ledger's own membership below, so a producer
    //    cannot fall off it quietly a second time.
    //
    // 2. ITS POSES CAME FROM EACH POLYLINE'S OWN w, NEVER FROM THE UNION.
    //    At main#3 mid-leg the outermost probe sat at union clearance -0.462,
    //    so the clamp still permitted 0.422 m of lateral travel this gate never
    //    looked at -- and chamber rims, where the union is far wider than the
    //    leg crossing them, are exactly where every failure in this district
    //    has actually lived. Poses are a grid over the union now, the way
    //    tools/probe-district-walls.mjs's reachablePoses does it.
    //
    // AND A POSE IS SOMETHING A COLLIDER CAN TAKE AWAY. "Nothing in this
    // district is a collider" was true when round twelve wrote it and stopped
    // being true in round thirteen, when the bell got one; the pump
    // chapel's pillars and altar had had one all along. A pose here is
    // clamp-legal AND collider-free, by player.js _moveAxis's own rule, and the
    // ledger names which guard each face has, because the two guards owe
    // different distances:
    //   'clamp'  -- the clamp is all there is, and installClamp stably holds a
    //               pose at clearance -0.04, so the face owes the player's
    //               RADIUS 0.34 plus that 0.08 dead band: UNDERFALLS_SOLID_PAD.
    //   a role   -- a collider carrying that role stands in front of it, and it
    //               has no dead band: _moveAxis puts the player's centre at
    //               exactly RADIUS. Less the 0.02 of world X the head bob adds
    //               to the camera and the collider never sees, that is 0.32.
    // Both numbers are past 0.24 -- the 0.2 near plane plus the 0.04 of slack
    // the clamp leaves -- so a face that keeps its guard's distance is never
    // clipped. The gate proves the named collider exists rather than believing
    // the label.
    //
    // OVERHEAD SETTLES THE BODY AND SAYS NOTHING ABOUT THE NEAR PLANE. So each
    // ledger entry is a PRISM (footprint plus y0..y1) and gets two questions:
    // the flat gap, asked only while the prism crosses the player's head window
    // (feet+STEP_UP .. feet+HEAD, player.js's own two collider tests), and the
    // full 3D distance from the eye, asked always. The second is not decorative:
    // it is what catches the hatch's long pull chain, which hung 0.093 m from
    // the camera of a player standing where the hatch makes them stand.
    //
    // FACES, NOT AABBs. A 35-degree yawed 0.54 x 0.95 wall box has a 0.99 m
    // AABB, 0.22 m fatter into the lane than the box, and believing that number
    // is the old forest trap. Rect entries carry their own frame; cones carry
    // {r} rather than being squared off into 0.481 m of corner they do not have.
    //
    // WHAT IS DELIBERATELY NOT ON THE LEDGER, and the measured numbers that say
    // why (tools/probe-cistern-shelf.mjs builds the real fixtures and reads the
    // triangles back; tools/probe-mica-pump.mjs does the atmosphere pass):
    //   Floors. The walkway paving, the chamber discs, the sluice treads, the
    //     runnels, the verge, the drowned aisle and the bell's dry ring all top
    //     out under 0.09 m over the floor they lie on. You walk ON them.
    //   The empty pump benches, 0.309..0.491, and their legs, -0.137..0.399.
    //     Wholly under STEP_UP, which is what round fourteen's 0.111 m of
    //     thinning was for: at 0.611 the seat was over that line and measured
    //     0.001 m from a legal stand -- you stood in the bench.
    //   Route roofs (avgY + 4.86), chamber caps (+5.68 and +6.08), the hatch
    //     door, frame and handle (3.56..3.86), the pump's bell jar (from
    //     2.094) and the broken nave ribs (from 2.203). Too high for the near
    //     plane to reach: the lowest of them, the ribs, measure 0.698 m from a
    //     pose and 0.721 m from a camera even from the raised corridor beside
    //     the chapel. The sluice tooth bars, the sluice lintels, the culvert
    //     lintel and the hatch pull chains are overhead too and are ON the
    //     ledger anyway, for the reason in the paragraph above.
    //   The spray displacement, drawn at opacity 0 until the beat reveals it.
    //   Everything in src/atmosphere.js: the rock skin, the rings, the floor
    //     spikes, the mica trail. That pass seats every instance itself against
    //     this same UNDERFALLS_SOLID_PAD (buildCaveDress's clearOfRoute) and
    //     tools/probe-mica-pump.mjs pins the result. This ledger is for the
    //     fixtures src/underfalls.js draws.
    const NEAR = 0.24;
    const PAD = 0.42;        // UNDERFALLS_SOLID_PAD
    const BODY = 0.32;       // RADIUS less the head bob a collider never sees
    const RADIUS = 0.34, STEP_UP = 0.5, HEAD = 1.75, EYE = 1.62, BOB = 0.02;
    const solids = L.solids || [];
    const colliders = g.world.colliders;
    const roles = new Set(colliders.map((c) => c.role).filter(Boolean));

    const gapTo = (s, px, pz) => {
      const dx = px - s.x, dz = pz - s.z;
      if (s.r !== undefined) return Math.max(0, Math.hypot(dx, dz) - s.r);
      const u = Math.abs(dx * s.nx + dz * s.nz) - s.halfN;
      const v = Math.abs(dx * s.tx + dz * s.tz) - s.halfT;
      return Math.hypot(Math.max(0, u), Math.max(0, v));
    };
    const halfExtent = (s) => (s.r !== undefined
      ? { hx: s.r, hz: s.r }
      : {
        hx: Math.abs(s.nx) * s.halfN + Math.abs(s.tx) * s.halfT,
        hz: Math.abs(s.nz) * s.halfN + Math.abs(s.tz) * s.halfT,
      });

    // Three passes, coarse to fine, so a 3 mm margin is still a margin: a bare
    // 0.05 grid can understate the danger by 0.035 simply by not landing on the
    // worst pose, and the tightest thing here (the hatch chamber's west wall,
    // whose collider IS its drawn box) clears its number by 0.003.
    // Pass/fail only needs need + 0.06 of search halo: the box is the
    // footprint AABB grown by halo, so nothing closer than the owed distance
    // can hide outside it. REPORT_REACH is the rest, and it exists only so the
    // numbers printed below are TRUE minima rather than whatever the corner of
    // a tight search box happened to touch -- at halo 0.38 the fallen bell
    // prints 0.911 when its real nearest stand is 0.44, and the next round
    // would read that and believe it. Anything past the reach prints as
    // "> reach" instead of as a number this cannot back up.
    // (The 0.911/0.44 in that sentence is the fallen bell round fourteen's
    // walkthrough branch measured; the bell hangs again and its stack now
    // prints 0.333, but the reason for REPORT_REACH is unchanged.)
    const REPORT_REACH = 0.45;
    const measureSolid = (s) => {
      const fp = halfExtent(s);
      const need = Math.max(s.guard === 'clamp' ? PAD : BODY, NEAR);
      const halo = need + REPORT_REACH;
      const box = {
        minX: s.x - fp.hx - halo, maxX: s.x + fp.hx + halo,
        minZ: s.z - fp.hz - halo, maxZ: s.z + fp.hz + halo,
      };
      const local = colliders.filter((c) => c.max.x > box.minX - RADIUS
        && c.min.x < box.maxX + RADIUS && c.max.z > box.minZ - RADIUS
        && c.min.z < box.maxZ + RADIUS);
      const found = { body: Infinity, bodyAt: null, cam: Infinity, camAt: null };
      const visit = (x, z) => {
        const p = U.project(x, z);
        if (!p || p.clearance > -0.04) return;
        const feet = U.groundAt(x, z);
        if (feet == null || !Number.isFinite(feet)) return;
        for (const c of local) {
          if (c.max.y <= feet + STEP_UP || c.min.y >= feet + HEAD) continue;
          const qx = Math.min(Math.max(x, c.min.x), c.max.x);
          const qz = Math.min(Math.max(z, c.min.z), c.max.z);
          if (Math.hypot(x - qx, z - qz) < RADIUS) return;
        }
        const eye = feet + EYE;
        const vert = Math.max(0, s.y0 - eye, eye - s.y1);
        const inWindow = s.y1 > feet + STEP_UP && s.y0 < feet + HEAD;
        for (const bob of [-BOB, 0, BOB]) {
          const flat = gapTo(s, x + bob, z);
          const cam = Math.hypot(flat, vert);
          if (cam < found.cam) { found.cam = cam; found.camAt = { x, z }; }
          if (inWindow && flat < found.body) { found.body = flat; found.bodyAt = { x, z }; }
        }
      };
      const sweep = (step, x0, x1, z0, z1) => {
        for (let x = x0; x <= x1 + 1e-9; x += step) {
          for (let z = z0; z <= z1 + 1e-9; z += step) visit(x, z);
        }
      };
      // The last stage matters: two producers here sit EXACTLY on the number
      // they owe, and not by luck. The pump nave pillars carry a collider of
      // exactly their drawn base circumradius and the hatch chamber walls
      // carry a collider that IS their drawn box, so both land at RADIUS less
      // the bob, 0.320, as an identity between the same constants rather than
      // as a measurement. A grid that can be 0.0014 off would flake on them;
      // this one converges to 0.0004, inside the 1e-3 the comparisons allow.
      sweep(0.05, box.minX, box.maxX, box.minZ, box.maxZ);
      for (const refine of [[0.01, 0.06], [0.002, 0.012], [0.0005, 0.003]]) {
        const [step, reach] = refine;
        for (const anchor of [found.bodyAt, found.camAt]) {
          if (!anchor) continue;
          sweep(step, anchor.x - reach, anchor.x + reach, anchor.z - reach, anchor.z + reach);
        }
      }
      found.reach = halo;
      return found;
    };
    const shown = (v, reach) => (v <= reach ? round(v) : `> ${round(reach)}`);

    const started = performance.now();
    const wallFailures = [];
    // Membership is counted in its own pass. The measuring loop below stops at
    // eight failures so a broken build reports something readable instead of
    // 224 lines, and counting inside it would make "missing" mean "we stopped".
    const ledger = new Map();
    const perName = new Map();
    for (const s of solids) ledger.set(s.name, (ledger.get(s.name) || 0) + 1);
    let worstBody = { gap: Infinity, name: null }, worstCam = { gap: Infinity, name: null };
    for (const s of solids) {
      const owed = s.guard === 'clamp' ? PAD : BODY;
      if (s.guard !== 'clamp' && !roles.has(s.guard)) {
        wallFailures.push({ name: s.name, why: `no collider carries the role ${s.guard}` });
        continue;
      }
      if (!Number.isFinite(s.y0) || !Number.isFinite(s.y1)) {
        wallFailures.push({ name: s.name, why: 'ledger entry has no vertical span' });
        continue;
      }
      const m = measureSolid(s);
      if (m.body <= m.reach && m.body < worstBody.gap) {
        worstBody = { gap: round(m.body), name: s.name, guard: s.guard, owed };
      }
      // Per producer, so the next round can read what each fixture is actually
      // holding instead of only the worst one in the district.
      const seen = perName.get(s.name) || { owed, body: Infinity, cam: Infinity, reach: m.reach };
      if (m.body < seen.body) seen.body = m.body;
      if (m.cam < seen.cam) seen.cam = m.cam;
      perName.set(s.name, seen);
      if (m.cam <= m.reach && m.cam < worstCam.gap) {
        worstCam = { gap: round(m.cam), name: s.name, guard: s.guard };
      }
      if (m.body < owed - 1e-3) {
        wallFailures.push({
          name: s.name, guard: s.guard, owed, gap: round(m.body),
          at: m.bodyAt && [round(m.bodyAt.x), round(m.bodyAt.z)],
          inside: m.body < 1e-3, clipped: m.cam < NEAR,
        });
      } else if (m.cam < NEAR - 1e-3) {
        wallFailures.push({
          name: s.name, guard: s.guard, near: NEAR, cameraGap: round(m.cam),
          at: m.camAt && [round(m.camAt.x), round(m.camAt.z)], clipped: true,
        });
      }
      if (wallFailures.length >= 8) break;
    }
    // The ledger's own membership, so "it is not on the list" can never again be
    // the reason a walk-through survives a green gate. Each name here is a
    // producer in src/underfalls.js; deleting one has to fail this, not go quiet.
    const expected = [
      'cave flank wall', 'sluice gate post', 'sluice gate lintel',
      'sluice gate tooth bar', 'underfalls chamber doorjamb',
      'underfalls turn marker', 'culvert mouth lintel', 'pump nave pillar',
      'pump altar drum', 'pump flywheel', 'pump piston', 'hung bell',
      'bell sling',
      'keepsake shelf plank', 'dry keepsakes', 'hatch chamber wall (east)',
      'hatch chamber wall (west)', 'hatch chamber wall (north)',
      'hatch pull chain',
    ];
    const missing = expected.filter((name) => !ledger.has(name));
    check(
      'every drawn silhouette is on the ledger, and no reachable pose stands inside one or near enough for the near plane to delete it',
      solids.length > 0 && missing.length === 0 && wallFailures.length === 0,
      {
        solids: solids.length,
        ledger: Object.fromEntries([...ledger.entries()].sort()),
        missing,
        near: NEAR, clampPad: PAD, colliderPad: BODY,
        worstBody, worstCam,
        gaps: Object.fromEntries([...perName.entries()].sort()
          .map(([name, v]) => [name,
            `body ${shown(v.body, v.reach)} cam ${shown(v.cam, v.reach)} owed ${v.owed}`])),
        ms: Math.round(performance.now() - started),
        failures: wallFailures.slice(0, 8),
      },
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

    // ---- THE BELL, MEASURED ---------------------------------------------
    // This object has moved twice on reasons nobody checked. Round twelve took
    // it down 1.18 m on a claim about an inherited lathe offset that four
    // authored parts contradict; round thirteen moved it 1.95 m sideways and
    // left the chain holding nothing, 1.217 m away. Nothing in this file ever
    // measured it, which is exactly how it drifted. These four checks measure
    // the DRAWN object -- the lathe's own profile, the rim torus, the sling's
    // instance matrices, the vault atmosphere.js draws over it, and the calls
    // the audio engine actually receives -- never the constants that made it.
    const BELL = U.secret;
    const bellAxis = { x: BELL.axis.x, z: BELL.axis.z };
    const HEADH = 1.75, CAPSULE_R = 0.34;   // player.js HEAD, RADIUS
    const floorY = BELL.position.y;

    // 1. THE CHAIN ACTUALLY MEETS THE BELL, AND THE CEILING.
    const sling = BELL.sling;
    const legLen = sling.geometry.parameters.height;
    const slingEnd = (i, sign) => {
      const a = sling.instanceMatrix.array, o = i * 16, h = sign * legLen * 0.5;
      return { x: a[o + 4] * h + a[o + 12], y: a[o + 5] * h + a[o + 13], z: a[o + 6] * h + a[o + 14] };
    };
    const ringR = BELL.rim.geometry.parameters.radius;
    const ringTube = BELL.rim.geometry.parameters.tube;
    const rimLocalY = BELL.rim.position.y;
    const slingFeet = [], slingTops = [];
    for (let i = 0; i < sling.count; i++) {
      const f = slingEnd(i, -1), t = slingEnd(i, 1);
      slingFeet.push(round(Math.hypot(Math.hypot(f.x, f.z) - ringR, f.y - rimLocalY)));
      slingTops.push(round(Math.hypot(t.x, t.y, t.z)));
    }
    const vaults = g.scene.getObjectByName('underfalls chamber ceiling vaults');
    const vaultIndex = L.chambers.findIndex((c) => c.name === 'bell cistern');
    let vaultUnder = null, vaultReach = null, vaultOffset = null;
    if (vaults && vaultIndex >= 0) {
      const a = vaults.instanceMatrix.array, o = vaultIndex * 16;
      vaultUnder = a[o + 13] - Math.hypot(a[o + 4], a[o + 5], a[o + 6]) * 0.5;
      vaultReach = Math.hypot(a[o], a[o + 1], a[o + 2]) * Math.cos(Math.PI / 12);
      vaultOffset = Math.hypot(bellAxis.x - a[o + 12], bellAxis.z - a[o + 14]);
    }
    const drawnCrown = BELL.pivot.position.y + BELL.bell.position.y;
    check(
      'the bell hangs on its chain: both sling feet sit on the rim ring, both tops meet the drawn vault',
      sling.count === 2
        && slingFeet.every((d) => d <= 0.01) && slingTops.every((d) => d <= 0.01)
        && vaultUnder !== null && Math.abs(BELL.pivot.position.y - vaultUnder) <= 0.01
        && vaultOffset < vaultReach
        && Math.abs(drawnCrown - BELL.crownY) <= 1e-6,
      {
        legs: sling.count, footToRimCentreLine: slingFeet, rimTube: round(ringTube),
        topToApex: slingTops, apexY: round(BELL.pivot.position.y),
        vaultUnderside: vaultUnder === null ? null : round(vaultUnder),
        axisOffChamberCentre: vaultOffset === null ? null : round(vaultOffset),
        vaultReach: vaultReach === null ? null : round(vaultReach),
        crownY: round(BELL.crownY), rimY: round(BELL.rimY), floorY: round(floorY),
      },
    );

    // 2. AND IT CARRIES A COLLIDER, BECAUSE A HUNG BELL AT THIS HEIGHT MUST.
    // The crown bottoms out inside the head window, so player.js cannot skip
    // the box as overhead; the box has to start and end at the iron.
    const bellBox = g.world.colliders.find((c) => c.role === 'hung bell');
    check(
      'the hung bell is solid from its crown to its rim, and its crown really is inside the head window',
      !!bellBox && bellBox.underfalls === true
        && Math.abs(bellBox.min.y - BELL.crownY) <= 1e-6
        && Math.abs(bellBox.max.y - BELL.rimY) <= 1e-6
        && BELL.crownY < floorY + HEADH
        && round(bellBox.max.x - bellBox.min.x) === round(BELL.half * 2),
      {
        role: bellBox?.role || null,
        boxY: bellBox ? [round(bellBox.min.y), round(bellBox.max.y)] : null,
        ironY: [round(BELL.crownY), round(BELL.rimY)],
        headWindowTop: round(floorY + HEADH),
        crownInsideHeadWindowBy: round(floorY + HEADH - BELL.crownY),
        halfExtent: BELL.half,
      },
    );

    // 3. NO POSE THE CLAMP AND THE COLLIDER BOTH ACCEPT STANDS INSIDE THE IRON,
    // AT ANY PHASE OF THE SWING. The profile comes off the drawn lathe, the
    // lever arm off the drawn pivot. _moveAxis guarantees only that the
    // player's centre ends at least RADIUS from the box, so that is the
    // permitted set, and every member of it has to clear the swept silhouette.
    const lathePoints = BELL.bell.geometry.parameters.points;
    const laneRadius = (ly) => {
      if (ly <= lathePoints[0].y) return lathePoints[0].x;
      for (let i = 0; i < lathePoints.length - 1; i++) {
        const a = lathePoints[i], b = lathePoints[i + 1];
        if (ly >= a.y && ly <= b.y) return a.x + (b.x - a.x) * ((ly - a.y) / ((b.y - a.y) || 1));
      }
      return lathePoints[lathePoints.length - 1].x;
    };
    // AND THE HEAD WINDOW IS THE POSE'S, NOT THE NODE'S. This scan used to run
    // to floorY + HEAD, which is the window of a player standing at the cistern
    // node's own height -- and nobody stands there. This chamber's floor runs
    // C.y - 0.455 to C.y + 0.350 inside the bell's three metres, and the ground
    // at the nearest stand the box allows is 0.115 m ABOVE the node, so 0.685 m
    // of iron is in that player's window rather than 0.57. Every pose is scored
    // against its own ground now, which is the whole point of the exercise.
    const sweptTo = (top) => {
      let r = 0;
      for (let h = BELL.crownY; h <= top + 1e-9; h += 0.005) {
        const w = laneRadius(h - BELL.crownY) + (BELL.apexY - h) * Math.sin(BELL.maxSwing);
        if (w > r) r = w;
      }
      return r;
    };
    let swept = 0, sweptAt = 0, requiredClear = 0, worstMargin = Infinity;
    let closest = Infinity, closestPose = null, poses = 0;
    for (let x = bellAxis.x - 3.4; x <= bellAxis.x + 3.4; x += 0.025) {
      for (let z = bellAxis.z - 3.4; z <= bellAxis.z + 3.4; z += 0.025) {
        if (!U.contains(x, z, -0.039)) continue;
        const cx = Math.min(Math.max(x, bellBox.min.x), bellBox.max.x);
        const cz = Math.min(Math.max(z, bellBox.min.z), bellBox.max.z);
        if (Math.hypot(x - cx, z - cz) < CAPSULE_R - 1e-9) continue;
        const feet = U.groundAt(x, z);
        if (feet == null || !Number.isFinite(feet)) continue;
        poses++;
        const d = Math.hypot(x - bellAxis.x, z - bellAxis.z);
        if (d < closest) { closest = d; closestPose = [round(x), round(z)]; }
        const reach = sweptTo(feet + HEADH);
        if (reach > swept) { swept = reach; sweptAt = feet + HEADH; }
        const margin = d - CAPSULE_R - reach;
        if (margin < worstMargin) {
          worstMargin = margin;
          requiredClear = reach + CAPSULE_R;
        }
      }
    }
    check(
      'no pose the clamp and the collider both accept stands inside the bell at any phase of its swing',
      poses > 0 && Number.isFinite(closest) && worstMargin > 0,
      {
        poses, requiredClear: round(requiredClear), sweptReach: round(swept),
        widestAtY: round(sweptAt), maxSwing: BELL.maxSwing,
        closestAllowedPose: closestPose, closestDistance: round(closest),
        // the worst pose, not the closest one: on a sloping floor the pose that
        // holds least air is not always the pose that stands nearest.
        worstAirToCapsule: round(worstMargin),
      },
    );

    // 4. HIS ONE CONDITION ON THIS ROUND, PINNED. "make sure that's not what is
    // causing the sound bug where that areas sound can completely go bad." The
    // cistern bell is the largest single reverb-bus event in the game, so what
    // is pinned is its DRIVE: the send any toll may use, and the floor between
    // tolls. Both literals live HERE, not in src, so widening them in src turns
    // this red. The caveDrip round thirteen fired at the same instant and the
    // same point -- a water sound with no drop anywhere in this chamber -- must
    // stay gone. Filtered by position, because bellRing is a shared one-shot.
    const strike = BELL.strikePos;
    const atStrike = (o) => !!o?.pos && Math.hypot(o.pos.x - strike.x, o.pos.z - strike.z) < 0.05;
    const tolls = [];
    let dripAtStrike = 0, simT = 0;
    const realBell = g.audio.bellRing.bind(g.audio);
    const realDrip = g.audio.caveDrip.bind(g.audio);
    g.audio.bellRing = (o = {}) => {
      if (atStrike(o)) tolls.push({ t: simT, verb: o.verb ?? null });
      return realBell(o);
    };
    g.audio.caveDrip = (o = {}) => {
      if (atStrike(o)) dripAtStrike++;
      return realDrip(o);
    };
    placeAt({ x: bellAxis.x - 1.7, z: bellAxis.z, y: floorY });
    g.player.yaw = Math.atan2(-(bellAxis.x - g.player.pos.x), -(bellAxis.z - g.player.pos.z));
    g.player._sync(0);
    let peakLean = 0, closestApproach = Infinity;
    for (let i = 0; i < 120 && !(tolls.length >= 3 && simT >= 20); i++) {
      F.stepWith(0.5, { moveZ: 1, run: true }, false);
      simT += 0.5;
      peakLean = Math.max(peakLean, Math.hypot(U.secret.ax, U.secret.az));
      closestApproach = Math.min(closestApproach,
        Math.hypot(g.player.pos.x - bellAxis.x, g.player.pos.z - bellAxis.z));
    }
    g.audio.bellRing = realBell;
    g.audio.caveDrip = realDrip;
    const tollGaps = tolls.slice(1).map((v, i) => round(v.t - tolls[i].t));
    check(
      'shoving the hung bell rings it, and no toll drives the cave reverb harder or oftener than the live build',
      tolls.length >= 2 && !g.dead
        && tolls.every((v) => v.verb !== null && v.verb <= 0.34 + 1e-9)
        && tollGaps.every((gap) => gap >= 7.3 - 0.51)
        && dripAtStrike === 0
        && peakLean <= BELL.maxSwing + 1e-6,
      {
        seconds: simT, tolls: tolls.length, sends: [...new Set(tolls.map((v) => v.verb))],
        gaps: tollGaps, floor: 7.3, dripsAtTheStrikePoint: dripAtStrike,
        peakLean: round(peakLean), maxSwing: BELL.maxSwing,
        closestApproach: round(closestApproach), faceStop: round(BELL.half + CAPSULE_R),
        dead: g.dead,
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
