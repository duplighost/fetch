// Failure-state and commitment gate for the 0.3 funeral route.
// Exercises the exact timings most likely to strand a real player: death during
// delayed house mechanisms, forest respawn inside the boss territory, sinking
// before the rope, destructible-grave reset, and first-contact attack fairness.
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
  // ---- House: irreversible delayed mechanisms survive a death scope.
  {
    const { page, errors } = await fresh();
    const house = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('basement');
      g.flag('ateFlame');
      g.flag('pumpGalleryLatched');
      const fireDoor = g.world.interactables.find((o) => o.userData.inter?.id === 'incineratorDoor');
      fireDoor.userData.inter.action();
      F.stepWith(0.2, {}, false);
      const firebox = g.world.fetchTargets.find((t) => t.id === 'firebox');
      g.skull.holdNow();
      g.skull.mode = 'outbound';
      const offer = firebox.onHit.call(firebox, g.skull);
      F.stepWith(0.45, { throwHeld: true }, false);
      g.director.death(null);
      F.stepWith(0.35, {}, false);
      g.director.respawn();
      F.stepWith(3.1, {}, false);
      const key = g.world.fetchTargets.find((t) => t.id === 'hatchKey');
      const offerState = {
        offer,
        offered: g.incinerator.offered,
        refused: g.incinerator.refused,
        fireRefused: g.flags.has('fireRefused'),
        keyEnabled: key.enabled,
        keyVisible: key.object.visible,
        act: g.act,
      };

      // Commit the hatch, then deliberately respawn before its 1.2 s exit.
      g.flag('hatchUnlocked');
      const hatch = g.world.interactables.find((o) => o.userData.inter?.id === 'hatch');
      hatch.userData.inter.action();
      F.stepWith(0.18, {}, false);
      g.director.death(null);
      F.stepWith(0.24, {}, false);
      g.director.respawn();
      const actAfterQuickRespawn = g.act;
      F.stepWith(1.25, {}, false);
      return {
        offerState,
        hatchOpen: g.hatch.open,
        hatchFlag: g.flags.has('hatchOpen'),
        actAfterQuickRespawn,
        finalAct: g.act,
        transitionPending: !!g._basementExit,
      };
    });
    check('death during the incinerator refusal cannot hide or disable the hatch key',
      house.offerState.offer === 'anchor'
        && house.offerState.offered && house.offerState.refused
        && house.offerState.fireRefused && house.offerState.keyEnabled
        && house.offerState.keyVisible,
    house.offerState);
    check('a quick death/respawn cannot cancel an already-open basement hatch exit',
      house.hatchOpen && house.hatchFlag
        && house.actAfterQuickRespawn === 'basement'
        && house.finalAct === 'graveyard' && !house.transitionPending,
    house);
    report.errors.push(...errors);
    await page.close();
  }

  // ---- Forest: lifecycle, boss grace, authored mire, and rope rescue.
  {
    const { page, errors } = await fresh();
    const forest = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('forest');
      const f = g.forest;
      f._lastIdx = f.arenaS();
      g.director._startArena();
      g.director.arena.pending = 2;
      F.teleport('clearing');
      F.stepWith(8, {}, false);
      const clearing = {
        act: g.act,
        arenaStatus: g.director.arena?.status,
        pending: g.director.arena?.pending,
        forestEnemies: g.enemies.list.filter((e) => e.forestArena || e.kind === 'kneeler').length,
      };

      F.teleport('forest');
      g.flag('arenaCleared');
      g.director.arena = { done: true, status: 'complete', pending: 0 };
      const bossS = Math.floor(f.length * 0.9);
      const bossPos = f.posAt(bossS);
      bossPos.y = f.heightAt(bossPos.x, bossPos.z);
      g.player.pos.copy(bossPos);
      f.reseat(bossPos.x, bossPos.z);
      g.checkpoint('forest');
      g.director.kneeler = g.enemies.spawn('kneeler', bossPos.x + 0.5, bossPos.z + 0.5, 'chase');
      g.director.death(g.director.kneeler);
      F.stepWith(1.12, {}, false);
      g.director.respawn();
      F.stepWith(3.0, {}, false);
      const beforeGrace = g.enemies.list.filter((e) => e.kind === 'kneeler').length;
      F.stepWith(0.42, {}, false);
      const afterGrace = g.enemies.list.filter((e) => e.kind === 'kneeler')
        .map((e) => ({ state: e.state, distance: Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z) }));

      g.enemies.clear();
      g.director.kneeler = null;
      const mireS = f.ravineS();
      const mirePos = f.posAt(mireS);
      mirePos.y = f.heightAt(mirePos.x, mirePos.z);
      g.player.pos.copy(mirePos);
      g.player.vel.set(0, 0, 0);
      g.player.grounded = true;
      g.player._sync(0);
      f.reseat(mirePos.x, mirePos.z);
      F.stepWith(0.78, {}, false);
      const mireMid = {
        depth: f._mireDepth,
        y: g.player.pos.y,
        surface: f.heightAt(g.player.pos.x, g.player.pos.z),
        frozen: g.player.frozen,
        movementLocked: g.player.movementLocked,
        skull: g.skull.mode,
        sealBefore: f.sealS,
      };
      F.stepWith(0.35, { moveZ: -1, run: true }, false);
      mireMid.controlDelta = Math.hypot(g.player.pos.x - mirePos.x, g.player.pos.z - mirePos.z);
      mireMid.sealAfter = f.sealS;
      F.stepWith(1.0, {}, false);
      const mireKilled = g.dead;

      // A rope grab is the live-control rescue. The ordinary forest frontier
      // may resume once the player is airborne, but the mire itself must stop.
      g.director.respawn();
      g.player.pos.copy(mirePos);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
      f.reseat(mirePos.x, mirePos.z);
      f._mireDepth = 0.9;
      const rope = g.world.fetchTargets.find((t) => t.id === 'ravineRope');
      rope.enabled = true;
      F.setSkull(rope.pos.x, rope.pos.y, rope.pos.z, 0, 0, 0, 'outbound');
      const ropeDirective = rope.onHit.call(rope, g.skull);
      const sealAtGrab = f.sealS;
      F.stepWith(1.0, { throwHeld: true }, false);
      const rescue = {
        directive: ropeDirective,
        swing: !!g.player.swing,
        dead: g.dead,
        depth: f._mireDepth,
        sealMoved: f.sealS - sealAtGrab,
      };
      return { clearing, beforeGrace, afterGrace, mireMid, mireKilled, rescue };
    });
    check('leaving an unfinished forest arena atomically cancels waves and clears the clearing',
      forest.clearing.act === 'clearing'
        && forest.clearing.arenaStatus === 'cancelled'
        && forest.clearing.pending === 0 && forest.clearing.forestEnemies === 0,
    forest.clearing);
    check('forest respawn gives a real input window before one dormant Kneeler is re-authored',
      forest.beforeGrace === 0 && forest.afterGrace.length === 1
        && forest.afterGrace[0].state === 'dormant',
    { beforeGrace: forest.beforeGrace, afterGrace: forest.afterGrace });
    check('the pre-rope hazard visibly sinks, preserves input, pauses the seal, and kills by depth',
      forest.mireMid.depth > 0.35
        && forest.mireMid.y < forest.mireMid.surface - 0.3
        && !forest.mireMid.frozen && !forest.mireMid.movementLocked
        && forest.mireMid.controlDelta > 0.02
        && Math.abs(forest.mireMid.sealAfter - forest.mireMid.sealBefore) < 0.02
        && forest.mireKilled,
    { ...forest.mireMid, killed: forest.mireKilled });
    check('grabbing the rope arrests the mire without stealing the held-release verb',
      forest.rescue.directive === 'anchor' && forest.rescue.swing
        && !forest.rescue.dead && forest.rescue.depth < 0.08,
      forest.rescue);
    report.errors.push(...errors);
    await page.close();
  }

  // ---- Forest chasers: scoped delay cancellation must not spend the event.
  {
    const { page, errors } = await fresh();
    const chasers = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('forest');
      g.checkpoint('forest');
      g.enemies.clear();
      g.director.kneeler = null;
      g.director._kneelerGrace = 999;
      let walkerSpawns = 0;
      const originalSpawn = g.enemies.spawn.bind(g.enemies);
      g.enemies.spawn = (...args) => {
        const enemy = originalSpawn(...args);
        if (args[0] === 'walker') {
          walkerSpawns++;
          // Keep this lifecycle probe about scheduling, not a stationary-player
          // combat outcome after the rear chaser arrives.
          enemy.state = 'dormant';
        }
        return enemy;
      };

      g.flag('treeCleared');
      g.flag('ropeLatched');
      F.stepWith(1 / 120, {}, false);
      const firstSchedule = {
        scope: g.director._scope,
        tree: g.director._chaser1,
        rope: g.director._chaser2,
        walkerSpawns,
      };

      // Cancel both scoped callbacks before either delay resolves. The next
      // forest life must own fresh reservations, not the dead life's booleans.
      g.director.death(null);
      g.director.respawn();
      g.director._kneelerGrace = 999;
      F.stepWith(1 / 120, {}, false);
      const firstRetry = {
        scope: g.director._scope,
        tree: g.director._chaser1,
        rope: g.director._chaser2,
        staleScopedBeats: g.director.beats.filter((beat) =>
          beat.scope !== null && beat.scope !== g.director._scope).length,
        walkerSpawns,
      };

      // Repeat while both fresh callbacks are still pending. This catches a
      // reset that works once but accumulates duplicate beats across retries.
      F.stepWith(1.5, {}, false);
      g.director.death(null);
      g.director.respawn();
      g.director._kneelerGrace = 999;
      F.stepWith(1 / 120, {}, false);
      const secondRetry = {
        scope: g.director._scope,
        tree: g.director._chaser1,
        rope: g.director._chaser2,
        staleScopedBeats: g.director.beats.filter((beat) =>
          beat.scope !== null && beat.scope !== g.director._scope).length,
        walkerSpawns,
      };

      F.stepWith(6.2, {}, false);
      const liveChasers = g.enemies.list
        .filter((enemy) => enemy.forestChaser)
        .map((enemy) => enemy.forestChaser).sort();
      const resolved = {
        tree: g.director._chaser1,
        rope: g.director._chaser2,
        liveChasers,
        walkerSpawns,
        dead: g.dead,
      };

      // A spawned consequence is spent. Respawn clears its body, but must not
      // interpret that cleanup as permission to author a second copy.
      g.director.death(null);
      g.director.respawn();
      g.director._kneelerGrace = 999;
      F.stepWith(7, {}, false);
      const afterSpawnRetry = {
        tree: g.director._chaser1,
        rope: g.director._chaser2,
        liveChasers: g.enemies.list.filter((enemy) => enemy.forestChaser).length,
        walkerSpawns,
        dead: g.dead,
      };
      return { firstSchedule, firstRetry, secondRetry, resolved, afterSpawnRetry };
    });
    check('a death before either forest chaser delay releases and re-arms both reservations',
      chasers.firstSchedule.tree === 'scheduled'
        && chasers.firstSchedule.rope === 'scheduled'
        && chasers.firstSchedule.walkerSpawns === 0
        && chasers.firstRetry.scope > chasers.firstSchedule.scope
        && chasers.firstRetry.tree === 'scheduled'
        && chasers.firstRetry.rope === 'scheduled'
        && chasers.firstRetry.staleScopedBeats === 0
        && chasers.firstRetry.walkerSpawns === 0,
      { first: chasers.firstSchedule, retry: chasers.firstRetry });
    check('repeated pre-delay deaths still resolve to exactly one tree and one rope chaser',
      chasers.secondRetry.tree === 'scheduled'
        && chasers.secondRetry.rope === 'scheduled'
        && chasers.secondRetry.staleScopedBeats === 0
        && chasers.secondRetry.walkerSpawns === 0
        && chasers.resolved.tree === 'spawned'
        && chasers.resolved.rope === 'spawned'
        && chasers.resolved.walkerSpawns === 2
        && chasers.resolved.liveChasers.length === 2
        && chasers.resolved.liveChasers[0] === 'rope-latched'
        && chasers.resolved.liveChasers[1] === 'tree-cleared'
        && !chasers.resolved.dead,
      { retry: chasers.secondRetry, resolved: chasers.resolved });
    check('death after the forest chasers spawn never duplicates the spent consequences',
      chasers.afterSpawnRetry.tree === 'spawned'
        && chasers.afterSpawnRetry.rope === 'spawned'
        && chasers.afterSpawnRetry.walkerSpawns === 2
        && chasers.afterSpawnRetry.liveChasers === 0
        && !chasers.afterSpawnRetry.dead,
      chasers.afterSpawnRetry);
    report.errors.push(...errors);
    await page.close();
  }

  // ---- One physical throw may advance one layer, and an aborted held pull
  // must give back its progress before the same mechanism can be retried.
  {
    const { page, errors } = await fresh();
    const commitments = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('forest');
      g.enemies.clear();
      const tree = g.world.fetchTargets.find((target) => target.id === 'fallenTree');
      const layerState = () => [0, 1, 2].map((layer) => {
        const colliders = g.world.colliders.filter((c) => c.fallenTreeLayer === layer);
        return colliders.length > 0 && colliders.every((c) => c.max.y <= c.min.y + 0.0001);
      });
      g.skull.mode = 'outbound';
      const firstDirective = tree.onHit.call(tree, g.skull, tree.object.position);
      const afterOutbound = layerState();
      g.skull.mode = 'returning';
      const returnDirective = tree.onHit.call(tree, g.skull, tree.object.position);
      const afterReturn = layerState();
      g.skull.mode = 'outbound';
      tree.onHit.call(tree, g.skull, tree.object.position);
      const afterSecondThrow = layerState();
      g.skull.mode = 'outbound';
      tree.onHit.call(tree, g.skull, tree.object.position);
      const afterThirdThrow = layerState();
      // The third strike starts a physical clear, rather than disabling an
      // invisible wall under a trunk that still spans the route. Let the real
      // dt-driven settle finish before checking the solved contract.
      F.stepWith(1.2, {}, false);
      const setpiece = g.fallenTreeSetpiece;
      const settledOffset = Math.hypot(
        setpiece.log.position.x - setpiece.center.x,
        setpiece.log.position.z - setpiece.center.z,
      );
      const activeLogColliders = setpiece.colliders
        .filter((c) => c.max.y > c.min.y + 0.0001).length;
      const treeResult = {
        firstDirective,
        returnDirective,
        afterOutbound,
        afterReturn,
        afterSecondThrow,
        afterThirdThrow,
        cleared: g.flags.has('treeCleared'),
        targetEnabled: tree.enabled,
        settledOffset,
        settledPosition: setpiece.log.position.toArray(),
        collidersCleared: setpiece.roll.collidersCleared,
        activeLogColliders,
      };
      g.skull.holdNow();

      F.teleport('graveyard');
      g.enemies.clear();
      const resonant = g.world.fetchTargets.find((target) => target.id === 'resonantGrave:1');
      const ritualCreditsBefore = g.director.graveRitual?.credits?.size || 0;
      g.skull.mode = 'returning';
      const ritualReturnDirective = resonant.onHit.call(resonant, g.skull, resonant.object.position);
      const ritualCreditsAfter = g.director.graveRitual?.credits?.size || 0;
      g.skull.holdNow();
      g.ossuary.unlock('ritual');
      const state = g.ossuary;
      const target = state.target;
      const shortPull = () => {
        g.skull.mode = 'outbound';
        const directive = target.onHit.call(target, g.skull, target.object.position);
        F.stepWith(0.42, { throwHeld: true }, false);
        const peak = state.progress;
        g.skull.holdNow();
        F.stepWith(0.48, {}, false);
        return { directive, peak, afterRest: state.progress, enabled: target.enabled };
      };
      const firstShort = shortPull();
      const secondShort = shortPull();
      g.skull.mode = 'outbound';
      const committedDirective = target.onHit.call(target, g.skull, target.object.position);
      F.stepWith(1.82, { throwHeld: true }, false);
      return {
        tree: treeResult,
        ritualReturn: {
          directive: ritualReturnDirective,
          before: ritualCreditsBefore,
          after: ritualCreditsAfter,
        },
        ossuary: {
          firstShort,
          secondShort,
          committedDirective,
          progress: state.progress,
          solved: state.solved,
          flag: g.flags.has('ossuaryCleared'),
        },
      };
    });
    check('one outbound throw removes exactly one fallen-tree layer and its return leg removes none',
      commitments.tree.firstDirective === 'return'
        && commitments.tree.returnDirective === 'continue'
        && JSON.stringify(commitments.tree.afterOutbound) === JSON.stringify([true, false, false])
        && JSON.stringify(commitments.tree.afterReturn) === JSON.stringify([true, false, false])
        && JSON.stringify(commitments.tree.afterSecondThrow) === JSON.stringify([true, true, false])
        && commitments.tree.afterThirdThrow[0] && commitments.tree.afterThirdThrow[1]
        && commitments.tree.cleared && !commitments.tree.targetEnabled
        && commitments.tree.settledOffset > 5.5
        && commitments.tree.collidersCleared
        && commitments.tree.activeLogColliders === 0,
    commitments.tree);
    check('short ossuary pulls decay instead of banking progress between retries',
      commitments.ossuary.firstShort.directive === 'anchor'
        && commitments.ossuary.firstShort.peak > 0.15
        && commitments.ossuary.firstShort.afterRest < 0.001
        && commitments.ossuary.firstShort.enabled
        && commitments.ossuary.secondShort.peak > 0.15
        && commitments.ossuary.secondShort.afterRest < 0.001
        && commitments.ossuary.secondShort.enabled,
      commitments.ossuary);
    check('a returning skull cannot solve a second resonant grave backwards',
      commitments.ritualReturn.directive === 'continue'
        && commitments.ritualReturn.before === commitments.ritualReturn.after,
      commitments.ritualReturn);
    check('one uninterrupted ossuary hold still opens the exit and surface gate',
      commitments.ossuary.committedDirective === 'anchor'
        && commitments.ossuary.progress === 1
        && commitments.ossuary.solved && commitments.ossuary.flag,
    commitments.ossuary);
    report.errors.push(...errors);
    await page.close();
  }

  // ---- Grave tactics and universal attack commitment.
  {
    const { page, errors } = await fresh();
    const combat = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('graveyard');
      g.enemies.clear();
      const grave = g.destructibleGraves[0];
      const target = grave.target;
      const helper = g.enemies.spawn('walker', grave.x + 1.1, grave.z, 'chase');
      g.skull.mode = 'outbound';
      target.onHit.call(target, g.skull, target.pos);
      g.skull.mode = 'returning';
      const returnDirective = target.onHit.call(target, g.skull, target.pos);
      F.stepWith(0.3, {}, false);
      const first = { hits: grave.hits, target: target.enabled, colliderY: grave.collider.max.y,
        returnDirective };
      g.skull.mode = 'outbound';
      target.onHit.call(target, g.skull, target.pos);
      g.skull.holdNow();
      F.stepWith(0.8, {}, false);
      const broken = {
        hits: grave.hits,
        target: target.enabled,
        colliderY: grave.collider.max.y,
        helperState: helper.state,
        activeDebris: g.graveDebrisPool.entries.filter((d) => d.active).length,
        capacity: g.graveDebrisPool.capacity,
      };
      g.checkpoint('graveyard');
      g.director.death(null);
      F.stepWith(1.12, {}, false);
      g.director.respawn();
      const reset = {
        hits: grave.hits,
        target: target.enabled,
        colliderY: grave.collider.max.y,
        activeDebris: g.graveDebrisPool.entries.filter((d) => d.active).length,
      };

      g.enemies.clear();
      const p = { x: 0, z: 20 };
      g.player.pos.set(p.x, g.world.groundHeightAt(p.x, p.z, 3), p.z);
      g.player.vel.set(0, 0, 0);
      g.player.yaw = 0;
      g.player._sync(0);
      const walker = g.enemies.spawn('walker', 0, 20.72, 'chase');
      F.stepWith(1 / 120, {}, false);
      const contact = { dead: g.dead, state: walker.state, strike: walker.strikePos.toArray() };
      F.stepWith(0.82, { moveZ: 1, run: true }, false);
      const dodge = {
        dead: g.dead,
        state: walker.state,
        moved: Math.hypot(g.player.pos.x - p.x, g.player.pos.z - p.z),
        strike: walker.strikePos.toArray(),
      };

      g.enemies.clear();
      g.dead = false;
      g.player.frozen = false;
      g.player.movementLocked = false;
      g.player.pos.set(0, g.world.groundHeightAt(0, 20, 3), 20);
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      const resident = g.enemies.spawn('resident', 0, 20.72, 'chase');
      F.stepWith(1 / 120, {}, false);
      const residentContact = { dead: g.dead, state: resident.state };
      F.stepWith(0.9, {}, false);
      return { first, broken, reset, contact, dodge, residentContact, stayedDead: g.dead };
    });
    check('hero gravestones chip, then topple into a walkable tactical stun with bounded debris',
      combat.first.hits === 1 && combat.first.returnDirective === 'continue'
        && combat.first.target && combat.first.colliderY > 1
        && combat.broken.hits === 2 && !combat.broken.target
        && combat.broken.colliderY <= 0.25 && combat.broken.helperState === 'stunned'
        && combat.broken.activeDebris > 0
        && combat.broken.activeDebris <= combat.broken.capacity,
    { first: combat.first, broken: combat.broken });
    check('death before grave resolution restores stone visuals, collision, target, and debris pool',
      combat.reset.hits === 0 && combat.reset.target
        && combat.reset.colliderY > 1 && combat.reset.activeDebris === 0,
    combat.reset);
    check('ordinary enemy contact begins a fixed-point tell and real sprint input can evade it',
      !combat.contact.dead && combat.contact.state === 'strike'
        && !combat.dodge.dead && combat.dodge.moved > 1.2
        && combat.dodge.state !== 'strike'
        && JSON.stringify(combat.contact.strike) === JSON.stringify(combat.dodge.strike),
    { contact: combat.contact, dodge: combat.dodge });
    check('holding still through the Resident tell preserves the one-hit consequence',
      !combat.residentContact.dead && combat.residentContact.state === 'strike'
        && combat.stayedDead,
    { contact: combat.residentContact, stayedDead: combat.stayedDead });
    report.errors.push(...errors);
    await page.close();
  }

  // ---- Noise economy: permanent violence and loud world objects have a
  // bounded, recoverable consequence at the position that made the sound.
  {
    const { page, errors } = await fresh();
    const noise = await page.evaluate(() => {
      const g = window.__game, F = window.__FETCH;
      F.start();
      F.teleport('house');
      g.enemies.clear();
      g.director.resident = null;
      g.director.onPop({ pos: g.player.pos.clone() });
      const house = {
        resident: !!g.director.resident,
        kind: g.director.resident?.kind,
        pressure: g.director.residentPressure,
      };

      F.teleport('forest');
      g.enemies.clear();
      g.director.arena = null;
      g.director._companyDebt = 0;
      g.director._companyPending = 0;
      const source = g.forest.posAt(24);
      const sleeper = g.enemies.spawn('walker', source.x + 1.2, source.z, 'dormant');
      const accepted = g.director.forestNoise(source, 1, 'appliance');
      const immediate = {
        accepted,
        sleeper: sleeper.state,
        debt: g.director._companyDebt,
        pending: g.director._companyPending,
      };
      F.stepWith(2.35, {}, false);
      const firstCompany = g.enemies.list.filter((e) => e.forestCompany).length;
      g.enemies.clear();
      F.stepWith(6.0, {}, false);
      const drained = g.director._companyDebt;
      g.director.forestNoise(source, 0.8, 'appliance');
      F.stepWith(2.35, {}, false);
      const invitedAgain = g.enemies.list.filter((e) => e.forestCompany).length;
      return { house, immediate, firstCompany, drained, invitedAgain };
    });
    check('a house pop immediately teaches the Resident where violence happened',
      noise.house.resident && noise.house.kind === 'resident' && noise.house.pressure >= 1,
    noise.house);
    check('forest world-noise wakes locally, invites bounded company, then forgives quiet',
      noise.immediate.accepted && noise.immediate.sleeper === 'wind'
        && noise.immediate.debt > 0 && noise.immediate.pending === 1
        && noise.firstCompany === 1 && noise.drained < 0.05 && noise.invitedAgain === 1,
    noise);
    report.errors.push(...errors);
    await page.close();
  }

  check('all failure-state scenarios produce zero browser errors', report.errors.length === 0, report.errors);
} finally {
  await browser.close();
  server.stop();
}

writeFileSync(resultsPath('failure-state-regression.json'), JSON.stringify(report, null, 2));
if (failed) {
  console.error(`FAIL: ${report.checks.filter((item) => !item.passed).length} failed check(s).`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${report.checks.length} checks, ${report.errors.length} browser errors`);
}
