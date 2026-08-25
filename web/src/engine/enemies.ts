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

/**
 * Every attack any enemy can be in the middle of. The union is complete up
 * front — `enemyAttackHitbox`'s switch is exhaustive with no `default`, so a
 * kind added later would break the build rather than silently draw nothing.
 *
 * duelist: lunge, antiair, leap · spitter: volley · warden: riposte, bash,
 * skyward · bill: lance, swat · dog: bones, roll.
 */
export type AttackKind =
  | 'lunge'
  | 'antiair'
  | 'leap'
  | 'volley'
  | 'riposte'
  | 'bash'
  | 'skyward'
  | 'lance'
  | 'swat'
  | 'bones'
  | 'roll';

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
    /**
     * The anti-air is a tall forward COLUMN, not a swipe over his head
     * (playtest 3, note 6: "I can pogo him forever").
     *
     * Measured, not guessed. His old box spanned 52-104 px above his feet.
     * A straight-down pogo chain keeps her feet in [116, 242] — contact at
     * ~120, apex ~240, one bounce every 0.600 s — so she was 12 px above the
     * top of it for the whole chain, every chain, forever.
     *
     * 210 catches her anywhere in that band. +-60 wide because the only
     * escape must be HORIZONTAL: 0.35 s of telegraph buys her 116 px at run
     * speed (332) or 233 on a dash, so running clears the column with 56 px
     * to spare, and bouncing again does not. He stays on the ground in the
     * simulation — the leap is drawing only.
     */
    antiAirTop: 210,
    antiAirWidth: 120,
    /** The column sits this far forward of his centre, along lockedDir. */
    antiAirForward: 20,
    /** He carries the swipe forward at this speed while it is live. */
    antiAirDashSpeed: 260,
    /**
     * The gap-closer (playtest 3, note 3 — one attack per thing she can do:
     * come in on the ground, come in from above, or stay away).
     *
     * Standing off beyond gapRange for gapDwell seconds provokes a leap: he
     * rises to a perch, hangs there long enough to be read, then dives along
     * the line he committed to at the end of the hang. The dive is the only
     * part that hurts — he can even be pogoed at the perch.
     *
     * Aim is captured at the END of the hang, not at the start of the leap,
     * so moving during the rise does not shake him; moving during the DIVE
     * does. That is the read the attack is teaching.
     */
    gapRange: 260,
    gapDwell: 0.8,
    leapRise: 0.4,
    leapHang: 0.2,
    leapRecovery: 0.9,
    /** How far in front of her he aims to land the perch, and how high it is. */
    perchOffset: 210,
    perchHeight: 200,
    diveSpeed: 900,
    /** The furthest the perch may be from where he started. */
    leapMaxDx: 460,
    /** The dive's hitbox: a box led slightly ahead of him along the aim. */
    diveWidth: 60,
    diveHeight: 70,
    diveLead: 20,
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
    /**
     * The skyward column: his answer to a hit into the raised shield
     * (playtest 3, note 4 — an overhead hit used to draw the same forward
     * riposte, which she was never in front of, so hitting his shield from
     * above cost her nothing).
     *
     * Its bottom sits at his HEAD, not at his feet, which is the whole
     * design: a Knight standing in front of him on the ground is never
     * inside it, even while it is live. That is what makes the loop work —
     * hit the shield from above, get out sideways, drop back in, and take
     * the front while he is still recovering.
     */
    skywardTell: 0.5,
    skywardActive: 0.3,
    skywardRecovery: 1.0,
    skywardTop: 250,
    skywardWidth: 170,
    /** The column sits this far BEHIND his facing — she blocked from up there. */
    skywardBack: 45,
  },
  /**
   * Bill the man. Every number here is DERIVED from the shipped physics, not
   * guessed — see the working in docs/plans/2026-08-24-playtest-3-build.md
   * § T11. The two that matter:
   *
   * - `lanceHeight` 130 is the reason the answer is 'be airborne'. A full
   *   jump reaches 233 px and spends 0.667 s of its 1.033 s above the band,
   *   so clearing the lance is generous — but no patch of FLOOR is safe,
   *   corners included, which is the lesson.
   * - `swatAfterBounce` 0.5 makes the FIRST head bounce free by
   *   construction: the clock only starts AT a bounce, and she is back above
   *   his head for 0.600 s after one, so the 0.41 s nail cadence lands the
   *   second bounce at ~0.55 s — inside the swat. One hit, then get out.
   *
   * Tune `lanceSpeed` and `lanceHeight` if the fight is wrong. Never PHYSICS:
   * gravity is the one estimated value in it and it prices the course too.
   */
  bill: {
    /** He walks at her the whole time; there is nowhere to wait him out. */
    marchSpeed: 90,
    /** He closes no nearer than this while winding up. */
    standOff: 90,
    lanceEvery: 2.6,
    lanceEveryHot: 1.7,
    lanceSpeed: 760,
    lanceSpeedHot: 950,
    /** Seconds stuck against the far wall after the pass — her only rest. */
    lanceStuck: 1.0,
    /** The foam finger's reach in front of him, and how high the pass sweeps. */
    lanceReach: 90,
    lanceHeight: 130,
    /** Seconds above his head before he swats. The first bounce is free. */
    swatAfterBounce: 0.5,
    swatTelegraph: 0.4,
    swatActive: 0.3,
    swatRecovery: 0.8,
    /** The swat is a column on his shoulders: 440 - 150 puts its top at y 290. */
    swatWidth: 140,
    swatHeight: 150,
    /** She counts as above him inside this horizontal half-width. */
    overheadHalfWidth: 90,
    cooldown: 0.8,
    cooldownHot: 0.5,
  },
  /**
   * Bill the dog. Both attacks are deliberately vocabulary she already owns:
   * the bones are the spitter's fan (same `fanShots`, so poking one out of
   * the air works identically), and the rolling ball is the red orb from
   * course level 2 — pogo-safe on top, lethal on the sides.
   *
   * No RNG anywhere: two independent timers, so the fight is reproducible and
   * every test and demo can depend on it.
   */
  dog: {
    huntSpeed: 110,
    bonesEvery: 3.0,
    bonesEveryHot: 2.0,
    shots: 3,
    spreadDeg: 35,
    projSpeed: 300,
    rollEvery: 6.5,
    rollEveryHot: 4.5,
    rollTelegraph: 0.45,
    /** Seconds the ball bounces before it uncurls. */
    rollTime: 5.0,
    rollSpeedX: 260,
    rollSpeedXHot: 325,
    /**
     * Re-launch speed at every floor bounce, and the ball's own gravity —
     * 620 and 1500 give a 128 px apex, 0.83 s and 215 px per arc, so about
     * six readable arcs across the 5 s roll.
     */
    rollLaunch: 620,
    rollGravity: 1500,
    /** The pogo-safe cap on top of the ball. Drawn, so the rule is visible. */
    rollSafeCap: 26,
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
  /** Duelist leap: which beat of rise → hang → dive the jump is on. */
  leapStage: 'rise' | 'hang' | 'dive' | null;
  /** Duelist leap: where the jump started, and the perch it is arcing to. */
  leapFrom: Vec2;
  leapTo: Vec2;
  /** Duelist leap: the direction committed to at the end of the hang. */
  leapAim: Vec2;
  /** Duelist leap: the floor height to land back on. */
  leapGroundY: number;
  /** Duelist: seconds the Knight has spent moving away, and standing still. */
  retreatTimer: number;
  awayTimer: number;
  /** Duelist: last frame's target x, so footwork reads HER movement, not his. */
  lastTargetX: number;
  /** Boss: past 1:00 the pair speeds up and leaves less gap. */
  hot: boolean;
  /** Bill: seconds since the Knight last bounced off his head (shake-off clock). */
  sinceBounce: number;
  /** Dog: true while it is balled up and rolling. */
  roll: boolean;
  /** Bill: lance passes still owed after the current one (1 while hot). */
  lancePasses: number;
}

