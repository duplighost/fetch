// probe-link-wait.mjs -- is the 7-9 second frame a GEOMETRY upload, or is it the
// driver still linking the shaders the warm pass handed it?
//
// probe-hitch.mjs reports the frame as "+191 geometries, +0 programs", and the
// brief reads that as 191 buffer uploads in one gulp. The same run uploads 162
// geometries entering the forest in 48 ms. Two hundred times the cost per
// geometry is not a difference in geometry -- so measure the other candidate.
//
// THE INSTRUMENT: KHR_parallel_shader_compile. gl.getProgramParameter(p,
// COMPLETION_STATUS_KHR) asks the driver whether a program has finished linking
// and returns IMMEDIATELY -- it is the one question about link state you can ask
// without waiting for the answer to become true. Sample it every frame and the
// stall stops being anonymous: if the frame that costs seconds is also the frame
// where `done` jumps from a fraction to all, the game was waiting on the driver,
// not on the bus.
//
// A FRESH BROWSER PER SCENARIO IS NOT OPTIONAL. Chrome keeps a GPU program cache
// per profile, so a second scenario in the same browser gets every program back
// from disk in milliseconds and reads as "the problem went away". The first cut
// of this probe did exactly that and nearly proved the opposite of the truth.
//
//   node tools/probe-link-wait.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const LONG_FRAME_MS = 45;

const server = await ensureServer();

const scenario = async (label, plan) => {
  // Fresh browser => fresh profile => cold GPU program cache, which is what a
  // player gets on their first visit and what the freeze report is about.
  const browser = await launchBrowser();
  const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

  await page.evaluate(() => {
    const g = window.__game;
    const gl = g.renderer.getContext();
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const rec = window.__hitch = { frames: [], marks: [], ext: !!ext };
    rec.mark = (label) => rec.marks.push({ label, t: +performance.now().toFixed(1) });
    const linkState = () => {
      const list = g.renderer.info.programs || [];
      if (!ext) return -1;
      let done = 0;
      for (const p of list) {
        try { if (gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)) done++; } catch { /* disposed */ }
      }
      return done;
    };
    rec.linkState = linkState;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const programs = g.renderer.info.programs?.length ?? -1;
      rec.frames.push({
        t: +now.toFixed(1), dt: +(now - last).toFixed(2),
        programs, linked: linkState(),
        geometries: g.renderer.info.memory.geometries,
        textures: g.renderer.info.memory.textures,
        calls: g.renderer.info.render.calls,
        act: g.act,
      });
      last = performance.now();   // after the sample, so the sample is not the gap
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.evaluate(() => { window.__hitch.mark('start'); window.__FETCH.start(); });
  await plan(page);

  const rec = await page.evaluate(() => window.__hitch);
  await browser.close();

  const frames = rec.frames;
  const marks = rec.marks;
  const labelFor = (t) => { let best = null; for (const m of marks) if (m.t <= t) best = m; else break; return best ? best.label : 'boot'; };
  const long = [];
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i]; const p = frames[i - 1];
    if (f.dt < LONG_FRAME_MS) continue;
    long.push({
      ms: f.dt, act: f.act, since: labelFor(f.t),
      dPrograms: f.programs - p.programs,
      dGeometries: f.geometries - p.geometries,
      linkedBefore: p.linked, linkedAfter: f.linked, programs: f.programs,
      calls: f.calls,
    });
  }
  long.sort((a, b) => b.ms - a.ms);

  console.log(`\n=== ${label} ===`);
  console.log(`  frames ${frames.length}   programs ${frames.at(-1)?.programs}   linked at end ${frames.at(-1)?.linked}`);
  console.log(`  long frames (>${LONG_FRAME_MS}ms): ${long.length}`);
  console.log('       ms  act        after-mark        +prog  +geo   linked(before->after)');
  for (const l of long.slice(0, 8)) {
    console.log(`   ${String(l.ms).padStart(7)}  ${(l.act || '?').padEnd(10)} ${l.since.padEnd(17)} ${String(l.dPrograms).padStart(5)} ${String(l.dGeometries).padStart(5)}   ${l.linkedBefore}/${l.programs} -> ${l.linkedAfter}/${l.programs}`);
  }
  // The link curve over the first seconds, one sample per ~250 ms of frames.
  const curve = [];
  for (let i = 0; i < frames.length; i += 15) curve.push(`${(frames[i].t / 1000).toFixed(1)}s:${frames[i].linked}`);
  console.log('  link curve: ' + curve.slice(0, 24).join(' '));
  if (errors.length) console.log('  errors: ' + errors.slice(0, 4).join(' | '));
  return { label, long, frames: frames.map((f) => [f.t, f.dt, f.linked, f.programs, f.geometries, f.act]) };
};

const enter = async (page, act) => {
  await page.evaluate((a) => { window.__hitch.mark('enter:' + a); window.__FETCH.teleport(a); }, act);
  await page.waitForTimeout(2500);
};

const results = [];

results.push(await scenario('A  basement at +3s, cold profile', async (page) => {
  await page.waitForTimeout(3000);
  await enter(page, 'basement');
}));

results.push(await scenario('B  sit in the bedroom 25s, then basement', async (page) => {
  await page.waitForTimeout(25000);
  await enter(page, 'basement');
}));

results.push(await scenario('C  forest first at +3s, basement second', async (page) => {
  await page.waitForTimeout(3000);
  await enter(page, 'forest');
  await enter(page, 'basement');
}));

server.stop();

const out = resultsPath('link-wait.json');
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\nfull record: ${out}`);
