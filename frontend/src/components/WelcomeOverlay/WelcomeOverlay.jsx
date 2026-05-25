import { useState, useEffect } from 'react';
import './WelcomeOverlay.css';

const STORAGE_KEY = 'autocorrect-welcomed-v1';

const FEATURES = [
  {
    icon: '🔤',
    title: 'Spelling Check',
    desc: 'Catches typos and misspellings instantly as you type, with smart suggestions.',
  },
  {
    icon: '📝',
    title: 'Grammar Analysis',
    desc: 'Powered by LanguageTool — detects grammar issues, punctuation, and style problems.',
  },
  {
    icon: '🧠',
    title: 'Contextual Correction',
    desc: "Uses Grammarly's CoEdIT AI model to fix context-aware errors humans miss.",
  },
];

const STEPS = [
  { icon: '✏️', text: 'Type or paste your text in the editor' },
  { icon: '👆', text: 'Click any highlighted word to see suggestions' },
  { icon: '✅', text: 'Accept corrections one-by-one or apply all at once' },
];

const SAMPLE_TEXT =
  "I has went to the store yesterday to buyed some apple's and a orange. The weather was extremly beautiful, so i decided to walking instead of taking the bus.";

export default function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="welcome-backdrop" aria-modal="true" role="dialog" aria-label="Welcome to Autocorrect">
      <div className="welcome-modal glass">
        {/* Logo */}
        <div className="welcome-logo" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="14" fill="url(#wl-grad)" />
            <path d="M13 34L24 14L35 34" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 28H31" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <defs>
              <linearGradient id="wl-grad" x1="0" y1="0" x2="48" y2="48">
                <stop offset="0%" stopColor="hsl(250,80%,65%)" />
                <stop offset="100%" stopColor="hsl(210,80%,60%)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="welcome-title">Welcome to Autocorrect</h2>
        <p className="welcome-subtitle">
          An AI-powered writing assistant that fixes spelling, grammar, and contextual errors in real time.
        </p>

        {/* Feature cards */}
        <div className="welcome-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="welcome-feature">
              <span className="welcome-feature-icon" aria-hidden="true">{f.icon}</span>
              <div>
                <strong>{f.title}</strong>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* How to use */}
        <div className="welcome-steps">
          <p className="welcome-steps-heading">How it works:</p>
          <ol className="welcome-steps-list">
            {STEPS.map((s, i) => (
              <li key={i}>
                <span aria-hidden="true">{s.icon}</span> {s.text}
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="welcome-actions">
          <button
            id="welcome-sample-btn"
            className="btn btn-ghost"
            onClick={() => {
              // Store sample text in sessionStorage for App to pick up on next render
              sessionStorage.setItem('autocorrect-sample', SAMPLE_TEXT);
              window.dispatchEvent(new CustomEvent('autocorrect:load-sample', { detail: SAMPLE_TEXT }));
              dismiss();
            }}
          >
            Try Sample Text
          </button>
          <button
            id="welcome-start-btn"
            className="btn btn-primary"
            onClick={dismiss}
            autoFocus
          >
            Start Writing →
          </button>
        </div>
      </div>
    </div>
  );
}
