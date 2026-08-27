// @vitest-environment jsdom
/**
 * `#/the-end`, the last screen of the dojo.
 *
 * What is worth pinning here is the SHAPE of the beat, not the drawing: she
 * reads four messages one at a time, and only then does the roll start. Every
 * one of these has a way of going quietly wrong — a page that showed all four
 * at once, a forward key that skipped to the credits, a cast list that fell out
 * of step with the roster she actually learned.
 *
 * The canvas never runs: `requestAnimationFrame` is stubbed to a no-op, the
 * same stance PlayWell.test.tsx takes. The question is never what was drawn.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theEndCopy } from '../copy/theEnd';
import { ROSTER } from '../engine/roster';
import { TheEnd } from './TheEnd';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTheEnd() {
  return render(
    <MemoryRouter>
      <TheEnd />
    </MemoryRouter>,
  );
}

/** Press the site's forward key, the way she would. */
function pressForward(): void {
  fireEvent.keyDown(window, { key: 'z', code: 'KeyZ' });
}

describe('the four messages', () => {
  it('opens on the first one, and only the first one', () => {
    renderTheEnd();
    expect(screen.getByText(theEndCopy.messages[0]!)).toBeDefined();
    expect(screen.queryByText(theEndCopy.messages[1]!)).toBeNull();
    expect(screen.queryByText(theEndCopy.messages[3]!)).toBeNull();
  });

  it('advances one at a time on the forward key', () => {
    renderTheEnd();
    for (const [i, text] of theEndCopy.messages.entries()) {
      expect(screen.getByText(text)).toBeDefined();
      if (i < theEndCopy.messages.length - 1) pressForward();
    }
  });

  it('advances on the on-screen button too, for a mouse', () => {
    renderTheEnd();
    fireEvent.click(screen.getByRole('button', { name: theEndCopy.advanceButton }));
    expect(screen.getByText(theEndCopy.messages[1]!)).toBeDefined();
  });

  it('says where she is, so four messages do not feel unbounded', () => {
    renderTheEnd();
    expect(screen.getByText(`1 of ${theEndCopy.messages.length}`)).toBeDefined();
    pressForward();
    expect(screen.getByText(`2 of ${theEndCopy.messages.length}`)).toBeDefined();
  });

  it('changes its own label on the last one, so the roll is never a surprise', () => {
    renderTheEnd();
    for (let i = 0; i < theEndCopy.messages.length - 1; i++) pressForward();
    expect(screen.getByRole('button', { name: theEndCopy.advanceButtonLast })).toBeDefined();
  });
});

describe('the credits roll', () => {
  /** Read all four, then one more press. */
  function rollIt(): void {
    for (let i = 0; i < theEndCopy.messages.length; i++) pressForward();
  }

  it('waits for all four messages before it starts', () => {
    renderTheEnd();
    for (let i = 0; i < theEndCopy.messages.length - 1; i++) pressForward();
    expect(screen.queryByText(theEndCopy.creditsHeading)).toBeNull();
    pressForward();
    expect(screen.getByText(theEndCopy.creditsHeading)).toBeDefined();
  });

  it('credits both Bills as themselves, which is the joke landing one last time', () => {
    renderTheEnd();
    rollIt();
    expect(screen.getByText('Bill the Man')).toBeDefined();
    expect(screen.getByText('Bill the Dog')).toBeDefined();
    expect(screen.getAllByText('as himself')).toHaveLength(2);
  });

  it('names every enemy she actually learned, and no others', () => {
    // Derived from the roster rather than from the copy: if a sixth enemy is
    // ever added to the road, this goes red instead of quietly leaving them
    // out of their own credits.
    renderTheEnd();
    rollIt();
    for (const entry of ROSTER) {
      expect(screen.getByText(new RegExp(entry.name, 'i'))).toBeDefined();
    }
    expect(theEndCopy.cast).toHaveLength(ROSTER.length + 2);
  });

  it('stops taking the forward key once it is rolling', () => {
    // There is nothing after the credits. A key that still did something would
    // have to invent a destination.
    renderTheEnd();
    rollIt();
    pressForward();
    expect(screen.getByText(theEndCopy.creditsHeading)).toBeDefined();
  });

  it('offers the way back, so the last screen is not a dead end', () => {
    renderTheEnd();
    rollIt();
    const back = screen.getByRole('link', { name: theEndCopy.backToMap });
    expect(back.getAttribute('href')).toBe('/');
  });
});

describe('what it does not assume', () => {
  it('reads without having beaten anything, so a direct link is never broken', () => {
    // She can reach `#/the-end` from Settings, from a bookmark, or by typing
    // it. None of those carry any progress with them.
    renderTheEnd();
    expect(screen.getByText(theEndCopy.messages[0]!)).toBeDefined();
  });

  it('draws Riggs with a label, for anyone who cannot see him', () => {
    renderTheEnd();
    expect(screen.getByRole('img', { name: /riggs/i })).toBeDefined();
  });
});
