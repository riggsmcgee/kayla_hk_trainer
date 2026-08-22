/**
 * The one "Best:" line under the map's next-stop sign — her furthest
 * personal best for that stop, in as few words as possible (playtest 2
 * interview: one line per cleared level / enemy, display only).
 *
 * A lesson shows the best of the mini-game that proves it, so the sign
 * says the same thing whether the Knight stands on the Crossroads or in
 * the Bounce Bog. Pure: runs in, string (or null) out.
 */
import type { PracticeRun } from '@dojo/shared';
import type { Chapter } from '../chapters';
import { COURSE_LEVEL_COUNT, FINALE_LEVEL, FINALE_WAVE_COUNT, ROSTER } from '../engine/roster';
import { arenaBest, courseBest, waveBest, type StageBest } from '../storage/bests';

/** Milliseconds as the in-game clock reads them: m:ss.t. */
export function formatClock(ms: number): string {
  const seconds = ms / 1000;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function hits(best: StageBest): string {
  return `${best.hitsLanded} ${best.hitsLanded === 1 ? 'hit' : 'hits'}`;
}

function courseLine(runs: readonly PracticeRun[]): string | null {
  for (let level = COURSE_LEVEL_COUNT; level >= 1; level--) {
    const best = courseBest(runs, level);
    if (best) return `Best: level ${level} in ${formatClock(best.durationMs)}`;
  }
  return null;
}

function arenaLine(runs: readonly PracticeRun[]): string | null {
  for (let i = ROSTER.length - 1; i >= 0; i--) {
    const enemy = ROSTER[i]!;
    const best = arenaBest(runs, enemy.id);
    if (!best) continue;
    const name = enemy.name.toLowerCase();
    return best.hitsLanded > 0
      ? `Best: ${hits(best)} on the ${name}`
      : `Best: ${formatClock(best.durationMs)} against the ${name}`;
  }
  return null;
}

function finaleLine(runs: readonly PracticeRun[]): string | null {
  for (let wave = FINALE_WAVE_COUNT; wave >= 1; wave--) {
    const best = waveBest(runs, wave);
    if (!best) continue;
    return best.hitsLanded > 0
      ? `Best: ${hits(best)} in wave ${wave}`
      : `Best: ${formatClock(best.durationMs)} in wave ${wave}`;
  }
  const level = courseBest(runs, FINALE_LEVEL);
  return level ? `Best: level ${FINALE_LEVEL} in ${formatClock(level.durationMs)}` : null;
}

/** Her best for this stop, or null when there is nothing to brag about yet. */
export function bestLine(chapter: Chapter, runs: readonly PracticeRun[]): string | null {
  switch (chapter.id) {
    case 'setup':
      return null;
    case 'pogo':
    case 'pogo-course':
      return courseLine(runs);
    case 'reading-enemies':
    case 'dodge-arena':
      return arenaLine(runs);
    case 'finale':
      return finaleLine(runs);
  }
}
