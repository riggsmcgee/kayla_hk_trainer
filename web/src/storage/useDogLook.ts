/**
 * DEV TOOL: remove in the final build.
 *
 * React glue for the dog's hazard-look picker, alongside `useGodMode`,
 * `useRollVariant` and `useEntranceVariant`. Same portfolio rule, same
 * persistence, same fate: when the user has picked, the winner becomes the
 * only one and this comes out with the rest of the dev tools.
 */
import { useCallback, useState } from 'react';
import { DOG_LOOKS } from '../engine/dogLook';
import { createLocalStore } from './local';

const store = createLocalStore();

/** Clamp anything a stale or hand-edited settings blob might hold. */
function clamp(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : 0;
  return n >= 0 && n < DOG_LOOKS.length ? n : 0;
}

export function useDogLook(): [number, (next: number) => void] {
  const [look, setLook] = useState<number>(() => clamp(store.getSettings().dogLook));

  const update = useCallback((next: number) => {
    const safe = clamp(next);
    setLook(safe);
    store.saveSettings({ ...store.getSettings(), dogLook: safe });
  }, []);

  return [look, update];
}
