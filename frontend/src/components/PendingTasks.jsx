import { useState, useEffect } from 'react';
import './PendingTasks.css';

const STATUS_CYCLE = { todo: 'in-progress', 'in-progress': 'done', done: 'todo' };

function daysUntil(due) {
  if (!due) return null;
  const diff = Math.ceil((new Date(due) - new Date().setHours(0,0,0,0)) / 86400000);
  return diff;
}

function dueBadge(due) {
  const d = daysUntil(due);
  if (d === null) return null;
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, cls: 'overdue' };
  if (d === 0) return { label: 'Due today', cls: 'today' };
  if (d === 1) return { label: 'Due tomorrow', cls: 'soon' };
  if (d <= 7) return { label: `${d}d left`, cls: 'soon' };
  return { label: `${d}d left`, cls: 'fine' };
}

export default function PendingTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPending(); }, []);

  async function fetchPending() {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const all = await res.json();
      const pending = all
        .filter(t => t.status !== 'done')
        .sort((a, b) => {
          if (!a.due && !b.due) return 0;
          if (!a.due) return 1;
          if (!b.due) return -1;
          return new Date(a.due) - new Date(b.due);
        });
      setTasks(pending);
    } catch {
    } finally {
      setLoading(false);
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
      if (updated.status === 'done') {
        setTasks(prev => prev.filter(t => t.id !== task.id));
      } else {
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      }
    } catch {
      alert('Failed to update task.');
    }
  }

  const overdue = tasks.filter(t => t.due && daysUntil(t.due) < 0);
  const dueToday = tasks.filter(t => t.due && daysUntil(t.due) === 0);
  const upcoming = tasks.filter(t => t.due && daysUntil(t.due) > 0);
  const noDue = tasks.filter(t => !t.due);

  const groups = [
    { label: 'Overdue', tasks: overdue, cls: 'group-overdue' },
    { label: 'Due Today', tasks: dueToday, cls: 'group-today' },
    { label: 'Upcoming', tasks: upcoming, cls: 'group-upcoming' },
    { label: 'No Due Date', tasks: noDue, cls: 'group-nodue' },
  ].filter(g => g.tasks.length > 0);

  return (
    <div className="pending-page">
      <div className="page-header">
        <div>
          <h1>Pending Tasks</h1>
          <p className="page-sub">{tasks.length} task{tasks.length !== 1 ? 's' : ''} remaining</p>
        </div>
      </div>

      {loading && <p className="empty-state">Loading...</p>}

      {!loading && tasks.length === 0 && (
        <div className="all-done">
          <span className="all-done-icon">✓</span>
          <p>All tasks completed. Great work!</p>
        </div>
      )}

      {groups.map(group => (
        <div key={group.label} className="task-group">
          <div className={`group-label ${group.cls}`}>
            {group.label}
            <span className="group-count">{group.tasks.length}</span>
          </div>
          <div className="group-cards">
            {group.tasks.map(t => {
              const badge = dueBadge(t.due);
              return (
                <div key={t.id} className="pending-card">
                  <div className="pending-card-top">
                    <div className="pending-card-title">
                      <span className={`status-dot ${t.status}`} />
                      <span className="pending-title-text">{t.title}</span>
                    </div>
                    <button
                      className={`status-btn ${t.status}`}
                      onClick={() => cycleStatus(t)}
                      title="Click to advance status"
                    >
                      {t.status === 'todo' ? 'To Do' : 'In Progress'}
                    </button>
                  </div>

                  {t.description && (
                    <p className="pending-desc">{t.description}</p>
                  )}

                  <div className="pending-card-meta">
                    {t.project && <span className="meta-tag">{t.project}</span>}
                    {t.owner && <span className="meta-owner">👤 {t.owner}</span>}
                    {badge && <span className={`due-badge ${badge.cls}`}>{badge.label}</span>}
                    <span className={`priority-chip ${t.priority}`}>{t.priority}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
