/**
 * The Setup sandbox, driven the way the loop drives it.
 *
 * `setupChecks.test.ts` pins the rules in isolation. This file pins the thing
 * only a running session can be wrong about: whether a real Knight, on a real
 * floor, under real physics, actually earns the checks the rules describe.
 *
 * The one with teeth is the down-slash. It is the item that proves the pogo,
 * it can only be earned in the air, and it depends on the sandbox reading
 * `grounded` BEFORE the step rather than after — an ordering bug there would
 * leave the item unearnable and no unit test of the rules would notice.
 *
 * It also pins what the sandbox must NOT do: nothing here may hurt her, score
 * her, or end.
 */
import { describe, expect, it } from 'vitest';
import type { SetupCheck } from '@dojo/shared';
import { FIXED_DT } from './constants';
import { SETUP_CHECKS, setupChecksComplete } from './setupChecks';
import { createSetupSandbox } from './setupSandboxSession';
import type { InputFrame } from './types';

function idle(over: Partial<InputFrame> = {}): InputFrame {
  return {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    up: false,
    down: false,
    dashPressed: false,
    ...over,
  };
}

/** A sandbox plus the sheet it fills in, so a test can read what was earned. */
function sandbox(alreadyDone: SetupCheck[] = []) {
  const earned = new Set<SetupCheck>(alreadyDone);
  const session = createSetupSandbox({
    alreadyDone: new Set(alreadyDone),
    onEarned: (checks) => {
      for (const check of checks) earned.add(check);
    },
  });
  const press = (input: InputFrame, steps = 1): void => {
    for (let i = 0; i < steps; i++) session.step(input, FIXED_DT);
  };
  return { session, earned, press };
}

describe('what she can earn on a bare floor', () => {
  it('earns the walk from walking', () => {
    const { earned, press } = sandbox();
    press(idle({ right: true }), 10);
    press(idle({ left: true }), 10);
    expect(earned.has('right')).toBe(true);
    expect(earned.has('left')).toBe(true);
  });

  it('earns the jump only once she actually leaves the ground', () => {
    const { earned, press } = sandbox();
    press(idle(), 5); // settle onto the floor
    press(idle({ jumpPressed: true, jumpHeld: true }));
    expect(earned.has('jump')).toBe(true);
  });

  it('earns the side slash standing still', () => {
    const { earned, press } = sandbox();
    press(idle(), 5);
    press(idle({ attackPressed: true }));
    expect(earned.has('slashSide')).toBe(true);
    expect(earned.has('slashDown')).toBe(false);
  });

  it('earns the up slash from holding up as she swings', () => {
    const { earned, press } = sandbox();
    press(idle(), 5);
    press(idle({ attackPressed: true, up: true }));
    expect(earned.has('slashUp')).toBe(true);
  });

  it('earns the down slash only in the air, which is what proves the pogo', () => {
    // The compound press the whole first pillar rests on: jump, then down and
    // attack together before she lands. If the sandbox read `grounded` after
    // the step instead of before, a swing thrown on the way down would be
    // recorded as a side slash and this item could never be earned at all.
    const { earned, press } = sandbox();
    press(idle(), 5);
    press(idle({ attackPressed: true, down: true }));
    expect(earned.has('slashDown')).toBe(false); // still on the floor

    // The nail has a cadence; a second swing inside it never comes out, so the
    // sheet would stay unfilled for a reason that has nothing to do with her.
    press(idle(), 30);
    press(idle({ jumpPressed: true, jumpHeld: true }));
    press(idle({ jumpHeld: true }), 6); // well clear of the ground
    press(idle({ jumpHeld: true, attackPressed: true, down: true }));
    expect(earned.has('slashDown')).toBe(true);
  });

  it('can fill the whole sheet, which is the gate’s only requirement', () => {
    const { earned, press } = sandbox();
    press(idle({ right: true }), 5);
    press(idle({ left: true }), 5);
    press(idle({ dashPressed: true }));
    press(idle(), 30); // let the dash end and land
    press(idle({ attackPressed: true }));
    press(idle(), 30); // the nail's 0.41 s cadence, between every swing
    press(idle({ attackPressed: true, up: true }));
    press(idle(), 30);
    press(idle({ jumpPressed: true, jumpHeld: true }));
    press(idle({ jumpHeld: true }), 6);
    press(idle({ jumpHeld: true, attackPressed: true, down: true }));
    expect(setupChecksComplete(earned)).toBe(true);
  });

  it('never re-earns something she has already done', () => {
    // The page saves on every tick. Re-earning would write to localStorage
    // sixty times a second for as long as she holds a direction.
    const seen: SetupCheck[][] = [];
    const session = createSetupSandbox({
      alreadyDone: new Set<SetupCheck>(['right']),
      onEarned: (checks) => seen.push([...checks]),
    });
    for (let i = 0; i < 30; i++) session.step(idle({ right: true }), FIXED_DT);
    expect(seen).toEqual([]);
  });
});

describe('what the sandbox deliberately has not got', () => {
  it('has no pass and no fail — it just keeps stepping', () => {
    // "Just a bare floor." Every other canvas on the site is scored, timed or
    // lethal; this one has no state a caller could even read to end it.
    const { session } = sandbox();
    for (let i = 0; i < 600; i++) session.step(idle({ right: true }), FIXED_DT);
    expect(Object.keys(session).sort()).toEqual(['render', 'step']);
  });

  it('earns nothing at all from being left alone', () => {
    // Ten seconds of nobody touching the controller must not tick a box, or
    // the checklist stops being evidence of anything.
    const { earned, press } = sandbox();
    press(idle(), 600);
    expect(earned.size).toBe(0);
    expect(SETUP_CHECKS.some((c) => earned.has(c))).toBe(false);
  });
});
