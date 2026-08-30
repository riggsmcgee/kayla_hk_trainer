/**
 * The words on the mini-game pages — the two that are extracted so far, the
 * Bounce Bog and the Colosseum.
 *
 * The fifth module of the copy extraction (playtest 8, note 4), and it follows
 * `copy/nav.ts`: everything exported and named, and anything with a value in it
 * is a FUNCTION rather than a template with a `{placeholder}`, so the editor
 * shows what the page really renders.
 *
 * Two things are deliberately left where they are.
 *
 * **The dev drawer's strings.** PLAN §7's standing note says the arena's enemy
 * picker and the observe toggle come OUT in the final build. Giving them names
 * in the module that feeds the site editor would put words in front of the user
 * that he is meant never to see, and would make deleting them a two-file job.
 *
 * **The chapters' own titles, places and ledes-by-another-name.** Those are in
 * `chapters.ts`, the one list every part of the road reads; the same reasoning
 * as `copy/nav.ts`.
 */

/** Chrome both mini-game pages share, above and below the canvas. */
export const playCopy = {
  /**
   * The line above the heading: what kind of stop this is, where it sits on the
   * road, and the place name. The separator is a real interpunct, not a hyphen.
   */
  eyebrow: (index: number, place: string): string => `Mini-game · ${index} · ${place}`,

  /**
   * The fine print at the foot of every page with a canvas on it.
   *
   * Three fragments because "Settings" is a real `<Link>` in the middle of the
   * sentence: the space before it travels at the end of `finePrintLead`, and
   * the full stop after it is its own string. An editor that offered the whole
   * sentence as one box would let the link be edited away.
   */
  finePrintLead: 'Screen shake and flashing can be turned down in ',
  finePrintLink: 'Settings',
  finePrintTail: '.',
} as const;

/** The Bounce Bog (`pages/PlayPogo.tsx`, `pages/playPogo.helpers.ts`). */
export const pogoCoursePlayCopy = {
  lede: (levels: string): string =>
    `${levels} levels, lantern to lantern — a miss only costs a few seconds. Clear one to open the next.`,

  /** The canvas's accessible name; a screen reader has no other way to know which level is up. */
  canvasLabel: (level: number): string => `Pogo Course, level ${level}`,

  /**
   * What the overlay calls the thing the forward key goes to. Lower case
   * because the overlay reads "…for {nextLabel}" — the next stop's own title
   * arrives already capitalised, and a level does not have one.
   */
  nextLevelLabel: (level: number): string => `level ${level}`,

  /** The panel under the canvas, after a clear. */
  levelClear: (level: number): string => `Level ${level} clear.`,
  nextLevelButton: 'Next level →',
  backToLevelButton: (level: number): string => `Level ${level} →`,
  /** Only when every level is genuinely cleared — a skipped level is not a clear. */
  courseClear: 'Course cleared, Kayla!',

  /** Under the level chips. Her time, or an honest blank. */
  best: (clock: string): string => `Best: ${clock}`,
  noBest: 'No clear yet.',
} as const;

/**
 * The Bottom of the Well (`pages/PlayWell.tsx`) — the three beats and the gate
 * between them.
 *
 * The gate's three lines each come in two versions because the beat before the
 * bottom is the waves and the beat before the waves is the level. A pair of
 * strings rather than a sentence built from a noun, so both readings can be
 * edited as the sentences they are.
 */
export const finalePlayCopy = {
  // The apostrophe is a real character. This line spent a while reading
  // "you2019ve" — a right single quote that lost its escape somewhere between
  // an editor and the file, leaving the code point's digits sitting in the
  // prose. He found it by reading the page, which is the only way anyone was
  // ever going to.
  lede: 'Everything you’ve learned, Kayla, all at once. Nothing down here is new.',

  beatsLabel: 'The three beats',

  gateRuleWaves: 'Clear the waves first.',
  gateRuleLevel: 'Clear the level first.',
  gateBackWaves: 'Play the waves',
  gateBackLevel: 'Play the level',
  gateSkipWaves: 'Skip to the bottom',
  gateSkipLevel: 'Skip the level',

  /** The whole road, finished. The letter at `#/the-end` is where it is said properly. */
  roadDone: 'You walked the whole road, Kayla.',
  roadDoneBack: 'Back to the map',
} as const;

/** The Colosseum (`pages/PlayDodge.tsx`). */
export const dodgeArenaPlayCopy = {
  lede: (enemies: string): string =>
    `${enemies} enemies, in order. Survive a minute and land your hits, and the next one steps in. Get touched and you start that enemy over.`,

  /** The stage strip: one entry per enemy, in road order. */
  rosterLabel: 'The roster',
  stageHits: (hits: number): string => `${hits} hits`,
  srCleared: ', cleared',

  canvasLabel: 'Dodge Arena',

  /** The only thing the page says when the whole roster is behind her. */
  arenaClear: 'Colosseum cleared, Kayla!',
} as const;
