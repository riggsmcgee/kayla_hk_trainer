/**
 * The front page — the hero, the sign beside the map, the legend and the two
 * lines at the bottom that are the whole dojo in miniature.
 *
 * The sixth module of the copy extraction (playtest 8, note 4), and the one
 * most likely to be edited: these are the warmest words on the site and the
 * only ones she reads before she has done anything. Same two rules as the
 * modules before it — everything named, and anything with a value in it is a
 * function rather than a template with a placeholder.
 *
 * The stops' own names, lines and what-finishing-means come from `chapters.ts`
 * and are printed here unchanged; the sign is a frame around them.
 */
export const homeCopy = {
  /** The one line at the top, and the only place the road is named as a road. */
  hero: 'Your training begins.',
  lede: (stops: string): string =>
    `Soon you'll have the skills to enjoy one of the best games ever made.`,

  /**
   * The sign beside the map while there is still road ahead. `signLabel` is the
   * accessible name of the whole panel and `signEyebrow` is the visible line —
   * the same words, and separate entries because a screen reader hearing
   * "Next stop, Next stop" would be the cost of merging them.
   */
  signLabel: 'Next stop',
  signEyebrow: 'Next stop',
  /** What clearing the next stop means, printed straight from `chapters.ts`. */
  signToFinish: (done: string): string => `To finish: ${done}`,

  /**
   * The same sign once every stop is behind her. It offers a replay rather than
   * a congratulation: `#/the-end` is where the dojo says well done, and saying
   * it here as well would spend the ending twice.
   */
  doneEyebrow: 'The whole road',
  doneTitle: (stops: string): string => `You’ve walked all ${stops} stops.`,
  doneLine: 'Replay whatever you like — the well’s always open.',
  doneButton: 'Back down the well',

  /** The key under the sign, matching the map's own colours. */
  legendLabel: 'Legend',
  legendLesson: 'chapter',
  legendMiniGame: 'mini-game',
  legendDone: 'done',
  legendSkipped: 'skipped',
  legendLocked: 'locked',

  /**
   * The doctrine, in the user's own words, and the signature under it. The
   * ampersand is a real character here; the page used to spell it as an HTML
   * entity, which is not something a text box should ever show her.
   */
  
} as const;