/** Visual/collision sizes per enemy (width × height, feet-anchored). */
export const ENEMY_SIZES: Record<EnemyId, { width: number; height: number }> = {
  walker: { width: 44, height: 26 },
  flier: { width: 32, height: 30 },
  spitter: { width: 38, height: 34 },
  duelist: { width: 34, height: 52 },
  warden: { width: 40, height: 56 },
  /** Bill stands 160 px tall — head and shoulders over everything else here. */
  bill: { width: 68, height: 160 },
  /** The dog is a little larger than the Knight (48 px sprite, 18x47 hurtbox). */
  dog: { width: 64, height: 58 },
};

/**
 * Seconds before an enemy's first attack can fire, so nothing opens with a
 * live hitbox. The three that would: the spitter's volley, and both Bills,
 * whose first move should be a walk she gets to read.
 */
const OPENING_BEAT: Partial<Record<EnemyId, number>> = { spitter: 1.0, bill: 1.2, dog: 1.0 };

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
    cooldownTimer: OPENING_BEAT[id] ?? 0,
    lockedDir: -1,
    shieldDir: 'front',
    shieldReaimTimer: 0,
    lingerTimer: 0,
    leapStage: null,
    leapFrom: { x, y },
    leapTo: { x, y },
    leapAim: { x: 0, y: 0 },
    leapGroundY: y,
    retreatTimer: 0,
    awayTimer: 0,
    lastTargetX: x,
    hot: false,
    sinceBounce: 0,
    roll: false,
    lancePasses: 0,
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

