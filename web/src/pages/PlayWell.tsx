/**
 * The Bottom of the Well — the finale (playtest 2 interview). Everything she
 * learned, at once, in three beats: pogo level 4 ("All of it at once"), then
 * the roster in waves on a flat floor, then the thing at the bottom — which
 * is not built yet. The page opens on the first beat not finished; the strip
 * above the canvas is the road between them (clear-to-unlock, skippable,
 * like everywhere else). Clears go through the shared progress store, and
 * once the level and every wave are cleared the road is walked.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { blurOnPointerClick } from '../components/focus';
import { createDodgeArenaSession } from '../engine/dodgeArenaSession';
import type { ComfortSettings } from '../engine/juice';
import { createPogoCourseSession } from '../engine/pogoCourseSession';
import { FINALE_LEVEL, FINALE_WAVE_COUNT } from '../engine/roster';
import { waveStages } from '../engine/stages';
import { jumpKeyName } from '../storage/keyNames';
import { finaleCleared, finaleLevelSkipKey, waveLocked, waveSkipKey } from '../storage/progress';
import { useBindings } from '../storage/useBindings';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { levelBestLine } from './playPogo.helpers';
import {
  BEATS,
  afterLevel,
  beatDone,
  beatLocked,
  firstUnclearedWave,
  nextBeat,
  waveBestLine,
  waveName,
  type Beat,
} from './playWell.helpers';
import '../styles/levels.css';
import '../styles/well.css';

const CHAPTER_ID = 'finale';

const WAVES = Array.from({ length: FINALE_WAVE_COUNT }, (_, i) => i + 1);

function CheckMark({ className }: { className: string }) {
  return (
    <svg className={`${className} ${className}-check`} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  );
}

function Lock({ className }: { className: string }) {
  return (
    <svg className={`${className} ${className}-lock`} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" />
    </svg>
  );
}

interface BeatProps {
  progress: ProgressV1;
  runs: readonly PracticeRun[];
  comfort: ComfortSettings;
  /** What the overlays call the jump key — from her bindings. */
  jumpKey: string;
  refresh: () => void;
}

