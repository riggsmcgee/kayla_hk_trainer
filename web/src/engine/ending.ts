/**
 * The ending — the celebration after 1:30, and nothing else.
 *
 * Written as its own clock for the same reason `boss.ts` is: the fight's
 * clock, the intro's clock and the ending's clock must never be the same
 * number. The score stopped at 1:30 and this runs afterwards, so a slow
 * celebration can no more eat her time than Bill's entrance could.
 *
 * The sequence is ratified in docs/feedback/2026-08-26-playtest-6.md (notes 6
 * and 7, which are one feature), and the user picked the two poses that carry
 * it: the KNEE the moment the clock stops, then the APPLAUSE once the rest of
 * the cast is on. Beat names are what is HAPPENING, never what is drawn — the
 * painters translate.
 */

import { tickDown } from './session';

/**
 * - `concede` — the Bills go down. The clock has just stopped; they were
 *   mid-attack a frame ago and now they are not.
 * - `cheer`   — the applause. Runs until she says she is finished, so nothing
 *   about the ending is on a timer she has to keep up with.
 */
export type EndingBeat = 'concede' | 'cheer';

export const ENDING = {
  /**
   * How long the Bills hold the knee before the cheer starts.
   *
   * Sized against the beat it has to read next to: the dog's card is 2.5 s and
   * Bill's entrance 2.8 s, both of which she watches without input. This is
   * shorter than either on purpose — it is a reaction, not a card.
   */
  concedeSeconds: 2,
} as const;

export interface EndingState {
  beat: EndingBeat;
  /** Seconds since the whole sequence started; never rewinds. */
  elapsed: number;
  /** Seconds left in the current beat; zero once a beat runs forever. */
  beatTimer: number;
}

export function createEndingState(): EndingState {
  return { beat: 'concede', elapsed: 0, beatTimer: ENDING.concedeSeconds };
}

/**
 * Advance the celebration by `dt` and report the beat it just moved INTO, or
 * null if it stayed where it was. One transition per step, like `stepBoss`.
 */
export function stepEnding(s: EndingState, dt: number): EndingBeat | null {
  s.elapsed += dt;
  if (s.beat === 'cheer') return null;

  s.beatTimer = tickDown(s.beatTimer, dt);
  if (s.beatTimer > 0) return null;
  s.beat = 'cheer';
  return 'cheer';
}

/**
 * 0 → 1 through the current beat, for anything that has to animate across it.
 * A beat with no timer (the cheer) is always finished, which is what makes it
 * safe to feed a fade or a slide without special-casing the last beat.
 */
export function beatProgress(s: EndingState): number {
  const total = s.beat === 'concede' ? ENDING.concedeSeconds : 0;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - s.beatTimer / total));
}
