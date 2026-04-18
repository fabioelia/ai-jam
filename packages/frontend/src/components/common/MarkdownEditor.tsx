import { useState, useRef, useCallback, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ViewMode = 'split' | 'edit' | 'preview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = '70vh',
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<ViewMode>(readOnly ? 'preview' : 'split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Sync scroll positions between editor and preview
  const handleEditorScroll = useCallback(() => {
    if (mode !== 'split' || !textareaRef.current || !previewRef.current) return;
    const editor = textareaRef.current;
    const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    const preview = previewRef.current;
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  }, [mode]);

  // Handle tab key for indentation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;

        if (e.shiftKey) {
          // Outdent: remove leading 2 spaces from selected lines
          const before = value.substring(0, start);
          const selected = value.substring(start, end);
          const lineStart = before.lastIndexOf('\n') + 1;
          const prefix = value.substring(lineStart, start);
          const fullSelected = prefix + selected;
          const outdented = fullSelected.replace(/^  /gm, '');
          const diff = fullSelected.length - outdented.length;
          const next = value.substring(0, lineStart) + outdented + value.substring(end);
          onChange(next);
          requestAnimationFrame(() => {
            ta.selectionStart = Math.max(lineStart, start - (prefix.startsWith('  ') ? 2 : 0));
            ta.selectionEnd = end - diff;
          });
        } else {
          // Indent
          const next = value.substring(0, start) + '  ' + value.substring(end);
          onChange(next);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 2;
          });
        }
      }
    },
    [value, onChange]
  );

  // Reset textarea scroll when switching modes
  useEffect(() => {
    if (textareaRef.current && mode !== 'preview') {
      textareaRef.current.scrollTop = 0;
    }
  }, [mode]);

  const modeButtons: { key: ViewMode; label: string }[] = readOnly
    ? [{ key: 'preview', label: 'Preview' }, { key: 'edit', label: 'Source' }]
    : [
        { key: 'edit', label: 'Edit' },
        { key: 'split', label: 'Split' },
        { key: 'preview', label: 'Preview' },
      ];

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-1">
          {modeButtons.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                mode === m.key
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>{value.split('\n').length} lines</span>
          <span>{value.length} chars</span>
        </div>
      </div>

      {/* Content */}
      <div
        className={`${mode === 'split' ? 'grid grid-cols-2' : ''}`}
        style={{ height: minHeight }}
      >
        {/* Editor pane */}
        {mode !== 'preview' && (
          <div className={`relative h-full overflow-hidden ${mode === 'split' ? 'border-r border-gray-800' : ''}`}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleEditorScroll}
              onKeyDown={handleKeyDown}
              readOnly={readOnly}
              spellCheck={false}
              className="w-full h-full bg-transparent text-gray-200 text-sm font-mono p-4 focus:outline-none resize-none leading-relaxed placeholder-gray-600 overflow-auto"
              placeholder="Write your prompt in Markdown..."
            />
          </div>
        )}

        {/* Preview pane */}
        {mode !== 'edit' && (
          <div
            ref={previewRef}
            className="overflow-auto p-4 h-full"
          >
            {value.trim() ? (
              <div className="markdown-preview prose prose-invert prose-sm max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm italic">Nothing to preview.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
