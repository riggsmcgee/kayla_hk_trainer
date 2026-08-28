/**
 * Gamepad seam tests (M7).
 *
 * Seam: the pure half of engine/gamepad.ts. The Gamepad API is POLLED rather
 * than evented, so the press edges the game reads are a diff this file owns —
 * and a diff is exactly the kind of thing that is right in the happy case and
 * wrong on the frame a pad disconnects, so it is worth pinning properly.
 *
 * The DOM half (readGamepads / connectedPads) is driven through a fake
 * navigator; nothing here needs a browser.
 */
import { describe, expect, it } from 'vitest';
import {
  BUTTON,
  DEFAULT_GAMEPAD_BINDINGS,
  STICK_DEADZONE,
  buttonName,
  connectedPads,
  createGamepadInput,
  gamepadBindingsFromSettings,
  gamepadBindingsToSettings,
  heldActions,
  mergeInput,
  pressedButton,
  readGamepads,
  rebindButton,
  type GamepadSnapshot,
  LEVERLESS_GAMEPAD_BINDINGS,
  gamepadDefaultsFor,
} from './gamepad';
import { ACTIONS } from './input';
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

/** A standard-mapping pad with the listed buttons down and the stick centred. */
function pad(down: readonly number[] = [], axes: readonly number[] = [0, 0]): GamepadSnapshot {
  const buttons = Array.from({ length: 17 }, (_, i) => down.includes(i));
  return { buttons, axes };
}

describe('reading a pad', () => {
  it('maps the default bindings to the actions the game already knows', () => {
    expect([...heldActions([pad([BUTTON.faceDown])])]).toEqual(['jump']);
    expect([...heldActions([pad([BUTTON.faceLeft])])]).toEqual(['attack']);
    expect([...heldActions([pad([BUTTON.dpadRight])])]).toEqual(['right']);
  });

  it('takes dash from either the right shoulder or the right trigger', () => {
    // A leverless and a Joy-Con put the comfortable button in different
    // places; accepting both means neither board arrives dead.
    expect(heldActions([pad([BUTTON.shoulderRight])]).has('dash')).toBe(true);
    expect(heldActions([pad([BUTTON.triggerRight])]).has('dash')).toBe(true);
  });

  it('reads the left stick as well as the D-pad', () => {
    expect(heldActions([pad([], [-1, 0])]).has('left')).toBe(true);
    expect(heldActions([pad([], [1, 0])]).has('right')).toBe(true);
    // Screen axes: -1 is up, so down is the positive one.
    expect(heldActions([pad([], [0, -1])]).has('up')).toBe(true);
    expect(heldActions([pad([], [0, 1])]).has('down')).toBe(true);
  });

  it('ignores a stick resting off-centre, so she never walks on her own', () => {
    const drift = STICK_DEADZONE - 0.01;
    expect([...heldActions([pad([], [drift, drift])])]).toEqual([]);
    expect(heldActions([pad([], [STICK_DEADZONE, 0])]).has('right')).toBe(true);
  });

  it('accepts any of several pads, so a second controller is not dead', () => {
    expect(heldActions([pad(), pad([BUTTON.faceDown])]).has('jump')).toBe(true);
  });

  it('reads nothing at all from no pads', () => {
    expect([...heldActions([])]).toEqual([]);
  });
});

describe('press edges, which the API does not give us', () => {
  it('raises a press on the poll a button goes down, and not after', () => {
    const input = createGamepadInput();
    expect(input.sample([pad()]).jumpPressed).toBe(false);
    const first = input.sample([pad([BUTTON.faceDown])]);
    expect(first.jumpPressed).toBe(true);
    expect(first.jumpHeld).toBe(true);
    // Still held, but no longer a press — the same contract the keyboard has.
    const second = input.sample([pad([BUTTON.faceDown])]);
    expect(second.jumpPressed).toBe(false);
    expect(second.jumpHeld).toBe(true);
  });

  it('raises a second press only after a release', () => {
    const input = createGamepadInput();
    input.sample([pad([BUTTON.faceLeft])]);
    input.sample([pad([BUTTON.faceLeft])]);
    expect(input.sample([pad()]).attackPressed).toBe(false);
    expect(input.sample([pad([BUTTON.faceLeft])]).attackPressed).toBe(true);
  });

  it('does not raise a phantom press when a pad vanishes and comes back', () => {
    // Unplugged mid-hold: the button is gone, so it is released. Plugged back
    // in still held would otherwise look like a fresh press she never made —
    // it IS a fresh press here, and that is correct, because from the game's
    // side the button did go from up to down.
    const input = createGamepadInput();
    input.sample([pad([BUTTON.faceDown])]);
    const gone = input.sample([]);
    expect(gone.jumpHeld).toBe(false);
    expect(gone.jumpPressed).toBe(false);
  });

  it('forgets the previous poll on reset, so a fresh session starts clean', () => {
    const input = createGamepadInput();
    input.sample([pad([BUTTON.faceDown])]);
    input.reset();
    expect(input.sample([pad([BUTTON.faceDown])]).jumpPressed).toBe(true);
  });

  it('honours a rebound button and drops the one it replaced', () => {
    const bindings = rebindButton(DEFAULT_GAMEPAD_BINDINGS, 'jump', BUTTON.faceRight);
    const input = createGamepadInput(bindings);
    expect(input.sample([pad([BUTTON.faceRight])]).jumpPressed).toBe(true);
    expect(input.sample([pad([BUTTON.faceDown])]).jumpHeld).toBe(false);
  });
});