/** Beat 1 — pogo level 4, "put it all together". */
function LevelBeat({
  progress,
  runs,
  comfort,
  jumpKey,
  refresh,
  onWaves,
}: BeatProps & { onWaves: () => void }) {
  const [justCleared, setJustCleared] = useState(false);

  const createSession = useCallback(
    () =>
      createPogoCourseSession({
        level: FINALE_LEVEL,
        comfort,
        jumpKey,
        onClear: () => {
          progressStore.markFinaleLevelCleared();
          refresh();
          setJustCleared(true);
        },
      }),
    [comfort, jumpKey, refresh],
  );

  const panel = justCleared ? afterLevel(progress) : null;

  return (
    <div className="well-beat-body">
      <p className="level-best">{levelBestLine(runs, FINALE_LEVEL)}</p>
      <PracticeCanvas
        label={`The Bottom of the Well, level ${FINALE_LEVEL}`}
        createSession={createSession}
      />
      {panel && (
        <div className="level-clear" role="status">
          <p className="level-clear-title">{panel.title}</p>
          {panel.offerWaves && (
            <button type="button" className="button" onClick={onWaves}>
              Waves →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Beat 2 — the roster in waves, on a flat floor. Checkpointed per wave. */
function WavesBeat({ progress, runs, comfort, jumpKey, refresh }: BeatProps) {
  // Fixed until she picks a wave, so recording a clear doesn't rebuild the session under her.
  const [startWave, setStartWave] = useState(() => firstUnclearedWave(progress));
  /**
   * Counts her picks. The canvas is keyed on it as well as on startWave: after
   * the session auto-advances, picking the wave it STARTED on leaves startWave
   * unchanged, and without the nonce nothing would remount — the chip would
   * move while the canvas stayed on the next wave.
   */
  const [pickCount, setPickCount] = useState(0);
  /** The wave the session is on (0-based); the session is its only writer (onStageStarted). */
  const [current, setCurrent] = useState(startWave);
  // The locked wave she last pressed; the gate shows while it stays locked.
  const [asked, setAsked] = useState<number | null>(null);
  const gateWave = asked !== null && waveLocked(asked, progress) ? asked : null;

  const select = useCallback((wave: number) => {
    setAsked(null);
    setStartWave(wave - 1);
    setPickCount((n) => n + 1);
  }, []);

  const pick = (wave: number): void => {
    if (waveLocked(wave, progress)) {
      setAsked(wave);
      return;
    }
    select(wave);
  };

  const skip = (wave: number): void => {
    progressStore.markSkipped(waveSkipKey(wave));
    refresh();
    select(wave);
  };

  const onStageCleared = useCallback(
    (index: number) => {
      progressStore.markWaveCleared(index + 1);
      refresh();
    },
    [refresh],
  );

  const createSession = useCallback(
    () =>
      createDodgeArenaSession({
        stages: waveStages(),
        startIndex: startWave,
        comfort,
        kind: 'waves',
        jumpKey,
        onStageStarted: setCurrent,
        onStageCleared,
        // A touch records a run, and the "longest survival" best comes from those.
        onStageFailed: refresh,
      }),
    [startWave, comfort, jumpKey, onStageCleared, refresh],
  );

  return (
    <div className="well-beat-body">
      <div className="level-picker">
        <div className="btn-row" role="group" aria-label="Choose a wave">
          {WAVES.map((wave) => {
            const cleared = progress.finaleWavesCleared.includes(wave);
            const locked = waveLocked(wave, progress);
            const active = wave - 1 === current;
            const cls = [
              'chip',
              'level-chip',
              active ? 'chip-active' : '',
              locked ? 'level-locked' : '',
              cleared ? 'level-cleared' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={wave}
                type="button"
                aria-pressed={active}
                className={cls}
                onClick={(e) => {
                  blurOnPointerClick(e);
                  pick(wave);
                }}
              >
                <span className="level-num">{wave}</span>
                <span className="level-name">{waveName(wave)}</span>
                {cleared && <CheckMark className="level-mark" />}
                {locked && <Lock className="level-mark" />}
                {cleared && <span className="sr-only">, cleared</span>}
                {locked && <span className="sr-only">, locked</span>}
              </button>
            );
          })}
        </div>

        {gateWave !== null && (
          <div className="level-gate" role="status">
            <p className="level-gate-rule">Clear wave {gateWave - 1} first.</p>
            <div className="gate-actions">
              <button type="button" className="button" onClick={() => pick(gateWave - 1)}>
                Play wave {gateWave - 1}
              </button>
              <button type="button" className="text-button" onClick={() => skip(gateWave)}>
                Skip this wave
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="level-best">{waveBestLine(runs, current + 1)}</p>

      <PracticeCanvas
        key={`${startWave}:${pickCount}`}
        label="The waves"
        createSession={createSession}
      />
    </div>
  );
}

/**
 * Beat 3 — the thing at the bottom. A quiet panel and nothing more: the boss
 * is PLANNED (PLAN.md §8) but must be designed in its own conversation with
 * the user before anyone builds or stubs it. Do not add art, copy or code
 * for it here without that conversation.
 */
function BottomBeat() {
  return (
    <div className="well-beat-body">
      <div className="well-quiet" role="status">
        <p>Something is waiting down here. Not yet.</p>
      </div>
    </div>
  );
}

export function PlayWell() {
  const chapter = chapterById(CHAPTER_ID);
  const { progress, runs, refresh } = useProgress();
  const [comfort] = useComfortSettings();
  const [bindings] = useBindings();
  const jumpKey = jumpKeyName(bindings);
  const [beat, setBeat] = useState<Beat>(() => nextBeat(progress));
  // The locked beat she last pressed; the gate shows while it stays locked.
  const [asked, setAsked] = useState<Beat | null>(null);
  const gateBeat = asked !== null && beatLocked(asked, progress) ? asked : null;

  const selectBeat = useCallback(
    (b: Beat) => {
      if (beatLocked(b, progress)) {
        setAsked(b);
        return;
      }
      setAsked(null);
      setBeat(b);
    },
    [progress],
  );

  const skipLevel = () => {
    progressStore.markSkipped(finaleLevelSkipKey());
    refresh();
    setAsked(null);
    setBeat(2);
  };

  const toWaves = useCallback(() => selectBeat(2), [selectBeat]);
  const beatProps: BeatProps = { progress, runs, comfort, jumpKey, refresh };

  return (
    <ChapterGate current={CHAPTER_ID}>
      <p className="eyebrow">
        Mini-game · {chapterIndex(CHAPTER_ID)} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">
        Everything you’ve learned, Kayla, all at once. Nothing down here is new.
      </p>

      <ol className="well-beats" aria-label="The three beats">
        {BEATS.map((def) => {
          const done = beatDone(def.beat, progress);
          const locked = beatLocked(def.beat, progress);
          const active = def.beat === beat;
          const cls = [
            'well-beat',
            active ? 'well-beat-active' : '',
            done ? 'well-beat-done' : '',
            locked ? 'well-beat-locked' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={def.beat} className={cls}>
              <button
                type="button"
                aria-pressed={active}
                className="well-beat-button"
                onClick={(e) => {
                  blurOnPointerClick(e);
                  selectBeat(def.beat);
                }}
              >
                <span className="well-beat-disc">
                  {done ? <CheckMark className="well-mark" /> : def.beat}
                </span>
                <span className="well-beat-name">{def.name}</span>
                {locked && <Lock className="well-mark" />}
                {done && <span className="sr-only">, done</span>}
                {locked && <span className="sr-only">, locked</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {gateBeat !== null && (
        <div className="level-gate" role="status">
          <p className="level-gate-rule">Clear the level first.</p>
          <div className="gate-actions">
            <button type="button" className="button" onClick={() => selectBeat(1)}>
              Play the level
            </button>
            <button type="button" className="text-button" onClick={skipLevel}>
              Skip the level
            </button>
          </div>
        </div>
      )}

      {beat === 1 && <LevelBeat {...beatProps} onWaves={toWaves} />}
      {beat === 2 && <WavesBeat {...beatProps} />}
      {beat === 3 && <BottomBeat />}

      {finaleCleared(progress) && (
        <div className="well-done" role="status">
          <p className="well-done-title">You walked the whole road, Kayla.</p>
          <Link className="button" to="/">
            Back to the map
          </Link>
        </div>
      )}

      <p className="fine-print">
        Screen shake and flashing can be turned down in <Link to="/settings">Settings</Link>.
      </p>

      <ChapterNav current={CHAPTER_ID} />
    </ChapterGate>
  );
}
