// @vitest-environment jsdom
/**
 * The practice floor, `#/lessons/setup/floor`.
 *
 * Five of these moved here from `LessonSetup.test.tsx` when the sandbox stopped
 * being the bottom third of the Setup lesson. The rest are playtest 9's second
 * ask — "it should say Jump and next it would be Remap" — and they drive it the
 * way she does: press the button on the row, press a key, read the row back.
 *
 * The sheet's persistence IS tested here, which it could not be before. The
 * shared stores cache their value at module level so `useSyncExternalStore` sees
 * a stable snapshot, which used to make "seed localStorage, then render" a lie;
 * `reloadStores()` is the seam that fixes it, and the note explaining why the
 * old test was dropped can come out of `LessonSetup.test.tsx` with it.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProgressV1 } from '@dojo/shared';
import { setupCheckLabels, setupFloorCopy } from '../copy/setup';
import { SETUP_CHECKS } from '../engine/setupChecks';
import { reloadStores } from '../storage/reload';
import { SetupFloor } from './SetupFloor';

const PROGRESS_KEY = 'kayla-hk-dojo:progress';

beforeEach(() => {
  window.localStorage.clear();
  reloadStores();
});

afterEach(cleanup);

/** A save in whatever state the test needs, written the way the store writes it. */
function seed(progress: Partial<ProgressV1>): void {
  const full: ProgressV1 = {
    version: 1,
    courseLevelsCleared: [],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    finaleBossCleared: false,
    skipped: [],
    ...progress,
  };
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, data: full }));
  reloadStores();
}

function renderFloor() {
  return render(
    <MemoryRouter>
      <SetupFloor />
    </MemoryRouter>,
  );
}

/** The list row for one checklist item. */
function row(label: string): HTMLElement {
  const found = screen.getByText(label).closest('li');
  if (!found) throw new Error(`no row for ${label}`);
  return found;
}

describe('arriving without a controller', () => {
  it('sends her back to pick one instead of showing a floor', () => {
    // The floor exists to prove ONE board. Before she has chosen there is
    // nothing to prove, and a canvas here would be asking her to test hardware
    // she has not picked.
    renderFloor();
    expect(
      screen.getByRole('heading', { name: setupFloorCopy.needsControllerHeading }),
    ).toBeDefined();
    expect(screen.queryByLabelText(setupFloorCopy.canvasLabel)).toBeNull();
  });
});

