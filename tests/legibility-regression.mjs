// legibility-regression.mjs -- THE FAILURE MODE THIS PROJECT ACTUALLY HAS.
//
// Nine rounds of Alex's notes, and the recurring one is never "it is broken".
// It is "I never saw it happen". The ossuary conduit was drawn nowhere for its
// whole life. The kennel wire worked and could not be read. The key came out of
// the tree behind him and he never knew a key had come out of a tree. Every one
// of those passed its own gate, because the gates test FUNCTION: did the flag
// flip, did the target answer, did the key become fetchable. None of them ask
// the only question that decides whether the player ever sees the game.
//
// So: measure the reading, the same way every time.
//
//   TOGGLE THE THING OFF, RE-RENDER THE SAME POSE, AND DIFF THE TWO FRAMES.
//     pctChanged -- how much of the screen it is
//     contrast   -- how far its luminance is from what it hides, EITHER WAY
//
// Both numbers matter. A thing can be huge and invisible (dark bark against
// dark trees) or bright and microscopic (a key at forty metres). The floors
// below are set UNDER what each thing currently measures, so this is a
// regression gate, not a target: it fires when a change makes an authored
// reveal quieter, which is exactly the change nobody notices they made.
//
// And pixels are only half of it. The last block measures the ANNOUNCE — the
// sound and the motion that carry a reveal which lands off-screen, which is
// what the key tree's failure actually was.
//
// Traps, learned the expensive way and all still live:
//  * world.finishStatic() CLONES the material it merges under, so toggling your
//    own material's `.visible` does nothing. Toggle the OBJECT.
//  * the ossuary's district seal hides every scene child that is not routeRoot,
//    so anything measured down there has to live in routeRoot.
//  * render() decays the impact light and the FOV kick every call and jitters
//    the camera while _shake is alive, so a pose has to be rendered until two
//    frames are byte-identical before it can be read. Skipping that reported
//    the key in the grass at "6.97% of frame" — pure noise, and the opposite
//    conclusion from the truth (0.02% at 9x: small, and bright).
//
//   node tests/legibility-regression.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from './lib/harness.mjs';
import { writeFileSync } from 'node:fs';

// label -> [minimum % of frame, minimum luminance ratio]. Measured, then
// floored with room to move; the measured values live in the console output.
const FLOORS = {
  'the ossuary conduit, from the walk-up': [0.35, 1.6],
  'the key-tree limb, from the top of the lane': [0.12, 1.8],
  'the key-tree limb, at throwing distance': [0.18, 1.15],
  'the key in the grass, from four metres': [0.01, 4.0],
  // PROVISIONAL, and say so rather than pretend: these two were authored
  // without a render -- the agent that added the second stall could not
  // launch a browser -- so they assert only the floor of the claim, that the
  // body is on screen at all and differs in luminance from what it hides.
  // RAISE THEM under the first measured run: the console prints the real
  // numbers on every pass, and a floor that nothing can ever trip is a
  // decorative gate, which is the failure this whole file exists to end.
  'the second stall, from the crawl doorway': [0.01, 1.02],
  'the second stall, at the bars': [0.30, 1.05],
};

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true && window.__game,
  null, { timeout: 120000, polling: 100 });

