/**
 * Popup React app.
 * Replaces the standalone frontend app — uses the background service worker
 * for all spell checking instead of the FastAPI backend.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

const DEBOUNCE_MS = 600;
const ERROR_CONFIG = {
  spelling: {
    label: 'Spelling', icon: '✏️',
    color: 'hsl(0, 85%, 65%)', bg: 'hsl(0, 80%, 65%, 0.12)',
    borderColor: 'hsl(0, 70%, 50%)', underline: 'wavy',
  },
  grammar: {
    label: 'Grammar', icon: '📝',
    color: 'hsl(210, 85%, 65%)', bg: 'hsl(210, 80%, 65%, 0.12)',
    borderColor: 'hsl(210, 70%, 55%)', underline: 'wavy',
  },
  context: {
    label: 'Context', icon: '🤖',
    color: 'hsl(42, 90%, 60%)', bg: 'hsl(42, 85%, 60%, 0.12)',
    borderColor: 'hsl(42, 70%, 50%)', underline: 'dashed',
  },
};

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ── API shim: calls background service worker ─────────────────────────────────
async function checkTextViaExtension(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'CHECK_TEXT', text }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (response?.ok) resolve(response.data);
      else reject(new Error(response?.error || 'Check failed'));
    });
  });
}

// ── ErrorKey helper ───────────────────────────────────────────────────────────
function errorKey(e) { return `${e.offset}-${e.length}-${e.original}-${e.error_type}`; }

// ── Main App ─────────────────────────────────────────────────────────────────
export default function PopupApp() {
  const [text, setText]                     = useState('');
  const [errors, setErrors]                 = useState([]);
  const [correctedText, setCorrectedText]   = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [apiError, setApiError]             = useState(null);
  const [dismissedIds, setDismissedIds]     = useState(new Set());
  const [history, setHistory]               = useState([]);
  const [activeTab, setActiveTab]           = useState('errors');
  const [customWords, setCustomWords]       = useState([]);
  const [newWord, setNewWord]               = useState('');
  const [correctionsMade, setCorrectionsMade] = useState(0);
  const textareaRef = useRef(null);
  const debouncedText = useDebounce(text, DEBOUNCE_MS);
  const lastChecked = useRef('');

  // Load persisted custom words
  useEffect(() => {
    chrome.storage.local.get(['customWords'], (res) => {
      setCustomWords(res.customWords || []);
    });
  }, []);

  // Spell-check effect
  useEffect(() => {
    if (!debouncedText || debouncedText === lastChecked.current) return;
    if (debouncedText.trim().length < 2) {
      setErrors([]); setCorrectedText(''); setApiError(null); return;
    }
    let cancelled = false;
    setIsLoading(true); setApiError(null);

    checkTextViaExtension(debouncedText).then((result) => {
      if (cancelled) return;
      lastChecked.current = debouncedText;
      const visible = result.errors.filter((e) => !dismissedIds.has(errorKey(e)));
      setErrors(visible);
      setCorrectedText(result.corrected_text);
    }).catch((err) => {
      if (!cancelled) setApiError(err.message);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [debouncedText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = useCallback((error, suggestion) => {
    setText((prev) => {
      const before = prev.slice(0, error.offset);
      const after  = prev.slice(error.offset + error.length);
      return before + suggestion + after;
    });
    setErrors((prev) => prev.filter((e) => errorKey(e) !== errorKey(error)));
    setHistory((prev) => [{
      original: error.original, corrected: suggestion,
      type: error.error_type, time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 100));
    setCorrectionsMade((n) => n + 1);
  }, []);

  const handleDismiss = useCallback((error) => {
    setDismissedIds((prev) => new Set([...prev, errorKey(error)]));
    setErrors((prev) => prev.filter((e) => errorKey(e) !== errorKey(error)));
  }, []);

  const handleApplyAll = useCallback(() => {
    if (!correctedText) return;
    const newHistory = errors
      .filter((e) => e.suggestions?.length > 0)
      .map((e) => ({
        original: e.original, corrected: e.suggestions[0],
        type: e.error_type, time: new Date().toLocaleTimeString(),
      }));
    setText(correctedText);
    setHistory((prev) => [...newHistory, ...prev].slice(0, 100));
    setErrors([]);
    setCorrectionsMade((n) => n + errors.length);
  }, [correctedText, errors]);

  const handleAddWord = useCallback(() => {
    const w = newWord.trim().toLowerCase();
    if (!w) return;
    chrome.runtime.sendMessage({ type: 'ADD_WORD', word: w });
    setCustomWords((prev) => prev.includes(w) ? prev : [...prev, w]);
    setNewWord('');
    // Re-check current text with new dictionary
    lastChecked.current = '';
  }, [newWord]);

  const total = errors.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(225,28%,7%)', color: 'hsl(220,20%,94%)', fontFamily: "'Inter',-apple-system,sans-serif", overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid hsl(225,20%,16%)', background: 'hsl(225,24%,9%,0.8)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
            <path d="M8 20L14 8L20 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 16H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs><linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
              <stop offset="0%" stopColor="hsl(250,80%,65%)" />
              <stop offset="100%" stopColor="hsl(210,80%,60%)" />
            </linearGradient></defs>
          </svg>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>Autocorrect</div>
            <div style={{ fontSize: 10, color: 'hsl(220,15%,55%)', marginTop: 1 }}>AI Writing Assistant</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLoading && <div style={{ width: 14, height: 14, border: '2px solid hsl(225,20%,28%)', borderTopColor: 'hsl(250,80%,65%)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
          {!isLoading && total > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'hsl(0,80%,65%,0.15)', color: 'hsl(0,80%,70%)', border: '1px solid hsl(0,70%,40%,0.3)', fontWeight: 600 }}>
              {total} issue{total !== 1 ? 's' : ''}
            </span>
          )}
          {!isLoading && total === 0 && correctionsMade === 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'hsl(150,60%,65%,0.15)', color: 'hsl(150,70%,60%)', border: '1px solid hsl(150,55%,35%,0.3)', fontWeight: 600 }}>
              ✓ Clean
            </span>
          )}
        </div>
      </header>

      {/* Editor textarea */}
      <div style={{ padding: '12px 14px 8px', flexShrink: 0 }}>
        {apiError && (
          <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 8, background: 'hsl(0,60%,12%)', border: '1px solid hsl(0,55%,30%)', color: 'hsl(0,80%,68%)', fontSize: 11 }}>
            ⚠️ {apiError}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Type or paste text to check spelling…\n\nExample: "I has went to the store and buyed apples."'}
          style={{
            width: '100%', height: 130, resize: 'none',
            background: 'hsl(225,22%,11%)', color: 'hsl(220,20%,92%)',
            border: '1px solid hsl(225,20%,20%)', borderRadius: 10,
            padding: '10px 12px', fontFamily: 'inherit', fontSize: 13,
            lineHeight: 1.6, outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'hsl(250,80%,65%)'}
          onBlur={(e) => e.target.style.borderColor = 'hsl(225,20%,20%)'}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 14px', gap: 2, borderBottom: '1px solid hsl(225,20%,16%)', flexShrink: 0 }}>
        {['errors', 'history', 'settings'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '7px 12px', fontSize: 12, fontWeight: 500,
            color: activeTab === tab ? 'hsl(250,80%,70%)' : 'hsl(220,15%,55%)',
            borderBottom: activeTab === tab ? '2px solid hsl(250,80%,65%)' : '2px solid transparent',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            {tab === 'errors'   && `Errors${errors.length > 0 ? ` (${errors.length})` : ''}`}
            {tab === 'history'  && 'History'}
            {tab === 'settings' && 'Settings'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>

        {/* ── Errors Tab ── */}
        {activeTab === 'errors' && (
          errors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'hsl(220,15%,50%)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>No errors found</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Your text looks great!</div>
            </div>
          ) : (
            <>
              {correctedText && (
                <button onClick={handleApplyAll} style={{
                  display: 'block', width: '100%', marginBottom: 10, padding: '8px 14px',
                  background: 'linear-gradient(135deg, hsl(250,70%,55%), hsl(250,80%,65%))',
                  color: 'white', border: 'none', borderRadius: 8, fontFamily: 'inherit',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}>
                  Fix All ({errors.length} issue{errors.length !== 1 ? 's' : ''})
                </button>
              )}
              {errors.map((error, i) => {
                const cfg = ERROR_CONFIG[error.error_type] || ERROR_CONFIG.spelling;
                const top = error.suggestions?.[0];
                return (
                  <div key={`${error.offset}-${i}`} style={{
                    background: 'hsl(225,22%,12%)', border: '1px solid hsl(225,20%,20%)',
                    borderRadius: 8, padding: '8px 10px', marginBottom: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <code style={{ color: cfg.color, fontSize: 12, fontWeight: 600 }}>{error.original}</code>
                      {top && <span style={{ fontSize: 11, color: 'hsl(220,15%,55%)' }}>→ <strong style={{ color: 'hsl(220,20%,80%)' }}>{top}</strong></span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(220,15%,55%)', marginBottom: 6 }}>{error.message}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {top && (
                        <button onClick={() => handleAccept(error, top)} style={{
                          padding: '3px 10px', borderRadius: 6, border: `1px solid ${cfg.borderColor}`,
                          background: cfg.bg, color: cfg.color, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                        }}>Accept</button>
                      )}
                      <button onClick={() => handleDismiss(error)} style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid hsl(225,20%,26%)',
                        background: 'transparent', color: 'hsl(220,15%,55%)',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                      }}>Ignore</button>
                    </div>
                  </div>
                );
              })}
            </>
          )
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'hsl(220,15%,50%)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>No history yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Accepted corrections appear here.</div>
            </div>
          ) : history.map((record, i) => (
            <div key={i} style={{
              background: 'hsl(225,22%,12%)', border: '1px solid hsl(225,20%,20%)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'hsl(220,15%,45%)' }}>{record.time}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'hsl(0,70%,65%,0.15)', color: 'hsl(0,70%,65%)', border: '1px solid hsl(0,60%,40%,0.3)' }}>{record.type}</span>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'hsl(0,80%,65%)' }}>"{record.original}"</span>
                <span style={{ color: 'hsl(220,15%,50%)', margin: '0 6px' }}>→</span>
                <span style={{ color: 'hsl(150,70%,60%)' }}>"{record.corrected}"</span>
              </div>
            </div>
          ))
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'settings' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'hsl(220,15%,70%)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Custom Dictionary</h3>
              <p style={{ fontSize: 11, color: 'hsl(220,15%,50%)', marginBottom: 10 }}>Add words that should not be flagged as spelling errors.</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddWord(); }}
                  placeholder="Add word…"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 7, border: '1px solid hsl(225,20%,22%)',
                    background: 'hsl(225,22%,11%)', color: 'hsl(220,20%,90%)',
                    fontFamily: 'inherit', fontSize: 12, outline: 'none',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'hsl(250,80%,65%)'}
                  onBlur={(e) => e.target.style.borderColor = 'hsl(225,20%,22%)'}
                />
                <button onClick={handleAddWord} disabled={!newWord.trim()} style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: 'hsl(250,70%,55%)', color: 'white',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  opacity: !newWord.trim() ? 0.45 : 1,
                }}>Add</button>
              </div>
              {customWords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                  {customWords.map((w) => (
                    <span key={w} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 99,
                      background: 'hsl(250,60%,20%)', border: '1px solid hsl(250,50%,35%)',
                      color: 'hsl(250,80%,80%)',
                    }}>{w}</span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'hsl(220,15%,70%)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legend</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(ERROR_CONFIG).map(([type, cfg]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-block', width: 28, borderBottom: `2px ${cfg.underline} ${cfg.color}` }} />
                    <span style={{ fontSize: 12, color: 'hsl(220,15%,65%)' }}>{cfg.icon} {cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: hsl(225,20%,28%); border-radius: 99px; }
      `}</style>
    </div>
  );
}
