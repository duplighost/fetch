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
  // THESE TWO ARE NOT MEASURED YET, and they say so on purpose. Every other
  // pair in this table is 0.5-0.6x a number this gate printed; these two come
  // from arithmetic, because the round that added them had no GPU to run on.
  // tools/probe-ravine-ball.mjs section 5 derives it: the ball is 25.3 m away
  // at the first pose and 8.3 m at the second, its 1.6 m corona is 41 px and
  // 124 px across at 1280x800 under a 71-degree vertical FOV, so the object is
  // about 0.14% and 1.26% of frame at full alpha — and even if only the inner
  // 60% of the gradient clears this file's |dL| > 4 gate, 0.05% and 0.45%.
  // The floors below sit 5x and 9x under THAT, i.e. they fire only if the ball
  // is drawn nowhere at all. FIRST RUN ON A MACHINE WITH A GPU: read the two
  // measured values off the console below and raise these to 0.6x the pct and
  // 0.7x the contrast, the same rule the rest of the table follows.
  'the ravine ball and its line, up the approach': [0.01, 1.10],
  'the ravine ball and its line, at the near lip': [0.05, 1.30],
};

// NOT YET MEASURED. Round thirteen laid the basement pilot's feed line and
// added the three reads below, but the agents who wrote them were forbidden to
// launch a browser, so nobody has seen a number for them yet. A floor somebody
// INVENTED is worse than no floor -- the ossuary wire is the cautionary tale,
// two cuts that measured 0.00% of the frame and would have shipped -- so these
// report their measurement and do not fail on it. The structural assertions on
// the feed line further down DO fail, because those are arithmetic.
//
// FIRST PERSON TO RUN THIS: copy each measured pair out of the console into
// FLOORS above, under the measurement with room to move, and delete it here.
// If the corridor read comes in below the ossuary conduit's own 0.35% / 1.6x,
// the escalation order in src/house.js is FEED_SECTION 0.09 -> 0.12, then
// feedMat's colour 0x8c6d31 -> 0xa9853d, then the cleat spacing 2.0 m -> 1.4 m.
// Never a light.
const UNMEASURED = new Set([
  'the pilot feed line, from the foot of the return flight',
  'the pilot feed at the furnace, from the boiler door',
  'the feed pulse crossing the storeroom',
]);

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

  // ---- 0. the basement pilot's feed line ---------------------------------
  // Screenshot 3, 2026-08-19: "can we make this bell at the bottom of the
  // stairs at the first basement look like its wired to the rest of the
  // puzzle." The wire is laid at build time and has to be readable BEFORE it
  // is ever used, so the first two poses are cold-pilot poses: the walk-up in
  // the corridor from where he was standing, and the far end landing on the
  // furnace crown seen from just inside the boiler door.
  //
  // IF THE FOUR FLOORS ABOVE SHIFT because of this basement visit, move this
  // block to the END of the evaluate. Never lower a floor to make it pass.
  F.teleport('basement');
  F.stepWith(0.25, {}, false);
  g.enemies.clear();          // a wandering dropcloth walker would pollute the diff
  g.skull.holdNow();
  const pilotFeed = g.basementPilotFeed;
  read('the pilot feed line, from the foot of the return flight', pilotFeed, () => {
    seat(4.30, 4.95, -3.0);
    lookAt(0.5, -0.86, 5.80);
    F.stepWith(0.05, {}, false);
  });
  snap('basement-feed-corridor');
  read('the pilot feed at the furnace, from the boiler door', pilotFeed, () => {
    seat(5.20, -3.00, -3.0);
    lookAt(11.05, -1.30, -1.90);
    F.stepWith(0.05, {}, false);
  });
  snap('basement-feed-furnace');
  // AND THE PULSE, which is the half of this the two frames above cannot
  // reach. From the bell only 4.77 m of the 28.06 m run is in frame, and the
  // wire's own lit lift is 1.22x against the 1.6x the ossuary conduit holds,
  // so the travelling sleeve and the knock ladder are what carry law 4. Caught
  // at t = 1.40 s, where it is coming down the storeroom's west leg.
  g.basementPilot.startFeedPulse();
  F.stepWith(1.35, {}, false);
  read('the feed pulse crossing the storeroom', g.basementPilotPulse, () => {
    seat(1.60, 0.60, -3.0);
    lookAt(-1.00, -0.88, -0.54);
    F.stepWith(0.05, {}, false);
  });
  snap('basement-feed-pulse');
  pilotFeed.geometry.computeBoundingBox();
  const feedMinY = pilotFeed.geometry.boundingBox.min.y;
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
  g.enemies.clear();          // same reason the feed-line block clears: a wandering walker pollutes a contrast read
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

  // ---- 1b. the ball over the mire ----------------------------------------
  // Alex, screenshot 11: "if we could get this hanging ball to be even more
  // visible above the sand trap in the forest, it would be great." Same kit as
  // the limb, same two questions: can it be READ from where you decide to
  // throw, and does it ANNOUNCE itself to a player who has not looked yet.
  //
  // This has to run BEFORE the ossuary block, not after: descend() seals every
  // scene child that is not routeRoot, and that is not cheaply reversible from
  // in here. It teleports back to the graveyard on the way out.
  F.teleport('forest');
  F.stepWith(0.3, {}, false);              // one forest.update reveals the detail roots
  const f = g.forest;
  const RAVINE_S = f.ravineS();
  const ballAt = () => f.ravineKnot.getWorldPosition(f.ravineKnotAt.clone());
  const REST = f.ravineKnotAt.clone();     // where the ball hangs with no swing on it
  // The halo is a world-space sprite in the shared corona group, NOT a child of
  // the hang. Toggling the hang alone would leave the glow burning in both
  // frames and under-report the read. Toggle the whole announced object.
  const ballToggle = {
    get visible() { return f.ravineHang.visible; },
    set visible(v) { f.ravineHang.visible = v; if (f._ravineHalo) f._ravineHalo.visible = v; },
  };
  // Poses stand at s = RAVINE_S - 5, not - 3.6: the mire's suction starts at
  // 3.08 and drowns you at depth 1.48, and 0.52 m of margin under a 30 s
  // stationary window is not margin. `entered` stays TRUE — forcing it false
  // here re-fires the whole gate-slam beat (outside.js: hard seal placement 6 m
  // behind you, brushCrash, stoneGrind, a 5 s look-window) once per pose.
  const faceBall = (s) => () => {
    const p = f.posAt(s);
    f._lastIdx = Math.round(s);
    f.entered = true; f._idleT = 0;        // already inside; do not re-fire the gate-slam
    seat(p.x, p.z, f.heightAt(p.x, p.z) + 0.02);
    const b = ballAt();
    lookAt(b.x, b.y, b.z);
    F.stepWith(0.05, {}, false);
  };
  read('the ravine ball and its line, up the approach', ballToggle, faceBall(RAVINE_S - 22));
  snap('ravine-ball-approach');
  read('the ravine ball and its line, at the near lip', ballToggle, faceBall(RAVINE_S - 5));
  snap('ravine-ball-near-lip');

  // ---- THE BALL'S ANNOUNCE -----------------------------------------------
  // Three things this needs that the limb's block above does not.
  //
  //  1. IT FILTERS BY POSITION. The graveyard is silent apart from the limb, so
  //     that block can assert calls.every(atTheLimb). The forest is not: the
  //     seal frontier and the fork closures both creak while a player stands
  //     still. A 2 m sphere around the ball's rest point contains neither.
  //  2. IT SAMPLES AT 0.1 s, NOT 0.5 s. The struck arc lives 1/0.34 = 2.94 s
  //     and the pendulum's period is 2.61 s, so at half-second steps the
  //     sampled extremes depend on which phase the window happens to open in —
  //     swept over 400 starting phases in tools/probe-ravine-ball.mjs the beat
  //     can read as little as 2.4 cm wider than the idle sway that way. At
  //     0.1 s it is 17-47 cm wider at every one of those phases.
  //  3. IT REUSES THE SPENT-CROSSING WINDOW as a free at-rest baseline, so the
  //     "it moves MORE when it speaks" row has something to be more than.
  const spy = (sink) => (opts = {}) => {
    sink.push({
      ref: opts.ref ?? 2.4, roll: opts.roll ?? 1.5,
      pos: opts.pos ? [opts.pos.x, opts.pos.y, opts.pos.z] : null,
    });
    return realCreak(opts);
  };
  const near = (c, r) => !!c.pos
    && Math.hypot(c.pos[0] - REST.x, c.pos[1] - REST.y, c.pos[2] - REST.z) < r;
  const mine = (list) => list.filter((c) => near(c, 2.0));
  const spread = (list) => {
    let r = 0;
    for (const p of list) for (const q2 of list) r = Math.max(r, p.distanceTo(q2));
    return r;
  };
  const sampleFor = (steps, sink) => {
    for (let i = 0; i < steps; i++) { F.stepWith(0.1, {}, false); sink.push(ballAt()); }
  };

  faceBall(RAVINE_S - 5)();
  const ballCalls = [];
  g.audio.creak = spy(ballCalls);
  const beatPos = [];
  sampleFor(300, beatPos);                 // 30 s, the same window the limb gets
  // ...and it goes quiet once the invitation is spent. `ropeLatched` is the
  // WRONG flag to test that with: it is set the instant the skull catches, and
  // nothing ever clears it, so a player who latched, swung short, drowned in
  // the mire and respawned at the near bank would find the ball permanently
  // silent — the one player who most needs it. The terminal signal is the fetch
  // target, which the director spends only on the firm far bank and never
  // re-enables.
  g.ravineRopeTarget.enabled = false;
  const afterCalls = [];
  g.audio.creak = spy(afterCalls);
  F.stepWith(3.5, {}, false);              // let the last struck arc die all the way out
  const restPos = [];
  sampleFor(300, restPos);
  g.audio.creak = realCreak;

  const beatCalls = mine(ballCalls);
  const carryOf = (d, ref, roll) => Math.pow(Math.max(d, ref) / ref, -roll);
  const ballAnnounce = {
    calls: beatCalls.length,
    ref: beatCalls[0]?.ref ?? null,
    roll: beatCalls[0]?.roll ?? null,
    carry30: beatCalls.length ? +carryOf(30, beatCalls[0].ref, beatCalls[0].roll).toFixed(3) : 0,
    nearFalloff: beatCalls.length
      ? +(carryOf(3, beatCalls[0].ref, beatCalls[0].roll) / carryOf(15, beatCalls[0].ref, beatCalls[0].roll)).toFixed(2)
      : 1,
    // 0.6 m, and the number is load-bearing. The ball's own arc never carries it
    // more than 0.39 m from rest, while the ground-level position this creak
    // used to play from (the rope group's origin: y = 0 and 0.9 m to the side)
    // is 1.54 m away. This row is what fails if that regresses.
    atTheBall: beatCalls.length > 0 && beatCalls.every((c) => near(c, 0.6)),
    swingRange: +spread(beatPos).toFixed(4),
    restRange: +spread(restPos).toFixed(4),
    afterCrossing: mine(afterCalls).length,
  };
  F.teleport('graveyard');                 // the ossuary block starts where it expects to
  F.stepWith(0.3, {}, false);

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

  return {
    measured, shots, announce, ballAnnounce,
    conduitInRouteRoot: !!conduit && conduit.parent === g.ossuary.root,
    feedMinY,
    feedIsInterior: g.houseInteriorRoots.includes(pilotFeed),
  };
});

