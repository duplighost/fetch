// THE SEAM: FETCH hands off to his coda at ending/.
//
// Two things have to hold, and neither had a gate before this file existed.
//
//  1. THE WARM IS PAID ONE DISTRICT EARLY. _warmCoda is kicked from
//     director._enterCave, and by the time the player reaches the mirror room
//     all seven of the coda's media files are in the HTTP cache. His one stated
//     worry about this hand-off was that it lags at the transition; the whole
//     point of the warm is that the click costs nothing.
//
//  2. THE CLICK GOES TO THE CODA. main.js's ending-screen click used to call
//     location.reload() and NOTHING in this suite ever exercised it. It calls
//     _leaveForCoda() now. location.assign is [LegacyUnforgeable] and cannot be
//     stubbed, so the hand-off is routed through the injectable this._navigate
//     -- which is the only reason this check can exist without the gate
//     navigating away from its own page mid-assertion.
//
// And the guard that makes the warm invisible to the gates that must not see
// it: tests/warm-start-regression.mjs boots ?mute=1&hitch=1 (NOT test mode) and
// tours through 'cave'. An unguarded fetch there would land megabytes inside
// its arrival-hitch window. Both guarded modes are asserted directly below.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServer, launchBrowser, openPage, URL_BASE, ROOT } from './lib/harness.mjs';

