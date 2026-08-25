import { describe, expect, it } from 'vitest';
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { CHAPTERS, chapterById, type ChapterId } from '../chapters';
import { COURSE_LEVEL_COUNT, FINALE_WAVE_COUNT, ROSTER } from '../engine/roster';
import {
  chapterDone,
  chapterGate,
  chapterLocked,
  chapterPassed,
  chapterSkipped,
  finaleLevelSkipKey,
  levelLocked,
  levelSkipKey,
  mapProgress,
  standingAt,
  waveLocked,
  waveSkipKey,
  withRunClears,
} from './progress';

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

const allLevels = Array.from({ length: COURSE_LEVEL_COUNT }, (_, i) => i + 1);
const allEnemies = ROSTER.map((e) => e.id);
const allWaves = Array.from({ length: FINALE_WAVE_COUNT }, (_, i) => i + 1);

const courseDone = progress({ controller: 'joycon', courseLevelsCleared: allLevels });
const arenaDone = progress({ ...courseDone, arenaEnemiesCleared: allEnemies });
const everythingDone = progress({
  ...arenaDone,
  finaleLevelCleared: true,
  finaleWavesCleared: allWaves,
  finaleBossCleared: true,
});

const none: ReadonlySet<ChapterId> = new Set();
const visited = (...ids: ChapterId[]): ReadonlySet<ChapterId> => new Set(ids);

describe('chapterDone', () => {
  it('setup is done once she has answered the controller question', () => {
    expect(chapterDone('setup', progress())).toBe(false);
    expect(chapterDone('setup', progress({ controller: 'leverless' }))).toBe(true);
  });

  it('the pogo course (and the pogo lesson) need every Bounce Bog level', () => {
    expect(chapterDone('pogo-course', progress({ courseLevelsCleared: [1, 2] }))).toBe(false);
    expect(chapterDone('pogo', progress({ courseLevelsCleared: [1, 2] }))).toBe(false);
    expect(chapterDone('pogo-course', progress({ courseLevelsCleared: [3, 1, 2] }))).toBe(true);
    expect(chapterDone('pogo', progress({ courseLevelsCleared: [3, 1, 2] }))).toBe(true);
    // The finale's level 4 doesn't count towards the Bog.
    expect(chapterDone('pogo-course', progress({ courseLevelsCleared: [1, 2, 4] }))).toBe(false);
  });

  it('the arena (and the reading lesson) need the whole roster', () => {
    const four = progress({ arenaEnemiesCleared: ['walker', 'flier', 'duelist', 'spitter'] });
    expect(chapterDone('dodge-arena', four)).toBe(false);
    expect(chapterDone('reading-enemies', four)).toBe(false);
    expect(chapterDone('dodge-arena', arenaDone)).toBe(true);
    expect(chapterDone('reading-enemies', arenaDone)).toBe(true);
  });

  it('the finale needs its level, all three waves, AND the Two Bills', () => {
    expect(chapterDone('finale', progress({ finaleWavesCleared: allWaves }))).toBe(false);
    expect(
      chapterDone('finale', progress({ finaleLevelCleared: true, finaleWavesCleared: [1, 2] })),
    ).toBe(false);
    // The waves alone no longer finish the well: the ratified road ends at
    // the Bills, and beat 3 is done at 1:30.
    expect(
      chapterDone('finale', progress({ finaleLevelCleared: true, finaleWavesCleared: allWaves })),
    ).toBe(false);
    expect(chapterDone('finale', everythingDone)).toBe(true);
  });
});

