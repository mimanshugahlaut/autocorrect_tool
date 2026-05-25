import { createContext, useContext, useState, useCallback } from 'react';
import { addDictionaryWords } from '../api/autocorrect';

const CorrectionContext = createContext(null);

/**
 * Global state for corrections, settings, and history.
 */
export function CorrectionProvider({ children }) {
  // Applied corrections history (session)
  const [sessionHistory, setSessionHistory] = useState([]);
  // Custom dictionary (session + API-backed)
  const [customWords, setCustomWords]       = useState([]);
  const [dictionaryVersion, setDictionaryVersion] = useState(0);
  // Active tab in sidebar
  const [sidebarTab, setSidebarTab] = useState('errors'); // 'errors' | 'history' | 'settings'
  // Backend connection status
  const [backendStatus, setBackendStatus] = useState('unknown'); // 'online' | 'offline' | 'unknown'

  const addToHistory = useCallback((record) => {
    setSessionHistory((prev) => [record, ...prev].slice(0, 100));
  }, []);

  const clearHistory = useCallback(() => {
    setSessionHistory([]);
  }, []);

  /**
   * Add a word to the custom dictionary.
   * Calls the API and bumps dictionaryVersion to trigger a re-check.
   * @param {string} word
   * @returns {Promise<void>}
   */
  const addCustomWord = useCallback(async (word) => {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    // Optimistic update — add immediately to the UI
    setCustomWords((prev) =>
      prev.includes(clean) ? prev : [...prev, clean]
    );
    // Persist to the backend (don't block the UI if it fails)
    try {
      await addDictionaryWords([clean]);
    } catch {
      // Best-effort — the spell checker in-memory still has the word for this session
    }
    // Bump version to trigger re-check with the updated dictionary
    setDictionaryVersion((v) => v + 1);
  }, []);

  return (
    <CorrectionContext.Provider
      value={{
        sessionHistory,
        addToHistory,
        clearHistory,
        customWords,
        addCustomWord,
        dictionaryVersion,
        sidebarTab,
        setSidebarTab,
        backendStatus,
        setBackendStatus,
      }}
    >
      {children}
    </CorrectionContext.Provider>
  );
}

export function useCorrectionContext() {
  const ctx = useContext(CorrectionContext);
  if (!ctx) throw new Error('useCorrectionContext must be inside CorrectionProvider');
  return ctx;
}
