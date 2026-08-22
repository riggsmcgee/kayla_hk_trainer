/**
 * The gate on a chapter page (playtest 2, note 5). Every chapter page wraps
 * its body in this:
 *
 *   <ChapterGate current="pogo-course">…</ChapterGate>
 *
 * While the stop before it isn't passed, the body is replaced by one panel —
 * the rule ("Finish the Pogo Course first"), the obvious button back to that
 * stop, and a quiet "Skip this challenge" beneath it. Skipping marks the gate
 * stop as skipped (it counts for unlocking, never for done) and the body
 * appears in place. Nothing ever traps her.
 *
 * Which stop is the gate comes from storage/progress.ts (chapterGate): the
 * previous stop, except that a mini-game proving the lesson before it shares
 * that lesson's gate, so "Prove it →" is never locked.
 *
 * A stop counts as VISITED only once its body has actually rendered —
 * bouncing off the gate panel is not a visit, or the Knight on the map
 * would walk past a lesson she never read (standingAt in progress.ts).
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { ChapterId } from '../chapters';
import { chapterGate, chapterLocked } from '../storage/progress';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { ChapterNav } from './ChapterNav';
import '../styles/gates.css';

interface ChapterGateProps {
  current: ChapterId;
  children: ReactNode;
}

export function ChapterGate({ current, children }: ChapterGateProps) {
  const { progress, refresh } = useProgress();
  const gate = chapterGate(current);
  const locked = gate !== null && chapterLocked(current, progress);
  // Mark the visit once the body shows — on mount when open, and on the
  // render after "Skip this challenge" flips the gate.
  useEffect(() => {
    if (!locked) progressStore.markVisited(current);
  }, [current, locked]);
  if (!gate || !locked) return <>{children}</>;

  const skip = () => {
    progressStore.markSkipped(gate.id);
    refresh();
  };

  // "Finish the Pogo Course first" — but "Finish Your Setup first".
  const gateName = gate.kind === 'mini-game' ? `the ${gate.title}` : gate.title;

  return (
    <>
      <section className="gate" aria-labelledby="gate-heading">
        <p className="eyebrow">Not yet</p>
        <h1 id="gate-heading">Finish {gateName} first</h1>
        <p className="gate-done">{gate.done}</p>
        <div className="gate-actions">
          <Link className="button" to={gate.route}>
            Back to {gate.place}
          </Link>
          <button type="button" className="text-button" onClick={skip}>
            Skip this challenge
          </button>
        </div>
      </section>
      {/* The strip stays visible behind a gate, so she can still see where she is on the
          road — without the "Next stop" button, which would point her past the locked page. */}
      <ChapterNav current={current} showNext={false} />
    </>
  );
}
