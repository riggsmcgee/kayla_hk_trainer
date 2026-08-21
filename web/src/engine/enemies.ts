/**
 * Enemy simulation (M3: walker + flier dummies; M4 adds the attackers).
 *
 * Positions are FEET-CENTER anchored, matching the player, so ground
 * snapping and drawing share conventions. Hitboxes equal visuals on
 * purpose — the site teaches by showing true hitboxes (PLAN §3).
 */

import { ENEMIES } from './constants';
import type { EnemyId } from '@dojo/shared';
import type { Player } from './player';
import type { AABB, AttackPhase, EnemyState, Vec2, World } from './types';

/** What the attacker state machines know about the player. */
export interface Target {
  position: Vec2;
  grounded: boolean;
}

/** One spitter shot. Nail contact destroys it; body contact is a hit. */
export interface Projectile {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  dead: boolean;
}

export type AttackKind = 'lunge' | 'antiair' | 'volley' | 'riposte';

/**
 * Attack tuning beyond the research-sourced ENEMIES table. Everything here
 * is estimated (the warden has no HK analog at all); telegraph durations
 * come from ENEMIES[id].telegraph.
 */
export const ATTACKS = {
  duelist: {
    /** Ground approach inside this range provokes the lunge. */
    triggerRange: 190,
    /** Airborne approach inside this range provokes the rising swipe. */
    antiAirRange: 150,
    lungeSpeed: 600,
    lungeTime: 0.3,
    lungeRecovery: 0.7,
    antiAirActive: 0.25,
    antiAirRecovery: 0.55,
    /** Pause after recovery before it can be provoked again. */
    cooldown: 0.6,
    /** Idle drift toward the player, forcing engagement. */
    approachSpeed: 45,
  },
  spitter: {
    volleyEvery: 2.5,
    shots: 3,
    spreadDeg: 35,
    projSpeed: 340,
    activeTime: 0.12,
    recovery: 0.8,
    /** It maneuvers to hold roughly this horizontal distance. */
    preferredRange: 320,
    rangeSlack: 50,
    strafeSpeed: 80,
    sightRange: 700,
  },
  warden: {
    approachSpeed: 32,
    riposteActive: 0.35,
    riposteSpeed: 220,
    riposteRecovery: 0.9,
  },
} as const;

/** Full simulation state for one enemy. */
export interface Enemy extends EnemyState {
  /** HP in nail hits (see ENEMIES tuning). */
  hp: number;
  dead: boolean;
  /** Seconds of white hurt-flash remaining after a nail hit. */
  hurtFlashTimer: number;
  /** Seconds of shield-clink flash remaining after a blocked hit (warden). */
  blockFlashTimer: number;
  /** The last player swing that landed — one hit per swing. */
  lastHitSwingId: number;
  /** Flier/spitter: fixed home point for altitude/bobbing. */
  home: Vec2;
  /** Phase clock driving deterministic drift/flapping. */
  bobPhase: number;
  /** Which attack the current telegraph/active/recovery belongs to. */
  attackKind: AttackKind | null;
  /** Seconds left in the current phase (telegraph/active/recovery). */
  phaseTimer: number;
  /** Duelist: re-trigger pause. Spitter: volley cadence. */
  cooldownTimer: number;
  /** Direction an attack committed to at its start. */
  lockedDir: 1 | -1;
}

/** Visual/collision sizes per enemy (width × height, feet-anchored). */
export const ENEMY_SIZES: Record<EnemyId, { width: number; height: number }> = {
  walker: { width: 44, height: 26 },
  flier: { width: 32, height: 30 },
  spitter: { width: 38, height: 34 },
  duelist: { width: 34, height: 52 },
  warden: { width: 40, height: 56 },
};

export function createEnemy(id: EnemyId, x: number, y: number): Enemy {
  return {
    id,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    facing: -1,
    hp: ENEMIES[id].hp,
    phase: 'idle' as AttackPhase,
    dead: false,
    hurtFlashTimer: 0,
    blockFlashTimer: 0,
    lastHitSwingId: 0,
    home: { x, y },
    bobPhase: 0,
    attackKind: null,
    phaseTimer: 0,
    // The spitter waits a beat before its first volley; others start ready.
    cooldownTimer: id === 'spitter' ? 1.0 : 0,
    lockedDir: -1,
  };
}

