// Live-WebAudio wiring gate for the enemy presence loops, positional wind tells,
// and skull scream. Chrome's output device is muted by the shared harness, but
// this page deliberately omits ?mute=1 so FETCH builds and schedules the real
// graph. That separates graph integrity from the still-required human listen.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const report = {
  url: `${URL_BASE}/?test=1`,
  checks: [],
  browserErrors: [],
};
let exit = 0;

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(async () => {
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const F = window.__FETCH;
    const g = window.__game;
    const audio = g.audio;

    F.start();
    await new Promise((resolve) => setTimeout(resolve, 120));
    check(
      'real AudioContext initializes without the mute query',
      audio.ready === true && audio.ctx && audio.ctx.state === 'running',
      { ready: audio.ready, state: audio.ctx?.state, sampleRate: audio.ctx?.sampleRate },
    );

    const ctx = audio.ctx;
    const created = { oscillators: 0, buffers: 0, gains: 0, filters: 0, panners: 0 };
    for (const [method, key] of [
      ['createOscillator', 'oscillators'],
      ['createBufferSource', 'buffers'],
      ['createGain', 'gains'],
      ['createBiquadFilter', 'filters'],
      ['createPanner', 'panners'],
    ]) {
      const original = ctx[method].bind(ctx);
      ctx[method] = (...args) => {
        created[key] += 1;
        return original(...args);
      };
    }

    const kinds = ['walker', 'resident', 'kneeler'];
    const handles = [];
    const signatures = {};
    const tells = {};
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i];
      const handle = audio.enemyLoop(kind);
      handles.push(handle);
      handle.setPos(i * 2 - 2, 1.4, -4 - i);
      handle.setThreat(0.55 + i * 0.15, 0.35 + i * 0.2, i === 1 ? 0.8 : 0.25);
      tells[kind] = audio.enemyTell(kind, {
        pos: { x: i * 2 - 2, y: 1.4, z: -4 - i },
        gain: 0.2,
      });

      const bufs = audio._enemyBufs?.[kind];
      const summarise = (buf) => {
        if (!buf) return null;
        const data = buf.getChannelData(0);
        let energy = 0;
        let finite = true;
        const stride = Math.max(1, Math.floor(data.length / 4096));
        for (let n = 0; n < data.length; n += stride) {
          finite = finite && Number.isFinite(data[n]);
          energy += Math.abs(data[n]);
        }
        return {
          duration: +buf.duration.toFixed(3),
          length: buf.length,
          energy: +energy.toFixed(3),
          finite,
        };
      };
      signatures[kind] = { far: summarise(bufs?.far), close: summarise(bufs?.close) };
    }

    let screamScheduled = true;
    try {
      audio.skullScream({ x: 0, y: 1.5, z: -3 });
    } catch (error) {
      screamScheduled = false;
      checks.push({ name: 'skull scream graph schedules without throwing', passed: false, details: String(error) });
    }
    if (screamScheduled) check('skull scream graph schedules without throwing', true, created);

    await new Promise((resolve) => setTimeout(resolve, 220));
    check(
      'all three enemy presence recipes bake finite non-silent far and close buffers',
      kinds.every((kind) => {
        const pair = signatures[kind];
        return pair?.far?.finite && pair?.close?.finite && pair.far.energy > 1 && pair.close.energy > 1;
      }),
      signatures,
    );
    check(
      'enemy recipes remain kind-distinct by authored buffer durations',
      new Set(kinds.map((kind) => signatures[kind]?.far?.duration)).size === kinds.length
        && new Set(kinds.map((kind) => signatures[kind]?.close?.duration)).size === kinds.length,
      signatures,
    );
    check(
      'all three positional wind tells use the dedicated creature graph',
      kinds.every((kind) => tells[kind] === true),
      tells,
    );
    check(
      'scream and tells scheduled substantial live synthesis',
      created.oscillators >= 16 && created.buffers >= 7
        && created.gains >= 28 && created.filters >= 8 && created.panners >= 7,
      created,
    );
    check(
      'enemy loop handles remain live and stoppable',
      handles.every((handle) => typeof handle.setPos === 'function'
        && typeof handle.setThreat === 'function' && typeof handle.stop === 'function'),
      { loopCount: audio._loops?.size },
    );

    for (const handle of handles) handle.stop();

    // Prove the gameplay state machine uses the dedicated tell exactly once,
    // and retains the old whisper only as a failed-audio fallback. The graph
    // itself was exercised above; these wrappers count the production route.
    F.teleport('house');
    g.enemies.clear();
    const originalTell = audio.enemyTell.bind(audio);
    const originalWhisper = audio.whisper.bind(audio);
    let routedTells = 0;
    let routedWhispers = 0;
    audio.enemyTell = (kind, opts) => {
      routedTells += 1;
      return originalTell(kind, { ...opts, gain: 0.04 });
    };
    audio.whisper = (...args) => {
      routedWhispers += 1;
      return originalWhisper(...args);
    };
    const routed = g.enemies.spawn(
      'walker', g.player.pos.x, g.player.pos.z - 6, 'wind', g.player.pos.y + 2,
    );
    routed.graveRiseT = 0;
    F.stepWith(3 / 120, {}, false);
    check(
      'normal wind state emits one dedicated tell and no legacy whisper',
      routedTells === 1 && routedWhispers === 0,
      { routedTells, routedWhispers, windT: routed.windT },
    );

    g.enemies.clear();
    let fallbackAttempts = 0;
    let fallbackWhispers = 0;
    audio.enemyTell = () => { fallbackAttempts += 1; return false; };
    audio.whisper = () => { fallbackWhispers += 1; };
    const fallback = g.enemies.spawn(
      'walker', g.player.pos.x, g.player.pos.z - 6, 'wind', g.player.pos.y + 2,
    );
    fallback.graveRiseT = 0;
    F.stepWith(3 / 120, {}, false);
    check(
      'failed dedicated tell falls back once to the legacy whisper',
      fallbackAttempts === 1 && fallbackWhispers === 1,
      { fallbackAttempts, fallbackWhispers, windT: fallback.windT },
    );
    audio.enemyTell = originalTell;
    audio.whisper = originalWhisper;
    g.enemies.clear();

    // Both authored arena entrances should own exactly one scream and neither
    // should stack the removed generic sting beside it.
    const originalScream = audio.skullScream.bind(audio);
    const originalSting = audio.sting.bind(audio);
    const screamRoutes = [];
    let adjacentStings = 0;
    audio.skullScream = () => { screamRoutes.push(g.act); };
    audio.sting = () => { adjacentStings += 1; };

    F.teleport('graveyard');
    g.enemies.clear();
    g.flags.delete('graveyardResolved');
    g.flags.delete('graveyardCleared');
    g.director.graveArena = null;
    g.player.pos.z = 18.5;
    g.player._sync(0);
    g.director._updateGraveyardArena(1 / 120);

    F.teleport('forest');
    g.enemies.clear();
    g.director.arena = null;
    g.director._startArena();
    check(
      'graveyard and forest arena routes each emit one scream with no adjacent sting',
      screamRoutes.length === 2
        && screamRoutes[0] === 'graveyard' && screamRoutes[1] === 'forest'
        && adjacentStings === 0,
      { screamRoutes, adjacentStings },
    );
    audio.skullScream = originalScream;
    audio.sting = originalSting;
    g.enemies.clear();
    return checks;
  });

  await page.waitForTimeout(150);
  report.checks.push({
    name: 'live creature audio graph emits zero browser errors',
    passed: report.browserErrors.length === 0,
    details: report.browserErrors,
  });

  for (const c of report.checks) {
    console.log(`${c.passed ? 'PASS' : 'FAIL'} ${c.name}${c.details ? ` -- ${JSON.stringify(c.details)}` : ''}`);
    if (!c.passed) exit = 1;
  }
} catch (error) {
  report.fatal = error?.stack || String(error);
  console.error(report.fatal);
  exit = 1;
} finally {
  writeFileSync(resultsPath('creature-audio-regression.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.stop();
}

if (exit) {
  console.error('CREATURE-AUDIO REGRESSION FAILED');
  process.exit(1);
}
console.log('CREATURE-AUDIO REGRESSION PASS');
