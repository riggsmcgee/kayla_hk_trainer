/**
 * "Prove it →" — the one big button a lesson ends on (playtest 2, note 5).
 * It points at the mini-game that proves the lesson (Chapter.provesAt); the
 * lesson only counts as done when that mini-game is cleared. Renders nothing
 * for a chapter that has no proof.
 */
import { Link } from 'react-router';
import { chapterById, type ChapterId } from '../chapters';
import '../styles/gates.css';

interface ProveItProps {
  current: ChapterId;
}

export function ProveIt({ current }: ProveItProps) {
  const provesAt = chapterById(current).provesAt;
  if (!provesAt) return null;
  const target = chapterById(provesAt);
  return (
    <div className="prove-it">
      <Link className="button" to={target.route}>
        Prove it →
      </Link>
      <span className="prove-it-where">
        <span className="prove-it-place">{target.place}</span> — {target.title}
      </span>
    </div>
  );
}
