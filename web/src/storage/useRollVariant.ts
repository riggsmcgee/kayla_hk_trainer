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
import { DEFAULT_ROLL_VARIANT, ROLL_VARIANTS } from '../engine/enemies';
import { createLocalStore } from './local';
import { useDevMode } from './useDevMode';

const store = createLocalStore();

/**
 * Clamp anything a stale or hand-edited settings blob might hold.
 *
 * An unset or out-of-range value means the RATIFIED roll, not index 0 — a
 * fresh browser must play what playtest 5 chose, not the first entry in a
 * list that only exists so the two can be compared.
 */
function clamp(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : DEFAULT_ROLL_VARIANT;
  return n >= 0 && n < ROLL_VARIANTS.length ? n : DEFAULT_ROLL_VARIANT;
}

/**
 * With the dev door shut this reports the RATIFIED roll whatever is stored,
 * which is the same value `clamp` gives a browser that has never held the
 * setting. That is deliberate and it is the point of the lock: the developer's
 * own browser is the one place a comparison pick can still be sitting, so
 * without this, "I turned the dev tools off to see what Kayla gets" would show
 * a fight rolling with whichever variant was last being tried. The pick is not
 * thrown away — it is in the blob, waiting for the next unlock.
 */
export function useRollVariant(): [number, (next: number) => void] {
  const devMode = useDevMode();
  const [variant, setVariant] = useState<number>(() => clamp(store.getSettings().rollVariant));

  const update = useCallback((next: number) => {
    const safe = clamp(next);
    setVariant(safe);
    store.saveSettings({ ...store.getSettings(), rollVariant: safe });
  }, []);

  return [devMode ? variant : DEFAULT_ROLL_VARIANT, update];
}
