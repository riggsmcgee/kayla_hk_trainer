/**
 * The Two Bills — the boss session at the bottom of the well.
 *
 * A survival clock, not a kill. Neither Bill can be damaged, one touch ends
 * the run, and 1:30 is the finish line: reach it untouched and the fight is
 * over, won, and the ending plays here (playtest 6, which struck "the fight
 * keeps escalating past it for a better time").
 *
 * This is its own session rather than a mode on `createDodgeArenaSession`,
 * which is a `stages[]` driver end to end and would fork about ten branches
 * for a fight that shares none of its rules. What IS reused is every piece
 * underneath: the same arena floor, the same juice and edge-carry, the same
 * player, the same `stepArena`, the same draw helpers. The fight's clock and
 * its three thresholds live in engine/boss.ts; this file is the wiring.
 */

import { BOSS, createBossState, startBoss, stepBoss, stepIntro } from './boss';
import {
  ENDING,
  beatElapsed,
  beatProgress,
  castMarks,
  crowdHop,
  createEndingState,
  dogIsFlipping,
  inkWidth,
  promptIsUp,
  reverence,
  stepEnding,
} from './ending';
import type { CastMark, EndingState } from './ending';
import {
  CONFETTI,
  CONFETTI_COLORS,
  CONFETTI_COLORS_SOFT,
  burstConfetti,
  shotHasBurst,
  stepConfetti,
} from './confetti';
import type { ConfettiPiece } from './confetti';
import { endingCopy } from '../copy/ending';
import { fightCopy } from '../copy/fight';
import { ROSTER } from './roster';
import {
  INTRO_FAST_FORWARD,
  arrivalX,
  billEntrance,
  dogArrivalT,
  entranceSeconds,
  stepEntrance,
} from './entrance';
import { dogLook } from './dogLook';
import type { EntranceShape } from './entrance';
import { createArenaState, stepArena } from './arena';
import { CANVAS, FIXED_DT } from './constants';
import { ENEMY_SIZES, createEnemy, stepEnemy, stepProjectile } from './enemies';
import type { Enemy, Projectile } from './enemies';
import { FEEDBACK, LAND_SQUASH_TIME, computeStretch, createEdgeCarry, createJuice } from './juice';
import type { ComfortSettings } from './juice';
import { createPlayer, stepPlayer } from './player';
import {
  COLORS,
  clearCanvas,
  drawEnemy,
  drawGodModeHud,
  drawKnight,
  drawNailSlash,
  drawProjectiles,
  drawWorld,
  lerpVec,
} from './render';
import { formatClock } from './clock';
import { FLOOR_Y, PLAYER_SPAWN_X, bossWorld } from './dodgeArenaSession';
import { recordRun } from '../storage/recordRun';
import { createOverlayGate } from './session';
import type { GameSession, OverlayControls } from './session';
import type { InputFrame, Vec2 } from './types';

/** Where Bill the man is waiting when she walks in. */
const BILL_SPAWN_X = CANVAS.width - 300;
/**
 * Where Bill stands before his entrance begins: past the right edge with his
 * whole 68 px body clear of it.
 *
 * Ratified in playtest 4: he is NOT on screen when the beat opens. The arena
 * is empty but for the Knight, the thumps land while he is still out of
 * frame, and he enters from the RIGHT — the far side from her spawn, and the
 * same side the dog already walks in from, so the well keeps a consistent
 * "they come from over there" geography.
 */
const BILL_OFFSTAGE_X = CANVAS.width + 80;

/** Where the dog stops after walking in, measured from the wall he came through. */
const DOG_WALK_IN_INSET = 200;

export interface BossSessionConfig extends OverlayControls {
  comfort: ComfortSettings;
  /**
   * True once she has already survived 1:30. The HUD then drops the target
   * and shows a bare clock: past that point the fight is about her best time.
   */
  cleared?: boolean;
  /**
   * DEV TOOL: remove in the final build. God mode: neither Bill can touch
   * her, so the clock only stops when she leaves. The run is flagged so a
   * fight nothing could end never becomes her best time.
   */
  godMode?: boolean;
  /**
   * DEV TOOL: remove in the final build. Which of ROLL_VARIANTS the dog
   * rolls with. Defaults to the first.
   */
  rollVariant?: number;
  /**
   * DEV TOOL: remove in the final build. Which of BILL_ENTRANCES plays
   * before the fight. Defaults to the first.
   */
  entranceVariant?: number;
  /**
   * DEV TOOL: remove in the final build. Which of DOG_LOOKS the ball and the
   * bones wear. Defaults to the first.
   */
  dogLook?: number;
  /**
   * DEV TOOL: remove in the final build. Start one step from the finish line,
   * untouched, so the ending can be watched without a flawless 1:30 first.
   *
   * It exists because god mode CANNOT reach the ending by design — a run that
   * absorbed 29 hits has not earned it (playtest 6) — so without this the only
   * way to look at the celebration is to actually beat the fight. The run it
   * produces is flagged exactly like a god-mode run and does NOT mark the stop
   * cleared: a win nobody played must never become her record of beating them.
   */
  playTheEnding?: boolean;
  /** Fires live at the 1:30 crossing, not at the end of the run. */
  onPassed?: () => void;
  /** Fires once per touch, after the run is recorded. */
  onFailed?: () => void;
}

function pressedAnything(input: InputFrame): boolean {
  return input.left || input.right || input.jumpPressed || input.dashPressed || input.attackPressed;
}

/**
 * Hands off every control, for the one place the Knight still has physics but
 * no driver: winning mid-pogo should let her fall and land, not hang in the
 * air for the whole celebration.
 */
const AT_REST: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpPressed: false,
  attackPressed: false,
  dashPressed: false,
};

