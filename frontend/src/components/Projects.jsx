import { useState, useEffect } from 'react';
import ProjectDetail from './ProjectDetail';
import { apiUrl } from '../api';
import './Projects.css';

const STATUSES = ['active', 'pipeline', 'on-hold', 'closed'];
const STATUS_LABEL = { active: 'Active', pipeline: 'Pipeline', 'on-hold': 'On Hold', closed: 'Closed' };
const EMPTY_FORM = { name: '', status: 'active', description: '', lead: '' };

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/projects'));
      setProjects(await res.json());
    } catch {}
    finally { setLoading(false); }
  }

  async function addProject(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const p = await res.json();
      setProjects(prev => [{ ...p, taskCount: 0, openCount: 0 }, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch { alert('Failed to create project.'); }
    finally { setSaving(false); }
  }

  async function deleteProject(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    await fetch(apiUrl(`/api/projects/${id}`), { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  async function syncFromDrive() {
    setSyncing(true);
    try {
      // Discover/create projects from the staging folder under the Projects
      // root, then pull new files into every existing project's own Drive
      // folder (wherever it actually lives). Never touches Drive Files.
      const stagingRes = await fetch(apiUrl('/api/projects/sync-staging'), { method: 'POST' });
      const stagingBody = await stagingRes.json();
      if (!stagingRes.ok) throw new Error(stagingBody.error || 'Sync failed.');

      const projRes = await fetch(apiUrl('/api/projects/sync'), { method: 'POST' });
      const projBody = await projRes.json();
      if (!projRes.ok) throw new Error(projBody.error || 'Sync failed.');

      await fetchProjects();

      const filesImported = stagingBody.filesImported + projBody.filesImported;
      const foldersImported = stagingBody.foldersImported + projBody.foldersImported;
      alert(`Synced from Drive: ${stagingBody.projectsCreated} project(s) created, ${filesImported} file(s) imported, ${foldersImported} folder(s) imported.`);
    } catch (err) {
      alert(err.message || 'Sync failed.');
    }
    setSyncing(false);
  }

  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        onBack={() => { setSelected(null); fetchProjects(); }}
        onUpdate={updated => setSelected(updated)}
      />
    );
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-sub">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="filter-btn" onClick={syncFromDrive} disabled={syncing}>
            {syncing ? 'Syncing...' : '⟳ Sync from Drive'}
          </button>
          <button className="btn-primary" onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM); }}>
            {showForm ? 'Cancel' : '+ New Project'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="project-form card" onSubmit={addProject}>
          <div className="form-row">
            <input
              className="form-input flex-1"
              placeholder="Project name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required autoFocus
            />
            <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="form-row">
            <input className="form-input flex-1" placeholder="Lead (person responsible)" value={form.lead} onChange={e => setForm(f => ({ ...f, lead: e.target.value }))} />
          </div>
          <textarea
            className="form-input form-textarea"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Project'}</button>
        </form>
      )}

      {loading && <p className="empty-state">Loading projects...</p>}

      {!loading && projects.length === 0 && (
        <div className="empty-projects">
          <p>No projects yet. Create your first one above.</p>
        </div>
      )}

      <div className="projects-grid">
        {projects.map(p => (
          <div key={p.id} className={`project-card status-${p.status}`} onClick={() => setSelected(p)}>
            <div className="project-card-header">
              <div className="project-initial">{p.name.charAt(0).toUpperCase()}</div>
              <span className={`status-badge ${p.status}`}>{STATUS_LABEL[p.status]}</span>
            </div>
            <div className="project-card-body">
              <h3 className="project-name">{p.name}</h3>
              {p.lead && <p className="project-lead">Lead: {p.lead}</p>}
              {p.description && <p className="project-desc">{p.description}</p>}
            </div>
            <div className="project-card-footer">
              <div className="task-counts">
                <span className="count-item">
                  <span className="count-num">{p.taskCount}</span> tasks
                </span>
                <span className="count-divider">·</span>
                <span className="count-item open">
                  <span className="count-num">{p.openCount}</span> open
                </span>
              </div>
              <button className="delete-btn" onClick={(e) => deleteProject(p.id, e)} title="Delete">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
