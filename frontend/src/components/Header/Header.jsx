import './Header.css';

/**
 * Top navigation bar.
 */
export default function Header({ isLoading, errorCounts, correctionsMade }) {
  const total = Object.values(errorCounts || {}).reduce((a, b) => a + b, 0);

  return (
    <header className="header glass" role="banner">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
            <path d="M8 20L14 8L20 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 16H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                <stop offset="0%" stopColor="hsl(250,80%,65%)" />
                <stop offset="100%" stopColor="hsl(210,80%,60%)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <h1 className="header-title">Autocorrect</h1>
          <p className="header-subtitle">AI Writing Assistant</p>
        </div>
      </div>

      <div className="header-stats" role="status" aria-live="polite">
        {isLoading && (
          <div className="header-checking" aria-label="Checking text">
            <div className="spinner" aria-hidden="true" />
            <span>Checking…</span>
          </div>
        )}
        {!isLoading && total > 0 && (
          <>
            {errorCounts.spelling > 0 && (
              <div className="stat-pill stat-spell" title="Spelling errors">
                <span className="stat-dot" />
                <span>{errorCounts.spelling} spelling</span>
              </div>
            )}
            {errorCounts.grammar > 0 && (
              <div className="stat-pill stat-grammar" title="Grammar errors">
                <span className="stat-dot" />
                <span>{errorCounts.grammar} grammar</span>
              </div>
            )}
            {errorCounts.context > 0 && (
              <div className="stat-pill stat-context" title="Contextual suggestions">
                <span className="stat-dot" />
                <span>{errorCounts.context} context</span>
              </div>
            )}
          </>
        )}
        {!isLoading && total === 0 && correctionsMade === 0 && (
          <div className="stat-pill stat-clean" title="No errors found">
            <span>✓ Looking good</span>
          </div>
        )}
      </div>

      <div className="header-actions">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
          aria-label="View source on GitHub"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
      </div>
    </header>
  );
}
