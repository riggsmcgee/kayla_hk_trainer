import { useCallback } from 'react';
import { Link } from 'react-router';
import { ComfortToggles } from '../components/ComfortToggles';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { createPogoCourseSession } from '../engine/pogoCourseSession';
import { useComfortSettings } from '../storage/useComfortSettings';

export function PracticePogo() {
  const [comfort, setComfort] = useComfortSettings();
  const createSession = useCallback(() => createPogoCourseSession(comfort), [comfort]);
  return (
    <>
      <h1>Pogo Course</h1>
      <p className="lede">
        A spike-floor obstacle course you cross by chaining downslash bounces, Kayla —
        checkpointed, so a miss only ever costs you a few seconds. Warm up with the{' '}
        <Link to="/lessons/pogo">Pogo lesson</Link> if the rhythm is new.
      </p>
      <p className="muted">
        Jump out over an orb, then slash <strong>down</strong> (hold ↓ and press X in the
        air) to bounce off it. Chain bounces to cross the spike pits — touching spikes just
        sends you back to the last lantern. Falling in costs seconds, never progress.
      </p>
      <PracticeCanvas label="Pogo Course" createSession={createSession} />
      <ComfortToggles value={comfort} onChange={setComfort} />
    </>
  );
}
