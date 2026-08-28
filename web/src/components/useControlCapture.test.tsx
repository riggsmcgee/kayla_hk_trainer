// @vitest-environment jsdom
/**
 * The capture's PAD half, which nothing else reaches.
 *
 * The keyboard half is driven all over `SetupFloor.test.tsx` and
 * `Settings.test.tsx`, because a test can dispatch a keydown. The pad half is
 * polled, so it needs a fake clock and a fake pad — and until this file existed
 * it was executed by no test at all. That is the wrong half to leave uncovered:
 * Kayla's board enumerates as a GAMEPAD, and the whole reason the floor's
 * capture listens to both hands is that nobody has ever established which index
 * each of its buttons reports on.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../engine/input';

/** What `readGamepads` will hand back on the next poll. */
let pressed: number | null = null;

vi.mock('../engine/gamepad', async (importOriginal) => {
  const real = await importOriginal<typeof import('../engine/gamepad')>();
  return {
    ...real,
    readGamepads: () => [],
    // The capture asks one question of the pad — "is anything down, and what?" —
    // so that is the seam the fake replaces.
    pressedButton: () => pressed,
  };
});

const { useControlCapture } = await import('./useControlCapture');

/** Every (action, control) pair the capture has reported, oldest first. */
let captured: Array<{ action: Action; control: unknown }> = [];
let handle: ReturnType<typeof useControlCapture> | null = null;

function Harness({ accept }: { accept?: 'key' | 'button' | 'either' }) {
  handle = useControlCapture(
    (action, control) => captured.push({ action, control }),
    accept ?? 'either',
  );
  return <span>{handle.capturing ?? 'idle'}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
  captured = [];
  handle = null;
  pressed = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Let the capture's poll run at least once. */
function poll(): void {
  act(() => {
    vi.advanceTimersByTime(400);
  });
}

describe('capturing a pad button', () => {
  it('takes the first button she holds down', () => {
    render(<Harness />);
    act(() => handle?.start('jump:jump', 'jump'));
    pressed = 3;
    poll();

    expect(captured).toEqual([{ action: 'jump', control: { kind: 'button', index: 3 } }]);
  });

  it('closes the capture, so a finger still on the button binds once', () => {
    // The poll runs six times a second and she will not have let go by the next
    // one. If the capture stayed open it would rebind on every tick.
    render(<Harness />);
    act(() => handle?.start('jump:jump', 'jump'));
    pressed = 3;
    poll();
    poll();

    expect(captured).toHaveLength(1);
    expect(handle?.capturing).toBeNull();
  });

  it('reports the action the caller asked about, not the id', () => {
    // The floor's ids are "check:action" so that one Attack row can capture
    // without the other two lighting up; what gets BOUND is still the action.
    render(<Harness />);
    act(() => handle?.start('slashUp:attack', 'attack'));
    pressed = 0;
    poll();

    expect(captured[0]?.action).toBe('attack');
  });

  it('stops polling once she cancels', () => {
    render(<Harness />);
    act(() => handle?.start('dash:dash', 'dash'));
    act(() => handle?.cancel());
    pressed = 5;
    poll();

    expect(captured).toHaveLength(0);
  });

  it('is not listening at all before she asks', () => {
    render(<Harness />);
    pressed = 5;
    poll();

    expect(captured).toHaveLength(0);
  });

  it('ignores the pad entirely when the caller only wants a key', () => {
    // The bench's Controls section: a button pressed while she is reading the
    // KEYBOARD's list must not silently rebind it.
    render(<Harness accept="key" />);
    act(() => handle?.start('jump', 'jump'));
    pressed = 3;
    poll();

    expect(captured).toHaveLength(0);
    expect(handle?.capturing).toBe('jump');
  });
});
