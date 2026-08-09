// Focused real-input regression for the graveyard horde:
//   node tests/grave-arena-regression.mjs
// Every seed gets a fresh page and fights all three production waves through
// the sacred press / hold / release skull grammar. A separate fresh life proves
// that a graveyard death cancels old beats and rebuilds a clean, playable arena.
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';

const SEEDS = [0x31, 0x91, 0x12d, 0x247, 0x401, 0x6a1];
const server = await ensureServer();
const browser = await launchBrowser();
const report = {
  url: `${URL_BASE}/?test=1&mute=1`,
  seeds: [],
  respawn: null,
  checks: [],
  browserErrors: [],
};
let exit = 0;

async function freshPage() {
  const opened = await openPage(browser, report.url);
  await opened.page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 90000, polling: 100 },
  );
  return opened;
}

async function runSeed(seed) {
  const { page, errors } = await freshPage();
  const result = await page.evaluate((runSeedValue) => {
    const F = window.__FETCH;
    const g = window.__game;
    let randomState = runSeedValue >>> 0;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };

    const trace = [];
    const strikes = [];
    const deaths = [];
    const maxClaims = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let maxSimultaneousStrikes = 0;
    let unclaimedStrikes = 0;
    let pops = 0;
    let quietStuns = 0;
    let resonancePulses = 0;
    let minThreatDistance = Infinity;
    const stateBefore = new WeakMap();

    const originalUpdate = g.enemies.update.bind(g.enemies);
    g.enemies.update = (dt, ctx) => {
      for (const enemy of g.enemies.list) stateBefore.set(enemy, enemy.state);
      originalUpdate(dt, ctx);
      const wave = g.director.graveArena?.wave ?? 0;
      const arena = g.enemies.list.filter((enemy) => enemy.graveArena && enemy.kind === 'walker'
        && enemy.state !== 'dying');
      const claimed = arena.filter((enemy) => enemy.graveClaimed);
      maxClaims[wave] = Math.max(maxClaims[wave] || 0, claimed.length);
      maxSimultaneousStrikes = Math.max(maxSimultaneousStrikes,
        arena.filter((enemy) => enemy.state === 'strike').length);
      for (const enemy of arena) {
        const distance = Math.hypot(enemy.pos.x - g.player.pos.x, enemy.pos.z - g.player.pos.z);
        minThreatDistance = Math.min(minThreatDistance, distance);
        if (enemy.state === 'strike' && stateBefore.get(enemy) !== 'strike') {
          const entry = {
            at: +g.time.toFixed(3), wave, claimed: !!enemy.graveClaimed,
            distance: +distance.toFixed(3),
            player: [g.player.pos.x, g.player.pos.z].map((n) => +n.toFixed(2)),
            enemy: [enemy.pos.x, enemy.pos.z].map((n) => +n.toFixed(2)),
            simultaneousClaims: claimed.length,
          };
          strikes.push(entry);
          if (!enemy.graveClaimed) unclaimedStrikes++;
        }
        if (stateBefore.get(enemy) !== 'stunned' && enemy.state === 'stunned') quietStuns++;
      }
    };

    const originalDeath = g.director.death.bind(g.director);
    g.director.death = (enemy) => {
      deaths.push({
        at: +g.time.toFixed(3),
        wave: g.director.graveArena?.wave ?? 0,
        attacker: enemy && {
          state: enemy.state,
          claimed: !!enemy.graveClaimed,
          pressure: !!enemy.gravePressure,
          pos: [enemy.pos.x, enemy.pos.z].map((n) => +n.toFixed(2)),
        },
        player: [g.player.pos.x, g.player.pos.z].map((n) => +n.toFixed(2)),
        claims: g.enemies.list.filter((e) => e.graveClaimed).map((e) => ({
          state: e.state,
          pos: [e.pos.x, e.pos.z].map((n) => +n.toFixed(2)),
        })),
      });
      return originalDeath(enemy);
    };
    const originalOnPop = g.director.onPop.bind(g.director);
    g.director.onPop = (enemy) => {
      pops++;
      return originalOnPop(enemy);
    };

    const originalPulse = g.enemies.resonancePulse.bind(g.enemies);
    g.enemies.resonancePulse = (...args) => {
      resonancePulses++;
      return originalPulse(...args);
    };

    const aimAt = (x, y, z) => {
      const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
      const dx = x - ex, dy = y - ey, dz = z - ez;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const walkTo = (x, z, maxS = 25, run = false) => {
      let elapsed = 0;
      while (elapsed < maxS && !g.dead) {
        const dx = x - g.player.pos.x, dz = z - g.player.pos.z;
        if (Math.hypot(dx, dz) < 0.7) return true;
        g.player.yaw = Math.atan2(-dx, -dz);
        F.stepWith(0.1, { moveZ: 1, run }, false);
        elapsed += 0.1;
      }
      return Math.hypot(x - g.player.pos.x, z - g.player.pos.z) < 1.5;
    };

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.25, {}, false);
    walkTo(-4, 14, 20);
    walkTo(2, 21, 25);

    let graveStrafe = Math.random() < 0.5 ? -1 : 1;
    const forwardBias = (Math.random() - 0.5) * 0.14;
    const graveThrowPoint = (x, y, z) => {
      aimAt(x, y, z);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      const distance = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
      F.stepWith(Math.min(2.6, distance / 20 + 0.22), {
        throwHeld: true, moveX: graveStrafe, moveZ: forwardBias, run: true,
      }, false);
      F.stepWith(1 / 120, {
        throwReleased: true, moveX: graveStrafe, moveZ: forwardBias, run: true,
      }, false);
      let returnT = 0;
      while (g.skull.mode !== 'held' && returnT < 3.5 && !g.dead) {
        const nearest = g.enemies.list
          .filter((enemy) => enemy.graveArena && enemy.state !== 'dying')
          .sort((a, b) => a.pos.distanceToSquared(g.player.pos) - b.pos.distanceToSquared(g.player.pos))[0];
        if (nearest) {
          let awayX = g.player.pos.x - nearest.pos.x;
          let awayZ = g.player.pos.z - nearest.pos.z;
          if (g.player.pos.x < -16) awayX += (-16 - g.player.pos.x) * 4;
          if (g.player.pos.x > 20) awayX -= (g.player.pos.x - 20) * 4;
          if (g.player.pos.z < 10) awayZ += (10 - g.player.pos.z) * 4;
          if (g.player.pos.z > 39) awayZ -= (g.player.pos.z - 39) * 4;
          g.player.yaw = Math.atan2(-awayX, -awayZ);
          g.player._sync(0);
        }
        F.stepWith(0.1, { moveZ: 1, run: true }, false);
        returnT += 0.1;
      }
      graveStrafe *= -1;
    };

    let guard = 0;
    let lastWave = -1;
    while (!g.flags.has('graveyardCleared') && !g.dead && guard < 260) {
      guard++;
      const wave = g.director.graveArena?.wave ?? 0;
      if (wave !== lastWave) {
        lastWave = wave;
        trace.push({ at: +g.time.toFixed(2), wave, player: [g.player.pos.x, g.player.pos.z].map((n) => +n.toFixed(1)) });
      }
      const enemies = g.enemies.list.filter((enemy) => enemy.graveArena
        && enemy.kind === 'walker' && enemy.state !== 'dying');
      if (!enemies.length) {
        F.stepWith(0.35, {}, false);
        continue;
      }
      const distanceTo = (enemy) => Math.hypot(enemy.pos.x - g.player.pos.x, enemy.pos.z - g.player.pos.z);
      const downed = enemies.filter((enemy) => enemy.state === 'stunned' && (enemy.iframes || 0) <= 0)
        .sort((a, b) => distanceTo(a) - distanceTo(b));
      const threats = enemies.filter((enemy) => enemy.state !== 'stunned')
        .sort((a, b) => distanceTo(a) - distanceTo(b));
      const imminent = threats.find((enemy) => enemy.state === 'strike' && distanceTo(enemy) < 2.5);
      if (imminent) {
        let evadeT = 0;
        while (!g.dead && imminent.state === 'strike' && evadeT < 0.9) {
          let awayX = g.player.pos.x - imminent.pos.x;
          let awayZ = g.player.pos.z - imminent.pos.z;
          if (g.player.pos.x < -16) awayX += (-16 - g.player.pos.x) * 4;
          if (g.player.pos.x > 20) awayX -= (g.player.pos.x - 20) * 4;
          if (g.player.pos.z < 10) awayZ += (10 - g.player.pos.z) * 4;
          if (g.player.pos.z > 39) awayZ -= (g.player.pos.z - 39) * 4;
          g.player.yaw = Math.atan2(-awayX, -awayZ);
          g.player._sync(0);
          F.stepWith(0.1, { moveZ: 1, run: true }, false);
          evadeT += 0.1;
        }
        continue;
      }
      const urgentClaimant = threats.find((enemy) => enemy.graveClaimed && distanceTo(enemy) < 5.5);
      if (urgentClaimant) {
        graveThrowPoint(urgentClaimant.pos.x, urgentClaimant.pos.y + 1.2, urgentClaimant.pos.z);
        continue;
      }
      const readyGraves = (g.resonantGraves || []).filter((grave) => grave.cooldown <= 0.01)
        .map((grave) => {
          const p = grave.group.position;
          return {
            grave,
            caught: threats.filter((enemy) => Math.hypot(enemy.pos.x - p.x, enemy.pos.z - p.z) <= 8.2).length,
          };
        })
        .sort((a, b) => b.caught - a.caught);
      if (!downed.length && readyGraves[0]?.caught >= 2) {
        const p = readyGraves[0].grave.shaft.getWorldPosition(g.player.pos.clone());
        graveThrowPoint(p.x, p.y, p.z);
        continue;
      }
      const target = threats[0] && distanceTo(threats[0]) < 5.5
        ? threats[0]
        : downed[0] || threats[0];
      if (!target) {
        F.stepWith(0.25, {}, false);
        continue;
      }
      graveThrowPoint(target.pos.x, target.pos.y + 1.2, target.pos.z);
    }

    return {
      seed: runSeedValue,
      clear: g.flags.has('graveyardCleared'),
      dead: g.dead,
      wave: g.director.graveArena?.wave ?? 0,
      guard,
      simTime: +g.time.toFixed(2),
      player: [g.player.pos.x, g.player.pos.y, g.player.pos.z].map((n) => +n.toFixed(2)),
      skullMode: g.skull.mode,
      controlsLive: !g.player.frozen && !g.player.movementLocked,
      maxClaims,
      maxSimultaneousStrikes,
      unclaimedStrikes,
      strikes,
      deaths,
      pops,
      quietStuns,
      resonancePulses,
      minThreatDistance: Number.isFinite(minThreatDistance) ? +minThreatDistance.toFixed(3) : null,
      trace,
      remaining: g.enemies.list.filter((enemy) => enemy.graveArena && enemy.state !== 'dying')
        .map((enemy) => ({ state: enemy.state, claimed: !!enemy.graveClaimed,
          pos: [enemy.pos.x, enemy.pos.z].map((n) => +n.toFixed(2)) })),
    };
  }, seed);
  report.browserErrors.push(...errors.map((error) => `seed ${seed}: ${error}`));
  await page.close();
  return result;
}

