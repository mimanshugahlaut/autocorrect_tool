import { useState, useEffect, useRef } from 'react';

/**
 * Debounces a value by `delay` ms.
 * Timer resets on every change.
 *
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds (default 500)
 * @returns debounced value
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return debouncedValue;
}
