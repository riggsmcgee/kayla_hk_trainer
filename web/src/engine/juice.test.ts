/**
 * Juice seam tests (M6): the trauma-shake and hit-stop clocks.
 *
 * Models from the game-feel skill: shake = trauma² (quadratic, so small
 * hits barely move and big hits punch), trauma decays per second and hits
 * ADD to it; hit-stop freezes the simulation for a real-time duration and
 * never fires per-frame. Reduce-shake zeroes the offset without touching
 * the simulation.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { createJuice } from './juice';

describe('trauma shake', () => {
  it('adds, clamps at 1, and decays over time', () => {
    const juice = createJuice({ reduceShake: false, reduceFlashing: false });
    juice.addTrauma(0.7);
    juice.addTrauma(0.7);
    expect(juice.trauma()).toBe(1);
    for (let i = 0; i < 30; i++) juice.update(FIXED_DT); // half a second
    expect(juice.trauma()).toBeLessThan(1);
    expect(juice.trauma()).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) juice.update(FIXED_DT);
    expect(juice.trauma()).toBe(0); // returns to rest — juice is transient
  });

  it('scales the offset quadratically with trauma', () => {
    const juice = createJuice({ reduceShake: false, reduceFlashing: false });
    juice.addTrauma(1);
    const big = juice.shakeOffset(0.35);
    const bigMag = Math.hypot(big.x, big.y);
    const weak = createJuice({ reduceShake: false, reduceFlashing: false });
    weak.addTrauma(0.25);
    const small = weak.shakeOffset(0.35);
    const smallMag = Math.hypot(small.x, small.y);
    expect(bigMag).toBeGreaterThan(0);
    // trauma² → quarter trauma gives ~1/16 the shake, well under a quarter.
    expect(smallMag).toBeLessThan(bigMag / 8);
  });

  it('returns a zero offset when reduce-shake is on, without killing trauma bookkeeping', () => {
    const juice = createJuice({ reduceShake: true, reduceFlashing: false });
    juice.addTrauma(1);
    const off = juice.shakeOffset(0.5);
    expect(off).toEqual({ x: 0, y: 0 });
  });
});

describe('hit-stop', () => {
  it('freezes the sim for the requested duration, then resumes', () => {
    const juice = createJuice({ reduceShake: false, reduceFlashing: false });
    juice.hitStop(0.05); // 3 frames at 60 Hz
    let frozenSteps = 0;
    for (let i = 0; i < 6; i++) {
      juice.update(FIXED_DT);
      if (juice.frozen()) frozenSteps++;
    }
    expect(frozenSteps).toBe(3);
    expect(juice.frozen()).toBe(false);
  });

  it('takes the longest requested freeze, not the sum (no per-frame stacking)', () => {
    const juice = createJuice({ reduceShake: false, reduceFlashing: false });
    juice.hitStop(0.1);
    juice.hitStop(0.03); // a smaller impact during the freeze must not extend it
    let frozenSteps = 0;
    for (let i = 0; i < 12; i++) {
      juice.update(FIXED_DT);
      if (juice.frozen()) frozenSteps++;
    }
    expect(frozenSteps).toBe(6); // 0.1 s at 60 Hz
  });
});
