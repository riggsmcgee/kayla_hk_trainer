import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { EnemyId } from '@dojo/shared';
import { ChapterNav } from '../components/ChapterNav';
import { ComfortToggles } from '../components/ComfortToggles';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { createDodgeArenaSession } from '../engine/dodgeArenaSession';
import { useMarkVisited } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';

/** Roster order matches the teaching progression. */
const ROSTER: { id: EnemyId; name: string }[] = [
  { id: 'walker', name: 'Walker' },
  { id: 'flier', name: 'Flier' },
  { id: 'duelist', name: 'Duelist' },
  { id: 'spitter', name: 'Spitter' },
  { id: 'warden', name: 'Warden' },
];

export function PlayDodge() {
  useMarkVisited('dodge-arena');
  const [enemyId, setEnemyId] = useState<EnemyId>('walker');
  const [observe, setObserve] = useState(false);
  const [comfort, setComfort] = useComfortSettings();

  const createSession = useCallback(
    () => createDodgeArenaSession({ enemyId, observe, comfort }),
    [enemyId, observe, comfort],
  );

  return (
    <>
      <p className="eyebrow">Mini-game · Kbug’s Colosseum</p>
      <h1>Dodge Arena</h1>
      <p className="lede">
        One enemy. The run ends the first time it touches you; your score is clean hits. Observe
        mode makes your nail a feather — just watch and dodge, like the{' '}
        <Link to="/lessons/reading-enemies">Reading Enemies chapter</Link> says.
      </p>
      <div className="arena-controls" role="group" aria-label="Arena setup">
        <div className="btn-row" role="radiogroup" aria-label="Choose an enemy">
          {ROSTER.map((e) => (
            <button
              key={e.id}
              role="radio"
              aria-checked={enemyId === e.id}
              className={enemyId === e.id ? 'chip chip-active' : 'chip'}
              onClick={() => setEnemyId(e.id)}
            >
              {e.name}
            </button>
          ))}
        </div>
        <label className="observe-toggle">
          <input type="checkbox" checked={observe} onChange={(e) => setObserve(e.target.checked)} />
          Observe mode — feather nail, just watch and dodge
        </label>
      </div>
      <PracticeCanvas label="Dodge Arena" createSession={createSession} />
      <ComfortToggles value={comfort} onChange={setComfort} />
      <ChapterNav current="dodge-arena" />
    </>
  );
}
