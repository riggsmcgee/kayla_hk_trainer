/**
 * Pure helper for the Settings page's key capture: what one keydown means
 * while an action is waiting for its new key. No React, no DOM — the fields
 * of a KeyboardEvent in, a verdict out — so the refusal list is testable.
 */

/** The parts of a keydown the verdict reads. */
export interface CaptureKey {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * - 'bind': take the key (and prevent its default — the focused Cancel
 *   button would otherwise also click on Space/Enter).
 * - 'cancel': stop capturing. Esc is prevented; Tab is NOT, so the browser
 *   moves her focus — and the next Enter/Space lands where she tabbed to.
 * - 'ignore': leave the key to the browser and keep waiting.
 */
export type CaptureVerdict = 'bind' | 'cancel' | 'ignore';

/**
 * Keys the capture refuses: the chord modifiers never reach the game
 * (attachKeyboard drops Ctrl/Alt/Meta chords), so binding them would be a
 * silent dud. Shift is fine — it is the default Dash.
 */
const UNBINDABLE = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

/** F1–F12 belong to the browser: F5 reloads, F11 is fullscreen, F12 is devtools. */
const F_KEY = /^F\d{1,2}$/;

export function captureVerdict(key: CaptureKey): CaptureVerdict {
  if (key.code === 'Escape' || key.code === 'Tab') return 'cancel';
  // A chord keeps its browser job (Ctrl+R, Cmd+T…); the bare key is not taken either.
  if (key.ctrlKey || key.metaKey || key.altKey) return 'ignore';
  if (key.code === '' || UNBINDABLE.has(key.code) || F_KEY.test(key.code)) return 'ignore';
  return 'bind';
}
