import { useState, useCallback } from 'react';
import { CorrectionProvider, useCorrectionContext } from './context/CorrectionContext';
import Header from './components/Header/Header';
import Editor from './components/Editor/Editor';
import Sidebar from './components/Sidebar/Sidebar';
import { useAutocorrect } from './hooks/useAutocorrect';
import './App.css';

function AppContent() {
  const [text, setText]               = useState('');
  const [correctionsMade, setCorrectionsMade] = useState(0);
  const { addToHistory }              = useCorrectionContext();

  const {
    errors,
    correctedText,
    errorCounts,
    isLoading,
    apiError,
    acceptCorrection,
    dismissError,
  } = useAutocorrect(text, 600);

  const handleTextChange = useCallback((newText) => {
    setText(newText);
  }, []);

  const handleAccept = useCallback(
    (error, suggestion) => {
      setText((prevText) => {
        const before = prevText.slice(0, error.offset);
        const after  = prevText.slice(error.offset + error.length);
        return before + suggestion + after;
      });
      addToHistory({
        original:  error.original,
        corrected: suggestion,
        type:      error.error_type,
        time:      new Date().toLocaleTimeString(),
      });
      acceptCorrection(error);
      setCorrectionsMade((n) => n + 1);
    },
    [acceptCorrection, addToHistory]
  );

  const handleApplyAll = useCallback(() => {
    if (!correctedText) return;
    // Apply all: set the text to fully corrected version
    setText(correctedText);
    errors.forEach((e) => {
      if (e.suggestions && e.suggestions.length > 0) {
        addToHistory({
          original:  e.original,
          corrected: e.suggestions[0],
          type:      e.error_type,
          time:      new Date().toLocaleTimeString(),
        });
      }
      acceptCorrection(e);
    });
    setCorrectionsMade((n) => n + errors.length);
  }, [correctedText, errors, acceptCorrection, addToHistory]);

  return (
    <div className="app-layout">
      <Header
        isLoading={isLoading}
        errorCounts={errorCounts}
        correctionsMade={correctionsMade}
      />

      <main className="app-main" role="main">
        <div className="editor-container">
          {apiError && (
            <div className="api-error-banner" role="alert">
              <span>⚠️ API Error: {apiError}</span>
              <span className="api-error-hint">Make sure the backend is running on port 8000.</span>
            </div>
          )}
          <Editor
            text={text}
            errors={errors}
            onTextChange={handleTextChange}
            onAccept={handleAccept}
            onDismiss={dismissError}
          />
        </div>

        <Sidebar
          errors={errors}
          correctedText={correctedText}
          onAccept={handleAccept}
          onDismiss={dismissError}
          onApplyAll={handleApplyAll}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <CorrectionProvider>
      <AppContent />
    </CorrectionProvider>
  );
}
