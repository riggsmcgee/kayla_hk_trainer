import { describe, expect, it } from 'vitest';
import {
  BOSS,
  cardAcceptsInput,
  leaveCard,
  createBossState,
  startBoss,
  stepBoss,
  stepIntro,
} from './boss';
import { BILL_ENTRANCE, entranceSeconds } from './entrance';
import type { BossEvent, BossState } from './boss';
import { FIXED_DT } from './constants';

const CALM = { playerHit: false, untouched: true } as const;
const TOUCHED = { playerHit: true, untouched: true } as const;
/**
 * A run that has already been touched and is somehow still going: god mode,
 * the only way that can happen. 1:30 is a marker for this run, not a win.
 */
const BRUISED = { playerHit: false, untouched: false } as const;

const steps = (seconds: number): number => Math.round(seconds / FIXED_DT);

/** Step blindly for `seconds`, whatever phase that lands in. */
function run(s: BossState, seconds: number): BossEvent[] {
  const events: BossEvent[] = [];
  for (let i = 0; i < steps(seconds); i++) {
    const ev = stepBoss(s, CALM, FIXED_DT);
    if (ev) events.push(ev);
  }
  return events;
}

/**
 * Fight for up to `seconds`, stopping the moment the fight stops being one —
 * so an assertion about a card sees it at the instant it appeared, not part
 * way through.
 */
function fight(s: BossState, seconds: number): BossEvent[] {
  const events: BossEvent[] = [];
  for (let i = 0; i < steps(seconds) && s.phase === 'fighting'; i++) {
    const ev = stepBoss(s, CALM, FIXED_DT);
    if (ev) events.push(ev);
  }
  return events;
}

/** Past Bill's entrance and waiting on her first input. */
function ready(): BossState {
  const s = createBossState();
  stepIntro(s, entranceSeconds(BILL_ENTRANCE), entranceSeconds(BILL_ENTRANCE));
  return s;
}

/** A fight already underway. */
function started(): BossState {
  const s = ready();
  startBoss(s);
  return s;
}

/**
 * Dismiss the dog's card the way she does: wait out the lockout, then say so.
 *
 * This used to be `while (s.phase === 'card') stepBoss(...)`, which worked
 * only because the card ended itself after 2.5 s. Playtest 10 made it wait for
 * her instead — so that loop would now spin forever, and a headless caller
 * needs a hand to dismiss it with. That hand is `leaveCard`.
 */
function dismissCard(s: BossState): void {
  run(s, BOSS.cardLockoutSeconds + FIXED_DT);
  leaveCard(s);
}

/** A fight underway with the dog already in and his card behind us. */
function pastTheDog(): BossState {
  const s = started();
  fight(s, BOSS.dogAt + 1);
  dismissCard(s);
  return s;
}

describe('the boss clock, before it starts', () => {
  it('opens on Bill’s entrance, not on the fight', () => {
    // Playtest 4, note 4. The clock is frozen throughout, so a slow intro
    // can never eat her best time — and her input during it fast-forwards
    // the beat rather than starting the fight.
    const s = createBossState();
    expect(s.phase).toBe('intro');
    startBoss(s);
    expect(s.phase).toBe('intro');
    expect(run(s, 5)).toEqual([]);
    expect(s.elapsed).toBe(0);
  });

  it('reaches ready when the entrance finishes, and no sooner', () => {
    const total = entranceSeconds(BILL_ENTRANCE);
    const s = createBossState();
    stepIntro(s, total, total - 0.1);
    expect(s.phase).toBe('intro');
    stepIntro(s, total, 0.1);
    expect(s.phase).toBe('ready');
    expect(s.introElapsed).toBe(total);
    // And it stays put: nothing after the beat keeps winding the intro on.
    stepIntro(s, total, 5);
    expect(s.introElapsed).toBe(total);
  });

  it('is inert until she presses something', () => {
    const s = ready();
    expect(s.phase).toBe('ready');
    expect(run(s, 5)).toEqual([]);
    expect(s.elapsed).toBe(0);
  });

  it('runs once started, advancing by exactly one dt per step', () => {
    const s = started();
    expect(s.phase).toBe('fighting');
    stepBoss(s, CALM, FIXED_DT);
    expect(s.elapsed).toBe(FIXED_DT);
  });
});

describe('the dog arrives at 0:30', () => {
  it('stays quiet right up to the mark', () => {
    const s = started();
    expect(fight(s, BOSS.dogAt - 0.1)).toEqual([]);
    expect(s.dogIn).toBe(false);
  });

  it('fires on the first step that reaches it, and puts up a card', () => {
    const s = started();
    expect(fight(s, BOSS.dogAt + 1)).toEqual(['dog-arrives']);
    expect(s.dogIn).toBe(true);
    expect(s.phase).toBe('card');
    expect(s.cardTimer).toBe(0);
    expect(s.elapsed).toBeGreaterThanOrEqual(BOSS.dogAt);
  });

  it('never fires twice, even if one huge step jumps the mark', () => {
    const s = started();
    expect(stepBoss(s, CALM, 45)).toBe('dog-arrives');
    dismissCard(s);
    // Every step after the jump is past 0:30 too, and must stay quiet.
    expect(fight(s, 5)).toEqual([]);
  });
});

