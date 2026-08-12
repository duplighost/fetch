// Watch shaderWarmup + gpu residency over 20s of REAL play (game's own rAF).
import { spawn } from 'node:child_process';
import { launchBrowser, openPage } from './lib/harness.mjs';

const root = process.argv[2];
const port = 9890;
const proc = spawn(process.execPath, ['C:/Users/Alex/Projects/qualiacology/build/scripts/static-server.mjs', `--root=${root}`, `--port=${port}`], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `http://localhost:${port}/fetch/`, { quiet: true });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-action="start"]')?.click());

const snap = () => page.evaluate(() => {
  const g = window.__game, w = g.shaderWarmup || {}, r = g.currentGpuResidency || {};
  const pick = (o, ks) => Object.fromEntries(ks.map(k => {
    let v = o[k];
    if (v instanceof Set || v instanceof Map) v = v.size;
    else if (Array.isArray(v)) v = v.length;
    else if (typeof v === 'object' && v) v = '[obj]';
    return [k, v];
  }));
  return {
    t: Math.round(performance.now()),
    warm: pick(w, ['status', 'reason', 'recoveryRound', 'renderShieldVariant', 'discoveryNodes', 'texturesDiscovered', 'texturesWarmed', 'pendingTextures', 'readyVariants', 'currentExactKey', 'bootstrapResumeScheduled', 'setupSlices', 'compileSlices']),
    res: pick(r, ['reducedFrames', 'fullFrames', 'ownerFullFrames', 'phase', 'status', 'certified', 'key']),
    reduced: g.lastRender?.reducedDetail,
    world: g.lastRender?.worldDrawCalls,
    boot: (() => { const b = g._reducedBootstrap; return b ? (b.status || b.phase || Object.keys(b).slice(0,8).join(',')) : null; })(),
    progressive: (() => { const p = r.progressive; return p ? { key: p.key, status: p.status || p.phase, pending: p.pending?.size ?? p.queue?.length } : null; })(),
  };
});

for (let i = 0; i < 10; i++) {
  console.log(JSON.stringify(await snap()));
  await page.waitForTimeout(2000);
}
console.log('errors: ' + errors.slice(0, 8).join(' | '));
await browser.close(); proc.kill();
