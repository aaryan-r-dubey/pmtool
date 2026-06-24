import { useState } from 'react';
import { events } from '../data';
import './Calendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getDays(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  return { first, total };
}

export default function Calendar() {
  const today = new Date('2026-06-23');
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  function prev() {
    setView(v => {
      const d = new Date(v.year, v.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function next() {
    setView(v => {
      const d = new Date(v.year, v.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const { first, total } = getDays(view.year, view.month);

  function eventsOnDay(day) {
    const dateStr = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  }

  const upcomingMonthEvents = events
    .filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === view.year && d.getMonth() === view.month;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="page-sub">{MONTHS[view.month]} {view.year}</p>
        </div>
      </div>

      <div className="cal-layout">
        <div className="cal-main card">
          <div className="cal-nav">
            <button className="nav-arrow" onClick={prev}>‹</button>
            <span className="cal-month-label">{MONTHS[view.month]} {view.year}</span>
            <button className="nav-arrow" onClick={next}>›</button>
          </div>

          <div className="cal-grid">
            {DAYS.map(d => <div key={d} className="cal-day-name">{d}</div>)}
            {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: total }, (_, i) => {
              const day = i + 1;
              const dayEvents = eventsOnDay(day);
              const dateStr = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              return (
                <div key={day} className={`cal-day ${isToday ? 'today' : ''}`}>
                  <span className="day-num">{day}</span>
                  {dayEvents.slice(0, 2).map(e => (
                    <div key={e.id} className={`cal-event-chip ${e.type}`}>{e.title}</div>
                  ))}
                  {dayEvents.length > 2 && <div className="more-chip">+{dayEvents.length - 2} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="cal-sidebar">
          <div className="card">
            <div className="card-header">
              <h2>Events this month</h2>
              <span className="badge">{upcomingMonthEvents.length}</span>
            </div>
            {upcomingMonthEvents.length === 0 && <p className="empty-state">No events.</p>}
            <ul className="event-list-full">
              {upcomingMonthEvents.map(e => (
                <li key={e.id} className="event-item-full">
                  <div className={`event-dot ${e.type}`} />
                  <div>
                    <span className="event-name">{e.title}</span>
                    <span className="event-when">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} at {e.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
