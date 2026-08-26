/**
 * Entrance timeline tests (playtest 4, note 4).
 *
 * Seam: the pure timeline. It says what is on screen and how far through the
 * beat is; the session turns that into shake and pixels. Everything ratified
 * about the entrance is a timing claim, so it can all be pinned here.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import {
  BILL_ENTRANCE,
  ENTRANCE_STEP_PX,
  INTRO_FAST_FORWARD,
  arrivalX,
  entranceSeconds,
  stepEntrance,
} from './entrance';

/** Run the whole beat at `rate`, collecting what happened. */
function play(rate = 1) {
  const beats: string[] = [];
  const thumps: number[] = [];
  let elapsed = 0;
  let last: string | null = null;
  for (let i = 0; i < Math.round(10 / FIXED_DT); i++) {
    const prev = elapsed;
    elapsed += FIXED_DT * rate;
    const step = stepEntrance(BILL_ENTRANCE, prev, elapsed);
    if (step.thumped) thumps.push(step.thumped);
    if (step.beat !== last) {
      beats.push(step.beat);
      last = step.beat;
    }
    if (step.beat === 'done') break;
  }
  return { beats, thumps, seconds: elapsed / rate };
}

describe('the Bills’ entrance timeline', () => {
  it('runs thumps → arrival → name → done, inside the 2–3 s the user asked for', () => {
    const total = entranceSeconds(BILL_ENTRANCE);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(total).toBeLessThanOrEqual(3);
    expect(play().beats).toEqual(['thumps', 'arrival', 'name', 'done']);
  });

  it('opens on the thumps — he is NOT on screen when the beat starts', () => {
    // Ratified: the arena opens empty but for the Knight, and the first thing
    // she reads is something very large walking toward it from off-frame.
    expect(stepEntrance(BILL_ENTRANCE, 0, 0.001).beat).toBe('thumps');
    expect(stepEntrance(BILL_ENTRANCE, 0, BILL_ENTRANCE.thumps - 0.01).beat).toBe('thumps');
  });

  it('lands every footfall exactly once, evenly spaced', () => {
    const { thumps } = play();
    expect(thumps).toEqual([1, 2, 3, 4]);
  });

  it('fast-forwards rather than skipping — the theatre survives the twentieth retry', () => {
    const fast = play(INTRO_FAST_FORWARD);
    // Every beat still happens, in order. A skip would collapse this to one.
    expect(fast.beats).toEqual(['thumps', 'arrival', 'name', 'done']);
    expect(INTRO_FAST_FORWARD).toBeGreaterThanOrEqual(2);
    expect(INTRO_FAST_FORWARD).toBeLessThanOrEqual(3);
  });

  it('never swallows a footfall, and never doubles one, however fast it runs', () => {
    for (const rate of [1, 2, INTRO_FAST_FORWARD, 3]) {
      const { thumps } = play(rate);
      // Two shakes on one frame is one shake, so a step that crosses two
      // reports the later. What must never happen is a beat with none.
      expect(thumps.length).toBeGreaterThan(0);
      expect(thumps).toEqual([...thumps].sort((a, b) => a - b));
      expect(new Set(thumps).size).toBe(thumps.length);
      expect(Math.max(...thumps)).toBe(BILL_ENTRANCE.thumpCount);
    }
  });

  it('stays done once it is done', () => {
    const total = entranceSeconds(BILL_ENTRANCE);
    for (const t of [total, total + 1, total + 60]) {
      const step = stepEntrance(BILL_ENTRANCE, t - FIXED_DT, t);
      expect(step.beat).toBe('done');
      expect(step.progress).toBe(1);
    }
  });
});

describe('the arrival walk is stepped, not glided', () => {
  it('only ever puts him on a whole 4 px step from his mark', () => {
    // PLAN.md §3: nothing in either Bill module interpolates, and that is
    // the one axis that separated the designs the user picked from the ones
    // they did not. An entrance that glided him in would be the single place
    // in the fight where he stops being the thing they chose.
    for (let i = 0; i <= 100; i++) {
      const x = arrivalX(1248, 868, i / 100);
      expect((x - 868) % ENTRANCE_STEP_PX).toBe(0);
    }
  });

  it('starts off-frame and finishes exactly on his mark', () => {
    expect(arrivalX(1248, 868, 0)).toBe(1248);
    expect(arrivalX(1248, 868, 1)).toBe(868);
    // Clamped, so a progress overshoot on a fast-forward frame cannot walk
    // him past the spot he is supposed to stop on.
    expect(arrivalX(1248, 868, 1.4)).toBe(868);
    expect(arrivalX(1248, 868, -0.3)).toBe(1248);
  });

  it('moves monotonically inward', () => {
    let last = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 60; i++) {
      const x = arrivalX(1248, 868, i / 60);
      expect(x).toBeLessThanOrEqual(last);
      last = x;
    }
  });
});
