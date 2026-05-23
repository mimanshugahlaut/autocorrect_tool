import { useState, useCallback, useMemo, useEffect } from 'react';
import { createEditor, Text, Transforms, Editor } from 'slate';
import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import SuggestionPopup from './SuggestionPopup';
import { ERROR_CONFIG } from '../../utils/errorTypes';
import './Editor.css';

const PLACEHOLDER = `Start typing here…

Example: "I has went to the store yesterday and buyed some apples."

Try spelling mistakes, grammar errors, or awkward phrasing — errors will be highlighted as you type.`;

const initialValue = [{ type: 'paragraph', children: [{ text: '' }] }];

/**
 * Extracts plain text from Slate's value array.
 */
function slateToPlainText(nodes) {
  return nodes.map((n) => n.children.map((c) => c.text).join('')).join('\n');
}

/**
 * Builds Slate decorations from error list.
 * Maps character offsets to Slate path+offset coordinates.
 */
function buildDecorations(errors, nodes) {
  const decorations = [];

  // Build a flat char-index → [path, offset] map
  let charIndex = 0;
  const charMap = []; // charMap[i] = { path, offset }

  nodes.forEach((node, ni) => {
    node.children.forEach((leaf, li) => {
      for (let ci = 0; ci < leaf.text.length; ci++) {
        charMap.push({ path: [ni, li], offset: ci });
        charIndex++;
      }
    });
    // newline between blocks
    if (ni < nodes.length - 1) {
      const lastLi = node.children.length - 1;
      const lastLeaf = node.children[lastLi];
      charMap.push({ path: [ni, lastLi], offset: lastLeaf.text.length });
    }
  });

  for (const error of errors) {
    const start = charMap[error.offset];
    const end   = charMap[Math.min(error.offset + error.length - 1, charMap.length - 1)];
    if (!start || !end) continue;

    decorations.push({
      anchor: { path: start.path, offset: start.offset },
      focus:  { path: end.path,   offset: end.offset + 1 },
      error,
    });
  }

  return decorations;
}

export default function EditorComponent({ text, errors, onTextChange, onAccept, onDismiss }) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [value, setValue]           = useState(initialValue);
  const [popupState, setPopupState] = useState(null); // { error, rect }

  // Sync external text updates (e.g. from Apply All or Sidebar) to Slate
  useEffect(() => {
    const currentPlainText = slateToPlainText(value);
    if (text !== currentPlainText) {
      const newValue = text.split('\n').map((line) => ({
        type: 'paragraph',
        children: [{ text: line }],
      }));
      setValue(newValue);
      
      Transforms.select(editor, {
        anchor: Editor.start(editor, []),
        focus:  Editor.end(editor, []),
      });
      editor.insertFragment(newValue.map((n) => ({ ...n })));
    }
  }, [text, editor]);

  const handleChange = useCallback(
    (newValue) => {
      setValue(newValue);
      onTextChange(slateToPlainText(newValue));
    },
    [onTextChange]
  );

  // Build decorations from errors
  const decorate = useCallback(
    ([node, path]) => {
      if (!Text.isText(node)) return [];
      return buildDecorations(errors, value).filter(
        (d) =>
          JSON.stringify(d.anchor.path) === JSON.stringify(path) ||
          JSON.stringify(d.focus.path)  === JSON.stringify(path)
      );
    },
    [errors, value]
  );

  // Render each leaf — applies wavy underline for errors
  const renderLeaf = useCallback(
    ({ attributes, children, leaf }) => {
      if (leaf.error) {
        const cfg = ERROR_CONFIG[leaf.error.error_type] || ERROR_CONFIG.spelling;
        return (
          <span
            {...attributes}
            className={`error-leaf error-leaf--${leaf.error.error_type}`}
            style={{
              textDecoration: `underline ${cfg.underline}`,
              textDecorationColor: cfg.color,
              textDecorationThickness: '2px',
              textUnderlineOffset: '3px',
              backgroundColor: cfg.bg,
              borderRadius: '2px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setPopupState({ error: leaf.error, rect });
            }}
            title={leaf.error.message}
          >
            {children}
          </span>
        );
      }
      return <span {...attributes}>{children}</span>;
    },
    []
  );

  const handleAccept = useCallback(
    (error, suggestion) => {
      // Apply correction in the Slate editor
      const text = slateToPlainText(value);
      const before = text.slice(0, error.offset);
      const after  = text.slice(error.offset + error.length);
      const newText = before + suggestion + after;

      // Replace entire content
      const newValue = newText.split('\n').map((line) => ({
        type: 'paragraph',
        children: [{ text: line }],
      }));
      Transforms.select(editor, {
        anchor: Editor.start(editor, []),
        focus:  Editor.end(editor, []),
      });
      editor.insertFragment(newValue.map((n) => ({ ...n })));

      onAccept(error, suggestion);
      setPopupState(null);
    },
    [editor, value, onAccept]
  );

  const handleDismiss = useCallback(
    (error) => {
      onDismiss(error);
      setPopupState(null);
    },
    [onDismiss]
  );

  return (
    <div className="editor-wrapper" onClick={() => setPopupState(null)}>
      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        <Editable
          id="main-editor"
          className="editor-editable"
          decorate={decorate}
          renderLeaf={renderLeaf}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoFocus
          aria-label="Text input area"
          aria-multiline="true"
          role="textbox"
        />
      </Slate>

      {popupState && (
        <SuggestionPopup
          error={popupState.error}
          anchorRect={popupState.rect}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onClose={() => setPopupState(null)}
        />
      )}
    </div>
  );
}
