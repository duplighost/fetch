// probe-resident-clock.mjs -- "the Resident walks the house early, unprompted"
// (tests/house-chase-doors-regression) has been red since before e166da4. The
// check teleports to the house, steps 19.5 s against an 18 s constant, and finds
// no Resident. The assertion reports two booleans, which name nothing.
//
// _updateResident holds the arrival clock while the landing window-entry scare
// is live. This watches the clock and the thing that holds it.
//
//   node tools/probe-resident-clock.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 180000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    // exactly the gate's own setup
    g.enemies.clear();
    g.director.resident = null;
    g.director._houseResidentT = undefined;
    F.teleport('house');
    F.stepWith(0.2, {}, false);

    const trace = [];
    const sample = (t) => trace.push({
      t: +t.toFixed(1),
      clock: g.director._houseResidentT === undefined
        ? 'unset' : +g.director._houseResidentT.toFixed(2),
      entry: g.windowWatcher?.entry?.state ?? '(no windowWatcher)',
      act: g.act,
      resident: g.enemies.list.some((e) => e.kind === 'resident'),
    });

    sample(0);
    for (let t = 0; t < 24; t += 0.5) {
      F.stepWith(0.5, {}, false);
      sample(t + 0.5);
    }
    return {
      hasWatcher: !!g.windowWatcher,
      hasEntry: !!g.windowWatcher?.entry,
      entryStates: [...new Set(trace.map((r) => r.entry))],
      arrived: trace.find((r) => r.resident)?.t ?? null,
      trace,
    };
  });

  console.log('windowWatcher:', out.hasWatcher, ' entry:', out.hasEntry);
  console.log('entry states seen across 24 s:', JSON.stringify(out.entryStates));
  console.log('Resident arrived at:', out.arrived === null ? 'NEVER' : out.arrived + 's');
  console.log('clock samples:', out.trace.filter((_, i) => i % 6 === 0)
    .map((r) => r.t + 's=' + r.clock + '/' + r.entry).join('  '));
  console.log('errors:', errors.slice(0, 4).join(' | ') || 'none');
  writeFileSync(resultsPath('resident-clock.json'), JSON.stringify(out, null, 2));
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
