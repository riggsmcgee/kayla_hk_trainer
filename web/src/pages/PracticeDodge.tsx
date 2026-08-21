import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { EnemyId } from '@dojo/shared';
import { ComfortToggles } from '../components/ComfortToggles';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { createDodgeArenaSession } from '../engine/dodgeArenaSession';
import { useComfortSettings } from '../storage/useComfortSettings';

/** Roster order matches the teaching progression. M4 unlocks the last three. */
const ROSTER: { id: EnemyId; name: string; ready: boolean }[] = [
  { id: 'walker', name: 'Walker', ready: true },
  { id: 'flier', name: 'Flier', ready: true },
  { id: 'duelist', name: 'Duelist', ready: true },
  { id: 'spitter', name: 'Spitter', ready: true },
  { id: 'warden', name: 'Warden', ready: true },
];

export function PracticeDodge() {
  const [enemyId, setEnemyId] = useState<EnemyId>('walker');
  const [observe, setObserve] = useState(false);
  const [comfort, setComfort] = useComfortSettings();

  const createSession = useCallback(
    () => createDodgeArenaSession({ enemyId, observe, comfort }),
    [enemyId, observe, comfort],
  );

  return (
    <>
      <h1>Dodge Arena</h1>
      <p className="lede">
        One enemy at a time, Kayla. The run ends the first time you get hit, and your score
        is how many clean nail hits you land — or flip on observe mode, where your nail
        does no damage and the only goal is to survive and watch. It&apos;s the{' '}
        <Link to="/lessons/reading-enemies">Reading Enemies</Link> lesson, made playable.
      </p>
      <div className="arena-controls" role="group" aria-label="Arena setup">
        <div className="btn-row" role="radiogroup" aria-label="Choose an enemy">
          {ROSTER.map((e) => (
            <button
              key={e.id}
              role="radio"
              aria-checked={enemyId === e.id}
              className={enemyId === e.id ? 'chip chip-active' : 'chip'}
              disabled={!e.ready}
              title={e.ready ? undefined : 'This one is still training. Coming soon.'}
              onClick={() => setEnemyId(e.id)}
            >
              {e.name}
            </button>
          ))}
        </div>
        <label className="observe-toggle">
          <input
            type="checkbox"
            checked={observe}
            onChange={(e) => setObserve(e.target.checked)}
          />
          Observe mode — feather nail, just watch and dodge
        </label>
      </div>
      <PracticeCanvas label="Dodge Arena" createSession={createSession} />
      <ComfortToggles value={comfort} onChange={setComfort} />
    </>
  );
}
