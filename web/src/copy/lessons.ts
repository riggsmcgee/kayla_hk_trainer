/**
 * What the three lesson pages share, and what each of them says that is a NAME
 * rather than an argument.
 *
 * The ninth module of the copy extraction (playtest 8, note 4), and the one
 * that had to wait for a ruling. Playtest 7 ratified that long lesson PROSE
 * stays in its page and is shown read-only; what nobody had drawn was the line
 * between prose and everything else. The line this module is built on, in the
 * order it is applied:
 *
 * 1. **Furniture always extracts** — the eyebrow, every heading, every button,
 *    every accessible name, every legend, every status line. These are names,
 *    not sentences.
 * 2. **A body paragraph stays**, with exactly two exceptions: the lede under the
 *    h1 and the `.thesis` pull-quote, because every non-lesson page already has
 *    those two in `copy/` and leaving them behind is what would make the editor
 *    inconsistent from page to page.
 * 3. **A list extracts only if EVERY item is markup-free and quotes no derived
 *    number.** One editable item beside two greyed-out ones is playtest 8's own
 *    complaint at list scale, and a sentence carrying a simulated constant must
 *    never become a text box — this project has twice shipped a number that had
 *    stopped being true.
 *
 * Same two rules as the modules before it: everything named, and anything with
 * a value in it is a function rather than a template with a placeholder.
 */
export const lessonCopy = {
  /**
   * The line above every lesson's heading, written out character for character
   * on three pages until now. The separator is a real interpunct, not a hyphen
   * — the same detail `playCopy.eyebrow` documents for the mini-games, and the
   * one that goes first when three copies drift.
   */
  eyebrow: (index: number, place: string): string => `Chapter ${index} · ${place}`,
} as const;

/**
 * The Pogo lesson, `#/lessons/pogo` — its furniture and its two single-slot
 * paragraphs.
 *
 * Almost all of this page's body stays where it is, and the reason is the third
 * rule above: every list item on it carries either markup or a number derived
 * from the simulation. `lessonPogo.helpers.ts` exists because this project has
 * twice shipped a sentence whose number had stopped being true, and a sentence
 * quoting `DASH_NUMBERS` cannot become a text box without inviting whoever
 * edits it to type the number back in as a literal.
 */
export const pogoLessonCopy = {
  lede: 'Kayla, the pogo — bouncing off things with a downward slash — is the one skill that changes how this game feels. Spikes become trampolines. Enemies become platforms.',

  /** The demo's accessible name — the whole animation, for anyone who cannot see it. */
  demoLabel:
    'Slow-motion demo of the Knight bouncing on an orb, with the down-slash hitbox drawn in green',

  kinder: 'Three things that make it kinder than it looks',
  beat: 'It’s a beat, not a mash',
  hitThenLeave: 'Hit, then leave',
  drills: 'Drills, in order',

  /**
   * The one paragraph on the page that quotes the escape window IN WORDS, and
   * therefore the one that takes it as arguments. It reads "doubles", which is a
   * claim about the two numbers and not only a description of them —
   * `lessonPogo.helpers.test.ts` holds that they stay a factor of two apart.
   */
  thesis: (running: string, dashing: string): string =>
    `The dash doubles the time you have to change your mind — from ${running} of a second to ${dashing}. That’s all it buys, and it’s enough.`,
} as const;

/**
 * The Reading Enemies lesson, `#/lessons/reading-enemies`.
 *
 * Its five demo labels are the highest-value strings on the page after the lede:
 * each is the only way one of the five animations reaches anyone who cannot see
 * it. Every body paragraph and both lists stay — each carries markup — and so do
 * the five demo CAPTIONS, because two of the five cannot be extracted and one
 * editable caption beside four read-only ones is worse than five read-only.
 */
export const readingEnemiesCopy = {
  legendLabel: 'Overlay color legend',
  legendRed: 'red — where it hurts',
  legendGreen: 'green — your nail beats this',
  legendGold: 'gold — the punish window',

  /** Three fragments: the middle word is emphasised. */
  ledeLead: 'Here’s the secret, Kayla: when you meet a new enemy, your job is ',
  ledeEm: 'not',
  ledeTail:
    ' to kill it. Spend a whole life just dodging. When you can avoid everything it has, find the one safe moment to hit back.',

  twoQuestions: 'Before the fight: two questions',
  threeBeats: 'Every attack has three beats',
  duelist: 'The duelist answers whatever you do',
  spitter: 'The spitter’s attack is your stepping stone',
  warden: 'The warden: hit where the shield isn’t',

  duelistGroundDemo:
    'Slow-motion demo: approaching the duelist on the ground provokes its lunge; the attack hitbox shows in red, the recovery window in gold',
  duelistAirDemo:
    'Slow-motion demo: jumping at the duelist provokes its rising swipe, which clips the jumper',
  spitterDemo:
    'Slow-motion demo: the spitter winds up and fires a three-shot fan of destroyable projectiles, then recovers',
  wardenShieldDemo:
    'Slow-motion demo: hanging above the warden makes it raise its shield overhead, leaving the front open; standing in front too long draws a shield bash',
  wardenRiposteDemo:
    "Slow-motion demo: a blocked hit provokes the warden's riposte; its post-riposte recovery is wide open",

  /** The hand-off to the Colosseum, which is what the whole lesson is for. */
  thesis:
    'Now prove it in the arena, Kayla: survive a minute against each one and land your hits. Watch, dodge, then take it apart.',
} as const;
