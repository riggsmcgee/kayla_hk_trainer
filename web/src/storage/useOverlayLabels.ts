/**
 * The two label functions every session's in-canvas overlays call at DRAW
 * time — "Press Attack to face them again", "hold Jump to hurry".
 *
 * They are functions rather than plain strings, and that is worth keeping even
 * now that they answer with a constant. These are dependencies of a session
 * factory: a fresh pair of functions on every render would rebuild the game on
 * every render, and rebuilding a session restarts her run. Returning one frozen
 * object from module scope makes that impossible by construction — an identity
 * that cannot change is strictly safer than one memoised on her bindings, which
 * is what this hook used to do.
 *
 * Playtest 10 is why they no longer read the bindings at all. The overlays used
 * to name whichever input she had bound, which printed "the bottom button" on a
 * pad — meaningless on the leverless board he set her up with, where the face
 * buttons are not in a diamond. They now name the action, the same on every
 * board. See `copy/controls.ts`.
 */
import { controlNameCopy } from '../copy/controls';

export interface OverlayLabels {
  /** The forward control. */
  jumpKey: () => string;
  /** The again control. */
  attackKey: () => string;
}

/**
 * One frozen instance, created once. Every page shares it, so no page can
 * hand a session a callback identity that changes underneath a live run.
 */
const OVERLAY_LABELS: OverlayLabels = {
  jumpKey: () => controlNameCopy.jump,
  attackKey: () => controlNameCopy.attack,
};

export function useOverlayLabels(): OverlayLabels {
  return OVERLAY_LABELS;
}
