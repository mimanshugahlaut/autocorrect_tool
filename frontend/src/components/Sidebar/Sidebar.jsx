import { useState } from 'react';
import { ERROR_CONFIG } from '../../utils/errorTypes';
import { useCorrectionContext } from '../../context/CorrectionContext';
import './Sidebar.css';

/**
 * Right sidebar with three tabs: Errors | History | Settings
 */
export default function Sidebar({
  errors,
  correctedText,
  onAccept,
  onDismiss,
  onApplyAll,
  onAddToDictionary,
}) {
  const {
    sidebarTab,
    setSidebarTab,
    sessionHistory,
    clearHistory,
    customWords,
    addCustomWord,
  } = useCorrectionContext();

  const [newWord, setNewWord]           = useState('');
  const [dictionaryError, setDictionaryError] = useState('');
  const [isSavingWord, setIsSavingWord] = useState(false);

  const grouped = {
    spelling: errors.filter((e) => e.error_type === 'spelling'),
    grammar:  errors.filter((e) => e.error_type === 'grammar'),
    context:  errors.filter((e) => e.error_type === 'context'),
  };

  const handleAddWord = async (word) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    setIsSavingWord(true);
    setDictionaryError('');
    try {
      await addCustomWord(clean);
      setNewWord('');
    } catch (err) {
      setDictionaryError(err.message || 'Could not add word.');
    } finally {
      setIsSavingWord(false);
    }
  };

  return (
    <aside className="sidebar glass" aria-label="Corrections panel">
      {/* Tabs */}
      <div className="sidebar-tabs" role="tablist">
        {['errors', 'history', 'settings'].map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            role="tab"
            aria-selected={sidebarTab === tab}
            className={`sidebar-tab ${sidebarTab === tab ? 'sidebar-tab--active' : ''}`}
            onClick={() => setSidebarTab(tab)}
          >
            {tab === 'errors'   && `Errors${errors.length > 0 ? ` (${errors.length})` : ''}`}
            {tab === 'history'  && `History${sessionHistory.length > 0 ? ` (${sessionHistory.length})` : ''}`}
            {tab === 'settings' && 'Settings'}
          </button>
        ))}
      </div>

      {/* ── Errors Tab ─────────────────────────────────────────────── */}
      {sidebarTab === 'errors' && (
        <div className="sidebar-content" role="tabpanel" aria-labelledby="tab-errors">
          {errors.length === 0 ? (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon" aria-hidden="true">✓</div>
              <p>No errors found</p>
              <span>Your text looks great!</span>
            </div>
          ) : (
            <>
              {correctedText && (
                <button
                  id="apply-all-btn"
                  className="btn btn-primary apply-all-btn"
                  onClick={onApplyAll}
                >
                  ✦ Apply All Corrections ({errors.length})
                </button>
              )}
              {Object.entries(grouped).map(([type, errs]) =>
                errs.length === 0 ? null : (
                  <div key={type} className="error-group">
                    <div className="error-group-header">
                      <span className={`badge badge-${type === 'spelling' ? 'spell' : type}`}>
                        {ERROR_CONFIG[type]?.icon} {ERROR_CONFIG[type]?.label}
                      </span>
                      <span className="error-group-count">{errs.length}</span>
                    </div>
                    {errs.map((error, i) => (
                      <ErrorCard
                        key={`${error.offset}-${i}`}
                        error={error}
                        onAccept={onAccept}
                        onDismiss={onDismiss}
                        onAddToDictionary={onAddToDictionary}
                      />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* ── History Tab ────────────────────────────────────────────── */}
      {sidebarTab === 'history' && (
        <div className="sidebar-content" role="tabpanel" aria-labelledby="tab-history">
          {sessionHistory.length === 0 ? (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon" aria-hidden="true">📋</div>
              <p>No history yet</p>
              <span>Accepted corrections will appear here.</span>
            </div>
          ) : (
            <>
              <button
                className="btn btn-ghost btn-sm clear-history-btn"
                onClick={clearHistory}
                id="clear-history-btn"
              >
                Clear History
              </button>
              {sessionHistory.map((record, i) => (
                <div key={i} className="history-card">
                  <div className="history-meta">
                    <span className="history-time">{record.time}</span>
                    <span className="history-badge">{record.type}</span>
                  </div>
                  <div className="history-original">"{record.original}"</div>
                  <div className="history-arrow">→</div>
                  <div className="history-corrected">"{record.corrected}"</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Settings Tab ───────────────────────────────────────────── */}
      {sidebarTab === 'settings' && (
        <div className="sidebar-content" role="tabpanel" aria-labelledby="tab-settings">
          <div className="settings-section">
            <h3 className="settings-heading">Custom Dictionary</h3>
            <p className="settings-description">
              Add words that should not be flagged as spelling errors.
            </p>
            <form
              className="dictionary-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await handleAddWord(newWord);
              }}
            >
              <input
                id="custom-word-input"
                type="text"
                className="dictionary-input"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Add word…"
                aria-label="Add word to custom dictionary"
              />
              <button
                id="add-word-btn"
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!newWord.trim() || isSavingWord}
              >
                {isSavingWord ? '…' : 'Add'}
              </button>
            </form>

            {dictionaryError && (
              <p className="settings-error" role="alert">{dictionaryError}</p>
            )}

            {customWords.length > 0 && (
              <div className="dictionary-list" aria-label="Custom dictionary words">
                {customWords.map((word) => (
                  <span key={word} className="dictionary-tag">{word}</span>
                ))}
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3 className="settings-heading">Legend</h3>
            <div className="legend">
              {Object.entries(ERROR_CONFIG).map(([type, cfg]) => (
                <div key={type} className="legend-item">
                  <span
                    className="legend-line"
                    style={{
                      borderBottom: `2px ${cfg.underline} ${cfg.color}`,
                      display: 'inline-block',
                      width: 32,
                    }}
                    aria-hidden="true"
                  />
                  <span className="legend-label">{cfg.icon} {cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ErrorCard({ error, onAccept, onDismiss, onAddToDictionary }) {
  const cfg = ERROR_CONFIG[error.error_type] || ERROR_CONFIG.spelling;
  const topSuggestion = error.suggestions?.[0];

  return (
    <div className="error-card" style={{ '--error-color': cfg.color }}>
      <div className="error-card-original">
        <code style={{ color: cfg.color }}>{error.original}</code>
        {topSuggestion && (
          <span className="error-card-arrow">→ <strong>{topSuggestion}</strong></span>
        )}
      </div>
      <p className="error-card-message">{error.message}</p>
      <div className="error-card-actions">
        {topSuggestion && (
          <button
            id={`accept-${error.offset}`}
            className="btn btn-sm"
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.borderColor}`,
            }}
            onClick={() => onAccept(error, topSuggestion)}
          >
            Accept
          </button>
        )}
        <button
          id={`dismiss-sidebar-${error.offset}`}
          className="btn btn-ghost btn-sm"
          onClick={() => onDismiss(error)}
        >
          Ignore
        </button>
        {error.error_type === 'spelling' && onAddToDictionary && (
          <button
            id={`add-dict-${error.offset}`}
            className="btn btn-ghost btn-sm btn-add-dict"
            onClick={() => onAddToDictionary(error.original)}
            title="Add to custom dictionary — won't be flagged again"
          >
            + Dict
          </button>
        )}
      </div>
    </div>
  );
}