export function enemyBox(e: Enemy): AABB {
  const size = ENEMY_SIZES[e.id];
  return {
    x: e.position.x - size.width / 2,
    y: e.position.y - size.height,
    width: size.width,
    height: size.height,
  };
}

function solidAt(world: World, x: number, y: number): boolean {
  return world.solids.some(
    (s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height,
  );
}

/** Ground pacer: walk, turn at walls and at ledge edges. */
function stepWalker(e: Enemy, world: World, dt: number): void {
  const speed = ENEMIES.walker.speed ?? 80;
  const size = ENEMY_SIZES.walker;
  const aheadX = e.position.x + e.facing * (size.width / 2 + 2);
  const wallAhead = solidAt(world, aheadX, e.position.y - size.height / 2);
  const groundAhead = solidAt(world, aheadX, e.position.y + 6);
  if (wallAhead || !groundAhead) {
    e.facing = (e.facing * -1) as 1 | -1;
  }
  e.velocity.x = e.facing * speed;
  e.position.x += e.velocity.x * dt;
}

/**
 * Drifting dummy: a deterministic Lissajous bob around its home point.
 * No RNG — the same session replays identically (lesson demos rely on it).
 */
function stepFlier(e: Enemy, world: World, dt: number): void {
  void world;
  e.bobPhase += dt;
  const t = e.bobPhase;
  const nx = e.home.x + Math.sin(t * 0.9) * 80;
  const ny = e.home.y + Math.sin(t * 1.7 + 1.2) * 34;
  e.velocity.x = (nx - e.position.x) / dt;
  e.facing = nx >= e.position.x ? 1 : -1;
  e.position.x = nx;
  e.position.y = ny;
}

function setPhase(e: Enemy, phase: AttackPhase, seconds: number): void {
  e.phase = phase;
  e.phaseTimer = seconds;
}

function faceTarget(e: Enemy, t: Target): void {
  e.facing = t.position.x >= e.position.x ? 1 : -1;
}

/** Horizontal drift with a wall probe so nothing walks into geometry. */
function drift(e: Enemy, world: World, dir: 1 | -1, speed: number, dt: number): void {
  const size = ENEMY_SIZES[e.id];
  const aheadX = e.position.x + dir * (size.width / 2 + 4);
  if (solidAt(world, aheadX, e.position.y - size.height / 2)) return;
  e.position.x += dir * speed * dt;
}

/**
 * Reactive melee duelist: your approach picks its answer. Ground approach →
 * lunge; jumping in → rising swipe. Recovery is the punish window.
 */
function stepDuelist(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  const A = ATTACKS.duelist;
  const telegraph = ENEMIES.duelist.telegraph ?? 0.35;
  e.phaseTimer -= dt;
  switch (e.phase) {
    case 'idle': {
      e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);
      if (!t) return;
      faceTarget(e, t);
      const dx = t.position.x - e.position.x;
      const adx = Math.abs(dx);
      const airborneAbove = !t.grounded && t.position.y < e.position.y - 20;
      if (e.cooldownTimer <= 0 && airborneAbove && adx < A.antiAirRange) {
        e.attackKind = 'antiair';
        e.lockedDir = e.facing;
        setPhase(e, 'telegraph', telegraph);
      } else if (
        e.cooldownTimer <= 0 &&
        t.grounded &&
        adx < A.triggerRange &&
        // Same elevation only: a player perched on a platform above is not
        // "approaching on the ground", and a lunge at a ceiling is nonsense.
        Math.abs(t.position.y - e.position.y) < 60
      ) {
        e.attackKind = 'lunge';
        e.lockedDir = dx >= 0 ? 1 : -1;
        setPhase(e, 'telegraph', telegraph);
      } else if (adx < 420 && adx > A.triggerRange) {
        drift(e, world, dx >= 0 ? 1 : -1, A.approachSpeed, dt);
      }
      break;
    }
    case 'telegraph':
      if (e.phaseTimer <= 0) {
        setPhase(e, 'active', e.attackKind === 'lunge' ? A.lungeTime : A.antiAirActive);
      }
      break;
    case 'active':
      if (e.attackKind === 'lunge') {
        drift(e, world, e.lockedDir, A.lungeSpeed, dt);
      }
      if (e.phaseTimer <= 0) {
        setPhase(e, 'recovery', e.attackKind === 'lunge' ? A.lungeRecovery : A.antiAirRecovery);
      }
      break;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        e.cooldownTimer = A.cooldown;
        setPhase(e, 'idle', 0);
      }
      break;
  }
}

