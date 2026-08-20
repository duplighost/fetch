// probe-webs.mjs -- did the webs land, and what do they cost?
//
// Two questions in one boot. (1) A spider used to be eighteen draw calls -- an
// abdomen, a head and sixteen leg segments on one material -- which is why
// there were three of them, in the house, the district with the least headroom
// in the game. They are one merged mesh now; this counts the difference.
// (2) Every new site is a hand-picked corner, and furnish() puts down enough
// furniture that a hand-picked corner cannot be trusted to still be empty, so
// each one is checked against the colliders at build time. This reports which
// sites survived that check and which were dropped, because a silently dropped
// web is a web nobody will ever look for.
//
//   node tools/probe-webs.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game, null, { timeout: 120000, polling: 100 });

const out = await page.evaluate(() => {
  const F = window.__FETCH, g = window.__game;
  F.start();
  F.stepWith(0.3, {}, false);

  const webs = g.webs.map((w) => {
    let lines = 0, spiderDraws = 0, spiders = 0;
    w.traverse((c) => {
      if (c.isLineSegments) lines++;
      else if (c.isMesh) { spiderDraws++; }
    });
    // a spider is one mesh now; count the roots so a regression to a Group of
    // eighteen shows up as spiderDraws climbing while spiders stays flat
    for (const c of w.children) if (c.isMesh || (c.isGroup && !c.isLineSegments && c.children.some((k) => k.isMesh))) spiders++;
    return {
      x: +w.position.x.toFixed(2), y: +w.position.y.toFixed(2), z: +w.position.z.toFixed(2),
      scale: +w.scale.y.toFixed(2), lines, spiderDraws, spiders,
    };
  });

  const totals = webs.reduce((a, w) => ({
    lines: a.lines + w.lines, spiderDraws: a.spiderDraws + w.spiderDraws, spiders: a.spiders + w.spiders,
  }), { lines: 0, spiderDraws: 0, spiders: 0 });

  // draw calls per district, the number the culling gate polices
  const districts = {};
  for (const d of ['house', 'graveyard', 'forest', 'cave', 'clearing']) {
    try {
      F.teleport(d);
      F.stepWith(0.05, {}, false);
      g.enemies.clear();
      g.render();
      districts[d] = g.lastRender.drawCalls;
    } catch (e) { districts[d] = `n/a (${e.message})`; }
  }

  return { report: g.__webReport, count: g.webs.length, totals, webs, districts };
});

console.log('sites placed        :', out.report?.placed, 'of', (out.report?.placed || 0) + (out.report?.skipped?.length || 0));
console.log('sites skipped (busy):', out.report?.skipped?.length ? out.report.skipped.join(', ') : 'none');
console.log('webs in game.webs   :', out.count);
console.log('draw calls: strands', out.totals.lines, '+ spiders', out.totals.spiderDraws, '=', out.totals.lines + out.totals.spiderDraws);
console.log('spiders             :', out.totals.spiders, '(at 18 draws each the old kit would cost', out.totals.spiders * 18, ')');
console.log('\ndistrict draw calls (ceiling 450):');
for (const [k, v] of Object.entries(out.districts)) console.log(' ', k.padEnd(10), v);
console.log('\nper web:');
for (const w of out.webs) console.log(`  (${String(w.x).padStart(7)},${String(w.y).padStart(7)},${String(w.z).padStart(7)}) s=${w.scale}  lines=${w.lines} spiderMeshes=${w.spiderDraws}`);
if (errors.length) console.log('\nPAGE ERRORS:', errors.slice(0, 5));
await browser.close();
await server?.close?.();
