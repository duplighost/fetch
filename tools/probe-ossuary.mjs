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

    // ---- FIRST PRESS TAKES THE STONE OFF, SECOND TAKES YOU DOWN -----------
    // Alex: "you shouldn't just walk into it and be teleported. a hatch should
    // open with e." Standing on a shut throat must do nothing.
    walkTo(MX, MZ + 0.5, 14);
    F.stepWith(0.3, {}, false);
    check('a shut throat does not swallow you',
      st.inOssuary === false && st.entryLid.open === false,
      { t: +st.entryLid.t.toFixed(2) });
    walkTo(MX, MZ - 1.35, 14);
    g.ossuary.descend();
    F.stepWith(0.1, {}, false);
    // ROUND NINE, his note: "you hit e, and it opens slowly, then you can walk
    // over it... the other one under the graveyard is perfect." The marrow is
    // instant both ways, so this is too. The stone still slides; it just
    // finishes behind you, and the press no longer waits on it.
    check('the press moves the stone AND takes you down in the same breath',
      st.entryLid.moving === true && st.inOssuary === true,
      { lidT: +st.entryLid.t.toFixed(3) });
    for (let i = 0; i < 80 && !st.entryLid.open; i++) F.stepWith(0.1, {}, false);
    check('the lid finishes opening on its own clock', st.entryLid.open === true,
      { t: +st.entryLid.t.toFixed(2) });
    snap('02-the-stone-off-the-throat');
    g.ossuary.descend();
    F.stepWith(0.25, {}, false);
    check('E on the open mouth takes you down',
      st.inOssuary === true && g.flags.has('ossuaryEntered') && g.act === 'graveyard',
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) });
    snap('03-arrived-under-the-yard');

    // ---- THE NEAR END IS A WALL WITH A HATCH IN IT ------------------------
    // It used to be neither: the corridor simply stopped, so looking back
    // showed the renderer's clear colour, and walking into that nothing
    // teleported you out in silence. Alex: "the wall at the beginning feels
    // weird. have a similar hatch to come out."
    const OX = st.origin.x, OZ = st.origin.z, FL = st.origin.floor;
    const capped = g.world.colliders.some((c) => c.ossuary
      && c.min.x <= OX - 2.9 && c.max.x >= OX + 2.9
      && c.min.z < OZ && c.max.z > OZ - 0.35);
    check('the near end is a real wall now', capped);
    g.player.pos.set(OX, FL, OZ + 1.0);
    g.player.yaw = 0;   // forward is -z: straight at the cap wall
    g.player._sync(0);
    for (let i = 0; i < 40 && st.inOssuary; i++) F.stepWith(0.08, { moveZ: 1 }, false);
    check('walking into a shut hatch does NOT teleport you out',
      st.inOssuary === true && st.exitLid.open === false,
      { z: +g.player.pos.z.toFixed(2) });
    snap('04-the-way-back-shut');
    st.climbBack();
    for (let i = 0; i < 80 && !st.exitLid.open; i++) F.stepWith(0.1, {}, false);
    check('E opens it', st.exitLid.open === true, { t: +st.exitLid.t.toFixed(2) });
    snap('05-the-way-back-open');
    st.climbBack();
    F.stepWith(0.3, {}, false);
    check('and E again lets you out, facing OUT of the doorway',
      st.inOssuary === false && g.act === 'graveyard' && Math.abs(g.player.yaw) < 0.01,
      { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) });

    // ---- THE STAIR TOP IS PLAIN CEILING NOW ------------------------------
    const deadVerbs = g.world.interactables
      .map((o) => o.userData.inter)
      .filter((i) => i && /^ossuaryClimbOut$/.test(i.id));
    const deadMeshes = [];
    g.scene.traverse((o) => {
      if (/ossuary hatch (lid|chains)/.test(o.name || '')) deadMeshes.push(o.name);
    });
    check('the unopenable hatch and its padlock are gone',
      deadVerbs.length === 0 && deadMeshes.length === 0,
      { verbs: deadVerbs.length, meshes: deadMeshes });

    // ---- ...AND THE KEY IS UP THERE, PAST THE WALL THE WEIGHT LOWERS -----
    st.solved = true;
    st.progress = 1;
    for (let i = 0; i < 40; i++) F.stepWith(0.1, {}, false);
    const key1 = g.gateKeys.list[0];
    check('the counterweight pays out gate key one, and nothing else',
      key1.revealed === true && !g.flags.has('graveyardCleared'),
      { at: key1.home.toArray().map((v) => +v.toFixed(2)) });
    check('and it hangs at the TOP of the stairs, beyond the wall it lowers',
      key1.home.z > st.exitCollider.max.z && key1.home.y > FL + 4.0,
      { keyZ: +key1.home.z.toFixed(2), wallZ: +st.exitCollider.max.z.toFixed(2),
        keyY: +key1.home.y.toFixed(2) });
    snap('06-the-key-at-the-stair-top');

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
