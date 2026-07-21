import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { query, one } from './db.js';
import * as googleDrive from './googleDrive.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/tasks', async (req, res) => {
  const tasks = await query('SELECT * FROM tasks ORDER BY created_at DESC');
  res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
  const { title, status = 'todo', priority = 'medium', owner = '', project = '', due = '', description = '' } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const task = await one(
    'INSERT INTO tasks (title, status, priority, owner, project, due, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [title.trim(), status, priority, owner, project, due, description]
  );
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, status, priority, owner, project, due, description } = req.body;
  const task = await one('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const updated = await one(
    `UPDATE tasks SET
      title = $1, status = $2, priority = $3, owner = $4, project = $5, due = $6, description = $7,
      updated_at = now()
    WHERE id = $8 RETURNING *`,
    [
      title ?? task.title,
      status ?? task.status,
      priority ?? task.priority,
      owner ?? task.owner,
      project ?? task.project,
      due ?? task.due,
      description ?? task.description,
      id,
    ]
  );
  res.json(updated);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const task = await one('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  await query('DELETE FROM tasks WHERE id = $1', [id]);
  res.json({ success: true });
});

// Projects
app.get('/api/projects', async (req, res) => {
  const projects = await query('SELECT * FROM projects ORDER BY created_at DESC');
  const withCounts = await Promise.all(projects.map(async p => {
    const taskCount = await one('SELECT COUNT(*) as c FROM tasks WHERE project = $1', [p.name]);
    const openCount = await one("SELECT COUNT(*) as c FROM tasks WHERE project = $1 AND status != 'done'", [p.name]);
    return { ...p, taskCount: Number(taskCount.c), openCount: Number(openCount.c) };
  }));
  res.json(withCounts);
});

app.post('/api/projects', async (req, res) => {
  const { name, status = 'active', description = '', lead = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const project = await one(
    'INSERT INTO projects (name, status, description, lead) VALUES ($1, $2, $3, $4) RETURNING *',
    [name.trim(), status, description, lead]
  );

  if (googleDrive.isAuthorized()) {
    try {
      const folderId = await googleDrive.getOrCreateProjectFolder(name.trim());
      await query('UPDATE projects SET drive_folder_id = $1 WHERE id = $2', [folderId, project.id]);
      project.drive_folder_id = folderId;
    } catch (err) {
      console.error('Failed to create Drive folder for project:', err.message);
    }
  }

  res.status(201).json(project);
});

app.patch('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, description, lead } = req.body;
  const p = await one('SELECT * FROM projects WHERE id = $1', [id]);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const newName = name ?? p.name;
  const updated = await one(
    'UPDATE projects SET name=$1, status=$2, description=$3, lead=$4 WHERE id=$5 RETURNING *',
    [newName, status ?? p.status, description ?? p.description, lead ?? p.lead, id]
  );

  if (newName !== p.name && p.drive_folder_id && googleDrive.isAuthorized()) {
    try { await googleDrive.renameProjectFolder(p.drive_folder_id, newName); } catch (err) {
      console.error('Failed to rename Drive folder:', err.message);
    }
  }

  res.json(updated);
});

app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const p = await one('SELECT * FROM projects WHERE id = $1', [id]);
  if (!p) return res.status(404).json({ error: 'Not found' });

  if (p.drive_folder_id && googleDrive.isAuthorized()) {
    try {
      await googleDrive.trashFolder(p.drive_folder_id);
      googleDrive.invalidateProjectFolderCache(p.name);
    } catch (err) {
      console.error('Failed to trash Drive folder:', err.message);
    }
  }

  await query('DELETE FROM files WHERE project = $1', [p.name]);
  await query('DELETE FROM folders WHERE project = $1', [p.name]);
  await query('DELETE FROM projects WHERE id = $1', [id]);
  res.json({ success: true });
});

// Contacts (founders / startups)
app.get('/api/contacts', async (req, res) => {
  const contacts = await query('SELECT * FROM contacts ORDER BY created_at DESC');
  res.json(contacts);
});

app.post('/api/contacts', async (req, res) => {
  const { name, type = 'founder', startup = '', role = '', email = '', phone = '', connected_on = '', status = 'active', notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const contact = await one(
    'INSERT INTO contacts (name, type, startup, role, email, phone, connected_on, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [name.trim(), type, startup, role, email, phone, connected_on, status, notes]
  );
  res.status(201).json(contact);
});

app.patch('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, startup, role, email, phone, connected_on, status, notes } = req.body;
  const contact = await one('SELECT * FROM contacts WHERE id = $1', [id]);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  const updated = await one(
    `UPDATE contacts SET
      name = $1, type = $2, startup = $3, role = $4, email = $5, phone = $6, connected_on = $7, status = $8, notes = $9,
      updated_at = now()
    WHERE id = $10 RETURNING *`,
    [
      name ?? contact.name,
      type ?? contact.type,
      startup ?? contact.startup,
      role ?? contact.role,
      email ?? contact.email,
      phone ?? contact.phone,
      connected_on ?? contact.connected_on,
      status ?? contact.status,
      notes ?? contact.notes,
      id,
    ]
  );
  res.json(updated);
});

