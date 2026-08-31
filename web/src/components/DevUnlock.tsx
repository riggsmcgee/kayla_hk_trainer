/**
 * The listener on the developer's door; `unlockSequence.ts` holds the keys and
 * the rule for matching them. Mounted once, in `App`, above the shell — the
 * sequence has to work on whatever page happens to be open, and the drawer it
 * reveals has to appear under it on that same page, which is what makes
 * `useDevMode` a shared store rather than component state.
 *
 * Its words are literals rather than entries in `copy/`, for the reason
 * `copy/settings.ts` gives about the drawer itself: these are strings the site
 * is built so that Kayla never sees, and naming them in the module that feeds
 * the copy editor would put them in front of the one person who is meant not
 * to read them.
 */
import { useEffect, useState } from 'react';
import { devModeEnabled, setDevMode } from '../storage/useDevMode';
import { advance, isComplete } from './unlockSequence';

/** How long the confirmation stays up. Long enough to read, short enough to leave. */
const FLASH_MS = 3200;

export function DevUnlock() {
  const [flash, setFlash] = useState('');

  useEffect(() => {
    /**
     * How much of the sequence stands matched. A local rather than a ref
     * because this effect runs exactly once — the handler reads the door's
     * state through `devModeEnabled()` instead of subscribing to it, so there
     * is nothing here for a dependency to change.
     */
    let matched = 0;

    function onKeyDown(event: KeyboardEvent): void {
      // A held key repeats, and eight of the ten are movement keys she holds
      // for seconds at a time. Only the first press of each counts.
      if (event.repeat) return;
      // Never while she is typing into something. Nothing on the site takes
      // free text today; this costs one line and survives the day something does.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      matched = advance(matched, event.code);
      if (!isComplete(matched)) return;

      matched = 0;
      const next = !devModeEnabled();
      setDevMode(next);
      setFlash(
        next
          ? 'Dev tools unlocked — the drawer is at the foot of Settings.'
          : 'Dev tools hidden. God mode is off and the pickers are back to the shipped ones.',
      );
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(''), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  /*
   * Always rendered, and collapsed to nothing while it is empty (styles.css
   * does that with `:empty`, the same way `.settings-done` does), so the live
   * region exists before its text arrives and the announcement is reliable.
   */
  return (
    <p className="dev-flash" role="status">
      {flash}
    </p>
  );
}
