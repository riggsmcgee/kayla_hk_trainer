/**
 * The forward button at the end of a chapter page, resolved from the road.
 *
 * `nextChapter(current)` is the single source of "what comes next" — the
 * same answer the lesson's old "Prove it →" gave and the same one the strip's
 * "Next stop →" gave, which is why those two collapsed into this one button.
 * chapters.test.ts pins that they can never disagree again.
 *
 * A gated page must NOT render this: it would point her past the page she is
 * locked out of. ChapterGate renders the strip without it, deliberately.
 */
import { Link } from 'react-router';
import { CHAPTERS, countWord, nextChapter, type ChapterId } from '../chapters';
import { nextCopy } from '../copy/nav';
import { NextButton } from './NextButton';

interface ChapterNextProps {
  current: ChapterId;
}

export function ChapterNext({ current }: ChapterNextProps) {
  const next = nextChapter(current);
  if (!next) {
    return (
      <p className="next-button-end">
        {nextCopy.endLead(countWord(CHAPTERS.length))}
        <Link to="/">{nextCopy.endLink}</Link>
        {nextCopy.endTail}
      </p>
    );
  }
  return <NextButton title={next.title} to={next.route} where={next.place} />;
}
