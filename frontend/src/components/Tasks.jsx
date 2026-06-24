import { useState, useEffect } from 'react';
import TaskDetail from './TaskDetail';
import './Tasks.css';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUSES = ['all', 'todo', 'in-progress', 'done'];
const PRIORITIES = ['all', 'high', 'medium', 'low'];
const STATUS_CYCLE = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };

const EMPTY_FORM = { title: '', priority: 'medium', owner: '', due: '', project: '', description: '' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => { fetchTasks(); }, []);

  async function fetchTasks() {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error();
      setTasks(await res.json());
      setError(null);
    } catch {
      setError('Could not connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function addTask(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const task = await res.json();
      setTasks(prev => [task, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      alert('Failed to add task.');
    } finally {
      setSaving(false);
    }
  }

  async function cycleStatus(task) {
    const newStatus = STATUS_CYCLE[task.status];
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch {
      alert('Failed to update task.');
    }
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      setEditingId(null);
    } catch {
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch {
      alert('Failed to delete task.');
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setEditForm({ title: task.title, priority: task.priority, owner: task.owner, project: task.project, due: task.due, description: task.description });
  }

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (selectedTask) {
    return (
      <TaskDetail
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
        onUpdate={updated => {
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
          setSelectedTask(updated);
        }}
      />
    );
  }

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="page-sub">{filtered.length} of {tasks.length} tasks</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM); }}>
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {showForm && (
        <form className="task-form card" onSubmit={addTask}>
          <div className="form-row">
            <input
              className="form-input flex-1"
              placeholder="Task title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
            <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-row">
            <input className="form-input flex-1" placeholder="Owner" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} />
            <input className="form-input flex-1" placeholder="Project" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
            <input className="form-input" type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
          </div>
          <textarea
            className="form-input form-textarea"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add Task'}
          </button>
        </form>
      )}

      <div className="filters">
        <input className="search-input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-group">
          {STATUSES.map(s => (
            <button key={s} className={`filter-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {PRIORITIES.map(p => (
            <button key={p} className={`filter-btn ${filterPriority === p ? 'active' : ''}`} onClick={() => setFilterPriority(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="task-table card">
        <div className="table-head">
          <span>Task</span>
          <span>Project</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Last Updated</span>
          <span></span>
        </div>

        {loading && <p className="empty-state">Loading tasks...</p>}

        {!loading && filtered.length === 0 && (
          <p className="empty-state">{tasks.length === 0 ? 'No tasks yet. Add your first one above.' : 'No tasks match your filters.'}</p>
        )}

        {filtered.map(t => (
          <div key={t.id} className="task-row-wrapper">
            {editingId === t.id ? (
              <div className="table-row edit-row">
                <div className="edit-main">
                  <div className="form-row">
                    <input className="form-input flex-1" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} autoFocus placeholder="Title" />
                    <select className="form-input" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <input className="form-input flex-1" value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))} placeholder="Owner" />
                    <input className="form-input flex-1" value={editForm.project} onChange={e => setEditForm(f => ({ ...f, project: e.target.value }))} placeholder="Project" />
                    <input className="form-input" type="date" value={editForm.due} onChange={e => setEditForm(f => ({ ...f, due: e.target.value }))} />
                  </div>
                  <textarea
                    className="form-input form-textarea"
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description"
                    rows={2}
                  />
                  <div className="row-actions" style={{marginTop: '4px'}}>
                    <button className="action-btn save" onClick={() => saveEdit(t.id)} disabled={saving}>Save</button>
                    <button className="action-btn cancel" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="table-row">
                <div className="task-title-cell" onClick={() => setSelectedTask(t)} style={{cursor:'pointer'}}>
                  <span className="task-title-text task-title-link">{t.title}</span>
                  {t.description && <span className="task-desc">{t.description}</span>}
                </div>
                <span className="cell-muted">{t.project || '—'}</span>
                <span className="cell-muted">{t.owner || '—'}</span>
                <span className="cell-muted">{t.due || '—'}</span>
                <span className={`priority-chip ${t.priority}`}>{t.priority}</span>
                <button className={`status-btn ${t.status}`} onClick={() => cycleStatus(t)} title="Click to advance status">
                  {t.status === 'todo' ? 'To Do' : t.status === 'in-progress' ? 'In Progress' : 'Done'}
                </button>
                <span className="cell-muted">{timeAgo(t.updated_at)}</span>
                <div className="row-actions">
                  <button className="action-btn edit" onClick={() => startEdit(t)} title="Edit">✎</button>
                  <button className="action-btn delete" onClick={() => deleteTask(t.id)} title="Delete">✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
