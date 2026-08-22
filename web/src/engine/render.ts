/**
 * Canvas drawing helpers (M1). Vector-silhouette art drawn in code — no
 * sprites. Everything here is intentionally simple; M6 is the real art and
 * juice pass. Colors mirror the site palette in styles.css.
 */

import { KNIGHT, PHYSICS } from './constants';
import type { Mover } from './course';
import { moverBox } from './course';
import type { Enemy, Projectile } from './enemies';
import { ATTACKS, ENEMY_SIZES } from './enemies';
import type { Player } from './player';
import type { AABB, Vec2, World } from './types';

export const COLORS = {
  canvasBg: '#070912',
  platform: '#1a2136',
  platformEdge: '#2c3654',
  knightBody: '#e9e4d5',
  knightEye: '#0b0e1a',
  dashStreak: 'rgba(233, 228, 213, 0.25)',
  spike: '#3a4260',
  spikeTip: '#525d85',
  orb: '#a9c7e8',
  orbGlow: 'rgba(169, 199, 232, 0.22)',
  /** Red = hazard orb: bounce on it, never touch it (playtest 2). */
  hazard: '#e86a6a',
  hazardGlow: 'rgba(232, 106, 106, 0.24)',
  /** Faint dotted path hint under a drifting orb. */
  moverPath: 'rgba(169, 199, 232, 0.28)',
  checkpoint: '#5a6484',
  checkpointArmed: '#cfe4fa',
  goal: '#cfe4fa',
  slash: 'rgba(233, 228, 213, 0.85)',
  hudText: '#e9e4d5',
  hudDim: '#9a97a8',
  enemyBody: '#8892b8',
  enemyDetail: '#0b0e1a',
  enemyFlash: '#ffffff',
  /** Gold = punish window (recovery), matching the lesson color language. */
  punishGold: '#e8c76a',
  /** Green = pokeable (destroyable projectiles), same language. */
  pokeGreen: '#9fd8a8',
  blockFlash: '#bcd9f7',
} as const;

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(0, 0, width, height);
}

export function drawWorld(ctx: CanvasRenderingContext2D, world: World): void {
  for (const s of world.solids) {
    ctx.fillStyle = COLORS.platform;
    ctx.fillRect(s.x, s.y, s.width, s.height);
    // Pale top edge so surfaces read against the dark ground.
    ctx.fillStyle = COLORS.platformEdge;
    ctx.fillRect(s.x, s.y, s.width, 2);
  }
}