const result = await page.evaluate(() => {
  const F = window.__FETCH, g = window.__game;
  const measured = [];
  const shots = {};
  const snap = (name) => { for (let i = 0; i < 3; i++) g.render(); shots[name] = g.renderer.domElement.toDataURL('image/png'); };

  const seat = (x, z, y) => {
    g.player.pos.set(x, y, z);
    g.player.vel.set(0, 0, 0); g.player.fallV = 0; g.player.grounded = true;
    g.player._sync(0);
  };
  const lookAt = (x, y, z) => {
    const ex = g.player.pos.x, ey = g.player.pos.y + 1.62, ez = g.player.pos.z;
    g.player.yaw = Math.atan2(-(x - ex), -(z - ez));
    g.player.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(y - ey, Math.hypot(x - ex, z - ez))));
    g.player._sync(0);
  };

  // THE INSTRUMENT. Everything in this file goes through it.
  //
  // RENDER UNTIL THE FRAME STOPS MOVING BEFORE READING IT. render() decays the
  // impact light and the FOV kick every call and applies a RANDOM rotational
  // flinch while _shake is alive, so two renders of one pose are two different
  // images — which reads as an enormous pctChanged at a ratio of 1.0, noise
  // wearing the shape of a signal. Measured that way, the key in the grass
  // reported "6.97% of frame"; settled, it is 0.02% at 12x, which is the truth
  // (a small bright thing) and the opposite conclusion.
  const grab = () => {
    const canvas = g.renderer.domElement;
    const scratch = document.createElement('canvas');
    scratch.width = canvas.width; scratch.height = canvas.height;
    const ctx = scratch.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    return ctx.getImageData(0, 0, scratch.width, scratch.height).data;
  };
  const same = (a, b) => { for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i]) return false; return true; };
  const settle = () => {
    g._shake = 0; g.fovKick = 0;
    let prev = null;
    for (let i = 0; i < 10; i++) {
      g.render();
      const now = grab();
      if (prev && same(prev, now)) return now;
      prev = now;
    }
    return prev;
  };
  const read = (label, target, poseFn) => {
    poseFn();
    const on = settle();
    const was = target.visible;
    target.visible = false;
    const off = settle();
    target.visible = was;
    let changed = 0, sumOn = 0, sumOff = 0, n = 0;
    for (let i = 0; i < on.length; i += 4) {
      const lOn = on[i] * 0.2126 + on[i + 1] * 0.7152 + on[i + 2] * 0.0722;
      const lOff = off[i] * 0.2126 + off[i + 1] * 0.7152 + off[i + 2] * 0.0722;
      if (Math.abs(lOn - lOff) > 4) { changed++; sumOn += lOn; sumOff += lOff; n++; }
    }
    const ratio = n ? sumOn / Math.max(1, sumOff) : 1;
    const row = {
      label,
      pctChanged: +(100 * changed / (on.length / 4)).toFixed(2),
      ratio: +ratio.toFixed(2),
      // CONTRAST, NOT BRIGHTNESS. A silhouette is as legible as a lamp; what the
      // eye needs is a difference, in either direction. Scored on brightness
      // alone, a limb that reads as a black diagonal against the sky (0.21x)
      // scores below a key that reads as nothing at all (1.02x).
      contrast: +Math.max(ratio, 1 / Math.max(ratio, 1e-6)).toFixed(2),
    };
    measured.push(row);
    return row;
  };

  F.start();

  // ---- 0. the crawl wing's second stall ----------------------------------
  // Measured FIRST, and that ordering is load-bearing: the graveyard teleport
  // below hides every house interior root, and this stall is one of them, so
  // read from the basement while the house district is still up.
  //
  // Toggle the OBJECT, never a material -- world.finishStatic() CLONES what it
  // merges, and that trap has already cost this project four rounds. Scored on
  // CONTRAST, which is what `read` already returns, so a dark body on a backlit
  // wall passes on exactly the same terms a bright key does.
  F.teleport('basement');
  F.stepWith(0.4, {}, false);
  g.skull.holdNow();
  const stall = g.cellTwo;
  if (stall) {
    const faceStall = (x, z) => () => {
      seat(x, z, g.world.groundHeightAt(x, z, -3) + 0.02);
      lookAt(stall.barMid.x, stall.barMid.y, stall.barMid.z);
      F.stepWith(0.3, {}, false);
    };
    read('the second stall, from the crawl doorway', stall.occupant, faceStall(-4.6, -3.0));
    snap('crawl-cell-two-doorway');
    read('the second stall, at the bars', stall.occupant, faceStall(-7.6, -8.77));
    snap('crawl-cell-two-at-the-bars');
  }

  F.teleport('graveyard');
  F.stepWith(0.3, {}, false);
  g.skull.holdNow();

  // ---- 1. the graveyard's key tree ---------------------------------------
  // The funeral's third beat drops the limb across the lane. Everything below
  // is the walk a player makes toward it afterwards.
  const climb = g.keyTreeClimb;
  // The real beat, not a flag: _completeGraveyard is what opens the three
  // routes, and the limb is the third of them, four seconds in. It also unlocks
  // the ossuary, which the last case needs.
  g.director._completeGraveyard('loud');
  F.stepWith(6.0, {}, false);                 // drop at +4.0s, then it sags out of the leaves
  const branch = () => climb.branchTarget.pos.clone();

  const faceLimb = (x, z) => () => {
    const b = branch();
    seat(x, z, g.world.groundHeightAt(x, z, 3) + 0.02);
    lookAt(b.x, b.y, b.z);
    F.stepWith(0.05, {}, false);
  };
  // ---- THE ANNOUNCE ------------------------------------------------------
  // Pixels are only half of legibility, and for this object they are the half
  // that was never the problem: the limb reads fine when you look at it, and
  // the measurement that mattered was that you never do. It drops 30.4 m away
  // and 53.9 degrees off-centre — outside a 48.8-degree half-frame — so what
  // has to carry is sound and motion. Both are pinned here.
  const calls = [];
  const realCreak = g.audio.creak.bind(g.audio);
  g.audio.creak = (opts = {}) => { calls.push({ ref: opts.ref ?? 2.4, roll: opts.roll ?? 1.5, pos: opts.pos ? [opts.pos.x, opts.pos.z] : null }); return realCreak(opts); };
  // Measure the motion where a player sees it: METRES travelled by the far end
  // of the limb. (The first cut sampled the arm quaternion's w, which for a
  // 0.14-radian swing moves by 0.0014 and says nothing a human could see.)
  const swings = [];
  for (let i = 0; i < 60; i++) { F.stepWith(0.5, {}, false); swings.push(branch().clone()); }
  g.audio.creak = realCreak;
  let swingRange = 0;
  for (const a of swings) for (const b of swings) swingRange = Math.max(swingRange, a.distanceTo(b));
  // What actually matters is not the reference distance, it is how much of the
  // sound survives the thirty metres between the limb and where the player is
  // standing when it falls. gain = (max(d, ref)/ref)^-roll is the panner's own
  // exponential model; at the kit's default 2.4/1.5 this comes out at 0.023,
  // which is why the crash written to be LOUD was never heard.
  const carry = (d, ref, roll) => Math.pow(Math.max(d, ref) / ref, -roll);
  const announce = {
    calls: calls.length,
    ref: calls[0]?.ref ?? null,
    roll: calls[0]?.roll ?? null,
    carry30: calls.length ? +carry(30, calls[0].ref, calls[0].roll).toFixed(3) : 0,
    nearFalloff: calls.length
      ? +(carry(3, calls[0].ref, calls[0].roll) / carry(15, calls[0].ref, calls[0].roll)).toFixed(2)
      : 1,
    atTheLimb: calls.every((c) => c.pos && Math.hypot(c.pos[0] - branch().x, c.pos[1] - branch().z) < 6),
    swingRange: +swingRange.toFixed(4),
  };

  read('the key-tree limb, from the top of the lane', climb.arm, faceLimb(2.0, 26.0));
  snap('limb-top-of-lane');
  read('the key-tree limb, at throwing distance', climb.arm, faceLimb(7.0, 17.0));
  snap('limb-throwing-distance');

  // ...and the payload, after one throw takes the limb down.
  climb.tear(branch());
  F.stepWith(4.0, {}, false);
  const key = g.gateKeys.list[2].key;
  read('the key in the grass, from four metres', key, () => {
    const p = key.position;
    const x = p.x - 2.9, z = p.z - 2.9;
    seat(x, z, g.world.groundHeightAt(x, z, 3) + 0.02);
    lookAt(p.x, p.y, p.z);
    F.stepWith(0.05, {}, false);
  });
  snap('key-in-the-grass');

  // ---- 2. the ossuary conduit --------------------------------------------
  // Round nine's wire: 1.64% of frame at 6.2x, and it is the reason this file
  // exists — it was laid with world.box, which merges into the world SHELL,
  // and the district seal hides every scene child that is not routeRoot. It
  // was drawn NOWHERE, and passed every test it had.
  const OX = -70, OZ = -10, FLOOR = -4.2;
  seat(-14.6, 34.2 - 1.35, 0.04);
  g.ossuary.descend();
  F.stepWith(1 / 60, {}, false);
  const conduit = g.ossuaryConduit;
  read('the ossuary conduit, from the walk-up', conduit, () => {
    seat(OX + 0.9, OZ + 15.4, FLOOR);
    lookAt(OX - 0.55, FLOOR + 0.05, OZ + 18.4);
    F.stepWith(0.1, {}, false);
  });
  snap('ossuary-conduit');

  return { measured, shots, announce, conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root };
});

