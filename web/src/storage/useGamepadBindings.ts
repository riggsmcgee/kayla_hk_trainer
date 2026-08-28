/**
 * React glue for gamepad bindings, mirroring useBindings for the keyboard:
 * read from localStorage, every change saved back through SettingsV1
 * (everything else in settings is kept). Saving the defaults removes the
 * override so a pristine settings blob stays pristine.
 *
 * Shared, for the same reason the keyboard's is — see `useBindings.ts`. The
 * pad's case is the sharper one: she can remap a face button on Settings and
 * the mounted canvas would go on polling the old one.
 */
import { useSyncExternalStore } from 'react';
import type { SettingsV1 } from '@dojo/shared';
import {
  DEFAULT_GAMEPAD_BINDINGS,
  gamepadBindingsFromSettings,
  gamepadBindingsToSettings,
  type GamepadBindings,
} from '../engine/gamepad';
import { createLocalStore } from './local';

const store = createLocalStore();

const DEFAULT_STORED = JSON.stringify(gamepadBindingsToSettings(DEFAULT_GAMEPAD_BINDINGS));

/** Null until first use, so a test can seed the store before anything reads it. */
let current: GamepadBindings | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable between changes, which is what `useSyncExternalStore` requires. */
function getSnapshot(): GamepadBindings {
  current ??= gamepadBindingsFromSettings(store.getSettings().gamepadBindings);
  return current;
}

/** Save a new set and tell every mounted hook, on this render. */
export function saveGamepadBindings(next: GamepadBindings): void {
  current = next;
  const stored = gamepadBindingsToSettings(next);
  const settings: SettingsV1 = { ...store.getSettings(), gamepadBindings: stored };
  if (JSON.stringify(stored) === DEFAULT_STORED) delete settings.gamepadBindings;
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
 * rendering does not change what `useGamepadBindings` returns. This is the seam that
 * makes that testable, and it is the seam a cross-tab `storage` listener would
 * use if the site ever grows one. Nothing in the app calls it today.
 */
export function reloadGamepadBindings(): void {
  current = null;
  for (const listener of listeners) listener();
}

/** Her pad bindings, and the one way to change them. */
export function useGamepadBindings(): [GamepadBindings, (next: GamepadBindings) => void] {
  const bindings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [bindings, saveGamepadBindings];
}
