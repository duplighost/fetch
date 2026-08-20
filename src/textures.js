// textures.js — every surface in FETCH, painted procedurally at load. No asset files.
//
// All maps go through util.canvasTexture, which sets NoColorSpace: canvas values
// are read as LINEAR albedo (no sRGB decode crushing the darks), so colors here
// are authored a notch brighter than their final lit read would suggest.
// The player is colorblind: readability comes from VALUE and pattern, never hue.
// Value hierarchy: headstone/bone pale > ceiling > walls > floors > metal.
import * as THREE from 'three';
import { canvasTexture, RNG, speckle, TAU } from './util.js';

// One master seed. RNG.fork(salt) is pure, so every painter gets its own
// deterministic stream regardless of creation order.
const ROOT = new RNG(0xfe7c11);

const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

/* ---------------- shared painter helpers ---------------- */

// Scale a finished canvas to a target mean value.
//
// This exists because of one measured fact about this game (see
// tools/probe-prop-surface.mjs). The light the player carries is a 58-candela
// point light with decay 1.6, which delivers irradiance ~131 at 0.6 m, 43 at
// 1.2 m, 19 at 2 m and 4.4 at 5 m. A surface clips to white as soon as
// albedo x irradiance passes 1.0 — so anything the player can stand next to
// has to sit below about 0.05 linear albedo or it blows out and every bit of
// painted detail in it is destroyed. That is why this whole texture kit is
// authored so dark, and it is why a prop given an honest mid-grey iron surface
// (0.174 measured) came back as white plastic no matter how many rivets it had.
//
// Painting bright and scaling at the end keeps the painters readable and puts
// the value decision in one documented place instead of thirty constants.
function toMeanValue(g, w, h, target) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722);
  const mean = sum / (d.length / 4) / 255;
  if (mean <= 0.001) return;
  const k = target / mean;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * k);
    d[i + 1] = Math.min(255, d[i + 1] * k);
    d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  g.putImageData(img, 0, 0);
}

// per-pixel value jitter — monochrome, so it can never introduce hue
function grain(g, w, h, amt, r) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r.float() - 0.5) * 255 * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// soft irregular blotches (damp, grime, bleach) — `col` is 'r,g,b'
function stains(g, w, h, n, r, col = '18,13,8', alpha = 0.16, minR = 0.05, maxR = 0.3) {
  for (let i = 0; i < n; i++) {
    const x = r.float() * w, y = r.float() * h;
    const rad = (minR + r.float() * (maxR - minR)) * w;
    const gr = g.createRadialGradient(x, y, rad * 0.15, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${alpha * (0.5 + r.float())})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }
}

// thin wandering fracture lines, with occasional short forks
function cracks(g, w, h, n, r, color = 'rgba(8,6,5,0.45)', width = 1, step = 11) {
  g.strokeStyle = color;
  g.lineWidth = width;
  for (let i = 0; i < n; i++) {
    let x = r.float() * w, y = r.float() * h, a = r.float() * TAU;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0, len = r.int(4, 9); s < len; s++) {
      a += (r.float() - 0.5) * 1.1;
      x += Math.cos(a) * step * (0.5 + r.float());
      y += Math.sin(a) * step * (0.5 + r.float());
      g.lineTo(x, y);
    }
    g.stroke();
    if (r.chance(0.4)) {
      g.beginPath(); g.moveTo(x, y);
      const fa = a + r.sign() * (0.7 + r.float());
      g.lineTo(x + Math.cos(fa) * step * 2, y + Math.sin(fa) * step * 2);
      g.stroke();
    }
  }
}

/* ---------------- surface painters ---------------- */

// horizontal planks; scuff=true adds pale wear streaks (floors, not furniture)
function planks(g, w, h, r, base, gapCol, rows, scuff) {
  const ph = h / rows;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * w * 0.37;
    for (let px = -1; px < 4; px++) {
      const x = ((px * w) / 3 + off) % (w + w / 3) - w / 6;
      const s = 0.72 + r.float() * 0.5;
      g.fillStyle = rgb(base[0] * s, base[1] * s, base[2] * s);
      g.fillRect(x, row * ph, w / 3 - 2, ph - 2);
      g.strokeStyle = `rgba(12,8,5,${0.14 + r.float() * 0.14})`;
      g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const gy = row * ph + r.float() * ph;
        g.beginPath();
        g.moveTo(x, gy);
        g.bezierCurveTo(x + w / 9, gy + r.gauss() * 4, x + w / 5, gy + r.gauss() * 4, x + w / 3, gy);
        g.stroke();
      }
      if (r.chance(0.18)) { // knot
        const kx = x + w / 6 + r.gauss() * w / 8;
        const ky = row * ph + ph * (0.3 + r.float() * 0.4);
        g.strokeStyle = 'rgba(10,7,4,0.5)';
        g.beginPath();
        g.ellipse(kx, ky, 3 + r.float() * 3, 2 + r.float() * 2, 0, 0, TAU);
        g.stroke();
      }
    }
  }
  g.fillStyle = gapCol;
  for (let row = 0; row <= rows; row++) g.fillRect(0, row * ph - 1, w, 2);
  if (scuff) {
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(168,152,124,${0.04 + r.float() * 0.08})`;
      g.lineWidth = 1 + r.float() * 2;
      const y = r.float() * h, x = r.float() * w, len = 20 + r.float() * 90;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + r.gauss() * 5); g.stroke();
    }
  }
}

// aged damask; rot=true tears it back to plaster and grows mold
function wallpaperPaint(g, w, h, r, rot) {
  const base = rot ? [54, 58, 50] : [60, 66, 56];
  g.fillStyle = rgb(base[0], base[1], base[2]);
  g.fillRect(0, 0, w, h);
  // the damask reads through VALUE: motifs a step lighter than the ground
  const cell = w / 4;
  g.fillStyle = 'rgba(118,126,104,0.30)';
  for (let iy = 0; iy < 4; iy++) for (let ix = 0; ix < 4; ix++) {
    const cx = (ix * cell + cell / 2 + (iy % 2) * cell / 2) % w;
    const cy = iy * cell + cell / 2;
    g.save(); g.translate(cx, cy);
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * TAU;
      g.beginPath();
      g.ellipse(Math.cos(a) * cell * 0.17, Math.sin(a) * cell * 0.17, cell * 0.12, cell * 0.045, a, 0, TAU);
      g.fill();
    }
    g.beginPath(); g.arc(0, 0, cell * 0.06, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, cell * 0.36, cell * 0.03, cell * 0.09, 0, 0, TAU); g.fill();
    g.restore();
  }
  // faint diagonal lattice tying the motifs together
  g.strokeStyle = 'rgba(30,32,26,0.35)';
  g.lineWidth = 1;
  for (let i = -4; i < 8; i++) {
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell + h, h); g.stroke();
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell - h, h); g.stroke();
  }
  // water damage running down from the picture rail
  for (let i = 0; i < (rot ? 7 : 4); i++) {
    const x = r.float() * w, len = h * (0.25 + r.float() * 0.6);
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, 'rgba(24,18,10,0.28)');
    gr.addColorStop(1, 'rgba(24,18,10,0)');
    g.fillStyle = gr;
    g.fillRect(x - 8 - r.float() * 14, 0, 16 + r.float() * 28, len);
  }
  stains(g, w, h, rot ? 10 : 6, r);
  // Peeling: ragged patches torn back to plaster.
  //
  // These used to be nine-sided polygons filled FLAT, two full value steps
  // above the paper — so a rotting wall came back wearing half a dozen pale
  // pentagons that read as cut paper stuck to it, the loudest "this is a
  // procedural texture" tell in the house. A tear is not a shape, it is an
  // EDGE: the plaster behind sits only a little lighter, it is grainy and
  // stained like plaster, and the paper curls away from it with a dark
  // undercut and a lit lip. Fewer, smaller, raggeder.
  for (let i = 0, n = rot ? 4 : 2; i < n; i++) {
    const px = r.float() * w, py = r.float() * h;
    const pr = w * (rot ? 0.055 + r.float() * 0.085 : 0.035 + r.float() * 0.045);
    const verts = [];
    for (let p = 0; p <= 17; p++) {
      const a = (p / 17) * TAU;
      // two scales of raggedness: a lobed outline with torn nicks in it
      const lobe = 0.72 + 0.34 * Math.sin(a * (2 + (i % 3)) + i);
      const rr = pr * lobe * (0.74 + r.float() * 0.5);
      verts.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr * 1.25]);
    }
    const trace = () => {
      g.beginPath();
      verts.forEach(([vx, vy], p) => (p === 0 ? g.moveTo(vx, vy) : g.lineTo(vx, vy)));
      g.closePath();
    };
    g.save();
    trace();
    g.fillStyle = rgb(74, 73, 67);
    g.fill();
    trace();
    g.clip();
    // the plaster behind is a surface, not a colour
    stains(g, w, h, 5, r, '30,27,22', 0.24, 0.02, 0.1);
    speckle(g, w, h, 260, ['#585448', '#464238', '#6a6659', '#3a372f'], r, 0.4, 1.6);
    cracks(g, w, h, 3, r, 'rgba(40,36,30,0.5)', 0.8, 7);
    g.restore();
    // the undercut: paper stands away from the wall and casts into the tear
    g.save();
    trace(); g.clip();
    g.strokeStyle = 'rgba(10,8,6,0.55)'; g.lineWidth = 5;
    trace(); g.stroke();
    g.restore();
    // and the torn lip catches light on the paper side
    g.strokeStyle = 'rgba(150,152,136,0.30)'; g.lineWidth = 1.1;
    trace(); g.stroke();
  }
  if (rot) {
    // mold blooms: a soft dark halo full of hard speckles
    for (let i = 0; i < 7; i++) {
      const mx = r.float() * w, my = r.float() * h, mr = 12 + r.float() * 34;
      const gr = g.createRadialGradient(mx, my, 2, mx, my, mr);
      gr.addColorStop(0, 'rgba(14,16,12,0.5)');
      gr.addColorStop(1, 'rgba(14,16,12,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(8,10,7,0.7)';
      for (let p = 0; p < 40; p++) {
        const a = r.float() * TAU, d = r.float() * r.float() * mr;
        g.fillRect(mx + Math.cos(a) * d, my + Math.sin(a) * d, 1 + r.float() * 1.6, 1 + r.float() * 1.6);
      }
    }
    cracks(g, w, h, 5, r);
  }
  grain(g, w, h, 0.06, r);
}

function plasterPaint(g, w, h, r) {
  g.fillStyle = rgb(80, 78, 72);
  g.fillRect(0, 0, w, h);
  // trowel sweeps: broad, barely-lighter arcs
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(150,146,134,${0.04 + r.float() * 0.05})`;
    g.lineWidth = 4 + r.float() * 10;
    const x = r.float() * w, y = r.float() * h, rad = 30 + r.float() * 90;
    const a0 = r.float() * TAU;
    g.beginPath(); g.arc(x, y, rad, a0, a0 + 1 + r.float() * 1.5); g.stroke();
  }
  stains(g, w, h, 6, r, '20,16,10', 0.14);
  cracks(g, w, h, 8, r);
  grain(g, w, h, 0.08, r);
}

