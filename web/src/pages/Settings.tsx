/**
 * The bench — Settings. Three compact sections: Controls (keyboard remap),
 * Comfort (the two toggles), Progress (reset). Not a chapter, so no gate
 * and no strip. The real controllers get their check-and-remap here in M7.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ComfortToggles } from '../components/ComfortToggles';
import { theEndCopy } from '../copy/theEnd';
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  bindingsToSettings,
  rebind,
  type Action,
} from '../engine/input';
import {
  DEFAULT_GAMEPAD_BINDINGS,
  buttonName,
  connectedPads,
  pressedButton,
  readGamepads,
  rebindButton,
  type ConnectedPad,
} from '../engine/gamepad';
import { friendlyKeyName } from '../storage/keyNames';
import { useGamepadBindings } from '../storage/useGamepadBindings';
import { useBindings } from '../storage/useBindings';
import { notifyProgressChanged, progressStore, useProgress } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { useGodMode } from '../storage/useGodMode';
import { useRollVariant } from '../storage/useRollVariant';
import { useEntranceVariant } from '../storage/useEntranceVariant';
import { useDogLook } from '../storage/useDogLook';
import { ROLL_VARIANTS } from '../engine/enemies';
import { BILL_ENTRANCES } from '../engine/entrance';
import { DOG_LOOKS } from '../engine/dogLook';
import { captureVerdict } from './settings.helpers';
import '../styles/settings.css';

const ACTION_LABELS: Record<Action, string> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Up',
  down: 'Down',
  jump: 'Jump',
  attack: 'Attack',
  dash: 'Dash',
};

const DEFAULT_STORED = JSON.stringify(bindingsToSettings(DEFAULT_BINDINGS));
const DEFAULT_PAD_STORED = JSON.stringify(DEFAULT_GAMEPAD_BINDINGS);

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
  const [rollVariant, setRollVariant] = useRollVariant();
  const [entranceVariant, setEntranceVariant] = useEntranceVariant();
  const [dogLook, setDogLook] = useDogLook();
  const [padBindings, setPadBindings] = useGamepadBindings();
  const [pads, setPads] = useState<ConnectedPad[]>([]);
  const [capturing, setCapturing] = useState<Action | null>(null);
  const [capturingPad, setCapturingPad] = useState<Action | null>(null);
  const [resetStage, setResetStage] = useState<ResetStage>('idle');

  // Capture state: the next keydown becomes that action's only key. Which
  // keys are taken, refused or cancel is settings.helpers.ts (captureVerdict);
  // a refused key is never prevented, so F5 still reloads and Ctrl+R is Ctrl+R.
  useEffect(() => {
    if (capturing === null) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const verdict = captureVerdict(e);
      if (verdict === 'ignore') return;
      if (verdict === 'cancel') {
        // Tab is left alone so the browser moves her focus on out of here.
        if (e.code !== 'Tab') e.preventDefault();
        setCapturing(null);
        return;
      }
      // Taken: prevent the default, or a Space/Enter would also click the
      // focused Cancel button and start the capture over.
      e.preventDefault();
      setBindings(rebind(bindings, capturing, e.code));
      setCapturing(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [capturing, bindings, setBindings]);

  // Which pads are here, refreshed on a timer. A pad stays invisible to the
  // browser until she presses something on it, so this is also what turns
  // "no controller found" into her controller's name the moment she does.
  useEffect(() => {
    const poll = (): void => setPads(connectedPads());
    poll();
    const timer = window.setInterval(poll, PAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Capture: the next button held on any pad becomes that action's only
  // button. Same shape as the keyboard capture above, but polled rather than
  // evented, because that is the only way the Gamepad API can be read.
  useEffect(() => {
    if (capturingPad === null) return;
    const timer = window.setInterval(() => {
      const index = pressedButton(readGamepads());
      if (index === null) return;
      setPadBindings(rebindButton(padBindings, capturingPad, index));
      setCapturingPad(null);
    }, PAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [capturingPad, padBindings, setPadBindings]);

  const isDefault = JSON.stringify(bindingsToSettings(bindings)) === DEFAULT_STORED;
  const padIsDefault = JSON.stringify(padBindings) === DEFAULT_PAD_STORED;

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
      <p className="eyebrow">The bench</p>
      <h1>Settings</h1>
      <p className="lede">Your keys, your comfort, your clean slate, Kayla.</p>

      <section className="settings-section" aria-labelledby="settings-controls">
        <h2 id="settings-controls">Controls</h2>
        <ul className="binding-list">
          {ACTIONS.map((action) => {
            const active = capturing === action;
            return (
              <li key={action} className={active ? 'binding-row is-capturing' : 'binding-row'}>
                <span className="binding-action">{ACTION_LABELS[action]}</span>
                <span className="binding-keys">
                  {active ? (
                    <span className="binding-prompt">press a key… (Esc cancels)</span>
                  ) : bindings[action].length === 0 ? (
                    <span className="binding-prompt">no key</span>
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
                      ? `Cancel changing key for ${ACTION_LABELS[action]}`
                      : `Change key for ${ACTION_LABELS[action]}`
                  }
                  onClick={() => setCapturing(active ? null : action)}
                >
                  {active ? 'Cancel' : 'Change'}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" role="status">
          {capturing ? `Press a key for ${ACTION_LABELS[capturing]}. Escape cancels.` : ''}
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
            aria-label="Reset to defaults for keyboard controls"
            disabled={isDefault}
            onClick={() => {
              setCapturing(null);
              setBindings(DEFAULT_BINDINGS);
            }}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-controller">
        <h2 id="settings-controller">Controller</h2>
        {pads.length === 0 ? (
          <p className="settings-note">
            No controller yet. Plug it in and <strong>press any button on it</strong> — browsers
            keep a controller hidden until you do, so pressing a button is what wakes it up.
          </p>
        ) : (
          <ul className="pad-list">
            {pads.map((padInfo, i) => (
              <li key={`${padInfo.id}-${i}`} className="pad-row">
                <span className="pad-name">{padInfo.id}</span>
                {!padInfo.standard && (
                  <span className="fine-print">
                    — your browser could not match this to a standard layout, so the buttons below
                    may sit in odd places. Re-map the ones that are wrong.
                  </span>
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
                    <span className="binding-prompt">press a button…</span>
                  ) : padBindings[action].length === 0 ? (
                    <span className="binding-prompt">no button</span>
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
                      ? `Cancel changing button for ${ACTION_LABELS[action]}`
                      : `Change button for ${ACTION_LABELS[action]}`
                  }
                  onClick={() => setCapturingPad(active ? null : action)}
                >
                  {active ? 'Cancel' : 'Change'}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" role="status">
          {capturingPad ? `Press a button for ${ACTION_LABELS[capturingPad]}.` : ''}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="chip"
            aria-label="Reset to defaults for controller buttons"
            disabled={padIsDefault}
            onClick={() => {
              setCapturingPad(null);
              setPadBindings(DEFAULT_GAMEPAD_BINDINGS);
            }}
          >
            Reset to defaults
          </button>
        </div>
        <p className="fine-print settings-note">
          Buttons are named by <em>where they are</em>, not by the letter printed on them — every
          controller disagrees about the letters, and none of them disagree about the positions. The
          keyboard keeps working the whole time; the controller is an extra pair of hands, not a
          replacement.
        </p>
      </section>

      <section className="settings-section" aria-labelledby="settings-comfort">
        <h2 id="settings-comfort">Comfort</h2>
        <ComfortToggles value={comfort} onChange={setComfort} />
      </section>

      {/* Only once she has actually beaten them. A message that can be read
          only by beating a boss again is the wrong shape for what it is
          (playtest 7) — but offering it before she has earned it would spoil
          the one beat the whole ending is built to protect. */}
      {progress.finaleBossCleared && (
        <section className="settings-section" aria-labelledby="settings-ending">
          <h2 id="settings-ending">The ending</h2>
          <div className="btn-row">
            <Link className="chip" to="/the-end">
              {theEndCopy.settingsReadAgain}
            </Link>
          </div>
          <p className="fine-print settings-note">{theEndCopy.settingsReadAgainNote}</p>
        </section>
      )}

      <section className="settings-section" aria-labelledby="settings-progress">
        <h2 id="settings-progress">Progress</h2>
        {resetStage === 'idle' && (
          <div className="btn-row">
            <button
              ref={resetButtonRef}
              type="button"
              className="chip"
              onClick={() => setResetStage('confirm')}
            >
              Reset my progress
            </button>
          </div>
        )}
        {resetStage === 'confirm' && (
          <div ref={confirmRef} className="settings-confirm" tabIndex={-1}>
            <p>This clears every cleared level, enemy and run. Sure?</p>
            <div className="btn-row">
              <button type="button" className="button" onClick={resetProgress}>
                Yes
              </button>
              <button type="button" className="chip" onClick={() => setResetStage('idle')}>
                No
              </button>
            </div>
          </div>
        )}
        {/* Always rendered (settings.css keeps it zero-height while empty), so the
            status region exists before its text arrives and the announcement is reliable. */}
        <p ref={doneRef} className="settings-done" role="status" tabIndex={-1}>
          {resetStage === 'cleared' ? 'Cleared. The map starts at Dirtmouth again.' : ''}
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
