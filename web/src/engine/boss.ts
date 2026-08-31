/**
 * The Two Bills — the fight's clock, and nothing else.
 *
 * The boss at the bottom of the well is a survival test, not a kill: neither
 * Bill can be damaged, one touch ends the run, and the score is time survived.
 * **1:30 is a finish line** — reach it untouched and the fight is over and won
 * (playtest 6, which STRUCK playtest 3's "1:30 marks the stop done and the
 * fight keeps escalating past it, chasing a better time"; an invisible score
 * that runs past the ending is worse than an ending).
 *
 * That is why this is its own module rather than a mode on `stepStage`: a
 * stage freezes its clock the moment it is cleared, and has no vocabulary for
 * "passed but still alive", for a paused clock, or for timed escalations.
 * Here the three thresholds are latches, so each fires exactly once, and the
 * caller decides what a crossing means — this file only says when.
 */

/**
 * - `intro`   — Bill's entrance (playtest 4, note 4). The arena opens empty
 *   but for the Knight; the clock is frozen throughout, and her input does
 *   NOT start the fight from here — it only fast-forwards the beat. It runs
 *   on every retry, so a slow intro can never eat her best time and can
 *   never be lost to impatience either.
 * - `ready`   — inert until her first input, so reading the arena is free.
 * - `fighting` — the clock runs and a touch ends it.
 * - `card`    — the dog's arrival card: everything freezes, INCLUDING the clock.
 * - `over`    — she was touched; the clock is frozen for good.
 * - `won`     — she reached 1:30 untouched. The clock is frozen for good too,
 *   and this is the phase the whole ending sequence plays in.
 *
 * `won` exists because `over` was the only terminal phase, and it is reachable
 * only by being touched: on a perfect run the last frame of the entire dojo
 * used to be a loss screen reading "Got you." Celebrating under a live fight
 * would let her die walking into a Bill that is congratulating her, and the
 * card phase is an interruption she did not ask for — so the ending gets its
 * own phase (playtest 6, notes 6 and 7).
 */
export type BossPhase = 'intro' | 'ready' | 'fighting' | 'card' | 'over' | 'won';

/** The five moments the fight has; everything else is just time passing. */
export type BossEvent = 'dog-arrives' | 'heat' | 'passed' | 'over' | 'won';

export const BOSS = {
  /** Survive this long untouched and the fight is over and won. */
  targetSeconds: 90,
  /** Bill the dog walks in. */
  dogAt: 30,
  /** Both Bills speed up and leave less gap. */
  heatAt: 60,
  /**
   * How long the dog's name card holds the fight — NOTHING, any more.
   *
   * It used to be a flat 2.5 s on which the shout, the answering woof, the
   * dog's whole walk-in and the name card all happened at once, and playtest
   * 10 was blunt about the result: "They come and go very quickly... It goes
   * by so fast right now." The beats are sequential now (`entrance.ts`) and
   * the card at the end of them waits for her to press something.
   *
   * The constant stays as the LOCKOUT: how long after the card raises before
   * a press is allowed to dismiss it. Not a timer she waits out — a guard
   * against the button she was already holding.
   */
  cardLockoutSeconds: 0.35,
} as const;

export interface BossState {
  phase: BossPhase;
  /** Seconds into Bill's entrance. Frozen at its full length once it is done. */
  introElapsed: number;
  /** FIGHT time — the score. Never moves during a card or after the touch. */
  elapsed: number;
  /**
   * Seconds the card has been up. Counts UP and stops at nothing: the card
   * is dismissed by her, not by a clock. Used only to know whether the
   * lockout above has passed.
   */
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
    phase: 'intro',
    introElapsed: 0,
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
 * She pressed something on the dog's card, and the fight resumes.
 *
 * The one way out of `card`. It exists as its own function rather than as a
 * branch inside `stepBoss` because the decision needs an input edge and a
 * beat state that this file deliberately knows nothing about — and because a
 * headless caller (the bot, the tests) needs a hand to dismiss it with. It
 * used to end itself after 2.5 s, which is exactly what playtest 10 removed.
 */
export function leaveCard(s: BossState): void {
  if (s.phase === 'card') s.phase = 'fighting';
}

/** Has the card been up long enough that a press is hers and not a leftover? */
export function cardAcceptsInput(s: BossState): boolean {
  return s.phase === 'card' && s.cardTimer >= BOSS.cardLockoutSeconds;
}

/**
 * Advance Bill's entrance by `dt` seconds of intro time — the session scales
 * that by the fast-forward when she is holding jump — and move on to
 * `ready` when the beat is over.
 *
 * Deliberately separate from `stepBoss`: the fight's clock and the intro's
 * clock must never be the same number, because the whole point of the beat
 * is that it costs her nothing.
 */
export function stepIntro(s: BossState, seconds: number, dt: number): void {
  if (s.phase !== 'intro') return;
  s.introElapsed += dt;
  if (s.introElapsed >= seconds) {
    s.introElapsed = seconds;
    s.phase = 'ready';
  }
}

/**
 * Advance the fight by one step and report the one thing that changed, if
 * anything. `ev.playerHit` is whatever the arena saw touch her this step.
 *
 * A touch beats a threshold on the step they share: the run ends where the
 * touch found her, and the threshold never latches.
 *
 * `ev.untouched` is what decides whether 1:30 is a win, and it has to be told
 * rather than inferred. In normal play reaching 1:30 at all proves she was
 * never touched — one touch ends the run — but god mode routes every hit
 * through `wouldHaveHit` instead, and a god-mode run took 29 hits and still
 * reached 1:30 in the browser. God mode does not earn the ending (playtest 6),
 * so the caller passes the fact rather than this file guessing at it.
 */
export function stepBoss(
  s: BossState,
  ev: { playerHit: boolean; untouched: boolean },
  dt: number,
): BossEvent | null {
  if (s.phase === 'card') {
    // Counts up and never leaves on its own. The card ends when she says so,
    // and `leaveCard` is the only door — see BOSS.cardLockoutSeconds.
    s.cardTimer += dt;
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
    s.cardTimer = 0;
    return 'dog-arrives';
  }
  if (!s.hot && s.elapsed >= BOSS.heatAt) {
    s.hot = true;
    return 'heat';
  }
  if (!s.passed && s.elapsed >= BOSS.targetSeconds) {
    s.passed = true;
    // The finish line. Untouched, it ends the fight; in god mode it is only a
    // marker the HUD reads, and the fight runs on exactly as it always did —
    // which is what keeps god mode useful for watching the fight itself.
    if (ev.untouched) {
      s.phase = 'won';
      return 'won';
    }
    return 'passed';
  }
  return null;
}
