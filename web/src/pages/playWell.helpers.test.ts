import { describe, expect, it } from 'vitest';
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { FINALE_WAVE_COUNT } from '../engine/roster';
import { finaleLevelSkipKey, waveSkipKey } from '../storage/progress';
import {
  BEATS,
  afterLevel,
  beatDone,
  beatLocked,
  bossBestLine,
  firstUnclearedWave,
  nextBeat,
  waveBestLine,
  waveName,
} from './playWell.helpers';

function progress(over: Partial<ProgressV1> = {}): ProgressV1 {
  return {
    version: 1,
    courseLevelsCleared: [],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    finaleBossCleared: false,
    skipped: [],
    ...over,
  };
}

let n = 0;
function run(over: Partial<PracticeRun>): PracticeRun {
  n += 1;
  return {
    id: `run-${n}`,
    mode: 'dodge',
    enemyId: 'walker',
    hitsLanded: 0,
    durationMs: 10_000,
    startedAt: '2026-08-22T00:00:00.000Z',
    ...over,
  };
}

const allWaves = Array.from({ length: FINALE_WAVE_COUNT }, (_, i) => i + 1);

describe('BEATS', () => {
  it('is the three beats, in order, with their names', () => {
    expect(BEATS.map((b) => b.beat)).toEqual([1, 2, 3]);
    expect(BEATS.map((b) => b.name)).toEqual([
      'All of it at once',
      'Waves',
      'The thing at the bottom',
    ]);
  });
});

describe('nextBeat', () => {
  it('starts a fresh Kayla on the level', () => {
    expect(nextBeat(progress())).toBe(1);
  });

  it('moves to the waves once the level is cleared', () => {
    expect(nextBeat(progress({ finaleLevelCleared: true }))).toBe(2);
    expect(nextBeat(progress({ finaleLevelCleared: true, finaleWavesCleared: [1, 2] }))).toBe(2);
  });

  it('rests at the bottom once the level and every wave are cleared', () => {
    expect(nextBeat(progress({ finaleLevelCleared: true, finaleWavesCleared: allWaves }))).toBe(3);
  });

  it('a skipped level is still unfinished, so it is where she resumes', () => {
    const p = progress({ skipped: [finaleLevelSkipKey()], finaleWavesCleared: allWaves });
    expect(nextBeat(p)).toBe(1);
  });
});

function bossRun(over: Partial<PracticeRun>): PracticeRun {
  return {
    id: 'boss-run',
    mode: 'dodge',
    boss: true,
    hitsLanded: 0,
    durationMs: 0,
    startedAt: '2026-08-25T00:00:00.000Z',
    ...over,
  };
}

describe('beatDone', () => {
  it('the level is done when it is cleared', () => {
    expect(beatDone(1, progress())).toBe(false);
    expect(beatDone(1, progress({ finaleLevelCleared: true }))).toBe(true);
  });

  it('the waves are done when every wave is cleared', () => {
    expect(beatDone(2, progress({ finaleWavesCleared: [1, 2] }))).toBe(false);
    expect(beatDone(2, progress({ finaleWavesCleared: allWaves }))).toBe(true);
  });

  it('the thing at the bottom is never done', () => {
    expect(beatDone(3, progress({ finaleLevelCleared: true, finaleWavesCleared: allWaves }))).toBe(
      false,
    );
  });
});

describe('beatLocked', () => {
  it('the level is never locked', () => {
    expect(beatLocked(1, progress())).toBe(false);
  });

  it('the waves wait for the level — cleared or skipped', () => {
    expect(beatLocked(2, progress())).toBe(true);
    expect(beatLocked(2, progress({ finaleLevelCleared: true }))).toBe(false);
    expect(beatLocked(2, progress({ skipped: [finaleLevelSkipKey()] }))).toBe(false);
  });

  it('the bottom waits for every wave — cleared or skipped', () => {
    const waves = [1, 2, 3].slice(0, FINALE_WAVE_COUNT);
    expect(beatLocked(3, progress())).toBe(true);
    expect(beatLocked(3, progress({ finaleWavesCleared: waves.slice(0, -1) }))).toBe(true);
    expect(beatLocked(3, progress({ finaleWavesCleared: waves }))).toBe(false);
    // A skipped wave counts as passed: nothing on this road ever traps her.
    expect(beatLocked(3, progress({ skipped: waves.map(waveSkipKey) }))).toBe(false);
  });
});

