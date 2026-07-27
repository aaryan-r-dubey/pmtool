import { useState, useEffect } from 'react';
import { apiUrl } from '../api';
import './Calendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EMPTY_FORM = { title: '', date: '', time: '', endTime: '', description: '', location: '', allDay: false };

function getDays(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  return { first, total };
}

function pad(n) { return String(n).padStart(2, '0'); }

export default function Calendar() {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calStatus, setCalStatus] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dayModal, setDayModal] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/calendar/status')).then(r => r.json()).then(setCalStatus).catch(() => {});
  }, []);

  useEffect(() => { if (calStatus?.authorized) fetchEvents(); }, [view.year, view.month, calStatus?.authorized]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const timeMin = new Date(view.year, view.month - 1, 1).toISOString();
      const timeMax = new Date(view.year, view.month + 2, 0).toISOString();
      const res = await fetch(apiUrl(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`));
      if (!res.ok) throw new Error();
      setEvents(await res.json());
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  function prev() {
    setView(v => { const d = new Date(v.year, v.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  }
  function next() {
    setView(v => { const d = new Date(v.year, v.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  }

  const { first, total } = getDays(view.year, view.month);

  function eventsOnDay(day) {
    const dateStr = `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
    return events.filter(e => e.date === dateStr);
  }

  const upcomingMonthEvents = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  function openNewForm(dateStr) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: dateStr || todayStr });
    setShowForm(true);
  }

  function openEditForm(e) {
    setEditingId(e.id);
    setForm({
      title: e.title, date: e.date, time: e.time, endTime: e.endTime,
      description: e.description, location: e.location, allDay: e.allDay,
    });
    setShowForm(true);
  }

  async function saveEvent(ev) {
    ev.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      const body = { ...form, endDate: form.date };
      const url = editingId ? apiUrl(`/api/calendar/events/${editingId}`) : apiUrl('/api/calendar/events');
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save event.');
      await fetchEvents();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      alert(err.message || 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try {
      const res = await fetch(apiUrl(`/api/calendar/events/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setEvents(prev => prev.filter(e => e.id !== id));
      if (editingId === id) { setShowForm(false); setEditingId(null); }
    } catch {
      alert('Failed to delete event.');
    }
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="page-sub">
            {MONTHS[view.month]} {view.year}
            {calStatus?.authorized && calStatus.connection?.ownerName ? ` — ${calStatus.connection.ownerName}'s calendar` : ''}
          </p>
        </div>
        {calStatus?.authorized && (
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? 'Cancel' : '+ Add Event'}
          </button>
        )}
      </div>

      {calStatus && !calStatus.authorized && (
        <div className="calendar-connect-banner">
          {calStatus.configured ? (
            <>
              <span>No Google Calendar connected yet — events won't show until it's linked.</span>
              <a className="btn-primary" href={apiUrl('/auth/google-calendar')}>Connect Google Calendar</a>
            </>
          ) : (
            <span>Google Calendar isn't configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI in backend/.env, then restart the server.</span>
          )}
        </div>
      )}

      {showForm && (
        <form className="event-form card" onSubmit={saveEvent}>
          <div className="form-row">
            <input className="form-input flex-1" placeholder="Event title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus />
          </div>
          <div className="form-row">
            <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            <input className="form-input" type="time" placeholder="Start" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} disabled={form.allDay} />
            <input className="form-input" type="time" placeholder="End" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} disabled={form.allDay} />
            <label className="allday-check">
              <input type="checkbox" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} />
              All day
            </label>
          </div>
          <div className="form-row">
            <input className="form-input flex-1" placeholder="Location (optional)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <textarea className="form-input form-textarea" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Event'}</button>
            {editingId && <button type="button" className="action-btn delete" onClick={() => deleteEvent(editingId)}>Delete</button>}
          </div>
        </form>
      )}

      <div className="cal-layout">
        <div className="cal-main card">
          <div className="cal-nav">
            <button className="nav-arrow" onClick={prev}>‹</button>
            <span className="cal-month-label">{MONTHS[view.month]} {view.year}</span>
            <button className="nav-arrow" onClick={next}>›</button>
          </div>

          {loading && <p className="empty-state">Loading events...</p>}

          {!loading && (
            <div className="cal-grid">
              {DAYS.map(d => <div key={d} className="cal-day-name">{d}</div>)}
              {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: total }, (_, i) => {
                const day = i + 1;
                const dayEvents = eventsOnDay(day);
                const dateStr = `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={day}
                    className={`cal-day ${isToday ? 'today' : ''}`}
                    onClick={() => calStatus?.authorized && openNewForm(dateStr)}
                    style={{ cursor: calStatus?.authorized ? 'pointer' : 'default' }}
                  >
                    <span className="day-num">{day}</span>
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={`cal-event-chip ${e.recurring ? 'recurring' : 'meeting'}`} onClick={ev => { ev.stopPropagation(); openEditForm(e); }}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div
                        className="more-chip"
                        onClick={ev => { ev.stopPropagation(); setDayModal({ dateStr, events: dayEvents }); }}
                      >
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="cal-sidebar">
          <div className="card">
            <div className="card-header">
              <h2>Events this month</h2>
              <span className="badge">{upcomingMonthEvents.length}</span>
            </div>
            {!loading && upcomingMonthEvents.length === 0 && <p className="empty-state">No events.</p>}
            <ul className="event-list-full">
              {upcomingMonthEvents.map(e => (
                <li key={e.id} className="event-item-full" onClick={() => openEditForm(e)} style={{ cursor: 'pointer' }}>
                  <div className={`event-dot ${e.recurring ? 'recurring' : 'meeting'}`} />
                  <div>
                    <span className="event-name">{e.title}</span>
                    <span className="event-when">
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {e.allDay ? ' · All day' : ` at ${e.time}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {dayModal && (
        <div className="day-modal-backdrop" onClick={() => setDayModal(null)}>
          <div className="day-modal card" onClick={ev => ev.stopPropagation()}>
            <div className="card-header">
              <h2>{new Date(dayModal.dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
              <button className="action-btn" onClick={() => setDayModal(null)}>Close</button>
            </div>
            <ul className="event-list-full">
              {dayModal.events.map(e => (
                <li
                  key={e.id}
                  className="event-item-full"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setDayModal(null); openEditForm(e); }}
                >
                  <div className={`event-dot ${e.recurring ? 'recurring' : 'meeting'}`} />
                  <div>
                    <span className="event-name">{e.title}</span>
                    <span className="event-when">{e.allDay ? 'All day' : e.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
