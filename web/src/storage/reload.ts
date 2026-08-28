/**
 * Re-read every shared store from localStorage.
 *
 * Three module-level caches sit between localStorage and the page: the keyboard
 * bindings, the pad bindings, and the progress snapshot's version counter. Each
 * exists so `useSyncExternalStore` sees a stable snapshot between changes, and
 * each is why "write to localStorage, then render" does not do what it looks
 * like it does — the value a hook hands back was decided before the write.
 *
 * A test that wants to start from a particular save seeds localStorage and calls
 * this. It is also the one call a cross-tab `storage` listener would need, which
 * is the reason it is a named operation rather than three test-only escapes.
 */
import { reloadBindings } from './useBindings';
import { reloadGamepadBindings } from './useGamepadBindings';
import { notifyProgressChanged } from './useChapterProgress';

export function reloadStores(): void {
  reloadBindings();
  reloadGamepadBindings();
  notifyProgressChanged();
}