/** One of the five who walk on for the ending: the body, and where it is going. */
interface CastMember {
  enemy: Enemy;
  mark: CastMark;
  /** Where it stood the instant the walk-on began — off the edge of the arena. */
  fromX: number;
  /**
   * Its x at the end of the PREVIOUS step, so the draw can interpolate like
   * every other body does. A walk-on written straight to `position` and drawn
   * without `alpha` stutters on any display that is not exactly 60 Hz.
   */
  prevX: number;
}

/**
 * How far off the floor she ends up. Chosen so the 48 px Knight clears the
 * kneeling cast with daylight underneath — the picture is that she is ABOVE
 * them — while staying well under the HUD line at the top.
 */
const RISE_HEIGHT = 190;

/**
 * How high the flier holds station in the tableau.
 *
 * It is the one body that does not stand on the floor, and in the fight it
 * aims itself at her CHEST — about 24 px up — which on a still frame reads as
 * a thing resting on the ground rather than hovering. This is roughly its own
 * body height, so the daylight underneath is unmistakable.
 */
const FLIER_HOVER = 56;

/**
 * How high up the arena the volley bursts.
 *
 * Above the Knight's risen head and clear of the HUD line, so the paper falls
 * THROUGH the tableau rather than starting inside it.
 */
const CONFETTI_BURST_Y = 90;

