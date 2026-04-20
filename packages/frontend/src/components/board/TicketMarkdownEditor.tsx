import { useState, useRef, useCallback, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ViewMode = 'split' | 'edit' | 'preview';

interface TicketMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  placeholder?: string;
}

const toolbarButtons = [
  { label: 'Bold', format: '**', icon: 'B' },
  { label: 'Italic', format: '_', icon: 'I' },
  { label: 'Heading', format: '# ', icon: 'H' },
  { label: 'Code', format: '`', icon: '</>' },
  { label: 'Link', format: '[', icon: '🔗' },
  { label: 'List', format: '- ', icon: '•' },
  { label: 'Checkbox', format: '- [ ] ', icon: '☑' },
  { label: 'Quote', format: '> ', icon: '"' },
];

export default function TicketMarkdownEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = '300px',
  placeholder = 'Add a description...',
}: TicketMarkdownEditorProps) {
  const [mode, setMode] = useState<ViewMode>(readOnly ? 'preview' : 'edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Handle toolbar button clicks
  const handleToolbarClick = useCallback((format: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    let newText = '';

    switch (format) {
      case '**':
        newText = selectedText ? `**${selectedText}**` : '****';
        break;
      case '_':
        newText = selectedText ? `_${selectedText}_` : '__';
        break;
      case '# ':
        newText = `# ${selectedText || 'Heading'}`;
        break;
      case '`':
        newText = selectedText ? `\`${selectedText}\`` : '``';
        break;
      case '[':
        newText = selectedText ? `[${selectedText}](url)` : '[link](url)';
        break;
      case '- ':
        newText = `${selectedText ? '- ' : '- '}${selectedText || 'list item'}`;
        break;
      case '- [ ] ':
        newText = `- [ ] ${selectedText || 'task'}`;
        break;
      case '> ':
        newText = `> ${selectedText || 'quote'}`;
        break;
      default:
        newText = format;
    }

    onChange(value.substring(0, start) + newText + value.substring(end));
    textarea.focus();
  }, [value, onChange]);

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
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    },
    [value, onChange, isFullscreen]
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

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-gray-950'
    : 'border border-gray-700 rounded-xl overflow-hidden bg-gray-950';

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-2">
          {/* Mode buttons */}
          <div className="flex items-center gap-1">
            {modeButtons.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all active:scale-95 ${
                  mode === m.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800 hover:shadow-sm'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Formatting buttons - only show in edit mode */}
          {!readOnly && mode !== 'preview' && (
            <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
              {toolbarButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => handleToolbarClick(btn.format)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all active:scale-95 ${
                    'text-gray-500 hover:text-gray-300 hover:bg-gray-800 hover:shadow-sm'
                  }`}
                  title={btn.label}
                >
                  {typeof btn.icon === 'string' && btn.icon.length > 2 ? btn.icon : <span className="font-bold">{btn.icon}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>{value.split('\n').length} lines</span>
            <span>{value.length} chars</span>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-all"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`${mode === 'split' ? 'grid grid-cols-2 divide-x divide-gray-800' : ''}`}
        style={{ height: isFullscreen ? 'calc(100vh - 50px)' : minHeight }}
      >
        {/* Editor pane */}
        {mode !== 'preview' && (
          <div className="relative h-full overflow-hidden bg-gray-950">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleEditorScroll}
              onKeyDown={handleKeyDown}
              readOnly={readOnly}
              spellCheck={false}
              className="w-full h-full bg-transparent text-gray-200 text-sm font-mono p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed placeholder-gray-600 overflow-auto transition-shadow"
              placeholder={placeholder}
            />
          </div>
        )}

        {/* Preview pane */}
        {mode !== 'edit' && (
          <div
            ref={previewRef}
            className="overflow-auto p-4 h-full bg-gray-950/50"
          >
            {value.trim() ? (
              <div className="markdown-preview prose prose-invert prose-sm max-w-none animate-in fade-in duration-200">
                <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3 animate-in scale-in duration-300">
                    <svg className="w-6 h-6 text-gray-600 animate-in fade-in duration-300 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-sm italic animate-in fade-in duration-300 delay-200">
                    {mode === 'preview' ? 'No content to preview' : 'Start typing to see markdown preview'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
