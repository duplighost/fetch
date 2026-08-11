// Systemic dead-flight interaction gate.
// The skull remains physically animated during death, but its swept flight may
// not spend puzzle targets, pickups, or exits until a living retry.
import { ensureServer, launchBrowser, openPage, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const report = { checks: [], errors: [] };
let failed = false;

const check = (name, passed, details = null) => {
  const item = { name, passed: !!passed, details };
  report.checks.push(item);
  if (!item.passed) failed = true;
  console.log(`${item.passed ? 'PASS' : 'FAIL'} ${name}${details == null ? '' : ` -- ${JSON.stringify(details)}`}`);
};

const fresh = async () => {
  const opened = await openPage(browser, `http://localhost:${server.port}/?test=1&mute=1`);
  await opened.page.waitForFunction('window.__FETCH && window.__FETCH.ready === true', null,
    { timeout: 60000 });
  return opened;
};

try {
  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('house');
      g.enemies.clear();

      // Prove Game.step passes the authoritative dead-state bit into the real
      // flight dispatcher, rather than relying only on direct test contexts.
      const seen = [];
      const originalCheck = g.skull._checkTargets;
      g.skull._checkTargets = function wrapped(ctx) {
        seen.push(ctx?.interactionsLive);
        return originalCheck.call(this, ctx);
      };
      const high = g.player.pos.clone().add({ x: 0, y: 18, z: 0 });
      F.setSkull(high.x, high.y, high.z, 0, 0, 0, 'outbound');
      g.director.death(null);
      F.stepWith(0.08, { throwHeld: true }, false);
      g.skull._checkTargets = originalCheck;
      const gameCtx = { seen: seen.slice(), allDead: seen.length > 0 && seen.every((v) => v === false) };

      const sweep = (target, interactionsLive) => {
        const p = target.object
          ? target.object.getWorldPosition(g.player.pos.clone())
          : target.pos.clone();
        g.skull.holdNow();
        F.setSkull(p.x - 0.9, p.y, p.z, 0, 0, 0, 'outbound');
        g.skull.prevPos.set(p.x - 0.9, p.y, p.z);
        g.skull.pos.set(p.x + 0.9, p.y, p.z);
        g.skull._checkTargets({ interactionsLive });
        return p.toArray();
      };

      const board = g.world.fetchTargets.find((t) => t.id === 'board0');
      const boardMesh = g.boards[0];
      const boardPoint = sweep(board, false);
      const boardDead = {
        off: !!boardMesh.userData.off,
        target: board.enabled,
        cleared: g.flags.has('cellarBoardsCleared'),
      };
      g.director.respawn();
      const boardRetryPoint = sweep(board, true);
      const boardLive = {
        off: !!boardMesh.userData.off,
        target: board.enabled,
        cleared: g.flags.has('cellarBoardsCleared'),
      };
      return { gameCtx, boardPoint, boardRetryPoint, boardDead, boardLive };
    });
    check('Game.step marks every dead-life skull target pass non-interactive',
      result.gameCtx.allDead, result.gameCtx);
    check('a dead-life swept board crossing spends nothing and the living retry breaks exactly that board',
      !result.boardDead.off && result.boardDead.target && !result.boardDead.cleared
        && result.boardLive.off && !result.boardLive.target && !result.boardLive.cleared,
      result);
    report.errors.push(...errors);
    await page.close();
  }

  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('basement');
      g.enemies.clear();
      const target = g.world.fetchTargets.find((t) => t.id === 'basementPilotFlame');
      const p = target.object.getWorldPosition(g.player.pos.clone());
      const sweep = (interactionsLive) => {
        g.skull.holdNow();
        F.setSkull(p.x - 0.9, p.y, p.z, 0, 0, 0, 'outbound');
        g.skull.prevPos.set(p.x - 0.9, p.y, p.z);
        g.skull.pos.set(p.x + 0.9, p.y, p.z);
        g.skull._checkTargets({ interactionsLive });
      };
      g.director.death(null);
      sweep(false);
      const dead = {
        ateFlame: g.flags.has('ateFlame'),
        pilotUsed: g.flags.has('basementPilotUsed'),
        relay: g.flags.has('windowRelaySolved'),
        target: target.enabled,
        flame: g.basementPilot.flame.visible,
      };
      g.director.respawn();
      sweep(true);
      const live = {
        ateFlame: g.flags.has('ateFlame'),
        pilotUsed: g.flags.has('basementPilotUsed'),
        relay: g.flags.has('windowRelaySolved'),
        source: g.windowRelay.solveSource,
        target: target.enabled,
        flame: g.basementPilot.flame.visible,
      };
      return { dead, live };
    });
    check('a dead-life pilot crossing cannot steal flame or ring the circuit; the living retry can',
      !result.dead.ateFlame && !result.dead.pilotUsed && !result.dead.relay
        && result.dead.target && result.dead.flame
        && result.live.ateFlame && result.live.pilotUsed && result.live.relay
        && result.live.source === 'basement-pilot'
        && !result.live.target && !result.live.flame,
      result);
    report.errors.push(...errors);
    await page.close();
  }

  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('clearing');
      g.enemies.clear();
      const target = g.world.fetchTargets.find((t) => t.id === 'waterfall');
      target.enabled = true;
      const p = target.pos.clone();
      const sweep = (interactionsLive) => {
        g.skull.holdNow();
        F.setSkull(p.x - 4, p.y, p.z, 0, 0, 0, 'outbound');
        g.skull.prevPos.set(p.x - 4, p.y, p.z);
        g.skull.pos.set(p.x + 4, p.y, p.z);
        g.skull._checkTargets({ interactionsLive });
      };
      g.director.death(null);
      sweep(false);
      const dead = {
        taken: g.flags.has('waterfallTaken'),
        mode: g.skull.mode,
        target: target.enabled,
        barrier: [g.bridgeBarrier.min.y, g.bridgeBarrier.max.y],
      };
      g.director.respawn();
      target.enabled = true;
      sweep(true);
      const live = {
        taken: g.flags.has('waterfallTaken'),
        mode: g.skull.mode,
        barrier: [g.bridgeBarrier.min.y, g.bridgeBarrier.max.y],
      };
      return { dead, live };
    });
    check('a dead-life waterfall crossing cannot spend the skull or open the cave; the living retry can',
      !result.dead.taken && result.dead.mode === 'outbound' && result.dead.target
        && result.dead.barrier[1] > result.dead.barrier[0]
        && result.live.taken && result.live.mode === 'gone'
        && result.live.barrier[1] <= result.live.barrier[0],
      result);
    report.errors.push(...errors);
    await page.close();
  }

  check('dead-flight interaction scenarios produce zero browser errors', report.errors.length === 0,
    report.errors);
} finally {
  await browser.close();
  server.stop();
}

writeFileSync(resultsPath('dead-flight-interaction-regression.json'), JSON.stringify(report, null, 2));
if (failed) {
  console.error(`FAIL: ${report.checks.filter((item) => !item.passed).length} failed check(s).`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${report.checks.length} checks, ${report.errors.length} browser errors`);
}
