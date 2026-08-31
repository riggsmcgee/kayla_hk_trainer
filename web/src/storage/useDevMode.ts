/**
 * The developer's door, and the lock on it.
 *
 * PLAN §7 said from the start that the dev tools come out before the site is
 * sent. Deleting them was the plan; locking them is the better one. Everything
 * in that drawer is still needed by the person who built the place — a build
 * whose god mode has been cut is a build where the next bug in the boss fight
 * has to be reached by playing all the way to it — and a tool you have to
 * re-add to use is a tool you stop using.
 *
 * So the tools stay and the door shuts. Kayla will never find it: it opens on
 * ten keys she has no reason to type (`components/devUnlock.ts`), and until
 * they are typed the site has no dev tools in it at all. Not a greyed switch,
 * not a collapsed drawer, nothing.
 *
 * Locked is the DEFAULT, not merely the starting state, and that is the part
 * worth being careful about. Every dev knob reads through this hook: with the
 * door shut `useGodMode` reports off however the stored blob reads, and the
 * three picker hooks report the variants playtest 5 ratified. So "dev mode
 * off" is not a cleaner screen — it is, key for key, the game she will get.
 * On the day you ship, that is the only property that matters.
 *
 * Shared rather than copied, the pattern `useBindings` already uses: one
 * module-level value, a listener set, and `useSyncExternalStore`. It has to be
 * shared, because the sequence is typed on whatever page happens to be open
 * and that page's drawer has to appear under it — which per-component
 * `useState` with its own lazy read could never do.
 */
import { useSyncExternalStore } from 'react';
import type { SettingsV1 } from '@dojo/shared';
import { createLocalStore } from './local';

const store = createLocalStore();

/**
 * The one value every hook reads. Null until first use rather than read at
 * import time: a module that touches localStorage while it is being imported
 * is a module that cannot be tested against a seeded store.
 */
let current: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable between changes, which is what `useSyncExternalStore` requires. */
function getSnapshot(): boolean {
  current ??= store.getSettings().devMode === true;
  return current;
}

/**
 * Whether the door is open, for the one caller that is not a component — the
 * keydown handler in `DevUnlock`, which needs to know what it is toggling
 * without subscribing to it and re-installing its listener on every change.
 */
export function devModeEnabled(): boolean {
  return getSnapshot();
}

/**
 * Open or shut the door, and tell every mounted hook, on this render.
 *
 * Persisted, because the alternative is typing ten keys after every reload and
 * the point of the thing is to be able to sit in the shipped build for a while
 * and then step out of it. Shutting it DELETES the field rather than storing
 * `false`, so a settings blob that was never unlocked stays pristine — the
 * same rule `saveBindings` follows for a binding that is back at its default.
 */
export function setDevMode(next: boolean): void {
  current = next;
  const settings: SettingsV1 = { ...store.getSettings() };
  if (next) settings.devMode = true;
  else delete settings.devMode;
  store.saveSettings(settings);
  for (const listener of listeners) listener();
}

/**
 * Throw away the cached value and tell every mounted hook to read localStorage
 * again.
 *
 * The cache exists because `useSyncExternalStore` needs `getSnapshot` to return
 * the same value between changes, and the cost of that is a module-level value
 * outliving any component — which means seeding localStorage and then rendering
 * does not change what `useDevMode` returns, and a `localStorage.clear()`
 * between two jsdom tests does not shut a door the first of them opened.
 * `reloadStores()` calls this, which is what makes both of those recoverable.
 */
export function reloadDevMode(): void {
  current = null;
  for (const listener of listeners) listener();
}

/** Whether the dev tools are showing, and whether the dev knobs are live. */
export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
