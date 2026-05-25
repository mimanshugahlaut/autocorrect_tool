import { useState, useCallback, useRef, useEffect } from 'react';
import { checkText } from '../api/autocorrect';
import { useDebounce } from './useDebounce';

/**
 * Main autocorrect hook.
 * Accepts the plain text from the editor, debounces it, calls the API,
 * and returns structured error data + helper actions.
 *
 * @param {string}  text          - Current editor plain text
 * @param {number}  debounceMs    - API call debounce delay (default 600ms)
 * @param {number}  recheckSignal - Increment to force a re-check (e.g. after dictionary update)
 */
export function useAutocorrect(text, debounceMs = 600, recheckSignal = 0) {
  const [errors, setErrors]               = useState([]);
  const [correctedText, setCorrectedText] = useState('');
  const [errorCounts, setErrorCounts]     = useState({});
  const [isLoading, setIsLoading]         = useState(false);
  const [apiError, setApiError]           = useState(null);
  const [dismissedIds, setDismissedIds]   = useState(new Set());

  const debouncedText  = useDebounce(text, debounceMs);
  const lastChecked    = useRef('');
  const abortRef       = useRef(null);

  useEffect(() => {
    const checkKey = `${recheckSignal}:${debouncedText}`;
    if (!debouncedText || checkKey === lastChecked.current) return;

    if (debouncedText.trim().length < 2) {
      setErrors([]);
      setCorrectedText('');
      setErrorCounts({});
      setApiError(null);
      lastChecked.current = checkKey;
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    async function runCheck(retries = 1) {
      setIsLoading(true);
      setApiError(null);
      try {
        const result = await checkText(debouncedText, controller.signal);

        lastChecked.current = checkKey;
        // Filter out user-dismissed errors
        const visible = result.errors.filter((e) => !dismissedIds.has(errorKey(e)));
        setErrors(visible);
        setCorrectedText(result.corrected_text);
        setErrorCounts(result.error_counts || {});
      } catch (err) {
        if (err.message === 'Request cancelled') return; // Intentional abort — don't show error

        if (retries > 0) {
          // One retry after 800ms for transient failures
          await new Promise((r) => setTimeout(r, 800));
          if (!controller.signal.aborted) {
            return runCheck(retries - 1);
          }
          return;
        }

        // User-friendly error messages
        let msg = err.message;
        if (msg.includes('Network Error') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
          msg = 'Cannot reach the backend. Make sure it is running on port 8000.';
        } else if (msg.includes('429')) {
          msg = 'Too many requests. Please wait a moment before typing again.';
        }
        setApiError(msg);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    runCheck();

    return () => {
      controller.abort();
    };
  }, [debouncedText, recheckSignal]); // eslint-disable-line react-hooks/exhaustive-deps

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
  return `${e.offset}-${e.length}-${e.original}-${e.error_type}`;
}
