import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Tasks from './components/Tasks';
import PendingTasks from './components/PendingTasks';
import Calendar from './components/Calendar';
import DriveFiles from './components/DriveFiles';
import Contacts from './components/Contacts';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');

  const views = {
    dashboard: <Dashboard />,
    projects: <Projects />,
    tasks: <Tasks />,
    pending: <PendingTasks />,
    calendar: <Calendar />,
    files: <DriveFiles />,
    contacts: <Contacts />,
  };

  return (
    <>
      <Sidebar active={page} onNav={setPage} />
      <main className="main-content">
        {views[page]}
      </main>
    </>
  );
}
