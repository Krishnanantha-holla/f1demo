import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

function ChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const userMsg = { role: 'user', content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    try {
      const res = await api.aiChat(updated);
      setMessages([...updated, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('Grok API key not configured')) {
        setMessages([...updated, { role: 'assistant', content: 'Grok AI not configured on the server. Ask the admin to set GROK_API_KEY in the backend. You can also use the Summary tab for cached bios.' }]);
      } else {
        setMessages([...updated, { role: 'assistant', content: `Error: ${msg}` }]);
      }
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="ai-chat-container card">
      <div className="ai-chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <p>Ask anything about Formula 1:</p>
            <div className="ai-suggestions">
              {['Who will win the championship?', 'Analyze Verstappen vs Norris', 'Best overtaking circuits', 'Tire degradation strategy explained'].map(s => (
                <button key={s} className="ai-suggestion-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
            <div className="ai-msg-label">{msg.role === 'user' ? 'You' : '🏎️ Grok'}</div>
            <div className="ai-msg-content">{msg.content}</div>
          </div>
        ))}
        {loading && <div className="ai-msg ai-msg-assistant"><div className="ai-msg-label">🏎️ Grok</div><div className="ai-msg-content ai-typing">Analyzing...</div></div>}
      </div>
      <div className="ai-chat-input-row">
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Ask about F1..." rows="1" className="ai-chat-input" disabled={loading} />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="ai-send-btn" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  );
}

function AnalyzeTab() {
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const analyze = async (t) => {
    const q = (t || topic).trim();
    if (!q || loading) return;
    setTopic(q);
    setLoading(true);
    setResult('');
    try {
      const res = await api.aiAnalyze(q);
      setResult(res.analysis);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('Grok API key not configured')) setResult('Grok AI not configured on the server. Set GROK_API_KEY to enable analysis.');
      else setResult(`Error: ${msg}`);
    }
    setLoading(false);
  };

  const presets = [
    'Championship battle analysis',
    'Mid-season power rankings',
    'Which team has the best upgrade path?',
    'Rookie performance comparison',
  ];

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <div className="ai-suggestions" style={{ marginBottom: '0.75rem' }}>
          {presets.map(p => (
            <button key={p} className="ai-suggestion-chip" onClick={() => { setTopic(p); analyze(p); }}>{p}</button>
          ))}
        </div>
        <div className="ai-chat-input-row" style={{ border: 'none', padding: 0 }}>
          <textarea value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(); } }}
            placeholder="Enter a topic to analyze..." rows="1" className="ai-chat-input" disabled={loading} />
          <button onClick={() => analyze()} disabled={loading || !topic.trim()} className="ai-send-btn" aria-label="Analyze">
            {loading ? <span className="spinner" style={{ width: 16, height: 16, margin: 0 }} /> :
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            }
          </button>
        </div>
      </div>
      {result && (
        <div className="ai-analysis-text" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
          {result}
        </div>
      )}
      {!result && !loading && (
        <div className="ai-chat-empty" style={{ padding: '2rem 1rem' }}>
          <p style={{ color: 'var(--text-dim)' }}>Pick a topic or type your own — Grok will analyze it with current season data.</p>
        </div>
      )}
    </div>
  );
}

function SummaryTab() {
  const [type, setType] = useState('driver');
  const [id, setId] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSummary = async (t, i) => {
    const st = t || type;
    const si = (i || id).trim();
    if (!si || loading) return;
    setLoading(true);
    setResult('');
    try {
      const res = await api.aiSummary(st, si);
      setResult(res.summary);
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('Grok API key not configured')) setResult('Grok AI not configured on the server. Set GROK_API_KEY to enable summaries.');
      else setResult(`Error: ${msg}`);
    }
    setLoading(false);
  };

  const quickPicks = {
    driver: ['Verstappen', 'Norris', 'Hamilton', 'Leclerc', 'Piastri'],
    constructor: ['Red Bull', 'McLaren', 'Ferrari', 'Mercedes', 'Aston Martin'],
    track: ['Monaco', 'Silverstone', 'Spa', 'Monza', 'Suzuka'],
    race: ['British Grand Prix', 'Monaco Grand Prix', 'Italian Grand Prix'],
  };

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['driver', 'constructor', 'track', 'race'].map(t => (
          <button key={t} className={`ai-suggestion-chip ${type === t ? 'active' : ''}`}
            style={type === t ? { background: 'var(--f1-red)', borderColor: 'var(--f1-red)', color: '#fff' } : {}}
            onClick={() => { setType(t); setResult(''); }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="ai-suggestions" style={{ marginBottom: '0.75rem' }}>
        {(quickPicks[type] || []).map(p => (
          <button key={p} className="ai-suggestion-chip" onClick={() => { setId(p); fetchSummary(type, p); }}>{p}</button>
        ))}
      </div>
      <div className="ai-chat-input-row" style={{ border: 'none', padding: 0 }}>
        <textarea value={id} onChange={e => setId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fetchSummary(); } }}
          placeholder={`Enter ${type} name...`} rows="1" className="ai-chat-input" disabled={loading} />
        <button onClick={() => fetchSummary()} disabled={loading || !id.trim()} className="ai-send-btn" aria-label="Get Summary">
          {loading ? <span className="spinner" style={{ width: 16, height: 16, margin: 0 }} /> :
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          }
        </button>
      </div>
      {result && (
        <div className="ai-analysis-text" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
          {result}
        </div>
      )}
    </div>
  );
}

export default function AIChat() {
  const [tab, setTab] = useState('chat');

  return (
    <div className="page-container">
      <h1 className="page-title">F1 AI Analyst</h1>
      <p className="page-subtitle">Powered by Grok — discuss, analyze, and explore F1 with AI-driven insights backed by real data.</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[['chat', '💬 Chat'], ['analyze', '🔍 Analyze'], ['summary', '📖 Summary']].map(([key, label]) => (
          <button key={key}
            className={`ai-suggestion-chip ${tab === key ? 'active' : ''}`}
            style={tab === key ? { background: 'var(--f1-red)', borderColor: 'var(--f1-red)', color: '#fff', fontWeight: 800 } : { fontWeight: 700 }}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <ChatTab />}
      {tab === 'analyze' && <AnalyzeTab />}
      {tab === 'summary' && <SummaryTab />}
    </div>
  );
}