/** Ease-out cubic: everything in the ending decelerates onto its mark. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function createBossSession(config: BossSessionConfig): GameSession {
  const { comfort, jumpKey = () => 'Z', attackKey = () => 'X', onNext, nextLabel } = config;
  const godMode = config.godMode ?? false;
  const devEnding = config.playTheEnding ?? false;
  const world = bossWorld();
  /** Which entrance plays, and how long it runs at normal speed. */
  const entrance = billEntrance(config.entranceVariant ?? 0);
  /** Which hazard markers the dog's ball and bones wear. */
  const look = dogLook(config.dogLook ?? 0);
  const INTRO_SECONDS = entranceSeconds(entrance);
  const juice = createJuice(comfort);
  const edgeCarry = createEdgeCarry();

  let boss = createBossState();
  let ending = createEndingState();
  let arena = createArenaState(false, godMode);
  let player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
  let bill = createEnemy('bill', BILL_OFFSTAGE_X, FLOOR_Y);
  /** Null until 0:30. */
  let dog: Enemy | null = null;
  /**
   * The ending's walk-on cast: the five roster enemies, created at the
   * `gather` beat and never stepped.
   *
   * `stepEnemy` is never called on them and neither is `stepArena`, so they
   * have no AI and no hitboxes — they are a tableau that happens to be made of
   * `Enemy` objects, which is what lets `drawEnemy` paint them with no idea
   * that the fight is over.
   */
  let cast: CastMember[] = [];
  /**
   * The spitter's celebration volley, and the paper it becomes.
   *
   * Only ever written during the cheer. `stepProjectile` cannot drive it —
   * that step has no gravity, deliberately, because a spitter shot must fly
   * true — so confetti has its own step in `confetti.ts`.
   */
  let confetti: ConfettiPiece[] = [];
  /** Seconds since the current shot left the spitter's mouth. */
  let shotAge = 0;
  /** Which shot this is, so consecutive bursts do not stamp one shape. */
  let shotIndex = 0;
  /** Where the dog is heading while his card is up, and how fast. */
  let dogWalkTo = 0;
  let dogWalkFrom = 0;
  /** 0 → 1 across the dog’s card; the variant’s curve shapes the walk. */
  let dogWalkT = 0;
  let projectiles: Projectile[] = [];

  let simTime = 0;
  let hitFlash = 0;
  /** God mode: hits she did not take this run, and the toast that says so. */
  let phantomHits = 0;
  let godToast = 0;
  let landSquash = 0;
  let wasGrounded = true;
  const overGate = createOverlayGate();
  /**
   * The ending's own gate. Separate from `overGate` because they guard
   * opposite screens — a run that is won can never reach the fail screen — and
   * because this one is not armed until the PROMPT appears at 19.5 s, which is
   * what makes the whole ending unskippable without any machinery of its own.
   */
  const winGate = createOverlayGate();
  /** One-shot: the gate is armed by the prompt appearing, and only once. */
  let promptShown = false;
  /** One-shot: she has taken the forward door out of the fight for good. */
  let leaving = false;
  /** Where she was standing when the rise began; the lift interpolates from it. */
  const riseFrom: Vec2 = { x: 0, y: 0 };
  let startedAtIso = '';

  const prevFeet: Vec2 = { ...player.position };
  const prevBillFeet: Vec2 = { ...bill.position };
  const prevDogFeet: Vec2 = { x: 0, y: 0 };

  function restart(): void {
    overGate.arm();
    boss = createBossState();
    ending = createEndingState();
    arena = createArenaState(false, godMode);
    player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
    bill = createEnemy('bill', BILL_OFFSTAGE_X, FLOOR_Y);
    dog = null;
    cast = [];
    confetti = [];
    shotAge = 0;
    shotIndex = 0;
    promptShown = false;
    leaving = false;
    projectiles = [];
    hitFlash = 0;
    phantomHits = 0;
    godToast = 0;
    startedAtIso = '';
    prevFeet.x = player.position.x;
    prevFeet.y = player.position.y;
    prevBillFeet.x = bill.position.x;
    prevBillFeet.y = bill.position.y;
    if (devEnding) jumpToTheFinish();
  }

  /**
   * DEV TOOL: remove in the final build. Wind the whole fight forward to half
   * a step short of 1:30, with the dog already on his mark and both Bills hot,
   * so the very next step crosses the finish line untouched.
   *
   * Deliberately reuses `bringInTheDog` and the real thresholds rather than
   * hand-placing a tableau: a dev shortcut that builds its own version of the
   * state is a dev shortcut that shows you something the game cannot produce.
   */
  function jumpToTheFinish(): void {
    boss.phase = 'fighting';
    boss.introElapsed = INTRO_SECONDS;
    boss.elapsed = BOSS.targetSeconds - FIXED_DT / 2;
    boss.dogIn = true;
    boss.hot = true;
    arena.started = true;
    startedAtIso = new Date().toISOString();
    bill.hot = true;
    bill.position.x = BILL_SPAWN_X;
    prevBillFeet.x = BILL_SPAWN_X;
    bringInTheDog();
    if (dog) {
      dog.position.x = dogWalkTo;
      dog.walkingIn = false;
      dog.hot = true;
      prevDogFeet.x = dogWalkTo;
    }
  }

  /**
   * The dog comes in through the wall she is furthest from, so he never
   * appears on top of her, and walks to his mark over the length of his card.
   * His position is set directly rather than drifted: he starts outside the
   * arena wall, and `drift` correctly refuses to walk a body through geometry.
   */
  function bringInTheDog(): void {
    const fromRight = player.position.x < CANVAS.width / 2;
    const startX = fromRight ? CANVAS.width + 80 : -80;
    dogWalkTo = fromRight ? CANVAS.width - DOG_WALK_IN_INSET : DOG_WALK_IN_INSET;
    dogWalkFrom = startX;
    dogWalkT = 0;
    dog = createEnemy('dog', startX, FLOOR_Y);
    dog.walkingIn = true;
    dog.rollVariantIndex = config.rollVariant ?? 0;
    dog.facing = fromRight ? -1 : 1;
    prevDogFeet.x = startX;
    prevDogFeet.y = FLOOR_Y;
  }

  function walkTheDogIn(dt: number): void {
    if (!dog) return;
    // The card branch returns before the fighting path takes its snapshot,
    // so this is the only place his previous position can be advanced.
    // Without it render lerps from the off-screen start he was pinned to and
    // he is not drawn on the card at all — invisible on a 60 Hz display,
    // oscillating on a faster one.
    prevDogFeet.x = dog.position.x;
    prevDogFeet.y = dog.position.y;
    dogWalkT = Math.min(1, dogWalkT + dt / BOSS.cardSeconds);
    // Stepped like everything else the Bills do: the curve shapes the pace,
    // and the result lands on a whole 4 px step from his mark.
    dog.position.x = arrivalX(dogWalkFrom, dogWalkTo, dogArrivalT(entrance, dogWalkT));
  }

  function record(): void {
    // No enemyId and no wave, deliberately: that is what keeps arenaBest and
    // waveBest from ever picking a boss run up as one of theirs.
    recordRun({
      mode: 'dodge',
      boss: true,
      // The dev ending rides the god-mode flag, which is exactly what that
      // flag means: a fight nothing could end never becomes her best time.
      godMode: godMode || devEnding || undefined,
      cleared: boss.passed,
      hitsLanded: 0,
      durationMs: Math.round(boss.elapsed * 1000),
      startedAt: startedAtIso || new Date().toISOString(),
    });
  }

  /** Both Bills, in list order, for the loops that treat them the same. */
  function bills(): Enemy[] {
    return dog && boss.dogIn ? [bill, dog] : [bill];
  }

  /**
   * What `stepBoss` needs to know about this step.
   *
   * `untouched` is the fact god mode hides: a hit she "did not take" still
   * happened, so a god-mode run that reached 1:30 having eaten 29 of them must
   * not be handed the ending (playtest 6). `phantomHits` is only ever written
   * in god mode, so in normal play this is true by construction — which is
   * correct, because one touch would have ended the run long before 1:30.
   */
  function bossInput(playerHit: boolean): { playerHit: boolean; untouched: boolean } {
    return { playerHit, untouched: phantomHits === 0 };
  }

  /**
   * The clock has just stopped at 1:30 and both Bills STOP — they do not
   * kneel. The kneel is seven and a half seconds away.
   *
   * This is playtest 7's correction to 66a89ac, and it is the whole sequence:
   * a Bill on one knee at 1:30 tells her she has won, and the walk-on that
   * follows then has nothing left to frighten her with. What happens here is
   * the stop and the shout. Bill's foam finger goes up — `summon` draws as
   * `swatTell`, the windup she has spent ninety seconds learning to fear — and
   * he calls for everybody.
   *
   * Planting them matters as much as the pose does: at 1:30 the man can be
   * mid-lance and the dog can be a ball in mid-air, and a stopped Bill drawn
   * where a rolling one was is a body floating two thirds of the way up the
   * arena. Everything in flight is cleared for the same reason — a bone that
   * outlived the fight would be the one lethal-looking thing left on a screen
   * that has just stopped being a fight.
   */
  function theyStop(): void {
    projectiles = [];
    for (const b of bills()) {
      b.celebrating = 'summon';
      b.roll = false;
      b.velocity.x = 0;
      b.velocity.y = 0;
      b.position.y = FLOOR_Y;
      // Both of them turn to face her. Every pose from here is "up to HER",
      // so a Bill addressing the wall would throw the whole tableau away.
      b.facing = player.position.x < b.position.x ? -1 : 1;
    }
  }

  /**
   * The five walk on, from both walls at once.
   *
   * Created here rather than at the win so that nothing exists during the
   * `stop` beat: the fear depends on the arena being empty at the moment Bill
   * shouts, and a body already standing off-frame is one `drawEnemy` call away
   * from being visible.
   *
   * Their marks come from `castMarks`, which is given every x already
   * occupied — hers and both Bills' — so nobody walks into anybody. The Bills
   * do NOT walk: they are planted where the fight left them.
   */
  function gatherTheCast(): void {
    const taken = [player.position.x, ...bills().map((b) => b.position.x)];
    cast = castMarks(
      ROSTER.map((r) => r.id),
      taken,
    ).map((mark) => {
      // The flier is the one body that does not stand on the floor. It keeps
      // the same hover it fights at, so the tableau reads as the cast she
      // knows rather than as five things placed on a line.
      const markY = mark.id === 'flier' ? FLOOR_Y - FLIER_HOVER : FLOOR_Y;
      const half = inkWidth(mark.id) / 2;
      const fromX = mark.fromLeft ? -half - 20 : CANVAS.width + half + 20;
      const enemy = createEnemy(mark.id, fromX, markY);
      // Facing the wall they are walking away from would read as retreating.
      enemy.facing = mark.fromLeft ? 1 : -1;
      return { enemy, mark, fromX, prevX: fromX };
    });
  }

  /** Slide the walk-on cast from the walls onto their marks, easing in to a stop. */
  function walkTheCastOn(t: number): void {
    const eased = easeOut(t);
    for (const c of cast) {
      c.prevX = c.enemy.position.x;
      c.enemy.position.x = c.fromX + (c.mark.x - c.fromX) * eased;
    }
  }

  /**
   * Everyone goes down to her, the Bills included.
   *
   * The Bills use their own painted poses — the man's knee, the dog's
   * lie-down — because they have them. The other five are bowed by a
   * TRANSFORM at draw time instead (see `drawReverent`), which is what keeps
   * `drawEnemy` from ever learning that the fight ended.
   */
  function theyConcede(): void {
    for (const b of bills()) {
      b.celebrating = 'concede';
      b.facing = player.position.x < b.position.x ? -1 : 1;
    }
    for (const c of cast) c.enemy.facing = player.position.x < c.enemy.position.x ? -1 : 1;
  }

  /**
   * The five stand up and join in.
   *
   * All it does is turn them back toward her, and that is not redundant with
   * the kneel: she DRIFTS to the horizontal centre as she rises, so a body
   * that was on her left through the whole fake-out can be on her right by
   * the time the applause starts, still facing the wall she left.
   *
   * Their celebration itself is `crowdHop`, at draw time. PLAN.md §8's
   * ratified party states were built and rejected on sight — see the note on
   * `crowdHop` in ending.ts.
   */
  function theyCelebrate(): void {
    for (const c of cast) {
      const e = c.enemy;
      e.facing = player.position.x < e.position.x ? -1 : 1;
    }
  }

  /**
   * The spitter fires straight up, and the shot bursts into paper at the top.
   *
   * Ratified: "the spitter re-fires on a ~2 s cycle so something is always
   * drifting through the held tableau." The cheer runs until she presses
   * forward, so this has to be a CYCLE rather than a one-off — and every piece
   * has to expire, or a celebration she sits in for two minutes grows a list
   * that never stops.
   *
   * Nothing here can hurt her. It is drawn paper, not a projectile: it never
   * enters `projectiles`, so `stepArena` never sees it and it has no hitbox
   * to switch off.
   */
  function fireTheVolley(dt: number): void {
    confetti = stepConfetti(confetti, dt);

    const spitter = cast.find((c) => c.enemy.id === 'spitter');
    if (!spitter) return;

    shotAge += dt;
    // The shot climbs from the spitter's mouth to a burst height near the top
    // of the arena; the sky above it is the only empty part of this tableau.
    const mouth = spitter.enemy.position.y - ENEMY_SIZES.spitter.height;
    const climb = mouth - CONFETTI_BURST_Y;
    if (shotHasBurst(shotAge, climb)) {
      confetti = [
        ...confetti,
        ...burstConfetti(spitter.enemy.position.x, CONFETTI_BURST_Y, shotIndex),
      ];
      shotIndex += 1;
      shotAge -= CONFETTI.cycleSeconds;
    }
  }

  /**
   * She lifts off the floor and drifts to the horizontal centre.
   *
   * Written into `player.position`, NEVER into the draw call: `render` lerps
   * `prevFeet → player.position` by `alpha`, so a rise applied only at draw
   * time jitters on any display that is not exactly 60 Hz. That is the same
   * class of bug that made the dog invisible on his own card (cda951e).
   */
  function liftHer(t: number, riseFrom: Vec2): void {
    const eased = easeOut(t);
    player.position.x = riseFrom.x + (CANVAS.width / 2 - riseFrom.x) * eased;
    player.position.y = riseFrom.y - RISE_HEIGHT * eased;
  }

  if (devEnding) jumpToTheFinish();

  return {
    step(rawInput: InputFrame, dt: number): void {
      simTime += dt;
      juice.update(dt);
      if (juice.frozen()) {
        edgeCarry.absorb(rawInput);
        return;
      }

      // Bill's entrance (playtest 4, note 4). Everything holds — the fight's
      // clock has not started and the Knight cannot move, so the beat costs
      // her nothing. Holding jump does NOT skip it; it runs it at 2.5x, so
      // an impatient twentieth attempt still gets the theatre, briefly.
      //
      // The raw frame is read and the carry is neither absorbed nor merged,
      // for the same reason the card branch does it: the hold that
      // fast-forwarded the intro must not also arrive as a jump on the
      // fight's first frame.
      if (boss.phase === 'intro') {
        const rate = rawInput.jumpHeld || rawInput.jumpPressed ? INTRO_FAST_FORWARD : 1;
        const before = boss.introElapsed;
        stepIntro(boss, INTRO_SECONDS, dt * rate);
        const beat = stepEntrance(entrance, before, boss.introElapsed);
        if (beat.thumped) juice.addTrauma(FEEDBACK.enemyDeath.trauma);
        bill.position.x =
          beat.beat === 'thumps'
            ? BILL_OFFSTAGE_X
            : arrivalX(
                BILL_OFFSTAGE_X,
                BILL_SPAWN_X,
                beat.beat === 'arrival' ? beat.progress : 1,
                entrance.style,
              );
        return;
      }

      // The card. Everything holds, including the clock, and NOTHING she
      // can press shortens it (playtest 6, note 5).
      //
      // It used to take any key as a skip. `pressedAnything` reads held
      // direction keys as level state, so the step after the card went up saw
      // the key she was already holding and dismissed it: the card was on
      // screen for one simulation step, 16.7 ms of its 2.5 s, and she had
      // never once seen the dog arrive. Bill the man's entrance is already
      // unskippable at 2.8 s — 139% of the length of the fight, about 114
      // times per ten minutes of grinding — so an unskippable beat here is
      // affordable, and this one costs her nothing at all because the clock
      // is paused for it.
      //
      // The raw frame is still read and the carry is NEITHER absorbed nor
      // merged: whatever she is holding while she watches must not arrive as
      // a jump on the fight's first frame. That is verbatim the bug playtest
      // 2 fixed.
      if (boss.phase === 'card') {
        walkTheDogIn(dt);
        stepBoss(boss, bossInput(false), dt);
        if (boss.phase !== 'card' && dog) {
          dog.position.x = dogWalkTo;
          dog.walkingIn = false;
        }
        return;
      }

      // She reached 1:30 untouched, and this is the whole ending.
      //
      // Damage resolution is not "switched off" here — `stepArena`, `stepEnemy`
      // and `stepProjectile` are simply never reached from this branch, so a
      // Bill kneeling at her feet is harmless by construction rather than by
      // anyone remembering to disarm him. That is the distinction playtest 6
      // ratified: the fight is OVER, not paused, so this is not a reopening of
      // the immunity window struck twice before.
      //
      // Nothing she can press shortens the knee: the gate is not armed until
      // the cheer beat starts.
      if (boss.phase === 'won') {
        prevFeet.x = player.position.x;
        prevFeet.y = player.position.y;
        // She keeps her physics until the rise takes her over, so winning
        // mid-pogo lets her fall and land rather than hang in the air.
        if (ending.beat !== 'rise' && ending.beat !== 'cheer' && !player.grounded) {
          stepPlayer(player, AT_REST, world, dt);
        }

        // Magic once, a tax afterwards. Twenty seconds is 7.1x Bill's
        // entrance, so the FIRST win is protected completely and every win
        // after it can be hurried by holding forward — the same bargain
        // `stepIntro` already strikes, at the same 2.5x.
        //
        // `config.cleared` is `clearedBefore` in PlayWell: read once with
        // `useState` and frozen for the life of the beat. It must NEVER become
        // a live read of `progress.finaleBossCleared`, which `onPassed()` sets
        // at the moment she wins — a live dependency there rebuilds the
        // session mid-celebration, which is verbatim the defect fixed in
        // 819c0ea.
        const hurrying = (config.cleared ?? false) && rawInput.jumpHeld;
        switch (stepEnding(ending, hurrying ? dt * INTRO_FAST_FORWARD : dt)) {
          case 'gather':
            gatherTheCast();
            break;
          case 'kneel':
            theyConcede();
            break;
          case 'rise':
            // Frozen at the moment the lift begins: `liftHer` interpolates
            // from here every step, so reading her live position would make
            // the rise chase its own tail and never arrive.
            riseFrom.x = player.position.x;
            riseFrom.y = player.position.y;
            break;
          case 'cheer':
            for (const b of bills()) b.celebrating = 'applaud';
            theyCelebrate();
            break;
        }

        if (ending.beat === 'cheer') fireTheVolley(hurrying ? dt * INTRO_FAST_FORWARD : dt);
        if (ending.beat === 'gather') walkTheCastOn(beatProgress(ending));
        if (ending.beat === 'rise') liftHer(beatProgress(ending), riseFrom);
        // The punchline, three seconds into the applause. He claps with
        // everybody first so the flip lands as a joke rather than as texture,
        // and it gives the held tableau a beat change instead of one picture.
        if (dog && dog.celebrating === 'applaud' && dogIsFlipping(ending)) {
          dog.celebrating = 'flip';
        }

        // The gate is armed by the PROMPT, not by the cheer — she is not asked
        // to press anything until she has been told what to press. That is
        // what makes the whole 19.5 s unskippable rather than the knee alone.
        if (promptIsUp(ending)) {
          if (!promptShown) {
            promptShown = true;
            winGate.arm();
          }
          const pressing = rawInput.attackPressed || rawInput.jumpPressed;
          if (winGate.open(dt, pressing) && pressing && !leaving) {
            // `jump = forward, attack = again`, ratified on every overlay in
            // the dojo. Until now this screen broke that rule — both keys
            // restarted the fight, because there was nowhere forward to go.
            // There is now, and it is the last screen of the whole thing.
            if (rawInput.jumpPressed && onNext) {
              // Latched. `restart()` ends its own branch by changing the
              // state underneath it; leaving does not — the page navigates
              // away on its own clock, and until it does this branch keeps
              // running. Without the latch a held key fires the handoff on
              // every frame between the press and the unmount.
              leaving = true;
              onNext();
            } else {
              restart();
            }
          }
        }
        return;
      }

      // Both keys retry. There is no forward from a run she just lost, and a
      // dead Z would read as broken.
      //
      // This screen used to trust the 0.15 s hit-stop to eat her reflex press
      // and had no guard of its own. It loses to a mashing thumb, so it goes
      // through the same gate as every other end screen now (playtest 5).
      if (boss.phase === 'over') {
        const pressing = rawInput.attackPressed || rawInput.jumpPressed;
        if (overGate.open(dt, pressing) && pressing) restart();
        return;
      }

      const input = edgeCarry.merge(rawInput);
      hitFlash = Math.max(0, hitFlash - dt);
      godToast = Math.max(0, godToast - dt);
      landSquash = Math.max(0, landSquash - dt);

      if (boss.phase === 'ready' && pressedAnything(input)) {
        startBoss(boss);
        arena.started = true;
        startedAtIso = new Date().toISOString();
      }

      prevFeet.x = player.position.x;
      prevFeet.y = player.position.y;
      prevBillFeet.x = bill.position.x;
      prevBillFeet.y = bill.position.y;
      if (dog) {
        prevDogFeet.x = dog.position.x;
        prevDogFeet.y = dog.position.y;
      }

      const pogosBefore = player.totalPogos;
      stepPlayer(player, input, world, dt);
      if (!wasGrounded && player.grounded) landSquash = LAND_SQUASH_TIME;
      wasGrounded = player.grounded;

      // Nobody moves until she does — reading the arena is free.
      if (boss.phase === 'fighting') {
        const target = { position: player.position, grounded: player.grounded };
        for (const enemy of bills()) {
          const shots = stepEnemy(enemy, world, dt, target);
          if (shots) projectiles.push(...shots);
        }
        for (const shot of projectiles) stepProjectile(shot, world, dt);
      }

      const events = stepArena(arena, player, bills(), dt, projectiles);
      projectiles = projectiles.filter((s) => !s.dead);
      if (events.wouldHaveHit) {
        // Trauma but no hit-stop: she is being told, not interrupted.
        phantomHits += 1;
        godToast = 1.1;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
      }
      // Only the pogo can fire here: the Bills never take a hit and never
      // die, so nailHit and enemyDeath have nothing to react to.
      if (player.totalPogos > pogosBefore) {
        juice.addTrauma(FEEDBACK.pogo.trauma);
        juice.hitStop(FEEDBACK.pogo.hitStop);
      }
      // The volley is a secret, so the FEEL is the only thing that tells her
      // it worked. It is the loudest confirmation in the fight for that reason.
      if (events.rallied) {
        juice.addTrauma(FEEDBACK.rally.trauma);
        juice.hitStop(FEEDBACK.rally.hitStop);
      }

      switch (stepBoss(boss, bossInput(events.playerHit), dt)) {
        case 'dog-arrives':
          bringInTheDog();
          break;
        case 'heat':
          bill.hot = true;
          if (dog) dog.hot = true;
          break;
        // 1:30, untouched: the finish line. `record()` moves here from the
        // `over` branch it used to live in alone — `over` is unreachable once
        // the fight ends at 1:30, so a win that did not record would be a run
        // that left no PracticeRun at all.
        case 'won':
          theyStop();
          juice.addTrauma(FEEDBACK.courseClear.trauma);
          record();
          // A win nobody played must not become her record of beating them.
          if (!devEnding) config.onPassed?.();
          break;
        // God mode only: the clock passed 1:30 but she was touched getting
        // there, so the fight runs on exactly as it always did.
        case 'passed':
          config.onPassed?.();
          break;
        case 'over':
          overGate.arm();
          hitFlash = 0.5;
          juice.addTrauma(FEEDBACK.playerHit.trauma);
          juice.hitStop(FEEDBACK.playerHit.hitStop);
          record();
          config.onFailed?.();
          break;
      }
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      const shake = juice.shakeOffset(simTime);

      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawWorld(ctx, world);
      // The walk-on cast, behind the Bills: they are the crowd, and a warden
      // drawn over Bill's 160 px body would read as standing in front of him.
      const bow = reverence(ending);
      const partying = boss.phase === 'won' && ending.beat === 'cheer';
      for (const [i, c] of cast.entries()) {
        const feetAt = {
          x: c.prevX + (c.enemy.position.x - c.prevX) * alpha,
          y: c.enemy.position.y - (partying ? crowdHop(simTime, i) : 0),
        };
        drawReverent(ctx, feetAt, bow, c.enemy.facing, () =>
          drawEnemy(ctx, feetAt, c.enemy, simTime, 0),
        );
      }
      drawEnemy(ctx, lerpVec(prevBillFeet, bill.position, alpha), bill, simTime, 0);
      if (dog)
        drawEnemy(ctx, lerpVec(prevDogFeet, dog.position, alpha), dog, simTime, 0, look.ring);
      drawProjectiles(ctx, projectiles, look.boneSteps);
      drawConfetti(ctx, confetti, comfort.reduceFlashing);
      drawNailSlash(ctx, feet, player);
      drawKnight(ctx, feet, player, computeStretch(player.velocity.y, landSquash));
      ctx.restore();

      // --- HUD: the clock is the whole score. No hits line, ever. ---
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudText;
      const target = config.cleared ? null : formatClock(BOSS.targetSeconds);
      ctx.fillText(fightCopy.hudClock(formatClock(boss.elapsed), target), 16, 14);
      if (boss.hot && boss.phase !== 'won') {
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(fightCopy.hudHot, 16, 50);
      }
      ctx.textAlign = 'right';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudDim;
      // "and they never touched you" is WIN TEXT, and it may not appear until
      // the cast is applauding — found by watching the sequence rather than by
      // a test, which is the whole reason the ending gets watched. For the
      // thirteen seconds she is supposed to believe she is in trouble, the HUD
      // keeps saying exactly what it said during the fight.
      ctx.fillText(
        boss.phase === 'won'
          ? ending.beat === 'cheer'
            ? endingCopy.hudNeverTouched
            : fightCopy.hudSubtitle
          : // Only reachable in god mode now: 1:30 ends the fight otherwise.
            boss.passed
            ? fightCopy.hudPastTarget
            : fightCopy.hudSubtitle,
        CANVAS.width - 16,
        14,
      );

      if (hitFlash > 0) {
        ctx.fillStyle = comfort.reduceFlashing
          ? `rgba(7, 9, 18, ${0.3 * (hitFlash / 0.5)})`
          : `rgba(233, 228, 213, ${0.35 * (hitFlash / 0.5)})`;
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      }

      if (boss.phase === 'intro') {
        const beat = stepEntrance(entrance, boss.introElapsed, boss.introElapsed);
        if (beat.beat === 'thumps') {
          // Nothing but the Knight and a floor that will not stop moving.
          // The line is deliberately not his name: she should be looking at
          // the empty right-hand side of the arena, wondering.
          ctx.textAlign = 'center';
          ctx.fillStyle = COLORS.hudDim;
          ctx.font = '19px system-ui, sans-serif';
          ctx.fillText(fightCopy.introSomethingComing, CANVAS.width / 2, CANVAS.height / 2 - 40);
        } else if (beat.beat === 'name') {
          drawCard(ctx, fightCopy.billName, fightCopy.billLine, 0.7 * beat.progress);
        }
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.hudDim;
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(fightCopy.introHurry(jumpKey()), CANVAS.width - 16, CANVAS.height - 26);
      } else if (boss.phase === 'ready') {
        drawCard(ctx, fightCopy.billName, fightCopy.billLine, 0.7);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudDim;
        ctx.font = '17px system-ui, sans-serif';
        ctx.fillText(fightCopy.readyLine, CANVAS.width / 2, CANVAS.height / 2 + 76);
      } else if (boss.phase === 'card') {
        drawBarking(ctx, 1 - boss.cardTimer / BOSS.cardSeconds, bill.position.x, entrance);
        drawCard(ctx, fightCopy.dogName, fightCopy.dogLine, 0.7);
      } else if (boss.phase === 'won') {
        drawEnding(
          ctx,
          ending,
          bill.position.x,
          config.cleared ?? false,
          onNext ? (nextLabel ?? endingCopy.whatsNext) : null,
          jumpKey,
          attackKey,
        );
      } else if (boss.phase === 'over') {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.78)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(fightCopy.failHeadline, CANVAS.width / 2, CANVAS.height / 2 - 70);
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          boss.passed
            ? fightCopy.failTimePastTarget(formatClock(boss.elapsed))
            : fightCopy.failTime(formatClock(boss.elapsed)),
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(
          onNext
            ? fightCopy.failPromptWithNext(
                attackKey(),
                jumpKey(),
                nextLabel ?? fightCopy.nextStopFallback,
              )
            : fightCopy.failPrompt(attackKey()),
          CANVAS.width / 2,
          CANVAS.height / 2 + 24,
        );
      }

      // Last, so it survives the card and fail washes above.
      if (godMode) drawGodModeHud(ctx, phantomHits, godToast, comfort.reduceFlashing);
    },
  };
}

