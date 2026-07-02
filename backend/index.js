import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, unlinkSync } from 'fs';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    cb(null, unique);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title, status = 'todo', priority = 'medium', owner = '', project = '', due = '', description = '' } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const result = db.prepare(
    'INSERT INTO tasks (title, status, priority, owner, project, due, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title.trim(), status, priority, owner, project, due, description);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, status, priority, owner, project, due, description } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.prepare(`
    UPDATE tasks SET
      title = ?, status = ?, priority = ?, owner = ?, project = ?, due = ?, description = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? task.title,
    status ?? task.status,
    priority ?? task.priority,
    owner ?? task.owner,
    project ?? task.project,
    due ?? task.due,
    description ?? task.description,
    id
  );
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

// Projects
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  const withCounts = projects.map(p => ({
    ...p,
    taskCount: db.prepare("SELECT COUNT(*) as c FROM tasks WHERE project = ?").get(p.name).c,
    openCount: db.prepare("SELECT COUNT(*) as c FROM tasks WHERE project = ? AND status != 'done'").get(p.name).c,
  }));
  res.json(withCounts);
});

app.post('/api/projects', (req, res) => {
  const { name, status = 'active', description = '', lead = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(
    'INSERT INTO projects (name, status, description, lead) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), status, description, lead);
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
});

app.patch('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const { name, status, description, lead } = req.body;
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  db.prepare('UPDATE projects SET name=?, status=?, description=?, lead=? WHERE id=?')
    .run(name ?? p.name, status ?? p.status, description ?? p.description, lead ?? p.lead, id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT * FROM projects WHERE id = ?').get(id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ success: true });
});

// Files
app.get('/api/files', (req, res) => {
  const files = db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
  res.json(files);
});

app.post('/api/files', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const { project = '', uploaded_by = '' } = req.body;
  const result = db.prepare(
    'INSERT INTO files (original_name, stored_name, mime_type, size, project, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, project, uploaded_by);
  res.status(201).json(db.prepare('SELECT * FROM files WHERE id = ?').get(result.lastInsertRowid));
});

app.get('/api/files/:id/download', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  res.download(join(UPLOAD_DIR, file.stored_name), file.original_name);
});

app.delete('/api/files/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  try { unlinkSync(join(UPLOAD_DIR, file.stored_name)); } catch {}
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
