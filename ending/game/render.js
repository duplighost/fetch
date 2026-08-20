// His `src/game/render.ts`, types stripped. The canvas playfield: lanes,
// receptors, falling arrows, particles, the judgement word, and the responsive
// layout that puts the field left on a wide screen and centred on a phone.
//
// One dress change, no geometry touched: the judgement type was set in Teko,
// a Google font the scaffold pulled over the network. This page ships no
// downloads, so the face is FETCH's own — the serif the rest of the game
// speaks in. Everything else here is his.

import { LANE_COLORS, TRAVEL } from './types.js';

const DISPLAY_FACE = 'Georgia, "Times New Roman", serif';

export function computeLayout(w, h) {
  const isWide = w >= 760;
  const fieldW = isWide ? Math.min(440, w * 0.4) : Math.min(w * 0.92, 420);
  const fieldX = isWide ? Math.max(28, w * 0.04) : (w - fieldW) / 2;
  const laneW = fieldW / 4;
  const arrow = Math.min(64, laneW * 0.72);
  const receptorY = h * (isWide ? 0.8 : 0.76);
  const spawnY = h * 0.07;
  return { w, h, fieldX, fieldW, laneW, spawnY, receptorY, arrow, isWide };
}

export function laneCenter(layout, lane) {
  return layout.fieldX + layout.laneW * lane + layout.laneW / 2;
}

export function hitLaneAt(layout, x, y) {
  if (y < layout.receptorY - layout.arrow * 1.6) return null;
  if (x < layout.fieldX || x > layout.fieldX + layout.fieldW) return null;
  const i = Math.floor((x - layout.fieldX) / layout.laneW);
  if (i < 0 || i > 3) return null;
  return i;
}

function arrowPath(ctx, size) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.5);
  ctx.lineTo(s * 0.4, -s * 0.08);
  ctx.lineTo(s * 0.16, -s * 0.08);
  ctx.lineTo(s * 0.16, s * 0.48);
  ctx.lineTo(-s * 0.16, s * 0.48);
  ctx.lineTo(-s * 0.16, -s * 0.08);
  ctx.lineTo(-s * 0.4, -s * 0.08);
  ctx.closePath();
}

const ROT = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];

function drawArrow(ctx, x, y, size, lane, fill, stroke, lineWidth, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ROT[lane] ?? 0);
  if (glow > 0) {
    ctx.shadowColor = fill ?? stroke;
    ctx.shadowBlur = glow;
  }
  arrowPath(ctx, size);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

export function drawPlayfield(ctx, snap, layout, audioTime, reduced) {
  const { fieldX, fieldW, laneW, spawnY, receptorY, arrow } = layout;
  const now = snap.songTime;

  ctx.save();
  ctx.fillStyle = 'rgba(9,9,11,0.42)';
  roundRect(ctx, fieldX - 10, spawnY - 18, fieldW + 20, receptorY - spawnY + arrow, 18);
  ctx.fill();

  for (let lane = 0; lane < 4; lane++) {
    const x = fieldX + laneW * lane;
    ctx.fillStyle = 'rgba(244,240,232,0.035)';
    ctx.fillRect(x + 2, spawnY, laneW - 4, receptorY - spawnY + arrow * 0.2);
  }

  const beatPulse = reduced ? 0 : (1 - snap.beatPhase) * (1 - snap.beatPhase);

  for (let lane = 0; lane < 4; lane++) {
    const cx = laneCenter(layout, lane);
    const color = LANE_COLORS[lane];
    const flash = Math.max(0, 1 - (audioTime - snap.pressFlash[lane]) * 8);
    const size = arrow * (1 + flash * 0.1 + beatPulse * 0.04);
    drawArrow(
      ctx,
      cx,
      receptorY,
      size,
      lane,
      flash > 0.05 ? color : null,
      color,
      3.2,
      8 + flash * 18,
    );
  }

  for (const n of snap.notes) {
    if (n.judged) continue;
    const eta = n.time - now;
    if (eta > TRAVEL || eta < -0.12) continue;
    const p = 1 - eta / TRAVEL;
    const y = spawnY + p * (receptorY - spawnY);
    const cx = laneCenter(layout, n.lane);
    const color = LANE_COLORS[n.lane];
    const alpha = Math.min(1, p * 2.2);
    ctx.globalAlpha = alpha;
    drawArrow(ctx, cx, y, arrow * 0.92, n.lane, color, '#f4f0e8', 1.6, reduced ? 0 : 12);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawJudgement(ctx, layout, snap, audioTime) {
  const hit = snap.lastHit;
  if (!hit) return;
  const age = audioTime - hit.at;
  if (age > 0.7) return;
  const k = 1 - age / 0.7;
  const labels = {
    perfect: 'CHOMP',
    great: 'GREAT',
    good: 'GOOD',
    miss: 'MISS',
  };
  const colors = {
    perfect: '#f4f0e8',
    great: '#8dcf7a',
    good: '#d4b46a',
    miss: '#c45c5c',
  };
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 ' + Math.round(layout.arrow * 0.42) + 'px ' + DISPLAY_FACE;
  ctx.fillStyle = colors[hit.judgement] ?? '#f4f0e8';
  ctx.letterSpacing = '0.18em';
  const y = layout.receptorY - layout.arrow * 1.55 - (1 - k) * 12;
  ctx.fillText(labels[hit.judgement] ?? '', layout.fieldX + layout.fieldW / 2, y);

  if (snap.combo > 1 && hit.judgement !== 'miss') {
    ctx.font = '600 ' + Math.round(layout.arrow * 0.7) + 'px ' + DISPLAY_FACE;
    ctx.fillStyle = '#f4f0e8';
    ctx.letterSpacing = '0.04em';
    ctx.globalAlpha = Math.min(1, k * 1.2);
    ctx.fillText(String(snap.combo), layout.fieldX + layout.fieldW / 2, y - layout.arrow * 0.7);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function resizeCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, ctx };
}
