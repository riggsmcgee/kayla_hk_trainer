import { useCallback } from 'react';
import { Link } from 'react-router';
import { ChapterNav } from '../components/ChapterNav';
import { ComfortToggles } from '../components/ComfortToggles';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { createPogoCourseSession } from '../engine/pogoCourseSession';
import { useMarkVisited } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';

export function PlayPogo() {
  useMarkVisited('pogo-course');
  const [comfort, setComfort] = useComfortSettings();
  const createSession = useCallback(() => createPogoCourseSession(comfort), [comfort]);
  return (
    <>
      <p className="eyebrow">Mini-game · The Bounce Bog</p>
      <h1>Pogo Course</h1>
      <p className="lede">
        Bounce across the spikes, lantern to lantern. A miss only costs a few seconds. New to the
        beat? The <Link to="/lessons/pogo">Pogo chapter</Link> is two minutes.
      </p>
      <PracticeCanvas label="Pogo Course" createSession={createSession} />
      <ComfortToggles value={comfort} onChange={setComfort} />
      <ChapterNav current="pogo-course" />
    </>
  );
}