/**
 * A fan of `count` projectiles from `mouth`, centred on the line to `aimAt`
 * and spread `spreadDeg` degrees wide. With count = 1 the single shot flies
 * straight at the aim point (the `count - 1` divisor would be a division by
 * zero, so it is special-cased).
 *
 * Shared by the spitter's volley and the dog's bones, so anything the lesson
 * teaches about poking one out of the air holds for both.
 */
export function fanShots(
  mouth: Vec2,
  aimAt: Vec2,
  count: number,
  spreadDeg: number,
  speed: number,
  radius = 7,
): Projectile[] {
  const aim = Math.atan2(aimAt.y - mouth.y, aimAt.x - mouth.x);
  const spread = (spreadDeg * Math.PI) / 180;
  const shots: Projectile[] = [];
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? aim : aim + spread * (i / (count - 1) - 0.5);
    shots.push({
      position: { ...mouth },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      radius,
      dead: false,
    });
  }
  return shots;
}

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
  const order =
    want <= lo ? [lo, hi] : want >= hi ? [hi, lo] : here - lo < hi - here ? [lo, hi] : [hi, lo];
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
/**
 * Walk an enemy sideways, refusing any step that would put its body inside
 * geometry.
 *
 * The look-ahead point is the cheap early-out. The body test after it is the
 * one that actually holds: a probe point 21 px ahead can still be clear on
 * the step that carries a 34 px-wide body five pixels into a wall, which is
 * how a lunging duelist used to end up standing in the arena's left wall.
 */
function drift(e: Enemy, world: World, dir: 1 | -1, speed: number, dt: number): void {
  const size = ENEMY_SIZES[e.id];
  const aheadX = e.position.x + dir * (size.width / 2 + 4);
  if (solidAt(world, aheadX, e.position.y - size.height / 2)) return;
  const nextX = e.position.x + dir * speed * dt;
  if (insideSolid(world, bodyAt(e.id, nextX, e.position.y))) return;
  e.position.x = nextX;
}

/**
 * Commit to a leap: pick a perch in front of her, clamped so it is reachable
 * and never inside geometry.
 *
 * The clamp is not optional. The rise and the dive set position directly and
 * bypass drift()'s wall probe, so an unclamped perch would let him arrive
 * inside a wall — which the hunting property test (stuckSteps === 0) catches,
 * and which would look like a bug in play.
 */
function startLeap(e: Enemy, world: World, t: Target, dx: number): void {
  const A = ATTACKS.duelist;
  const dir = dx >= 0 ? 1 : -1;
  e.attackKind = 'leap';
  e.lockedDir = dir;
  e.facing = dir;
  e.leapStage = null;
  e.leapGroundY = e.position.y;
  e.leapFrom = { ...e.position };
  e.awayTimer = 0;

  // Aim to land short of her, and never further than leapMaxDx from here.
  const wanted = t.position.x - dir * A.perchOffset;
  const capped =
    Math.abs(wanted - e.position.x) > A.leapMaxDx ? e.position.x + dir * A.leapMaxDx : wanted;
  const perchY = e.position.y - A.perchHeight;

  // Walk the perch back toward his start until the body is clear of geometry.
  let x = capped;
  for (let i = 0; i < 12 && insideSolid(world, bodyAt('duelist', x, perchY)); i++) {
    x += (e.position.x - x) * 0.25;
  }
  e.leapTo = { x, y: perchY };
}

