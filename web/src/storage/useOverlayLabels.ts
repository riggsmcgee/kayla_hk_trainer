/**
 * The two label functions every session's in-canvas overlays call at DRAW
 * time — "Press X to face them again", "hold Z to hurry".
 *
 * Both close over her bindings and ask `lastInputSource()` at the moment
 * they are called, which is the only shape that lets the copy follow the
 * board she is holding WITHOUT the session being rebuilt. Rebuilding a
 * session restarts her run, and picking up the pad mid-fight must not cost
 * her the fight.
 *
 * The two identities are stable for as long as her bindings are, and that
 * matters: these are dependencies of a session factory, so a fresh pair of
 * functions on every render would rebuild the game on every render.
 */
import { useMemo } from 'react';
import { lastInputSource } from '../engine/inputSource';
import { attackLabel, jumpLabel } from './keyNames';
import { useBindings } from './useBindings';
import { useGamepadBindings } from './useGamepadBindings';

export interface OverlayLabels {
  /** The forward control, named for whichever board she last touched. */
  jumpKey: () => string;
  /** The again control, same rule. */
  attackKey: () => string;
}

export function useOverlayLabels(): OverlayLabels {
  const [bindings] = useBindings();
  const [padBindings] = useGamepadBindings();
  return useMemo(
    () => ({
      jumpKey: () => jumpLabel(bindings, padBindings, lastInputSource()),
      attackKey: () => attackLabel(bindings, padBindings, lastInputSource()),
    }),
    [bindings, padBindings],
  );
}
