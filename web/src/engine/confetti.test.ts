/**
 * The ending's confetti.
 *
 * The properties worth pinning are the ones that would go quietly wrong: paper
 * that never lands, paper that never leaves (a list that grows for as long as
 * she looks at the celebration is a leak with a two-minute fuse), a burst that
 * stamps the same shape every cycle, and a colour that collides with something
 * the game has taught her to read.
 */
import { describe, expect, it } from 'vitest';
import {
  CONFETTI,
  CONFETTI_COLORS,
  CONFETTI_COLORS_SOFT,
  burstConfetti,
  shotHasBurst,
  shotHeight,
  stepConfetti,
} from './confetti';
import { FIXED_DT } from './constants';
import { COLORS } from './render';

/** Run a list of pieces for `seconds` at the fixed step. */
function run(pieces: ReturnType<typeof burstConfetti>, seconds: number) {
  let alive = pieces;
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) alive = stepConfetti(alive, FIXED_DT);
  return alive;
}

describe('a burst', () => {
  it('makes a full spread of paper from one shot', () => {
    expect(burstConfetti(100, 100, 0)).toHaveLength(CONFETTI.piecesPerBurst);
  });

  it('throws pieces both ways, so it reads as a burst and not as a jet', () => {
    const pieces = burstConfetti(100, 100, 0);
    expect(pieces.some((p) => p.vx < 0)).toBe(true);
    expect(pieces.some((p) => p.vx > 0)).toBe(true);
  });

  it('kicks everything upward first, so gravity has something to undo', () => {
    // A burst that started falling immediately reads as a leak rather than as
    // a firework.
    expect(burstConfetti(100, 100, 0).every((p) => p.vy <= 0)).toBe(true);
  });

  it('looks different every cycle rather than stamping one shape', () => {
    const first = burstConfetti(100, 100, 0).map((p) => Math.round(p.vx));
    const second = burstConfetti(100, 100, 1).map((p) => Math.round(p.vx));
    expect(first).not.toEqual(second);
  });

  it('is exactly repeatable, so nothing here needs a random seed', () => {
    // Determinism is what keeps a stepped drawing on whole pixels, and it is
    // why this module has no state to reset between runs.
    expect(burstConfetti(100, 100, 3)).toEqual(burstConfetti(100, 100, 3));
  });

  it('starts every piece where the shot burst', () => {
    for (const p of burstConfetti(640, 120, 2)) {
      expect(p.x).toBe(640);
      expect(p.y).toBe(120);
    }
  });
});

describe('the fall', () => {
  it('accelerates downward rather than drifting at a constant speed', () => {
    const one = run(burstConfetti(100, 100, 0), 0.5);
    const two = run(burstConfetti(100, 100, 0), 1.0);
    const fastest = (list: typeof one) => Math.max(...list.map((p) => p.vy));
    expect(fastest(two)).toBeGreaterThan(fastest(one));
  });

  it('ends up below where it burst', () => {
    const later = run(burstConfetti(100, 100, 0), 2);
    expect(later.every((p) => p.y > 100)).toBe(true);
  });

  it('clears itself out, so a celebration she watches for two minutes is bounded', () => {
    // The cheer runs until she presses forward. A list that only ever grew
    // would be a leak with a very long fuse and no symptom until then.
    expect(run(burstConfetti(100, 100, 0), CONFETTI.lifeSeconds + 0.2)).toEqual([]);
  });

  it('does not mutate the list it was handed', () => {
    // The caller reassigns; a step that also spliced in place would let a
    // draw mid-frame iterate a list that is changing underneath it.
    const pieces = burstConfetti(100, 100, 0);
    const before = pieces.map((p) => p.y);
    stepConfetti(pieces, FIXED_DT);
    expect(pieces.map((p) => p.y)).toEqual(before);
  });
});

describe('the shot that becomes a burst', () => {
  it('climbs at the speed it says it does', () => {
    expect(shotHeight(1)).toBe(CONFETTI.riseSpeed);
    expect(shotHeight(0)).toBe(0);
  });

  it('bursts once it has reached the height it was given, and not before', () => {
    const top = 400;
    const justUnder = top / CONFETTI.riseSpeed - 0.01;
    expect(shotHasBurst(justUnder, top)).toBe(false);
    expect(shotHasBurst(justUnder + 0.02, top)).toBe(true);
  });

  it('re-fires often enough that the tableau is never empty', () => {
    // Ratified: "the spitter re-fires on a ~2 s cycle so something is always
    // drifting". A piece must outlive the gap between shots or the celebration
    // blinks empty between bursts.
    expect(CONFETTI.lifeSeconds).toBeGreaterThan(CONFETTI.cycleSeconds);
  });
});

describe('the palette', () => {
  it('never borrows a colour the game has taught her to read', () => {
    // punishGold is "the punish window" and #f08a2c is Bill's foam finger.
    // Confetti sharing either would be the one moment the site's colour
    // language lies to her.
    const banned = [COLORS.punishGold?.toLowerCase(), '#e8c76a', '#f08a2c'].filter(Boolean);
    for (const colour of [...CONFETTI_COLORS, ...CONFETTI_COLORS_SOFT]) {
      expect(banned).not.toContain(colour.toLowerCase());
    }
  });

  it('offers a softened set of the same size, so reduceFlashing swaps rather than removes', () => {
    // The comfort setting must not be able to take her party away — it exists
    // to stop things flashing, and steady paper is not that.
    expect(CONFETTI_COLORS_SOFT).toHaveLength(CONFETTI_COLORS.length);
  });

  it('picks a colour every piece can actually index', () => {
    for (const p of burstConfetti(100, 100, 5)) {
      expect(p.color).toBeGreaterThanOrEqual(0);
      expect(p.color).toBeLessThan(CONFETTI_COLORS.length);
    }
  });
});