function woodDarkPaint(g, w, h, r) {
  g.fillStyle = rgb(32, 26, 20);
  g.fillRect(0, 0, w, h);
  // tight vertical grain for doors / beams / furniture; strokes pin to the same
  // x at top and bottom so the map tiles vertically
  for (let i = 0; i < 40; i++) {
    const x = r.float() * w;
    g.strokeStyle = r.chance(0.75)
      ? `rgba(8,6,4,${0.2 + r.float() * 0.3})`
      : `rgba(110,92,66,${0.05 + r.float() * 0.07})`;
    g.lineWidth = 0.8 + r.float() * 1.4;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + r.gauss() * 6, h * 0.33, x + r.gauss() * 6, h * 0.66, x, h);
    g.stroke();
  }
  stains(g, w, h, 4, r, '8,6,5', 0.2);
  grain(g, w, h, 0.06, r);
}

// coursed blocks; shared by stone and brick (different base/rows/mortar).
//
// The old version laid a PERFECT four-column grid with a half-offset on every
// other row, which is the one thing real masonry never is — and at three tile
// repeats across a basement wall the eye read the repeat instantly and the
// whole room came back as wallpaper-of-bricks. Courses now walk their own
// jittered widths, blocks sit proud or sunk by their own amount, a few are
// missing outright, and a low-frequency field (whole cycles, so it still
// tiles) keeps any two square metres from matching.
function stonePaint(g, w, h, r, base, rows, mortar) {
  g.fillStyle = mortar;
  g.fillRect(0, 0, w, h);
  // recessed joints: darken the ground a little so the bump map reads mortar as
  // the low ground and every block face as raised. Gently — a hard mortar/block
  // contrast is exactly the tiled-grid read this is trying to get away from.
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.fillRect(0, 0, w, h);
  const bh = h / rows;
  const nominal = w / 4;
  for (let row = 0; row < rows; row++) {
    const y = row * bh;
    // start each course part-way through a block so the vertical joints never
    // line up between rows, and never at the same offset twice
    let x = -nominal * (0.15 + r.float() * 0.7);
    while (x < w) {
      const bw = nominal * (0.62 + r.float() * 0.8);
      const s = 0.74 + r.float() * 0.4;
      const inset = 1.5 + r.float() * 2;
      const bx = x + inset, by = y + inset;
      const bwi = bw - inset * 2, bhi = bh - inset * 2;
      if (bwi > 3 && bhi > 3) {
        // A wall loses a block once in a long while. At 1-in-20 it stopped
        // being masonry and became a checkerboard of holes — the shipped
        // basement read as black-and-white tiling. One in 150 is a wall with
        // something wrong with it; one in 20 is a pattern.
        if (r.chance(0.007)) {
          g.fillStyle = 'rgba(10,9,9,0.62)';
          g.fillRect(bx, by, bwi, bhi);
        } else {
          g.fillStyle = rgb(base[0] * s, base[1] * s, base[2] * s);
          g.fillRect(bx, by, bwi, bhi);
          // a lit top-left arris and a shadowed bottom edge: the block reads as
          // a solid with a thickness even before the bump map touches it
          g.fillStyle = `rgba(210,206,196,${0.025 + r.float() * 0.035})`;
          g.fillRect(bx, by, bwi, 1.6);
          g.fillRect(bx, by, 1.4, bhi);
          g.fillStyle = `rgba(8,7,7,${0.16 + r.float() * 0.14})`;
          g.fillRect(bx, by + bhi - 3, bwi, 3);
          g.fillRect(bx + bwi - 2, by, 2, bhi);
          // pitting and spall
          for (let p = 0, n = r.int(3, 8); p < n; p++) {
            g.fillStyle = `rgba(14,13,11,${0.12 + r.float() * 0.22})`;
            g.beginPath();
            g.arc(bx + r.float() * bwi, by + r.float() * bhi, 0.6 + r.float() * 2.4, 0, TAU);
            g.fill();
          }
          if (r.chance(0.22)) {   // a chipped corner
            g.fillStyle = 'rgba(12,11,10,0.4)';
            const cw = 3 + r.float() * 7;
            g.beginPath();
            g.moveTo(bx + bwi, by + bhi);
            g.lineTo(bx + bwi - cw, by + bhi);
            g.lineTo(bx + bwi, by + bhi - cw);
            g.closePath(); g.fill();
          }
        }
      }
      x += bw;
    }
  }
  // macro variation: two crossed low-frequency waves at whole cycles, so a big
  // wall has weather on it and still tiles seamlessly
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const f = 1 + 0.17 * Math.sin((px / w) * TAU) * Math.sin((py / h) * TAU + 1.1)
        + 0.11 * Math.sin((px / w) * TAU * 2 + 0.7) * Math.cos((py / h) * TAU * 2);
      const i = (py * w + px) * 4;
      d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
    }
  }
  g.putImageData(img, 0, 0);
  stains(g, w, h, 6, r, '12,11,10', 0.22, 0.05, 0.3);
  cracks(g, w, h, 5, r);
  grain(g, w, h, 0.09, r);
}

