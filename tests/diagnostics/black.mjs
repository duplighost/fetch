// Diagnose the reported black screen: game runs (audio + reticle + input) but
// nothing renders. Boots the LIVE production build in system Chrome on the
// D3D11 path, starts it the way a player does, then measures actual pixels.
import { launchBrowser, openPage } from './lib/harness.mjs';

const URL = process.argv[2] || 'https://qualiacology.com/fetch/';
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, URL, { quiet: false });

const shaderLog = [];
page.on('console', m => { if (/shader|glsl|program|link|compile|webgl|context/i.test(m.text())) shaderLog.push(m.type() + ': ' + m.text()); });

// Wait for the game object the two-rAF launch creates.
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 }).catch(() => {});

const preStart = await page.evaluate(() => ({
  hasGame: !!window.__game,
  boot: window.__FETCH_BOOT ? { ...window.__FETCH_BOOT } : null,
  canvasInDom: !!document.querySelector('canvas'),
}));

// Start it the way a player does.
await page.evaluate(() => {
  const b = document.querySelector('[data-action="start"]');
  if (b) b.click();
  else if (window.__game?.startGame) window.__game.startGame();
});
await page.waitForTimeout(1500);

// Let it actually run a while, as a player would.
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => { try { window.__game?.render?.(); } catch (e) { window.__diagRenderError = String(e); } });
  await page.waitForTimeout(50);
}

const diag = await page.evaluate(() => {
  const g = window.__game;
  const r = g?.renderer;
  const gl = r?.getContext?.();
  const canvas = r?.domElement || document.querySelector('canvas');

  // Read the real framebuffer back and measure luminance.
  let pixels = null;
  if (canvas) {
    try {
      g?.render?.();
      const o = document.createElement('canvas');
      o.width = 160; o.height = 90;
      const ctx = o.getContext('2d');
      ctx.drawImage(canvas, 0, 0, o.width, o.height);
      const d = ctx.getImageData(0, 0, o.width, o.height).data;
      let sum = 0, max = 0, nonBlack = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722);
        sum += l; if (l > max) max = l; if (l > 4) nonBlack++;
      }
      pixels = {
        meanLuma: +(sum / (d.length / 4)).toFixed(2),
        maxLuma: +max.toFixed(1),
        nonBlackPct: +(100 * nonBlack / (d.length / 4)).toFixed(1),
      };
    } catch (e) { pixels = { error: String(e) }; }
  }

  // Count lights actually in the scene graph.
  let lights = [];
  try {
    g?.scene?.traverse?.(o => { if (o.isLight) lights.push({ type: o.type, visible: o.visible, intensity: o.intensity, parentVisible: o.parent?.visible }); });
  } catch (e) { lights = [{ error: String(e) }]; }

  return {
    state: (() => { try { return { act: g?.state?.().act, started: g?.started, running: g?.running }; } catch (e) { return String(e); } })(),
    contextLost: gl ? gl.isContextLost() : 'no-gl',
    glError: gl ? gl.getError() : null,
    canvas: canvas ? { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight, inDom: document.contains(canvas), display: getComputedStyle(canvas).display, opacity: getComputedStyle(canvas).opacity, visibility: getComputedStyle(canvas).visibility, zIndex: getComputedStyle(canvas).zIndex } : null,
    renderInfo: r?.info ? { calls: r.info.render.calls, triangles: r.info.render.triangles, programs: r.info.programs?.length } : null,
    programDiagnostics: (r?.info?.programs || []).map(p => p.diagnostics).filter(Boolean).slice(0, 3),
    lightCount: lights.length,
    lights: lights.slice(0, 12),
    renderError: window.__diagRenderError || null,
    pixels,
    debugShader: (() => { try { return r.debug?.checkShaderErrors; } catch { return 'n/a'; } })(),
  };
});

console.log('URL:', URL);
console.log('--- pre-start ---'); console.log(JSON.stringify(preStart, null, 1));
console.log('--- after start + 40 rendered frames ---'); console.log(JSON.stringify(diag, null, 1));
console.log('--- page/console errors (' + errors.length + ') ---'); errors.slice(0, 20).forEach(e => console.log('  ' + e));
console.log('--- shader/webgl console lines (' + shaderLog.length + ') ---'); shaderLog.slice(0, 20).forEach(e => console.log('  ' + e));

await browser.close();
