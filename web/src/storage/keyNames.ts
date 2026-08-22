/**
 * KeyboardEvent.code → what is printed on the key. Pure; used by the
 * Settings chips and the caption under every practice canvas.
 *
 * Codes are physical positions ('KeyZ' is the key where Z sits on a US
 * layout), so on another layout the printed letter may differ — good
 * enough for a trainer, and exactly what the browser gives us.
 */

import type { Bindings } from '../engine/input';

const NAMED: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
  ContextMenu: 'Menu',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
};

/** 'CapsLock' → 'Caps Lock', 'IntlBackslash' → 'Intl Backslash'. */
function splitWords(code: string): string {
  return code.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function friendlyKeyName(code: string): string {
  if (code.length === 0) return '?';
  const named = NAMED[code];
  if (named !== undefined) return named;
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code;
  if (code.startsWith('Numpad')) return `Num ${splitWords(code.slice(6))}`;
  return splitWords(code);
}

/**
 * "C, K or Shift" — friendly names joined for a sentence, duplicates
 * collapsed (both Shifts print as one). An empty list reads as "nothing".
 */
export function joinKeyNames(codes: readonly string[]): string {
  const names = [...new Set(codes.map(friendlyKeyName))];
  if (names.length === 0) return 'nothing';
  if (names.length === 1) return names[0] ?? 'nothing';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * "Move with ←/→ or A/D" — left and right paired up when they have the same
 * number of keys (the usual case: arrows + letters), spelled out otherwise.
 */
function movePhrase(left: readonly string[], right: readonly string[]): string {
  const l = [...new Set(left.map(friendlyKeyName))];
  const r = [...new Set(right.map(friendlyKeyName))];
  if (l.length === r.length && l.length > 0) {
    return l.map((name, i) => `${name}/${r[i]}`).join(' or ');
  }
  return `${joinKeyNames(left)} (left) and ${joinKeyNames(right)} (right)`;
}

/** The one-line controls caption under every practice canvas. */
export function controlsCaption(bindings: Bindings): string {
  const down = friendlyKeyName(bindings.down[0] ?? '');
  return (
    `Move with ${movePhrase(bindings.left, bindings.right)} · ` +
    `jump with ${joinKeyNames(bindings.jump)} (hold for height, tap for a hop) · ` +
    `slash with ${joinKeyNames(bindings.attack)} (hold ${down} in the air to pogo) · ` +
    `dash with ${joinKeyNames(bindings.dash)}.`
  );
}

/**
 * The key the in-canvas overlays tell her to press ("Press Z to run it
 * again"): her first jump key, by name. Falls back to Z if jump has no key.
 */
export function jumpKeyName(bindings: Bindings): string {
  const code = bindings.jump[0];
  return code === undefined || code.length === 0 ? 'Z' : friendlyKeyName(code);
}
