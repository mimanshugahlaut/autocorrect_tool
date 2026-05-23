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
    const detail = err.response?.data?.detail || err.response?.data?.error || err.message;
    return Promise.reject(new Error(detail));
  }
);

/**
 * Check text for spelling, grammar, and contextual errors.
 * @param {string} text
 * @returns {Promise<import('../utils/errorTypes').CheckResponse>}
 */
export async function checkText(text) {
  const { data } = await api.post('/api/check', { text });
  return data;
}

/**
 * Return fully corrected text.
 * @param {string} text
 * @returns {Promise<{original_text: string, corrected_text: string, changes_made: number}>}
 */
export async function correctText(text) {
  const { data } = await api.post('/api/correct', { text });
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
 * Check API health.
 */
export async function getHealth() {
  const { data } = await api.get('/api/health');
  return data;
}
