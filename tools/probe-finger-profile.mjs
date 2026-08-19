// probe-finger-profile.mjs -- the silhouette half-width along a finger, as a
// column of numbers.
//
// Round eight used this to catch BEADS ON A STRING: capsule segments butted
// end to end with no overlap, so every joint printed as a waist, hidden only
// by a knuckle ball 33% wider than the shaft (a bead). Round nine replaced
// the assembly with one skinned surface per hand, and this probe is the
// regression watch on that idea: the column should now read as ONE smooth
// taper with millimetre swells at the joints -- any waist/bead alternation
// bigger than a millimetre means the tube construction regressed.
//
// The flesh is a SkinnedMesh, so vertices go through applyBoneTransform and
// are grouped to fingers by skinIndex (userData.fingerOfBone).
//
//   node tools/probe-finger-profile.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE } from '../tests/lib/harness.mjs';

const server = await ensureServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
  await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 90000, polling: 200 });

  const out = await page.evaluate(() => {
    const F = window.__FETCH, g = window.__game;
    F.start();
    F.stepWith(0.6, {}, false);
    g.skull.holdNow();
    F.stepWith(1.5, {}, false);
    const V = new g.player.pos.constructor();
    const hold = g.skull.hold;
    // straighten the fingers for the measurement: this probe answers a
    // CONSTRUCTION question (is the tube smooth?), and binning a curled
    // finger along a straight axis folds the far segments onto each other and
    // prints phantom beads. update() reasserts the curl on the next step.
    for (const f of g.skull._fingers) { f.k1.rotation.x = 0; f.k2.rotation.x = 0; }
    hold.updateWorldMatrix(true, true);

    // sample every skinned vertex of one finger in k1-local space and bin the
    // max radius per millimetre of arc along the finger axis
    const profileOf = (hand, f, localFi) => {
      let sm = null;
      hand.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
      if (!sm) return [];
      f.k1.updateWorldMatrix(true, true);
      const inv = f.k1.matrixWorld.clone().invert();
      const pos = sm.geometry.getAttribute('position');
      const sidx = sm.geometry.getAttribute('skinIndex');
      const map = sm.userData.fingerOfBone || [];
      const bins = new Map();
      for (let i = 0; i < pos.count; i++) {
        if (map[sidx.getX(i)] !== localFi) continue;
        V.fromBufferAttribute(pos, i);
        sm.applyBoneTransform(i, V);
        V.applyMatrix4(sm.matrixWorld).applyMatrix4(inv);
        const b = Math.round(V.z * 1000);
        const r = Math.hypot(V.x, V.y);
        if (!bins.has(b) || bins.get(b) < r) bins.set(b, r);
      }
      return [...bins.entries()].sort((a, b) => a[0] - b[0]);
    };

    const L = hold.children[0];
    const fs = g.skull._fingers;
    return {
      profiles: [
        { name: 'L f0', rows: profileOf(L, fs[0], 0) },
        { name: 'L f2', rows: profileOf(L, fs[2], 2) },
      ],
    };
  });

  for (const p of out.profiles) {
    console.log('\n' + p.name + '  half-width along the finger (mm at hold scale, 1 unit = 874 mm)');
    let prev = null;
    for (const [zmm, r] of p.rows) {
      const w = r * 874;
      const bar = '#'.repeat(Math.max(0, Math.round(w * 2)));
      const mark = prev !== null && w > prev + 0.35 ? '  <-- BEAD' : (prev !== null && w < prev - 0.35 ? '  <-- waist' : '');
      console.log(String((zmm / 1000 * 874).toFixed(1)).padStart(7) + ' mm  ' + w.toFixed(2).padStart(6) + '  ' + bar + mark);
      prev = w;
    }
  }
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
