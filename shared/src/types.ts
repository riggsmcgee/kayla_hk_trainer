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
 * - `warden`  — shield/counter: the shield covers one side at a time (front,
 *               or overhead when the Knight is above) and re-aims with a lag;
 *               a blocked hit draws a telegraphed riposte, lingering in front
 *               draws a bash; recovery after either is open from every side.
 * - `bill` / `dog` — the boss pair at the bottom of the well. Invulnerable
 *               furniture: the nail bounces off them and nothing else happens.
 *
 * EnemyId is everything the enemy sim can be; ROSTER (engine/roster.ts) is the
 * five the Colosseum teaches, and stays five.
 */
export type EnemyId = 'walker' | 'flier' | 'duelist' | 'spitter' | 'warden' | 'bill' | 'dog';

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
  /**
   * DEV TOOL: remove in the final build. The run was played with god mode on,
   * so nothing could touch her. Recorded rather than dropped so the developer
   * can still see what happened, and filtered out of every personal best the
   * same way `observeMode` is — a run nothing could end is not a best.
   */
  godMode?: boolean;
  /**
   * The run was played with assist mode on, so she had lives to spend
   * whether or not she spent any.
   *
   * Recorded on AVAILABILITY rather than on use, deliberately: a run played
   * with a safety net is a run played with a safety net, and tagging on
   * "spent one" would make the flag flicker between two runs that were
   * attempted under identical conditions. Unlike `godMode` this does NOT
   * disqualify a run from the bests — it ranks below a clean one and says so
   * (playtest 10). Optional, so every run recorded before it existed reads
   * as unassisted.
   */
  assisted?: boolean;
  /** Nail hits landed during the run (0 in observe mode). */
  hitsLanded: number;
  /** Run length in milliseconds. */
  durationMs: number;
  /** When the run began, as an ISO 8601 timestamp string. */
  startedAt: string;
  /**
   * Pogo course level (1–4). Levels 1–3 are the Bounce Bog; 4 is the
   * finale's "put it all together" level. Runs recorded before levels
   * existed have no value and are read as level 1.
   */
  level?: number;
  /**
   * Finale arena wave (1–3). Only set on 'dodge' runs played in the finale's
   * wave mode; a plain Dodge Arena run (one enemy) leaves it unset.
   */
  wave?: number;
  /**
   * The Two Bills, at the bottom of the well. Set only on boss runs, and the
   * reason they carry no enemyId and no wave: those two fields are what
   * arenaBest and waveBest filter on, so a boss run can never be mistaken for
   * a Colosseum or a wave best.
   */
  boss?: boolean;
  /**
   * Did the run achieve its goal? Pogo: reached the goal flag. Dodge: the
   * stage was passed, which since playtest 10 means the full stage time was
   * survived — hits are a score and no longer a condition. Pogo runs recorded
   * before this field existed are read as cleared.
   */
  cleared?: boolean;
}

/** The one controller Kayla commits to in chapter 1 (Your Setup). */
export type ControllerChoice = 'joycon' | 'leverless';

/**
 * The seven things the Setup sandbox asks her to prove her controller can do.
 *
 * The whole player kit (PLAN §5) and nothing more: no double jump, no spells.
 * `slashDown` is the load-bearing one — the downslash is airborne-only, so
 * ticking it proves the compound mid-air press the pogo needs.
 */
export type SetupCheck = 'left' | 'right' | 'jump' | 'dash' | 'slashSide' | 'slashUp' | 'slashDown';

/**
 * Course progress, version 1 — what is DONE, as opposed to what was merely
 * opened (the visited list) or recorded (runs). Stored in localStorage under
 * its own key; the map, the gates and the chapter strip all derive from it.
 */
