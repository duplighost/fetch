// shot-cull-audit.mjs -- which of the house's 93 render roots can the
// graveyard actually SEE?
//
// Round seven, phase 0. Standing mid-yard and looking south submits 1203 draw
// calls against a 450 ceiling, and none of them are the graveyard: walls do
// not occlude anything in three.js, so the 260 m far plane holds the entire
// furnished house — every chair, every skirting board, every doorframe — and
// the frustum takes the lot. syncBackDistrictCulling only engages past the
// forest gate, so inside the yard nothing hides any of it.
//
// The cheap fix is to hide the house's INTERIOR while the player is in the
// graveyard. The dangerous fix is to hide the house's SILHOUETTE, which the
// player is supposed to see standing behind them — this game's whole arrival
// reads against that shape. So the ledger gets built by measurement, not by
// name-guessing: hide one root, render, pixel-diff against the reference
// frame, restore. A root that changes NOTHING at any of the seven poses --
// five worst graveyard views plus two deliberate look-backs at the house --
// is invisible from the district and can be turned off for free.
//
// Writes tests/results/cull-audit.json: the invisible list, by index, with the
// per-pose delta each root produced so a later reader can see the margin.
//
//   node tools/shot-cull-audit.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

// [name, fromX, fromZ, toX, toTargetY, toZ] -- the five worst draw poses, then
// the two that must NOT change: the yard's south edge staring at the house
// door, and the gate line looking back over the whole yard at it.
const POSES = [
  ['08-mid-yard-looking-SOUTH', 0, 30, 0, 1.4, 5],
  ['04-the-car-beside-it', -12.2, 14.5, -9, 0.9, 14],
  ['05-the-car-from-its-beam', -3.6, 20.5, -9, 1.0, 14.5],
  ['01-arrival-from-the-house', 0, 7.5, 0, 1.4, 20],
  ['02-arrival-wide-east', 1, 9.5, 12, 1.6, 26],
  ['L1-south-edge-at-the-door', 0, 11.0, 0, 1.9, 2],
  ['L2-gate-line-looking-back', 2, 40.0, 0, 3.0, 2],
];

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 180000, polling: 100 });
  const out = await page.evaluate(async (poses) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.teleport('graveyard');
    F.stepWith(1.2, {}, false);
    g.skull.holdNow();
    F.stepWith(0.6, {}, false);

    const look = (px, pz, tx, ty, tz) => {
      g.player.pos.set(px, g.world.groundHeightAt(px, pz, 3), pz);
      g.player.vel.set(0, 0, 0);
      const ey = g.player.pos.y + 1.62;
      g.player.yaw = Math.atan2(-(tx - px), -(tz - pz));
      g.player.pitch = Math.max(-1.2, Math.min(1.2,
        Math.atan2(ty - ey, Math.hypot(tx - px, tz - pz))));
      g.player._sync(0);
      F.stepWith(0.3, {}, false);
    };
    // Grab the frame as raw bytes at a modest size. 320x200 is small enough to
    // diff 93 roots x 7 poses in reasonable time and still large enough that a
    // chair leg two rooms away lands on a pixel.
    const W = 320, H = 200;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => {
      g.render();
      ctx.drawImage(g.renderer.domElement, 0, 0, W, H);
      return ctx.getImageData(0, 0, W, H).data;
    };
    // render() is NOT idempotent: it decays fovKick, the impact light and the
    // impact ring by a fixed dt every call, so two consecutive renders of an
    // unchanged scene differ — the first version of this tool measured that
    // decay and reported a ~16915 "delta" for every root in the house. Render
    // until two frames come back byte-identical, then measure.
    const settle = (limit = 40) => {
      let prev = grab();
      for (let i = 0; i < limit; i++) {
        const next = grab();
        let same = true;
        for (let k = 0; k < prev.length; k += 4) {
          if (prev[k] !== next[k] || prev[k + 1] !== next[k + 1] || prev[k + 2] !== next[k + 2]) { same = false; break; }
        }
        if (same) return { frame: next, renders: i + 2, settled: true };
        prev = next;
      }
      return { frame: prev, renders: limit + 1, settled: false };
    };
    // Sum of absolute luminance difference, and the worst single pixel. A root
    // is "invisible" only if BOTH are zero -- not "small", zero.
    const diff = (a, b) => {
      let sum = 0, worst = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.abs((a[i] + a[i + 1] + a[i + 2]) - (b[i] + b[i + 1] + b[i + 2]));
        sum += d;
        if (d > worst) worst = d;
      }
      return { sum, worst };
    };

    const roots = g.houseRenderRoots || [];
    // Lights live under world.lightRoot, never under a house render root --
    // the district cullers rely on that (they skip anything whose parent is
    // not the scene). Assert it here rather than trusting the comment.
    let lightsUnderRoots = 0;
    for (const root of roots) root.traverse((o) => { if (o.isLight) lightsUnderRoots++; });

    // A root that is already hidden at build time is not a culling win: it is
    // already off. Test only what is actually on, and record the rest as such.
    const ledger = roots.map((root, i) => ({
      i,
      name: root.name || `(unnamed ${root.type})`,
      type: root.type,
      visible: root.visible,
      alreadyOff: !root.visible,
      isLight: root.isLight === true,
      poses: {},
      totalSum: 0,
      totalWorst: 0,
    }));

    const poseDraws = {}, poseSettle = {};
    for (const [name, px, pz, tx, ty, tz] of poses) {
      look(px, pz, tx, ty, tz);
      const base = settle();
      poseDraws[name] = g.lastRender.drawCalls;
      poseSettle[name] = { renders: base.renders, settled: base.settled };
      const reference = base.frame;
      for (const entry of ledger) {
        const root = roots[entry.i];
        // never flip a light: the visible light count keys every shader
        // program in the game and a mid-play recompile is the round-five freeze
        if (entry.alreadyOff || entry.isLight) {
          entry.poses[name] = { sum: 0, worst: 0, skipped: true };
          continue;
        }
        root.visible = false;
        const shot = grab();
        root.visible = true;
        const d = diff(reference, shot);
        entry.poses[name] = d;
        entry.totalSum += d.sum;
        entry.totalWorst = Math.max(entry.totalWorst, d.worst);
      }
    }

    // What does hiding the whole invisible set actually buy, per pose?
    const invisible = ledger.filter((e) => !e.alreadyOff && !e.isLight
      && e.totalSum === 0 && e.totalWorst === 0);
    const savings = {};
    for (const [name, px, pz, tx, ty, tz] of poses) {
      look(px, pz, tx, ty, tz);
      const base = settle();
      const beforeDraws = g.lastRender.drawCalls;
      for (const entry of invisible) roots[entry.i].visible = false;
      const after = grab();
      const afterDraws = g.lastRender.drawCalls;
      const d = diff(base.frame, after);
      for (const entry of invisible) roots[entry.i].visible = true;
      savings[name] = { beforeDraws, afterDraws, saved: beforeDraws - afterDraws, residual: d };
    }

    return {
      rootCount: roots.length,
      alreadyOff: ledger.filter((e) => e.alreadyOff).length,
      lightRoots: ledger.filter((e) => e.isLight).length,
      lightsUnderRoots,
      poseDraws,
      poseSettle,
      savings,
      ledger: ledger.map((e) => ({
        i: e.i, name: e.name, type: e.type, visible: e.visible,
        alreadyOff: e.alreadyOff, isLight: e.isLight,
        totalSum: e.totalSum, totalWorst: e.totalWorst,
        poses: e.poses,
      })),
    };
  }, POSES);

  const invisible = out.ledger.filter((e) => !e.alreadyOff && !e.isLight
    && e.totalSum === 0 && e.totalWorst === 0);
  const visible = out.ledger.filter((e) => e.totalSum > 0 || e.totalWorst > 0);
  console.log(`house render roots: ${out.rootCount}`
    + `  (already hidden ${out.alreadyOff}, lights ${out.lightRoots})`);
  console.log(`lights nested under house render roots: ${out.lightsUnderRoots}`);
  console.log('settle renders per pose: '
    + Object.entries(out.poseSettle).map(([k, v]) => `${k}=${v.renders}${v.settled ? '' : '!UNSETTLED'}`).join(' '));
  console.log(`\nINVISIBLE from the graveyard at all ${POSES.length} poses: ${invisible.length}`);
  for (const e of invisible) console.log(`  [${String(e.i).padStart(2)}] ${e.name}`);
  console.log(`\nVISIBLE (leave alone): ${visible.length}`);
  for (const e of visible.sort((a, b) => b.totalSum - a.totalSum)) {
    console.log(`  [${String(e.i).padStart(2)}] ${e.name.padEnd(34)} sum ${String(e.totalSum).padStart(9)}  worst ${e.totalWorst}`);
  }
  console.log('\ndraws per pose, and what hiding the invisible set saves:');
  for (const [name] of POSES) {
    const s = out.savings[name];
    console.log(`  ${name.padEnd(30)} ${String(s.beforeDraws).padStart(4)} -> ${String(s.afterDraws).padStart(4)}`
      + `  (saved ${String(s.saved).padStart(4)})   residual pixels sum ${s.residual.sum} worst ${s.residual.worst}`);
  }
  console.log('\nerrors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('cull-audit.json'), JSON.stringify({
    invisibleIndices: invisible.map((e) => e.i),
    invisibleNames: invisible.map((e) => e.name),
    ...out,
  }, null, 2));
} finally {
  await browser.close();
  server.stop();
}
