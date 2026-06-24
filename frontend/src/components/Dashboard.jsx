import { useState, useEffect } from 'react';
import { events, driveFiles } from '../data';
import './Dashboard.css';

const today = new Date().toISOString().split('T')[0];

function fileIcon(type) {
  if (type === 'presentation') return '📊';
  if (type === 'doc') return '📄';
  if (type === 'sheet') return '📋';
  if (type === 'pdf') return '📕';
  return '📁';
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(setTasks)
      .catch(() => {});
  }, []);

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const upcomingEvents = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const recentFiles = driveFiles.slice(0, 4);
  const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 5);

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — Good morning</p>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Total Tasks</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-card accent">
          <span className="stat-label">In Progress</span>
          <span className="stat-value">{inProgress}</span>
        </div>
        <div className="stat-card success">
          <span className="stat-label">Completed</span>
          <span className="stat-value">{done}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Drive Files</span>
          <span className="stat-value">{driveFiles.length}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <h2>Active Tasks</h2>
            <span className="badge">{activeTasks.length}</span>
          </div>
          {activeTasks.length === 0 ? (
            <p className="empty-state">No active tasks.</p>
          ) : (
            <ul className="task-list">
              {activeTasks.map(t => (
                <li key={t.id} className="task-row">
                  <span className={`status-dot ${t.status}`} />
                  <div className="task-info">
                    <span className="task-title">{t.title}</span>
                    <span className="task-meta">{t.project || 'No project'} · {t.assignee || 'Unassigned'}</span>
                  </div>
                  <span className={`priority-chip ${t.priority}`}>{t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Upcoming Events</h2>
          </div>
          <ul className="event-list">
            {upcomingEvents.map(e => (
              <li key={e.id} className="event-row">
                <div className="event-date-col">
                  <span className="event-day">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                  <span className="event-time">{e.time}</span>
                </div>
                <div className="event-details">
                  <span className="event-title">{e.title}</span>
                  <span className={`event-type ${e.type}`}>{e.type}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card span-full">
          <div className="card-header">
            <h2>Recent Drive Files</h2>
            <span className="text-link">View all</span>
          </div>
          <div className="files-grid">
            {recentFiles.map(f => (
              <div key={f.id} className="file-card">
                <span className="file-icon">{fileIcon(f.type)}</span>
                <div className="file-info">
                  <span className="file-name">{f.name}</span>
                  <span className="file-meta">Modified {f.modified} · {f.modifiedBy}</span>
                </div>
                <span className="file-size">{f.size}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