/**
 * The leap's three beats, run inside the active phase: rise to the perch,
 * hang there, then dive along the line committed to at the end of the hang.
 */
function stepLeap(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  const A = ATTACKS.duelist;
  if (e.leapStage === 'rise') {
    // Interpolate toward the perch over leapRise; phaseTimer counts it down.
    const left = Math.max(0, e.phaseTimer);
    const k = 1 - left / A.leapRise;
    e.position.x = e.leapFrom.x + (e.leapTo.x - e.leapFrom.x) * k;
    e.position.y = e.leapFrom.y + (e.leapTo.y - e.leapFrom.y) * k;
    if (e.phaseTimer <= 0) {
      e.position = { ...e.leapTo };
      e.leapStage = 'hang';
      e.phaseTimer = A.leapHang;
    }
    return;
  }
  if (e.leapStage === 'hang') {
    if (e.phaseTimer <= 0) {
      // Aim is captured HERE, at the end of the hang — moving during the rise
      // does not shake him, moving during the dive does.
      const tx = t ? t.position.x : e.position.x + e.lockedDir * A.perchOffset;
      const ty = t ? t.position.y : e.leapGroundY;
      const vx = tx - e.position.x;
      const vy = Math.max(ty - e.position.y, 0.15); // never dive upward
      const len = Math.hypot(vx, vy) || 1;
      e.leapAim = { x: vx / len, y: vy / len };
      e.facing = e.leapAim.x >= 0 ? 1 : -1;
      e.leapStage = 'dive';
    }
    return;
  }
  // Diving.
  const nextX = e.position.x + e.leapAim.x * A.diveSpeed * dt;
  const nextY = e.position.y + e.leapAim.y * A.diveSpeed * dt;
  const landed = nextY >= e.leapGroundY;
  const blocked = insideSolid(world, bodyAt('duelist', nextX, Math.min(nextY, e.leapGroundY)));
  if (landed || blocked) {
    // End into recovery on the floor he left, never inside geometry.
    e.position.y = e.leapGroundY;
    if (!blocked) e.position.x = nextX;
    e.leapStage = null;
    setPhase(e, 'recovery', A.leapRecovery);
    return;
  }
  e.position.x = nextX;
  e.position.y = nextY;
}

/**
 * Reactive melee duelist: your approach picks its answer. Ground approach →
 * lunge; jumping in → rising swipe; keeping your distance → the leap.
 * Recovery is the punish window.
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

      // Standing off is its own answer. Tracked on a dwell clock so a Knight
      // merely passing through the far half is not enough — she has to
      // actually keep her distance.
      if (adx > A.gapRange) e.awayTimer += dt;
      else e.awayTimer = 0;

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
      } else if (e.cooldownTimer <= 0 && e.awayTimer >= A.gapDwell - 1e-9) {
        startLeap(e, world, t, dx);
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
        if (e.attackKind === 'leap') {
          e.leapStage = 'rise';
          // The active phase runs until the dive lands, so its timer is only
          // there to drive the rise; stepLeap owns the transitions.
          setPhase(e, 'active', A.leapRise);
        } else {
          setPhase(e, 'active', e.attackKind === 'lunge' ? A.lungeTime : A.antiAirActive);
        }
      }
      break;
    case 'active':
      if (e.attackKind === 'lunge') {
        drift(e, world, e.lockedDir, A.lungeSpeed, dt);
        if (e.phaseTimer <= 0) setPhase(e, 'recovery', A.lungeRecovery);
      } else if (e.attackKind === 'antiair') {
        // The column travels with him. Slow enough that running out of it
        // still works, fast enough that standing under it does not.
        drift(e, world, e.lockedDir, A.antiAirDashSpeed, dt);
        if (e.phaseTimer <= 0) setPhase(e, 'recovery', A.antiAirRecovery);
      } else if (e.attackKind === 'leap') {
        stepLeap(e, world, dt, t);
      }
      break;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        e.leapStage = null;
        e.awayTimer = 0;
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
          return fanShots(
            mouth,
            { x: t.position.x, y: t.position.y - CHEST },
            A.shots,
            A.spreadDeg,
            A.projSpeed,
          );
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
 * Is the target overhead — feet above this enemy's shoulders and roughly
 * centred on it? `halfWidth` is how far to either side still counts.
 *
 * The 0.8x height (rather than the full height) is what makes "above" mean
 * "above the shoulders": at the warden's 56 px that is 44.8 px, so a Knight
 * hanging just over his head reads as overhead before she is clear of him.
 */
