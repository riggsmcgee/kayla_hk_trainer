/**
 * Every word the Two Bills fight says, in one place.
 *
 * The third module of the copy extraction ratified in playtest 7, note 2, and
 * the one that mattered most: `bossSession.ts` carried **17 of the project's 42
 * canvas `fillText` calls** — more than any other file — and canvas strings are
 * exactly the half the user named. "You passed", "you failed", the cards: those
 * are pixels, not DOM, which is why an in-site click-to-edit overlay was
 * rejected and why they have to be given names before anything can show them.
 *
 * The same two rules as `copy/ending.ts` and `copy/theEnd.ts`:
 *
 * 1. **Everything is exported and named.** Nothing can show the user "all the
 *    writing" until the writing has names.
 * 2. **Anything with a value substituted into it is a FUNCTION**, never a
 *    template with a placeholder, so a generated deck shows what the game
 *    really draws rather than `Press {key}`.
 */

export const fightCopy = {
  /**
   * The right-hand corner during the fight — and, for the thirteen seconds of
   * the ending's fake-out, after it too. Nothing about the corner may change at
   * 1:30 or it becomes the tell.
   */
  hudSubtitle: 'the thing at the bottom',

  /** Only reachable in god mode now: 1:30 ends the fight for everyone else. */
  hudPastTarget: 'past 1:30 — how long can you go?',

  /** The 1:00 threshold, where both Bills speed up. */
  hudHot: 'they have your number now',

  /**
   * The clock, which is the whole score. There is no hits line, ever — the
   * fight is a survival clock and a second number would invite her to optimise
   * the wrong thing.
   */
  hudClock: (elapsed: string, target: string | null): string =>
    target === null ? elapsed : `${elapsed} / ${target}`,

  /**
   * Bill's entrance. The first line is deliberately NOT his name: she should be
   * looking at the empty right-hand side of the arena, wondering.
   */
  introSomethingComing: 'Something is coming.',
  introHurry: (jump: string): string => `hold ${jump} to hurry`,

  billName: 'BILL THE MAN',
  billLine:
    'Your Dad was the Hollow Knight all along. Hitting him slows him down, but you have to outlast him.',

  /** The rules, in one line, on the screen she reads before she moves. */
  readyLine: 'One touch ends it. Survive 1:30. Move to begin.',

  dogName: 'BILL THE DOG',
  dogLine: 'The Bills were working together all along.',

  /**
   * Bill shouts for the dog at 0:30, and the answer arrives from off-screen.
   * There is no audio anywhere in this project, so the barking is DRAWN.
   */
  billShout: 'I NEED SOME HELP!',
  /**
   * Under the dog's card, which waits for her rather than timing out.
   *
   * Names no key on purpose — it takes any button and any direction, and the
   * overlays name actions rather than inputs anyway (playtest 10). It must
   * contain neither "skip" nor "hurry": the card is unskippable, and a test
   * says so, because an unskippable card that advertises a way out is a card
   * she will spend the whole beat looking for the way out of.
   */
  dogCardPrompt: 'Press anything when you are ready.',
  dogAnswer: 'WOOF!',

  /** The fail screen. Short on purpose: she wants to be back in it. */
  failHeadline: 'Got you.',
  failTime: (clock: string): string => `${clock} survived.`,
  failTimePastTarget: (clock: string): string =>
    `${clock} — past 1:30, and still going when they got you.`,

  /**
   * Both keys retry from a run she just lost — there is no forward from a
   * fight she did not finish, and a dead key would read as broken.
   */
  failPrompt: (attack: string): string => `Press ${attack} to face them again.`,
  failPromptWithNext: (attack: string, jump: string, next: string): string =>
    `Press ${attack} to face them again · ${jump} for ${next}.`,

  /** What forward leads to when the page did not say. */
  nextStopFallback: 'the next stop',
} as const;
