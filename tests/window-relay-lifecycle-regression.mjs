// Window-trolley lifecycle regression.
// A held skull keeps simulating while the death overlay arrives, so this gate
// deliberately leaves the physical mouse state held beyond the trolley's
// 22-second failsafe. Neither death nor an act exit may ring the bell, release
// the cellar, or leave a stale apparition; a living retry must still solve.
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
      g.skull.holdNow();
      const relay = g.windowRelay;
      const departure = relay.departureTarget;
      g.skull.mode = 'outbound';
      const directive = departure.onHit.call(departure, g.skull, departure.object.position);
      // Put the physical trolley at the release-qualified end. If the dead-life
      // anchor is merely allowed to time out, this exact setup ghost-solves.
      relay.mooring.position.z = 0.72;
      relay.visitor.active = true;
      relay.visitor.progress = 2.72;
      relay.visitor.entered = true;
      g.director.death(null);
      F.stepWith(23.1, { throwHeld: true }, false);
      const duringDeath = {
        directive,
        dead: g.dead,
        solved: relay.solved,
        armed: relay.armed,
        state: relay.state,
        mooringZ: relay.mooring.position.z,
        skullMode: g.skull.mode,
        skullAnchor: g.skull.anchor?.puzzleId || null,
        visitor: {
          active: relay.visitor.active,
          progress: relay.visitor.progress,
          entered: relay.visitor.entered,
          stage: relay.visitor.stage,
          proof: relay.visitor.proof.visible,
        },
        flags: [...g.flags],
        blocker: [relay.plateCollider.min.y, relay.plateCollider.max.y],
      };

      g.director.respawn();
      F.stepWith(0.8, {}, false);
      const rearmed = departure.enabled && g.skull.mode === 'held'
        && g.act === 'house' && !relay.armed && !relay.solved;
      // Retry the same mechanism, then perform its authored release at the
      // study end. This is not a direct-bell shortcut.
      g.skull.mode = 'outbound';
      const retryDirective = departure.onHit.call(departure, g.skull, departure.object.position);
      relay.mooring.position.z = 0.72;
      F.stepWith(0.12, { throwHeld: true }, false);
      F.stepWith(1 / 120, { throwReleased: true, throwHeld: false }, false);
      F.stepWith(0.8, {}, false);
      const retry = {
        rearmed,
        retryDirective,
        solved: relay.solved,
        source: relay.solveSource,
        flag: g.flags.has('windowRelaySolved'),
        door: g.flags.has('voidDoorOpen'),
        blocker: [relay.plateCollider.min.y, relay.plateCollider.max.y],
      };
      return { duringDeath, retry };
    });
    check('death while the trolley is held cannot time out into a ghost bell solve',
      result.duringDeath.directive === 'anchor'
        && result.duringDeath.dead
        && !result.duringDeath.solved && !result.duringDeath.armed
        && result.duringDeath.state === 'idle'
        && Math.abs(result.duringDeath.mooringZ + 9) < 0.001
        && result.duringDeath.skullAnchor === null
        && !result.duringDeath.flags.includes('windowRelaySolved')
        && !result.duringDeath.flags.includes('voidDoorOpen')
        && result.duringDeath.blocker[1] > result.duringDeath.blocker[0],
      result.duringDeath);
    check('death clears the unsolved window apparition and wet proof with the trolley',
      !result.duringDeath.visitor.active
        && result.duringDeath.visitor.progress === 0
        && !result.duringDeath.visitor.entered
        && result.duringDeath.visitor.stage === -1
        && !result.duringDeath.visitor.proof,
      result.duringDeath.visitor);
    check('respawn re-arms the physical trolley and a living release still solves once',
      result.retry.rearmed && result.retry.retryDirective === 'anchor'
        && result.retry.solved && result.retry.source === 'trolley-release'
        && result.retry.flag && result.retry.door
        && result.retry.blocker[1] < -10,
      result.retry);
    report.errors.push(...errors);
    await page.close();
  }

  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('house');
      g.enemies.clear();
      const relay = g.windowRelay;
      const departure = relay.departureTarget;
      g.skull.holdNow();
      g.skull.mode = 'outbound';
      departure.onHit.call(departure, g.skull, departure.object.position);
      relay.mooring.position.z = 0.72;
      // Preserve the live anchor and physical button but leave the house act.
      // The relay ticker itself must reject the now-invalid context.
      g.act = 'basement';
      F.stepWith(23.1, { throwHeld: true }, false);
      const exited = {
        solved: relay.solved,
        armed: relay.armed,
        state: relay.state,
        mooringZ: relay.mooring.position.z,
        skullAnchor: g.skull.anchor?.puzzleId || null,
        targetEnabled: departure.enabled,
        flags: [...g.flags],
      };
      g.act = 'house';
      F.stepWith(0.8, {}, false);
      return {
        ...exited,
        returnedMode: g.skull.mode,
        returnedTargetEnabled: departure.enabled,
      };
    });
    check('leaving the house while held aborts the trolley without a late receiver commit',
      !result.solved && !result.armed && result.state === 'idle'
        && Math.abs(result.mooringZ + 9) < 0.001
        && result.skullAnchor === null && !result.targetEnabled
        && !result.flags.includes('windowRelaySolved')
        && !result.flags.includes('voidDoorOpen')
        && result.returnedMode === 'held' && result.returnedTargetEnabled,
      result);
    report.errors.push(...errors);
    await page.close();
  }

  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('house');
      g.enemies.clear();
      const c = g.sculleryCrawler;
      const look = () => {
        const dx = c.focus.x - g.player.pos.x;
        const dy = c.focus.y - (g.player.pos.y + 1.62);
        const dz = c.focus.z - g.player.pos.z;
        g.player.yaw = Math.atan2(-dx, -dz);
        g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        g.player._sync(0);
      };
      g.player.pos.set(7, 0, 3.8);
      g.player.vel.set(0, 0, 0);
      look();
      F.stepWith(1.1, {}, false);
      const beforeExit = { progress: c.progress, stage: c.stage, triggered: c.triggered };
      g.act = 'basement';
      F.stepWith(2.4, {}, false);
      const duringExit = {
        progress: c.progress,
        stage: c.stage,
        visible: c.root.visible,
        vanished: c.vanished,
      };
      g.act = 'house';
      look();
      F.stepWith(0.6, {}, false);
      const afterReturn = { progress: c.progress, stage: c.stage, visible: c.root.visible };

      // An uncommitted pre-entry sighting resets on death instead of spending
      // stages under the overlay.
      g.director.death(null);
      F.stepWith(1.3, {}, false);
      const afterDeath = {
        progress: c.progress,
        stage: c.stage,
        triggered: c.triggered,
        visible: c.root.visible,
        vanished: c.vanished,
      };
      return { beforeExit, duringExit, afterReturn, afterDeath };
    });
    check('leaving the house pauses the scullery crawl and re-entry resumes the same stage',
      result.beforeExit.triggered && result.beforeExit.progress > 0
        && Math.abs(result.duringExit.progress - result.beforeExit.progress) < 0.001
        && result.duringExit.stage === result.beforeExit.stage
        && !result.duringExit.visible && !result.duringExit.vanished
        && result.afterReturn.progress > result.beforeExit.progress
        && result.afterReturn.visible,
      result);
    check('death before the crawler enters resets the uncommitted sighting without a vanish flag',
      result.afterDeath.progress === 0 && result.afterDeath.stage === -1
        && !result.afterDeath.triggered && !result.afterDeath.visible
        && !result.afterDeath.vanished,
      result.afterDeath);
    report.errors.push(...errors);
    await page.close();
  }

  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('house');
      g.enemies.clear();
      const c = g.sculleryCrawler;
      const look = () => {
        const dx = c.focus.x - g.player.pos.x;
        const dy = c.focus.y - (g.player.pos.y + 1.62);
        const dz = c.focus.z - g.player.pos.z;
        g.player.yaw = Math.atan2(-dx, -dz);
        g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        g.player._sync(0);
      };
      g.player.pos.set(7, 0, 3.8);
      g.player.vel.set(0, 0, 0);
      look();
      F.stepWith(5.8, {}, false);
      for (let i = 0; i < 180 && !c.resolving; i++) {
        look();
        F.stepWith(1 / 60, { moveZ: 1, moveX: 0.35 }, false);
      }
      const committed = {
        entered: c.entered,
        resolving: c.resolving,
        progress: c.progress,
        resolveT: c.resolveT,
        reason: c.resolveReason,
      };
      g.director.death(null);
      F.stepWith(1.3, {}, false);
      const duringDeath = {
        resolving: c.resolving,
        resolved: c.resolved,
        vanished: c.vanished,
        resolveT: c.resolveT,
        visible: c.root.visible,
      };
      g.director.respawn();
      F.stepWith(0.72, {}, false);
      const afterRespawn = {
        resolved: c.resolved,
        vanished: c.vanished,
        visible: c.root.visible,
        reason: c.resolveReason,
        progress: c.progress,
        wetProof: c.proof.children.filter((mark) => mark.visible).length,
      };
      return { committed, duringDeath, afterRespawn };
    });
    check('death pauses a committed proximity recoil and respawn finishes it without replaying the crawl',
      result.committed.entered && result.committed.resolving
        && result.committed.reason === 'proximity-recoil'
        && result.duringDeath.resolving && !result.duringDeath.resolved
        && !result.duringDeath.vanished && !result.duringDeath.visible
        && Math.abs(result.duringDeath.resolveT - result.committed.resolveT) < 0.001
        && result.afterRespawn.resolved && result.afterRespawn.vanished
        && !result.afterRespawn.visible
        && result.afterRespawn.reason === 'proximity-recoil'
        && Math.abs(result.afterRespawn.progress - result.committed.progress) < 0.001
        && result.afterRespawn.wetProof >= 4,
      result);
    report.errors.push(...errors);
    await page.close();
  }

  {
    const { page, errors } = await fresh();
    const result = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('house');
      const relay = g.windowRelay;
      const visitor = relay.visitor;
      // Isolate the already-earned post-solve crossing. It must wait for a
      // living house frame rather than animate and finish under the death veil.
      relay.solved = true;
      visitor.entered = true;
      visitor.crossed = true;
      visitor.crossT = 0.31;
      visitor.guestCrossing.visible = true;
      g.director.death(null);
      F.stepWith(0.72, {}, false);
      const duringDeath = {
        crossT: visitor.crossT,
        visible: visitor.guestCrossing.visible,
      };
      g.director.respawn();
      F.stepWith(0.42, {}, false);
      return {
        duringDeath,
        resumedCrossT: visitor.crossT,
        resumedVisible: visitor.guestCrossing.visible,
      };
    });
    check('the earned guest-window crossing pauses under death and resumes only in live play',
      Math.abs(result.duringDeath.crossT - 0.31) < 0.001
        && !result.duringDeath.visible
        && result.resumedCrossT > result.duringDeath.crossT
        && result.resumedVisible,
      result);
    report.errors.push(...errors);
    await page.close();
  }

  check('window relay lifecycle scenarios produce zero browser errors', report.errors.length === 0,
    report.errors);
} finally {
  await browser.close();
  server.stop();
}

writeFileSync(resultsPath('window-relay-lifecycle-regression.json'), JSON.stringify(report, null, 2));
if (failed) {
  console.error(`FAIL: ${report.checks.filter((item) => !item.passed).length} failed check(s).`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${report.checks.length} checks, ${report.errors.length} browser errors`);
}