describe('the card is a pause, not a penalty', () => {
  it('does not move the fight clock while it shows, however long she takes', () => {
    const s = started();
    fight(s, BOSS.dogAt + 1);
    const frozen = s.elapsed;

    // A full minute of reading. The whole point: an interruption she did not
    // ask for costs her nothing, and now that it waits for her the cost of
    // taking her time has to be zero too.
    run(s, 60);
    expect(s.elapsed).toBeCloseTo(frozen, 10);
  });

  it('never ends itself, however long it is left alone', () => {
    // The inverse of the rule this test used to pin. Playtest 10: "Instead of
    // automatically just going back to the match, let's have it be another
    // thing where she has to press any button... She has time to read it and
    // doesn't feel rushed."
    const s = started();
    fight(s, BOSS.dogAt + 1);
    run(s, 120);
    expect(s.phase).toBe('card');
  });

  it('ends when she says so, and not before the lockout', () => {
    const s = started();
    fight(s, BOSS.dogAt + 1);
    // A press on the frame it appears is a leftover, not an answer.
    expect(cardAcceptsInput(s)).toBe(false);
    run(s, BOSS.cardLockoutSeconds + FIXED_DT);
    expect(cardAcceptsInput(s)).toBe(true);
    leaveCard(s);
    expect(s.phase).toBe('fighting');
  });
});

describe('the heat at 1:00', () => {
  it('fires exactly once', () => {
    const s = pastTheDog();
    expect(fight(s, BOSS.heatAt - s.elapsed - 0.1)).toEqual([]);
    expect(s.hot).toBe(false);

    expect(fight(s, 0.3)).toEqual(['heat']);
    expect(s.hot).toBe(true);
    expect(fight(s, 5)).toEqual([]);
  });
});

describe('1:30 is the finish line', () => {
  /**
   * Playtest 6 STRUCK "1:30 marks the stop done, and the fight keeps
   * escalating after that for her best time". An invisible score that runs
   * past the ending is worse than an ending — and the score really was
   * invisible: `bestLine.ts` never had a boss line to show it on.
   */
  it('ends the fight and wins it, on the first step that reaches it', () => {
    const s = pastTheDog();
    fight(s, BOSS.targetSeconds - s.elapsed - 0.1);
    expect(s.passed).toBe(false);
    expect(s.phase).toBe('fighting');

    expect(fight(s, 0.3)).toEqual(['won']);
    expect(s.passed).toBe(true);
    expect(s.phase).toBe('won');
  });

  it('freezes the clock at the finish line, and never fires again', () => {
    const s = pastTheDog();
    fight(s, BOSS.targetSeconds - s.elapsed + 1);
    const atTarget = s.elapsed;
    expect(atTarget).toBeGreaterThanOrEqual(BOSS.targetSeconds);

    // Nothing after the win moves the score or reports anything.
    expect(run(s, 10)).toEqual([]);
    expect(s.elapsed).toBeCloseTo(atTarget, 10);
  });

  it('is only a marker for a run that was already touched — god mode', () => {
    // God mode routes every hit through `wouldHaveHit`, so `playerHit` stays
    // false and the run survives. A god-mode run took 29 hits and still
    // reached 1:30 in the browser; it does not get the ending.
    const s = pastTheDog();
    const events: BossEvent[] = [];
    const toTheLine = steps(BOSS.targetSeconds - s.elapsed + 0.2);
    for (let i = 0; i < toTheLine; i++) {
      const ev = stepBoss(s, BRUISED, FIXED_DT);
      if (ev) events.push(ev);
    }
    // The heat at 1:00 is on the way there, and it still fires normally.
    expect(events).toEqual(['heat', 'passed']);
    expect(s.passed).toBe(true);
    expect(s.phase).toBe('fighting');

    // And it keeps escalating, exactly as it did before the ending existed.
    const atTarget = s.elapsed;
    for (let i = 0; i < steps(10); i++) stepBoss(s, BRUISED, FIXED_DT);
    expect(s.elapsed).toBeGreaterThan(atTarget + 9.9);
  });

  it('is beaten by a touch on the step they share', () => {
    // The same rule the dog's card already follows: the run ends where the
    // touch found her, and the threshold never latches.
    const s = pastTheDog();
    fight(s, BOSS.targetSeconds - s.elapsed - FIXED_DT / 2);

    expect(stepBoss(s, TOUCHED, FIXED_DT)).toBe('over');
    expect(s.phase).toBe('over');
    expect(s.passed).toBe(false);
  });
});

describe('the touch that ends it', () => {
  it('freezes the clock where the touch found her', () => {
    const s = started();
    fight(s, 12);
    const died = s.elapsed;

    expect(stepBoss(s, TOUCHED, FIXED_DT)).toBe('over');
    expect(s.phase).toBe('over');
    expect(s.elapsed).toBeCloseTo(died, 10);

    run(s, 5);
    expect(s.elapsed).toBeCloseTo(died, 10);
  });

  it('wins the step it shares with a threshold', () => {
    const s = started();
    fight(s, BOSS.dogAt - FIXED_DT / 2);

    // She is touched on the very step that would have brought the dog in.
    expect(stepBoss(s, TOUCHED, FIXED_DT)).toBe('over');
    expect(s.dogIn).toBe(false);
    expect(s.elapsed).toBeLessThan(BOSS.dogAt);
  });

  it('does not fire twice', () => {
    const s = started();
    fight(s, 3);
    expect(stepBoss(s, TOUCHED, FIXED_DT)).toBe('over');
    expect(stepBoss(s, TOUCHED, FIXED_DT)).toBe(null);
  });
});
