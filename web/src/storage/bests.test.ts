import { describe, expect, it } from 'vitest';
import type { PracticeRun } from '@dojo/shared';
import {
  arenaBest,
  bestHits,
  billsWinWasAssisted,
  bossBest,
  clearedBillsClean,
  courseBest,
  waveBest,
} from './bests';

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
    expect(courseBest(runs, 1)).toEqual({ durationMs: 22_000, assisted: false });
    expect(courseBest(runs, 2)).toEqual({ durationMs: 9_000, assisted: false });
    expect(courseBest(runs, 3)).toBeNull();
  });

  it('reads runs from before levels existed as level 1, cleared', () => {
    const runs = [run({ durationMs: 41_000 }), run({ durationMs: 38_000 })];
    expect(courseBest(runs, 1)).toEqual({ durationMs: 38_000, assisted: false });
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
      assisted: false,
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
      assisted: false,
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
    expect(waveBest(runs, 1)).toEqual({
      hitsLanded: 8,
      durationMs: 60_000,
      cleared: true,
      assisted: false,
    });
    expect(waveBest(runs, 2)).toEqual({
      hitsLanded: 4,
      durationMs: 31_000,
      cleared: false,
      assisted: false,
    });
    expect(waveBest(runs, 3)).toBeNull();
  });
});

describe('bossBest', () => {
  const boss = (over: Partial<PracticeRun>): PracticeRun =>
    run({ mode: 'dodge', boss: true, ...over });

  it('takes the longest survival while she has never reached 1:30', () => {
    const runs = [
      boss({ cleared: false, durationMs: 41_000 }),
      boss({ cleared: false, durationMs: 82_000 }),
      boss({ cleared: false, durationMs: 6_000 }),
    ];
    expect(bossBest(runs)?.durationMs).toBe(82_000);
    expect(bossBest(runs)?.cleared).toBe(false);
  });

  it('prefers a cleared run over a longer uncleared one', () => {
    // Not a contradiction: an uncleared run cannot be longer than a cleared
    // one in this fight, but the ordering must still say clears come first.
    const runs = [
      boss({ cleared: false, durationMs: 89_000 }),
      boss({ cleared: true, durationMs: 91_000 }),
    ];
    expect(bossBest(runs)).toEqual({
      hitsLanded: 0,
      durationMs: 91_000,
      cleared: true,
      assisted: false,
    });
  });

  it('is null until she has met them', () => {
    expect(bossBest([run({ mode: 'dodge', enemyId: 'warden' })])).toBeNull();
  });

  it('never lets a boss run be mistaken for an arena or wave best', () => {
    const runs = [boss({ cleared: true, durationMs: 95_000 })];
    for (const id of ['walker', 'flier', 'spitter', 'duelist', 'warden'] as const) {
      expect(arenaBest(runs, id)).toBeNull();
    }
    for (const wave of [1, 2, 3]) expect(waveBest(runs, wave)).toBeNull();
  });
});

/**
 * DEV TOOL: remove in the final build. A run played with god mode on is not a
 * best in any of the three modes — nothing could have ended it, so its time
 * and its survival mean nothing. Same treatment observe-mode runs already get.
 */
describe('god-mode runs never become a best', () => {
  it('is skipped by courseBest, however fast it was', () => {
    const runs = [
      run({ mode: 'pogo', level: 1, cleared: true, durationMs: 40_000 }),
      run({ mode: 'pogo', level: 1, cleared: true, durationMs: 1_000, godMode: true }),
    ];
    // The cheated 1 s run would otherwise be an unbeatable personal best.
    expect(courseBest(runs, 1)).toEqual({ durationMs: 40_000, assisted: false });
  });

  it('is skipped by arenaBest, waveBest and bossBest alike', () => {
    const cheated = { cleared: true, durationMs: 999_000, hitsLanded: 99, godMode: true };
    expect(arenaBest([run({ mode: 'dodge', enemyId: 'warden', ...cheated })], 'warden')).toBeNull();
    expect(waveBest([run({ mode: 'dodge', wave: 1, ...cheated })], 1)).toBeNull();
    expect(bossBest([run({ mode: 'dodge', boss: true, ...cheated })])).toBeNull();
  });

  it('leaves an honest run beside it untouched', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'warden', cleared: false, durationMs: 12_000, hitsLanded: 2 }),
      run({ mode: 'dodge', enemyId: 'warden', cleared: true, durationMs: 60_000, godMode: true }),
    ];
    expect(arenaBest(runs, 'warden')?.durationMs).toBe(12_000);
    expect(arenaBest(runs, 'warden')?.cleared).toBe(false);
  });
});

/**
 * The arena's high score, which playtest 10 put where the hits requirement
 * used to be. A separate question from `arenaBest`, deliberately — see below.
 */
