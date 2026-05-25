/**
 * Content script.
 * Injects an ✏️ autocorrect button next to every <textarea> and
 * [contenteditable] element on the page.
 */
import './content.css';

const ATTR = 'data-ac-bound';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getFieldText(el) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
  return el.innerText || el.textContent || '';
}

function setFieldText(el, text) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ) || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    nativeInputValueSetter?.set?.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.innerText = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ── Debounce ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Result panel ─────────────────────────────────────────────────────────────
function createPanel(field, errors, correctedText) {
  // Remove any existing panel for this field
  removePanel(field);

  if (errors.length === 0) {
    showToast('✓ No writing issues found!', 'success');
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'ac-panel';
  panel.setAttribute('data-ac-panel', '');

  // Header
  const header = document.createElement('div');
  header.className = 'ac-panel-header';
  header.innerHTML = `
    <span class="ac-panel-title">✏️ ${errors.length} writing ${errors.length === 1 ? 'issue' : 'issues'}</span>
    <button class="ac-panel-close" title="Close">✕</button>
  `;
  panel.appendChild(header);

  // Apply all button
  if (correctedText) {
    const applyAll = document.createElement('button');
    applyAll.className = 'ac-btn ac-btn-primary';
    applyAll.textContent = `Fix all (${errors.length})`;
    applyAll.addEventListener('click', () => {
      setFieldText(field, correctedText);
      removePanel(field);
      showToast(`✓ Fixed ${errors.length} ${errors.length === 1 ? 'issue' : 'issues'}!`, 'success');
    });
    panel.appendChild(applyAll);
  }

  // Error cards
  const list = document.createElement('div');
  list.className = 'ac-error-list';

  for (const error of errors) {
    const card = document.createElement('div');
    card.className = 'ac-error-card';
    card.innerHTML = `
      <div class="ac-error-word">"<strong>${escapeHtml(error.original)}</strong>"</div>
      <div class="ac-error-suggestions"></div>
    `;

    const sugDiv = card.querySelector('.ac-error-suggestions');
    for (const sug of error.suggestions.slice(0, 4)) {
      const btn = document.createElement('button');
      btn.className = 'ac-sug-btn';
      btn.textContent = sug;
      btn.addEventListener('click', () => {
        const text = getFieldText(field);
        const newText =
          text.slice(0, error.offset) + sug + text.slice(error.offset + error.length);
        setFieldText(field, newText);
        // Adjust subsequent error offsets
        const delta = sug.length - error.length;
        for (const e of errors) {
          if (e.offset > error.offset) e.offset += delta;
        }
        // Remove card
        card.remove();
        // Update header count
        const remaining = panel.querySelectorAll('.ac-error-card').length;
        panel.querySelector('.ac-panel-title').textContent =
          `✏️ ${remaining} writing ${remaining === 1 ? 'issue' : 'issues'}`;
        if (remaining === 0) {
          removePanel(field);
          showToast('✓ All issues fixed!', 'success');
        }
      });
      sugDiv.appendChild(btn);
    }

    list.appendChild(card);
  }

  panel.appendChild(list);

  // Close button
  header.querySelector('.ac-panel-close').addEventListener('click', () => removePanel(field));

  // Position panel
  document.body.appendChild(panel);
  positionPanel(panel, field);

  // Store reference
  field._acPanel = panel;
}

function positionPanel(panel, field) {
  const rect = field.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  let top = rect.bottom + scrollTop + 6;
  let left = rect.left + scrollLeft;

  // Keep within viewport
  const panelW = 300;
  if (left + panelW > window.innerWidth) left = window.innerWidth - panelW - 12;
  if (left < 8) left = 8;

  panel.style.top  = `${top}px`;
  panel.style.left = `${left}px`;
}

function removePanel(field) {
  if (field._acPanel) {
    field._acPanel.remove();
    field._acPanel = null;
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.querySelector('.ac-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `ac-toast ac-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('ac-toast-visible'));
  setTimeout(() => {
    toast.classList.remove('ac-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Check button ─────────────────────────────────────────────────────────────
function injectButton(field) {
  if (field.hasAttribute(ATTR)) return;
  field.setAttribute(ATTR, '1');

  const btn = document.createElement('button');
  btn.className = 'ac-check-btn';
  btn.title = 'Check writing (Autocorrect)';
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  `;

  let checking = false;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (checking) return;

    const text = getFieldText(field);
    if (!text.trim() || text.trim().length < 2) {
      showToast('Type some text first!', 'info');
      return;
    }

    checking = true;
    btn.classList.add('ac-check-btn--loading');
    removePanel(field);

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CHECK_TEXT', text }, resolve);
      });

      if (response?.ok) {
        createPanel(field, response.data.errors, response.data.corrected_text);
      } else {
        showToast('Check failed. Try again.', 'error');
      }
    } catch {
      showToast('Extension error. Please reload.', 'error');
    } finally {
      checking = false;
      btn.classList.remove('ac-check-btn--loading');
    }
  });

  // Position button as an overlay at the bottom-right of the field
  positionButton(btn, field);
  document.body.appendChild(btn);

  // Reposition on scroll/resize
  const reposition = debounce(() => positionButton(btn, field), 100);
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });

  // Hide when field is not visible
  const obs = new IntersectionObserver(([entry]) => {
    btn.style.display = entry.isIntersecting ? 'flex' : 'none';
  });
  obs.observe(field);

  field._acBtn = btn;
}

function positionButton(btn, field) {
  const rect = field.getBoundingClientRect();
  const scrollTop  = window.scrollY  || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX  || document.documentElement.scrollLeft;

  // Clamp to field bounds
  if (rect.width < 60 || rect.height < 24) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';

  btn.style.top  = `${rect.bottom + scrollTop  - 28}px`;
  btn.style.left = `${rect.right  + scrollLeft - 36}px`;
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Bind fields ───────────────────────────────────────────────────────────────
function bindFields() {
  const selectors = 'textarea, [contenteditable="true"], [contenteditable=""]';
  document.querySelectorAll(selectors).forEach((el) => {
    // Skip very small or hidden fields
    const rect = el.getBoundingClientRect();
    if (rect.width < 60 || rect.height < 24) return;
    // Skip password/hidden inputs
    if (el.type === 'password' || el.type === 'hidden') return;
    injectButton(el);
  });
}

// ── MutationObserver — catch dynamically added inputs ─────────────────────────
const observer = new MutationObserver(debounce(bindFields, 400));
observer.observe(document.body, { childList: true, subtree: true });

// ── Initial bind ──────────────────────────────────────────────────────────────
bindFields();
