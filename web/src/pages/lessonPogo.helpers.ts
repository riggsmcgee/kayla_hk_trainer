/**
 * The one figure the Pogo lesson's thesis quotes.
 *
 * The escape window is measured rather than derived — it comes out of a
 * simulation, not out of arithmetic — so it is pinned by
 * `lessonPogo.helpers.test.ts`, which runs the same probe `attackers.test.ts`
 * runs. If the physics moves, the lesson goes red.
 *
 * This module used to export a second table, `DASH_NUMBERS`, holding the dash
 * distances and the lance speed that three paragraphs of the page printed as
 * digits. Playtest 10 rewrote those paragraphs in the user's own voice without
 * numbers in them, so the table had nothing left to keep honest and came out
 * with them. A derived constant with no sentence depending on it is not
 * safety; it is a second thing to maintain.
 */

/**
 * How long after landing a hit she can still leave and not be caught, in
 * seconds — measured against the duelist's anti-air, the enemy that punishes
 * staying. Running buys a tenth of a second; dashing buys two.
 */
export const ESCAPE_WINDOW = {
  running: 0.1,
  dashing: 0.2,
} as const;

/**
 * "a tenth", "two tenths" — a whole number of tenths of a second, spelled.
 *
 * The thesis of this lesson says the escape window in WORDS. That sentence was
 * true by coincidence until this existed: the pair of numbers is measured and
 * updates itself, and the words did not, so a physics change would have left
 * the page's loudest line quietly wrong. This is what makes both halves read
 * from the same source.
 *
 * Anything that is not a whole number of tenths falls back to the digits, which
 * reads worse and is the point — a lesson that cannot spell its own number
 * should say the number rather than round it.
 */
const TENTHS = ['no time at all', 'a tenth', 'two tenths', 'three tenths', 'four tenths'];
export function tenthsInWords(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  return Math.abs(tenths / 10 - seconds) < 1e-9 && tenths < TENTHS.length
    ? TENTHS[tenths]!
    : String(seconds);
}