// Floors that are not wood. A floor is a wall that gets walked on: bigger
// courses, ground-in grime in every joint, and a good deal darker than the
// masonry standing on it — the up-facing hemisphere term already hands floors
// the sky's share of the light, and pale wall stone underfoot came back as the
// brightest plane in the cellar.
function flagstonePaint(g, w, h, r) {
  stonePaint(g, w, h, r, [58, 56, 52], 3, rgb(20, 19, 18));
  stains(g, w, h, 9, r, '10,9,8', 0.3, 0.08, 0.36);
  speckle(g, w, h, 320, ['#2a2724', '#3a3630', '#171514', '#454038'], r, 0.5, 2.4);
  // a walked line: two soft parallel scuffs polished paler than the rest
  for (let i = 0; i < 3; i++) {
    const x = w * (0.25 + r.float() * 0.5), lw = w * (0.06 + r.float() * 0.1);
    const gr = g.createLinearGradient(x - lw, 0, x + lw, 0);
    gr.addColorStop(0, 'rgba(126,120,108,0)');
    gr.addColorStop(0.5, `rgba(126,120,108,${0.05 + r.float() * 0.05})`);
    gr.addColorStop(1, 'rgba(126,120,108,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  grain(g, w, h, 0.07, r);
}

function dirtPaint(g, w, h, r) {
  g.fillStyle = rgb(58, 48, 38);
  g.fillRect(0, 0, w, h);
  stains(g, w, h, 8, r, '20,16,11', 0.2, 0.06, 0.35);
  stains(g, w, h, 4, r, '96,84,64', 0.1, 0.08, 0.3); // dry lighter patches
  speckle(g, w, h, 420, ['#6a6054', '#4c4236', '#2c261e', '#78705f'], r, 0.5, 2.2);
  // twig / root litter
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = `rgba(24,19,13,${0.3 + r.float() * 0.3})`;
    g.lineWidth = 1 + r.float();
    const x = r.float() * w, y = r.float() * h, a = r.float() * TAU, len = 6 + r.float() * 16;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  grain(g, w, h, 0.09, r);
}

// THE LARGEST SURFACE IN THE GRAVEYARD, and the one every pale object in the
// district is judged against.
//
// It was not too bright. Measured through tools/probe-albedo.mjs, the product
// the shader actually samples — map mean 0.198 times the grade's #3d4a3c —
// is 0.0124 linear, comfortably UNDER the ~0.03 anything-you-walk-up-to
// ceiling. Normalising the painter down, which is what a reading of the
// painter alone argues for, would have taken the yard's floor four times
// darker and answered "no mids, no focal" by deleting the last of the mids.
//
// What it was is GREEN: chroma 2.03, meaning the surface carried twice as much
// of its read in hue as in value, in the one channel the player cannot see.
// Every colour below is luminance-matched to what it replaced, so the value
// spread — which was always the right instinct — survives intact and only the
// billiard-felt goes. Grey-blond, dead, trodden: moss over clay.
function grassPaint(g, w, h, r) {
  g.fillStyle = rgb(51, 50, 47);
  g.fillRect(0, 0, w, h);
  stains(g, w, h, 6, r, '27,26,24', 0.22, 0.08, 0.3); // bare worn patches
  stains(g, w, h, 4, r, '82,81,78', 0.12, 0.06, 0.2);
  // blades: the wide value spread does the work, and now it is the only thing
  // doing it — a two-point channel spread is a whisper of life, not a cue
  for (let i = 0; i < 950; i++) {
    const v = 46 + r.float() * 52;
    g.strokeStyle = `rgba(${v | 0},${(v + 2) | 0},${(v - 3) | 0},${0.4 + r.float() * 0.4})`;
    g.lineWidth = 1;
    const x = r.float() * w, y = r.float() * h, len = 3 + r.float() * 6;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + r.gauss() * 2.5, y - len);
    g.stroke();
  }
  // dead pale tufts — the graveyard reads grey-blond, not green
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(122,119,110,${0.3 + r.float() * 0.3})`;
    const x = r.float() * w, y = r.float() * h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + r.gauss() * 3, y - 4 - r.float() * 6); g.stroke();
  }
  grain(g, w, h, 0.06, r);
}

function barkPaint(g, w, h, r) {
  g.fillStyle = rgb(48, 42, 34);
  g.fillRect(0, 0, w, h);
  const grooves = 16;
  for (let i = 0; i < grooves; i++) {
    const bx = (i + r.float() * 0.6) * (w / grooves);
    const k = r.int(1, 3); // whole sine cycles → top edge meets bottom edge (tiles)
    const ph = r.float() * TAU;
    const amp = 2 + r.float() * 5;
    // dark groove with a lit ridge hugging its side
    const passes = [
      [0, `rgba(10,8,6,${0.4 + r.float() * 0.25})`, 2 + r.float() * 3],
      [3.5, 'rgba(128,112,88,0.14)', 1.5],
    ];
    for (const [dx, col, lw] of passes) {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath();
      for (let y = 0; y <= h; y += 8) {
        const x = bx + dx + Math.sin((y / h) * TAU * k + ph) * amp;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // horizontal scarring
  for (let i = 0; i < 12; i++) {
    g.strokeStyle = `rgba(16,13,10,${0.25 + r.float() * 0.25})`;
    g.lineWidth = 1 + r.float();
    const y = r.float() * h, x = r.float() * w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + r.float() * 20, y + r.gauss() * 3); g.stroke();
  }
  grain(g, w, h, 0.09, r);
}

// plain threadbare weave — deliberately NO borders (tiled borders read as tape lines)
function carpetPaint(g, w, h, r) {
  g.fillStyle = rgb(48, 42, 40);
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) {
    g.fillStyle = y % 4 === 0 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.035)';
    g.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 3) {
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(x, 0, 1, h);
  }
  // threadbare: pale backing showing through
  stains(g, w, h, 4, r, '108,98,84', 0.16, 0.06, 0.2);
  // old spills: darker, harder-edged
  for (let i = 0; i < 4; i++) {
    const x = r.float() * w, y = r.float() * h, rad = 8 + r.float() * 26;
    const gr = g.createRadialGradient(x, y, rad * 0.55, x, y, rad);
    gr.addColorStop(0, 'rgba(14,10,8,0.4)');
    gr.addColorStop(1, 'rgba(14,10,8,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  grain(g, w, h, 0.07, r);
}

function ceilingPaint(g, w, h, r) {
  g.fillStyle = rgb(88, 86, 80);
  g.fillRect(0, 0, w, h);
  // water rings: nested wobbling tide-marks
  for (let i = 0; i < 4; i++) {
    const cx = r.float() * w, cy = r.float() * h;
    const rings = r.int(2, 4);
    let rad = 10 + r.float() * 22;
    for (let q = 0; q < rings; q++) {
      g.strokeStyle = `rgba(66,54,36,${0.16 + r.float() * 0.2})`;
      g.lineWidth = 1.5 + r.float() * 2;
      g.beginPath();
      const wob = 2 + r.float() * 4, kk = r.int(3, 6);
      for (let p = 0; p <= 40; p++) {
        const a = (p / 40) * TAU;
        const rr = rad + Math.sin(a * kk + i) * wob;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8;
        if (p === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.stroke();
      rad += 7 + r.float() * 14;
    }
    const gr = g.createRadialGradient(cx, cy, 4, cx, cy, rad);
    gr.addColorStop(0, 'rgba(84,68,44,0.10)');
    gr.addColorStop(1, 'rgba(84,68,44,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  cracks(g, w, h, 5, r, 'rgba(30,28,24,0.4)', 0.8);
  grain(g, w, h, 0.05, r);
}

function metalPaint(g, w, h, r) {
  g.fillStyle = rgb(38, 40, 43);
  g.fillRect(0, 0, w, h);
  stains(g, w, h, 7, r, '54,38,24', 0.22, 0.04, 0.2); // oxide blooms — warm but DARK
  speckle(g, w, h, 260, ['#1a1b1d', '#2a241e', '#4a4e52'], r, 0.5, 1.8); // pitting
  for (let i = 0; i < 20; i++) { // brushed scratches, barely lighter
    g.strokeStyle = `rgba(150,156,162,${0.04 + r.float() * 0.08})`;
    g.lineWidth = 0.8;
    const y = r.float() * h, x = r.float() * w, a = r.gauss() * 0.3;
    const len = 20 + r.float() * 80;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  grain(g, w, h, 0.07, r);
}

// Riveted machine iron — the boiler, the tanks, the incinerator shell.
//
// These were all wearing the generic `metal` map at repeat 1, which on a
// 3.3 m circumference tank stretches a 256 px texture until it is a smooth
// gradient: the boiler read as a pale plastic canister with a hole in it, and
// it is a puzzle object the player is asked to study. Machine iron has plate
// seams, rivets, soot climbing out of the firebox and rust standing in the
// bottom few inches, and every one of those is an edge for a moving light.
// Authored to tile ~3x around a tank, so the rivet courses read as courses.
function machineIronPaint(g, w, h, r) {
  g.fillStyle = rgb(46, 46, 48);
  g.fillRect(0, 0, w, h);
  // rolled-plate mottling
  stains(g, w, h, 9, r, '18,17,16', 0.26, 0.06, 0.3);
  stains(g, w, h, 5, r, '96,94,88', 0.09, 0.05, 0.2);
  // horizontal plate seams with a lit upper arris and a shadow under
  const seams = 3;
  for (let i = 1; i <= seams; i++) {
    const y = (i / (seams + 1)) * h + r.gauss() * 3;
    g.fillStyle = 'rgba(8,8,9,0.55)';
    g.fillRect(0, y, w, 2.5);
    g.fillStyle = 'rgba(150,152,150,0.10)';
    g.fillRect(0, y - 1.5, w, 1.2);
  }
  // rivet courses along every seam and around the rims
  const rivet = (x, y, rad) => {
    g.fillStyle = 'rgba(10,10,11,0.5)';
    g.beginPath(); g.arc(x, y + rad * 0.45, rad, 0, TAU); g.fill();
    g.fillStyle = `rgba(122,124,122,${0.22 + r.float() * 0.16})`;
    g.beginPath(); g.arc(x, y, rad * 0.92, 0, TAU); g.fill();
    g.fillStyle = 'rgba(176,180,178,0.20)';
    g.beginPath(); g.arc(x - rad * 0.28, y - rad * 0.3, rad * 0.42, 0, TAU); g.fill();
  };
  const courses = [0.055, 0.5, 0.945];
  for (let c = 0; c < seams + courses.length; c++) {
    const y = c < courses.length
      ? courses[c] * h
      : ((c - courses.length + 1) / (seams + 1)) * h + 6;
    const n = 14;
    for (let i = 0; i < n; i++) rivet((i + 0.5) * (w / n) + r.gauss() * 1.2, y, 2.1 + r.float() * 0.8);
  }
  // soot climbing, and rust standing in the bottom
  for (let i = 0; i < 9; i++) {
    const x = r.float() * w, len = h * (0.2 + r.float() * 0.5), lw = 4 + r.float() * 16;
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(9,8,8,${0.3 + r.float() * 0.3})`);
    gr.addColorStop(1, 'rgba(9,8,8,0)');
    g.fillStyle = gr;
    g.fillRect(x - lw / 2, 0, lw, len);
  }
  const rustBed = g.createLinearGradient(0, h, 0, h * 0.55);
  rustBed.addColorStop(0, 'rgba(74,48,30,0.40)');
  rustBed.addColorStop(1, 'rgba(74,48,30,0)');
  g.fillStyle = rustBed; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 220, ['#4a3120', '#2a2622', '#5c3d26', '#1a1918'], r, 0.5, 2.2);
  cracks(g, w, h, 4, r, 'rgba(12,11,10,0.45)', 0.9, 9);
  grain(g, w, h, 0.08, r);
  // You stand about 1.6 m from the boiler to use it, and the lantern in your
  // hands delivers ~27 there (tools/probe-light-attribution.mjs: the carried
  // light is 90% of what any close prop is lit by — not the room, not the
  // moon). At the 0.174 this originally painted to that is five times over
  // clipping, and a clipped surface has no rivets on it no matter how many
  // were painted. 0.026 lands the tank near mid-value at working distance,
  // which is where the bump map can actually carve.
  //
  // 0.018 is a COMPROMISE and worth naming as one: at 1.6 m it still sits high,
  // and at 4 m across the room it is already dim. No single albedo serves both,
  // because the lantern's near field is ~130 and its far field ~2 — a hundred
  // to one across the room you are standing in. That range, not this number, is
  // what stops close props having any material identity. See
  // tools/probe-lantern-curve.mjs for the A/B.
  toMeanValue(g, w, h, 0.018);
}

