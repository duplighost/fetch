// util.js — seeded randomness + math helpers + canvas texture factory
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// Small convenience wrapper over mulberry32.
export class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); this.seed = seed >>> 0; }
  float() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  sign() { return this.f() < 0.5 ? -1 : 1; }
  gauss() { // approx normal in [-1,1]
    return (this.f() + this.f() + this.f()) / 1.5 - 1;
  }
  fork(salt) { return new RNG(hash2(this.seed, salt)); }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Acts only move forward, but the house is physically revisitable after the
// basement act begins. Systems that belong to the rooms above the cellar must
// therefore ask where the player is, not whether progression moved backward.
// -0.70 matches house.js's upper-sector culling seam: above it the player can
// see and inhabit the furnished house; below it they are genuinely downstairs.
export const isPhysicalHouseInterior = (game) => !!game && (
  game.act === 'bedroom'
  || game.act === 'house'
  || (game.act === 'basement' && (game.player?.pos?.y ?? -Infinity) > -0.70)
);

// And the same question asked about a POINT rather than about progression:
// is this thing standing inside the building? house.js publishes the box
// beside the zones it is derived from. Anything outside the house — the
// yard, the graveyard, the forest — answers false, and so does everything
// in a session where the house has not been built yet.
export const inHouseShell = (game, pos) => {
  const b = game?.houseShell;
  if (!b || !pos) return false;
  return pos.x >= b.minX && pos.x <= b.maxX
    && pos.z >= b.minZ && pos.z <= b.maxZ
    && pos.y >= b.minY && pos.y <= b.maxY;
};

export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// frame-rate independent exponential approach
export const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));

export const angleLerp = (a, b, t) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
};

// shortest signed angular distance a->b in [-PI, PI]
export const shortAngle = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export function canvasTexture(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  // treat canvas art as linear albedo — sRGB decode would crush the dark tones
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  // 8x anisotropy: grazing-angle textures (floors, brick walls, turned wood)
  // were shimmering/crawling as you moved (playtest 3b "texture flickering")
  tex.anisotropy = 8;
  return tex;
}

// speckled noise fill used by several textures
export function speckle(g, w, h, n, colors, rng, rMin = 0.5, rMax = 2.5) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rng.float() * colors.length)];
    const r = rng.range(rMin, rMax);
    g.globalAlpha = rng.range(0.25, 0.9);
    g.fillRect(rng.float() * w, rng.float() * h, r, r);
  }
  g.globalAlpha = 1;
}
