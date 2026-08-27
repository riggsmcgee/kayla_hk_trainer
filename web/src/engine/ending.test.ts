/**
 * The ending's clock — the twenty seconds after 1:30.
 *
 * The properties that matter here are the ones the fight's clock had to get
 * right too: one transition per step, a beat that runs forever without ever
 * overflowing, and a sequence that cannot be hurried. What playtest 7 added is
 * the reason the sequence exists at all — for the first nine seconds nothing
 * may tell her she has won.
 */
import { describe, expect, it } from 'vitest';
import {
  CAST_SLOTS,
  ENDING,
  ENDING_ORDER,
  ENDING_PROMPT_SECONDS,
  beatElapsed,
  beatProgress,
  CROWD_HOP_HEIGHT,
  castMarks,
  crowdHop,
  createEndingState,
  dogIsFlipping,
  inkWidth,
  promptIsUp,
  reverence,
  slotX,
  stepEnding,
} from './ending';
import type { EndingBeat } from './ending';
import { CANVAS, FIXED_DT } from './constants';
import { ENEMY_SIZES } from './enemies';
import { ROSTER } from './roster';

const steps = (seconds: number): number => Math.round(seconds / FIXED_DT);

/** Run the celebration for `seconds` and collect every beat it entered. */
function run(s: ReturnType<typeof createEndingState>, seconds: number): EndingBeat[] {
  const beats: EndingBeat[] = [];
  for (let i = 0; i < steps(seconds); i++) {
    const beat = stepEnding(s, FIXED_DT);
    if (beat) beats.push(beat);
  }
  return beats;
}

describe('the ending', () => {
  it('opens on the Bills STOPPING, not kneeling', () => {
    // Playtest 7's correction to the version that shipped in 66a89ac. A Bill
    // on one knee at 1:30 announces the win, and the walk-on that follows then
    // has nothing left to frighten her with.
    const s = createEndingState();
    expect(s.beat).toBe('stop');
    expect(s.elapsed).toBe(0);
  });

  it('plays the six beats in the ratified order', () => {
    const s = createEndingState();
    expect(run(s, 60)).toEqual(['gather', 'hold', 'kneel', 'rise', 'cheer']);
  });

  it('holds each beat for its full length and no longer', () => {
    // The ratified table, read as absolute times off 1:30 rather than as
    // durations chained together: 1.2 s of stop, then 5.0 s of walk-on, then
    // 1.5 s of nothing happening at all.
    const at = (seconds: number): EndingBeat => {
      const s = createEndingState();
      run(s, seconds);
      return s.beat;
    };
    expect(at(1.1)).toBe('stop');
    expect(at(1.3)).toBe('gather');
    expect(at(6.1)).toBe('gather');
    expect(at(6.3)).toBe('hold');
    expect(at(7.6)).toBe('hold');
    expect(at(7.8)).toBe('kneel');
    expect(at(11.1)).toBe('kneel');
    expect(at(11.3)).toBe('rise');
    expect(at(13.7)).toBe('rise');
    expect(at(13.9)).toBe('cheer');
  });

  it('reaches the prompt at the ratified 19.5 seconds', () => {
    // The user asked for twenty seconds — "don't rush it" — and the table adds
    // up to 19.5. The constant is derived from the beats, so a beat retuned
    // without the others moves this number rather than silently disagreeing.
    expect(ENDING_PROMPT_SECONDS).toBeCloseTo(19.5, 5);

    const s = createEndingState();
    run(s, 19.4);
    expect(promptIsUp(s)).toBe(false);
    run(s, 0.2);
    expect(promptIsUp(s)).toBe(true);
  });

  it('says nothing at all for the first nine seconds', () => {
    // The fear beat, stated as a clock property: everything up to the kneel is
    // silence, and the kneel is the first frame that admits she has won.
    const silent = ENDING.stopSeconds + ENDING.gatherSeconds + ENDING.holdSeconds;
    expect(silent).toBeCloseTo(7.7, 5);
    const s = createEndingState();
    run(s, silent - 0.1);
    expect(ENDING_ORDER.indexOf(s.beat)).toBeLessThan(ENDING_ORDER.indexOf('kneel'));
  });

  it('reports each beat exactly once', () => {
    const s = createEndingState();
    expect(run(s, 300)).toEqual(['gather', 'hold', 'kneel', 'rise', 'cheer']);
  });

  it('leaves the cheer running, so nothing about the ending is on a timer', () => {
    // She advances it herself. A celebration that timed out would be the wave
    // auto-advance complaint again, at the moment she is most likely to be
    // sitting back and looking at it.
    const s = createEndingState();
    run(s, ENDING_PROMPT_SECONDS + 0.1);
    const before = s.elapsed;
    expect(run(s, 120)).toEqual([]);
    expect(s.beat).toBe('cheer');
    expect(s.elapsed).toBeGreaterThan(before + 119);
  });

  it('never runs more than one beat on one huge step', () => {
    // A tab that slept must not skip the sequence: `stepBoss` has the same
    // property, and a 60 s step landing straight on the cheer would hand her
    // the prompt without the fake-out that earns it.
    const s = createEndingState();
    expect(stepEnding(s, 60)).toBe('gather');
    expect(s.beat).toBe('gather');
  });
});

describe('the dog waits before showing off', () => {
  it('applauds with everyone first, then starts flipping', () => {
    // The flip lands as a PUNCHLINE rather than as texture, and it gives the
    // held tableau a beat change instead of one held picture.
    const s = createEndingState();
    run(s, ENDING_PROMPT_SECONDS - ENDING.cheerPromptAt + 0.1);
    expect(s.beat).toBe('cheer');
    expect(dogIsFlipping(s)).toBe(false);

    run(s, ENDING.cheerFlipAt);
    expect(dogIsFlipping(s)).toBe(true);
  });
});