export interface ProgressV1 {
  version: 1;
  /** Her answer to "Which controller will you use?"; unset until answered. */
  controller?: ControllerChoice;
  /**
   * Sandbox checklist items she has performed at least once. Optional because
   * every save written before the sandbox existed has none, and an absent list
   * has to read as "none ticked" rather than as a broken blob.
   */
  setupChecks?: SetupCheck[];
  /**
   * True on any save written since the practice floor's gate shipped.
   *
   * It exists to tell two saves apart that are otherwise identical: one whose
   * sheet is half-filled because she is halfway through proving her controller,
   * and one whose sheet is half-filled because she used the sandbox back when it
   * proved nothing and chapter 1 was finished by answering one question. The
   * first must stay gated; the second must not lose a chapter it had already
   * finished. Absent means the second, and `readProgress` credits it with the
   * whole sheet.
   */
  setupGated?: boolean;
  /** Pogo course levels reached-the-goal at least once (1–3 in the Bounce Bog). */
  courseLevelsCleared: number[];
  /** Dodge Arena enemies whose stage has been passed (survived, start to finish). */
  arenaEnemiesCleared: EnemyId[];
  /** The finale's pogo level (level 4) reached-the-goal at least once. */
  finaleLevelCleared: boolean;
  /** Finale arena waves passed (1–3). */
  finaleWavesCleared: number[];
  /** The Two Bills survived to 1:30 at least once. */
  finaleBossCleared: boolean;
  /**
   * Things she chose to skip past rather than clear. Holds chapter ids
   * ('pogo-course') or sub-keys ('pogo-course:level:2', 'finale:wave:2').
   * A skipped thing counts as passed for unlocking what follows, but is
   * drawn as unfinished on the map.
   */
  skipped: string[];
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
  /**
   * Optional gamepad rebinds (action name -> comma-joined button indices, in
   * W3C standard-mapping order). Separate from `inputBindings` because the
   * two sources are live at the same time and neither replaces the other.
   */
  gamepadBindings?: Record<string, string>;
  /**
   * DEV TOOL: remove in the final build. God mode — nothing can touch her, but
   * every hit she WOULD have taken is still shown and counted. It exists so
   * the developer can reach and test any part of the dojo without playing
   * through it. Optional, so a settings blob written before it existed reads
   * as off.
   */
  godMode?: boolean;
  /**
   * Assist mode: how many extra hits she has given herself, 0-3. Zero is off,
   * which is the default and what a settings blob written before this existed
   * reads as.
   *
   * A shipping feature and not a dev tool, so it carries no "remove in the
   * final build" note. It lives in settings rather than progress because
   * `clearAllProgress()` deliberately keeps settings — resetting the map
   * should not silently turn her safety net off, nor re-ask the question
   * below.
   */
  assistLives?: number;
  /**
   * Whether she has already been asked "are you sure?" about assist mode.
   * The warning is worth making once; making it every time turns a considered
   * choice into something she clicks past.
   */
  assistConfirmed?: boolean;
  /**
   * DEV TOOL: remove in the final build. Which of the five roll behaviours
   * (engine/enemies.ts ROLL_VARIANTS) the Two Bills’ dog uses. Playtest 4
   * asked for five to try rather than one to accept; when the user has
   * picked, the winner becomes the only one and this goes. Optional, so a
   * blob written before it existed reads as the first variant.
   */
  rollVariant?: number;
  /**
   * DEV TOOL: remove in the final build. Which of Bill's three entrances
   * (engine/entrance.ts BILL_ENTRANCES) plays before the fight. Same reason
   * as `rollVariant`: playtest 4 ratified that artistic decisions ship as a
   * portfolio to choose from rather than as a pick.
   */
  entranceVariant?: number;
  /**
   * DEV TOOL: remove in the final build. Which of the dog's three hazard
   * looks (engine/dogLook.ts DOG_LOOKS) the ball and the bones wear. Same
   * portfolio rule as `rollVariant` and `entranceVariant`.
   */
  dogLook?: number;
  /**
   * Whether the dev tools above are reachable at all — the lock on the door
   * the six fields before this one sit behind.
   *
   * Absent (the only state a browser that has not been unlocked can be in)
   * means locked, and locked is not merely a tidier screen: every dev field
   * above reads as its shipped value while it holds, so the site behind a
   * shut door is exactly the site Kayla gets. `web/src/storage/useDevMode.ts`
   * has the whole argument, and `web/src/components/devUnlock.ts` holds the
   * ten keys that open it.
   *
   * Written only as `true`; shutting the door deletes the field rather than
   * storing `false`, so a settings blob that was never unlocked stays
   * pristine.
   */
  devMode?: boolean;
}