await browser.close();
server.stop();

const failures = [];
console.log('legibility, measured (pctChanged = share of frame, ratio = brightness against what it hides):\n');
for (const row of result.measured) {
  const floor = FLOORS[row.label];
  if (!floor && UNMEASURED.has(row.label)) {
    console.log(`  ----  ${row.label.padEnd(46)} ${String(row.pctChanged).padStart(6)}% of frame  ${String(row.contrast).padStart(6)}x contrast`
      + `   (ratio ${row.ratio}x, NO FLOOR YET -- write this pair into FLOORS)`);
    continue;
  }
  const ok = floor && row.pctChanged >= floor[0] && row.contrast >= floor[1];
  if (!ok) failures.push(`${row.label}: ${row.pctChanged}% at ${row.contrast}x contrast (floor ${floor ? `${floor[0]}% / ${floor[1]}x` : 'MISSING'})`);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${row.label.padEnd(46)} ${String(row.pctChanged).padStart(6)}% of frame  ${String(row.contrast).padStart(6)}x contrast`
    + `   (ratio ${row.ratio}x, floor ${floor ? `${floor[0]}% / ${floor[1]}x` : 'MISSING'})`);
}
if (!result.conduitInRouteRoot) failures.push('the ossuary conduit is not inside routeRoot (the seal will hide it)');
console.log(`\n  ${result.conduitInRouteRoot ? 'PASS' : 'FAIL'}  the ossuary conduit lives inside routeRoot, where the seal cannot hide it`);
// The basement's version of the same question. buildPumpGallery zeroes the
// world layer of every mesh whose bounds sit ENTIRELY above B + 2.42 = -0.58
// while the player is deep in the western works, so a feed line that never
// reaches below that line is a wire the culler is free to blank one day.
if (!(result.feedMinY <= -0.58)) {
  failures.push(`the basement feed line's lowest point is ${result.feedMinY} — above the upper-sector cut at -0.58, so buildPumpGallery's culler will blank it`);
}
console.log(`  ${result.feedMinY <= -0.58 ? 'PASS' : 'FAIL'}  the basement feed line reaches below the upper-sector cut (min.y ${result.feedMinY}), where the culler cannot file it`);
if (!result.feedIsInterior) failures.push('the basement feed line is not a house interior root (it will still be drawn from the graveyard)');
console.log(`  ${result.feedIsInterior ? 'PASS' : 'FAIL'}  the basement feed line is a house interior root, so the graveyard retires it`);

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

// THE BALL OVER THE MIRE. His screenshot 11. The pixels were never the whole
// problem here either: it hangs 0.75 m past the far lip of a mire that kills
// you, so the read has to happen from the near bank, BEFORE the decision, and
// what reaches a player who has not looked yet is sound and motion.
//
// The last two rows are the ones the limb does not carry. The limb's
// `swingRange >= 0.15` can be satisfied by idle sway alone; a ball that hangs
// in a forest sways whether or not anything is asking you to throw at it, so
// the coupling has to be measured as a DIFFERENCE. The floors come from
// tools/probe-ravine-ball.mjs, which replays the ticker's own arithmetic over
// 400 starting phases: the beat travels 0.431-0.732 m and the idle sway
// 0.257-0.267 m, a difference of 0.171-0.469 m, floored here at 0.10 on this
// file's usual ~0.6x-the-worst-case rule.
const b = result.ballAnnounce || {};
const ballChecks = [
  ['the ball keeps calling while the crossing is unmade (3+ times in 30 s)', b.calls >= 3],
  ['it calls FROM the ball, not from the ground under it, so HRTF can point a head at it', !!b.atTheBall],
  ['it carries: a quarter of it survives 30 m of lane', b.carry30 >= 0.25],
  ['and it still fades in the near field, so walking toward it reads as approach', b.nearFalloff >= 1.4],
  ['and it MOVES: the ball travels 15 cm+', b.swingRange >= 0.15],
  ['and it moves MORE when it speaks: 10 cm+ wider on a beat than at rest', (b.swingRange - b.restRange) >= 0.10],
  ['and it goes quiet once the crossing has been made', b.afterCrossing === 0],
];
console.log('');
for (const [name, ok] of ballChecks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
}
console.log(`        measured: ${b.calls} calls, ref ${b.ref} m / roll ${b.roll}, ${b.carry30} of source gain left at 30 m, ${b.nearFalloff}x louder at 3 m than 15 m, ball travels ${b.swingRange} m on a beat and ${b.restRange} m at rest, ${b.afterCrossing} calls after the crossing`);

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
