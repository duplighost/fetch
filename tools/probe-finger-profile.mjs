// probe-finger-profile.mjs -- WHY THE FINGERS READ AS BEADS ON A STRING.
//
// Open scratch-hands/z-01-hands.png and every finger is capsule, ball, capsule,
// ball, capsule -- a wooden artist's mannequin, not a hand. A real finger is
// ONE continuous tube whose width barely changes at the joints. Two things
// have to be true for that and neither is checked anywhere:
//
//   1. the segments must OVERLAP, so no waist appears between them;
//   2. the knuckle must not be WIDER than the finger, or it reads as a bead.
//
// So walk each finger along its own axis and print the silhouette half-width
// at every millimetre: the waists and the beads show up as dips and spikes in
// one column of numbers. Also settles which way the finger faces, because the
// nail and the pad disagree in the source (nail at +y, pad at -y) and only one
// of them can be on the back of the hand.
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
    hold.updateWorldMatrix(true, true);

    // ---- 1. profile: sample every flesh vertex of one finger in k1 space ----
    // k1 is the finger's own frame: +z along the finger, +y the curl side.
    const profileOf = (f) => {
      f.k1.updateWorldMatrix(true, true);
      const inv = f.k1.matrixWorld.clone().invert();
      const bins = new Map();
      f.k1.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry?.getAttribute('position')) return;
        const pos = o.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          V.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          // straighten the distal curl out of the way: bin on arc length along
          // the finger, which for the first two links is just z
          const b = Math.round(V.z * 1000);
          const r = Math.hypot(V.x, V.y);
          if (!bins.has(b) || bins.get(b) < r) bins.set(b, r);
        }
      });
      return [...bins.entries()].sort((a, b) => a[0] - b[0]);
    };

    // ---- 2. which side is the camera on? ----
    const cam = new g.player.pos.constructor();
    g.camera.getWorldPosition(cam);
    const facing = (f) => {
      const dist = (o) => { const p = new g.player.pos.constructor(); o.getWorldPosition(p); return p.distanceTo(cam); };
      // the distal group's children: [seg, pad, nail] in build order
      const d = f.k2.children.find((c) => c.isGroup);
      if (!d) return null;
      const meshes = d.children.filter((c) => c.isMesh);
      const seg = meshes[0], pad = meshes[1], nail = meshes[2];
      // curl direction: rotate k1 a touch and see which way the tip moves
      const tipBefore = new g.player.pos.constructor();
      seg.getWorldPosition(tipBefore);
      const keep = f.k1.rotation.x;
      f.k1.rotation.x -= 0.3;
      f.k1.updateWorldMatrix(true, true);
      const tipAfter = new g.player.pos.constructor();
      seg.getWorldPosition(tipAfter);
      f.k1.rotation.x = keep;
      f.k1.updateWorldMatrix(true, true);
      return {
        segToCam: +dist(seg).toFixed(4),
        padToCam: +dist(pad).toFixed(4),
        nailToCam: +dist(nail).toFixed(4),
        nailFacesCamera: dist(nail) < dist(seg),
        padFacesCamera: dist(pad) < dist(seg),
        curlTowardCamera: tipAfter.distanceTo(cam) < tipBefore.distanceTo(cam),
      };
    };

    const fs = g.skull._fingers;
    return {
      // index-side finger of the left hand, and the middle one
      profiles: [
        { name: 'L f0', rows: profileOf(fs[0]) },
        { name: 'L f2', rows: profileOf(fs[2]) },
      ],
      facing: { 'L f0': facing(fs[0]), 'L f2': facing(fs[2]) },
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
  console.log('\nfacing:', JSON.stringify(out.facing, null, 2));
  console.log(errors.length ? 'ERRORS: ' + errors.slice(0, 4).join(' | ') : '(clean)');
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