export function overheadOf(e: Enemy, t: Target, halfWidth: number): boolean {
  const size = ENEMY_SIZES[e.id];
  return (
    t.position.y < e.position.y - size.height * 0.8 &&
    Math.abs(t.position.x - e.position.x) < halfWidth
  );
}

/** The warden's overhead test, at its own reach. */
function overhead(e: Enemy, t: Target): boolean {
  return overheadOf(e, t, ATTACKS.warden.overheadHalfWidth);
}

/** How long the warden's active phase lasts, per attack. */
function activeTime(kind: AttackKind | null): number {
  const A = ATTACKS.warden;
  if (kind === 'bash') return A.bashActive;
  if (kind === 'skyward') return A.skywardActive;
  return A.riposteActive;
}

/**
 * How long the warden's recovery lasts, per attack — the punish window.
 * Exported because render.ts measures the recovery sag against it, and a
 * skyward measured against the riposte's total would sag at the wrong rate.
 */
export function wardenRecoveryTime(kind: AttackKind | null): number {
  const A = ATTACKS.warden;
  if (kind === 'bash') return A.bashRecovery;
  if (kind === 'skyward') return A.skywardRecovery;
  return A.riposteRecovery;
}

const recoveryTime = wardenRecoveryTime;

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
  const skyward = e.attackKind === 'skyward';
  if (t && (e.phase === 'idle' || (e.phase === 'recovery' && !skyward))) {
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
      if (e.phaseTimer <= 0) setPhase(e, 'active', activeTime(e.attackKind));
      break;
    case 'active':
      // No drift on the skyward: a bash-style lunge would carry him onto the
      // ground she is about to land on, and "the front is open" is the whole
      // promise of the attack.
      if (!skyward) {
        drift(e, world, e.lockedDir, e.attackKind === 'bash' ? A.bashSpeed : A.riposteSpeed, dt);
      }
      if (e.phaseTimer <= 0) setPhase(e, 'recovery', recoveryTime(e.attackKind));
      break;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        e.shieldDir = 'front'; // the arm comes down when he is idle again
        e.shieldReaimTimer = 0;
        e.cooldownTimer = A.bashCooldown;
        e.lingerTimer = 0;
        setPhase(e, 'idle', 0);
      }
      break;
  }
}

/**
 * A safety cap on the lance's active phase.
 *
 * The pass is meant to end by ARRIVING at a wall, not by a clock — that is
 * what makes "he crosses the whole arena" true of whatever arena he is in.
 * The Colosseum is 1168 px wide and the hot charge covers it in 1.23 s, so
 * this only ever fires in a test world that has no walls at all.
 */
const LANCE_MAX_SECONDS = 3;

/**
 * Carry Bill one step along the direction his lance committed to.
 *
 * Returns true when a wall stops him, having placed him flush against its
 * surface rather than short of it — the picture and the stop have to agree,
 * and the stuck second afterwards is her only rest in the whole fight.
 */
function chargeIntoWall(e: Enemy, world: World, dt: number): boolean {
  const speed = e.hot ? ATTACKS.bill.lanceSpeedHot : ATTACKS.bill.lanceSpeed;
  const nextX = e.position.x + e.lockedDir * speed * dt;
  const wall = blockerOf(world, bodyAt(e.id, nextX, e.position.y));
  if (!wall) {
    e.position.x = nextX;
    return false;
  }
  const half = ENEMY_SIZES[e.id].width / 2;
  e.position.x = e.lockedDir === 1 ? wall.x - half : wall.x + wall.width + half;
  return true;
}

