import { describe, expect, it } from 'vitest';
import type { PracticeRun } from '@dojo/shared';
import { chapterById } from '../chapters';
import { bestLine, formatClock } from './bestLine';

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

describe('formatClock', () => {
  it('reads as the in-game clock: m:ss.t', () => {
    expect(formatClock(14_300)).toBe('0:14.3');
    expect(formatClock(0)).toBe('0:00.0');
    expect(formatClock(61_080)).toBe('1:01.1');
    expect(formatClock(125_949)).toBe('2:05.9');
  });
});

describe('bestLine', () => {
  it('has nothing to say for Setup or with no runs', () => {
    expect(bestLine(chapterById('setup'), [])).toBeNull();
    expect(bestLine(chapterById('pogo-course'), [])).toBeNull();
    expect(bestLine(chapterById('dodge-arena'), [])).toBeNull();
    expect(bestLine(chapterById('finale'), [])).toBeNull();
  });

  it('shows the fastest clear of the highest cleared course level, for the lesson and the game', () => {
    const runs = [
      run({ level: 1, cleared: true, durationMs: 30_000 }),
      run({ level: 2, cleared: true, durationMs: 22_000 }),
      run({ level: 2, cleared: true, durationMs: 14_300 }),
      run({ level: 3, cleared: false, durationMs: 5_000 }), // fell; not a clear
      run({ level: 4, cleared: true, durationMs: 9_000 }), // the finale's, not the Bog's
    ];
    expect(bestLine(chapterById('pogo-course'), runs)).toBe('Best: level 2 in 0:14.3');
    expect(bestLine(chapterById('pogo'), runs)).toBe('Best: level 2 in 0:14.3');
  });

  it('shows the most hits on the furthest enemy, for the lesson and the arena', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', hitsLanded: 9, cleared: true }),
      run({ mode: 'dodge', enemyId: 'duelist', hitsLanded: 7, cleared: true }),
      run({ mode: 'dodge', enemyId: 'duelist', hitsLanded: 4, cleared: true }),
      run({ mode: 'dodge', enemyId: 'warden', hitsLanded: 12, observeMode: true }), // never counts
      run({ mode: 'dodge', enemyId: 'spitter', wave: 2, hitsLanded: 5 }), // a finale wave, not the arena
    ];
    expect(bestLine(chapterById('dodge-arena'), runs)).toBe('Best: 7 hits on the duelist');
    expect(bestLine(chapterById('reading-enemies'), runs)).toBe('Best: 7 hits on the duelist');
  });

  it('falls back to survival time when she has not landed a hit yet', () => {
    const runs = [run({ mode: 'dodge', enemyId: 'flier', hitsLanded: 0, durationMs: 32_100 })];
    expect(bestLine(chapterById('dodge-arena'), runs)).toBe('Best: 0:32.1 against the flier');
  });

  it('says "1 hit", not "1 hits"', () => {
    const runs = [run({ mode: 'dodge', enemyId: 'walker', hitsLanded: 1 })];
    expect(bestLine(chapterById('dodge-arena'), runs)).toBe('Best: 1 hit on the walker');
  });

  it('prefers the furthest enemy she PASSED over the furthest she merely faced', () => {
    // The roster runs easiest to hardest. arenaBest also reports her longest
    // survival among failures, so before this one panicked half-minute
    // against the warden outranked a passed stage on everything before it —
    // the sign said how far she had wandered, not how far she had got.
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', hitsLanded: 9, cleared: true }),
      run({ mode: 'dodge', enemyId: 'duelist', hitsLanded: 7, cleared: true }),
      run({ mode: 'dodge', enemyId: 'warden', hitsLanded: 0, durationMs: 9_800, cleared: false }),
    ];
    expect(bestLine(chapterById('dodge-arena'), runs)).toBe('Best: 7 hits on the duelist');
  });

  it('still says something when she has not passed anything yet', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', hitsLanded: 2, durationMs: 12_000, cleared: false }),
    ];
    expect(bestLine(chapterById('dodge-arena'), runs)).toBe('Best: 2 hits on the walker');
  });

  it('shows the furthest finale wave, else the finale level', () => {
    const waves = [
      run({ mode: 'dodge', enemyId: 'walker', wave: 1, hitsLanded: 8, cleared: true }),
      run({ mode: 'dodge', enemyId: 'duelist', wave: 2, hitsLanded: 3, cleared: true }),
      run({ mode: 'dodge', enemyId: 'walker', hitsLanded: 20, cleared: true }), // plain arena run
    ];
    expect(bestLine(chapterById('finale'), waves)).toBe('Best: 3 hits in wave 2');

    const levelOnly = [run({ level: 4, cleared: true, durationMs: 40_200 })];
    expect(bestLine(chapterById('finale'), levelOnly)).toBe('Best: level 4 in 0:40.2');
  });

  it('lets the Bills outrank the waves, because they are what the finale ends on', () => {
    // The boss had no line at all: the last and hardest of the twelve
    // scoreable things in the dojo was invisible on the one surface for it.
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', wave: 1, hitsLanded: 8, cleared: true }),
      run({ mode: 'dodge', boss: true, hitsLanded: 0, durationMs: 47_400, cleared: false }),
    ];
    expect(bestLine(chapterById('finale'), runs)).toBe('Best: 0:47.4 against the Bills');
  });

  it('says so when she has been past 1:30', () => {
    const runs = [
      run({ mode: 'dodge', boss: true, hitsLanded: 0, durationMs: 96_200, cleared: true }),
    ];
    expect(bestLine(chapterById('finale'), runs)).toBe(
      'Best: 1:36.2 against the Bills — past 1:30',
    );
  });
});
