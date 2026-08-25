import { describe, expect, it } from 'vitest';
import { BOSS, createBossState, skipCard, startBoss, stepBoss } from './boss';
import type { BossEvent, BossState } from './boss';
import { FIXED_DT } from './constants';

const CALM = { playerHit: false } as const;
const TOUCHED = { playerHit: true } as const;

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

/** A fight already underway. */
function started(): BossState {
  const s = createBossState();
  startBoss(s);
  return s;
}

/** Press "any key" on the card and let the one step it costs go by. */
function dismissCard(s: BossState): void {
  skipCard(s);
  stepBoss(s, CALM, FIXED_DT);
}

/** A fight underway with the dog already in and his card behind us. */
function pastTheDog(): BossState {
  const s = started();
  fight(s, BOSS.dogAt + 1);
  dismissCard(s);
  return s;
}

describe('the boss clock, before it starts', () => {
  it('is inert until she presses something', () => {
    const s = createBossState();
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
    expect(s.cardTimer).toBe(BOSS.cardSeconds);
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
  it('does not move the fight clock while it shows', () => {
    const s = started();
    fight(s, BOSS.dogAt + 1);
    const frozen = s.elapsed;

    run(s, BOSS.cardSeconds);
    // The whole point: an interruption she did not ask for costs her nothing.
    expect(s.elapsed).toBeCloseTo(frozen, 10);
  });

  it('ends itself after its full length', () => {
    const s = started();
    fight(s, BOSS.dogAt + 1);
    run(s, BOSS.cardSeconds);
    expect(s.phase).toBe('fighting');
  });

  it('resumes on the step AFTER the skip, never on the skip itself', () => {
    const s = started();
    fight(s, BOSS.dogAt + 1);
    const frozen = s.elapsed;

    skipCard(s);
    // The step that consumes the skip is still a card step: her "any key"
    // press must not also be the fight's first frame.
    expect(stepBoss(s, CALM, FIXED_DT)).toBe(null);
    expect(s.elapsed).toBeCloseTo(frozen, 10);
    expect(s.phase).toBe('fighting');

    stepBoss(s, CALM, FIXED_DT);
    expect(s.elapsed).toBeCloseTo(frozen + FIXED_DT, 10);
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

describe('1:30 is the target, not the end', () => {
  it('marks the run passed and keeps the fight running', () => {
    const s = pastTheDog();
    fight(s, BOSS.targetSeconds - s.elapsed - 0.1);
    expect(s.passed).toBe(false);

    expect(fight(s, 0.3)).toEqual(['passed']);
    expect(s.passed).toBe(true);
    // Ratified: the clock keeps escalating past 1:30, chasing her best time.
    expect(s.phase).toBe('fighting');
    const atTarget = s.elapsed;
    fight(s, 10);
    expect(s.elapsed).toBeGreaterThan(atTarget + 9.9);
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
