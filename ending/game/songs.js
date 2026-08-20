// His `src/game/songs.ts`, types stripped. The four movements, their taglines
// (his words, verbatim) and the seeded mulberry32 chart generator. It is
// deterministic: the same seed makes the same chart every time, so a run is
// comparable to the run before it. Keep it that way.
//
// The only edit: `cover` paths were absolute ("/media/...") because the
// original was served from a site root. This page lives at ending/ inside
// FETCH, so they are relative now and resolve wherever the page is mounted.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATTERNS = [
  [0, 3, 0, 3],
  [1, 2, 1, 2],
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [0, 2, 3, 1],
  [1, 0, 1, 3],
  [2, 3, 2, 0],
  [0, 3, 1, 2],
  [3, 0, 3, 1],
  [1, 3, 0, 2],
];

export const SONGS = [
  {
    id: 'grin-machine',
    title: 'Grin Machine',
    tagline: 'A slow grin. Plenty of time to chomp.',
    bpm: 108,
    difficulty: 'easy',
    bars: 20,
    seed: 1081,
    sixteenth: false,
    density: 0.42,
    jumpChance: 0.04,
    cover: 'media/dancer-stage.jpg',
    stage: 'stage',
    key: 45,
    style: 'house',
  },
  {
    id: 'jawbone-jig',
    title: 'Jawbone Jig',
    tagline: 'He starts swinging the skull for real.',
    bpm: 128,
    difficulty: 'normal',
    bars: 24,
    seed: 1283,
    sixteenth: false,
    density: 0.58,
    jumpChance: 0.12,
    cover: 'media/dancer-club.jpg',
    stage: 'stage',
    key: 48,
    style: 'house',
  },
  {
    id: 'marrow-march',
    title: 'Marrow March',
    tagline: 'Boots on wet concrete. Keep up.',
    bpm: 140,
    difficulty: 'hard',
    bars: 24,
    seed: 1405,
    sixteenth: true,
    density: 0.5,
    jumpChance: 0.18,
    cover: 'media/dancer-spin.jpg',
    stage: 'spin',
    key: 41,
    style: 'march',
  },
  {
    id: 'last-chomp',
    title: 'Last Chomp',
    tagline: 'The jaw never closes. Neither should you.',
    bpm: 160,
    difficulty: 'expert',
    bars: 28,
    seed: 1609,
    sixteenth: true,
    density: 0.62,
    jumpChance: 0.26,
    cover: 'media/skull-close.jpg',
    stage: 'spin',
    key: 52,
    style: 'acid',
  },
];

export function difficultyLabel(d) {
  return d.toUpperCase();
}

export function generateChart(song) {
  const rand = mulberry32(song.seed);
  const beat = 60 / song.bpm;
  const step = song.sixteenth ? beat / 4 : beat / 2;
  const stepsPerBar = song.sixteenth ? 16 : 8;
  const notes = [];
  let lastLane = 0;
  let id = 0;

  const totalSteps = song.bars * stepsPerBar;
  const start = stepsPerBar;
  const end = totalSteps - Math.floor(stepsPerBar * 0.5);

  for (let i = start; i < end; i++) {
    const bar = Math.floor(i / stepsPerBar);
    const pos = i % stepsPerBar;
    const inChorus = bar % 8 >= 4;
    const isDownbeat = pos === 0;
    const isBeat = pos % (song.sixteenth ? 4 : 2) === 0;
    const isOff = !isBeat;

    let p = song.density * (inChorus ? 1.15 : 0.82);
    if (isDownbeat) p *= 1.55;
    else if (isBeat) p *= 1.15;
    else p *= song.sixteenth ? 0.55 : 0.7;

    if (bar % 8 === 0 && pos < (song.sixteenth ? 4 : 2)) p *= 0.35;

    if (rand() > Math.min(0.96, p)) continue;

    const pattern = PATTERNS[Math.floor(rand() * PATTERNS.length)];
    let lane = pattern[pos % pattern.length];
    if (lane === lastLane && rand() < 0.72) {
      lane = (lane + 1 + Math.floor(rand() * 3)) % 4;
    }
    lastLane = lane;

    const time = i * step;
    notes.push({
      id: id++,
      time,
      lane,
      judged: false,
      judgement: null,
    });

    const jumpOk =
      isBeat &&
      rand() < song.jumpChance * (inChorus ? 1.4 : 0.8) &&
      song.difficulty !== 'easy';
    if (jumpOk) {
      const other = (lane + (rand() < 0.5 ? 1 : 2) + (rand() < 0.5 ? 1 : 0)) % 4;
      if (other !== lane) {
        notes.push({
          id: id++,
          time,
          lane: other,
          judged: false,
          judgement: null,
        });
      }
    }

    if (song.difficulty === 'expert' && isOff && inChorus && rand() < 0.18) {
      const extra = (lane + 2) % 4;
      notes.push({
        id: id++,
        time,
        lane: extra,
        judged: false,
        judgement: null,
      });
    }
  }

  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  return notes;
}

export function songDuration(song) {
  return (song.bars * 4 * 60) / song.bpm + 0.4;
}

export function getSong(id) {
  return SONGS.find((s) => s.id === id) ?? SONGS[0];
}