/**
 * The confetti, drawn.
 *
 * Squares on whole 4 px coordinates, because everything else in this fight is:
 * paper that slid smoothly past a cast drawn in whole cells would be the one
 * thing on screen from a different medium.
 *
 * `reduceFlashing` swaps the palette for a softened one rather than dropping
 * the confetti. The ratified line is that she still gets her party — the
 * setting exists to stop things flashing at her, and steady paper falling
 * down a screen is not that.
 */
function drawConfetti(
  ctx: CanvasRenderingContext2D,
  pieces: readonly ConfettiPiece[],
  reduceFlashing: boolean,
): void {
  if (pieces.length === 0) return;
  const palette = reduceFlashing ? CONFETTI_COLORS_SOFT : CONFETTI_COLORS;
  const step = (v: number) => Math.round(v / 4) * 4;
  for (const p of pieces) {
    ctx.fillStyle = palette[p.color] ?? palette[0]!;
    ctx.fillRect(step(p.x), step(p.y), CONFETTI.size, CONFETTI.size);
  }
}

/**
 * Bow a body toward the Knight, whatever shape it happens to be.
 *
 * The ratified alternative was five new painters, and it was rejected for a
 * reason that survives contact with the art: a walker is a shell with leg
 * nubs, a flier is a hovering ball, a spitter has no legs. None of them has a
 * knee to bend. What they all have is a footprint and a facing, so the
 * reverence is a TRANSFORM about the feet — sink, then tip forward — and it
 * reads as deference on all five without `drawEnemy` ever learning that the
 * fight ended.
 *
 * It is also the honest answer for the flier: a hovering thing that sinks and
 * tips is exactly what a bow looks like when you have no legs to kneel on.
 */
