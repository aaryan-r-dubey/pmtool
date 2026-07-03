import { useState, useEffect } from 'react';
import './ProjectDetail.css';

const STATUS_LABEL = { active: 'Active', pipeline: 'Pipeline', 'on-hold': 'On Hold', closed: 'Closed' };
const STATUSES = ['active', 'pipeline', 'on-hold', 'closed'];

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EMPTY_TASK_FORM = { title: '', priority: 'medium', owner: '', due: '', description: '' };

export default function ProjectDetail({ project: initial, onBack, onUpdate }) {
  const [project, setProject] = useState(initial);
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: initial.name, status: initial.status, description: initial.description || '', lead: initial.lead || '' });
  const [saving, setSaving] = useState(false);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [savingTask, setSavingTask] = useState(false);

  const [files, setFiles] = useState([]);
  const [showFileForm, setShowFileForm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedBy, setUploadedBy] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(all => setTasks(all.filter(t => t.project === project.name)))
      .catch(() => {});
    fetchFiles();
  }, [project.name]);

  async function fetchFiles() {
    try {
      const res = await fetch('/api/files');
      const all = await res.json();
      setFiles(all.filter(f => f.project === project.name));
    } catch {}
  }

  async function addTask(e) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskForm, project: project.name }),
      });
      if (!res.ok) throw new Error();
      const task = await res.json();
      setTasks(prev => [task, ...prev]);
      setTaskForm(EMPTY_TASK_FORM);
      setShowTaskForm(false);
    } catch {
      alert('Failed to add task.');
    } finally {
      setSavingTask(false);
    }
  }

  async function uploadFiles(e) {
    e.preventDefault();
    if (!selectedFiles.length) return;
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('project', project.name);
        fd.append('uploaded_by', uploadedBy);
        await fetch('/api/files', { method: 'POST', body: fd });
      }
      await fetchFiles();
      setShowFileForm(false);
      setSelectedFiles([]);
      setUploadedBy('');
    } catch {
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(id) {
    if (!confirm('Delete this file?')) return;
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      setProject(updated);
      onUpdate(updated);
      setEditing(false);
    } catch { alert('Failed to save.'); }
    finally { setSaving(false); }
  }

  const done = tasks.filter(t => t.status === 'done').length;
  const open = tasks.filter(t => t.status !== 'done').length;

  return (
    <div className="proj-detail-page">
      <div className="detail-topbar">
        <button className="back-btn" onClick={onBack}>← Back to Projects</button>
        {!editing && <button className="btn-outline" onClick={() => setEditing(true)}>Edit</button>}
      </div>

      {editing ? (
        <form className="proj-edit-form" onSubmit={saveEdit}>
          <input
            className="proj-title-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required autoFocus
          />
          <div className="edit-grid">
            <label>
              <span>Status</span>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label>
              <span>Lead</span>
              <input className="form-input" value={form.lead} onChange={e => setForm(f => ({ ...f, lead: e.target.value }))} placeholder="Lead" />
            </label>
          </div>
          <label className="desc-label">
            <span>Description</span>
            <textarea className="form-input form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Project description..." />
          </label>
          <div className="edit-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="proj-header">
            <div className="proj-initial">{project.name.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="proj-title">{project.name}</h1>
              {project.lead && <p className="proj-lead">Lead: {project.lead}</p>}
            </div>
            <span className={`status-badge ${project.status}`}>{STATUS_LABEL[project.status]}</span>
          </div>

          <div className="proj-meta-row">
            <div className="proj-stat">
              <span className="proj-stat-num">{tasks.length}</span>
              <span className="proj-stat-label">Total Tasks</span>
            </div>
            <div className="proj-stat">
              <span className="proj-stat-num accent">{open}</span>
              <span className="proj-stat-label">Open</span>
            </div>
            <div className="proj-stat">
              <span className="proj-stat-num success">{done}</span>
              <span className="proj-stat-label">Completed</span>
            </div>
            <div className="proj-stat">
              <span className="proj-stat-num">{new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="proj-stat-label">Created</span>
            </div>
          </div>

          {project.description && (
            <div className="proj-desc-box">
              <span className="section-label">Description</span>
              <p>{project.description}</p>
            </div>
          )}

          <div className="proj-tasks-section">
            <div className="section-header-row">
              <span className="section-label">Tasks in this project</span>
              <button className="btn-outline btn-sm" onClick={() => setShowTaskForm(v => !v)}>
                {showTaskForm ? 'Cancel' : '+ Add Task'}
              </button>
            </div>

            {showTaskForm && (
              <form className="inline-add-form" onSubmit={addTask}>
                <input
                  className="form-input"
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  required autoFocus
                />
                <div className="inline-add-row">
                  <select className="form-input" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <input className="form-input" placeholder="Owner" value={taskForm.owner} onChange={e => setTaskForm(f => ({ ...f, owner: e.target.value }))} />
                  <input className="form-input" type="date" value={taskForm.due} onChange={e => setTaskForm(f => ({ ...f, due: e.target.value }))} />
                </div>
                <button type="submit" className="btn-primary" disabled={!taskForm.title.trim() || savingTask}>
                  {savingTask ? 'Adding...' : 'Add Task'}
                </button>
              </form>
            )}

            {tasks.length === 0 ? (
              <p className="empty-state">No tasks linked to this project yet.</p>
            ) : (
              <div className="proj-task-list">
                {tasks.map(t => (
                  <div key={t.id} className="proj-task-row">
                    <span className={`status-dot ${t.status}`} />
                    <span className="proj-task-title">{t.title}</span>
                    <span className="proj-task-owner">{t.owner || '—'}</span>
                    <span className="proj-task-due">{t.due || '—'}</span>
                    <span className={`priority-chip ${t.priority}`}>{t.priority}</span>
                    <span className={`status-chip ${t.status}`}>
                      {t.status === 'todo' ? 'To Do' : t.status === 'in-progress' ? 'In Progress' : 'Done'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="proj-files-section">
            <div className="section-header-row">
              <span className="section-label">Files</span>
              <button className="btn-outline btn-sm" onClick={() => setShowFileForm(v => !v)}>
                {showFileForm ? 'Cancel' : '+ Add File'}
              </button>
            </div>

            {showFileForm && (
              <form className="inline-add-form" onSubmit={uploadFiles}>
                <input
                  type="file"
                  multiple
                  className="form-input"
                  onChange={e => setSelectedFiles(Array.from(e.target.files))}
                />
                <div className="inline-add-row">
                  <input className="form-input" placeholder="Uploaded by (optional)" value={uploadedBy} onChange={e => setUploadedBy(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary" disabled={!selectedFiles.length || uploading}>
                  {uploading ? 'Uploading...' : selectedFiles.length ? `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}` : 'Select files first'}
                </button>
              </form>
            )}

            {files.length === 0 ? (
              <p className="empty-state">No files uploaded to this project yet.</p>
            ) : (
              <div className="proj-task-list">
                {files.map(f => (
                  <div key={f.id} className="proj-file-row">
                    <span className="proj-file-name">{f.original_name}</span>
                    <span className="proj-task-owner">{f.uploaded_by || '—'}</span>
                    <span className="proj-task-owner">{formatSize(f.size)}</span>
                    <div className="row-actions">
                      <a href={`/api/files/${f.id}/download`} className="action-btn-link" title="Download">⬇</a>
                      <button type="button" className="action-btn delete" onClick={() => deleteFile(f.id)} title="Delete">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
