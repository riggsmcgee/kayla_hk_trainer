// @vitest-environment jsdom
/**
 * Bindings are shared, not copied.
 *
 * Both hooks used to hold plain per-component `useState` with a lazy
 * localStorage read, so every call site got its OWN copy: a rebind on
 * Settings reached storage and no mounted component. There are three
 * consumers with three different lifetimes — a page's label strings, the
 * canvas's keyboard adapter, and the copy baked into a running session — and
 * note 3's sandbox is a screen with the remap rows and a live Knight on it at
 * once, where "the rows update and the Knight does not" is the whole failure.
 *
 * Two components are mounted here rather than one, because one component
 * would have passed the entire time.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, type Bindings } from '../engine/input';
import { DEFAULT_GAMEPAD_BINDINGS, type GamepadBindings } from '../engine/gamepad';
import { useBindings } from './useBindings';
import { useGamepadBindings } from './useGamepadBindings';

/** Stands in for Settings: it holds the setter and never renders the value. */
function Rebinder({ onReady }: { onReady: (set: (next: Bindings) => void) => void }) {
  const [, setBindings] = useBindings();
  onReady(setBindings);
  return null;
}

/** Stands in for a mounted PracticeCanvas: it only ever reads. */
function Reader() {
  const [bindings] = useBindings();
  return <p data-testid="jump">{bindings.jump.join(',')}</p>;
}

function PadRebinder({ onReady }: { onReady: (set: (next: GamepadBindings) => void) => void }) {
  const [, setPad] = useGamepadBindings();
  onReady(setPad);
  return null;
}

function PadReader() {
  const [pad] = useGamepadBindings();
  return <p data-testid="pad-jump">{pad.jump.join(',')}</p>;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('a rebind reaches everything already on screen', () => {
  it('updates a keyboard reader mounted beside the rebinder', () => {
    let setBindings: ((next: Bindings) => void) | null = null;
    render(
      <>
        <Rebinder onReady={(set) => (setBindings = set)} />
        <Reader />
      </>,
    );
    const before = screen.getByTestId('jump').textContent;

    act(() => setBindings?.({ ...DEFAULT_BINDINGS, jump: ['KeyN'] }));

    expect(screen.getByTestId('jump').textContent).toBe('KeyN');
    expect(screen.getByTestId('jump').textContent).not.toBe(before);
  });

  it('updates a pad reader mounted beside the rebinder', () => {
    let setPad: ((next: GamepadBindings) => void) | null = null;
    render(
      <>
        <PadRebinder onReady={(set) => (setPad = set)} />
        <PadReader />
      </>,
    );

    act(() => setPad?.({ ...DEFAULT_GAMEPAD_BINDINGS, jump: [3] }));

    expect(screen.getByTestId('pad-jump').textContent).toBe('3');
  });

  it('leaves the change in storage for the next visit', () => {
    let setBindings: ((next: Bindings) => void) | null = null;
    render(<Rebinder onReady={(set) => (setBindings = set)} />);

    act(() => setBindings?.({ ...DEFAULT_BINDINGS, jump: ['KeyN'] }));

    // The store is shared in memory AND still written through: a rebind that
    // only lived in the store would be gone on reload.
    const raw = window.localStorage.getItem('kayla-hk-dojo:settings');
    expect(raw).toContain('KeyN');
  });
});
