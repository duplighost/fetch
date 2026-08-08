// Playwright harness for FETCH: SYSTEM CHROME on the real GPU (ANGLE/D3D11).
// Never swiftshader -- timing assertions on software GL measure the harness, not the game.
// Ported from kick-ball/tests/lib/harness.mjs.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SHOTS = join(ROOT, 'tests', 'shots');
export const RESULTS = join(ROOT, 'tests', 'results');

const PW = (() => {
  if (process.env.FETCH_PLAYWRIGHT) return process.env.FETCH_PLAYWRIGHT;
  try { return require.resolve('playwright-core', { paths: [ROOT] }); } catch { /* fall through */ }
  const legacy = 'C:/Users/Alex/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core';
  if (existsSync(legacy)) return legacy;
  throw new Error('playwright-core not found; set FETCH_PLAYWRIGHT');
})();

const CHROME = (() => {
  const candidates = [
    process.env.FETCH_CHROME,
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  const found = candidates.find(existsSync);
  if (found) return found;
  throw new Error('system Chrome not found; set FETCH_CHROME');
})();

export const PORT = Number(process.env.FETCH_PORT) || (9200 + (process.pid % 600));
export const URL_BASE = `http://localhost:${PORT}`;

export function chromium() { return require(PW).chromium; }

export async function ensureServer() {
  const ping = async (ms) => {
    const r = await fetch(URL_BASE + '/', { signal: AbortSignal.timeout(ms) });
    return r.ok;
  };
  try { if (await ping(1000)) return { port: PORT, stop() {} }; } catch { /* not up */ }
  let output = '';
  const proc = spawn(process.execPath, [join(ROOT, 'serve.mjs'), String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, FETCH_DEBUG: '1' },
  });
  proc.stdout?.on('data', c => { output += c; });
  proc.stderr?.on('data', c => { output += c; });
  const stop = () => { try { proc.kill(); } catch { /* already gone */ } };
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (proc.exitCode !== null) throw new Error(`server exited (${proc.exitCode}): ${output.trim()}`);
    try { if (await ping(800)) return { port: PORT, stop }; } catch { /* warming up */ }
  }
  stop();
  throw new Error(`server failed to start on ${PORT}: ${output.trim()}`);
}

export async function launchBrowser() {
  return chromium().launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-first-run', '--no-default-browser-check',
      '--enable-webgl', '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization', '--use-angle=d3d11',
      '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    ],
  });
}

export async function openPage(browser, url, { width = 1280, height = 800, quiet = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push('pageerror: ' + (e && e.message || e)); });
  page.on('console', m => {
    if (/favicon/i.test(m.text())) return;
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
    if (!quiet && m.type() === 'warning') errors.push('console.warning: ' + m.text());
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  return { page, errors };
}

export function shotPath(name) {
  mkdirSync(SHOTS, { recursive: true });
  return join(SHOTS, /\.(?:png|jpe?g|webp)$/i.test(name) ? name : name + '.png');
}

export function resultsPath(name) {
  mkdirSync(RESULTS, { recursive: true });
  return join(RESULTS, name);
}