function drawReverent(
  ctx: CanvasRenderingContext2D,
  feet: Vec2,
  bow: number,
  facing: number,
  paint: () => void,
): void {
  if (bow <= 0) {
    paint();
    return;
  }
  ctx.save();
  // Rotate about the FEET, not the centre: a body pivoting about its middle
  // sinks its head and lifts its base, which reads as falling over.
  //
  // The tip is signed by facing, so every body leans toward HER rather than
  // all of them leaning the same way down the screen. A cast bowing east in
  // unison is a chorus line; a cast bowing inward is a court.
  ctx.translate(feet.x, feet.y + REVERENCE_SINK * bow);
  ctx.rotate(REVERENCE_TIP * bow * Math.sign(facing || 1));
  ctx.translate(-feet.x, -feet.y);
  paint();
  ctx.restore();
}

/** How far a bowing body sinks toward the floor, fully bowed. */
const REVERENCE_SINK = 10;
/**
 * How far it tips forward, fully bowed. About 22°: enough to be unmistakably
 * a bow at a glance, shallow enough that a 26 px walker does not look like it
 * has fallen on its face.
 */
const REVERENCE_TIP = 0.38;

/**
 * Bill calls for help, and the answer arrives from off-screen.
 *
 * There is no audio anywhere in this project — no `Audio`, no Web Audio, no
 * sound files — so the barking is DRAWN. Bill shouts in his own lettering
 * and "WOOF!" comes in from the right edge with motion lines behind it,
 * which is the same right edge both Bills walk in from.
 *
 * Stepped, like everything else the Bills do: the shout and the woof move in
 * whole 4 px jumps on a floored clock, never interpolated. That constraint
 * is what the user picked these designs FOR (PLAN.md §3), and an entrance
 * that glided would be the one place the fight stops honouring it.
 */
