/**
 * The boss pair's painting, kept in its own module.
 *
 * Every state read (`phase`, `attackKind`, `phaseTimer`, `facing`,
 * `lockedDir`, `hot`) stays inside this file, so the art and the fight's state
 * machine never learn about each other. That seam was built for a swap, and
 * the swap has now happened: the placeholder ink geometry is gone and the two
 * designs the user chose from the concept portfolio are in
 * `renderBillMan.ts` and `renderBillDog.ts`. Those two modules know nothing
 * about `Enemy`; this one is the whole translation layer.
 *
 * If the art is ever replaced again, this file is the only thing that has to
 * agree with both sides.
 */
import { ENEMY_SIZES, type Enemy } from './enemies';
import { CANVAS_BG } from './constants';
import type { RingStyle } from './dogLook';
import { paintBillDog, type BillDogPose } from './renderBillDog';
import { paintBillMan, type BillPose } from './renderBillMan';
import type { Vec2 } from './types';

/**
 * The dark ring around the rolling ball: "bounce off this and it still
 * hurts", drawn.
 *
 * This REPLACES the pale pogo-safe cap that used to sit on top. Playtest 4
 * struck the cap: the ball is lethal everywhere now, and a marker that says
 * "ride me here" would be a lie that costs her a run.
 *
 * The ring is not invented for this. It is exactly the marker the red hazard
 * orbs already wear in course level 2 (`drawHazardOrbs`) — same thin stroke
 * in the canvas's own background colour, same meaning — so the ball is
 * speaking a vocabulary she has been reading since the Bounce Bog rather
 * than a new one at the very bottom of the well.
 *
 * Drawn HERE rather than inside `renderBillDog`, on top of whatever the art
 * painted, for the reason the plan gives: the marker has to survive the
 * painting being replaced, including by a single static image. A rule the
 * simulation enforces but the picture never mentions is the exact bug that
 * shipped the warden's invisible telegraph.
 */
function drawRollHazardRing(
  ctx: CanvasRenderingContext2D,
  feet: Vec2,
  style: RingStyle,
  timeS: number,
): void {
  const radius = ENEMY_SIZES.dog.height / 2;
  const cx = feet.x;
  const cy = feet.y - radius;

  ctx.save();
  ctx.strokeStyle = CANVAS_BG;
  ctx.lineWidth = style === 'bold' ? 4 : 2;

  if (style === 'spun') {
    // Four gaps that travel around the ring: the ball's spin, drawn. Stepped
    // on a floored clock like the rest of the Bills, never swept.
    const step = (Math.PI * 2) / 16;
    const offset = Math.floor(timeS * 12) * step;
    for (let i = 0; i < 4; i++) {
      const from = offset + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 3, from, from + step * 2.6);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Which pose Bill the man is in, from the fight's own state.
 *
 * The mapping is deliberately total — every combination lands somewhere real,
 * because a boss that blanks for a frame is worse than one in a slightly
 * wrong pose, and T11's state machine is not written yet. It reads:
 *
 * | attack  | phase       | pose        | why                                  |
 * |---------|-------------|-------------|--------------------------------------|
 * | lance   | telegraph   | `lanceTell` | the 0.6 s windup she reads           |
 * | lance   | active      | `lanceDash` | crossing the arena                   |
 * | lance   | recovery    | `stuck`     | he hit the wall; her punish window   |
 * | swat    | telegraph   | `swatTell`  | the 0.4 s upward windup              |
 * | swat    | active      | `swat`      | the strike                           |
 * | swat    | recovery    | `idle`      | he recovers on his feet, not dazed   |
 * | —       | idle        | `idle`      |                                      |
 */
export function billPose(enemy: Enemy): BillPose {
  // The ending, checked before anything else: at 1:30 the fight stops mid-
  // attack, and whatever Bill was in the middle of is no longer true of him.
  // The user picked the KNEE for the concede — "back knee down, foam finger up
  // to her" — over the bow and the applause, and then picked the applause for
  // the cheer, so the two now mean two different things.
  //
  // `summon` REUSES `swatTell`, the 0.4 s upward windup, rather than adding a
  // pose: it is already the foam finger held high, and she has spent ninety
  // seconds learning to fear exactly that shape. Bill calling the roster in
  // with the arm that has been trying to hit her all fight is the joke and
  // the threat in one picture.
  if (enemy.celebrating) {
    if (enemy.celebrating === 'summon') return 'swatTell';
    return enemy.celebrating === 'concede' ? 'kneel' : 'applaud';
  }
  if (enemy.attackKind === 'lance') {
    if (enemy.phase === 'telegraph') return 'lanceTell';
    if (enemy.phase === 'active') return 'lanceDash';
    // Only the lance ends against a wall, so only the lance is ever `stuck`.
    if (enemy.phase === 'recovery') return 'stuck';
  }
  if (enemy.attackKind === 'swat') {
    if (enemy.phase === 'telegraph') return 'swatTell';
    if (enemy.phase === 'active') return 'swat';
  }
  return 'idle';
}

/**
 * Which pose the dog is in.
 *
 * `roll` is the one pose that can outlive its own phase: the ball bounces
 * until it next touches the floor, so the `roll` flag on the enemy is
 * authoritative and is checked before the phase is. Everything else follows
 * the man's shape.
 */
export function billDogPose(enemy: Enemy): BillDogPose {
  // The ending. `lieDown` is the dog's half of the man's knee — chin out, ear
  // back, all the way to the floor; `applaud` sits him up on his haunches
  // patting his front paws on the man's own 5 Hz clap beat.
  //
  // He has nothing to do during the man's `summon`: the shout is the man's,
  // and a dog who reacted to it would be answering the call he is meant to be
  // part of. He stands, and he breathes.
  if (enemy.celebrating) {
    if (enemy.celebrating === 'summon') return 'idle';
    return enemy.celebrating === 'concede' ? 'lieDown' : 'applaud';
  }
  // Trotting in on his card. Checked first because he is carrying no attack
  // and no phase during it, so every branch below would fall through to
  // `idle` and his entrance would be a standing dog on a conveyor belt.
  if (enemy.walkingIn) return 'walkIn';
  // Coming out of the ball. `walkIn` is the trot the renderer already draws
  // and nothing else could reach — a dog finding its feet again is exactly
  // what it looks like.
  if (enemy.attackKind === 'uncurl') return 'walkIn';
  if (enemy.attackKind === 'roll') {
    return enemy.phase === 'telegraph' ? 'rollTell' : 'roll';
  }
  // The ball can still be in flight after the attack's phases have moved on.
  if (enemy.roll) return 'roll';
  if (enemy.attackKind === 'bones') {
    return enemy.phase === 'telegraph' ? 'bonesTell' : 'bones';
  }
  return 'idle';
}

/** Bill the man: 68 x 160, feet-anchored. */
export function drawBill(ctx: CanvasRenderingContext2D, feet: Vec2, enemy: Enemy, timeS = 0): void {
  paintBillMan(ctx, feet, billPose(enemy), timeS, enemy.facing);
}

/** Bill the dog: 64 x 58, feet-anchored. */
export function drawBillDog(
  ctx: CanvasRenderingContext2D,
  feet: Vec2,
  enemy: Enemy,
  timeS = 0,
  ring: RingStyle = 'thin',
): void {
  paintBillDog(ctx, feet, billDogPose(enemy), timeS, enemy.facing);
  // Only while he is actually a ball. A standing dog hurts everywhere too,
  // but the ring is the ROLL’s marker: it says “this one is coming at you
  // and there is no safe face on it”.
  if (enemy.roll) drawRollHazardRing(ctx, feet, ring, timeS);
}