// Dead automotive paint on a wreck that has sat in a graveyard.
//
// The car's geometry was rebuilt properly — crushed shell, real glasshouse,
// arches — and then wore a flat metal tint, so it came back as a clean plastic
// model of a car, which is most of what "the car still looks like not a car"
// survives as. Paint that has stopped being paint: chalked and blotchy, clear
// coat gone in patches, rust standing along the bottom and blooming out of
// every seam, and a spray of road dirt up the flanks.
function carPaintPaint(g, w, h, r) {
  g.fillStyle = rgb(44, 52, 58);
  g.fillRect(0, 0, w, h);
  // chalking: paint oxidises unevenly, in big soft fields. Pushed hard at BOTH
  // ends — the mean is pinned at the bottom of this function, so contrast in
  // here is free, and contrast is the only thing a floodlit surface has.
  stains(g, w, h, 10, r, '150,158,160', 0.26, 0.1, 0.4);
  stains(g, w, h, 9, r, '7,9,11', 0.5, 0.08, 0.34);
  // clear-coat failure: hard-edged pale islands with a dark lip
  for (let i = 0; i < 7; i++) {
    const x = r.float() * w, y = r.float() * h, rad = 8 + r.float() * 26;
    g.beginPath();
    for (let p = 0; p <= 13; p++) {
      const a = (p / 13) * TAU, rr = rad * (0.55 + r.float() * 0.7);
      const vx = x + Math.cos(a) * rr, vy = y + Math.sin(a) * rr * 0.8;
      if (p === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
    }
    g.closePath();
    g.fillStyle = `rgba(178,182,178,${0.2 + r.float() * 0.18})`;
    g.fill();
    g.strokeStyle = 'rgba(8,7,6,0.6)'; g.lineWidth = 1.4; g.stroke();
  }
  // PANEL LINES. A car is panels, and the gaps between them hold a decade of
  // road film. Hard-edged, near-black, with grime bleeding out of one side:
  // the single most car-shaped mark available at zero cost.
  for (let i = 0; i < 5; i++) {
    const vertical = r.chance(0.55);
    const at = (0.1 + r.float() * 0.8) * (vertical ? w : h);
    const bleed = g.createLinearGradient(
      vertical ? at : 0, vertical ? 0 : at,
      vertical ? at + 13 : 0, vertical ? 0 : at + 13);
    bleed.addColorStop(0, 'rgba(6,7,8,0.72)');
    bleed.addColorStop(1, 'rgba(6,7,8,0)');
    g.fillStyle = bleed;
    if (vertical) g.fillRect(at, 0, 14, h); else g.fillRect(0, at, w, 14);
    g.strokeStyle = 'rgba(4,4,5,0.9)';
    g.lineWidth = 1.2 + r.float() * 0.8;
    g.beginPath();
    if (vertical) { g.moveTo(at, 0); g.lineTo(at + r.gauss() * 1.5, h); }
    else { g.moveTo(0, at); g.lineTo(w, at + r.gauss() * 1.5); }
    g.stroke();
  }
  // rust: a DARK bloom, not a bright one. Oxide on a night surface is one of
  // the darkest things on the car, and it used to be painted three times
  // lighter than the field it ate into — which is most of why the panels read
  // as one flat sheet with some pattern on it.
  for (let i = 0; i < 18; i++) {
    const x = r.float() * w, y = h * (0.4 + r.float() * 0.6), rad = 5 + r.float() * 17;
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(19,13,9,${0.62 + r.float() * 0.3})`);
    gr.addColorStop(0.5, 'rgba(31,20,13,0.44)');
    gr.addColorStop(1, 'rgba(38,26,17,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // pinholes where it has gone through — the only true black on the panel
    g.fillStyle = 'rgba(2,2,3,0.92)';
    for (let p = 0, n = r.int(3, 9); p < n; p++) {
      const a = r.float() * TAU, d = r.float() * r.float() * rad;
      g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + r.float() * 1.8, 0, TAU); g.fill();
    }
    // and a pale halo of blistered paint lifting at the edge of the bloom
    g.strokeStyle = `rgba(150,150,144,${0.1 + r.float() * 0.14})`;
    g.lineWidth = 0.8;
    g.beginPath(); g.arc(x, y, rad * 0.86, r.float() * TAU, r.float() * TAU + 2.4); g.stroke();
  }
  // road dirt sprayed up from the bottom edge, to an honest near-black sill.
  // The lower third of a wreck standing in a field is not dark grey; it is
  // where the light stops.
  const dirt = g.createLinearGradient(0, h, 0, h * 0.34);
  dirt.addColorStop(0, 'rgba(5,5,6,0.94)');
  dirt.addColorStop(0.45, 'rgba(14,13,11,0.6)');
  dirt.addColorStop(1, 'rgba(20,18,14,0)');
  g.fillStyle = dirt; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 300, ['#241e18', '#0d0b09', '#3c332a'], r, 0.4, 2);
  // scratches: BARE METAL. A scratch through dead paint is the brightest thing
  // on the panel, not a slightly lighter grey — and a bright hairline is what
  // makes a floodlit surface read as having a surface at all.
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(216,220,216,${0.3 + r.float() * 0.45})`;
    g.lineWidth = 0.5 + r.float() * 0.7;
    const y = r.float() * h, x = r.float() * w, len = 14 + r.float() * 70;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + r.gauss() * 3); g.stroke();
  }
  cracks(g, w, h, 6, r, 'rgba(5,4,4,0.7)', 0.8, 10);
  grain(g, w, h, 0.07, r);
  // Measured: at the distance you first see the wreck the carried lantern is
  // 91% of its light and the body came back at 0.26 mean — against a graveyard
  // averaging 0.03. That is why it read as a clean pale model of a car parked
  // in a dark field. A derelict should be one of the DARKER things out there,
  // with the headstones staying the pale landmarks. 0.032 puts it under them.
  //
  // And 0.032 is where it STAYS. Round seven's finding is that the car was
  // never pale: probe-albedo puts this map at 0.032 against a district ceiling
  // of about 0.03, and the pale pixels belong to the wreck's own headlight,
  // which throws 300 candela straight across the body field. Darkening a
  // floodlit surface buys almost nothing — the shore lip measured a fivefold
  // albedo cut for a 1.4x pixel cut — so everything above spends its budget on
  // VARIANCE at this same mean instead: near-black rust and sills that no
  // amount of light can lift, bare-metal scratches that go bright, and hard
  // panel lines to break the sheet. Under a floodlight, variance is the read.
  toMeanValue(g, w, h, 0.032);
}

