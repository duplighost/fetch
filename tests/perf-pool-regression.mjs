// Bounded hitch-regression gate: impact fragments plateau at one resident mesh,
// candle lights keep a stable shader light count, and boot shader warm-up never
// leaks the Underfalls light rig into ordinary play.
import { ensureServer, launchBrowser, openPage, URL_BASE } from './lib/harness.mjs';

const failures = [];
const check = (condition, message, detail = '') => {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}${suffix}`);
  if (!condition) failures.push(`${message}${suffix}`);
};

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1&warmup=1`);
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.goreMesh,
    null,
    { timeout: 90000, polling: 100 },
  );

  const initial = await page.evaluate(() => {
    const g = window.__game;
    window.__gorePoolRefs = {
      pool: g.gorePool,
      mesh: g.goreMesh,
      slots: [...g.gorePool],
      positions: g.gorePool.map((slot) => slot.pos),
      velocities: g.gorePool.map((slot) => slot.vel),
    };
    return {
      started: g.started,
      pool: g.goreState(),
      poolLength: g.gorePool.length,
      poolMeshes: g.scene.children.filter((o) => o.userData?.fetchGorePool).length,
      sceneChildren: g.scene.children.length,
      caveLights: g.underfalls.lights.map((light) => light.color.getHex() !== 0 && light.intensity > 0),
      candles: g.world.candlePool.map((light) => ({ visible: light.visible, intensity: light.intensity })),
      enemyTrace: {
        enemies: g.enemies.list.length,
        choir: !!g.enemies.choir,
        spawnSerial: g.enemies._spawnSerial,
        spawnLog: g.spawnLog?.length || 0,
      },
      warmup: { ...g.shaderWarmup },
    };
  });

  check(!initial.started, 'shader warm-up does not start the game');
  check(initial.pool.capacity === 64 && initial.poolLength === 64,
    'impact fragment storage is a fixed 64-slot pool');
  check(initial.poolMeshes === 1, 'one resident InstancedMesh owns every impact fragment');
  check(initial.caveLights.every((emitting) => emitting === false),
    'Underfalls lights are restored before the page becomes ready');
  check(initial.candles.every((light) => light.visible),
    'all candle-pool lights remain resident');

  await page.waitForFunction(
    () => window.__game.shaderWarmup.status !== 'scheduled',
    null,
    { timeout: 90000, polling: 100 },
  );
  const start = await page.evaluate(() => {
    const g = window.__game;
    const warmupStatus = g.shaderWarmup.status;
    const preStartTrace = {
      enemies: g.enemies.list.length,
      choir: !!g.enemies.choir,
      spawnSerial: g.enemies._spawnSerial,
      spawnLog: g.spawnLog?.length || 0,
    };
    const before = performance.now();
    window.__FETCH.start();
    return {
      warmupStatus,
      preStartTrace,
      elapsedMs: performance.now() - before,
      started: g.started,
      titleHidden: g.el.title.classList.contains('hidden'),
      caveLights: g.underfalls.lights.map((light) => light.color.getHex() !== 0 && light.intensity > 0),
    };
  });
  check(start.started && start.titleHidden,
    'start remains synchronous while scheduled shader work settles',
    `${start.warmupStatus}; ${start.elapsedMs.toFixed(3)}ms`);
  check(start.preStartTrace.enemies === initial.enemyTrace.enemies
      && start.preStartTrace.choir === initial.enemyTrace.choir
      && start.preStartTrace.spawnSerial === initial.enemyTrace.spawnSerial
      && start.preStartTrace.spawnLog === initial.enemyTrace.spawnLog,
    'warm-up restores enemy, Choir, serial, and spawn-log gameplay state',
    `${JSON.stringify(initial.enemyTrace)} -> ${JSON.stringify(start.preStartTrace)}`);
  check(start.caveLights.every((emitting) => emitting === false),
    'starting from the title does not activate cave lights');

  await page.waitForFunction(
    () => window.__game.shaderWarmup.status !== 'pending',
    null,
    { timeout: 90000, polling: 100 },
  );
  await page.evaluate(() => {
    // Settle ordinary lazy WebGL uploads before attributing memory movement to
    // the fragment pool itself.
    window.__game.render();
    window.__game.render();
  });

  const first = await page.evaluate(() => {
    const g = window.__game;
    g.gore(g.player.pos, 100, 40);
    g.render();
    return {
      pool: g.goreState(),
      drawCount: g.goreMesh.count,
      sceneChildren: g.scene.children.length,
      geometries: g.renderer.info.memory.geometries,
    };
  });
  check(first.pool.active === 64 && first.drawCount === 64,
    'a 100-fragment burst caps at 64 visible instances');
  check(first.pool.dropped === 36 && first.pool.emitted === 64,
    'overflow is counted and discarded without recycling live fragments');
  check(first.sceneChildren === initial.sceneChildren,
    'a full burst adds no scene objects');

  const second = await page.evaluate(() => {
    const g = window.__game;
    g._updateGore(1.8);
    const expired = g.goreState();
    g.gore(g.player.pos, 100, 40);
    g.render();
    const refs = window.__gorePoolRefs;
    return {
      expired,
      pool: g.goreState(),
      drawCount: g.goreMesh.count,
      sceneChildren: g.scene.children.length,
      geometries: g.renderer.info.memory.geometries,
      samePool: refs.pool === g.gorePool,
      sameMesh: refs.mesh === g.goreMesh,
      sameSlots: refs.slots.every((slot) => g.gorePool.includes(slot)),
      sameVectors: refs.positions.every((v, i) => v === refs.slots[i].pos)
        && refs.velocities.every((v, i) => v === refs.slots[i].vel),
    };
  });
  check(second.expired.active === 0 && second.expired.free === 64,
    'all fragment slots return to the pool after their fixed lifetime');
  check(second.pool.active === 64 && second.pool.emitted === 128 && second.pool.dropped === 72,
    'a second 100-fragment burst reuses the same bounded capacity');
  check(second.samePool && second.sameMesh && second.sameSlots && second.sameVectors,
    'the second burst reuses every pool object and Vector3');
  check(second.sceneChildren === initial.sceneChildren,
    'repeated bursts keep scene-object count flat');
  check(second.geometries === first.geometries,
    'GPU geometry count plateaus after the first burst',
    `${first.geometries} -> ${second.geometries}`);

  const graveSettle = await page.evaluate(() => {
    const g = window.__game;
    const F = window.__FETCH;
    F.teleport('graveyard');
    F.stepWith(0.1, {}, false);
    g.enemies.clear();
    const stone = g.destructibleGraves[0];
    stone.reset();
    g.skull.mode = 'outbound';
    stone.target.onHit(g.skull, stone.target.pos);
    g.skull.mode = 'outbound';
    stone.target.onHit(g.skull, stone.target.pos);
    g.skull.holdNow();
    F.stepWith(8, {}, false);
    const debrisMesh = g.graveDebrisPool.mesh;
    const shaft = g.scene.getObjectByName('destructible hero headstone shafts');
    const base = g.scene.getObjectByName('destructible hero headstone bases');
    const cap = g.scene.getObjectByName('destructible hero headstone crowns');
    const active = g.graveDebrisPool.entries.filter((entry) => entry.active);
    const before = {
      debris: debrisMesh.instanceMatrix.version,
      shaft: shaft.instanceMatrix.version,
      base: base.instanceMatrix.version,
      cap: cap.instanceMatrix.version,
    };
    F.stepWith(5, {}, false);
    const after = {
      debris: debrisMesh.instanceMatrix.version,
      shaft: shaft.instanceMatrix.version,
      base: base.instanceMatrix.version,
      cap: cap.instanceMatrix.version,
    };
    const result = {
      active: active.length,
      settled: active.filter((entry) => entry.settled).length,
      maxSpeed: Math.max(0, ...active.map((entry) => entry.v.length())),
      versions: { before, after },
    };
    stone.reset();
    F.stepWith(0.05, {}, false);
    result.reset = {
      active: g.graveDebrisPool.entries.filter((entry) => entry.active).length,
      owned: g.graveDebrisPool.entries.filter((entry) => entry.owner >= 0).length,
      settled: g.graveDebrisPool.entries.filter((entry) => entry.settled).length,
    };
    return result;
  });
  check(graveSettle.active === 7 && graveSettle.settled === 7 && graveSettle.maxSpeed === 0,
    'grave fragments enter a real settled state instead of bouncing forever',
    JSON.stringify(graveSettle));
  check(Object.keys(graveSettle.versions.before).every((key) =>
    graveSettle.versions.before[key] === graveSettle.versions.after[key]),
  'settled debris and converged hero stones stop dirtying every instance buffer',
  JSON.stringify(graveSettle.versions));
  check(graveSettle.reset.active === 0 && graveSettle.reset.owned === 0
      && graveSettle.reset.settled === 0,
  'death/reset still hides and reclaims every settled grave fragment',
  JSON.stringify(graveSettle.reset));

  const forkSettle = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    F.teleport('forest');
    g.enemies.clear();
    g.director._kneelerGrace = 999;
    F.stepWith(8, {}, false);
    const mesh = g.forest.forkClosureMesh;
    const before = mesh.instanceMatrix.version;
    F.stepWith(5, {}, false);
    return { before, after: mesh.instanceMatrix.version, capacity: mesh.count };
  });
  check(forkSettle.capacity === 60 && forkSettle.before === forkSettle.after,
    'converged fork closures stop rebuilding and uploading all instance matrices',
    JSON.stringify(forkSettle));

  const candle = await page.evaluate(() => {
    const g = window.__game;
    const authored = g.world.candles;
    g.world.candles = [];
    g.world._candleT = 0;
    g.world.updateCandles(1 / 60, g.player.pos, g.time);
    const inactive = g.world.candlePool.map((light) => ({
      visible: light.visible,
      intensity: light.intensity,
      assigned: !!light.userData.c,
    }));
    g.world.candles = authored;
    g.world._candleT = 0;
    g.world.updateCandles(1 / 60, g.player.pos, g.time);
    return inactive;
  });
  check(candle.every((light) => light.visible && light.intensity === 0 && !light.assigned),
    'inactive candle slots stay visible with exactly zero intensity');

  const warmup = await page.evaluate(() => ({
    ...window.__game.shaderWarmup,
    retainedMaterials: window.__game._shaderWarmMaterials?.length || 0,
    caveLights: window.__game.underfalls.lights.map((light) => light.color.getHex() !== 0 && light.intensity > 0),
  }));
  check(warmup.status === 'ready',
    'ordinary, hidden-threat/cave, and grain shader variants finish warming',
    `${warmup.mode}; errors=${warmup.errors.join(' | ') || 'none'}`);
  check(warmup.caveLights.every((emitting) => emitting === false),
    'async completion leaves the Underfalls light rig inactive');
  check(warmup.retainedMaterials === 9,
    'warm-up retains only the nine on-demand threat materials',
    `${warmup.retainedMaterials}`);
  const fallback = await page.evaluate(() => {
    const g = window.__game;
    const compileAsync = g.renderer.compileAsync;
    g.renderer.compileAsync = undefined;
    try {
      return g._compileWarmVariant(g.grainScene, g.grainCam) === null;
    } finally {
      g.renderer.compileAsync = compileAsync;
    }
  });
  check(fallback, 'sync renderer.compile fallback completes without a promise');
  check(errors.length === 0, 'browser emitted no page or console errors', errors.join(' | '));
} finally {
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} performance-pool regression(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nAll performance-pool regressions passed.');
}
