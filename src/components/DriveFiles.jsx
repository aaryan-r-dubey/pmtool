import { useState } from 'react';
import { driveFiles } from '../data';
import './DriveFiles.css';

const TYPE_LABELS = { presentation: 'Presentation', doc: 'Document', sheet: 'Spreadsheet', pdf: 'PDF', other: 'Other' };
const ALL_TYPES = ['all', 'doc', 'presentation', 'sheet', 'pdf', 'other'];

function fileIcon(type) {
  if (type === 'presentation') return '📊';
  if (type === 'doc') return '📄';
  if (type === 'sheet') return '📋';
  if (type === 'pdf') return '📕';
  return '📁';
}

export default function DriveFiles() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const filtered = driveFiles.filter(f => {
    if (filterType !== 'all' && f.type !== filterType) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="drive-page">
      <div className="page-header">
        <div>
          <h1>Drive Files</h1>
          <p className="page-sub">Connected to Google Drive · {driveFiles.length} files synced</p>
        </div>
        <div className="drive-connect-banner">
          <span className="drive-icon">◈</span>
          Google Drive connected
        </div>
      </div>

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-group">
          {ALL_TYPES.map(t => (
            <button key={t} className={`filter-btn ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
              {t === 'all' ? 'All' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
          <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="files-grid">
          {filtered.map(f => (
            <div key={f.id} className="file-card-full">
              <div className="file-card-icon">{fileIcon(f.type)}</div>
              <div className="file-card-body">
                <span className="file-name">{f.name}</span>
                <span className="file-type-tag">{TYPE_LABELS[f.type]}</span>
              </div>
              <div className="file-card-footer">
                <span>{f.modifiedBy}</span>
                <span>{f.modified}</span>
                <span>{f.size}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="file-list card">
          <div className="file-list-head">
            <span>Name</span>
            <span>Type</span>
            <span>Modified by</span>
            <span>Date</span>
            <span>Size</span>
          </div>
          {filtered.map(f => (
            <div key={f.id} className="file-list-row">
              <span className="file-row-name">
                <span className="file-row-icon">{fileIcon(f.type)}</span>
                {f.name}
              </span>
              <span className="cell-muted">{TYPE_LABELS[f.type]}</span>
              <span className="cell-muted">{f.modifiedBy}</span>
              <span className="cell-muted">{f.modified}</span>
              <span className="cell-muted">{f.size}</span>
            </div>
          ))}
          {filtered.length === 0 && <p className="empty-state">No files match your search.</p>}
        </div>
      )}
    </div>
  );
}
