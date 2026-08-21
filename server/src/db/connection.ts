import Database from 'better-sqlite3';

/**
 * Open (or create) a SQLite database.
 *
 * @param location Either a filesystem path (e.g. `server/data/dojo.db`) or the
 *   special string `':memory:'`, which gives you a throwaway database that
 *   lives entirely in RAM — perfect for tests, gone when the process exits.
 */
export function openDatabase(location: string): Database.Database {
  const db = new Database(location);

  // WAL (write-ahead logging) lets readers and the writer overlap instead of
  // blocking each other. Overkill for a one-user practice server, but it is
  // the pragma you would always reach for in a real deployment, so practice
  // it here. On ':memory:' databases SQLite silently ignores it — harmless.
  db.pragma('journal_mode = WAL');

  // SQLite ships with foreign key enforcement OFF for historical reasons.
  // We have no foreign keys yet, but turning it on at connection time is the
  // habit worth building — forgetting this is a classic SQLite footgun.
  db.pragma('foreign_keys = ON');

  return db;
}
