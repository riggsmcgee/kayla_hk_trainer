/**
 * KeyboardEvent.code → what is printed on the key. Pure; used by the
 * Settings chips and the caption under every practice canvas.
 *
 * Codes are physical positions ('KeyZ' is the key where Z sits on a US
 * layout), so on another layout the printed letter may differ — good
 * enough for a trainer, and exactly what the browser gives us.
 */

import type { Action, Bindings } from '../engine/input';
import { buttonName, type GamepadBindings } from '../engine/gamepad';
import type { InputSource } from '../engine/inputSource';

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

/**
 * "the bottom button" — pad buttons named by POSITION, joined for a sentence.
 *
 * Positions and not letters, which is ratified: browsers report a pad through
 * the standard mapping, which knows index 0 is the bottom face button and has
 * no idea what letter is printed on it. The Setup lesson also tells her to
 * remap once, so any letter this printed would be wrong immediately after she
 * follows the site's own advice.
 */
export function joinButtonNames(indices: readonly number[]): string {
  const names = [...new Set(indices.map(buttonName))];
  if (names.length === 0) return 'nothing';
  if (names.length === 1) return `the ${names[0]}`;
  return `the ${names.slice(0, -1).join(', the ')} or the ${names[names.length - 1]}`;
}

/**
 * The one-line controls caption under every practice canvas, in the terms of
 * whichever board she last touched.
 *
 * This string is on screen the entire time she plays, on all three mini-game
 * pages, and until now it only ever spoke about keys — so a whole playtest on
 * the pad was spent being told to press X (playtest 6, note 1).
 */
export function controlsCaption(
  bindings: Bindings,
  padBindings: GamepadBindings,
  source: InputSource = 'keyboard',
): string {
  if (source === 'gamepad') {
    // Movement answers to the stick as well as the d-pad, and that is not in
    // the bindings table — it is wired in gamepad.ts — so it is said here.
    return (
      `Move with ${joinButtonNames(padBindings.left)}/${joinButtonNames(padBindings.right)} or the left stick · ` +
      `jump with ${joinButtonNames(padBindings.jump)} (hold for height, tap for a hop) · ` +
      `slash with ${joinButtonNames(padBindings.attack)} ` +
      `(hold ${joinButtonNames(padBindings.down)} in the air to pogo) · ` +
      `dash with ${joinButtonNames(padBindings.dash)}.`
    );
  }
  const down = friendlyKeyName(bindings.down[0] ?? '');
  return (
    `Move with ${movePhrase(bindings.left, bindings.right)} · ` +
    `jump with ${joinKeyNames(bindings.jump)} (hold for height, tap for a hop) · ` +
    `slash with ${joinKeyNames(bindings.attack)} (hold ${down} in the air to pogo) · ` +
    `dash with ${joinKeyNames(bindings.dash)}.`
  );
}

/**
 * The name of the first key bound to `action`, for the in-canvas overlays
 * ("Press Z for level 2"). Falls back when the action has no key bound.
 */
export function actionKeyName(bindings: Bindings, action: Action, fallback: string): string {
  const code = bindings[action][0];
  return code === undefined || code.length === 0 ? fallback : friendlyKeyName(code);
}

/** The forward key on every overlay. Z unless she rebound jump. */
export function jumpKeyName(bindings: Bindings): string {
  return actionKeyName(bindings, 'jump', 'Z');
}

/** The again key on every overlay. X unless she rebound attack. */
export function attackKeyName(bindings: Bindings): string {
  return actionKeyName(bindings, 'attack', 'X');
}

/**
 * What the in-canvas overlays call the FORWARD control, in the terms of the
 * board she last touched: "Z", or "the bottom button".
 *
 * The ratified rule is "jump = forward, attack = again" — not "Z = forward,
 * X = again", which is how PLAN.md and playtest 3 both stated it and which
 * teaches the next reader to hard-code two keys that she may already have
 * rebound and that a pad does not have at all.
 */
export function jumpLabel(
  bindings: Bindings,
  padBindings: GamepadBindings,
  source: InputSource,
): string {
  return source === 'gamepad'
    ? joinButtonNames([padBindings.jump[0] ?? -1])
    : jumpKeyName(bindings);
}

/** What the overlays call the AGAIN control, same rule. */
export function attackLabel(
  bindings: Bindings,
  padBindings: GamepadBindings,
  source: InputSource,
): string {
  return source === 'gamepad'
    ? joinButtonNames([padBindings.attack[0] ?? -1])
    : attackKeyName(bindings);
}
