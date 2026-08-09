// Adversarial forest safety gate. Unlike probe-stuck, this exercises death
// after the cumulative seal has advanced, edge-biased checkpoints, and the
// first real movement frames after restore.
//   node tests/forest-hardening.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
const report = { url: `${URL_BASE}/?test=1&mute=1`, checks: [], browserErrors: [] };

try {
  const { page, errors } = await openPage(browser, report.url);
  report.browserErrors = errors;
  await page.waitForFunction(
    () => window.__FETCH?.ready === true && window.__game,
    null,
    { timeout: 60000, polling: 100 },
  );

  report.checks = await page.evaluate(() => {
    const F = window.__FETCH;
    const g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    F.start();
    F.teleport('forest');
    F.stepWith(0.2, {}, false);
    g.enemies.clear();
    const f = g.forest;

    // Manufacture the exact lifecycle a normal death creates: the cumulative
    // seal has eaten well past a checkpoint, then respawn re-seats the player
    // behind those already-rendered trees.
    f.sealAnim.length = 0;
    f.sealMesh.count = 0;
    f._sealPlaced = 104;
    f.sealS = 126;
    f._placeSeal(true);
    const historicalCount = f.sealAnim.length;
    const checkpointS = 74;
    const unsafeEdge = f.posAt(checkpointS, f.halfW[checkpointS] - 0.12);
    g.checkpoint('forest', {
      pos: { x: unsafeEdge.x, y: f.heightAt(unsafeEdge.x, unsafeEdge.z), z: unsafeEdge.z },
      yaw: Math.PI,
      pitch: 0,
    });
    g.dead = true;
    g.director.respawn();
    F.stepWith(0.15, {}, false);

    const restored = f.project(g.player.pos.x, g.player.pos.z);
    const sealAhead = f.sealAnim.filter((tree) => {
      const p = f.project(tree.x, tree.z);
      return p && p.s > restored.s - 3;
    });
    const nearestSeal = f.sealAnim.reduce((best, tree) => Math.min(
      best,
      Math.hypot(tree.x - g.player.pos.x, tree.z - g.player.pos.z),
    ), Infinity);
    check(
      'respawn removes cumulative seal geometry from the restored lane',
      historicalCount > 0 && sealAhead.length === 0 && nearestSeal > 5.5,
      {
        historicalCount,
        restoredS: +restored.s.toFixed(2),
        remainingSeal: f.sealAnim.length,
        sealAhead: sealAhead.length,
        nearestSeal: Number.isFinite(nearestSeal) ? +nearestSeal.toFixed(2) : null,
      },
    );
    check(
      'forest respawn resolves to an authored centerline safety pad',
      Math.abs(restored.lat) <= 0.35,
      { s: +restored.s.toFixed(2), lat: +restored.lat.toFixed(3), pos: [g.player.pos.x, g.player.pos.y, g.player.pos.z] },
    );

    // Clamp a grounded player from a deliberately impossible lateral breach.
    // XZ correction and ground resolution must describe the same final point
    // in the same frame; otherwise the next frame begins below a new floor.
    const breachS = 64;
    const breach = f.posAt(breachS, f.halfW[breachS] + 18);
    g.player.pos.set(breach.x, -1.2, breach.z);
    g.player.grounded = true;
    f._lastIdx = breachS;
    f.clampPlayer(g.player.pos, 1 / 60);
    const clampedGround = f.heightAt(g.player.pos.x, g.player.pos.z);
    const clamped = f.project(g.player.pos.x, g.player.pos.z);
    check(
      'a lateral clamp leaves grounded feet on the corrected terrain',
      Math.abs(clamped.lat) <= f.halfW[clamped.i] - 0.34
        && g.player.pos.y >= clampedGround - 0.02,
      {
        s: +clamped.s.toFixed(2), lat: +clamped.lat.toFixed(3),
        y: +g.player.pos.y.toFixed(3), ground: +clampedGround.toFixed(3),
      },
    );

    // Restore from both edges at several authored progress points, including
    // before and after the ravine but never inside its intentional gash. Every
    // restored life must start on clear ground and make forward progress using
    // ordinary movement input.
    const samples = [18, 46, 78, f.ravineS() + 8, f.arenaS() - 8, f.arenaS() + 12];
    const soak = [];
    for (let n = 0; n < samples.length; n++) {
      const s = samples[n];
      const side = n % 2 ? -1 : 1;
      const edge = f.posAt(s, side * (f.halfW[s] - 0.04));
      g.checkpoint('forest', { pos: { x: edge.x, y: f.heightAt(edge.x, edge.z), z: edge.z }, yaw: 0, pitch: 0 });
      f.sealS = Math.min(f.length - 2, s + 24);
      f._placeSeal(true);
      g.dead = true;
      g.director.respawn();
      F.stepWith(0.1, {}, false);
      const start = f.project(g.player.pos.x, g.player.pos.z);
      const startY = g.player.pos.y;
      let lowestY = startY;
      let pinnedFor = 0;
      let prev = g.player.pos.clone();
      // This is a restore-and-move safety soak, not an automated ravine
      // solution. Keep the trial long enough to expose a pin while stopping
      // well before the authored rope gap when the sample begins at s=78.
      for (let i = 0; i < 28; i++) {
        const pr = f.project(g.player.pos.x, g.player.pos.z);
        const target = f.posAt(Math.min(f.length - 1, pr.s + 5));
        g.player.yaw = Math.atan2(-(target.x - g.player.pos.x), -(target.z - g.player.pos.z));
        F.stepWith(0.1, { moveZ: 1, run: i % 3 !== 0 }, false);
        lowestY = Math.min(lowestY, g.player.pos.y);
        const moved = prev.distanceTo(g.player.pos);
        pinnedFor = moved < 0.018 ? pinnedFor + 0.1 : 0;
        prev = g.player.pos.clone();
      }
      const end = f.project(g.player.pos.x, g.player.pos.z);
      const nearTree = f.sealAnim.reduce((best, tree) => Math.min(
        best,
        Math.hypot(tree.x - g.player.pos.x, tree.z - g.player.pos.z),
      ), Infinity);
      soak.push({
        requestedS: s,
        startS: +start.s.toFixed(2), startLat: +start.lat.toFixed(3), startY: +startY.toFixed(3),
        endS: +end.s.toFixed(2), progress: +(end.s - start.s).toFixed(2),
        lowestY: +lowestY.toFixed(3), pinnedFor: +pinnedFor.toFixed(2),
        nearestSeal: Number.isFinite(nearTree) ? +nearTree.toFixed(2) : null,
        dead: g.dead,
      });
    }
    check(
      'edge-biased death/respawn soak always starts clear and can move forward',
      soak.every((r) => Math.abs(r.startLat) <= 0.35
        && r.lowestY > -3.5
        && r.progress > 3
        && r.pinnedFor < 0.8
        && !r.dead),
      soak,
    );

    return checks;
  });

  for (const c of report.checks) {
    console.log(` ${c.passed ? 'PASS' : 'FAIL'} ${c.name}`
      + (c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`));
    if (!c.passed) exit = 1;
  }
  for (const error of report.browserErrors) console.log(` browser: ${error}`);
  if (report.browserErrors.length) exit = 1;
  console.log(`${exit ? 'FAIL' : 'PASS'}: ${report.checks.length} checks, ${report.browserErrors.length} browser errors (${report.url})`);
  writeFileSync(resultsPath('forest-hardening.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error && (error.stack || error.message) || String(error));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}

process.exit(exit);
