import { describe, expect, it } from 'vitest';
import { CHAPTERS, mapProgress, nextChapter, prevChapter } from './chapters';

describe('chapters', () => {
  it('teaches Setup first, then Pogo, then Reading Enemies, then the two mini-games', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      'setup',
      'pogo',
      'reading-enemies',
      'pogo-course',
      'dodge-arena',
    ]);
    expect(nextChapter('setup')?.id).toBe('pogo');
    expect(prevChapter('setup')).toBeNull();
    expect(nextChapter('dodge-arena')).toBeNull();
  });

  it('map progress is contiguous: a skipped chapter is where the Knight stands', () => {
    expect(mapProgress(new Set())).toEqual({ next: CHAPTERS[0], reached: 0 });
    expect(mapProgress(new Set(['setup', 'pogo']))).toEqual({ next: CHAPTERS[2], reached: 2 });
    // Jumped straight to the arena from the header: the road isn't walked past chapter 1.
    expect(mapProgress(new Set(['setup', 'dodge-arena']))).toEqual({
      next: CHAPTERS[1],
      reached: 1,
    });
    expect(mapProgress(new Set(CHAPTERS.map((c) => c.id)))).toEqual({ next: null, reached: 5 });
  });
});
