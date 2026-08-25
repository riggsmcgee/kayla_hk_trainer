/**
 * The Two Bills, played by a bot — the arena's answer to the pogo course's
 * completability test (course.test.ts).
 *
 * Every number in this fight was DERIVED against the shipped physics rather
 * than felt in play (the plan says so out loud), so the one thing a test can
 * still prove is that the derivation holds: that standing on the floor loses,
 * that being airborne over the lance wins, and that the shake-off really does
 * give her one free bounce and punish the second.
 *
 * The bot only ever presses what a person could press, on the real
 * `stepPlayer`, in the real arena world. If it cannot survive, the knobs are
 * `ATTACKS.bill.lanceSpeed` and `lanceHeight` — never `PHYSICS`, whose
 * gravity is the one estimated value in the whole engine and which prices the
 * pogo course's ceiling section too.
 */
import { describe, expect, it } from 'vitest';
import { createArenaState, stepArena } from './arena';
import { ATTACKS, ENEMY_SIZES, createEnemy, stepEnemy } from './enemies';
import type { Enemy } from './enemies';
import { FIXED_DT, KNIGHT } from './constants';
import { arenaWorld, FLOOR_Y, PLAYER_SPAWN_X } from './dodgeArenaSession';
import { createPlayer, stepPlayer } from './player';
import type { Player } from './player';
import type { InputFrame } from './types';

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
const press = (partial: Partial<InputFrame>): InputFrame => ({ ...IDLE, ...partial });

/** Where their bodies touch: his half-width plus hers. */
const CONTACT = ENEMY_SIZES.bill.width / 2 + KNIGHT.hurtboxWidth / 2;

/**
 * When the bot leaves the ground, measured back from the moment of contact.
 *
 * Derived, not tuned. A standing jump pins 666 px/s for 0.18 s (120 px) and
 * then coasts against 1900 px/s², so her feet pass Bill's 160 px head at
 * about 0.25 s and drop back below it at about 0.79 s. Jumping half a second
 * out puts the charge in the middle of that window rather than on its edge —
 * which is also the margin a person gets, and the reason the tell is 0.6 s.
 */
const JUMP_LEAD_SECONDS = 0.5;

interface BotRun {
  survivedSeconds: number;
  lancesDodged: number;
  /** The attack that was live when she was caught; null means his body. */
  caughtBy: string | null;
}

interface Scene {
  /** Where the Knight starts. Default: her usual arena spawn, on the floor. */
  playerAt?: { x: number; y: number };
  /** Where Bill starts. Default: the far side of the Colosseum. */
  billAt?: number;
}

/**
 * Play the fight for `seconds` with one strategy, and report when it ended.
 *
 * `strategy` is handed the live player and Bill and returns the frame a
 * person would press. Nothing else is granted: no teleporting, no reading
 * the future, no touching state.
 */
function play(
  seconds: number,
  strategy: (player: Player, bill: Enemy, elapsed: number) => InputFrame,
  scene: Scene = {},
): BotRun {
  const world = arenaWorld();
  const spawn = scene.playerAt ?? { x: PLAYER_SPAWN_X, y: FLOOR_Y };
  const player = createPlayer(spawn.x, spawn.y);
  const bill = createEnemy('bill', scene.billAt ?? 868, FLOOR_Y);
  const arena = createArenaState(false);
  arena.started = true;

  let lancesDodged = 0;
  let wasCharging = false;
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
    const elapsed = i * FIXED_DT;
    stepPlayer(player, strategy(player, bill, elapsed), world, FIXED_DT);
    stepEnemy(bill, world, FIXED_DT, { position: player.position, grounded: player.grounded });

    const charging = bill.attackKind === 'lance' && bill.phase === 'active';
    if (wasCharging && !charging) lancesDodged += 1;
    wasCharging = charging;

    if (stepArena(arena, player, [bill], FIXED_DT).playerHit) {
      const live = bill.phase === 'active' ? bill.attackKind : null;
      return { survivedSeconds: elapsed, lancesDodged, caughtBy: live };
    }
  }
  return { survivedSeconds: seconds, lancesDodged, caughtBy: null };
}

