/**
 * "Press the thing you want this to be."
 *
 * One capture, listening to both hands at once. The keyboard is evented and
 * the pad has to be polled — that difference is the whole reason the two used
 * to be written out separately on the Settings page, once per section — but to
 * her they are one question with one answer, and on the sandbox floor the
 * answer is whichever control she reaches for. First press wins and the
 * capture closes.
 *
 * `accept` exists because Settings asks the narrower question deliberately:
 * its Controls section is the keyboard's and its Controller section is the
 * pad's, and a key pressed while she is looking at the pad's list would be a
 * surprise. The sandbox asks the wide one.
 *
 * WHAT THIS DOES NOT DO is stop the game from also acting on the press. That
 * is `PracticeCanvas`'s `inputPaused`, and a caller with a canvas on screen
 * must wire it — the keyboard adapter ignores keys pressed while a button has
 * focus, so the keyboard half is usually covered by accident, and nothing
 * anywhere ignores a gamepad.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '../engine/input';
import { pressedButton, readGamepads } from '../engine/gamepad';
import { captureVerdict } from '../pages/settings.helpers';

/** What she pressed: a physical key position, or a pad button index. */
export type CapturedControl = { kind: 'key'; code: string } | { kind: 'button'; index: number };

/** Which hands this capture is willing to hear from. */
export type CaptureAccepts = 'key' | 'button' | 'either';

export interface ControlCapture {
  /**
   * The id of the control waiting, or null when nothing is capturing.
   *
   * An id and not the action, because the same action can appear on more than
   * one row: Attack is on all three nail rows of the practice floor, and keying
   * the capture by the action put all three of them into the capture state at
   * once. The caller decides what an id means; the floor uses "check:action"
   * and the bench uses the action, which is unique there.
   */
  capturing: string | null;
  /** The action the open capture will bind, or null. */
  capturingAction: Action | null;
  start(id: string, action: Action): void;
  cancel(): void;
}

/**
 * How often an open capture looks at the pad.
 *
 * The Gamepad API cannot be evented for this — there is no "button went down"
 * — so a capture polls. Six times a second reads as instant to a finger and is
 * nothing next to the 60 Hz the game itself runs at.
 */
const POLL_MS = 160;

export function useControlCapture(
  onCaptured: (action: Action, control: CapturedControl) => void,
  accept: CaptureAccepts = 'either',
): ControlCapture {
  const [open, setOpen] = useState<{ id: string; action: Action } | null>(null);

  // The callback almost always closes over the current bindings, which change
  // on every capture. Held in a ref so that does not tear the listeners down
  // and rebuild them underneath a finger that is already moving.
  const handler = useRef(onCaptured);
  handler.current = onCaptured;

  useEffect(() => {
    if (open === null) return;
    const { action } = open;
    /**
     * One capture, one binding, even if two presses land before React unwinds.
     *
     * Clearing the state does not tear this effect down synchronously — the
     * listener is still attached and the interval still scheduled until the
     * re-render commits. Two pad polls inside one frame, or two keys down in the
     * same tick, would otherwise rebind twice: the second one wins, and it is a
     * key she never meant to assign.
     */
    let taken = false;
    const finish = (control: CapturedControl): void => {
      if (taken) return;
      taken = true;
      setOpen(null);
      handler.current(action, control);
    };

    let detachKey: (() => void) | undefined;
    if (accept !== 'button') {
      const onKeyDown = (e: KeyboardEvent): void => {
        if (e.repeat) return;
        // Which keys are taken, refused, or cancel is settings.helpers.ts. A
        // refused key is never prevented, so F5 still reloads.
        const verdict = captureVerdict(e);
        if (verdict === 'ignore') return;
        if (verdict === 'cancel') {
          // Tab is left alone so the browser moves her focus on out of here.
          if (e.code !== 'Tab') e.preventDefault();
          setOpen(null);
          return;
        }
        // Taken: prevented, or Space and Enter would also re-click the button
        // she pressed to open the capture and start it over.
        e.preventDefault();
        finish({ kind: 'key', code: e.code });
      };
      window.addEventListener('keydown', onKeyDown);
      detachKey = () => window.removeEventListener('keydown', onKeyDown);
    }

    let timer: number | undefined;
    if (accept !== 'key') {
      timer = window.setInterval(() => {
        const index = pressedButton(readGamepads());
        if (index === null) return;
        finish({ kind: 'button', index });
      }, POLL_MS);
    }

    return () => {
      detachKey?.();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [open, accept]);

  const start = useCallback((id: string, action: Action) => setOpen({ id, action }), []);
  const cancel = useCallback(() => setOpen(null), []);

  return {
    capturing: open?.id ?? null,
    capturingAction: open?.action ?? null,
    start,
    cancel,
  };
}
