import { useEffect, useRef } from 'react';
import { ERROR_CONFIG } from '../../utils/errorTypes';
import './SuggestionPopup.css';

/**
 * Floating suggestion popup — appears above/below a clicked error.
 *
 * Props:
 *   error              — ErrorSuggestion object from API
 *   anchorRect         — DOMRect of the clicked span
 *   onAccept           — (error, suggestion) => void
 *   onDismiss          — (error) => void
 *   onClose            — () => void
 *   onAddToDictionary  — (word) => void  (only for spelling errors)
 */
export default function SuggestionPopup({
  error,
  anchorRect,
  onAccept,
  onDismiss,
  onClose,
  onAddToDictionary,
}) {
  const popupRef = useRef(null);
  const cfg = ERROR_CONFIG[error.error_type] || ERROR_CONFIG.spelling;

  // Close on Escape, keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Arrow keys to cycle suggestions
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && popupRef.current) {
        const btns = [...popupRef.current.querySelectorAll('.popup-suggestion-btn')];
        if (!btns.length) return;
        const idx = btns.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown'
          ? (idx + 1) % btns.length
          : (idx - 1 + btns.length) % btns.length;
        btns[next]?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Smart positioning: show below, flip above if not enough space
  const POPUP_WIDTH  = 280;
  const POPUP_HEIGHT = 220; // rough estimate
  const MARGIN       = 8;

  const left = Math.max(
    MARGIN,
    Math.min(anchorRect.left, window.innerWidth - POPUP_WIDTH - MARGIN)
  );

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const top = spaceBelow >= POPUP_HEIGHT + MARGIN
    ? anchorRect.bottom + MARGIN
    : anchorRect.top - POPUP_HEIGHT - MARGIN;

  const style = {
    position: 'fixed',
    left: `${left}px`,
    top:  `${Math.max(MARGIN, top)}px`,
    zIndex: 1000,
    width: POPUP_WIDTH,
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
          {error.error_type === 'spelling' && onAddToDictionary && (
            <button
              id={`add-dict-popup-${error.offset}`}
              className="btn btn-ghost btn-sm popup-add-dict-btn"
              onClick={() => {
                onAddToDictionary(error.original);
                onClose();
              }}
              title="Add to custom dictionary — won't be flagged again"
            >
              + Dictionary
            </button>
          )}
        </div>
      </div>
    </>
  );
}