describe('reverence', () => {
  it('is flat until the kneel, so nothing bows during the fake-out', () => {
    const s = createEndingState();
    expect(reverence(s)).toBe(0);
    run(s, ENDING.stopSeconds + ENDING.gatherSeconds + ENDING.holdSeconds - 0.1);
    expect(reverence(s)).toBe(0);
  });

  it('goes all the way down over the kneel motion, then holds', () => {
    const s = createEndingState();
    run(s, ENDING.stopSeconds + ENDING.gatherSeconds + ENDING.holdSeconds + 0.02);
    expect(s.beat).toBe('kneel');
    expect(reverence(s)).toBeLessThan(0.1);

    run(s, ENDING.kneelMotionSeconds);
    expect(reverence(s)).toBe(1);

    // Still down while she rises: she is lifting and they are not, which is
    // the whole picture.
    run(s, ENDING.kneelSeconds - ENDING.kneelMotionSeconds + 0.5);
    expect(s.beat).toBe('rise');
    expect(reverence(s)).toBe(1);
  });

  it('unwinds when they stand to applaud', () => {
    const s = createEndingState();
    run(s, ENDING_PROMPT_SECONDS - ENDING.cheerPromptAt + ENDING.standSeconds + 0.1);
    expect(s.beat).toBe('cheer');
    expect(reverence(s)).toBe(0);
  });
});

describe('beatProgress and beatElapsed', () => {
  it('runs 0 → 1 across a beat', () => {
    const s = createEndingState();
    expect(beatProgress(s)).toBe(0);
    run(s, ENDING.stopSeconds / 2);
    expect(beatProgress(s)).toBeCloseTo(0.5, 2);
  });

  it('is finished for a beat that has no end, so a fade needs no special case', () => {
    const s = createEndingState();
    run(s, ENDING_PROMPT_SECONDS + 1);
    expect(beatProgress(s)).toBe(1);
  });

  it('keeps counting inside the cheer, which has no timer to count down', () => {
    const s = createEndingState();
    const cheerStarts = ENDING_PROMPT_SECONDS - ENDING.cheerPromptAt;
    run(s, cheerStarts + 4);
    expect(beatElapsed(s)).toBeCloseTo(4, 1);
  });
});

describe('the cast marks', () => {
  const KNIGHT_X = 200;
  const BILLS = [900, 1000];

  it('gives every roster member a mark, and nobody a taken one', () => {
    const marks = castMarks(
      ROSTER.map((r) => r.id),
      [KNIGHT_X, ...BILLS],
    );
    expect(marks).toHaveLength(ROSTER.length);
    expect(new Set(marks.map((m) => m.x)).size).toBe(ROSTER.length);
    // Nobody stands on top of the Knight or either Bill.
    for (const m of marks) {
      for (const taken of [KNIGHT_X, ...BILLS]) {
        expect(Math.abs(m.x - taken)).toBeGreaterThan(inkWidth('bill') / 2);
      }
    }
  });

  it('brings them on from both walls at once', () => {
    // "All the other enemies walk [on]" is only frightening if she cannot
    // watch one edge and feel safe about the other.
    const marks = castMarks(
      ROSTER.map((r) => r.id),
      [KNIGHT_X, ...BILLS],
    );
    expect(marks.some((m) => m.fromLeft)).toBe(true);
    expect(marks.some((m) => !m.fromLeft)).toBe(true);
  });

  it('leaves every slot wider than the widest body that can stand in it', () => {
    // Derived from playtest 6's INK table, NOT from ENEMY_SIZES: the flier's
    // wings are 64 px across a 32 px hurtbox, and sizing a tableau from the
    // hurtbox is the same class of error that shipped the warden's invisible
    // telegraph.
    const pitch = CANVAS.width / CAST_SLOTS;
    const widest = Math.max(...ROSTER.map((r) => inkWidth(r.id)), inkWidth('bill'));
    expect(pitch).toBeGreaterThan(widest);
  });

  it('reports drawn ink, which is wider than the collision box where they differ', () => {
    expect(inkWidth('flier')).toBe(64);
    expect(ENEMY_SIZES.flier.width).toBe(32);
    // A body with no recorded ink falls back to its box, which is correct for
    // the ones playtest 6 measured as identical.
    expect(inkWidth('walker')).toBe(ENEMY_SIZES.walker.width);
  });

  it('spreads the slots evenly inside the arena, ends included', () => {
    expect(slotX(0)).toBeGreaterThan(0);
    expect(slotX(CAST_SLOTS - 1)).toBeLessThan(CANVAS.width);
    expect(slotX(1) - slotX(0)).toBeCloseTo(CANVAS.width / CAST_SLOTS, 5);
  });
});

describe('the crowd hop', () => {
  it('puts every body back on the floor, so they hop rather than hover', () => {
    // A plain sine would leave them floating half the time. This is what makes
    // it read as cheering.
    const lows = [];
    for (let t = 0; t < 4; t += 1 / 60) lows.push(crowdHop(t, 0));
    expect(Math.min(...lows)).toBe(0);
    expect(Math.max(...lows)).toBeCloseTo(CROWD_HOP_HEIGHT, 1);
  });

  it('staggers them, so five bodies do not move as one object', () => {
    const together = [0, 1, 2, 3, 4].map((i) => crowdHop(1.0, i));
    expect(new Set(together.map((h) => h.toFixed(3))).size).toBeGreaterThan(1);
  });

  it('never pushes a body below the floor it is standing on', () => {
    for (let t = 0; t < 4; t += 0.01) {
      for (let i = 0; i < 5; i++) expect(crowdHop(t, i)).toBeGreaterThanOrEqual(0);
    }
  });
});
