/**
 * The Setup chapter's words — the controller diagrams' accessible descriptions,
 * and the whole of the practice floor at `#/lessons/setup/floor`.
 *
 * The eighth module of the copy extraction (playtest 8, note 4). Same two rules
 * as the modules before it: everything exported and named, and anything with a
 * value substituted into it is a FUNCTION rather than a template with a
 * placeholder, so the site editor shows what the page really renders.
 */
import type { SetupCheck } from '@dojo/shared';

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

/**
 * What each checklist item asks her to do, in her own words rather than the
 * code's.
 *
 * These live here rather than beside the rule that earns them: they are seven
 * of the most-read strings on the site and the engine never prints them. What
 * `engine/setupChecks.ts` keeps is the list, the order and the arithmetic.
 */
export const setupCheckLabels: Readonly<Record<SetupCheck, string>> = Object.freeze({
  left: 'Walk left',
  right: 'Walk right',
  jump: 'Jump',
  dash: 'Dash',
  slashSide: 'Slash sideways',
  slashUp: 'Slash up',
  // Named for what it costs her, not for what it is: this is the only item that
  // cannot be done standing still, and that is the point of it.
  slashDown: 'Slash down — in the air',
});

/**
 * The practice floor, `#/lessons/setup/floor` — its own page since playtest 9.
 *
 * It was the bottom third of the Setup lesson, under two controller diagrams
 * and eight paragraphs of prose, which is a long way to scroll to find out
 * whether your buttons work.
 */
export const setupFloorCopy = {
  title: 'Try it out',
  lede: 'A floor and nothing else — nothing to fight, nothing to fall off, no clock. Move around until your controller feels like yours.',
  /**
   * Why the list is worth reading and not only ticking. Playtest 8 asked for
   * two things in one sentence — "make sure that all the core functionalities
   * work AND that she knows what she's supposed to be able to do" — and the
   * list is how one control does both.
   */
  kit: 'The list is the whole kit: everything the dojo will ever ask you to do is one of these seven.',

  canvasLabel: 'A practice floor with your Knight on it, and nothing else',

  /** Read out after each item, since the tick itself is a colour and a mark. */
  srDone: ' — done',
  srNotYet: ' — not yet',

  /**
   * The button next to every row, and the whole of playtest 9's second ask:
   * "It should say Jump and next it would be Remap, and it's not working."
   * A control that does not answer is fixed on the row it failed on, not two
   * pages away.
   */
  remap: 'Remap',
  remapLabel: (control: string): string => `Remap ${control}`,
  cancel: 'Cancel',
  cancelLabel: (control: string): string => `Stop remapping ${control}`,

  /**
   * The prompt while a capture is open. It says "or button" because the capture
   * listens to both hands at once — on this page the answer is whichever
   * control she reaches for, and her board is a gamepad whose button numbering
   * nobody has ever established.
   */
  pressPrompt: (control: string): string =>
    `Press the key or button you want for ${control}. Escape cancels.`,

  /**
   * An action with nothing bound to it at all, which the capture allows and
   * which is the most useful thing a row can say when a control does not answer.
   */
  unbound: 'nothing yet',

  /** Under the list. Counted down rather than up: what is left is the ask. */
  remaining: (left: number): string => `${left} still to try.`,
  allDone: 'That is all seven. Your controller does everything the dojo needs.',

  /**
   * The skip. Every gate on the road is skippable and this one is no different
   * — playtest 8 asked for "just a little hard gate" and in the same breath
   * "obviously, she can skip things if needed". Nothing ever traps her.
   */
  skip: 'Skip this and move on',
  skipped: 'Skipped. You can come back to the floor any time.',

  /**
   * She reached the floor without answering chapter 1's question. The sandbox
   * exists to prove ONE board, so there is nothing to prove yet.
   */
  needsControllerEyebrow: 'Not yet',
  needsControllerHeading: 'Pick a controller first',
  needsControllerLine:
    'The floor is here to prove the board you have chosen, so it needs you to have chosen one.',
  needsControllerBack: 'Back to Your Setup',
} as const;

/** What the Setup lesson says where the sandbox used to be. */
export const setupHandoffCopy = {
  heading: 'Now prove it',
  line: 'A bare floor, your Knight, and a list of the seven things your hands need to be able to do. Anything that does not answer, you can rebind right there on the line it failed on.',
  button: 'Try it out',
  where: 'Dirtmouth',
} as const;
