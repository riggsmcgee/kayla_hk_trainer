import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { openDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { createRunsRouter } from './routes/runs.js';

// Resolve the package root relative to this file so dev (server/src/) and the
// built output (server/dist/) both land on server/.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The SQLite file lives in server/data/ (gitignored — see server/.gitignore).
const dataDir = path.join(packageRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

// Open the database and bring the schema up to date before accepting traffic.
const db = openDatabase(path.join(dataDir, 'dojo.db'));
const applied = migrate(db);
if (applied.length > 0) {
  console.log(`[dojo-server] applied migrations: ${applied.join(', ')}`);
} else {
  console.log('[dojo-server] database schema up to date');
}

const app = express();

// Wide-open CORS is fine here: this is a local practice backend for exactly
// one developer, and the web app must treat it as optional anyway.
app.use(cors());
app.use(express.json());

// The web app's sync adapter pings this with a short timeout to decide whether
// the mirror is available. Keep it instant and dependency-free.
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/runs', createRunsRouter(db));

// Port 4000 per the project contract (Vite dev server owns 5173).
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`[dojo-server] listening on http://localhost:${PORT}`);
});
