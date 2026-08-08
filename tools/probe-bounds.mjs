// probe-bounds.mjs — can the player leave the world? Walks out of every act in
// 12 compass directions for a long time and reports where they ended up, how
// far they got, and whether they fell.
//   node tools/probe-bounds.mjs [seconds]
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const SECS = +(process.argv[2] || 26);
const ACTS = ['graveyard', 'forest', 'clearing', 'cave', 'mirror'];

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH && window.__FETCH.ready === true, null, { timeout: 60000, polling: 200 });
  const rows = await page.evaluate(async ([acts, secs]) => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    const out = [];
    for (const act of acts) {
      for (let d = 0; d < 12; d++) {
        F.teleport('bedroom');   // full reset between runs, or act 2 onward inherits act 1's state
        F.stepWith(0.3);
        F.teleport(act);
        F.stepWith(0.4);
        const start = g.player.pos.clone();
        g.player.yaw = (d / 12) * Math.PI * 2;
        let minY = g.player.pos.y, escaped = false, maxDist = 0, deaths = 0, wasDead = false;
        for (let n = 0; n < secs * 4; n++) {
          F.stepWith(0.25, { moveZ: 1, run: true });
          minY = Math.min(minY, g.player.pos.y);
          maxDist = Math.max(maxDist, start.distanceTo(g.player.pos));
          if (g.player.dead && !wasDead) deaths++;
          wasDead = !!g.player.dead;
          if (g.player.pos.y < -14) { escaped = true; break; }
        }
        const p = g.player.pos;
        out.push({
          act, dir: d, x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1),
          dist: +start.distanceTo(p).toFixed(1), maxDist: +maxDist.toFixed(1), deaths, minY: +minY.toFixed(2),
          escaped, zone: g.world.zoneAt ? g.world.zoneAt(p.x, p.z) : null,
        });
      }
    }
    return out;
  }, [ACTS, SECS]);

  const bad = rows.filter((r) => r.escaped || r.minY < -9);
  for (const act of ACTS) {
    const rs = rows.filter((r) => r.act === act);
    const far = rs.reduce((a, b) => (b.dist > a.dist ? b : a));
    console.log(`${act.padEnd(10)} max walk ${String(far.maxDist).padStart(6)}m  dir${far.dir}  -> (${far.x}, ${far.y}, ${far.z})  lowest y ${Math.min(...rs.map((r) => r.minY)).toFixed(2)}  deaths ${rs.reduce((n, r) => n + r.deaths, 0)}`);
  }
  if (bad.length) {
    console.log('\nOFF THE MAP:');
    for (const r of bad) console.log(' ', JSON.stringify(r));
  } else {
    console.log('\nno escapes: nobody left the world in any direction');
  }
  if (errors.length) console.log('ERRORS:', errors.join(' | '));
  process.exit(bad.length ? 1 : 0);
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
