/**
 * friendlyKeyName — KeyboardEvent.code → the name printed on the key, for
 * the Settings chips and the caption under every canvas.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../engine/input';
import { BUTTON, DEFAULT_GAMEPAD_BINDINGS } from '../engine/gamepad';
import {
  controlsCaption,
  friendlyKeyName,
  joinButtonNames,
  joinKeyNames,
  jumpKeyName,
} from './keyNames';

describe('jumpKeyName', () => {
  it('is the first jump key, friendly — "Z" by default, so the overlays say "Press Z"', () => {
    expect(jumpKeyName(DEFAULT_BINDINGS)).toBe('Z');
    expect(jumpKeyName({ ...DEFAULT_BINDINGS, jump: ['Space', 'KeyZ'] })).toBe('Space');
    expect(jumpKeyName({ ...DEFAULT_BINDINGS, jump: ['KeyW'] })).toBe('W');
  });

  it('falls back to the default jump key when jump has no key at all', () => {
    expect(jumpKeyName({ ...DEFAULT_BINDINGS, jump: [] })).toBe('Z');
  });
});

describe('friendlyKeyName', () => {
  it('strips the Key/Digit prefixes', () => {
    expect(friendlyKeyName('KeyZ')).toBe('Z');
    expect(friendlyKeyName('KeyA')).toBe('A');
    expect(friendlyKeyName('Digit1')).toBe('1');
  });

  it('draws the arrows', () => {
    expect(friendlyKeyName('ArrowLeft')).toBe('←');
    expect(friendlyKeyName('ArrowRight')).toBe('→');
    expect(friendlyKeyName('ArrowUp')).toBe('↑');
    expect(friendlyKeyName('ArrowDown')).toBe('↓');
  });

  it('names the modifiers without their side', () => {
    expect(friendlyKeyName('ShiftLeft')).toBe('Shift');
    expect(friendlyKeyName('ShiftRight')).toBe('Shift');
    expect(friendlyKeyName('ControlLeft')).toBe('Ctrl');
    expect(friendlyKeyName('AltRight')).toBe('Alt');
  });

  it('keeps the plain names', () => {
    expect(friendlyKeyName('Space')).toBe('Space');
    expect(friendlyKeyName('Enter')).toBe('Enter');
    expect(friendlyKeyName('Backspace')).toBe('Backspace');
    expect(friendlyKeyName('Tab')).toBe('Tab');
    expect(friendlyKeyName('Escape')).toBe('Esc');
    expect(friendlyKeyName('F5')).toBe('F5');
  });

  it('prints punctuation as the character', () => {
    expect(friendlyKeyName('Comma')).toBe(',');
    expect(friendlyKeyName('Period')).toBe('.');
    expect(friendlyKeyName('Slash')).toBe('/');
    expect(friendlyKeyName('Semicolon')).toBe(';');
    expect(friendlyKeyName('Quote')).toBe("'");
    expect(friendlyKeyName('BracketLeft')).toBe('[');
    expect(friendlyKeyName('BracketRight')).toBe(']');
    expect(friendlyKeyName('Minus')).toBe('-');
    expect(friendlyKeyName('Equal')).toBe('=');
    expect(friendlyKeyName('Backquote')).toBe('`');
    expect(friendlyKeyName('Backslash')).toBe('\\');
  });

  it('labels the numpad', () => {
    expect(friendlyKeyName('Numpad1')).toBe('Num 1');
    expect(friendlyKeyName('NumpadEnter')).toBe('Num Enter');
    expect(friendlyKeyName('NumpadAdd')).toBe('Num +');
  });

  it('splits an unknown camel-cased code into words', () => {
    expect(friendlyKeyName('CapsLock')).toBe('Caps Lock');
    expect(friendlyKeyName('IntlBackslash')).toBe('Intl Backslash');
    expect(friendlyKeyName('PageDown')).toBe('Page Down');
  });

  it('returns something readable for garbage', () => {
    expect(friendlyKeyName('')).toBe('?');
  });
});

describe('joinKeyNames', () => {
  it('joins friendly names with commas and a final "or", de-duplicated', () => {
    expect(joinKeyNames(['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'])).toBe('C, K or Shift');
    expect(joinKeyNames(['KeyZ', 'Space'])).toBe('Z or Space');
    expect(joinKeyNames(['KeyU'])).toBe('U');
    expect(joinKeyNames([])).toBe('nothing');
  });
});

describe('controlsCaption', () => {
  it('reads exactly like the old hand-written caption with the defaults', () => {
    expect(controlsCaption(DEFAULT_BINDINGS, DEFAULT_GAMEPAD_BINDINGS)).toBe(
      'Move with ←/→ or A/D · jump with Z or Space (hold for height, tap for a hop) · ' +
        'slash with X or J (hold ↓ in the air to pogo) · dash with C, K or Shift.',
    );
  });

  it('follows a remap', () => {
    const caption = controlsCaption(
      {
        ...DEFAULT_BINDINGS,
        left: ['KeyU'],
        right: ['KeyO'],
        down: ['KeyK'],
        jump: ['Space'],
        dash: ['KeyL'],
      },
      DEFAULT_GAMEPAD_BINDINGS,
    );
    expect(caption).toBe(
      'Move with U/O · jump with Space (hold for height, tap for a hop) · ' +
        'slash with X or J (hold K in the air to pogo) · dash with L.',
    );
  });

  it('spells left and right out when they have different key counts', () => {
    const caption = controlsCaption(
      { ...DEFAULT_BINDINGS, left: ['KeyU'] },
      DEFAULT_GAMEPAD_BINDINGS,
    );
    expect(caption.startsWith('Move with U (left) and → or D (right) · ')).toBe(true);
  });

  /**
   * Note 1, and the half of it the note did not mention: this caption sits
   * under every mini-game the whole time she plays, and it only ever spoke
   * about keys — so a playtest spent on the pad was a playtest spent being
   * told to press X.
   */
  it('speaks about buttons when the pad is the board she last touched', () => {
    const caption = controlsCaption(DEFAULT_BINDINGS, DEFAULT_GAMEPAD_BINDINGS, 'gamepad');
    expect(caption).toBe(
      'Move with the D-pad left/the D-pad right or the left stick · ' +
        'jump with the bottom button (hold for height, tap for a hop) · ' +
        'slash with the left button (hold the D-pad down in the air to pogo) · ' +
        'dash with the right shoulder or the right trigger.',
    );
    // Not one key name left anywhere in it — that is the whole defect.
    expect(caption).not.toMatch(/[ZX]|←|→/);
  });

  it('follows a pad remap the same way it follows a keyboard one', () => {
    const caption = controlsCaption(
      DEFAULT_BINDINGS,
      { ...DEFAULT_GAMEPAD_BINDINGS, jump: [BUTTON.faceRight] },
      'gamepad',
    );
    expect(caption).toContain('jump with the right button');
  });
});

describe('joinButtonNames', () => {
  it('names buttons by position, never by letter', () => {
    // Ratified: the standard mapping knows index 0 is the bottom face button
    // and has no idea what letter is printed on it, and the site's own Setup
    // lesson tells her to remap once — so a letter would be wrong twice over.
    expect(joinButtonNames([BUTTON.faceDown])).toBe('the bottom button');
    expect(joinButtonNames([BUTTON.shoulderRight, BUTTON.triggerRight])).toBe(
      'the right shoulder or the right trigger',
    );
    expect(joinButtonNames([])).toBe('nothing');
  });
});
