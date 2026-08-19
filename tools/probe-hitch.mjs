// probe-hitch.mjs -- find the stalls Alex reports as "lag/freeze when entering
// areas", "loading new areas just about always freezes it", and "a lot of the
// things that you hit with the skull to activate freeze the game".
//
// The instrument: leave FETCH's real rAF loop running on the real GPU, and on
// every frame record (a) the wall-clock gap since the previous frame and
// (b) renderer.info.programs.length. Both are numbers the renderer reports
// about itself -- no pixel reads, nothing that can be black-by-construction.
//
// A long frame that coincides with programs.length increasing is a shader
// compile stall. A long frame with no program delta is something else (geometry
// upload, texture upload, or plain CPU work) and says so.
//
//   node tools/probe-hitch.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const ACTS = ['house', 'basement', 'graveyard', 'forest', 'clearing', 'cave', 'mirror'];
const SETTLE_MS = 2200;      // real frames per act after arrival
const LONG_FRAME_MS = 45;    // anything past this is a visible hitch at 60Hz

const server = await ensureServer();
const browser = await launchBrowser();
// No ?test=1: test mode skips the shader warmup and stops the self-stepping
// loop, so it would measure a different program than the one Alex plays.
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1`);

await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

// Frame recorder. Installed before the game starts so boot frames are covered.
await page.evaluate(() => {
  const g = window.__game;
  const rec = window.__hitch = { frames: [], marks: [] };
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    rec.frames.push({
      t: +(now).toFixed(1),
      dt: +(now - last).toFixed(2),
      programs: g.renderer.info.programs?.length ?? -1,
      calls: g.renderer.info.render.calls,
      geometries: g.renderer.info.memory.geometries,
      textures: g.renderer.info.memory.textures,
      act: g.act,
    });
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  rec.mark = (label) => rec.marks.push({ label, t: +performance.now().toFixed(1) });
});

await page.evaluate(() => { window.__hitch.mark('start'); window.__FETCH.start(); });
await page.waitForTimeout(3000);

// ROUND TEN: wait for the first-draw warm pass before touring the acts, and say
// so out loud. The pass streams at ~6 ms a frame from the moment the driver
// finishes linking (~10 s after boot on this machine), and nobody reaches the
// basement in the five seconds this tour used to take -- the bedroom opening
// alone is longer than that. Touring before it finishes measures a player who
// does not exist, and the number it produces (the old 9017 ms) is the cost this
// pass exists to move. The frame log below still covers the wait, so if the pass
// itself ever stalls a frame it shows up here as itself.
const warmStart = Date.now();
await page.waitForFunction(
  () => ['done', 'skipped', 'degraded'].includes(window.__FETCH.warm().draw?.status ?? 'skipped'),
  null, { timeout: 120000, polling: 250 },
).catch(() => console.log('WARNING: first-draw warm pass did not finish in 120s'));
const warmState = await page.evaluate(() => window.__FETCH.warm());
console.log(`first-draw warm: ${JSON.stringify(warmState.draw)}`);
console.log(`driver links:    ${JSON.stringify(warmState.links)}`);
console.log(`waited ${((Date.now() - warmStart) / 1000).toFixed(1)}s for it\n`);

for (const act of ACTS) {
  await page.evaluate((a) => { window.__hitch.mark('enter:' + a); window.__FETCH.teleport(a); }, act);
  await page.waitForTimeout(SETTLE_MS);
}

// Now the other half of his report: hitting things with the skull. Each target
// is fired IN ITS OWN ACT -- firing everything from wherever the act walk
// happened to end measures a situation no player is ever in, and inflates the
// cost of anything whose response is only visible somewhere else.
await page.evaluate(() => { window.__hitch.mark('targets:begin'); });
const targetLog = await page.evaluate(async (ACTS) => {
  const g = window.__game;
  const F = window.__FETCH;
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const worldPos = (t) => t.mesh?.getWorldPosition?.(new THREE.Vector3()) || t.pos || null;

  // Group targets by the act whose zone contains them, so each is hit at home.
  const byAct = new Map();
  for (const t of g.world.fetchTargets.slice()) {
    const p = worldPos(t);
    if (!p) continue;
    const act = g.world.zoneAt(p) || 'house';
    if (!byAct.has(act)) byAct.set(act, []);
    byAct.get(act).push(t);
  }

  for (const act of ACTS) {
    const targets = byAct.get(act);
    if (!targets?.length) continue;
    F.teleport(act);
    await wait(700);
    for (const t of targets) {
    const p = worldPos(t);
    if (!p) continue;
    t.enabled = true;
    const before = g.renderer.info.programs?.length ?? -1;
    const t0 = performance.now();
    window.__hitch.mark('target:' + (t.id || 'anon'));
    // Put the skull on the target directly; this fires the same handler the
    // real throw does without needing a 60-metre line of sight.
    F.setSkull(p.x, p.y, p.z, 0, 0, 0, 'outbound');
    await wait(420);
    out.push({
      id: t.id || 'anon',
      act: g.act,
      ms: +(performance.now() - t0).toFixed(1),
      programsBefore: before,
      programsAfter: g.renderer.info.programs?.length ?? -1,
    });
    F.setSkull(g.player.pos.x, g.player.pos.y + 1, g.player.pos.z, 0, 0, 0, 'held');
    await wait(120);
    }
  }
  return out;
}, ACTS);

const rec = await page.evaluate(() => window.__hitch);

await browser.close();
server.stop();

// ------------------------------------------------------------------- report
const frames = rec.frames;
const marks = rec.marks;
const labelFor = (t) => {
  let best = null;
  for (const m of marks) if (m.t <= t) best = m; else break;
  return best ? best.label : 'boot';
};

const long = [];
for (let i = 1; i < frames.length; i++) {
  const f = frames[i];
  if (f.dt < LONG_FRAME_MS) continue;
  long.push({
    ms: f.dt,
    act: f.act,
    since: labelFor(f.t),
    dPrograms: f.programs - frames[i - 1].programs,
    dGeometries: f.geometries - frames[i - 1].geometries,
    dTextures: f.textures - frames[i - 1].textures,
    programs: f.programs,
  });
}
long.sort((a, b) => b.ms - a.ms);

console.log(`frames recorded: ${frames.length}`);
console.log(`final program count: ${frames.at(-1)?.programs}`);
console.log(`long frames (>${LONG_FRAME_MS}ms): ${long.length}\n`);
console.log('worst 30:');
console.log('    ms  act        after-mark            +prog +geo +tex');
for (const l of long.slice(0, 30)) {
  console.log(
    `  ${String(l.ms).padStart(6)}  ${(l.act || '?').padEnd(10)} ${l.since.padEnd(20)} ` +
    `${String(l.dPrograms).padStart(5)} ${String(l.dGeometries).padStart(4)} ${String(l.dTextures).padStart(4)}`,
  );
}

const withPrograms = long.filter((l) => l.dPrograms > 0);
const withoutPrograms = long.filter((l) => l.dPrograms <= 0);
const sum = (a) => a.reduce((n, l) => n + l.ms, 0);
console.log(`\nstall time attributable to shader compiles: ${sum(withPrograms).toFixed(0)}ms across ${withPrograms.length} frames`);
console.log(`stall time with no new programs:            ${sum(withoutPrograms).toFixed(0)}ms across ${withoutPrograms.length} frames`);

console.log('\nfetch targets, slowest first:');
for (const t of targetLog.sort((a, b) => b.ms - a.ms).slice(0, 15)) {
  const dp = t.programsAfter - t.programsBefore;
  console.log(`  ${String(t.ms).padStart(7)}ms  ${t.id.padEnd(24)} ${t.act.padEnd(10)} +${dp} programs`);
}

if (errors.length) {
  console.log('\nconsole errors:');
  for (const e of errors.slice(0, 10)) console.log('  ' + e);
}

const out = resultsPath('hitch.json');
writeFileSync(out, JSON.stringify({ long, targetLog, marks, frameCount: frames.length }, null, 2));
console.log(`\nfull record: ${out}`);
