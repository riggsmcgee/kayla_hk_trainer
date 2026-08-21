import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

/**
 * Default location of the *.sql migration files.
 *
 * Resolved relative to THIS module file so it works from both places this code
 * runs from:
 *   - dev/tests:  server/src/db/migrate.ts  -> ../../db/migrations -> server/db/migrations
 *   - built:      server/dist/db/migrate.js -> ../../db/migrations -> server/db/migrations
 */
const DEFAULT_MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../db/migrations',
);

/**
 * A tiny migration runner — the whole idea in three steps:
 *
 *  1. Make sure the bookkeeping table exists (schema_migrations: one row per
 *     migration file we have ever applied).
 *  2. Read db/migrations/*.sql in name order (001_..., 002_..., ...), skipping
 *     any file already recorded in schema_migrations.
 *  3. Apply each remaining file inside its own transaction, recording it in
 *     schema_migrations in that same transaction — so a migration either fully
 *     applies AND is recorded, or neither happens.
 *
 * @returns the file names applied during this call (empty array = up to date),
 *   mostly so callers and tests can log/assert what happened.
 */
export function migrate(
  db: Database.Database,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): string[] {
  // The runner owns this table; migration files never mention it.
  // IF NOT EXISTS makes the runner safe to call on every startup.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,                          -- the migration file name, e.g. '001_init.sql'
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))    -- when we applied it (UTC)
    );
  `);

  // Name order IS the migration order — that is why the files carry numeric
  // prefixes. sort() on the file names gives us 001 before 002 and so on.
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const alreadyApplied = new Set(
    (db.prepare('SELECT name FROM schema_migrations;').all() as { name: string }[]).map(
      (row) => row.name,
    ),
  );

  const recordMigration = db.prepare(
    // Plain INSERT (not INSERT OR IGNORE): if we ever try to record the same
    // migration twice, that is a bug we WANT to blow up loudly.
    'INSERT INTO schema_migrations (name) VALUES (?);',
  );

  // db.transaction() wraps the function in BEGIN/COMMIT and rolls back
  // automatically if it throws. One transaction per migration file: a broken
  // migration undoes itself completely, while earlier successful ones stay
  // applied and recorded. (Migration files must therefore not contain their
  // own BEGIN/COMMIT statements.)
  const applyOne = db.transaction((name: string, sql: string) => {
    db.exec(sql);
    recordMigration.run(name);
  });

  const appliedNow: string[] = [];
  for (const file of files) {
    if (alreadyApplied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    applyOne(file, sql);
    appliedNow.push(file);
  }

  return appliedNow;
}
