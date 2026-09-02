// probe-mire-rail.mjs -- Alex, 2026-09-01: "make the pit you can fall into the
// forest moor clear. maybe even block it off so you have to use the thing to
// swing in the air (but make sure that thing actually doesn't stop you from
// going over however we block it."
//
// The caveat is the whole test. Three questions, in the order he asked them:
//   1. can you still walk into the bog?  (it must refuse)
//   2. does the rail eat the throw?      (skullPass says it cannot)
//   3. does the rail eat the swing?      (its top drops while player.swing)
// and one more he did not have to ask: the crossing still lands you across.
//
//   node tools/probe-mire-rail.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let failures = 0;
const check = (ok, name, details) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${details === undefined ? '' : ' -- ' + JSON.stringify(details)}`);
};
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game?.forest,
    null, { timeout: 300000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game, f = g.forest;
    const R = {};
    const rs = f.ravineS();

    const seat = (s, lat = 0) => {
      const p = f.posAt(s, lat);
      g.dead = false; g.player.frozen = false;
      g.player.abortSwing();
      g.player.pos.set(p.x, f.heightAt(p.x, p.z) + 0.05, p.z);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      f.recentre(g.player.pos);
      g.player._sync(0);
    };
    const faceAlong = (s) => {
      const a = f.posAt(s, 0), b = f.posAt(s + 2, 0);
      g.player.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      g.player.pitch = 0;
      g.player._sync(0);
    };

    F.start();
    F.teleport('forest');
    F.stepWith(0.3, {}, false);
    g.flag('treeCleared');
    R.rail = {
      built: !!f.mireRail,
      colliders: f.mireRail ? f.mireRail.colliders.length : 0,
      s: f.mireRail ? +f.mireRail.s.toFixed(2) : null,
      ravineS: rs,
    };

    // ---- 1. WALK AT IT, hard, for ten seconds --------------------------
    seat(rs - 7);
    faceAlong(rs - 7);
    let walked = { closestS: -99, sank: 0, died: false };
    for (let t = 0; t < 10; t += 0.1) {
      faceAlong(f.project(g.player.pos.x, g.player.pos.z)?.s ?? rs - 7);
      F.stepWith(0.1, { moveZ: 1, run: true }, false);
      const pr = f.project(g.player.pos.x, g.player.pos.z);
      if (pr && pr.s > walked.closestS) walked.closestS = pr.s;
      if (f._mireDepth > walked.sank) walked.sank = f._mireDepth;
      if (g.dead) { walked.died = true; break; }
    }
    walked.closestS = +walked.closestS.toFixed(2);
    walked.sank = +(walked.sank || 0).toFixed(3);
    walked.stoppedShortBy = +(rs - walked.closestS).toFixed(2);
    R.walk = walked;

    // and try to go AROUND it, hugging each side wall
    const around = {};
    for (const side of [-1, 1]) {
      seat(rs - 7, side * (f.halfW[Math.round(rs - 7)] - 0.2));
      let best = -99;
      for (let t = 0; t < 9; t += 0.1) {
        const pr0 = f.project(g.player.pos.x, g.player.pos.z);
        faceAlong(pr0?.s ?? rs - 7);
        F.stepWith(0.1, { moveZ: 1, moveX: side * 0.6, run: true }, false);
        const pr = f.project(g.player.pos.x, g.player.pos.z);
        if (pr && pr.s > best) best = pr.s;
        if (g.dead) break;
      }
      around[side < 0 ? 'left' : 'right'] = +best.toFixed(2);
    }
    R.around = around;

    // ---- 2 + 3. THE CROSSING, exactly as the game teaches it ------------
    seat(rs - 5);
    g.skull.holdNow();
    F.stepWith(0.4, {}, false);
    const rope = f.ropeAnchor;
    const dx = rope.x - g.player.pos.x, dz = rope.z - g.player.pos.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(rope.y - (g.player.pos.y + 1.62), Math.hypot(dx, dz) || 0.001);
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    const cross = { latched: false, swung: false, maxY: -99, endS: null, railDown: false };
    // HOLD IS THE TETHER. Releasing the instant the far lip goes past is a
    // probe that drops itself in the bog: ride the arc to its own end.
    let held = 0;
    for (let t = 0; t < 7; t += 1 / 60) {
      F.stepWith(1 / 60, { throwHeld: true }, false);
      if (g.flags.has('ropeLatched')) cross.latched = true;
      if (g.player.swing) {
        held += 1 / 60;
        cross.swung = true;
        if (f.mireRail.colliders.every((c) => c.max.y === c.min.y)) cross.railDown = true;
      } else if (cross.swung) {
        const pr0 = f.project(g.player.pos.x, g.player.pos.z);
        cross.endS = pr0 ? +pr0.s.toFixed(2) : null;
        break;
      }
      if (g.player.pos.y > cross.maxY) cross.maxY = g.player.pos.y;
      if (g.dead) { cross.died = true; break; }
    }
    cross.heldFor = +held.toFixed(2);
    for (let t = 0; t < 3 && !g.dead; t += 0.1) F.stepWith(0.1, {}, false);
    const prEnd = f.project(g.player.pos.x, g.player.pos.z);
    cross.finalS = prEnd ? +prEnd.s.toFixed(2) : null;
    cross.maxY = +cross.maxY.toFixed(2);
    cross.railBackUp = f.mireRail.colliders.every((c) => c.max.y > c.min.y);
    cross.dead = !!g.dead;
    R.cross = cross;
    return R;
  });

  console.log(JSON.stringify(out, null, 2));
  console.log('');
  check(out.rail.built && out.rail.colliders >= 8, 'the rail exists across the near lip', out.rail);
  check(out.walk.closestS < out.rail.ravineS - 2.9 && !out.walk.died && out.walk.sank < 0.05,
    'a ten-second run straight at the bog is REFUSED before the sink zone', out.walk);
  check(out.around.left < out.rail.ravineS - 2.9 && out.around.right < out.rail.ravineS - 2.9,
    'and it cannot be walked around on either side wall', out.around);
  check(out.cross.latched, 'the throw still reaches the rope -- the rail is skullPass', { latched: out.cross.latched });
  check(out.cross.railDown, 'the rail drops its tops for the whole swing', { railDown: out.cross.railDown });
  check(out.cross.finalS !== null && out.cross.finalS > out.rail.ravineS + 1 && !out.cross.dead,
    'and the swing puts you across, alive', { finalS: out.cross.finalS, maxY: out.cross.maxY, dead: out.cross.dead });
  check(out.cross.railBackUp, 'the rail is solid again the moment the swing ends', { up: out.cross.railBackUp });
  console.log('\nerrors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('mire-rail.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
console.log(failures ? `\nFAIL: ${failures} checks` : '\nAll checks passed');
if (failures) process.exitCode = 1;
