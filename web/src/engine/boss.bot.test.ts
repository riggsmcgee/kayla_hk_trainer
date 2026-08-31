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
import {
  BOSS,
  createBossState,
  startBoss,
  stepBoss,
  stepIntro,
  cardAcceptsInput,
  leaveCard,
} from './boss';
import { BILL_ENTRANCE, entranceSeconds } from './entrance';
import { ATTACKS, ENEMY_SIZES, createEnemy, stepEnemy, stepProjectile } from './enemies';
import type { Projectile } from './enemies';
import type { Enemy } from './enemies';
import { CANVAS, FIXED_DT, KNIGHT } from './constants';
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

  it('and carries that read all the way to 1:30 — the finish line is reachable', () => {
    /**
     * The biggest untested assumption in the project, answered.
     *
     * Every number in this fight was DERIVED against the shipped physics and
     * none of it had been played to the end by anything — so it was possible,
     * right up until this test, that 1:30 untouched was not achievable at all
     * and that the whole ending could never fire.
     *
     * It is achievable against Bill, by a strategy a person can execute: stand
     * still, and commit to a held jump when the lance commits. No dashing, no
     * pogo chain, no frame-perfect anything.
     *
     * What this does NOT prove is the fight she actually plays: the dog joins
     * at 0:30 and this bot never meets him. That is still open — see PLAN.md
     * M6.7 — and the exploration that raised it found a reading bot dying
     * about 2.7 s after he arrives, to BODY CONTACT rather than to an attack.
     */
    const run = play(BOSS.targetSeconds + 1, jumpTheLance());
    expect(run.survivedSeconds).toBeGreaterThan(BOSS.targetSeconds);
    expect(run.caughtBy).toBe(null);
    // Roughly a pass every seven seconds across the whole minute and a half.
    expect(run.lancesDodged).toBeGreaterThanOrEqual(10);
  });

  /** Jump on a fixed beat, holding the ascent, ignoring what Bill is doing. */
  function jumpOnABeat(periodFrames: number, offsetFrames: number): () => InputFrame {
    let frame = -1;
    return () => {
      frame += 1;
      const k = (frame + offsetFrames) % periodFrames;
      return k === 0 ? press({ jumpPressed: true, jumpHeld: true }) : press({ jumpHeld: k < 12 });
    };
  }

  it('but rhythm alone never does — the tell has to be read', () => {
    // Every beat from 0.5 s to 1.5 s, at ten offsets each. The full jump is
    // 1.03 s and only 0.55 s of it clears his head, so a fixed cadence is
    // above him about half the time and has to be lucky several passes
    // running. None of the 210 is.
    const survivors: string[] = [];
    for (let period = 30; period <= 90; period += 3) {
      for (let offset = 0; offset < 40; offset += 4) {
        const run = play(30, jumpOnABeat(period, offset));
        if (run.survivedSeconds === 30) survivors.push(`${period}f+${offset}`);
      }
    }
    expect(survivors).toEqual([]);
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

/**
 * The second half of the fight, run to the end.
 *
 * No bot survives to 0:30 yet (see PLAN.md §8), so nothing else in the suite
 * ever sees the dog arrive, the pair go hot, or the 1:30 crossing happen in a
 * live arena rather than on the clock alone. This harness runs the whole
 * ninety seconds with touches COUNTED rather than fatal — it is a liveness
 * test of the machinery, not a claim that anyone can survive it — and it
 * mirrors `createBossSession`'s step order on purpose, because a bot has to
 * see state the session deliberately hides.
 */
describe('the whole fight, with the touch disarmed', () => {
  function runToTheEnd(seconds: number): {
    touches: number;
    /** All three clocks below are the FIGHT's, not the loop's: the dog's card pauses one and not the other. */
    dogArrivedAt: number;
    dogBones: number;
    dogRolls: number;
    lances: number;
    hotAt: number;
    passedAt: number;
    dogLeftTheArena: boolean;
    billStuckInGeometry: boolean;
  } {
    const world = arenaWorld();
    const player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
    const bill = createEnemy('bill', 868, FLOOR_Y);
    let dog: Enemy | null = null;
    const arena = createArenaState(false);
    arena.started = true;
    const boss = createBossState();
    // Bill’s entrance runs in front of every fight now (playtest 4). It is
    // theatre on a frozen clock, so the bot walks past it rather than
    // simulating it — what it is here to measure starts afterwards.
    stepIntro(boss, entranceSeconds(BILL_ENTRANCE), entranceSeconds(BILL_ENTRANCE));
    startBoss(boss);
    let projectiles: Projectile[] = [];

    const out = {
      touches: 0,
      dogArrivedAt: -1,
      dogBones: 0,
      dogRolls: 0,
      lances: 0,
      hotAt: -1,
      passedAt: -1,
      dogLeftTheArena: false,
      billStuckInGeometry: false,
    };
    let wasCharging = false;
    let wasRolling = false;
    let wasSpitting = false;

    for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
      // The card waits for a press since playtest 10, so a headless bot has to
      // supply one or it sits here until the loop runs out of iterations —
      // never reaching 1:00, never reaching 1:30, and failing for a reason
      // that has nothing to do with the fight. It sits through the lockout
      // first, like she does. The clock is paused throughout, so none of this
      // costs the measurement anything.
      if (boss.phase === 'card') {
        stepBoss(boss, { playerHit: false, untouched: false }, FIXED_DT);
        if (cardAcceptsInput(boss)) leaveCard(boss);
        continue;
      }

      stepPlayer(player, IDLE, world, FIXED_DT);
      const target = { position: player.position, grounded: player.grounded };
      const both = dog ? [bill, dog] : [bill];
      for (const enemy of both) {
        const shots = stepEnemy(enemy, world, FIXED_DT, target);
        if (shots) projectiles.push(...shots);
      }
      for (const shot of projectiles) stepProjectile(shot, world, FIXED_DT);

      // The touch is counted, not fatal: the arena state is rebuilt every
      // step so one contact does not freeze the rest of the run.
      const events = stepArena(createArenaState(false), player, both, FIXED_DT, projectiles);
      projectiles = projectiles.filter((sh) => !sh.dead);
      if (events.playerHit) out.touches += 1;

      const charging = bill.attackKind === 'lance' && bill.phase === 'active';
      if (charging && !wasCharging) out.lances += 1;
      wasCharging = charging;
      // Bill must never end a charge inside a wall.
      const half = ENEMY_SIZES.bill.width / 2;
      if (bill.position.x < half - 1 || bill.position.x > CANVAS.width - half + 1) {
        out.billStuckInGeometry = true;
      }

      if (dog) {
        if (dog.roll && !wasRolling) out.dogRolls += 1;
        wasRolling = dog.roll;
        const spitting = dog.attackKind === 'bones' && dog.phase === 'active';
        if (spitting && !wasSpitting) out.dogBones += 1;
        wasSpitting = spitting;
        const dogHalf = ENEMY_SIZES.dog.width / 2;
        if (dog.position.x < dogHalf - 1 || dog.position.x > CANVAS.width - dogHalf + 1) {
          out.dogLeftTheArena = true;
        }
      }

      switch (stepBoss(boss, { playerHit: false, untouched: false }, FIXED_DT)) {
        case 'dog-arrives':
          out.dogArrivedAt = boss.elapsed;
          // Where the session puts him: the far wall, then walked to his mark.
          dog = createEnemy('dog', CANVAS.width - 200, FLOOR_Y);
          break;
        case 'heat':
          out.hotAt = boss.elapsed;
          bill.hot = true;
          if (dog) dog.hot = true;
          break;
        case 'passed':
          out.passedAt = boss.elapsed;
          break;
      }
    }
    return out;
  }

  it('brings the dog in on time and lets him fight', () => {
    const run = runToTheEnd(BOSS.targetSeconds + 5);

    expect(run.dogArrivedAt).toBeGreaterThanOrEqual(BOSS.dogAt);
    expect(run.dogArrivedAt).toBeLessThan(BOSS.dogAt + 0.1);
    // He is in for a full minute; both attacks must actually come out.
    expect(run.dogBones).toBeGreaterThanOrEqual(5);
    expect(run.dogRolls).toBeGreaterThanOrEqual(3);
  });

  /**
   * `untouched: false` is what keeps this harness running past 1:30 now that
   * the finish line ends the fight — and it is the truth about it, not a
   * dodge: this describe block disarms the touch, which is exactly what god
   * mode does, and god mode does not earn the ending (playtest 6). Measuring
   * Bill's behaviour across the full 95 s is the whole point of the bot, so
   * the harness stays on the god-mode path deliberately.
   */
  it('escalates on the clock, and with the touch disarmed runs past 1:30', () => {
    const run = runToTheEnd(BOSS.targetSeconds + 5);
    expect(run.hotAt).toBeGreaterThanOrEqual(BOSS.heatAt);
    expect(run.hotAt).toBeLessThan(BOSS.heatAt + 0.1);
    expect(run.passedAt).toBeGreaterThanOrEqual(BOSS.targetSeconds);
    expect(run.passedAt).toBeLessThan(BOSS.targetSeconds + 0.1);
    // Bill keeps working the whole time rather than parking somewhere.
    expect(run.lances).toBeGreaterThanOrEqual(10);
  });

  it('keeps both of them inside the arena for the whole ninety seconds', () => {
    const run = runToTheEnd(BOSS.targetSeconds + 5);
    expect(run.billStuckInGeometry).toBe(false);
    expect(run.dogLeftTheArena).toBe(false);
  });
});
