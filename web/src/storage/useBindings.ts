/**
 * React glue for keyboard bindings: read from localStorage, every change
 * saved back through SettingsV1 (the comfort flags and anything else in
 * settings are kept). Saving the defaults removes the override so a pristine
 * settings blob stays pristine.
 *
 * This is a SHARED store, not per-component state, and that matters. Every
 * call site used to hold its own `useState` copy with its own lazy read, so a
 * rebind on Settings reached localStorage and nothing else — the next mount
 * picked it up and anything already on screen did not. There are three
 * consumers with three different lifetimes (a page's label strings, the
 * canvas's keyboard adapter, and the copy baked into a session), and note 3's
 * sandbox puts the remap controls on the same screen as a live Knight, where
 * "the rows update and the Knight does not" is the whole failure.
 *
 * The pattern is the one `useChapterProgress` already uses: one module-level
 * value, a listener set, and `useSyncExternalStore`.
 */
import { useSyncExternalStore } from 'react';
import type { SettingsV1 } from '@dojo/shared';
import {
  DEFAULT_BINDINGS,
  bindingsFromSettings,
  bindingsToSettings,
  type Bindings,
} from '../engine/input';
import { createLocalStore } from './local';

const store = createLocalStore();

const DEFAULT_STORED = JSON.stringify(bindingsToSettings(DEFAULT_BINDINGS));

/**
 * The one value every hook reads. Null until first use rather than read at
 * import time: a module that touches localStorage while it is being imported
 * is a module that cannot be tested against a seeded store.
 */
let current: Bindings | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable between changes, which is what `useSyncExternalStore` requires. */
function getSnapshot(): Bindings {
  current ??= bindingsFromSettings(store.getSettings());
  return current;
}

/** Save a new set and tell every mounted hook, on this render. */
export function saveBindings(next: Bindings): void {
  current = next;
  const stored = bindingsToSettings(next);
  const settings: SettingsV1 = { ...store.getSettings(), inputBindings: stored };
  if (JSON.stringify(stored) === DEFAULT_STORED) delete settings.inputBindings;
  store.saveSettings(settings);
  for (const listener of listeners) listener();
}

/**
 * Throw away the cached value and tell every mounted hook to read localStorage
 * again.
 *
 * The cache exists because `useSyncExternalStore` needs `getSnapshot` to
 * return the same object between changes, and the cost of that is a module-level
 * value that outlives any component — which means seeding localStorage and then
 * rendering does not change what `useBindings` returns. This is the seam that
 * makes that testable, and it is the seam a cross-tab `storage` listener would
 * use if the site ever grows one. Nothing in the app calls it today.
 */
export function reloadBindings(): void {
  current = null;
  for (const listener of listeners) listener();
}

/** Her keyboard bindings, and the one way to change them. */
export function useBindings(): [Bindings, (next: Bindings) => void] {
  const bindings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [bindings, saveBindings];
}
