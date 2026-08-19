// probe-key-tree-legibility.mjs -- he never SAW the key come down.
//
// The mechanism is fine and has been proved fine (tools/probe-key-tree.mjs:
// branch drops, throw tears it, key falls, fetch works). This asks the only
// question left, which is the one this project keeps failing:
// CAN IT BE SEEN, AND FROM WHERE?
//
// Three measurements, none of them an opinion:
//  1. THE VIEW CONE at the moment the branch comes down. The funeral parks the
//     player at the checkpoint it just set; if the tree is 130 degrees behind
//     them, the whole authored sentence -- crash, creak, creak -- plays to an
//     empty room and only the audio can carry it.
//  2. THE FRAME SHARE of the branch from the poses a player actually holds:
//     the checkpoint, the walk down the lane, the throwing spot. Toggle the
//     limb off, re-render the SAME pose, count the pixels that changed and the
//     luminance ratio across them (the round-nine wire method).
//  3. THE KEY IN THE GRASS after the tear, the same way -- the payload has its
//     own legibility problem and its own answer (it lands lit).
//
//   node tools/probe-key-tree-legibility.mjs
import { ensureServer, launchBrowser, openPage, URL_BASE, shotPath, resultsPath } from '../tests/lib/harness.mjs';
import { writeFileSync } from 'node:fs';

const server = await ensureServer();
const browser = await launchBrowser();
const { page, errors } = await openPage(browser, `${URL_BASE}/?test=1&mute=1`);
await page.waitForFunction(() => window.__FETCH?.ready === true, null, { timeout: 120000, polling: 100 });

