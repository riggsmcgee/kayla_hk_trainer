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

/** One spitter shot or thrown bone. Nail contact destroys it; body contact is a hit. */
export interface Projectile {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  dead: boolean;
  /**
   * Rebounds left before a surface kills it instead of turning it. Absent or
   * zero is the spitter's shot: it dies on the first thing it touches.
   *
   * The budget is spent by ANY surface — floor, wall or ceiling — so a bone
   * that goes wall, ceiling, floor is finished. That was ratified over a
   * floor-only rule on purpose: the budget is the readable limit, and it is
   * meant to be short.
   */
  bounces?: number;
  /** Radians per second the drawing spins. Simulation-irrelevant; the box is round. */
  spin?: number;
  /** Current rotation in radians, advanced by `spin`. */
  angle?: number;
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
  | 'roll'
  | 'uncurl';

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
    /**
     * How much of the lance telegraph he can still abort into a swat, as a
     * share of it (playtest 5, note 6).
     *
     * > "She obviously is meant to jump over the dash attack, but if he's in
     * > the wind-up for it and she's already trying to jump over him, he
     * > should react to that and do a proper anti-air."
     *
     * EARLY, and it re-tells. Half means he reads a jump she has already
     * committed to at the start of his wind-up, and she then gets the whole
     * swatTelegraph before the swat lands — so the tell she is acting on is
     * never a lie. A conversion later than this was considered and rejected
     * for exactly that reason: it would have been a shorter tell in disguise,
     * and heat is speed and gaps, never a shorter tell.
     */
    antiAirConvertShare: 0.5,
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
    bonesActive: 0.12,
    bonesRecovery: 0.6,
    /**
     * A thrown bone rebounds this many times before a surface stops it
     * (playtest 4, note 1). Spent by ANY surface — floor, wall or ceiling —
     * so a bone that goes wall → ceiling → floor is done.
     *
     * Three is a knob. It is meant to be SHORT: the budget is the readable
     * limit on how long the arena stays full of them, and the whole point of
     * a rebound she can watch is that she can also wait it out.
     */
    boneBounces: 3,
    /** Radians per second the bone tumbles. Drawing only — its hitbox is round. */
    boneSpin: 11,
    rollEvery: 5.0,
    rollEveryHot: 4.5,
    rollTelegraph: 0.45,
    /**
     * How long the ball bounces before he WANTS to land — a soft threshold,
     * not a stop (playtest 5, note 2). When it elapses mid-arc he keeps
     * bouncing; the roll ends on the next floor contact, so he never
     * uncurls in mid-air and the floor never moves up to meet him.
     *
     * Raised 5.0 -> 7.0 with `rollEvery` cut 6.5 -> 5.0, because the ratified
     * pressure knob is the GAP between rolls: lengthening the roll on its own
     * would have stretched the cycle to 14 s and loosened it.
     */
    rollTime: 7.0,
    /**
     * The landing animation, from ball to four feet. He is LETHAL for every
     * frame of it — playtest 5 rejected a harmless punish window outright:
     * "make his hitbox active so that she can't just walk into the dog."
     */
    uncurlTime: 0.5,
    /**
     * The Metronome variant’s numbers, kept as the family’s baseline: the
     * rally escalation is measured against rollLaunch/rollGravity, and every
     * variant’s arcs are checked against rollApexMax derived from the same
     * gravity. ROLL_VARIANTS is what a fight actually rolls with.
     */
    rollSpeedX: 260,
    rollSpeedXHot: 325,
    /**
     * Re-launch speed at every floor bounce, and the ball's own gravity —
     * 620 and 1500 give a 128 px apex, 0.83 s and 215 px per arc, so about
     * six readable arcs across the 5 s roll.
     */
    rollLaunch: 620,
    rollGravity: 1500,
    /**
     * THE VOLLEY (playtest 4, note 2, round 2). Up-slash the ball from below
     * and it goes back up instead of reaching you — a rally that keeps the
     * dog airborne.
     *
     * These three numbers are load-bearing, and the constraint runs the
     * opposite way to intuition: the HIGHER the ball goes, the FASTER it is
     * moving when it falls back through her nail band, and the shorter the
     * window to hit it again. Measured against a nail that is live for 0.15 s:
     *
     *   apex above the strike   speed entering the band   time to cross it
     *   90 px  (rally 1)        367 px/s                  0.22 s
     *   128 px (rally 5+)       499 px/s                  0.15 s  ← the floor
     *   295 px                  708 px/s                  0.11 s  ← deletes it
     *
     * So the first return is generous and each one after it comes back a
     * little faster, until it settles at exactly one nail window and stops
     * escalating. A rally that keeps getting away from her is the point; a
     * rally that becomes impossible is a broken mechanic.
     */
    rallyLaunch: 520,
    rallyEscalation: 26,
    rallyLaunchMax: 620,
    /**
     * The apex above which the FLOOR-STANDING volley stops being possible, in
     * px above the floor. Derived, and it replaces playtest 4's `rollApexMax`
     * of 150 — which playtest 5 strikes outright.
     *
     * Above this the ball crosses the 81 px strip her up-nail can reach
     * ([47, 128] above the floor: her hurtbox top up to the top of the nail
     * box) in less than `nailActiveTime`, so there is no longer a whole nail
     * window to catch it in. Solve 2·(v(47) − v(128))/g = 0.15 for the apex
     * and it comes out at 188.9 px.
     *
     * This is a CEILING on the family, not a target. The ratified roll sits
     * at 180 px, 8.9 px under it, and that gap is the whole margin the volley
     * has left — see ROLL_VARIANTS.
     */
    rollVolleyApexMax: 188.9,
  },
} as const;

