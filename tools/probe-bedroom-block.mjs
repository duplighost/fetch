// probe-bedroom-block.mjs -- the 8.9-second frame in the bedroom: WHICH CALL?
//
// With the first-draw warm pass in, every act entry is clean and one enormous
// frame is left, right after start, carrying +0 programs +0 geometries +0
// textures. The game's own frame recorder can only say "this frame was long";
// it cannot say whether the time went into the sim step, the world render, the
// held render, the warm pass's own draw, or the link poll. So wrap each of them
// and let the frame account for itself.
//
//   node tools/probe-bedroom-block.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000 });

await page.evaluate(() => {
  const g = window.__game;
  const log = window.__block = { calls: [], frames: [] };
  const wrap = (owner, name, label) => {
    if (typeof owner?.[name] !== 'function') return;   // runs against older trees too
    const original = owner[name].bind(owner);
    owner[name] = (...args) => {
      const t0 = performance.now();
      const out = original(...args);
      const ms = performance.now() - t0;
      if (ms > 30) log.calls.push({ label, ms: +ms.toFixed(0), t: +performance.now().toFixed(0), warm: !!g._warmDrawingNow });
      return out;
    };
  };
  wrap(g.renderer, 'render', 'renderer.render');
  wrap(g.renderer, 'compile', 'renderer.compile');
  wrap(g.renderer, 'initTexture', 'renderer.initTexture');
  wrap(g, 'render', 'game.render');
  wrap(g, 'step', 'game.step');
  wrap(g, '_warmDrawTick', 'warmDrawTick');
  wrap(g, '_warmLinksSettled', 'warmLinksSettled');
  wrap(g, '_warmTexturesNow', 'warmTextures');
  wrap(g, '_beginShaderWarmup', 'beginShaderWarmup');
  // tag renderer.render calls that come from inside the warm pass
  if (typeof g._warmDrawTick === 'function') {
    const tick = g._warmDrawTick.bind(g);
    g._warmDrawTick = (...args) => { g._warmDrawingNow = true; try { return tick(...args); } finally { g._warmDrawingNow = false; } };
  }

  let last = performance.now();
  const frame = () => {
    const now = performance.now();
    const dt = now - last;
    if (dt > 60) log.frames.push({ t: +now.toFixed(0), ms: +dt.toFixed(0), act: g.act, started: g.started });
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
});

await page.evaluate(() => window.__FETCH.start());
await page.waitForTimeout(30000);

const out = await page.evaluate(() => ({ ...window.__block, warm: window.__FETCH.warm() }));
await browser.close();
server.stop();

console.log('calls over 30ms:');
for (const c of out.calls.sort((a, b) => b.ms - a.ms).slice(0, 20)) {
  console.log(`  ${String(c.ms).padStart(6)}ms  ${c.label.padEnd(20)} t=${c.t}  ${c.warm ? '(inside warm pass)' : ''}`);
}
console.log('\nframes over 60ms:');
for (const f of out.frames.sort((a, b) => b.ms - a.ms).slice(0, 12)) {
  console.log(`  ${String(f.ms).padStart(6)}ms  t=${f.t}  ${f.act}  started=${f.started}`);
}
console.log('\nwarm state: ' + JSON.stringify(out.warm.draw));
console.log('links:      ' + JSON.stringify(out.warm.links));
if (errors.length) console.log('\nerrors: ' + errors.slice(0, 5).join(' | '));
writeFileSync(resultsPath('bedroom-block.json'), JSON.stringify(out, null, 2));
