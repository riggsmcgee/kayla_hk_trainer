/**
 * React glue for the comfort toggles: state initialized from localStorage,
 * every change saved back through SettingsV1 (versioned, source of truth).
 */
import { useCallback, useState } from 'react';
import type { ComfortSettings } from '../engine/juice';
import { createLocalStore } from './local';

const store = createLocalStore();

export function useComfortSettings(): [ComfortSettings, (next: ComfortSettings) => void] {
  const [comfort, setComfort] = useState<ComfortSettings>(() => {
    const s = store.getSettings();
    return { reduceShake: s.reduceShake, reduceFlashing: s.reduceFlashing };
  });

  const update = useCallback((next: ComfortSettings) => {
    setComfort(next);
    const current = store.getSettings();
    store.saveSettings({ ...current, ...next });
  }, []);

  return [comfort, update];
}
