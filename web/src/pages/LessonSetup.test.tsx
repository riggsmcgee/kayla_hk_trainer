// @vitest-environment jsdom
/**
 * Setup's controller question, which for eight sessions recorded an answer and
 * configured nothing.
 *
 * `progress.controller` was written here and read in exactly two places — to
 * print the answer back and to tick the chapter — while ONE set of pad
 * defaults served both boards. Meanwhile the leverless diagram's own
 * accessible description told her, in so many words, that "Attack (Y) and Jump
 * (B) sit under the same finger until remapped". The site named a clash and
 * then did nothing about it.
 *
 * These tests pin the two halves of playtest 8's ratified shape, PRESET THEN
 * OFFER: picking a board lays it out, and the page still offers her the
 * capture, because the preset is a guess about which index each button reports
 * on and only her hardware can settle that.
 *
 * They drive the page the way she does — click the button, read the sentence —
 * rather than reaching into the store, so a break anywhere along
 * choose → save → store → hook → render is caught.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LessonSetup } from './LessonSetup';

beforeEach(() => {
  // Every test starts from a browser that has never seen the site. The store
  // wraps blobs as `{ v, data }` and a mismatch reads back as the fallback
  // SILENTLY, so clearing is the only safe way to reach a known state.
  window.localStorage.clear();
});

afterEach(cleanup);

function renderSetup() {
  return render(
    <MemoryRouter>
      <LessonSetup />
    </MemoryRouter>,
  );
}

/** Pick a board, the way she does. */
function choose(name: 'Joy-Con' | 'Leverless'): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

/** The line under the answer, which says what her buttons are set to. */
function layoutLine(): string {
  const found = screen
    .getAllByText((_, el) => (el?.textContent ?? '').includes('Your buttons are set up for it'))
    .pop();
  return found?.textContent ?? '';
}

describe('picking a controller lays it out', () => {
  it('moves attack off jump’s finger for a leverless', () => {
    // The clash, in the exact terms the diagram warns about. Jump stays on the
    // bottom button (B); attack moves to the right button (A), which is the
    // next column along and therefore the next finger.
    renderSetup();
    choose('Leverless');
    const line = layoutLine();
    expect(line).toContain('jump bottom button');
    expect(line).toContain('attack right button');
    expect(line).not.toContain('attack left button');
  });

  it('leaves the Joy-Con on the shape Hollow Knight ships in', () => {
    // The clash is a leverless fact. Rearranging the pad to "fix" it would
    // break the muscle memory the whole chapter exists to protect.
    renderSetup();
    choose('Joy-Con');
    const line = layoutLine();
    expect(line).toContain('jump bottom button');
    expect(line).toContain('attack left button');
  });

  it('lays the new board out when she changes her mind', () => {
    renderSetup();
    choose('Joy-Con');
    fireEvent.click(screen.getByRole('button', { name: 'change' }));
    choose('Leverless');
    expect(layoutLine()).toContain('attack right button');
  });

  it('does not wipe a remap when she re-confirms the same board', () => {
    // She picks, remaps in Settings, comes back and presses the same button
    // again. Re-applying the preset here would silently undo her work; telling
    // us she has moved to a DIFFERENT board is the only thing that reshuffles.
    renderSetup();
    choose('Leverless');
    fireEvent.click(screen.getByRole('button', { name: 'change' }));
    // Stand in for the remap: any binding that is neither preset.
    window.localStorage.setItem(
      'kayla-hk-dojo:settings',
      JSON.stringify({ v: 1, data: { gamepadBindings: { attack: [3] } } }),
    );
    choose('Leverless');
    // The choice did not change, so nothing was re-applied. Whatever the store
    // holds is hers; the page must not have overwritten it with the preset.
    const stored = window.localStorage.getItem('kayla-hk-dojo:settings') ?? '';
    expect(stored).toContain('"attack":[3]');
  });
});

describe('and then offers her the capture', () => {
  it('points at Settings, because the preset is a guess', () => {
    // "Her leverless enumerates as a gamepad" is established. "We know which
    // index each of its buttons reports on" is not, and no preset can settle
    // it — only pressing the buttons can.
    renderSetup();
    choose('Leverless');
    // Scoped to the offer itself: the chapter nav links to Settings too, and a
    // page-wide query would pass whether or not the offer exists at all.
    const offer = screen
      .getAllByText((_, el) => (el?.textContent ?? '').includes('teach it yours in'))
      .pop();
    const link = offer?.querySelector('a[href="/settings"]');
    expect(link).not.toBeNull();
  });

  it('says nothing about buttons until she has answered', () => {
    // The line describes HER layout. Before there is a choice there is no
    // layout to describe, and a page that guessed would be back to the
    // problem this whole change exists to fix.
    renderSetup();
    expect(screen.queryByText(/Your buttons are set up for it/)).toBeNull();
  });
});
