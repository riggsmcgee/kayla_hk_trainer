/**
 * Assist mode's row on the bench: Off · 1 · 2 · 3, and the one-time panel
 * that asks whether she is sure.
 *
 * The confirm is *pre*-action, unlike the Reset Progress one it is modelled
 * on: the pending value is held while she decides, and only applied if she
 * says yes. Saying no leaves the setting exactly where it was, which is the
 * behaviour a warning should have — it is a question, not a trap.
 *
 * It fires once ever. `assistConfirmed` lives in settings, and settings
 * survive `clearAllProgress()`, so resetting the map does not re-ask a
 * question she has already answered.
 */
import { useEffect, useRef, useState } from 'react';
import { settingsCopy } from '../copy/settings';
import { MAX_ASSIST_LIVES } from '../storage/useAssistMode';

interface AssistControlProps {
  lives: number;
  confirmed: boolean;
  onChange(next: number, confirm?: boolean): void;
}

const CHOICES = [0, 1, 2, 3];

export function AssistControl({ lives, confirmed, onChange }: AssistControlProps) {
  /** The value she has asked for but not yet confirmed; null when nothing is pending. */
  const [pending, setPending] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasAsking = useRef(false);

  // Move focus onto the panel when it appears, and never onto the affirmative
  // button — the same rule the reset flow follows.
  useEffect(() => {
    const asking = pending !== null;
    if (asking && !wasAsking.current) panelRef.current?.focus();
    wasAsking.current = asking;
  }, [pending]);

  const pick = (next: number): void => {
    // Only the first move AWAY from Off is worth a warning. Turning it back
    // off, or changing between 1 and 3 once she has accepted it, is not.
    if (next > 0 && !confirmed) {
      setPending(next);
      return;
    }
    onChange(next);
  };

  return (
    <>
      <fieldset className="difficulty-choices">
        <legend>{settingsCopy.assistLabel}</legend>
        {CHOICES.map((n) => (
          <label key={n} className="difficulty-choice">
            <input
              type="radio"
              name="assist-lives"
              checked={lives === n}
              onChange={() => pick(n)}
            />
            <span>{n === 0 ? settingsCopy.assistOff : settingsCopy.assistLives(n)}</span>
          </label>
        ))}
      </fieldset>
      <p className="fine-print settings-note">{settingsCopy.assistNote}</p>

      {pending !== null && (
        <div ref={panelRef} className="settings-confirm" tabIndex={-1}>
          <p>
            <strong>{settingsCopy.assistConfirmTitle}</strong>
          </p>
          <p>{settingsCopy.assistConfirmBody}</p>
          <div className="btn-row">
            <button
              type="button"
              className="button"
              onClick={() => {
                onChange(pending, true);
                setPending(null);
              }}
            >
              {settingsCopy.assistYes}
            </button>
            <button type="button" className="chip" onClick={() => setPending(null)}>
              {settingsCopy.assistNo}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export { MAX_ASSIST_LIVES };
