// Real-GPU visual/performance/audio probe for the under-falls horror lane.
// Writes five canvas-direct captures plus a JSON report:
//   node tools/probe-horror-expansion.mjs
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = {
  url: `${URL_BASE}/?test=1`,
  browserErrors: [],
  audio: null,
  render: null,
  perf: null,
  captures: [],
  vistas: [],
  routeTrials: [],
};

try {
  const { page, errors } = await openPage(browser, report.url, { width: 1280, height: 800, quiet: false });
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );

  const result = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const events = [];
    const loopModels = [];
    const vistas = [];
    const posOf = (p) => p && [p.x, p.y, p.z].map((n) => +Number(n).toFixed(3));

    for (const name of ['caveDrip', 'drownedCall', 'drownedSurge', 'sprayReveal', 'drownedImpact']) {
      const original = g.audio[name].bind(g.audio);
      g.audio[name] = (opts = {}) => {
        events.push({ name, pos: posOf(opts.pos), at: +g.time.toFixed(3) });
        return original(opts);
      };
    }
    const originalLoop = g.audio.drownedChoirLoop.bind(g.audio);
    g.audio.drownedChoirLoop = (pos) => {
      const h = originalLoop(pos);
      loopModels.push(h.panningModel || null);
      return h;
    };

    F.start();
    if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
    g.skull.vanish();
    F.teleport('cave');

    const lookAt = (p, y = 1.4) => {
      const dx = p.x - g.player.pos.x;
      const dz = p.z - g.player.pos.z;
      const dy = p.y + y - (g.player.pos.y + 1.62);
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.25, Math.min(1.25, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const renderFrame = () => {
      // Manual test-mode renders happen between RAF callbacks. A stale negative
      // RAF delta makes cosmetic FOV decay run backward and manufactures radial
      // wedges that never exist in live play.
      g._lastShakeDt = 1 / 60;
      g.render();
    };
    const lookFrom = (p, target, targetLift = 1.35) => {
      const y = g.underfalls.groundAt(p.x, p.z) ?? p.y ?? 0;
      g.player.pos.set(p.x, y, p.z);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      g.fovKick = 0;
      g._shake = 0;
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.player._sync(0);
      lookAt(target, targetLift);
    };
    const capture = (name, choir = null) => {
      // Eight render-only settles update viewmodel/instancing without advancing
      // the predator's state or manufacturing a more flattering gameplay pose.
      for (let i = 0; i < 8; i++) renderFrame();
      const projection = g.underfalls.project(g.player.pos.x, g.player.pos.z);
      vistas.push({
        name,
        player: posOf(g.player.pos),
        choir: choir ? posOf(choir.pos) : null,
        state: choir?.state || null,
        fov: +g.camera.fov.toFixed(3),
        routeClearance: projection ? +projection.clearance.toFixed(3) : null,
        render: { ...g.lastRender },
      });
      return g.renderer.domElement.toDataURL('image/png');
    };

    // First visual: the underfalls lane's passive displaced-spray figure. It
    // rhymes with the later predator but never attacks or blocks the route.
    const L = g.underfalls.layout;
    const backFrom = (node, previous, distance) => {
      const dx = previous.x - node.x, dz = previous.z - node.z;
      const d = Math.hypot(dx, dz) || 1;
      const k = Math.min(distance, d) / d;
      return {
        x: node.x + dx * k,
        y: node.y + (previous.y - node.y) * k,
        z: node.z + dz * k,
      };
    };
    const passive = g.underfalls.displacement;
    lookFrom(L.named['chapel west aisle'], passive.root.position, 1.5);
    F.stepWith(1.0, {}, false);
    lookAt(passive.root.position, 1.5);
    const falseSighting = capture('falseSighting');

    // Passing the chapel arms the real Choir behind the player. Its own mesh
    // remains absent for the warning beat even though its HRTF source is live.
    const lowerSluice = L.lowerSluice;
    g.player.pos.set(lowerSluice.x, lowerSluice.y, lowerSluice.z);
    g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true; g.player._sync(0);
    F.stepWith(0.05, {}, false);
    const choir = g.enemies.choir;
    F.stepWith(1.0, {}, false);

    // Distant post-warning silhouette: a real route center looks toward the
    // next authored rise, so shell corruption or wall phasing cannot masquerade
    // as creature design. The one-second reveal is the production surge tell.
    lookFrom(lowerSluice, L.sluiceRise, 1.25);
    choir.pos.set(L.sluiceRise.x, L.sluiceRise.y, L.sluiceRise.z);
    choir.heardPos.copy(g.player.pos);
    choir.washV.set(0, 0, 0);
    choir.state = 'stalk'; choir.stateT = 0.14;
    choir.revealT = 1.25; choir.wetT = 0;
    F.stepWith(0.04, {}, false);
    lookAt(choir.pos, 1.35);
    const distantSilhouette = capture('distantSilhouette', choir);

    // The lower sluice is a real authored defense volume. Catch the creature
    // just inside its pressure radius and settle for only one sim quantum, so
    // the frame shows both revelation and the beginning—not the end—of recoil.
    const spray = L.sprayZones[0];
    const sprayY = g.underfalls.groundAt(spray.pos.x, spray.pos.z) ?? L.sluiceRise.y;
    choir.pos.set(spray.pos.x, sprayY, spray.pos.z);
    choir.heardPos.copy(choir.pos);
    choir.state = 'pressure'; choir.stateT = 0.5; choir.warned = true;
    choir.washV.set(0, 0, 0); choir.revealT = 0; choir.wetT = 0;
    g.enemies.caveSpray(spray.pos, spray.radius, spray.strength);
    F.stepWith(1 / 120, {}, false);
    lookAt(choir.pos, 1.35);
    const sprayReveal = capture('sprayReveal', choir);

    // A separate dry corridor stages the fixed-point attack telegraph. At this
    // range the full body fits in frame and the player still has the production
    // 1.05-second commitment window; no camera or movement lock is involved.
    const east = L.named['east ambulatory'];
    const pressureCam = backFrom(lowerSluice, east, 2.65);
    lookFrom(pressureCam, lowerSluice, 1.25);
    choir.pos.set(lowerSluice.x, lowerSluice.y, lowerSluice.z);
    choir.washV.set(0, 0, 0);
    choir.heardPos.copy(g.player.pos);
    choir.strikePos.copy(g.player.pos);
    choir.state = 'pressure';
    choir.stateT = 0.64;
    choir.revealT = 2;
    choir.wetT = 0;
    F.stepWith(0.025, {}, false);
    lookAt(choir.pos, 1.35);
    const pressure = capture('pressure', choir);

    // The upper overflow proves the defense has an authored retreat read. The
    // shroud folds, ribs close and the HRTF source physically recedes through
    // the final real spray chamber rather than vanishing from the lower shot.
    const recoveryCam = backFrom(L.overflow, L.upperSluice, 4.6);
    lookFrom(recoveryCam, L.overflow, 1.25);
    choir.pos.set(L.overflow.x, L.overflow.y, L.overflow.z);
    choir.heardPos.copy(g.player.pos);
    choir.state = 'recoil'; choir.stateT = 0.08;
    choir.revealT = 2.4; choir.wetT = 1.5;
    const rvx = choir.pos.x - g.player.pos.x, rvz = choir.pos.z - g.player.pos.z;
    const rvl = Math.hypot(rvx, rvz) || 1;
    choir.washV.set(rvx / rvl * 5.5, 0, rvz / rvl * 5.5);
    // The visual is one authored recoil, not two stacked probe-side pulses.
    if (g.underfalls.sprayPulse[1]) g.underfalls.sprayPulse[1].inside = true;
    F.stepWith(0.22, {}, false);
    lookAt(choir.pos, 1.35);
    const recovery = capture('recovery', choir);

    // Keep the live source away during the render-cadence probe.
    choir.state = 'stalk'; choir.stateT = 0;
    choir.pos.set(g.player.pos.x + 24, g.player.pos.y, g.player.pos.z + 24);
    choir.heardPos.copy(choir.pos);
    choir.memoryT = 0; choir.heardStrength = 0; choir.wetT = 0;
    const frame = {
      moveX: 0, moveZ: 0, run: false, lookX: 0, lookY: 0,
      throwHeld: false, callHeld: false,
      throwPressed: false, throwReleased: false, callTap: false,
      interactPressed: false, jumpPressed: false,
    };
    const samples = [];
    const t0 = performance.now();
    for (let i = 0; i < 240; i++) {
      const f0 = performance.now();
      g.step(1 / 60, frame);
      renderFrame();
      samples.push(performance.now() - f0);
    }
    const elapsedMs = performance.now() - t0;
    samples.sort((a, b) => a - b);
    const p95Ms = samples[Math.floor(samples.length * 0.95)];
    const render = {
      ...g.lastRender,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
    };
    g.director.setAct('mirror', true);

    return {
      captures: { falseSighting, distantSilhouette, sprayReveal, pressure, recovery },
      vistas,
      audio: {
        ready: g.audio.ready,
        contextState: g.audio.ctx?.state || null,
        loopModels,
        events,
        allPositioned: events.length > 0 && events.every((e) => e.pos?.length === 3 && e.pos.every(Number.isFinite)),
      },
      render,
      perf: {
        frames: 240,
        elapsedMs,
        renderedFps: 240 / (elapsedMs / 1000),
        p95Ms,
      },
      passiveFalseSighting: g.underfalls.displacement.revealed,
      choirRemovedAfterActChange: !g.enemies.choir,
    };
  });

  for (const [name, data] of Object.entries(result.captures)) {
    const file = shotPath(`horror-${name}.png`);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    report.captures.push(file);
  }
  report.audio = result.audio;
  report.render = result.render;
  report.perf = result.perf;
  report.vistas = result.vistas;
  report.passiveFalseSighting = result.passiveFalseSighting;
  report.choirRemovedAfterActChange = result.choirRemovedAfterActChange;

  // Two clean muted pages measure the actual main route with production input
  // and enemy logic. Keeping them separate prevents the visual staging above
  // from gifting either trial a displaced or pre-wounded predator.
  for (const run of [false, true]) {
    const { page: routePage, errors: routeErrors } = await openPage(
      browser, `${URL_BASE}/?test=1&mute=1`, { width: 960, height: 600 },
    );
    await routePage.waitForFunction(
      () => window.__FETCH?.ready === true && window.__game?.underfalls,
      null, { timeout: 60000, polling: 100 },
    );
    const trial = await routePage.evaluate((runInput) => {
      const F = window.__FETCH, g = window.__game, L = g.underfalls.layout;
      const states = new Set();
      let simSeconds = 0;
      let distance = 0;
      let minChoirDistance = Infinity;
      let sprayPulses = 0;
      let spawnedAt = null;
      const realSpray = g.enemies.caveSpray.bind(g.enemies);
      g.enemies.caveSpray = (...args) => {
        const caught = realSpray(...args);
        if (caught) sprayPulses++;
        return caught;
      };
      const settle = (p) => {
        const y = g.underfalls.groundAt(p.x, p.z) ?? p.y ?? 0;
        g.player.pos.set(p.x, y, p.z);
        g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
        g.player._sync(0);
      };
      const step = (seconds, input) => {
        const beforeX = g.player.pos.x, beforeZ = g.player.pos.z;
        F.stepWith(seconds, input, false);
        distance += Math.hypot(g.player.pos.x - beforeX, g.player.pos.z - beforeZ);
        simSeconds += seconds;
        const choir = g.enemies.choir;
        if (choir) {
          if (spawnedAt == null) spawnedAt = simSeconds;
          states.add(choir.state);
          minChoirDistance = Math.min(minChoirDistance,
            Math.hypot(choir.pos.x - g.player.pos.x, choir.pos.z - g.player.pos.z));
        }
      };
      const walkTo = (p, maxSeconds = 24) => {
        let leg = 0;
        while (leg < maxSeconds && !g.dead) {
          const dx = p.x - g.player.pos.x, dz = p.z - g.player.pos.z;
          if (Math.hypot(dx, dz) < 0.62) return true;
          g.player.yaw = Math.atan2(-dx, -dz);
          step(0.08, { moveZ: 1, run: runInput });
          leg += 0.08;
        }
        return Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z) < 1.05;
      };

      F.start();
      if (!g.flags.has('waterfallTaken')) g.director.waterfallTaken();
      g.skull.vanish();
      F.teleport('cave');
      step(1 / 120, {});
      settle(L.entrance);
      const legs = [];
      for (const p of L.main.slice(1)) {
        legs.push(walkTo(p));
        if (g.dead) break;
      }
      const endDistance = Math.hypot(g.player.pos.x - L.hatch.x, g.player.pos.z - L.hatch.z);
      return {
        pace: runInput ? 'run' : 'walk',
        simSeconds: +simSeconds.toFixed(2),
        distance: +distance.toFixed(2),
        reached: legs.length === L.main.length - 1 && legs.every(Boolean) && endDistance < 1.2,
        endDistance: +endDistance.toFixed(3),
        dead: g.dead,
        legs,
        choirSpawnedAt: spawnedAt == null ? null : +spawnedAt.toFixed(2),
        minChoirDistance: Number.isFinite(minChoirDistance) ? +minChoirDistance.toFixed(2) : null,
        choirStates: [...states],
        sprayPulses,
        controlsLive: !g.player.frozen && !g.player.movementLocked,
      };
    }, run);
    report.routeTrials.push(trial);
    report.browserErrors.push(...routeErrors.map((e) => `${trial.pace} trial: ${e}`));
    await routePage.close();
  }

  const checks = [
    [report.browserErrors.length === 0, 'zero browser/page errors'],
    [result.audio.ready && result.audio.contextState === 'running', 'native WebAudio graph is running'],
    [result.audio.loopModels.includes('HRTF'), 'Drowned Choir loop reports HRTF panning'],
    [result.audio.allPositioned, 'every observed new cave event carries a finite world position'],
    [result.audio.events.some((e) => e.name === 'drownedCall'), 'audio-first call fired'],
    [result.passiveFalseSighting, 'passive chapel false sighting precedes the predator'],
    [result.audio.events.some((e) => e.name === 'sprayReveal'), 'authored spray hook reveal fired'],
    [result.audio.events.some((e) => e.name === 'caveDrip'), 'positional cave ecology fired'],
    [result.vistas.length === 5 && result.vistas.every((v) => v.routeClearance <= -0.2),
      'all five visual cameras are settled inside authored route clearance'],
    [result.vistas.every((v) => Math.abs(v.fov - 71) < 0.01),
      'every visual proof uses the live 71-degree resting FOV'],
    [result.vistas.every((v) => v.render.drawCalls < 700),
      `every vista remains under 700 draw calls (max ${Math.max(...result.vistas.map((v) => v.render.drawCalls))})`],
    [report.routeTrials.every((t) => t.reached && !t.dead && t.controlsLive),
      `real-input walk/run trials reach the hatch alive (${report.routeTrials.map((t) => `${t.pace} ${t.simSeconds}s`).join(', ')})`],
    [report.routeTrials.every((t) => t.choirSpawnedAt != null && t.choirStates.includes('warning')),
      'both clean route trials encounter the production Choir warning'],
    [report.routeTrials[1].simSeconds < report.routeTrials[0].simSeconds,
      'committed running traverses the route faster than walking'],
    [result.render.drawCalls < 700, `draw calls ${result.render.drawCalls} < 700`],
    [result.render.geometries < 1500, `geometries ${result.render.geometries} < 1500`],
    [result.perf.renderedFps > 25, `rendered cadence ${result.perf.renderedFps.toFixed(1)} fps > 25`],
    [result.choirRemovedAfterActChange, 'act change removes the live Choir source'],
  ];
  for (const [pass, label] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`);
    if (!pass) exit = 1;
  }
  console.log(JSON.stringify({
    audio: report.audio,
    vistas: report.vistas,
    routeTrials: report.routeTrials,
    render: report.render,
    perf: report.perf,
    captures: report.captures,
  }, null, 2));
  if (report.browserErrors.length) exit = 1;
  writeFileSync(resultsPath('horror-expansion-probe.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
