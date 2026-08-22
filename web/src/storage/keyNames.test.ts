/**
 * friendlyKeyName — KeyboardEvent.code → the name printed on the key, for
 * the Settings chips and the caption under every canvas.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../engine/input';
import { controlsCaption, friendlyKeyName, joinKeyNames, jumpKeyName } from './keyNames';

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
    expect(controlsCaption(DEFAULT_BINDINGS)).toBe(
      'Move with ←/→ or A/D · jump with Z or Space (hold for height, tap for a hop) · ' +
        'slash with X or J (hold ↓ in the air to pogo) · dash with C, K or Shift.',
    );
  });

  it('follows a remap', () => {
    const caption = controlsCaption({
      ...DEFAULT_BINDINGS,
      left: ['KeyU'],
      right: ['KeyO'],
      down: ['KeyK'],
      jump: ['Space'],
      dash: ['KeyL'],
    });
    expect(caption).toBe(
      'Move with U/O · jump with Space (hold for height, tap for a hop) · ' +
        'slash with X or J (hold K in the air to pogo) · dash with L.',
    );
  });

  it('spells left and right out when they have different key counts', () => {
    const caption = controlsCaption({ ...DEFAULT_BINDINGS, left: ['KeyU'] });
    expect(caption.startsWith('Move with U (left) and → or D (right) · ')).toBe(true);
  });
});
