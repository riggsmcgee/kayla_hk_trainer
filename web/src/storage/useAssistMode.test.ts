/**
 * The assist setting's clamp.
 *
 * The failure direction matters: anything a stale, hand-edited or
 * future-versioned settings blob might hold has to read as OFF rather than as
 * "some lives", because a corrupt value should never quietly hand her an
 * easier game she did not ask for.
 */
import { describe, expect, it } from 'vitest';
import { MAX_ASSIST_LIVES, clampLives } from './useAssistMode';

describe('the assist lives clamp', () => {
  it('keeps every value the control can produce', () => {
    for (let n = 0; n <= MAX_ASSIST_LIVES; n++) expect(clampLives(n)).toBe(n);
  });

  it('reads anything out of range as off', () => {
    expect(clampLives(MAX_ASSIST_LIVES + 1)).toBe(0);
    expect(clampLives(99)).toBe(0);
    expect(clampLives(-1)).toBe(0);
  });

  it('reads anything that is not a number as off', () => {
    expect(clampLives(undefined)).toBe(0);
    expect(clampLives(null)).toBe(0);
    expect(clampLives('3')).toBe(0);
    expect(clampLives(Number.NaN)).toBe(0);
  });

  it('floors a fraction rather than carrying it into the engine', () => {
    // The sessions count lives down to zero, so half a life would never be
    // spendable and the last touch would arrive one earlier than the pips say.
    expect(clampLives(2.7)).toBe(2);
  });

  it('offers three, which is what he asked for', () => {
    expect(MAX_ASSIST_LIVES).toBe(3);
  });
});
