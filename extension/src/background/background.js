/**
 * Background service worker.
 * Loads nspell + dictionary files (from extension's dict/ folder) once at startup,
 * then handles CHECK_TEXT / ADD_WORD messages from popup and content scripts.
 *
 * Message in:  { type: 'CHECK_TEXT', text: string }
 * Message out: { ok: true, data: CheckResponse }  |  { ok: false, error: string }
 */

import nspell from 'nspell';

// ── State ────────────────────────────────────────────────────────────────────
let spell = null;
let initPromise = null;
const customWords = new Set();
const BACKEND_URLS = ['http://127.0.0.1:8000', 'http://localhost:8000'];

// ── Init ─────────────────────────────────────────────────────────────────────
async function initSpell() {
  if (spell) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
      const base = chrome.runtime.getURL('dict/');
      console.debug('background: loading dict from', base);
      const [affRes, dicRes] = await Promise.all([
        fetch(base + 'en.aff'),
        fetch(base + 'en.dic'),
      ]);
      const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
      console.debug('background: loaded dict lengths', aff && aff.length, dic && dic.length);
      try {
        spell = nspell({ aff, dic });
      } catch (err) {
        console.error('background: nspell parse error', err, { affLength: aff && aff.length, dicLength: dic && dic.length });
        throw err;
      }

    // Re-add persisted custom words
    const stored = await chrome.storage.local.get(['customWords']);
    for (const w of stored.customWords || []) {
      customWords.add(w);
      spell.add(w);
    }
  })();

  return initPromise;
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
const TOKEN_RE = /[A-Za-z']+/g;

// ── Lightweight grammar rules (offline only) ─────────────────────────────────
const LIGHT_RULES = [
  { re: /\bi\b/g,              fix: 'I',    type: 'grammar', msg: 'Lowercase "i" should be capitalized.' },
  { re: /\ba ([aeiouAEIOU])/g, fix: 'an $1',type: 'grammar', msg: 'Use "an" before a vowel sound.' },
  { re: /\b(\w+) \1\b/gi,      fix: '$1',   type: 'context', msg: 'Repeated word.' },
];

function runLightweightRules(text) {
  const extra = [];
  for (const rule of LIGHT_RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      extra.push({
        offset:      m.index,
        length:      m[0].length,
        original:    m[0],
        suggestions: [m[0].replace(new RegExp(rule.re.source, rule.re.flags), rule.fix)],
        error_type:  rule.type,
        message:     rule.msg,
        rule_id:     'LIGHTWEIGHT',
      });
    }
  }
  return extra;
}

function runCheck(text) {
  const errors = [];
  TOKEN_RE.lastIndex = 0;
  let m;

  while ((m = TOKEN_RE.exec(text)) !== null) {
    const word = m[0];
    if (word.length <= 1) continue;
    const lower = word.toLowerCase();

    if (!spell.correct(lower)) {
      const raw = spell.suggest(lower) || [];
      const seen = new Set();
      const suggestions = [];
      for (const s of raw) {
        if (!seen.has(s) && s !== lower) {
          seen.add(s);
          suggestions.push(s);
          if (suggestions.length === 5) break;
        }
      }

      errors.push({
        offset:     m.index,
        length:     word.length,
        original:   word,
        suggestions,
        error_type: 'spelling',
        message:    `"${word}" may be misspelled.`,
        rule_id:    'SPELL_CHECK',
      });
    }
  }

  // Apply lightweight grammar/context rules in offline mode
  errors.push(...runLightweightRules(text));
  errors.sort((a, b) => a.offset - b.offset);

  // Build corrected text (apply top suggestions in reverse order)
  let corrected = text;
  const sorted = [...errors].sort((a, b) => b.offset - a.offset);
  for (const e of sorted) {
    if (e.suggestions.length > 0) {
      corrected =
        corrected.slice(0, e.offset) +
        e.suggestions[0] +
        corrected.slice(e.offset + e.length);
    }
  }

  const counts = {};
  for (const e of errors) counts[e.error_type] = (counts[e.error_type] || 0) + 1;

  return {
    original_text: text,
    errors,
    corrected_text: corrected,
    error_counts: counts,
  };
}

// ── Simple LRU cache for backend results ─────────────────────────────────────
const CACHE_SIZE = 5;
const resultCache = new Map();
function cacheGet(text) { return resultCache.get(text) || null; }
function cacheSet(text, result) {
  if (resultCache.size >= CACHE_SIZE) resultCache.delete(resultCache.keys().next().value);
  resultCache.set(text, result);
}

async function checkViaBackend(text) {
  // Return cached result if available
  const cached = cacheGet(text);
  if (cached) return cached;

  for (const baseUrl of BACKEND_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${baseUrl}/api/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (response.ok) {
        const result = await response.json();
        cacheSet(text, result);
        return result;
      }
    } catch {
      // Fall through to the next backend URL, then offline mode.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CHECK_TEXT') {
    (async () => {
      try {
        const backendResult = await checkViaBackend(msg.text);
        if (backendResult) {
          sendResponse({ ok: true, data: backendResult, source: 'backend' });
          return;
        }

        await initSpell();
        sendResponse({ ok: true, data: runCheck(msg.text), source: 'offline' });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // keep message channel open for async response
  }

  if (msg.type === 'ADD_WORD') {
    (async () => {
      try {
        await initSpell();
        const w = (msg.word || '').toLowerCase().trim();
        if (w && !customWords.has(w)) {
          customWords.add(w);
          spell.add(w);
          const stored = await chrome.storage.local.get(['customWords']);
          const list = stored.customWords || [];
          await chrome.storage.local.set({ customWords: [...list, w] });
          // Sync to backend (best effort)
          for (const baseUrl of BACKEND_URLS) {
            fetch(`${baseUrl}/api/dictionary`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ words: [w] }),
            }).catch(() => {});
          }
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});

// ── Pre-warm on install / startup ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => { initSpell(); });
chrome.runtime.onStartup.addListener(()   => { initSpell(); });
