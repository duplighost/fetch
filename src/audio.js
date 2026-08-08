// audio.js — FETCH's entire soundscape, synthesized. No sample files anywhere.
// Master chain: everything -> lowpass 7500 -> compressor -> out (eaten-path shape,
// minus the VHS wow/flutter — FETCH is not tape).
// Threat is legible through sound alone: the skull's jaw is the radar, enemy
// presence loops carry the Behind You rear-threat law, and nothing is encoded in hue.
//
// Deliberately dependency-free: util.js imports three, and this module must load
// under plain node for syntax checks, so the few helpers it needs live here.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep01 = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

// Per-zone bed levels + reverb character. Interior/outdoor/cave impulses are
// crossfaded at their wet gains — never swapped hard, or the tail clicks.
const ZONES = {
  bedroom:   { wind: 0.014, drone: 0.020, crickets: 0.004, falls: 0,     verb: 'interior' },
  house:     { wind: 0.010, drone: 0.034, crickets: 0,     falls: 0,     verb: 'interior' },
  basement:  { wind: 0,     drone: 0.050, crickets: 0,     falls: 0,     verb: 'interior' },
  graveyard: { wind: 0.050, drone: 0.012, crickets: 0.026, falls: 0,     verb: 'outdoor' },
  forest:    { wind: 0.040, drone: 0.020, crickets: 0.018, falls: 0,     verb: 'outdoor' },
  clearing:  { wind: 0.034, drone: 0.010, crickets: 0.012, falls: 0.060, verb: 'outdoor' },
  cave:      { wind: 0.008, drone: 0.044, crickets: 0,     falls: 0.016, verb: 'cave' },
  mirror:    { wind: 0,     drone: 0.060, crickets: 0,     falls: 0,     verb: 'interior' },
};
const WET = { interior: 0.18, outdoor: 0.22, cave: 0.32 };

// Enemy presence tuning (Behind You law). floor: the 'exponential' distance model
// never reaches zero, so audibility is governed by these explicit volume floors —
// the kneeler, like Behind You's boss, must always be trackable on the sound stage.
const ENEMIES = {
  walker:   { floor: 0.18, pitchRise: 0.5,  farGain: 0.85, closeGain: 0.8,  ref: 14, roll: 1.55 },
  resident: { floor: 0.18, pitchRise: 0.22, farGain: 0.9,  closeGain: 0.85, ref: 16, roll: 1.4 },
  kneeler:  { floor: 0.4,  pitchRise: 0.3,  farGain: 1.0,  closeGain: 1.0,  ref: 18, roll: 1.2 },
};

