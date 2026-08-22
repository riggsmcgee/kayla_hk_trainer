/**
 * Pure helpers for The Bottom of the Well (playtest 2 interview): the three
 * beats, which one she resumes at, what is locked, the wave to start on,
 * and the one "Best:" line per wave. No React, no storage — progress and
 * runs in, numbers and strings out — so the page stays thin and this
 * stays testable.
 */
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { FINALE_WAVES, FINALE_WAVE_COUNT, rosterEntry } from '../engine/roster';
import { waveBest } from '../storage/bests';
import { finaleLevelSkipKey, waveLocked } from '../storage/progress';
import { formatClock } from './bestLine';

/** The finale, in order: the level, the waves, and what waits below them. */
export type Beat = 1 | 2 | 3;

export interface BeatDef {
  beat: Beat;
  /** What the strip calls it. */
  name: string;
}

export const BEATS: readonly BeatDef[] = [
  { beat: 1, name: 'All of it at once' },
  { beat: 2, name: 'Waves' },
  { beat: 3, name: 'The thing at the bottom' },
];

function allWavesCleared(progress: ProgressV1): boolean {
  for (let wave = 1; wave <= FINALE_WAVE_COUNT; wave++) {
    if (!progress.finaleWavesCleared.includes(wave)) return false;
  }
  return true;
}

/** Finished by its own rule. The third beat has nothing to finish yet. */
export function beatDone(beat: Beat, progress: ProgressV1): boolean {
  switch (beat) {
    case 1:
      return progress.finaleLevelCleared;
    case 2:
      return allWavesCleared(progress);
    case 3:
      return false;
  }
}

/**
 * The waves wait for the level — cleared or skipped, like every gate on the
 * road. The level is never locked, and neither is the bottom: there is
 * nothing there to play.
 */
export function beatLocked(beat: Beat, progress: ProgressV1): boolean {
  if (beat !== 2) return false;
  if (progress.finaleLevelCleared) return false;
  return !progress.skipped.includes(finaleLevelSkipKey());
}

/**
 * Where she resumes when the page opens: the first beat not finished — the
 * level, then the waves — and the bottom once both are done. A skipped
 * level is still unfinished, so it is where she lands.
 */
export function nextBeat(progress: ProgressV1): Beat {
  if (!beatDone(1, progress)) return 1;
  if (!beatDone(2, progress)) return 2;
  return 3;
}

/**
 * The stage index (0-based) the wave session starts on: the first wave she
 * has not cleared and is allowed to play, else wave 1 — once every wave is
 * cleared, running them again from the top is practice.
 */
export function firstUnclearedWave(progress: ProgressV1): number {
  for (let wave = 1; wave <= FINALE_WAVE_COUNT; wave++) {
    if (progress.finaleWavesCleared.includes(wave)) continue;
    if (waveLocked(wave, progress)) continue;
    return wave - 1;
  }
  return 0;
}

/** "Walker + Flier" — who is in the wave, by their roster names. */
export function waveName(wave: number): string {
  const pair = FINALE_WAVES[wave - 1] ?? [];
  return pair.map((id) => rosterEntry(id).name).join(' + ');
}

/** One line for the wave she's on. */
export function waveBestLine(runs: readonly PracticeRun[], wave: number): string {
  const best = waveBest(runs, wave);
  if (!best) return `No run at wave ${wave} yet.`;
  const hits = `${best.hitsLanded} ${best.hitsLanded === 1 ? 'hit' : 'hits'}`;
  return best.cleared
    ? `Best: cleared wave ${wave} with ${hits}.`
    : `Best: ${formatClock(best.durationMs)} in wave ${wave}, ${hits}.`;
}

export interface AfterLevel {
  /** The panel's one line. */
  title: string;
  /** Point at the waves — unless they are already all cleared. */
  offerWaves: boolean;
}

/** What the panel under the canvas says once the level is cleared. */
export function afterLevel(progress: ProgressV1): AfterLevel {
  return { title: 'Level clear.', offerWaves: !allWavesCleared(progress) };
}
