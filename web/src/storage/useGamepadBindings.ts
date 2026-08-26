/**
 * React glue for gamepad bindings, mirroring useBindings for the keyboard:
 * state initialized from localStorage, every change saved back through
 * SettingsV1 (everything else in settings is kept). Saving the defaults
 * removes the override so a pristine settings blob stays pristine.
 */
import { useCallback, useState } from 'react';
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

export function useGamepadBindings(): [GamepadBindings, (next: GamepadBindings) => void] {
  const [bindings, setBindings] = useState<GamepadBindings>(() =>
    gamepadBindingsFromSettings(store.getSettings().gamepadBindings),
  );

  const update = useCallback((next: GamepadBindings) => {
    setBindings(next);
    const stored = gamepadBindingsToSettings(next);
    const settings: SettingsV1 = { ...store.getSettings(), gamepadBindings: stored };
    if (JSON.stringify(stored) === DEFAULT_STORED) delete settings.gamepadBindings;
    store.saveSettings(settings);
  }, []);

  return [bindings, update];
}
