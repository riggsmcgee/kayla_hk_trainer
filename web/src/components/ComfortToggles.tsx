/**
 * The two comfort settings (M6): reduce screen shake and reduce flashing.
 * Persisted in SettingsV1 via localStorage so they stick across visits.
 */
import type { ComfortSettings } from '../engine/juice';

interface ComfortTogglesProps {
  value: ComfortSettings;
  onChange(next: ComfortSettings): void;
}

export function ComfortToggles({ value, onChange }: ComfortTogglesProps) {
  return (
    <div className="btn-row" role="group" aria-label="Comfort settings">
      <label className="observe-toggle">
        <input
          type="checkbox"
          checked={value.reduceShake}
          onChange={(e) => onChange({ ...value, reduceShake: e.target.checked })}
        />
        Reduce screen shake
      </label>
      <label className="observe-toggle">
        <input
          type="checkbox"
          checked={value.reduceFlashing}
          onChange={(e) => onChange({ ...value, reduceFlashing: e.target.checked })}
        />
        Reduce flashing
      </label>
    </div>
  );
}
