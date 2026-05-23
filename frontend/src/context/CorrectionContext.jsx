import { createContext, useContext, useState, useCallback } from 'react';

const CorrectionContext = createContext(null);

/**
 * Global state for corrections, settings, and history.
 */
export function CorrectionProvider({ children }) {
  // Applied corrections history (session)
  const [sessionHistory, setSessionHistory] = useState([]);
  // Custom dictionary (session)
  const [customWords, setCustomWords] = useState([]);
  // Active tab in sidebar
  const [sidebarTab, setSidebarTab] = useState('errors'); // 'errors' | 'history' | 'settings'

  const addToHistory = useCallback((record) => {
    setSessionHistory((prev) => [record, ...prev].slice(0, 100));
  }, []);

  const addCustomWord = useCallback((word) => {
    setCustomWords((prev) =>
      prev.includes(word.toLowerCase()) ? prev : [...prev, word.toLowerCase()]
    );
  }, []);

  return (
    <CorrectionContext.Provider
      value={{
        sessionHistory,
        addToHistory,
        customWords,
        addCustomWord,
        sidebarTab,
        setSidebarTab,
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
