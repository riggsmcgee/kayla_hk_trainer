/**
 * DEV TOOL: remove in the final build.
 *
 * React glue for the dog's hazard-look picker, alongside `useGodMode`,
 * `useRollVariant` and `useEntranceVariant`. Same portfolio rule, same
 * persistence, same fate: when the user has picked, the winner becomes the
 * only one and this comes out with the rest of the dev tools.
 */
import { useCallback, useState } from 'react';
import { DEFAULT_DOG_LOOK, DOG_LOOKS } from '../engine/dogLook';
import { createLocalStore } from './local';
import { useDevMode } from './useDevMode';

const store = createLocalStore();

/** Clamp anything a stale or hand-edited settings blob might hold. */
function clamp(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : DEFAULT_DOG_LOOK;
  return n >= 0 && n < DOG_LOOKS.length ? n : DEFAULT_DOG_LOOK;
}

/** Shut door, shipped look — the same rule `useRollVariant` explains. */
export function useDogLook(): [number, (next: number) => void] {
  const devMode = useDevMode();
  const [look, setLook] = useState<number>(() => clamp(store.getSettings().dogLook));

  const update = useCallback((next: number) => {
    const safe = clamp(next);
    setLook(safe);
    store.saveSettings({ ...store.getSettings(), dogLook: safe });
  }, []);

  return [devMode ? look : DEFAULT_DOG_LOOK, update];
}
