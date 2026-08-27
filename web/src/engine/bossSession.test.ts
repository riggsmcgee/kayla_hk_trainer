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
import { CANVAS, FIXED_DT } from './constants';
import { BOSS } from './boss';
import { ENDING, ENDING_PROMPT_SECONDS } from './ending';
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
    // A hundred seconds of it: mash for a second, breathe for a second, over
    // and over. The breath matters — playtest 5's fail screen waits for one,
    // so a bot that never stops mashing only ever gets one run.
    for (let i = 0; i < 60 * 100; i++) {
      const mashing = i % 120 < 60;
      session.step(press({ attackPressed: mashing && i % 25 === 0, down: true }), FIXED_DT);
    }
    expect(recorded.length).toBeGreaterThan(1);
    for (const run of recorded) {
      expect(run.boss).toBe(true);
      expect(run.hitsLanded).toBe(0);
      expect(run.cleared).toBe(false);
    }
  });
});

/**
 * A canvas stand-in that keeps where each body was drawn. Every painter in
 * the fight puts its rig down with one `translate`, so the x values are the
 * positions on screen.
 */
function placeRecorder(): { ctx: CanvasRenderingContext2D; xs: number[] } {
  const xs: number[] = [];
  const ctx = new Proxy(
    {
      translate: (x: number) => {
        xs.push(x);
      },
    },
    {
      get: (target: Record<string, unknown>, key: string) =>
        key in target ? target[key] : () => undefined,
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, xs };
}

/**
 * Where the dog is drawn this frame: the rightmost body on screen. He comes
 * in through the far wall at x 1248 and stops at 968, and Bill's mark is 868,
 * so the dog is the right-hand extreme for the whole of his entrance.
 */
function dogDrawnAt(session: Session, alpha: number): number {
  const { ctx, xs } = placeRecorder();
  session.render(ctx, alpha);
  return Math.max(...xs);
}

describe("Bill the dog's entrance (playtest 6, note 5)", () => {
  /**
   * God mode is the only way a test can reach 0:30 today: an idle Knight is
   * caught at about two seconds, and the survival bot is still M6.7's last
   * piece. It changes nothing about the card, which is pure theatre.
   */
  function atTheCard(): Session {
    const session = afterEntrance({ comfort: COMFORT, godMode: true });
    // "Move to begin" — nothing moves, including the clock, until she does.
    session.step(press({ right: true }), FIXED_DT);
    hold(session, BOSS.dogAt + 0.1);
    return session;
  }

  it('raises his card when he is due', () => {
    expect(drawn(atTheCard())).toContain('BILL THE DOG');
  });

  it('cannot be cut short by anything she is holding', () => {
    // Every input at once — more than a pair of hands can do. The skip used
    // to read held direction keys as level state, so the step after the card
    // went up saw the key she was already holding and dismissed it: 16.7 ms
    // of a 2.5 s card, which is why she had never seen the dog arrive.
    const everything = press({
      left: true,
      right: true,
      up: true,
      down: true,
      jumpHeld: true,
      jumpPressed: true,
      attackPressed: true,
      dashPressed: true,
    });
    const session = atTheCard();
    hold(session, BOSS.cardSeconds - 0.5, everything);
    expect(drawn(session)).toContain('BILL THE DOG');
  });

  it('ends itself once it has run its full length', () => {
    const session = atTheCard();
    hold(session, BOSS.cardSeconds + 0.1, press({ jumpHeld: true }));
    expect(drawn(session)).not.toContain('BILL THE DOG');
  });

  it('keeps the promise that makes an unskippable card bearable', () => {
    const copy = drawn(atTheCard()).join(' ');
    // The reassurance survives; the two mechanisms it used to advertise do not.
    expect(copy).toContain('your clock is paused');
    expect(copy).not.toMatch(/skip|hurry/i);
  });

  it('draws him where he actually is, not pinned to his off-screen start', () => {
    const session = atTheCard();
    // Most of the way through the card, so he is well inside the arena.
    hold(session, 1.8);
    // Render lerps from his PREVIOUS position, and the card branch returns
    // before the fighting path takes that snapshot — so it stayed at the
    // off-screen start he was pinned to, and on a 60 Hz display (alpha 0) he
    // was never drawn on the card at all. Nobody had ever seen the card, so
    // nobody had seen this either.
    expect(dogDrawnAt(session, 0)).toBeLessThan(CANVAS.width);
  });

  it('walks him toward his mark while the card is up', () => {
    const session = atTheCard();
    const start = dogDrawnAt(session, 0);
    hold(session, 1);
    expect(dogDrawnAt(session, 0)).toBeLessThan(start);
  });
});

/**
 * The ending (playtest 6, notes 6 and 7).
 *
 * Reached through the dev seam, because it has to be: god mode is the only
 * way a test can survive ninety seconds against Bill, and god mode is
 * deliberately locked out of the ending. So the celebration itself is played
 * through `playTheEnding`, and the LOCK is proved separately, on the real
 * session, by letting god mode run the full fight and checking it never wins.
 */
describe('the ending', () => {
  /** One step short of the finish line, untouched. */
  function atTheFinish() {
    return createBossSession({ comfort: COMFORT, playTheEnding: true });
  }

  it('ends the fight at 1:30 instead of restarting it', () => {
    const session = atTheFinish();
    hold(session, 0.5);
    const copy = drawn(session).join(' ');
    // The clock stops on the number, and the fail screen never appears.
    expect(copy).toContain('1:30');
    expect(copy).not.toContain('Got you.');
    expect(copy).not.toContain('Move to begin');
  });

  it('shouts for everybody instead of telling her she has won', () => {
    // The load-bearing frame of the whole sequence. At 1:30 the Bills STOP,
    // Bill's foam finger goes up and he calls the roster in. Any win text here
    // kills the fake-out before the walk-on has even begun.
    const session = atTheFinish();
    hold(session, 0.5);
    const copy = drawn(session).join(' ');
    expect(copy).toContain('ALL RIGHT');
    expect(copy).not.toContain('YOU DID IT');
    // And NOT the 0:30 line: "HELP!" reads as Bill losing.
    expect(copy).not.toContain('HELP!');
  });

  it('says nothing at all while the roster walks on', () => {
    // The fear beat. The game never lies to her and it never reassures her
    // either \u2014 a wave-style card naming the five would sell the fake-out and
    // would be the first untrue thing the dojo ever said.
    const session = atTheFinish();
    hold(session, ENDING.stopSeconds + ENDING.gatherSeconds - 0.2);
    const copy = drawn(session).join(' ');
    expect(copy).not.toContain('YOU DID IT');
    expect(copy).not.toContain('Hollow Knight Queen');
  });

  it('cannot be hurried, however hard she is pressing', () => {
    // The whole 19.5 s goes through no gate at all: the ending's gate is not
    // armed until the PROMPT appears, which is the same reasoning that made
    // the dog's card unskippable. She has just won — a mashing thumb must not
    // eat it.
    const session = atTheFinish();
    hold(session, ENDING_PROMPT_SECONDS - 0.3, press({ jumpPressed: true, attackPressed: true }));
    expect(drawn(session).join(' ')).not.toContain('to face them again');
  });

  it('gets to the cheer, and tells her what she did', () => {
    const session = atTheFinish();
    hold(session, ENDING_PROMPT_SECONDS - ENDING.cheerPromptAt + 0.3);
    const copy = drawn(session).join(' ');
    expect(copy).toContain('YOU DID IT');
    expect(copy).toContain('Hollow Knight Queen');
  });

  it('holds the prompt back until the tableau has had its time', () => {
    const session = atTheFinish();
    hold(session, ENDING_PROMPT_SECONDS - 0.3);
    expect(drawn(session).join(' ')).not.toContain('to face them again');
    hold(session, 0.6);
    expect(drawn(session).join(' ')).toContain('to face them again');
  });

  it('waits for her rather than timing out', () => {
    // Two full minutes of her looking at it. Nothing advances on its own.
    const session = atTheFinish();
    hold(session, 120);
    expect(drawn(session).join(' ')).toContain('YOU DID IT');
  });

  it('records the win, which the fail branch used to be the only place for', () => {
    // `record()` fired only when she was touched. Once 1:30 ends the fight,
    // `over` is unreachable after it — so a win that did not record would be
    // a run that left no PracticeRun at all.
    const session = atTheFinish();
    hold(session, 0.5);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ boss: true, cleared: true });
    expect(recorded[0]?.durationMs).toBeGreaterThanOrEqual(BOSS.targetSeconds * 1000);
  });

  it('never lets a win nobody played become her record of beating them', () => {
    const onPassed = vi.fn();
    const session = createBossSession({ comfort: COMFORT, playTheEnding: true, onPassed });
    hold(session, 0.5);
    expect(onPassed).not.toHaveBeenCalled();
    // And the run it wrote is flagged the way god-mode runs are, so the bests
    // can never pick it up either.
    expect(recorded[0]).toMatchObject({ godMode: true });
  });

  it('restarts when she asks, and plays the whole thing again from the stop', () => {
    const session = atTheFinish();
    hold(session, ENDING_PROMPT_SECONDS + 0.5);
    expect(drawn(session).join(' ')).toContain('YOU DID IT');

    hold(session, 0.5, press({ attackPressed: true }));
    // Back to the stop: the ending's own clock restarted with the run, so the
    // dev seam replays the sequence rather than dumping her on the cheer.
    expect(drawn(session).join(' ')).not.toContain('YOU DID IT');
    hold(session, ENDING_PROMPT_SECONDS - ENDING.cheerPromptAt + 0.3);
    expect(drawn(session).join(' ')).toContain('YOU DID IT');
  });
});

describe('god mode does not earn the ending', () => {
  it('runs the whole fight past 1:30 and never celebrates', () => {
    // The lock, proved end to end on the real session rather than on the
    // clock alone: a god-mode run in the browser took 29 hits and still
    // reached 1:30. She is standing still here, so Bill catches her at about
    // two seconds and keeps catching her for the next ninety.
    const session = afterEntrance({ comfort: COMFORT, godMode: true });
    hold(session, 1, press({ right: true }));
    hold(session, BOSS.targetSeconds + 3);

    const copy = drawn(session).join(' ');
    expect(copy).not.toContain('YOU DID IT');
    expect(copy).toContain('past 1:30');
    // Still fighting: nothing recorded, because nothing ended.
    expect(recorded).toHaveLength(0);
  });
});
