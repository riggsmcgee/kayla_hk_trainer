/**
 * Lesson demos (M5): slow-motion scripted replays running on the REAL
 * engine — same stepPlayer/stepEnemy, same hitbox data — so the lessons can
 * never drift out of sync with the game they teach (PLAN §6).
 *
 * Overlay color language (used verbatim in the lesson copy):
 *   red  = the attack hitbox — where it hurts
 *   green = pokeable — your nail beats this (destroyable shots, safe pokes)
 *   gold = punish window (recovery)
 */

import { FIXED_DT } from './constants';
import {
  ATTACKS,
  createEnemy,
  enemyAttackHitbox,
  resolveNailHit,
  stepEnemy,
  stepProjectile,
} from './enemies';
import type { Enemy, Projectile, Target } from './enemies';
import { activeNailHitbox, createPlayer, stepPlayer } from './player';
import type { Player } from './player';
import {
  COLORS,
  clearCanvas,
  drawEnemy,
  drawKnight,
  drawNailSlash,
  drawOrbs,
  drawProjectiles,
  drawWorld,
  lerpVec,
} from './render';
import type { GameSession } from './session';
import type { AABB, InputFrame, Vec2, World } from './types';

export const DEMO_COLORS = {
  threatRed: 'rgba(226, 105, 95, 0.4)',
  threatRedEdge: '#e2695f',
  punishGoldFill: 'rgba(232, 199, 106, 0.18)',
  pokeGreenFill: 'rgba(159, 216, 168, 0.35)',
  telegraphAmber: '#d8a54a',
} as const;

export interface DemoView {
  width: number;
  height: number;
  floorY: number;
}

/** Everything a demo simulates in one loop cycle. */
export interface DemoActors {
  world: World;
  enemy?: Enemy;
  player?: Player;
  /** A drawn-only knight standing in for "you" in enemy-anatomy demos. */
  ghost?: { feet: Vec2; facing: 1 | -1; slashing: boolean; hurt?: number };
  /** Bounce orbs to draw (already in world.pogoables for the physics). */
  orbs?: AABB[];
  projectiles: Projectile[];
}

export interface DemoScript {
  view: DemoView;
  /** 0.4 = the demo plays at 40 % speed. */
  timeScale: number;
  /** Sim-seconds per loop; the scene resets when the cycle ends. */
  cycle: number;
  setup(): DemoActors;
  /**
   * Scripted control, called once per sim step at sim-time t. Returns the
   * player's input frame when the demo simulates a real player.
   */
  drive(actors: DemoActors, t: number): InputFrame | null;
  caption(actors: DemoActors, t: number): string;
}

const IDLE_INPUT: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpPressed: false,
  attackPressed: false,
  dashPressed: false,
};

