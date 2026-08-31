/**
 * The practice floor — a bare floor, her Knight, and the seven things her
 * hands need to be able to do.
 *
 * Playtest 8 asked for the sandbox; playtest 9 moved it here and gave it the
 * second half of its job. It used to be the bottom third of the Setup lesson,
 * below two controller diagrams and eight paragraphs, which is a long way to
 * scroll to find out whether your buttons work. And it could only ever TELL
 * her a control was wrong — the fix was two pages away in Settings.
 *
 * Now every row carries its own Remap. "It should say Jump and next it would
 * be Remap, and it's not working." A control that does not answer is rebound
 * on the line it failed on, from whichever hand she reaches for: the capture
 * listens to the keyboard and the pad at once and takes the first press. That
 * is not a convenience — her board enumerates as a gamepad whose button
 * numbering nobody has ever established, so "press the one you mean" is the
 * only thing that can be right.
 *
 * Not a chapter, so no `ChapterGate`: gating the floor on Setup's completion
 * would lock it behind the very checks it exists to collect.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetupCheck } from '@dojo/shared';
import { Link } from 'react-router';
import { chapterById, chapterIndex } from '../chapters';
import { ChapterNav } from '../components/ChapterNav';
import { ChapterNext } from '../components/ChapterNext';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { useControlCapture } from '../components/useControlCapture';
import { lessonCopy } from '../copy/lessons';
import { actionLabelCopy } from '../copy/settings';
import { setupCheckLabels, setupFloorCopy } from '../copy/setup';
import { buttonName, rebindButton, type GamepadBindings } from '../engine/gamepad';
import { rebind, type Action, type Bindings } from '../engine/input';
import { SETUP_CHECKS, SETUP_CHECK_ACTIONS } from '../engine/setupChecks';
import { createSetupSandbox } from '../engine/setupSandboxSession';
import { friendlyKeyName } from '../storage/keyNames';
import { chapterPassed } from '../storage/progress';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useBindings } from '../storage/useBindings';
import { useGamepadBindings } from '../storage/useGamepadBindings';
import '../styles/gates.css';
import '../styles/setup.css';

/**
 * What is bound to one action right now, keys and buttons together.
 *
 * Both hands, always, and never "the one she last used": the point of the row
 * is that she can see what SHOULD work, and a row that hid the pad while she
 * was typing would hide the exact thing she came here to check.
 */
function ControlChips({
  action,
  bindings,
  padBindings,
}: {
  action: Action;
  bindings: Bindings;
  padBindings: GamepadBindings;
}) {
  // Both Shifts, and a button bound twice, print once.
  const keys = [...new Set(bindings[action].map(friendlyKeyName))];
  const buttons = [...new Set(padBindings[action].map(buttonName))];
  if (keys.length === 0 && buttons.length === 0) {
    return <span className="control-chips is-unbound">{setupFloorCopy.unbound}</span>;
  }
  return (
    <span className="control-chips">
      {keys.map((name) => (
        <kbd key={`k:${name}`} className="key-chip">
          {name}
        </kbd>
      ))}
      {buttons.map((name) => (
        <kbd key={`b:${name}`} className="key-chip pad-chip">
          {name}
        </kbd>
      ))}
    </span>
  );
}

