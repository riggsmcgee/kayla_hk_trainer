/**
 * Keyboard input (M1, rebindable since M6.6). The core is a pure key-state
 * machine so it tests in plain node; attachKeyboard() is the only
 * DOM-touching part, a thin adapter.
 *
 * Sampling model: the simulation calls sample() exactly once per fixed step.
 * Press EDGES accumulate between samples and are consumed by the next
 * sample — a tap that goes down and up between two steps still counts.
 *
 * Bindings: an action → KeyboardEvent.code[] table. DEFAULT_BINDINGS is HK's
 * keyboard layout plus WASD; the Settings page stores overrides in
 * SettingsV1.inputBindings (action → comma-joined codes) and the canvas
 * builds its KeyboardInput from bindingsFromSettings(). M7 adds a Gamepad
 * API source behind the same InputFrame shape.
 */

import type { SettingsV1 } from '@dojo/shared';
import type { InputFrame } from './types';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash';

/** Every action, in the order the Settings page lists them. */
export const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash'];

/** Action → the KeyboardEvent.codes that trigger it. */
export type Bindings = Record<Action, readonly string[]>;

export const DEFAULT_BINDINGS: Bindings = Object.freeze({
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'],
});

/** Invert a bindings table into the code → action lookup the state machine uses. */
function codeTable(bindings: Bindings): ReadonlyMap<string, Action> {
  const table = new Map<string, Action>();
  for (const action of ACTIONS) {
    for (const code of bindings[action]) {
      if (!table.has(code)) table.set(code, action); // first action wins on a clash
    }
  }
  return table;
}

/** Build the "is this a game key?" predicate for a bindings table. */
export function makeIsGameKey(bindings: Bindings): (code: string) => boolean {
  const table = codeTable(bindings);
  return (code) => table.has(code);
}

/** True for codes the DEFAULT table uses — kept for callers without a table. */
export const isGameKey: (code: string) => boolean = makeIsGameKey(DEFAULT_BINDINGS);

/**
 * A KeyboardEvent.code is a short ASCII identifier ('KeyA', 'ArrowLeft',
 * 'Numpad1', 'F5'); anything else in storage is garbage and falls back.
 */
const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,31}$/;

/**
 * Read the stored overrides; every action missing or malformed falls back
 * to its default. An action stored as '' is honestly EMPTY — "no key" —
 * not the default: resurrecting the default would hand a key she moved
 * elsewhere to two actions at once (first one wins, the other goes dead).
 * Always returns fresh arrays.
 */
export function bindingsFromSettings(settings: SettingsV1): Record<Action, string[]> {
  const stored: unknown = settings.inputBindings;
  const table = stored !== null && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out = {} as Record<Action, string[]>;
  for (const action of ACTIONS) {
    const raw = table[action];
    if (typeof raw === 'string' && raw.trim() === '') {
      out[action] = [];
      continue;
    }
    const codes =
      typeof raw === 'string'
        ? raw
            .split(',')
            .map((c) => c.trim())
            .filter((c) => CODE_PATTERN.test(c))
        : [];
    out[action] = codes.length > 0 ? codes : [...DEFAULT_BINDINGS[action]];
  }
  return out;
}

/**
 * Give one key to one action (the Settings "Change" capture): the action
 * becomes [code] and the code leaves any other action it was on, so a key
 * never means two things. If that would strip another action of its only
 * key, it takes the keys this action is giving up instead — a swap — so no
 * action is ever left dead. Returns a new table.
 */
export function rebind(bindings: Bindings, action: Action, code: string): Bindings {
  const givenUp = bindings[action].filter((c) => c !== code);
  const out = {} as Record<Action, string[]>;
  for (const a of ACTIONS) {
    if (a === action) {
      out[a] = [code];
      continue;
    }
    const kept = bindings[a].filter((c) => c !== code);
    out[a] = kept.length === 0 && bindings[a].length > 0 ? [...givenUp] : kept;
  }
  return out;
}

/** The shape SettingsV1.inputBindings stores: action → comma-joined codes. */
export function bindingsToSettings(bindings: Bindings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const action of ACTIONS) out[action] = bindings[action].join(',');
  return out;
}

export interface KeyboardInput {
  handleKeyDown(code: string): void;
  handleKeyUp(code: string): void;
  /** Drop all held/pending state (window blur, tab switch). */
  handleBlur(): void;
  /** Consume one InputFrame; press edges reset after each call. */
  sample(): InputFrame;
  /** True for codes this input uses — the adapter preventDefaults these. */
  isGameKey(code: string): boolean;
}

export function createKeyboardInput(bindings: Bindings = DEFAULT_BINDINGS): KeyboardInput {
  const table = codeTable(bindings);
  const held = new Set<Action>();
  const pressedSinceSample = new Set<Action>();
  const downCodes = new Set<string>();

  return {
    handleKeyDown(code) {
      const action = table.get(code);
      if (!action || downCodes.has(code)) return; // unbound or OS auto-repeat
      downCodes.add(code);
      held.add(action);
      pressedSinceSample.add(action);
    },
    handleKeyUp(code) {
      const action = table.get(code);
      if (!action) return;
      downCodes.delete(code);
      // Only release the action if no other bound code still holds it.
      for (const down of downCodes) {
        if (table.get(down) === action) return;
      }
      held.delete(action);
    },
    handleBlur() {
      held.clear();
      pressedSinceSample.clear();
      downCodes.clear();
    },
    sample() {
      const frame: InputFrame = {
        left: held.has('left'),
        right: held.has('right'),
        up: held.has('up'),
        down: held.has('down'),
        jumpHeld: held.has('jump'),
        jumpPressed: pressedSinceSample.has('jump'),
        attackPressed: pressedSinceSample.has('attack'),
        dashPressed: pressedSinceSample.has('dash'),
      };
      pressedSinceSample.clear();
      return frame;
    },
    isGameKey: (code) => table.has(code),
  };
}

/** True when the event targets a control that must keep its own keys. */
function targetsInteractiveElement(e: KeyboardEvent): boolean {
  const el = e.target;
  return (
    el instanceof HTMLElement &&
    el.closest('button, input, select, textarea, a, [contenteditable]') !== null
  );
}

/**
 * DOM adapter: wire a KeyboardInput to window events. Returns a cleanup
 * function; the canvas component calls this once on mount.
 *
 * Two deliberate carve-outs so the page stays usable around the game:
 * modifier chords (Ctrl/Cmd/Alt + anything) are never treated as game
 * input, and keys pressed while a button/input/link has focus go to that
 * control (Space must toggle the observe checkbox, not jump).
 */
export function attachKeyboard(input: KeyboardInput, target: Window = window): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!input.isGameKey(e.code)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (targetsInteractiveElement(e)) return;
    e.preventDefault(); // keep Space/arrows from scrolling the page
    input.handleKeyDown(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!input.isGameKey(e.code)) return;
    // Always release — a key that went down as game input must not stick
    // just because focus moved before the keyup.
    input.handleKeyUp(e.code);
    if (e.ctrlKey || e.metaKey || e.altKey || targetsInteractiveElement(e)) return;
    e.preventDefault();
  };
  const onBlur = (): void => input.handleBlur();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
