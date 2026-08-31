// @vitest-environment jsdom
/**
 * The Pogo lesson had no test at all, which is how its thesis came to restate
 * two simulation-measured constants in English four lines below the same two
 * numbers printed as digits — with nothing anywhere noticing.
 *
 * This is the page half of that guard. `lessonPogo.helpers.test.ts` holds the
 * numbers against the physics; this holds the SENTENCE against the numbers, so
 * the two halves of the page can never disagree about what the dash buys her.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProgressV1 } from '@dojo/shared';
import { pogoLessonCopy } from '../copy/lessons';
import { reloadStores } from '../storage/reload';
import { ESCAPE_WINDOW, tenthsInWords } from './lessonPogo.helpers';
import { LessonPogo } from './LessonPogo';

beforeEach(() => {
  window.localStorage.clear();
  reloadStores();
});

/** A save that has passed chapter 1, so chapter 2's gate is open. */
function openTheGate(): void {
  const progress: ProgressV1 = {
    version: 1,
    courseLevelsCleared: [],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    finaleBossCleared: false,
    // A skip counts for unlocking and never for done, which is all this needs.
    skipped: ['setup'],
  };
  window.localStorage.setItem('kayla-hk-dojo:progress', JSON.stringify({ v: 1, data: progress }));
  reloadStores();
}
afterEach(cleanup);

function renderPogo() {
  return render(
    <MemoryRouter>
      <LessonPogo />
    </MemoryRouter>,
  );
}

describe('the dash thesis', () => {
  beforeEach(openTheGate);

  it('spells the escape window the engine actually measured', () => {
    const { container } = renderPogo();
    const thesis = container.querySelector('.thesis');
    expect(thesis?.textContent).toBe(
      pogoLessonCopy.thesis(
        tenthsInWords(ESCAPE_WINDOW.running),
        tenthsInWords(ESCAPE_WINDOW.dashing),
      ),
    );
  });

  it('reads as English, not as a template with the numbers left in it', () => {
    // Derived from the copy above, the assertion only pins the join. This pins
    // the prose: the spelled window appears, and no placeholder survived.
    const { container } = renderPogo();
    const thesis = container.querySelector('.thesis')?.textContent ?? '';
    expect(thesis).toContain('a tenth of a second to two tenths');
    expect(thesis).not.toMatch(/[{}]/);
  });
});

describe('the page behind the gate', () => {
  it('is locked until Setup is passed, and says so rather than showing the lesson', () => {
    // A blank save has not answered the controller, so chapter 2's gate holds.
    // This is the first thing the practice floor's new gate changes about the
    // road, and it should be visible from the page it gates.
    renderPogo();
    expect(screen.queryByRole('heading', { name: pogoLessonCopy.kinder })).toBeNull();
  });
});