/** One rebindable control: what it is bound to, and the button that changes it. */
function ControlLine({
  action,
  id,
  row,
  named,
  bindings,
  padBindings,
  capturing,
  onStart,
  onCancel,
}: {
  action: Action;
  /**
   * The control's id — the CHECK and the action, not the action alone. Attack is
   * on all three nail rows, so an action-keyed capture put all three of them
   * into the capture state at once.
   */
  id: string;
  /** The checklist item this control belongs to, for the accessible name. */
  row: string;
  /** True on a compound row, where the action needs naming of its own. */
  named: boolean;
  bindings: Bindings;
  padBindings: GamepadBindings;
  capturing: string | null;
  onStart: (id: string, action: Action) => void;
  onCancel: () => void;
}) {
  const label = actionLabelCopy[action];
  const active = capturing === id;
  return (
    <span className="control-line">
      {named && <span className="control-name">{label}</span>}
      {active ? (
        // A live region, because the prompt is the whole instruction and it
        // arrives without her having moved focus anywhere.
        <span className="control-prompt" role="status">
          {setupFloorCopy.pressPrompt(label)}
        </span>
      ) : (
        <ControlChips action={action} bindings={bindings} padBindings={padBindings} />
      )}
      <button
        type="button"
        className={active ? 'chip chip-active' : 'chip'}
        // Nine of these on one page, all reading "Remap", so the accessible name
        // is the only thing telling them apart — and it names the ROW, because
        // Attack is on all three nail rows and naming by control alone gave three
        // buttons called "Remap Attack".
        aria-label={
          active
            ? setupFloorCopy.cancelLabel(label)
            : named
              ? setupFloorCopy.remapControlLabel(label, row)
              : setupFloorCopy.remapLabel(row)
        }
        onClick={() => (active ? onCancel() : onStart(id, action))}
      >
        {active ? setupFloorCopy.cancel : setupFloorCopy.remap}
      </button>
    </span>
  );
}

/**
 * She arrived without answering chapter 1's question, so there is no board to
 * prove. Shaped like every other gate on the road — eyebrow, rule, one obvious
 * way back — and it keeps the chapter strip for the same reason `ChapterGate`
 * does: bouncing off a gate should not cost her the map.
 *
 * It has no skip, and that is the one way it differs. Every other gate skips
 * past a CHALLENGE; this one is waiting on an answer that takes one click, and
 * the floor has nothing to show until it has one.
 */
function NeedsController() {
  return (
    <>
      <section className="gate" aria-labelledby="floor-gate-h">
        <p className="eyebrow">{setupFloorCopy.needsControllerEyebrow}</p>
        <h1 id="floor-gate-h">{setupFloorCopy.needsControllerHeading}</h1>
        <p className="gate-done">{setupFloorCopy.needsControllerLine}</p>
        <div className="gate-actions">
          <Link className="button" to={chapterById('setup').route}>
            {setupFloorCopy.needsControllerBack}
          </Link>
        </div>
      </section>
      <ChapterNav current="setup" />
    </>
  );
}