describe('skipped and passed', () => {
  it('a skipped chapter is passed but not done', () => {
    const p = progress({ skipped: ['pogo-course'] });
    expect(chapterSkipped('pogo-course', p)).toBe(true);
    expect(chapterDone('pogo-course', p)).toBe(false);
    expect(chapterPassed('pogo-course', p)).toBe(true);
    expect(chapterPassed('setup', p)).toBe(false);
  });

  it('skipping a mini-game also skips the lesson it proves', () => {
    const p = progress({ skipped: ['dodge-arena'] });
    expect(chapterSkipped('reading-enemies', p)).toBe(true);
    expect(chapterPassed('reading-enemies', p)).toBe(true);
    // ...but not the other way round: skipping the lesson leaves the game unskipped.
    const q = progress({ skipped: ['reading-enemies'] });
    expect(chapterSkipped('dodge-arena', q)).toBe(false);
  });

  it('done beats skipped', () => {
    const p = progress({ ...courseDone, skipped: ['pogo-course'] });
    expect(chapterDone('pogo-course', p)).toBe(true);
    expect(chapterPassed('pogo-course', p)).toBe(true);
  });
});

describe('gates', () => {
  it('each stop is gated on the previous one, except a proof, which is gated like its lesson', () => {
    expect(chapterGate('setup')).toBeNull();
    expect(chapterGate('pogo')?.id).toBe('setup');
    expect(chapterGate('pogo-course')?.id).toBe('setup'); // not 'pogo' — that would be circular
    expect(chapterGate('reading-enemies')?.id).toBe('pogo-course');
    expect(chapterGate('dodge-arena')?.id).toBe('pogo-course');
    expect(chapterGate('finale')?.id).toBe('dodge-arena');
  });

  it('the first chapter is never locked; the rest wait on their gate being passed', () => {
    const fresh = progress();
    expect(chapterLocked('setup', fresh)).toBe(false);
    expect(chapterLocked('pogo', fresh)).toBe(true);
    expect(chapterLocked('pogo-course', fresh)).toBe(true);

    const answered = progress({ controller: 'joycon' });
    expect(chapterLocked('pogo', answered)).toBe(false);
    expect(chapterLocked('pogo-course', answered)).toBe(false); // Prove it → must open
    expect(chapterLocked('reading-enemies', answered)).toBe(true);
    expect(chapterLocked('dodge-arena', answered)).toBe(true);

    expect(chapterLocked('reading-enemies', courseDone)).toBe(false);
    expect(chapterLocked('dodge-arena', courseDone)).toBe(false);
    expect(chapterLocked('finale', courseDone)).toBe(true);
    expect(chapterLocked('finale', arenaDone)).toBe(false);
  });

  it('a skip opens the gate', () => {
    const p = progress({ controller: 'joycon', skipped: ['pogo-course'] });
    expect(chapterLocked('reading-enemies', p)).toBe(false);
    expect(chapterLocked('dodge-arena', p)).toBe(false);
    expect(chapterLocked('finale', p)).toBe(true);
  });
});

describe('levels and waves', () => {
  it('level 1 is never locked; level N waits on N-1 or a skip', () => {
    expect(levelLocked(1, progress())).toBe(false);
    expect(levelLocked(2, progress())).toBe(true);
    expect(levelLocked(2, progress({ courseLevelsCleared: [1] }))).toBe(false);
    expect(levelLocked(3, progress({ courseLevelsCleared: [1] }))).toBe(true);
    expect(levelLocked(3, progress({ courseLevelsCleared: [1, 2] }))).toBe(false);
    expect(levelLocked(3, progress({ skipped: ['pogo-course:level:3'] }))).toBe(false);
    expect(levelSkipKey(3)).toBe('pogo-course:level:3');
  });

  it('wave 1 is never locked; wave N waits on N-1 or a skip', () => {
    expect(waveLocked(1, progress())).toBe(false);
    expect(waveLocked(2, progress())).toBe(true);
    expect(waveLocked(2, progress({ finaleWavesCleared: [1] }))).toBe(false);
    expect(waveLocked(3, progress({ finaleWavesCleared: [1] }))).toBe(true);
    expect(waveLocked(3, progress({ skipped: ['finale:wave:3'] }))).toBe(false);
    expect(waveSkipKey(2)).toBe('finale:wave:2');
  });

  it('the finale level has its own skip key, distinct from every wave and course level', () => {
    expect(finaleLevelSkipKey()).toBe('finale:level');
    expect(finaleLevelSkipKey()).not.toBe(waveSkipKey(1));
    expect(finaleLevelSkipKey()).not.toBe(levelSkipKey(4));
  });
});