// weathered pale granite — must stay LIGHTER than everything around it
function headstonePaint(g, w, h, r) {
  g.fillStyle = rgb(172, 170, 162);
  g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1400, ['#8a8880', '#b4b2aa', '#d6d4cc', '#6e6c66'], r, 0.4, 1.4);
  // rain streaking from the top edge
  for (let i = 0; i < 16; i++) {
    const x = r.float() * w, len = h * (0.2 + r.float() * 0.6), lw = 2 + r.float() * 5;
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(88,84,74,${0.1 + r.float() * 0.1})`);
    gr.addColorStop(1, 'rgba(88,84,74,0)');
    g.fillStyle = gr;
    g.fillRect(x - lw / 2, 0, lw, len);
  }
  // lichen crusts — darker discs, kept sparse so the slab still reads pale
  for (let i = 0; i < 6; i++) {
    const x = r.float() * w, y = r.float() * h, rad = 5 + r.float() * 14;
    g.fillStyle = `rgba(120,120,96,${0.18 + r.float() * 0.15})`;
    g.beginPath();
    for (let p = 0; p <= 10; p++) {
      const a = (p / 10) * TAU, rr = rad * (0.7 + r.float() * 0.5);
      const vx = x + Math.cos(a) * rr, vy = y + Math.sin(a) * rr;
      if (p === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
    }
    g.fill();
  }
  cracks(g, w, h, 3, r, 'rgba(90,88,80,0.5)', 0.8, 8);
  grain(g, w, h, 0.04, r);
}

function rockPaint(g, w, h, r) {
  g.fillStyle = rgb(60, 58, 60);
  g.fillRect(0, 0, w, h);
  // angular facet shading
  for (let i = 0; i < 16; i++) {
    const x = r.float() * w, y = r.float() * h, s = 20 + r.float() * 60;
    g.fillStyle = r.chance(0.5) ? 'rgba(130,132,136,0.07)' : 'rgba(12,12,14,0.10)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + s * (0.4 + r.float()), y + r.gauss() * s * 0.5);
    g.lineTo(x + r.gauss() * s * 0.5, y + s * (0.4 + r.float()));
    g.closePath(); g.fill();
  }
  // pale vertical runs — this is what sells "wet" (the sheen comes from roughness)
  for (let i = 0; i < 14; i++) {
    const x = r.float() * w, len = 30 + r.float() * 120, lw = 1 + r.float() * 3;
    const y0 = r.float() * h;
    const gr = g.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, 'rgba(150,155,160,0)');
    gr.addColorStop(0.5, `rgba(150,155,160,${0.06 + r.float() * 0.08})`);
    gr.addColorStop(1, 'rgba(150,155,160,0)');
    g.fillStyle = gr;
    g.fillRect(x - lw / 2, y0, lw, len);
  }
  speckle(g, w, h, 90, ['#c2c8cc', '#9aa0a4'], r, 0.4, 1); // mineral glints
  cracks(g, w, h, 7, r, 'rgba(14,13,15,0.5)', 1, 12);
  grain(g, w, h, 0.08, r);
}

function curtainPaint(g, w, h, r) {
  // vertical fold shading — whole sine cycles so the drape tiles sideways
  const base = [46, 38, 42];
  for (let x = 0; x < w; x++) {
    const s = 0.72 + 0.34 * (0.5 + 0.5 * Math.sin((x / w) * TAU * 5));
    g.fillStyle = rgb(base[0] * s, base[1] * s, base[2] * s);
    g.fillRect(x, 0, 1, h);
  }
  // rot creeping up from the hem
  const gr = g.createLinearGradient(0, h, 0, h * 0.45);
  gr.addColorStop(0, 'rgba(10,8,9,0.5)');
  gr.addColorStop(1, 'rgba(10,8,9,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  stains(g, w, h, 6, r, '14,11,12', 0.2, 0.04, 0.18);
  // moth holes — painted, the cloth geometry stays solid
  for (let i = 0; i < 46; i++) {
    g.fillStyle = `rgba(6,5,6,${0.5 + r.float() * 0.4})`;
    g.beginPath();
    g.arc(r.float() * w, r.float() * h, 0.8 + r.float() * 2.4, 0, TAU);
    g.fill();
  }
  grain(g, w, h, 0.07, r);
}

// pale strands on a transparent ground; alphaTest clips everything that isn't strand
function webPaint(g, w, h, r) {
  const cx = w * 0.5, cy = h * 0.46;
  const spokes = 12, reach = w * 0.48;
  const ang = [];
  for (let i = 0; i < spokes; i++) ang.push((i / spokes) * TAU + r.gauss() * 0.1);
  g.strokeStyle = 'rgba(212,216,220,0.9)';
  g.lineWidth = 1.3;
  for (const a of ang) {
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
    g.stroke();
  }
  // spiral rings, sagging between spokes, with torn gaps
  for (let rad = w * 0.05; rad < reach; rad *= 1.22) {
    g.lineWidth = 0.9;
    for (let i = 0; i < spokes; i++) {
      if (r.chance(0.16)) continue;
      const a0 = ang[i];
      let a1 = ang[(i + 1) % spokes];
      if (a1 < a0) a1 += TAU;
      const r0 = rad * (0.94 + r.float() * 0.12), r1 = rad * (0.94 + r.float() * 0.12);
      const am = (a0 + a1) / 2, rm = rad * 0.88;
      g.strokeStyle = `rgba(212,216,220,${0.65 + r.float() * 0.3})`;
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
      g.quadraticCurveTo(cx + Math.cos(am) * rm, cy + Math.sin(am) * rm,
        cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
      g.stroke();
    }
  }
  // dust snags
  g.fillStyle = 'rgba(200,202,205,0.8)';
  for (let i = 0; i < 26; i++) {
    const a = r.float() * TAU, d = r.float() * reach;
    g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r.float() * 1.6, 1 + r.float() * 1.6);
  }
}

// aged bone/ivory — the single most-looked-at surface in the game
function bonePaint(g, w, h, r) {
  // ground: warm ivory, top-lit
  const gr0 = g.createLinearGradient(0, 0, 0, h);
  gr0.addColorStop(0, rgb(188, 178, 154));
  gr0.addColorStop(1, rgb(166, 154, 130));
  g.fillStyle = gr0; g.fillRect(0, 0, w, h);
  // broad mottling — old bone is never one colour
  stains(g, w, h, 8, r, '146,130,102', 0.12, 0.08, 0.3);
  stains(g, w, h, 5, r, '214,206,184', 0.12, 0.06, 0.22);
  // porous fields: pores cluster, they don't sprinkle evenly
  for (let c = 0; c < 26; c++) {
    const px0 = r.float() * w, py0 = r.float() * h, spread = 12 + r.float() * 44;
    for (let i = 0, n = r.int(24, 64); i < n; i++) {
      const px = px0 + r.gauss() * spread, py = py0 + r.gauss() * spread;
      g.fillStyle = `rgba(104,86,62,${0.1 + r.float() * 0.22})`;
      g.beginPath();
      g.arc(px, py, 0.4 + r.float() * r.float() * 1.6, 0, TAU);
      g.fill();
    }
  }
  // a few big nutrient foramina — dark, definite
  for (let i = 0; i < 9; i++) {
    g.fillStyle = 'rgba(66,52,38,0.55)';
    g.beginPath();
    g.ellipse(r.float() * w, r.float() * h, 1.2 + r.float() * 1.6, 0.8 + r.float(), r.float() * TAU, 0, TAU);
    g.fill();
  }
  // sutures: wandering interdigitated seams — the skull's signature.
  // Path is precomputed so the soft halo and the tight seam trace the SAME line.
  const suturePath = (x0, y0, a0, steps) => {
    const pts = [[x0, y0]];
    let x = x0, y = y0, a = a0;
    for (let s = 0; s < steps; s++) {
      a += (r.float() - 0.5) * 0.5;
      const st = 7 + r.float() * 6;
      x += Math.cos(a) * st; y += Math.sin(a) * st;
      const off = (s % 2 ? 1 : -1) * (1.5 + r.float() * 3.5); // interdigitation
      pts.push([x + Math.cos(a + Math.PI / 2) * off, y + Math.sin(a + Math.PI / 2) * off]);
    }
    return pts;
  };
  const strokePts = (pts, col, lw) => {
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) g.moveTo(pts[i][0], pts[i][1]); else g.lineTo(pts[i][0], pts[i][1]);
    }
    g.stroke();
  };
  const seams = [
    [0, h * 0.3, 0.1],             // coronal — sweeping across
    [w * 0.55, 0, Math.PI * 0.55], // sagittal — dropping down
    [w * 0.15, h * 0.75, -0.25],   // lambdoid-ish
  ];
  for (const [sx, sy, sa] of seams) {
    const pts = suturePath(sx, sy, sa, 40);
    strokePts(pts, 'rgba(112,94,70,0.18)', 6);  // stained halo
    strokePts(pts, 'rgba(70,55,40,0.6)', 1.3);  // the seam itself
  }
  // hairline age cracks radiating off the sutures
  cracks(g, w, h, 12, r, 'rgba(96,76,54,0.35)', 0.7, 8);
  // polished wear highs — where it's been carried
  stains(g, w, h, 4, r, '224,216,196', 0.14, 0.05, 0.16);
  grain(g, w, h, 0.045, r);
}

// stains that survive the wrap: a capsule's u runs right round the finger, so
// a blotch drawn near one edge has to come back round the other side
function wrapStains(g, w, h, n, r, col, alpha, minR, maxR) {
  for (let i = 0; i < n; i++) {
    const x0 = r.float() * w, y = r.float() * h;
    const rad = (minR + r.float() * (maxR - minR)) * w;
    const a = alpha * (0.5 + r.float());
    for (const dx of [-w, 0, w]) {
      const gr = g.createRadialGradient(x0 + dx, y, rad * 0.15, x0 + dx, y, rad);
      gr.addColorStop(0, `rgba(${col},${a})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
  }
}

