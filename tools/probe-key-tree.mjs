// KEY THREE. "what if instead of those balls coming down, something else came
// down that was obvious you could hit. like some kind of large branch hanging
// down. if you hit it with the skull, the key and the bones of a skeleton fall
// down. but not the skull of the skeleton, just bones." — Alex, 2026-08-16.
// Drives it the way a player does: walk under the limb, throw once, watch what
// lands, then fetch the key off the grass.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });
  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const log = [];
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);

    const climb = g.keyTreeClimb;
    const key3 = g.gateKeys.list[2];
    const snap = (at) => log.push({
      at,
      dropped: climb.dropped, hit: climb.hit,
      branchEnabled: climb.branchTarget.enabled,
      branchAt: climb.branchTarget.pos.toArray().map((v) => +v.toFixed(2)),
      branchR: climb.branchTarget.radius,
      keyVisible: key3.key.visible, keyFetchable: key3.target.enabled,
      keyAt: key3.home.toArray().map((v) => +v.toFixed(2)),
      boneAt: climb.bones.position.toArray().map((v) => +v.toFixed(2)),
      boneVisible: climb.bones.visible,
      shardsVisible: climb.shards.visible,
      carry: g.skull.carry?.id ?? null,
    });
    snap('before the funeral');

    g.director._completeGraveyard('loud');
    for (let i = 0; i < 90; i++) F.stepWith(0.1, {}, false);   // routes reveal over ~4 s + payout
    snap('branch down');

    // stand where a player would and throw ONCE at the hanging end
    const hang = climb.branchTarget.pos.clone();
    g.player.pos.set(7.6, 0, 18.4);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    F.stepWith(0.2, {}, false);
    const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
    g.player.yaw = Math.atan2(-(hang.x - ex), -(hang.z - ez));
    g.player.pitch = Math.atan2(hang.y - ey, Math.hypot(hang.x - ex, hang.z - ez));
    g.player._sync(0);
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    F.stepWith(0.55, { throwHeld: true }, false);
    F.stepWith(1 / 120, { throwReleased: true }, false);
    for (let i = 0; i < 40 && !climb.hit; i++) F.stepWith(0.05, {}, false);
    snap('one throw later');
    for (let i = 0; i < 60; i++) F.stepWith(0.1, {}, false);
    snap('everything settled');

    // and now fetch it off the grass
    const rest = climb.keyRest;
    g.player.pos.set(rest.x + 0.4, 0, rest.z + 3.0);
    g.player.vel.set(0, 0, 0);
    g.player._sync(0);
    for (let i = 0; i < 30 && g.skull.mode !== 'held'; i++) F.stepWith(0.1, {}, false);
    const e2 = g.player.pos.y + 1.62;
    g.player.yaw = Math.atan2(-(key3.home.x - g.player.pos.x), -(key3.home.z - g.player.pos.z));
    g.player.pitch = Math.atan2(key3.home.y - e2,
      Math.hypot(key3.home.x - g.player.pos.x, key3.home.z - g.player.pos.z));
    g.player._sync(0);
    const path = [];
    // WHICH target eats the throw? Wrap every one of them and name the culprit
    // instead of triangulating from positions.
    const fired = [];
    for (const t of g.world.fetchTargets) {
      if (t._wrapped) continue;
      t._wrapped = true;
      const real = t.onHit;
      t.onHit = function wrapped(...args) {
        const d = real.apply(this, args);
        fired.push({ id: t.id, directive: d ?? 'return', r: t.radius });
        return d;
      };
    }
    F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
    for (let i = 0; i < 24; i++) {
      F.stepWith(0.02, { throwHeld: true }, false);
      path.push([+g.skull.pos.x.toFixed(2), +g.skull.pos.y.toFixed(2),
        +g.skull.pos.z.toFixed(2), g.skull.mode]);
    }
    F.stepWith(1 / 120, { throwReleased: true }, false);
    for (let i = 0; i < 50 && g.skull.carry?.id !== 'gateKey3'; i++) F.stepWith(0.05, {}, false);
    snap('key fetched');
    log.push({ at: 'the second throw, frame by frame', from: [+g.player.pos.x.toFixed(2),
      +g.player.pos.z.toFixed(2)], want: key3.home.toArray().map((v) => +v.toFixed(2)),
    fired, gotFlag: g.flags.has('gotgateKey3'), path: path.slice(0, 8) });

    return { log, draws: g.lastRender ? g.lastRender.drawCalls : null, dead: g.dead };
  });
  console.log(JSON.stringify(out, null, 1));
  if (errors.length) console.log('BROWSER ERRORS:', errors);
  const fetched = out.log.find((l) => l.at === 'key fetched');
  console.log(fetched?.carry === 'gateKey3' ? '\nPASS: one hit, then the key off the grass'
    : '\nFAIL: the key never reached the jaw');
} finally {
  await browser.close();
  server.stop();
}
