/**
 * Pogo Course session seam tests.
 *
 * Seam: createPogoCourseSession — the whole mini-game as one object. It has
 * no state getters, so what it believes is read the way she reads it: off
 * the text it draws (see hudText).
 *
 * The subject here is the overlay contract (playtest 3, note 11): Z goes
 * FORWARD, X goes AGAIN, and neither is heard until she has had time to read
 * the screen.
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXED_DT } from './constants';
import { createPogoCourseSession } from './pogoCourseSession';
import type { PogoCourseOptions } from './pogoCourseSession';
import { OVERLAY_LOCKOUT_SECONDS } from './session';
import type { ComfortSettings } from './juice';
import type { GameSession } from './session';
import type { InputFrame } from './types';

/** The session records every clear; capture instead of touching storage. */
const recorded: Record<string, unknown>[] = [];
vi.mock('../storage/recordRun', () => ({
  recordRun: (run: Record<string, unknown>) => {
    recorded.push(run);
  },
}));

const COMFORT: ComfortSettings = { reduceShake: false, reduceFlashing: false };

const IDLE: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpPressed: false,
  attackPressed: false,
  dashPressed: false,
};

const press = (p: Partial<InputFrame>): InputFrame => ({ ...IDLE, ...p });

/** What the screen says, captured from a stub 2D context. */
function hudText(s: GameSession): string {
  const lines: string[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, prop) =>
      prop === 'fillText'
        ? (text: string) => {
            lines.push(text);
          }
        : () => undefined,
    set: () => true,
  });
  s.render(ctx, 1);
  return lines.join(' | ');
}

/**
 * Run level 1 to its goal by holding right and mashing the pogo, the way the
 * course is meant to be played, and stop on the frame the clear screen
 * appears. Returns the session sitting on that screen.
 */
function runToClear(options: PogoCourseOptions): GameSession {
  const s = createPogoCourseSession(options);
  for (let i = 0; i < 60 * 90 && !hudText(s).includes('clear, Kayla!'); i++) {
    // The same mash pattern the lesson demo uses: hold right and DOWN, and
    // slash on every third step, so the run pogos its way along.
    s.step(
      press({ right: true, down: true, attackPressed: i % 3 === 0, jumpPressed: i === 0 }),
      FIXED_DT,
    );
  }
  return s;
}

/** Steps enough idle frames to clear OVERLAY_LOCKOUT_SECONDS. */
function waitOutLockout(s: GameSession): void {
  const steps = Math.ceil(OVERLAY_LOCKOUT_SECONDS / FIXED_DT) + 1;
  for (let i = 0; i < steps; i++) s.step(IDLE, FIXED_DT);
}

describe('pogo course clear screen (playtest 3, note 11)', () => {
  it('names the forward key, its destination, and the again key', () => {
    const s = runToClear({
      level: 1,
      comfort: COMFORT,
      onNext: () => {},
      nextLabel: 'level 2',
    });
    const copy = hudText(s);
    expect(copy).toContain('Press Z for level 2');
    expect(copy).toContain('X to run it again');
  });

  it('offers X alone when there is nowhere forward to go', () => {
    const s = runToClear({ level: 1, comfort: COMFORT });
    const copy = hudText(s);
    expect(copy).toContain('Press X to run it again');
    expect(copy).not.toContain('Press Z');
  });

  it('follows her bindings rather than a hard-coded Z and X', () => {
    const s = runToClear({
      level: 1,
      comfort: COMFORT,
      jumpKey: 'Space',
      attackKey: 'J',
      onNext: () => {},
      nextLabel: 'level 2',
    });
    const copy = hudText(s);
    expect(copy).toContain('Press Space for level 2');
    expect(copy).toContain('J to run it again');
  });

  it('X runs it again, and does not go forward', () => {
    let forward = 0;
    const s = runToClear({
      level: 1,
      comfort: COMFORT,
      onNext: () => {
        forward += 1;
      },
      nextLabel: 'level 2',
    });
    waitOutLockout(s);
    s.step(press({ attackPressed: true }), FIXED_DT);
    expect(hudText(s)).not.toContain('clear, Kayla!');
    expect(forward).toBe(0);
  });

  it('Z goes forward exactly once, and does not restart the run', () => {
    let forward = 0;
    const s = runToClear({
      level: 1,
      comfort: COMFORT,
      onNext: () => {
        forward += 1;
      },
      nextLabel: 'level 2',
    });
    waitOutLockout(s);
    s.step(press({ jumpPressed: true }), FIXED_DT);
    expect(forward).toBe(1);
    // The page owns what happens next; the screen stays up until it acts.
    expect(hudText(s)).toContain('clear, Kayla!');
  });

  it('Z is inert when there is nowhere forward', () => {
    const s = runToClear({ level: 1, comfort: COMFORT });
    waitOutLockout(s);
    s.step(press({ jumpPressed: true }), FIXED_DT);
    expect(hudText(s)).toContain('clear, Kayla!');
  });

  it('ignores an X held across the goal line, so the screen cannot be skipped unread', () => {
    // This session has NO hit-stop on a clear (FEEDBACK.courseClear.hitStop
    // is 0) and course.ts sets `finished` on the same step the goal is
    // touched — so she arrives here mid pogo-mash with X going. The lockout
    // is the only thing protecting the screen.
    const s = runToClear({ level: 1, comfort: COMFORT });
    const lockoutSteps = Math.ceil(OVERLAY_LOCKOUT_SECONDS / FIXED_DT);
    for (let i = 0; i < lockoutSteps - 1; i++) {
      s.step(press({ attackPressed: true, down: true }), FIXED_DT);
    }
    expect(hudText(s)).toContain('clear, Kayla!');

    // And it answers the moment it is allowed to.
    s.step(press({ attackPressed: true }), FIXED_DT);
    expect(hudText(s)).not.toContain('clear, Kayla!');
  });
});