/** Spike strips render as rows of teeth. */
export function drawSpikes(ctx: CanvasRenderingContext2D, spikes: AABB[]): void {
  const tooth = 16;
  for (const s of spikes) {
    const teeth = Math.max(1, Math.floor(s.width / tooth));
    const w = s.width / teeth;
    for (let i = 0; i < teeth; i++) {
      const x0 = s.x + i * w;
      ctx.fillStyle = COLORS.spike;
      ctx.beginPath();
      ctx.moveTo(x0, s.y + s.height);
      ctx.lineTo(x0 + w / 2, s.y);
      ctx.lineTo(x0 + w, s.y + s.height);
      ctx.closePath();
      ctx.fill();
      // Pale tip so the danger reads at speed.
      ctx.fillStyle = COLORS.spikeTip;
      ctx.beginPath();
      ctx.moveTo(x0 + w / 2 - 2.5, s.y + 7);
      ctx.lineTo(x0 + w / 2, s.y);
      ctx.lineTo(x0 + w / 2 + 2.5, s.y + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** One glowing sphere: the shared body of blue, red, and drifting orbs. */
function drawOrb(
  ctx: CanvasRenderingContext2D,
  o: AABB,
  timeS: number,
  fill: string,
  glow: string,
): void {
  const cx = o.x + o.width / 2;
  const cy = o.y + o.height / 2;
  const pulse = 1 + 0.08 * Math.sin(timeS * 3 + cx * 0.05);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, (o.width / 2 + 8) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, o.width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.canvasBg;
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Bounce orbs: soft-glowing lumafly-ish spheres. */
export function drawOrbs(ctx: CanvasRenderingContext2D, orbs: AABB[], timeS: number): void {
  for (const o of orbs) drawOrb(ctx, o, timeS, COLORS.orb, COLORS.orbGlow);
}

/**
 * Hazard orbs: the same sphere in an unmistakable red, with a thin dark
 * ring so the color reads even through the glow. Bounce, never touch.
 */
export function drawHazardOrbs(ctx: CanvasRenderingContext2D, orbs: AABB[], timeS: number): void {
  for (const o of orbs) {
    drawOrb(ctx, o, timeS, COLORS.hazard, COLORS.hazardGlow);
    ctx.strokeStyle = COLORS.canvasBg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x + o.width / 2, o.y + o.height / 2, o.width / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Drifting orbs at course time t — the SAME t the simulation used, so the
 * drawn orb is exactly what the nail can hit. A faint dotted path under
 * each one shows where it is going. `pulseS` is the ambient clock for the
 * glow pulse (course time stands still before her first input).
 */
export function drawMovers(
  ctx: CanvasRenderingContext2D,
  movers: readonly Mover[],
  t: number,
  pulseS: number = t,
): void {
  ctx.save();
  ctx.strokeStyle = COLORS.moverPath;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 7]);
  for (const m of movers) {
    const { x, y } = m.center;
    const a = m.path.amplitude;
    ctx.beginPath();
    if (m.path.kind === 'circle') {
      ctx.arc(x, y, a, 0, Math.PI * 2);
    } else if (m.path.kind === 'horizontal') {
      ctx.moveTo(x - a, y);
      ctx.lineTo(x + a, y);
    } else {
      ctx.moveTo(x, y - a);
      ctx.lineTo(x, y + a);
    }
    ctx.stroke();
  }
  ctx.restore();
  for (const m of movers) drawOrb(ctx, moverBox(m, t), pulseS, COLORS.orb, COLORS.orbGlow);
}

/** Checkpoint lantern: a pole with a diamond head that lights when armed. */
export function drawCheckpoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  armed: boolean,
): void {
  ctx.strokeStyle = COLORS.checkpoint;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, floorY);
  ctx.lineTo(x, floorY - 64);
  ctx.stroke();
  const c = armed ? COLORS.checkpointArmed : COLORS.checkpoint;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x, floorY - 88);
  ctx.lineTo(x + 10, floorY - 74);
  ctx.lineTo(x, floorY - 60);
  ctx.lineTo(x - 10, floorY - 74);
  ctx.closePath();
  ctx.fill();
  if (armed) {
    ctx.fillStyle = COLORS.orbGlow;
    ctx.beginPath();
    ctx.arc(x, floorY - 74, 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The goal: a softly glowing doorway. */
export function drawGoal(ctx: CanvasRenderingContext2D, goal: AABB, timeS: number): void {
  const glow = 0.5 + 0.2 * Math.sin(timeS * 2);
  ctx.fillStyle = `rgba(207, 228, 250, ${0.12 * glow})`;
  ctx.fillRect(goal.x - 10, goal.y - 10, goal.width + 20, goal.height + 10);
  ctx.strokeStyle = COLORS.goal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const r = goal.width / 2;
  ctx.moveTo(goal.x, goal.y + goal.height);
  ctx.lineTo(goal.x, goal.y + r);
  ctx.arc(goal.x + r, goal.y + r, r, Math.PI, 0);
  ctx.lineTo(goal.x + goal.width, goal.y + goal.height);
  ctx.stroke();
}

/** Slash arc drawn over the swing animation, oriented by swing direction. */
export function drawNailSlash(ctx: CanvasRenderingContext2D, feet: Vec2, player: Player): void {
  const t = player.nailTimer;
  if (!Number.isFinite(t) || t >= PHYSICS.nailSwingTime) return;
  const progress = t / PHYSICS.nailSwingTime;
  const fade = 1 - progress;
  const cy = feet.y - KNIGHT.hurtboxHeight / 2;

  ctx.save();
  ctx.strokeStyle = COLORS.slash;
  ctx.globalAlpha = 0.9 * fade;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (player.nailDir === 'side') {
    // A 120° arc facing forward: right = [−60°, 60°], left = [120°, 240°].
    const mid = player.nailFacing === 1 ? 0 : Math.PI;
    ctx.arc(feet.x, cy, 52, mid - Math.PI / 3, mid + Math.PI / 3);
  } else if (player.nailDir === 'up') {
    ctx.arc(feet.x, feet.y - KNIGHT.spriteHeight, 46, -Math.PI * 0.85, -Math.PI * 0.15);
  } else {
    ctx.arc(feet.x, feet.y - 6, 50, Math.PI * 0.15, Math.PI * 0.85);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw one enemy at an interpolated feet position. `deathFade` in [0, 1]
 * fades a dying enemy out (1 = fully faded); pass 0 for a live one.
 */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  feet: Vec2,
  enemy: Enemy,
  timeS: number,
  deathFade = 0,
): void {
  const size = ENEMY_SIZES[enemy.id];
  const flashing = enemy.hurtFlashTimer > 0;
  const body = flashing ? COLORS.enemyFlash : COLORS.enemyBody;

  ctx.save();
  if (deathFade > 0) {
    ctx.globalAlpha = Math.max(0, 1 - deathFade * 2.2);
    // Death burst ring.
    ctx.strokeStyle = COLORS.orb;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(feet.x, feet.y - size.height / 2, 12 + deathFade * 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.id === 'walker') {
    // Crawlid-ish: a low rounded shell with stubby legs and a forward eye.
    const w = size.width;
    const h = size.height;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(feet.x - w / 2, feet.y - 3);
    ctx.quadraticCurveTo(feet.x - w / 2, feet.y - h, feet.x, feet.y - h);
    ctx.quadraticCurveTo(feet.x + w / 2, feet.y - h, feet.x + w / 2, feet.y - 3);
    ctx.closePath();
    ctx.fill();
    // Legs: little nubs that alternate with movement.
    const step = Math.sin(timeS * 14) * 2;
    ctx.fillRect(feet.x - w * 0.3, feet.y - 4, 5, 4 + step);
    ctx.fillRect(feet.x - 2, feet.y - 4, 5, 4 - step);
    ctx.fillRect(feet.x + w * 0.3 - 4, feet.y - 4, 5, 4 + step);
    // Eye toward facing.
    ctx.fillStyle = COLORS.enemyDetail;
    ctx.beginPath();
    ctx.arc(feet.x + enemy.facing * (w / 2 - 9), feet.y - h + 9, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.id === 'flier') {
    // Vengefly-ish: round body, flapping wing triangles, one keen eye.
    const r = size.width / 2;
    const cy = feet.y - size.height / 2;
    const flap = Math.sin(timeS * 18) * 10;
    ctx.fillStyle = body;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(feet.x + side * (r - 4), cy - 4);
      ctx.lineTo(feet.x + side * (r + 16), cy - 12 - flap);
      ctx.lineTo(feet.x + side * (r + 2), cy + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(feet.x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.enemyDetail;
    ctx.beginPath();
    ctx.arc(feet.x + enemy.facing * 5, cy - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.id === 'duelist') {
    drawDuelist(ctx, feet, enemy, body);
  } else if (enemy.id === 'spitter') {
    drawSpitter(ctx, feet, enemy, body);
  } else {
    drawWarden(ctx, feet, enemy, body);
  }

  // Gold rim during recovery: the punish window, spelled out in color.
  if (!enemy.dead && enemy.phase === 'recovery') {
    const size2 = ENEMY_SIZES[enemy.id];
    ctx.strokeStyle = COLORS.punishGold;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      feet.x - size2.width / 2 - 5,
      feet.y - size2.height - 5,
      size2.width + 10,
      size2.height + 10,
    );
  }
  ctx.restore();
}

/** 0→1 progress through the enemy's current phase (0 at its start). */
function phaseProgress(enemy: Enemy, total: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - enemy.phaseTimer / total));
}

/**
 * Mantis-ish duelist: slim body, scythe arms. The lunge crouches and leans
 * forward; the anti-air COILS, then visibly leaps with both arms thrown
 * overhead — the counter has to read as "it answered your jump" (playtest 1).
 * Pure visual: the simulated position and hitboxes never move.
 */
function drawDuelist(ctx: CanvasRenderingContext2D, feet: Vec2, enemy: Enemy, body: string): void {
  const size = ENEMY_SIZES.duelist;
  const A = ATTACKS.duelist;
  const antiAir = enemy.attackKind === 'antiair';
  const w = size.width;

  // Vertical lift for the anti-air leap: up fast during active, back down
  // over the first part of recovery.
  let lift = 0;
  if (antiAir && enemy.phase === 'active') {
    const k = phaseProgress(enemy, A.antiAirActive);
    lift = 34 * Math.sin(Math.min(1, k * 1.4) * (Math.PI / 2));
  } else if (antiAir && enemy.phase === 'recovery') {
    const k = phaseProgress(enemy, A.antiAirRecovery);
    lift = 34 * Math.max(0, 1 - k * 3.5);
  }
  const base = { x: feet.x, y: feet.y - lift };

  const crouch =
    enemy.phase === 'telegraph' ? (antiAir ? 0.66 : 0.78) : enemy.phase === 'recovery' ? 0.9 : 1;
  const h = size.height * crouch;
  const lean = enemy.phase === 'active' && !antiAir ? enemy.lockedDir * 10 : 0;

  ctx.fillStyle = body;
  // Torso: a slim tapered stalk (stretched taller mid-leap).
  const stretch = antiAir && enemy.phase === 'active' ? 1.12 : 1;
  ctx.beginPath();
  ctx.moveTo(base.x - w * 0.22 + lean * 0.4, base.y);
  ctx.quadraticCurveTo(
    base.x - w * 0.3 + lean,
    base.y - h * 0.65 * stretch,
    base.x + lean,
    base.y - h * stretch,
  );
  ctx.quadraticCurveTo(
    base.x + w * 0.3 + lean,
    base.y - h * 0.65 * stretch,
    base.x + w * 0.22 + lean * 0.4,
    base.y,
  );
  ctx.closePath();
  ctx.fill();

  // Scythe arms.
  ctx.strokeStyle = body;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  const armY = base.y - h * 0.7;
  if (antiAir && (enemy.phase === 'telegraph' || enemy.phase === 'active')) {
    // Telegraph: arms pulled down and back (coiled). Active: both thrown
    // overhead in a sweeping crescent, plus a slash arc above the head.
    const k = enemy.phase === 'telegraph' ? 0 : phaseProgress(enemy, A.antiAirActive);
    const swing = enemy.phase === 'telegraph' ? -0.35 : Math.min(1, k * 1.6);
    for (const side of [-1, 1] as const) {
      const ang = -Math.PI / 2 + side * (0.95 - swing * 0.8);
      const reach = 26 + swing * 10;
      const ex = base.x + Math.cos(ang + (swing < 0 ? side * 0.9 : 0)) * reach;
      const ey = armY + (swing < 0 ? 16 : 0) + Math.sin(ang) * reach;
      ctx.beginPath();
      ctx.moveTo(base.x, armY);
      ctx.quadraticCurveTo(base.x + side * reach * 0.8, armY + (swing < 0 ? 12 : -6), ex, ey);
      ctx.stroke();
    }
    if (enemy.phase === 'active') {
      // Upward slash crescent: the swipe, drawn where the real hitbox sits.
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - k * 0.6);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(feet.x, feet.y - size.height - 4, 34 + k * 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    const reach = enemy.phase === 'active' ? 30 : enemy.phase === 'telegraph' ? 10 : 18;
    const rise = enemy.phase === 'telegraph' ? -14 : enemy.phase === 'recovery' ? 6 : -4;
    for (const off of [0, 6]) {
      ctx.beginPath();
      ctx.moveTo(base.x + lean, armY + off);
      ctx.quadraticCurveTo(
        base.x + enemy.facing * (reach * 0.6) + lean,
        armY + rise + off,
        base.x + enemy.facing * reach + lean,
        armY + rise * 0.4 + off,
      );
      ctx.stroke();
    }
  }
  // Eyes: look up at the jumper while coiled or leaping.
  ctx.fillStyle = COLORS.enemyDetail;
  const eyeUp = antiAir && enemy.phase !== 'recovery' ? -3 : 0;
  ctx.beginPath();
  ctx.arc(base.x + enemy.facing * 5 + lean, base.y - h * stretch + 8 + eyeUp, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Aspid-ish spitter: round floater that inflates to spit. */
function drawSpitter(ctx: CanvasRenderingContext2D, feet: Vec2, enemy: Enemy, body: string): void {
  const size = ENEMY_SIZES.spitter;
  const cy = feet.y - size.height / 2;
  const inflate = enemy.phase === 'telegraph' ? 1.18 : enemy.phase === 'recovery' ? 0.88 : 1;
  const r = (size.width / 2) * inflate;

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(feet.x, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  // Small side fins.
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(feet.x + side * (r - 3), cy - 6);
    ctx.lineTo(feet.x + side * (r + 10), cy - 14);
    ctx.lineTo(feet.x + side * (r - 1), cy + 2);
    ctx.closePath();
    ctx.fill();
  }
  // Mouth: opens toward the player in telegraph — the tell to watch.
  ctx.fillStyle = COLORS.enemyDetail;
  if (enemy.phase === 'telegraph' || enemy.phase === 'active') {
    ctx.beginPath();
    ctx.moveTo(feet.x + enemy.facing * (r - 6), cy + 2);
    ctx.lineTo(feet.x + enemy.facing * (r + 4), cy - 3);
    ctx.lineTo(feet.x + enemy.facing * (r + 4), cy + 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(feet.x + enemy.facing * (r * 0.35), cy - 6, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Shield warden: broad figure behind a slab of shield. The shield is drawn
 * where it actually blocks — across the front, or flat over the head when
 * it has re-aimed upward — so the open side is visible. Telegraph raises
 * it, active (riposte/bash) throws it forward, recovery drops it low.
 */
function drawWarden(ctx: CanvasRenderingContext2D, feet: Vec2, enemy: Enemy, body: string): void {
  const size = ENEMY_SIZES.warden;
  const w = size.width;
  const h = size.height;
  const A = ATTACKS.warden;
  const bash = enemy.attackKind === 'bash';

  // Body: a stout rounded slab; hunches for the bash telegraph.
  const hunch = enemy.phase === 'telegraph' && bash ? 0.9 : 1;
  const lean = enemy.phase === 'active' ? enemy.lockedDir * (bash ? 8 : 5) : 0;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(feet.x - w * 0.32, feet.y);
  ctx.quadraticCurveTo(
    feet.x - w * 0.38 + lean,
    feet.y - h * hunch,
    feet.x + lean,
    feet.y - h * hunch,
  );
  ctx.quadraticCurveTo(feet.x + w * 0.38 + lean, feet.y - h * hunch, feet.x + w * 0.32, feet.y);
  ctx.closePath();
  ctx.fill();
  // Eye.
  ctx.fillStyle = COLORS.enemyDetail;
  ctx.beginPath();
  ctx.arc(feet.x + enemy.facing * 6 + lean, feet.y - h * hunch + 12, 3, 0, Math.PI * 2);
  ctx.fill();

  const flash = enemy.blockFlashTimer > 0;
  const sw = 9;
  ctx.fillStyle = flash ? COLORS.blockFlash : enemy.phase === 'recovery' ? '#525d85' : '#a8b4d8';
  ctx.beginPath();
  if (enemy.phase === 'recovery') {
    // Dropped low at the side: wide open, the gold window.
    const k = phaseProgress(enemy, bash ? A.bashRecovery : A.riposteRecovery);
    const sag = 6 + k * 4;
    ctx.roundRect(
      feet.x + enemy.facing * (w / 2 + 2) - sw / 2,
      feet.y - h * 0.4 + sag,
      sw,
      h * 0.4,
      4,
    );
  } else if (enemy.phase === 'telegraph' || enemy.phase === 'active') {
    // Raised high (telegraph) then thrown forward (active).
    const k =
      enemy.phase === 'active' ? phaseProgress(enemy, bash ? A.bashActive : A.riposteActive) : 0;
    const thrust = enemy.phase === 'active' ? 10 + k * 8 : 0;
    const top = enemy.phase === 'telegraph' ? feet.y - h - 8 : feet.y - h * 0.9;
    const shieldX = feet.x + enemy.lockedDir * (w / 2 + 4 + thrust);
    ctx.roundRect(shieldX - sw / 2, top, sw, h * 0.85, 4);
  } else if (enemy.shieldDir === 'up') {
    // Held flat overhead: the front is bare.
    const slabW = w + 14;
    ctx.roundRect(feet.x - slabW / 2, feet.y - h - 12, slabW, sw, 4);
  } else {
    // Across the front.
    const shieldX = feet.x + enemy.facing * (w / 2 + 4);
    ctx.roundRect(shieldX - sw / 2, feet.y - h * 0.85, sw, h * 0.85, 4);
  }
  ctx.fill();
}

/** Spitter shots: pale-green pokeable orbs (green = "your nail beats this"). */
export function drawProjectiles(ctx: CanvasRenderingContext2D, shots: readonly Projectile[]): void {
  for (const s of shots) {
    if (s.dead) continue;
    ctx.fillStyle = 'rgba(159, 216, 168, 0.25)';
    ctx.beginPath();
    ctx.arc(s.position.x, s.position.y, s.radius + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.pokeGreen;
    ctx.beginPath();
    ctx.arc(s.position.x, s.position.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function lerpVec(prev: Vec2, curr: Vec2, alpha: number): Vec2 {
  return {
    x: prev.x + (curr.x - prev.x) * alpha,
    y: prev.y + (curr.y - prev.y) * alpha,
  };
}

/** Squash/stretch factors for the Knight, volume-conserving (sx·sy ≈ 1). */
export interface Stretch {
  sx: number;
  sy: number;
}

/**
 * The Knight as a code-drawn silhouette: pale rounded body, two horns, dark
 * mask eyes. `feet` is the interpolated feet-center position. `stretch`
 * scales the drawing about the feet (squash on landing, stretch in flight)
 * — pure visual, the hurtbox never changes.
 */
export function drawKnight(
  ctx: CanvasRenderingContext2D,
  feet: Vec2,
  player: Player,
  stretch: Stretch = { sx: 1, sy: 1 },
): void {
  const h = KNIGHT.spriteHeight;
  const w = 24; // visual width, a touch wider than the 18 px hurtbox
  ctx.save();
  ctx.translate(feet.x, feet.y);
  ctx.scale(stretch.sx, stretch.sy);
  ctx.translate(-feet.x, -feet.y);
  const x = feet.x;
  const top = feet.y - h;

  // Motion streak while dashing.
  if (player.dashTimer > 0) {
    ctx.fillStyle = COLORS.dashStreak;
    const streakLen = 34;
    const sx = player.dashDir === 1 ? x - w / 2 - streakLen : x + w / 2;
    ctx.fillRect(sx, top + h * 0.35, streakLen, h * 0.45);
  }

  // Body: capsule silhouette.
  ctx.fillStyle = COLORS.knightBody;
  ctx.beginPath();
  const r = w / 2;
  ctx.moveTo(x - r, top + r + 6);
  ctx.arc(x, top + r + 6, r, Math.PI, 0); // rounded head
  ctx.lineTo(x + r, feet.y - 4);
  ctx.quadraticCurveTo(x + r, feet.y, x + r - 5, feet.y);
  ctx.lineTo(x - r + 5, feet.y);
  ctx.quadraticCurveTo(x - r, feet.y, x - r, feet.y - 4);
  ctx.closePath();
  ctx.fill();

  // Horns: two slim curved spikes.
  const hornBaseY = top + 8;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(x + side * (r - 4), hornBaseY);
    ctx.quadraticCurveTo(x + side * (r + 6), hornBaseY - 10, x + side * (r + 3), top - 8);
    ctx.quadraticCurveTo(x + side * (r - 1), hornBaseY - 8, x + side * (r - 8), hornBaseY - 2);
    ctx.closePath();
    ctx.fill();
  }

  // Eyes: dark ovals, shifted toward facing.
  ctx.fillStyle = COLORS.knightEye;
  const eyeY = top + r + 6;
  const shift = player.facing * 2.5;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(x + side * 5.5 + shift, eyeY, 2.6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
