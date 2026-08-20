// His `src/game/audio.ts`, types stripped, otherwise untouched. The entire
// soundtrack is synthesised here — kick, snare, hat, clap, acid bass, lead,
// a scale per style, and a 16th-note lookahead scheduler. There is no audio
// file anywhere in this game; the three clips are silent.
//
// Web Audio needs a user gesture to start. This page can never inherit one
// from FETCH — user activation does not survive a navigation — so
// `unlockAudio()` is called from the title screen's button and nowhere else.

let bus = null;
let musicMuted = false;
let sfxMuted = false;
let schedulerId = 0;
let musicGen = 0;
let nextStepTime = 0;
let stepIndex = 0;
let activeSong = null;
let noiseBuffer = null;

export function getAudioContext() {
  return bus?.ctx ?? null;
}

export function unlockAudio() {
  if (!bus) {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 4.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    music.gain.value = 0.52;
    sfx.gain.value = 0.72;
    master.gain.value = 0.9;
    music.connect(comp);
    sfx.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    bus = { ctx, master, music, sfx };
    noiseBuffer = makeNoise(ctx);
  }
  if (bus.ctx.state === 'suspended') void bus.ctx.resume();
  return bus.ctx;
}

export function setMusicMuted(v) {
  musicMuted = v;
  if (bus) bus.music.gain.setTargetAtTime(v ? 0 : 0.52, bus.ctx.currentTime, 0.03);
}

export function setSfxMuted(v) {
  sfxMuted = v;
}

export function isMusicMuted() {
  return musicMuted;
}

export function suspendAudio() {
  if (bus && bus.ctx.state === 'running') void bus.ctx.suspend();
}

export function resumeAudio() {
  if (bus && bus.ctx.state === 'suspended') void bus.ctx.resume();
}