function drawBarking(
  ctx: CanvasRenderingContext2D,
  progress: number,
  billX: number,
  shape: EntranceShape,
): void {
  const step = (v: number) => Math.round(v / 4) * 4;
  ctx.textAlign = 'center';
  ctx.font = '22px system-ui, sans-serif';

  // Bill's shout comes first and stays up.
  if (progress > shape.dogShoutAt) {
    const bob = step(Math.floor(progress * 8) % 2 === 0 ? 0 : 4);
    ctx.fillStyle = COLORS.hudText;
    // Clamped inward: Bill can be standing against either wall when the
    // dog is due, and a shout that runs off the edge of the canvas reads as
    // a rendering bug rather than as a shout.
    drawShout(ctx, fightCopy.billShout, billX, bob);
  }

  // The woof crosses in from the right edge over the back half of the card.
  if (progress > shape.dogWoofAt) {
    const t = Math.min(1, (progress - shape.dogWoofAt) / 0.45);
    const x = step(CANVAS.width + 40 + (CANVAS.width * 0.45 - CANVAS.width - 40) * t);
    const y = step(FLOOR_Y - 150);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(fightCopy.dogAnswer, x, y);
    ctx.strokeStyle = COLORS.hudDim;
    ctx.lineWidth = 3;
    for (const dy of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.moveTo(x + 56, y + dy);
      ctx.lineTo(x + 56 + step(28 + dy * 0.6), y + dy);
      ctx.stroke();
    }
  }
}

