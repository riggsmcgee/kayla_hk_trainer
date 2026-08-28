/**
 * The Setup chapter's words — begun with the part that carries the most meaning
 * per character: the accessible description of each controller diagram.
 *
 * These two are not decoration. They are the only way the diagrams reach anyone
 * who cannot see them, and the leverless one is the sentence the whole controller
 * preset answers — "Attack (Y) and Jump (B) sit under the same finger until
 * remapped" is quoted in PLAN §8 as the reason the preset exists. A description
 * that drifts from what the diagram draws is worse than none, so it belongs
 * somewhere it can be read next to the rest of the site's words.
 *
 * The eighth module of the copy extraction; the rest of `pages/LessonSetup.tsx`
 * and the diagrams' own printed labels are the next slice. Same two rules as the
 * modules before it.
 */
export const setupCopy = {
  /**
   * The pair in the grip, as she holds it on the couch. It names positions
   * before letters — bottom of the diamond, left of the diamond — because
   * positions are what the site binds and letters are what pads disagree about.
   */
  joyConDescription:
    'A pair of Joy-Con in the grip. On the right half, B (bottom of the diamond) is Jump, Y (left) is Attack, and the ZR trigger behind the shoulder is Dash. On the left half, the stick moves you, and holding it down while you attack is a pogo. The Down button under the stick is a more reliable down if pogos keep coming out as side slashes.',

  /** The board she actually owns, and the clash the preset is built to move. */
  leverlessDescription:
    'A leverless all-button controller. Left hand: Left, Down and Right buttons under three fingers, with a large Up button below for the thumb. Right hand: two rows of four. In Switch mode the top row is Y X R L and the bottom row is B A ZR ZL, so Attack (Y) and Jump (B) sit under the same finger until remapped; Dash is ZR.',
} as const;
