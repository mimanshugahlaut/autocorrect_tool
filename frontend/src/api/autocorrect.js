import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isCancel(err)) {
      return Promise.reject(new Error('Request cancelled'));
    }
    const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
    return Promise.reject(new Error(detail));
  }
);

/**
 * Check text for spelling, grammar, and contextual errors.
 * @param {string} text
 * @param {AbortSignal} [signal] - Optional AbortController signal
 * @returns {Promise<import('../utils/errorTypes').CheckResponse>}
 */
export async function checkText(text, signal) {
  const { data } = await api.post('/api/check', { text }, { signal });
  return data;
}

/**
 * Return fully corrected text.
 * @param {string} text
 * @param {AbortSignal} [signal]
 * @returns {Promise<{original_text: string, corrected_text: string, changes_made: number}>}
 */
export async function correctText(text, signal) {
  const { data } = await api.post('/api/correct', { text }, { signal });
  return data;
}

/**
 * Get correction history.
 * @param {number} limit
 * @param {number} offset
 */
export async function getHistory(limit = 50, offset = 0) {
  const { data } = await api.get('/api/history', { params: { limit, offset } });
  return data;
}

/**
 * Delete all correction history.
 */
export async function clearHistory() {
  const { data } = await api.delete('/api/history');
  return data;
}

/**
 * Add words to the custom dictionary.
 * @param {string[]} words
 */
export async function addDictionaryWords(words) {
  const { data } = await api.post('/api/dictionary', { words });
  return data;
}

/**
 * Get custom dictionary words.
 */
export async function getDictionaryWords() {
  const { data } = await api.get('/api/dictionary');
  return data;
}

/**
 * Remove a word from the custom dictionary.
 * @param {string} word
 */
export async function removeDictionaryWord(word) {
  const { data } = await api.delete(`/api/dictionary/${encodeURIComponent(word)}`);
  return data;
}

/**
 * Check API health. Returns null on failure (backend offline).
 * @returns {Promise<{status: string, grammar_checker: boolean, context_model: boolean, supabase: boolean} | null>}
 */
export async function getHealth() {
  try {
    const { data } = await api.get('/api/health', { timeout: 3000 });
    return data;
  } catch {
    return null;
  }
}