/**
 * A word out of Bill's mouth, in his own lettering.
 *
 * Pulled out of `drawBarking` so the ending's summons can use it without
 * reusing the WOOF that answers it: at 0:30 the second stage flies in from the
 * right edge because it comes from someone else, and at 1:30 both stages are
 * Bill's own voice and belong over Bill's own head.
 *
 * Clamped inward: he can be standing against either wall when a shout is due,
 * and one that runs off the canvas reads as a rendering bug rather than as a
 * shout.
 */
function drawShout(ctx: CanvasRenderingContext2D, text: string, billX: number, bob: number): void {
  ctx.textAlign = 'center';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudText;
  const step = (v: number) => Math.round(v / 4) * 4;
  ctx.fillText(
    text,
    step(Math.min(Math.max(billX, 90), CANVAS.width - 90)),
    step(FLOOR_Y - 200) + bob,
  );
}

/**
 * The ending, drawn.
 *
 * Deliberately the LIGHTEST wash in the file — 0.34 against the fail screen's
 * 0.78. The fail screen is hiding a fight she lost; this one is the only thing
 * on the site she is meant to look AT, and a Bill on one knee behind an opaque
 * sheet is a beat nobody sees (playtest 6 flagged exactly this).
 *
 * The knee gets no text of its own for its first second: the pose is the beat,
 * and a caption arriving on top of it would be the site explaining a joke.
 */