/**
 * THE ROLL BEHAVIOURS. Five from playtest 4's portfolio, plus the one
 * playtest 5 ratified out of them — `ROLL_VARIANTS[LOPES]` is what the fight
 * plays now, and the other five stay one more round so the new shape can be
 * compared against Loper-as-it-was before anything is baked in.
 *
 * PLAYTEST 5 STRIKES THE ALTERNATION RULE. Playtest 4 required every variant
 * to alternate — _"so each one keeps a low phase the volley can live on"_ —
 * and note 1 overrides it: "I just don't like the double bounce, the small
 * one. I think all the bounces can just be the same height, and I want that
 * height to be higher, about the max jump height of the character."
 *
 * The arithmetic that follows from that note, because the two goals in it
 * cannot both be comfortable:
 *
 *   her max jump, fully held                 233.3 px
 *   JUMPING OVER THE BALL dies at apex       175.3 px  (the ball is 58 tall)
 *   THE FLOOR-STANDING VOLLEY dies at apex   188.9 px  (rollVolleyApexMax)
 *
 * The two thresholds are 13.6 px apart, so no height serves both — 180 px is
 * inside that band, and the price is that the volley becomes near
 * frame-perfect rather than comfortable. That was chosen knowingly.
 *
 * SO IS THE ROLL BEING LESS DANGEROUS. The 30 px skitter was the only part of
 * the cycle a Knight standing still was not safe under, and deleting it takes
 * most of the roll's standing threat with it. Ratified on the grounds that
 * BILL THE MAN is the pressure and the roll is a positioning-and-rhythm beat
 * — with `speedX` raised to 300, because at 205 her 332 px/s run simply
 * outruns it, and outrunning it was the whole counter once the low bounce
 * went.
 *
 * The five older ones still alternate, and that shape is described here
 * because it is what they are:
 *
 * - A HIGH phase lifts the ball's underside clear of her 47 px head, so she
 *   can run under it. It is also slow near its apex, so it is the phase the
 *   volley is easiest on.
 * - A LOW phase skitters along the floor. There is no running under that
 *   one: she jumps it, or she volleys it, or she is somewhere else.
 *
 * `launches` is cycled per floor bounce, so a one-entry pattern is uniform,
 * a two-entry one alternates, and a three-entry one gives low, low, high.
 */
export interface RollVariant {
  name: string;
  /** One line the picker shows — what this one feels like to fight. */
  feel: string;
  /** Re-launch speed per floor bounce, cycled. */
  launches: readonly number[];
  speedX: number;
  speedXHot: number;
}