async function runRespawn() {
  const { page, errors } = await freshPage();
  const result = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    F.start();
    F.teleport('graveyard');
    g.player.pos.set(2, g.world.groundHeightAt(2, 21, 2), 21);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.1, {}, false);

    g.enemies.clear((enemy) => enemy.graveArena);
    g.director.beats = g.director.beats.filter((beat) => beat.scope !== g.director._scope);
    g.director.graveArena = { wave: 1, pending: 0, t: 99, done: false };
    const killer = g.enemies.spawn('walker', 2, 21.65, 'chase');
    killer.graveArena = true;
    killer.windT = 9;
    F.stepWith(0.75, {}, false);
    const died = g.dead && g.player.movementLocked;
    let staleBeat = 0;
    g.director.after(0.35, () => { staleBeat++; });
    const deadScope = g.director._scope;
    g.director.respawn();
    const startX = g.player.pos.x, startZ = g.player.pos.z;
    F.stepWith(1.3, {}, false);
    const beforeMove = [g.player.pos.x, g.player.pos.z];
    F.stepWith(0.45, { moveZ: 1, run: true }, false);
    const moved = Math.hypot(g.player.pos.x - beforeMove[0], g.player.pos.z - beforeMove[1]);
    return {
      died,
      dead: g.dead,
      act: g.act,
      scopeAdvanced: g.director._scope > deadScope,
      staleBeat,
      frozen: g.player.frozen,
      movementLocked: g.player.movementLocked,
      deathOverlayHidden: g.el.die.classList.contains('hidden'),
      arena: g.director.graveArena,
      graveSpawned: !!g.director._graveSpawned,
      gate: g.graveyardGate && { open: g.graveyardGate.open, opening: g.graveyardGate.opening },
      initialThreats: g.enemies.list.filter((enemy) => enemy.graveArena || enemy.gravePressure)
        .map((enemy) => ({ state: enemy.state, arena: !!enemy.graveArena, pressure: !!enemy.gravePressure })),
      graveClaimRecovery: g.enemies._graveClaimRecovery,
      skullMode: g.skull.mode,
      respawnPos: [startX, startZ].map((n) => +n.toFixed(2)),
      moved: +moved.toFixed(3),
    };
  });
  report.browserErrors.push(...errors.map((error) => `respawn: ${error}`));
  await page.close();
  return result;
}

