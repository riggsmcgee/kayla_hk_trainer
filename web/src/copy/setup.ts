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
 * The two boards, named. Written out at four render sites before this — the two
 * choice buttons, the two card headings, and the answer — so a rename used to
 * be a four-place edit with three chances to miss one.
 */
export const controllerNameCopy = {
  joycon: 'Joy-Con',
  leverless: 'Leverless',
} as const;

/**
 * The Setup lesson, `#/lessons/setup`.
 *
 * What is here is the page's FURNITURE and its two single-slot paragraphs — the
 * lede and the thesis — plus the pro/con comparison, which is the one body list
 * on the page where every item is a markup-free sentence and is therefore
 * editable without half of it greying out. The four argument paragraphs stay in
 * the page and are shown read-only, per playtest 7.
 */
export const setupLessonCopy = {
  /** Three fragments: the middle one is bold, so the spaces travel in the strings. */
  ledeLead: 'Kayla, this one decides everything after it: ',
  ledeStrong: 'pick one controller and stick with it.',
  ledeTail:
    ` If you switch between controllers every couple of times you play, you'll just bounce off the game every time.`,

  howToChoose: 'How to choose',
  thesis:
    'Both can beat the whole game. Neither is faster. The only thing that matters is muscle memory, and it only builds on one layout — so choose tonight, and don’t touch the other until the credits roll.',

  /**
   * The buying argument, one entry per bullet.
   *
   * A comparison table wearing two lists: the tone is already data (`pro`,
   * `con`, `tip` are class names), and this is the most likely thing on the
   * page to be reworded. Every item is one markup-free sentence, which is what
   * makes it safe to offer as text boxes when the page's other lists are not.
   */
  joyConPoints: [
    { tone: 'pro', text: 'Super convenient: works handheld, docked, anywhere.' },
    {
      tone: 'pro',
      text: 'Familiar controls that align with other games you play.',
    },
    { tone: 'con', text: 'One thumb controlling multiple buttons is slow.' },
    {
      tone: 'tip',
      text: 'The joystick / d-pad are not very consistent for pogos and up-slashes',
    },
  ],
  leverlessPoints: [
    { tone: 'pro', text: 'Down is exactly down, every time — the cleanest pogo input there is.' },
    {
      tone: 'pro',
      text: 'One finger per button. On a purely technical level, this was made exactly for Hollow Knight.',
    },
    {
      tone: 'con',
      text: `It's not as convenient. You either have to be in dock mode or use a special adapter to play. Plus, you might have to play around with button mapping.`,
    },
    {
      tone: 'con',
      text: `There will be a larger hurdle to learn the muscle memory over the Joy-Con that you're more familiar and comfortable with.`,
    },
  ],
} as const;

/**
 * The controller question — the card at the foot of the lesson, and the only
 * interactive thing on the page.
 *
 * The heading used to be written once per branch of the same component, so
 * changing it meant changing it twice or shipping a card whose title moved when
 * she pressed a button.
 */
