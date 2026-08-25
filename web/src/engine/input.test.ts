/**
 * Input core seam tests (M1).
 *
 * Seam: createKeyboardInput() — a pure key-state machine fed KeyboardEvent
 * codes by a thin DOM adapter. sample() is called exactly once per simulation
 * step and is where press edges are consumed.
 */
import { describe, expect, it } from 'vitest';
import type { SettingsV1 } from '@dojo/shared';
import type { InputFrame } from './types';
import {
  ACTIONS,
  anyInput,
  DEFAULT_BINDINGS,
  bindingsFromSettings,
  bindingsToSettings,
  createKeyboardInput,
  makeIsGameKey,
  rebind,
} from './input';

describe('keyboard input sampling', () => {
  it('reports held directions', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('ArrowRight');
    expect(kb.sample().right).toBe(true);
    kb.handleKeyUp('ArrowRight');
    expect(kb.sample().right).toBe(false);
  });

  it('supports WASD as well as arrows', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyA');
    kb.handleKeyDown('KeyW');
    kb.handleKeyDown('KeyS');
    const f = kb.sample();
    expect(f.left).toBe(true);
    expect(f.up).toBe(true);
    expect(f.down).toBe(true);
  });

  it('reports a jump press edge exactly once, held until keyup', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyZ');
    const first = kb.sample();
    expect(first.jumpPressed).toBe(true);
    expect(first.jumpHeld).toBe(true);
    const second = kb.sample();
    expect(second.jumpPressed).toBe(false);
    expect(second.jumpHeld).toBe(true);
    kb.handleKeyUp('KeyZ');
    expect(kb.sample().jumpHeld).toBe(false);
  });

  it('registers a press edge even if the key was released before the sample', () => {
    // A full tap between two samples must still count as a press.
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyZ');
    kb.handleKeyUp('KeyZ');
    const f = kb.sample();
    expect(f.jumpPressed).toBe(true);
    expect(f.jumpHeld).toBe(false);
  });

  it('ignores OS auto-repeat keydowns (no re-trigger without a keyup)', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyX');
    kb.sample();
    kb.handleKeyDown('KeyX'); // auto-repeat while held
    expect(kb.sample().attackPressed).toBe(false);
  });

  it('maps attack and dash edges on their alternate keys too', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyJ');
    kb.handleKeyDown('KeyK');
    const f = kb.sample();
    expect(f.attackPressed).toBe(true);
    expect(f.dashPressed).toBe(true);
  });

  it('treats Space as jump', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('Space');
    expect(kb.sample().jumpPressed).toBe(true);
  });

  it('clears all state on blur (no stuck keys after alt-tab)', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('ArrowRight');
    kb.handleKeyDown('KeyZ');
    kb.sample();
    kb.handleBlur();
    const f = kb.sample();
    expect(f.right).toBe(false);
    expect(f.jumpHeld).toBe(false);
  });
});

/**
 * Rebindable bindings (Settings page). The code→action table is built from a
 * Bindings record; SettingsV1.inputBindings stores it as action → comma-joined
 * codes, and anything missing or malformed falls back to the defaults.
 */
const BASE_SETTINGS: SettingsV1 = { version: 1, reduceShake: false, reduceFlashing: false };

