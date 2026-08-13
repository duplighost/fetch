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
    // Forest story props are ordinary owned loop handles, but their separate
    // set makes the two-voice budget an invariant of the audio engine rather
    // than a promise every caller has to remember.
    this._forestStoryLoops = new Set();
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
    // FETCH's synthesized palette tops out well below 12 kHz (the master
    // low-pass is 7.5 kHz), so generating every procedural buffer at a 48 kHz
    // hardware rate burned roughly twice the CPU and memory for frequencies the
    // mix intentionally removes. Request a 24 kHz interactive context; Chrome
    // resamples once at output and every authored oscillator/filter remains
    // comfortably under Nyquist. Keep a constructor fallback for older WebAudio
    // implementations that do not accept options.
    let ctx;
    try { ctx = new AC({ latencyHint: 'interactive', sampleRate: 24000 }); }
    catch { ctx = new AC(); }
    this.ctx = ctx;
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
    this._impulseSpecs = { interior: [0.6, 4.5], outdoor: [1.4, 2.8], cave: [2.4, 2.2] };
    this._convolvers = {};
    for (const k of Object.keys(this._impulseSpecs)) {
      const conv = ctx.createConvolver();
      // Bedroom/house need the interior tail on the first frame. Later-act
      // spaces prepare their own impulse only when setZone first reaches them;
      // generating 3.8 seconds of unused stereo noise inside Start was a large
      // part of the reported cold-input hitch.
      if (k === 'interior') {
        const spec = this._impulseSpecs[k];
        conv.buffer = this._impulse(spec[0], spec[1]);
      }
      const wet = ctx.createGain();
      wet.gain.value = 0.0001;
      this.verbBus.connect(conv); conv.connect(wet).connect(this.master);
      this._wet[k] = wet;
      this._convolvers[k] = conv;
    }

    // shared pinkish noise for beds and breaths
    this._noiseBuf = this._makeNoiseBuf(1.5);

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
    this._queueForestStoryPrewarm?.();
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
    this._whisperBuf = this._mono(1.0, (d, sr, n) => {
      let bp = 0, bp2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.sin(Math.PI * Math.min(1, t / 1.0)) ** 1.5;
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
    // ---- grave walkers: dirt-birth, committed inhale, missed collapse ----
    // These are positional body sounds, not score stings. The player hears the
    // soil/cloth before a risen silhouette, then gets one unmistakable inhale
    // for the lethal commitment and a dry exhale when sprinting clears it.
    this._walkerRiseBuf = this._mono(1.08, (d, sr, n) => {
      let dirt = 0, cloth = 0;
      const knocks = [0.19, 0.43, 0.76];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = R() * 2 - 1;
        dirt += 0.09 * (w - dirt);
        cloth += 0.012 * (w - cloth);
        const rise = Math.sin(Math.PI * Math.min(1, t / 1.02));
        let bones = 0;
        for (const at of knocks) {
          const q = t - at;
          if (q >= 0 && q < 0.055) bones += Math.sin(TAU * (310 - q * 1700) * q) * Math.exp(-q * 85);
        }
        d[i] = dirt * rise * 1.8 + cloth * rise * 0.42 + bones * 0.34;
      }
    });
    this._walkerStrikeBuf = this._mono(0.74, (d, sr, n) => {
      let breath = 0, prev = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = R() * 2 - 1;
        breath += 0.045 * (w - breath);
        const hp = w - prev; prev = w;
        const draw = Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.66)), 0.8);
        const throat = Math.sin(TAU * (68 + t * 52) * t) * (0.18 + draw * 0.32);
        const jawAt = t - 0.23;
        const jaw = jawAt >= 0 && jawAt < 0.065
          ? hp * Math.exp(-jawAt * 95) * 0.72
          : 0;
        d[i] = breath * draw * 2.8 + throat * draw + jaw;
      }
    });
    this._walkerMissBuf = this._mono(0.48, (d, sr, n) => {
      let breath = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = R() * 2 - 1;
        breath += 0.07 * (w - breath);
        const env = Math.exp(-t * 6.2);
        const jaw = Math.max(0, Math.sin(TAU * 17 * t)) ** 7;
        d[i] = breath * env * 2.1 + Math.sin(TAU * 118 * t) * env * 0.2 + w * jaw * env * 0.16;
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
    this._crickLoop = this._loopBuf(1.5, (d, sr, n) => {
      const chirps = [];
      for (let k = 0; k < 3; k++) chirps.push({ at: R() * 1.15, f: 3900 + R() * 700, dur: 0.26 + R() * 0.18 });
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
    // ---- found machines in the forest -----------------------------------
    // Eight identities, one deterministic recipe each. The world owns where
    // they are and which two deserve voices; these buffers only make a phone
    // impossible to confuse with a washer or a tree squeal in darkness.
    // This late-act bank is prepared one identity per idle slice. Baking all
    // eight inside Start added a measured ~162ms long task; baking them on first
    // contact merely moved the hitch into the forest. Chunked prewarm keeps both
    // moments clean and still guarantees a synchronous fallback for unusual
    // test/debug teleports that outrun the queue.
    this._forestStoryBufs = {};
    const fixedNoise = (i, seed) => fract(Math.sin((i + seed * 131) * 12.9898) * 43758.5453) * 2 - 1;
    this._forestStoryRecipes = {
      radio: () => this._loopBuf(2.0, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const bar = Math.floor((t / 0.4) % 6);
          const chord = [196, 247, 294, 220, 262, 330][bar];
          const wow = 1 + Math.sin(TAU * 0.53 * t) * 0.012;
          const music = Math.sin(TAU * chord * wow * t) * 0.23
            + Math.sin(TAU * chord * 1.5 * wow * t + 0.7) * 0.11;
          const staticV = fixedNoise(i, 1) * (0.08 + Math.max(0, Math.sin(TAU * 2.5 * t)) * 0.06);
          d[i] = music * (0.62 + Math.sin(TAU * 1.25 * t) * 0.22) + staticV;
        }
      }),
      phone: () => this._loopBuf(2.4, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr, phase = t % 1.4;
          const gate = phase < 0.48 ? Math.sin(Math.PI * phase / 0.48) ** 0.5 : 0;
          d[i] = (Math.sin(TAU * 440 * t) * 0.31 + Math.sin(TAU * 480 * t) * 0.27) * gate;
        }
      }),
      swing: () => this._loopBuf(1.65, (d, sr, n) => {
        let ph = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const arc = Math.sin(Math.PI * t / 1.65);
          const f = 118 - arc * 52;
          ph += TAU * f / sr;
          const stick = fract(t * (17 - arc * 8)) < 0.42 ? 1 : 0.18;
          d[i] = (Math.sin(ph) * 0.33 + fixedNoise(i, 2) * 0.06) * stick * arc;
        }
      }),
      washer: () => this._loopBuf(1.2, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr, cyc = fract(t / 0.4);
          const thump = Math.exp(-cyc * 20);
          d[i] = Math.sin(TAU * 54 * t) * 0.16
            + Math.sin(TAU * 33 * t) * thump * 0.55
            + fixedNoise(i, 3) * thump * 0.08;
        }
      }),
      fridge: () => this._loopBuf(2.0, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const compressor = 0.75 + Math.sin(TAU * 0.5 * t) * 0.08;
          const tick = t > 1.72 && t < 1.76 ? Math.exp(-(t - 1.72) * 120) : 0;
          d[i] = (Math.sin(TAU * 60 * t) * 0.28 + Math.sin(TAU * 120 * t) * 0.08) * compressor
            + fixedNoise(i, 4) * tick * 0.26;
        }
      }),
      crt: () => this._loopBuf(1.5, (d, sr, n) => {
        let hiss = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr, w = fixedNoise(i, 5);
          hiss += 0.38 * (w - hiss);
          const scan = Math.max(0, Math.sin(TAU * 11.8 * t)) ** 8;
          d[i] = Math.sin(TAU * 3920 * t) * 0.07 + hiss * 0.24 + w * scan * 0.13;
        }
      }),
      bell: () => this._loopBuf(2.6, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr, env = Math.exp(-t * 1.36);
          d[i] = (Math.sin(TAU * 146 * t) * 0.42
            + Math.sin(TAU * 231.4 * t + 0.3) * 0.22
            + Math.sin(TAU * 376 * t + 1.1) * 0.11) * env;
        }
      }),
      generator: () => this._loopBuf(0.72, (d, sr, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / sr, cyc = fract(t * 5.555);
          const fire = Math.exp(-cyc * 15);
          d[i] = Math.sin(TAU * 47 * t) * 0.22
            + Math.sin(TAU * 94 * t) * 0.09
            + fixedNoise(i, 6) * fire * 0.24;
        }
      }),
    };
    this._storyBakeMs = 0;
    this._storyPrewarmMaxChunkMs = 0;
    this._storyPrewarmReady = false;
    this._storyPrewarmCancelled = false;
    this._bakeForestStoryKind = (kind) => {
      if (this._forestStoryBufs[kind]) return this._forestStoryBufs[kind];
      const recipe = this._forestStoryRecipes[kind];
      if (!recipe) return null;
      const at = typeof performance !== 'undefined' ? performance.now() : 0;
      const buffer = recipe();
      const elapsed = typeof performance !== 'undefined' ? performance.now() - at : 0;
      this._storyBakeMs += elapsed;
      this._storyPrewarmMaxChunkMs = Math.max(this._storyPrewarmMaxChunkMs, elapsed);
      this._forestStoryBufs[kind] = buffer;
      return buffer;
    };
    this._queueForestStoryPrewarm = () => {
      if (this._storyPrewarmReady || this._storyPrewarmHandle) return;
      this._storyPrewarmCancelled = false;
      const remaining = Object.keys(this._forestStoryRecipes)
        .filter((kind) => !this._forestStoryBufs[kind]);
      const schedule = (fn) => {
        if (typeof requestIdleCallback === 'function') {
          this._storyPrewarmHandle = requestIdleCallback(fn, { timeout: 180 });
        } else {
          this._storyPrewarmHandle = setTimeout(fn, 24);
        }
      };
      const pump = () => {
        this._storyPrewarmHandle = null;
        if (this._storyPrewarmCancelled || !this._ready) return;
        const kind = remaining.shift();
        if (kind) this._bakeForestStoryKind(kind);
        if (remaining.length) schedule(pump);
        else this._storyPrewarmReady = true;
      };
      if (remaining.length) schedule(pump);
      else this._storyPrewarmReady = true;
    };
    this._cancelForestStoryPrewarm = () => {
      this._storyPrewarmCancelled = true;
      if (this._storyPrewarmHandle != null) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this._storyPrewarmHandle);
        else clearTimeout(this._storyPrewarmHandle);
        this._storyPrewarmHandle = null;
      }
    };
    // ---- enemy presence loops: two layers each, distinct recipes ----
    this._enemyBufs = {};
    this._bakeEnemyBuffers = () => {
      if (this._enemyBufs.walker) return;
    this._enemyBufs = {
      walker: {
        // Far: one asymmetrical lung drags through a loose jaw. The events do
        // not share a clock, so this reads as a body occupying the room rather
        // than a short sound-effect loop restarting beside the player.
        far: this._loopBuf(1.37, (d, sr, n) => {
          let dark = 0;
          const clicks = [0.08, 0.34, 0.79, 1.13].map((at) => at + R() * 0.055);
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const w = fixedNoise(i, 11);
            dark += 0.032 * (w - dark);
            const lung = 0.14 + Math.max(0, Math.sin(TAU * (t / 1.37 - 0.11))) ** 1.8 * 0.86;
            let s = dark * 1.9 * lung * 0.36;
            for (let k = 0; k < clicks.length; k++) {
              const age = t - clicks[k];
              if (age >= 0 && age < 0.075) {
                const snap = Math.exp(-age * (54 + k * 8));
                s += (Math.sin(TAU * (310 + k * 97) * age) * 0.42 + (w - dark) * 0.46) * snap;
              }
            }
            d[i] = s * 0.78;
          }
        }),
        // Close: two chest pulses fall slightly out of phase with a held,
        // stop-motion tooth tremor. Locomotion stays smooth; only the mouth is
        // allowed to sound mechanically discontinuous.
        close: this._loopBuf(0.71, (d, sr, n) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const p0 = Math.exp(-fract(t / 0.355) * 10.5);
            const p1 = Math.exp(-fract((t + 0.083) / 0.403) * 13);
            const chest = Math.sin(TAU * (72 + Math.sin(TAU * 1.4 * t) * 5) * t) * (p0 * 0.48 + p1 * 0.22);
            const held = Math.sin((Math.floor(t * 14) + 3) * 12.9898) > 0.15 ? 1 : 0.12;
            const teeth = Math.sin(TAU * 477 * t) * held * 0.11;
            d[i] = chest + teeth;
          }
        }),
      },
      resident: {
        // Far: several incompatible fundamentals bend through the house, with
        // real stick-slip transients embedded in the mass. It should sound as
        // though the frame is speaking through the Resident, not like a synth
        // pad assigned to a monster.
        far: this._loopBuf(2.2, (d, sr, n) => {
          let wood = 0;
          const breaks = [0.42 + R() * 0.08, 1.36 + R() * 0.12, 1.91 + R() * 0.06];
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const swell = 0.26 + Math.max(0, Math.sin(TAU * (t / 2.2 - 0.16))) ** 1.45 * 0.74;
            const body = Math.sin(TAU * (41.5 * t + Math.sin(TAU * 0.31 * t) * 1.8)) * 0.34
              + Math.sin(TAU * 61.3 * t + 1.7) * 0.19
              + Math.sin(TAU * 89.1 * t + 4.2) * 0.08;
            const w = fixedNoise(i, 17); wood += 0.055 * (w - wood);
            let snap = 0;
            for (const at of breaks) {
              const age = t - at;
              if (age >= 0 && age < 0.14) snap += (w - wood) * Math.exp(-age * 23) * 0.72;
            }
            d[i] = body * swell + snap;
          }
        }),
        close: this._loopBuf(0.94, (d, sr, n) => {
          let throat = 0;
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const breath = 0.22 + Math.max(0, Math.sin(TAU * (t / 0.94 - 0.12))) ** 1.4 * 0.78;
            const flutter = 0.54 + Math.sin(TAU * 19.4 * t + Math.sin(TAU * 2.1 * t)) * 0.21;
            const voices = Math.sin(TAU * 38.5 * t) * 0.36
              + Math.sin(TAU * 57.8 * t + 0.8) * 0.19
              + Math.sin(TAU * 87.4 * t + 2.3) * 0.09;
            const w = fixedNoise(i, 23); throat += 0.09 * (w - throat);
            d[i] = voices * breath * flutter + throat * breath * 0.18;
          }
        }),
      },
      kneeler: {
        // Far: body weight lands on an irregular three-beat gait while small,
        // much faster contacts scramble above it. Size comes from the split
        // between those time scales, not simply turning up a sub oscillator.
        far: this._loopBuf(1.82, (d, sr, n) => {
          let wet = 0;
          const loads = [0.02, 0.73 + R() * 0.08, 1.34 + R() * 0.09];
          const skitters = [0.19, 0.31, 0.96, 1.07, 1.55, 1.66].map((at) => at + R() * 0.035);
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            let body = Math.sin(TAU * 18.2 * t) * 0.08;
            for (const at of loads) {
              const age = t - at;
              if (age >= 0 && age < 0.38) {
                body += Math.sin(TAU * (38 - age * 31) * age) * Math.exp(-age * 8) * 0.78;
              }
            }
            const w = fixedNoise(i, 29); wet += 0.12 * (w - wet);
            let feet = 0;
            for (const at of skitters) {
              const age = t - at;
              if (age >= 0 && age < 0.055) feet += (w - wet) * Math.exp(-age * 72) * 0.62;
            }
            d[i] = body + feet;
          }
        }),
        close: this._loopBuf(0.96, (d, sr, n) => {
          let gorge = 0;
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const breath = 0.3 + Math.max(0, Math.sin(TAU * (t / 0.96 - 0.08))) ** 1.7 * 0.7;
            const sub = Math.sin(TAU * (31.5 + Math.sin(TAU * 1.04 * t) * 2.5) * t) * 0.43;
            const w = fixedNoise(i, 31); gorge += 0.075 * (w - gorge);
            const heldStep = Math.sin((Math.floor(t * 22) + 9) * 78.233) > 0.22 ? 1 : 0.08;
            const scrape = (w - gorge) * heldStep * 0.22;
            d[i] = sub * breath + gorge * breath * 0.27 + scrape;
          }
        }),
      },
    };
    };

    // The Drowned Choir is not in the walker palette. Its far layer is three
    // almost-human fundamentals sharing one lung; the close layer is pressure
    // hiss and displaced droplets. Both are routed through moving HRTF panners
    // by drownedChoirLoop() below.
    this._choirBufs = {};
    this._bakeChoirBuffers = () => {
      if (this._choirBufs.far) return;
    this._choirBufs = {
      far: this._loopBuf(2.4, (d, sr, n) => {
        let wet = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const lung = 0.28 + Math.max(0, Math.sin(TAU * (t / 2.4))) ** 1.7 * 0.72;
          const wobble = Math.sin(TAU * 0.42 * t) * 1.8;
          const voices =
            Math.sin(TAU * (52 + wobble) * t) * 0.36
            + Math.sin(TAU * (65.5 - wobble * 0.7) * t + 1.7) * 0.25
            + Math.sin(TAU * (78.2 + wobble * 0.35) * t + 3.9) * 0.17;
          const w = R() * 2 - 1;
          wet += 0.035 * (w - wet);
          d[i] = (voices * lung + wet * 1.8 * (0.2 + lung * 0.45)) * 0.62;
        }
      }),
      pressure: this._loopBuf(0.72, (d, sr, n) => {
        let lpv = 0, last = 0;
        for (let i = 0; i < n; i++) {
          const t = i / sr;
          const w = R() * 2 - 1;
          lpv += 0.22 * (w - lpv);
          const spray = w - last; last = w;
          const swell = 0.2 + 0.8 * Math.max(0, Math.sin(TAU * 1.39 * t)) ** 2;
          const throat = Math.sin(TAU * 116 * t + Math.sin(TAU * 7 * t) * 0.7) * 0.18;
          const bead = fract(t * 9.7) < 0.035 ? spray * 0.8 : 0;
          d[i] = (lpv * 1.9 * swell + spray * 0.1 + throat * swell + bead) * 0.5;
        }
      }),
    };
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
    if (opts.pos) {
      const p = this._panner(opts.pos, opts.ref ?? 2.4, opts.roll ?? 1.5);
      g.connect(p); tail = p; nodes.push(p);
    }
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
    const convolver = this._convolvers?.[z.verb];
    if (convolver && !convolver.buffer) {
      const spec = this._impulseSpecs[z.verb];
      convolver.buffer = this._impulse(spec[0], spec[1]);
    }
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

  ironGateCreak(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 2.5, 1, 0.55);
    // A broad iron hinge complains continuously as the leaves move. The old
    // three-note metal-drop read as a latch falling, not a cemetery gate.
    const scrape = ctx.createBufferSource();
    scrape.buffer = this._noiseBuf;
    scrape.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 8;
    bp.frequency.setValueAtTime(720 * (opts.rate ?? 1), t);
    bp.frequency.exponentialRampToValueAtTime(170 * (opts.rate ?? 1), t + 1.85);
    const scrapeGain = ctx.createGain();
    scrapeGain.gain.setValueAtTime(0.0001, t);
    scrapeGain.gain.exponentialRampToValueAtTime(0.34 * (opts.gain ?? 1), t + 0.12);
    scrapeGain.gain.setTargetAtTime(0.16 * (opts.gain ?? 1), t + 0.65, 0.5);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    scrape.connect(bp).connect(scrapeGain).connect(out);
    scrape.start(t); scrape.stop(t + 2.15);
    for (const [i, base] of [82, 119, 173].entries()) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(base * (opts.rate ?? 1), t);
      o.frequency.linearRampToValueAtTime((base * 0.62 + i * 5) * (opts.rate ?? 1), t + 1.9);
      const wobble = ctx.createOscillator(); wobble.frequency.value = 5.4 + i * 2.1;
      const wobbleGain = ctx.createGain(); wobbleGain.gain.value = 4.5 + i * 2;
      wobble.connect(wobbleGain).connect(o.frequency);
      const g = ctx.createGain();
      this._env(g, t, (0.18 - i * 0.035) * (opts.gain ?? 1), 0.08 + i * 0.04, 1.9);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 2.05);
      wobble.start(t); wobble.stop(t + 2.05);
    }
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

  // A real struck servant bell, not the generic metal-drop cluster.  The
  // inharmonic partials and long positional tail make the window relay audible
  // from either floor, so its causal payoff cannot be mistaken for a loose
  // latch.  Brightness, motion and this sound all tell the same state change.
  bellRing(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const rate = opts.rate ?? 1;
    const out = this._bus(opts, 3.4, 0.92, opts.verb ?? 0.78);
    for (const [frequency, peak, decay, phase] of [
      [512, 0.42, 2.7, 0],
      [731, 0.3, 2.35, 0.35],
      [1049, 0.19, 1.85, 0.8],
      [1486, 0.1, 1.25, 1.2],
    ]) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * rate;
      oscillator.detune.value = Math.sin(phase) * 5;
      const gain = ctx.createGain();
      this._env(gain, t, peak, 0.0025, decay);
      oscillator.connect(gain).connect(out);
      oscillator.start(t);
      oscillator.stop(t + decay + 0.04);
    }
    const strike = ctx.createBufferSource();
    strike.buffer = this._noiseBuf;
    const strikeFilter = ctx.createBiquadFilter();
    strikeFilter.type = 'bandpass';
    strikeFilter.frequency.value = 2780 * rate;
    strikeFilter.Q.value = 1.7;
    const strikeGain = ctx.createGain();
    this._env(strikeGain, t, 0.34, 0.0015, 0.055);
    strike.connect(strikeFilter).connect(strikeGain).connect(out);
    strike.start(t);
    strike.stop(t + 0.08);
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

  // A wordless human inhale for the final black. The noise breath rises toward
  // a tight, involuntary glottal catch; both layers share the HRTF bus so the
  // stranger occupies a precise point just behind the listener instead of
  // reading as another generic centered whisper.
  gasp(opts = {}) {
    if (!this._ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.25, 0.72, 0.7);
    const breath = ctx.createBufferSource();
    breath.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.72;
    bp.frequency.setValueAtTime(520, t);
    bp.frequency.exponentialRampToValueAtTime(2100, t + 0.62);
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, t);
    breathGain.gain.exponentialRampToValueAtTime(0.58, t + 0.5);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);
    breath.connect(bp).connect(breathGain).connect(out);
    breath.start(t); breath.stop(t + 0.86);

    const throat = ctx.createOscillator();
    throat.type = 'triangle';
    throat.frequency.setValueAtTime(92, t + 0.38);
    throat.frequency.exponentialRampToValueAtTime(154, t + 0.66);
    const throatGain = ctx.createGain();
    throatGain.gain.setValueAtTime(0.0001, t + 0.36);
    throatGain.gain.exponentialRampToValueAtTime(0.14, t + 0.57);
    throatGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.73);
    throat.connect(throatGain).connect(out);
    throat.start(t + 0.36); throat.stop(t + 0.78);
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

  // ---------------- under-falls positional ecology ----------------

  caveDrip(opts = {}) {
    // A drip without a source is just a UI click. Refuse to make one: every
    // cave detail must occupy a stable point the player can turn toward.
    if (!this._ready || !opts.pos) return false;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.15, 0.7, opts.verb ?? 0.86);
    const ping = ctx.createOscillator(); ping.type = 'sine';
    const rate = opts.rate ?? 1;
    ping.frequency.setValueAtTime((1600 + Math.random() * 700) * rate, t);
    ping.frequency.exponentialRampToValueAtTime((520 + Math.random() * 160) * rate, t + 0.11);
    const pg = ctx.createGain();
    this._env(pg, t, 0.23, 0.0015, 0.34);
    ping.connect(pg).connect(out); ping.start(t); ping.stop(t + 0.42);
    const body = ctx.createOscillator(); body.type = 'sine';
    body.frequency.setValueAtTime(145 * rate, t + 0.018);
    body.frequency.exponentialRampToValueAtTime(58 * rate, t + 0.24);
    const bg = ctx.createGain();
    this._env(bg, t + 0.018, 0.16, 0.002, 0.25);
    body.connect(bg).connect(out); body.start(t + 0.018); body.stop(t + 0.34);
    return true;
  }

  drownedCall(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    const ctx = this.ctx, t = ctx.currentTime;
    const rate = opts.rate ?? (opts.distant ? 0.86 : 1);
    const out = this._bus(opts, 3.0, opts.distant ? 0.62 : 0.82, opts.verb ?? 0.92);
    // Three throats enter one after another. No centered sting sits beneath it;
    // the exact HRTF point is the whole warning.
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.105;
      const o = ctx.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine';
      const f = [72, 91, 116][i] * rate;
      o.frequency.setValueAtTime(f * 0.82, at);
      o.frequency.exponentialRampToValueAtTime(f * 1.18, at + 0.58);
      o.frequency.exponentialRampToValueAtTime(f * 0.72, at + 1.85);
      const g = ctx.createGain();
      this._env(g, at, 0.22 - i * 0.035, 0.24, 1.75);
      o.connect(g).connect(out); o.start(at); o.stop(at + 2.1);
    }
    const breath = ctx.createBufferSource(); breath.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(430, t);
    bp.frequency.exponentialRampToValueAtTime(1700, t + 1.05);
    const bg = ctx.createGain(); this._env(bg, t, 0.28, 0.32, 1.55);
    breath.connect(bp).connect(bg).connect(out);
    breath.start(t); breath.stop(t + 2.0);
    return true;
  }

  drownedSurge(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    const ctx = this.ctx, t = ctx.currentTime;
    const rate = opts.rate ?? 1;
    const out = this._bus(opts, 1.9, opts.pressure ? 0.95 : 0.76, opts.verb ?? 0.72);
    const rush = ctx.createBufferSource(); rush.buffer = this._noiseBuf; rush.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.75;
    bp.frequency.setValueAtTime(260 * rate, t);
    bp.frequency.exponentialRampToValueAtTime((opts.pressure ? 2800 : 1700) * rate, t + 0.62);
    const rg = ctx.createGain(); this._env(rg, t, 0.72, 0.16, 1.05);
    rush.connect(bp).connect(rg).connect(out);
    rush.start(t); rush.stop(t + 1.35);
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(68 * rate, t);
    sub.frequency.exponentialRampToValueAtTime(27 * rate, t + 0.95);
    const sg = ctx.createGain(); this._env(sg, t, opts.pressure ? 0.68 : 0.38, 0.035, 1.0);
    sub.connect(sg).connect(out); sub.start(t); sub.stop(t + 1.2);
    return true;
  }

  sprayReveal(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    this._play(this._splashBufs[(Math.random() * 2) | 0], {
      pos: opts.pos, gain: 0.52 * (opts.gain ?? 1), rate: 1.35, verb: opts.verb ?? 0.78,
    });
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.35, 0.58, opts.verb ?? 0.78);
    const hiss = ctx.createBufferSource(); hiss.buffer = this._noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2300;
    const hg = ctx.createGain(); this._env(hg, t, 0.42, 0.025, 0.78);
    hiss.connect(hp).connect(hg).connect(out);
    hiss.start(t); hiss.stop(t + 0.9);
    return true;
  }

  drownedImpact(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.45, 0.92, opts.verb ?? 0.62);
    const choke = ctx.createBufferSource(); choke.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.exponentialRampToValueAtTime(180, t + 0.62);
    const cg = ctx.createGain(); this._env(cg, t, 0.78, 0.006, 0.72);
    choke.connect(bp).connect(cg).connect(out);
    choke.start(t); choke.stop(t + 0.84);
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(96, t);
    sub.frequency.exponentialRampToValueAtTime(31, t + 0.44);
    const sg = ctx.createGain(); this._env(sg, t, 0.72, 0.003, 0.5);
    sub.connect(sg).connect(out); sub.start(t); sub.stop(t + 0.58);
    return true;
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

  walkerRise(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    this._play(this._walkerRiseBuf, {
      pos: opts.pos,
      gain: 0.72 * (opts.gain ?? 1),
      rate: opts.rate ?? 1,
      verb: opts.verb ?? 0.62,
    });
    return true;
  }

  walkerStrike(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    this._play(this._walkerStrikeBuf, {
      pos: opts.pos,
      gain: 0.9 * (opts.gain ?? 1),
      rate: opts.rate ?? 1,
      verb: opts.verb ?? 0.38,
    });
    return true;
  }

  walkerMiss(opts = {}) {
    if (!this._ready || !opts.pos) return false;
    this._play(this._walkerMissBuf, {
      pos: opts.pos,
      gain: 0.58 * (opts.gain ?? 1),
      rate: opts.rate ?? 1,
      verb: opts.verb ?? 0.25,
    });
    return true;
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

  skullMoanStart(pos = null) {
    if (!this._ready || this._moan) return;
    const ctx = this.ctx;
    // Start at the actual launch point instead of jumping from world origin on
    // the first audio quantum before skullMoanUpdate has run.
    const p = this._panner(pos || { x: 0, y: 1.4, z: 0 }, 3.2, 1.2);
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
    const out = this._bus({ pos, ref: 3.2, roll: 1.25 }, 3.4, 0.76, 0.68);

    // The old cue was one clean sawtooth glissando through fixed formants: a
    // perfectly legible synthesizer patch wearing a scream moustache. This is
    // the skull finding several incompatible throats at once. A sucked inhale
    // establishes breath first; three inharmonic voices tear loose at slightly
    // different times, lose their pitch, and collapse into the body below.
    const inhale = ctx.createBufferSource(); inhale.buffer = this._noiseBuf;
    const inhaleBP = ctx.createBiquadFilter(); inhaleBP.type = 'bandpass'; inhaleBP.Q.value = 0.72;
    inhaleBP.frequency.setValueAtTime(360, t);
    inhaleBP.frequency.exponentialRampToValueAtTime(2350, t + 0.34);
    const inhaleG = ctx.createGain();
    inhaleG.gain.setValueAtTime(0.0001, t);
    inhaleG.gain.exponentialRampToValueAtTime(0.32, t + 0.27);
    inhaleG.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    inhale.connect(inhaleBP).connect(inhaleG).connect(out);
    inhale.start(t); inhale.stop(t + 0.5);

    const start = t + 0.24;
    const voices = [
      { at: 0,     f0: 118, peak: 213, end: 71,  gain: 0.27, type: 'triangle', phase: 0.1 },
      { at: 0.045, f0: 147, peak: 274, end: 93,  gain: 0.2,  type: 'sine',     phase: 1.7 },
      { at: 0.11,  f0: 189, peak: 326, end: 111, gain: 0.13, type: 'triangle', phase: 3.4 },
    ];
    for (const voice of voices) {
      const at = start + voice.at;
      const o = ctx.createOscillator(); o.type = voice.type;
      o.frequency.setValueAtTime(voice.f0, at);
      o.frequency.exponentialRampToValueAtTime(voice.peak, at + 0.29);
      o.frequency.exponentialRampToValueAtTime(voice.peak * 0.78, at + 0.72);
      o.frequency.exponentialRampToValueAtTime(voice.end, at + 2.12);

      // The modulation rates are intentionally unrelated. Their depth rises
      // after the initial cry, so the voice breaks apart instead of sustaining
      // a recognisable musical vibrato.
      const trem = ctx.createOscillator(); trem.type = 'square'; trem.frequency.value = 12.7 + voice.phase * 1.9;
      const tremDepth = ctx.createGain();
      const tremAmount = 0.105 + voice.phase * 0.008;
      tremDepth.gain.setValueAtTime(0.0001, at);
      tremDepth.gain.linearRampToValueAtTime(tremAmount, at + 0.38);
      tremDepth.gain.setValueAtTime(tremAmount, at + 1.12);
      tremDepth.gain.linearRampToValueAtTime(0.0001, at + 1.78);
      const pitchBreak = ctx.createOscillator(); pitchBreak.frequency.value = 4.1 + voice.phase * 0.73;
      const pitchDepth = ctx.createGain(); pitchDepth.gain.value = 5.5 + voice.phase * 2.2;
      pitchBreak.connect(pitchDepth).connect(o.frequency);

      const raw = ctx.createGain(); raw.gain.value = 0.62;
      const gate = ctx.createGain();
      gate.gain.setValueAtTime(0.0001, at);
      gate.gain.exponentialRampToValueAtTime(voice.gain, at + 0.055);
      gate.gain.exponentialRampToValueAtTime(voice.gain * 0.84, at + 0.56);
      gate.gain.setValueAtTime(voice.gain * 0.84, at + 0.7);
      gate.gain.exponentialRampToValueAtTime(voice.gain * 0.22, at + 1.46);
      gate.gain.exponentialRampToValueAtTime(0.0001, at + 2.28);
      trem.connect(tremDepth).connect(gate.gain);
      o.connect(raw);

      // Each throat owns a moving cavity rather than sharing three static
      // vowel bands. The formants cross as the jaws stop agreeing.
      for (const [f0, f1, q, g0] of [
        [430 + voice.phase * 36, 710 - voice.phase * 19, 4.2, 0.62],
        [960 + voice.phase * 71, 1280 - voice.phase * 44, 5.1, 0.34],
        [1840 + voice.phase * 83, 1320 + voice.phase * 31, 3.4, 0.17],
      ]) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
        bp.frequency.setValueAtTime(f0, at);
        bp.frequency.exponentialRampToValueAtTime(f1, at + 1.62);
        const fg = ctx.createGain(); fg.gain.value = g0;
        raw.connect(bp); bp.connect(fg).connect(gate);
      }
      gate.connect(out);
      o.start(at); o.stop(at + 2.34);
      trem.start(at + 0.32); trem.stop(at + 2.32);
      pitchBreak.start(at); pitchBreak.stop(at + 2.32);
    }

    // Dry tooth catches interrupt the long envelope. They are deliberately
    // brief and non-periodic: the skull is choking on the sound, not singing.
    for (const [offset, freq, gain] of [[0.61, 2260, 0.24], [0.87, 1740, 0.19], [1.31, 2480, 0.14]]) {
      const tear = ctx.createBufferSource(); tear.buffer = this._noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = freq; hp.Q.value = 1.8;
      const tg = ctx.createGain(); this._env(tg, start + offset, gain, 0.002, 0.065);
      tear.connect(hp).connect(tg).connect(out);
      tear.start(start + offset); tear.stop(start + offset + 0.1);
    }

    const body = ctx.createOscillator(); body.type = 'sine';
    body.frequency.setValueAtTime(54, start);
    body.frequency.exponentialRampToValueAtTime(23, start + 2.36);
    const bodyG = ctx.createGain(); this._env(bodyG, start, 0.34, 0.025, 2.35);
    body.connect(bodyG).connect(out); body.start(start); body.stop(start + 2.48);

    // Leave the arena bed present enough to locate the world around the cue.
    // The scream owns the foreground; it does not switch the rest of the mix
    // off for four seconds.
    this.duck(0.28, 2.7);
  }

  enemyTell(kind, opts = {}) {
    if (!this._ready || !opts.pos) return false;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.6, 0.78, opts.verb ?? 0.58);
    const recipe = {
      walker:   { f: [91, 137], dur: 0.72, noise: 1220, rise: 1.42, bite: 0.32 },
      resident: { f: [43, 63.7, 91], dur: 1.18, noise: 610, rise: 0.71, bite: 0.24 },
      kneeler:  { f: [32, 49], dur: 0.94, noise: 880, rise: 0.58, bite: 0.42 },
    }[kind] || { f: [91, 137], dur: 0.72, noise: 1220, rise: 1.42, bite: 0.32 };

    for (let i = 0; i < recipe.f.length; i++) {
      const at = t + i * 0.027;
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(recipe.f[i], at);
      o.frequency.exponentialRampToValueAtTime(recipe.f[i] * recipe.rise, at + recipe.dur * 0.38);
      o.frequency.exponentialRampToValueAtTime(recipe.f[i] * 0.73, at + recipe.dur);
      const g = ctx.createGain(); this._env(g, at, 0.19 - i * 0.025, 0.07 + i * 0.025, recipe.dur * 0.84);
      o.connect(g).connect(out); o.start(at); o.stop(at + recipe.dur + 0.1);
    }
    const breath = ctx.createBufferSource(); breath.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = recipe.noise; bp.Q.value = 0.82;
    const bg = ctx.createGain(); this._env(bg, t, recipe.bite, 0.025, recipe.dur * 0.82);
    breath.connect(bp).connect(bg).connect(out); breath.start(t); breath.stop(t + recipe.dur + 0.08);
    return true;
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

  drownedChoirLoop(pos = { x: 0, y: 1.4, z: 0 }) {
    if (!this._ready) {
      return { panningModel: 'HRTF', setPos() {}, setState() {}, douse() {}, stop() {} };
    }
    if (!this._choirBufs?.far) this._bakeChoirBuffers?.();
    const ctx = this.ctx;
    const farP = this._panner(pos, 12, 1.18);
    const pressureP = this._panner(pos, 5.5, 0.92);
    farP.connect(this.master); pressureP.connect(this.master);
    const farWet = ctx.createGain(); farWet.gain.value = 0.68;
    const pressureWet = ctx.createGain(); pressureWet.gain.value = 0.5;
    farP.connect(farWet).connect(this.verbBus);
    pressureP.connect(pressureWet).connect(this.verbBus);

    const farSrc = ctx.createBufferSource(); farSrc.buffer = this._choirBufs.far; farSrc.loop = true;
    const pressureSrc = ctx.createBufferSource(); pressureSrc.buffer = this._choirBufs.pressure; pressureSrc.loop = true;
    const farG = ctx.createGain(); farG.gain.value = 0.0001;
    const pressureG = ctx.createGain(); pressureG.gain.value = 0.0001;
    farSrc.connect(farG).connect(farP);
    pressureSrc.connect(pressureG).connect(pressureP);
    farSrc.start(); pressureSrc.start();

    const self = this;
    const h = {
      panningModel: 'HRTF',
      _dead: false,
      setPos(x, y, z) {
        if (this._dead) return;
        self._setPos(farP, x, y, z, 0.045);
        self._setPos(pressureP, x, y, z, 0.028);
      },
      setState(presence, reveal, pressure, rear) {
        if (this._dead) return;
        const t = ctx.currentTime;
        const p = clamp01(presence), r = clamp01(reveal), a = clamp01(pressure);
        const behind = clamp01(rear);
        const farVol = 0.025 + p * 0.31 + behind * 0.11;
        const nearVol = r * 0.16 + a * 0.66 + behind * p * 0.12;
        farG.gain.setTargetAtTime(Math.max(0.0001, farVol), t, 0.11);
        pressureG.gain.setTargetAtTime(Math.max(0.0001, nearVol), t, 0.055);
        farSrc.playbackRate.setTargetAtTime(0.82 + p * 0.22 + a * 0.26, t, 0.12);
        pressureSrc.playbackRate.setTargetAtTime(0.74 + r * 0.38 + a * 0.72, t, 0.075);
        farWet.gain.setTargetAtTime(0.54 + (1 - r) * 0.28, t, 0.16);
        pressureWet.gain.setTargetAtTime(0.38 + a * 0.32, t, 0.1);
      },
      douse(exposure = 1) {
        if (this._dead) return;
        const t = ctx.currentTime;
        pressureSrc.playbackRate.cancelScheduledValues(t);
        pressureSrc.playbackRate.setTargetAtTime(1.45 + clamp01(exposure) * 0.65, t, 0.025);
        pressureSrc.playbackRate.setTargetAtTime(0.92, t + 0.18, 0.38);
        farG.gain.setTargetAtTime(0.025, t, 0.035);
      },
      stop() {
        if (this._dead) return;
        this._dead = true;
        const t = ctx.currentTime;
        farG.gain.cancelScheduledValues(t); farG.gain.setTargetAtTime(0.0001, t, 0.12);
        pressureG.gain.cancelScheduledValues(t); pressureG.gain.setTargetAtTime(0.0001, t, 0.1);
        setTimeout(() => {
          try { farSrc.stop(); pressureSrc.stop(); } catch {}
          for (const n of [farP, pressureP, farWet, pressureWet, farG, pressureG]) {
            try { n.disconnect(); } catch {}
          }
        }, 800);
        self._loops.delete(h);
      },
    };
    this._loops.add(h);
    return h;
  }

  // A found object may begin calling before the player can see it, but the
  // forest never gets to become an eight-channel jukebox. At most two of these
  // handles can exist; outside.js continuously awards them to the nearest two
  // audible, unsealed props and releases them as ownership changes.
  forestStoryLoop(kind, pos = { x: 0, y: 1.2, z: 0 }, opts = {}) {
    if (!this._ready) return null;
    if (!this._forestStoryBufs?.[kind]) this._bakeForestStoryKind?.(kind);
    if (!this._forestStoryBufs?.[kind]) return null;
    if (this._forestStoryLoops.size >= 2) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._forestStoryBufs[kind];
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const panner = this._panner(pos, opts.ref ?? 8.5, opts.roll ?? 1.12);
    const wet = ctx.createGain();
    wet.gain.value = opts.verb ?? 0.36;
    src.connect(gain).connect(panner);
    panner.connect(this.master);
    panner.connect(wet).connect(this.verbBus);
    src.start();

    const self = this;
    const h = {
      kind,
      storyProp: true,
      panningModel: panner.panningModel,
      worldPos: { x: pos.x, y: pos.y ?? 1.2, z: pos.z },
      _dead: false,
      setGain(value, tau = 0.16) {
        if (this._dead) return;
        gain.gain.setTargetAtTime(Math.max(0.0001, clamp01(value)), ctx.currentTime, tau);
      },
      setPos(x, y, z) {
        if (this._dead) return;
        this.worldPos.x = x; this.worldPos.y = y; this.worldPos.z = z;
        self._setPos(panner, x, y, z, 0.045);
      },
      stop() {
        if (this._dead) return;
        this._dead = true;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(0.0001, t, 0.055);
        self._forestStoryLoops.delete(h);
        self._loops.delete(h);
        setTimeout(() => {
          try { src.stop(); } catch {}
          for (const node of [src, gain, panner, wet]) {
            try { node.disconnect(); } catch {}
          }
        }, 360);
      },
    };
    this._forestStoryLoops.add(h);
    this._loops.add(h);
    h.setGain(opts.gain ?? 0.22, 0.09);
    return h;
  }

  // Silencing one of the forest's calling objects is deliberately louder than
  // leaving it alone: a transformer cough, a metal case buckling, then the
  // local voice is gone. The world couples this to player.noise so it remains
  // a systemic choice even when no enemy is currently close enough to answer.
  forestStoryBreak(kind, opts = {}) {
    if (!this._ready) return false;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = this._bus(opts, 1.35, 1, 0.48);
    const body = ctx.createOscillator();
    body.type = kind === 'bell' ? 'sine' : 'sawtooth';
    body.frequency.setValueAtTime(kind === 'crt' ? 180 : 104, t);
    body.frequency.exponentialRampToValueAtTime(34, t + 0.62);
    const bodyGain = ctx.createGain();
    this._env(bodyGain, t, 0.42 * (opts.gain ?? 1), 0.006, 0.72);
    body.connect(bodyGain).connect(out);
    body.start(t); body.stop(t + 0.8);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 920; bp.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    this._env(noiseGain, t, 0.55 * (opts.gain ?? 1), 0.002, 0.34);
    noise.connect(bp).connect(noiseGain).connect(out);
    noise.start(t); noise.stop(t + 0.42);
    return true;
  }

  // ---------------- enemy presence loops ----------------

  // Two-layer presence per Behind You: a far loop that carries the threat math and
  // a close-pressure loop that only exists inside arm's reach. The caller feeds
  // setThreat with its own smoothstepped threat/near/rear terms — rear MUST be
  // computed on y-flattened vectors or looking down reads as "behind you".
  enemyLoop(kind) {
    if (!this._ready) return { setPos() {}, setThreat() {}, stop() {} };
    if (!this._enemyBufs?.walker) this._bakeEnemyBuffers?.();
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

  stopAll({ suspend = false } = {}) {
    if (!this._ready) return;
    this._cancelForestStoryPrewarm?.();
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
    this.bedGain.gain.setTargetAtTime(0.0001, t, 0.16);
    this._tGain.gain.cancelScheduledValues(t);
    this._tGain.gain.setTargetAtTime(0.0001, t, 0.1);
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.0001, t, 0.18);
    if (suspend && !this._suspendTimer) {
      const ctx = this.ctx;
      this._suspendTimer = setTimeout(() => {
        this._suspendTimer = null;
        if (ctx.state === 'running') ctx.suspend().catch(() => {});
      }, 420);
    }
  }
}
