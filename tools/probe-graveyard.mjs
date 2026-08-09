// Deterministic graveyard arena probe. Boots directly into the act, fights via
// the real throw/hold/release input grammar, and reports any body that fails to
// join or finish the encounter.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 60000, polling: 100 });
  const result = await page.evaluate(() => {
    const g = window.__game, F = window.__FETCH;
    F.start();
    F.teleport('graveyard');
    const originalDeath = g.director.death.bind(g.director);
    g.director.death = (enemy) => {
      g.__graveProbeKiller = enemy ? {
        state: enemy.state,
        x: enemy.pos.x,
        z: enemy.pos.z,
        graveArena: !!enemy.graveArena,
        gravePressure: !!enemy.gravePressure,
      } : null;
      return originalDeath(enemy);
    };
    g.player.pos.set(2, g.world.groundHeightAt(2, 21, 2), 21);
    g.player.vel.set(0, 0, 0);
    g.player.fallV = 0;
    g.player.grounded = true;
    g.player._sync(0);
    F.stepWith(0.1);

    const aimAt = (x, y, z) => {
      const dx = x - g.player.pos.x;
      const dy = y - (g.player.pos.y + 1.62);
      const dz = z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
      g.player._sync(0);
    };
    let strafeSign = 1;
    const throwAtPoint = (x, y, z) => {
      aimAt(x, y, z);
      F.stepWith(1 / 120, { throwPressed: true, throwHeld: true }, false);
      const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
      F.stepWith(Math.min(2.6, d / 20 + 0.22),
        { throwHeld: true, moveX: strafeSign, moveZ: 0.05, run: true }, false);
      F.stepWith(1 / 120, { throwReleased: true, moveX: strafeSign, moveZ: 0.05, run: true }, false);
      let t = 0;
      while (g.skull.mode !== 'held' && t < 3.5) {
        const nearest = g.enemies.list
          .filter((enemy) => enemy.graveArena && enemy.state !== 'dying')
          .sort((a, b) => a.pos.distanceToSquared(g.player.pos) - b.pos.distanceToSquared(g.player.pos))[0];
        if (nearest) {
          let awayX = g.player.pos.x - nearest.pos.x;
          let awayZ = g.player.pos.z - nearest.pos.z;
          if (g.player.pos.x < -16) awayX += (-16 - g.player.pos.x) * 4;
          if (g.player.pos.x > 20) awayX -= (g.player.pos.x - 20) * 4;
          if (g.player.pos.z < 10) awayZ += (10 - g.player.pos.z) * 4;
          if (g.player.pos.z > 39) awayZ -= (g.player.pos.z - 39) * 4;
          g.player.yaw = Math.atan2(-awayX, -awayZ);
          g.player._sync(0);
        }
        F.stepWith(0.1, { moveZ: 1, run: true }, false);
        t += 0.1;
      }
      strafeSign *= -1;
    };
    const throwAt = (e) => throwAtPoint(e.pos.x, e.pos.y + 1.2, e.pos.z);

    const kite = [
      [2, 18], [9, 16], [18, 18], [20, 27], [10, 29],
      [3, 34], [-6, 36], [-11, 29], [-10, 22], [-4, 17],
    ];
    let kiteIndex = 0;
    const runToward = (x, z, seconds = 0.8) => {
      const dx = x - g.player.pos.x, dz = z - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      F.stepWith(seconds, { moveZ: 1, run: true }, false);
    };

    let guard = 0;
    const snapshots = [];
    while (!g.flags.has('graveyardCleared') && !g.dead && guard < 620) {
      guard++;
      const es = g.enemies.list.filter((e) => e.graveArena && e.kind === 'walker'
        && e.state !== 'dying');
      const distance = (e) => Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z);
      const downed = es.filter((e) => e.state === 'stunned' && (e.iframes || 0) <= 0)
        .sort((a, b) => distance(a) - distance(b));
      const active = es.filter((e) => e.state !== 'stunned')
        .sort((a, b) => distance(a) - distance(b));
      const readyGraves = (g.resonantGraves || []).filter((grave) => grave.cooldown <= 0.01)
        .map((grave) => {
          const p = grave.group.position;
          const caught = active.filter((e) => Math.hypot(e.pos.x - p.x, e.pos.z - p.z) <= 8.2).length;
          return { grave, p, caught };
        })
        .sort((a, b) => b.caught - a.caught);
      if (!downed.length && readyGraves[0]?.caught >= 2) {
        const pulse = readyGraves[0];
        const p = pulse.grave.shaft.getWorldPosition(g.player.pos.clone());
        throwAtPoint(p.x, p.y, p.z);
        continue;
      }
      const target = active[0] && distance(active[0]) < 5.5
        ? active[0]
        : downed[0] || active[0];
      if (target) throwAt(target);
      else F.stepWith(0.2, {}, false);
      if (guard % 50 === 0) {
        snapshots.push({
          guard,
          wave: g.director.graveArena?.wave ?? null,
          pending: g.director.graveArena?.pending ?? null,
          enemies: es.map((e) => ({
            state: e.state,
            x: +e.pos.x.toFixed(2),
            z: +e.pos.z.toFixed(2),
            d: +distance(e).toFixed(2),
            via: e._via ? { x: +e._via.x.toFixed(2), z: +e._via.z.toFixed(2) } : null,
          })),
        });
      }
    }
    const survivors = g.enemies.list.filter((e) => e.graveArena || e.gravePressure).map((e) => ({
      state: e.state,
      x: +e.pos.x.toFixed(2),
      z: +e.pos.z.toFixed(2),
      d: +Math.hypot(e.pos.x - g.player.pos.x, e.pos.z - g.player.pos.z).toFixed(2),
      stall: +(e._stallT || 0).toFixed(2),
      via: e._via ? { x: +e._via.x.toFixed(2), z: +e._via.z.toFixed(2) } : null,
    }));
    return {
      cleared: g.flags.has('graveyardCleared'),
      dead: g.dead,
      guard,
      player: [g.player.pos.x, g.player.pos.z],
      arena: g.director.graveArena,
      killer: g.__graveProbeKiller || null,
      survivors,
      snapshots,
    };
  });
  console.log(JSON.stringify({ errors, ...result }, null, 2));
  process.exit(errors.length || !result.cleared || result.dead ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
