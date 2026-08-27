/**
 * The ending's clock — the celebration after 1:30.
 *
 * The properties that matter here are the ones the fight's clock had to get
 * right too: one transition per step, a beat that runs forever without ever
 * overflowing, and a sequence that cannot be hurried.
 */
import { describe, expect, it } from 'vitest';
import { ENDING, beatProgress, createEndingState, stepEnding } from './ending';
import type { EndingBeat } from './ending';
import { FIXED_DT } from './constants';

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
  it('opens on the Bills going down', () => {
    // The user's pick: the knee immediately after the fight, the applause
    // only once the rest of the cast is on. The knee is first because it is
    // the fight's own last frame, not part of the party.
    const s = createEndingState();
    expect(s.beat).toBe('concede');
    expect(s.elapsed).toBe(0);
  });

  it('holds the knee for its full length and no longer', () => {
    const s = createEndingState();
    expect(run(s, ENDING.concedeSeconds - 0.1)).toEqual([]);
    expect(s.beat).toBe('concede');

    expect(run(s, 0.2)).toEqual(['cheer']);
    expect(s.beat).toBe('cheer');
  });

  it('reports each beat exactly once', () => {
    const s = createEndingState();
    expect(run(s, ENDING.concedeSeconds + 30)).toEqual(['cheer']);
  });

  it('leaves the cheer running, so nothing about the ending is on a timer', () => {
    // She advances it herself. A celebration that timed out would be the wave
    // auto-advance complaint again, at the moment she is most likely to be
    // sitting back and looking at it.
    const s = createEndingState();
    run(s, ENDING.concedeSeconds + 0.1);
    const before = s.elapsed;
    expect(run(s, 120)).toEqual([]);
    expect(s.beat).toBe('cheer');
    expect(s.elapsed).toBeGreaterThan(before + 119);
  });

  it('never runs a beat past its end, even on one huge step', () => {
    const s = createEndingState();
    expect(stepEnding(s, 60)).toBe('cheer');
    expect(s.beat).toBe('cheer');
    expect(stepEnding(s, 60)).toBe(null);
  });
});

describe('beatProgress', () => {
  it('runs 0 → 1 across the knee', () => {
    const s = createEndingState();
    expect(beatProgress(s)).toBe(0);
    run(s, ENDING.concedeSeconds / 2);
    expect(beatProgress(s)).toBeCloseTo(0.5, 2);
  });

  it('is finished for a beat that has no end, so a fade needs no special case', () => {
    const s = createEndingState();
    run(s, ENDING.concedeSeconds + 1);
    expect(beatProgress(s)).toBe(1);
  });
});
