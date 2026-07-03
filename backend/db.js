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
if (!cols.includes('updated_at')) {
  db.exec("ALTER TABLE tasks ADD COLUMN updated_at TEXT DEFAULT NULL");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT DEFAULT '',
    lead TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const projectCols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
if (!projectCols.includes('drive_folder_id')) {
  db.exec("ALTER TABLE projects ADD COLUMN drive_folder_id TEXT DEFAULT ''");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    project TEXT DEFAULT '',
    uploaded_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const fileCols = db.prepare("PRAGMA table_info(files)").all().map(c => c.name);
if (!fileCols.includes('drive_file_id')) {
  db.exec("ALTER TABLE files ADD COLUMN drive_file_id TEXT DEFAULT ''");
}
if (!fileCols.includes('drive_link')) {
  db.exec("ALTER TABLE files ADD COLUMN drive_link TEXT DEFAULT ''");
}

export default db;
