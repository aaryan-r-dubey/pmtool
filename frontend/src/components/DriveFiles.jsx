import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../api';
import './DriveFiles.css';

function fileIcon(mime) {
  if (!mime) return '📁';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return '📋';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('word') || mime.includes('document') || mime.includes('text')) return '📄';
  if (mime.includes('image')) return '🖼️';
  if (mime.includes('video')) return '🎬';
  if (mime.includes('audio')) return '🎵';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  return '📁';
}

function fileTypeLabel(mime) {
  if (!mime) return 'File';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'Spreadsheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Presentation';
  if (mime.includes('word') || mime.includes('document')) return 'Document';
  if (mime.includes('text/plain')) return 'Text';
  if (mime.includes('image')) return 'Image';
  if (mime.includes('video')) return 'Video';
  if (mime.includes('audio')) return 'Audio';
  return 'File';
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DriveFiles() {
  const [files, setFiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openFolder, setOpenFolder] = useState(null); // null = folder view; '' = No Project; name = project
  const [viewMode, setViewMode] = useState('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ project: '', uploaded_by: '' });
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [driveStatus, setDriveStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    fetchFiles();
    fetch(apiUrl('/api/projects')).then(r => r.json()).then(setProjects).catch(() => {});
    fetch(apiUrl('/api/drive/status')).then(r => r.json()).then(setDriveStatus).catch(() => {});
  }, []);

  async function fetchFiles() {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/files'));
      setFiles(await res.json());
    } catch {}
    setLoading(false);
  }

  async function uploadFiles(e) {
    e.preventDefault();
    if (!selectedFiles.length) return;
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('project', uploadForm.project);
        fd.append('uploaded_by', uploadForm.uploaded_by);
        const res = await fetch(apiUrl('/api/files'), { method: 'POST', body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Upload failed.');
        }
      }
      await fetchFiles();
      setShowUpload(false);
      setSelectedFiles([]);
      setUploadForm({ project: '', uploaded_by: '' });
    } catch (err) {
      alert(err.message || 'Upload failed.');
    }
    setUploading(false);
  }

  async function syncFromDrive() {
    setSyncing(true);
    try {
      const res = await fetch(apiUrl('/api/drive/sync'), { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Sync failed.');
      await fetchFiles();
      alert(`Synced from Drive: ${body.projectsImported} project(s), ${body.filesImported} file(s) imported.`);
    } catch (err) {
      alert(err.message || 'Sync failed.');
    }
    setSyncing(false);
  }

  async function deleteFile(id) {
    if (!confirm('Delete this file?')) return;
    await fetch(apiUrl(`/api/files/${id}`), { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) { setSelectedFiles(dropped); setShowUpload(true); }
  }

  const projectNames = [...new Set(files.map(f => f.project).filter(Boolean))];

  const searching = search.trim().length > 0;

  const searchFiltered = files.filter(f =>
    f.original_name.toLowerCase().includes(search.toLowerCase())
  );

  const folders = [
    ...projectNames.map(name => ({ key: name, label: name })),
    { key: '', label: 'No Project' },
  ].map(folder => {
    const folderFiles = files.filter(f => (f.project || '') === folder.key);
    return { ...folder, files: folderFiles, totalSize: folderFiles.reduce((s, f) => s + (f.size || 0), 0) };
  }).filter(folder => folder.files.length > 0);

  const filtered = searching
    ? searchFiltered
    : files.filter(f => (f.project || '') === openFolder);

  return (
    <div
      className="drive-page"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-inner">
            <span style={{fontSize: 48}}>📁</span>
            <p>Drop files to upload</p>
          </div>
        </div>
      )}

      {driveStatus && !driveStatus.authorized && (
        <div className="drive-connect-banner">
          {driveStatus.configured ? (
            <>
              <span>Google Drive isn't connected yet — uploads won't work until it is.</span>
              <a className="btn-primary" href={apiUrl('/auth/google')}>Connect Google Drive</a>
            </>
          ) : (
            <span>Google Drive isn't configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in backend/.env, then restart the server.</span>
          )}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Files</h1>
          <p className="page-sub">
            {files.length} file{files.length !== 1 ? 's' : ''} stored
            {!searching && openFolder === null ? ` in ${folders.length} folder${folders.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="filter-btn" onClick={syncFromDrive} disabled={syncing || !driveStatus?.authorized}>
            {syncing ? 'Syncing...' : '⟳ Sync from Drive'}
          </button>
          <button className="btn-primary" onClick={() => setShowUpload(v => !v)}>
            {showUpload ? 'Cancel' : '+ Upload Files'}
          </button>
        </div>
      </div>

      {showUpload && (
        <form className="upload-form card" onSubmit={uploadFiles}>
          <div
            className={`drop-zone ${selectedFiles.length ? 'has-files' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setSelectedFiles(Array.from(e.dataTransfer.files)); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => setSelectedFiles(Array.from(e.target.files))}
            />
            {selectedFiles.length ? (
              <div style={{width:'100%'}}>
                <div className="selected-files-list">
                  {selectedFiles.map((f, i) => (
                    <span key={i} className="selected-file-chip">
                      {fileIcon(f.type)} {f.name}
                    </span>
                  ))}
                </div>
                <button type="button" className="change-files-btn" onClick={() => fileInputRef.current.click()}>
                  Change files
                </button>
              </div>
            ) : (
              <div className="drop-placeholder">
                <span style={{fontSize: 36}}>📂</span>
                <p>Drag files here or</p>
                <button type="button" className="browse-btn" onClick={() => fileInputRef.current.click()}>
                  Browse files
                </button>
                <p className="drop-hint">Max 50 MB per file · Any file type</p>
              </div>
            )}
          </div>
          <div className="form-row">
            <select
              className="form-input flex-1"
              value={uploadForm.project}
              onChange={e => setUploadForm(f => ({ ...f, project: e.target.value }))}
            >
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <input
              className="form-input flex-1"
              placeholder="Uploaded by (optional)"
              value={uploadForm.uploaded_by}
              onChange={e => setUploadForm(f => ({ ...f, uploaded_by: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!selectedFiles.length || uploading}>
            {uploading ? 'Uploading...' : selectedFiles.length ? `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}` : 'Select files first'}
          </button>
        </form>
      )}

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {!searching && openFolder !== null && (
          <button className="filter-btn back-btn" onClick={() => setOpenFolder(null)}>
            ← All Folders
          </button>
        )}
        {!searching && openFolder !== null && (
          <span className="folder-crumb">{openFolder === '' ? 'No Project' : openFolder}</span>
        )}
        {(searching || openFolder !== null) && (
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
            <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
          </div>
        )}
      </div>

      {loading && <p className="empty-state">Loading files...</p>}

      {!loading && searching && searchFiltered.length === 0 && (
        <p className="empty-state">No files match your search.</p>
      )}

      {!loading && !searching && files.length === 0 && (
        <p className="empty-state">No files yet. Click "Upload Files" or drag and drop files anywhere on this page.</p>
      )}

      {!loading && !searching && openFolder === null && files.length > 0 && (
        <div className="folders-grid">
          {folders.map(folder => (
            <button key={folder.key || '__none__'} className="folder-card" onClick={() => setOpenFolder(folder.key)}>
              <div className="folder-card-icon">📁</div>
              <div className="folder-card-body">
                <span className="folder-name">{folder.label}</span>
                <span className="folder-meta">{folder.files.length} file{folder.files.length !== 1 ? 's' : ''} · {formatSize(folder.totalSize)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && (searching || openFolder !== null) && filtered.length === 0 && !searching && (
        <p className="empty-state">No files in this folder.</p>
      )}

      {viewMode === 'grid' && !loading && (searching || openFolder !== null) && filtered.length > 0 && (
        <div className="files-grid">
          {filtered.map(f => (
            <div key={f.id} className="file-card-full">
              <div className="file-card-icon">{fileIcon(f.mime_type)}</div>
              <div className="file-card-body">
                <span className="file-name">{f.original_name}</span>
                <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span className="file-type-tag">{fileTypeLabel(f.mime_type)}</span>
                  {f.project && <span className="file-project-tag">{f.project}</span>}
                </div>
              </div>
              <div className="file-card-footer">
                <span>{f.uploaded_by || '—'}</span>
                <span>{formatSize(f.size)}</span>
                <div className="file-card-actions">
                  <a href={apiUrl(`/api/files/${f.id}/download`)} className="action-btn-link" title="Download">⬇</a>
                  <button className="action-btn delete" onClick={() => deleteFile(f.id)} title="Delete">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && !loading && (searching || openFolder !== null) && filtered.length > 0 && (
        <div className="file-list card">
          <div className="file-list-head">
            <span>Name</span>
            <span>Type</span>
            <span>Project</span>
            <span>Uploaded by</span>
            <span>Size</span>
            <span>When</span>
            <span></span>
          </div>
          {filtered.map(f => (
            <div key={f.id} className="file-list-row">
              <span className="file-row-name">
                <span className="file-row-icon">{fileIcon(f.mime_type)}</span>
                {f.original_name}
              </span>
              <span className="cell-muted">{fileTypeLabel(f.mime_type)}</span>
              <span className="cell-muted">{f.project || '—'}</span>
              <span className="cell-muted">{f.uploaded_by || '—'}</span>
              <span className="cell-muted">{formatSize(f.size)}</span>
              <span className="cell-muted">{timeAgo(f.created_at)}</span>
              <div className="row-actions">
                <a href={`/api/files/${f.id}/download`} className="action-btn-link" title="Download">⬇</a>
                <button className="action-btn delete" onClick={() => deleteFile(f.id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
