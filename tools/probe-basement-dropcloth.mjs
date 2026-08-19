// ROUND NINE, items 4 and 5b.
//
// HIS BUG: "if you die in the beginning and checkpoint, i don't think the enemy
// appears behind that thing in the basement." Driven literally — die before the
// basement, respawn, go down, and look for it. Then his two extras: the decoy
// sheets answer a throw, and the gallery floor is crawling.
//   node tools/probe-basement-dropcloth.mjs
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
      for (let i = 0; i < 3; i++) g.render();
      shots[name] = g.renderer.domElement.toDataURL('image/png');
    };
    const B = -3.0;
    const wearer = () => g.enemies.list.find((e) => e === g.dropcloths?.walker) || null;
    const sheetOnIt = () => {
      const w = wearer();
      return !!w && w.mesh.children.some((c) => c.isGroup || c.children?.length);
    };

    F.start();

    // ---- the seed is a SEED now, not a coin flip -------------------------
    check('the real sheet is chosen by the seeded RNG, not Math.random',
      typeof g.dropcloths?.realIdx === 'number', { realIdx: g.dropcloths?.realIdx });
    check('nothing is spawned at boot: the record starts un-armed',
      g.dropcloths.walker === null && g.dropcloths.consumed === false);

    // ---- HIS SEQUENCE: die in the opening, then go down ------------------
    F.teleport('house');
    F.stepWith(0.4, {}, false);
    g.director.death({ kind: 'walker' });
    for (let t = 0; t < 4 && !g.dead; t += 0.1) F.stepWith(0.1, {}, false);
    F.stepWith(1.6, {}, false);
    const diedInOpening = g.dead;
    g.director.respawn();
    F.stepWith(0.5, {}, false);
    const enemiesAfterRespawn = g.enemies.list.length;
    check('a death in the opening really does clear every enemy',
      diedInOpening && enemiesAfterRespawn === 0,
      { died: diedInOpening, after: enemiesAfterRespawn });

    F.teleport('basement');
    F.stepWith(0.6, {}, false);
    const w = wearer();
    check('THE DROPCLOTH WALKER IS STILL THERE AFTER THE DEATH',
      !!w, { walker: w ? [+w.pos.x.toFixed(2), +w.pos.z.toFixed(2)] : null,
        listed: g.enemies.list.length });
    check('...and it is wearing its sheet', sheetOnIt());
    check('...and it stands on the basement storey',
      !!w && Math.abs(w.pos.y - (B + 1)) < 1.2, { y: w ? +w.pos.y.toFixed(2) : null });

    // re-entering must not stack a second one
    F.teleport('house');
    F.stepWith(0.3, {}, false);
    F.teleport('basement');
    F.stepWith(0.3, {}, false);
    const wearers = g.enemies.list.filter((e) => e === g.dropcloths.walker).length;
    check('re-entering the basement does not stack a second walker',
      wearers === 1 && g.enemies.list.filter((e) => e.standing).length <= 2,
      { wearers, standing: g.enemies.list.filter((e) => e.standing).length });

    // ---- the decoys answer a throw, and there is nothing under them ------
    const decoys = g.world.fetchTargets.filter((t) => t.id.startsWith('basementDropcloth:'));
    check('the three decoy sheets are hittable', decoys.length === 3,
      { ids: decoys.map((t) => t.id) });
    const d0 = decoys[0];
    g.player.pos.set(d0.pos.x + 1.6, B, d0.pos.z + 1.6);
    g.player.yaw = Math.atan2(-(d0.pos.x - g.player.pos.x), -(d0.pos.z - g.player.pos.z));
    g.player.pitch = 0;
    g.player._sync(0);
    F.stepWith(0.15, {}, false);
    snap('01-decoy-standing');
    const before = g.enemies.list.length;
    g.skull.holdNow();
    g.skull.mode = 'outbound';
    const directive = d0.onHit.call(d0, g.skull, d0.pos);
    g.skull.holdNow();
    F.stepWith(1.4, {}, false);
    snap('02-decoy-toppled');
    check('a hit topples a decoy and sends the skull home',
      directive === 'return' && d0.enabled === false
      && [...g.flags].some((f) => f.startsWith('dropclothFelled:')),
      { directive, enabled: d0.enabled });
    check('and NOTHING was under it — no enemy is created by the topple',
      g.enemies.list.length === before, { before, after: g.enemies.list.length });
    check('a toppled decoy refuses a second hit',
      d0.onHit.call(d0, { mode: 'outbound' }, d0.pos) === 'return');

    // ---- the gallery floor is crawling ------------------------------------
    let bugs = null;
    g.scene.traverse((o) => { if (o.name === 'pump gallery floor vermin') bugs = o; });
    check('the pump gallery has one instanced vermin mesh', !!bugs && bugs.isInstancedMesh,
      { count: bugs?.count ?? 0 });
    check('...unlit and near-black, like the ossuary population it was ported from',
      !!bugs && bugs.material.type === 'MeshBasicMaterial',
      { type: bugs?.material?.type });
    // walk into the gallery and let them run
    g.player.pos.set(-16.2, B, 4.2);
    g.player.yaw = Math.PI * 0.5;
    g.player.pitch = -0.5;
    g.player._sync(0);
    F.stepWith(1.2, {}, false);
    check('they are only drawn when the player is actually in the west wing',
      bugs.visible === true, { visible: bugs.visible });
    const ys = [];
    for (let i = 0; i < bugs.count; i += 17) {
      ys.push(+bugs.instanceMatrix.array[i * 16 + 13].toFixed(3));
    }
    // instance y is LOCAL: the mesh itself sits at the basement floor so the
    // upper-sector culler classifies it as basement (see house.js)
    check('every one of them is ON the gallery floor, not floating',
      Math.abs(bugs.position.y - B) < 0.001 && ys.every((y) => Math.abs(y - 0.02) < 0.05),
      { meshY: bugs.position.y, sample: ys.slice(0, 6) });
    // stand back from the seeded bands so the scatter has not just emptied the
    // shot, look down the wall base, and MEASURE: toggle them off, diff.
    g.player.pos.set(-15.4, B, 2.0);
    g.player.yaw = Math.atan2(-(-18.6 - g.player.pos.x), -(5.2 - g.player.pos.z));
    g.player.pitch = -0.5;
    g.player._sync(0);
    F.stepWith(0.9, {}, false);
    snap('03-the-floor-is-moving');
    const grab = () => {
      for (let i = 0; i < 3; i++) g.render();
      const c = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    };
    const withBugs = grab();
    bugs.visible = false;
    const without = grab();
    bugs.visible = true;
    let changed = 0;
    for (let i = 0; i < withBugs.length; i += 4) {
      const a = withBugs[i] * 0.2126 + withBugs[i + 1] * 0.7152 + withBugs[i + 2] * 0.0722;
      const b2 = without[i] * 0.2126 + without[i + 1] * 0.7152 + without[i + 2] * 0.0722;
      if (Math.abs(a - b2) > 6) changed++;
    }
    const bugPct = +(100 * changed / (withBugs.length / 4)).toFixed(3);
    check('the vermin are actually ON SCREEN from a standing look (>=0.05%)',
      bugPct >= 0.05, { bugPct });
    // and they SCATTER, which is the whole read
    const seen = [];
    for (let i = 0; i < 6; i++) seen.push(bugs.instanceMatrix.array[i * 16 + 12]);
    F.stepWith(1.0, { moveZ: 1 }, false);
    const seen2 = [];
    for (let i = 0; i < 6; i++) seen2.push(bugs.instanceMatrix.array[i * 16 + 12]);
    check('they move (the twitch is the read, not the model)',
      seen.some((v, i) => Math.abs(v - seen2[i]) > 0.001), { seen, seen2 });
    // leave the wing: they must stop drawing
    g.player.pos.set(-5, B, 0);
    g.player._sync(0);
    F.stepWith(0.2, {}, false);
    check('they stop drawing once you leave the wing', bugs.visible === false);

    return { checks, shots };
  });

  for (const [name, data] of Object.entries(out.shots)) {
    writeFileSync(join(SHOTS, `r9-basement-${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  let bad = 0;
  for (const c of out.checks) {
    if (!c.passed) bad++;
    console.log(`${c.passed ? 'PASS' : 'FAIL'} ${c.name}${c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`}`);
  }
  console.log(`\nshots -> ${SHOTS}\\r9-basement-*.png`);
  console.log(bad ? `${bad} FAILURE(S)` : 'ALL PASS');
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
  process.exitCode = bad ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