describe('bestHits', () => {
  const walker = (over: Partial<PracticeRun>) => run({ mode: 'dodge', enemyId: 'walker', ...over });
  const isWalker = (r: PracticeRun) =>
    r.mode === 'dodge' && r.enemyId === 'walker' && r.wave === undefined;

  it('is the most hits she ever landed, cleared or not', () => {
    const runs = [walker({ hitsLanded: 3, cleared: true }), walker({ hitsLanded: 9 })];
    expect(bestHits(runs, isWalker)).toBe(9);
  });

  it('does NOT agree with arenaBest, and that is the whole reason it exists', () => {
    // arenaBest ranks a CLEAR above everything before it looks at a number,
    // so her best clear can be three hits while her best score is nine.
    // Showing her the three would be showing her the smaller true number.
    const runs = [walker({ hitsLanded: 3, cleared: true }), walker({ hitsLanded: 9 })];
    expect(arenaBest(runs, 'walker')?.hitsLanded).toBe(3);
    expect(bestHits(runs, isWalker)).toBe(9);
  });

  it('is null when she has never scored there, so the HUD can say so', () => {
    expect(bestHits([], isWalker)).toBeNull();
    expect(bestHits([walker({ hitsLanded: 4 })], (r) => r.enemyId === 'flier')).toBeNull();
  });

  it('counts a genuine zero rather than reporting no score at all', () => {
    // Since a stage clears on time alone, a nought-hit run is a real result.
    expect(bestHits([walker({ hitsLanded: 0, cleared: true })], isWalker)).toBe(0);
  });

  it('skips observe and god-mode runs, like every other best here', () => {
    const runs = [
      walker({ hitsLanded: 2 }),
      walker({ hitsLanded: 50, observeMode: true }),
      walker({ hitsLanded: 99, godMode: true }),
    ];
    expect(bestHits(runs, isWalker)).toBe(2);
  });

  it('keeps a wave run out of an enemy score, and vice versa', () => {
    const runs = [walker({ hitsLanded: 2 }), run({ mode: 'dodge', wave: 1, hitsLanded: 40 })];
    expect(bestHits(runs, isWalker)).toBe(2);
    expect(bestHits(runs, (r) => r.mode === 'dodge' && r.wave === 1)).toBe(40);
  });
});

/**
 * Assist mode and the scoreboard. The rule playtest 10 settled is RANK, not
 * exclude — the opposite of god mode's treatment, and for a reason: god mode
 * makes a run meaningless, assist is a choice she is allowed to make. So its
 * runs count, sit below clean ones, and carry the tag that says so.
 */
describe('assist runs are ranked below clean ones, never excluded', () => {
  it('keeps an assisted run as a best when it is the only one she has', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 7, assisted: true }),
    ];
    // Excluding it — the god-mode treatment — would freeze her high score at
    // nothing for the whole time assist is on, which would neuter the very
    // feature the score was added to encourage.
    expect(arenaBest(runs, 'walker')?.assisted).toBe(true);
    expect(arenaBest(runs, 'walker')?.hitsLanded).toBe(7);
  });

  it('lets a clean run outrank an assisted one at ANY hit count', () => {
    const runs = [
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 99, assisted: true }),
      run({ mode: 'dodge', enemyId: 'walker', cleared: true, hitsLanded: 1 }),
    ];
    const best = arenaBest(runs, 'walker');
    expect(best?.assisted).toBe(false);
    expect(best?.hitsLanded).toBe(1);
  });

  it('does the same for a course level, where fastest rather than most wins', () => {
    const runs = [
      run({ mode: 'pogo', level: 1, cleared: true, durationMs: 5_000, assisted: true }),
      run({ mode: 'pogo', level: 1, cleared: true, durationMs: 90_000 }),
    ];
    expect(courseBest(runs, 1)).toEqual({ durationMs: 90_000, assisted: false });
  });

  it('still counts an assisted run in the hits high score', () => {
    const runs = [run({ mode: 'dodge', enemyId: 'walker', hitsLanded: 6, assisted: true })];
    expect(bestHits(runs, (r) => r.enemyId === 'walker')).toBe(6);
  });
});

describe('which ending letter she has earned', () => {
  const bossRun = (over: Partial<PracticeRun>) =>
    run({ mode: 'dodge', boss: true, cleared: true, hitsLanded: 0, ...over });

  it('keeps his words whole when there is no assisted win on record', () => {
    // The trim exists to stop the letter saying something untrue. With no
    // evidence of assist there is nothing untrue to avoid, so an empty or
    // missing history gets the full letter rather than a trim it never earned.
    expect(billsWinWasAssisted([])).toBe(false);
    expect(billsWinWasAssisted([bossRun({})])).toBe(false);
  });

  it('trims it for a win she took with lives on', () => {
    expect(billsWinWasAssisted([bossRun({ assisted: true })])).toBe(true);
  });

  it('restores it for good the moment she does it clean', () => {
    // The whole point of deciding this at render rather than storing it: the
    // two lines about never being touched become true retroactively.
    const runs = [bossRun({ assisted: true }), bossRun({})];
    expect(billsWinWasAssisted(runs)).toBe(false);
    expect(clearedBillsClean(runs)).toBe(true);
  });

  it('does not count a god-mode 1:30 as a clean win', () => {
    // `cleared` on a boss run is `boss.passed`, which is set at 1:30 whether
    // or not anything could have stopped her.
    expect(clearedBillsClean([bossRun({ godMode: true })])).toBe(false);
  });
});
