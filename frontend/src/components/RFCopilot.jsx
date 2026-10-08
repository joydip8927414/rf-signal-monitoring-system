// components/RFCopilot.jsx
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { sendCopilotMessage } from '../services/api';

const SUGGESTIONS = [
  'What is happening with the signal?',
  'Summarize the last 5 minutes',
  'Why did SNR change?',
  'Is the signal abnormal?',
  'Show device health',
  'Explain the latest anomaly',
];

function renderMd(text) {
  if (!text) return '';
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const em = bold.replace(/\*(.*?)\*/g, '<em>$1</em>');
    const code = em.replace(/`(.*?)`/g, '<code>$1</code>');
    if (line.startsWith('- ')) {
      return `<li>${code.slice(2)}</li>`;
    }
    if (line.startsWith('# ')) {
      return `<h4>${code.slice(2)}</h4>`;
    }
    return code + (i < lines.length - 1 ? '<br/>' : '');
  }).join('');
}

export default function RFCopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: '**RF Copilot** — Ask me about your RF measurements, AI analysis, device status, or signal anomalies.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text) => {
    const q = text?.trim() || input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await sendCopilotMessage(q);
      setMessages((m) => [...m, { role: 'bot', text: res.response, src: res.data_source }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: `Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        className="copilot-fab"
        onClick={() => setOpen((o) => !o)}
        title="RF Copilot"
        aria-label="Open RF Copilot"
        id="copilot-fab-btn"
      >
        <MessageSquare size={20} />
      </button>

      {/* Panel */}
      {open && (
        <div className="copilot-panel" id="copilot-panel">
          {/* Header */}
          <div className="copilot-header">
            <div>
              <div className="copilot-title">RF Copilot</div>
              <div className="copilot-sub">Understand your RF measurements</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ color: '#999', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="copilot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`copilot-msg ${m.role}`}>
                {m.src && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    background: '#171717', color: '#B7FF3C',
                    padding: '1px 5px', borderRadius: 3, marginBottom: 4, display: 'inline-block'
                  }}>
                    {m.src}
                  </span>
                )}
                {m.src && <br />}
                <span dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
              </div>
            ))}
            {loading && (
              <div className="copilot-msg bot" style={{ color: '#999' }}>
                Analysing RF data…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div className="copilot-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="copilot-suggestion"
                onClick={() => send(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="copilot-input-row">
            <input
              className="copilot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about signal, SNR, anomalies…"
              disabled={loading}
              id="copilot-input"
            />
            <button
              className="copilot-send"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
