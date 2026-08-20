// FETCH — The True Ending. Alex's rhythm game, ported from the TypeScript/React
// build he sent on 2026-08-19 to FETCH's own idiom: plain ES modules, no build
// step, no dependencies. This file is his `src/game/types.ts` with the types
// stripped and nothing else changed. The numbers are the game's feel — do not
// tune them.

export const LANE_COLORS = ['#e07070', '#6ec8d4', '#8dcf7a', '#d4b46a'];
export const LANE_LABELS = ['left', 'down', 'up', 'right'];

export const WINDOWS = {
  perfect: 0.046,
  great: 0.092,
  good: 0.148,
};

export const TRAVEL = 1.55;

export const SET_ID = 'chomp-set';
