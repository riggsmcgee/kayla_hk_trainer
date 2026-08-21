/**
 * Canonical shared types for Kayla's Hollow Knight Dojo.
 *
 * This workspace is types-only: nothing here may have a runtime footprint.
 * Both @dojo/web and @dojo/server import these types; web must keep working
 * even if the (deliberately disposable) server is deleted, so these types are
 * the only contract between them.
 */

/** The two practice modes the dojo offers. */
export type PracticeMode = 'pogo' | 'dodge';

/**
 * Canonical enemy ids for the Dodge Arena roster.
 *
 * - `walker`  — Crawlid-like pacing dummy; contact damage only.
 * - `flier`   — Vengefly-like drifting dummy.
 * - `duelist` — Mantis-like reactive melee: lunge slash on ground approach,
 *               rising anti-air swipe if you jump in; punishable in recovery.
 * - `spitter` — Aspid-like ranged: wind-up then 3-shot fan; projectiles can be
 *               nail-poked to destroy them; punish by closing during recovery.
 * - `warden`  — shield/counter: blocks frontal and aerial hits, telegraphed
 *               riposte after blocking; only vulnerable in post-counter recovery.
 */
export type EnemyId = 'walker' | 'flier' | 'duelist' | 'spitter' | 'warden';

/**
 * One recorded practice session.
 *
 * Stored in versioned localStorage (the source of truth) and optionally
 * mirrored to the practice server, which may not exist.
 */
export interface PracticeRun {
  /** Unique id for this run (generated client-side). */
  id: string;
  /** Which practice mode the run took place in. */
  mode: PracticeMode;
  /** The enemy faced; only meaningful for 'dodge' runs. */
  enemyId?: EnemyId;
  /**
   * Dodge Arena observe mode: the nail does no damage and the score is
   * survival time, for pure dodge-first practice.
   */
  observeMode?: boolean;
  /** Nail hits landed during the run (0 in observe mode). */
  hitsLanded: number;
  /** Run length in milliseconds. */
  durationMs: number;
  /** When the run began, as an ISO 8601 timestamp string. */
  startedAt: string;
}

/**
 * User settings, version 1. The `version` literal tags the JSON stored in
 * localStorage so future shapes can migrate explicitly.
 */
export interface SettingsV1 {
  version: 1;
  /** Accessibility: tone down screen shake. */
  reduceShake: boolean;
  /** Accessibility: tone down flashing effects. */
  reduceFlashing: boolean;
  /**
   * Optional input rebinds (action name -> key/button code). Groundwork for
   * the later gamepad-binding milestone.
   */
  inputBindings?: Record<string, string>;
}
