/**
 * Keyboard focus around the game canvas. The engine's keyboard adapter
 * (engine/input.ts) hands any game key to a focused button or link, so a
 * chip she clicked with the mouse must not keep the focus — or her next
 * arrow / Z goes to the chip, not the Knight, until she clicks elsewhere.
 */
import type { MouseEvent } from 'react';

/**
 * The id <main> carries. ScrollToTop moves focus here on a route change so a
 * keyboard or screen-reader user starts at the new page's content rather than
 * at the top of the site nav.
 */
export const MAIN_ID = 'main';

/**
 * Drop focus from a button activated by a pointer (e.detail > 0 — mouse or
 * touch). Keyboard activation (Enter/Space, detail 0) keeps the focus, so a
 * keyboard user is never stranded; when the pick changes the selection the
 * remounted canvas takes the focus anyway (PracticeCanvas).
 */
export function blurOnPointerClick(e: MouseEvent<HTMLElement>): void {
  if (e.detail > 0) e.currentTarget.blur();
}
