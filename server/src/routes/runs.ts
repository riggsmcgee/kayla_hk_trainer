import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { EnemyId, PracticeMode, PracticeRun } from '@dojo/shared';

// @dojo/shared is types-only, so the runtime value lists live here. The
// `satisfies` clauses make TypeScript verify every id listed is a real one.
//
// ENEMY_IDS is deliberately a SUBSET of EnemyId: it is the five arena enemies
// a run can name. The boss pair ('bill', 'dog') are in the shared union
// because the enemy sim can be them, but a boss run carries no enemyId at all,
// so accepting one here would be accepting a shape the client never sends.
const MODES = ['pogo', 'dodge'] as const satisfies readonly PracticeMode[];
const ENEMY_IDS = [
  'walker',
  'flier',
  'duelist',
  'spitter',
  'warden',
] as const satisfies readonly EnemyId[];

/** How the runs table row looks in SQL land (snake_case, INTEGER booleans). */
interface RunRow {
  id: string;
  mode: PracticeMode;
  enemy_id: EnemyId | null;
  observe_mode: 0 | 1;
  hits_landed: number;
  duration_ms: number;
  started_at: string;
}

/** Translate a SQL row back into the shared camelCase PracticeRun shape. */
function rowToRun(row: RunRow): PracticeRun {
  const run: PracticeRun = {
    id: row.id,
    mode: row.mode,
    hitsLanded: row.hits_landed,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
  };
  // Optional fields: only present when they carry information, so the JSON the
  // API returns matches what the client originally sent.
  if (row.enemy_id !== null) run.enemyId = row.enemy_id;
  if (row.observe_mode === 1) run.observeMode = true;
  return run;
}

/**
 * INSERT one practice run.
 *
 * SQL practice notes:
 *  - The `?` placeholders are *bound parameters*. The values never get pasted
 *    into the SQL text — the driver hands them to SQLite separately, which is
 *    what makes SQL injection impossible here. NEVER build SQL with string
 *    concatenation of user input.
 *  - We list the columns explicitly instead of `INSERT INTO runs VALUES (...)`
 *    so the statement keeps working even if the table gains columns later.
 *  - db.prepare() compiles the statement; .run() executes it. A busier server
 *    would prepare once and reuse the statement object — better-sqlite3 makes
 *    preparation cheap enough that per-call clarity wins in a practice app.
 */
export function insertRun(db: Database.Database, run: PracticeRun): void {
  db.prepare(
    `INSERT INTO runs (id, mode, enemy_id, observe_mode, hits_landed, duration_ms, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
  ).run(
    run.id,
    run.mode,
    run.enemyId ?? null, // undefined -> SQL NULL ("no enemy for this run")
    run.observeMode ? 1 : 0, // boolean -> SQLite's INTEGER 0/1 convention
    run.hitsLanded,
    run.durationMs,
    run.startedAt,
  );
}

/**
 * SELECT the newest runs.
 *
 * SQL practice notes:
 *  - ORDER BY started_at DESC = newest first. ISO-8601 strings sort correctly
 *    as text, and idx_runs_started_at (see 001_init.sql) means SQLite can read
 *    rows straight off the index in that order — no sort step at all.
 *  - LIMIT is also a bound parameter. An API that returns "everything" grows
 *    slower forever; always cap list endpoints.
 */
export function listRuns(db: Database.Database, limit: number): PracticeRun[] {
  const rows = db
    .prepare(
      `SELECT id, mode, enemy_id, observe_mode, hits_landed, duration_ms, started_at
       FROM runs
       ORDER BY started_at DESC
       LIMIT ?;`,
    )
    .all(limit) as RunRow[];
  return rows.map(rowToRun);
}

/**
 * Validate an unknown request body against the shared PracticeRun shape.
 * Returns every problem found (not just the first) so a debugging session
 * fixes them all in one round trip.
 */
export function validatePracticeRun(
  body: unknown,
): { ok: true; run: PracticeRun } | { ok: false; errors: string[] } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.id !== 'string' || b.id.length === 0) {
    errors.push('id must be a non-empty string');
  }
  if (!MODES.includes(b.mode as PracticeMode)) {
    errors.push(`mode must be one of: ${MODES.join(', ')}`);
  }
  // Compared as plain strings: ENEMY_IDS is a narrower tuple than EnemyId, so
  // includes() would otherwise refuse to be handed the wider union.
  if (b.enemyId !== undefined && !(ENEMY_IDS as readonly string[]).includes(b.enemyId as string)) {
    errors.push(`enemyId, when present, must be one of: ${ENEMY_IDS.join(', ')}`);
  }
  if (b.observeMode !== undefined && typeof b.observeMode !== 'boolean') {
    errors.push('observeMode, when present, must be a boolean');
  }
  if (typeof b.hitsLanded !== 'number' || !Number.isInteger(b.hitsLanded) || b.hitsLanded < 0) {
    errors.push('hitsLanded must be a non-negative integer');
  }
  if (typeof b.durationMs !== 'number' || !Number.isInteger(b.durationMs) || b.durationMs < 0) {
    errors.push('durationMs must be a non-negative integer');
  }
  if (typeof b.startedAt !== 'string' || Number.isNaN(Date.parse(b.startedAt))) {
    errors.push('startedAt must be an ISO-8601 date string');
  }

  if (errors.length > 0) return { ok: false, errors };

  // Rebuild the object field by field instead of trusting the body wholesale —
  // this strips any extra properties a client might have tacked on.
  const run: PracticeRun = {
    id: b.id as string,
    mode: b.mode as PracticeMode,
    hitsLanded: b.hitsLanded as number,
    durationMs: b.durationMs as number,
    startedAt: b.startedAt as string,
  };
  if (b.enemyId !== undefined) run.enemyId = b.enemyId as EnemyId;
  if (b.observeMode !== undefined) run.observeMode = b.observeMode as boolean;
  return { ok: true, run };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Mounts as /api/runs in src/index.ts. */
export function createRunsRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/runs[?limit=N] — newest runs first, capped.
  router.get('/', (req, res) => {
    const raw = req.query.limit;
    const parsed = typeof raw === 'string' ? Number(raw) : NaN;
    const limit = Number.isInteger(parsed)
      ? Math.min(Math.max(parsed, 1), MAX_LIMIT) // clamp into [1, MAX_LIMIT]
      : DEFAULT_LIMIT;
    res.json(listRuns(db, limit));
  });

  // POST /api/runs — body is a PracticeRun (see @dojo/shared).
  router.post('/', (req, res) => {
    const result = validatePracticeRun(req.body);
    if (!result.ok) {
      res.status(400).json({ errors: result.errors });
      return;
    }
    try {
      insertRun(db, result.run);
    } catch (err) {
      // The PRIMARY KEY constraint firing means this id already exists. The
      // web client may retry syncs, so treat a duplicate as a conflict rather
      // than a server error.
      if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        res.status(409).json({ errors: [`run '${result.run.id}' already exists`] });
        return;
      }
      throw err; // anything else is a real bug — let Express turn it into a 500
    }
    res.status(201).json(result.run);
  });

  return router;
}
