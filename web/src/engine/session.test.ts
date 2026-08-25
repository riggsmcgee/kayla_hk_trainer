import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { OVERLAY_LOCKOUT_SECONDS, tickDown } from './session';

describe('tickDown', () => {
  it('lands a whole-step countdown on exactly zero', () => {
    // 0.35 s is 21 steps of 1/60. Subtracting dt twenty-one times leaves a
    // float residue, and a `> 0` test on that residue costs a whole step.
    let left = OVERLAY_LOCKOUT_SECONDS;
    const steps = Math.round(OVERLAY_LOCKOUT_SECONDS / FIXED_DT);
    for (let i = 0; i < steps; i++) left = tickDown(left, FIXED_DT);
    expect(left).toBe(0);
  });

  it('is still counting one step before the end', () => {
    let left = OVERLAY_LOCKOUT_SECONDS;
    const steps = Math.round(OVERLAY_LOCKOUT_SECONDS / FIXED_DT);
    for (let i = 0; i < steps - 1; i++) left = tickDown(left, FIXED_DT);
    expect(left).toBeGreaterThan(0);
  });

  it('never goes negative', () => {
    expect(tickDown(0, FIXED_DT)).toBe(0);
    expect(tickDown(0.001, FIXED_DT)).toBe(0);
  });
});
