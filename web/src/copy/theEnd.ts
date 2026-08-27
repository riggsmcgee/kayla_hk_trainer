/**
 * Every word on `#/the-end` — the last screen of the dojo.
 *
 * Same two rules as `copy/ending.ts`, and the same reason: this is the second
 * module of the copy extraction ratified in playtest 7, note 2. Everything is
 * exported and named so a generated deck can show it, and anything with a
 * value substituted into it is a FUNCTION rather than a template with a
 * placeholder, so the deck can show what the page really draws.
 *
 * The four messages are drafts. They are the most personal writing in the
 * project and they are the writing most likely to be rewritten, which is
 * exactly why they live here rather than inline in the JSX.
 */

/** The five enemies she learned by name, in the order the road taught them. */
export interface CastCredit {
  name: string;
  /** What they are credited AS. The joke is that most of them play themselves. */
  role: string;
}

export const theEndCopy = {
  /**
   * The heading, and the only place the page says what it is. Deliberately not
   * "Congratulations": she has already had YOU DID IT on the arena screen, and
   * repeating it here would make this a second victory card rather than a
   * letter from the person who built it.
   */
  title: 'From Riggs',

  /**
   * The four messages, advanced one at a time with the forward button.
   *
   * Ratified drafts, in the user's own words from the playtest-7 interview.
   * The last one signs off, so nothing after it needs to.
   */
  messages: [
    'Kayla — you did it. 1:30 against both Bills, and they never laid a finger on you.',
    'I want to be straight with you about what that means. That fight is harder than a lot of the real bosses in Hollow Knight. I built it that way. And you beat it clean.',
    'Everything you just did — the bouncing, the waiting, the reading before the hitting — is the same thing the real game is asking you for. You’ve got it now.',
    'I’m really proud of you. Go enjoy Hollow Knight. It’s one of my favourite games in the world and I hope this made it more fun. — Riggs',
  ],

  /**
   * The prompt under the messages. The label is LIVE — it prints `Z`, or
   * `Space` if she has rebound it, or "the bottom button" on a pad — because
   * `jump = forward` is ratified on every overlay and a hardcoded key would be
   * a lie the moment she remaps.
   */
  advance: (jump: string): string => `Press ${jump} to keep going`,
  advanceLast: (jump: string): string => `Press ${jump} for the credits`,

  /** The on-screen button, for a mouse and for anyone who cannot press a key. */
  advanceButton: 'Next',
  advanceButtonLast: 'Roll the credits',

  creditsHeading: 'The Bottom of the Well',

  /**
   * The cast, and the joke landing one last time: she has spent the whole dojo
   * learning these seven by name, and the Two Bills get a screen credit for
   * playing themselves.
   */
  castHeading: 'The cast',
  cast: [
    { name: 'Bill the Man', role: 'as himself' },
    { name: 'Bill the Dog', role: 'as himself' },
    { name: 'The Walker', role: 'the first thing you ever hit' },
    { name: 'The Flier', role: 'the first thing that would not stay still' },
    { name: 'The Duelist', role: 'the one that answers whatever you do' },
    { name: 'The Spitter', role: 'the one whose attack was a stepping stone' },
    { name: 'The Warden', role: 'the one you had to hit where the shield was not' },
  ] as readonly CastCredit[],

  builtHeading: 'Built for Kayla, by Riggs',
  builtLine: 'Hit them more than they hit you and you beat the game.',

  /** Back to the map, for when she has finished reading. */
  backToMap: 'Back to the map',

  /** Settings, once she has beaten the Bills at least once. */
  settingsWatchCredits: 'Watch the credits',
  settingsWatchCreditsNote:
    'You have beaten the Two Bills, so the ending is yours to re-read whenever you like.',
} as const;
