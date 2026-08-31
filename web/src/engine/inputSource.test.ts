/**
 * Which hand she is using — the signal note 1 turned out to need.
 *
 * The important property is the one that is easy to get wrong: this is a
 * display signal, so a quiet step must never rewrite it. She spends most of
 * a fight not pressing anything, and a signal that fell back to 'keyboard'
 * every time she stopped moving would flicker the copy under the canvas
 * between two boards while she stood still.
 */
import { describe, expect, it } from 'vitest';
import { lastInputSource, noteInputSource, sourceOf } from './inputSource';
import type { InputFrame } from './types';

const IDLE: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpPressed: false,
  attackPressed: false,
  dashPressed: false,
};
const frame = (partial: Partial<InputFrame>): InputFrame => ({ ...IDLE, ...partial });

describe('sourceOf', () => {
  it('names whichever board actually did something', () => {
    expect(sourceOf(frame({ jumpPressed: true }), IDLE)).toBe('keyboard');
    expect(sourceOf(IDLE, frame({ jumpPressed: true }))).toBe('gamepad');
  });

  it('says nothing at all on a quiet step', () => {
    // Null is "no news", not "keyboard". Standing still must not retract
    // what she is holding the board in.
    expect(sourceOf(IDLE, IDLE)).toBe(null);
  });

  it('counts held state, not just fresh presses', () => {
    // Walking right is a level, not an edge, and it is most of what she does.
    expect(sourceOf(IDLE, frame({ right: true }))).toBe('gamepad');
    expect(sourceOf(IDLE, frame({ jumpHeld: true }))).toBe('gamepad');
  });

  it('gives a tie to the pad', () => {
    // Both live is a hand brushing a key with the board in her lap, and the
    // failure being guarded against is being told to press X on the pad.
    expect(sourceOf(frame({ left: true }), frame({ right: true }))).toBe('gamepad');
  });
});

describe('the recorded source', () => {
  it('starts on the keyboard, which is the board every visitor has', () => {
    expect(lastInputSource()).toBe('keyboard');
  });

  it('moves to the pad and stays there through the quiet steps after it', () => {
    noteInputSource(IDLE, frame({ attackPressed: true }));
    expect(lastInputSource()).toBe('gamepad');

    // A whole second of her standing still, reading the arena.
    for (let i = 0; i < 60; i++) noteInputSource(IDLE, IDLE);
    expect(lastInputSource()).toBe('gamepad');
  });

  it('comes back to the keyboard the moment she touches one', () => {
    noteInputSource(IDLE, frame({ attackPressed: true }));
    noteInputSource(frame({ jumpPressed: true }), IDLE);
    expect(lastInputSource()).toBe('keyboard');
  });
});
