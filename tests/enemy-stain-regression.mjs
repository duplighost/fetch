// Focused deterministic lifecycle gate for enemy pop stains:
//   node tests/enemy-stain-regression.mjs
// Pop history survives an ordinary death/respawn, but its one-draw-call ring
// can never grow the scene without bound and has one explicit full-reset owner.
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
    () => window.__FETCH?.ready === true && window.__game?.enemies?.stainPool,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const poolsInScene = () => g.scene.children.filter((o) => o.userData?.fetchEnemyStainPool);
    F.start();
    g.enemies.resetStains();

    // Isolate the stain lifecycle from audiovisual/pop-director side effects.
    // `_pop` remains the production entry point under test.
    const original = {
      impact: g.impact,
      pop: g.audio.pop,
      gore: g.gore,
      flag: g.flag,
      wakeAll: g.enemies.wakeAll,
      onPop: g.director.onPop,
    };
    g.impact = () => {};
    g.audio.pop = () => {};
    g.gore = () => {};
    g.flag = () => {};
    g.enemies.wakeAll = () => {};
    g.director.onPop = () => {};

    try {
      const pool = g.enemies.stainPool;
      const initialPool = poolsInScene();
      const initialChildren = g.scene.children.length;
      const capacity = g.enemies.stainState().capacity;
      const attempts = capacity * 3 + 7;
      let first = null;
      let latest = null;

      for (let i = 0; i < attempts; i++) {
        const pos = g.player.pos.clone().set(-10 + i * 0.03, 0.8, 18 + i * 0.02);
        if (i === 0) first = pos.clone();
        latest = pos.clone();
        g.enemies._pop({ pos, graveClaimed: false, loop: null }, 1, 0, 20);
      }

      const saturated = g.enemies.stainState();
      const matrix = g.camera.matrixWorld.clone();
      const positions = [];
      for (let i = 0; i < pool.count; i++) {
        pool.getMatrixAt(i, matrix);
        positions.push([matrix.elements[12], matrix.elements[14]]);
      }
      const has = (pos) => positions.some(([x, z]) =>
        Math.abs(x - pos.x) < 1e-5 && Math.abs(z - pos.z) < 1e-5);
      const sceneAfterPops = poolsInScene();

      check(
        'repeated production pops saturate one fixed-capacity stain draw call',
        initialPool.length === 1
          && initialPool[0] === pool
          && sceneAfterPops.length === 1
          && sceneAfterPops[0] === pool
          && g.scene.children.length === initialChildren
          && saturated.visible === capacity
          && saturated.totalPlaced === attempts
          && pool.count === capacity,
        {
          capacity,
          attempts,
          state: saturated,
          scenePools: sceneAfterPops.length,
          sceneChildrenDelta: g.scene.children.length - initialChildren,
        },
      );
      check(
        'ring recycling retains the newest history and evicts the oldest mark',
        has(latest) && !has(first),
        { first: [first.x, first.z], latest: [latest.x, latest.z], visible: positions.length },
      );

      const beforeRespawn = g.enemies.stainState();
      g.lastCheckpoint = 'bedroom';
      g.checkpointPose = null;
      g.director.respawn();
      const afterRespawn = g.enemies.stainState();
      check(
        'ordinary respawn intentionally preserves bounded visible pop history',
        g.enemies.stainPool === pool
          && pool.parent === g.scene
          && afterRespawn.visible === beforeRespawn.visible
          && afterRespawn.totalPlaced === beforeRespawn.totalPlaced
          && afterRespawn.nextSlot === beforeRespawn.nextSlot
          && pool.count === capacity,
        { beforeRespawn, afterRespawn, act: g.act, poolStillMounted: pool.parent === g.scene },
      );

      const reset = g.enemies.resetStains();
      const afterResetPools = poolsInScene();
      check(
        'the enemy system owns one explicit full-reset boundary without reallocating the pool',
        reset.visible === 0
          && reset.totalPlaced === 0
          && reset.nextSlot === 0
          && pool.count === 0
          && afterResetPools.length === 1
          && afterResetPools[0] === pool,
        { reset, scenePools: afterResetPools.length },
      );

      const refillPos = g.player.pos.clone().set(3.25, 0.8, -5.75);
      g.enemies._pop({ pos: refillPos, graveClaimed: false, loop: null }, 0, 1, 20);
      const refilled = g.enemies.stainState();
      check(
        'a reset pool starts a fresh bounded history in place',
        refilled.visible === 1
          && refilled.totalPlaced === 1
          && refilled.nextSlot === 1
          && pool.count === 1
          && poolsInScene().length === 1,
        refilled,
      );
    } finally {
      g.impact = original.impact;
      g.audio.pop = original.pop;
      g.gore = original.gore;
      g.flag = original.flag;
      g.enemies.wakeAll = original.wakeAll;
      g.director.onPop = original.onPop;
    }

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
  writeFileSync(resultsPath('enemy-stain-regression.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
