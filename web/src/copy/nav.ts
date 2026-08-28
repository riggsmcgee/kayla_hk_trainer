/**
 * Every word the road's own chrome says — the gate panel, the chapter strip,
 * the forward button, and the Bounce Bog's level chips.
 *
 * The fourth module of the copy extraction, and the first one that is DOM
 * rather than canvas. `copy/ending.ts`, `copy/fight.ts` and `copy/theEnd.ts`
 * took the 52 strings the boss fight and the last screen DRAW; this takes the
 * strings the site's furniture RENDERS. Playtest 8, note 4 is why: the one-to-one
 * editor cannot show her half the site's words and grey out the rest, and the
 * chrome is the half that appears on every screen.
 *
 * The same two rules as the three canvas modules:
 *
 * 1. **Everything is exported and named**, so a tool can list it.
 * 2. **Anything with a value substituted into it is a FUNCTION**, never a
 *    template with a `{placeholder}`, so the editor shows what the page really
 *    renders rather than a shape the reader has to fill in themselves.
 *
 * What is deliberately NOT here: the chapters' own `place`, `title`, `line`
 * and `done` strings. They already live named in `chapters.ts`, which is the
 * one list the map, the strip, the gates and the routes all read — moving them
 * would split that list in half to gain nothing an editor can use.
 */

/**
 * The gate panel that replaces a chapter's body while the stop before it is
 * unfinished (`components/ChapterGate.tsx`).
 *
 * `heading` takes the gate's name already shaped by the caller, because a
 * mini-game reads "the Pogo Course" and a lesson reads "Your Setup" — the
 * article belongs to the sentence, not to the chapter list.
 */
export const gateCopy = {
  /** Above the heading. Not "Locked": the panel's whole job is to sound temporary. */
  eyebrow: 'Not yet',
  heading: (gateName: string): string => `Finish ${gateName} first`,
  /** The article a mini-game's title needs and a lesson's does not. */
  gateName: (title: string, isMiniGame: boolean): string => (isMiniGame ? `the ${title}` : title),
  /** The loud way out: back to the stop that is actually in her way. */
  back: (place: string): string => `Back to ${place}`,
  /**
   * The quiet way out, and it is quiet on purpose. Every gate on the road is
   * skippable — nothing ever traps her — but the button that finishes the
   * challenge is the one that should look like the offer.
   */
  skip: 'Skip this challenge',
} as const;

/**
 * The chapter strip at the foot of every chapter page
 * (`components/ChapterNav.tsx`).
 *
 * The three state suffixes are read out by a screen reader and are invisible
 * otherwise — the strip shows state as lantern and colour, which a screen
 * reader cannot see. They start with a comma because they are appended to the
 * stop's name inside the same link: "3. Bounce Bog, done".
 */
export const chapterNavCopy = {
  label: 'Chapters',
  stateDone: ', done',
  stateSkipped: ', skipped',
  stateLocked: ', locked',
} as const;

/**
 * The one gold forward button a page ends on, and what stands in for it at the
 * end of the road (`components/NextButton.tsx`, `components/ChapterNext.tsx`).
 *
 * "Next: {title}" is the site's single forward affordance — playtest 3 notes 13
 * and 14 collapsed three competing ones into it — so the label is a function of
 * the next stop's name rather than a fixed word.
 */
export const nextCopy = {
  button: (title: string): string => `Next: ${title}`,
  /**
   * The end of the road, in place of a button, because there is nowhere
   * forward to point. Three fragments rather than one string: the link in the
   * middle is a real `<Link>`, and an editor that offered the sentence as one
   * text box would let her edit the anchor into nothing.
   */
  endLead: (stops: string): string => `That’s the whole map — ${stops} stops. `,
  endLink: 'Back to the start',
  endTail: ' and go again.',
} as const;

/**
 * The Bounce Bog's level chips and the small gate under them
 * (`components/LevelPicker.tsx`).
 *
 * The level's own name comes from `POGO_COURSES`; `fallbackName` only prints if
 * a chip exists for a level the course table does not define, which the level
 * count makes impossible today and would make obvious if it ever changed.
 */
export const levelPickerCopy = {
  label: 'Choose a level',
  fallbackName: (level: number): string => `Level ${level}`,
  srCleared: ', cleared',
  srLocked: ', locked',
  /** The same clear-to-unlock shape as a chapter gate, one level down. */
  gateRule: (previous: number): string => `Clear level ${previous} first.`,
  gateBack: (previous: number): string => `Play level ${previous}`,
  gateSkip: 'Skip this level',
} as const;
