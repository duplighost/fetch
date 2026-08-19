// THE SECOND ROOM'S WINDOW. Alex, 2026-08-17: "the thing that is supposed to
// come in the window in the second room of the game only flashes for less than
// a second."
//
//   node tests/window-scare-regression.mjs
//
// It did, and nothing in the repo pinned any of it — a grep for windowWatcher
// across tests/ returned zero assertions before this file. Five compounding
// bugs made the beat unwitnessable: the fully-risen figure existed for 0.85 s;
// STARING advanced it faster than ignoring it; walking toward it deleted it;
// looking away for 0.55 s deleted it; and the unwatched creep completed the
// whole thing off-camera in three seconds, so it routinely fired at an empty
// landing. This file pins the grammar it wears instead, which is the scullery
// crawler's: sound before pixels, watching HOLDS, looking away FREEZES,
// approaching RECOILS, and nothing completes unseen.
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], errors: [], diagnostics: {} };
const failures = [];
const check = (passed, name, details = null) => {
  const row = { name, passed: !!passed, details };
  report.checks.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name}${details == null ? '' : ` -- ${JSON.stringify(details)}`}`);
  if (!row.passed) failures.push(name);
};

const server = await ensureServer();
const browser = await launchBrowser();
let page;

async function freshPage() {
  if (page) await page.close();
  const opened = await openPage(browser, report.url);
  page = opened.page;
  report.errors.push(...opened.errors);
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 300000, polling: 100 },
  );
}

// Shared preamble: stand in the landing looking at its south window, arm the
// scripted event, and instrument the two cues that carry it.
const PRELUDE = `
  const F = window.__FETCH, g = window.__game;
  F.start();
  F.teleport('house');
  g.enemies.clear();
  const ww = g.windowWatcher;
  const site = ww.sites[0];
  const pane = { x: site.x, y: site.floor + 1.8, z: site.z };
  const lookAtPane = () => {
    const dx = pane.x - g.player.pos.x;
    const dy = pane.y - (g.player.pos.y + 1.62);
    const dz = pane.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    g.player._sync(0);
  };
  const lookAway = () => {
    const dx = pane.x - g.player.pos.x;
    const dz = pane.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz) + Math.PI;
    g.player.pitch = 0;
    g.player._sync(0);
  };
  const cues = [];
  for (const name of ['sashScrape', 'glassTink', 'creak', 'whisper', 'thud']) {
    const original = g.audio[name];
    g.audio[name] = (opts) => {
      cues.push({ name, visible: ww.root.visible, t: +g.time.toFixed(2) });
      if (original) return original.call(g.audio, opts);
      return undefined;
    };
  }
  // stand in the landing, four metres back from the pane, facing it
  g.player.pos.set(-1, site.floor, 2.2);
  g.player.vel.set(0, 0, 0);
  lookAtPane();
  ww.force(0);
