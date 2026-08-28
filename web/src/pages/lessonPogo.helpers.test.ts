/**
 * The Pogo lesson makes promises with numbers in them. These pin every one
 * of them to the engine, so a tuning pass that changes the dash cannot leave
 * the page teaching Kayla something that stopped being true.
 *
 * The escape-window probe below is deliberately a second, independent copy
 * of the one in `attackers.test.ts`. That file measures the window because
 * the FIGHT depends on it; this one measures it because the LESSON claims
 * it, and the lesson must break on its own even if that test is ever
 * rewritten. Two tests failing for one cause is the cheap half of the trade.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT, PHYSICS } from '../engine/constants';
import { createEnemy, enemyAttackHitbox, stepEnemy, type Target } from '../engine/enemies';
import { FLOOR_Y } from '../engine/dodgeArenaSession';
import type { World } from '../engine/types';
import { DASH_NUMBERS, ESCAPE_WINDOW, tenthsInWords } from './lessonPogo.helpers';

/** A floor and nothing else — the escape is horizontal, so walls only confuse it. */
function flatWorld(): World {
  return { solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }] };
}

/** The pogo chain she actually flies: contact at 120 px, apex 240, one bounce per 0.6 s. */
const CHAIN = { contact: 120, apex: 240, period: 0.6 };

function chainFeetY(t: number): number {
  const phase = (t % CHAIN.period) / CHAIN.period;
  const k = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return FLOOR_Y - (CHAIN.contact + (CHAIN.apex - CHAIN.contact) * k);
}

/**
 * Bounce on a duelist, leave `leaveAt` seconds later at `speed`, and report
 * whether his anti-air column ever reaches her. True means she got out.
 */
function escapes(leaveAt: number, speed: number): boolean {
  const world = flatWorld();
  const duelist = createEnemy('duelist', 600, FLOOR_Y);
  duelist.cooldownTimer = 0;
  const steps = Math.round(3 / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * FIXED_DT;
    const x = t < leaveAt ? 600 : 600 + (t - leaveAt) * speed;
    const target: Target = { position: { x, y: chainFeetY(t) }, grounded: false };
    stepEnemy(duelist, world, FIXED_DT, target);
    const box = enemyAttackHitbox(duelist);
    if (!box) continue;
    // Her hurtbox: 18 wide, 47 tall, hanging above her feet.
    const hurt = { x: x - 9, y: target.position.y - 47, width: 18, height: 47 };
    const hit =
      box.x < hurt.x + hurt.width &&
      box.x + box.width > hurt.x &&
      box.y < hurt.y + hurt.height &&
      box.y + box.height > hurt.y;
    if (hit) return false;
  }
  return true;
}

describe('the escape window the dashing section teaches', () => {
  it('lets her run out at the tenth of a second the page promises', () => {
    expect(escapes(ESCAPE_WINDOW.running, PHYSICS.runSpeed)).toBe(true);
  });

  it('does not let her run out any later than that', () => {
    // The page says a tenth is all running buys. If this ever passes, the
    // number in the prose is too small and she is being told to leave early.
    expect(escapes(ESCAPE_WINDOW.running + 0.05, PHYSICS.runSpeed)).toBe(false);
  });

  it('lets her dash out at two tenths, twice as late', () => {
    expect(escapes(ESCAPE_WINDOW.dashing, PHYSICS.dashSpeed)).toBe(true);
  });

  it('does not let her dash out any later than that', () => {
    // "After that you are committed" — the other half of the promise.
    expect(escapes(ESCAPE_WINDOW.dashing + 0.1, PHYSICS.dashSpeed)).toBe(false);
  });

  it('is exactly the doubling the thesis claims', () => {
    expect(ESCAPE_WINDOW.dashing).toBe(ESCAPE_WINDOW.running * 2);
  });
});

describe('the dash figures the page prints', () => {
  it('covers 200 px against running 83 in the same quarter second', () => {
    // Both derived from the decompiled constants: 800 × 0.25 and 332 × 0.25.
    expect(DASH_NUMBERS.distancePx).toBe(200);
    expect(DASH_NUMBERS.runDistancePx).toBe(83);
  });

  it('buys 117 px of daylight at 2.4x her run', () => {
    expect(DASH_NUMBERS.headStartPx).toBe(117);
    expect(DASH_NUMBERS.timesRunSpeed).toBe(2.4);
  });

  it('comes back slower than the nail, which is why the rhythm is the dash', () => {
    // The page tells her hit-and-away repeats on the dash cooldown. That is
    // only true while the dash is the slower of the two to return.
    expect(DASH_NUMBERS.dashReadySeconds).toBeGreaterThan(DASH_NUMBERS.nailReadySeconds);
  });

  it('loses a straight race with Bill the man once he is hot', () => {
    // The correction the page carries: dashing away from the lance is the
    // wrong answer, and it is wrong by arithmetic, not by feel.
    expect(DASH_NUMBERS.hotLancePxPerSecond).toBeGreaterThan(DASH_NUMBERS.dashPxPerSecond);
  });

  it('leaves nothing for a dash-cancel to save', () => {
    // Why the section does NOT teach cancelling: her nail is not ready again
    // until after the swing has finished on its own.
    expect(PHYSICS.nailCadence).toBeGreaterThan(PHYSICS.nailSwingTime);
  });
});

describe('the thesis, which says the escape window in words', () => {
  it('spells a whole number of tenths', () => {
    expect(tenthsInWords(0.1)).toBe('a tenth');
    expect(tenthsInWords(0.2)).toBe('two tenths');
    expect(tenthsInWords(0.3)).toBe('three tenths');
  });

  it('falls back to the digits rather than rounding a number it cannot spell', () => {
    // Reading worse is the point. A lesson that quietly rounded 0.15 to "two
    // tenths" would be the exact failure this helper exists to prevent, wearing
    // a nicer sentence.
    expect(tenthsInWords(0.15)).toBe('0.15');
  });

  it('keeps the two windows a factor of two apart, because the page says "doubles"', () => {
    // The thesis makes a CLAIM about the pair, not just a report of them. If a
    // tuning pass moved one and not the other, the digits four lines above would
    // update themselves and the loudest line on the page would go quietly wrong.
    expect(ESCAPE_WINDOW.dashing).toBeCloseTo(ESCAPE_WINDOW.running * 2, 10);
  });
});