app.delete('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const contact = await one('SELECT * FROM contacts WHERE id = $1', [id]);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  await query('DELETE FROM contacts WHERE id = $1', [id]);
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

async function syncBrowseFolder(driveFolder, parentDbFolderId, knownFileIds, stats) {
  let folderRow = await one('SELECT * FROM folders WHERE drive_folder_id = $1', [driveFolder.id]);
  if (!folderRow) {
    folderRow = await one(
      'INSERT INTO folders (name, project, parent_folder_id, drive_folder_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [driveFolder.name, '', parentDbFolderId, driveFolder.id]
    );
    stats.foldersImported++;
  }
  // absorb any files left over from the old text-tag sync into this real folder
  await query(
    'UPDATE files SET project = $1, folder_id = $2 WHERE project = $3 AND folder_id IS NULL',
    ['', folderRow.id, driveFolder.name]
  );

  const driveFiles = await googleDrive.listChildFiles(driveFolder.id);
  for (const file of driveFiles) {
    if (knownFileIds.has(file.id)) continue;
    await query(
      'INSERT INTO files (original_name, stored_name, mime_type, size, project, uploaded_by, drive_file_id, drive_link, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [file.name, '', file.mimeType || '', Number(file.size) || 0, '', '', file.id, file.webViewLink || '', folderRow.id]
    );
    knownFileIds.add(file.id);
    stats.filesImported++;
  }

  const subfolders = await googleDrive.listChildFolders(driveFolder.id);
  for (const sub of subfolders) {
    await syncBrowseFolder(sub, folderRow.id, knownFileIds, stats);
  }
}

app.post('/api/drive/sync', async (req, res) => {
  if (!googleDrive.isAuthorized()) {
    return res.status(503).json({ error: 'Google Drive is not connected. Visit /auth/google to connect it.' });
  }
  try {
    const rootId = await googleDrive.getFilesRoot();
    const driveFolders = await googleDrive.listChildFolders(rootId);

    const existingProjects = await query('SELECT * FROM projects');
    const byProjectName = new Map(existingProjects.map(p => [p.name, p]));

    const existingFiles = await query('SELECT drive_file_id FROM files WHERE drive_file_id IS NOT NULL AND drive_file_id != $1', ['']);
    const knownFileIds = new Set(existingFiles.map(f => f.drive_file_id));

    const stats = { projectsLinked: 0, foldersImported: 0, filesImported: 0 };

    // Link folders to existing projects with a matching name (never auto-create
    // new projects). Everything else mirrors recursively into real, browsable
    // folders — even if empty — so Drive Files reflects the actual folder tree.
    for (const folder of driveFolders) {
      const project = byProjectName.get(folder.name);
      if (project) {
        if (!project.drive_folder_id) {
          await query('UPDATE projects SET drive_folder_id = $1 WHERE id = $2', [folder.id, project.id]);
          project.drive_folder_id = folder.id;
          stats.projectsLinked++;
        }
        const driveFiles = await googleDrive.listChildFiles(folder.id);
        for (const file of driveFiles) {
          if (knownFileIds.has(file.id)) continue;
          await query(
            'INSERT INTO files (original_name, stored_name, mime_type, size, project, uploaded_by, drive_file_id, drive_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [file.name, '', file.mimeType || '', Number(file.size) || 0, project.name, '', file.id, file.webViewLink || '']
          );
          knownFileIds.add(file.id);
          stats.filesImported++;
        }
        continue;
      }

      await syncBrowseFolder(folder, null, knownFileIds, stats);
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync from Drive: ' + err.message });
  }
});

async function syncProjectFolder(driveFolderId, projectName, parentDbFolderId, knownFileIds, stats) {
  const driveFiles = await googleDrive.listChildFiles(driveFolderId);
  for (const file of driveFiles) {
    if (knownFileIds.has(file.id)) continue;
    await query(
      'INSERT INTO files (original_name, stored_name, mime_type, size, project, uploaded_by, drive_file_id, drive_link, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [file.name, '', file.mimeType || '', Number(file.size) || 0, projectName, '', file.id, file.webViewLink || '', parentDbFolderId]
    );
    knownFileIds.add(file.id);
    stats.filesImported++;
  }

  const subfolders = await googleDrive.listChildFolders(driveFolderId);
  for (const sub of subfolders) {
    let folderRow = await one('SELECT * FROM folders WHERE drive_folder_id = $1', [sub.id]);
    if (!folderRow) {
      folderRow = await one(
        'INSERT INTO folders (name, project, parent_folder_id, drive_folder_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [sub.name, projectName, parentDbFolderId, sub.id]
      );
      stats.foldersImported++;
    }
    await syncProjectFolder(sub.id, projectName, folderRow.id, knownFileIds, stats);
  }
}

app.post('/api/projects/sync', async (req, res) => {
  if (!googleDrive.isAuthorized()) {
    return res.status(503).json({ error: 'Google Drive is not connected. Visit /auth/google to connect it.' });
  }
  try {
    const projects = await query("SELECT * FROM projects WHERE drive_folder_id IS NOT NULL AND drive_folder_id != ''");

    const existingFiles = await query('SELECT drive_file_id FROM files WHERE drive_file_id IS NOT NULL AND drive_file_id != $1', ['']);
    const knownFileIds = new Set(existingFiles.map(f => f.drive_file_id));

    const stats = { filesImported: 0, foldersImported: 0 };
    for (const project of projects) {
      await syncProjectFolder(project.drive_folder_id, project.name, null, knownFileIds, stats);
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync projects from Drive: ' + err.message });
  }
});

// Folders
app.get('/api/folders', async (req, res) => {
  const { project = '', parent } = req.query;
  const params = [project];
  let where = 'project = $1';
  if (parent === undefined || parent === '' || parent === 'null') {
    where += ' AND parent_folder_id IS NULL';
  } else {
    params.push(parent);
    where += ` AND parent_folder_id = $${params.length}`;
  }
  const folders = await query(`SELECT * FROM folders WHERE ${where} ORDER BY name ASC`, params);
  res.json(folders);
});

app.post('/api/folders', async (req, res) => {
  const { name, project = '', parent_folder_id = null } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!googleDrive.isAuthorized()) {
    return res.status(503).json({ error: 'Google Drive is not connected. Visit /auth/google to connect it.' });
  }
  try {
    let parentDriveId;
    if (parent_folder_id) {
      const parentFolder = await one('SELECT drive_folder_id FROM folders WHERE id = $1', [parent_folder_id]);
      if (!parentFolder) return res.status(404).json({ error: 'Parent folder not found' });
      parentDriveId = parentFolder.drive_folder_id;
    } else if (project) {
      const projectRow = await one('SELECT drive_folder_id FROM projects WHERE name = $1', [project]);
      parentDriveId = projectRow?.drive_folder_id || await googleDrive.getOrCreateProjectFolder(project);
    } else {
      parentDriveId = await googleDrive.getFilesRoot();
    }
    const driveFolderId = await googleDrive.createFolderIn(name.trim(), parentDriveId);
    const folder = await one(
      'INSERT INTO folders (name, project, parent_folder_id, drive_folder_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), project, parent_folder_id || null, driveFolderId]
    );
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create folder in Google Drive: ' + err.message });
  }
});

app.delete('/api/folders/:id', async (req, res) => {
  const folder = await one('SELECT * FROM folders WHERE id = $1', [req.params.id]);
  if (!folder) return res.status(404).json({ error: 'Not found' });
  if (folder.drive_folder_id && googleDrive.isAuthorized()) {
    try { await googleDrive.trashFolder(folder.drive_folder_id); } catch (err) {
      console.error('Failed to trash Drive folder:', err.message);
    }
  }
  await query('DELETE FROM folders WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// Files
app.get('/api/files', async (req, res) => {
  const { project, folder } = req.query;
  if (project === undefined) {
    const files = await query('SELECT * FROM files ORDER BY created_at DESC');
    return res.json(files);
  }
  const params = [project];
  let where = 'project = $1';
  if (folder === undefined || folder === '' || folder === 'null') {
    where += ' AND folder_id IS NULL';
  } else {
    params.push(folder);
    where += ` AND folder_id = $${params.length}`;
  }
  const files = await query(`SELECT * FROM files WHERE ${where} ORDER BY created_at DESC`, params);
  res.json(files);
});

app.post('/api/files', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  if (!googleDrive.isAuthorized()) {
    return res.status(503).json({ error: 'Google Drive is not connected. Visit /auth/google to connect it.' });
  }
  const { project = '', uploaded_by = '', folder_id = null } = req.body;
  try {
    let driveFolderId = null;
    if (folder_id) {
      const folderRow = await one('SELECT drive_folder_id FROM folders WHERE id = $1', [folder_id]);
      if (!folderRow) return res.status(404).json({ error: 'Folder not found' });
      driveFolderId = folderRow.drive_folder_id;
    } else {
      const projectRow = project ? await one('SELECT drive_folder_id FROM projects WHERE name = $1', [project]) : null;
      driveFolderId = projectRow?.drive_folder_id || null;
    }
    const { driveFileId, driveLink } = await googleDrive.uploadFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      project,
      driveFolderId,
    });
    const file = await one(
      'INSERT INTO files (original_name, stored_name, mime_type, size, project, uploaded_by, drive_file_id, drive_link, folder_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [req.file.originalname, '', req.file.mimetype, req.file.size, project, uploaded_by, driveFileId, driveLink, folder_id || null]
    );
    res.status(201).json(file);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload to Google Drive: ' + err.message });
  }
});

app.get('/api/files/:id/download', async (req, res) => {
  const file = await one('SELECT * FROM files WHERE id = $1', [req.params.id]);
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
  const file = await one('SELECT * FROM files WHERE id = $1', [req.params.id]);
  if (!file) return res.status(404).json({ error: 'Not found' });
  if (file.drive_file_id) await googleDrive.deleteFile(file.drive_file_id);
  await query('DELETE FROM files WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