/**
 * Ranged spitter: holds distance, winds up, spits a 3-shot fan, and is wide
 * open in recovery — the window to close in and punish.
 */
function stepSpitter(e: Enemy, world: World, dt: number, t: Target | undefined): Projectile[] | null {
  const A = ATTACKS.spitter;
  const telegraph = ENEMIES.spitter.telegraph ?? 0.5;
  e.bobPhase += dt;
  e.position.y = e.home.y + Math.sin(e.bobPhase * 2.2) * 10;
  e.phaseTimer -= dt;
  switch (e.phase) {
    case 'idle': {
      e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);
      if (!t) return null;
      faceTarget(e, t);
      const dx = t.position.x - e.position.x;
      const adx = Math.abs(dx);
      if (adx < A.preferredRange - A.rangeSlack) {
        drift(e, world, dx >= 0 ? -1 : 1, A.strafeSpeed, dt); // back off
      } else if (adx > A.preferredRange + A.rangeSlack && adx < A.sightRange) {
        drift(e, world, dx >= 0 ? 1 : -1, A.strafeSpeed, dt); // close in
      }
      if (e.cooldownTimer <= 0 && adx < A.sightRange) {
        e.attackKind = 'volley';
        setPhase(e, 'telegraph', telegraph);
      }
      break;
    }
    case 'telegraph':
      if (e.phaseTimer <= 0) {
        setPhase(e, 'active', A.activeTime);
        if (t) {
          // Fire on the transition: a fan centered on the player's chest.
          const size = ENEMY_SIZES.spitter;
          const mouth: Vec2 = {
            x: e.position.x + e.facing * 10,
            y: e.position.y - size.height / 2,
          };
          const aim = Math.atan2(t.position.y - 24 - mouth.y, t.position.x - mouth.x);
          const spread = (A.spreadDeg * Math.PI) / 180;
          const shots: Projectile[] = [];
          for (let i = 0; i < A.shots; i++) {
            const angle = aim + spread * (i / (A.shots - 1) - 0.5);
            shots.push({
              position: { ...mouth },
              velocity: {
                x: Math.cos(angle) * A.projSpeed,
                y: Math.sin(angle) * A.projSpeed,
              },
              radius: 7,
              dead: false,
            });
          }
          return shots;
        }
      }
      break;
    case 'active':
      if (e.phaseTimer <= 0) setPhase(e, 'recovery', A.recovery);
      break;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        e.cooldownTimer = A.volleyEvery;
        setPhase(e, 'idle', 0);
      }
      break;
  }
  return null;
}

/**
 * Shield warden: advances slowly, blocks every hit outside recovery, and
 * answers a blocked hit with a telegraphed riposte. Post-riposte recovery
 * is its ONLY vulnerable window — the full doctrine in one enemy.
 */
function stepWarden(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  const A = ATTACKS.warden;
  const telegraph = ENEMIES.warden.telegraph ?? 0.4;
  void telegraph; // riposte telegraph is set where the block happens
  e.phaseTimer -= dt;
  switch (e.phase) {
    case 'idle': {
      if (!t) return;
      faceTarget(e, t);
      const dx = t.position.x - e.position.x;
      if (Math.abs(dx) > 60 && Math.abs(dx) < 520) {
        drift(e, world, dx >= 0 ? 1 : -1, A.approachSpeed, dt);
      }
      break;
    }
    case 'telegraph':
      if (e.phaseTimer <= 0) setPhase(e, 'active', A.riposteActive);
      break;
    case 'active':
      drift(e, world, e.lockedDir, A.riposteSpeed, dt);
      if (e.phaseTimer <= 0) setPhase(e, 'recovery', A.riposteRecovery);
      break;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        setPhase(e, 'idle', 0);
      }
      break;
  }
}