/**
 * Bill the man — Kayla's uncle, 160 px of him, and he cannot be hurt.
 *
 * Two attacks, and the answer to each is something she already owns.
 *
 * The LANCE is why there is no safe ground. He locks a direction, winds up
 * for 0.6 s, then crosses the ENTIRE arena and stops dead against the far
 * wall for a second. No corner is out of the pass, so standing still loses;
 * his head sits 43 px inside a full jump, so pogoing him as he goes under is
 * the answer, and the stuck second is when she gets to breathe.
 *
 * The SWAT is the shake-off, and it is why the first bounce is always free:
 * `sinceBounce` is zeroed by every downslash that lands on him
 * (resolveNailHit), so the clock cannot reach 0.5 s until she has already had
 * one. Still over his head after that and the column goes up. One hit, then
 * get out — the same rule the warden taught with his shield.
 */
function stepBill(e: Enemy, world: World, dt: number, t: Target | undefined): void {
  const A = ATTACKS.bill;
  const telegraph = ENEMIES.bill.telegraph ?? 0.6;
  e.phaseTimer -= dt;
  e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);
  e.sinceBounce += dt;

  switch (e.phase) {
    case 'idle': {
      if (!t) return;
      faceTarget(e, t);
      const dx = t.position.x - e.position.x;
      if (Math.abs(dx) > A.standOff) drift(e, world, dx >= 0 ? 1 : -1, A.marchSpeed, dt);
      if (e.cooldownTimer > 0) return;

      // While she is over his head he never lances. The lance answers a
      // GROUND approach — starting one here would carry him out from under
      // her and make the shake-off unreachable, which is the whole reason
      // the first bounce is free. So he waits out her half second instead.
      if (overheadOf(e, t, A.overheadHalfWidth)) {
        if (e.sinceBounce >= A.swatAfterBounce) {
          e.attackKind = 'swat';
          e.lockedDir = e.facing;
          setPhase(e, 'telegraph', A.swatTelegraph);
        }
        return;
      }

      e.attackKind = 'lance';
      e.lockedDir = dx >= 0 ? 1 : -1;
      e.facing = e.lockedDir;
      e.lancePasses = e.hot ? 1 : 0;
      setPhase(e, 'telegraph', telegraph);
      break;
    }
    case 'telegraph':
      if (e.phaseTimer <= 0) {
        setPhase(e, 'active', e.attackKind === 'lance' ? LANCE_MAX_SECONDS : A.swatActive);
      }
      break;
    case 'active':
      if (e.attackKind === 'lance') {
        if (chargeIntoWall(e, world, dt) || e.phaseTimer <= 0) {
          setPhase(e, 'recovery', A.lanceStuck);
        }
      } else if (e.phaseTimer <= 0) {
        setPhase(e, 'recovery', A.swatRecovery);
      }
      break;
    case 'recovery': {
      if (e.phaseTimer > 0) break;
      if (e.attackKind === 'lance' && e.lancePasses > 0) {
        // Hot: straight back the other way. He still winds up first — heat is
        // speed and gaps, never a shorter tell (ratified).
        e.lancePasses -= 1;
        e.lockedDir = e.lockedDir === 1 ? -1 : 1;
        e.facing = e.lockedDir;
        setPhase(e, 'telegraph', telegraph);
        break;
      }
      const lance = e.attackKind === 'lance';
      e.cooldownTimer = lance
        ? e.hot
          ? A.lanceEveryHot
          : A.lanceEvery
        : e.hot
          ? A.cooldownHot
          : A.cooldown;
      e.attackKind = null;
      e.lancePasses = 0;
      setPhase(e, 'idle', 0);
      break;
    }
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
    case 'bill':
      stepBill(e, world, dt, target);
      return null;
    case 'dog':
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
    case 'antiair': {
      // A column standing on his shoulders, leaning the way he committed.
      // Drawn from the same constants in render.ts, so the picture and the
      // box can never disagree.
      const A = ATTACKS.duelist;
      const cx = e.position.x + e.lockedDir * A.antiAirForward;
      return {
        x: cx - A.antiAirWidth / 2,
        y: e.position.y - A.antiAirTop,
        width: A.antiAirWidth,
        height: A.antiAirTop - size.height,
      };
    }
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
    case 'skyward': {
      const A = ATTACKS.warden;
      const cx = e.position.x - e.lockedDir * A.skywardBack;
      return {
        x: cx - A.skywardWidth / 2,
        y: e.position.y - A.skywardTop,
        // Bottom at his head: the ground in front of him stays safe.
        height: A.skywardTop - size.height,
        width: A.skywardWidth,
      };
    }
    case 'volley':
      return null; // the projectiles carry the threat
    case 'leap': {
      // Only the dive hurts. Rising and hanging are free — she can even pogo
      // him at the perch, which is the reward for reading it.
      if (e.leapStage !== 'dive') return null;
      const A = ATTACKS.duelist;
      const cx = e.position.x + e.leapAim.x * A.diveLead;
      const cy = e.position.y - size.height / 2 + e.leapAim.y * A.diveLead;
      return {
        x: cx - A.diveWidth / 2,
        y: cy - A.diveHeight / 2,
        width: A.diveWidth,
        height: A.diveHeight,
      };
    }
    case 'lance': {
      // The foam finger, held out level. It only reaches lanceHeight up, so
      // the pass sweeps the FLOOR — his 160 px body is what threatens the
      // air, and clearing that is the whole read.
      const A = ATTACKS.bill;
      return {
        x: e.lockedDir === 1 ? front : front - A.lanceReach,
        y: e.position.y - A.lanceHeight,
        width: A.lanceReach,
        height: A.lanceHeight,
      };
    }
    case 'swat': {
      // A column standing on his shoulders — bottom at his head, top at
      // y 290 on the Colosseum floor. Nothing at ground level is in it.
      const A = ATTACKS.bill;
      return {
        x: e.position.x - A.swatWidth / 2,
        y: e.position.y - size.height - A.swatHeight,
        width: A.swatWidth,
        height: A.swatHeight,
      };
    }
    // Stubs. The dog's attacks exist in the union so the switch stays
    // exhaustive; their boxes arrive with his state machine.
    case 'bones':
    case 'roll':
      return null;
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

  // The boss pair is furniture: the nail rings off them and nothing else
  // happens — no damage, no counter, no death. 'blocked' already means
  // exactly that, so NailHitResult gains no member and no exhaustive switch
  // breaks; stepArena only scores 'hit', and bounces her either way.
  if (ENEMIES[e.id].invulnerable) {
    e.blockFlashTimer = 0.18;
    // Landing on his head is what arms the shake-off clock.
    if (player.nailDir === 'down') e.sinceBounce = 0;
    return 'blocked';
  }

  if (e.id === 'warden' && e.phase !== 'recovery') {
    const hitFrom = swingSide(player);
    if (shieldCovers(player, e, hitFrom)) {
      e.blockFlashTimer = 0.18;
      if (e.phase === 'idle') {
        e.lockedDir = player.position.x >= e.position.x ? 1 : -1;
        e.facing = e.lockedDir;
        e.shieldReaimTimer = 0;
        e.lingerTimer = 0;
        if (hitFrom === 'up') {
          // She rang his raised shield from above, so he answers upward: the
          // shield stays committed UP and the column goes where she is. His
          // front is bare from the telegraph on, which is the opening the
          // loop is built around (playtest 3, note 4).
          e.attackKind = 'skyward';
          setPhase(e, 'telegraph', ATTACKS.warden.skywardTell);
        } else {
          e.attackKind = 'riposte';
          // A swung shield can't also cover the head (same as the bash).
          e.shieldDir = 'front';
          setPhase(e, 'telegraph', ENEMIES.warden.telegraph ?? 0.4);
        }
      }
      return 'blocked';
    }
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

/** Which side of the warden a swing arrives on: overhead, or across its front. */
function swingSide(player: Player): ShieldDir {
  return player.nailDir === 'down' ? 'up' : 'front';
}

/** Does the warden's shield stand between this swing and its body? */
function shieldCovers(player: Player, e: Enemy, hitFrom: ShieldDir): boolean {
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