// skinPaint — the back of a hand, at the distance the cradle holds it.
//
// The one surface in this game that had no texture at all. Every wall, floor,
// coffin and car in FETCH is a painted canvas and the hands the player looks
// at for the whole game were flat colour: one value, one hue, smooth shading
// over a shape. That is most of what is left of "they still don't look like
// human hands" once they are the right proportions and actually touching the
// skull — you can model a hand correctly and it will still read as a mannequin
// while its surface is a plastic that has never been anywhere.
//
// This map MULTIPLIES rather than replaces. Round seven spent three passes
// putting the hands a stop or two under the skull in the value order and they
// have to stay there, so this is authored around white and carries only the
// variation; toMeanValue pulls it to 0.92 and the material colours are lifted
// by the reciprocal. Same hands, same value, every pixel of them different.
//
// It is the bumpMap too, and that is the point. The kit's note above
// M.wallpaper is the law here: a surface with no relief under a moving lantern
// is a picture of a thing, and the light has to be able to rake across it. A
// hand is mostly creases.
//
// Every finger segment shares one capsule, so this cannot carry landmarks —
// u runs around the circumference and v along the segment, and whatever sits
// at a given v appears on every phalanx of every finger. Which is close to
// true of real fingers anyway: creases at the joints, grain everywhere.
function skinPaint(g, w, h, r) {
  // SCALE FIRST, and it is the thing the first pass got wrong. One capsule
  // serves every phalanx, so this whole sheet wraps ONE finger segment — about
  // forty screen pixels of it at the distance the cradle holds the hand. 256 px
  // of texture landing on 40 means everything finer than about eight pixels
  // here is gone to the mip chain before the player ever sees it. The first
  // pass painted hairline creases and one-pixel pores at 1.39x contrast and
  // came back invisible; every feature below is deliberately coarse and
  // deliberately dark.
  g.fillStyle = rgb(250, 248, 245);
  g.fillRect(0, 0, w, h);
  // broad tonal drift — skin at hand scale is blotchy, never one tone
  wrapStains(g, w, h, 10, r, '128,112,100', 0.50, 0.08, 0.24);
  wrapStains(g, w, h, 6, r, '255,254,252', 0.30, 0.06, 0.18);
  // and it has been somewhere: ground-in dirt, tight and uneven so it cannot be
  // mistaken for shading
  wrapStains(g, w, h, 9, r, '46,38,30', 0.55, 0.03, 0.12);

  // TRANSVERSE CREASES, which are the strongest cue there is at this size.
  // A fold has a dark valley and a lit lip, and painting both is what lets the
  // same sheet serve as the bump map. Whole sine cycles across the width so the
  // line meets itself at the capsule's seam.
  const crease = (y0, k, amp, dark, lw, phase) => {
    const line = (dy, style, width) => {
      g.strokeStyle = style; g.lineWidth = width;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = y0 + dy + Math.sin((x / w) * TAU * k + phase) * amp;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    };
    line(-lw * 0.9, `rgba(255,253,250,${dark * 0.55})`, lw * 0.8);
    line(0, `rgba(52,40,32,${dark})`, lw);
  };
  // the joints: two dense bands of them, because that is where a hand creases
  for (const band of [0.13, 0.87]) {
    for (let i = 0; i < 7; i++) {
      crease(h * band + r.gauss() * h * 0.045, r.int(1, 3), 1.2 + r.float() * 2.6,
        0.30 + r.float() * 0.30, 1.8 + r.float() * 2.0, i * 1.7);
    }
  }
  // and the rest of the length, looser — and SPARSE. Twelve of these wrapped
  // every finger of the skinned hand in rings; the geometry carries the
  // joints now (hinge folds are vertex colour), so the sheet only needs the
  // fine dry-skin lines between them.
  for (let i = 0; i < 5; i++) {
    crease(r.float() * h, r.int(1, 4), 1.0 + r.float() * 2.4,
      0.10 + r.float() * 0.14, 1.2 + r.float() * 1.6, i * 0.9);
  }

  // pores cluster, they do not sprinkle — and at this scale a pore has to be
  // two or three pixels or it is nothing
  for (let c = 0; c < 26; c++) {
    const px0 = r.float() * w, py0 = r.float() * h, spread = 10 + r.float() * 34;
    for (let i = 0, n = r.int(12, 34); i < n; i++) {
      g.fillStyle = `rgba(84,68,56,${0.16 + r.float() * 0.28})`;
      g.beginPath();
      g.arc(px0 + r.gauss() * spread, py0 + r.gauss() * spread,
        0.9 + r.float() * r.float() * 2.0, 0, TAU);
      g.fill();
    }
  }

  // NO LONGITUDINAL VEINS. The first strong pass had three of them — an
  // extensor tendon down a finger, a vein across the back of the hand — and
  // they were the only feature that came back WRONG rather than weak. One
  // sheet serves capsules and spheres both, and a line that runs helpfully
  // down a phalanx runs across the palm as a smear; at hand scale the render
  // read as woodgrain. Anything directional in here has to survive being
  // wrapped on geometry it was not aimed at, and only the rings do.
  //
  // So the rest of the skin is isotropic on purpose: mottle, pores, dry nicks,
  // grain. They read the same whichever way the sheet lands.
  for (let c = 0; c < 18; c++) {
    const px0 = r.float() * w, py0 = r.float() * h, spread = 18 + r.float() * 40;
    for (let i = 0, n = r.int(8, 22); i < n; i++) {
      g.fillStyle = `rgba(226,220,212,${0.20 + r.float() * 0.30})`;
      g.beginPath();
      g.arc(px0 + r.gauss() * spread, py0 + r.gauss() * spread,
        1.4 + r.float() * 3.4, 0, TAU);
      g.fill();
    }
  }
  // a few dry splits and nicks, dark enough to survive the mip chain
  cracks(g, w, h, 9, r, 'rgba(38,28,22,0.42)', 1.4, 9);
  grain(g, w, h, 0.09, r);
  // Authored around white so the material colour keeps carrying the value, and
  // pulled to 0.85 rather than the first pass's 0.92 because the contrast this
  // needs has to come from somewhere. skull.js lifts both hand colours by the
  // reciprocal, so the hands sit exactly where round seven put them in the
  // value order.
  toMeanValue(g, w, h, 0.85);
}

