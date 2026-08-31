import { describe, expect, it } from 'vitest';
import { captureVerdict } from './settings.helpers';

describe('captureVerdict', () => {
  it('takes an ordinary key, including Shift (the default Dash)', () => {
    expect(captureVerdict({ code: 'KeyZ' })).toBe('bind');
    expect(captureVerdict({ code: 'Space' })).toBe('bind');
    expect(captureVerdict({ code: 'ArrowLeft' })).toBe('bind');
    expect(captureVerdict({ code: 'ShiftLeft' })).toBe('bind');
    expect(captureVerdict({ code: 'Numpad1' })).toBe('bind');
  });

  it('Esc and Tab cancel the capture', () => {
    expect(captureVerdict({ code: 'Escape' })).toBe('cancel');
    expect(captureVerdict({ code: 'Tab' })).toBe('cancel');
  });

  it('leaves the F-keys to the browser — F5 must still reload', () => {
    for (const code of ['F1', 'F3', 'F5', 'F11', 'F12']) {
      expect(captureVerdict({ code })).toBe('ignore');
    }
  });

  it('leaves chords to the browser, and never binds their bare key', () => {
    expect(captureVerdict({ code: 'KeyR', ctrlKey: true })).toBe('ignore');
    expect(captureVerdict({ code: 'KeyT', metaKey: true })).toBe('ignore');
    expect(captureVerdict({ code: 'KeyD', altKey: true })).toBe('ignore');
    expect(captureVerdict({ code: 'ControlLeft' })).toBe('ignore');
    expect(captureVerdict({ code: 'MetaRight' })).toBe('ignore');
    expect(captureVerdict({ code: '' })).toBe('ignore');
  });
});
