// @vitest-environment jsdom
/**
 * Settings, tested at the seam a rendering test is uniquely good for: the
 * ACCESSIBLE NAME of every control on the page.
 *
 * Found by walking the site in a real browser and asking the DOM for names
 * rather than for text. Seven buttons on this page read "Change" and are
 * fine — their labels name the action they change. Two read "Reset to
 * defaults" and were indistinguishable: one resets the keyboard, one resets
 * the controller, and listing the page's buttons (which is how a screen
 * reader is usually driven) gave no way to tell which was which.
 *
 * The rule these tests pin is the one the file's own comment already states:
 * an accessible name must be UNIQUE among the page's controls, and it must
 * still START with the visible text, per WCAG 2.5.3 "label in name" — a voice
 * user says "click Reset to defaults", and the name has to match what they
 * can see.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { Settings } from './Settings';

afterEach(cleanup);

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

/** Every button's accessible name, the way an assistive technology sees it. */
function buttonNames(): string[] {
  return screen
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim());
}

describe('every control on Settings can be told apart by name', () => {
  it('gives no two buttons the same accessible name', () => {
    renderSettings();
    const names = buttonNames();
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates).toEqual([]);
  });

  it('names the two resets for what they actually reset', () => {
    renderSettings();
    // Not "the reset button" — there are two, and only the label says which.
    expect(screen.getByLabelText('Reset to defaults for keyboard controls')).toBeDefined();
    expect(screen.getByLabelText('Reset to defaults for controller buttons')).toBeDefined();
  });

  it('keeps the visible text at the front of every relabelled name', () => {
    // WCAG 2.5.3. A voice user says what they can read; if the accessible name
    // does not start with it, the command misses.
    renderSettings();
    for (const button of screen.getAllByRole('button')) {
      const label = button.getAttribute('aria-label');
      if (!label) continue;
      const visible = (button.textContent ?? '').trim();
      // "Cancel" replaces "Change" mid-capture and gets its own label; both
      // forms start with their own visible word.
      expect(label.toLowerCase().startsWith(visible.toLowerCase())).toBe(true);
    }
  });
});
