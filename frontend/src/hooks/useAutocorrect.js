import { useState, useCallback, useRef } from 'react';
import { checkText } from '../api/autocorrect';
import { useDebounce } from './useDebounce';
import { useEffect } from 'react';

/**
 * Main autocorrect hook.
 * Accepts the plain text from the editor, debounces it, calls the API,
 * and returns structured error data + helper actions.
 *
 * @param {string} text - Current editor plain text
 * @param {number} debounceMs - API call debounce delay (default 600ms)
 */
export function useAutocorrect(text, debounceMs = 600) {
  const [errors, setErrors]             = useState([]);
  const [correctedText, setCorrectedText] = useState('');
  const [errorCounts, setErrorCounts]   = useState({});
  const [isLoading, setIsLoading]       = useState(false);
  const [apiError, setApiError]         = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const debouncedText = useDebounce(text, debounceMs);
  const lastChecked   = useRef('');

  useEffect(() => {
    if (!debouncedText || debouncedText === lastChecked.current) return;
    if (debouncedText.trim().length < 2) {
      setErrors([]);
      setCorrectedText('');
      setErrorCounts({});
      return;
    }

    let cancelled = false;

    async function runCheck() {
      setIsLoading(true);
      setApiError(null);
      try {
        const result = await checkText(debouncedText);
        if (!cancelled) {
          lastChecked.current = debouncedText;
          // Filter out user-dismissed errors
          const visible = result.errors.filter(
            (e) => !dismissedIds.has(errorKey(e))
          );
          setErrors(visible);
          setCorrectedText(result.corrected_text);
          setErrorCounts(result.error_counts || {});
        }
      } catch (err) {
        if (!cancelled) {
          setApiError(err.message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    runCheck();
    return () => { cancelled = true; };
  }, [debouncedText]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Accept a correction — removes the error from the list */
  const acceptCorrection = useCallback((error) => {
    setErrors((prev) => prev.filter((e) => errorKey(e) !== errorKey(error)));
  }, []);

  /** Dismiss an error without correcting */
  const dismissError = useCallback((error) => {
    setDismissedIds((prev) => new Set([...prev, errorKey(error)]));
    setErrors((prev) => prev.filter((e) => errorKey(e) !== errorKey(error)));
  }, []);

  /** Clear all dismissed IDs (e.g. on full re-check) */
  const clearDismissed = useCallback(() => setDismissedIds(new Set()), []);

  return {
    errors,
    correctedText,
    errorCounts,
    isLoading,
    apiError,
    acceptCorrection,
    dismissError,
    clearDismissed,
  };
}

function errorKey(e) {
  return `${e.offset}-${e.length}-${e.error_type}`;
}
