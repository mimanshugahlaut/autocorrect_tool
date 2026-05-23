/** Error type constants used across the app */
export const ERROR_TYPES = {
  SPELLING: 'spelling',
  GRAMMAR:  'grammar',
  CONTEXT:  'context',
};

/** Visual properties per error type */
export const ERROR_CONFIG = {
  spelling: {
    label:       'Spelling',
    badgeClass:  'badge-spell',
    color:       'var(--spell-color)',
    bg:          'var(--spell-bg)',
    borderColor: 'hsl(0, 70%, 50%)',
    icon:        '✏️',
    underline:   'wavy',
  },
  grammar: {
    label:       'Grammar',
    badgeClass:  'badge-grammar',
    color:       'var(--grammar-color)',
    bg:          'var(--grammar-bg)',
    borderColor: 'hsl(210, 70%, 55%)',
    icon:        '📝',
    underline:   'wavy',
  },
  context: {
    label:       'Context',
    badgeClass:  'badge-context',
    color:       'var(--context-color)',
    bg:          'var(--context-bg)',
    borderColor: 'hsl(42, 70%, 50%)',
    icon:        '🤖',
    underline:   'dashed',
  },
};

/** Format a timestamp for display */
export function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString(undefined, {
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}
