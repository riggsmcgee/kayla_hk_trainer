/**
 * The ending's confetti — the spitter's volley, fired straight up and bursting
 * at the top.
 *
 * It has its own step, and the reason is worth keeping: `stepProjectile` has
 * NO GRAVITY. A spitter shot must fly true or the fight's whole "slash them out
 * of the air" lesson stops working, so confetti cannot borrow it — falling is
 * the entire behaviour here (PLAN.md §8).
 *
 * Two rules from the ratified design, both load-bearing:
 *
 * - **Colours are STEADY.** No strobe, no full-screen flash. That is what lets
 *   `reduceFlashing` soften the palette rather than delete the confetti — she
 *   still gets her party instead of a toggle taking it away.
 * - **Nothing is random.** Every piece's spread, drift and colour comes from
 *   its own index through a hash, so the burst looks scattered and a test can
 *   still say exactly where a piece will be. It is also the only way a stepped
 *   drawing stays stepped: `Math.random` would put pieces on fractional pixels.
 */

/** The pieces are square, and small enough to read as paper rather than as rocks. */
export const CONFETTI = {
  /** Downward acceleration, px/s². Gentler than the player's — paper falls slowly. */
  gravity: 260,
  /** How fast the shot climbs before it bursts, px/s. */
  riseSpeed: 520,
  /** How long a piece lives once it has burst, seconds. */
  lifeSeconds: 3.4,
  /** How many pieces one shot becomes. */
  piecesPerBurst: 18,
  /** Seconds between shots, so something is always drifting through the tableau. */
  cycleSeconds: 2,
  /** Half the sideways spread a burst throws, px/s. */
  spreadX: 190,
  /** How much upward kick the burst adds, px/s, before gravity takes over. */
  spreadY: 150,
  /** Square edge, in px. A multiple of 4 keeps it on the Bills' own grid. */
  size: 8,
} as const;

/**
 * The party palette.
 *
 * Deliberately drawn from the site's own accents and NOT from anything that
 * teaches her something: no `punishGold #e8c76a` (the punish window) and no
 * `#f08a2c` (Bill's foam finger). Confetti that shared a colour with a hazard
 * marker would be the one moment the site's colour language lies.
 */
export const CONFETTI_COLORS = ['#e9e4d5', '#a9c7e8', '#3f8a5e', '#7c6a9e', '#cfe4fa'] as const;

/**
 * The same palette with the life taken out of it, for `reduceFlashing`.
 *
 * Softened, never removed. The ratified line is that she still gets her party;
 * the comfort setting exists to stop things flashing at her, and steady paper
 * drifting down a screen is not that.
 */
export const CONFETTI_COLORS_SOFT = [
  '#b9b4a8',
  '#8095ac',
  '#3a6350',
  '#5f5578',
  '#93a5b8',
] as const;

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Index into the palette, so the draw picks the right list at draw time. */
  color: number;
  /** Seconds left. A piece is dropped when this reaches zero. */
  life: number;
}

/**
 * A stable pseudo-random in [0, 1) from two integers.
 *
 * A hash rather than a generator, so a piece's spread depends only on which
 * piece it is — no state to reset, and a test can ask about piece 7 of burst 3
 * without running the other twenty-nine.
 */
function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Turn one shot into a burst of paper at (`x`, `y`).
 *
 * `burstIndex` is which shot this is; it is what makes consecutive bursts look
 * different instead of stamping the same shape over and over.
 */
export function burstConfetti(x: number, y: number, burstIndex: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < CONFETTI.piecesPerBurst; i++) {
    const spread = hash(i, burstIndex) * 2 - 1;
    const kick = hash(i + 91, burstIndex);
    pieces.push({
      x,
      y,
      vx: spread * CONFETTI.spreadX,
      vy: -kick * CONFETTI.spreadY,
      color: Math.floor(hash(i + 17, burstIndex) * CONFETTI_COLORS.length),
      life: CONFETTI.lifeSeconds * (0.7 + kick * 0.3),
    });
  }
  return pieces;
}

/**
 * Advance every piece and drop the ones that are finished.
 *
 * Returns a NEW array rather than mutating in place, so the caller cannot end
 * up iterating a list something else is splicing — the same stance
 * `projectiles.filter(...)` takes in the sessions.
 */
export function stepConfetti(pieces: readonly ConfettiPiece[], dt: number): ConfettiPiece[] {
  const alive: ConfettiPiece[] = [];
  for (const p of pieces) {
    const life = p.life - dt;
    if (life <= 0) continue;
    alive.push({
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: p.vx,
      vy: p.vy + CONFETTI.gravity * dt,
      color: p.color,
      life,
    });
  }
  return alive;
}

/**
 * How high the shot from `firedAt` has climbed after `elapsed` seconds, and
 * whether it has reached the top and should burst.
 *
 * Split out from the session because it is the one piece of the cycle with
 * arithmetic in it, and arithmetic is what a test can hold onto.
 */
export function shotHeight(elapsed: number): number {
  return CONFETTI.riseSpeed * elapsed;
}

/** True once a shot launched `elapsed` seconds ago has climbed `toHeight`. */
export function shotHasBurst(elapsed: number, toHeight: number): boolean {
  return shotHeight(elapsed) >= toHeight;
}
