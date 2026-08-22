/**
 * Pure helpers for the Pogo Course page (playtest 2, notes 3 and 5): where
 * Kayla resumes when she opens the Bounce Bog, and the one "Best:" line
 * under the level picker. No React, no storage — progress and runs in,
 * numbers and strings out — so the page stays thin and this stays testable.
 */
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { COURSE_LEVEL_COUNT } from '../engine/roster';
import { courseBest } from '../storage/bests';
import { courseCleared, levelLocked } from '../storage/progress';
import { formatClock } from './bestLine';

/**
 * The level to select when the page opens: the first Bounce Bog level she
 * has not cleared and is allowed to play (resume), else level 1 — once the
 * course is cleared, replaying from the top is practice.
 */
export function nextLevelToPlay(progress: ProgressV1): number {
  for (let level = 1; level <= COURSE_LEVEL_COUNT; level++) {
    if (progress.courseLevelsCleared.includes(level)) continue;
    if (levelLocked(level, progress)) continue;
    return level;
  }
  return 1;
}

export interface AfterClear {
  /** The panel's one line. */
  title: string;
  /** The level to offer next, or null when the course is done and the road goes on. */
  nextLevel: number | null;
  /** The button's text for that level; null with nextLevel. */
  label: string | null;
}

/**
 * What the panel under the canvas says once `level` is cleared, given the
 * progress AFTER the clear was recorded. Mid-course: the next level. On the
 * last level: the course is cleared (the road goes on), unless an earlier
 * level was skipped past — then point back at it, so "done" stays honest.
 */
export function afterClear(level: number, progress: ProgressV1): AfterClear {
  if (level < COURSE_LEVEL_COUNT) {
    return { title: `Level ${level} clear.`, nextLevel: level + 1, label: 'Next level →' };
  }
  if (courseCleared(progress)) {
    return { title: 'Course cleared, Kayla!', nextLevel: null, label: null };
  }
  const back = nextLevelToPlay(progress);
  return { title: `Level ${level} clear.`, nextLevel: back, label: `Level ${back} →` };
}

/** "Best: 0:14.3" for the level's fastest clear, or "No clear yet." */
export function levelBestLine(runs: readonly PracticeRun[], level: number): string {
  const best = courseBest(runs, level);
  return best ? `Best: ${formatClock(best.durationMs)}` : 'No clear yet.';
}