describe('rebindable bindings', () => {
  it('defaults match the original table (arrows + WASD, HK keyboard keys)', () => {
    expect(DEFAULT_BINDINGS.left).toEqual(['ArrowLeft', 'KeyA']);
    expect(DEFAULT_BINDINGS.right).toEqual(['ArrowRight', 'KeyD']);
    expect(DEFAULT_BINDINGS.up).toEqual(['ArrowUp', 'KeyW']);
    expect(DEFAULT_BINDINGS.down).toEqual(['ArrowDown', 'KeyS']);
    expect(DEFAULT_BINDINGS.jump).toEqual(['KeyZ', 'Space']);
    expect(DEFAULT_BINDINGS.attack).toEqual(['KeyX', 'KeyJ']);
    expect(DEFAULT_BINDINGS.dash).toEqual(['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight']);
    expect(ACTIONS).toEqual(['left', 'right', 'up', 'down', 'jump', 'attack', 'dash']);
  });

  it('a custom binding fires its action', () => {
    const kb = createKeyboardInput({ ...DEFAULT_BINDINGS, jump: ['KeyU'] });
    kb.handleKeyDown('KeyU');
    const f = kb.sample();
    expect(f.jumpPressed).toBe(true);
    expect(f.jumpHeld).toBe(true);
    kb.handleKeyUp('KeyU');
    expect(kb.sample().jumpHeld).toBe(false);
  });

  it('an overridden default no longer fires', () => {
    const kb = createKeyboardInput({ ...DEFAULT_BINDINGS, jump: ['KeyU'] });
    kb.handleKeyDown('KeyZ');
    kb.handleKeyDown('Space');
    const f = kb.sample();
    expect(f.jumpPressed).toBe(false);
    expect(f.jumpHeld).toBe(false);
    // The adapter must not preventDefault keys the game no longer uses.
    expect(kb.isGameKey('KeyZ')).toBe(false);
    expect(kb.isGameKey('Space')).toBe(false);
    expect(kb.isGameKey('KeyU')).toBe(true);
  });

  it('makeIsGameKey answers for any bindings table', () => {
    const isGameKey = makeIsGameKey({ ...DEFAULT_BINDINGS, dash: ['KeyL'] });
    expect(isGameKey('KeyL')).toBe(true);
    expect(isGameKey('ShiftLeft')).toBe(false);
    expect(isGameKey('ArrowLeft')).toBe(true);
  });

  it('releases a held action only when every bound code is up (custom table too)', () => {
    const kb = createKeyboardInput({ ...DEFAULT_BINDINGS, left: ['KeyA', 'KeyH'] });
    kb.handleKeyDown('KeyA');
    kb.handleKeyDown('KeyH');
    kb.handleKeyUp('KeyA');
    expect(kb.sample().left).toBe(true);
    kb.handleKeyUp('KeyH');
    expect(kb.sample().left).toBe(false);
  });

  it('round-trips through SettingsV1.inputBindings', () => {
    const custom = {
      ...DEFAULT_BINDINGS,
      jump: ['KeyU'],
      dash: ['KeyL', 'ShiftRight'],
    };
    const stored = bindingsToSettings(custom);
    expect(stored).toEqual({
      left: 'ArrowLeft,KeyA',
      right: 'ArrowRight,KeyD',
      up: 'ArrowUp,KeyW',
      down: 'ArrowDown,KeyS',
      jump: 'KeyU',
      attack: 'KeyX,KeyJ',
      dash: 'KeyL,ShiftRight',
    });
    expect(bindingsFromSettings({ ...BASE_SETTINGS, inputBindings: stored })).toEqual(custom);
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(bindingsFromSettings(BASE_SETTINGS)).toEqual(DEFAULT_BINDINGS);
    expect(bindingsFromSettings({ ...BASE_SETTINGS, inputBindings: {} })).toEqual(DEFAULT_BINDINGS);
  });

  it('falls back per action when the stored value is invalid', () => {
    const settings = {
      ...BASE_SETTINGS,
      inputBindings: {
        jump: '', // explicitly empty: "no key" — what an emptied action is stored as
        attack: ',, ,', // only separators
        dash: 'not a code!', // not a KeyboardEvent.code
        left: 42, // wrong type
        up: 'KeyI, KeyO', // valid, with a stray space
        nonsense: 'KeyQ', // unknown action — ignored
      },
    } as unknown as SettingsV1;
    const b = bindingsFromSettings(settings);
    expect(b.jump).toEqual([]);
    expect(b.attack).toEqual(DEFAULT_BINDINGS.attack);
    expect(b.dash).toEqual(DEFAULT_BINDINGS.dash);
    expect(b.left).toEqual(DEFAULT_BINDINGS.left);
    expect(b.right).toEqual(DEFAULT_BINDINGS.right);
    expect(b.up).toEqual(['KeyI', 'KeyO']);
    expect(Object.keys(b)).toEqual([...ACTIONS]);
  });

  it('falls back entirely when inputBindings is not an object', () => {
    const settings = { ...BASE_SETTINGS, inputBindings: 'KeyZ' } as unknown as SettingsV1;
    expect(bindingsFromSettings(settings)).toEqual(DEFAULT_BINDINGS);
    const nul = { ...BASE_SETTINGS, inputBindings: null } as unknown as SettingsV1;
    expect(bindingsFromSettings(nul)).toEqual(DEFAULT_BINDINGS);
  });

  it('an action with no key round-trips as no key — never as the defaults', () => {
    // Storage can hold an emptied action (older builds wrote one); it must
    // come back empty, or the key she gave away lands on two actions at once.
    const table = { ...DEFAULT_BINDINGS, jump: [] as string[], attack: ['KeyZ'] };
    const stored = bindingsToSettings(table);
    expect(stored.jump).toBe('');
    const back = bindingsFromSettings({ ...BASE_SETTINGS, inputBindings: stored });
    expect(back).toEqual(table);
    const kb = createKeyboardInput(back);
    kb.handleKeyDown('KeyZ');
    expect(kb.sample()).toMatchObject({ jumpPressed: false, attackPressed: true });
  });

  it('returns fresh arrays, never the shared defaults', () => {
    const b = bindingsFromSettings(BASE_SETTINGS);
    b.jump.push('KeyQ');
    expect(DEFAULT_BINDINGS.jump).toEqual(['KeyZ', 'Space']);
  });
});