/** Swing straight down — the pogo, and the only thing her nail does up here. */
function downslash(): InputFrame {
  return press({ attackPressed: true, down: true });
}

/** Seconds until the charge reaches her, counting the tell she has left. */
function secondsUntilContact(player: Player, bill: Enemy): number {
  const gap = Math.max(0, Math.abs(bill.position.x - player.position.x) - CONTACT);
  const speed = bill.hot ? ATTACKS.bill.lanceSpeedHot : ATTACKS.bill.lanceSpeed;
  const tell = bill.phase === 'telegraph' ? bill.phaseTimer : 0;
  return tell + gap / speed;
}

describe('the floor is not an option', () => {
  it('a Knight who stands still is caught inside the first ten seconds', () => {
    const run = play(30, () => IDLE);
    expect(run.survivedSeconds).toBeLessThan(10);
  });

  it('and running away does not help — the pass crosses everything', () => {
    const run = play(30, () => press({ left: true }));
    expect(run.survivedSeconds).toBeLessThan(20);
  });
});

describe('being airborne is', () => {
  /**
   * Jump at the tell, timed so her feet are over his head when the charge
   * arrives — the read the whole attack is built to teach.
   */
  function jumpTheLance(): (p: Player, b: Enemy) => InputFrame {
    return (player, bill) => {
      // Hold all the way up, the way a person does. Letting go at
      // jumpHoldMax fires HK's jump CUTOFF (vy snaps to 0) and the hop tops
      // out around 133 px — under Bill's 160 px head. Clearing him is a
      // committed jump, not a tap, and that is a real thing the fight asks
      // for rather than an artefact of the bot.
      if (!player.grounded) return press({ jumpHeld: player.velocity.y < 0 });

      const committed = bill.attackKind === 'lance' && bill.phase !== 'idle';
      if (committed && secondsUntilContact(player, bill) <= JUMP_LEAD_SECONDS) {
        return press({ jumpPressed: true, jumpHeld: true });
      }
      return IDLE;
    };
  }

  it('a Knight who jumps at the tell survives every pass for half a minute', () => {
    const run = play(30, jumpTheLance());
    expect(run.survivedSeconds).toBe(30);
    // Several full cycles, not one lucky escape.
    expect(run.lancesDodged).toBeGreaterThanOrEqual(4);
  });
});

/**
 * The shake-off, played out.
 *
 * She starts where a pogo chain would put her — airborne, directly over his
 * head — because getting there is the duelist's and warden's lesson, not
 * this one. What is under test is what happens NEXT.
 */
describe('one hit, then get out', () => {
  const OVER_HIS_HEAD = { playerAt: { x: 600, y: FLOOR_Y - 250 }, billAt: 600 };

  it('gives her the first bounce and lets her leave with it', () => {
    let bounced = false;
    const run = play(
      1.6,
      (player) => {
        if (player.totalPogos > 0) bounced = true;
        // Bounce once, then run — the ratified answer to this attack.
        return bounced ? press({ left: true }) : downslash();
      },
      OVER_HIS_HEAD,
    );
    expect(bounced).toBe(true);
    expect(run.survivedSeconds).toBe(1.6);
  });

  it('punishes a chain — his head is not a platform', () => {
    const run = play(2.5, () => downslash(), OVER_HIS_HEAD);
    expect(run.survivedSeconds).toBeLessThan(2.5);
    // What actually gets her is his BODY, not the column: a mashed chain
    // desyncs (0.41 s nail cadence against a ~0.6 s bounce) and she drops
    // onto his head, which is a touch because he has no pogo-safe cap
    // (ratified). The shake-off is the backstop for HOVERING, and its own
    // timing and reach are pinned in attackers.test.ts.
    expect(run.caughtBy).toBeNull();
  });
});