try {
  for (const seed of SEEDS) {
    const result = await runSeed(seed);
    report.seeds.push(result);
    console.log(`seed ${seed}: ${result.clear && !result.dead ? 'PASS' : 'FAIL'} wave=${result.wave} guard=${result.guard} strikes=${result.strikes.length}`);
  }
  report.respawn = await runRespawn();

  const check = (name, passed, details = null) => {
    report.checks.push({ name, passed: !!passed, details });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
    if (!passed) exit = 1;
  };
  check('all fresh seeded real-input fights clear three waves alive',
    report.seeds.every((seed) => seed.clear && !seed.dead && seed.wave === 3),
    report.seeds.map((seed) => ({ seed: seed.seed, clear: seed.clear, dead: seed.dead,
      wave: seed.wave, guard: seed.guard, deaths: seed.deaths })));
  check('every fight uses quiet stuns and deliberate loud pops',
    report.seeds.every((seed) => seed.pops >= 16 && seed.quietStuns >= seed.pops && seed.skullMode === 'held'),
    report.seeds.map((seed) => ({ seed: seed.seed, pops: seed.pops,
      quietStuns: seed.quietStuns, pulses: seed.resonancePulses, skull: seed.skullMode })));
  check('only claimed walkers enter a graveyard strike',
    report.seeds.every((seed) => seed.unclaimedStrikes === 0),
    report.seeds.map((seed) => ({ seed: seed.seed, unclaimed: seed.unclaimedStrikes })));
  check('attack-token budget remains bounded in every wave',
    report.seeds.every((seed) => seed.maxClaims[1] <= 1 && seed.maxClaims[2] <= 2
      && seed.maxClaims[3] <= 2 && seed.maxSimultaneousStrikes <= 1),
    report.seeds.map((seed) => ({ seed: seed.seed, claims: seed.maxClaims,
      simultaneousStrikes: seed.maxSimultaneousStrikes })));
  check('the token system actually applies late-wave pressure and commits a claimed strike',
    report.seeds.every((seed) => seed.maxClaims[1] >= 1 && seed.maxClaims[2] >= 2
      && seed.maxClaims[3] >= 2)
      && report.seeds.some((seed) => seed.strikes.length > 0),
    report.seeds.map((seed) => ({ seed: seed.seed, claims: seed.maxClaims,
      strikes: seed.strikes.length })));
  check('combat never steals player controls',
    report.seeds.every((seed) => seed.controlsLive),
    report.seeds.map((seed) => ({ seed: seed.seed, controls: seed.controlsLive })));
  check('death is real and respawn returns a fresh graveyard life',
    report.respawn.died && !report.respawn.dead && report.respawn.act === 'graveyard'
      && report.respawn.scopeAdvanced && report.respawn.staleBeat === 0
      && !report.respawn.frozen && !report.respawn.movementLocked
      && report.respawn.deathOverlayHidden && report.respawn.arena == null
      && report.respawn.graveSpawned && report.respawn.gate?.open === false
      && report.respawn.skullMode === 'held' && report.respawn.moved > 0.25,
    report.respawn);
  check('browser produced no errors', report.browserErrors.length === 0, report.browserErrors);
} catch (error) {
  exit = 1;
  report.fatal = error && (error.stack || error.message) || String(error);
  console.error(report.fatal);
} finally {
  writeFileSync(resultsPath('grave-arena-regression.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.stop();
}

process.exit(exit);