export class GameAudio {
  constructor() {
    // allocates nothing audio-side; init() must run inside a user gesture
    this._ready = false;
    this.ctx = null;
    this._zone = 'bedroom';
    this._tension = 0;
    this._hbT = 0;
    this._windT = 0;
    this._windMul = 1;
    this._windBase = ZONES.bedroom.wind;
    this._chatter = null;
    this._chatAcc = 0.9; // head start: first jaw tick lands almost immediately
    this._moan = null;
    this._loops = new Set();
    // tiny vec shim so camera.getWorldDirection works without importing three
    this._fv = {
      x: 0, y: 0, z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
      normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; },
      negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; },
      copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
      multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; },
      setFromMatrixColumn(m, i) { const e = m.elements, o = i * 4; this.x = e[o]; this.y = e[o + 1]; this.z = e[o + 2]; return this; },
    };
  }

  get ready() { return this._ready; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    if (ctx.state === 'suspended') ctx.resume();

    // master bus
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 7500;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 4; this.comp.knee.value = 12;
    this.master.connect(this.lp).connect(this.comp).connect(ctx.destination);

    // three reverb characters share one send bus; setZone crossfades the wets
    this.verbBus = ctx.createGain(); this.verbBus.gain.value = 1;
    this._wet = {};
    const impulses = { interior: [0.6, 4.5], outdoor: [1.4, 2.8], cave: [2.4, 2.2] };
    for (const k of Object.keys(impulses)) {
      const conv = ctx.createConvolver();
      conv.buffer = this._impulse(impulses[k][0], impulses[k][1]);
      const wet = ctx.createGain();
      wet.gain.value = 0.0001;
      this.verbBus.connect(conv); conv.connect(wet).connect(this.master);
      this._wet[k] = wet;
    }

    // shared pinkish noise for beds and breaths
    this._noiseBuf = this._makeNoiseBuf(2);

    // beds — all through bedGain so duck() sidechains everything at once
    this.bedGain = ctx.createGain(); this.bedGain.gain.value = 1;
    this.bedGain.connect(this.master);

    const wind = this._noiseSrc();
    const windLP = ctx.createBiquadFilter(); windLP.type = 'lowpass'; windLP.frequency.value = 320; windLP.Q.value = 0.4;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.0001;
    wind.connect(windLP).connect(this.windGain).connect(this.bedGain);

    const dr1 = ctx.createOscillator(); dr1.type = 'sawtooth'; dr1.frequency.value = 46;
    const dr2 = ctx.createOscillator(); dr2.type = 'sine'; dr2.frequency.value = 57.5;
    const drLP = ctx.createBiquadFilter(); drLP.type = 'lowpass'; drLP.frequency.value = 180;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.0001;
    dr1.connect(drLP); dr2.connect(drLP); drLP.connect(this.droneGain).connect(this.bedGain);
    dr1.start(); dr2.start();

    const falls = this._noiseSrc();
    const fLP = ctx.createBiquadFilter(); fLP.type = 'lowpass'; fLP.frequency.value = 1100;
    const fBody = ctx.createGain(); fBody.gain.value = 0.8;
    const falls2 = this._noiseSrc();
    const fBP = ctx.createBiquadFilter(); fBP.type = 'bandpass'; fBP.frequency.value = 2900; fBP.Q.value = 0.7;
    const fSpray = ctx.createGain(); fSpray.gain.value = 0.35;
    this.fallsGain = ctx.createGain(); this.fallsGain.gain.value = 0.0001;
    falls.connect(fLP).connect(fBody).connect(this.fallsGain);
    falls2.connect(fBP).connect(fSpray).connect(this.fallsGain);
    this.fallsGain.connect(this.bedGain);

    // tension layer: chamber's dread drone, silent at 0 — on master so a duck
    // (which is usually a scare) never kills the dread itself
    const t1 = ctx.createOscillator(); t1.type = 'sawtooth'; t1.frequency.value = 41.2;
    const t2 = ctx.createOscillator(); t2.type = 'sine'; t2.frequency.value = 55;
    this._tLP = ctx.createBiquadFilter(); this._tLP.type = 'lowpass'; this._tLP.frequency.value = 220;
    this._tGain = ctx.createGain(); this._tGain.gain.value = 0.0001;
    t1.connect(this._tLP); t2.connect(this._tLP); this._tLP.connect(this._tGain).connect(this.master);
    t1.start(); t2.start();

    // sub for stings/screams
    this.subOsc = ctx.createOscillator(); this.subOsc.type = 'sine'; this.subOsc.frequency.value = 42;
    this.subGain = ctx.createGain(); this.subGain.gain.value = 0.0001;
    this.subOsc.connect(this.subGain).connect(this.master);
    this.subOsc.start();

    this._bake();

    // crickets bed = looping baked chorus
    const cr = ctx.createBufferSource(); cr.buffer = this._crickLoop; cr.loop = true;
    this.cricketGain = ctx.createGain(); this.cricketGain.gain.value = 0.0001;
    cr.connect(this.cricketGain).connect(this.bedGain);
    cr.start();

    this._ready = true;
    this.setZone(this._zone);
  }

  // ---------------- synthesis helpers ----------------

  _impulse(dur, decay) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  _makeNoiseBuf(seconds) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.98 * b + 0.02 * w;
      d[i] = b * 3 + w * 0.15;
    }
    return buf;
  }

  _noiseSrc() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true; src.start();
    return src;
  }

  _mono(dur, fill) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, n, sr);
    fill(buf.getChannelData(0), sr, n);
    return buf;
  }

  // loop buffers need 12ms edge fades or they click at the seam
  _loopBuf(dur, fill) {
    const buf = this._mono(dur, fill);
    const d = buf.getChannelData(0), n = d.length;
    const fade = Math.max(1, Math.min(Math.floor(this.ctx.sampleRate * 0.012), Math.floor(n / 8)));
    for (let i = 0; i < n; i++) {
      const k = Math.min(1, Math.min(i / fade, (n - 1 - i) / fade));
      d[i] = clamp(d[i] * k, -1, 1);
    }
    return buf;
  }

  _bake() {
    const R = Math.random;
    // ---- footsteps: distinct buffers per surface ----
    this._steps = { wood: [], stone: [], dirt: [], leaves: [] };
    for (let v = 0; v < 3; v++) {
      const kf = 72 + R() * 20;
      this._steps.wood.push(this._mono(0.16, (d, sr, n) => {
        let lpv = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr, env = Math.pow(1 - i / n, 2.2) * (i < 80 ? i / 80 : 1);
          const w = R() * 2 - 1; lpv += 0.16 * (w - lpv);
          d[i] = (lpv * 0.55 + Math.sin(TAU * kf * t) * Math.exp(-t * 30) * 0.6) * env * 0.6;
        }
      }));
      const sf = 600 + R() * 170;
      this._steps.stone.push(this._mono(0.14, (d, sr, n) => {
        let lpv = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr, env = Math.pow(1 - i / n, 2.6) * (i < 50 ? i / 50 : 1);
          const w = R() * 2 - 1; lpv += 0.38 * (w - lpv);
          let s = (lpv * 0.6 + Math.sin(TAU * sf * t) * Math.exp(-t * 70) * 0.25) * env * 0.62;
          if (i < 60) s += w * 0.5 * (1 - i / 60);
          d[i] = s;
        }
      }));
      this._steps.dirt.push(this._mono(0.15, (d, sr, n) => {
        let lpv = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr, env = Math.pow(1 - i / n, 2.4) * (i < 100 ? i / 100 : 1);
          const w = R() * 2 - 1; lpv += 0.09 * (w - lpv);
          d[i] = (lpv * 0.85 + Math.sin(TAU * 58 * t) * Math.exp(-t * 40) * 0.35) * env * 0.55;
        }
      }));
    }
    for (let v = 0; v < 4; v++) {
      this._steps.leaves.push(this._mono(0.19, (d, sr, n) => {
        let lpv = 0;
        const nCr = 7 + Math.floor(R() * 8);
        const crs = Array.from({ length: nCr }, () => Math.floor(R() * n * 0.7));
        for (let i = 0; i < n; i++) {
          const env = Math.pow(1 - i / n, 1.6) * (i < 200 ? i / 200 : 1);
          const w = R() * 2 - 1; lpv += 0.25 * (w - lpv);
          d[i] = lpv * env * 0.7;
        }
        for (const c of crs) {
          const amp = 0.35 + R() * 0.5;
          for (let k = 0; k < 90 && c + k < n; k++) d[c + k] += (R() * 2 - 1) * amp * Math.pow(1 - k / 90, 3);
        }
      }));
    }
    // ---- wooden creaks (stick-slip) ----
    this._creaks = [];
    for (let v = 0; v < 3; v++) {
      this._creaks.push(this._mono(0.9, (d, sr, n) => {
        let phase = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const f = 82 - 26 * t + v * 7;
          phase += (TAU * f) / sr;
          const stick = fract(t * (30 - 20 * t)) < 0.5 ? 1 : 0.25;
          const env = Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 0.7;
          d[i] = (Math.sin(phase) * 0.5 + (R() * 2 - 1) * 0.22) * stick * env * 0.33;
        }
      }));
    }
    // ---- whisper: sibilant, wordless, close ----
    this._whisperBuf = this._mono(1.4, (d, sr, n) => {
      let bp = 0, bp2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.sin(Math.PI * Math.min(1, t / 1.4)) ** 1.5;
        const gate = 0.5 + 0.5 * Math.sin(TAU * 3.5 * t + Math.sin(t * 11));
        const w = R() * 2 - 1;
        bp = bp + 0.5 * (w - bp); bp2 = bp2 + 0.5 * (bp - bp2);
        d[i] = (bp - bp2) * gate * env * 0.5;
      }
    });
    // ---- brush crash ----
    this._brushBuf = this._mono(0.4, (d, sr, n) => {
      let lpv = 0;
      for (let i = 0; i < n; i++) {
        const env = Math.pow(1 - i / n, 1.5);
        const w = R() * 2 - 1; lpv += 0.3 * (w - lpv);
        d[i] = lpv * env * 0.7;
      }
      for (let k = 0; k < 20; k++) {
        const c = Math.floor(R() * n * 0.7);
        for (let j = 0; j < 40 && c + j < n; j++) d[c + j] += (R() * 2 - 1) * 0.5 * Math.pow(1 - j / 40, 2);
      }
    });
    // ---- splash + droplets ----
    this._splashBufs = [];
    for (let v = 0; v < 2; v++) {
      this._splashBufs.push(this._mono(0.5, (d, sr, n) => {
        let lpv = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const env = t < 0.04 ? t / 0.04 : Math.pow(Math.max(0, 1 - (t - 0.04) / 0.46), 1.7);
          const w = R() * 2 - 1; lpv += 0.2 * (w - lpv);
          d[i] = lpv * env * 0.75;
        }
        for (let k = 0; k < 6; k++) {
          const at = Math.floor(n * (0.15 + R() * 0.6)), f = 900 + R() * 1600, len = Math.floor(sr * 0.03);
          for (let j = 0; j < len && at + j < n; j++) d[at + j] += Math.sin(TAU * f * (j / sr)) * Math.exp(-j / (sr * 0.008)) * 0.3;
        }
      }));
    }
    // ---- web tear: sticky crackle, density ramps to a snap ----
    this._webBuf = this._mono(0.5, (d, sr, n) => {
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = R() * 2 - 1;
        const hp = w - prev; prev = w;
        const density = 0.015 + t * 0.3;
        const crack = R() < density ? hp * (1.5 + R() * 2) : hp * 0.12;
        const squeal = Math.sin(TAU * (1800 + t * 1400) * t) * 0.06 * Math.sin(Math.PI * t / 0.5);
        d[i] = (crack * 0.5 + squeal) * (t > 0.42 ? Math.max(0, 1 - (t - 0.42) / 0.08) : 1);
      }
      const at = Math.floor(n * 0.7);
      for (let j = 0; j < 400 && at + j < n; j++) d[at + j] += (R() * 2 - 1) * 0.7 * Math.pow(1 - j / 400, 2);
    });
    // ---- pop: the wet burst body (crack + sub are live) ----
    this._popBuf = this._mono(0.42, (d, sr, n) => {
      let lpv = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 7.5);
        const w = R() * 2 - 1; lpv += 0.14 * (w - lpv);
        const blub = Math.sin(TAU * (190 - 260 * t) * t) * Math.exp(-t * 10) * 0.5;
        d[i] = (lpv * 2.6 * env + blub) * 0.8;
      }
      for (let k = 0; k < 5; k++) {
        const at = Math.floor(R() * n * 0.35);
        for (let j = 0; j < 90 && at + j < n; j++) d[at + j] += (R() * 2 - 1) * 0.6 * Math.pow(1 - j / 90, 3);
      }
    });
    // ---- jaw ticks: soft (far, muffled bone) and hard (close, sharp rattle) ----
    this._tickSoft = []; this._tickHard = [];
    for (let v = 0; v < 3; v++) {
      const f = 500 + v * 65;
      this._tickSoft.push(this._mono(0.06, (d, sr, n) => {
        let lpv = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const w = R() * 2 - 1; lpv += 0.1 * (w - lpv);
          d[i] = Math.sin(TAU * f * t) * Math.exp(-t * 160) * 0.65 + lpv * Math.exp(-t * 120) * 0.25;
        }
      }));
      const hf = 2250 + v * 260;
      this._tickHard.push(this._mono(0.05, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const w = R() * 2 - 1;
          d[i] = w * Math.exp(-t * 400) * 0.7 + Math.sin(TAU * hf * t) * Math.exp(-t * 220) * 0.55;
        }
      }));
    }
    // ---- crickets chorus loop (4s, edge-faded) ----
    this._crickLoop = this._loopBuf(4, (d, sr, n) => {
      const chirps = [];
      for (let k = 0; k < 7; k++) chirps.push({ at: R() * 3.4, f: 3900 + R() * 700, dur: 0.32 + R() * 0.2 });
      for (let i = 0; i < n; i++) {
        const t = i / sr; let v = 0;
        for (const c of chirps) {
          if (t < c.at || t > c.at + c.dur) continue;
          const k2 = (t - c.at) / c.dur;
          const pulse = Math.max(0, Math.sin(TAU * 21 * (t - c.at))) ** 2;
          v += Math.sin(TAU * c.f * t) * pulse * Math.sin(Math.PI * k2) * 0.22;
        }
        d[i] = v;
      }
    });
    // ---- enemy presence loops: two layers each, distinct recipes ----
    this._enemyBufs = {
      walker: {
        // far: dry skeletal clicks + a dark ragged breath
        far: this._loopBuf(0.923, (d, sr, n) => {
          let lpv = 0;
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const w = R() * 2 - 1; lpv += 0.045 * (w - lpv);
            const breathe = 0.35 + 0.65 * Math.max(0, Math.sin(TAU * 1.083 * t)) ** 2;
            let s = lpv * 2.2 * breathe * 0.32;
            const ph = fract(t * 6.5);
            if (ph < 0.06) s += w * Math.exp(-ph * 120) * 0.5;
            d[i] = s;
          }
        }),
        // close pressure (Behind You chaserClose): pulse-gated chest + teeth
        close: this._loopBuf(0.32, (d, sr, n) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const pulse = 0.58 + Math.sin(TAU * 11 * t) * 0.34;
            const chest = Math.sin(TAU * 78 * t) * 0.62;
            const teeth = Math.sin(TAU * 430 * t) * 0.2;
            d[i] = (chest + teeth) * pulse * 0.58;
          }
        }),
      },
      resident: {
        // far: slow heavy drone with a wood-creak character riding the swell
        far: this._loopBuf(1.6, (d, sr, n) => {
          let ph = 0;
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const swell = 0.5 + 0.5 * Math.sin(TAU * 0.625 * t);
            const body = (Math.sin(TAU * 43 * t) * 0.55 + Math.sin(TAU * 64.7 * t) * 0.2) * (0.45 + swell * 0.55);
            ph += (TAU * (74 - 18 * swell)) / sr;
            const stick = fract(t * (11 - swell * 6)) < 0.5 ? 1 : 0.25;
            const creakv = (Math.sin(ph) * 0.4 + (R() * 2 - 1) * 0.12) * stick * swell * 0.3;
            d[i] = body * 0.42 + creakv;
          }
        }),
        close: this._loopBuf(0.7, (d, sr, n) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const breath = 0.48 + Math.sin(TAU * 1.43 * t) * 0.12;
            const sub = Math.sin(TAU * 42 * t) * 0.45;
            const rough = Math.sin(TAU * 96 * t) * 0.14;
            d[i] = (sub + rough) * breath;
          }
        }),
      },
      kneeler: {
        // far: huge slow sub thumps + wet blips
        far: this._loopBuf(1.4, (d, sr, n) => {
          let lpv = 0;
          const blips = [];
          for (let k = 0; k < 5; k++) blips.push(R() * 1.25);
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const cyc = t % 0.7;
            const thump = Math.exp(-cyc * 7);
            const sub = Math.sin(TAU * 37 * t) * thump * 0.85 + Math.sin(TAU * 18.5 * t) * 0.18;
            const w = R() * 2 - 1; lpv += 0.06 * (w - lpv);
            let wet = 0;
            for (const b of blips) if (t > b && t < b + 0.09) wet += lpv * 6 * Math.sin(Math.PI * (t - b) / 0.09);
            d[i] = sub * 0.7 + wet * 0.22;
          }
        }),
        close: this._loopBuf(0.8, (d, sr, n) => {
          let lpv = 0;
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const breath = 0.5 + Math.sin(TAU * 1.25 * t) * 0.14;
            const sub = Math.sin(TAU * 34 * t) * 0.55;
            const rough = Math.sin(TAU * 68 * t) * 0.18;
            const w = R() * 2 - 1; lpv += 0.08 * (w - lpv);
            const gargle = lpv * 4 * Math.max(0, Math.sin(TAU * 7.5 * t)) ** 3 * 0.4;
            d[i] = (sub + rough) * breath + gargle;
          }
        }),
      },
    };
  }

  // ---------------- routing helpers ----------------

  _panner(pos, ref = 2.4, roll = 1.5) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'exponential';
    p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 90;
    p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.4; p.positionZ.value = pos.z;
    return p;
  }

  _setPos(p, x, y, z, tau = 0.03) {
    const t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setTargetAtTime(x, t, tau);
      p.positionY.setTargetAtTime(y ?? 1.4, t, tau);
      p.positionZ.setTargetAtTime(z, t, tau);
    } else p.setPosition(x, y ?? 1.4, z);
  }

  // one-shot buffer player; verb send is post-envelope/post-panner, never raw source
  _play(buf, { pos = null, gain = 1, rate = 1, when = 0, verb = 0.3, dest = null } = {}) {
    if (!this._ready) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g);
    let tail = g, vs = null;
    if (pos) { const p = this._panner(pos); g.connect(p); tail = p; }
    tail.connect(dest || this.master);
    if (verb > 0) { vs = ctx.createGain(); vs.gain.value = verb; tail.connect(vs).connect(this.verbBus); }
    src.start(ctx.currentTime + when);
    src.onended = () => { try { src.disconnect(); g.disconnect(); tail.disconnect(); if (vs) vs.disconnect(); } catch {} };
    return src;
  }

  // output bus for live-synthesized one-shots: voices connect (post their own
  // envelope gains) into the returned node; verb rides the same post-env tail
  _bus(opts = {}, dur = 2, baseGain = 1, baseVerb = 0.25) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = baseGain * (opts.gain ?? 1);
    const nodes = [g];
    let tail = g;
    if (opts.pos) { const p = this._panner(opts.pos); g.connect(p); tail = p; nodes.push(p); }
    tail.connect(this.master);
    const verb = opts.verb ?? baseVerb;
    if (verb > 0) { const vs = ctx.createGain(); vs.gain.value = verb; tail.connect(vs).connect(this.verbBus); nodes.push(vs); }
    setTimeout(() => { for (const nd of nodes) { try { nd.disconnect(); } catch {} } }, (dur + 1.2) * 1000);
    return g;
  }

  // exponential envelope — clamped at 0.0001, never 0
  _env(g, t0, peak, a, d) {
    const p = g.gain;
    p.cancelScheduledValues(t0);
    p.setValueAtTime(0.0001, t0);
    p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    p.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  // ---------------- continuous state ----------------

  _setListener(pos, camera) {
    const L = this.ctx.listener, t = this.ctx.currentTime;
    const y = pos.y ?? 1.6;
    let fx = 0, fy = 0, fz = -1;
    if (camera && camera.getWorldDirection) {
      const fwd = camera.getWorldDirection(this._fv);
      fx = fwd.x; fy = fwd.y; fz = fwd.z;
    }
    if (L.positionX) {
      // setTargetAtTime (τ=0.05): hard sets zipper on fast mouse turns
      L.positionX.setTargetAtTime(pos.x, t, 0.05);
      L.positionY.setTargetAtTime(y, t, 0.05);
      L.positionZ.setTargetAtTime(pos.z, t, 0.05);
      L.forwardX.setTargetAtTime(fx, t, 0.05);
      L.forwardY.setTargetAtTime(fy, t, 0.05);
      L.forwardZ.setTargetAtTime(fz, t, 0.05);
      L.upX.setTargetAtTime(0, t, 0.05); L.upY.setTargetAtTime(1, t, 0.05); L.upZ.setTargetAtTime(0, t, 0.05);
    } else {
      L.setPosition(pos.x, y, pos.z);
      L.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  update(dt, listenerPos, camera) {
    if (!this._ready) return;
    dt = Math.min(dt || 0.016, 0.1);
    if (listenerPos) this._setListener(listenerPos, camera);

    // wind wanders; the world breathes
    this._windT -= dt;
    if (this._windT <= 0) {
      this._windT = 2 + Math.random() * 5;
      this._windMul = 0.5 + Math.random() * 1.1;
      this.windGain.gain.setTargetAtTime(Math.max(0.0001, this._windBase * this._windMul), this.ctx.currentTime, 1.2);
    }

    // tension drone — direct value damping (no scheduled events to fight)
    const k = 1 - Math.exp(-2 * dt);
    this._tGain.gain.value += (this._tension * 0.085 - this._tGain.gain.value) * k;
    this._tLP.frequency.value += (220 + this._tension * 260 - this._tLP.frequency.value) * k;

    // heartbeat: 46..138 bpm with tension (chamber recipe)
    if (this._tension > 0.12) {
      const bpm = 46 + this._tension * 92;
      this._hbT -= dt;
      if (this._hbT <= 0) { this._hbT = 60 / bpm; this._thump(0.4 + this._tension * 0.7); }
    } else this._hbT = 0;

    this._updateChatter(dt);
  }

  _thump(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const beat = (t0, f0) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      const g = ctx.createGain(); g.connect(this.master);
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t0 + 0.14);
      o.connect(g); o.start(t0); o.stop(t0 + 0.24);
      this._env(g, t0, 0.09 * vol, 0.008, 0.2);
    };
    beat(t, 62); beat(t + 0.16, 52); // lub-dub
  }

  setZone(zone) {
    this._zone = zone;
    if (!this._ready) return; // init() applies the stored zone
    const z = ZONES[zone] || ZONES.forest;
    const t = this.ctx.currentTime;
    this._windBase = z.wind;
    this.windGain.gain.setTargetAtTime(Math.max(0.0001, z.wind * this._windMul), t, 1.5);
    this.droneGain.gain.setTargetAtTime(Math.max(0.0001, z.drone), t, 1.5);
    this.cricketGain.gain.setTargetAtTime(Math.max(0.0001, z.crickets), t, 1.5);
    this.fallsGain.gain.setTargetAtTime(Math.max(0.0001, z.falls), t, 1.5);
    for (const kind of Object.keys(this._wet)) {
      this._wet[kind].gain.setTargetAtTime(kind === z.verb ? WET[kind] : 0.0001, t, 0.6);
    }
  }

  setTension(x) { this._tension = clamp01(x); }

  duck(level = 0.35, recover = 2) {
    if (!this._ready) return;
    const t = this.ctx.currentTime, g = this.bedGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + 0.08);
    g.setTargetAtTime(1, t + 0.5, recover / 3);
  }

  // ---------------- one-shots ----------------

  footstep(surface, opts = {}) {
    if (!this._ready) return;
    const set = this._steps[surface] || this._steps.dirt;
    const base = { wood: 0.5, stone: 0.5, dirt: 0.42, leaves: 0.55 }[surface] ?? 0.45;
    this._play(set[(Math.random() * set.length) | 0], {
      pos: opts.pos,
      gain: base * (opts.gain ?? 1),
      rate: (0.92 + Math.random() * 0.16) * (opts.rate ?? 1),
      verb: opts.verb ?? 0.08,
    });
  }

  creak(opts = {}) {
    if (!this._ready) return;
    this._play(this._creaks[(Math.random() * 3) | 0], {
      pos: opts.pos, gain: 0.55 * (opts.gain ?? 1),
      rate: (0.9 + Math.random() * 0.2) * (opts.rate ?? 1), verb: opts.verb ?? 0.4,
    });
  }

  doorOpen(heavy, opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime, r = opts.rate ?? 1;
    const out = this._bus(opts, 1.4, 1, 0.35);
    // hinge: a wavering squeak falling as the door swings
    const o = ctx.createOscillator(); o.type = 'sine';
    if (heavy) {
      o.frequency.setValueAtTime((420 + Math.random() * 90) * r, t);
      o.frequency.linearRampToValueAtTime((230 + Math.random() * 50) * r, t + 0.8);
    } else {
      o.frequency.setValueAtTime((1150 + Math.random() * 250) * r, t);
      o.frequency.linearRampToValueAtTime((700 + Math.random() * 120) * r, t + 0.5);
    }
    const vib = ctx.createOscillator(); vib.frequency.value = 13;
    const vg = ctx.createGain(); vg.gain.value = 42;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    this._env(g, t, heavy ? 0.28 : 0.2, 0.05, 0.55);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.75);
    vib.start(t); vib.stop(t + 0.75);
    // air moving through the frame
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g2 = ctx.createGain();
    this._env(g2, t, 0.3, 0.12, 0.45);
    src.connect(lp).connect(g2).connect(out);
    src.start(t); src.stop(t + 0.7);
  }

  doorClose(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 0.9, 1, 0.3);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 44;
    const g = ctx.createGain();
    this._env(g, t, 0.9, 0.004, 0.26);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g2 = ctx.createGain();
    this._env(g2, t, 0.8, 0.005, 0.3);
    src.connect(lp).connect(g2).connect(out);
    src.start(t); src.stop(t + 0.45);
  }

  lockedRattle(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx;
    const out = this._bus(opts, 0.9, 1, 0.2);
    // four knob-clacks, each with a wood body-knock under it — the whole
    // door works against its frame and refuses (playtest 2: "pump it")
    for (let i = 0; i < 4; i++) {
      const t = ctx.currentTime + i * 0.075;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 - i * 260; bp.Q.value = 1.2;
      const g = ctx.createGain();
      this._env(g, t, 0.55, 0.002, 0.05);
      src.connect(bp).connect(g).connect(out);
      src.start(t); src.stop(t + 0.08);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130 - i * 8, t);
      const og = ctx.createGain();
      this._env(og, t, 0.3, 0.003, 0.09);
      o.connect(og).connect(out);
      o.start(t); o.stop(t + 0.12);
    }
  }

  unlock(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 0.6, 1, 0.25);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1400;
    const g = ctx.createGain();
    this._env(g, t, 0.22, 0.002, 0.05);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.08);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 300;
    const g2 = ctx.createGain();
    this._env(g2, t + 0.09, 0.45, 0.004, 0.12);
    o2.connect(g2).connect(out); o2.start(t + 0.09); o2.stop(t + 0.3);
  }

  knock(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 0.8, 1, 0.3);
    for (const dt of [0, 0.18]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(95, t + dt);
      o.frequency.exponentialRampToValueAtTime(55, t + dt + 0.1);
      const g = ctx.createGain();
      this._env(g, t + dt, 0.55, 0.003, 0.22);
      o.connect(g).connect(out);
      o.start(t + dt); o.stop(t + dt + 0.3);
    }
  }

  metalDrop(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 0.7, 1, 0.3);
    for (const [dt, f] of [[0, 2600], [0.12, 2200], [0.2, 2400]]) {
      const o = ctx.createOscillator(); o.frequency.value = f * (opts.rate ?? 1);
      const g = ctx.createGain();
      this._env(g, t + dt, 0.28, 0.002, 0.08);
      o.connect(g).connect(out);
      o.start(t + dt); o.stop(t + dt + 0.14);
    }
  }

  stoneGrind(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 2.4, 1, 0.4);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(120, t);
    bp.frequency.linearRampToValueAtTime(200, t + 1.8);
    const g = ctx.createGain();
    this._env(g, t, 0.9, 0.3, 1.8);
    src.connect(bp).connect(g).connect(out);
    src.start(t); src.stop(t + 2.2);
  }

  fireRoar(opts = {}) {
    // the incinerator takes the offering: a swelling, hungry column of noise
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 2.2, 1, 0.3);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + 1.0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.9);
    g.gain.setValueAtTime(0.85, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
    const rumble = ctx.createOscillator(); rumble.type = 'sine';
    rumble.frequency.setValueAtTime(48, t);
    rumble.frequency.linearRampToValueAtTime(34, t + 1.4);
    const rg = ctx.createGain();
    this._env(rg, t, 0.5, 0.5, 1.0);
    src.connect(lp).connect(g).connect(out);
    rumble.connect(rg).connect(out);
    src.start(t); src.stop(t + 1.7);
    rumble.start(t); rumble.stop(t + 1.6);
  }

  fireChoke(opts = {}) {
    // ...and refuses it: a hollow backdraft whumpf, then nothing
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.4, 1, 0.45);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const og = ctx.createGain();
    this._env(og, t, 0.9, 0.012, 0.6);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 0.7);
    const g = ctx.createGain();
    this._env(g, t, 0.5, 0.01, 0.7);
    o.connect(og).connect(out);
    src.connect(lp).connect(g).connect(out);
    o.start(t); o.stop(t + 0.8);
    src.start(t); src.stop(t + 0.9);
    this.duck(0.5, 1.6);
  }

  whisper(opts = {}) {
    if (!this._ready) return;
    this._play(this._whisperBuf, {
      pos: opts.pos, gain: 0.5 * (opts.gain ?? 1),
      rate: (0.92 + Math.random() * 0.12) * (opts.rate ?? 1), verb: opts.verb ?? 0.6,
    });
  }

  glassTink(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime, r = opts.rate ?? 1;
    const out = this._bus(opts, 0.6, 1, 0.35);
    for (const [f, g0] of [[2350, 0.2], [3620, 0.11], [5210, 0.06]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.01);
      const g = ctx.createGain();
      this._env(g, t, g0, 0.002, 0.3);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.4);
    }
  }

  splash(opts = {}) {
    if (!this._ready) return;
    this._play(this._splashBufs[(Math.random() * 2) | 0], {
      pos: opts.pos, gain: 0.65 * (opts.gain ?? 1),
      rate: (0.9 + Math.random() * 0.2) * (opts.rate ?? 1), verb: opts.verb ?? 0.35,
    });
  }

  brushCrash(opts = {}) {
    if (!this._ready) return;
    this._play(this._brushBuf, {
      pos: opts.pos, gain: 0.7 * (opts.gain ?? 1),
      rate: (0.9 + Math.random() * 0.2) * (opts.rate ?? 1), verb: opts.verb ?? 0.3,
    });
  }

  webTear(opts = {}) {
    if (!this._ready) return;
    this._play(this._webBuf, {
      pos: opts.pos, gain: 0.6 * (opts.gain ?? 1),
      rate: (0.92 + Math.random() * 0.16) * (opts.rate ?? 1), verb: opts.verb ?? 0.25,
    });
  }

  thud(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 0.7, 1, 0.3);
    // speed writes the sound: intensity 0..1 lifts the pitch and body
    const inten = opts.intensity ?? 0.5;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(100 + inten * 60, t);
    o.frequency.exponentialRampToValueAtTime(34 + inten * 12, t + 0.2);
    const g = ctx.createGain();
    this._env(g, t, 0.55 + inten * 0.35, 0.002, 0.26);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.34);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g2 = ctx.createGain();
    this._env(g2, t, 0.4, 0.002, 0.18);
    src.connect(lp).connect(g2).connect(out);
    src.start(t); src.stop(t + 0.22);
    if (opts.crack) {
      // a dry bone CRACK riding the dark thud — flesh stops sounding like floor.
      // sharpness, not loudness, is what makes the quiet option read.
      const cs = ctx.createBufferSource(); cs.buffer = this._noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const cg = ctx.createGain();
      this._env(cg, t, 0.16 + inten * 0.14, 0.001, 0.055);
      cs.connect(hp).connect(cg).connect(out);
      cs.start(t); cs.stop(t + 0.08);
    }
  }

  sting(intensity = 0.5) {
    if (!this._ready) return;
    const x = clamp01(intensity);
    const ctx = this.ctx, t = ctx.currentTime;
    const freqs = [233, 246.9, 311.1, 370, 415.3];
    const count = 3 + Math.round(x * 2);
    for (let i = 0; i < count; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freqs[i];
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); g.connect(this.master);
      const vs = ctx.createGain(); vs.gain.value = 0.5; g.connect(vs).connect(this.verbBus);
      o.connect(lp).connect(g);
      o.start(t); o.stop(t + 1.4 + x);
      this._env(g, t, 0.05 + x * 0.09, 0.02, 1.3 + x);
    }
    // sub swell underneath
    const sg = this.subGain.gain;
    sg.cancelScheduledValues(t);
    sg.setValueAtTime(0.0001, t);
    sg.exponentialRampToValueAtTime(0.12 + x * 0.32, t + 0.35);
    sg.exponentialRampToValueAtTime(0.0001, t + 1.8 + x * 1.2);
    if (x > 0.5) this.duck(0.45, 2.5);
  }

  pop(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // wet burst body — LOUD
    this._play(this._popBuf, {
      pos: opts.pos, gain: 1.25 * (opts.gain ?? 1),
      rate: (0.92 + Math.random() * 0.16) * (opts.rate ?? 1), verb: opts.verb ?? 0.45,
    });
    const out = this._bus(opts, 0.8, 1, opts.verb ?? 0.45);
    // crack
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain();
    this._env(g, t, 0.9, 0.001, 0.07);
    src.connect(hp).connect(g).connect(out);
    src.start(t); src.stop(t + 0.1);
    // sub drop
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.28);
    const g2 = ctx.createGain();
    this._env(g2, t, 0.6, 0.003, 0.3);
    o.connect(g2).connect(out); o.start(t); o.stop(t + 0.4);
    this.duck(0.35, 2.5);
  }

  // ---------------- the skull's voice ----------------

  skullMoanStart() {
    if (!this._ready || this._moan) return;
    const ctx = this.ctx;
    const p = this._panner({ x: 0, y: 1.4, z: 0 }, 3.2, 1.2);
    const out = ctx.createGain(); out.gain.value = 0.0001;
    out.connect(p); p.connect(this.master);
    const vs = ctx.createGain(); vs.gain.value = 0.5;
    p.connect(vs).connect(this.verbBus);
    // hollow voice: near-unison sines through a resonant "cavity" bandpass
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 130;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 130 * 2.01;
    const o2g = ctx.createGain(); o2g.gain.value = 0.35;
    const cavity = ctx.createBiquadFilter(); cavity.type = 'bandpass'; cavity.frequency.value = 420; cavity.Q.value = 2.2;
    const voice = ctx.createGain(); voice.gain.value = 0.55;
    o1.connect(cavity); o2.connect(o2g).connect(cavity); cavity.connect(voice).connect(out);
    // breath through the eye sockets
    const breath = ctx.createBufferSource(); breath.buffer = this._noiseBuf; breath.loop = true;
    const bbp = ctx.createBiquadFilter(); bbp.type = 'bandpass'; bbp.frequency.value = 900; bbp.Q.value = 0.8;
    const bg = ctx.createGain(); bg.gain.value = 0.1;
    breath.connect(bbp).connect(bg).connect(out);
    // whoosh — only speaks on fast returns
    const whoosh = ctx.createBufferSource(); whoosh.buffer = this._noiseBuf; whoosh.loop = true;
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 500; wbp.Q.value = 1.1;
    const wg = ctx.createGain(); wg.gain.value = 0.0001;
    whoosh.connect(wbp).connect(wg).connect(out);
    // AM tremble — the depth gain sums into voice.gain, so stop() must fade it too
    const am = ctx.createOscillator(); am.frequency.value = 5.2;
    const amDepth = ctx.createGain(); amDepth.gain.value = 0.16;
    am.connect(amDepth).connect(voice.gain);
    o1.start(); o2.start(); breath.start(); whoosh.start(); am.start();
    out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
    this._moan = { p, out, vs, o1, o2, cavity, am, amDepth, wg, wbp, nodes: [o1, o2, breath, whoosh, am] };
  }

  skullMoanUpdate(pos, speed, tension) {
    const m = this._moan;
    if (!m || !this._ready) return;
    const t = this.ctx.currentTime;
    this._setPos(m.p, pos.x, pos.y, pos.z);
    const s = clamp(speed / 24, 0, 1.5);   // normalized flight speed
    const ten = clamp01(tension);
    // pitch: 110..350 with how "called" it is, rising with speed into a whoosh-scream
    const f0 = (110 + ten * 240) * (1 + s * 0.55);
    m.o1.frequency.setTargetAtTime(f0, t, 0.06);
    m.o2.frequency.setTargetAtTime(f0 * 2.01, t, 0.06);
    m.cavity.frequency.setTargetAtTime(320 + f0 * 1.6 + s * 900, t, 0.08);
    m.am.frequency.setTargetAtTime(4.2 + ten * 5 + s * 3, t, 0.1);
    m.wg.gain.setTargetAtTime(Math.max(0.0001, s * 0.5), t, 0.05);
    m.wbp.frequency.setTargetAtTime(400 + s * 2600, t, 0.05);
    m.out.gain.setTargetAtTime(0.34 + ten * 0.3 + s * 0.28, t, 0.08);
  }

  skullMoanStop() {
    const m = this._moan;
    if (!m) return;
    this._moan = null;
    const t = this.ctx.currentTime;
    m.out.gain.cancelScheduledValues(t);
    m.out.gain.setTargetAtTime(0.0001, t, 0.12);
    m.amDepth.gain.setTargetAtTime(0.0001, t, 0.1); // fade the AM depth too, or it never dies
    setTimeout(() => {
      for (const nd of m.nodes) { try { nd.stop(); } catch {} }
      try { m.p.disconnect(); m.vs.disconnect(); m.out.disconnect(); } catch {}
    }, 700);
  }

  // THE THREAT RADAR. Call per-frame with 0..1: rate and sharpness carry the
  // information — soft slow ticks far away, hard fast rattle when death is close.
  skullChatter(level, pos) {
    if (!this._ready) return;
    const lv = clamp01(level);
    if (lv <= 0.001) { this._chatter = null; return; }
    if (!this._chatter) this._chatAcc = 0.9; // waking radar answers immediately
    this._chatter = { level: lv, pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : null, fresh: 0.25 };
  }

  _updateChatter(dt) {
    const c = this._chatter;
    if (!c) return;
    c.fresh -= dt;
    if (c.fresh <= 0) { this._chatter = null; return; } // caller stopped feeding us
    const rate = lerp(1.6, 15, smoothstep01(c.level));
    this._chatAcc += dt * rate;
    while (this._chatAcc >= 1) {
      this._chatAcc -= 1;
      const hard = smoothstep01((c.level - 0.3) / 0.7);
      const set = Math.random() < hard ? this._tickHard : this._tickSoft;
      this._play(set[(Math.random() * set.length) | 0], {
        pos: c.pos,
        gain: 0.35 + c.level * 0.75,
        rate: 0.92 + Math.random() * 0.16 + hard * 0.2,
        verb: 0.12,
      });
    }
  }

  skullScream(pos) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus({ pos }, 4.5, 1, 0.9); // long verb tail
    // formant-ish wail: saw source through parallel voice-band peaks
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(150, t);
    src.frequency.exponentialRampToValueAtTime(330, t + 0.5);
    src.frequency.setValueAtTime(330, t + 1.4);
    src.frequency.exponentialRampToValueAtTime(120, t + 2.6);
    const vib = ctx.createOscillator(); vib.frequency.value = 6.5;
    const vg = ctx.createGain(); vg.gain.value = 12;
    vib.connect(vg).connect(src.frequency);
    const srcG = ctx.createGain();
    srcG.gain.setValueAtTime(0.0001, t);
    srcG.gain.exponentialRampToValueAtTime(0.9, t + 0.08);
    srcG.gain.exponentialRampToValueAtTime(0.5, t + 1.8);
    srcG.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    src.connect(srcG);
    for (const [f, q, g0] of [[640, 8, 0.5], [1150, 9, 0.38], [2600, 11, 0.2]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = g0;
      srcG.connect(bp); bp.connect(bg).connect(out);
    }
    src.start(t); src.stop(t + 3.3);
    vib.start(t); vib.stop(t + 3.3);
    // torn-throat noise layer
    const nz = ctx.createBufferSource(); nz.buffer = this._noiseBuf;
    const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1500; nbp.Q.value = 1.2;
    const ng = ctx.createGain();
    this._env(ng, t, 0.3, 0.1, 2.6);
    nz.connect(nbp).connect(ng).connect(out);
    nz.start(t); nz.stop(t + 2.9);
    // sub dread
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(60, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 2.4);
    const sg = ctx.createGain();
    this._env(sg, t, 0.5, 0.06, 2.5);
    sub.connect(sg).connect(out);
    sub.start(t); sub.stop(t + 2.8);
    this.duck(0.12, 4); // ducks everything hard
  }

  catchThud(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 0.6, 1, 0.15);
    // palm thud
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain();
    this._env(g, t, 0.6, 0.003, 0.16);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.22);
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g2 = ctx.createGain();
    this._env(g2, t, 0.3, 0.002, 0.1);
    src.connect(lp).connect(g2).connect(out);
    src.start(t); src.stop(t + 0.14);
    // tooth click as the jaw claps shut
    this._play(this._tickHard[(Math.random() * 3) | 0], {
      pos: opts.pos, gain: 0.5 * (opts.gain ?? 1), rate: 1.1, when: 0.03, verb: 0.1,
    });
  }

  // ---------------- enemy presence loops ----------------

  // Two-layer presence per Behind You: a far loop that carries the threat math and
  // a close-pressure loop that only exists inside arm's reach. The caller feeds
  // setThreat with its own smoothstepped threat/near/rear terms — rear MUST be
  // computed on y-flattened vectors or looking down reads as "behind you".
  enemyLoop(kind) {
    if (!this._ready) return { setPos() {}, setThreat() {}, stop() {} };
    const ctx = this.ctx;
    const cfg = ENEMIES[kind] || ENEMIES.walker;
    const bufs = this._enemyBufs[kind] || this._enemyBufs.walker;
    const farP = this._panner({ x: 0, y: 1.4, z: 0 }, cfg.ref, cfg.roll);
    const closeP = this._panner({ x: 0, y: 1.4, z: 0 }, 5.5, 0.85);
    farP.connect(this.master); closeP.connect(this.master);
    const farSrc = ctx.createBufferSource(); farSrc.buffer = bufs.far; farSrc.loop = true;
    const farG = ctx.createGain(); farG.gain.value = 0.0001;
    farSrc.connect(farG).connect(farP);
    const closeSrc = ctx.createBufferSource(); closeSrc.buffer = bufs.close; closeSrc.loop = true;
    const closeG = ctx.createGain(); closeG.gain.value = 0.0001;
    closeSrc.connect(closeG).connect(closeP);
    farSrc.start(); closeSrc.start();
    const self = this;
    const h = {
      _dead: false,
      setPos(x, y, z) {
        if (this._dead) return;
        self._setPos(farP, x, y, z);
        self._setPos(closeP, x, y, z);
      },
      choke(dur = 0.5) {
        // the hit punches a hole in the creature's drone — its voice gasps
        if (this._dead) return;
        const t = ctx.currentTime;
        this._chokeT = t + 0.4;
        for (const gg of [farG, closeG]) {
          const held = gg.gain.value;
          gg.gain.cancelScheduledValues(t);
          gg.gain.setTargetAtTime(0.03, t, 0.02);
          gg.gain.setTargetAtTime(Math.max(0.0001, held), t + 0.12, dur * 0.6);
        }
        farSrc.playbackRate.setTargetAtTime(0.6, t, 0.03);
        farSrc.playbackRate.setTargetAtTime(1, t + 0.15, dur);
      },
      setThreat(threat, near, rear) {
        if (this._dead) return;
        if (this._chokeT && ctx.currentTime < this._chokeT) return;
        const t = ctx.currentTime;
        const panic = clamp01(near * near + rear * 0.45);
        // volume = floor + threat*0.42 + near*0.28 + rear*0.28 (Behind You law)
        const farVol = clamp01(cfg.floor + threat * 0.42 + near * 0.28 + rear * 0.28) * cfg.farGain;
        farG.gain.setTargetAtTime(Math.max(0.0001, farVol), t, 0.08);
        farSrc.playbackRate.setTargetAtTime(1 + threat * cfg.pitchRise * 0.45 + panic * cfg.pitchRise * 0.85, t, 0.1);
        const nearVol = clamp01(Math.pow(clamp01(near), 1.65) * 0.72 + panic * 0.55) * cfg.closeGain;
        closeG.gain.setTargetAtTime(Math.max(0.0001, nearVol), t, 0.08);
        closeSrc.playbackRate.setTargetAtTime(0.78 + near * 0.5 + panic * 0.5, t, 0.1);
      },
      stop() {
        if (this._dead) return;
        this._dead = true;
        const t = ctx.currentTime;
        farG.gain.cancelScheduledValues(t); farG.gain.setTargetAtTime(0.0001, t, 0.15);
        closeG.gain.cancelScheduledValues(t); closeG.gain.setTargetAtTime(0.0001, t, 0.15);
        setTimeout(() => {
          try { farSrc.stop(); closeSrc.stop(); } catch {}
          try { farP.disconnect(); closeP.disconnect(); } catch {}
        }, 900);
        self._loops.delete(h);
      },
    };
    this._loops.add(h);
    return h;
  }

  // ---------------- teardown ----------------

  stopAll() {
    if (!this._ready) return;
    const t = this.ctx.currentTime;
    for (const h of Array.from(this._loops)) h.stop();
    this.skullMoanStop();
    this._chatter = null;
    this._tension = 0;
    this._hbT = 0;
    this.subGain.gain.cancelScheduledValues(t);
    this.subGain.gain.setTargetAtTime(0.0001, t, 0.1);
    for (const g of [this.windGain, this.droneGain, this.cricketGain, this.fallsGain]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.25);
    }
    // clear any in-flight duck; beds stay alive but silent — the next setZone()
    // brings them back without re-allocating anything
    this.bedGain.gain.cancelScheduledValues(t);
    this.bedGain.gain.setTargetAtTime(1, t, 0.5);
  }
}
