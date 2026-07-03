import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import db from './db.js';
import * as googleDrive from './googleDrive.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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

app.post('/api/projects', async (req, res) => {
  const { name, status = 'active', description = '', lead = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(
    'INSERT INTO projects (name, status, description, lead) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), status, description, lead);

  if (googleDrive.isAuthorized()) {
    try {
      const folderId = await googleDrive.getOrCreateProjectFolder(name.trim());
      db.prepare('UPDATE projects SET drive_folder_id = ? WHERE id = ?').run(folderId, result.lastInsertRowid);
    } catch (err) {
      console.error('Failed to create Drive folder for project:', err.message);
    }
  }

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
});

app.patch('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, description, lead } = req.body;
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const newName = name ?? p.name;
  db.prepare('UPDATE projects SET name=?, status=?, description=?, lead=? WHERE id=?')
    .run(newName, status ?? p.status, description ?? p.description, lead ?? p.lead, id);

  if (newName !== p.name && p.drive_folder_id && googleDrive.isAuthorized()) {
    try { await googleDrive.renameProjectFolder(p.drive_folder_id, newName); } catch (err) {
      console.error('Failed to rename Drive folder:', err.message);
    }
  }

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ error: 'Not found' });

  if (p.drive_folder_id && googleDrive.isAuthorized()) {
    try {
      await googleDrive.trashFolder(p.drive_folder_id);
      googleDrive.invalidateProjectFolderCache(p.name);
    } catch (err) {
      console.error('Failed to trash Drive folder:', err.message);
    }
  }

  db.prepare('DELETE FROM files WHERE project = ?').run(p.name);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ success: true });
});

// Google Drive OAuth
app.get('/auth/google', (req, res) => {
  if (!googleDrive.isConfigured()) return res.status(500).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in backend/.env');
  res.redirect(googleDrive.getAuthUrl());
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    await googleDrive.handleOAuthCallback(code);
    res.send('Google Drive connected. You can close this tab.');
  } catch (err) {
    res.status(500).send('Failed to connect Google Drive: ' + err.message);
  }
});

app.get('/api/drive/status', (req, res) => {
  res.json({ configured: googleDrive.isConfigured(), authorized: googleDrive.isAuthorized() });
});

// Files
app.get('/api/files', (req, res) => {
  const files = db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
  res.json(files);
});

app.post('/api/files', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  if (!googleDrive.isAuthorized()) {
    return res.status(503).json({ error: 'Google Drive is not connected. Visit /auth/google to connect it.' });
  }
  const { project = '', uploaded_by = '' } = req.body;
  try {
    const projectRow = project ? db.prepare('SELECT drive_folder_id FROM projects WHERE name = ?').get(project) : null;
    const { driveFileId, driveLink } = await googleDrive.uploadFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      project,
      driveFolderId: projectRow?.drive_folder_id || null,
    });
    const result = db.prepare(
      'INSERT INTO files (original_name, stored_name, mime_type, size, project, uploaded_by, drive_file_id, drive_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.file.originalname, '', req.file.mimetype, req.file.size, project, uploaded_by, driveFileId, driveLink);
    res.status(201).json(db.prepare('SELECT * FROM files WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload to Google Drive: ' + err.message });
  }
});

app.get('/api/files/:id/download', async (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (!file.drive_file_id) return res.status(410).json({ error: 'File is not available' });
  try {
    const stream = await googleDrive.downloadFileStream(file.drive_file_id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    if (file.mime_type) res.setHeader('Content-Type', file.mime_type);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download from Google Drive: ' + err.message });
  }
});

app.delete('/api/files/:id', async (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (file.drive_file_id) await googleDrive.deleteFile(file.drive_file_id);
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
