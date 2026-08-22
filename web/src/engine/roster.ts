/**
 * The dojo's progression numbers, in one place — the Dodge Arena roster in
 * teaching order, the stage rule, the course's level count, and the finale's
 * shape. Pages, gates, bests and the map all read from here so they can
 * never disagree (playtest 2, notes 1, 3 and 5).
 */
import type { EnemyId } from '@dojo/shared';

export interface RosterEntry {
  id: EnemyId;
  /** The in-world name Kayla sees. */
  name: string;
  /** Clean nail hits required (alongside surviving the stage) to pass. */
  hitsToPass: number;
}

/**
 * Teaching order: two dummies to learn the nail on, then the three attackers.
 * "Hit them more than they hit you" — 5 on the dummies, 3 on the attackers.
 */
export const ROSTER: readonly RosterEntry[] = [
  { id: 'walker', name: 'Walker', hitsToPass: 5 },
  { id: 'flier', name: 'Flier', hitsToPass: 5 },
  { id: 'duelist', name: 'Duelist', hitsToPass: 3 },
  { id: 'spitter', name: 'Spitter', hitsToPass: 3 },
  { id: 'warden', name: 'Warden', hitsToPass: 3 },
];

export function rosterEntry(id: EnemyId): RosterEntry {
  const found = ROSTER.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown enemy: ${id}`);
  return found;
}

/** Every stage — arena enemy or finale wave — is survived for this long. One number. */
export const STAGE_SURVIVE_SECONDS = 60;

/** Bounce Bog levels (1..COURSE_LEVEL_COUNT). Level 1 is the original course. */
export const COURSE_LEVEL_COUNT = 3;

/** The finale's "put it all together" pogo level. */
export const FINALE_LEVEL = 4;

/** Finale arena waves (1..FINALE_WAVE_COUNT). */
export const FINALE_WAVE_COUNT = 3;

/** Who shows up in each finale wave, index 0 = wave 1. */
export const FINALE_WAVES: readonly (readonly EnemyId[])[] = [
  ['walker', 'flier'],
  ['duelist', 'spitter'],
  ['spitter', 'warden'],
];
