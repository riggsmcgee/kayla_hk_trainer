import { describe, expect, it } from 'vitest';
import { formatClock } from './clock';

describe('formatClock', () => {
  it('reads m:ss with a zero-padded seconds field', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(600)).toBe('10:00');
  });

  it('floors a partial second rather than rounding it up', () => {
    // A stage clock that showed 1:00 at 59.6 s would let a 60 s stage read as
    // finished before it was; the arena HUD depends on the floor.
    expect(formatClock(59.9)).toBe('0:59');
    expect(formatClock(0.999)).toBe('0:00');
  });
});
