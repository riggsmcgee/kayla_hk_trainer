/**
 * The one loud button a page ends on (playtest 3, notes 13 and 14).
 *
 * Every stop on the road now finishes the same way: one gold "Next: {title}"
 * button, with the place in small text beneath it. Before this there were
 * three different forward affordances — "Prove it →" on a lesson, "Next
 * stop → {place}" under the chapter strip, and a duplicate link inside the
 * mini-game panels — and she could not tell which one was the way on.
 *
 * Dumb on purpose: it renders a link or a click handler and nothing else.
 * ChapterNext knows about chapters; this knows about buttons.
 */
import { Link } from 'react-router';
import { nextCopy } from '../copy/nav';
import '../styles/next.css';

interface NextButtonProps {
  /** The name of what comes next — the button reads "Next: {title}". */
  title: string;
  /** Where it goes. Exactly one of `to` / `onClick`. */
  to?: string;
  onClick?: () => void;
  /** Small text under the button: the place, usually. */
  where?: string;
}

export function NextButton({ title, to, onClick, where }: NextButtonProps) {
  const label = nextCopy.button(title);
  return (
    <div className="next-button">
      {to !== undefined ? (
        <Link className="button" to={to}>
          {label}
        </Link>
      ) : (
        <button type="button" className="button" onClick={onClick}>
          {label}
        </button>
      )}
      {where && <span className="next-button-where">{where}</span>}
    </div>
  );
}
