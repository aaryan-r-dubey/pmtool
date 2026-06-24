import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'tasks.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    owner TEXT DEFAULT '',
    project TEXT DEFAULT '',
    due TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// migrate existing tables that still have the old "assignee" column
const cols = db.prepare("PRAGMA table_info(tasks)").all().map(c => c.name);
if (cols.includes('assignee') && !cols.includes('owner')) {
  db.exec('ALTER TABLE tasks RENAME COLUMN assignee TO owner');
}
if (!cols.includes('description')) {
  db.exec("ALTER TABLE tasks ADD COLUMN description TEXT DEFAULT ''");
}

export default db;
