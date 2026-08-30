/**
 * Kbug's Colosseum — the Dodge Arena as a staged game (playtest 2, note 1).
 * Five enemies in teaching order; each is passed by surviving thirty seconds,
 * then the next steps in. Hits are a score she is chasing, not a toll. A touch restarts that enemy,
 * never the roster. The page resumes at the first enemy not yet cleared,
 * records clears through the shared progress store, and shows her best for
 * the enemy she's on. Once all five are cleared, the road goes on.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import type { EnemyId, PracticeRun, ProgressV1 } from '@dojo/shared';
import { chapterById, chapterIndex, countWordCap, nextChapter } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { ChapterNext } from '../components/ChapterNext';
import { FinePrint } from '../components/FinePrint';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { blurOnPointerClick } from '../components/focus';
import { dodgeArenaPlayCopy, playCopy } from '../copy/play';
import { createDodgeArenaSession } from '../engine/dodgeArenaSession';
import { ROSTER, rosterEntry } from '../engine/roster';
import { rosterStages } from '../engine/stages';
import { arenaBest, bestHits } from '../storage/bests';
import { useOverlayLabels } from '../storage/useOverlayLabels';
import { arenaCleared } from '../storage/progress';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { useAssistMode } from '../storage/useAssistMode';
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
  const { lives: assistLives } = useAssistMode();
  // Functions, not strings: the overlays ask at draw time, so the copy can
  // follow her pad without the session being rebuilt under a live run.
  const { jumpKey, attackKey } = useOverlayLabels();
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

  /**
   * Her best hits on the enemy at `index`, read from the STORE rather than
   * from the `runs` this component rendered with.
   *
   * That is not a shortcut, it is the requirement: `createSession`'s dependency
   * list deliberately leaves `runs` out, because adding it would rebuild the
   * canvas every time a run is recorded — which restarts the run that recorded
   * it. A closure over the rendered array would therefore go stale the moment
   * she finishes her first attempt. `progressStore` is the same singleton
   * `recordRun` writes through, so asking it is always current.
   */
  const bestHitsForStage = useCallback((index: number): number | null => {
    const id = ROSTER[index]?.id;
    if (!id) return null;
    return bestHits(
      progressStore.listRuns(),
      (r) => r.mode === 'dodge' && r.enemyId === id && r.wave === undefined,
    );
  }, []);

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
        assistLives,
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
      assistLives,
      jumpKey,
      attackKey,
      bestHits: bestHitsForStage,
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
    assistLives,
    comfort,
    startIndex,
    onStageCleared,
    refresh,
    jumpKey,
    attackKey,
    bestHitsForStage,
    next,
    navigate,
  ]);

  const shownEnemy = freePlay ?? ROSTER[current]?.id ?? 'walker';
  const allCleared = arenaCleared(progress);

  return (
    <ChapterGate current={CHAPTER_ID}>
      <p className="eyebrow">{playCopy.eyebrow(chapterIndex(CHAPTER_ID), chapter.place)}</p>
      <h1>{chapter.title}</h1>
      <p className="lede">{dodgeArenaPlayCopy.lede(countWordCap(ROSTER.length))}</p>

      <ol className="arena-strip" aria-label={dodgeArenaPlayCopy.rosterLabel}>
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
              <span className="arena-stage-hits">
                {dodgeArenaPlayCopy.stageBestHits(bestHitsForStage(i))}
              </span>
              {cleared && <span className="sr-only">{dodgeArenaPlayCopy.srCleared}</span>}
            </li>
          );
        })}
      </ol>
      <p className="arena-best">{arenaBestLine(runs, shownEnemy)}</p>

      <PracticeCanvas
        key={`${freePlay ?? 'roster'}:${observe ? 'observe' : 'play'}`}
        label={dodgeArenaPlayCopy.canvasLabel}
        createSession={createSession}
      />

      {allCleared && (
        <div className="arena-clear" role="status">
          <p className="arena-clear-title">{dodgeArenaPlayCopy.arenaClear}</p>
        </div>
      )}

      <FinePrint />

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
