/**
 * Keyboard input (M1). The core is a pure key-state machine so it tests in
 * plain node; attachKeyboard() is the only DOM-touching part, a thin adapter.
 *
 * Sampling model: the simulation calls sample() exactly once per fixed step.
 * Press EDGES accumulate between samples and are consumed by the next
 * sample — a tap that goes down and up between two steps still counts.
 *
 * Bindings are HK's keyboard defaults plus WASD. M7 replaces this table with
 * rebindable SettingsV1.inputBindings and a Gamepad API source behind the
 * same InputFrame shape.
 */

import type { InputFrame } from './types';

type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash';

const BINDINGS: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyZ: 'jump',
  Space: 'jump',
  KeyX: 'attack',
  KeyJ: 'attack',
  KeyC: 'dash',
  KeyK: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
};

/** True for codes the game uses — the adapter preventDefaults these. */
export function isGameKey(code: string): boolean {
  return code in BINDINGS;
}

export interface KeyboardInput {
  handleKeyDown(code: string): void;
  handleKeyUp(code: string): void;
  /** Drop all held/pending state (window blur, tab switch). */
  handleBlur(): void;
  /** Consume one InputFrame; press edges reset after each call. */
  sample(): InputFrame;
}

export function createKeyboardInput(): KeyboardInput {
  const held = new Set<Action>();
  const pressedSinceSample = new Set<Action>();
  const downCodes = new Set<string>();

  return {
    handleKeyDown(code) {
      const action = BINDINGS[code];
      if (!action || downCodes.has(code)) return; // unbound or OS auto-repeat
      downCodes.add(code);
      held.add(action);
      pressedSinceSample.add(action);
    },
    handleKeyUp(code) {
      const action = BINDINGS[code];
      if (!action) return;
      downCodes.delete(code);
      // Only release the action if no other bound code still holds it.
      for (const down of downCodes) {
        if (BINDINGS[down] === action) return;
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
    if (!isGameKey(e.code)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (targetsInteractiveElement(e)) return;
    e.preventDefault(); // keep Space/arrows from scrolling the page
    input.handleKeyDown(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!isGameKey(e.code)) return;
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
