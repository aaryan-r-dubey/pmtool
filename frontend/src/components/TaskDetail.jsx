import { useState } from 'react';
import './TaskDetail.css';

const STATUS_CYCLE = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };
const STATUS_LABEL = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' };

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function daysUntil(due) {
  if (!due) return null;
  return Math.ceil((new Date(due) - new Date().setHours(0,0,0,0)) / 86400000);
}

export default function TaskDetail({ task: initial, onBack, onUpdate }) {
  const [task, setTask] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: initial.title,
    priority: initial.priority,
    owner: initial.owner || '',
    project: initial.project || '',
    due: initial.due || '',
    description: initial.description || '',
  });
  const [saving, setSaving] = useState(false);

  async function cycleStatus() {
    const newStatus = STATUS_CYCLE[task.status];
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = await res.json();
      setTask(updated);
      onUpdate(updated);
    } catch {
      alert('Failed to update status.');
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      setTask(updated);
      onUpdate(updated);
      setEditing(false);
    } catch {
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const d = daysUntil(task.due);
  const dueColor = d === null ? '' : d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 7 ? 'soon' : 'fine';
  const dueLabel = d === null ? '—' : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : task.due;

  return (
    <div className="detail-page">
      <div className="detail-topbar">
        <button className="back-btn" onClick={onBack}>← Back to Tasks</button>
        <div className="detail-actions">
          {!editing && (
            <button className="btn-outline" onClick={() => setEditing(true)}>Edit</button>
          )}
          <button className={`status-btn ${task.status}`} onClick={cycleStatus}>
            {STATUS_LABEL[task.status]}
          </button>
        </div>
      </div>

      {editing ? (
        <form className="detail-edit-form" onSubmit={saveEdit}>
          <input
            className="detail-title-input"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            autoFocus
          />
          <div className="edit-grid">
            <label>
              <span>Owner</span>
              <input className="form-input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Owner" />
            </label>
            <label>
              <span>Project</span>
              <input className="form-input" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="Project" />
            </label>
            <label>
              <span>Priority</span>
              <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              <span>Due Date</span>
              <input className="form-input" type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
            </label>
          </div>
          <label className="desc-label">
            <span>Description</span>
            <textarea
              className="form-input form-textarea"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={5}
              placeholder="Add a description..."
            />
          </label>
          <div className="edit-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="detail-content">
          <h1 className="detail-title">{task.title}</h1>

          <div className="detail-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className={`status-chip ${task.status}`}>{STATUS_LABEL[task.status]}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Priority</span>
              <span className={`priority-chip ${task.priority}`}>{task.priority}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Owner</span>
              <span className="meta-value">{task.owner || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Project</span>
              <span className="meta-value">{task.project || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Due Date</span>
              <span className={`meta-value due-val ${dueColor}`}>{dueLabel}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Last Updated</span>
              <span className="meta-value">{timeAgo(task.updated_at)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Created</span>
              <span className="meta-value">{task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
            </div>
          </div>

          <div className="detail-description">
            <span className="meta-label">Description</span>
            {task.description
              ? <p className="desc-text">{task.description}</p>
              : <p className="desc-empty">No description added.</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}
