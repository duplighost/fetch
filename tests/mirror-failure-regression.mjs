import { ensureServer, launchBrowser, openPage, URL_BASE } from './lib/harness.mjs';

const failures = [];
const check = (condition, message, detail = null) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${message}`
    + (detail == null ? '' : ` -- ${JSON.stringify(detail)}`));
  if (!condition) failures.push({ message, detail });
};

const server = await ensureServer();
let browser = null;
let opened = null;
try {
  browser = await launchBrowser();
  opened = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  const { page } = opened;
  await page.waitForFunction(() => window.__FETCH?.ready === true,
    null, { timeout: 15000, polling: 50 });
  const results = await page.evaluate(async () => {
    const THREE = await import('three');
    const { Mirror, Mirrors } = await import('/src/mirrors.js');
    const fixture = (fault = null) => {
      const outer = { name: 'outer-target' };
      let current = outer;
      let sawPool = false;
      let thrown = false;
      const renderer = {
        getRenderTarget() { return current; },
        setRenderTarget(target) {
          const isPool = target?.isWebGLRenderTarget;
          if (fault === 'bind' && isPool && !thrown) {
            thrown = true;
            throw new Error('injected bind');
          }
          if (fault === 'restore' && sawPool && target === outer && !thrown) {
            thrown = true;
            throw new Error('injected restore');
          }
          if (isPool) sawPool = true;
          current = target;
        },
        clear() {},
        render() {
          if (fault === 'render' && current?.isWebGLRenderTarget && !thrown) {
            thrown = true;
            throw new Error('injected render');
          }
        },
      };
      const mirrors = new Mirrors(renderer, { budget: 1, size: 8, maxDist: 8 });
      const pane = mirrors.add(new Mirror(1, 1));
      pane.place(0, 1, -2, 0);
      const scene = new THREE.Scene();
      scene.add(pane.mesh);
      const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 20);
      camera.position.set(0, 1, 0);
      camera.lookAt(0, 1, -2);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const reports = [];
      mirrors.onFailure = (failure) => reports.push(failure);
      return { renderer, mirrors, pane, scene, camera, outer, reports,
        current: () => current, thrown: () => thrown };
    };
    const rows = [];
    for (const fault of ['bind', 'render', 'restore']) {
      const f = fixture(fault);
      let result = null;
      let escaped = null;
      try { result = f.mirrors.update(f.scene, f.camera); }
      catch (error) { escaped = error?.message || `${error}`; }
      rows.push({
        fault, result, escaped, thrown: f.thrown(), inUpdate: f.mirrors._inUpdate,
        targetRestored: f.current() === f.outer, scopeVisible: f.pane.mesh.visible,
        active: f.pane.active,
        textureNull: f.pane.material.uniforms.tDiffuse.value == null,
        reports: f.reports,
      });
      f.mirrors.dispose();
    }
    const success = fixture();
    const successResult = success.mirrors.update(success.scene, success.camera);
    const successful = {
      result: successResult,
      active: success.pane.active,
      targetRestored: success.current() === success.outer,
      inUpdate: success.mirrors._inUpdate,
      reports: success.reports,
    };
    success.mirrors.dispose();
    return { rows, successful };
  });
  for (const row of results.rows) {
    const expectedPhase = {
      bind: 'bind-pane-target',
      render: 'render-pane',
      restore: 'restore-pane-target',
    }[row.fault];
    check(row.escaped == null && row.result === false && row.thrown,
      `${row.fault} fault is contained and reported as a failed reflection`, row);
    check(row.inUpdate === false && row.targetRestored,
      `${row.fault} fault restores outer target and clears update latch`, row);
    check(row.scopeVisible === true && row.active === false && row.textureNull === true,
      `${row.fault} fault restores scope and leaves safe dark glass`, row);
    check(row.reports.length >= 1
        && row.reports.every((entry) => entry.message.includes('injected'))
        && row.reports[0]?.phase === expectedPhase,
      `${row.fault} fault reaches the bounded owner recovery callback`, row.reports);
  }
  check(results.successful.result === true && results.successful.active === true
      && results.successful.targetRestored && results.successful.inUpdate === false
      && results.successful.reports.length === 0,
    'successful reflection still activates pane and restores nested target state', results.successful);
  check(opened.errors.length === 0, 'mirror fault harness emits no browser errors', opened.errors);
} catch (error) {
  const detail = {
    error: error?.stack || `${error}`,
    browserErrors: opened?.errors || [],
  };
  failures.push({ message: 'suite crashed', detail });
  if (detail.browserErrors.length) console.error(detail.browserErrors.join('\n'));
  console.error(error?.stack || error);
} finally {
  await browser?.close().catch(() => {});
  server.stop();
}

if (failures.length) {
  console.error(`\n${failures.length} mirror failure regression(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll mirror failure regressions passed.');
}