describe('the floor itself', () => {
  beforeEach(() => seed({ controller: 'leverless', setupChecks: [] }));

  it('is a floor and nothing else', () => {
    renderFloor();
    // The canvas is named for what it actually contains, because that name is
    // the whole screen for anyone who cannot see it.
    expect(screen.getByLabelText(setupFloorCopy.canvasLabel)).toBeDefined();
  });

  it('lists the whole kit, so she learns what she can do by reading it', () => {
    renderFloor();
    for (const label of Object.values(setupCheckLabels)) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('says out loud how many are left, without her hunting the list', () => {
    renderFloor();
    expect(screen.getByRole('status').textContent).toContain(setupFloorCopy.remaining(7));
  });

  it('still has the sheet she filled in last time', () => {
    // The bug a browser reload found and every unit test walked past: the
    // reader rebuilds progress field by field, so a field it does not list is
    // written on every change and dropped on every read.
    cleanup();
    seed({ controller: 'leverless', setupChecks: ['left', 'right', 'jump'] });
    renderFloor();
    expect(screen.getByRole('status').textContent).toContain(setupFloorCopy.remaining(4));
    expect(row(setupCheckLabels.left).className).toContain('is-done');
    expect(row(setupCheckLabels.jump).className).toContain('is-done');
    expect(row(setupCheckLabels.dash).className).not.toContain('is-done');
  });
});

describe('the Remap on every row', () => {
  beforeEach(() => seed({ controller: 'leverless', setupChecks: [] }));

  it('offers one control on a row that needs one', () => {
    renderFloor();
    const jump = row(setupCheckLabels.jump);
    expect(
      within(jump).getByRole('button', { name: setupFloorCopy.remapLabel('Jump') }),
    ).toBeDefined();
    expect(within(jump).getAllByRole('button')).toHaveLength(1);
  });

  it('offers both controls on a row that needs two', () => {
    // "Slash up" is a direction AND a swing, and only one of them is broken.
    // A single Remap here would rebind the wrong half half the time.
    renderFloor();
    const slashUp = row(setupCheckLabels.slashUp);
    expect(
      within(slashUp).getByRole('button', { name: setupFloorCopy.remapLabel('Up') }),
    ).toBeDefined();
    expect(
      within(slashUp).getByRole('button', { name: setupFloorCopy.remapLabel('Attack') }),
    ).toBeDefined();
  });

  it('shows what the control answers to now, keys and buttons together', () => {
    // She came here because something did not work. What it is bound to is the
    // first thing she needs to see, on both hands at once — the pad is the one
    // whose numbering nobody has established.
    renderFloor();
    const jump = row(setupCheckLabels.jump);
    expect(jump.textContent).toContain('Z');
    expect(jump.textContent).toContain('bottom button');
  });

  it('takes the next key she presses and shows it on the row', () => {
    renderFloor();
    const jump = row(setupCheckLabels.jump);
    fireEvent.click(within(jump).getByRole('button', { name: setupFloorCopy.remapLabel('Jump') }));
    expect(jump.textContent).toContain(setupFloorCopy.pressPrompt('Jump'));

    fireEvent.keyDown(window, { code: 'KeyQ' });

    expect(row(setupCheckLabels.jump).textContent).toContain('Q');
    expect(row(setupCheckLabels.jump).textContent).not.toContain(
      setupFloorCopy.pressPrompt('Jump'),
    );
  });

  it('lets Escape put it back the way it was', () => {
    renderFloor();
    const jump = row(setupCheckLabels.jump);
    fireEvent.click(within(jump).getByRole('button', { name: setupFloorCopy.remapLabel('Jump') }));
    fireEvent.keyDown(window, { code: 'Escape' });

    const after = row(setupCheckLabels.jump);
    expect(after.textContent).not.toContain(setupFloorCopy.pressPrompt('Jump'));
    expect(after.textContent).toContain('Z');
  });

  it('rebinds only the control she asked about', () => {
    // The rows share actions — every nail row uses Attack — so a capture that
    // wrote the wrong action would look right on the row she pressed and wrong
    // two rows down.
    renderFloor();
    const slashUp = row(setupCheckLabels.slashUp);
    fireEvent.click(within(slashUp).getByRole('button', { name: setupFloorCopy.remapLabel('Up') }));
    fireEvent.keyDown(window, { code: 'KeyI' });

    expect(row(setupCheckLabels.slashUp).textContent).toContain('I');
    // Attack is untouched, here and on the sideways row.
    expect(row(setupCheckLabels.slashSide).textContent).toContain('X');
  });
});

describe('the way out', () => {
  it('is offered while there is anything left to prove', () => {
    // Playtest 8 asked for "just a little hard gate" and in the same breath
    // "obviously, she can skip things if needed". Nothing ever traps her.
    seed({ controller: 'leverless', setupChecks: [] });
    renderFloor();
    expect(screen.getByRole('button', { name: setupFloorCopy.skip })).toBeDefined();
  });

  it('is gone once she has done all seven, because there is nothing to skip', () => {
    seed({ controller: 'leverless', setupChecks: [...SETUP_CHECKS] });
    renderFloor();
    expect(screen.queryByRole('button', { name: setupFloorCopy.skip })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(setupFloorCopy.allDone);
  });

  it('points at the next stop on the road, which the floor is not', () => {
    seed({ controller: 'leverless', setupChecks: [] });
    renderFloor();
    // The floor carries the button Setup used to: "Next: Pogo". Rendered in a
    // MemoryRouter, so the href is the bare path; the app's HashRouter adds the #.
    expect(screen.getByRole('link', { name: /^Next: / }).getAttribute('href')).toBe(
      '/lessons/pogo',
    );
  });
});