`;

try {
  await freshPage();

  // ---------------------------------------------------------------- 1. SEEN
  const seen = await page.evaluate(`(() => {
    ${PRELUDE}
    // the beat, watched the whole way, sampled every 1/10 s
    let visibleFrames = 0, longestVisibleRun = 0, run = 0;
    let firstVisibleAt = null, firstCueAt = null;
    let fullyRisenFrames = 0;
    const SILL = site.floor + 1.0;
    for (let i = 0; i < 260; i++) {
      lookAtPane();
      F.stepWith(0.1, {}, false);
      if (firstCueAt === null && cues.length) firstCueAt = +g.time.toFixed(2);
      if (ww.root.visible) {
        visibleFrames++;
        run++;
        longestVisibleRun = Math.max(longestVisibleRun, run);
        if (firstVisibleAt === null) firstVisibleAt = +g.time.toFixed(2);
        // the head clears the sill => it is actually framed in the glass
        if (ww.root.position.y + 1.6 > SILL + 0.35) fullyRisenFrames++;
      } else run = 0;
      if (g.flags.has('windowWatcherEntered')) break;
    }
    return {
      visibleSeconds: +(visibleFrames * 0.1).toFixed(2),
      longestVisibleRun: +(longestVisibleRun * 0.1).toFixed(2),
      framedSeconds: +(fullyRisenFrames * 0.1).toFixed(2),
      firstVisibleAt, firstCueAt,
      cuesBeforeAnyPixel: cues.filter((c) => !c.visible).length,
      firstCueName: cues[0] ? cues[0].name : null,
      scrapeBeforePixels: cues.some((c) => c.name === 'sashScrape' && c.visible === false),
      entered: g.flags.has('windowWatcherEntered'),
      entryState: ww.entry.state,
      viewT: +ww.state.viewT.toFixed(2),
    };
  })()`);
  report.diagnostics.seen = seen;

  // The house has other voices, so this does not demand the watcher own the
  // first sound in the world — it demands that the watcher's own sill scrape
  // happens while the watcher is invisible, and that nothing of it is on
  // screen until the lead-in has run.
  check(seen.scrapeBeforePixels && seen.firstVisibleAt >= 1.3
      && seen.cuesBeforeAnyPixel >= 2,
    'you HEAR it at the sill before a single pixel of it exists', seen);
  check(seen.framedSeconds >= 4.0,
    'the figure stands framed above the sill for seconds, not a flash', seen);
  check(seen.entered === true && seen.entryState === 'done',
    'watched all the way through, it comes in the window and finishes', seen);

  // -------------------------------------------------------------- 2. FREEZE
  await freshPage();
  const away = await page.evaluate(`(() => {
    ${PRELUDE}
    // watch it up to the pane, then turn your back
    for (let i = 0; i < 200 && ww.entry.state !== 'press'; i++) {
      lookAtPane();
      F.stepWith(0.1, {}, false);
    }
    const atPress = {
      state: ww.entry.state, visible: ww.root.visible,
      t: +ww.state.t.toFixed(3), y: +ww.root.position.y.toFixed(3),
    };
    lookAway();
    const frozenAt = ww.state.t;
    for (let i = 0; i < 60; i++) { lookAway(); F.stepWith(0.1, {}, false); }
    const afterLookAway = {
      state: ww.entry.state, visible: ww.root.visible,
      t: +ww.state.t.toFixed(3),
      drift: +Math.abs(ww.state.t - frozenAt).toFixed(4),
      seen: g.flags.has('windowWatcherSeen'),
      entered: g.flags.has('windowWatcherEntered'),
    };
    return { atPress, afterLookAway };
  })()`);
  report.diagnostics.away = away;

  check(away.atPress.state === 'press' && away.atPress.visible === true,
    'watching it up the pane reaches the hold-at-the-glass beat', away.atPress);
  check(away.afterLookAway.visible === true && !away.afterLookAway.entered
      && away.afterLookAway.drift < 0.001,
    'looking away FREEZES it at the pane — six seconds of back turned does not delete it',
    away.afterLookAway);

  // ------------------------------------------------------------ 3. APPROACH
  await freshPage();
  const near = await page.evaluate(`(() => {
    ${PRELUDE}
    for (let i = 0; i < 200 && ww.entry.state !== 'press'; i++) {
      lookAtPane();
      F.stepWith(0.1, {}, false);
    }
    const before = { state: ww.entry.state, visible: ww.root.visible };
    // walk right up to the glass — the response the scare invites
    let minPlanar = Infinity;
    for (let i = 0; i < 90; i++) {
      lookAtPane();
      F.stepWith(0.1, { moveZ: 1 }, false);
      minPlanar = Math.min(minPlanar,
        Math.hypot(g.player.pos.x - site.x, g.player.pos.z - site.z));
      if (minPlanar < 1.3) break;
    }
    const atGlass = {
      minPlanar: +minPlanar.toFixed(2),
      visible: ww.root.visible,
      recoil: +ww.state.recoil.toFixed(3),
      state: ww.entry.state,
      seen: g.flags.has('windowWatcherSeen'),
    };
    // back off and it comes again
    for (let i = 0; i < 90 && ww.entry.state !== 'done'; i++) {
      lookAtPane();
      F.stepWith(0.1, { moveZ: -1 }, false);
      if (Math.hypot(g.player.pos.x - site.x, g.player.pos.z - site.z) > 3.2) break;
    }
    for (let i = 0; i < 160 && !g.flags.has('windowWatcherEntered'); i++) {
      lookAtPane();
      F.stepWith(0.1, {}, false);
    }
    return { before, atGlass, recovered: {
      entered: g.flags.has('windowWatcherEntered'), state: ww.entry.state,
    } };
  })()`);
  report.diagnostics.near = near;

  check(near.atGlass.minPlanar < 1.5 && near.atGlass.visible === true
      && near.atGlass.recoil > 0.2,
    'walking up to the glass makes it shrink back, not blink out', near.atGlass);
  check(near.recovered.entered === true,
    'and giving it room again lets the beat finish — crowding it never consumes it',
    near.recovered);

  // ------------------------------------------------------- 4. NEVER UNSEEN
  await freshPage();
  const blind = await page.evaluate(`(() => {
    ${PRELUDE}
    // stand in the landing with your back to the window for a full minute
    let everVisibleWhileFacing = false;
    for (let i = 0; i < 600; i++) {
      lookAway();
      F.stepWith(0.1, {}, false);
      if (g.flags.has('windowWatcherEntered')) break;
    }
    return {
      entered: g.flags.has('windowWatcherEntered'),
      seenFlag: g.flags.has('windowWatcherSeen'),
      t: +ww.state.t.toFixed(3),
      entryState: ww.entry.state,
      viewT: +ww.state.viewT.toFixed(2),
      everVisibleWhileFacing,
    };
  })()`);
  report.diagnostics.blind = blind;

  check(blind.entered === false && blind.entryState === 'idle',
    'a minute with your back turned never spends the beat off-camera', blind);
  check(blind.t <= 0.821,
    'the unwatched creep stops short of the top — the last stretch is watched-time only',
    blind);

  // --------------------------------------------------- 5. THE SAFETY VALVE
  await freshPage();
  const valve = await page.evaluate(`(() => {
    ${PRELUDE}
    for (let i = 0; i < 200 && ww.entry.state !== 'press'; i++) {
      lookAtPane();
      F.stepWith(0.1, {}, false);
    }
    const midBeat = ww.entry.state;
    // leaving the act must still crack the sash open for good
    F.teleport('basement');
    F.stepWith(0.4, {}, false);
    return {
      midBeat, entryState: ww.entry.state,
      entered: g.flags.has('windowWatcherEntered'),
      sashLift: +ww.entry.lift.toFixed(3),
      visible: ww.root.visible,
    };
  })()`);
  report.diagnostics.valve = valve;

  check(valve.entered === true && valve.entryState === 'done'
      && valve.sashLift > 0.3 && valve.visible === false,
    'walking out of the act mid-beat still leaves the sash open forever', valve);

  check(report.errors.length === 0, 'zero browser errors', report.errors);
} finally {
  writeFileSync(resultsPath('window-scare-regression.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL PASS');
