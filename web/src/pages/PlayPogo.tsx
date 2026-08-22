/**
 * The Bounce Bog — the Pogo Course as a three-level mini-game (playtest 2,
 * notes 3 and 5). Pick a level (clear-to-unlock, skippable), play it, see
 * your best; a clear unlocks the next level and offers it right under the
 * canvas. The session remounts per level (the canvas is keyed by it), and
 * clears are recorded to localStorage through the shared progress store.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { chapterById, chapterIndex, countWordCap, nextChapter } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { LevelPicker } from '../components/LevelPicker';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { createPogoCourseSession } from '../engine/pogoCourseSession';
import { COURSE_LEVEL_COUNT } from '../engine/roster';
import { jumpKeyName } from '../storage/keyNames';
import { levelSkipKey } from '../storage/progress';
import { useBindings } from '../storage/useBindings';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { afterClear, levelBestLine, nextLevelToPlay } from './playPogo.helpers';
import '../styles/levels.css';

const CHAPTER_ID = 'pogo-course';

export function PlayPogo() {
  const chapter = chapterById(CHAPTER_ID);
  const next = nextChapter(CHAPTER_ID);
  const { progress, runs, refresh } = useProgress();
  const [comfort] = useComfortSettings();
  const [bindings] = useBindings();
  const jumpKey = jumpKeyName(bindings);
  const [level, setLevel] = useState(() => nextLevelToPlay(progress));
  /** The level cleared most recently in this visit — drives the panel under the canvas. */
  const [justCleared, setJustCleared] = useState<number | null>(null);

  const selectLevel = useCallback((n: number) => {
    setLevel(n);
    setJustCleared(null);
  }, []);

  const skipLevel = useCallback(
    (n: number) => {
      progressStore.markSkipped(levelSkipKey(n));
      refresh();
      selectLevel(n);
    },
    [refresh, selectLevel],
  );

  const hasNextLevel = level < COURSE_LEVEL_COUNT;
  const createSession = useCallback(
    () =>
      createPogoCourseSession({
        level,
        comfort,
        hasNextLevel,
        jumpKey,
        onClear: (info) => {
          progressStore.markLevelCleared(info.level);
          refresh();
          setJustCleared(info.level);
        },
      }),
    [level, comfort, hasNextLevel, jumpKey, refresh],
  );

  const panel = justCleared === null ? null : afterClear(justCleared, progress);
  const panelNext = panel?.nextLevel ?? null;

  return (
    <ChapterGate current={CHAPTER_ID}>
      <p className="eyebrow">
        Mini-game · {chapterIndex(CHAPTER_ID)} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">
        {countWordCap(COURSE_LEVEL_COUNT)} levels, lantern to lantern — a miss only costs a few
        seconds. Clear one to open the next.
      </p>

      <LevelPicker
        progress={progress}
        selected={level}
        onSelect={selectLevel}
        onSkip={skipLevel}
      />
      <p className="level-best">{levelBestLine(runs, level)}</p>

      <PracticeCanvas
        key={level}
        label={`Pogo Course, level ${level}`}
        createSession={createSession}
      />

      {panel && (
        <div className="level-clear" role="status">
          <p className="level-clear-title">{panel.title}</p>
          {panelNext !== null ? (
            <button type="button" className="button" onClick={() => selectLevel(panelNext)}>
              {panel.label}
            </button>
          ) : (
            next && (
              <Link className="button" to={next.route}>
                Next stop → {next.place}
              </Link>
            )
          )}
        </div>
      )}

      <p className="fine-print">
        Screen shake and flashing can be turned down in <Link to="/settings">Settings</Link>.
      </p>

      <ChapterNav current={CHAPTER_ID} />
    </ChapterGate>
  );
}
