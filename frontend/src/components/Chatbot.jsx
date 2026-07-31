import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../api';
import './Chatbot.css';

function fileIcon(mime) {
  if (!mime) return '📁';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📋';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('word') || mime.includes('document')) return '📄';
  return '📁';
}

export default function Chatbot() {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi — I can help you find files you've uploaded, or create a calendar event or task. What do you need?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(apiUrl('/api/chat/status')).then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Chat failed.');
      setMessages(prev => [...prev, { role: 'assistant', content: body.reply, fileResults: body.fileResults }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'Something went wrong.', isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="page-header">
        <div>
          <h1>Assistant</h1>
          <p className="page-sub">Find files, schedule meetings, or add tasks by chatting.</p>
        </div>
      </div>

      {status && !status.configured && (
        <div className="chat-connect-banner">
          <span>The assistant isn't configured yet — set ANTHROPIC_API_KEY in backend/.env, then restart the server.</span>
        </div>
      )}

      <div className="chat-window card">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble-row ${m.role}`}>
              <div className={`chat-bubble ${m.role} ${m.isError ? 'error' : ''}`}>
                {m.content}
              </div>
              {m.fileResults && (
                <div className="chat-file-results">
                  {m.fileResults.length === 0 ? (
                    <span className="chat-file-empty">No matching files found.</span>
                  ) : (
                    m.fileResults.map(f => (
                      <a
                        key={f.id}
                        className="chat-file-card"
                        href={f.drive_link || apiUrl(`/api/files/${f.id}/download`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="chat-file-icon">{fileIcon(f.mime_type)}</span>
                        <div className="chat-file-info">
                          <span className="chat-file-name">{f.original_name}</span>
                          <span className="chat-file-meta">{[f.project, f.folder_name].filter(Boolean).join(' / ') || 'No project'}</span>
                        </div>
                      </a>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="chat-bubble-row assistant"><div className="chat-bubble assistant typing">…</div></div>}
          <div ref={bottomRef} />
        </div>

        <form className="chat-input-row" onSubmit={send}>
          <input
            className="chat-input"
            placeholder={status?.configured === false ? 'Assistant not configured' : "Ask something, e.g. \"meet notes ufl x infrabid\""}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || status?.configured === false}
          />
          <button className="btn-primary" type="submit" disabled={loading || !input.trim() || status?.configured === false}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
