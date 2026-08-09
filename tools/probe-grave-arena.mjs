// Real-GPU visual, performance, audio and combat probe for the graveyard pass:
//   node tools/probe-grave-arena.mjs
// Writes canvas-direct rise/pressure/strike/stun/pop captures and a JSON report.
import { writeFileSync } from 'node:fs';
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const report = {
  url: `${URL_BASE}/?test=1`,
  browserErrors: [],
  audio: null,
  combat: null,
  escape: null,
  vistas: [],
  render: null,
  perf: null,
  captures: [],
};
let exit = 0;

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
    const panners = [];
    const vistas = [];
    let pops = 0;
    const posOf = (p) => p && [p.x, p.y, p.z].map((n) => +Number(n).toFixed(3));

    const originalPanner = g.audio._panner.bind(g.audio);
    g.audio._panner = (...args) => {
      const panner = originalPanner(...args);
      panners.push({
        pos: posOf(args[0]),
        model: panner.panningModel,
        distance: panner.distanceModel,
      });
      return panner;
    };
    for (const name of ['walkerRise', 'walkerStrike', 'walkerMiss']) {
      const original = g.audio[name].bind(g.audio);
      g.audio[name] = (opts = {}) => {
        const at = panners.length;
        const returned = original(opts);
        events.push({
          name,
          pos: posOf(opts.pos),
          returned,
          panners: panners.slice(at).map((p) => p.model),
          at: +g.time.toFixed(3),
        });
        return returned;
      };
    }
    const originalOnPop = g.director.onPop.bind(g.director);
    g.director.onPop = (enemy) => {
      pops++;
      return originalOnPop(enemy);
    };

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);

    const renderFrame = () => {
      g._lastShakeDt = 1 / 60;
      g._shake = 0;
      g.fovKick = 0;
      g.camera.fov = 71;
      g.camera.updateProjectionMatrix();
      g.render();
    };
    const aimAt = (p, lift = 1.25) => {
      const dx = p.x - g.player.pos.x;
      const dz = p.z - g.player.pos.z;
      const dy = p.y + lift - (g.player.pos.y + 1.62);
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const placePlayer = (x, z) => {
      const y = g.world.groundHeightAt(x, z, g.player.pos.y + 3);
      g.player.pos.set(x, y, z);
      g.player.vel.set(0, 0, 0);
      g.player.fallV = 0;
      g.player.grounded = true;
      g.player._sync(0);
    };
    const clearFight = () => {
      g.enemies.clear((enemy) => enemy.kind === 'walker');
      g.enemies.resetGraveClaims();
      g.director.beats = g.director.beats.filter((beat) => beat.scope !== g.director._scope);
      g.director.graveArena = { wave: 3, pending: 0, t: 99, done: false, engaged: true };
      g.dead = false;
      g.player.frozen = false;
      g.player.movementLocked = false;
      g.skull.holdNow();
    };
    const meshCount = (enemy) => {
      let count = 0;
      enemy.mesh.traverse((o) => { if (o.isMesh) count++; });
      return count;
    };
    const capture = (name, focus, extra = {}) => {
      aimAt(focus.pos, extra.lift ?? 1.2);
      for (let i = 0; i < 8; i++) renderFrame();
      const W = focus.mesh.userData.walker;
      vistas.push({
        name,
        state: focus.state,
        claimed: !!focus.graveClaimed,
        player: posOf(g.player.pos),
        enemy: posOf(focus.pos),
        distance: +Math.hypot(focus.pos.x - g.player.pos.x, focus.pos.z - g.player.pos.z).toFixed(3),
        fov: +g.camera.fov.toFixed(3),
        meshes: meshCount(focus),
        mouthScaleY: W ? +W.mouth.scale.y.toFixed(4) : null,
        eyeScaleX: W ? +W.eyes[0].scale.x.toFixed(4) : null,
        render: { ...g.lastRender },
      });
      return g.renderer.domElement.toDataURL('image/png');
    };

    // A body is heard and then seen levering itself out of the ground.
    clearFight();
    placePlayer(2, 20);
    const risen = g.enemies.spawn('walker', 2, 25.2, 'wind');
    risen.graveArena = true;
    g.director.graveArena.wave = 0;
    g.enemies._graveClaimRecovery = 99;
    risen.graveRiseDur = 1.08;
    risen.graveRiseT = 0.82;
    risen.windT = 0.28;
    g.audio.walkerRise({ pos: risen.pos, gain: 0.58, verb: 0.62 });
    F.stepWith(0.04, {}, false);
    const rise = capture('rise', risen);

    // Four bodies hold a value-readable ring; only the claimed mask uncocks.
    clearFight();
    placePlayer(2, 20);
    const pressureBodies = [[2, 25.4], [-2.2, 24.2], [6.3, 24.1], [2.3, 28.1]]
      .map(([x, z]) => {
        const enemy = g.enemies.spawn('walker', x, z, 'chase');
        enemy.graveArena = true;
        enemy.windT = 9;
        return enemy;
      });
    F.stepWith(1 / 120, {}, false);
    const pressureFocus = pressureBodies.find((enemy) => enemy.graveClaimed) || pressureBodies[0];
    const pressure = capture('pressure', pressureFocus);

    // Hold the actual committed pose far enough away to inspect the whole body.
    pressureFocus.pos.set(2, g.world.groundHeightAt(2, 22.75, 2), 22.75);
    pressureFocus.state = 'strike';
    pressureFocus.strikeT = 0.43;
    pressureFocus.graveClaimed = true;
    for (const other of pressureBodies) if (other !== pressureFocus) other.graveClaimed = false;
    g.audio.walkerStrike({ pos: pressureFocus.pos, gain: 0.88, verb: 0.38 });
    F.stepWith(1 / 120, {}, false);
    const strike = capture('strike', pressureFocus);

    // Quiet and loud tiers are captured from two real skull throws.
    clearFight();
    placePlayer(2, 20);
    const victim = g.enemies.spawn('walker', 2, 25, 'chase');
    victim.graveArena = true;
    victim.windT = 9;
    const throwUntil = (predicate, max = 1.2) => {
      aimAt(victim.pos, 1.2);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      let elapsed = 0;
      while (!predicate() && elapsed < max) {
        F.stepWith(1 / 120, { throwHeld: true }, false);
        elapsed += 1 / 120;
      }
      if (g.skull.mode === 'outbound') F.stepWith(1 / 120, { throwReleased: true }, false);
      return elapsed;
    };
    const firstFlight = throwUntil(() => victim.state === 'stunned');
    const stunnedState = victim.state;
    const quiet = capture('quiet-stun', victim);
    let wait = 0;
    while (g.skull.mode !== 'held' && wait < 4) {
      F.stepWith(0.05, {}, false);
      wait += 0.05;
    }
    while ((victim.iframes || 0) > 0 && !g.dead) F.stepWith(0.05, {}, false);
    const secondFlight = throwUntil(() => victim.state === 'dying');
    const loudState = victim.state;
    const loud = capture('loud-pop', victim);

    // One real attack commitment is escaped by ordinary sprint input.
    clearFight();
    placePlayer(2, 20);
    const striker = g.enemies.spawn('walker', 2, 20.72, 'chase');
    striker.graveArena = true;
    striker.windT = 9;
    F.stepWith(1 / 120, {}, false);
    const strikeBegan = striker.state === 'strike' && striker.graveClaimed;
    g.player.yaw = 0;
    g.player._sync(0);
    F.stepWith(0.82, { moveZ: 1, run: true }, false);
    const escapedDistance = Math.hypot(striker.pos.x - g.player.pos.x, striker.pos.z - g.player.pos.z);
    const combat = {
      firstFlight: +firstFlight.toFixed(3),
      secondFlight: +secondFlight.toFixed(3),
      stunnedState,
      loudState,
      pops,
      strikeBegan,
      strikeEnded: striker.state !== 'strike',
      escapedDistance: +escapedDistance.toFixed(3),
      alive: !g.dead,
      controlsLive: !g.player.frozen && !g.player.movementLocked,
      skullMode: g.skull.mode,
    };

    // Reproduce the old right-mausoleum deadlock and let production steering
    // take the body out through the door and around the exterior rear corner.
    clearFight();
    placePlayer(22, 50);
    const trapped = g.enemies.spawn('walker', 15.75, 32.5, 'chase');
    trapped.graveArena = true;
    trapped.windT = 9;
    F.stepWith(4.2, {}, false);
    const escape = {
      start: [15.75, 32.5],
      end: [trapped.pos.x, trapped.pos.z].map((n) => +n.toFixed(3)),
      stillInside: !!g.enemies._graveMausoleumAt(trapped.pos),
      routeActive: !!trapped._graveEscape,
      alive: !g.dead,
    };

    // Maximum authored arena presentation: eight visible walkers, no culling
    // tricks, measured with the full already-built world resident in memory.
    clearFight();
    placePlayer(2, 20);
    const horde = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const r = 5.4 + (i % 3) * 1.2;
      const enemy = g.enemies.spawn('walker', 2 + Math.sin(a) * r, 20 + Math.cos(a) * r, 'stunned');
      enemy.graveArena = i < 6;
      enemy.gravePressure = i >= 6;
      enemy.stunT = 99;
      horde.push(enemy);
    }
    aimAt(horde[0].pos, 1.2);
    const frameTimes = [];
    for (let i = 0; i < 240; i++) {
      const before = performance.now();
      F.stepWith(1 / 120, {}, false);
      renderFrame();
      frameTimes.push(performance.now() - before);
    }
    frameTimes.sort((a, b) => a - b);
    const totalMs = frameTimes.reduce((sum, n) => sum + n, 0);
    const render = {
      ...g.lastRender,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
      visibleWalkers: horde.length,
      meshesPerWalker: meshCount(horde[0]),
    };
    const perf = {
      frames: frameTimes.length,
      averageMs: totalMs / frameTimes.length,
      renderedFps: 1000 / (totalMs / frameTimes.length),
      p95Ms: frameTimes[Math.floor(frameTimes.length * 0.95)],
      maxMs: frameTimes[frameTimes.length - 1],
    };

    const beforeMissing = panners.length;
    const missingPositionReturns = ['walkerRise', 'walkerStrike', 'walkerMiss']
      .map((name) => ({ name, returned: g.audio[name]({}) }));
    const missingCreatedPanners = panners.length - beforeMissing;
    const positionedEvents = events.filter((event) => event.pos);
    return {
      captures: { rise, pressure, strike, quietStun: quiet, loudPop: loud },
      vistas,
      audio: {
        ready: g.audio.ready,
        contextState: g.audio.ctx?.state || null,
        events,
        pannerCount: panners.length,
        allPannersHRTF: panners.every((panner) => panner.model === 'HRTF'),
        positionedEvents: positionedEvents.length,
        allPositionedFinite: positionedEvents.every((event) => event.pos.every(Number.isFinite)),
        allEventPannersHRTF: positionedEvents.every((event) => event.panners.length > 0
          && event.panners.every((model) => model === 'HRTF')),
        missingPositionReturns,
        missingCreatedPanners,
      },
      combat,
      escape,
      render,
      perf,
    };
  });

  for (const [name, data] of Object.entries(result.captures)) {
    const file = shotPath(`grave-walker-${name}.png`);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    report.captures.push(file);
  }
  report.audio = result.audio;
  report.combat = result.combat;
  report.escape = result.escape;
  report.vistas = result.vistas;
  report.render = result.render;
  report.perf = result.perf;

  const vista = (name) => result.vistas.find((item) => item.name === name);
  const checks = [
    [report.browserErrors.length === 0, 'zero browser/page errors'],
    [result.audio.ready && result.audio.contextState === 'running', 'native WebAudio graph is running'],
    [result.audio.allPositionedFinite && result.audio.positionedEvents >= 3,
      'all observed walker body events carry finite world positions'],
    [result.audio.allEventPannersHRTF, 'every positioned walker event creates an HRTF panner'],
    [result.audio.missingPositionReturns.every((event) => event.returned === false)
      && result.audio.missingCreatedPanners === 0,
    'walker body events reject nowhere sounds'],
    [result.vistas.length === 5 && result.vistas.every((item) => Math.abs(item.fov - 71) < 0.01),
      'all five visual proofs use the live 71-degree resting FOV'],
    [result.vistas.every((item) => item.meshes <= 14),
      'authored walker anatomy stays below the old fifteen-mesh figure'],
    [vista('strike').mouthScaleY > vista('pressure').mouthScaleY * 1.35,
      'committed strike opens a materially larger mouth silhouette'],
    [vista('pressure').eyeScaleX > vista('rise').eyeScaleX * 1.25,
      'claimed attacker broadens its bright mask slit without hue'],
    [result.combat.stunnedState === 'stunned' && result.combat.loudState === 'dying'
      && result.combat.pops === 1,
    'two real throws preserve quiet stun then deliberate loud pop'],
    [result.combat.strikeBegan && result.combat.strikeEnded && result.combat.alive
      && result.combat.controlsLive && result.combat.escapedDistance > 1.2,
    'ordinary sprint input escapes the committed grave strike'],
    [!result.escape.stillInside && result.escape.alive,
      'right-mausoleum body exits through authored steering instead of deadlocking'],
    [result.vistas.every((item) => item.render.drawCalls < 700)
      && result.render.drawCalls < 700,
    `all vistas and the eight-body horde remain under 700 draw calls (${result.render.drawCalls})`],
    [result.render.geometries < 1500, `geometries ${result.render.geometries} < 1500`],
    [result.perf.renderedFps > 25 && result.perf.p95Ms < 40,
      `rendered cadence ${result.perf.renderedFps.toFixed(1)} fps, p95 ${result.perf.p95Ms.toFixed(1)} ms`],
  ];
  for (const [passed, label] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
    if (!passed) exit = 1;
  }
  console.log(JSON.stringify({
    audio: report.audio,
    combat: report.combat,
    escape: report.escape,
    vistas: report.vistas,
    render: report.render,
    perf: report.perf,
    captures: report.captures,
  }, null, 2));
  writeFileSync(resultsPath('grave-arena-probe.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
