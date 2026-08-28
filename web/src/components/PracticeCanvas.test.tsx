// @vitest-environment jsdom
/**
 * The canvas's two lives: one session, and input adapters that can be swapped
 * under it.
 *
 * This is the seam the sandbox's in-place remap rests on. Before it, the
 * session and the adapters shared a single effect whose dependency list held
 * the bindings, so rebinding a key tore the session down and built a new one —
 * on Settings that is invisible, because Settings has no Knight; on a screen
 * where she is standing on a floor testing her controller, it is the Knight
 * disappearing the moment she fixes a button.
 *
 * jsdom has no 2D context and no game loop worth running, so both are stubbed:
 * `getContext` returns a do-nothing context so the session effect gets past its
 * guard, and `createGameLoop` is replaced by one that hands its `simulate`
 * callback back to the test. That callback IS the thing under test — it is
 * where the pause decides what the session is handed.
 */
import { cleanup, act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputFrame } from '../engine/types';

/** The `simulate` callbacks handed to createGameLoop, newest last. */
const simulators: Array<(dt: number) => void> = [];

vi.mock('../engine/loop', () => ({
  createGameLoop: (callbacks: { simulate: (dt: number) => void }) => {
    simulators.push(callbacks.simulate);
    return { start: () => {}, stop: () => {}, isRunning: () => false };
  },
}));

const { PracticeCanvas } = await import('./PracticeCanvas');
const { saveBindings } = await import('../storage/useBindings');
const { DEFAULT_BINDINGS, rebind } = await import('../engine/input');

/** Every frame the session was stepped with, in order. */
let stepped: InputFrame[] = [];
/** How many sessions have been built. One mount should mean exactly one. */
let built = 0;

function makeSession() {
  built += 1;
  return {
    step: (input: InputFrame) => {
      stepped.push(input);
    },
    render: () => {},
  };
}

beforeEach(() => {
  window.localStorage.clear();
  simulators.length = 0;
  stepped = [];
  built = 0;
  saveBindings(DEFAULT_BINDINGS);
  // A context object is all the component checks for; nothing draws in jsdom.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The most recent simulate callback — the live loop's. */
function tick(): void {
  const simulate = simulators[simulators.length - 1];
  if (!simulate) throw new Error('the loop was never started');
  act(() => simulate(1 / 60));
}

describe('rebinding while the game is running', () => {
  it('does not rebuild the session', () => {
    // The whole reason the sandbox can put Remap next to a live Knight.
    const createSession = () => makeSession();
    render(<PracticeCanvas label="a floor" createSession={createSession} />);
    expect(built).toBe(1);

    act(() => saveBindings(rebind(DEFAULT_BINDINGS, 'jump', 'KeyQ')));

    expect(built).toBe(1);
  });
});

describe('while a capture is open', () => {
  it('hands the session an empty frame instead of what she pressed', () => {
    // She is assigning a new Jump key. Pressing it must not also jump.
    const createSession = () => makeSession();
    const { rerender } = render(
      <PracticeCanvas label="a floor" createSession={createSession} inputPaused />,
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    tick();

    const first = stepped[0];
    expect(first).toBeDefined();
    expect(first?.jumpPressed).toBe(false);
    expect(first?.jumpHeld).toBe(false);

    // And the press must not be waiting for her when the capture closes: the
    // paused frame drained it rather than banking it.
    rerender(<PracticeCanvas label="a floor" createSession={createSession} inputPaused={false} />);
    tick();
    const second = stepped[1];
    expect(second).toBeDefined();
    expect(second?.jumpPressed).toBe(false);
  });

  it('keeps stepping the world, so the Knight is not frozen mid-air', () => {
    const createSession = () => makeSession();
    render(<PracticeCanvas label="a floor" createSession={createSession} inputPaused />);
    tick();
    tick();
    expect(stepped.length).toBeGreaterThanOrEqual(2);
  });
});

describe('with nothing paused', () => {
  it('passes her keys through to the session', () => {
    const createSession = () => makeSession();
    render(<PracticeCanvas label="a floor" createSession={createSession} />);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    tick();

    expect(stepped[0]?.jumpPressed).toBe(true);
  });
});
