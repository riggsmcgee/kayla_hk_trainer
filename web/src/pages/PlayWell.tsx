/**
 * The Bottom of the Well — the finale (playtest 2 interview). Everything she
 * learned, at once, in three beats: pogo level 4 ("All of it at once"), then
 * the roster in waves on a flat floor, then the Two Bills at the bottom. The
 * page opens on the first beat not finished; the strip above the canvas is
 * the road between them (clear-to-unlock, skippable, like everywhere else).
 * Clears go through the shared progress store, and once the level, every
 * wave and the Bills are done the road is walked.
 */
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { ChapterNext } from '../components/ChapterNext';
import { FinePrint } from '../components/FinePrint';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { blurOnPointerClick } from '../components/focus';
import { endingCopy } from '../copy/ending';
import { stopStateCopy } from '../copy/nav';
import { finalePlayCopy } from '../copy/play';
import { createBossSession } from '../engine/bossSession';
import { createDodgeArenaSession } from '../engine/dodgeArenaSession';
import type { ComfortSettings } from '../engine/juice';
import { createPogoCourseSession } from '../engine/pogoCourseSession';
import { FINALE_LEVEL, FINALE_WAVE_COUNT } from '../engine/roster';
import { waveStages } from '../engine/stages';
import { useOverlayLabels } from '../storage/useOverlayLabels';
import {
  bossSkipKey,
  finaleCleared,
  finaleLevelSkipKey,
  waveLocked,
  waveSkipKey,
} from '../storage/progress';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { useGodMode } from '../storage/useGodMode';
import { useRollVariant } from '../storage/useRollVariant';
import { useEntranceVariant } from '../storage/useEntranceVariant';
import { useDogLook } from '../storage/useDogLook';
import { levelBestLine } from './playPogo.helpers';
import {
  BEATS,
  afterLevel,
  beatDone,
  beatLocked,
  bossBestLine,
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
  /** DEV TOOL: remove in the final build. Passed straight through to each session. */
  godMode: boolean;
  /**
   * What the overlays call the forward control, asked for at draw time so the
   * copy can follow her bindings and her board without a rebuild.
   */
  jumpKey: () => string;
  /** What the overlays call the again control, same rule. */
  attackKey: () => string;
  refresh: () => void;
}

