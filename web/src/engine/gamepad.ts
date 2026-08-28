/**
 * Gamepad input (M7), behind the same `InputFrame` seam as the keyboard.
 *
 * Nothing outside this file learns what a gamepad is. `PracticeCanvas` merges
 * one frame from each source and the sessions cannot tell them apart, which
 * is the whole point: every rule, test and demo already written against
 * `InputFrame` keeps working.
 *
 * THE ONE THING THAT MAKES THIS DIFFERENT FROM THE KEYBOARD: the Gamepad API
 * is POLLED, not evented. There is no keydown to latch a press from — you
 * read the whole pad every frame and work out yourself what changed. So the
 * press EDGES here are a diff against the previous poll, and that diff is a
 * pure function the tests drive in plain node.
 *
 * WHY THE DEFAULTS ARE POSITIONS AND NOT LETTERS. PLAN.md scopes this
 * milestone to Kayla's muscle memory transferring to the Switch, and the
 * Setup lesson draws her board in Switch mode. Browsers report a pad through
 * the W3C "standard mapping", which names buttons by POSITION — index 0 is
 * the bottom face button whatever letter is printed on it — and different
 * pads disagree about which letter that is. Defaulting to a letter would be a
 * guess that could teach her the wrong thumb; defaulting to a position is
 * true on every pad, and the Settings remap is how she fixes the rest with
 * the board in her hands.
 */

import type { ControllerChoice } from '@dojo/shared';
import { ACTIONS, type Action } from './input';
import type { InputFrame } from './types';

/**
 * One pad, flattened to the two things this file needs. Keeping the real
 * `Gamepad` out of the core is what lets every test run without a DOM.
 */
export interface GamepadSnapshot {
  /** Pressed state per button, in the pad's own index order. */
  buttons: readonly boolean[];
  /** Axis values in [-1, 1]; 0 and 1 are the left stick on a standard mapping. */
  axes: readonly number[];
}

/** Action → the button indices that trigger it, in standard-mapping order. */
export type GamepadBindings = Record<Action, readonly number[]>;

/**
 * W3C standard-mapping indices, by position, so the bindings below read as
 * intent rather than as magic numbers.
 */
export const BUTTON = Object.freeze({
  faceDown: 0,
  faceRight: 1,
  faceLeft: 2,
  faceUp: 3,
  shoulderLeft: 4,
  shoulderRight: 5,
  triggerLeft: 6,
  triggerRight: 7,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
});

/**
 * A starting point, not a claim about her controller.
 *
 * Jump on the bottom face button and attack on the left face button is the
 * shape Hollow Knight ships in, and dash sits under the right shoulder and
 * the right trigger so either reach works. Movement answers to the d-pad AND
 * the left stick, because a leverless has no stick and a Joy-Con's d-pad is
 * four separate buttons — accepting both costs nothing and means neither
 * board arrives dead.
 *
 * This is the JOY-CON shape and the fallback for a controller nobody has
 * picked yet. `gamepadDefaultsFor` is what turns a choice into a layout.
 */
export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = Object.freeze({
  left: [BUTTON.dpadLeft],
  right: [BUTTON.dpadRight],
  up: [BUTTON.dpadUp],
  down: [BUTTON.dpadDown],
  jump: [BUTTON.faceDown],
  attack: [BUTTON.faceLeft],
  dash: [BUTTON.shoulderRight, BUTTON.triggerRight],
});

/**
 * The leverless layout, and the reason this function exists at all.
 *
 * The site has been telling her about a clash and doing nothing about it for
 * eight sessions. `LeverlessDiagram`'s own screen-reader description says it
 * outright: "In Switch mode the top row is Y X R L and the bottom row is
 * B A ZR ZL, so Attack (Y) and Jump (B) sit under the same finger until
 * remapped." On a leverless the right hand is two rows of four and each
 * COLUMN is one finger, so Y and B are the same finger — and the shipped
 * default put jump on B and attack on Y.
 *
 * The fix is to move attack one column along, to A: still the bottom row,
 * which is where the hand rests, and now under the middle finger with jump
 * under the index and dash under the ring. Three actions, three fingers, one
 * row, all holdable at once — which is the thing the Setup lesson sells the
 * board on in the first place.
 *
 * Dash keeps BOTH of its bindings. R and ZR are the same column and therefore
 * the same finger, so neither collides with anything, and a board that
 * reports one but not the other still arrives working.
 */
export const LEVERLESS_GAMEPAD_BINDINGS: GamepadBindings = Object.freeze({
  left: [BUTTON.dpadLeft],
  right: [BUTTON.dpadRight],
  up: [BUTTON.dpadUp],
  down: [BUTTON.dpadDown],
  jump: [BUTTON.faceDown], // B — bottom row, index finger
  attack: [BUTTON.faceRight], // A — bottom row, middle finger, off B's finger
  dash: [BUTTON.shoulderRight, BUTTON.triggerRight], // R and ZR, ring finger
});