export const ROLL_VARIANTS: readonly RollVariant[] = [
  {
    name: 'Metronome',
    feel: 'One big hop, one low skitter, forever. The most readable of the five.',
    launches: [620, 350],
    speedX: 260,
    speedXHot: 325,
  },
  {
    name: 'Hunter',
    feel: 'The same rhythm, crossing the arena half again as fast. Less time to choose.',
    launches: [600, 340],
    speedX: 340,
    speedXHot: 410,
  },
  {
    name: 'Stutter',
    feel: 'Two low skitters, then a hop. The gap you want comes every third beat.',
    launches: [640, 330, 330],
    speedX: 290,
    speedXHot: 350,
  },
  {
    name: 'Loper',
    feel: 'Slow, tall, lazy arcs over long low glides. The most room, and the most waiting.',
    launches: [665, 300],
    speedX: 205,
    speedXHot: 260,
  },
  {
    name: 'Terrier',
    feel: 'Quick and shallow, tearing across the floor. Barely enough gap to duck through.',
    launches: [580, 300],
    speedX: 400,
    speedXHot: 470,
  },
  {
    name: 'Lopes',
    feel: 'Loper’s lazy rhythm with every bounce as tall as her jump. No skitter, and no jumping over it.',
    // One entry, so every bounce is the same. 735 px/s against rollGravity
    // 1500 is a 180.07 px apex: above the 175.3 px that kills the jump-over,
    // below the 188.9 px that kills the volley.
    launches: [735],
    speedX: 300,
    speedXHot: 380,
  },
];

/**
 * The roll the fight plays, and what an unset or out-of-range setting means.
 *
 * Playtest 5 picked Loper's movement and then changed its shape; `Lopes` is
 * that change. It is LAST rather than first on purpose — inserting it at the
 * front would have silently re-pointed every stored `rollVariant` index at a
 * different behaviour, which on a picker whose whole job is comparison is the
 * one thing it must not do.
 */
export const DEFAULT_ROLL_VARIANT = ROLL_VARIANTS.length - 1;

export function rollVariant(index: number): RollVariant {
  return ROLL_VARIANTS[index] ?? ROLL_VARIANTS[DEFAULT_ROLL_VARIANT]!;
}

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
  /** Duelist leap and dog roll: the floor height to land back on. */
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
  /**
   * Dog: true while he is trotting in on his card at 0:30, before the fight
   * has him. He has no attack and no phase yet, so without this flag the
   * only pose left for him is `idle` — a standing dog sliding 280 px.
   */
  walkingIn: boolean;
  /** Dog: which of ROLL_VARIANTS this dog rolls with. The user picks it. */
  rollVariantIndex: number;
  /** Dog: floor bounces so far this roll — the cursor into the variant’s pattern. */
  rollBounces: number;
  /** Dog: how many times the ball has been volleyed back up during this roll. */
  rallies: number;
  /** Dog: the swing that last volleyed the ball, so one up-slash rallies once. */
  lastRallySwingId: number;
  /** Bill: lance passes still owed after the current one (1 while hot). */
  lancePasses: number;
  /**
   * Dog: seconds until the next roll. The bones ride `cooldownTimer`, so the
   * two attacks run off independent clocks and neither can starve the other.
   */
  rollTimer: number;
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
    walkingIn: false,
    rollVariantIndex: 0,
    rollBounces: 0,
    rallies: 0,
    lastRallySwingId: 0,
    lancePasses: 0,
    rollTimer: ATTACKS.dog.rollEvery,
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

/**
 * Is she in the air somewhere this lance would pass underneath?
 *
 * Ahead of the direction he committed to, or straight over his head — but
 * never behind him, where a jump is a retreat rather than a vault and swatting
 * at it would be swatting at nothing.
 */
