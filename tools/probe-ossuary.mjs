// probe-ossuary.mjs — THE WAY IN, driven the way a player drives it.
//
// The old version teleported straight into the throat band and then demanded
// the forest-side climb-out verb, which aug15 nailed shut for good; it exits 1
// on this tree and proves nothing about the doorway. Alex's §5 complaint —
// "that area isn't able to be entered even though the hatch is on the ground
// inside it" — is a GRAMMAR failure, not a trigger failure, so this probe
// tests the grammar: does the crosshair offer a verb, does E take you down,
// does a throw get an answer, does the walk-over still work, does the skull-
// away cross refuse OUT LOUD, is the far end still sealed, and does the
// counterweight still pay out gate key 1.
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
    const snap = (name) => { g.render(); shots[name] = g.renderer.domElement.toDataURL('image/png'); };

    const MX = -14.6, MZ = 34.2;             // the west (ritual) mausoleum
    const walkTo = (x, z, maxS = 30) => {
      let t = 0;
      while (t < maxS) {
        const dx = x - g.player.pos.x, dz = z - g.player.pos.z;
        if (Math.hypot(dx, dz) < 0.34) return true;
        g.player.yaw = Math.atan2(-dx, -dz);
        F.stepWith(0.08, { moveZ: 1 }, false);
        t += 0.08;
      }
      return false;
    };
    const lookAt = (x, y, z) => {
      const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
      g.player.yaw = Math.atan2(-(x - ex), -(z - ez));
      g.player.pitch = Math.max(-1.3, Math.min(1.3,
        Math.atan2(y - ey, Math.hypot(x - ex, z - ez))));
      g.player._sync(0);
    };

    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);
    const st = g.ossuary;

    check('sealed before the funeral: no verb, no throw answer',
      st.unlocked === false
      && !g.world.interactables.some((o) => o.userData.inter?.id === 'ossuaryDescend'
        && o.userData.inter.enabled)
      && !g.world.fetchTargets.some((t) => t.id === 'ossuaryThroat' && t.enabled));

    g.director._completeGraveyard('loud');
    for (let i = 0; i < 40; i++) F.stepWith(0.1, {}, false);
    check('the funeral opens it', st.unlocked === true);

    // ---- THE CROSSHAIR OFFERS IT -----------------------------------------
    // stand short of the throat, in the doorway, and look down at the hole
    walkTo(MX, MZ - 2.0, 40);
    walkTo(MX, MZ - 1.35, 10);
    lookAt(MX, 0.07, MZ + 0.25);           // the mouth itself, where a player looks
    F.stepWith(0.1, {}, false);
    const lit = g.crosshairTarget ? g.crosshairTarget() : g._crosshairTarget?.();
    check('leaning over the hole LIGHTS a verb',
      !!lit && lit.id === 'ossuaryDescend', { got: lit ? lit.id : null });
    snap('01-the-throat-from-the-doorway');

    // ---- IT ANSWERS A THROW ----------------------------------------------
    const throat = g.world.fetchTargets.find((t) => t.id === 'ossuaryThroat');
    check('and it answers a throw at all', !!throat && throat.enabled === true);

    // ---- SKULL AWAY: REFUSED OUT LOUD, NOT SILENTLY ----------------------
    const heard = [];
    const realKnock = g.audio.lockedRattle.bind(g.audio);
    g.audio.lockedRattle = (o) => { heard.push('lockedRattle'); return realKnock(o); };
    g.skull.vanish?.();
    F.stepWith(0.2, {}, false);
    const modeAway = g.skull.mode;
    g.ossuary.descend();
    F.stepWith(0.2, {}, false);
    check('with the skull away the throat refuses OUT LOUD, and does not take you',
      st.inOssuary === false && heard.length > 0, { mode: modeAway, heard: heard.length });
    g.audio.lockedRattle = realKnock;
    g.skull.holdNow();
    F.stepWith(0.3, {}, false);

    // ---- E TAKES YOU DOWN -------------------------------------------------
    g.ossuary.descend();
    F.stepWith(0.25, {}, false);
    check('E on the mouth takes you down',
      st.inOssuary === true && g.flags.has('ossuaryEntered') && g.act === 'graveyard',
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) });
    snap('02-arrived-under-the-yard');

    // ---- BACK OUT, THEN IN AGAIN BY WALKING ------------------------------
    // straight back the way we came: yaw 0 walks -z, which is the throat wall
    g.player.yaw = 0;
    g.player._sync(0);
    for (let i = 0; i < 60 && st.inOssuary; i++) F.stepWith(0.08, { moveZ: 1 }, false);
    check('the way in is two-way: you walk back out into the yard',
      st.inOssuary === false && g.act === 'graveyard',
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) });
    walkTo(MX, MZ + 0.5, 14);
    F.stepWith(0.2, {}, false);
    check('and the old walk-over still works, untouched', st.inOssuary === true);

    // ---- THE FAR END IS SEALED, AND THE KEY IS THE REWARD -----------------
    const climbOutInter = g.world.interactables
      .map((o) => o.userData.inter).find((i) => i && i.id === 'ossuaryClimbOut');
    check('the far end has no way out, ever',
      climbOutInter && climbOutInter.enabled === false && !g.flags.has('ossuaryExited'));

    st.solved = true;
    st.progress = 1;
    for (let i = 0; i < 40; i++) F.stepWith(0.1, {}, false);
    const key1 = g.gateKeys.list[0];
    check('the counterweight pays out gate key one, and nothing else',
      key1.revealed === true && !g.flags.has('graveyardCleared'),
      { at: key1.home.toArray().map((v) => +v.toFixed(2)) });
    snap('03-the-key-at-the-end');

    return { checks, shots, dead: g.dead };
  });

  for (const [name, url] of Object.entries(out.shots)) {
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  for (const c of out.checks) {
    console.log((c.passed ? 'PASS ' : 'FAIL ') + c.name
      + (c.details == null ? '' : ' -- ' + JSON.stringify(c.details)));
  }
  const failed = out.checks.filter((c) => !c.passed);
  console.log(`\nwrote ${Object.keys(out.shots).length} shots to tests/shots/`);
  console.log(failed.length ? `OSSUARY PROBE FAIL: ${failed.length}` : 'OSSUARY PROBE PASS');
  if (errors.length) console.log('BROWSER ERRORS: ' + errors.join(' | '));
  process.exitCode = failed.length || errors.length ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
