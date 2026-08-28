/**
 * The bench — every word on `#/settings`, and the two comfort toggles the page
 * borrows from `components/ComfortToggles.tsx`.
 *
 * The seventh module of the copy extraction (playtest 8, note 4). Same two
 * rules as the modules before it: everything exported and named, and anything
 * with a value in it is a function rather than a template with a placeholder.
 *
 * The dev drawer at the foot of the page keeps its literals, for the reason
 * given in `copy/play.ts`: PLAN §7 says it comes out in the final build, and
 * naming its words here would put them in front of the user in the site editor.
 * The ending section's two strings stay in `copy/theEnd.ts`, where the rest of
 * that screen's words already live.
 */

/**
 * What each action is called, everywhere on the page: in the row, in the button
 * that changes it, and in the line a screen reader hears while she is pressing.
 * One table, so a rename cannot leave three of the four disagreeing.
 */
export const actionLabelCopy = {
  left: 'Move left',
  right: 'Move right',
  up: 'Up',
  down: 'Down',
  jump: 'Jump',
  attack: 'Attack',
  dash: 'Dash',
} as const;

export const settingsCopy = {
  eyebrow: 'The bench',
  title: 'Settings',
  lede: 'Your keys, your comfort, your clean slate, Kayla.',

  controlsHeading: 'Controls',
  /** In the row that is currently listening. The ellipsis is one character. */
  keyPrompt: 'press a key… (Esc cancels)',
  /** An action she has unbound entirely — honest rather than blank. */
  noKey: 'no key',
  /**
   * The change buttons say "Change" and there are seven of them, so each needs
   * an accessible name that says WHICH key it changes. It starts with the
   * visible word, which is WCAG's "label in name".
   */
  changeKey: (action: string): string => `Change key for ${action}`,
  cancelChangeKey: (action: string): string => `Cancel changing key for ${action}`,
  /** Announced while a key capture is open; Escape is the way out. */
  keyCaptureStatus: (action: string): string => `Press a key for ${action}. Escape cancels.`,

  controllerHeading: 'Controller',
  buttonPrompt: 'press a button…',
  noButton: 'no button',
  changeButton: (action: string): string => `Change button for ${action}`,
  cancelChangeButton: (action: string): string => `Cancel changing button for ${action}`,
  buttonCaptureStatus: (action: string): string => `Press a button for ${action}.`,

  /**
   * Why an empty controller list is not a bug. Three fragments because the
   * instruction in the middle is bold: the spaces travel inside the strings,
   * since JSX drops whitespace-only lines.
   */
  noPadLead: 'No controller yet. Plug it in and ',
  noPadStrong: 'press any button on it',
  noPadTail:
    ' — browsers keep a controller hidden until you do, so pressing a button is what wakes it up.',

  /** Appended to a pad the browser could not fit to the standard layout. */
  padNonStandard:
    '— your browser could not match this to a standard layout, so the buttons below may sit in odd places. Re-map the ones that are wrong.',

  /**
   * Both reset buttons read "Reset to defaults", so listing the page's buttons
   * — how a screen reader is usually driven — needed a way to tell them apart.
   */
  reset: 'Reset to defaults',
  resetKeyboardLabel: 'Reset to defaults for keyboard controls',
  resetControllerLabel: 'Reset to defaults for controller buttons',
  cancel: 'Cancel',
  change: 'Change',

  /**
   * The ratified rule the whole gamepad feature rests on, said once to her.
   * Two fragments around the italicised phrase, spaces inside the strings.
   */
  padNoteLead: 'Buttons are named by ',
  padNoteEm: 'where they are',
  padNoteTail:
    ', not by the letter printed on them — every controller disagrees about the letters, and none of them disagree about the positions. The keyboard keeps working the whole time; the controller is an extra pair of hands, not a replacement.',

  comfortHeading: 'Comfort',
  endingHeading: 'The ending',

  progressHeading: 'Progress',
  resetProgress: 'Reset my progress',
  /** The one destructive thing on the site, so it asks first. */
  resetConfirm: 'This clears every cleared level, enemy and run. Sure?',
  resetYes: 'Yes',
  resetNo: 'No',
  /** Announced after the fact, naming where the map now starts. */
  resetDone: 'Cleared. The map starts at Dirtmouth again.',
} as const;

/** The two comfort toggles (`components/ComfortToggles.tsx`), used by the section above. */
export const comfortCopy = {
  label: 'Comfort settings',
  reduceShake: 'Reduce screen shake',
  reduceFlashing: 'Reduce flashing',
} as const;
