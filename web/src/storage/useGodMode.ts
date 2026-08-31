/**
 * DEV TOOL, behind the locked door (`useDevMode`).
 *
 * React glue for the god-mode switch, alongside `useComfortSettings`. It is
 * deliberately NOT part of `ComfortSettings`: comfort is an accessibility
 * promise the game keeps, and this is a cheat the developer flips to reach a
 * part of the dojo without playing through it.
 *
 * Stored in the same versioned SettingsV1 blob, so it survives a reload — a
 * flag you have to re-tick every refresh is no use for testing.
 *
 * What it REPORTS is `stored && unlocked`, and the second half of that is the
 * one that matters on the day the site is sent. The stored flag is sticky by
 * design, so without the gate a browser that was left with god mode on would
 * quietly ship an unlosable game the instant the drawer stopped being visible
 * enough to notice. Locking the door is therefore not a change of appearance:
 * it turns the cheat off. The setter still writes the real value, so the
 * choice is waiting where it was left when the door opens again.
 */
import { useCallback, useState } from 'react';
import { createLocalStore } from './local';
import { useDevMode } from './useDevMode';

const store = createLocalStore();

export function useGodMode(): [boolean, (next: boolean) => void] {
  const devMode = useDevMode();
  const [godMode, setGodMode] = useState<boolean>(() => store.getSettings().godMode === true);

  const update = useCallback((next: boolean) => {
    setGodMode(next);
    store.saveSettings({ ...store.getSettings(), godMode: next });
  }, []);

  return [devMode && godMode, update];
}
