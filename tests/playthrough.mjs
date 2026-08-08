// playthrough.mjs — plays FETCH start to finish through the real input path:
// aims, charges, throws, walks, fights. No teleports except the initial spawn.
// This is the completability gate. node tests/playthrough.mjs
import { ensureServer, launchBrowser, openPage, shotPath, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let failed = false;

try {
  const { page, errors } = await openPage(browser, `http://localhost:${server.port}/?test=1&mute=1`);
  await page.waitForFunction('window.__FETCH && window.__FETCH.ready === true', null, { timeout: 60000 });
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.startsWith('[beat]')) console.log('  ' + t.slice(7));
  });

  const result = await page.evaluate(async () => {
    const g = window.__game, F = window.__FETCH;
    const log = [];
    const shots = {};
    const beat = (name, ok, extra) => {
      log.push({ name, ok: !!ok, extra: extra ?? null });
      console.log('[beat] ' + (ok ? 'PASS ' : 'FAIL ') + name);
    };
    const snap = (name) => { g.render(); shots[name] = g.renderer.domElement.toDataURL('image/jpeg', 0.75); };
    // sim-only stepping: rendering every walk step is what killed the last run
    const _stepWith = F.stepWith;
    F.stepWith = (s, c) => _stepWith(s, c, false);

    const aimAt = (x, y, z) => {
      const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
      const dx = x - ex, dy = y - ey, dz = z - ez;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    const throwAt = (x, y, z, holdExtra = 0.5) => {
      // press throws; hold long enough to cross the distance; release recalls
      aimAt(x, y, z);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true });
      const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
      F.stepWith(Math.min(2.6, d / 20 + holdExtra), { throwHeld: true });
      F.stepWith(1 / 120, { throwReleased: true });
    };
    const waitHeld = (maxS = 4.5) => {
      let t = 0;
      while (g.skull.mode !== 'held' && t < maxS) { F.stepWith(0.1); t += 0.1; }
      return g.skull.mode === 'held';
    };
    const walkTo = (x, z, maxS = 30, run = false) => {
      let t = 0;
      while (t < maxS) {
        const dx = x - g.player.pos.x, dz = z - g.player.pos.z;
        if (Math.hypot(dx, dz) < 0.7) return true;
        if (g.dead) return false;
        g.player.yaw = Math.atan2(-dx, -dz);
        F.stepWith(0.1, { moveZ: 1, run });
        t += 0.1;
      }
      return Math.hypot(x - g.player.pos.x, z - g.player.pos.z) < 1.5;
    };
    const useAt = (x, y, z) => { aimAt(x, y, z); F.stepWith(1 / 120, { interactPressed: true }); };
    const fightNearbyWalkers = (range = 12) => {
      for (let i = 0; i < 10; i++) {
        if (g.dead) return;
        const e = g.enemies.list.find((en) => en.kind === 'walker' &&
          Math.hypot(en.pos.x - g.player.pos.x, en.pos.z - g.player.pos.z) < range);
        if (!e) return;
        throwAt(e.pos.x, e.pos.y + 1.2, e.pos.z, 0.3);
        F.stepWith(0.45);
        waitHeld();
      }
    };

    F.start();
    F.stepWith(0.5);

    // ---- ACT 0: bedroom ------------------------------------------------
    snap('00-wake');
    walkTo(7.2, 4.6, 10);                          // step to the open window first
    throwAt(7.2, 5.7, 8.2, 0.75);                 // the key in the tree
    let ok = false;
    for (let t = 0; t < 4 && !ok; t += 0.1) { F.stepWith(0.1); ok = !!(g.skull.carry && g.skull.carry.id === 'bedroomKey'); }
    waitHeld();
    beat('key-fetched-from-tree', ok && g.skull.mode === 'held', g.skull.getState());

    walkTo(6.5, 1.0, 10);
    throwAt(4.3, 4.7, 0.8, 0.4);                   // the lock takes the key
    for (let t = 0; t < 4 && !g.flags.has('bedroomOpen'); t += 0.1) F.stepWith(0.1);
    waitHeld();
    F.stepWith(1.2);                               // door swings
    beat('bedroom-door-unlocked-by-throw', g.flags.has('bedroomOpen'));

    // ---- ACT 1: landing + nursery -------------------------------------
    walkTo(4.8, 1, 10); walkTo(3, 1, 8); walkTo(-1, 2.5, 10);
    beat('reached-landing', g.act === 'house', g.act);
    walkTo(-3.2, 1, 10); walkTo(-4.8, 1, 8);       // through the ajar nursery door
    walkTo(-8, 3, 10);
    throwAt(-11.55, 5.7, 4.6, 0.5);                // stair key on the wall hook
    ok = false;
    for (let t = 0; t < 4 && !ok; t += 0.1) { F.stepWith(0.1); ok = !!(g.skull.carry && g.skull.carry.id === 'stairKey'); }
    waitHeld();
    beat('stair-key-fetched', ok);

    walkTo(-4.8, 1, 10); walkTo(-3.2, 1, 8); walkTo(1, 2.5, 10);
    throwAt(1, 4.7, 0.2, 0.4);                     // the stair door lock
    for (let t = 0; t < 4 && !g.flags.has('stairsOpen'); t += 0.1) F.stepWith(0.1);
    waitHeld();
    F.stepWith(1.2);
    beat('stair-door-unlocked', g.flags.has('stairsOpen'));

    // ---- down the stairs, break the cellar boards ----------------------
    walkTo(1, 0.9, 6); walkTo(1, -0.9, 6);         // through the stair door
    walkTo(1, -5, 10);
    // the door over the void: no hand reaches it — knock it open with a
    // throw, then steal the flame waiting in its light
    walkTo(1, -6.8, 10);
    throwAt(4, 4.75, -7, 0.35);
    for (let t = 0; t < 3 && !g.flags.has('voidDoorOpen'); t += 0.1) F.stepWith(0.1);
    waitHeld();
    F.stepWith(1.0);                               // the door swings wide
    beat('void-door-knocked-open', g.flags.has('voidDoorOpen'));
    throwAt(5.3, 4.95, -7, 0.6);
    for (let t = 0; t < 4 && !g.flags.has('ateFlame'); t += 0.1) F.stepWith(0.1);
    waitHeld();
    beat('the-skull-ate-a-flame', g.flags.has('ateFlame'), g.skull.getState());
    walkTo(1, -9.3, 12);                           // down the flight
    walkTo(1, -10.8, 6); walkTo(2.5, -11.5, 8);    // entry
    walkTo(3.4, -11, 6); walkTo(4.8, -11, 6);      // dining door
    walkTo(7, -10, 8); walkTo(7, -6.7, 8); walkTo(7, -5.2, 6);   // kitchen door
    walkTo(9, -2, 8); walkTo(9, 0.5, 8);           // kitchen
    beat('reached-kitchen', Math.abs(g.player.pos.x - 9.5) < 2 && g.player.pos.y < 0.5, [g.player.pos.x, g.player.pos.y, g.player.pos.z]);
    snap('01-kitchen');

    const boards = g.boards.slice();
    for (const b of boards) {
      if (b.userData.off) continue;
      const p = b.position;
      throwAt(p.x, p.y, p.z, 0.35);
      for (let t = 0; t < 3 && !b.userData.off; t += 0.1) F.stepWith(0.1);
      waitHeld();
      // the Resident heard that — stun it if it's close
      const res = g.director.resident;
      if (res && Math.hypot(res.pos.x - g.player.pos.x, res.pos.z - g.player.pos.z) < 7 && res.state !== 'stunned') {
        throwAt(res.pos.x, res.pos.y + 1.4, res.pos.z, 0.3);
        F.stepWith(0.4);
        waitHeld();
      }
      if (g.dead) break;
    }
    beat('boards-broken', g.flags.has('cellarOpen') && !g.dead, { dead: g.dead, resident: !!g.director.resident });
    const resident = g.director.resident;
    const residentRegistered = !!resident && resident.kind === 'resident'
      && g.enemies.list.includes(resident);
    beat('resident-came', residentRegistered, {
      kind: resident && resident.kind,
      state: resident && resident.state,
      registered: !!resident && g.enemies.list.includes(resident),
      pressure: g.director.residentPressure,
    });

    // open the cellar door, descend
    walkTo(9, 0.8, 8);
    useAt(9, 1.1, 2);
    F.stepWith(1.4);
    walkTo(9.6, 2.8, 8); walkTo(10, 5.1, 10);        // down the cellar stairs
    F.stepWith(2);                                   // door-slam beat
    beat('in-the-basement', g.act === 'basement' && !g.director.resident, { act: g.act });
    snap('02-basement');

    // ---- ACT 2: basement -----------------------------------------------
    walkTo(5, 4, 10); walkTo(-0.6, 3.6, 12);         // west along the webs
    walkTo(-1, 2.8, 6); walkTo(-1, 1.2, 6);          // storeroom door
    walkTo(-1.5, -1.5, 10);                          // storeroom
    F.stepWith(1);
    fightNearbyWalkers(7);                           // one of the sheets is real
    walkTo(3.2, -3, 10);                             // the boiler door is shut
    useAt(4, -1.9, -3);
    F.stepWith(1.4);
    walkTo(5, -3, 6); walkTo(9.8, -1.7, 10);         // boiler room; the one warm thing in it
    useAt(10.71, -2.1, -1.52);                       // open the incinerator's mouth
    F.stepWith(0.7);
    throwAt(11.0, -2.1, -1.5, 0.35);                 // try to burn it. try.
    for (let t = 0; t < 5 && !g.flags.has('fireRefused'); t += 0.1) F.stepWith(0.1);
    waitHeld(5);
    beat('fire-refused-the-skull', g.flags.has('fireRefused') && g.skull.mode === 'held', g.skull.getState());
    throwAt(10.5, -2.65, -1.5, 0.35);                // the key was in the ash all along
    ok = false;
    for (let t = 0; t < 4 && !ok; t += 0.1) { F.stepWith(0.1); ok = !!(g.skull.carry && g.skull.carry.id === 'hatchKey'); }
    waitHeld();
    beat('hatch-key-fetched', ok && !g.dead, { dead: g.dead, enemies: g.enemies.list.length });

    walkTo(5, -3, 8); walkTo(-3.4, -3, 12);          // back through the storeroom
    fightNearbyWalkers();                            // the third shape was real
    walkTo(-4.8, -3, 6); walkTo(-8, -3, 8);          // crawl wing
    fightNearbyWalkers();
    walkTo(-8.6, 0.5, 8); walkTo(-9, 1.2, 6); walkTo(-9, 2.8, 6);   // hatchbay door
    walkTo(-9.4, 4, 6);
    fightNearbyWalkers(8);
    const prePadlock = g.skull.getState();
    for (let tries = 0; tries < 3 && !g.flags.has('hatchUnlocked'); tries++) {
      throwAt(-10, -1.25, 3.6, 0.15);                // the padlock
      for (let t = 0; t < 3 && !g.flags.has('hatchUnlocked'); t += 0.1) F.stepWith(0.1);
      waitHeld();
      fightNearbyWalkers(8);
    }
    beat('hatch-unlocked', g.flags.has('hatchUnlocked'),
      { dead: g.dead, enemies: g.enemies.list.length, prePadlock, playerPos: [g.player.pos.x, g.player.pos.z].map((v) => +v.toFixed(1)) });
    useAt(-10, -0.9, 4.4);                           // open the hatch, climb out
    F.stepWith(2.5);
    beat('out-in-the-graveyard', g.act === 'graveyard', g.act);
    snap('03-graveyard');

    // ---- ACT 3: graveyard ----------------------------------------------
    walkTo(-4, 14, 20); walkTo(2, 26, 25); walkTo(2, 41, 25);
    walkTo(2, 45, 10);
    F.stepWith(0.5);
    beat('entered-the-forest', g.act === 'forest', g.act);   // the sealed-path beat proves 'forestEntered' later

    // ---- ACT 4: the forest ---------------------------------------------
    const f = g.forest;
    const walkPath = (toS, maxS = 90, run = false) => {
      let t = 0;
      while (t < maxS) {
        const pr = f.project(g.player.pos.x, g.player.pos.z);
        if (!pr) break;
        if (pr.s >= toS) return true;
        if (g.dead) return false;
        const tgt = f.posAt(Math.min(f.length - 1, pr.s + 6));
        g.player.yaw = Math.atan2(-(tgt.x - g.player.pos.x), -(tgt.z - g.player.pos.z));
        F.stepWith(0.1, { moveZ: 1, run });
        t += 0.1;
        // anything chasing? put it down. two hits.
        const e = g.enemies.list.find((en) => en.kind === 'walker' && en.state !== 'dormant' && en.state !== 'stunned' && en.state !== 'standing' &&
          Math.hypot(en.pos.x - g.player.pos.x, en.pos.z - g.player.pos.z) < (run ? 4 : 9));
        if (e) {
          // the intended play: stun it quiet and RUN. popping is loud and loud invites company.
          throwAt(e.pos.x, e.pos.y + 1.2, e.pos.z, 0.3);
          F.stepWith(0.3);
          waitHeld(3);
        }
      }
      return false;
    };

    walkPath(f.fallenS() - 4, 60);
    const logT = g.world.fetchTargets.find((t2) => t2.id === 'fallenTree');
    for (let i = 0; i < 7 && !g.flags.has('treeCleared'); i++) {
      const lp = logT.object.position;
      throwAt(lp.x, lp.y + 0.3, lp.z, 0.4);
      F.stepWith(0.6);
      waitHeld();
      fightNearbyWalkers(8);
    }
    beat('fallen-tree-cleared', g.flags.has('treeCleared'));
    beat('path-sealed-behind', f.sealS > 0, +f.sealS.toFixed(1));

    walkPath(f.ravineS() - 5, 60);
    const rope = g.forest.ropeAnchor;
    throwAt(rope.x, rope.y, rope.z, 0.8);
    let flew = false;
    for (let t = 0; t < 7; t += 0.1) {
      F.stepWith(0.1);
      const pr = f.project(g.player.pos.x, g.player.pos.z);
      if (pr && pr.s >= f.ravineS() + 1) { flew = true; break; }
    }
    waitHeld(6);
    beat('rope-launch-crossed-ravine', flew && g.flags.has('ropeLatched') && !g.dead, { dead: g.dead });
    // snap removed: sync canvas readback wedges headless GPU after long render-free stretches

    // the arena
    walkPath(f.arenaS() - 2, 60);   // walk INTO the ambush
    F.stepWith(1);
    let guard = 0;
    while (!g.flags.has('arenaCleared') && !g.dead && guard < 300) {
      guard++;
      const es = g.enemies.list.filter((en) => en.kind === 'walker');
      if (!es.length) { F.stepWith(0.4); continue; }
      const d = (en) => Math.hypot(en.pos.x - g.player.pos.x, en.pos.z - g.player.pos.z);
      // crowd control first: stun anything alive and closing; execute the downed in the gaps
      const threats = es.filter((en) => en.state !== 'stunned' && d(en) < 8).sort((a, b) => d(a) - d(b));
      const downed = es.filter((en) => en.state === 'stunned' && (en.iframes || 0) <= 0).sort((a, b) => d(a) - d(b));
      const target = threats[0] || downed[0];
      if (!target) { F.stepWith(0.3); continue; }
      throwAt(target.pos.x, target.pos.y + 1.2, target.pos.z, 0.2);
      F.stepWith(0.3);
      waitHeld(2.5);
    }
    beat('arena-survived', g.flags.has('arenaCleared') && !g.dead, { dead: g.dead, waves: g.director.arena && g.director.arena.wave, guard });

    // sprint the open stretch, then go quiet past the Kneeler. never re-throw at the downed.
    walkPath(Math.floor(f.length * 0.82), 60, true);
    walkPath(f.length - 2, 90, false);
    walkTo(g.clearingCenter.x, g.clearingCenter.z - 10, 40);
    { const pr2 = f.project(g.player.pos.x, g.player.pos.z); beat('reached-the-clearing', g.act === 'clearing', { act: g.act, pos: [+g.player.pos.x.toFixed(1), +g.player.pos.z.toFixed(1)], s: pr2 && pr2.s, len: f.length, dead: g.dead, enemies: g.enemies.list.map(e=>e.kind+':'+e.state+'@'+Math.round(e.pos.x)+','+Math.round(e.pos.z)), spawnLog: (g.spawnLog||[]).slice(-14) }); }
    // snap removed: sync canvas readback wedges headless GPU after long render-free stretches

    // ---- ACT 5: the waterfall ------------------------------------------
    for (let t = 0; t < 5 && g.skull.mode !== 'held'; t += 0.2) F.stepWith(0.2);   // hands full? wait
    walkTo(g.clearingCenter.x, g.clearingCenter.z + 6, 30);
    throwAt(g.clearingCenter.x, 8, g.clearingCenter.z + 20.5, 0.9);
    for (let t = 0; t < 5 && !g.flags.has('waterfallTaken'); t += 0.1) F.stepWith(0.1);
    beat('skull-given-to-the-waterfall', g.flags.has('waterfallTaken') && g.skull.mode === 'gone', g.skull.mode);
    F.stepWith(8);                                   // the bridge rises
    beat('bridge-rose', g.bridgeStones.every((s) => s.position.y > 0.05));

    walkTo(g.clearingCenter.x, g.clearingCenter.z + 14, 20);
    walkTo(g.clearingCenter.x, g.clearingCenter.z + 21, 15);   // through the fall
    walkTo(g.clearingCenter.x + 2, g.clearingCenter.z + 30, 20);
    beat('inside-the-cave', g.act === 'cave', g.act);
    // snap removed: sync canvas readback wedges headless GPU after long render-free stretches

    walkTo(g.clearingCenter.x + 7, g.clearingCenter.z + 36, 20);
    walkTo(g.clearingCenter.x + 14, g.clearingCenter.z + 40, 20);
    walkTo(g.caveEnd.x - 1.2, g.caveEnd.z, 20);   // stand OFF-center: straight up is beyond the pitch clamp
    useAt(g.caveEnd.x, 3.7, g.caveEnd.z);            // the hatch above
    F.stepWith(4.5);
    beat('in-the-mirror-room', g.act === 'mirror' && g.finale.active, g.act);
    // snap removed: sync canvas readback wedges headless GPU after long render-free stretches

    // ---- ACT 6: the walls ----------------------------------------------
    let closed = false;
    for (let t = 0; t < 90; t += 1) {
      F.stepWith(1, { moveX: (t % 4 < 2 ? 0.4 : -0.4), moveZ: 0.2 });   // squirm like a person
      if (g.finale.phase === 'end') { closed = true; break; }
    }
    F.stepWith(7);                                    // the slow fade + showEnd
    // snap removed: sync canvas readback wedges headless GPU after long render-free stretches
    beat('the-walls-did-not-stop', closed && g.finale.half <= 0.38, +g.finale.half.toFixed(2));
    beat('ended', g.flags.has('ended'));

    return { log, shots, dead: g.dead };
  });

  console.log('');
  for (const b of result.log) {
    console.log(` ${b.ok ? 'PASS' : 'FAIL'} ${b.name}${b.extra != null ? '  -- ' + JSON.stringify(b.extra) : ''}`);
    if (!b.ok) failed = true;
  }
  for (const [name, dataUrl] of Object.entries(result.shots)) {
    writeFileSync(shotPath('play-' + name + '.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  if (errors.length) { failed = true; console.log('PAGE ERRORS:', errors); }
  writeFileSync(resultsPath('playthrough.json'), JSON.stringify(result.log, null, 2));
  console.log(failed ? '\nPLAYTHROUGH FAIL' : '\nPLAYTHROUGH COMPLETE — the game can be finished.');
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);
