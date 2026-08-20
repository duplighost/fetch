// What his `src/game/overlays.tsx` was: title, pause, bridge, results, the HUD,
// the key guide and the touch pads. Same screens, same words, same order —
// React and Tailwind removed, so this file only reaches into markup that is
// already in index.html and writes text into it.
//
// The auth chip is gone with the rest of the sign-in ("no sign-in, ever"), and
// the results screen no longer claims a cloud save, because there is no server
// to save to. Personal bests live in localStorage, exactly as they already did.

import { SONGS } from './songs.js';

const $ = (id) => document.getElementById(id);

export const el = {
  body: document.body,
  clips: { club: $('clipClub'), stage: $('clipStage'), spin: $('clipSpin') },
  field: $('field'),

  hud: $('hud'),
  hudTrack: $('hudTrack'),
  hudScore: $('hudScore'),
  hudPips: $('hudPips'),
  hudGrinFill: $('hudGrinFill'),
  muteButton: $('muteButton'),
  pauseButton: $('pauseButton'),

  countin: $('countin'),
  countinText: $('countin').querySelector('p'),
  pads: $('pads'),

  title: $('title'),
  titleBest: $('titleBest'),
  titlePlay: $('titlePlay'),

  bridge: $('bridge'),
  bridgePart: $('bridgePart'),
  bridgeTitle: $('bridgeTitle'),
  bridgeTag: $('bridgeTag'),

  pause: $('pause'),
  offsetValue: $('offsetValue'),
  offsetDown: $('offsetDown'),
  offsetUp: $('offsetUp'),
  resumeButton: $('resumeButton'),
  quitButton: $('quitButton'),

  results: $('results'),
  resultGrade: $('resultGrade'),
  resultParts: $('resultParts'),
  resultTotal: $('resultTotal'),
  resultCombo: $('resultCombo'),
  retryButton: $('retryButton'),
  titleButton: $('titleButton'),
};

const SCREENS = {
  title: el.title,
  bridge: el.bridge,
  paused: el.pause,
  results: el.results,
};

export function setScreen(name) {
  for (const [key, node] of Object.entries(SCREENS)) node.hidden = key !== name;
  el.hud.hidden = name !== 'playing';
  el.body.dataset.screen = name;
}

export function setPads(visible) {
  el.pads.hidden = !visible;
}

export function setStageClip(name) {
  for (const [key, node] of Object.entries(el.clips)) {
    if (!node) continue;
    if (key === name) {
      node.classList.add('on');
      const p = node.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      node.classList.remove('on');
      node.pause();
    }
  }
}

export function setHudTrack(part, total, title) {
  el.hudTrack.textContent = part + ' / ' + total + ' · ' + title;
  const pips = el.hudPips.children;
  for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('done', i < part);
}

export function setHudScore(score) {
  el.hudScore.textContent = score.toLocaleString();
}

export function setHudGrin(grin) {
  el.hudGrinFill.style.width = Math.max(2, grin) + '%';
}

export function setMuteLabel(muted) {
  el.muteButton.textContent = muted ? 'Sound off' : 'Sound on';
}

export function setCountIn(n) {
  if (n <= 0) {
    el.countin.hidden = true;
    return;
  }
  el.countin.hidden = false;
  el.countinText.textContent = n === 1 ? 'CHOMP' : String(n);
}

export function setOffsetLabel(ms) {
  el.offsetValue.textContent = ms + ' ms';
}

export function setBest(best) {
  if (!best) {
    el.titleBest.hidden = true;
    el.titleBest.textContent = '';
    return;
  }
  el.titleBest.hidden = false;
  el.titleBest.textContent = 'Best ' + best.grade + ' · ' + best.score.toLocaleString();
}

export function showBridge(part, total, song) {
  el.bridgePart.textContent = 'Movement ' + part + ' of ' + total;
  el.bridgeTitle.textContent = song.title;
  el.bridgeTag.textContent = song.tagline;
}

export function showResults(payload) {
  el.resultGrade.textContent = payload.grade;
  el.resultTotal.textContent = payload.totalScore.toLocaleString();
  el.resultCombo.textContent = String(payload.maxCombo);

  el.resultParts.replaceChildren();
  payload.parts.forEach((part, i) => {
    const li = document.createElement('li');

    const left = document.createElement('div');
    const idx = document.createElement('p');
    idx.className = 'idx';
    idx.textContent = i + 1 + ' / ' + SONGS.length;
    const name = document.createElement('p');
    name.className = 'name';
    name.textContent = part.title;
    left.append(idx, name);

    const right = document.createElement('div');
    const grade = document.createElement('p');
    grade.className = 'grade';
    grade.textContent = part.grade;
    const pts = document.createElement('p');
    pts.className = 'pts';
    pts.textContent = part.score.toLocaleString();
    right.append(grade, pts);

    li.append(left, right);
    el.resultParts.append(li);
  });
}
