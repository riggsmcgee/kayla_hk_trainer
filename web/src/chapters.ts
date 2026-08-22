/**
 * The dojo's chapters, in teaching order — the ONE list the map, the
 * chapter strip, and the routes all draw from, so they can never disagree.
 *
 * Order is ratified in PLAN.md §6 (Session 5): Setup first, because it
 * decides how Kayla practices everything after it; then the two skill
 * lessons; then the two mini-games that drill them. Each stop borrows a
 * Hallownest place name as a riff — it's her dojo, not a walkthrough.
 */

export type ChapterId = 'setup' | 'pogo' | 'reading-enemies' | 'pogo-course' | 'dodge-arena';

export type ChapterKind = 'lesson' | 'mini-game';

export interface Chapter {
  id: ChapterId;
  kind: ChapterKind;
  /** Where it sits on the map — a Hallownest riff. */
  place: string;
  /** The chapter's real name. */
  title: string;
  route: string;
  /** One line, to Kayla. The only copy the map shows. */
  line: string;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'setup',
    kind: 'lesson',
    place: 'Dirtmouth',
    title: 'Your Setup',
    route: '/lessons/setup',
    line: 'Sit on the bench, pick one controller, keep it.',
  },
  {
    id: 'pogo',
    kind: 'lesson',
    place: 'The Crossroads',
    title: 'Pogo',
    route: '/lessons/pogo',
    line: 'The downslash bounce — your biggest unlock.',
  },
  {
    id: 'reading-enemies',
    kind: 'lesson',
    place: 'Greenpath',
    title: 'Reading Enemies',
    route: '/lessons/reading-enemies',
    line: 'Watch first. Dodge everything. Then take it apart.',
  },
  {
    id: 'pogo-course',
    kind: 'mini-game',
    place: 'The Bounce Bog',
    title: 'Pogo Course',
    route: '/play/pogo',
    line: 'Bounce your way across the spikes.',
  },
  {
    id: 'dodge-arena',
    kind: 'mini-game',
    place: 'Kbug’s Colosseum',
    title: 'Dodge Arena',
    route: '/play/dodge',
    line: 'One enemy. Don’t get hit. Land clean hits.',
  },
];

export function chapterById(id: ChapterId): Chapter {
  const found = CHAPTERS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown chapter: ${id}`);
  return found;
}

/** The chapter after this one in teaching order, or null at the end. */
export function nextChapter(id: ChapterId): Chapter | null {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1]! : null;
}

export function prevChapter(id: ChapterId): Chapter | null {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i > 0 ? CHAPTERS[i - 1]! : null;
}

/**
 * Map progress. `next` is the first stop not yet lit — the one to play, where
 * the Knight stands and the ring pulses ("start where the Knight is standing"
 * stays literally true). `reached` counts contiguous lit stops from the
 * start, so a header click straight into the arena doesn't walk the road
 * past chapters she skipped. With no data: the Knight stands at Dirtmouth.
 */
export function mapProgress(lit: ReadonlySet<ChapterId>): {
  next: Chapter | null;
  /** Number of consecutive lit stops from the first; the legs up to here are walked. */
  reached: number;
} {
  let reached = 0;
  for (const c of CHAPTERS) {
    if (!lit.has(c.id)) break;
    reached += 1;
  }
  const next = CHAPTERS[reached] ?? null;
  return { next, reached };
}
