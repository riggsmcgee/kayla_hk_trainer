/**
 * The rule that decides whether ten keys were the sequence.
 *
 * Worth its own tests for one reason: everything else about the dev lock is
 * "does this render", and this is the only part that can be wrong in a way that
 * nothing on screen would show. A matcher that is too eager opens the door
 * under Kayla while she is playing; a matcher that is too strict cannot be
 * opened by the person who wrote it, which is a bug that looks exactly like a
 * typo and gets debugged as one.
 */
import { describe, expect, it } from 'vitest';
import { UNLOCK_SEQUENCE, advance, isComplete } from './unlockSequence';

/** Feed a run of key codes through the matcher, starting from nothing. */
function type(...codes: readonly string[]): number {
  return codes.reduce((matched, code) => advance(matched, code), 0);
}

describe('the sequence', () => {
  it('opens on all ten, in order', () => {
    expect(isComplete(type(...UNLOCK_SEQUENCE))).toBe(true);
  });

  it('is not open one key short', () => {
    expect(isComplete(type(...UNLOCK_SEQUENCE.slice(0, -1)))).toBe(false);
  });

  it('does not open on the ten keys in another order', () => {
    const swapped = [...UNLOCK_SEQUENCE];
    [swapped[8], swapped[9]] = [swapped[9]!, swapped[8]!];
    expect(isComplete(type(...swapped))).toBe(false);
  });
});

describe('a wrong key', () => {
  it('drops the run to nothing', () => {
    expect(type('ArrowUp', 'ArrowUp', 'ArrowDown', 'KeyX')).toBe(0);
  });

  it('is what makes playing the game safe', () => {
    // The realistic case: she is mid-fight, holding movement keys, and the
    // front of the sequence keeps half-matching. One attack press ends it, and
    // the ninth key is one she has no reason to press at all.
    const mashing = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    expect(isComplete(type(...mashing, 'KeyX', ...mashing, 'KeyZ', ...mashing))).toBe(false);
  });

  it('still counts when it is itself the first key of a fresh attempt', () => {
    // The overshoot everyone types from memory: a third ArrowUp. It cannot
    // continue the run, but it is a perfectly good first key of the next one,
    // and treating it as nothing would leave the sequence unopenable without a
    // deliberate pause nobody knows to make.
    expect(type('ArrowUp', 'ArrowUp', 'ArrowUp')).toBe(1);
    expect(isComplete(type('ArrowUp', 'ArrowUp', 'ArrowUp', ...UNLOCK_SEQUENCE.slice(1)))).toBe(
      true,
    );
  });

  it('does not resurrect a run from the middle', () => {
    // 'ArrowDown' is in the sequence, but not at the start, so a stray one
    // after a break is worth nothing rather than worth three.
    expect(type('KeyX', 'ArrowDown')).toBe(0);
  });
});