/**
 * The layout a controller starts on.
 *
 * PRESET, THEN OFFER — ratified in playtest 8. This is the preset half: the
 * moment she picks a board, a layout that fits it is applied. It is a GUESS,
 * and it has to be, because "her leverless enumerates as a gamepad" (which she
 * has confirmed) and "we know which index each of its buttons reports on" are
 * different facts and only the first one is established. The offer half — the
 * four-button capture in Settings — is how her real hardware overrules the
 * guess, and it is the reason a wrong preset costs a remap rather than a
 * broken board.
 *
 * `undefined` is a real case and not a defensive one: every screen can be
 * reached before Setup is answered, and a bookmark straight into the Pogo
 * Course must not arrive with no bindings at all.
 */
export function gamepadDefaultsFor(controller: ControllerChoice | undefined): GamepadBindings {
  return controller === 'leverless' ? LEVERLESS_GAMEPAD_BINDINGS : DEFAULT_GAMEPAD_BINDINGS;
}

/**
 * How far the left stick must leave centre before it counts as a direction.
 *
 * Sticks rest a little off-centre and drift as they wear, so a raw non-zero
 * test would have her walking on her own. Half travel is well past any
 * resting slop and still comfortable to reach.
 */
export const STICK_DEADZONE = 0.5;

/** True when any button bound to `action` is down on any connected pad. */
function actionHeld(
  pads: readonly GamepadSnapshot[],
  bindings: GamepadBindings,
  action: Action,
): boolean {
  return pads.some((pad) => bindings[action].some((index) => pad.buttons[index] === true));
}

/** The left stick as a direction, or 0 — deadzoned so a resting stick is still. */
function stickAxis(pads: readonly GamepadSnapshot[], axis: number): number {
  for (const pad of pads) {
    const value = pad.axes[axis] ?? 0;
    if (Math.abs(value) >= STICK_DEADZONE) return Math.sign(value);
  }
  return 0;
}

/** Which actions are held this poll, buttons and stick together. */
export function heldActions(
  pads: readonly GamepadSnapshot[],
  bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS,
): ReadonlySet<Action> {
  const held = new Set<Action>();
  for (const action of ACTIONS) {
    if (actionHeld(pads, bindings, action)) held.add(action);
  }
  // Screen axes: -1 is left and up, which is why down is the positive one.
  const x = stickAxis(pads, 0);
  if (x < 0) held.add('left');
  if (x > 0) held.add('right');
  const y = stickAxis(pads, 1);
  if (y < 0) held.add('up');
  if (y > 0) held.add('down');
  return held;
}

export interface GamepadInput {
  /**
   * Consume one InputFrame from this poll. Press edges are the difference
   * against the previous call, so the caller must call this exactly once per
   * simulation step — the same contract `KeyboardInput.sample()` has.
   */
  sample(pads: readonly GamepadSnapshot[]): InputFrame;
  /** Forget the previous poll, so the next one raises no phantom edges. */
  reset(): void;
}

export function createGamepadInput(
  bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS,
): GamepadInput {
  let previous: ReadonlySet<Action> = new Set();
  return {
    sample(pads): InputFrame {
      const held = heldActions(pads, bindings);
      // A press is an action held now that was not held last poll. The
      // held-only fields need no diff; only the three the game reads as a
      // press do.
      const pressed = (action: Action): boolean => held.has(action) && !previous.has(action);
      const frame: InputFrame = {
        left: held.has('left'),
        right: held.has('right'),
        up: held.has('up'),
        down: held.has('down'),
        jumpHeld: held.has('jump'),
        jumpPressed: pressed('jump'),
        attackPressed: pressed('attack'),
        dashPressed: pressed('dash'),
      };
      previous = held;
      return frame;
    },
    reset(): void {
      previous = new Set();
    },
  };
}

/**
 * Both hands on the same Knight: either source can do anything.
 *
 * A plain OR per field. She can hold left on the pad and jump on the
 * keyboard, which is not a use case anybody asked for but is the only
 * behaviour that never surprises — a source sitting idle contributes nothing,
 * so plugging a pad in can never take the keyboard away.
 */
export function mergeInput(a: InputFrame, b: InputFrame): InputFrame {
  return {
    left: a.left || b.left,
    right: a.right || b.right,
    up: a.up || b.up,
    down: a.down || b.down,
    jumpHeld: a.jumpHeld || b.jumpHeld,
    jumpPressed: a.jumpPressed || b.jumpPressed,
    attackPressed: a.attackPressed || b.attackPressed,
    dashPressed: a.dashPressed || b.dashPressed,
  };
}

/**
 * The lowest button index held on any pad, or null.
 *
 * This is the Settings "press a button" capture. It answers with a POSITION,
 * which is what a remap needs to store — and it is also the honest answer to
 * "what does this board actually report?", which is the question the rest of
 * this milestone is waiting on.
 */
export function pressedButton(pads: readonly GamepadSnapshot[]): number | null {
  for (const pad of pads) {
    const index = pad.buttons.findIndex((down) => down);
    if (index !== -1) return index;
  }
  return null;
}

