// ROUND NINE, item 3: the kennel cradle arms the counterweight, the wire says
// so before it is used, and the two residents live in the pockets now.
//   node tools/probe-ossuary-arming.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, SHOTS } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
mkdirSync(SHOTS, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const shots = {};
    const snap = (name) => {
      for (let i = 0; i < 3; i++) g.render();     // decay settles before we look
      shots[name] = g.renderer.domElement.toDataURL('image/png');
    };
    const lookAt = (x, y, z) => {
      const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
      g.player.yaw = Math.atan2(-(x - ex), -(z - ez));
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(y - ey, Math.hypot(x - ex, z - ez))));
      g.player._sync(0);
    };
    const seat = (x, z, y) => {
      g.player.pos.set(x, y, z);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      g.player._sync(0);
    };

    F.start();
    F.teleport('graveyard');
    g.director._completeGraveyard('loud');
    for (let i = 0; i < 40; i++) F.stepWith(0.1, {}, false);
    g.skull.holdNow();
    const st = g.ossuary;
    const OX = -70, OZ = -10, FLOOR = -4.2;

    // ---- E TAKES YOU DOWN AT ONCE (item 2, checked here too) -------------
    seat(-14.6, 34.2 - 1.35, 0.04);
    const t0 = g.time;
    st.descend();
    F.stepWith(1 / 60, {}, false);
    check('E descends on the very next tick, no lid wait',
      st.inOssuary === true, { lidT: +st.entryLid.t.toFixed(3), dt: +(g.time - t0).toFixed(3) });

    // ---- WHERE THE RESIDENTS ACTUALLY STAND ------------------------------
    const residents = g.enemies.list.filter((e) => e.ossuaryResident).map((e) => {
      const x = e.pos.x, z = e.pos.z;
      const floor = g.world.groundHeightAt(x, z, FLOOR + 1.2);
      const inside = g.world.colliders.filter((c) =>
        x > c.min.x - 0.3 && x < c.max.x + 0.3 && z > c.min.z - 0.3 && z < c.max.z + 0.3
        && c.max.y > FLOOR && c.min.y < FLOOR + 1.8).map((c) => c.userData?.id || 'wall');
      return { x: +x.toFixed(2), z: +z.toFixed(2), dx: +(x - OX).toFixed(2), dz: +(z - OZ).toFixed(2),
        floorErr: +(floor - FLOOR).toFixed(3), crowding: inside };
    });
    check('two residents, both on real ossuary floor',
      residents.length === 2 && residents.every((r) => Math.abs(r.floorErr) < 0.2), residents);
    check('neither resident stands in the counterweight hold (z+15.4..18.2)',
      residents.every((r) => r.dz < 15.4 || r.dz > 18.2), residents.map((r) => r.dz));

    // let them settle for a second and make sure nobody is grinding on stone
    const before = residents.map((r) => [r.x, r.z]);
    F.stepWith(1.5, {}, false);
    const after = g.enemies.list.filter((e) => e.ossuaryResident)
      .map((e) => [+e.pos.x.toFixed(2), +e.pos.z.toFixed(2)]);
    // standing walkers CREEP while unobserved — that is the encounter, not a
    // bug. What must not happen is one of them ending up inside stone, or
    // slipping its tether.
    const stuck = g.enemies.list.filter((e) => e.ossuaryResident).map((e) => ({
      x: +e.pos.x.toFixed(2), z: +e.pos.z.toFixed(2),
      fromHome: +Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z).toFixed(2),
      tether: e.tether,
      inStone: g.world.colliders.some((c) => e.pos.x > c.min.x && e.pos.x < c.max.x
        && e.pos.z > c.min.z && e.pos.z < c.max.z && c.max.y > FLOOR + 0.2 && c.min.y < FLOOR + 1.6),
    }));
    check('neither resident ends up inside stone, or off its tether',
      stuck.every((s) => !s.inStone && s.fromHome <= s.tether + 0.35), stuck);

    // ---- THE WHEEL IS DEAD, AND SAYS SO ----------------------------------
    // stand OFF the centre line: the held skull owns the bottom middle of
    // every frame, and the pawl lives exactly there from head on
    seat(OX + 1.5, OZ + 24.5, FLOOR);
    lookAt(OX, FLOOR + 0.85, OZ + 26.3);
    F.stepWith(0.2, {}, false);
    check('the counterweight starts DISARMED', st.armed === false && st.armT < 0.05,
      { armT: +st.armT.toFixed(3) });
    const lamps = () => ({ kennelLamp: +g.ossuaryKennel.lamp.intensity.toFixed(2),
      wheelCore: +(g.ossuary._coreOpacity ?? -1).toFixed(3) });
    const lampsBefore = lamps();
    const cw = g.world.fetchTargets.find((t) => t.id === 'ossuaryCounterweight');
    check('...and its target is still ENABLED, so a throw is answered not swallowed',
      !!cw && cw.enabled === true);
    snap('01-wheel-dead-pawl-in');

    // a throw at the dead wheel must knock, not anchor
    const heard = [];
    const realKnock = g.audio.knock.bind(g.audio);
    g.audio.knock = (o) => { heard.push('knock'); return realKnock(o); };
    const verdict = cw.onHit.call(cw, { mode: 'outbound' }, null);
    check('a locked wheel answers a throw OUT LOUD and sends it home',
      verdict === 'return' && heard.length > 0 && st.pulling === false,
      { verdict, heard: heard.length });
    g.audio.knock = realKnock;

    // ---- THE CRADLE ARMS IT ----------------------------------------------
    const kp = g.ossuaryKennel;
    g.skull.holdNow();
    g.skull.mode = 'outbound';
    kp.target.onHit.call(kp.target, g.skull);   // the skull lands in the basket
    F.stepWith(kp.requiredHold + 0.25, { throwHeld: true }, false);
    check('the kennel solving arms the counterweight',
      kp.solved === true && st.armed === true, { kennelSolved: kp.solved, armed: st.armed });
    F.stepWith(2.0, {}, false);
    check('the pawl comes out of the rim', st.armT > 0.95, { armT: +st.armT.toFixed(3) });
    seat(OX + 1.5, OZ + 24.5, FLOOR);
    lookAt(OX, FLOOR + 0.85, OZ + 26.3);
    F.stepWith(0.1, {}, false);
    snap('02-wheel-armed-pawl-out');
    const lampsAfter = lamps();
    // the frame gets much brighter here and it is NOT all mine: the kennel's
    // own lamp goes 1.5 -> 9.5 on solve and has since round six. Mine is the
    // wheel core, 0.02 -> ~0.32. Measured, because the shot alone would have
    // let me claim either one.
    check('the wheel core comes up on arming (and the flood is the kennel lamp)',
      lampsAfter.wheelCore > lampsBefore.wheelCore * 10 && lampsAfter.kennelLamp > 8,
      { lampsBefore, lampsAfter });

    // ---- AND THE HOLD STILL HAS TO BE PAID -------------------------------
    check('the counterweight hold itself is untouched (not auto-solved)',
      st.solved === false && st.progress < 0.05, { progress: +st.progress.toFixed(3) });

    // ---- THE WIRE IS VISIBLE FROM THE WALK UP ----------------------------
    // ---- IS THE WIRE ACTUALLY VISIBLE? measured, not eyeballed -----------
    // The legibility law: toggle the thing off, re-render the SAME pose, and
    // count the pixels that changed. A conduit nobody can see is not a wire.
    const conduitShell = g.ossuaryConduit;
    check('the conduit is one mesh inside routeRoot (the seal hides everything else)',
      !!conduitShell && conduitShell.parent === g.ossuary.root);
    const litFrac = (poseFn) => {
      poseFn();
      for (let i = 0; i < 3; i++) g.render();
      const c = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d');
      cx.drawImage(c, 0, 0);
      const on = cx.getImageData(0, 0, cv.width, cv.height).data;
      conduitShell.visible = false;
      for (let i = 0; i < 3; i++) g.render();
      cx.drawImage(c, 0, 0);
      const off = cx.getImageData(0, 0, cv.width, cv.height).data;
      conduitShell.visible = true;
      let changed = 0, sumOn = 0, sumOff = 0, n = 0;
      for (let i = 0; i < on.length; i += 4) {
        const lOn = on[i] * 0.2126 + on[i + 1] * 0.7152 + on[i + 2] * 0.0722;
        const lOff = off[i] * 0.2126 + off[i + 1] * 0.7152 + off[i + 2] * 0.0722;
        if (Math.abs(lOn - lOff) > 4) { changed++; sumOn += lOn; sumOff += lOff; n++; }
      }
      return { pctChanged: +(100 * changed / (on.length / 4)).toFixed(2),
        ratio: n ? +(sumOn / Math.max(1, sumOff)).toFixed(2) : 0 };
    };
    const wireNear = litFrac(() => {
      seat(OX + 0.9, OZ + 15.4, FLOOR);
      lookAt(OX - 0.55, FLOOR + 0.05, OZ + 18.4);
      F.stepWith(0.1, {}, false);
    });
    const wireFar = litFrac(() => {
      seat(OX + 0.9, OZ + 12.9, FLOOR);
      lookAt(OX - 0.55, FLOOR + 0.05, OZ + 20.6);
      F.stepWith(0.1, {}, false);
    });
    check('the wire is genuinely on screen from the walk-up (>=0.35% of frame, >=1.6x)',
      wireNear.pctChanged >= 0.35 && wireNear.ratio >= 1.6, { wireNear, wireFar });

    // the clear stretch between baffle 2 (z+14.5) and baffle 3 (z+22)
    seat(OX + 0.9, OZ + 15.4, FLOOR);
    lookAt(OX - 0.55, FLOOR + 0.03, OZ + 20.6);
    F.stepWith(0.1, {}, false);
    snap('03-the-wire-north-mid-corridor');
    // the wire arriving at the machine and climbing the plinth
    seat(OX + 1.2, OZ + 23.6, FLOOR);
    lookAt(OX - 0.55, FLOOR + 0.2, OZ + 25.9);
    F.stepWith(0.1, {}, false);
    snap('04-the-wire-reaching-the-plinth');
    // and leaving the cradle, seen from the corridor gap
    seat(OX - 2.4, OZ + 12.4, FLOOR);
    lookAt(OX - 5.4, FLOOR + 0.5, OZ + 12.4);
    F.stepWith(0.1, {}, false);
    snap('05-the-wire-out-of-the-cell');

    return { checks, shots, residents };
  });

  for (const [name, data] of Object.entries(out.shots)) {
    writeFileSync(join(SHOTS, `r9-arming-${name}.png`),
      Buffer.from(data.split(',')[1], 'base64'));
  }
  let bad = 0;
  for (const c of out.checks) {
    if (!c.passed) bad++;
    console.log(`${c.passed ? 'PASS' : 'FAIL'} ${c.name}${c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`}`);
  }
  console.log(`\nshots -> ${SHOTS}\r9-arming-*.png`);
  console.log(bad ? `${bad} FAILURE(S)` : 'ALL PASS');
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
  process.exitCode = bad ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