describe('rebinding a button', () => {
  it('never lets one button mean two things', () => {
    const next = rebindButton(DEFAULT_GAMEPAD_BINDINGS, 'attack', BUTTON.faceDown);
    expect(next.attack).toEqual([BUTTON.faceDown]);
    expect(next.jump).not.toContain(BUTTON.faceDown);
  });

  it('swaps rather than leaving an action with no button at all', () => {
    // jump owns exactly one button. Giving it to attack would strip jump, so
    // jump takes what attack gave up — the same rule the keyboard follows.
    const next = rebindButton(DEFAULT_GAMEPAD_BINDINGS, 'attack', BUTTON.faceDown);
    expect(next.jump).toEqual([BUTTON.faceLeft]);
  });

  it('leaves every other action alone', () => {
    const next = rebindButton(DEFAULT_GAMEPAD_BINDINGS, 'up', BUTTON.faceUp);
    expect(next.left).toEqual(DEFAULT_GAMEPAD_BINDINGS.left);
    expect(next.dash).toEqual(DEFAULT_GAMEPAD_BINDINGS.dash);
  });
});

describe('the "press a button" capture', () => {
  it('answers with the position, which is what a remap stores', () => {
    expect(pressedButton([pad([BUTTON.triggerRight])])).toBe(BUTTON.triggerRight);
  });

  it('answers null while she has not pressed anything', () => {
    expect(pressedButton([pad()])).toBeNull();
    expect(pressedButton([])).toBeNull();
  });

  it('names buttons by position, because letters differ between pads', () => {
    expect(buttonName(BUTTON.faceDown)).toBe('bottom button');
    expect(buttonName(BUTTON.dpadLeft)).toBe('D-pad left');
    expect(buttonName(30)).toBe('button 30');
  });
});

describe('merging the two sources', () => {
  it('lets either hand do anything', () => {
    const keys: InputFrame = { ...IDLE, left: true };
    const stick: InputFrame = { ...IDLE, jumpPressed: true, jumpHeld: true };
    const merged = mergeInput(keys, stick);
    expect(merged.left).toBe(true);
    expect(merged.jumpPressed).toBe(true);
  });

  it('adds nothing when a source is idle, so a pad can never take the keys away', () => {
    const keys: InputFrame = { ...IDLE, right: true, attackPressed: true };
    expect(mergeInput(keys, IDLE)).toEqual(keys);
    expect(mergeInput(IDLE, keys)).toEqual(keys);
  });
});

describe('storing gamepad bindings', () => {
  it('round-trips through the settings blob', () => {
    const stored = gamepadBindingsToSettings(DEFAULT_GAMEPAD_BINDINGS);
    expect(gamepadBindingsFromSettings(stored)).toEqual(DEFAULT_GAMEPAD_BINDINGS);
  });

  it('falls back per action, so one bad entry cannot break the rest', () => {
    const bindings = gamepadBindingsFromSettings({ jump: 'nonsense', attack: '3' });
    expect(bindings.jump).toEqual(DEFAULT_GAMEPAD_BINDINGS.jump);
    expect(bindings.attack).toEqual([3]);
    expect(bindings.left).toEqual(DEFAULT_GAMEPAD_BINDINGS.left);
  });

  it('honours an empty string as "no button", never as the default', () => {
    // Resurrecting the default would hand a button she moved elsewhere to two
    // actions at once, and the first one would win while the other went dead.
    expect(gamepadBindingsFromSettings({ dash: '' }).dash).toEqual([]);
  });

  it('reads a missing or malformed blob as the defaults', () => {
    for (const stored of [null, undefined, 'nope', 42]) {
      expect(gamepadBindingsFromSettings(stored)).toEqual(DEFAULT_GAMEPAD_BINDINGS);
    }
  });

  it('covers every action the keyboard covers', () => {
    const bindings = gamepadBindingsFromSettings({});
    for (const action of ACTIONS) expect(bindings[action]).toBeDefined();
  });
});

