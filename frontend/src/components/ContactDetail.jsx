import { useState } from 'react';
import { apiUrl } from '../api';
import './ContactDetail.css';

const TYPE_LABEL = { founder: 'Founder', startup: 'Startup', contact: 'Contact' };
const STATUS_LABEL = { active: 'Active', cold: 'Cold', archived: 'Archived' };

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContactDetail({ contact: initial, onBack, onUpdate, onDelete }) {
  const [contact, setContact] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: initial.name,
    type: initial.type,
    startup: initial.startup || '',
    role: initial.role || '',
    email: initial.email || '',
    phone: initial.phone || '',
    connected_on: initial.connected_on || '',
    status: initial.status,
    notes: initial.notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/contacts/${contact.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setContact(updated);
      onUpdate(updated);
      setEditing(false);
    } catch {
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this record?')) return;
    try {
      const res = await fetch(apiUrl(`/api/contacts/${contact.id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onDelete(contact.id);
    } catch {
      alert('Failed to delete.');
    }
  }

  return (
    <div className="detail-page">
      <div className="detail-topbar">
        <button className="back-btn" onClick={onBack}>← Back to Application Database</button>
        <div className="detail-actions">
          {!editing && (
            <>
              <button className="btn-outline" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn-outline danger" onClick={handleDelete}>Delete</button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <form className="detail-edit-form" onSubmit={saveEdit}>
          <input
            className="detail-title-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            autoFocus
            placeholder="Name"
          />
          <div className="edit-grid">
            <label>
              <span>Type</span>
              <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="founder">Founder</option>
                <option value="startup">Startup</option>
                <option value="contact">Contact</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="cold">Cold</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              <span>Startup</span>
              <input className="form-input" value={form.startup} onChange={e => setForm(f => ({ ...f, startup: e.target.value }))} placeholder="Startup / company" />
            </label>
            <label>
              <span>Role</span>
              <input className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Role / title" />
            </label>
            <label>
              <span>Email</span>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
            </label>
            <label>
              <span>Phone</span>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
            </label>
            <label>
              <span>Connected On</span>
              <input className="form-input" type="date" value={form.connected_on} onChange={e => setForm(f => ({ ...f, connected_on: e.target.value }))} />
            </label>
          </div>
          <label className="desc-label">
            <span>Notes</span>
            <textarea
              className="form-input form-textarea"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={8}
              placeholder="Notes..."
            />
          </label>
          <div className="edit-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="detail-content">
          <h1 className="detail-title">{contact.name}</h1>

          <div className="detail-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Type</span>
              <span className="meta-value">{TYPE_LABEL[contact.type] || contact.type}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className={`status-chip ${contact.status}`}>{STATUS_LABEL[contact.status] || contact.status}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Startup</span>
              <span className="meta-value">{contact.startup || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Role</span>
              <span className="meta-value">{contact.role || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Email</span>
              <span className="meta-value">{contact.email || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Phone</span>
              <span className="meta-value">{contact.phone || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Connected On</span>
              <span className="meta-value">{contact.connected_on || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Created</span>
              <span className="meta-value">{formatDate(contact.created_at)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Last Updated</span>
              <span className="meta-value">{contact.updated_at ? formatDate(contact.updated_at) : '—'}</span>
            </div>
          </div>

          <div className="detail-description">
            <span className="meta-label">Notes</span>
            {contact.notes
              ? <p className="desc-text">{contact.notes}</p>
              : <p className="desc-empty">No notes added.</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}
