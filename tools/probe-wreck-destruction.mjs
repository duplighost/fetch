// ROUND NINE, item 1: "I want to be able to destroy the hell out of the car in
// the graveyard by throwing the skull at it. maybe it even has a car alarm
// going off before you destroy it."
//
// Drives the four stages, measures that each one CHANGES THE FRAME (a wreck
// that takes four hits and looks identical is the round-two disease again),
// and checks the alarm is bounded, strobes the lamp it already owns, calls the
// dead, and dies mid-wail.
//   node tools/probe-wreck-destruction.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, SHOTS } from '../tests/lib/harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
mkdirSync(SHOTS, { recursive: true });

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    const checks = [];
    const check = (name, passed, details = null) => checks.push({ name, passed: !!passed, details });
    const shots = {};
    const CAR = { x: -9, y: 0.9, z: 14 };

    const settle = () => { for (let i = 0; i < 3; i++) g.render(); };
    const pixels = () => {
      settle();
      const c = g.renderer.domElement;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    };
    const snap = (name) => {
      settle();
      shots[name] = g.renderer.domElement.toDataURL('image/png');
    };
    const diffPct = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        const la = a[i] * 0.2126 + a[i + 1] * 0.7152 + a[i + 2] * 0.0722;
        const lb = b[i] * 0.2126 + b[i + 1] * 0.7152 + b[i + 2] * 0.0722;
        if (Math.abs(la - lb) > 6) n++;
      }
      return +(100 * n / (a.length / 4)).toFixed(2);
    };
    const view = () => {
      g.player.pos.set(-4.6, 0, 12.4);
      g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
      const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
      g.player.yaw = Math.atan2(-(CAR.x - ex), -(CAR.z - ez));
      g.player.pitch = Math.atan2(CAR.y + 0.4 - ey, Math.hypot(CAR.x - ex, CAR.z - ez));
      g.player._sync(0);
      F.stepWith(0.1, {}, false);
    };

    F.start();
    F.teleport('graveyard');
    g.enemies.clear();
    F.stepWith(0.3, {}, false);
    g.skull.holdNow();
    const wreck = g.wreck;
    const target = g.world.fetchTargets.find((t) => t.id === 'wreckedWagon');
    check('the wreck is a fetch target at all', !!target && target.enabled === true);

    view();
    const frames = [pixels()];
    snap('00-intact');
    check('it starts intact and quiet',
      wreck.hits === 0 && !wreck.alarm && !wreck.dead && wreck.wreckT === 0);

    // ---- the four stages, each driven as a real outbound hit --------------
    const alarms = [];
    const realAlarm = g.audio.carAlarm.bind(g.audio);
    g.audio.carAlarm = (o = {}) => { alarms.push({ dying: !!o.dying }); return realAlarm(o); };
    const pulses = [];
    const realPulse = g.enemies.resonancePulse?.bind(g.enemies);
    if (realPulse) g.enemies.resonancePulse = (p, r, s) => { pulses.push(r); return realPulse(p, r, s); };

    const hit = () => {
      g.skull.mode = 'outbound';
      const directive = target.onHit.call(target, g.skull, g.skull.pos.clone().set(CAR.x, CAR.y, CAR.z));
      g.skull.holdNow();
      F.stepWith(1.1, {}, false);
      view();
      return directive;
    };

    const d1 = hit();
    frames.push(pixels());
    // catch BOTH phases of the strobe deliberately: a hard square is the whole
    // read, and a single frame proves whichever half it happened to land on
    const stepToPhase = (wantOn) => {
      for (let i = 0; i < 200; i++) {
        const on = Math.sin(g.time * 8.1) > 0;
        if (on === wantOn) return true;
        F.stepWith(1 / 120, {}, false);
      }
      return false;
    };
    stepToPhase(true); view();
    const strobeOn = pixels();
    snap('01a-alarm-strobe-on');
    stepToPhase(false); view();
    const strobeOff = pixels();
    snap('01b-alarm-strobe-off');
    check('the alarm STROBES: the two phases are different frames (>=2%)',
      diffPct(strobeOn, strobeOff) >= 2, { phaseDelta: diffPct(strobeOn, strobeOff) });
    view();
    const alarmsAfterFirst = alarms.length;
    const noiseWhileWailing = g.player.noise;
    check('the FIRST hit wakes the alarm and sends the skull home',
      d1 === 'return' && wreck.alarm === true && alarmsAfterFirst > 0,
      { directive: d1, alarm: wreck.alarm, wails: alarmsAfterFirst });
    check('...and the alarm is LOUD: it pins player noise and calls the dead',
      noiseWhileWailing > 0.7 && pulses.length > 0,
      { noise: +noiseWhileWailing.toFixed(2), pulses });

    const d2 = hit();
    frames.push(pixels());
    snap('02-glass-goes');
    const d3 = hit();
    frames.push(pixels());
    snap('03-door-and-hood');
    const wailsBeforeDeath = alarms.filter((a) => !a.dying).length;
    const d4 = hit();
    frames.push(pixels());
    snap('04-dead');

    check('four hits finish it, and the target stops answering',
      wreck.dead === true && wreck.hits === 4 && target.enabled === false
      && g.flags.has('wreckDestroyed'),
      { hits: wreck.hits, dead: wreck.dead, flag: g.flags.has('wreckDestroyed') });
    check('the alarm DIES rather than stopping', alarms.some((a) => a.dying) && !wreck.alarm,
      { wailsBeforeDeath, dying: alarms.filter((a) => a.dying).length });
    check('the wail repeated while it was alive, and stopped after',
      wailsBeforeDeath >= 2, { wailsBeforeDeath });
    F.stepWith(2.5, {}, false);
    check('nothing keeps wailing after the wreck is dead',
      alarms.filter((a) => !a.dying).length === wailsBeforeDeath,
      { after: alarms.filter((a) => !a.dying).length });

    // ---- did each stage actually CHANGE THE FRAME? -----------------------
    const deltas = [];
    for (let i = 1; i < frames.length; i++) deltas.push(diffPct(frames[i - 1], frames[i]));
    check('every stage visibly changes the car (>=0.5% of frame each)',
      deltas.every((d) => d >= 0.5), { deltas });
    check('the finished wreck is a different object from the intact one (>=6%)',
      diffPct(frames[0], frames[frames.length - 1]) >= 6,
      { total: diffPct(frames[0], frames[frames.length - 1]) });

    // ---- the collider dropped, so you can walk over what is left ---------
    check('the wreck collider drops on the last hit', wreck.collider.max.y <= 0.65,
      { top: +wreck.collider.max.y.toFixed(2) });
    // ---- the lamp is out --------------------------------------------------
    F.stepWith(0.2, {}, false);
    check('the headlight is out and the lens is dark',
      g.wreckLens.color.r < 0.05, { lens: +g.wreckLens.color.r.toFixed(3) });

    // ---- a finished wreck survives a graveyard reset ---------------------
    wreck.reset();
    check('a finished wreck stays finished through a reset',
      wreck.dead === true && wreck.hits === 4, { hits: wreck.hits });

    g.audio.carAlarm = realAlarm;
    if (realPulse) g.enemies.resonancePulse = realPulse;
    return { checks, shots, deltas };
  });

  for (const [name, data] of Object.entries(out.shots)) {
    writeFileSync(join(SHOTS, `r9-wreck-${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  let bad = 0;
  for (const c of out.checks) {
    if (!c.passed) bad++;
    console.log(`${c.passed ? 'PASS' : 'FAIL'} ${c.name}${c.details == null ? '' : ` -- ${JSON.stringify(c.details)}`}`);
  }
  console.log(`\nstage deltas: ${JSON.stringify(out.deltas)}`);
  console.log(`shots -> ${SHOTS}\\r9-wreck-*.png`);
  console.log(bad ? `${bad} FAILURE(S)` : 'ALL PASS');
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
  process.exitCode = bad ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