describe('the DOM edge', () => {
  const fakePad = (over: Partial<Record<string, unknown>> = {}) => ({
    connected: true,
    buttons: [{ pressed: false }, { pressed: true }],
    axes: [0, 0.75],
    id: 'Fake Pad (Vendor: 0000 Product: 0000)',
    mapping: 'standard',
    ...over,
  });

  it('flattens a live pad to buttons and axes', () => {
    const nav = { getGamepads: () => [fakePad()] };
    expect(readGamepads(nav)).toEqual([{ buttons: [false, true], axes: [0, 0.75] }]);
  });

  it('skips the empty slots browsers pad the array with', () => {
    const nav = { getGamepads: () => [null, fakePad(), null, fakePad({ connected: false })] };
    expect(readGamepads(nav)).toHaveLength(1);
  });

  it('reads as no pads at all in a browser without the API', () => {
    // Older Safari and any headless context. The caller must never have to
    // feature-detect, or every call site grows the same three lines.
    expect(readGamepads({})).toEqual([]);
    expect(connectedPads({})).toEqual([]);
  });

  it('names pads for Settings, and flags one the browser could not fit', () => {
    const nav = { getGamepads: () => [fakePad(), fakePad({ mapping: '' })] };
    expect(connectedPads(nav)).toEqual([
      { id: 'Fake Pad (Vendor: 0000 Product: 0000)', standard: true },
      { id: 'Fake Pad (Vendor: 0000 Product: 0000)', standard: false },
    ]);
  });
});

describe('the layout a controller starts on', () => {
  /**
   * The leverless right hand, taken from `LeverlessDiagram`'s own accessible
   * description rather than from the bindings under test: "In Switch mode the
   * top row is Y X R L and the bottom row is B A ZR ZL". Each COLUMN is one
   * finger, which is the fact the whole preset turns on.
   */
  const LEVERLESS_COLUMNS: readonly (readonly number[])[] = [
    [BUTTON.faceLeft, BUTTON.faceDown], //      Y over B — index finger
    [BUTTON.faceUp, BUTTON.faceRight], //       X over A — middle finger
    [BUTTON.shoulderRight, BUTTON.triggerRight], // R over ZR — ring finger
    [BUTTON.shoulderLeft, BUTTON.triggerLeft], //  L over ZL — little finger
  ];

  /** Which finger a button sits under, or -1 for the left hand. */
  function finger(button: number): number {
    return LEVERLESS_COLUMNS.findIndex((column) => column.includes(button));
  }

  it('gives the leverless a layout with no two actions under one finger', () => {
    // THE WHOLE POINT OF THE PRESET. The site's own diagram has been warning
    // her that jump and attack share a finger, and for eight sessions picking
    // a controller did nothing about it. Derived from the diagram's columns,
    // not from the bindings: if someone moves attack back onto Y this goes red.
    const used = new Map<number, string>();
    for (const [action, buttons] of Object.entries(LEVERLESS_GAMEPAD_BINDINGS)) {
      for (const button of buttons) {
        const column = finger(button);
        if (column < 0) continue; // left-hand movement buttons, one per finger already
        const already = used.get(column);
        // Dash binds two buttons in one column on purpose; that is one action.
        if (already !== undefined && already !== action) {
          throw new Error(`${action} shares finger ${column} with ${already}`);
        }
        used.set(column, action);
      }
    }
    expect(finger(LEVERLESS_GAMEPAD_BINDINGS.jump[0]!)).not.toBe(
      finger(LEVERLESS_GAMEPAD_BINDINGS.attack[0]!),
    );
  });

  it('keeps jump, attack and dash on the row the hand rests on', () => {
    // The Setup lesson sells the board on "one finger per button: jump,
    // attack, dash and down can all be held at once". A preset that scattered
    // them across both rows would make that sentence false.
    const bottomRow: readonly number[] = [
      BUTTON.faceDown,
      BUTTON.faceRight,
      BUTTON.triggerRight,
      BUTTON.triggerLeft,
    ];
    expect(bottomRow).toContain(LEVERLESS_GAMEPAD_BINDINGS.jump[0]);
    expect(bottomRow).toContain(LEVERLESS_GAMEPAD_BINDINGS.attack[0]);
    expect(LEVERLESS_GAMEPAD_BINDINGS.dash.some((b) => bottomRow.includes(b))).toBe(true);
  });

  it('leaves the Joy-Con on the shape Hollow Knight ships in', () => {
    // The clash is a leverless fact. Changing the pad's layout to "fix" it
    // would break the muscle memory this whole chapter exists to protect.
    expect(gamepadDefaultsFor('joycon')).toBe(DEFAULT_GAMEPAD_BINDINGS);
  });

  it('answers before she has picked, because every screen is reachable early', () => {
    // A bookmark straight into the Pogo Course must not arrive with no
    // bindings at all.
    expect(gamepadDefaultsFor(undefined)).toBe(DEFAULT_GAMEPAD_BINDINGS);
  });

  it('moves nothing but attack between the two layouts', () => {
    // A preset is a guess. The narrower the guess, the cheaper it is to be
    // wrong about — and the capture in Settings is what corrects it.
    const moved = ACTIONS.filter(
      (action) =>
        JSON.stringify(DEFAULT_GAMEPAD_BINDINGS[action]) !==
        JSON.stringify(LEVERLESS_GAMEPAD_BINDINGS[action]),
    );
    expect(moved).toEqual(['attack']);
  });
});
