import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import PendingTasks from './components/PendingTasks';
import Calendar from './components/Calendar';
import DriveFiles from './components/DriveFiles';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');

  const views = {
    dashboard: <Dashboard />,
    tasks: <Tasks />,
    pending: <PendingTasks />,
    calendar: <Calendar />,
    files: <DriveFiles />,
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
