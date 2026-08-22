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

export type AttackKind = 'lunge' | 'antiair' | 'volley' | 'riposte' | 'bash';

/** Where the warden's shield is held: across its front, or overhead. */
export type ShieldDir = 'front' | 'up';

/**
 * Attack and hunting tuning beyond the research-sourced ENEMIES table.
 * Everything here is estimated (the warden has no HK analog at all);
 * telegraph durations come from ENEMIES[id].telegraph.
 *
 * Playtest 2: every enemy HUNTS — the arena has no safe corner. The hunt
 * speeds are set so that any enemy reaches a Knight standing still on the
 * far side of the Colosseum inside ten seconds (enemies.test.ts pins it).
 */
export const ATTACKS = {
  walker: {
    /** Walking at the Knight; patrol (no target) keeps ENEMIES.walker.speed. */
    chaseSpeed: 100,
    /** Don't flip every frame when it's right under her — pace a little. */
    turnSlack: 12,
  },
  flier: {
    /**
     * Its bobbing home point drifts toward the Knight's chest this fast —
     * the Vengefly's chase speed from the research table. Playtest 2 asked
     * for ~70, but with the 7 s bob period anything under ~125 leaves the
     * far corner unreached after 10 s (measured against the property test).
     */
    huntSpeed: ENEMIES.flier.speed ?? 150,
    /** Lissajous amplitudes: wide sweeps through her, a shallow rise and fall. */
    bobX: 80,
    bobY: 26,
  },
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
    /**
     * Idle closing speed inside stalkRange — cooldown or not. Playtest 2
     * asked for ~80, but the anti-air lesson demo's 2.8 s cycle is cut to
     * this pace: anything over ~50 lets a ground lunge wear its captions.
     * So the stalk stays slow and the hunt is the march.
     */
    approachSpeed: 45,
    /** Beyond stalkRange it marches — no corner of the arena is out of reach. */
    marchSpeed: 100,
    stalkRange: 300,
    /** It closes no nearer than this while waiting to be provoked. */
    standOff: 100,
  },
  spitter: {
    volleyEvery: 2.5,
    shots: 3,
    spreadDeg: 35,
    projSpeed: 340,
    activeTime: 0.12,
    recovery: 0.8,
    /** It maneuvers to hold roughly this horizontal distance. */
    preferredRange: 220,
    rangeSlack: 50,
    /** Closing in. */
    strafeSpeed: 80,
    /** Backing off when crowded — slower than closing, so the net drift is inward. */
    backOffSpeed: 45,
    /** It hovers with its feet this far above hers: inside a side slash and an upslash. */
    hoverAbove: 44,
    /** Altitude adjustment speed. */
    climbSpeed: 80,
    sightRange: 700,
  },
  warden: {
    /** The deliberate stalk once it's near enough to square up. */
    approachSpeed: 60,
    /** Further out it marches — no corner of the arena is out of its reach. */
    marchSpeed: 130,
    /** Inside this horizontal distance it slows from the march to the stalk. */
    stalkRange: 240,
    riposteActive: 0.35,
    riposteSpeed: 220,
    riposteRecovery: 0.9,
    /**
     * Seconds the Knight must be on the other side of the shield before it
     * re-aims — the window "hit where it isn't" lives in (playtest 1).
     */
    reaimDelay: 0.3,
    /**
     * Coming back down is quicker than going up: the open-front window is
     * for the drop-and-strike, not for standing there. The clock decays
     * rather than resetting, so brief hops can't keep the front bare.
     */
    reaimDownDelay: 0.18,
    /** The Knight counts as "above" inside this horizontal half-width. */
    overheadHalfWidth: 80,
    /** Lingering counts anywhere in front up to a full jump high — hopping in place is still lingering. */
    bashHeight: 240,
    /** Seconds of lingering in front (within bashRange) before it bashes. */
    bashLinger: 1.2,
    bashRange: 130,
    bashActive: 0.25,
    bashSpeed: 240,
    bashRecovery: 0.8,
    /** Pause after any attack before lingering counts again. */
    bashCooldown: 0.9,
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
  /** Flier/spitter: the home point the body bobs around; it drifts toward the Knight. */
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
  /** Warden: which side the shield covers right now. */
  shieldDir: ShieldDir;
  /** Warden: seconds the Knight has been on the uncovered side (re-aim clock). */
  shieldReaimTimer: number;
  /** Warden: seconds the Knight has lingered in bash range. */
  lingerTimer: number;
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
    shieldDir: 'front',
    shieldReaimTimer: 0,
    lingerTimer: 0,
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

/** The feet-anchored body box this enemy would have at (x, y). */
function bodyAt(id: EnemyId, x: number, y: number): AABB {
  const size = ENEMY_SIZES[id];
  return { x: x - size.width / 2, y: y - size.height, width: size.width, height: size.height };
}

/** The first solid this box is strictly inside, if any — touching a surface is not being inside it. */
function blockerOf(world: World, box: AABB): AABB | null {
  for (const s of world.solids) {
    if (
      box.x < s.x + s.width &&
      box.x + box.width > s.x &&
      box.y < s.y + s.height &&
      box.y + box.height > s.y
    ) {
      return s;
    }
  }
  return null;
}

function insideSolid(world: World, box: AABB): boolean {
  return blockerOf(world, box) !== null;
}

/** Chest height above the feet — where the fliers aim themselves and their shots. */
const CHEST = 24;

/** Can the walker step that way — floor under its toes and no wall in its face? */
function footingAhead(e: Enemy, world: World, dir: 1 | -1): boolean {
  const size = ENEMY_SIZES.walker;
  const aheadX = e.position.x + dir * (size.width / 2 + 2);
  const wallAhead = solidAt(world, aheadX, e.position.y - size.height / 2);
  const groundAhead = solidAt(world, aheadX, e.position.y + 6);
  return !wallAhead && groundAhead;
}

/**
 * Ground pacer: walks at the Knight when it can see her, patrols when it
 * can't. Either way it turns at walls and at ledge edges — with her up on
 * a platform it paces beneath her rather than walking off.
 */
function stepWalker(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  const speed = t ? ATTACKS.walker.chaseSpeed : (ENEMIES.walker.speed ?? 80);
  if (t) {
    const dx = t.position.x - e.position.x;
    if (Math.abs(dx) > ATTACKS.walker.turnSlack) {
      const toward: 1 | -1 = dx >= 0 ? 1 : -1;
      if (toward !== e.facing && footingAhead(e, world, toward)) e.facing = toward;
    }
  }
  if (!footingAhead(e, world, e.facing)) {
    e.facing = (e.facing * -1) as 1 | -1;
  }
  e.velocity.x = e.facing * speed;
  e.position.x += e.velocity.x * dt;
}

/** How fast an airborne body may move per axis to keep up with where it wants to be. */
const FLY_FOLLOW_SPEED = 260;

/**
 * Farthest a blocked airborne body will sidestep to get round what blocks
 * it. Covers a ledge (140 wide, 18 tall); never a wall or the floor, which
 * it simply presses against.
 */
const SIDESTEP_REACH = 160;

/**
 * Pick the nearer of two sidestep targets the body could actually occupy —
 * preferring the one on the side `want` lies — or null when both are out of
 * reach (a wall, the floor) or themselves inside something.
 */
function pickSidestep(
  here: number,
  want: number,
  lo: number,
  hi: number,
  freeAt: (v: number) => boolean,
): number | null {
  const order = want <= lo ? [lo, hi] : want >= hi ? [hi, lo] : here - lo < hi - here ? [lo, hi] : [hi, lo];
  for (const v of order) {
    if (Math.abs(v - here) <= SIDESTEP_REACH && freeAt(v)) return v;
  }
  return null;
}

/**
 * Move an airborne body toward `want`, one axis at a time, never into a
 * solid. An axis blocked by geometry the body wants to be clear of — the
 * ledge between it and the Knight standing on top — makes the OTHER axis
 * sidestep round the blocker's nearer edge instead of tracking `want`, so
 * nothing hovers forever under a platform. A blocked axis whose `want` is
 * merely grazing the surface (a bob dipping into the floor) simply waits.
 * (A body somehow already inside geometry is let out rather than pinned.)
 */
function flyToward(e: Enemy, world: World, want: Vec2, dt: number): void {
  const size = ENEMY_SIZES[e.id];
  const cap = FLY_FOLLOW_SPEED * dt;
  const clamp = (v: number): number => Math.max(-cap, Math.min(cap, v));
  const { x, y } = e.position;
  const free = !insideSolid(world, bodyAt(e.id, x, y));

  let gx = want.x;
  let gy = want.y;
  if (free) {
    // Is `want` genuinely past this solid's height band — not a bob grazing its surface?
    const wantBeyond = (s: AABB): boolean =>
      want.y <= s.y || want.y - size.height >= s.y + s.height;
    const blockX = blockerOf(world, bodyAt(e.id, x + clamp(want.x - x), y));
    const blockY = blockerOf(world, bodyAt(e.id, x, y + clamp(want.y - y)));
    // Up or down round whatever stops the sideways move.
    if (blockX && wantBeyond(blockX)) {
      const above = blockX.y;
      const below = blockX.y + blockX.height + size.height;
      gy =
        pickSidestep(y, want.y, above, below, (v) => !insideSolid(world, bodyAt(e.id, x, v))) ??
        want.y;
    }
    // Left or right round whatever stops the vertical move.
    if (blockY && wantBeyond(blockY)) {
      const left = blockY.x - size.width / 2;
      const right = blockY.x + blockY.width + size.width / 2;
      gx =
        pickSidestep(x, want.x, left, right, (v) => !insideSolid(world, bodyAt(e.id, v, y))) ??
        want.x;
    }
  }

  const nx = x + clamp(gx - x);
  if (!free || !insideSolid(world, bodyAt(e.id, nx, y))) e.position.x = nx;
  const ny = y + clamp(gy - y);
  if (!free || !insideSolid(world, bodyAt(e.id, e.position.x, ny))) e.position.y = ny;
}

/**
 * Steer an airborne enemy's home point straight toward `goal` at `speed`.
 * The home is invisible and its goal is always open air (the Knight's chest
 * or the band above her feet), so it ignores geometry; the body that bobs
 * around it is what flyToward keeps out of the walls and round the ledges.
 */
function steerHome(e: Enemy, goal: Vec2, speed: number, dt: number): void {
  const dx = goal.x - e.home.x;
  const dy = goal.y - e.home.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return;
  const step = Math.min(dist, speed * dt);
  e.home.x += (dx / dist) * step;
  e.home.y += (dy / dist) * step;
}

/**
 * Drifting dummy: a deterministic Lissajous bob around its home point — and
 * the home point hunts, drifting toward the Knight's chest. No RNG — the
 * same session replays identically (lesson demos rely on it).
 */
function stepFlier(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  e.bobPhase += dt;
  if (t) {
    steerHome(e, { x: t.position.x, y: t.position.y - CHEST }, ATTACKS.flier.huntSpeed, dt);
  }
  const ph = e.bobPhase;
  const want: Vec2 = {
    x: e.home.x + Math.sin(ph * 0.9) * ATTACKS.flier.bobX,
    y: e.home.y + Math.sin(ph * 1.7 + 1.2) * ATTACKS.flier.bobY,
  };
  const x0 = e.position.x;
  flyToward(e, world, want, dt);
  e.velocity.x = (e.position.x - x0) / dt;
  if (e.position.x !== x0) e.facing = e.position.x > x0 ? 1 : -1;
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
      } else if (adx > A.standOff) {
        // Hunting: march from anywhere, stalk once near — cooldown or not.
        const speed = adx > A.stalkRange ? A.marchSpeed : A.approachSpeed;
        drift(e, world, dx >= 0 ? 1 : -1, speed, dt);
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
 * Spitter hunting: hold the preferred range — closing in faster than it
 * backs off, so the net drift is always inward — and hover in her height
 * band so a slash can reach it. Moves the home point; the body follows in
 * stepSpitter, which keeps it out of the geometry.
 */
function spitterManeuver(e: Enemy, t: Target, dt: number): void {
  const A = ATTACKS.spitter;
  const dx = t.position.x - e.position.x;
  const adx = Math.abs(dx);
  let vx = 0;
  if (adx < A.preferredRange - A.rangeSlack) {
    vx = (dx >= 0 ? -1 : 1) * A.backOffSpeed; // crowded: back off, slowly
  } else if (adx > A.preferredRange + A.rangeSlack) {
    vx = (dx >= 0 ? 1 : -1) * A.strafeSpeed; // close in
  }
  e.home.x += vx * dt;
  const dy = t.position.y - A.hoverAbove - e.home.y;
  e.home.y += Math.sign(dy) * Math.min(Math.abs(dy), A.climbSpeed * dt);
}

/**
 * Ranged spitter: holds distance, winds up, spits a 3-shot fan, and is wide
 * open in recovery — the window to close in and punish. The brain runs the
 * phases; the body then rides a small bob around the home point, never into
 * geometry.
 */
function stepSpitter(
  e: Enemy,
  world: World,
  dt: number,
  t: Target | undefined,
): Projectile[] | null {
  e.bobPhase += dt;
  e.phaseTimer -= dt;
  const shots = spitterPhases(e, dt, t);
  const want: Vec2 = { x: e.home.x, y: e.home.y + Math.sin(e.bobPhase * 2.2) * 10 };
  flyToward(e, world, want, dt);
  return shots;
}

function spitterPhases(e: Enemy, dt: number, t: Target | undefined): Projectile[] | null {
  const A = ATTACKS.spitter;
  const telegraph = ENEMIES.spitter.telegraph ?? 0.5;
  switch (e.phase) {
    case 'idle': {
      e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);
      if (!t) return null;
      faceTarget(e, t);
      spitterManeuver(e, t, dt);
      const adx = Math.abs(t.position.x - e.position.x);
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
          const aim = Math.atan2(t.position.y - CHEST - mouth.y, t.position.x - mouth.x);
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

/** Is the target overhead (feet above the warden's head, roughly centred)? */
function overhead(e: Enemy, t: Target): boolean {
  const size = ENEMY_SIZES.warden;
  return (
    t.position.y < e.position.y - size.height * 0.8 &&
    Math.abs(t.position.x - e.position.x) < ATTACKS.warden.overheadHalfWidth
  );
}

/**
 * Shield warden (playtest 1 redesign): the shield covers ONE side — its
 * front, or overhead once the Knight hangs above it — and re-aims only after
 * a short delay, so the uncovered side is a real weak spot. A hit into the
 * shield is blocked and provokes a riposte; a Knight who lingers in front is
 * bashed unprovoked. Recovery after either attack is open from every side.
 */
function stepWarden(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  const A = ATTACKS.warden;
  const telegraph = ENEMIES.warden.telegraph ?? 0.4;
  e.phaseTimer -= dt;
  e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);

  // Shield aim: track the Knight's side with a re-aim delay. While attacking
  // the shield is committed forward (a swung shield can't also cover the head).
  if (t && (e.phase === 'idle' || e.phase === 'recovery')) {
    const wanted: ShieldDir = overhead(e, t) ? 'up' : 'front';
    if (wanted !== e.shieldDir) {
      e.shieldReaimTimer += dt;
      const delay = wanted === 'up' ? A.reaimDelay : A.reaimDownDelay;
      if (e.shieldReaimTimer >= delay - 1e-9) {
        e.shieldDir = wanted;
        e.shieldReaimTimer = 0;
      }
    } else {
      // Decay, don't reset: a frame of agreement must not erase the clock.
      e.shieldReaimTimer = Math.max(0, e.shieldReaimTimer - dt);
    }
  }

  switch (e.phase) {
    case 'idle': {
      if (!t) return;
      faceTarget(e, t);
      const dx = t.position.x - e.position.x;
      const adx = Math.abs(dx);
      // Hunting: march from anywhere, stalk once it's close enough to square up.
      if (adx > 60) {
        const speed = adx > A.stalkRange ? A.marchSpeed : A.approachSpeed;
        drift(e, world, dx >= 0 ? 1 : -1, speed, dt);
      }
      // Lingering in front — on the ground or hopping — draws the bash.
      const dy = e.position.y - t.position.y;
      const inFront = adx < A.bashRange && dy > -60 && dy < A.bashHeight;
      if (inFront && e.cooldownTimer <= 0) {
        e.lingerTimer += dt;
        if (e.lingerTimer >= A.bashLinger - 1e-9) {
          e.lingerTimer = 0;
          e.attackKind = 'bash';
          e.lockedDir = dx >= 0 ? 1 : -1;
          e.facing = e.lockedDir;
          e.shieldDir = 'front';
          e.shieldReaimTimer = 0;
          setPhase(e, 'telegraph', telegraph);
        }
      } else {
        e.lingerTimer = Math.max(0, e.lingerTimer - dt * 2); // forgets fast
      }
      break;
    }
    case 'telegraph':
      if (e.phaseTimer <= 0) {
        setPhase(e, 'active', e.attackKind === 'bash' ? A.bashActive : A.riposteActive);
      }
      break;
    case 'active':
      drift(e, world, e.lockedDir, e.attackKind === 'bash' ? A.bashSpeed : A.riposteSpeed, dt);
      if (e.phaseTimer <= 0) {
        setPhase(e, 'recovery', e.attackKind === 'bash' ? A.bashRecovery : A.riposteRecovery);
      }
      break;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        e.cooldownTimer = A.bashCooldown;
        e.lingerTimer = 0;
        setPhase(e, 'idle', 0);
      }
      break;
  }
}

/**
 * Advance one enemy by one step. Every enemy hunts the player (`target`)
 * when it can see one; without a target the dummies patrol and the
 * attackers hold still. Returns projectiles spawned this step, if any.
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
      stepWalker(e, world, dt, target);
      return null;
    case 'flier':
      stepFlier(e, world, dt, target);
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
    case 'bash':
      return {
        x: e.lockedDir === 1 ? front : front - 56,
        y: e.position.y - 50,
        width: 56,
        height: 48,
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
 * The warden blocks a hit that comes into the side its shield covers (front
 * or overhead) outside recovery; a blocked hit while idle provokes the
 * riposte. Hits into the open side — the other direction, or from behind —
 * land like on anyone else.
 */
export function resolveNailHit(player: Player, e: Enemy, lethal: boolean): NailHitResult {
  if (e.dead || e.lastHitSwingId === player.swingId) return 'none';
  e.lastHitSwingId = player.swingId;

  if (e.id === 'warden' && e.phase !== 'recovery' && shieldCovers(player, e)) {
    e.blockFlashTimer = 0.18;
    if (e.phase === 'idle') {
      e.attackKind = 'riposte';
      e.lockedDir = player.position.x >= e.position.x ? 1 : -1;
      e.facing = e.lockedDir;
      // A swung shield can't also cover the head (same commitment as the bash).
      e.shieldDir = 'front';
      e.shieldReaimTimer = 0;
      e.lingerTimer = 0;
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

/** Does the warden's shield stand between this swing and its body? */
function shieldCovers(player: Player, e: Enemy): boolean {
  const hitFrom: ShieldDir = player.nailDir === 'down' ? 'up' : 'front';
  if (hitFrom !== e.shieldDir) return false;
  if (hitFrom === 'front') {
    const side = Math.sign(player.position.x - e.position.x);
    if (side !== 0 && side !== e.facing) return false; // from behind: open
  }
  return true;
}

/**
 * Apply one lethal nail hit. Returns true if it landed. Kept as the simple
 * damage seam; resolveNailHit adds block/observe semantics on top.
 */
export function applyNailHit(player: Player, e: Enemy): boolean {
  return resolveNailHit(player, e, true) === 'hit';
}