function makeNoise(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(ctx, dest, t, a, d, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(dest);
  return g;
}

function kick(t) {
  if (!bus) return;
  const { ctx, music } = bus;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(148, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(0.95, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g);
  g.connect(music);
  osc.start(t);
  osc.stop(t + 0.24);
}

function snare(t) {
  if (!bus || !noiseBuffer) return;
  const { ctx, music } = bus;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const g = envGain(ctx, music, t, 0.004, 0.12, 0.38);
  src.connect(hp);
  hp.connect(g);
  src.start(t);
  src.stop(t + 0.16);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 196;
  const og = envGain(ctx, music, t, 0.002, 0.08, 0.18);
  osc.connect(og);
  osc.start(t);
  osc.stop(t + 0.1);
}

function hat(t, open = false) {
  if (!bus || !noiseBuffer) return;
  const { ctx, music } = bus;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = open ? 6000 : 8000;
  const g = envGain(ctx, music, t, 0.001, open ? 0.14 : 0.04, open ? 0.16 : 0.1);
  src.connect(hp);
  hp.connect(g);
  src.start(t);
  src.stop(t + (open ? 0.18 : 0.06));
}

function bass(t, midi, dur) {
  if (!bus) return;
  const { ctx, music } = bus;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = midiToHz(midi);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(420, t);
  filt.frequency.exponentialRampToValueAtTime(180, t + dur * 0.8);
  filt.Q.value = 8;
  const g = envGain(ctx, music, t, 0.01, dur * 0.92, 0.22);
  osc.connect(filt);
  filt.connect(g);
  osc.start(t);
  osc.stop(t + dur);
}

function lead(t, midi, dur, acid) {
  if (!bus) return;
  const { ctx, music } = bus;
  const osc = ctx.createOscillator();
  osc.type = acid ? 'sawtooth' : 'square';
  osc.frequency.value = midiToHz(midi);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = acid ? 14 : 4;
  filt.frequency.setValueAtTime(acid ? 900 : 1400, t);
  filt.frequency.exponentialRampToValueAtTime(acid ? 400 : 700, t + dur);
  const g = envGain(ctx, music, t, 0.01, dur * 0.85, acid ? 0.12 : 0.09);
  osc.connect(filt);
  filt.connect(g);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function clap(t) {
  if (!bus || !noiseBuffer) return;
  const { ctx, music } = bus;
  for (let i = 0; i < 3; i++) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const g = envGain(ctx, music, t + i * 0.012, 0.001, 0.07, 0.16);
    src.connect(bp);
    bp.connect(g);
    src.start(t + i * 0.012);
    src.stop(t + i * 0.012 + 0.09);
  }
}

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

const SCALES = {
  house: [0, 3, 5, 7, 10, 12, 15, 17],
  break: [0, 2, 3, 7, 8, 12, 14, 15],
  march: [0, 3, 7, 8, 10, 12, 15, 19],
  acid: [0, 1, 3, 6, 7, 10, 12, 13],
};

function scheduleStep(song, t, step, gen) {
  if (gen !== musicGen || !bus) return;
  const s = step % 16;
  const bar = Math.floor(step / 16);
  const sixteenth = 60 / song.bpm / 4;
  const scale = SCALES[song.style];
  const root = song.key;

  if (s === 0 || s === 8) kick(t);
  if (song.style === 'break' && (s === 4 || s === 12 || s === 14)) kick(t + sixteenth * 0.02);
  if (song.style === 'march' && s === 4) kick(t);

  if (s === 4 || s === 12) {
    if (song.style === 'march') clap(t);
    else snare(t);
  }

  if (s % 2 === 0) hat(t, s === 6 || s === 14);
  if (song.style === 'acid' && s % 2 === 1 && bar % 2 === 1) hat(t, false);

  if (s === 0 || s === 8 || (song.style !== 'house' && s === 4)) {
    const deg = s === 0 ? 0 : s === 8 ? 4 : 3;
    bass(t, root + (scale[deg] ?? 0) - 12, sixteenth * (s === 0 ? 3.5 : 1.8));
  }
  if (song.style === 'acid' && s % 2 === 0) {
    const deg = Math.floor((Math.sin(bar * 1.7 + s) * 0.5 + 0.5) * 7);
    bass(t, root + (scale[deg] ?? 0) - 12, sixteenth * 0.9);
  }

  const leadOn =
    bar > 1 &&
    (s === 0 || s === 6 || s === 10 || (song.style !== 'house' && (s === 3 || s === 12)));
  if (leadOn) {
    const deg = (bar * 3 + s) % scale.length;
    lead(t, root + 12 + (scale[deg] ?? 0), sixteenth * (s === 0 ? 4 : 2), song.style === 'acid');
  }
}

export function startMusic(song, startAt) {
  if (!bus) unlockAudio();
  if (!bus) return;
  musicGen += 1;
  const gen = musicGen;
  activeSong = song;
  const sixteenth = 60 / song.bpm / 4;
  stepIndex = 0;
  nextStepTime = startAt;
  const totalSteps = song.bars * 16 + 4;

  const tick = () => {
    if (gen !== musicGen || !bus) return;
    const now = bus.ctx.currentTime;
    while (nextStepTime < now + 0.22 && stepIndex < totalSteps) {
      scheduleStep(song, nextStepTime, stepIndex, gen);
      nextStepTime += sixteenth;
      stepIndex += 1;
    }
    if (stepIndex < totalSteps && gen === musicGen) {
      schedulerId = window.setTimeout(tick, 40);
    }
  };
  tick();
}

export function stopMusic() {
  musicGen += 1;
  window.clearTimeout(schedulerId);
  activeSong = null;
}

export function playHit(judgement, lane) {
  if (!bus || sfxMuted) return;
  const { ctx, sfx } = bus;
  const t = ctx.currentTime;
  const pan = ctx.createStereoPanner();
  pan.pan.value = [-0.7, -0.22, 0.22, 0.7][lane] ?? 0;
  pan.connect(sfx);

  if (judgement === 'miss') {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    const g = envGain(ctx, pan, t, 0.004, 0.18, 0.22);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.2);
    return;
  }

  const peak = judgement === 'perfect' ? 0.38 : judgement === 'great' ? 0.26 : 0.16;
  const freq = judgement === 'perfect' ? 880 : judgement === 'great' ? 660 : 490;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.05);
  const g = envGain(ctx, pan, t, 0.002, 0.09, peak);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.12);

  if (judgement === 'perfect') {
    const jaw = ctx.createOscillator();
    jaw.type = 'sine';
    jaw.frequency.setValueAtTime(140, t);
    jaw.frequency.exponentialRampToValueAtTime(70, t + 0.07);
    const jg = envGain(ctx, pan, t, 0.002, 0.08, 0.28);
    jaw.connect(jg);
    jaw.start(t);
    jaw.stop(t + 0.1);
  }
}

export function playUi() {
  if (!bus || sfxMuted) return;
  const { ctx, sfx } = bus;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 520;
  const g = envGain(ctx, sfx, t, 0.002, 0.06, 0.12);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.08);
}

export function playCount(beat) {
  if (!bus || sfxMuted) return;
  const { ctx, sfx } = bus;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = beat === 0 ? 660 : 440;
  const g = envGain(ctx, sfx, t, 0.002, 0.1, beat === 0 ? 0.28 : 0.16);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function getActiveSong() {
  return activeSong;
}
