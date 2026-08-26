/**
 * Kbug's Colosseum — the Dodge Arena as a staged game (playtest 2, note 1).
 * Five enemies in teaching order; each is passed by surviving a minute AND
 * landing its hits, then the next steps in. A touch restarts that enemy,
 * never the roster. The page resumes at the first enemy not yet cleared,
 * records clears through the shared progress store, and shows her best for
 * the enemy she's on. Once all five are cleared, the road goes on.
 */
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { EnemyId, PracticeRun, ProgressV1 } from '@dojo/shared';
import { chapterById, chapterIndex, countWordCap, nextChapter } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { ChapterNext } from '../components/ChapterNext';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { blurOnPointerClick } from '../components/focus';
import { createDodgeArenaSession } from '../engine/dodgeArenaSession';
import { ROSTER, rosterEntry } from '../engine/roster';
import { rosterStages } from '../engine/stages';
import { arenaBest } from '../storage/bests';
import { attackKeyName, jumpKeyName } from '../storage/keyNames';
import { arenaCleared } from '../storage/progress';
import { useBindings } from '../storage/useBindings';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { useGodMode } from '../storage/useGodMode';
import { formatClock } from './bestLine';
import '../styles/arena.css';

const CHAPTER_ID = 'dodge-arena';

/** Where she resumes: the first enemy not yet cleared, else the top (replay = practice). */
function firstUncleared(progress: ProgressV1): number {
  const i = ROSTER.findIndex((e) => !progress.arenaEnemiesCleared.includes(e.id));
  return i < 0 ? 0 : i;
}

/** One line for the enemy she's on. */
function arenaBestLine(runs: readonly PracticeRun[], enemyId: EnemyId): string {
  const name = rosterEntry(enemyId).name.toLowerCase();
  const best = arenaBest(runs, enemyId);
  if (!best) return `No run against the ${name} yet.`;
  const hits = `${best.hitsLanded} ${best.hitsLanded === 1 ? 'hit' : 'hits'}`;
  return best.cleared
    ? `Best: cleared the ${name} with ${hits}.`
    : `Best: ${formatClock(best.durationMs)} against the ${name}, ${hits}.`;
}

function CheckMark() {
  return (
    <svg className="arena-check" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  );
}