await browser.close();
server.stop();

const failures = [];
console.log('legibility, measured (pctChanged = share of frame, ratio = brightness against what it hides):\n');
for (const row of result.measured) {
  const floor = FLOORS[row.label];
  const ok = floor && row.pctChanged >= floor[0] && row.contrast >= floor[1];
  if (!ok) failures.push(`${row.label}: ${row.pctChanged}% at ${row.contrast}x contrast (floor ${floor ? `${floor[0]}% / ${floor[1]}x` : 'MISSING'})`);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${row.label.padEnd(46)} ${String(row.pctChanged).padStart(6)}% of frame  ${String(row.contrast).padStart(6)}x contrast`
    + `   (ratio ${row.ratio}x, floor ${floor ? `${floor[0]}% / ${floor[1]}x` : 'MISSING'})`);
}
if (!result.conduitInRouteRoot) failures.push('the ossuary conduit is not inside routeRoot (the seal will hide it)');
console.log(`\n  ${result.conduitInRouteRoot ? 'PASS' : 'FAIL'}  the ossuary conduit lives inside routeRoot, where the seal cannot hide it`);

// THE ANNOUNCE. Pixels are only half of legibility, and for the key tree they
// are the half that was never wrong: the limb reads fine when you look at it.
// It drops 30.4 m away and 53.9 degrees off-centre — outside a 48.8-degree
// half-frame — so what has to carry the reveal is sound and motion.
const a = result.announce;
const announceChecks = [
  ['the limb keeps calling while it hangs unhit (3+ times in 30 s)', a.calls >= 3],
  ['it calls FROM the limb, so HRTF can point a head at it', a.atTheLimb],
  ['it carries: a quarter of it survives the 30 m to where the player stands', a.carry30 >= 0.25],
  ['and it still fades in the near field, so walking toward it reads as approach', a.nearFalloff >= 1.4],
  ['and it MOVES when it speaks: the far end travels 15 cm+', a.swingRange >= 0.15],
];
console.log('');
for (const [name, ok] of announceChecks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
}
console.log(`        measured: ${a.calls} calls, ref ${a.ref} m / roll ${a.roll}, ${a.carry30} of source gain left at 30 m, ${a.nearFalloff}x louder at 3 m than 15 m, far end travels ${a.swingRange} m`);

for (const [name, data] of Object.entries(result.shots || {})) {
  writeFileSync(shotPath(`legibility-${name}`), Buffer.from(String(data).split(',')[1], 'base64'));
}
writeFileSync(resultsPath('legibility-regression.json'),
  JSON.stringify({ measured: result.measured, floors: FLOORS, failures }, null, 2));

if (errors.length) {
  console.log('\npage errors:\n  ' + errors.slice(0, 6).join('\n  '));
  failures.push(`${errors.length} page errors`);
}
if (failures.length) {
  console.log(`\nFAIL — ${failures.length} legibility regression(s):`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('\nAll legibility regressions passed.');
