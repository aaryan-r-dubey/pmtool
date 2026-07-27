import './Sidebar.css';
import useTheme from '../useTheme';

const nav = [
  { key: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { key: 'projects', label: 'Projects', icon: '◫' },
  { key: 'tasks', label: 'Tasks', icon: '✓' },
  { key: 'pending', label: 'Pending Tasks', icon: '◷' },
  { key: 'calendar', label: 'Calendar', icon: '◻' },
  { key: 'files', label: 'Drive Files', icon: '◈' },
  { key: 'contacts', label: 'Application Database', icon: '☰' },
];

export default function Sidebar({ active, onNav }) {
  const { theme, toggleTheme } = useTheme();

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
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </aside>
  );
}