export const controllerQuestionCopy = {
  heading: 'Which controller will you use?',
  /** Follows the board's name in bold: "Leverless it is. Stick with it." */
  answerTail: ' it is. Stick with it.',
  /**
   * The quiet way to change the answer. Its accessible name says WHAT changes,
   * because "change" alone tells a screen-reader user nothing about which of
   * the page's controls they have landed on.
   */
  change: 'change',
  changeLabel: 'change which controller you use',

  /**
   * PRESET, THEN OFFER. The preset has already happened by the time this
   * renders; this is the offer, and it is a real one — the preset is a guess
   * about which INDEX each button reports on, and only her board can settle it.
   *
   * Fragments, because three button names are bold and a link closes the
   * sentence. Every space travels inside a string: the page used to hold them
   * in `{' '}` expressions, and JSX drops a line that is only whitespace.
   */
  offerLead: 'Your buttons are set up for it already: ',
  offerBinding: (action: string, button: string): string => `${action} ${button}`,

  /**
   * The three action names IN THIS SENTENCE, and the reason they are not
   * `actionLabelCopy`: that table titles a row on the bench and is capitalised
   * for it. Here the names sit mid-sentence in running prose, where "jump"
   * reads and "Jump" does not. Two voices for the same seven words is a real
   * distinction, not a duplication to be tidied away.
   */
  offerActions: { jump: 'jump', attack: 'attack', dash: 'dash' },
  offerLeverless: 'Attack is off jump’s finger, so you can hold both.',
  offerJoyCon: 'The shape Hollow Knight ships in.',
  offerTeachLead: ' If your board presses back differently, teach it yours in ',
  offerTeachLink: 'Settings',
  offerTeachTail: ' — four buttons, once.',

  /** An action can legally have nothing bound to it; the sentence has to survive it. */
  unbound: 'nothing yet',
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
 * The words drawn ON the two controller diagrams — the letters printed on the
 * buttons, and the callouts that say what each one does.
 *
 * THESE DELIBERATELY DO NOT SHARE `actionLabelCopy`, and the reason is the
 * whole point of the diagrams. That table names an action she can rebind, and
 * every screen that prints it must follow her when she does. These describe the
 * board AS IT COMES OUT OF THE BOX — "B — jump", "Y — attack" — which is a fact
 * about the hardware in her hands and must NOT change when she remaps. The two
 * tables read alike and mean opposite things, and merging them would make the
 * diagram lie the moment she took the site's own advice.
 *
 * The letters are the letters silkscreened on the plastic. They are not
 * positions, and they are the one place on the site allowed to say a letter.
 */
export const diagramCopy = {
  /** The Joy-Con's right-hand diamond, as printed. */
  joyConX: 'X',
  joyConA: 'A',
  joyConB: 'B',
  joyConY: 'Y',
  joyConJump: 'B — jump',
  joyConAttack: 'Y — attack',
  joyConDash: 'ZR — dash',
  joyConStick: 'stick — move · hold ↓ + attack = pogo',
  joyConDownButton: '↓ button — a more reliable down',

  /** The leverless's left hand: three fingers and a thumb. */
  leverlessLeft: '←',
  leverlessDown: '↓',
  leverlessRight: '→',
  leverlessUp: '↑',
  leverlessPogoFinger: 'middle finger holds ↓ for pogo',
  leverlessAttack: 'Y — attack',
  /** The clash the whole controller preset exists to move. */
  leverlessJump: 'B — jump · same finger as Y, so remap one',
  leverlessDash: 'ZR — dash',
} as const;

/**
 * The practice floor, `#/lessons/setup/floor` — its own page since playtest 9.
 *
 * It was the bottom third of the Setup lesson, under two controller diagrams
 * and eight paragraphs of prose, which is a long way to scroll to find out
 * whether your buttons work.
 */
export const setupFloorCopy = {
  title: 'Try it out',
  lede: 'Move around and make changes until your controller feels like yours.',
  /**
   * Why the list is worth reading and not only ticking. Playtest 8 asked for
   * two things in one sentence — "make sure that all the core functionalities
   * work AND that she knows what she's supposed to be able to do" — and the
   * list is how one control does both.
   */
  kit: 'The list is the whole kit. Tool progression will be saved for the full game.',

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
  cancel: 'Cancel',

  /**
   * Nine Remap buttons on one page, all reading "Remap", so the accessible name
   * is the only thing telling them apart — and it has to name the ROW, not the
   * control. Attack appears on all three nail rows, so naming by control alone
   * gave three buttons called "Remap Attack" and a screen-reader user listing
   * the page's controls no way to know which slash they had landed on.
   *
   * A row that needs one control is named by the row; a row that needs two names
   * both, because there the control is the thing being chosen between. The name
   * starts with the visible word either way, per WCAG label-in-name.
   */
  remapLabel: (row: string): string => `Remap ${row}`,
  remapControlLabel: (control: string, row: string): string => `Remap ${control} for ${row}`,
  /** Starts with the visible word, like every other name on the page. */
  cancelLabel: (control: string): string => `Cancel remapping ${control}`,

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
  heading: `Let's make sure your controller is working.`,
  // The button names the page it opens, so it reads the page's own title
  // rather than repeating it — two copies of "Try it out" can drift.
  line: `The next room will give you a chance to test your controller and change any buttons that aren't in the correct place.`,
  button: setupFloorCopy.title,
  where: 'Dirtmouth',
} as const;
