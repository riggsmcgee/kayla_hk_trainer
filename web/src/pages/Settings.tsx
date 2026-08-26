/**
 * The bench — Settings. Three compact sections: Controls (keyboard remap),
 * Comfort (the two toggles), Progress (reset). Not a chapter, so no gate
 * and no strip. The real controllers get their check-and-remap here in M7.
 */
import { useEffect, useRef, useState } from 'react';
import { ComfortToggles } from '../components/ComfortToggles';
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  bindingsToSettings,
  rebind,
  type Action,
} from '../engine/input';
import { friendlyKeyName } from '../storage/keyNames';
import { useBindings } from '../storage/useBindings';
import { notifyProgressChanged, progressStore } from '../storage/useChapterProgress';
import { useComfortSettings } from '../storage/useComfortSettings';
import { useGodMode } from '../storage/useGodMode';
import { useRollVariant } from '../storage/useRollVariant';
import { useEntranceVariant } from '../storage/useEntranceVariant';
import { ROLL_VARIANTS } from '../engine/enemies';
import { BILL_ENTRANCES } from '../engine/entrance';
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

type ResetStage = 'idle' | 'confirm' | 'cleared';

export function Settings() {
  const [bindings, setBindings] = useBindings();
  const [comfort, setComfort] = useComfortSettings();
  const [godMode, setGodMode] = useGodMode();
  const [rollVariant, setRollVariant] = useRollVariant();
  const [entranceVariant, setEntranceVariant] = useEntranceVariant();
  const [capturing, setCapturing] = useState<Action | null>(null);
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

  const isDefault = JSON.stringify(bindingsToSettings(bindings)) === DEFAULT_STORED;

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
          <button
            type="button"
            className="chip"
            disabled={isDefault}
            onClick={() => {
              setCapturing(null);
              setBindings(DEFAULT_BINDINGS);
            }}
          >
            Reset to defaults
          </button>
        </div>
        <p className="fine-print settings-note">
          The real controllers get their own check-and-remap here once we plug them in.
        </p>
      </section>

      <section className="settings-section" aria-labelledby="settings-comfort">
        <h2 id="settings-comfort">Comfort</h2>
        <ComfortToggles value={comfort} onChange={setComfort} />
      </section>

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
            <legend>Bill’s entrance — three to try</legend>
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
            All three open on an empty arena and bring him in from the right; what changes is how
            many footfalls you hear coming and how he crosses the ground. Hold jump during any of
            them to run it at 2.5×.
          </p>
        </div>
      </details>
    </div>
  );
}
