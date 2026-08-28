/**
 * The Setup sandbox's checklist — the seven things she has to be able to do.
 *
 * Playtest 8, note 5: "we should make sure that all the core functionalities
 * work and that she knows what she's supposed to be able to do." That is two
 * jobs in one sentence, and the checklist is how one control does both: it
 * PROVES the buttons work, and reading it is how she learns the whole kit
 * exists. The kit is deliberately small (PLAN §5) — jump, dash, and a nail
 * with three directions — so seven items covers all of it.
 *
 * The sandbox itself is "just a bare floor": nothing to bounce off, nothing to
 * fight, no pass and no fail. It is the one place on the site with neither.
 *
 * WHY THE DOWNSLASH IS THE ONE THAT MATTERS. The user's instinct — "no bounce
 * target, just check she can attack in all directions" — verifies the pogo for
 * free, and by a shorter route than the design would have taken. `nailDir` is
 * `'down'` ONLY when she is airborne, so ticking "slash down" is proof she
 * performed the compound mid-air press the whole first pillar rests on,
 * without the sandbox needing anything to bounce off.
 *
 * Nothing here knows what a canvas or a React component is: it is a fold over
 * input frames, which is what lets the whole checklist be tested in plain node.
 */

import type { SetupCheck } from '@dojo/shared';
import type { Action } from './input';
import { nailDirection } from './player';
import type { InputFrame } from './types';

/**
 * The seven, in the order the sandbox lists them: move, then jump, then dash,
 * then the three nail directions. Reading order is teaching order — she meets
 * the kit in the order the road will ask for it.
 */
export const SETUP_CHECKS: readonly SetupCheck[] = [
  'left',
  'right',
  'jump',
  'dash',
  'slashSide',
  'slashUp',
  'slashDown',
];

/**
 * Which controls each item actually needs, so a row can offer to rebind them.
 *
 * This is what lets the checklist answer "Jump doesn't work" on the spot
 * instead of sending her to Settings: the row knows that Jump is one control
 * and that a down-slash is two. The three nail rows all include `attack`
 * because a direction without a swing proves nothing — `earnedSetupChecks`
 * only reads a direction on a step where a swing actually started.
 *
 * Ordered so the control most likely to be the problem comes first: for the
 * two compound rows that is the DIRECTION, since attack has already been
 * proved by the sideways slash above them.
 */
export const SETUP_CHECK_ACTIONS: Readonly<Record<SetupCheck, readonly Action[]>> = Object.freeze({
  left: ['left'],
  right: ['right'],
  jump: ['jump'],
  dash: ['dash'],
  slashSide: ['attack'],
  slashUp: ['up', 'attack'],
  slashDown: ['down', 'attack'],
});

/** What the checklist needs to know about the Knight this step. */
export interface SetupCheckState {
  grounded: boolean;
  /** True on the step a swing actually starts, not while one is in flight. */
  swinging: boolean;
}

/**
 * Which checks this step earns, given what she pressed and where the Knight is.
 *
 * Returns only the NEWLY earned ones so a caller can react to each tick once —
 * a sound, a strike-through, a save — instead of diffing sets itself.
 *
 * The jump check wants a real jump rather than a press: holding the button in
 * mid-air is not the thing being proved, and a button that fires while she is
 * falling would tick the box on a controller that never left the ground.
 */
export function earnedSetupChecks(
  done: ReadonlySet<SetupCheck>,
  input: InputFrame,
  state: SetupCheckState,
): readonly SetupCheck[] {
  const earned: SetupCheck[] = [];
  const tick = (check: SetupCheck, when: boolean): void => {
    if (when && !done.has(check)) earned.push(check);
  };

  tick('left', input.left);
  tick('right', input.right);
  tick('jump', input.jumpPressed && state.grounded);
  tick('dash', input.dashPressed);

  // The three nail directions come from the GAME's own rule rather than from a
  // copy of it, so a checklist item can never tick for a swing the Knight
  // would have thrown in a different direction.
  if (state.swinging) {
    const dir = nailDirection(input, state.grounded);
    tick('slashSide', dir === 'side');
    tick('slashUp', dir === 'up');
    tick('slashDown', dir === 'down');
  }

  return earned;
}

/** True once every item is ticked. The gate reads this; nothing else does. */
export function setupChecksComplete(done: ReadonlySet<SetupCheck>): boolean {
  return SETUP_CHECKS.every((check) => done.has(check));
}
