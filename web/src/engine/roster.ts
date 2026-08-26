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

/** One enemy arriving mid-wave: who, and how many seconds in. */
export interface WaveJoin {
  /** Seconds of stage time survived before this one walks in. */
  at: number;
  id: EnemyId;
}

export interface FinaleWave {
  /** What the HUD calls it — "wave 1 of 2 — The pests". */
  name: string;
  /** Who is on screen when the wave opens. */
  enemies: readonly EnemyId[];
  /** Who arrives later. Ascending by `at`; the schedule reads it as a cursor. */
  reinforcements: readonly WaveJoin[];
}

/**
 * The finale's waves (playtest 4, note 3).
 *
 * Two waves, each opening with a pair and doubling to four at thirty
 * seconds. The hits required do NOT grow with the reinforcements — they are
 * summed from the OPENING cast alone, so four bodies is four targets and
 * landing hits gets easier. The thing that grew is the danger.
 */
export const FINALE_WAVES: readonly FinaleWave[] = [
  {
    name: 'The pests',
    enemies: ['walker', 'flier'],
    reinforcements: [
      { at: 30, id: 'walker' },
      { at: 30, id: 'flier' },
    ],
  },
  {
    name: 'The real ones',
    enemies: ['duelist', 'spitter'],
    /**
     * Playtest 5, note 5: "let's have the reinforcement spread be two
     * spitters, a duelist and a warden". That is the cast at 0:30 — the
     * opening pair plus these two — not four arrivals on top of the pair,
     * which would be six alive against an ARENA_MAX_ALIVE of 4 and would see
     * the runtime silently drop the last two while every test stayed green.
     */
    reinforcements: [
      { at: 30, id: 'spitter' },
      { at: 30, id: 'warden' },
    ],
  },
];

/**
 * Finale arena waves (1..FINALE_WAVE_COUNT). DERIVED, never written down —
 * this constant and FINALE_WAVES drifted apart once already (the count said
 * three while the waves said what they said), and a derived number cannot.
 */
export const FINALE_WAVE_COUNT = FINALE_WAVES.length;

/**
 * The most enemies the arena will ever hold at once. Every wave's opening
 * cast plus its reinforcements must fit inside it — pinned as a data
 * invariant in stages.test.ts, so a wave that outgrows the arena fails a
 * test rather than the frame budget.
 */
export const ARENA_MAX_ALIVE = 4;
