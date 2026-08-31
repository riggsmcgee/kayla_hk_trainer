// @vitest-environment jsdom
/**
 * The front page, now that its words live in `copy/home.ts`.
 *
 * Two things worth holding. The first is that the page still says what it says:
 * the hero, the doctrine and the signature are the warmest lines on the site
 * and the ones most likely to be edited, so the extraction has to have moved
 * them rather than lost them.
 *
 * The second is the promise `components/ChapterNav.tsx` has always made in its
 * doc comment and nothing has ever checked — that **the map and the strip draw
 * a stop in the same state**. They now read one table, `stopStateCopy`, so the
 * test is cheap; before this slice they held two copies of the same four
 * strings and could have drifted silently.
 *
 * Everything runs against a save with nothing on the road cleared, which is
 * what a browser with no localStorage gives Kayla the first time she opens it.
 * That keeps the module-level progress store out of the way: seeding it and
 * then rendering is the trap the last sprint hit, and none of this needs it.
 */
import type { ReactElement } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { CHAPTERS } from '../chapters';
import { homeCopy } from '../copy/home';
import { chapterNavCopy, dojoMapCopy, stopStateCopy } from '../copy/nav';
import { ChapterNav } from '../components/ChapterNav';
import { Home } from './Home';

afterEach(cleanup);

function renderAt(ui: ReactElement): HTMLElement {
  return render(<MemoryRouter>{ui}</MemoryRouter>).container;
}

describe('the front page', () => {
  it('opens with the hero and the lede', () => {
    renderAt(<Home />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(homeCopy.hero);
    expect(screen.getByText(homeCopy.lede)).toBeTruthy();
  });

  it('points a blank save at the first stop on the road', () => {
    renderAt(<Home />);
    const first = CHAPTERS[0];
    if (!first) throw new Error('the road has no stops');
    const sign = screen.getByRole('complementary', { name: homeCopy.signLabel });
    expect(within(sign).getByText(first.title)).toBeTruthy();
    expect(within(sign).getByText(homeCopy.signToFinish(first.done))).toBeTruthy();
  });
});

describe('the map and the chapter strip', () => {
  it('read a locked stop out in the same words', () => {
    // The last stop is locked on a blank save: the finale is the far end of the
    // road, and nothing before it has been cleared or skipped.
    const last = CHAPTERS[CHAPTERS.length - 1];
    if (!last) throw new Error('the road has no stops');

    const map = renderAt(<Home />).querySelector('nav.map');
    const mapStop = within(map as HTMLElement)
      .getByText(last.title)
      .closest('li');
    expect(mapStop?.textContent).toContain(stopStateCopy.locked);
    expect((map as HTMLElement).getAttribute('aria-label')).toBe(dojoMapCopy.label);

    cleanup();

    const strip = renderAt(<ChapterNav current={CHAPTERS[0]!.id} />).querySelector(
      'nav.chapter-nav',
    );
    const stripStop = within(strip as HTMLElement)
      .getByText(last.title)
      .closest('li');
    expect(stripStop?.textContent).toContain(stopStateCopy.locked);
    expect((strip as HTMLElement).getAttribute('aria-label')).toBe(chapterNavCopy.label);
  });
});
