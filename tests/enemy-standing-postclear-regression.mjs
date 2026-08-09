// Deterministic post-arena contract for the graveyard's Standing Kind:
//   node tests/enemy-standing-postclear-regression.mjs
// During a live horde they occupy readable orbit slots. Once the arena is done,
// their original law returns: watched means stone-still; unobserved means move.
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.enemies,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => +n.toFixed(4);

    F.start();
    // Enter with the completion flag already set so Director cannot start a new
    // wave while the focused enemy-state simulation advances.
    g.flags.add('graveyardCleared');
    F.teleport('graveyard');
    g.enemies.clear();
    g.dead = false;
    g.player.frozen = false;
    g.player.movementLocked = false;
    g.director.graveArena = { wave: 3, pending: 0, t: 0, done: true, engaged: false };

    const playerX = 2;
    const playerZ = 22;
    const enemyX = 2;
    const enemyZ = 28;
    const playerY = g.world.groundHeightAt(playerX, playerZ, 3);
    g.player.pos.set(playerX, playerY, playerZ);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;

    const spawnStanding = () => {
      const enemy = g.enemies.spawn('walker', enemyX, enemyZ, 'standing');
      enemy.standing = true;
      enemy.gravePressure = true;
      enemy.home = { x: enemy.pos.x, z: enemy.pos.z };
      enemy.graveClaimed = false;
      return enemy;
    };
    const aimAt = (enemy) => {
      const eyeY = g.player.pos.y + 1.62;
      const dx = enemy.pos.x - g.player.pos.x;
      const dy = enemy.pos.y + 1.35 - eyeY;
      const dz = enemy.pos.z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      g.player._sync(0);
      g.camera.updateMatrixWorld(true);
    };
    const lookAway = (enemy) => {
      aimAt(enemy);
      g.player.yaw += Math.PI;
      g.player.pitch = 0;
      g.player._sync(0);
      g.camera.updateMatrixWorld(true);
    };

    const watched = spawnStanding();
    aimAt(watched);
    const watchedStart = watched.pos.clone();
    F.stepWith(0.8, {}, false);
    const watchedMoved = watched.pos.distanceTo(watchedStart);
    check(
      'a watched Standing Kind is motionless again after the grave arena is complete',
      watched.state === 'standing'
        && watched._losClear === true
        && watchedMoved < 0.02
        && !watched.graveClaimed,
      {
        moved: round(watchedMoved),
        state: watched.state,
        losClear: watched._losClear,
        claimed: !!watched.graveClaimed,
        arenaDone: g.director.graveArena.done,
      },
    );

    g.enemies.clear();
    const unwatched = spawnStanding();
    lookAway(unwatched);
    const unwatchedStart = unwatched.pos.clone();
    const distanceBefore = unwatched.pos.distanceTo(g.player.pos);
    F.stepWith(0.8, {}, false);
    const unwatchedMoved = unwatched.pos.distanceTo(unwatchedStart);
    const distanceAfter = unwatched.pos.distanceTo(g.player.pos);
    check(
      'an unwatched post-clear Standing Kind resumes its silent approach law',
      unwatched.state === 'standing'
        && unwatchedMoved > 0.45
        && distanceBefore - distanceAfter > 0.45
        && !g.dead,
      {
        moved: round(unwatchedMoved),
        distanceBefore: round(distanceBefore),
        distanceAfter: round(distanceAfter),
        state: unwatched.state,
        dead: g.dead,
        arenaDone: g.director.graveArena.done,
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
  writeFileSync(resultsPath('enemy-standing-postclear-regression.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
