/**
 * The chapter strip: the map's road, flattened into a row, shown on every
 * chapter page so Kayla always knows where she is and what's next. The
 * sequence is real (PLAN §6 teaching order), which is why it's numbered.
 *
 * Each stop is drawn in the same state the map draws it — done (lit, full),
 * visited / skipped (unfinished), locked (faded) — from storage/progress.ts,
 * so the two can never disagree.
 *
 * It used to carry a "Next stop →" button as well. That button now lives in
 * ChapterNext, above the strip, as the page's one gold forward button
 * (playtest 3, note 13) — the strip itself is small print at the bottom of
 * the page, for orientation only (note 14).
 */
import { Link } from 'react-router';
import { CHAPTERS, type ChapterId } from '../chapters';
import type { ChapterState } from '../storage/progress';
import { useMapProgress } from '../storage/useChapterProgress';
import '../styles/gates.css';

interface ChapterNavProps {
  current: ChapterId;
}

const STATE_SR: Partial<Record<ChapterState, string>> = {
  done: ', done',
  skipped: ', skipped',
  locked: ', locked',
};

export function ChapterNav({ current }: ChapterNavProps) {
  const { states } = useMapProgress();
  return (
    <nav className="chapter-nav" aria-label="Chapters">
      <ol className="chapter-strip">
        {CHAPTERS.map((c, i) => {
          const isCurrent = c.id === current;
          const state = states[c.id];
          const cls = [
            'stop',
            `stop-${state}`,
            isCurrent ? 'stop-current' : '',
            state === 'done' ? 'stop-lit' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const sr = STATE_SR[state];
          return (
            <li key={c.id} className={cls}>
              <Link to={c.route} aria-current={isCurrent ? 'page' : undefined}>
                <span className="stop-lantern" aria-hidden="true">
                  <svg viewBox="0 0 16 24" width="9" height="14">
                    <line x1="8" y1="12" x2="8" y2="24" />
                    <path d="M8 2 L13 9 L8 16 L3 9 Z" />
                  </svg>
                </span>
                <span className="stop-text">
                  <span className="stop-place">
                    {i + 1}. {c.place}
                  </span>
                  <span className="stop-title">{c.title}</span>
                  {sr && <span className="sr-only">{sr}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
