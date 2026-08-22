/**
 * The chapter strip: the map's path, flattened into a row, shown on every
 * chapter page so Kayla always knows where she is and what's next. The
 * sequence is real (PLAN §6 teaching order), which is why it's numbered.
 */
import { Link } from 'react-router';
import { CHAPTERS, nextChapter, type ChapterId } from '../chapters';
import { useLitChapters } from '../storage/useChapterProgress';

interface ChapterNavProps {
  current: ChapterId;
}

export function ChapterNav({ current }: ChapterNavProps) {
  const lit = useLitChapters();
  const next = nextChapter(current);
  return (
    <nav className="chapter-nav" aria-label="Chapters">
      <ol className="chapter-strip">
        {CHAPTERS.map((c, i) => {
          const isCurrent = c.id === current;
          const isLit = lit.has(c.id) || isCurrent;
          const cls = ['stop', isCurrent ? 'stop-current' : '', isLit ? 'stop-lit' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={c.id} className={cls}>
              <Link to={c.route} aria-current={isCurrent ? 'page' : undefined}>
                <span className="stop-lantern" aria-hidden="true">
                  <svg viewBox="0 0 16 24" width="12" height="18">
                    <line x1="8" y1="12" x2="8" y2="24" />
                    <path d="M8 2 L13 9 L8 16 L3 9 Z" />
                  </svg>
                </span>
                <span className="stop-text">
                  <span className="stop-place">
                    {i + 1}. {c.place}
                  </span>
                  <span className="stop-title">{c.title}</span>
                  {isLit && !isCurrent && <span className="sr-only">, done</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {next ? (
        <p className="chapter-next">
          Next stop:{' '}
          <Link to={next.route}>
            {next.place} — {next.title}
          </Link>
        </p>
      ) : (
        <p className="chapter-next">
          That’s the whole map. <Link to="/">Back to the start</Link> and go again.
        </p>
      )}
    </nav>
  );
}
