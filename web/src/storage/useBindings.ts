/**
 * React glue for keyboard bindings: state initialized from localStorage,
 * every change saved back through SettingsV1 (the comfort flags and anything
 * else in settings are kept). Saving the defaults removes the override so a
 * pristine settings blob stays pristine.
 */
import { useCallback, useState } from 'react';
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

export function useBindings(): [Bindings, (next: Bindings) => void] {
  const [bindings, setBindings] = useState<Bindings>(() =>
    bindingsFromSettings(store.getSettings()),
  );

  const update = useCallback((next: Bindings) => {
    setBindings(next);
    const stored = bindingsToSettings(next);
    const settings: SettingsV1 = { ...store.getSettings(), inputBindings: stored };
    if (JSON.stringify(stored) === DEFAULT_STORED) delete settings.inputBindings;
    store.saveSettings(settings);
  }, []);

  return [bindings, update];
}
