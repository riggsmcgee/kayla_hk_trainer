/**
 * What the in-canvas overlays call the two controls they talk about.
 *
 * Every "press X to continue" prompt in the dojo reads from here, and it says
 * the same two words whatever she is holding.
 *
 * Playtest 10, in his words: _"Attaching the retry or move forward button to
 * buttons on the controller just ends up working very strangely with how
 * leverless controllers work and how their buttons are labeled. Instead of
 * doing that, let's just simply make it easy across the board: jump to
 * continue or attack to retry."_
 *
 * The binding itself does not change — `jump = forward, attack = again` is
 * ratified and still true. What changed is that the prompt names the action
 * rather than resolving it to a key or a pad position. `storage/keyNames.ts`
 * still names real inputs for the CAPTION under each canvas, which is a
 * reference card and needs the specifics.
 *
 * Capitalised, because in "Press Jump to continue" the word is the name of a
 * control and not a verb — the same reason `copy/settings.ts` capitalises the
 * rows it labels. Deliberately its own table rather than a borrow from
 * `actionLabelCopy`: playtest 9 ratified that an extraction which rewords is
 * not an extraction, and these two words answer to the overlays, not to the
 * Settings page.
 */
export const controlNameCopy = {
  /** Forward: the next level, the next enemy, the next stop. */
  jump: 'Jump',
  /** Again: retry the thing that just ended. */
  attack: 'Attack',
} as const;
