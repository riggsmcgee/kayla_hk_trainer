/**
 * Which hand Kayla is actually using, so the copy on screen can name the
 * button she just pressed.
 *
 * This is a DISPLAY SIGNAL, NOT A MODE, and the distinction is ratified.
 * `mergeInput` ORs the keyboard and the pad frames every step, and a source
 * sitting idle contributes nothing, so plugging a pad in can never take the
 * keyboard away. Provenance is destroyed at exactly that point — by the time
 * a session sees an InputFrame there is no way to ask where it came from —
 * which is why the answer has to be recorded one step earlier, here, and why
 * nothing downstream is allowed to branch on it except words.
 *
 * The value is a module-level signal rather than React state because its
 * main reader is a canvas overlay drawn 60 times a second, which must be
 * able to ask without causing a render. `storage/useInputSource.ts` is the
 * React view of the same signal, for page copy.
 */
import type { InputFrame } from './types';

export type InputSource = 'keyboard' | 'gamepad';

/** Did this frame carry anything at all? Held state counts: she is holding it. */
function isLive(frame: InputFrame): boolean {
  return (
    frame.left ||
    frame.right ||
    frame.up ||
    frame.down ||
    frame.jumpHeld ||
    frame.jumpPressed ||
    frame.attackPressed ||
    frame.dashPressed
  );
}

/**
 * Which source this step belongs to, or null when neither moved — null means
 * "no news", so a still moment never rewrites the answer.
 *
 * The PAD wins when both are live. That case is her hand brushing a key
 * while the board is in her lap, not a deliberate two-handed input, and the
 * failure it protects against is the one she reported: playing on the pad
 * and being told to press X.
 */
export function sourceOf(keyboard: InputFrame, pad: InputFrame): InputSource | null {
  if (isLive(pad)) return 'gamepad';
  if (isLive(keyboard)) return 'keyboard';
  return null;
}

/** Keyboard until proven otherwise: it is the one board every visitor has. */
let last: InputSource = 'keyboard';
const listeners = new Set<() => void>();

/** Feed one step's two raw frames. Cheap enough to call every step. */
export function noteInputSource(keyboard: InputFrame, pad: InputFrame): void {
  const source = sourceOf(keyboard, pad);
  // Only a CHANGE is worth telling anyone about: this runs at 60 Hz.
  if (source === null || source === last) return;
  last = source;
  for (const listener of listeners) listener();
}

/** The last source that did something. Safe to call at draw time. */
export function lastInputSource(): InputSource {
  return last;
}

export function subscribeInputSource(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
