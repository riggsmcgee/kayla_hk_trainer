/**
 * The two comfort settings (M6): reduce screen shake and reduce flashing.
 * Persisted in SettingsV1 via localStorage so they stick across visits.
 */
import { comfortCopy } from '../copy/settings';
import type { ComfortSettings } from '../engine/juice';

interface ComfortTogglesProps {
  value: ComfortSettings;
  onChange(next: ComfortSettings): void;
}

export function ComfortToggles({ value, onChange }: ComfortTogglesProps) {
  return (
    <div className="btn-row" role="group" aria-label={comfortCopy.label}>
      <label className="observe-toggle">
        <input
          type="checkbox"
          checked={value.reduceShake}
          onChange={(e) => onChange({ ...value, reduceShake: e.target.checked })}
        />
        {comfortCopy.reduceShake}
      </label>
      <label className="observe-toggle">
        <input
          type="checkbox"
          checked={value.reduceFlashing}
          onChange={(e) => onChange({ ...value, reduceFlashing: e.target.checked })}
        />
        {comfortCopy.reduceFlashing}
      </label>
    </div>
  );
}