const shots = {};
const report = await page.evaluate(async () => {
  const F = window.__FETCH, g = window.__game;
  const out = { poses: [], shots: {} };
  const snap = (name) => { for (let i = 0; i < 2; i++) g.render(); out.shots[name] = g.renderer.domElement.toDataURL('image/png'); };

  F.start();
  F.teleport('graveyard');
  F.stepWith(0.3, {}, false);
  g.skull.holdNow();
  F.stepWith(0.2, {}, false);

  const climb = g.keyTreeClimb;
  const branchAt = () => climb.branchTarget.pos.clone();

  // ---- 1. the view cone at the drop -------------------------------------
  // Stand where the funeral leaves you and face where it leaves you facing.
  const cp = g.checkpointPose;
  const seat = (x, z, yaw, pitch = 0) => {
    g.player.pos.set(x, g.world.groundHeightAt(x, z, 3) + 0.02, z);
    g.player.yaw = yaw; g.player.pitch = pitch;
    g.player._sync(0);
    F.stepWith(0.05, {}, false);
  };
  seat(-14.6, 31.2, 0, 0);
  // The yaw arithmetic by hand: no clones, no THREE import in the page.
  const coneAngle = (tx, tz) => {
    const fx = -Math.sin(g.player.yaw), fz = -Math.cos(g.player.yaw);
    const dx = tx - g.player.pos.x, dz = tz - g.player.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const dot = (fx * dx + fz * dz) / d;
    return { deg: +(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI).toFixed(1), dist: +d.toFixed(1) };
  };

  // fire the funeral's third beat exactly as the director does
  g.flag('graveyardResolved');
  F.stepWith(0.2, {}, false);
  const b = branchAt();
  out.atDrop = {
    dropped: climb.dropped,
    checkpoint: cp ? { x: +cp.x.toFixed(1), z: +cp.z.toFixed(1), yaw: +cp.yaw.toFixed(2) } : null,
    player: { x: +g.player.pos.x.toFixed(1), z: +g.player.pos.z.toFixed(1), yaw: +g.player.yaw.toFixed(2) },
    branch: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1) },
    cone: coneAngle(b.x, b.z),
    halfFovDeg: +( (g.camera.fov / 2) * (1 + g.camera.aspect) / 2 ).toFixed(1),   // rough horizontal half-angle
  };
  snap('00-where-you-are-standing-when-it-falls');

  // ---- 2. frame share of the limb from real poses ------------------------
  // RENDER UNTIL THE FRAME STOPS MOVING BEFORE YOU READ IT. render() decays the
  // impact light and the FOV kick every call and applies a RANDOM rotational
  // flinch while _shake is alive, so two renders of the same pose are two
  // different images — which shows up as a huge pctChanged at a ratio of ~1.0,
  // i.e. as noise wearing the shape of a signal. The first cut of this probe
  // reported the key at "4.45% of frame" that way.
  const grab = () => {
    const c = g.renderer.domElement;
    const cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height;
    const cx = cv.getContext('2d');
    cx.drawImage(c, 0, 0);
    return cx.getImageData(0, 0, cv.width, cv.height).data;
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
  const litFrac = (target, poseFn) => {
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
    // CONTRAST, NOT BRIGHTNESS. A silhouette is as legible as a lamp: what the
    // eye needs is a difference, in either direction. Reporting only on/off
    // called a limb that reads as a black diagonal against the sky (0.21x) less
    // visible than a key that reads as nothing at all (1.02x).
    return {
      pctChanged: +(100 * changed / (on.length / 4)).toFixed(2),
      ratio: +ratio.toFixed(2),
      contrast: +Math.max(ratio, 1 / Math.max(ratio, 1e-6)).toFixed(2),
    };
  };

  const yawTo = (tx, tz) => Math.atan2(-(tx - g.player.pos.x), -(tz - g.player.pos.z));

  // let it finish sagging into the open before anyone looks at it
  F.stepWith(3.0, {}, false);

  const poses = [
    ['checkpoint, turned to face it', -14.6, 31.2],
    ['top of the lane', 2.0, 26.0],
    ['halfway down the lane', 5.5, 20.0],
    ['throwing distance', 7.0, 17.0],
  ];
  for (const [label, x, z] of poses) {
    const measured = litFrac(climb.arm, () => {
      const bb = branchAt();
      g.player.pos.set(x, g.world.groundHeightAt(x, z, 3) + 0.02, z);
      g.player.yaw = yawTo(bb.x, bb.z);
      g.player.pitch = Math.atan2(bb.y - (g.player.pos.y + 1.62), Math.hypot(bb.x - x, bb.z - z));
      g.player._sync(0);
      F.stepWith(0.05, {}, false);
    });
    out.poses.push({ label, x, z, ...measured, cone: coneAngle(branchAt().x, branchAt().z) });
    snap(`limb-${label.replace(/[^a-z]+/gi, '-')}`);
  }

  // ---- 3. the key in the grass -------------------------------------------
  const key3 = g.gateKeys.list[2];
  climb.tear(branchAt());
  F.stepWith(4.0, {}, false);
  const keyMesh = key3.key;
  const keyPose = () => {
    const p = keyMesh.position;
    const x = p.x - 3.4, z = p.z - 3.4;
    g.player.pos.set(x, g.world.groundHeightAt(x, z, 3) + 0.02, z);
    g.player.yaw = Math.atan2(-(p.x - x), -(p.z - z));
    g.player.pitch = Math.atan2(p.y - (g.player.pos.y + 1.62), Math.hypot(p.x - x, p.z - z));
    g.player._sync(0);
    F.stepWith(0.05, {}, false);
  };
  out.key = { at: keyMesh.position.toArray().map((v) => +v.toFixed(2)), ...litFrac(keyMesh, keyPose) };
  snap('key-in-the-grass');
  out.bones = { ...litFrac(climb.bones, keyPose) };
  out.shards = { ...litFrac(climb.shards, keyPose) };
  return out;
});

await browser.close();
server.stop();

console.log('AT THE DROP:');
console.log(JSON.stringify(report.atDrop, null, 2));
console.log('\nTHE LIMB, per pose (pctChanged = share of frame, ratio = luminance against what it hides):');
for (const p of report.poses) {
  console.log(`  ${p.label.padEnd(30)} ${String(p.pctChanged).padStart(6)}%  ratio ${String(p.ratio).padStart(5)}x  contrast ${String(p.contrast).padStart(5)}x   ${p.cone.dist}m`);
}
console.log(`\nTHE KEY IN THE GRASS: ${report.key.pctChanged}% ${report.key.ratio}x  at ${report.key.at}`);
console.log(`THE BONES:            ${report.bones.pctChanged}% ratio ${report.bones.ratio}x contrast ${report.bones.contrast}x`);
console.log(`THE SHARDS:           ${report.shards.pctChanged}% ratio ${report.shards.ratio}x contrast ${report.shards.contrast}x`);
if (errors.length) console.log('\nerrors: ' + errors.slice(0, 5).join(' | '));

for (const [name, data] of Object.entries(report.shots || {})) {
  const path = shotPath(`keytree-${name}`);
  writeFileSync(path, Buffer.from(String(data).split(',')[1], 'base64'));
  console.log(`  shot ${path}`);
}
writeFileSync(resultsPath('key-tree-legibility.json'), JSON.stringify({ ...report, shots: undefined }, null, 2));
