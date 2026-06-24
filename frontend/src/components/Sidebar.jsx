import './Sidebar.css';

const nav = [
  { key: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { key: 'tasks', label: 'Tasks', icon: '✓' },
  { key: 'calendar', label: 'Calendar', icon: '◻' },
  { key: 'files', label: 'Drive Files', icon: '◈' },
];

export default function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">PM</span>
        <div>
          <span className="logo-text">TeamSpace</span>
          <span className="logo-sub">Urban Futures Lab</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {nav.map(item => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onNav(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">SL</div>
        <div className="sidebar-user">
          <span className="user-name">Your Team</span>
          <span className="user-role">Internal</span>
        </div>
      </div>
    </aside>
  );
}
