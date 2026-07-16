import { useState, useEffect } from 'react';
import { apiUrl } from '../api';
import './Contacts.css';

const TABS = [
  { key: 'founder', label: 'Founders' },
  { key: 'startup', label: 'Startups' },
  { key: 'contact', label: 'Contacts' },
];
const STATUSES = ['all', 'active', 'cold', 'archived'];

const EMPTY_FORM = { name: '', type: 'founder', startup: '', role: '', email: '', phone: '', connected_on: '', status: 'active', notes: '' };

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('founder');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  async function fetchContacts() {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/contacts'));
      if (!res.ok) throw new Error();
      setContacts(await res.json());
      setError(null);
    } catch {
      setError('Could not connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function addContact(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/contacts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type: tab }),
      });
      if (!res.ok) throw new Error();
      const contact = await res.json();
      setContacts(prev => [contact, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      alert('Failed to add contact.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/contacts/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setContacts(prev => prev.map(c => c.id === id ? updated : c));
      setEditingId(null);
    } catch {
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try {
      const res = await fetch(apiUrl(`/api/contacts/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Failed to delete contact.');
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditForm({ name: c.name, type: c.type, startup: c.startup, role: c.role, email: c.email, phone: c.phone, connected_on: c.connected_on, status: c.status, notes: c.notes });
  }

  const filtered = contacts.filter(c => {
    if (c.type !== tab) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![c.name, c.startup, c.email].some(v => (v || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="contacts-page">
      <div className="page-header">
        <div>
          <h1>Application Database</h1>
          <p className="page-sub">{filtered.length} of {contacts.filter(c => c.type === tab).length} {TABS.find(t => t.key === tab).label.toLowerCase()}</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM); }}>
          {showForm ? 'Cancel' : `+ Add ${TABS.find(t => t.key === tab).label.replace(/s$/, '')}`}
        </button>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); setShowForm(false); setEditingId(null); }}>
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <form className="contact-form card" onSubmit={addContact}>
          <div className="form-row">
            <input
              className="form-input flex-1"
              placeholder="Name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <input className="form-input flex-1" placeholder="Startup / company" value={form.startup} onChange={e => setForm(f => ({ ...f, startup: e.target.value }))} />
            <input className="form-input flex-1" placeholder="Role / title" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          </div>
          <div className="form-row">
            <input className="form-input flex-1" type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="form-input flex-1" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className="form-input" type="date" title="Date connected" value={form.connected_on} onChange={e => setForm(f => ({ ...f, connected_on: e.target.value }))} />
          </div>
          <div className="form-row">
            <select className="form-input flex-1" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="cold">Cold</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <textarea
            className="form-input form-textarea"
            placeholder="Notes (how you connected, context, follow-ups...)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add Contact'}
          </button>
        </form>
      )}

      <div className="filters">
        <input className="search-input" placeholder="Search name, startup, email..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-group">
          {STATUSES.map(s => (
            <button key={s} className={`filter-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="contact-table card">
        <div className="table-head">
          <span>Name</span>
          <span>Startup</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Connected</span>
          <span>Status</span>
          <span></span>
        </div>

        {loading && <p className="empty-state">Loading contacts...</p>}

        {!loading && filtered.length === 0 && (
          <p className="empty-state">{contacts.length === 0 ? 'No contacts yet. Add your first one above.' : 'No contacts match your filters.'}</p>
        )}

        {filtered.map(c => (
          <div key={c.id} className="contact-row-wrapper">
            {editingId === c.id ? (
              <div className="table-row edit-row">
                <div className="edit-main">
                  <div className="form-row">
                    <input className="form-input flex-1" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus placeholder="Name" />
                    <select className="form-input" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} title="Category">
                      <option value="founder">Founder</option>
                      <option value="startup">Startup</option>
                      <option value="contact">Contact</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <input className="form-input flex-1" value={editForm.startup} onChange={e => setEditForm(f => ({ ...f, startup: e.target.value }))} placeholder="Startup" />
                    <input className="form-input flex-1" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} placeholder="Role" />
                  </div>
                  <div className="form-row">
                    <input className="form-input flex-1" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                    <input className="form-input flex-1" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
                    <input className="form-input" type="date" value={editForm.connected_on} onChange={e => setEditForm(f => ({ ...f, connected_on: e.target.value }))} />
                  </div>
                  <div className="form-row">
                    <select className="form-input flex-1" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="cold">Cold</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <textarea
                    className="form-input form-textarea"
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes"
                    rows={2}
                  />
                  <div className="row-actions" style={{marginTop: '4px'}}>
                    <button className="action-btn save" onClick={() => saveEdit(c.id)} disabled={saving}>Save</button>
                    <button className="action-btn cancel" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="table-row">
                <div className="contact-name-cell">
                  <span className="contact-name-text">{c.name}</span>
                  {c.role && <span className="contact-sub">{c.role}</span>}
                </div>
                <span className="cell-muted">{c.startup || '—'}</span>
                <span className="cell-muted">{c.email || '—'}</span>
                <span className="cell-muted">{c.phone || '—'}</span>
                <span className="cell-muted">{c.connected_on || '—'}</span>
                <span className={`status-chip ${c.status}`}>{c.status}</span>
                <div className="row-actions">
                  <button className="action-btn edit" onClick={() => startEdit(c)} title="Edit">✎</button>
                  <button className="action-btn delete" onClick={() => deleteContact(c.id)} title="Delete">✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