function drawEnding(
  ctx: CanvasRenderingContext2D,
  ending: EndingState,
  billX: number,
  cleared: boolean,
  /** What forward leads to, or null when there is nowhere to go. */
  nextLabel: string | null,
  jumpKey: () => string,
  attackKey: () => string,
): void {
  // NOTHING dims until the cast is down. For the first nine seconds she is
  // supposed to believe the fight is still on, and a wash is the site telling
  // her it is not — the one thing this whole sequence exists to withhold.
  if (ending.beat === 'kneel' || ending.beat === 'rise' || ending.beat === 'cheer') {
    const settled = ending.beat === 'kneel' ? beatProgress(ending) : 1;
    ctx.fillStyle = `rgba(7, 9, 18, ${0.34 * settled})`;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  }

  // Bill's summons, in two stages on the shout's own clock. The words are the
  // user's correction: "HELP!" is already in this fight at 0:30 and reads as
  // Bill LOSING, and this beat needs him escalating. The fear is Kayla's own
  // inference — she has already watched a shouting Bill produce a second one.
  if (ending.beat === 'stop') {
    drawShout(ctx, endingCopy.summonFirst, billX, shoutBob(ending.elapsed));
  } else if (ending.beat === 'gather' && beatElapsed(ending) < SUMMON_SECOND_SECONDS) {
    drawShout(ctx, endingCopy.summonSecond, billX, shoutBob(ending.elapsed));
  }

  // The hurry hint, once she has beaten them before. Bottom-right, in the
  // same words and the same place the entrance puts it, because it is the
  // same bargain — and it is the one line the ending is allowed to say
  // during the fake-out, since it says nothing about winning.
  if (cleared && ending.beat !== 'cheer') {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(endingCopy.hurryHint(jumpKey()), CANVAS.width - 16, CANVAS.height - 26);
  }

  // The gather and the hold get NO text at all. That silence is ratified:
  // a wave-style card naming the five would sell the fake-out completely and
  // would be the first time the dojo ever told her something untrue.
  if (ending.beat !== 'cheer') return;

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '44px system-ui, sans-serif';
  ctx.fillText(endingCopy.winHeadline, CANVAS.width / 2, 128);
  ctx.font = '21px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(endingCopy.winLine, CANVAS.width / 2, 178);

  // The prompt is last and latest: she is not asked to press anything until
  // she has had the tableau to herself for the better part of six seconds.
  if (promptIsUp(ending)) {
    const fade = Math.min(1, (beatElapsed(ending) - ENDING.cheerPromptAt) / 0.8);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(
      nextLabel
        ? endingCopy.winPromptWithNext(jumpKey(), attackKey(), nextLabel)
        : endingCopy.winPrompt(jumpKey(), attackKey()),
      CANVAS.width / 2,
      218,
    );
    ctx.restore();
  }
}

/** How long "EVERYBODY!" stays up after it lands, at the top of the walk-on. */
const SUMMON_SECOND_SECONDS = 1.4;

/** The two-frame jitter every shout in this fight has. Stepped, never swept. */
function shoutBob(elapsed: number): number {
  return Math.floor(elapsed * 8) % 2 === 0 ? 0 : 4;
}

/** A named card over a dimmed arena: the boss's one piece of theatre. */
function drawCard(ctx: CanvasRenderingContext2D, name: string, line: string, dim: number): void {
  ctx.fillStyle = `rgba(7, 9, 18, ${dim})`;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '38px system-ui, sans-serif';
  ctx.fillText(name, CANVAS.width / 2, CANVAS.height / 2 - 40);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(line, CANVAS.width / 2, CANVAS.height / 2 + 14);
}
