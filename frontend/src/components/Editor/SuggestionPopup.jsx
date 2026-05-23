import { useEffect, useRef } from 'react';
import { ERROR_CONFIG } from '../../utils/errorTypes';
import './SuggestionPopup.css';

/**
 * Floating suggestion popup — appears above/below a clicked error.
 *
 * Props:
 *   error       — ErrorSuggestion object from API
 *   anchorRect  — DOMRect of the clicked span
 *   onAccept    — (error, suggestion) => void
 *   onDismiss   — (error) => void
 *   onClose     — () => void
 */
export default function SuggestionPopup({ error, anchorRect, onAccept, onDismiss, onClose }) {
  const popupRef = useRef(null);
  const cfg = ERROR_CONFIG[error.error_type] || ERROR_CONFIG.spelling;

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Position popup below (or above) the anchor span
  const style = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 280) + 'px',
    top:  anchorRect.bottom + 8 + 'px',
    zIndex: 1000,
  };

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={popupRef}
        className="suggestion-popup glass"
        style={style}
        role="dialog"
        aria-label="Correction suggestion"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="popup-header" style={{ borderColor: cfg.color }}>
          <span className="popup-type-icon" aria-hidden="true">{cfg.icon}</span>
          <span className="popup-type-label" style={{ color: cfg.color }}>{cfg.label} error</span>
          <button
            className="popup-close"
            onClick={onClose}
            aria-label="Close suggestion"
          >×</button>
        </div>

        {/* Message */}
        <p className="popup-message">{error.message}</p>

        {/* Original word */}
        <div className="popup-original">
          <span className="popup-original-label">Original:</span>
          <code className="popup-original-text" style={{ color: cfg.color }}>
            {error.original || '(empty)'}
          </code>
        </div>

        {/* Suggestions */}
        {error.suggestions && error.suggestions.length > 0 ? (
          <div className="popup-suggestions">
            <p className="popup-suggestions-label">Suggestions:</p>
            <div className="popup-suggestions-list">
              {error.suggestions.map((s, i) => (
                <button
                  key={i}
                  id={`suggestion-${error.offset}-${i}`}
                  className={`popup-suggestion-btn ${i === 0 ? 'popup-suggestion-btn--primary' : ''}`}
                  onClick={() => onAccept(error, s)}
                  style={i === 0 ? { borderColor: cfg.color, color: cfg.color } : {}}
                >
                  {i === 0 && <span className="suggestion-star" aria-hidden="true">★</span>}
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="popup-no-suggestions">No suggestions available.</p>
        )}

        {/* Actions */}
        <div className="popup-actions">
          <button
            id={`dismiss-${error.offset}`}
            className="btn btn-ghost btn-sm"
            onClick={() => onDismiss(error)}
          >
            Ignore
          </button>
        </div>
      </div>
    </>
  );
}
