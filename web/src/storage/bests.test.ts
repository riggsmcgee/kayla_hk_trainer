import { describe, expect, it } from 'vitest';
import type { PracticeRun } from '@dojo/shared';
import { arenaBest, courseBest, waveBest } from './bests';

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

describe('courseBest', () => {
  it('is the fastest cleared run for that level', () => {
    const runs = [
      run({ level: 1, cleared: true, durationMs: 30_000 }),
      run({ level: 1, cleared: true, durationMs: 22_000 }),
      run({ level: 1, cleared: false, durationMs: 5_000 }), // fell; doesn't count
      run({ level: 2, cleared: true, durationMs: 9_000 }),
    ];
    expect(courseBest(runs, 1)).toEqual({ durationMs: 22_000 });
    expect(courseBest(runs, 2)).toEqual({ durationMs: 9_000 });
    expect(courseBest(runs, 3)).toBeNull();
  });

  it('reads runs from before levels existed as level 1, cleared', () => {
    const runs = [run({ durationMs: 41_000 }), run({ durationMs: 38_000 })];
    expect(courseBest(runs, 1)).toEqual({ durationMs: 38_000 });
    expect(courseBest(runs, 2)).toBeNull();
  });

  it('ignores dodge runs and returns null with nothing to show', () => {
    expect(courseBest([], 1)).toBeNull();
    expect(courseBest([run({ mode: 'dodge', enemyId: 'walker', cleared: true })], 1)).toBeNull();
  });
});

describe('arenaBest', () => {
  it('prefers the best cleared run: most hits, then longest survival', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 5, durationMs: 60_000 }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 7, durationMs: 60_000 }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 7, durationMs: 61_000 }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: false, hitsLanded: 9, durationMs: 80_000 }),
    ];
    expect(arenaBest(runs, 'walker')).toEqual({
      hitsLanded: 7,
      durationMs: 61_000,
      cleared: true,
    });
  });

  it('falls back to the longest survival among uncleared runs', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'duelist', cleared: false, hitsLanded: 2, durationMs: 12_000 }),
      run({ mode: 'dodge', enemyId: 'duelist', hitsLanded: 0, durationMs: 25_000 }), // pre-tonight run
      run({ mode: 'dodge', enemyId: 'duelist', cleared: false, hitsLanded: 3, durationMs: 25_000 }),
    ];
    expect(arenaBest(runs, 'duelist')).toEqual({
      hitsLanded: 3,
      durationMs: 25_000,
      cleared: false,
    });
  });

  it('never counts observe mode, pogo runs, other enemies or finale waves', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'flier', observeMode: true, durationMs: 99_000 }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 5, durationMs: 60_000 }),
      run({ mode: 'dodge', enemyId: 'flier', wave: 1, cleared: true, hitsLanded: 5 }),
      run({ mode: 'pogo', enemyId: 'flier', cleared: true, hitsLanded: 5 }),
    ];
    expect(arenaBest(runs, 'flier')).toBeNull();
    expect(arenaBest([], 'flier')).toBeNull();
  });
});

describe('waveBest', () => {
  it('works like arenaBest, keyed by wave', () => {
    const runs = [
      run({ mode: 'dodge', wave: 1, cleared: true, hitsLanded: 6, durationMs: 60_000 }),
      run({ mode: 'dodge', wave: 1, cleared: true, hitsLanded: 8, durationMs: 60_000 }),
      run({ mode: 'dodge', wave: 2, cleared: false, hitsLanded: 1, durationMs: 14_000 }),
      run({ mode: 'dodge', wave: 2, cleared: false, hitsLanded: 4, durationMs: 31_000 }),
      run({ mode: 'dodge', wave: 2, observeMode: true, durationMs: 90_000 }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 9, durationMs: 60_000 }),
    ];
    expect(waveBest(runs, 1)).toEqual({ hitsLanded: 8, durationMs: 60_000, cleared: true });
    expect(waveBest(runs, 2)).toEqual({ hitsLanded: 4, durationMs: 31_000, cleared: false });
    expect(waveBest(runs, 3)).toBeNull();
  });
});