describe('withRunClears', () => {
  const run = (over: Partial<PracticeRun>): PracticeRun => ({
    id: 'r',
    mode: 'pogo',
    hitsLanded: 12,
    durationMs: 14_300,
    startedAt: '2026-08-21T00:00:00.000Z',
    ...over,
  });

  it('a run from before levels and `cleared` existed is a level-1 clear', () => {
    const p = withRunClears(progress(), [run({})]);
    expect(p.courseLevelsCleared).toEqual([1]);
    expect(levelLocked(2, p)).toBe(false);
  });

  it('cleared runs add their level; failed runs, finale runs and arena runs do not', () => {
    const p = withRunClears(progress({ courseLevelsCleared: [1] }), [
      run({ level: 2, cleared: true }),
      run({ level: 3, cleared: false }),
      run({ level: 4, cleared: true }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: true }),
    ]);
    expect(p.courseLevelsCleared).toEqual([1, 2]);
  });

  it('hands back the same progress when the runs add nothing', () => {
    const p = progress({ courseLevelsCleared: [1] });
    expect(withRunClears(p, [run({ level: 1, cleared: true })])).toBe(p);
  });
});

describe('standingAt', () => {
  it('stands at the first stop that is not passed', () => {
    expect(standingAt(progress(), none)?.id).toBe('setup');
    expect(standingAt(progress({ controller: 'joycon' }), none)?.id).toBe('pogo');
    expect(standingAt(courseDone, none)?.id).toBe('reading-enemies');
    expect(standingAt(arenaDone, none)?.id).toBe('finale');
    expect(standingAt(everythingDone, none)).toBeNull();
  });

  it('moves on to the proof once she has opened it', () => {
    const p = progress({ controller: 'joycon' });
    expect(standingAt(p, visited('setup', 'pogo'))?.id).toBe('pogo');
    expect(standingAt(p, visited('setup', 'pogo', 'pogo-course'))?.id).toBe('pogo-course');
    expect(standingAt(courseDone, visited('dodge-arena'))?.id).toBe('dodge-arena');
  });

  it('a skipped stop is passed, so she stands past it', () => {
    const p = progress({ controller: 'joycon', skipped: ['pogo-course'] });
    expect(standingAt(p, none)?.id).toBe('reading-enemies');
  });
});

describe('mapProgress', () => {
  it('with no data: the Knight stands at Dirtmouth, everything past it locked', () => {
    const m = mapProgress(progress(), none);
    expect(m.next).toBe(CHAPTERS[0]);
    expect(m.reached).toBe(0);
    expect(m.states).toEqual({
      setup: 'open',
      pogo: 'locked',
      'pogo-course': 'locked',
      'reading-enemies': 'locked',
      'dodge-arena': 'locked',
      finale: 'locked',
    });
  });

  it('tells done, skipped, visited, open and locked apart', () => {
    const p = progress({ controller: 'joycon', skipped: ['pogo-course'] });
    const m = mapProgress(p, visited('setup', 'pogo', 'pogo-course', 'reading-enemies'));
    expect(m.states).toEqual({
      setup: 'done',
      pogo: 'skipped', // its proof was skipped
      'pogo-course': 'skipped',
      'reading-enemies': 'visited',
      'dodge-arena': 'open',
      finale: 'locked',
    });
    expect(m.next).toBe(chapterById('reading-enemies'));
    expect(m.reached).toBe(3); // setup, pogo, pogo-course all passed
  });

  it('a header click straight into a locked stop does not walk the road there', () => {
    const m = mapProgress(progress({ controller: 'joycon' }), visited('setup', 'dodge-arena'));
    expect(m.reached).toBe(1);
    expect(m.next?.id).toBe('pogo');
    expect(m.states['dodge-arena']).toBe('locked');
  });

  it('done everywhere: no next stop, the whole road walked', () => {
    const m = mapProgress(everythingDone, none);
    expect(m.next).toBeNull();
    expect(m.reached).toBe(CHAPTERS.length);
    expect(Object.values(m.states).every((s) => s === 'done')).toBe(true);
  });
});