export function SetupFloor() {
  const { progress, refresh } = useProgress();
  const [bindings, setBindings] = useBindings();
  const [padBindings, setPadBindings] = useGamepadBindings();

  /**
   * The sheet lives in a ref, and the session factory has no dependencies —
   * both for the same reason. `PracticeCanvas` rebuilds its session whenever
   * `createSession` changes identity, so a factory that closed over changing
   * state would restart the Knight on every tick.
   */
  const doneRef = useRef<Set<SetupCheck>>(new Set(progress.setupChecks ?? []));
  const [ticked, setTicked] = useState<readonly SetupCheck[]>(() => [...doneRef.current]);

  const createSession = useCallback(
    () =>
      createSetupSandbox({
        alreadyDone: doneRef.current,
        onEarned: (earned) => {
          for (const check of earned) doneRef.current.add(check);
          progressStore.markSetupChecks(earned);
          setTicked([...doneRef.current]);
          // The strip under the canvas and the forward button both read the
          // store, and ticking the seventh check is exactly the moment they
          // stop being true. `refresh` is stable, so this does not rebuild the
          // session that just called it.
          refresh();
        },
      }),
    [refresh],
  );

  /**
   * The canvas, so the keyboard can be handed back to it.
   *
   * The adapter ignores keys pressed while a BUTTON has focus — deliberately,
   * so Space can toggle a checkbox rather than jump — and after a Remap the
   * focus is still on the Remap button she pressed. Without this the key she
   * just assigned does nothing until she clicks the game, which is the feature
   * failing at the last inch.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A capture writes through the shared binding stores, so the rows, the
  // caption under the canvas and the adapter the Knight is driven by all change
  // together — and the session underneath is not rebuilt (PracticeCanvas).
  const capture = useControlCapture((action, control) => {
    if (control.kind === 'key') setBindings(rebind(bindings, action, control.code));
    else setPadBindings(rebindButton(padBindings, action, control.index));
    // Straight back to the game, so she can try the control she just bound.
    canvasRef.current?.focus({ preventScroll: true });
  });

  const skippedRef = useRef<HTMLParagraphElement>(null);
  const skip = (): void => {
    progressStore.markSkipped('setup');
    refresh();
  };
  // The skip swaps the button she pressed for a line of text; move her focus
  // with it, the way the bench's reset flow does, or it drops to the document.
  const skipped = progress.skipped.includes('setup');
  const wasSkipped = useRef(skipped);
  useEffect(() => {
    if (wasSkipped.current === skipped) return; // first render: leave focus alone
    wasSkipped.current = skipped;
    if (skipped) skippedRef.current?.focus();
  }, [skipped]);

  if (progress.controller === undefined) return <NeedsController />;

  const chapter = chapterById('setup');
  const remaining = SETUP_CHECKS.filter((check) => !ticked.includes(check)).length;
  // The forward button is the road's, and the road is locked until this page is
  // finished with. Offering it early would point her gold button at Pogo's gate.
  const passed = chapterPassed('setup', progress);

  return (
    <>
      <p className="eyebrow">{lessonCopy.eyebrow(chapterIndex('setup'), chapter.place)}</p>
      <h1>{setupFloorCopy.title}</h1>
      <p className="lede">{setupFloorCopy.lede}</p>
      <p>{setupFloorCopy.kit}</p>

      <PracticeCanvas
        label={setupFloorCopy.canvasLabel}
        createSession={createSession}
        // While a capture is open the key she presses is being ASSIGNED, not
        // played — otherwise assigning Jump would also jump, and could tick the
        // box using the binding she is in the middle of replacing.
        inputPaused={capture.capturing !== null}
        canvasRef={canvasRef}
      />

      <ul className="setup-checklist">
        {SETUP_CHECKS.map((check) => {
          const done = ticked.includes(check);
          const actions = SETUP_CHECK_ACTIONS[check];
          const compound = actions.length > 1;
          return (
            <li key={check} className={done ? 'is-done' : undefined}>
              <span className="check-mark" aria-hidden="true">
                {done ? '✔' : '·'}
              </span>
              <span className={compound ? 'check-body is-compound' : 'check-body'}>
                <span className="check-label">
                  {setupCheckLabels[check]}
                  <span className="sr-only">
                    {done ? setupFloorCopy.srDone : setupFloorCopy.srNotYet}
                  </span>
                </span>
                {actions.map((action) => (
                  <ControlLine
                    key={action}
                    action={action}
                    id={`${check}:${action}`}
                    row={setupCheckLabels[check]}
                    named={compound}
                    bindings={bindings}
                    padBindings={padBindings}
                    capturing={capture.capturing}
                    onStart={capture.start}
                    onCancel={capture.cancel}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ul>

      {/* aria-live so the count is announced as she works, without a screen
          reader user having to go hunting through the list for what changed. */}
      <p className="fine-print" role="status">
        {remaining === 0 ? setupFloorCopy.allDone : setupFloorCopy.remaining(remaining)}
      </p>

      {remaining > 0 && !skipped && (
        <p className="fine-print">
          <button type="button" className="text-button" onClick={skip}>
            {setupFloorCopy.skip}
          </button>
        </p>
      )}
      {/* Only while it is still the reason she is past this page. Once all seven
          are ticked, "you skipped this" and "that is all seven" would be on
          screen together saying opposite things. */}
      {skipped && remaining > 0 && (
        <p className="fine-print" role="status" tabIndex={-1} ref={skippedRef}>
          {setupFloorCopy.skipped}
        </p>
      )}

      {passed && <ChapterNext current="setup" />}
      <ChapterNav current="setup" />
    </>
  );
}
