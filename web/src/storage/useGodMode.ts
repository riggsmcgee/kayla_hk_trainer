/**
 * DEV TOOL: remove in the final build.
 *
 * React glue for the god-mode switch, alongside `useComfortSettings`. It is
 * deliberately NOT part of `ComfortSettings`: comfort is an accessibility
 * promise the game keeps, and this is a cheat the developer flips to reach a
 * part of the dojo without playing through it.
 *
 * Stored in the same versioned SettingsV1 blob, so it survives a reload — a
 * flag you have to re-tick every refresh is no use for testing.
 */
import { useCallback, useState } from 'react';
import { createLocalStore } from './local';

const store = createLocalStore();

export function useGodMode(): [boolean, (next: boolean) => void] {
  const [godMode, setGodMode] = useState<boolean>(() => store.getSettings().godMode === true);

  const update = useCallback((next: boolean) => {
    setGodMode(next);
    store.saveSettings({ ...store.getSettings(), godMode: next });
  }, []);

  return [godMode, update];
}