describe('rebind (the Settings "Change" capture)', () => {
  it('replaces the action with the one captured key', () => {
    const b = rebind(DEFAULT_BINDINGS, 'jump', 'KeyU');
    expect(b.jump).toEqual(['KeyU']);
    expect(b.attack).toEqual(DEFAULT_BINDINGS.attack);
  });

  it('takes the key away from whichever action had it', () => {
    const b = rebind(DEFAULT_BINDINGS, 'jump', 'KeyX');
    expect(b.jump).toEqual(['KeyX']);
    expect(b.attack).toEqual(['KeyJ']);
  });

  it('never leaves an action with no key: the two actions swap instead', () => {
    // Jump → Z leaves Jump = [Z]; Attack → Z would empty Jump, so Jump takes
    // the keys Attack is giving up. Every key still means exactly one thing.
    const once = rebind(DEFAULT_BINDINGS, 'jump', 'KeyZ');
    const twice = rebind(once, 'attack', 'KeyZ');
    expect(twice.attack).toEqual(['KeyZ']);
    expect(twice.jump).toEqual(['KeyX', 'KeyJ']);
    for (const a of ACTIONS) expect(twice[a].length).toBeGreaterThan(0);
    const codes = ACTIONS.flatMap((a) => twice[a]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('does not mutate the table it was given', () => {
    const before = { ...DEFAULT_BINDINGS, attack: ['KeyX'] };
    rebind(before, 'jump', 'KeyX');
    expect(before.attack).toEqual(['KeyX']);
    expect(before.jump).toEqual(['KeyZ', 'Space']);
  });
});

describe('anyInput', () => {
  const quiet: InputFrame = {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    dashPressed: false,
  };
  const fields = Object.keys(quiet) as (keyof InputFrame)[];

  it('is false for a frame with nothing pressed', () => {
    expect(anyInput(quiet)).toBe(false);
  });

  it.each(fields)('is true when only %s is set', (field) => {
    expect(anyInput({ ...quiet, [field]: true })).toBe(true);
  });

  it('covers every field of InputFrame, so a new action cannot be missed', () => {
    expect(fields).toHaveLength(8);
  });
});