function waterPaint(g, w, h, r) {
  g.fillStyle = rgb(16, 22, 28);
  g.fillRect(0, 0, w, h);
  // long ripple bands; whole cycles so it tiles
  for (let i = 0; i < 22; i++) {
    const y0 = r.float() * h, amp = 1 + r.float() * 3, k = r.int(2, 5);
    g.strokeStyle = `rgba(96,116,128,${0.05 + r.float() * 0.08})`;
    g.lineWidth = 1 + r.float() * 1.5;
    g.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = y0 + Math.sin((x / w) * TAU * k + i) * amp;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  grain(g, w, h, 0.03, r);
}

/* ---------------- material set ---------------- */

let cached = null;

// THE WORKS PLATE ON THE STAIR DOOR. Alex's own idea, and his own reasoning:
// "when that door is closed, we just put a sign on it with a picture of a
// furnace, one of those things with a circle with a line through it. like its
// saying no furnace. The player will see that sign on the door the first time
// they leave the upstairs of the house."
//
// It is a PICTURE ON AN OBJECT, not a message on the screen, so it is inside
// the no-HUD law; and it is shape, not hue, so it is inside the other one. What
// it says is true: the furnace cannot light until the skull carries fire, and
// that rule is checked every frame and cannot be lost.
//
// The ground is DARK, and that was not the first guess. A pale enamel plate is
// the obvious answer for an unlit stairwell — until you measure it, and find
// that this door is one of the palest surfaces in the house: pale plate on pale
// door came back at 1.03x contrast from the pose he would actually read it
// from, which is nothing at all. So it is a dark enamel works plate with a pale
// glyph, which is period-correct anyway, and it reads as a dark shape on a
// light door from across the landing. Legibility is CONTRAST, not brightness:
// what the eye needs is a difference, in whichever direction the surface
// underneath is not.
function furnaceSignPaint(g, w, h, r) {
  // enamel ground, faintly unevenly fired
  g.fillStyle = rgb(34, 33, 30);
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const x = r.float() * w, y = r.float() * h, rad = 2 + r.float() * 9;
    g.fillStyle = `rgba(${70 + r.float() * 60 | 0},${66 + r.float() * 56 | 0},${58 + r.float() * 50 | 0},${0.05 + r.float() * 0.07})`;
    g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  }
  // a dark border, the way a stamped plate is edged
  g.strokeStyle = rgb(196, 190, 172); g.lineWidth = w * 0.045;
  g.strokeRect(w * 0.055, h * 0.055, w * 0.89, h * 0.89);

  // BOLD, because 256 px of sheet on a 0.44 m plate seen from three metres is
  // a few dozen screen pixels, and round eight's law is that anything finer
  // than about 8 px is gone to the mip chain before the player sees it. Fewer
  // parts, thicker strokes, one silhouette.
  const cx = w * 0.5, cy = h * 0.52, S = w * 0.31;
  g.strokeStyle = rgb(206, 200, 182);
  g.fillStyle = rgb(206, 200, 182);

  // the furnace: squat body, arched mouth, short legs, flue rising off the top
  const bw = S * 1.16, bh = S * 0.98;
  g.fillRect(cx - bw / 2, cy - bh * 0.34, bw, bh);
  g.lineWidth = w * 0.055;                         // flue, fat enough to survive
  g.beginPath();
  g.moveTo(cx + bw * 0.24, cy - bh * 0.34);
  g.lineTo(cx + bw * 0.24, cy - bh * 1.02);
  g.stroke();
  // the mouth, cut back to the enamel so the furnace reads as open and cold
  g.fillStyle = rgb(34, 33, 30);
  g.beginPath();
  g.moveTo(cx - bw * 0.30, cy + bh * 0.50);
  g.lineTo(cx - bw * 0.30, cy + bh * 0.04);
  g.arc(cx, cy + bh * 0.04, bw * 0.30, Math.PI, 0);
  g.lineTo(cx + bw * 0.30, cy + bh * 0.50);
  g.closePath(); g.fill();

  // ...and the circle with the line through it
  g.strokeStyle = rgb(206, 200, 182);
  g.lineWidth = w * 0.075;
  g.beginPath(); g.arc(cx, cy, S * 1.14, 0, TAU); g.stroke();
  const d = S * 1.14 * Math.SQRT1_2;
  g.beginPath();
  g.moveTo(cx - d, cy + d); g.lineTo(cx + d, cy - d);
  g.stroke();

  // chips: enamel gone at the corners, bare tin under it
  for (let i = 0; i < 26; i++) {
    const corner = i % 4;
    const x = (corner === 0 || corner === 3 ? 0.03 + r.float() * 0.16 : 0.81 + r.float() * 0.16) * w;
    const y = (corner < 2 ? 0.03 + r.float() * 0.16 : 0.81 + r.float() * 0.16) * h;
    g.fillStyle = `rgba(126,122,114,${0.35 + r.float() * 0.4})`;
    g.beginPath(); g.arc(x, y, 2 + r.float() * 7, 0, TAU); g.fill();
  }
  speckle(g, w, h, r, 900, 0.05);
}

