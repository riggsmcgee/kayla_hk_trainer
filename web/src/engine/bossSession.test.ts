/**
 * Boss session seam tests.
 *
 * The fight's clock is proved in boss.test.ts and the two state machines in
 * attackers.test.ts; what is proved here is the WIRING — the overlays, the
 * restart, and that a run is recorded in a shape the bests can read.
 *
 * Everything here plays a Knight who is standing still, because that is the
 * only strategy a test can execute today: reaching 0:30 needs a Knight who
 * can actually dodge, and the scripted survival bot is T11's last piece (see
 * PLAN.md, M6.7). So the 0:30 card and the 1:00 heat are proved at the clock
 * level in boss.test.ts, not from here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBossSession } from './bossSession';
import { BILL_ENTRANCE, entranceSeconds } from './entrance';
import { FIXED_DT } from './constants';
import type { InputFrame } from './types';

const recorded: Record<string, unknown>[] = [];
vi.mock('../storage/recordRun', () => ({
  recordRun: (run: Record<string, unknown>) => {
    recorded.push(run);
  },
}));

const IDLE: InputFrame = {
  left: false,
  right: false,
  jumpHeld: false,
  jumpPressed: false,
  attackPressed: false,
  up: false,
  down: false,
  dashPressed: false,
};
const COMFORT = { reduceShake: false, reduceFlashing: false };
const press = (partial: Partial<InputFrame>): InputFrame => ({ ...IDLE, ...partial });

/** A canvas stand-in that keeps only the strings the HUD and overlays write. */
function textRecorder(): { ctx: CanvasRenderingContext2D; lines: string[] } {
  const lines: string[] = [];
  const ctx = new Proxy(
    { fillText: (text: string) => lines.push(text) },
    {
      get: (target: Record<string, unknown>, key: string) =>
        key in target ? target[key] : () => undefined,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, lines };
}

type Session = ReturnType<typeof createBossSession>;

/** What the session would draw right now. */
function drawn(session: Session): string[] {
  const { ctx, lines } = textRecorder();
  session.render(ctx, 0);
  return lines;
}

/** Step for `seconds`, holding one input frame throughout. */
function hold(session: Session, seconds: number, input: InputFrame = IDLE): void {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) session.step(input, FIXED_DT);
}

/**
 * A boss session with Bill's entrance already played out.
 *
 * Almost every test here wants one: playtest 4 put a 2.8 s entrance in front
 * of the fight, and it replays on every retry, so "the fight" now means
 * "after the beat". Idle input, not a held jump — the fast-forward is a
 * behaviour under test, not a shortcut the other tests should lean on.
 */
function afterEntrance(config: Parameters<typeof createBossSession>[0]) {
  const session = createBossSession(config);
  hold(session, entranceSeconds(BILL_ENTRANCE) + 0.1);
  return session;
}

beforeEach(() => {
  recorded.length = 0;
});

describe('walking in', () => {
  it('opens with him OFF screen, thumping, before any of it', () => {
    // Ratified in playtest 4: the arena opens empty but for the Knight, and
    // the thumps land while he is still out of frame.
    const session = createBossSession({ comfort: COMFORT });
    hold(session, 0.3);
    const early = drawn(session);
    expect(early).toContain('Something is coming.');
    expect(early).not.toContain('BILL THE MAN');
    expect(early[0]).toBe('0:00 / 1:30');
  });

  it('runs the entrance faster when she holds jump, but never skips it', () => {
    // "If you hold down the jump button, the intro isn't skipped, but it goes
    // at two or three times speed."
    const patient = createBossSession({ comfort: COMFORT });
    const hurried = createBossSession({ comfort: COMFORT });
    hold(patient, 1.0);
    hold(hurried, 1.0, press({ jumpHeld: true }));
    // Same moment on the wall clock, further through the beat.
    expect(drawn(patient)).toContain('Something is coming.');
    expect(drawn(hurried)).not.toContain('Something is coming.');
    // And the fight still has not started: the clock is frozen throughout.
    expect(drawn(hurried)[0]).toBe('0:00 / 1:30');
  });

  it('names Bill the man and holds the clock at zero until she moves', () => {
    const session = afterEntrance({ comfort: COMFORT });
    hold(session, 3);

    const lines = drawn(session);
    expect(lines).toContain('BILL THE MAN');
    expect(lines[0]).toBe('0:00 / 1:30');
  });

  it('drops the target once she has already done 1:30', () => {
    const session = afterEntrance({ comfort: COMFORT, cleared: true });
    expect(drawn(session)[0]).toBe('0:00');
  });

  it('starts on any input, and never shows a hits line', () => {
    const session = afterEntrance({ comfort: COMFORT });
    session.step(press({ attackPressed: true }), FIXED_DT);
    hold(session, 1);

    const lines = drawn(session);
    expect(lines[0]).not.toBe('0:00 / 1:30');
    expect(lines.some((l) => l.includes('hits'))).toBe(false);
  });
});

describe('the run it records', () => {
  it('carries no enemy and no wave, so no other best can claim it', () => {
    const failed: number[] = [];
    const session = afterEntrance({ comfort: COMFORT, onFailed: () => failed.push(1) });
    session.step(press({ attackPressed: true }), FIXED_DT);
    // A Knight who does nothing is lanced inside the first few seconds.
    hold(session, 8);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ mode: 'dodge', boss: true, cleared: false, hitsLanded: 0 });
    expect(recorded[0]!.enemyId).toBeUndefined();
    expect(recorded[0]!.wave).toBeUndefined();
    expect(failed).toEqual([1]);
  });

  it('records the fight clock, and freezes it at the touch', () => {
    const session = afterEntrance({ comfort: COMFORT });
    session.step(press({ attackPressed: true }), FIXED_DT);
    hold(session, 8);

    const durationMs = recorded[0]!.durationMs as number;
    expect(durationMs).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(8000);
    // The overlay reads back the same frozen number the run kept.
    expect(drawn(session)[0]).toContain(`0:0${Math.floor(durationMs / 1000)}`);
  });

  it('shows the fail screen, and both keys face them again', () => {
    const session = afterEntrance({ comfort: COMFORT });
    session.step(press({ attackPressed: true }), FIXED_DT);
    hold(session, 8);
    expect(drawn(session)).toContain('Got you.');

    // Retrying replays the entrance from the top — ratified in playtest 4.
    // A skip would mean the twentieth attempt never sees the theatre again;
    // the fast-forward is what makes replaying it affordable.
    session.step(press({ attackPressed: true }), FIXED_DT);
    expect(drawn(session)).toContain('Something is coming.');
    expect(drawn(session)[0]).toBe('0:00 / 1:30');
    hold(session, entranceSeconds(BILL_ENTRANCE) + 0.1);
    expect(drawn(session)).toContain('BILL THE MAN');
  });
});

describe('the Bills, over a long run', () => {
  it('never take a hit, however many times she swings and dies', () => {
    const session = afterEntrance({ comfort: COMFORT });
    // A hundred seconds of mashing: swing, die, X, swing again.
    for (let i = 0; i < 60 * 100; i++) {
      session.step(press({ attackPressed: i % 25 === 0, down: true }), FIXED_DT);
    }
    expect(recorded.length).toBeGreaterThan(1);
    for (const run of recorded) {
      expect(run.boss).toBe(true);
      expect(run.hitsLanded).toBe(0);
      expect(run.cleared).toBe(false);
    }
  });
});