/** Beat 1 — pogo level 4, "put it all together". */
function LevelBeat({
  progress,
  runs,
  comfort,
  godMode,
  jumpKey,
  attackKey,
  refresh,
  onWaves,
}: BeatProps & { onWaves: () => void }) {
  const [justCleared, setJustCleared] = useState(false);

  const createSession = useCallback(
    () =>
      createPogoCourseSession({
        level: FINALE_LEVEL,
        comfort,
        godMode,
        jumpKey,
        attackKey,
        // Z goes on to the waves, X runs the level again (playtest 3, note 11).
        onNext: onWaves,
        nextLabel: 'the waves',
        onClear: () => {
          progressStore.markFinaleLevelCleared();
          refresh();
          setJustCleared(true);
        },
      }),
    [comfort, godMode, jumpKey, attackKey, onWaves, refresh],
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
function WavesBeat({
  progress,
  runs,
  comfort,
  godMode,
  jumpKey,
  attackKey,
  refresh,
  onBottom,
}: BeatProps & { onBottom: () => void }) {
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
        godMode,
        kind: 'waves',
        jumpKey,
        attackKey,
        onNext: onBottom,
        nextLabel: 'the bottom',
        onStageStarted: setCurrent,
        onStageCleared,
        // A touch records a run, and the "longest survival" best comes from those.
        onStageFailed: refresh,
      }),
    [startWave, comfort, godMode, jumpKey, attackKey, onBottom, onStageCleared, refresh],
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
 * Beat 3 — the Two Bills. The one beat with no target but the clock: nothing
 * down here can be hurt, so the strip, the panel and the HUD all speak in
 * time survived rather than hits landed.
 */
function BossBeat({ progress, runs, comfort, godMode, jumpKey, attackKey, refresh }: BeatProps) {
  // DEV TOOL: remove in the final build. Which of the five roll behaviours
  // the dog uses — read here rather than threaded through BeatProps, because
  // the boss is the only beat with a dog in it.
  const [rollVariant] = useRollVariant();
  const [entranceVariant] = useEntranceVariant();
  const [look] = useDogLook();
  /**
   * DEV TOOL: remove in the final build. God mode makes the fight unlosable,
   * and the only way out of the canvas is the fail screen (bossSession's
   * `over` branch), which can then never be reached — so the fight would run
   * until she left the page. The nonce remounts it, the same trick WavesBeat
   * uses to replay a wave it is already on.
   */
  const [runCount, setRunCount] = useState(0);
  /**
   * DEV TOOL: remove in the final build. Watch the ending without beating the
   * fight first. God mode cannot reach it on purpose — a run that absorbed
   * hits has not earned it — so this is the only way to look at the
   * celebration while it is being built.
   */
  const [watchEnding, setWatchEnding] = useState(false);
  const replay = (ending: boolean) => {
    setWatchEnding(ending);
    setRunCount((n) => n + 1);
  };
  /**
   * Whether she had already survived 1:30 BEFORE this visit. Read once and
   * held for the life of the beat, deliberately: `cleared` is baked into the
   * session when it is built, so a live value rebuilds the whole fight the
   * instant she crosses 1:30 — mid-run, with both Bills on screen. Playtest 6
   * watched exactly that in a browser: on her first ever clear the fight
   * dropped back to "Move to begin" and the run was never recorded.
   */
  const [clearedBefore] = useState(progress.finaleBossCleared);

  const onPassed = useCallback(() => {
    progressStore.markFinaleBossCleared();
    refresh();
  }, [refresh]);

  /**
   * Where forward goes from the celebration. Until now there was nowhere, so
   * both keys restarted the fight and this screen was the only one in the dojo
   * breaking the ratified `jump = forward, attack = again`.
   *
   * `useCallback`, and not an inline arrow, for the reason this whole file has
   * been burned by three times: `createSession` is a dependency of the canvas,
   * and a callback whose identity changes every render rebuilds the fight
   * under her while she is playing it. `navigate` is stable across renders, so
   * this is too.
   */
  const navigate = useNavigate();
  const onTheEnd = useCallback(() => navigate('/the-end'), [navigate]);

  const createSession = useCallback(
    () =>
      createBossSession({
        comfort,
        godMode,
        rollVariant,
        entranceVariant,
        dogLook: look,
        playTheEnding: watchEnding,
        jumpKey,
        attackKey,
        cleared: clearedBefore,
        onPassed,
        onNext: onTheEnd,
        nextLabel: endingCopy.whatsNext,
        // A touch records the run, and her best time comes from those.
        onFailed: refresh,
      }),
    [
      comfort,
      godMode,
      rollVariant,
      entranceVariant,
      look,
      watchEnding,
      jumpKey,
      attackKey,
      clearedBefore,
      onPassed,
      onTheEnd,
      refresh,
    ],
  );

  return (
    <div className="well-beat-body">
      <p className="level-best">{bossBestLine(runs)}</p>
      <PracticeCanvas
        key={runCount}
        label="The thing at the bottom"
        createSession={createSession}
      />
      {godMode && (
        <p className="fine-print settings-note">
          <button type="button" className="text-button" onClick={() => replay(false)}>
            Start the fight over
          </button>{' '}
          — god mode means it cannot end on its own.{' '}
          <button type="button" className="text-button" onClick={() => replay(true)}>
            Watch the ending
          </button>{' '}
          — jumps to 1:30 untouched. It does not count as beating them.
        </p>
      )}
    </div>
  );
}

export function PlayWell() {
  const chapter = chapterById(CHAPTER_ID);
  const { progress, runs, refresh } = useProgress();
  const [comfort] = useComfortSettings();
  const [godMode] = useGodMode();
  const { jumpKey, attackKey } = useOverlayLabels();
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

  /**
   * Walking FORWARD out of a beat she has just finished — what the running
   * game calls when it clears. It is deliberately not `selectBeat`: this gets
   * handed to a session factory, and `selectBeat` takes a new identity on
   * every progress change, so clearing a beat rebuilt the very game that
   * cleared it. No lock check is needed either, because the beat it leads to
   * is the one she has this moment unlocked.
   */
  const goForward = useCallback((b: Beat) => {
    setAsked(null);
    setBeat(b);
  }, []);

  const toWaves = useCallback(() => goForward(2), [goForward]);
  const skipToBottom = () => {
    // Skipping the bottom means skipping every wave that still stands in the
    // way — the same "nothing ever traps her" rule the level gate follows.
    for (let wave = 1; wave <= FINALE_WAVE_COUNT; wave++) {
      progressStore.markSkipped(waveSkipKey(wave));
    }
    progressStore.markSkipped(bossSkipKey());
    refresh();
    setAsked(null);
    setBeat(3);
  };

  const toBottom = useCallback(() => goForward(3), [goForward]);
  const beatProps: BeatProps = {
    progress,
    runs,
    comfort,
    godMode,
    jumpKey,
    attackKey,
    refresh,
  };

  return (
    <ChapterGate current={CHAPTER_ID}>
      <p className="eyebrow">
        Mini-game · {chapterIndex(CHAPTER_ID)} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">{finalePlayCopy.lede}</p>

      <ol className="well-beats" aria-label={finalePlayCopy.beatsLabel}>
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
                {done && <span className="sr-only">{stopStateCopy.done}</span>}
                {locked && <span className="sr-only">{stopStateCopy.locked}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {gateBeat !== null && (
        <div className="level-gate" role="status">
          <p className="level-gate-rule">
            {gateBeat === 3 ? finalePlayCopy.gateRuleWaves : finalePlayCopy.gateRuleLevel}
          </p>
          <div className="gate-actions">
            <button
              type="button"
              className="button"
              onClick={() => selectBeat(gateBeat === 3 ? 2 : 1)}
            >
              {gateBeat === 3 ? finalePlayCopy.gateBackWaves : finalePlayCopy.gateBackLevel}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={gateBeat === 3 ? skipToBottom : skipLevel}
            >
              {gateBeat === 3 ? finalePlayCopy.gateSkipWaves : finalePlayCopy.gateSkipLevel}
            </button>
          </div>
        </div>
      )}

      {beat === 1 && <LevelBeat {...beatProps} onWaves={toWaves} />}
      {beat === 2 && <WavesBeat {...beatProps} onBottom={toBottom} />}
      {beat === 3 && <BossBeat {...beatProps} />}

      {finaleCleared(progress) && (
        <div className="well-done" role="status">
          <p className="well-done-title">{finalePlayCopy.roadDone}</p>
          <Link className="button" to="/">
            {finalePlayCopy.roadDoneBack}
          </Link>
        </div>
      )}

      <FinePrint />

      <ChapterNext current={CHAPTER_ID} />
      <ChapterNav current={CHAPTER_ID} />
    </ChapterGate>
  );
}
