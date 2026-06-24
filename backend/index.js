import express from 'express';
import cors from 'cors';
import db from './db.js';

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
      title = ?, status = ?, priority = ?, owner = ?, project = ?, due = ?, description = ?
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

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
