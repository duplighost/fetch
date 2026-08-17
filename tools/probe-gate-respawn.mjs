// THE BUG OF ROUND FOUR, on a bench. `gateKeys.restore()` replayed a KEY-NUMBER
// flag onto a SOCKET INDEX while bankAny() seats bottom-up, so any out-of-order
// bank plus any death invented sockets — three filled from two real keys, the
// `_opened` latch set over a gate that never opened, and the real third key
// answered with the locked rattle forever. Alex hit it dying in the marrow.
//
// Runs all SIX bank orders with a respawn after every single bank (restore()
// fires twice per respawn and has to be idempotent both times), then walks the
// opened gate to prove nothing stands in the gap.
// Reports: per-order column, count, weight pose, latch state, and the walk.
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const t0 = Date.now();
  const since = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  // stream progress: a page.evaluate returns nothing until it finishes, and
  // this one drives 21 respawns — without this you cannot tell slow from hung
  page.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[probe]')) console.log(`${since()} ${text}`);
  });
  await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
    null, { timeout: 300000, polling: 100 });
  console.log(`${since()} booted`);
  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const rows = [];

    // Six orders on ONE page, so each has to start from a genuinely clean gate:
    // giveToJaw() refuses forever once 'gotgateKeyN' is set, and restore() reads
    // 'gateKeyBanked:N'. Clearing through restore() also exercises its CLEARING
    // direction, which the old key-number version could never do (it only ever
    // wrote true — half the reason a stale socket could never be corrected).
    const resetGate = () => {
      for (const k of [1, 2, 3]) {
        g.flags.delete('gateKeyBanked:' + k);
        g.flags.delete('gotgateKey' + k);
      }
      g.flags.delete('graveyardCleared');
      g.gateKeys._opened = false;
      if (g.skull.carry) g.skull.dropCarry();
      g.gateKeys.restore();
      for (const rec of g.gateKeys.list) rec.revealed = false;
      g.graveyardGate.reset();
    };

    const ORDERS = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]];
    for (const order of ORDERS) {
      console.log('[probe] order ' + order.join('') + ' start');
      F.start();
      F.teleport('graveyard');
      F.stepWith(0.2, {}, false);
      resetGate();
      g.flag('graveyardResolved');
      g.skull.holdNow();
      F.stepWith(0.2, {}, false);
      const steps = [];
      if (g.gateKeys.banked() !== 0) {
        rows.push({ order: order.join(''), steps: [], gave: false, cleared: false,
          dirty: g.gateKeys.banked() });
        continue;
      }
      for (let i = 0; i < 3; i++) {
        const rec = g.gateKeys.list[order[i] - 1];
        rec.reveal(g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z + 1.2);
        rec.giveToJaw();
        F.stepWith(0.1, {}, false);
        const seated = g.gateKeys.sockets.find((s) => !s.filled)?.bank();
        F.stepWith(0.1, {}, false);
        const before = g.gateKeys.banked();
        console.log('[probe]   key ' + order[i] + ' seated=' + seated + ' -> respawn');
        g.director.respawn();
        F.stepWith(0.6, {}, false);
        const gate = g.graveyardGate;
        steps.push({
          key: order[i], seated, before, after: g.gateKeys.banked(),
          column: g.gateKeys.sockets.map((s) => (s.filled ? 1 : 0)).join(''),
          down: gate.weights.filter((w) => w.position.y < w.userData.homeY - 0.005).length,
          opened: !!g.gateKeys._opened,
          softlock: g.gateKeys.banked() >= 3 && !gate.opening && !gate.open
            && !g.flags.has('graveyardCleared'),
        });
      }
      F.stepWith(1.8, {}, false);
      rows.push({
        order: order.join(''), steps,
        gave: !!(g.graveyardGate.opening || g.graveyardGate.open),
        cleared: g.flags.has('graveyardCleared'),
      });
    }

    // ---- the corrupt-session heal, and then the walkway ----
    F.start();
    F.teleport('graveyard');
    F.stepWith(0.2, {}, false);
    resetGate();
    g.flag('graveyardResolved');
    g.skull.holdNow();
    F.stepWith(0.2, {}, false);
    for (const s of g.gateKeys.sockets) s.filled = true;
    g.gateKeys._opened = true;
    g.flag('gateKeyBanked:2');
    g.flag('gateKeyBanked:3');
    F.stepWith(0.4, {}, false);
    const corruptBefore = {
      banked: g.gateKeys.banked(),
      shut: !g.graveyardGate.opening && !g.graveyardGate.open,
    };
    g.director.respawn();
    F.stepWith(0.6, {}, false);
    const healed = {
      banked: g.gateKeys.banked(),
      column: g.gateKeys.sockets.map((s) => (s.filled ? 1 : 0)).join(''),
      opened: !!g.gateKeys._opened,
    };
    const rec = g.gateKeys.list[0];
    rec.reveal(g.player.pos.x, g.player.pos.y + 1.2, g.player.pos.z + 1.2);
    rec.giveToJaw();
    F.stepWith(0.1, {}, false);
    const lastSeated = g.gateKeys.sockets.find((s) => !s.filled)?.bank();
    F.stepWith(1.8, {}, false);
    healed.thirdKeyGave = !!(g.graveyardGate.opening || g.graveyardGate.open);
    healed.lastSeated = lastSeated;

    // ---- the walkway: colliders, then an actual walk ----
    F.stepWith(4.0, {}, false);
    const inGap = (c) => c.max.y > 0.15 && c.max.x > 0.5 && c.min.x < 3.5
      && c.max.z > 41.4 && c.min.z < 45.5;
    const blockers = g.world.colliders.filter((c) => !c.door && inGap(c))
      .map((c) => ({
        skullPass: !!c.skullPass,
        box: [+c.min.x.toFixed(2), +c.min.z.toFixed(2),
          +c.max.x.toFixed(2), +c.max.z.toFixed(2), +c.max.y.toFixed(2)],
      }));
    g.player.pos.set(2, g.player.pos.y, 41);
    g.player.yaw = Math.PI;   // forward = (-sin, -cos) => PI faces +z
    g.player._sync(0);
    F.stepWith(0.1, {}, false);
    F.stepWith(4.0, { moveZ: 1 }, false);
    const walk = { x: +g.player.pos.x.toFixed(2), z: +g.player.pos.z.toFixed(2) };

    return { rows, corruptBefore, healed, blockers, walk,
      arrivalGone: g.ossuary.arrival == null };
  });

  console.log('=== SIX BANK ORDERS, a death after every bank ===');
  let bad = 0;
  for (const r of out.rows) {
    const flaws = [];
    r.steps.forEach((s, i) => {
      if (s.seated !== true) flaws.push(`key${s.key} refused`);
      if (s.after !== i + 1) flaws.push(`respawn ${s.before}->${s.after} want ${i + 1}`);
      const want = '111'.slice(0, i + 1).padEnd(3, '0');
      if (s.column !== want) flaws.push(`column ${s.column} want ${want}`);
      if (i < 2 && s.down !== i + 1) flaws.push(`${s.down} weights down want ${i + 1}`);
      if (i < 2 && s.opened) flaws.push(`_opened at ${i + 1}`);
      if (s.softlock) flaws.push('SOFTLOCK');
    });
    if (!r.gave) flaws.push('gate never gave');
    if (!r.cleared) flaws.push('graveyardCleared missing');
    if (r.dirty != null) flaws.push(`reset left ${r.dirty} banked`);
    if (flaws.length) bad++;
    console.log(` ${flaws.length ? 'FAIL' : 'PASS'} order ${r.order}`
      + (flaws.length ? ` -- ${flaws.join('; ')}` : '')
      + `   [${r.steps.map((s) => s.column).join(' ')}]`);
  }

  console.log('\n=== A SESSION THAT WALKS IN CORRUPT ===');
  console.log(' before ', JSON.stringify(out.corruptBefore));
  console.log(' healed ', JSON.stringify(out.healed));
  const healOk = out.healed.banked === 2 && out.healed.column === '110'
    && !out.healed.opened && out.healed.thirdKeyGave;
  console.log(` ${healOk ? 'PASS' : 'FAIL'} restore re-derives the count and the last key gives the gate`);

  console.log('\n=== THE WALKWAY ===');
  console.log(' arrival hatch gone:', out.arrivalGone);
  console.log(' colliders in the gap:', JSON.stringify(out.blockers));
  console.log(' straight walk ended at', JSON.stringify(out.walk));
  const walkOk = Math.abs(out.walk.x - 2) < 0.35 && out.walk.z > 45;
  console.log(` ${out.blockers.length === 0 && out.arrivalGone ? 'PASS' : 'FAIL'} nothing stands in the gap`);
  console.log(` ${walkOk ? 'PASS' : 'FAIL'} you can walk straight out without steering`);

  if (errors.length) console.log('\nBROWSER ERRORS:', errors);
  const ok = bad === 0 && healOk && walkOk && out.blockers.length === 0
    && out.arrivalGone && errors.length === 0;
  console.log(`\n${ok ? 'ALL GREEN' : 'PROBLEMS ABOVE'}`);
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close().catch(() => {});
  await server?.close?.().catch(() => {});
}
