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
  /**
   * The heading, and the only place the page says what it is. Deliberately not
   * "Congratulations": she has already had YOU DID IT on the arena screen, and
   * repeating it here would make this a second victory card rather than a
   * letter from the person who built it.
   */
  title: 'From Riggs',

  /**
   * The messages, typed out one at a time at talking pace.
   *
   * Ratified drafts, in the user's own words from the playtest-7 interview.
   * The last one signs off, so nothing after it needs to — and after playtest 8
   * deleted the credits, nothing after it EXISTS.
   *
   * The cost of a longer letter is arithmetic, not taste: at 12 characters a
   * second, every 150 characters added is another twelve seconds of her sitting
   * and reading. These four run about a minute.
   */
  messages: [
    'Kayla — you did it. 1:30 against both Bills, and they never laid a finger on you.',
    'I want to be straight with you about what that means. That fight is harder than a lot of the real bosses in Hollow Knight. I built it that way. And you beat it clean.',
    'Everything you just did — the bouncing, the waiting, the reading before the hitting — is the same thing the real game is asking you for. You’ve got it now.',
    'I’m really proud of you. Go enjoy Hollow Knight. It’s one of my favourite games in the world and I hope this made it more fun. — Riggs',
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
