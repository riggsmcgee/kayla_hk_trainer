/**
 * The Two Bills — the fight's clock, and nothing else.
 *
 * The boss at the bottom of the well is a survival test, not a kill: neither
 * Bill can be damaged, one touch ends the run, and the score is time survived.
 * 1:30 marks the stop done and the fight keeps escalating past it, chasing a
 * better time (ratified — docs/feedback/2026-08-22-playtest-3.md).
 *
 * That is why this is its own module rather than a mode on `stepStage`: a
 * stage freezes its clock the moment it is cleared, and has no vocabulary for
 * "passed but still alive", for a paused clock, or for timed escalations.
 * Here the three thresholds are latches, so each fires exactly once, and the
 * caller decides what a crossing means — this file only says when.
 */

import { tickDown } from './session';

/**
 * - `ready`   — inert until her first input, so reading the arena is free.
 * - `fighting` — the clock runs and a touch ends it.
 * - `card`    — the dog's arrival card: everything freezes, INCLUDING the clock.
 * - `over`    — she was touched; the clock is frozen for good.
 */
export type BossPhase = 'ready' | 'fighting' | 'card' | 'over';

/** The four moments the fight has; everything else is just time passing. */
export type BossEvent = 'dog-arrives' | 'heat' | 'passed' | 'over';

export const BOSS = {
  /** Survive this long and the stop is done. The fight does not stop here. */
  targetSeconds: 90,
  /** Bill the dog walks in. */
  dogAt: 30,
  /** Both Bills speed up and leave less gap. */
  heatAt: 60,
  /** How long the dog's name card holds the fight. */
  cardSeconds: 2.5,
} as const;

export interface BossState {
  phase: BossPhase;
  /** FIGHT time — the score. Never moves during a card or after the touch. */
  elapsed: number;
  /** Seconds left on the dog's card; zero in every other phase. */
  cardTimer: number;
  /**
   * The three one-way latches. `dogIn` doubles as "the dog is in the arena",
   * which is what tells the session to start stepping him.
   */
  dogIn: boolean;
  hot: boolean;
  passed: boolean;
}

export function createBossState(): BossState {
  return {
    phase: 'ready',
    elapsed: 0,
    cardTimer: 0,
    dogIn: false,
    hot: false,
    passed: false,
  };
}

/** Her first input starts the clock. Harmless to call again. */
export function startBoss(s: BossState): void {
  if (s.phase === 'ready') s.phase = 'fighting';
}

/**
 * "Any key" on the dog's card.
 *
 * It only arms the skip; the next `stepBoss` is still a card step and the one
 * after it is the fight's first frame. That gap is deliberate — the press that
 * dismisses the card must never also be the press that jumps the Knight.
 */
export function skipCard(s: BossState): void {
  if (s.phase === 'card') s.cardTimer = 0;
}

/**
 * Advance the fight by one step and report the one thing that changed, if
 * anything. `ev.playerHit` is whatever the arena saw touch her this step.
 *
 * A touch beats a threshold on the step they share: the run ends where the
 * touch found her, and the threshold never latches.
 */
export function stepBoss(s: BossState, ev: { playerHit: boolean }, dt: number): BossEvent | null {
  if (s.phase === 'card') {
    s.cardTimer = tickDown(s.cardTimer, dt);
    if (s.cardTimer === 0) s.phase = 'fighting';
    return null;
  }

  if (s.phase !== 'fighting') return null;

  if (ev.playerHit) {
    s.phase = 'over';
    return 'over';
  }

  s.elapsed += dt;

  // Ascending order, one crossing per step. A step big enough to jump two
  // thresholds reports the earlier one and catches the later one next step,
  // so neither is ever skipped and neither ever fires twice.
  if (!s.dogIn && s.elapsed >= BOSS.dogAt) {
    s.dogIn = true;
    s.phase = 'card';
    s.cardTimer = BOSS.cardSeconds;
    return 'dog-arrives';
  }
  if (!s.hot && s.elapsed >= BOSS.heatAt) {
    s.hot = true;
    return 'heat';
  }
  if (!s.passed && s.elapsed >= BOSS.targetSeconds) {
    s.passed = true;
    return 'passed';
  }
  return null;
}