export function PlayDodge() {
  const chapter = chapterById(CHAPTER_ID);
  const next = nextChapter(CHAPTER_ID);
  const { progress, runs, refresh } = useProgress();
  const [comfort] = useComfortSettings();
  const [godMode] = useGodMode();
  const [bindings] = useBindings();
  const jumpKey = jumpKeyName(bindings);
  const attackKey = attackKeyName(bindings);
  const navigate = useNavigate();
  // Fixed for this visit, so recording a clear doesn't rebuild the session under her.
  const [startIndex] = useState(() => firstUncleared(progress));
  /**
   * The stage the session is on. The session is its only writer
   * (onStageStarted) — auto-advance, checkpoint restart and the replay from
   * the top after the last clear all come through it, so the strip and the
   * best line never point at an enemy the canvas has moved off.
   */
  const [current, setCurrent] = useState(startIndex);

  // DEV TOOL: remove in the final build — free play against one enemy, and
  // observe mode. Neither records a clear; both are out of the progression.
  const [freePlay, setFreePlay] = useState<EnemyId | null>(null);
  const [observe, setObserve] = useState(false);

  const onStageCleared = useCallback(
    (index: number) => {
      const entry = ROSTER[index];
      if (!entry) return;
      progressStore.markEnemyCleared(entry.id);
      refresh();
    },
    [refresh],
  );

  const createSession = useCallback(() => {
    const stages = rosterStages();
    if (freePlay !== null) {
      // DEV TOOL: remove in the final build — no onStageCleared, so nothing is marked.
      return createDodgeArenaSession({
        stages: stages.filter((s) => s.enemies[0] === freePlay),
        startIndex: 0,
        comfort,
        observe,
        godMode,
        kind: 'roster',
        jumpKey,
        attackKey,
      });
    }
    return createDodgeArenaSession({
      stages,
      startIndex,
      comfort,
      observe,
      godMode,
      kind: 'roster',
      jumpKey,
      attackKey,
      // Z off the all-cleared screen leaves the page for the next chapter
      // (playtest 3, note 11); X replays the roster from the top.
      onNext: next ? () => navigate(next.route) : undefined,
      nextLabel: next?.title,
      onStageStarted: setCurrent,
      onStageCleared: observe ? undefined : onStageCleared,
      // A touch records a run, and the "longest survival" best comes from those.
      onStageFailed: observe ? undefined : refresh,
    });
  }, [
    freePlay,
    observe,
    godMode,
    comfort,
    startIndex,
    onStageCleared,
    refresh,
    jumpKey,
    attackKey,
    next,
    navigate,
  ]);

  const shownEnemy = freePlay ?? ROSTER[current]?.id ?? 'walker';
  const allCleared = arenaCleared(progress);

  return (
    <ChapterGate current={CHAPTER_ID}>
      <p className="eyebrow">
        Mini-game · {chapterIndex(CHAPTER_ID)} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">
        {countWordCap(ROSTER.length)} enemies, in order. Survive a minute and land your hits, and
        the next one steps in. Get touched and you start that enemy over.
      </p>

      <ol className="arena-strip" aria-label="The roster">
        {ROSTER.map((e, i) => {
          const cleared = progress.arenaEnemiesCleared.includes(e.id);
          const isCurrent = freePlay === null && i === current;
          const cls = [
            'arena-stage',
            cleared ? 'arena-stage-done' : '',
            isCurrent ? 'arena-stage-current' : '',
            !cleared && !isCurrent ? 'arena-stage-upcoming' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={e.id} className={cls} aria-current={isCurrent ? 'step' : undefined}>
              <span className="arena-stage-disc">{cleared ? <CheckMark /> : i + 1}</span>
              <span className="arena-stage-name">{e.name}</span>
              <span className="arena-stage-hits">{e.hitsToPass} hits</span>
              {cleared && <span className="sr-only">, cleared</span>}
            </li>
          );
        })}
      </ol>
      <p className="arena-best">{arenaBestLine(runs, shownEnemy)}</p>

      <PracticeCanvas
        key={`${freePlay ?? 'roster'}:${observe ? 'observe' : 'play'}`}
        label="Dodge Arena"
        createSession={createSession}
      />

      {allCleared && (
        <div className="arena-clear" role="status">
          <p className="arena-clear-title">Colosseum cleared, Kayla!</p>
        </div>
      )}

      <p className="fine-print">
        Screen shake and flashing can be turned down in <Link to="/settings">Settings</Link>.
      </p>

      {/* DEV TOOL: remove in the final build */}
      <details className="dev-tools">
        <summary>Dev tools — remove in the final build</summary>
        <div className="arena-controls" role="group" aria-label="Dev tools">
          <div className="btn-row" role="group" aria-label="Free play: pick one enemy">
            <button
              type="button"
              aria-pressed={freePlay === null}
              className={freePlay === null ? 'chip chip-active' : 'chip'}
              onClick={(ev) => {
                blurOnPointerClick(ev);
                setFreePlay(null);
              }}
            >
              The roster
            </button>
            {ROSTER.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={freePlay === e.id}
                className={freePlay === e.id ? 'chip chip-active' : 'chip'}
                onClick={(ev) => {
                  blurOnPointerClick(ev);
                  setFreePlay(e.id);
                }}
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
            Observe mode — feather nail, no clears
          </label>
        </div>
      </details>

      <ChapterNext current={CHAPTER_ID} />
      <ChapterNav current={CHAPTER_ID} />
    </ChapterGate>
  );
}