export function makeMaterials() {
  if (cached) return cached;
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  // fork a fresh deterministic stream per texture, paint, set default tiling
  const T = (w, h, salt, painter, rx = 1, ry = 1) => {
    const r = ROOT.fork(salt);
    const t = canvasTexture(w, h, (g, cw, ch) => painter(g, cw, ch, r), { repeat: true });
    t.repeat.set(rx, ry);
    return t;
  };

  const M = {};

  // Repeat convention: wall/floor maps are authored as ~2m of surface; defaults
  // below assume typical quads (walls ~4m x 2.8m, floors ~4m across) with 0..1
  // UVs. Callers retune per-mesh via mat.map.repeat.set(w/2, h/2) — but note
  // repeat lives on the shared texture, so clone the material first if two
  // meshes need different tiling.
  // RELIEF. Every wall in this game was a pure-diffuse Lambert with nothing but
  // an albedo, so the one light the player carries could sweep across a brick
  // wall and never find a brick: perfectly smooth falloff over a picture OF
  // masonry. These maps were painted with their own shading in them, which
  // makes each one a serviceable height field — the mortar is the dark, the
  // face is the light. Feeding the same texture back as a bumpMap costs no
  // extra memory, no extra draw call and no new material, and it is what turns
  // a moving lantern into a thing that rakes across a surface.
  // Lambert carries bumpMap per-fragment in r161 (verified in the vendored
  // build), so nothing here needs to become Standard to get it.
  const bump = (t, scale) => ({ map: t, bumpMap: t, bumpScale: scale });
  M.wallpaper    = lam(bump(T(512, 512, 11, (g, w, h, r) => wallpaperPaint(g, w, h, r, false), 2, 1.4), 0.07));
  M.wallpaperRot = lam(bump(T(512, 512, 12, (g, w, h, r) => wallpaperPaint(g, w, h, r, true), 2, 1.4), 0.11));
  M.plaster      = lam(bump(T(256, 256, 13, plasterPaint, 2, 1.4), 0.10));
  M.woodFloor    = std({
    ...bump(T(512, 512, 14, (g, w, h, r) => planks(g, w, h, r, [66, 52, 38], '#0f0b07', 8, true), 2, 2), 0.16),
    roughness: 0.85, metalness: 0.02,
  });
  M.woodDark     = lam(bump(T(256, 256, 15, woodDarkPaint), 0.09));
  M.stone        = lam(bump(T(512, 512, 16, (g, w, h, r) => stonePaint(g, w, h, r, [74, 72, 66], 5, rgb(30, 28, 26)), 2, 1), 0.19));
  M.brick        = lam(bump(T(256, 256, 17, (g, w, h, r) => stonePaint(g, w, h, r, [80, 54, 46], 6, rgb(46, 43, 40)), 3, 1.5), 0.16));
  M.dirt         = lam(bump(T(256, 256, 18, dirtPaint, 3, 3), 0.16));
  // Only stone needs the split. `dirt` is already the darkest map in the game
  // and never appears as a wall, so a second dirt variant bought nothing but a
  // draw call — and house-after-cave sits close enough to the 450 ceiling that
  // draw calls are not free.
  M.stoneFloor   = lam(bump(T(512, 512, 30, flagstonePaint, 1.6, 1.6), 0.22));
  M.grass        = lam(bump(T(256, 256, 19, grassPaint, 4, 4), 0.12));
  M.bark         = lam(bump(T(256, 256, 20, barkPaint, 1, 2), 0.34));
  M.carpet       = lam(bump(T(256, 256, 21, carpetPaint, 2, 2), 0.06));
  M.ceiling      = lam(bump(T(256, 256, 22, ceilingPaint, 2, 2), 0.07));
  M.metal        = std({ ...bump(T(256, 256, 23, metalPaint), 0.10), roughness: 0.5, metalness: 0.7 });
  // Machinery gets its own map at its own tiling: repeat 3 around a tank puts
  // the rivet courses at rivet scale instead of stretching one 256 px sheet
  // around three and a bit metres of circumference. Low metalness on purpose —
  // there is no environment map in this game, so a metallic surface is one that
  // goes black except where a light hits it dead on.
  // Roughness 0.95 / metalness 0, and the reason is measured. Dielectric
  // specular uses a fixed F0 of 0.04 REGARDLESS of albedo, so under a lantern
  // delivering ~22 at working distance a semi-glossy surface wears a white
  // sheen that darkening the map cannot touch: the boiler stayed pale plastic
  // through a 6.7x albedo cut because what was pale was never the albedo.
  // Sooty cast iron is nearly matte, and matte is what lets the map be seen.
  M.machine      = std({ ...bump(T(512, 512, 32, machineIronPaint, 3, 1), 0.42), roughness: 0.95, metalness: 0.0 });
  // The wreck. Extrude UVs run in world units, so repeat 1 is one metre a tile.
  //
  // Lambert, for the boiler's reason and the graveyard bodies' reason, measured
  // a third time on this surface: set this map to pure black and 52% of what
  // you see on the car is still there (tools/probe-body-specular.mjs). At
  // roughness 0.93 there was no gloss left to want — what the specular term was
  // contributing was a broad white wash from a point light, in a game with no
  // environment map, over paint the painter above describes as chalked and
  // clear-coat-failed. That wash is most of "the car reads as an unpainted
  // plastic model". Lambert carries the bumpMap per-fragment in r161, so the
  // panel relief this map was authored for survives the change.
  M.carPaint     = lam(bump(T(512, 512, 33, carPaintPaint, 1, 1), 0.20));
  M.headstone    = lam(bump(T(256, 256, 24, headstonePaint), 0.14));
  // one plate, one repeat: this map is a PICTURE, not a tiling surface
  M.furnaceSign  = lam(bump(T(256, 256, 71, furnaceSignPaint), 0.05));
  M.furnaceSign.map.repeat.set(1, 1);
  M.furnaceSign.map.wrapS = M.furnaceSign.map.wrapT = THREE.ClampToEdgeWrapping;
  M.rock         = std({ ...bump(T(256, 256, 25, rockPaint, 2, 2), 0.26), roughness: 0.6, metalness: 0.05 });
  M.curtain      = lam({ map: T(256, 256, 26, curtainPaint), side: THREE.DoubleSide });
  // web ground stays transparent — no repeat wrap, one web per quad
  M.web = lam({
    map: canvasTexture(256, 256, (g, w, h) => webPaint(g, w, h, ROOT.fork(27))),
    transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
  });
  const boneTex = T(512, 512, 28, bonePaint);
  M.bone  = std({ map: boneTex, bumpMap: boneTex, bumpScale: 0.12, roughness: 0.55, metalness: 0 });
  M.water = std({ map: T(256, 256, 29, waterPaint, 4, 4), roughness: 0.15, metalness: 0.7 });

  cached = M;
  return M;
}

// The hands are built in skull.js rather than here, because becomeBone mutates
// those exact material objects in the last room and they cannot be shared out
// of the cached set. Their SURFACE still belongs in the texture kit like every
// other surface in this game. One texture, shared by the skin and the crease —
// it is the same skin, and sharing it is one upload and one bump map.
let handSkinTex = null;
export function handSkinTexture() {
  if (!handSkinTex) {
    handSkinTex = canvasTexture(256, 256, (g, w, h) => skinPaint(g, w, h, ROOT.fork(34)), { repeat: true });
  }
  return handSkinTex;
}
