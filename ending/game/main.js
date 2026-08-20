// What his `src/game/ChompGame.tsx` was: screen flow, the RAF loop, keyboard
// and pointer input, the three video layers and the HUD — with React replaced
// by plain DOM. The order of everything, the timings and the numbers are his.
//
// Gone with the scaffold: the p2p multiplayer, the sign-in, the database and
// the score server ("lol, p2p multipleayer. we dont need that stuff"). Personal
// bests were already mirrored to localStorage; only the server half is gone.

import {
  getAudioContext,
  playCount,
  playUi,
  resumeAudio,
  setMusicMuted,
  setSfxMuted,
  startMusic,
  stopMusic,
  suspendAudio,
  unlockAudio,
} from './audio.js';
import { Engine, gradeFromCounts } from './engine.js';
import {
  computeLayout,
  drawJudgement,
  drawParticles,
  drawPlayfield,
  hitLaneAt,
  laneCenter,
  resizeCanvas,
} from './render.js';
import { SONGS } from './songs.js';
import { LANE_COLORS, SET_ID } from './types.js';
import * as ui from './ui.js';

const BESTS_KEY = 'chomp-bests-v2';
const OFFSET_KEY = 'chomp-offset-v1';
const MUTE_KEY = 'chomp-mute-v1';

const KEY_LANE = {
  ArrowLeft: 0,
  KeyA: 0,
  ArrowDown: 1,
  KeyS: 1,
  ArrowUp: 2,
  KeyW: 2,
  ArrowRight: 3,
  KeyD: 3,
};

const S = {
  screen: 'title',
  engine: null,
  song: null,
  partIndex: 0,
  partResults: [],
  upcoming: null,
  bests: {},
  muted: false,
  offsetMs: 0,
  offset: 0,
  coarse: false,
  reduced: false,
  trauma: 0,
  lastTs: 0,
  lastHitId: 0,
  lastCount: -1,
  hud: { score: 0, grin: 55, combo: 0 },
  count: 0,
  bridgeTimer: 0,
};

/* ---------------------------------------------------------------- storage */

