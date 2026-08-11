// Human-readability contract for the expanded Underfalls plus the cellar
// doorway debris retirement requested from main.js. No HUD/text/input changes:
// route meaning must live in value, silhouette, motion, space, and positional sound.
import { writeFileSync } from 'node:fs';
import {
  ensureServer, launchBrowser, openPage, URL_BASE, resultsPath, shotPath,
} from './lib/harness.mjs';

const report = {
  url: `${URL_BASE}/?test=1&mute=1`,
  checks: [],
  browserErrors: [],
  shots: [],
};
let failed = false;
const server = await ensureServer();
const browser = await launchBrowser();

try {
  const opened = await openPage(browser, report.url, { width: 1600, height: 900 });
  const { page } = opened;
  report.browserErrors = opened.errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game?.underfalls?.routeGuide,
    null, { timeout: 90000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    const U = g.underfalls, L = U.layout, guide = U.routeGuide;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const round = (n) => Number.isFinite(n) ? +n.toFixed(4) : null;
    const exteriorRock = g.scene.children.find((root) =>
      root.isMesh && root.material === g.mats.rock) || null;
    check(
      'the dedicated Underfalls shell is bound and hidden outside its district',
      !!U.shellRoot && U.shellRoot.material === U.shellMaterial
        && U.renderRoots.includes(U.shellRoot) && U.shellRoot.visible === false,
      {
        shell: U.shellRoot && { name: U.shellRoot.name, visible: U.shellRoot.visible },
        exteriorRock: exteriorRock && { name: exteriorRock.name, visible: exteriorRock.visible },
      },
    );

    // The open cellar throat may own a brief clatter, never permanent boards.
    F.start();
    g.director._residentPending = false;
    for (const board of g.boards) if (!board.userData.off) g.detachBoard(board);
    F.stepWith(1.36, {}, false);
    const boardState = g.boards.map((board) => ({
      retired: board.userData.retired,
      age: round(board.userData.detachAge),
      visible: board.visible,
      parent: board.parent?.uuid || null,
      pos: [round(board.position.x), round(board.position.y), round(board.position.z)],
    }));
    const door = g.world.doorById.cellarDoor;
    door.locked = null;
    door.setOpen(true);
    const oldPos = g.player.pos.clone();
    const oldVel = g.player.vel.clone();
    g.player.pos.set(door.group.position.x + 0.65, 0, door.group.position.z - 1.25);
    g.player.vel.set(0, 0, 0);
    const startZ = g.player.pos.z;
    for (let i = 0; i < 32; i++) g.player._moveAxis(0, 0.09);
    const walkedZ = g.player.pos.z - startZ;
    g.player.pos.copy(oldPos);
    g.player.vel.copy(oldVel);
    g.player._sync(0);
    check(
      'all three detached cellar boards retire wholly within the 1.4-second contract',
      boardState.length === 3 && boardState.every((board) => board.retired
        && !board.visible && board.parent === null && board.age <= 1.4),
      boardState,
    );
    check(
      'the open cellar door leaves full player-capsule travel through its former visual throat',
      door.open && door.collider.max.y === door.collider.min.y && walkedZ > 2.35,
      { open: door.open, colliderHeight: door.collider.max.y - door.collider.min.y, walkedZ: round(walkedZ) },
    );

    // Enter through the same irreversible condition as the real waterfall.
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');
    F.stepWith(0.12, {}, false);
    check(
      'cave entry exposes only its structural rock batch and retires the exterior rock batch',
      U.shellRoot.visible === true && exteriorRock?.visible === false,
      { shellVisible: U.shellRoot.visible, exteriorRockVisible: exteriorRock?.visible },
    );

    const matrices = [];
    const matrix = g.camera.matrixWorld.clone();
    for (let i = 0; i < guide.markers.count; i++) {
      guide.markers.getMatrixAt(i, matrix);
      const e = matrix.elements;
      const length = Math.hypot(e[8], e[10]) || 1;
      const data = guide.markerData[i];
      matrices.push({
        dot: (e[8] / length) * data.forwardX + (e[10] / length) * data.forwardZ,
        x: e[12], y: e[13], z: e[14],
      });
    }
    const guideOwnedTargets = g.world.fetchTargets.filter((target) =>
      target.object === guide.markers || target.object === guide.drySlates
      || guide.hatchSignal.children.includes(target.object));
    const guideOwnedInteracts = g.world.interactables.filter((object) =>
      object === guide.markers || object === guide.drySlates
      || guide.hatchSignal.children.includes(object));
    const guideOwnedColliders = g.world.colliders.filter((collider) =>
      collider.object === guide.markers || collider.object === guide.drySlates
      || collider.role?.includes?.('route calcite'));
    check(
      'one bounded instanced calcite current covers the complete required route',
      guide.metrics.requiredDraws === 1
        && guide.metrics.requiredMarkers === guide.markers.count
        && guide.markers.count >= 50 && guide.markers.count <= 72
        && guide.metrics.mainRouteMeters === L.mainLength,
      { metrics: guide.metrics, count: guide.markers.count },
    );
    check(
      'every current flake physically points into its next route leg',
      matrices.every((entry) => entry.dot > 0.985),
      { minDot: round(Math.min(...matrices.map((entry) => entry.dot))) },
    );
    check(
      'wayfinding geometry remains non-colliding, non-interactive, and progression-neutral',
      guideOwnedTargets.length === 0 && guideOwnedInteracts.length === 0
        && guideOwnedColliders.length === 0,
      { fetchTargets: guideOwnedTargets.length, interacts: guideOwnedInteracts.length, colliders: guideOwnedColliders.length },
    );

    const beforeColors = Array.from(guide.markers.instanceColor.array);
    const entrance = L.main[0];
    g.player.pos.set(entrance.x, entrance.y, entrance.z);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.38, {}, false);
    const afterColors = Array.from(guide.markers.instanceColor.array);
    const changed = afterColors.reduce((count, value, i) =>
      count + (Math.abs(value - beforeColors[i]) > 1e-4 ? 1 : 0), 0);
    const aheadValues = guide.markerData.map((data, i) => ({
      d: data.routeDistance,
      value: afterColors[i * 3],
    })).filter((entry) => entry.d >= 0 && entry.d <= 22);
    const behindValues = guide.markerData.map((data, i) => ({
      d: data.routeDistance,
      value: afterColors[i * 3],
    })).filter((entry) => entry.d > 35);
    check(
      'the required route hands motion forward through a changing high-value current',
      // Only the authored 22 m handoff window should animate; comparing its
      // changed channels against every marker on the 125 m route incorrectly
      // treats the deliberately quiet far route as a missing pulse.
      changed >= Math.floor(aheadValues.length * 3 * 0.7)
        && Math.max(...aheadValues.map((entry) => entry.value))
          > Math.max(...behindValues.map((entry) => entry.value)) + 0.18,
      {
        changedChannels: changed,
        aheadMax: round(Math.max(...aheadValues.map((entry) => entry.value))),
        farMax: round(Math.max(...behindValues.map((entry) => entry.value))),
      },
    );

    const dry = guide.drySlates;
    const dryColorMax = Math.max(dry.material.color.r, dry.material.color.g, dry.material.color.b);
    const dryMatrixVersion = dry.instanceMatrix.version;
    F.stepWith(0.55, {}, false);
    check(
      'the optional culvert has a separate dark crosswise cadence and no moving destination signal',
      dry.count === guide.metrics.optionalDrySlates && dry.count === 5
        && dryColorMax < 0.13 && dry.instanceMatrix.usage !== guide.markers.instanceColor.usage
        && dry.instanceMatrix.version === dryMatrixVersion,
      {
        count: dry.count,
        colorMax: round(dryColorMax),
        matrixVersion: [dryMatrixVersion, dry.instanceMatrix.version],
      },
    );

    const shaft = guide.hatchSignal.getObjectByName('hatch light shaft');
    const halo = guide.hatchSignal.getObjectByName('hatch ceiling halo');
    const hatchDoor = U.hatch.group.children[0];
    const hatchDoorWorldY = U.hatch.group.position.y + hatchDoor.position.y;
    const prior = L.main[L.main.length - 2];
    const revealDistance = Math.hypot(L.hatch.x - prior.x, L.hatch.z - prior.z);
    check(
      'the final hatch owns a distant vertical shaft and bright ring at its exact world position',
      !!shaft && !!halo && guide.hatchSignal.visible
        && Math.hypot(shaft.position.x - L.hatch.x, shaft.position.z - L.hatch.z) < 0.01
        && Math.hypot(halo.position.x - L.hatch.x, halo.position.z - L.hatch.z) < 0.01
        && revealDistance > 10 && shaft.position.y < hatchDoorWorldY,
      {
        revealDistance: round(revealDistance),
        shaft: shaft && [round(shaft.position.x), round(shaft.position.y), round(shaft.position.z)],
        halo: halo && [round(halo.position.x), round(halo.position.y), round(halo.position.z)],
      },
    );
    g.player.pos.set(prior.x, U.groundAt(prior.x, prior.z), prior.z);
    g.player._sync(0);
    const rayOrigin = g.camera.getWorldPosition(g.player.pos.clone());
    const rayTarget = U.hatch.group.position.clone();
    rayTarget.y += 2.72;
    g._ray.set(rayOrigin, rayTarget.sub(rayOrigin).normalize());
    g._ray.far = revealDistance + 2;
    const effectiveVisible = (object) => {
      for (let at = object; at; at = at.parent) if (at.visible === false) return false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.length && materials.every((material) => !material
          || material.visible === false || material.opacity === 0)) return false;
      return true;
    };
    const hatchHits = g._ray.intersectObjects(g.scene.children, true)
      .filter((hit) => effectiveVisible(hit.object));
    const hatchFirst = hatchHits[0] || null;
    check(
      'the final hatch shaft has an unobstructed authored sightline from the preceding leg',
      !!hatchFirst && (hatchFirst.object === shaft || hatchFirst.object.parent === U.hatch.group),
      {
        first: hatchFirst && {
          name: hatchFirst.object.name,
          parent: hatchFirst.object.parent?.name || '',
          distance: round(hatchFirst.distance),
          instanceId: hatchFirst.instanceId ?? null,
        },
        hits: hatchHits.slice(0, 6).map((hit) => ({
          name: hit.object.name,
          parent: hit.object.parent?.name || '',
          distance: round(hit.distance),
          instanceId: hit.instanceId ?? null,
        })),
      },
    );

    const calls = [];
    const realDrip = g.audio.caveDrip;
    g.audio.caveDrip = (options) => calls.push({
      x: options.pos.x, y: options.pos.y, z: options.pos.z,
      gain: options.gain, rate: options.rate,
    });
    const placeAtRouteDistance = (distance) => {
      const segment = L.mainSegments.find((candidate) =>
        distance >= candidate.distance && distance <= candidate.distance + candidate.length)
        || L.mainSegments[L.mainSegments.length - 1];
      const along = Math.max(0, Math.min(1,
        (distance - segment.distance) / (segment.length || 1)));
      g.player.pos.set(
        segment.a.x + segment.dx * along,
        segment.a.y + (segment.b.y - segment.a.y) * along,
        segment.a.z + segment.dz * along,
      );
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
    };
    // Entering directly at a late checkpoint must retire prior nodes silently.
    for (const node of guide.majorNodes) { node.announced = false; node.skipped = false; }
    guide.announced.length = 0;
    guide.furthestDistance = 0;
    guide.nextAudioAt = 0;
    F.teleport('house');
    F.stepWith(0.03, {}, false);
    F.teleport('cave');
    const lateCheckpoint = L.main[9];
    g.player.pos.set(lateCheckpoint.x, lateCheckpoint.y, lateCheckpoint.z);
    g.player._sync(0);
    // Sample only the checkpoint-entry guard. A later, genuinely in-range next
    // destination is allowed to call after the short entry hush expires.
    F.stepWith(0.2, {}, false);
    const behindNodes = guide.majorNodes.filter((node) => node.distance
      <= guide.furthestDistance + 0.75);
    const lateEntryCalls = calls.length;
    check(
      'a far cave checkpoint silently retires every behind-player destination cue',
      lateEntryCalls === 0 && behindNodes.length > 0
        && behindNodes.every((node) => node.announced && node.skipped),
      {
        lateEntryCalls,
        behind: behindNodes.map((node) => ({ name: node.name, announced: node.announced, skipped: node.skipped })),
      },
    );

    // A historical high-water mark must not authorize a still-unvisited cue
    // after the player backtracks or a checkpoint reseats them earlier. Keep
    // this inside the same cave visit so the entry-time retirement guard does
    // not hide a bad distance predicate.
    const futureNode = guide.majorNodes.find((node) => !node.announced);
    const callsBeforeBacktrackRestore = calls.length;
    guide.furthestDistance = L.mainLength;
    guide.nextAudioAt = g.time;
    g.player.pos.set(entrance.x, entrance.y, entrance.z);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.12, {}, false);
    check(
      'a backtrack or earlier reseat cannot spend a future cue from the historical high-water mark',
      !!futureNode && calls.length === callsBeforeBacktrackRestore && !futureNode.announced,
      {
        future: futureNode?.name,
        futureDistance: futureNode && round(futureNode.distance),
        currentDistance: round(guide.markerData[0].routeDistance),
        furthestDistance: round(guide.furthestDistance),
        callsBeforeBacktrackRestore,
        callsAfterBacktrackRestore: calls.length,
      },
    );

    // Death keeps Game.tick running beneath the overlay. Die inside an authored
    // approach window, wait past its audio cooldown, then take the real cave
    // checkpoint path back: the dead life must spend nothing, and the first
    // live forward step must still earn exactly one cue.
    for (const node of guide.majorNodes) { node.announced = false; node.skipped = false; }
    guide.announced.length = 0;
    guide.furthestDistance = 0;
    const deathCue = guide.majorNodes[Math.min(2, guide.majorNodes.length - 1)];
    placeAtRouteDistance(0);
    g.checkpoint('cave');
    F.stepWith(0.03, {}, false);
    placeAtRouteDistance(Math.max(0, deathCue.distance - 9.4));
    guide.nextAudioAt = g.time + 0.34;
    const cueCallsBeforeDeath = calls.length;
    g.director.death(null);
    F.stepWith(0.78, {}, false);
    const deadCueState = {
      calls: calls.length - cueCallsBeforeDeath,
      announced: deathCue.announced,
      skipped: deathCue.skipped,
      dead: g.dead,
      cooldownElapsed: g.time >= guide.nextAudioAt,
    };
    g.director.respawn();
    F.stepWith(0.38, {}, false);
    placeAtRouteDistance(Math.max(0, deathCue.distance - 9.4));
    guide.nextAudioAt = g.time;
    F.stepWith(0.09, {}, false);
    const respawnCueState = {
      calls: calls.length - cueCallsBeforeDeath,
      announced: deathCue.announced,
      skipped: deathCue.skipped,
      dead: g.dead,
      act: g.act,
    };
    check(
      'death cannot consume an approached route cue; respawn earns that forward cue exactly once',
      deadCueState.dead && deadCueState.cooldownElapsed
        && deadCueState.calls === 0 && !deadCueState.announced && !deadCueState.skipped
        && !respawnCueState.dead && respawnCueState.act === 'cave'
        && respawnCueState.calls === 1 && respawnCueState.announced && !respawnCueState.skipped,
      { node: deathCue.name, deadCueState, respawnCueState },
    );

    // A cue that did play in a doomed life is not permanent story progress.
    // Natural cave death rolls all the way back to its entrance checkpoint, so
    // the same destination must hand off once again when physically approached
    // in the returned life (never immediately from the respawn point).
    for (const node of guide.majorNodes) { node.announced = false; node.skipped = false; }
    guide.announced.length = 0;
    guide.furthestDistance = 0;
    placeAtRouteDistance(0);
    g.checkpoint('cave');
    F.stepWith(0.03, {}, false);
    // Approach the first forward node. Selecting the second lets the still-
    // eligible first node correctly win the one-cue cooldown, which tests loop
    // ordering rather than doomed-life replay.
    const replayCue = guide.majorNodes[0];
    const replayCallsAtStart = calls.length;
    placeAtRouteDistance(Math.max(0, replayCue.distance - 9.4));
    guide.nextAudioAt = g.time;
    F.stepWith(0.09, {}, false);
    const firstLifeCue = {
      calls: calls.length - replayCallsAtStart,
      announced: replayCue.announced,
    };
    placeAtRouteDistance(Math.min(L.mainLength, replayCue.distance + 1.2));
    g.director.death(null);
    F.stepWith(0.5, {}, false);
    const callsWhileReplayDead = calls.length - replayCallsAtStart;
    g.director.respawn();
    F.stepWith(0.38, {}, false);
    const callsAtEntranceRespawn = calls.length - replayCallsAtStart;
    placeAtRouteDistance(Math.max(0, replayCue.distance - 9.4));
    guide.nextAudioAt = g.time;
    F.stepWith(0.09, {}, false);
    const secondLifeCue = {
      calls: calls.length - replayCallsAtStart,
      announced: replayCue.announced,
      ledger: [...guide.announced],
    };
    check(
      'natural entrance rollback replays a consumed forward cue once in the returned life',
      firstLifeCue.calls === 1 && firstLifeCue.announced
        && callsWhileReplayDead === 1 && callsAtEntranceRespawn === 1
        && secondLifeCue.calls === 2 && secondLifeCue.announced
        && secondLifeCue.ledger.filter((name) => name === replayCue.name).length === 1,
      {
        node: replayCue.name,
        firstLifeCue,
        callsWhileReplayDead,
        callsAtEntranceRespawn,
        secondLifeCue,
      },
    );

    // Exercise the other one-shot cave semantics at their exact world points
    // while dead. The visibility/current ticker may keep drawing, but pump,
    // high sluice, culvert discovery and the displaced figure must remain fresh
    // for the returned player and then fire normally once control is live.
    const realStoneGrind = g.audio.stoneGrind;
    const realMetalDrop = g.audio.metalDrop;
    const realSplash = g.audio.splash;
    const semanticAudio = { stone: 0, metal: 0, splash: 0 };
    const nearSource = (pos, source, radius = 0.8) => {
      if (!pos || !source) return false;
      const dx = pos.x - source.x, dy = pos.y - source.y, dz = pos.z - source.z;
      return dx * dx + dy * dy + dz * dz <= radius * radius;
    };
    const metalSources = [
      { x: L.sluiceRise.x + 3.2, y: L.sluiceRise.y + 1, z: L.sluiceRise.z },
      { x: U.secret.position.x, y: U.secret.position.y + 2.4, z: U.secret.position.z },
    ];
    const splashSources = [
      { x: L.lowerSluice.x - 2.6, y: L.lowerSluice.y + 2.2, z: L.lowerSluice.z },
      U.displacement.positions[0],
    ];
    // Count only the exact authored semantic sources. Director ambience may
    // legitimately finish a previously scheduled stone sound during the
    // overlay; it is not evidence that a cave beat was consumed.
    g.audio.stoneGrind = ({ pos } = {}) => {
      if (nearSource(pos, U.pump.position)) semanticAudio.stone++;
    };
    g.audio.metalDrop = ({ pos } = {}) => {
      if (metalSources.some((source) => nearSource(pos, source))) semanticAudio.metal++;
    };
    g.audio.splash = ({ pos } = {}) => {
      if (splashSources.some((source) => nearSource(pos, source))) semanticAudio.splash++;
    };
    U.beats.pump = false;
    U.beats.high = false;
    U.secret.discovered = false;
    g.flags.delete('underfallsSecret');
    U.displacement.heard = false;
    U.displacement.revealed = false;
    U.displacement.t = 0;
    U.displacement.index = 0;
    U.displacement.root.visible = false;
    U.displacement.mat.opacity = 0;
    const semanticBefore = {
      pump: U.beats.pump,
      high: U.beats.high,
      secret: U.secret.discovered,
      flag: g.flags.has('underfallsSecret'),
      heard: U.displacement.heard,
      revealed: U.displacement.revealed,
      displacementT: U.displacement.t,
      displacementIndex: U.displacement.index,
    };
    g.player.pos.set(entrance.x, entrance.y, entrance.z);
    g.player._sync(0);
    g.checkpoint('cave');
    g.director.death(null);
    // Death itself may legitimately use a stone-family sting. Snapshot after
    // that transition; only additional audio caused by visiting semantic sites
    // beneath the overlay would be a progression leak.
    const semanticAudioAtDeath = { ...semanticAudio };
    const deadSites = [U.pump.position, L.upperSluice, U.secret.position, L.chapel];
    for (const site of deadSites) {
      g.player.pos.set(site.x, U.groundAt(site.x, site.z), site.z);
      g.player._sync(0);
      F.stepWith(0.08, {}, false);
    }
    const semanticWhileDead = {
      pump: U.beats.pump,
      high: U.beats.high,
      secret: U.secret.discovered,
      flag: g.flags.has('underfallsSecret'),
      heard: U.displacement.heard,
      revealed: U.displacement.revealed,
      displacementT: U.displacement.t,
      displacementIndex: U.displacement.index,
      audio: { ...semanticAudio },
    };
    g.director.respawn();
    for (const site of [U.pump.position, L.upperSluice, U.secret.position, L.chapel]) {
      g.player.pos.set(site.x, U.groundAt(site.x, site.z), site.z);
      g.player._sync(0);
      F.stepWith(0.08, {}, false);
    }
    F.stepWith(0.95, {}, false);
    const semanticAfterRespawn = {
      pump: U.beats.pump,
      high: U.beats.high,
      secret: U.secret.discovered,
      flag: g.flags.has('underfallsSecret'),
      heard: U.displacement.heard,
      revealed: U.displacement.revealed,
      audio: { ...semanticAudio },
    };
    g.audio.stoneGrind = realStoneGrind;
    g.audio.metalDrop = realMetalDrop;
    g.audio.splash = realSplash;
    check(
      'death overlay cannot consume pump, high-sluice, culvert, or displaced-figure semantics',
      JSON.stringify(semanticWhileDead) === JSON.stringify({ ...semanticBefore, audio: semanticAudioAtDeath })
        && semanticAfterRespawn.pump && semanticAfterRespawn.high
        && semanticAfterRespawn.secret && semanticAfterRespawn.flag
        && semanticAfterRespawn.heard && semanticAfterRespawn.revealed
        // Several independently earned live semantics use the same stone
        // family; no overlay-side growth and live-side presence are the contract.
        && semanticAfterRespawn.audio.stone >= semanticAudioAtDeath.stone + 1
        && semanticAfterRespawn.audio.metal >= semanticAudioAtDeath.metal + 2
        && semanticAfterRespawn.audio.splash >= semanticAudioAtDeath.splash + 2,
      { semanticBefore, semanticAudioAtDeath, semanticWhileDead, semanticAfterRespawn },
    );

    // Reset the isolated cue ledger, re-enter normally, and exercise every leg.
    calls.length = 0;
    for (const node of guide.majorNodes) { node.announced = false; node.skipped = false; }
    guide.announced.length = 0;
    guide.furthestDistance = 0;
    guide.nextAudioAt = 0;
    F.teleport('house');
    F.stepWith(0.03, {}, false);
    F.teleport('cave');
    g.player.pos.set(entrance.x, entrance.y, entrance.z);
    g.player._sync(0);
    F.stepWith(0.03, {}, false);
    for (const node of guide.majorNodes) {
      const approachDistance = Math.max(0, node.distance - 9.4);
      const segment = L.mainSegments.find((candidate) =>
        approachDistance >= candidate.distance
          && approachDistance <= candidate.distance + candidate.length)
        || L.mainSegments[L.mainSegments.length - 1];
      const along = Math.max(0, Math.min(1,
        (approachDistance - segment.distance) / (segment.length || 1)));
      g.player.pos.set(
        segment.a.x + segment.dx * along,
        segment.a.y + (segment.b.y - segment.a.y) * along,
        segment.a.z + segment.dz * along,
      );
      g.player.vel.set(0, 0, 0);
      g.player._sync(0);
      guide.nextAudioAt = g.time;
      F.stepWith(0.09, {}, false);
    }
    const beforeBacktrack = calls.length;
    g.player.pos.set(entrance.x, entrance.y, entrance.z);
    g.player._sync(0);
    guide.nextAudioAt = g.time;
    F.stepWith(0.2, {}, false);
    g.audio.caveDrip = realDrip;
    const callMatches = calls.every((call, i) => {
      const node = guide.majorNodes[i];
      return node && Math.hypot(call.x - node.pos.x, call.z - node.pos.z) < 0.01;
    });
    check(
      'each major leg announces its next destination once in positional sound and never chatters on backtrack',
      calls.length === guide.majorNodes.length && beforeBacktrack === calls.length
        && guide.announced.length === guide.majorNodes.length && callMatches,
      {
        calls: calls.length,
        nodes: guide.majorNodes.length,
        announced: guide.announced,
        beforeBacktrack,
        callMatches,
      },
    );

    const rootVisibleInCave = U.renderRoots.includes(guide.markers) && guide.markers.visible;
    F.teleport('house');
    F.stepWith(0.05, {}, false);
    const hiddenOutside = !guide.markers.visible && !guide.drySlates.visible && !guide.hatchSignal.visible;
    F.teleport('cave');
    F.stepWith(0.05, {}, false);
    const restoredInside = guide.markers.visible && guide.drySlates.visible && guide.hatchSignal.visible;
    check(
      'route signals obey district culling and restore only inside Underfalls',
      rootVisibleInCave && hiddenOutside && restoredInside,
      { rootVisibleInCave, hiddenOutside, restoredInside },
    );

    const liveHudText = [...document.querySelectorAll('#hud *')]
      .filter((element) => !element.classList.contains('sr-only'))
      .map((element) => (element.textContent || '').trim()).join('');
    check(
      'wayfinding adds no gameplay words or HUD directions',
      liveHudText === '', { liveHudText },
    );
    return checks;
  });

  const viewpoints = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH, L = g.underfalls.layout;
    const points = [
      { name: 'underfalls-current-entry', at: L.main[1], look: L.main[2] },
      { name: 'underfalls-required-vs-culvert', at: L.main[3], look: L.main[4] },
      { name: 'underfalls-hatch-reveal', at: L.main[L.main.length - 2], look: L.hatch },
    ];
    const out = [];
    for (const point of points) {
      g.player.pos.set(point.at.x, point.at.y, point.at.z);
      const dx = point.look.x - point.at.x, dz = point.look.z - point.at.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = -0.04;
      g.player._sync(0);
      F.stepWith(0.25, {}, true);
      out.push(point.name);
    }
    return out;
  });
  // Reposition and capture one at a time; page.evaluate above verifies all
  // positions without relying on screenshots as test assertions.
  for (const [name, index] of viewpoints.map((name, index) => [name, index])) {
    await page.evaluate((i) => {
      const g = window.__game, F = window.__FETCH, L = g.underfalls.layout;
      const defs = [
        [L.main[1], L.main[2]],
        [L.main[3], L.main[4]],
        [L.main[L.main.length - 2], L.hatch],
      ];
      const [at, look] = defs[i];
      g.player.pos.set(at.x, at.y, at.z);
      g.player.yaw = Math.atan2(-(look.x - at.x), -(look.z - at.z));
      g.player.pitch = -0.04;
      g.player._sync(0);
      F.stepWith(0.25, {}, true);
    }, index);
    const path = shotPath(`${name}.png`);
    await page.screenshot({ path });
    report.shots.push(path);
  }

  for (const result of report.checks) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}`
      + (result.details == null ? '' : ` -- ${JSON.stringify(result.details)}`));
    if (!result.passed) failed = true;
  }
  if (report.browserErrors.length) failed = true;
  for (const error of report.browserErrors) console.log(`browser: ${error}`);
} catch (error) {
  failed = true;
  report.crash = error?.stack || `${error}`;
  console.error(report.crash);
} finally {
  await browser.close().catch(() => {});
  server.stop();
  writeFileSync(resultsPath('underfalls-wayfinding-regression.json'), JSON.stringify(report, null, 2));
}

console.log(`${failed ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, `
  + `${report.browserErrors.length} browser errors (${report.url})`);
process.exit(failed ? 1 : 0);
