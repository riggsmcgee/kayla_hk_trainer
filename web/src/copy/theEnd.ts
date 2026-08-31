/**
 * Every word on `#/the-end` — the last screen of the dojo.
 *
 * Same two rules as `copy/ending.ts`, and the same reason: this is the second
 * module of the copy extraction ratified in playtest 7, note 2. Everything is
 * exported and named so the site editor can show it, and anything with a value
 * substituted into it is a FUNCTION rather than a template with a placeholder,
 * so the editor can show what the page really draws.
 *
 * The messages are drafts. They are the most personal writing in the project
 * and they are the writing most likely to be rewritten, which is exactly why
 * they live here rather than inline in the JSX.
 */

export const theEndCopy = {
  /*
   * There is no heading on this screen any more, and its absence is the point.
   * It was "From Riggs", which was already deliberately not "Congratulations"
   * — she has had YOU DID IT on the arena screen, and a second victory card is
   * not what this is. The rewrite went one further: a letter that opens by
   * announcing itself as a letter is a card, and the first line signs its own
   * name by the way it talks. The last one signs it properly.
   */

  /**
   * The messages, typed out one at a time at talking pace.
   *
   * Ratified drafts, in the user's own words from the playtest-7 interview.
   * The last one signs off, so nothing after it needs to — and after playtest 8
   * deleted the credits, nothing after it EXISTS.
   *
   * The cost of a longer letter is arithmetic, not taste, and the numbers to do
   * it with are in `pages/theEnd.helpers.ts` rather than here: at the pace set
   * there, every 150 characters added is about another four and a half seconds
   * of her sitting and reading, plus a gap. These six run a little over half a
   * minute.
   */
  messages: [
    `Wow... I'm really impressed`,
    `When I started making this trainer I didn't intend to make it this hard. If you only completed 80% of the challenges, you would be in a great spot to play Hollow Knight.`,
    `But you didn't do that, did you?`,
    'No, you overcame every last obstacle that I threw at you.',
    `Don't get me wrong, Hollow Knight is a very hard game. You will find challenges and frustration, but I hope you also find a lot of fun and accomplishment along the way.`,
    `Best of luck in your digital adventures. - Riggs`,
  ],

  /**
   * The same letter for a win she took with assist mode on.
   *
   * Two of the four sentences above claim she was never touched, and with
   * lives on she may have been. Playtest 10 settled the treatment, and it is
   * OMISSION rather than a rewrite — in his words: _"keep the original line,
   * and then if she turns on the assistant mode where she can take multiple
   * hits, then just don't include that."_ So the untrue CLAUSES come out and
   * every other word is his, in his order. Messages 3 and 4 are untouched:
   * they were true either way.
   *
   * The array is the same LENGTH as the one above, deliberately. The page
   * derives "finished" from the last index, and a shorter letter would have
   * left an assisted reader on a page with no way forward.
   *
   * Which one she sees is decided at render from her recorded runs, so a clean
   * win later restores the full letter rather than freezing the version she
   * happened to earn first.
   */
  messagesAssisted: [
    `Wow... I'm really impressed`,
    `When I started making this trainer I didn't intend to make it this hard. If you only completed 80% of the challenges, you would be in a great spot to play Hollow Knight.`,
    `But you didn't do that, did you?`,
    'No, you overcame every last obstacle that I threw at you.',
    `Don't get me wrong, Hollow Knight is a very hard game. You will find challenges and frustration, but I hope you also find a lot of fun and accomplishment along the way.`,
    `Best of luck in your digital adventures. - Riggs`,
  ],

  /**
   * The prompt under the messages, and it has TWO jobs now that the text
   * arrives on its own: forward finishes the sentence being typed, and only
   * once it is finished does forward move on.
   *
   * The label is LIVE — it prints `Z`, or `Space` if she has rebound it, or
   * "the bottom button" on a pad — because `jump = forward` is ratified on
   * every overlay and a hardcoded key would be a lie the moment she remaps.
   */
  advance: (jump: string): string => `Press ${jump} to keep going`,
  finish: (jump: string): string => `Press ${jump} to finish the sentence`,

  /** The on-screen button, for a mouse and for anyone who cannot press a key. */
  advanceButton: 'Next',
  finishButton: 'Finish the sentence',

  /**
   * Back to the map, underneath his last sentence.
   *
   * Playtest 8 deleted the credits rather than expanding them — "it just
   * doesn't add anything" — so this is the whole of what follows the letter.
   * It is a quiet link and not a gold button on purpose: the forward key is
   * how the site says "the next thing is worth doing", and there is no next
   * thing here.
   */
  backToMap: 'Back to the map',

  /**
   * Settings, once she has beaten the Bills at least once.
   *
   * It used to say "Watch the credits". With the credits gone the letter is
   * the whole thing, so the link now offers what is actually behind it.
   */
  settingsReadAgain: 'Read it again',
  settingsReadAgainNote:
    'You have beaten the Two Bills, so the letter is yours to re-read whenever you like.',
} as const;
