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
  // peeling: ragged patches torn back to plaster — plaster is LIGHTER, reads as wound
  for (let i = 0, n = rot ? 6 : 2; i < n; i++) {
    const px = r.float() * w, py = r.float() * h;
    const pr = w * (rot ? 0.07 + r.float() * 0.13 : 0.04 + r.float() * 0.06);
    g.save();
    g.beginPath();
    for (let p = 0; p <= 9; p++) {
      const a = (p / 9) * TAU;
      const rr = pr * (0.6 + r.float() * 0.7);
      const vx = px + Math.cos(a) * rr, vy = py + Math.sin(a) * rr * 1.3;
      if (p === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
    }
    g.closePath();
    g.fillStyle = rgb(96, 92, 84);
    g.fill();
    g.strokeStyle = 'rgba(16,12,8,0.6)'; g.lineWidth = 1.5; g.stroke();
    g.clip();
    cracks(g, w, h, 2, r, 'rgba(40,36,30,0.5)', 0.8, 7);
    g.restore();
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

// coursed blocks; shared by stone and brick (different base/rows/mortar)
function stonePaint(g, w, h, r, base, rows, mortar) {
  g.fillStyle = mortar;
  g.fillRect(0, 0, w, h);
  const bh = h / rows, cols = 4, bw = w / cols;
  for (let row = 0; row < rows; row++) {
    const half = row % 2 === 1;
    for (let i = 0; i <= cols; i++) {
      if (!half && i === cols) break;
      const x = i * bw - (half ? bw / 2 : 0);
      const s = 0.78 + r.float() * 0.38;
      g.fillStyle = rgb(base[0] * s, base[1] * s, base[2] * s);
      g.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      // bevel shadow along the bottom edge, then pocks
      g.fillStyle = 'rgba(10,9,8,0.35)';
      g.fillRect(x + 2, row * bh + bh - 6, bw - 4, 3);
      for (let p = 0; p < 5; p++) {
        g.fillStyle = `rgba(14,13,11,${0.15 + r.float() * 0.2})`;
        g.beginPath();
        g.arc(x + 4 + r.float() * (bw - 8), row * bh + 4 + r.float() * (bh - 8), 1 + r.float() * 2.5, 0, TAU);
        g.fill();
      }
    }
  }
  stains(g, w, h, 5, r, '12,11,10', 0.2, 0.05, 0.28);
  cracks(g, w, h, 4, r);
  grain(g, w, h, 0.09, r);
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

function grassPaint(g, w, h, r) {
  g.fillStyle = rgb(52, 50, 38);
  g.fillRect(0, 0, w, h);
  stains(g, w, h, 6, r, '30,26,18', 0.22, 0.08, 0.3); // bare worn patches
  stains(g, w, h, 4, r, '86,82,58', 0.12, 0.06, 0.2);
  // blades: the wide value spread does the work, not the (barely) green tint
  for (let i = 0; i < 950; i++) {
    const v = 46 + r.float() * 52;
    g.strokeStyle = `rgba(${(v + 8) | 0},${(v + 12) | 0},${(v * 0.72) | 0},${0.4 + r.float() * 0.4})`;
    g.lineWidth = 1;
    const x = r.float() * w, y = r.float() * h, len = 3 + r.float() * 6;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + r.gauss() * 2.5, y - len);
    g.stroke();
  }
  // dead pale tufts — the graveyard reads grey-blond, not green
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(128,118,86,${0.3 + r.float() * 0.3})`;
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
  M.wallpaper    = lam({ map: T(512, 512, 11, (g, w, h, r) => wallpaperPaint(g, w, h, r, false), 2, 1.4) });
  M.wallpaperRot = lam({ map: T(512, 512, 12, (g, w, h, r) => wallpaperPaint(g, w, h, r, true), 2, 1.4) });
  M.plaster      = lam({ map: T(256, 256, 13, plasterPaint, 2, 1.4) });
  M.woodFloor    = std({
    map: T(512, 512, 14, (g, w, h, r) => planks(g, w, h, r, [66, 52, 38], '#0f0b07', 8, true), 2, 2),
    roughness: 0.85, metalness: 0.02,
  });
  M.woodDark     = lam({ map: T(256, 256, 15, woodDarkPaint) });
  M.stone        = lam({ map: T(512, 512, 16, (g, w, h, r) => stonePaint(g, w, h, r, [74, 72, 66], 5, rgb(30, 28, 26)), 2, 1) });
  M.brick        = lam({ map: T(256, 256, 17, (g, w, h, r) => stonePaint(g, w, h, r, [80, 54, 46], 6, rgb(46, 43, 40)), 3, 1.5) });
  M.dirt         = lam({ map: T(256, 256, 18, dirtPaint, 3, 3) });
  M.grass        = lam({ map: T(256, 256, 19, grassPaint, 4, 4) });
  M.bark         = lam({ map: T(256, 256, 20, barkPaint, 1, 2) });
  M.carpet       = lam({ map: T(256, 256, 21, carpetPaint, 2, 2) });
  M.ceiling      = lam({ map: T(256, 256, 22, ceilingPaint, 2, 2) });
  M.metal        = std({ map: T(256, 256, 23, metalPaint), roughness: 0.5, metalness: 0.7 });
  M.headstone    = lam({ map: T(256, 256, 24, headstonePaint) });
  M.rock         = std({ map: T(256, 256, 25, rockPaint, 2, 2), roughness: 0.6, metalness: 0.05 });
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