const failures = [];
const check = (condition, message, detail = '') => {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}${suffix}`);
  if (!condition) failures.push(`${message}${suffix}`);
};

// The coda's contract, stated here independently of src/main.js on purpose: if
// the manifest and the shipped media ever disagree, this is what says so.
const CODA_MEDIA = [
  'media/dancer-club.mp4', 'media/dancer-club.jpg',
  'media/dancer-stage.mp4', 'media/dancer-stage.jpg',
  'media/dancer-spin.mp4', 'media/dancer-spin.jpg',
  'media/skull-close.jpg',
];
const onDisk = CODA_MEDIA.map((name) => {
  const path = join(ROOT, 'ending', ...name.split('/'));
  return { name, bytes: statSync(path).size };
});
const onDiskBytes = onDisk.reduce((sum, f) => sum + f.bytes, 0);

const server = await ensureServer();
const browser = await launchBrowser();
try {
  // ---- serve.mjs: the coda's media is playable AND cacheable --------------
  // Without a .mp4 type a <video> is handed application/octet-stream and
  // refuses, and the failure reads as a coda bug. Without a cacheable header
  // the warm fetch populates nothing and every byte is re-downloaded at the
  // seam -- the dev server would defeat the prefetch by construction.
  const clip = await fetch(`${URL_BASE}/ending/media/dancer-club.mp4`);
  check(clip.status === 200 && clip.headers.get('content-type') === 'video/mp4',
    'the coda\'s video is served as video/mp4, not application/octet-stream',
    `${clip.status} ${clip.headers.get('content-type')}`);
  check(!/no-store/.test(clip.headers.get('cache-control') || ''),
    'ending/media/ is cacheable, so a warm fetch actually populates the cache',
    clip.headers.get('cache-control') || '(none)');
  const source = await fetch(`${URL_BASE}/src/main.js`);
  check(/no-store/.test(source.headers.get('cache-control') || ''),
    'the cacheable exception does not leak onto FETCH\'s own source',
    source.headers.get('cache-control') || '(none)');
  const page404 = await fetch(`${URL_BASE}/ending/`);
  check(page404.status === 200, 'the coda page itself answers at ending/', `${page404.status}`);

  // ---- the guard: the two measuring modes never fetch --------------------
  // Called directly rather than through a teleport: _warmCoda is standalone,
  // and this keeps the two guarded pages from paying for a whole boot.
  for (const [query, reason] of [['?test=1&mute=1', 'test-mode'], ['?mute=1&hitch=1', 'hitch-mode']]) {
    const guarded = await openPage(browser, `${URL_BASE}/${query}`);
    await guarded.page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });
    const warm = await guarded.page.evaluate(() => {
      window.__game._warmCoda();
      return window.__FETCH.coda().warm;
    });
    check(warm.status === 'skipped' && warm.reason === reason && warm.bytes === 0,
      `${query} never fetches the coda's media`,
      `${warm.status}/${warm.reason}, ${warm.bytes} bytes`);
    check(guarded.errors.length === 0,
      `${query} produces zero page/console errors around the guard`,
      guarded.errors.slice(0, 3).join(' | '));
    await guarded.page.close();
  }

  // ---- the real path -----------------------------------------------------
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1&warmup=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 100 });

  const target = await page.evaluate(() => window.__FETCH.codaTarget());
  check(target === `${URL_BASE}/ending/`,
    'the hand-off resolves one relative hop from the page, so / and /fetch/ both work',
    target);

  const beforeStart = await page.evaluate(() => window.__FETCH.coda());
  check(beforeStart.warm === null && beforeStart.left === null,
    'nothing is fetched and nothing is left for before the player is anywhere near the cave',
    JSON.stringify({ warm: beforeStart.warm, left: beforeStart.left }));

  await page.evaluate(() => window.__FETCH.start());
  await page.waitForFunction(() => window.__game.started === true, null, { timeout: 120000, polling: 50 });
  const atEntry = await page.evaluate(() => window.__FETCH.coda().warm);
  check(atEntry === null, 'entering the game does not fetch the coda either', JSON.stringify(atEntry));

  // The kick. _enterCave is the district before the mirror room -- the walk
  // through the Underfalls is minutes of the player being busy.
  const kicked = await page.evaluate(() => {
    window.__FETCH.teleport('cave');
    return window.__FETCH.coda().warm;
  });
  check(kicked && kicked.status === 'fetching' && kicked.total === 7,
    'arriving in the cave starts the warm for all seven files',
    JSON.stringify({ status: kicked?.status, total: kicked?.total }));

  await page.waitForFunction(
    () => ['ready', 'partial', 'failed'].includes(window.__FETCH.coda().warm?.status),
    null,
    { timeout: 120000, polling: 100 },
  );
  const warm = await page.evaluate(() => window.__FETCH.coda().warm);
  check(warm.status === 'ready' && warm.done === 7 && warm.failed === 0,
    'the warm reaches ready before the player can possibly reach the ending',
    `${warm.status}, ${warm.done}/${warm.total} in ${warm.spentMs}ms; ${warm.errors.join(' | ')}`);
  check(warm.bytes === onDiskBytes,
    'every byte the coda plays on is in the cache, measured against the files on disk',
    `${warm.bytes} fetched vs ${onDiskBytes} on disk`);
  const fetched = [...warm.files].map((f) => f.name).sort().join(',');
  check(fetched === [...CODA_MEDIA].sort().join(','),
    'the warm manifest and the shipped media are the same seven files',
    fetched);
  // dancer-club is the one the plan originally left out. The coda MOUNTS on it.
  check(warm.files.some((f) => f.name === 'media/dancer-club.mp4' && f.bytes > 0),
    'the club clip -- the one the coda opens on -- is warmed, not left for the seam');

  // Re-entering the cave must not re-download six megabytes.
  const second = await page.evaluate(() => {
    const before = window.__FETCH.coda().warm.bytes;
    window.__game._warmCoda();
    return { before, after: window.__FETCH.coda().warm.bytes, status: window.__FETCH.coda().warm.status };
  });
  check(second.before === second.after && second.status === 'ready',
    're-entering the cave re-uses the warm instead of paying for it twice',
    JSON.stringify(second));

  // ---- THE SEAM ITSELF ---------------------------------------------------
  const href = await page.evaluate(() => {
    window.__codaNav = [];
    // location.assign is [LegacyUnforgeable]; this field is the only stub point.
    window.__game._navigate = (url) => { window.__codaNav.push(url); };
    window.__game.showEnd();
    return location.href;
  });
  const beforeClick = await page.evaluate(() => ({
    ended: window.__game.flags.has('ended'),
    titleShown: !window.__game.el.title.classList.contains('hidden'),
    nav: window.__codaNav.length,
  }));
  check(beforeClick.ended && beforeClick.titleShown && beforeClick.nav === 0,
    'the ending screen is up, and reaching it navigates nowhere on its own',
    JSON.stringify(beforeClick));

  await page.click('#title');
  const seam = await page.evaluate(() => ({
    nav: window.__codaNav.slice(),
    left: window.__FETCH.coda().left,
    target: window.__FETCH.codaTarget(),
    href: location.href,
  }));
  check(seam.nav.length === 1 && seam.nav[0] === seam.target,
    'a click on the ending screen hands off to the coda exactly once',
    JSON.stringify(seam.nav));
  check(seam.left === seam.target,
    'the game records where it left for', `${seam.left}`);
  check(seam.href === href,
    'the injected navigator really intercepted -- the gate is still on its own page',
    seam.href);

  check(errors.length === 0, 'the coda seam produces zero page/console errors',
    errors.slice(0, 4).join(' | '));
} finally {
  await browser.close();
  server.stop();
}

console.log(failures.length
  ? `FAIL: ${failures.length} coda-seam failures\n - ${failures.join('\n - ')}`
  : 'PASS: coda seam holds (warm one district early, click hands off)');
if (failures.length) process.exitCode = 1;
