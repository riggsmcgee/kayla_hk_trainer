import { describe, expect, it } from 'vitest';
import { CANVAS, ENEMIES, FIXED_DT, PHYSICS, SIM_HZ, UNIT_PX } from './constants';

describe('engine constants sanity', () => {
  it('uses a positive px-per-unit scale and a 60 Hz fixed step', () => {
    expect(UNIT_PX).toBeGreaterThan(0);
    expect(SIM_HZ).toBe(60);
    expect(FIXED_DT).toBeCloseTo(1 / 60, 10);
    expect(CANVAS.width).toBeGreaterThan(0);
    expect(CANVAS.height).toBeGreaterThan(0);
  });

  it('has physically sane movement values', () => {
    expect(PHYSICS.gravity).toBeGreaterThan(0);
    expect(PHYSICS.runSpeed).toBeGreaterThan(0);
    expect(PHYSICS.jumpVelocity).toBeGreaterThan(0);
    expect(PHYSICS.maxFallSpeed).toBeGreaterThan(0);
    expect(PHYSICS.dashSpeed).toBeGreaterThan(PHYSICS.runSpeed);
    expect(PHYSICS.jumpHoldMin).toBeLessThanOrEqual(PHYSICS.jumpHoldMax);
  });

  it('has a usable pogo and nail', () => {
    expect(PHYSICS.pogoVelocity).toBeGreaterThan(0);
    expect(PHYSICS.pogoTime).toBeGreaterThan(0);
    expect(PHYSICS.nailReachDown).toBeGreaterThan(0);
    expect(PHYSICS.nailDamage).toBeGreaterThan(0);
    // A pogo rise (velocity × pinned time) should be meaningfully smaller
    // than a full jump's pinned rise — it's ~half a jump in HK.
    expect(PHYSICS.pogoVelocity * PHYSICS.pogoTime).toBeLessThan(
      PHYSICS.jumpVelocity * PHYSICS.jumpHoldMax + PHYSICS.jumpVelocity ** 2 / (2 * PHYSICS.gravity),
    );
  });

  it('gives every rostered enemy positive hp and standard contact damage', () => {
    for (const tuning of Object.values(ENEMIES)) {
      expect(tuning.hp).toBeGreaterThan(0);
      expect(tuning.damage).toBe(1);
    }
    expect(Object.keys(ENEMIES).sort()).toEqual(
      ['duelist', 'flier', 'spitter', 'walker', 'warden'].sort(),
    );
  });
});