function loadBests() {
  try {
    const raw = localStorage.getItem(BESTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBests(b) {
  try {
    localStorage.setItem(BESTS_KEY, JSON.stringify(b));
  } catch {
    /* private browsing, a full quota — a lost best is not worth a crash */
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* see above */
  }
}

/* ------------------------------------------------------------------ audio */

// The one gesture this page gets is the button that calls in here. User
// activation does not survive the navigation from FETCH, so nothing above this
// line may touch the AudioContext.
function ensureAudio() {
  unlockAudio();
  resumeAudio();
  // The bus is built with music at full gain, so a mute remembered from a
  // previous visit has to be pressed onto it once it exists.
  setMusicMuted(S.muted);
  setSfxMuted(S.muted);
}

/* ------------------------------------------------------------------ flow */

function setScreen(name) {
  if (name !== 'bridge' && S.bridgeTimer) {
    window.clearTimeout(S.bridgeTimer);
    S.bridgeTimer = 0;
  }
  S.screen = name;
  ui.setScreen(name);
  ui.setPads(name === 'playing' && S.coarse);
  if (name !== 'playing') ui.setCountIn(0);
}

function startPart(index) {
  const picked = SONGS[index];
  if (!picked) return;
  ensureAudio();
  stopMusic();
  const ctx = getAudioContext();
  if (!ctx) return;

  const eng = new Engine(picked, S.offset);
  S.engine = eng;
  S.lastHitId = 0;
  S.lastCount = -1;

  const startAt = ctx.currentTime + 0.05;
  eng.begin(startAt);
  startMusic(picked, startAt);

  S.partIndex = index;
  S.song = picked;
  S.upcoming = null;
  ui.setStageClip(picked.stage);

  S.hud = { score: 0, grin: 55, combo: 0 };
  ui.setHudTrack(index + 1, SONGS.length, picked.title);
  ui.setHudScore(0);
  ui.setHudGrin(55);
  S.count = 0;
  ui.setCountIn(0);
  setScreen('playing');
}

function startSet() {
  ensureAudio();
  playUi();
  S.partIndex = 0;
  S.partResults = [];
  startPart(0);
}

function finishSet(parts) {
  stopMusic();
  const totalScore = parts.reduce((s, p) => s + p.score, 0);
  const maxCombo = parts.reduce((s, p) => Math.max(s, p.maxCombo), 0);
  const perfects = parts.reduce((s, p) => s + p.perfects, 0);
  const greats = parts.reduce((s, p) => s + p.greats, 0);
  const goods = parts.reduce((s, p) => s + p.goods, 0);
  const misses = parts.reduce((s, p) => s + p.misses, 0);
  const grade = gradeFromCounts(perfects, greats, goods, misses);
  const gradeLine = parts.map((p) => p.grade).join(' / ');

  const local = { ...loadBests() };
  const prev = local[SET_ID];
  if (!prev || totalScore > prev.score) {
    local[SET_ID] = { score: totalScore, grade: gradeLine, maxCombo };
    saveBests(local);
    S.bests = local;
    ui.setBest({ grade: gradeLine, score: totalScore });
  }

  ui.showResults({ parts, totalScore, maxCombo, grade });
  setScreen('results');
  ui.setStageClip('club');
}

function onPartDone(eng) {
  const part = eng.toPartResult();
  S.partResults = [...S.partResults, part];
  stopMusic();

  const nextIndex = S.partIndex + 1;
  if (nextIndex >= SONGS.length) {
    finishSet(S.partResults);
    return;
  }

  const nextSong = SONGS[nextIndex];
  S.partIndex = nextIndex;
  S.upcoming = nextSong;
  ui.setStageClip(nextSong.stage);
  ui.showBridge(nextIndex + 1, SONGS.length, nextSong);
  setScreen('bridge');
  S.bridgeTimer = window.setTimeout(() => {
    S.bridgeTimer = 0;
    startPart(S.partIndex);
  }, 1700);
}

function goTitle() {
  stopMusic();
  S.engine = null;
  S.partResults = [];
  S.song = null;
  S.upcoming = null;
  ui.setStageClip('club');
  setScreen('title');
}

/* ------------------------------------------------------------------ loop */

function loop(ts) {
  const dt = Math.min(0.1, (ts - (S.lastTs || ts)) / 1000);
  S.lastTs = ts;
  S.trauma = Math.max(0, S.trauma - dt * 2.4);

  const sized = resizeCanvas(ui.el.field);
  const ctx = sized.ctx;
  if (!ctx) {
    requestAnimationFrame(loop);
    return;
  }
  ctx.clearRect(0, 0, sized.w, sized.h);

  const layout = computeLayout(sized.w, sized.h);
  const audio = getAudioContext();
  const audioTime = audio ? audio.currentTime : 0;
  const eng = S.engine;

  if (S.screen === 'playing' && eng && audio && audio.state === 'running') {
    eng.update(audioTime, dt);
    const snap = eng.snapshot(audioTime);

    if (eng.lastHit && eng.lastHit.id !== S.lastHitId) {
      S.lastHitId = eng.lastHit.id;
      if (eng.lastHit.judgement === 'miss') {
        S.trauma = Math.min(1, S.trauma + 0.45);
      } else {
        const x = laneCenter(layout, eng.lastHit.lane);
        eng.burst(
          x,
          layout.receptorY,
          LANE_COLORS[eng.lastHit.lane],
          eng.lastHit.judgement === 'perfect' ? 16 : 8,
        );
        if (eng.combo === 25 || eng.combo === 50 || eng.combo === 100) {
          S.trauma = Math.min(1, S.trauma + 0.3);
          ui.setStageClip('spin');
        }
      }
    }

    const beatLen = 60 / eng.song.bpm;
    const beatNum = Math.floor(snap.songTime / beatLen);
    if (beatNum >= 0 && beatNum < 4 && beatNum !== S.lastCount) {
      S.lastCount = beatNum;
      playCount(beatNum);
      S.count = 4 - beatNum;
      ui.setCountIn(S.count);
    } else if (beatNum >= 4 && S.lastCount < 4) {
      S.lastCount = beatNum;
      S.count = 0;
      ui.setCountIn(0);
    }

    const prev = S.hud;
    if (
      prev.score !== snap.score ||
      Math.abs(prev.grin - snap.grin) > 0.5 ||
      prev.combo !== snap.combo
    ) {
      S.hud = { score: snap.score, grin: snap.grin, combo: snap.combo };
      ui.setHudScore(snap.score);
      ui.setHudGrin(snap.grin);
    }

    const shake = S.trauma * S.trauma;
    if (!S.reduced && shake > 0.002) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 10 * shake);
    }
    drawPlayfield(ctx, snap, layout, audioTime, S.reduced);
    drawParticles(ctx, eng.particles);
    drawJudgement(ctx, layout, snap, audioTime);
    if (!S.reduced && shake > 0.002) ctx.restore();

    if (eng.finished && !eng.settled) {
      eng.markSettled();
      onPartDone(eng);
    }
  }

  requestAnimationFrame(loop);
}

/* ----------------------------------------------------------------- input */

function hitLane(lane) {
  const audio = getAudioContext();
  if (S.engine) S.engine.input(lane, audio ? audio.currentTime : 0);
}

function onKey(e) {
  if (e.repeat) return;

  if (S.screen === 'playing') {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      suspendAudio();
      setScreen('paused');
      return;
    }
    const lane = KEY_LANE[e.code];
    if (lane === undefined) return;
    e.preventDefault();
    hitLane(lane);
    return;
  }

  if (S.screen === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
    resumeAudio();
    setScreen('playing');
    return;
  }

  if (S.screen === 'bridge' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
    e.preventDefault();
    // Skipping the card means the 1.7 s timer must not also fire.
    if (S.bridgeTimer) {
      window.clearTimeout(S.bridgeTimer);
      S.bridgeTimer = 0;
    }
    startPart(S.partIndex);
  }
}

