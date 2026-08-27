/**
 * Every word the ending says, in one place.
 *
 * This is the first module of the copy extraction ratified in playtest 7,
 * note 2: "one copy module, generated deck". The extraction of the other ~250
 * strings is still ahead, but the ending writes about fifteen NEW ones and the
 * contract's reasoning is that writing them inline means extracting them again
 * a week later. So they are born here.
 *
 * Two rules the deck generator downstream will depend on:
 *
 * 1. **Every entry is exported and named.** Nothing can show the user "all the
 *    writing" until the writing has names.
 * 2. **Interpolated strings are functions, not templates with placeholders.**
 *    Nine of the fight's 42 `fillText` calls interpolate; a deck that showed
 *    `Press {key}` would be showing a string the game never actually draws.
 *    A function can be called with a worked example instead.
 */

export const endingCopy = {
  /**
   * Bill's summons at 1:30, in two stages on `drawBarking`'s own clock.
   *
   * NOT "HELP!" — that line already exists at 0:30 and means Bill is losing.
   * This beat needs him escalating, and the fear has to be Kayla's own
   * inference: the fight taught her at 0:30 that a Bill who shouts GETS
   * backup (playtest 7, the user's correction).
   */
  summonFirst: 'ALL RIGHT—',
  summonSecond: 'EVERYBODY!',

  /**
   * The celebration's headline, once the cast is up and applauding. Nothing
   * appears before this: the ratified sequence has NO win text of any kind
   * for the first thirteen seconds, because a caption is the site explaining
   * the joke while the joke is still being told.
   */
  /**
   * The HUD's right-hand line, once the party has started. It is win text, so
   * it waits for the cheer with everything else — during the walk-on the HUD
   * still says "the thing at the bottom", exactly as it did all fight.
   */
  hudNeverTouched: 'and they never touched you',

  winHeadline: 'YOU DID IT',
  winLine: "1:30 against the Two Bills, untouched. You're the Hollow Knight Queen.",

  /**
   * The prompt, ~19.5 s in. The user's "Press 1 for next" meant THE CONTINUE
   * BUTTON — "just keep it consistent, because by that point she'll know what
   * you mean" — so it prints the live key label, which is `Z`, or `Space` if
   * she has rebound it, or "the bottom button" on a pad.
   */
  winPrompt: (jump: string, attack: string): string =>
    `Press ${attack} or ${jump} to face them again.`,

  /** The dev drawer's own line, so the deck sees it too and can flag it as dev-only. */
  devWatchEnding: 'Watch the ending',
} as const;
