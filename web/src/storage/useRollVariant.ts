/**
 * DEV TOOL: remove in the final build.
 *
 * React glue for the roll-behaviour picker, alongside `useGodMode`.
 *
 * It exists because playtest 4 asked for the dog's roll to be CHOSEN rather
 * than designed:
 *
 *   "I think this is a situation where I just need to try out five different
 *    examples and then go off that."
 *
 * A page of animations would have been the wrong portfolio for a behaviour —
 * a roll is something you find out about by being chased by it. So the five
 * live in the engine (`ROLL_VARIANTS`) and this switches which one the boss
 * fight rolls with, persisted in the same SettingsV1 blob so the choice
 * survives the reload between one attempt and the next.
 *
 * When the user has picked, the winner becomes the only one and this file
 * and its setting come out with the rest of the dev tools.
 */
import { useCallback, useState } from 'react';
import { ROLL_VARIANTS } from '../engine/enemies';
import { createLocalStore } from './local';

const store = createLocalStore();

/** Clamp anything a stale or hand-edited settings blob might hold. */
function clamp(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : 0;
  return n >= 0 && n < ROLL_VARIANTS.length ? n : 0;
}

export function useRollVariant(): [number, (next: number) => void] {
  const [variant, setVariant] = useState<number>(() => clamp(store.getSettings().rollVariant));

  const update = useCallback((next: number) => {
    const safe = clamp(next);
    setVariant(safe);
    store.saveSettings({ ...store.getSettings(), rollVariant: safe });
  }, []);

  return [variant, update];
}