/** telegraph/active/recovery durations for the enemy's current attack. */
function attackTimeline(e: Enemy): { telegraph: number; active: number; recovery: number } | null {
  switch (e.attackKind) {
    case 'lunge':
      return {
        telegraph: 0.35,
        active: ATTACKS.duelist.lungeTime,
        recovery: ATTACKS.duelist.lungeRecovery,
      };
    case 'antiair':
      return {
        telegraph: 0.35,
        active: ATTACKS.duelist.antiAirActive,
        recovery: ATTACKS.duelist.antiAirRecovery,
      };
    case 'volley':
      return {
        telegraph: 0.5,
        active: ATTACKS.spitter.activeTime,
        recovery: ATTACKS.spitter.recovery,
      };
    case 'riposte':
      return {
        telegraph: 0.4,
        active: ATTACKS.warden.riposteActive,
        recovery: ATTACKS.warden.riposteRecovery,
      };
    case 'bash':
      return {
        telegraph: 0.4,
        active: ATTACKS.warden.bashActive,
        recovery: ATTACKS.warden.bashRecovery,
      };
    default:
      return null;
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, feet: Vec2, facing: 1 | -1, hurt = 0): void {
  ctx.save();
  ctx.globalAlpha = hurt > 0 ? 0.8 : 0.45;
  ctx.fillStyle = hurt > 0 ? DEMO_COLORS.threatRedEdge : COLORS.knightBody;
  const w = 24;
  const h = 48;
  const r = w / 2;
  const top = feet.y - h;
  ctx.beginPath();
  ctx.moveTo(feet.x - r, top + r + 6);
  ctx.arc(feet.x, top + r + 6, r, Math.PI, 0);
  ctx.lineTo(feet.x + r, feet.y - 4);
  ctx.lineTo(feet.x - r, feet.y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.knightEye;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(feet.x + side * 5 + facing * 2.5, top + r + 6, 2.4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function fillBox(ctx: CanvasRenderingContext2D, box: AABB, fill: string, edge?: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
  }
}

/** The telegraph→active→recovery bar with a moving cursor. */
function drawPhaseBar(ctx: CanvasRenderingContext2D, view: DemoView, e: Enemy): void {
  const tl = attackTimeline(e);
  const barX = 16;
  const barW = view.width - 32;
  const barY = view.height - 26;
  const barH = 8;
  if (!tl || e.phase === 'idle') {
    ctx.fillStyle = COLORS.platform;
    ctx.fillRect(barX, barY, barW, barH);
    return;
  }
  const total = tl.telegraph + tl.active + tl.recovery;
  const seg = [
    { len: tl.telegraph, color: DEMO_COLORS.telegraphAmber, label: 'tell' },
    { len: tl.active, color: DEMO_COLORS.threatRedEdge, label: 'attack' },
    { len: tl.recovery, color: COLORS.punishGold, label: 'punish' },
  ];
  let x = barX;
  for (const s of seg) {
    const w = (s.len / total) * barW;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, barY, w - 1, barH);
    ctx.globalAlpha = 1;
    x += w;
  }
  // Cursor: elapsed time within the whole attack.
  const phaseElapsed =
    e.phase === 'telegraph'
      ? tl.telegraph - e.phaseTimer
      : e.phase === 'active'
        ? tl.telegraph + (tl.active - e.phaseTimer)
        : tl.telegraph + tl.active + (tl.recovery - e.phaseTimer);
  const cx = barX + (Math.min(Math.max(phaseElapsed, 0), total) / total) * barW;
  ctx.fillStyle = COLORS.hudText;
  ctx.fillRect(cx - 1.5, barY - 4, 3, barH + 8);
}

export function createDemoSession(script: DemoScript): GameSession {
  let actors = script.setup();
  let t = 0;
  let scaledAcc = 0;
  let prevEnemyPos: Vec2 | null = actors.enemy ? { ...actors.enemy.position } : null;
  let prevPlayerPos: Vec2 | null = actors.player ? { ...actors.player.position } : null;

  return {
    step(_input: InputFrame, dt: number): void {
      scaledAcc += dt * script.timeScale;
      while (scaledAcc >= FIXED_DT) {
        scaledAcc -= FIXED_DT;
        t += FIXED_DT;
        if (t >= script.cycle) {
          actors = script.setup();
          t = 0;
          prevEnemyPos = actors.enemy ? { ...actors.enemy.position } : null;
          prevPlayerPos = actors.player ? { ...actors.player.position } : null;
          continue;
        }
        if (actors.enemy && prevEnemyPos) {
          prevEnemyPos.x = actors.enemy.position.x;
          prevEnemyPos.y = actors.enemy.position.y;
        }
        if (actors.player && prevPlayerPos) {
          prevPlayerPos.x = actors.player.position.x;
          prevPlayerPos.y = actors.player.position.y;
        }

        const input = script.drive(actors, t);
        if (actors.player) {
          stepPlayer(actors.player, input ?? IDLE_INPUT, actors.world, FIXED_DT);
        }
        if (actors.enemy) {
          const target: Target | undefined = actors.player
            ? { position: actors.player.position, grounded: actors.player.grounded }
            : actors.ghost
              ? {
                  position: actors.ghost.feet,
                  grounded: actors.ghost.feet.y >= script.view.floorY - 1,
                }
              : undefined;
          const shots = stepEnemy(actors.enemy, actors.world, FIXED_DT, target);
          if (shots) actors.projectiles.push(...shots);
        }
        for (const shot of actors.projectiles) stepProjectile(shot, actors.world, FIXED_DT);
        actors.projectiles = actors.projectiles.filter((s) => !s.dead);
      }
    },

    render(ctx: CanvasRenderingContext2D): void {
      const alpha = scaledAcc / FIXED_DT;
      const view = script.view;
      clearCanvas(ctx, view.width, view.height);
      drawWorld(ctx, actors.world);
      if (actors.orbs) drawOrbs(ctx, actors.orbs, t);

      // Gold punish fill behind the enemy during recovery.
      if (actors.enemy && !actors.enemy.dead && actors.enemy.phase === 'recovery') {
        const size = 70;
        fillBox(
          ctx,
          {
            x: actors.enemy.position.x - size / 2,
            y: actors.enemy.position.y - size,
            width: size,
            height: size,
          },
          DEMO_COLORS.punishGoldFill,
        );
      }

      if (actors.enemy) {
        const feet = prevEnemyPos
          ? lerpVec(prevEnemyPos, actors.enemy.position, alpha)
          : actors.enemy.position;
        drawEnemy(ctx, feet, actors.enemy, t);
        // Red overlay on the live attack hitbox.
        const attack = enemyAttackHitbox(actors.enemy);
        if (attack) fillBox(ctx, attack, DEMO_COLORS.threatRed, DEMO_COLORS.threatRedEdge);
      }

      // Green rings around destroyable shots (they're already drawn green;
      // the ring shouts "pokeable").
      drawProjectiles(ctx, actors.projectiles);
      for (const s of actors.projectiles) {
        ctx.strokeStyle = COLORS.pokeGreen;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.position.x, s.position.y, s.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (actors.player) {
        const feet = prevPlayerPos
          ? lerpVec(prevPlayerPos, actors.player.position, alpha)
          : actors.player.position;
        // Green fill on the live downslash — the pogo's whole story.
        const nail = activeNailHitbox(actors.player);
        if (nail && actors.player.nailDir === 'down') {
          fillBox(ctx, nail, DEMO_COLORS.pokeGreenFill, COLORS.pokeGreen);
        }
        drawNailSlash(ctx, feet, actors.player);
        drawKnight(ctx, feet, actors.player);
      }

      if (actors.ghost) {
        drawGhost(ctx, actors.ghost.feet, actors.ghost.facing, actors.ghost.hurt ?? 0);
        if (actors.ghost.slashing) {
          // A simple forward slash arc so the provocation reads.
          ctx.save();
          ctx.strokeStyle = COLORS.slash;
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          const mid = actors.ghost.facing === 1 ? 0 : Math.PI;
          ctx.beginPath();
          ctx.arc(
            actors.ghost.feet.x,
            actors.ghost.feet.y - 24,
            46,
            mid - Math.PI / 3,
            mid + Math.PI / 3,
          );
          ctx.stroke();
          ctx.restore();
        }
      }

      if (actors.enemy) drawPhaseBar(ctx, view, actors.enemy);

      // Caption.
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(script.caption(actors, t), 16, 12);
    },
  };
}

// ---------------------------------------------------------------------------
// The demo scripts
// ---------------------------------------------------------------------------

const DEMO_VIEW: DemoView = { width: 640, height: 360, floorY: 320 };

function demoWorld(): World {
  return {
    solids: [
      { x: -100, y: DEMO_VIEW.floorY, width: DEMO_VIEW.width + 200, height: 80 },
      { x: -32, y: -200, width: 32, height: 600 },
      { x: DEMO_VIEW.width, y: -200, width: 32, height: 600 },
    ],
  };
}

/** Ghost walks from a to b over [t0, t1], then stands still. */
function walk(
  ghost: { feet: Vec2 },
  a: number,
  b: number,
  t0: number,
  t1: number,
  t: number,
): void {
  const k = Math.min(Math.max((t - t0) / (t1 - t0), 0), 1);
  ghost.feet.x = a + (b - a) * k;
}

/** Duelist lunge anatomy: approach on the ground and it answers forward. */
export const duelistLungeDemo: DemoScript = {
  view: DEMO_VIEW,
  timeScale: 0.45,
  cycle: 5,
  setup: () => ({
    world: demoWorld(),
    enemy: createEnemy('duelist', 440, DEMO_VIEW.floorY),
    ghost: { feet: { x: 110, y: DEMO_VIEW.floorY }, facing: 1, slashing: false },
    projectiles: [],
  }),
  drive: (actors, t) => {
    if (actors.ghost) walk(actors.ghost, 110, 290, 0.5, 1.4, t);
    return null;
  },
  caption: (actors) => {
    switch (actors.enemy?.phase) {
      case 'telegraph':
        return 'The crouch — that’s the tell. Get ready to move.';
      case 'active':
        return 'The lunge. Red is where it hurts — it covers a LOT of ground.';
      case 'recovery':
        return 'Gold: it’s spent. This is your window — strike, then back off.';
      default:
        return 'Walk in on the ground and watch what your approach provokes.';
    }
  },
};

/**
 * Duelist anti-air anatomy: jump in and it answers upward — and the jumper
 * pays for it. The ghost's arc is timed so the real swipe hitbox clips it
 * (playtest 1: the counter has to visibly be a counter). The cycle ends
 * before the duelist's cooldown could let a ground lunge wear these captions.
 */
export const duelistAntiAirDemo: DemoScript = (() => {
  let hitAt = -1;
  return {
    view: DEMO_VIEW,
    timeScale: 0.45,
    cycle: 2.8,
    setup: () => {
      hitAt = -1;
      return {
        world: demoWorld(),
        enemy: createEnemy('duelist', 440, DEMO_VIEW.floorY),
        ghost: { feet: { x: 180, y: DEMO_VIEW.floorY }, facing: 1, slashing: false, hurt: 0 },
        projectiles: [],
      };
    },
    drive: (actors, t) => {
      const g = actors.ghost;
      const e = actors.enemy;
      if (!g || !e) return null;
      if (hitAt < 0) {
        // A long jump straight at the duelist between t = 0.8 and 1.9.
        if (t >= 0.8 && t < 1.9) {
          const k = (t - 0.8) / 1.1;
          g.feet.x = 180 + 260 * k;
          g.feet.y = DEMO_VIEW.floorY - 130 * Math.sin(Math.PI * k);
        }
        // The live swipe hitbox catches the ghost mid-arc.
        const box = enemyAttackHitbox(e);
        if (box && e.attackKind === 'antiair') {
          const gx = g.feet.x;
          const gy = g.feet.y - 24;
          if (gx > box.x && gx < box.x + box.width && gy > box.y && gy < box.y + box.height) {
            hitAt = t;
            g.hurt = 0.5;
          }
        }
      } else {
        // Knocked back and down, then limping off out of its reach.
        const k = Math.min(1, (t - hitAt) / 0.35);
        g.feet.x = Math.max(120, g.feet.x - (k < 1 ? 330 * (1 - k) : 220) * FIXED_DT);
        g.feet.y = Math.min(DEMO_VIEW.floorY, g.feet.y + 420 * FIXED_DT);
        g.hurt = Math.max(0, (g.hurt ?? 0) - FIXED_DT);
        g.facing = -1;
      }
      return null;
    },
    caption: (actors, t) => {
      const e = actors.enemy;
      if (hitAt > 0 && t < hitAt + 0.3) return 'Clipped. Jumping in is what it was waiting for.';
      if (e?.attackKind === 'antiair') {
        switch (e.phase) {
          case 'telegraph':
            return 'It saw you jump in — it coils, eyes up.';
          case 'active':
            return 'The rising swipe: it LEAPS to meet you. Red is where it hurts.';
          case 'recovery':
            return 'Gold — this is the moment. Had you waited on the ground, it’s yours.';
        }
      }
      return 'Same enemy, different approach: this time, jump in.';
    },
  };
})();

/** Spitter volley anatomy: wind-up, fan, and the closing window. */
export const spitterVolleyDemo: DemoScript = {
  view: DEMO_VIEW,
  timeScale: 0.45,
  cycle: 5.5,
  setup: () => ({
    world: demoWorld(),
    enemy: createEnemy('spitter', 470, 205),
    ghost: { feet: { x: 120, y: DEMO_VIEW.floorY }, facing: 1, slashing: false },
    projectiles: [],
  }),
  drive: () => null,
  caption: (actors) => {
    switch (actors.enemy?.phase) {
      case 'telegraph':
        return 'It rears back, mouth open — shots are coming.';
      case 'active':
        return 'A fan of three. GREEN means your nail can destroy them mid-air.';
      case 'recovery':
        return 'It’s spent — close the distance NOW and take your hits.';
      default:
        return 'It keeps its distance and waits. Watch the mouth.';
    }
  },
};

/**
 * Warden block + riposte anatomy: swing into the shield and it answers. The
 * ghost is scripted relative to the LIVE warden position, because the warden
 * drifts and lunges; the cycle resets before lingering could draw a bash.
 */
export const wardenRiposteDemo: DemoScript = (() => {
  // A scripted player exists only to provoke; it is never drawn.
  let scriptPlayer: Player | null = null;
  let provokedAt = -1;
  let punishedAt = -1;
  const STAND_OFF = 60;
  return {
    view: DEMO_VIEW,
    timeScale: 0.45,
    cycle: 4.6,
    setup: () => {
      scriptPlayer = createPlayer(320, DEMO_VIEW.floorY);
      provokedAt = -1;
      punishedAt = -1;
      return {
        world: demoWorld(),
        enemy: createEnemy('warden', 430, DEMO_VIEW.floorY),
        ghost: { feet: { x: 140, y: DEMO_VIEW.floorY }, facing: 1, slashing: false },
        projectiles: [],
      };
    },
    drive: (actors, t) => {
      const g = actors.ghost;
      const e = actors.enemy;
      if (!g || !e || !scriptPlayer) return null;
      const inFrontX = e.position.x - STAND_OFF;
      if (provokedAt < 0) walk(g, 140, inFrontX, 0.4, 1.2, t);
      scriptPlayer.position.x = g.feet.x;
      scriptPlayer.position.y = g.feet.y;
      // First slash at t ≈ 1.5: blocked, provokes the riposte.
      if (t >= 1.5 && provokedAt < 0) {
        provokedAt = t;
        scriptPlayer.swingId += 1;
        scriptPlayer.nailDir = 'side';
        scriptPlayer.nailFacing = 1;
        resolveNailHit(scriptPlayer, e, false);
        g.slashing = true;
      }
      if (provokedAt > 0 && t > provokedAt + 0.3) g.slashing = false;
      // Hop back out of the riposte's way.
      if (e.attackKind === 'riposte' && (e.phase === 'telegraph' || e.phase === 'active')) {
        g.feet.x = Math.max(140, Math.min(g.feet.x, e.position.x - 150) - 220 * FIXED_DT);
      }
      // Second slash during recovery: run back in — this one lands.
      if (e.attackKind === 'riposte' && e.phase === 'recovery' && punishedAt < 0) {
        g.feet.x = Math.min(inFrontX, g.feet.x + 300 * FIXED_DT);
        g.facing = 1;
        if (g.feet.x >= inFrontX - 1) {
          punishedAt = t;
          scriptPlayer.swingId += 1;
          resolveNailHit(scriptPlayer, e, false);
          g.slashing = true;
        }
      }
      if (punishedAt > 0 && t > punishedAt + 0.3) g.slashing = false;
      // Then step back out before it could take offence at the lingering.
      if (punishedAt > 0 && t > punishedAt + 0.3) {
        g.feet.x = Math.max(e.position.x - 200, g.feet.x - 160 * FIXED_DT);
      }
      return null;
    },
    caption: (actors, t) => {
      const e = actors.enemy;
      if (!e) return '';
      if (e.attackKind === 'riposte') {
        if (e.phase === 'telegraph') return 'Blocked! And now it answers — the shield rises.';
        if (e.phase === 'active')
          return 'The riposte. Attacking into the shield is what caused this.';
        if (e.phase === 'recovery') return 'Gold: shield down, wide open from every side. Take it.';
      }
      if (t < 1.4) return 'Shield across the front. Hitting it there just rings your nail.';
      return 'Patience beats armor. Provoke, dodge, punish — then step back.';
    },
  };
})();

/**
 * Warden shield + bash anatomy (playtest 1): hang above it and the shield
 * re-aims overhead — so the front is bare. Then stand there too long and it
 * comes for you. Positions are relative to the LIVE warden, which drifts.
 */
export const wardenShieldDemo: DemoScript = (() => {
  let scriptPlayer: Player | null = null;
  let frontHitAt = -1;
  let punishedAt = -1;
  let hoverX = 430;
  const STAND_OFF = 60;
  return {
    view: DEMO_VIEW,
    timeScale: 0.45,
    cycle: 6.6,
    setup: () => {
      scriptPlayer = createPlayer(300, DEMO_VIEW.floorY);
      frontHitAt = -1;
      punishedAt = -1;
      hoverX = 430;
      return {
        world: demoWorld(),
        enemy: createEnemy('warden', 430, DEMO_VIEW.floorY),
        ghost: { feet: { x: 300, y: DEMO_VIEW.floorY }, facing: 1, slashing: false },
        projectiles: [],
      };
    },
    drive: (actors, t) => {
      const g = actors.ghost;
      const e = actors.enemy;
      if (!g || !e || !scriptPlayer) return null;
      const wx = e.position.x;
      const inFrontX = wx - STAND_OFF;
      // Jump up over its head (t 0.6–1.2), hang there (1.2–1.9), drop in front (1.9–2.3).
      if (t >= 0.6 && t < 1.2) {
        const k = (t - 0.6) / 0.6;
        hoverX = wx;
        g.feet.x = 300 + (wx - 300) * k;
        g.feet.y = DEMO_VIEW.floorY - 120 * Math.sin((Math.PI / 2) * k);
      } else if (t >= 1.2 && t < 1.9) {
        g.feet.x = wx;
        g.feet.y = DEMO_VIEW.floorY - 120 - 6 * Math.sin((t - 1.2) * 9);
      } else if (t >= 1.9 && t < 2.3) {
        const k = (t - 1.9) / 0.4;
        g.feet.x = hoverX - STAND_OFF * k;
        g.feet.y = DEMO_VIEW.floorY - 120 * (1 - k * k);
      } else if (t >= 2.3 && frontHitAt < 0) {
        g.feet.x = inFrontX;
        g.feet.y = DEMO_VIEW.floorY;
      }
      g.facing = wx >= g.feet.x ? 1 : -1;
      scriptPlayer.position.x = g.feet.x;
      scriptPlayer.position.y = g.feet.y;
      // The front slash the moment it lands: the shield is still overhead.
      if (t >= 2.35 && frontHitAt < 0) {
        frontHitAt = t;
        scriptPlayer.swingId += 1;
        scriptPlayer.nailDir = 'side';
        scriptPlayer.nailFacing = g.facing;
        resolveNailHit(scriptPlayer, e, false);
        g.slashing = true;
      }
      if (frontHitAt > 0 && t > frontHitAt + 0.3) g.slashing = false;
      // Then it lingers… and the bash comes. Hop back during the tell/attack.
      if (e.attackKind === 'bash' && (e.phase === 'telegraph' || e.phase === 'active')) {
        g.feet.x = Math.max(140, Math.min(g.feet.x, wx - 150) - 240 * FIXED_DT);
      }
      // Run back in during recovery and take the gold window.
      if (e.attackKind === 'bash' && e.phase === 'recovery' && punishedAt < 0) {
        g.feet.x = Math.min(inFrontX, g.feet.x + 320 * FIXED_DT);
        if (g.feet.x >= inFrontX - 1) {
          punishedAt = t;
          scriptPlayer.swingId += 1;
          scriptPlayer.nailDir = 'side';
          scriptPlayer.nailFacing = g.facing;
          resolveNailHit(scriptPlayer, e, false);
          g.slashing = true;
        }
      }
      if (punishedAt > 0 && t > punishedAt + 0.3) {
        g.slashing = false;
        g.feet.x = Math.max(wx - 200, g.feet.x - 160 * FIXED_DT);
      }
      return null;
    },
    caption: (actors, t) => {
      const e = actors.enemy;
      if (!e) return '';
      if (e.attackKind === 'bash') {
        if (e.phase === 'telegraph')
          return 'Stood there too long — the hunch is the tell. Back off.';
        if (e.phase === 'active') return 'The bash. Nobody gets to stand still in front of it.';
        if (e.phase === 'recovery') return 'Gold: spent again. Take the hit it owes you.';
      }
      if (frontHitAt > 0 && t < frontHitAt + 0.7)
        return 'Shield’s still up top — the front is bare. That one lands.';
      if (e.shieldDir === 'up') return 'It raised the shield to meet you. Now watch the front.';
      if (t < 0.6) return 'Shield across the front. So… go over it.';
      return 'Hang above it and see where the shield goes.';
    },
  };
})();

/** Pogo rhythm: a real simulated knight bouncing on one orb, slowed down. */
export const pogoRhythmDemo: DemoScript = (() => {
  let stepCount = 0;
  let jumped = false;
  const ORB: AABB = { x: 306, y: 208, width: 28, height: 28 };
  return {
    view: DEMO_VIEW,
    timeScale: 0.5,
    cycle: 8,
    setup: () => {
      stepCount = 0;
      jumped = false;
      const world = demoWorld();
      world.pogoables = [ORB];
      return {
        world,
        player: createPlayer(320, DEMO_VIEW.floorY),
        orbs: [ORB],
        projectiles: [],
      };
    },
    drive: (actors, t) => {
      stepCount++;
      const p = actors.player;
      if (!p) return null;
      const airborne = !p.grounded;
      const jumpNow = t >= 0.3 && !jumped && p.grounded;
      if (jumpNow) jumped = true;
      return {
        ...IDLE_INPUT,
        jumpPressed: jumpNow,
        jumpHeld: jumped && t < 0.55,
        down: airborne,
        attackPressed: airborne && stepCount % 3 === 0,
      };
    },
    caption: (actors, t) => {
      const p = actors.player;
      if (!p) return '';
      if (t < 0.3) return 'One orb. Watch the rhythm, not the height.';
      if (p.pogoPinElapsed >= 0)
        return 'The bounce: a quarter-second rise, then float. Dash comes back too.';
      if (!p.grounded) return 'Hold DOWN in the air — the green arc is your down-slash. It’s WIDE.';
      return 'Jump, slash down, rise, repeat. About two bounces a second.';
    },
  };
})();