/**
 * Give one button to one action, exactly as `rebind` does for keys: the
 * action becomes [index] and the index leaves every other action, so a button
 * never means two things. An action stripped of its only button takes the
 * ones this action gave up, so nothing is left dead. Returns a new table.
 */
export function rebindButton(
  bindings: GamepadBindings,
  action: Action,
  index: number,
): GamepadBindings {
  const givenUp = bindings[action].filter((i) => i !== index);
  const out = {} as Record<Action, readonly number[]>;
  for (const a of ACTIONS) {
    if (a === action) {
      out[a] = [index];
      continue;
    }
    const kept = bindings[a].filter((i) => i !== index);
    out[a] = kept.length === 0 && bindings[a].length > 0 ? [...givenUp] : kept;
  }
  return out as GamepadBindings;
}

/**
 * What to call a button she has never seen a number for. Positions, again:
 * "bottom button" is true on every pad, and "A" is true on some of them.
 */
export function buttonName(index: number): string {
  const names: Record<number, string> = {
    [BUTTON.faceDown]: 'bottom button',
    [BUTTON.faceRight]: 'right button',
    [BUTTON.faceLeft]: 'left button',
    [BUTTON.faceUp]: 'top button',
    [BUTTON.shoulderLeft]: 'left shoulder',
    [BUTTON.shoulderRight]: 'right shoulder',
    [BUTTON.triggerLeft]: 'left trigger',
    [BUTTON.triggerRight]: 'right trigger',
    8: 'select',
    9: 'start',
    10: 'left stick press',
    11: 'right stick press',
    [BUTTON.dpadUp]: 'D-pad up',
    [BUTTON.dpadDown]: 'D-pad down',
    [BUTTON.dpadLeft]: 'D-pad left',
    [BUTTON.dpadRight]: 'D-pad right',
    16: 'home',
  };
  return names[index] ?? `button ${index}`;
}

/* ========================================================================== *
 * The DOM edge. Everything above is pure; everything below touches the API.
 * ========================================================================== */

/** What `navigator.getGamepads()` returns, narrowed to what is read. */
interface GamepadLike {
  connected: boolean;
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
  id: string;
  mapping: string;
}

interface GamepadNavigator {
  getGamepads?: () => readonly (GamepadLike | null)[];
}

/**
 * Poll every connected pad. Returns an empty array when the browser has no
 * Gamepad API at all, so no caller needs to feature-detect.
 *
 * Browsers hand back a fixed-length array with nulls in the empty slots, and
 * a pad stays absent until the player presses something on it — that is the
 * API's own anti-fingerprinting rule rather than a bug, and it is why the
 * Settings copy says "press a button" and not "plug one in".
 */
export function readGamepads(nav: GamepadNavigator = navigator): GamepadSnapshot[] {
  const pads = nav.getGamepads?.() ?? [];
  const out: GamepadSnapshot[] = [];
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    out.push({ buttons: pad.buttons.map((b) => b.pressed), axes: [...pad.axes] });
  }
  return out;
}

/** One connected pad, for the Settings page to name. */
export interface ConnectedPad {
  id: string;
  /** False when the browser could not fit this pad to the standard layout. */
  standard: boolean;
}

/**
 * The pads Settings lists. Separate from `readGamepads` because the game
 * needs button states every frame and never needs the name, while Settings
 * needs the name and polls slowly.
 */
export function connectedPads(nav: GamepadNavigator = navigator): ConnectedPad[] {
  const pads = nav.getGamepads?.() ?? [];
  const out: ConnectedPad[] = [];
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    out.push({ id: pad.id, standard: pad.mapping === 'standard' });
  }
  return out;
}

/** The shape SettingsV1.gamepadBindings stores: action → comma-joined indices. */
export function gamepadBindingsToSettings(bindings: GamepadBindings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const action of ACTIONS) out[action] = bindings[action].join(',');
  return out;
}

/**
 * Read stored gamepad overrides. Anything missing or malformed falls back to
 * its default; an action stored as '' is honestly EMPTY — "no button" — the
 * same rule `bindingsFromSettings` follows for keys, and for the same reason:
 * resurrecting the default would hand a button she moved elsewhere to two
 * actions at once. Always returns fresh arrays.
 */
export function gamepadBindingsFromSettings(stored: unknown): GamepadBindings {
  const table =
    stored !== null && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out = {} as Record<Action, number[]>;
  for (const action of ACTIONS) {
    const raw = table[action];
    if (typeof raw === 'string' && raw.trim() === '') {
      out[action] = [];
      continue;
    }
    const indices =
      typeof raw === 'string'
        ? raw
            .split(',')
            .map((part) => Number(part.trim()))
            .filter((n) => Number.isInteger(n) && n >= 0 && n < 32)
        : [];
    out[action] = indices.length > 0 ? indices : [...DEFAULT_GAMEPAD_BINDINGS[action]];
  }
  return out;
}