function vaultingTheLance(e: Enemy, t: Target): boolean {
  if (t.grounded) return false;
  const dx = t.position.x - e.position.x;
  // Close enough that the jump is a VAULT OVER HIM and not a hop somewhere
  // else in the arena. Reading it wider than this is worse than not having it:
  // a far-away hop would cancel the pass, and cancelling the pass is exactly
  // the thing jumping was not supposed to buy for free.
  return (
    Math.abs(dx) < ATTACKS.bill.overheadHalfWidth && dx * e.lockedDir > -ENEMY_SIZES.bill.width
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
    case 'telegraph': {
      // ANTI-AIR. Jumping the lance is still the right answer; playtest 5
      // stops it being a free one. Catch her in the air early in the wind-up
      // and he abandons the lance and starts the swat's OWN telegraph from
      // the top, so she is answering a tell rather than a surprise.
      const early = e.phaseTimer > telegraph * (1 - A.antiAirConvertShare);
      if (e.attackKind === 'lance' && t && early && vaultingTheLance(e, t)) {
        e.attackKind = 'swat';
        e.lancePasses = 0;
        e.lockedDir = e.facing;
        setPhase(e, 'telegraph', A.swatTelegraph);
        break;
      }
      if (e.phaseTimer <= 0) {
        setPhase(e, 'active', e.attackKind === 'lance' ? LANCE_MAX_SECONDS : A.swatActive);
      }
      break;
    }
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
      // The second pass used to re-enter 'telegraph' straight from here,
      // never passing through 'idle' — so the "never lance while she is over
      // his head" gate below never ran on it, and he would lance out from
      // under a Knight standing on his head, which PLAN.md forbids. Falling
      // through to the end-of-attack path hands her back to that gate.
      const overheadNow = t !== undefined && overheadOf(e, t, A.overheadHalfWidth);
      if (e.attackKind === 'lance' && e.lancePasses > 0 && !overheadNow) {
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
 * The ball, mid-bounce.
 *
 * Its own gravity, not the world's: 620 up against 1500 down gives a 128 px
 * apex and a 0.83 s arc, which is slow enough to read and land on. Every
 * floor bounce re-launches to exactly the same speed, so the arcs never decay
 * into an unreadable skitter — six identical hops across the five seconds.
 */
/**
 * THE VOLLEY: send the rolling ball back up (playtest 4, note 2, round 2).
 *
 * > "If she hits it from below, she can bounce it back up. The ball won't
 * > actually hit her, so she can bounce the dog and keep him in the air.
 * > That would actually be really fun."
 *
 * Horizontal speed is deliberately PRESERVED, not zeroed: a ball that went
 * straight up would make the rally a stationary minigame, and the whole
 * pleasure of it is chasing the thing across the arena. Nothing else in the
 * dojo has ever rewarded the up-slash.
 *
 * She is never told this exists. It is not the answer to the roll — running
 * under the high phase is — so a Kayla who never finds it clears the fight
 * anyway, and a Kayla who does feel like she found a secret.
 *
 * Returns false when this swing has already rallied (one up-slash, one
 * return, however long the nail stays live) or the ball is not a ball.
 */
export function rallyBall(e: Enemy, swingId: number): boolean {
  if (!e.roll || e.lastRallySwingId === swingId) return false;
  const A = ATTACKS.dog;
  e.lastRallySwingId = swingId;
  e.velocity.y = -Math.min(A.rallyLaunch + e.rallies * A.rallyEscalation, A.rallyLaunchMax);
  e.rallies += 1;
  return true;
}

function stepRoll(e: Enemy, world: World, dt: number): void {
  const A = ATTACKS.dog;
  const half = ENEMY_SIZES[e.id].width / 2;

  e.velocity.y += A.rollGravity * dt;
  e.position.y += e.velocity.y * dt;

  // THE LID, and it bounces off it the way the bones already do.
  //
  // `stepRoll` had no ceiling test at all, which was safe only because
  // nothing could send the ball that high. Playtest 5 sanctioned the
  // indefinite juggle, so a hard enough rally now reaches bossWorld()'s lid —
  // and the horizontal probe below would have found that lid, read it as a
  // WALL, and snapped the ball to x = -232, outside the arena.
  if (e.velocity.y < 0) {
    const lid = blockerOf(world, bodyAt(e.id, e.position.x, e.position.y));
    if (lid) {
      e.position.y = lid.y + lid.height + ENEMY_SIZES[e.id].height;
      e.velocity.y = -e.velocity.y;
    }
  }

  if (e.position.y >= e.leapGroundY) {
    e.position.y = e.leapGroundY;
    // THE ONLY PLACE THE ROLL ENDS. Once `rollTime` has elapsed he is looking
    // to land, and this is the floor contact he lands on. Before playtest 5
    // the roll stopped wherever the clock ran out and snapped him down to the
    // floor from there — 12.5 px on Loper, and far worse on a taller arc.
    if (e.phaseTimer <= 0) {
      beginUncurl(e);
      return;
    }
    // Each floor bounce takes the next launch in the variant’s pattern, so a
    // two-entry pattern alternates high, low, high, low without a timer.
    const launches = rollVariant(e.rollVariantIndex).launches;
    e.rollBounces += 1;
    e.velocity.y = -launches[e.rollBounces % launches.length]!;
  }

  const nextX = e.position.x + e.velocity.x * dt;
  const wall = blockerOf(world, bodyAt(e.id, nextX, e.position.y));
  if (wall) {
    e.position.x = e.velocity.x > 0 ? wall.x - half : wall.x + wall.width + half;
    e.velocity.x = -e.velocity.x;
  } else {
    e.position.x = nextX;
  }
  e.facing = e.velocity.x >= 0 ? 1 : -1;
}

/**
 * Ball to dog, on the floor he actually touched. He keeps his hitbox and his
 * commitment for `uncurlTime` — this is an animation she has to respect, not
 * a gap she can walk into.
 */
function beginUncurl(e: Enemy): void {
  const A = ATTACKS.dog;
  e.roll = false;
  e.velocity.x = 0;
  e.velocity.y = 0;
  e.attackKind = 'uncurl';
  e.rollTimer = e.hot ? A.rollEveryHot : A.rollEvery;
  setPhase(e, 'active', A.uncurlTime);
}

/**
 * Bill the dog — the family's other Bill, in at 0:30 and just as unkillable.
 *
 * Both his attacks are deliberately vocabulary she already owns, because
 * nothing new is taught at the end of the road:
 *
 * - BONES are the spitter's fan, built by the same `fanShots`, so poking one
 *   out of the air works exactly the way chapter 3 taught it.
 * - The ROLL is the red orb from course level 2 — pogo-safe on top
 *   (`enemyHurtsBox`), lethal on the sides.
 *
 * Two independent deterministic timers and no RNG anywhere, so the fight is
 * reproducible and the demos and tests can depend on it.
 */
function stepDog(e: Enemy, world: World, dt: number, t: Target | undefined): Projectile[] | null {
  const A = ATTACKS.dog;
  const telegraph = ENEMIES.dog.telegraph ?? 0.45;
  e.phaseTimer -= dt;
  e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);
  e.rollTimer = Math.max(0, e.rollTimer - dt);

  // While he is balled up the roll owns the body outright.
  if (e.roll) {
    stepRoll(e, world, dt);
    return null;
  }

  // ...and the uncurl owns it on the way out, so the bones' phase machine
  // below never sees a landing it would mistake for a recovery.
  if (e.attackKind === 'uncurl') {
    if (e.phaseTimer <= 0) {
      e.attackKind = null;
      setPhase(e, 'idle', 0);
    }
    return null;
  }

  switch (e.phase) {
    case 'idle': {
      if (!t) return null;
      faceTarget(e, t);
      const dx = t.position.x - e.position.x;
      if (Math.abs(dx) > 60) drift(e, world, dx >= 0 ? 1 : -1, A.huntSpeed, dt);

      // The roll goes first when both are due: it is the bigger commitment,
      // and a volley fired into a roll she is already dodging is noise.
      const kind = e.rollTimer <= 0 ? 'roll' : e.cooldownTimer <= 0 ? 'bones' : null;
      if (!kind) return null;
      e.attackKind = kind;
      e.lockedDir = dx >= 0 ? 1 : -1;
      e.facing = e.lockedDir;
      setPhase(e, 'telegraph', kind === 'roll' ? A.rollTelegraph : telegraph);
      return null;
    }
    case 'telegraph': {
      if (e.phaseTimer > 0) return null;
      if (e.attackKind === 'roll') {
        const variant = rollVariant(e.rollVariantIndex);
        e.roll = true;
        e.rallies = 0;
        e.rollBounces = 0;
        e.velocity.x = e.lockedDir * (e.hot ? variant.speedXHot : variant.speedX);
        e.velocity.y = -variant.launches[0]!;
        setPhase(e, 'active', A.rollTime);
        return null;
      }
      setPhase(e, 'active', A.bonesActive);
      if (!t) return null;
      const size = ENEMY_SIZES.dog;
      const mouth: Vec2 = {
        x: e.position.x + e.facing * (size.width / 2),
        y: e.position.y - size.height / 2,
      };
      // THROWN, not fired (playtest 4, note 1): “I thought that he would
      // actually shoot the bones, and they would sort of spin around and go
      // around the map and actually bounce them.” Same fan, same speed, same
      // pokeable radius — what changed is that a surface turns them instead
      // of eating them, and that they tumble while they travel.
      //
      // The alternating spin direction is free readability: three bones
      // leaving the same mouth on the same frame no longer look like one
      // object, and it costs nothing but a sign.
      return fanShots(
        mouth,
        { x: t.position.x, y: t.position.y - CHEST },
        A.shots,
        A.spreadDeg,
        A.projSpeed,
      ).map((bone, i) => ({
        ...bone,
        bounces: A.boneBounces,
        spin: i % 2 === 0 ? A.boneSpin : -A.boneSpin,
        angle: 0,
      }));
    }
    case 'active':
      if (e.phaseTimer <= 0) setPhase(e, 'recovery', A.bonesRecovery);
      return null;
    case 'recovery':
      if (e.phaseTimer <= 0) {
        e.attackKind = null;
        e.cooldownTimer = e.hot ? A.bonesEveryHot : A.bonesEvery;
        setPhase(e, 'idle', 0);
      }
      return null;
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
      return stepDog(e, world, dt, target);
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
    case 'bones':
      return null; // the projectiles carry the threat, same as the volley
    case 'roll':
    case 'uncurl':
      // The ball's threat is its BODY, and only its lower band at that —
      // arena.ts's enemyHurtsBox owns that rule so the pogo-safe cap and the
      // damage check can never drift apart. The uncurl is the same: he is
      // lethal because he is a dog, not because a box is out.
      return null;
  }
}

/**
 * One projectile step.
 *
 * A spitter shot flies straight and dies on the first solid it meets — that
 * is still the default, and every mode she has already played is unchanged.
 *
 * A thrown bone (`bounces > 0`) REBOUNDS instead, spending one of its budget
 * per surface (playtest 4, note 1). The two axes are resolved separately so
 * the rebound knows which surface it met: a wall flips x, a floor or ceiling
 * flips y. A corner that turns both in one step still costs one bounce — it
 * is one event to watch, so it should be one number off the budget.
 */
export function stepProjectile(p: Projectile, world: World, dt: number): void {
  if (p.dead) return;
  if (p.spin) p.angle = (p.angle ?? 0) + p.spin * dt;

  const nextX = p.position.x + p.velocity.x * dt;
  const nextY = p.position.y + p.velocity.y * dt;

  if (!p.bounces) {
    p.position.x = nextX;
    p.position.y = nextY;
    if (solidAt(world, p.position.x, p.position.y)) p.dead = true;
  } else {
    let turned = false;
    if (solidAt(world, nextX, p.position.y)) {
      p.velocity.x = -p.velocity.x;
      turned = true;
    } else {
      p.position.x = nextX;
    }
    if (solidAt(world, p.position.x, nextY)) {
      p.velocity.y = -p.velocity.y;
      turned = true;
    } else {
      p.position.y = nextY;
    }
    if (turned) {
      p.bounces -= 1;
      // A bone that just changed direction should look like it did.
      if (p.spin) p.spin = -p.spin;
      // The budget is spent: the next surface is the one that stops it.
      if (p.bounces <= 0 && solidAt(world, p.position.x, p.position.y)) p.dead = true;
    }
  }

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
