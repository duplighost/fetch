// His `src/game/engine.ts`, types stripped. Timing windows, scoring, the combo
// multiplier, the grin meter and the grades. An empty grin does NOT end the
// run — you always reach the results. That is his rule; leave it alone.

import { playHit } from './audio.js';
import { generateChart, songDuration } from './songs.js';
import { TRAVEL, WINDOWS } from './types.js';

let hitSeq = 1;

export function gradeFromCounts(perfects, greats, goods, misses) {
  const total = perfects + greats + goods + misses;
  if (total === 0) return 'F';
  const acc = (perfects + greats * 0.75 + goods * 0.45) / total;
  if (misses === 0 && acc >= 0.96) return 'S';
  if (acc >= 0.9) return 'A';
  if (acc >= 0.8) return 'B';
  if (acc >= 0.68) return 'C';
  if (acc >= 0.5) return 'D';
  return 'F';
}

export class Engine {
  constructor(song, offset = 0) {
    this.song = song;
    this.notes = generateChart(song);
    this.duration = songDuration(song);
    this.offset = offset;

    this.startAt = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.grin = 55;
    this.perfects = 0;
    this.greats = 0;
    this.goods = 0;
    this.misses = 0;
    this.finished = false;
    this.failed = false;
    this.settled = false;
    this.lastHit = null;
    this.pressFlash = [0, 0, 0, 0];
    this.particles = [];
    this.cursor = 0;
  }

  begin(audioTime) {
    this.startAt = audioTime;
  }

  songTime(audioTime) {
    return audioTime - this.startAt;
  }

  judgeTime(audioTime) {
    return this.songTime(audioTime) + this.offset;
  }

  input(lane, audioTime) {
    if (this.finished) return;
    const now = this.judgeTime(audioTime);
    this.pressFlash[lane] = audioTime;

    let best = null;
    let bestAbs = WINDOWS.good;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.judged) continue;
      if (n.time - now > WINDOWS.good) break;
      if (n.lane !== lane) continue;
      const dt = Math.abs(n.time - now);
      if (dt <= bestAbs) {
        bestAbs = dt;
        best = n;
      }
    }

    if (!best) return;

    let judgement;
    if (bestAbs <= WINDOWS.perfect) judgement = 'perfect';
    else if (bestAbs <= WINDOWS.great) judgement = 'great';
    else judgement = 'good';

    this.applyHit(best, judgement, audioTime);
  }

  update(audioTime, dt) {
    const now = this.judgeTime(audioTime);
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.judged) {
        if (i === this.cursor) this.cursor = i + 1;
        continue;
      }
      if (now - n.time > WINDOWS.good) {
        this.applyHit(n, 'miss', audioTime);
        if (i === this.cursor) this.cursor = i + 1;
      } else if (n.time - now > TRAVEL + 0.2) {
        break;
      }
    }

    const live = [];
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.life > 0) live.push(p);
    }
    this.particles = live;

    if (!this.finished && this.songTime(audioTime) >= this.duration) {
      this.finished = true;
    }
    if (this.grin <= 0) this.failed = true;
  }

  markSettled() {
    this.settled = true;
  }

  toPartResult() {
    return {
      songId: this.song.id,
      title: this.song.title,
      grade: this.grade(),
      score: this.score,
      maxCombo: this.maxCombo,
      perfects: this.perfects,
      greats: this.greats,
      goods: this.goods,
      misses: this.misses,
    };
  }

  applyHit(note, judgement, audioTime) {
    if (note.judged) return;
    note.judged = true;
    note.judgement = judgement;
    playHit(judgement, note.lane);

    if (judgement === 'miss') {
      this.combo = 0;
      this.misses += 1;
      this.grin = Math.max(0, this.grin - 9);
    } else {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const base = judgement === 'perfect' ? 1000 : judgement === 'great' ? 700 : 350;
      const mult = 1 + Math.min(8, Math.floor(this.combo / 10)) * 0.15;
      this.score += Math.round(base * mult);
      if (judgement === 'perfect') {
        this.perfects += 1;
        this.grin = Math.min(100, this.grin + 3.2);
      } else if (judgement === 'great') {
        this.greats += 1;
        this.grin = Math.min(100, this.grin + 1.4);
      } else {
        this.goods += 1;
      }
    }

    this.lastHit = {
      id: hitSeq++,
      judgement,
      lane: note.lane,
      combo: this.combo,
      at: audioTime,
    };
  }

  burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: 0.35 + Math.random() * 0.25,
        max: 0.55,
        size: 2 + Math.random() * 3.2,
        color,
      });
    }
  }

  snapshot(audioTime) {
    const songTime = this.songTime(audioTime);
    const beat = 60 / this.song.bpm;
    return {
      songTime,
      duration: this.duration,
      bpm: this.song.bpm,
      notes: this.notes,
      combo: this.combo,
      maxCombo: this.maxCombo,
      score: this.score,
      grin: this.grin,
      perfects: this.perfects,
      greats: this.greats,
      goods: this.goods,
      misses: this.misses,
      finished: this.finished,
      failed: this.failed,
      lastHit: this.lastHit,
      pressFlash: this.pressFlash,
      beatPhase: (((songTime % beat) + beat) % beat) / beat,
    };
  }

  grade() {
    return gradeFromCounts(this.perfects, this.greats, this.goods, this.misses);
  }

  accuracy() {
    const total = this.perfects + this.greats + this.goods + this.misses;
    if (total === 0) return 0;
    return (this.perfects + this.greats * 0.75 + this.goods * 0.45) / total;
  }
}
