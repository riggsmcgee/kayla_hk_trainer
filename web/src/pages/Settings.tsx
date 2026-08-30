/**
 * The bench — Settings. Three compact sections: Controls (keyboard remap),
 * Comfort (the two toggles), Progress (reset). Not a chapter, so no gate
 * and no strip. The real controllers get their check-and-remap here in M7.
 */
import { useEffect, useRef, useState } from 'react';
import type { ControllerChoice } from '@dojo/shared';
import { Link } from 'react-router';
import { AssistControl } from '../components/AssistControl';
import { ComfortToggles } from '../components/ComfortToggles';
import { useControlCapture } from '../components/useControlCapture';
import { theEndCopy } from '../copy/theEnd';
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  bindingsToSettings,
  rebind,
  type Action,
} from '../engine/input';
import {
  gamepadDefaultsFor,
  buttonName,
  connectedPads,
  rebindButton,
  type ConnectedPad,
} from '../engine/gamepad';
import { friendlyKeyName } from '../storage/keyNames';
import { useGamepadBindings } from '../storage/useGamepadBindings';
import { useBindings } from '../storage/useBindings';
import { notifyProgressChanged, progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { useAssistMode } from '../storage/useAssistMode';
import { useGodMode } from '../storage/useGodMode';
import { useRollVariant } from '../storage/useRollVariant';
import { useEntranceVariant } from '../storage/useEntranceVariant';
import { useDogLook } from '../storage/useDogLook';
import { ROLL_VARIANTS } from '../engine/enemies';
import { BILL_ENTRANCES } from '../engine/entrance';
import { DOG_LOOKS } from '../engine/dogLook';
import { actionLabelCopy, settingsCopy } from '../copy/settings';
import '../styles/settings.css';

const ACTION_LABELS: Record<Action, string> = actionLabelCopy;

const DEFAULT_STORED = JSON.stringify(bindingsToSettings(DEFAULT_BINDINGS));
/**
 * "Reset to defaults" has to mean HER defaults.
 *
 * Since playtest 8 the pad's starting layout depends on the controller she
 * picked in Setup — a leverless moves attack off jump's finger — so a reset
 * that always restored the Joy-Con shape would quietly undo the preset and
 * hand the clash back to her. The button was relabelled last sprint; this is
 * the sprint where it also changed behaviour.
 */
function padDefaultsStored(controller: ControllerChoice | undefined): string {
  return JSON.stringify(gamepadDefaultsFor(controller));
}

/**
 * How often the Controller section looks for pads.
 *
 * The Gamepad API has no "a pad appeared" event worth relying on, and it
 * hides a pad entirely until a button is pressed on it (the spec's own
 * anti-fingerprinting rule). So this polls — six times a second, which finds
 * a newly-woken pad fast enough to feel instant and is nothing next to the
 * 60 Hz the game itself polls at.
 */
const PAD_POLL_MS = 160;

type ResetStage = 'idle' | 'confirm' | 'cleared';

export function Settings() {
  const { progress } = useProgress();
  const [bindings, setBindings] = useBindings();
  const [comfort, setComfort] = useComfortSettings();
  const [godMode, setGodMode] = useGodMode();
  const assist = useAssistMode();
  const [rollVariant, setRollVariant] = useRollVariant();
  const [entranceVariant, setEntranceVariant] = useEntranceVariant();
  const [dogLook, setDogLook] = useDogLook();
  const [padBindings, setPadBindings] = useGamepadBindings();
  const [pads, setPads] = useState<ConnectedPad[]>([]);
  /**
   * Two captures, deliberately kept narrow.
   *
   * The bench asks the narrow question on purpose: the Controls section is the
   * keyboard's and the Controller section is the pad's, and a key taken while
   * she is looking at the pad's list would be a surprise. The practice floor
   * asks the wide one — press whatever you mean — because there the row is the
   * control rather than the hand. Same hook, one argument apart.
   */
  const keyCapture = useControlCapture((action, control) => {
    if (control.kind === 'key') setBindings(rebind(bindings, action, control.code));
  }, 'key');
  const padCapture = useControlCapture((action, control) => {
    if (control.kind === 'button') setPadBindings(rebindButton(padBindings, action, control.index));
  }, 'button');
  // The bench's ids ARE the actions: each appears on exactly one row here.
  const capturing = keyCapture.capturingAction;
  const capturingPad = padCapture.capturingAction;
  const [resetStage, setResetStage] = useState<ResetStage>('idle');

  // Which pads are here, refreshed on a timer. A pad stays invisible to the
  // browser until she presses something on it, so this is also what turns
  // "no controller found" into her controller's name the moment she does.
  useEffect(() => {
    const poll = (): void => setPads(connectedPads());
    poll();
    const timer = window.setInterval(poll, PAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const isDefault = JSON.stringify(bindingsToSettings(bindings)) === DEFAULT_STORED;
  const padDefaults = gamepadDefaultsFor(progress.controller);
  const padIsDefault = JSON.stringify(padBindings) === padDefaultsStored(progress.controller);

  // The reset flow swaps the button she pressed for a panel, then a line of
  // text; move her focus along with it so the keyboard (and the screen
  // reader) follows. Never onto the destructive "Yes".
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const shownStage = useRef(resetStage);
  useEffect(() => {
    if (shownStage.current === resetStage) return; // first render: leave the page's focus alone
    shownStage.current = resetStage;
    if (resetStage === 'confirm') confirmRef.current?.focus();
    else if (resetStage === 'cleared') doneRef.current?.focus();
    else resetButtonRef.current?.focus();
  }, [resetStage]);

  function resetProgress(): void {
    progressStore.clearAllProgress();
    notifyProgressChanged();
    setResetStage('cleared');
  }

  return (
    <div className="settings">
      <p className="eyebrow">{settingsCopy.eyebrow}</p>
      <h1>{settingsCopy.title}</h1>
      <p className="lede">{settingsCopy.lede}</p>

      <section className="settings-section" aria-labelledby="settings-controls">
        <h2 id="settings-controls">{settingsCopy.controlsHeading}</h2>
        <ul className="binding-list">
          {ACTIONS.map((action) => {
            const active = capturing === action;
            return (
              <li key={action} className={active ? 'binding-row is-capturing' : 'binding-row'}>
                <span className="binding-action">{ACTION_LABELS[action]}</span>
                <span className="binding-keys">
                  {active ? (
                    <span className="binding-prompt">{settingsCopy.keyPrompt}</span>
                  ) : bindings[action].length === 0 ? (
                    <span className="binding-prompt">{settingsCopy.noKey}</span>
                  ) : (
                    // Both Shifts print as one chip, like the caption.
                    [...new Set(bindings[action].map(friendlyKeyName))].map((name) => (
                      <kbd key={name} className="key-chip">
                        {name}
                      </kbd>
                    ))
                  )}
                </span>
                {/* Seven rows, so each button says which key it changes; the
                    label starts with the visible text (WCAG "label in name"). */}
                <button
                  type="button"
                  className={active ? 'chip chip-active' : 'chip'}
                  aria-label={
                    active
                      ? settingsCopy.cancelChangeKey(ACTION_LABELS[action])
                      : settingsCopy.changeKey(ACTION_LABELS[action])
                  }
                  onClick={() => (active ? keyCapture.cancel() : keyCapture.start(action, action))}
                >
                  {active ? settingsCopy.cancel : settingsCopy.change}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" role="status">
          {capturing ? settingsCopy.keyCaptureStatus(ACTION_LABELS[capturing]) : ''}
        </p>
        <div className="btn-row">
          {/* Two buttons on this page read "Reset to defaults" — this one and
              the controller's. Listing the page's buttons, which is how a
              screen reader is usually driven, gave no way to tell them apart.
              The name still STARTS with the visible text, per the same WCAG
              "label in name" rule the Change buttons above follow. */}
          <button
            type="button"
            className="chip"
            aria-label={settingsCopy.resetKeyboardLabel}
            disabled={isDefault}
            onClick={() => {
              keyCapture.cancel();
              setBindings(DEFAULT_BINDINGS);
            }}
          >
            {settingsCopy.reset}
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-controller">
        <h2 id="settings-controller">{settingsCopy.controllerHeading}</h2>
        {pads.length === 0 ? (
          <p className="settings-note">
            {settingsCopy.noPadLead}
            <strong>{settingsCopy.noPadStrong}</strong>
            {settingsCopy.noPadTail}
          </p>
        ) : (
          <ul className="pad-list">
            {pads.map((padInfo, i) => (
              <li key={`${padInfo.id}-${i}`} className="pad-row">
                <span className="pad-name">{padInfo.id}</span>
                <span className="pad-buttons">{settingsCopy.padButtons(padInfo.buttons)}</span>
                {!padInfo.standard && (
                  <span className="fine-print">{settingsCopy.padNonStandard}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <ul className="binding-list">
          {ACTIONS.map((action) => {
            const active = capturingPad === action;
            return (
              <li key={action} className={active ? 'binding-row is-capturing' : 'binding-row'}>
                <span className="binding-action">{ACTION_LABELS[action]}</span>
                <span className="binding-keys">
                  {active ? (
                    <span className="binding-prompt">{settingsCopy.buttonPrompt}</span>
                  ) : padBindings[action].length === 0 ? (
                    <span className="binding-prompt">{settingsCopy.noButton}</span>
                  ) : (
                    padBindings[action].map((index) => (
                      <kbd key={index} className="key-chip">
                        {buttonName(index)}
                      </kbd>
                    ))
                  )}
                </span>
                <button
                  type="button"
                  className={active ? 'chip chip-active' : 'chip'}
                  aria-label={
                    active
                      ? settingsCopy.cancelChangeButton(ACTION_LABELS[action])
                      : settingsCopy.changeButton(ACTION_LABELS[action])
                  }
                  onClick={() => (active ? padCapture.cancel() : padCapture.start(action, action))}
                >
                  {active ? settingsCopy.cancel : settingsCopy.change}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" role="status">
          {capturingPad ? settingsCopy.buttonCaptureStatus(ACTION_LABELS[capturingPad]) : ''}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="chip"
            aria-label={settingsCopy.resetControllerLabel}
            disabled={padIsDefault}
            onClick={() => {
              padCapture.cancel();
              setPadBindings(padDefaults);
            }}
          >
            {settingsCopy.reset}
          </button>
        </div>
        <p className="fine-print settings-note">
          {settingsCopy.padNoteLead}
          <em>{settingsCopy.padNoteEm}</em>
          {settingsCopy.padNoteTail}
        </p>
      </section>

      <section className="settings-section" aria-labelledby="settings-comfort">
        <h2 id="settings-comfort">{settingsCopy.comfortHeading}</h2>
        <ComfortToggles value={comfort} onChange={setComfort} />
      </section>

      <section className="settings-section" aria-labelledby="settings-difficulty">
        <h2 id="settings-difficulty">{settingsCopy.difficultyHeading}</h2>
        <AssistControl lives={assist.lives} confirmed={assist.confirmed} onChange={assist.setLives} />
      </section>

      {/* Only once she has actually beaten them. A message that can be read
          only by beating a boss again is the wrong shape for what it is
          (playtest 7) — but offering it before she has earned it would spoil
          the one beat the whole ending is built to protect. */}
      {progress.finaleBossCleared && (
        <section className="settings-section" aria-labelledby="settings-ending">
          <h2 id="settings-ending">{settingsCopy.endingHeading}</h2>
          <div className="btn-row">
            <Link className="chip" to="/the-end">
              {theEndCopy.settingsReadAgain}
            </Link>
          </div>
          <p className="fine-print settings-note">{theEndCopy.settingsReadAgainNote}</p>
        </section>
      )}

      <section className="settings-section" aria-labelledby="settings-progress">
        <h2 id="settings-progress">{settingsCopy.progressHeading}</h2>
        {resetStage === 'idle' && (
          <div className="btn-row">
            <button
              ref={resetButtonRef}
              type="button"
              className="chip"
              onClick={() => setResetStage('confirm')}
            >
              {settingsCopy.resetProgress}
            </button>
          </div>
        )}
        {resetStage === 'confirm' && (
          <div ref={confirmRef} className="settings-confirm" tabIndex={-1}>
            <p>{settingsCopy.resetConfirm}</p>
            <div className="btn-row">
              <button type="button" className="button" onClick={resetProgress}>
                {settingsCopy.resetYes}
              </button>
              <button type="button" className="chip" onClick={() => setResetStage('idle')}>
                {settingsCopy.resetNo}
              </button>
            </div>
          </div>
        )}
        {/* Always rendered (settings.css keeps it zero-height while empty), so the
            status region exists before its text arrives and the announcement is reliable. */}
        <p ref={doneRef} className="settings-done" role="status" tabIndex={-1}>
          {resetStage === 'cleared' ? settingsCopy.resetDone : ''}
        </p>
      </section>

      {/* DEV TOOL: remove in the final build */}
      <details className="dev-tools">
        <summary>Dev tools — remove in the final build</summary>
        <div role="group" aria-label="Dev tools">
          <label className="observe-toggle">
            <input
              type="checkbox"
              checked={godMode}
              onChange={(e) => setGodMode(e.target.checked)}
            />
            God mode — nothing can touch you
          </label>
          <p className="fine-print settings-note">
            Every hit still flashes and still counts on the HUD, so you can see what would have got
            you — it just does not end the run. Runs played with it on never become a personal best.
          </p>

          <fieldset className="roll-variants">
            <legend>The dog’s roll — five to try</legend>
            {ROLL_VARIANTS.map((variant, i) => (
              <label key={variant.name} className="roll-variant">
                <input
                  type="radio"
                  name="roll-variant"
                  checked={rollVariant === i}
                  onChange={() => setRollVariant(i)}
                />
                <span>
                  <strong>{variant.name}</strong>
                  <span className="fine-print">{variant.feel}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="fine-print settings-note">
            Fight the Two Bills with each one and pick a favourite. They all alternate between a hop
            you can run under and a skitter you cannot — what changes is the pace, the rhythm and
            how long you get to decide.
          </p>

          <fieldset className="roll-variants">
            <legend>The entrances — three to try</legend>
            {BILL_ENTRANCES.map((variant, i) => (
              <label key={variant.name} className="roll-variant">
                <input
                  type="radio"
                  name="entrance-variant"
                  checked={entranceVariant === i}
                  onChange={() => setEntranceVariant(i)}
                />
                <span>
                  <strong>{variant.name}</strong>
                  <span className="fine-print">{variant.feel}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="fine-print settings-note">
            Each one covers BOTH Bills: how many footfalls you hear before the man arrives and how
            he crosses the ground, and then at 0:30 how quickly he calls for help, how long the
            barking takes to answer and how the dog comes in. Hold jump during either to run it at
            2.5×.
          </p>

          <fieldset className="roll-variants">
            <legend>The dog’s ball and bones — three to try</legend>
            {DOG_LOOKS.map((variant, i) => (
              <label key={variant.name} className="roll-variant">
                <input
                  type="radio"
                  name="dog-look"
                  checked={dogLook === i}
                  onChange={() => setDogLook(i)}
                />
                <span>
                  <strong>{variant.name}</strong>
                  <span className="fine-print">{variant.feel}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="fine-print settings-note">
            The ball’s pale “safe on top” cap is gone — it is lethal everywhere now — so it needs a
            marker that says so. All three use the dark ring the red hazard orbs already wear in
            Bounce Bog. “Stepped” also tumbles the bones in whole frames instead of spinning them
            smoothly, which is the rule the rest of the Bills are held to.
          </p>
        </div>
      </details>
    </div>
  );
}
