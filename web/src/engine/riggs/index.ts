/**
 * Eight-bit Riggs — the portfolio, and the one seam the rest of the app uses.
 *
 * The final screen of the dojo needs a picture of the person who built it, and
 * playtest 7 ratified how: waist-up, ~500 px, a 16 px master cell with nothing
 * finer than 8 px, stepped motion, drawn in Bill the man's medium. What it did
 * NOT decide is what he looks like — the only stated fact is the bow tie — so
 * this ships as a portfolio the user picks from, exactly as the Bills'
 * entrances, the dog's look and the celebration poses did.
 *
 * The rule that portfolio process runs on (playtest 6, after Session 8's
 * gallery turned out to be a fork that drifted): **the candidates are real
 * code in the shipped module, not a concept branch.** `build-riggs-gallery.mjs`
 * compiles this directory with the repo's own esbuild, so choosing one is
 * choosing a painter the game already contains, and choosing one is deleting
 * the other two.
 *
 * Nothing here knows what a canvas is beyond `fillRect`. The three painters
 * take a `tie` colour as a PARAMETER rather than reading a constant, which is
 * what lets the gallery show the same drawing in six yellows without any of
 * them being touched.
 */

import { paintRiggsA } from './riggsA';
import { paintRiggsB } from './riggsB';
import { paintRiggsC } from './riggsC';
import type { Vec2 } from '../types';

type Ctx = CanvasRenderingContext2D;

/** How one candidate paints: origin is the centre of his waist cut. */
export type RiggsPainter = (ctx: Ctx, origin: Vec2, t: number, tie: string) => void;

export interface RiggsCandidate {
  /** How the user refers back to one — "I pick B" — not a running order. */
  letter: string;
  /** The direction it argues for, in the words the gallery briefed it with. */
  name: string;
  paint: RiggsPainter;
}

export const RIGGS_CANDIDATES: readonly RiggsCandidate[] = [
  { letter: 'A', name: 'Same Room As Bill', paint: paintRiggsA },
  { letter: 'B', name: 'The Detail The Scale Buys', paint: paintRiggsB },
  { letter: 'C', name: 'The Portrait', paint: paintRiggsC },
];

/** Which candidate to draw, as an index into `RIGGS_CANDIDATES`. */
export type RiggsVariant = number;

/**
 * The one that ships until the user has picked.
 *
 * Deliberately NOT presented as a decision: it is the first candidate, the
 * same way `DEFAULT_DOG_LOOK` was the first look before the portfolio was
 * answered. When the pick comes in, this constant changes and the other two
 * files are deleted.
 */
export const DEFAULT_RIGGS_VARIANT: RiggsVariant = 0;

/**
 * The bow tie's yellow, UNPICKED.
 *
 * Ratified out: `punishGold #e8c76a`. The Reading Enemies lesson teaches that
 * exact hex in so many words as "the punish window", and it is every forward
 * button on the site — a tie in it is the picture telling her to hit him. What
 * replaces it is a colour the user should SEE rather than name, so the gallery
 * offers a shortlist and this holds a placeholder from it until he answers.
 *
 * It is one constant in one place precisely so answering costs one line.
 */
export const RIGGS_TIE = '#a8891c';

/** Clamp anything a stale setting or a hand-edited blob might hold. */
export function riggsCandidate(variant: RiggsVariant): RiggsCandidate {
  const found = RIGGS_CANDIDATES[variant];
  return found ?? RIGGS_CANDIDATES[DEFAULT_RIGGS_VARIANT]!;
}

/**
 * Draw Riggs, waist-up, anchored at the centre of his waist cut.
 *
 * He extends UP about 496 px and about 448 px across, and draws nothing below
 * `origin.y`. `t` is free-running seconds; every candidate steps its animation
 * off a floored clock, never off an interpolation, which is the one thing his
 * art has to do to look like it comes from the same world as the Bills.
 */
export function paintRiggs(
  ctx: Ctx,
  origin: Vec2,
  t: number,
  variant: RiggsVariant = DEFAULT_RIGGS_VARIANT,
  tie: string = RIGGS_TIE,
): void {
  riggsCandidate(variant).paint(ctx, origin, t, tie);
}