function onCanvasPointer(e) {
  if (S.screen !== 'playing') return;
  const rect = ui.el.field.getBoundingClientRect();
  const layout = computeLayout(rect.width, rect.height);
  const lane = hitLaneAt(layout, e.clientX - rect.left, e.clientY - rect.top);
  if (lane === null) return;
  hitLane(lane);
}

function toggleMute() {
  S.muted = !S.muted;
  setMusicMuted(S.muted);
  setSfxMuted(S.muted);
  ui.setMuteLabel(S.muted);
  remember(MUTE_KEY, S.muted ? '1' : '0');
}

function applyOffset(ms) {
  const next = Math.max(-120, Math.min(120, ms));
  S.offsetMs = next;
  S.offset = next / 1000;
  ui.setOffsetLabel(next);
  remember(OFFSET_KEY, String(next));
  if (S.engine) S.engine.offset = S.offset;
}

/* ------------------------------------------------------------------ boot */

function boot() {
  S.bests = loadBests();
  const setBest = S.bests[SET_ID];
  ui.setBest(setBest ? { grade: setBest.grade, score: setBest.score } : null);

  let stored = 0;
  try {
    stored = Number(localStorage.getItem(OFFSET_KEY) || '0');
  } catch {
    stored = 0;
  }
  if (Number.isFinite(stored)) {
    S.offsetMs = stored;
    S.offset = stored / 1000;
  }
  ui.setOffsetLabel(S.offsetMs);

  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
  S.muted = muted;
  setMusicMuted(muted);
  setSfxMuted(muted);
  ui.setMuteLabel(muted);

  const coarse = window.matchMedia('(pointer: coarse)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => {
    S.coarse = coarse.matches;
    S.reduced = reduce.matches;
    ui.setPads(S.screen === 'playing' && S.coarse);
  };
  sync();
  coarse.addEventListener('change', sync);
  reduce.addEventListener('change', sync);

  // The title clip is the only one allowed to start by itself, and only
  // because it is muted; the other two wait for the set to begin.
  ui.setStageClip('club');

  ui.el.titlePlay.addEventListener('click', startSet);
  ui.el.retryButton.addEventListener('click', startSet);
  ui.el.titleButton.addEventListener('click', goTitle);
  ui.el.muteButton.addEventListener('click', toggleMute);
  ui.el.pauseButton.addEventListener('click', () => {
    suspendAudio();
    setScreen('paused');
  });
  ui.el.resumeButton.addEventListener('click', () => {
    resumeAudio();
    setScreen('playing');
  });
  ui.el.quitButton.addEventListener('click', () => {
    resumeAudio();
    goTitle();
  });
  ui.el.offsetDown.addEventListener('click', () => applyOffset(S.offsetMs - 5));
  ui.el.offsetUp.addEventListener('click', () => applyOffset(S.offsetMs + 5));

  ui.el.field.addEventListener('pointerdown', onCanvasPointer);
  for (const pad of ui.el.pads.querySelectorAll('.pad')) {
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hitLane(Number(pad.dataset.lane));
    });
  }

  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === 'playing') {
      suspendAudio();
      setScreen('paused');
    }
  });

  setScreen('title');

  // The same bargain FETCH makes with its own gates (window.__FETCH, src/main.js).
  // Without a handle, nothing outside this file can ever assert that the coda
  // actually plays -- only that its page returned 200. Read-only except hit(),
  // which drives the identical path a real key press takes.
  window.__CODA = {
    get screen() { return S.screen; },
    get part() { return { index: S.partIndex, id: S.song ? S.song.id : null, of: SONGS.length }; },
    get hud() { return { score: S.hud.score, grin: S.hud.grin, combo: S.hud.combo }; },
    get engine() { return S.engine; },
    get notesLeft() { return S.engine ? S.engine.notes.filter((n) => !n.judged).length : 0; },
    get audio() {
      const ctx = getAudioContext();
      return { state: ctx ? ctx.state : 'none', time: ctx ? +ctx.currentTime.toFixed(3) : 0, muted: S.muted };
    },
    get clips() {
      return Object.values(ui.el.clips).map((v) => ({
        src: (v.currentSrc || '').split('/').pop(),
        playing: !v.paused, readyState: v.readyState,
        shown: window.getComputedStyle(v).opacity !== '0',
      }));
    },
    hit(lane) { hitLane(lane); return S.hud.score; },
  };

  requestAnimationFrame(loop);
}

boot();
