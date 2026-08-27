/**
 * Eight-bit Riggs — the drawing of the person who built the dojo, and the one
 * seam the rest of the app uses.
 *
 * The last screen needs a picture of him, and playtest 7 ratified how:
 * waist-up, ~500 px, a 16 px master cell with nothing finer than 8 px, stepped
 * motion, drawn in Bill the man's medium. What it did NOT decide was what he
 * looks like, so three candidates shipped as real code and the user chose from
 * a gallery compiled out of them.
 *
 * **Playtest 8 answered it: candidate B, on style.** A and C are deleted, and
 * that deletion is the rule this project runs on rather than tidiness —
 * Session 8's gallery drifted out of sync with the game precisely because the
 * losers were kept alive. One painter is now the only painter.
 *
 * Two things survive the portfolio because they are still open questions:
 * the tie colour is a parameter with an unpicked placeholder, and
 * `build-riggs-gallery.mjs` still compiles this directory, which is how the
 * likeness round-trip (photo in, one revised face out) gets shown as a
 * picture rather than described as a paragraph.
 *
 * Nothing here knows what a canvas is beyond `fillRect`.
 */

import { paintRiggsB } from './riggsB';
import type { Vec2 } from '../types';

type Ctx = CanvasRenderingContext2D;

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

/**
 * Draw Riggs, waist-up, anchored at the centre of his waist cut.
 *
 * He extends UP about 496 px and about 448 px across, and draws nothing below
 * `origin.y`. `t` is free-running seconds; the animation steps off a floored
 * clock and never interpolates, which is the one thing his art has to do to
 * look like it comes from the same world as the Bills.
 *
 * `speaking` is the read-off's typewriter telling him a sentence is currently
 * appearing on the page beside him. It moves his mouth and nothing else.
 */
export function paintRiggs(
  ctx: Ctx,
  origin: Vec2,
  t: number,
  speaking = false,
  tie: string = RIGGS_TIE,
): void {
  paintRiggsB(ctx, origin, t, tie, speaking);
}