/**
 * Advance one enemy by one step. Attackers need to see the player (`target`);
 * the dummies ignore it. Returns projectiles spawned this step, if any.
 */
export function stepEnemy(
  e: Enemy,
  world: World,
  dt: number,
  target?: Target,
): Projectile[] | null {
  e.hurtFlashTimer = Math.max(0, e.hurtFlashTimer - dt);
  e.blockFlashTimer = Math.max(0, e.blockFlashTimer - dt);
  if (e.dead) return null;
  switch (e.id) {
    case 'walker':
      stepWalker(e, world, dt);
      return null;
    case 'flier':
      stepFlier(e, world, dt);
      return null;
    case 'duelist':
      stepDuelist(e, world, dt, target);
      return null;
    case 'spitter':
      return stepSpitter(e, world, dt, target);
    case 'warden':
      stepWarden(e, world, dt, target);
      return null;
  }
}

/** The active-phase hitbox that damages the player, or null. */
export function enemyAttackHitbox(e: Enemy): AABB | null {
  if (e.dead || e.phase !== 'active' || !e.attackKind) return null;
  const size = ENEMY_SIZES[e.id];
  const front = e.position.x + e.lockedDir * (size.width / 2);
  switch (e.attackKind) {
    case 'lunge':
      return {
        x: e.lockedDir === 1 ? front : front - 60,
        y: e.position.y - 46,
        width: 60,
        height: 44,
      };
    case 'antiair':
      return {
        x: e.position.x - 34,
        y: e.position.y - size.height - 52,
        width: 68,
        height: 52,
      };
    case 'riposte':
      return {
        x: e.lockedDir === 1 ? front : front - 64,
        y: e.position.y - 52,
        width: 64,
        height: 50,
      };
    case 'volley':
      return null; // the projectiles carry the threat
  }
}

/** One projectile step: straight flight; dies on world geometry. */
export function stepProjectile(p: Projectile, world: World, dt: number): void {
  if (p.dead) return;
  p.position.x += p.velocity.x * dt;
  p.position.y += p.velocity.y * dt;
  if (solidAt(world, p.position.x, p.position.y)) p.dead = true;
  if (Math.abs(p.position.x) > 8000 || Math.abs(p.position.y) > 4000) p.dead = true;
}

export type NailHitResult = 'hit' | 'blocked' | 'none';

/**
 * Resolve one nail contact with an enemy for the player's current swing
 * (each swing resolves at most once per enemy). `lethal` is false in
 * observe mode: everything reacts — flashes, blocks, provocations — but
 * hp never moves.
 *
 * The warden blocks every hit outside its post-riposte recovery, and a
 * blocked hit while idle provokes the riposte.
 */
export function resolveNailHit(player: Player, e: Enemy, lethal: boolean): NailHitResult {
  if (e.dead || e.lastHitSwingId === player.swingId) return 'none';
  e.lastHitSwingId = player.swingId;

  if (e.id === 'warden' && e.phase !== 'recovery') {
    e.blockFlashTimer = 0.18;
    if (e.phase === 'idle') {
      e.attackKind = 'riposte';
      e.lockedDir = player.position.x >= e.position.x ? 1 : -1;
      e.facing = e.lockedDir;
      setPhase(e, 'telegraph', ENEMIES.warden.telegraph ?? 0.4);
    }
    return 'blocked';
  }

  e.hurtFlashTimer = 0.18;
  if (lethal) {
    e.hp -= 1;
    if (e.hp <= 0) {
      e.hp = 0;
      e.dead = true;
    }
  }
  return 'hit';
}

/**
 * Apply one lethal nail hit. Returns true if it landed. Kept as the simple
 * damage seam; resolveNailHit adds block/observe semantics on top.
 */
export function applyNailHit(player: Player, e: Enemy): boolean {
  return resolveNailHit(player, e, true) === 'hit';
}
