import { describe, expect, it } from 'vitest';
import type { PracticeRun } from '@dojo/shared';
import { openDatabase } from './connection.js';
import { migrate } from './migrate.js';
import { insertRun, listRuns } from '../routes/runs.js';

// ':memory:' gives every test its own throwaway database living entirely in
// RAM — no files to clean up, no state leaking between runs, and the exact
// same migration SQL the real server applies to server/data/dojo.db.
describe('database smoke test (:memory:)', () => {
  it('migrates, inserts a run, and reads it back newest-first', () => {
    const db = openDatabase(':memory:');

    // Fresh database: the runner should apply our one migration...
    expect(migrate(db)).toEqual(['001_init.sql']);
    // ...and a second call should find nothing left to do (idempotent).
    expect(migrate(db)).toEqual([]);

    const dodgeRun: PracticeRun = {
      id: 'run-dodge-1',
      mode: 'dodge',
      enemyId: 'duelist',
      observeMode: true,
      hitsLanded: 0,
      durationMs: 42_000,
      startedAt: '2026-08-21T10:00:00.000Z',
    };
    const pogoRun: PracticeRun = {
      id: 'run-pogo-1',
      mode: 'pogo',
      hitsLanded: 12,
      durationMs: 90_000,
      startedAt: '2026-08-21T11:30:00.000Z', // later than the dodge run
    };

    insertRun(db, dodgeRun);
    insertRun(db, pogoRun);

    const runs = listRuns(db, 50);

    // Newest first: the pogo run started later, so it comes back on top.
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual(pogoRun);
    expect(runs[1]).toEqual(dodgeRun);

    // LIMIT is honored.
    expect(listRuns(db, 1)).toEqual([pogoRun]);

    db.close();
  });
});
