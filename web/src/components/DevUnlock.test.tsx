// @vitest-environment jsdom
/**
 * The glue between the ten keys and the door.
 *
 * `unlockSequence.test.ts` proves the matcher and `useDevMode.test.tsx` proves
 * what a shut door means for the game. What is left is the part that could be
 * wired wrong while both of those still passed: whether anything is listening,
 * whether it listens on the WINDOW (the sequence has to work with the focus
 * anywhere, including on a canvas that has taken it), and whether a held key
 * counts once or sixty times a second.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reloadStores } from '../storage/reload';
import { devModeEnabled } from '../storage/useDevMode';
import { DevUnlock } from './DevUnlock';
import { UNLOCK_SEQUENCE } from './unlockSequence';

/** Type a run of codes at the window, the way a keyboard would. */
function press(...codes: readonly string[]): void {
  for (const code of codes) fireEvent.keyDown(window, { code });
}

beforeEach(() => {
  window.localStorage.clear();
  reloadStores();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  reloadStores();
});

describe('typing the sequence', () => {
  it('opens the door and says so', () => {
    render(<DevUnlock />);
    press(...UNLOCK_SEQUENCE);
    expect(devModeEnabled()).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('unlocked');
  });

  it('shuts it again on a second run, and says that too', () => {
    render(<DevUnlock />);
    press(...UNLOCK_SEQUENCE);
    press(...UNLOCK_SEQUENCE);
    expect(devModeEnabled()).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('hidden');
  });

  it('leaves the door alone for anything short of the whole run', () => {
    render(<DevUnlock />);
    press(...UNLOCK_SEQUENCE.slice(0, -1), 'KeyX', 'KeyA');
    expect(devModeEnabled()).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('what it refuses to count', () => {
  it('a held key, which is how she holds every arrow on this site', () => {
    render(<DevUnlock />);
    // The two ArrowUps that open the sequence, as ONE press held down. A
    // matcher fed by key repeat would take this for two and be a third of the
    // way in before she had moved.
    fireEvent.keyDown(window, { code: 'ArrowUp' });
    fireEvent.keyDown(window, { code: 'ArrowUp', repeat: true });
    press(...UNLOCK_SEQUENCE.slice(2));
    expect(devModeEnabled()).toBe(false);
  });

  it('keys typed into a text field', () => {
    render(
      <>
        <input aria-label="a field" />
        <DevUnlock />
      </>,
    );
    const field = screen.getByLabelText('a field');
    for (const code of UNLOCK_SEQUENCE) fireEvent.keyDown(field, { code });
    expect(devModeEnabled()).toBe(false);
  });
});

describe('the live region', () => {
  it('is on the page before it has anything to announce', () => {
    // A status region created at the same moment as its text is a region a
    // screen reader never saw, and the announcement is lost.
    render(<DevUnlock />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
