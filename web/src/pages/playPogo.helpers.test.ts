import { describe, expect, it } from 'vitest';
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { COURSE_LEVEL_COUNT } from '../engine/roster';
import { levelSkipKey } from '../storage/progress';
import { afterClear, levelBestLine, nextLevelToPlay } from './playPogo.helpers';

function progress(over: Partial<ProgressV1> = {}): ProgressV1 {
  return {
    version: 1,
    courseLevelsCleared: [],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    skipped: [],
    ...over,
  };
}

let n = 0;
function run(over: Partial<PracticeRun>): PracticeRun {
  n += 1;
  return {
    id: `run-${n}`,
    mode: 'pogo',
    hitsLanded: 0,
    durationMs: 10_000,
    startedAt: '2026-08-22T00:00:00.000Z',
    ...over,
  };
}

const allLevels = Array.from({ length: COURSE_LEVEL_COUNT }, (_, i) => i + 1);

describe('nextLevelToPlay', () => {
  it('starts a fresh Kayla on level 1', () => {
    expect(nextLevelToPlay(progress())).toBe(1);
  });

  it('resumes at the first level she has not cleared', () => {
    expect(nextLevelToPlay(progress({ courseLevelsCleared: [1] }))).toBe(2);
    expect(nextLevelToPlay(progress({ courseLevelsCleared: [1, 2] }))).toBe(3);
  });

  it('never picks a locked level: cleared 2 without 1 still resumes at 1', () => {
    expect(nextLevelToPlay(progress({ courseLevelsCleared: [2] }))).toBe(1);
  });

  it('goes back to level 1 for practice once the course is cleared', () => {
    expect(nextLevelToPlay(progress({ courseLevelsCleared: allLevels }))).toBe(1);
  });

  it('a skipped level is open, so it is where she resumes', () => {
    const p = progress({ courseLevelsCleared: [1], skipped: [levelSkipKey(3)] });
    expect(nextLevelToPlay(p)).toBe(2);
    const cleared2 = progress({ courseLevelsCleared: [1, 3], skipped: [levelSkipKey(3)] });
    expect(nextLevelToPlay(cleared2)).toBe(2);
  });

  it('never reaches the finale level', () => {
    const p = progress({ courseLevelsCleared: [1, 2] });
    expect(nextLevelToPlay(p)).toBeLessThanOrEqual(COURSE_LEVEL_COUNT);
  });
});

describe('afterClear', () => {
  it('points at the next level after clearing one in the middle', () => {
    expect(afterClear(1, progress({ courseLevelsCleared: [1] }))).toEqual({
      title: 'Level 1 clear.',
      nextLevel: 2,
      label: 'Next level →',
    });
    expect(afterClear(2, progress({ courseLevelsCleared: [1, 2] }))).toEqual({
      title: 'Level 2 clear.',
      nextLevel: 3,
      label: 'Next level →',
    });
  });

  it('celebrates the course once every level is cleared', () => {
    const p = progress({ courseLevelsCleared: allLevels });
    expect(afterClear(COURSE_LEVEL_COUNT, p)).toEqual({
      title: 'Course cleared, Kayla!',
      nextLevel: null,
      label: null,
    });
  });

  it('after the last level, points back at a level she skipped', () => {
    const p = progress({ courseLevelsCleared: [1, 3], skipped: [levelSkipKey(3)] });
    expect(afterClear(COURSE_LEVEL_COUNT, p)).toEqual({
      title: `Level ${COURSE_LEVEL_COUNT} clear.`,
      nextLevel: 2,
      label: 'Level 2 →',
    });
  });

  it('replaying an early level once the course is done still offers the next one', () => {
    const p = progress({ courseLevelsCleared: allLevels });
    expect(afterClear(1, p).nextLevel).toBe(2);
  });
});

describe('levelBestLine', () => {
  it('says so when there is no clear yet', () => {
    expect(levelBestLine([], 1)).toBe('No clear yet.');
    expect(levelBestLine([run({ level: 2, cleared: true })], 1)).toBe('No clear yet.');
    expect(levelBestLine([run({ level: 1, cleared: false })], 1)).toBe('No clear yet.');
  });

  it('shows the fastest clear for that level as the in-game clock reads it', () => {
    const runs = [
      run({ level: 1, cleared: true, durationMs: 30_000 }),
      run({ level: 1, cleared: true, durationMs: 14_300 }),
      run({ level: 2, cleared: true, durationMs: 9_000 }),
    ];
    expect(levelBestLine(runs, 1)).toBe('Best: 0:14.3');
    expect(levelBestLine(runs, 2)).toBe('Best: 0:09.0');
  });

  it('reads an old run with no level as level 1', () => {
    expect(levelBestLine([run({ durationMs: 61_080 })], 1)).toBe('Best: 1:01.1');
  });
});
