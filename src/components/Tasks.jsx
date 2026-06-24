import { useState } from 'react';
import { tasks as initialTasks } from '../data';
import './Tasks.css';

const STATUSES = ['all', 'todo', 'in-progress', 'done'];
const PRIORITIES = ['all', 'high', 'medium', 'low'];

export default function Tasks() {
  const [tasks, setTasks] = useState(initialTasks);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'medium', assignee: '', due: '', project: '' });

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function cycleStatus(id) {
    const cycle = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: cycle[t.status] } : t));
  }

  function addTask(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setTasks(prev => [...prev, { ...form, id: Date.now(), status: 'todo' }]);
    setForm({ title: '', priority: 'medium', assignee: '', due: '', project: '' });
    setShowForm(false);
  }

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="page-sub">{filtered.length} of {tasks.length} tasks</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {showForm && (
        <form className="task-form card" onSubmit={addTask}>
          <div className="form-row">
            <input
              className="form-input flex-1"
              placeholder="Task title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
            <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-row">
            <input className="form-input flex-1" placeholder="Assignee" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} />
            <input className="form-input flex-1" placeholder="Project" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
            <input className="form-input" type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
          </div>
          <button type="submit" className="btn-primary">Add Task</button>
        </form>
      )}

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
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

      <div className="task-table card">
        <div className="table-head">
          <span>Task</span>
          <span>Project</span>
          <span>Assignee</span>
          <span>Due</span>
          <span>Priority</span>
          <span>Status</span>
        </div>
        {filtered.length === 0 && <p className="empty-state">No tasks match your filters.</p>}
        {filtered.map(t => (
          <div key={t.id} className="table-row">
            <span className="task-title-cell">{t.title}</span>
            <span className="cell-muted">{t.project || '—'}</span>
            <span className="cell-muted">{t.assignee || '—'}</span>
            <span className="cell-muted">{t.due || '—'}</span>
            <span className={`priority-chip ${t.priority}`}>{t.priority}</span>
            <button className={`status-btn ${t.status}`} onClick={() => cycleStatus(t.id)} title="Click to advance status">
              {t.status === 'todo' ? 'To Do' : t.status === 'in-progress' ? 'In Progress' : 'Done'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