describe('the bottom is done at 1:30', () => {
  it('follows finaleBossCleared, and nothing else', () => {
    const waves = [1, 2, 3].slice(0, FINALE_WAVE_COUNT);
    expect(beatDone(3, progress({ finaleWavesCleared: waves }))).toBe(false);
    expect(beatDone(3, progress({ finaleBossCleared: true }))).toBe(true);
  });

  it('is where she resumes once the level and the waves are behind her', () => {
    const waves = [1, 2, 3].slice(0, FINALE_WAVE_COUNT);
    const atTheBottom = progress({ finaleLevelCleared: true, finaleWavesCleared: waves });
    expect(nextBeat(atTheBottom)).toBe(3);
    expect(nextBeat(progress({ ...atTheBottom, finaleBossCleared: true }))).toBe(3);
  });
});

describe('bossBestLine', () => {
  it('says she has not met them yet', () => {
    expect(bossBestLine([])).toBe('You have not met them yet.');
  });

  it('reads an uncleared run as a time, with the mark to beat', () => {
    const line = bossBestLine([bossRun({ cleared: false, durationMs: 82_400 })]);
    expect(line).toContain('1:22');
    expect(line).toContain('1:30');
  });

  it('reads a cleared run as past the mark', () => {
    const line = bossBestLine([bossRun({ cleared: true, durationMs: 104_000 })]);
    expect(line).toContain('1:44');
    expect(line).toContain('past 1:30');
  });
});

describe('firstUnclearedWave', () => {
  it('is a 0-based stage index, starting at wave 1', () => {
    expect(firstUnclearedWave(progress())).toBe(0);
  });

  it('resumes at the first wave she has not cleared', () => {
    expect(firstUnclearedWave(progress({ finaleWavesCleared: [1] }))).toBe(1);
    expect(firstUnclearedWave(progress({ finaleWavesCleared: [1, 2] }))).toBe(2);
  });

  it('never picks a locked wave: cleared 2 without 1 still resumes at 1', () => {
    expect(firstUnclearedWave(progress({ finaleWavesCleared: [2] }))).toBe(0);
  });

  it('goes back to wave 1 for practice once every wave is cleared', () => {
    expect(firstUnclearedWave(progress({ finaleWavesCleared: allWaves }))).toBe(0);
  });

  it('a skipped wave is open, and an uncleared earlier wave still comes first', () => {
    const skippedThree = progress({ finaleWavesCleared: [1], skipped: [waveSkipKey(3)] });
    expect(firstUnclearedWave(skippedThree)).toBe(1);
    const clearedThree = progress({ finaleWavesCleared: [1, 3], skipped: [waveSkipKey(3)] });
    expect(firstUnclearedWave(clearedThree)).toBe(1);
  });
});

describe('waveName', () => {
  it('names the pair from the roster', () => {
    expect(waveName(1)).toBe('Walker + Flier');
    expect(waveName(2)).toBe('Duelist + Spitter');
    expect(waveName(3)).toBe('Spitter + Warden');
  });
});

describe('waveBestLine', () => {
  it('says so when there is no run at that wave yet', () => {
    expect(waveBestLine([], 1)).toBe('No run at wave 1 yet.');
    expect(waveBestLine([run({ wave: 2, cleared: true, hitsLanded: 8 })], 1)).toBe(
      'No run at wave 1 yet.',
    );
  });

  it('ignores plain arena runs against the same enemies', () => {
    expect(waveBestLine([run({ enemyId: 'walker', cleared: true, hitsLanded: 5 })], 1)).toBe(
      'No run at wave 1 yet.',
    );
  });

  it('brags about a cleared wave by its hits', () => {
    const runs = [
      run({ wave: 1, cleared: false, hitsLanded: 9, durationMs: 40_000 }),
      run({ wave: 1, cleared: true, hitsLanded: 10, durationMs: 60_000 }),
      run({ wave: 1, cleared: true, hitsLanded: 11, durationMs: 61_000 }),
    ];
    expect(waveBestLine(runs, 1)).toBe('Best: cleared wave 1 with 11 hits.');
  });

  it('shows the longest survival while the wave is not cleared yet', () => {
    const runs = [
      run({ wave: 2, cleared: false, hitsLanded: 2, durationMs: 31_000 }),
      run({ wave: 2, cleared: false, hitsLanded: 4, durationMs: 12_000 }),
    ];
    expect(waveBestLine(runs, 2)).toBe('Best: 0:31.0 in wave 2, 2 hits.');
    expect(waveBestLine([run({ wave: 2, hitsLanded: 1, durationMs: 5_500 })], 2)).toBe(
      'Best: 0:05.5 in wave 2, 1 hit.',
    );
  });
});

describe('afterLevel', () => {
  it('offers the waves once the level is cleared', () => {
    expect(afterLevel(progress({ finaleLevelCleared: true }))).toEqual({
      title: 'Level clear.',
      offerWaves: true,
    });
  });

  it('has nothing left to offer once every wave is cleared too', () => {
    const p = progress({ finaleLevelCleared: true, finaleWavesCleared: allWaves });
    expect(afterLevel(p)).toEqual({ title: 'Level clear.', offerWaves: false });
  });
});
