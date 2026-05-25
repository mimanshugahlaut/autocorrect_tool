import { useState, useCallback, useEffect } from 'react';
import { CorrectionProvider, useCorrectionContext } from './context/CorrectionContext';
import Header from './components/Header/Header';
import Editor from './components/Editor/Editor';
import Sidebar from './components/Sidebar/Sidebar';
import Footer from './components/Footer/Footer';
import WelcomeOverlay from './components/WelcomeOverlay/WelcomeOverlay';
import { useAutocorrect } from './hooks/useAutocorrect';
import { getHealth } from './api/autocorrect';
import './App.css';

function AppContent() {
  const [text, setText]               = useState('');
  const [correctionsMade, setCorrectionsMade] = useState(0);
  const { addToHistory, dictionaryVersion, setBackendStatus, addCustomWord } = useCorrectionContext();

  // Listen for "Try Sample Text" from the WelcomeOverlay
  useEffect(() => {
    const handler = (e) => setText(e.detail);
    window.addEventListener('autocorrect:load-sample', handler);
    return () => window.removeEventListener('autocorrect:load-sample', handler);
  }, []);

  const {
    errors,
    correctedText,
    errorCounts,
    isLoading,
    apiError,
    acceptCorrection,
    dismissError,
  } = useAutocorrect(text, 600, dictionaryVersion);

  // Check backend health on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const health = await getHealth();
      if (mounted) {
        setBackendStatus(health ? 'online' : 'offline');
      }
    })();
    return () => { mounted = false; };
  }, [setBackendStatus]);

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

  const handleAddToDictionary = useCallback(async (word) => {
    await addCustomWord(word);
  }, [addCustomWord]);

  return (
    <>
      <WelcomeOverlay />
      <div className="app-layout">
        <Header
          isLoading={isLoading}
          errorCounts={errorCounts}
          correctionsMade={correctionsMade}
          wordCount={text.trim() ? text.trim().split(/\s+/).length : 0}
          charCount={text.length}
        />

        <main className="app-main" role="main">
          <div className="editor-container">
            {apiError && (
              <div className="api-error-banner" role="alert">
                <span>⚠️ {apiError}</span>
              </div>
            )}
            <Editor
              text={text}
              errors={errors}
              onTextChange={handleTextChange}
              onAccept={handleAccept}
              onDismiss={dismissError}
              onAddToDictionary={handleAddToDictionary}
            />
          </div>

          <Sidebar
            errors={errors}
            correctedText={correctedText}
            onAccept={handleAccept}
            onDismiss={dismissError}
            onApplyAll={handleApplyAll}
            onAddToDictionary={handleAddToDictionary}
          />
        </main>

        <Footer />
      </div>
    </>
  );
}

export default function App() {
  return (
    <CorrectionProvider>
      <AppContent />
    </CorrectionProvider>
  );
}
