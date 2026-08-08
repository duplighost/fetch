// Runs FETCH's built-in deterministic regression suite on real Chrome.
// The game (in ?autotest=1 mode) sets document.body.dataset.autotestResult to
// 'pass'/'fail' and dataset.autotestDetails to a JSON array of checks.
//   node tests/autotest.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
let exit = 0;
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?autotest=1`);

  let result = 'timeout';
  try {
    await page.waitForFunction(
      () => document.body.dataset.autotestResult === 'pass' || document.body.dataset.autotestResult === 'fail',
      null, { timeout: 180000, polling: 200 },
    );
    result = await page.evaluate(() => document.body.dataset.autotestResult);
  } catch { /* result stays 'timeout' */ }

  let details = [];
  try {
    details = JSON.parse(await page.evaluate(() => document.body.dataset.autotestDetails || '[]'));
  } catch (e) { console.log('  unparseable autotestDetails: ' + (e && e.message || e)); }

  const checks = Array.isArray(details) ? details : (details && details.checks) || [];
  for (const c of checks) {
    if (c && typeof c === 'object') {
      const passed = c.passed ?? c.pass ?? c.ok;
      const name = c.name ?? c.check ?? c.msg ?? JSON.stringify(c);
      console.log(`  ${passed === true ? 'PASS' : passed === false ? 'FAIL' : '  ? '} ${name}`);
    } else {
      console.log('  check: ' + String(c));
    }
  }
  for (const e of errors) console.log('  browser: ' + e);
  console.log(`${result.toUpperCase()}: ${checks.length} checks, ${errors.length} browser errors (${URL_BASE}/?autotest=1)`);

  writeFileSync(resultsPath('autotest.json'), JSON.stringify({ result, details, errors }, null, 2));
  if (result !== 'pass' || errors.length) exit = 1;
} catch (e) {
  console.log('FAIL exception: ' + (e && e.stack || e));
  exit = 1;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
process.exit(exit);
