/**
 * Re-read every shared store from localStorage.
 *
 * Four module-level caches sit between localStorage and the page: the keyboard
 * bindings, the pad bindings, the progress snapshot's version counter, and
 * whether the dev door is open. Each exists so `useSyncExternalStore` sees a
 * stable snapshot between changes, and each is why "write to localStorage, then
 * render" does not do what it looks like it does — the value a hook hands back
 * was decided before the write.
 *
 * A test that wants to start from a particular save seeds localStorage and calls
 * this. It is also the one call a cross-tab `storage` listener would need, which
 * is the reason it is a named operation rather than four test-only escapes.
 *
 * The dev door is the entry here with teeth, and it was missed when the door was
 * added. A module-level cache outlives the `localStorage.clear()` that every
 * jsdom test runs before each case, so a suite where one test opens the door
 * leaves it open for every test after it in the same file — and that failure
 * points the wrong way, because an open door is the state where "Kayla can see
 * the dev tools" quietly passes.
 */
import { reloadBindings } from './useBindings';
import { reloadGamepadBindings } from './useGamepadBindings';
import { reloadDevMode } from './useDevMode';
import { notifyProgressChanged } from './useChapterProgress';

export function reloadStores(): void {
  reloadBindings();
  reloadGamepadBindings();
  reloadDevMode();
  notifyProgressChanged();
}
