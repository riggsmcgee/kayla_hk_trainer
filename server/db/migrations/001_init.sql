-- 001_init.sql — first migration for the Dojo practice server.
--
-- HOW THIS FILE RUNS: src/db/migrate.ts reads every db/migrations/*.sql file in
-- name order, skips the ones already recorded in the schema_migrations table,
-- and applies each remaining file inside its own transaction. The
-- schema_migrations bookkeeping table itself is created by the runner, NOT
-- here — migrations stay pure "what does the app's schema look like".

-- The runs table mirrors the shared PracticeRun type (see @dojo/shared):
--   PracticeRun { id, mode, enemyId?, observeMode?, hitsLanded, durationMs, startedAt }
-- SQL convention is snake_case column names; the Express route layer translates
-- to/from the camelCase JSON shape.
CREATE TABLE runs (
    -- The client generates the id (a UUID string). Declaring it TEXT PRIMARY KEY
    -- gives us uniqueness enforcement AND a fast lookup index in one go.
    id TEXT PRIMARY KEY,

    -- A CHECK constraint is the database refusing bad data even if application
    -- validation has a bug. Two practice modes exist, so only two values pass.
    mode TEXT NOT NULL CHECK (mode IN ('pogo', 'dodge')),

    -- NULL means "no enemy involved" (e.g. a pogo-course run). SQLite quirk
    -- worth knowing: when enemy_id is NULL this CHECK evaluates to NULL, and a
    -- NULL check result counts as passing — so the constraint only rejects
    -- actual garbage strings, never the absence of a value.
    enemy_id TEXT CHECK (enemy_id IN ('walker', 'flier', 'duelist', 'spitter', 'warden')),

    -- SQLite has no BOOLEAN type; the universal convention is INTEGER 0/1.
    observe_mode INTEGER NOT NULL DEFAULT 0 CHECK (observe_mode IN (0, 1)),

    -- Score counters. ">= 0" because a negative count is always a bug upstream.
    hits_landed INTEGER NOT NULL CHECK (hits_landed >= 0),
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),

    -- ISO-8601 UTC timestamp string, e.g. '2026-08-21T18:30:00.000Z'.
    -- Storing timestamps as ISO text is idiomatic SQLite: ISO-8601 sorts
    -- correctly as plain text, which is exactly what the index below exploits.
    started_at TEXT NOT NULL
);

-- GET /api/runs always asks the same question: "newest runs first, limited".
-- This index lets SQLite walk the rows already in started_at order instead of
-- loading and sorting the whole table on every request. Rule of thumb: index
-- the columns your ORDER BY / WHERE clauses actually use — no more, no fewer.
CREATE INDEX idx_runs_started_at ON runs (started_at DESC);
