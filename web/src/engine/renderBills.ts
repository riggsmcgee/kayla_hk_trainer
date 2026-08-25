/**
 * The boss pair's painting, kept in its own module.
 *
 * Every state read (`phase`, `attackKind`, `phaseTimer`, `facing`,
 * `lockedDir`, `hot`) stays inside these two functions, so the real painting
 * of Uncle Bill can be dropped in later without the fight's state machine
 * being touched. Placeholder geometry for now, at the ratified proportions:
 * Bill 68 x 160, the dog 64 x 58, both feet-anchored like every other enemy.
 */

import { COLORS } from './render';
import type { Enemy } from './enemies';
import { ENEMY_SIZES } from './enemies';
import type { Vec2 } from './types';

/** Bill the man. Placeholder: a correctly-sized block with a head on it. */
export function drawBill(ctx: CanvasRenderingContext2D, feet: Vec2, enemy: Enemy): void {
  const { width, height } = ENEMY_SIZES.bill;
  ctx.fillStyle = COLORS.enemyBody;
  ctx.fillRect(feet.x - width / 2, feet.y - height, width, height);
  // A head circle at the ratified 160 px proportion, so the silhouette reads
  // as a person at the right scale before the painting arrives.
  ctx.beginPath();
  ctx.arc(feet.x, feet.y - height + 10, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.enemyDetail;
  ctx.beginPath();
  ctx.arc(feet.x + enemy.facing * 6, feet.y - height + 8, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Bill the dog. Placeholder: a body block, or a ball while it is rolling. */
export function drawBillDog(ctx: CanvasRenderingContext2D, feet: Vec2, enemy: Enemy): void {
  const { width, height } = ENEMY_SIZES.dog;
  ctx.fillStyle = COLORS.enemyBody;
  if (enemy.roll) {
    ctx.beginPath();
    ctx.arc(feet.x, feet.y - height / 2, 29, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillRect(feet.x - width / 2, feet.y - height, width, height);
  ctx.fillStyle = COLORS.enemyDetail;
  ctx.beginPath();
  ctx.arc(feet.x + enemy.facing * 14, feet.y - height + 16, 3.5, 0, Math.PI * 2);
  ctx.fill();
}
