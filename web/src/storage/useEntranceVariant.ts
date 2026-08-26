/**
 * DEV TOOL: remove in the final build.
 *
 * React glue for Bill's entrance picker, alongside `useGodMode` and
 * `useRollVariant`.
 *
 * Playtest 4 ratified that every artistic decision this round ships as a
 * portfolio rather than a pick, so the three entrances live in the engine
 * (`BILL_ENTRANCES`) and this switches which one plays. Persisted in the
 * same SettingsV1 blob, because the whole point is to sit through each of
 * them a few times and the choice must survive a reload.
 *
 * When the user has picked, the winner becomes the only one and this file
 * and its setting come out with the rest of the dev tools.
 */
import { useCallback, useState } from 'react';
import { BILL_ENTRANCES } from '../engine/entrance';
import { createLocalStore } from './local';

const store = createLocalStore();

/** Clamp anything a stale or hand-edited settings blob might hold. */
function clamp(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : 0;
  return n >= 0 && n < BILL_ENTRANCES.length ? n : 0;
}

export function useEntranceVariant(): [number, (next: number) => void] {
  const [variant, setVariant] = useState<number>(() => clamp(store.getSettings().entranceVariant));

  const update = useCallback((next: number) => {
    const safe = clamp(next);
    setVariant(safe);
    store.saveSettings({ ...store.getSettings(), entranceVariant: safe });
  }, []);

  return [variant, update];
}
