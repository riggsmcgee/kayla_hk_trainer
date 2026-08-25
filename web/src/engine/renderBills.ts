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
import { ATTACKS, ENEMY_SIZES, type Enemy } from './enemies';
import { paintBillDog, type BillDogPose } from './renderBillDog';
import { paintBillMan, type BillPose } from './renderBillMan';
import type { Vec2 } from './types';

/**
 * The pale band on top of the rolling ball: the pogo-safe cap, drawn.
 *
 * The rule it shows is real — `enemyHurtsBox` (arena.ts) removes exactly
 * these pixels from the damage box, so the top of the ball can be ridden and
 * the sides cannot. Both read `ATTACKS.dog.rollSafeCap`, so the picture and
 * the hitbox cannot drift apart.
 *
 * It is drawn HERE rather than in `renderBillDog`, on top of whatever the
 * art painted, for the reason the plan gives: the marker has to survive the
 * painting being replaced, including by a single static image.
 *
 * Precedent, and the reason it looks like this: the red hazard orb's thin
 * dark ring (`drawHazardOrbs`). A rule the simulation enforces but the
 * picture never mentions is the exact bug that shipped the warden's
 * invisible telegraph.
 */
function drawRollSafeCap(ctx: CanvasRenderingContext2D, feet: Vec2): void {
  const size = ENEMY_SIZES.dog;
  const cap = ATTACKS.dog.rollSafeCap;
  const cx = feet.x;
  const top = feet.y - size.height;
  const radius = size.height / 2;

  ctx.save();
  // Clip to the top band, then fill the ball's own circle through it, so the
  // cap follows the silhouette instead of sitting on it as a rectangle.
  ctx.beginPath();
  ctx.rect(cx - size.width / 2, top, size.width, cap);
  ctx.clip();
  ctx.fillStyle = 'rgba(233, 228, 213, 0.5)';
  ctx.beginPath();
  ctx.arc(cx, top + radius, radius, 0, Math.PI * 2);
  ctx.fill();
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
 * `roll` is the one pose that can outlive its own phase: the ball bounces for
 * about five seconds, so the `roll` flag on the enemy is authoritative and is
 * checked before the phase is. Everything else follows the man's shape.
 */
export function billDogPose(enemy: Enemy): BillDogPose {
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
): void {
  paintBillDog(ctx, feet, billDogPose(enemy), timeS, enemy.facing);
  // Only while he is actually a ball — a standing dog hurts everywhere.
  if (enemy.roll) drawRollSafeCap(ctx, feet);
}
