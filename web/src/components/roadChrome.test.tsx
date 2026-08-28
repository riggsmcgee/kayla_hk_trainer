// @vitest-environment jsdom
/**
 * The road's chrome, now that its words live in `copy/nav.ts`.
 *
 * These components had no tests at all before the extraction, which is exactly
 * why the extraction needed some: moving a string out of JSX and into a module
 * is invisible to a type checker and to every other test in the project. The
 * two things that can actually break are pinned here.
 *
 * **Sentences assembled from more than one node.** The end of the road is one
 * sentence with a real `<Link>` in the middle of it. In JSX a line that holds
 * only whitespace is dropped, so the spaces either side of the link have to be
 * carried INSIDE the strings — `endLead` ends with one and `endTail` starts
 * with one. Get that wrong and the page reads "…six stops.Back to the start
 * and go again", which nothing else in the suite would notice.
 *
 * **Copy that does arithmetic.** "Clear level 2 first" is derived from the
 * chip she pressed, so the expected value here is derived the same way — from
 * the level asked for, minus one — rather than pasted from a run.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressV1 } from '@dojo/shared';
import { CHAPTERS, countWord } from '../chapters';
import { gateCopy, levelPickerCopy, nextCopy } from '../copy/nav';
import { ChapterNext } from './ChapterNext';
import { LevelPicker } from './LevelPicker';

afterEach(cleanup);

/** A save with nothing on the road cleared and nothing skipped. */
function blankProgress(): ProgressV1 {
  return {
    version: 1,
    courseLevelsCleared: [],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    finaleBossCleared: false,
    skipped: [],
  };
}

describe('the forward button at the end of a page', () => {
  it('names the next stop', () => {
    render(
      <MemoryRouter>
        <ChapterNext current="setup" />
      </MemoryRouter>,
    );
    const next = CHAPTERS[1];
    if (!next) throw new Error('the road is shorter than two stops');
    expect(screen.getByRole('link', { name: nextCopy.button(next.title) })).toBeTruthy();
  });

  it('closes the road with one sentence, spaced either side of the link', () => {
    const last = CHAPTERS[CHAPTERS.length - 1];
    if (!last) throw new Error('the road has no stops');
    const { container } = render(
      <MemoryRouter>
        <ChapterNext current={last.id} />
      </MemoryRouter>,
    );
    const sentence = container.querySelector('.next-button-end');
    expect(sentence?.textContent).toBe(
      nextCopy.endLead(countWord(CHAPTERS.length)) + nextCopy.endLink + nextCopy.endTail,
    );
    // The line above is derived from the copy, so it only pins the JOIN. The
    // prose is checked independently: one space either side of the link, and
    // nowhere in the sentence two spaces in a row.
    expect(sentence?.textContent).toContain(` ${nextCopy.endLink} `);
    expect(sentence?.textContent).not.toMatch(/ {2}/);
  });
});

describe("the Bounce Bog's level chips", () => {
  it('asks for the level before the one she pressed', () => {
    const asked = 3;
    render(
      <LevelPicker progress={blankProgress()} selected={1} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${asked}`) }));
    expect(screen.getByText(levelPickerCopy.gateRule(asked - 1))).toBeTruthy();
    expect(screen.getByRole('button', { name: levelPickerCopy.gateBack(asked - 1) })).toBeTruthy();
    expect(screen.getByRole('button', { name: levelPickerCopy.gateSkip })).toBeTruthy();
  });
});

describe('the gate panel', () => {
  it("gives a mini-game's title the article a lesson's does not need", () => {
    expect(gateCopy.gateName('Pogo Course', true)).toBe('the Pogo Course');
    expect(gateCopy.gateName('Your Setup', false)).toBe('Your Setup');
  });
});
