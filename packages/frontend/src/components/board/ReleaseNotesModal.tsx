import { useState } from 'react';
import { apiFetch } from '../../api/client.js';

interface ReleaseNoteItem {
  ticketId: string;
  title: string;
  headline: string;
}

interface ReleaseNotes {
  version: string;
  summary: string;
  features: ReleaseNoteItem[];
  bugFixes: ReleaseNoteItem[];
  improvements: ReleaseNoteItem[];
  infrastructure: ReleaseNoteItem[];
  markdown: string;
  generatedAt: string;
}

interface ReleaseNotesModalProps {
  projectId: string;
  featureId: string;
  onClose: () => void;
}

export default function ReleaseNotesModal({ projectId, featureId, onClose }: ReleaseNotesModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReleaseNotes | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const data = await apiFetch<ReleaseNotes>(`/projects/${projectId}/features/${featureId}/release-notes`, { method: 'POST' });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyMarkdown() {
    if (!result?.markdown) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function renderSection(title: string, items: ReleaseNoteItem[]) {
    if (items.length === 0) return null;
    return (
      <div key={title} className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">{title}</h4>
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.ticketId} className="text-sm text-gray-400 flex items-start gap-2">
              <span className="text-xs text-gray-600 font-mono shrink-0">[{item.ticketId}]</span>
              <span>{item.headline}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span className="text-emerald-400">📝</span> Release Notes
          </h2>
          {result && (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">
              v{result.version}
            </span>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!result && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">
                AI will analyze all completed tickets and generate categorized release notes.
              </p>
              <button
                onClick={handleGenerate}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-medium"
              >
                Generate Release Notes
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">AI is generating release notes...</p>
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>

              {/* Sections */}
              {renderSection('✨ Features', result.features)}
              {renderSection('🐛 Bug Fixes', result.bugFixes)}
              {renderSection('🔧 Improvements', result.improvements)}
              {renderSection('🏗 Infrastructure', result.infrastructure)}

              <p className="text-xs text-gray-600">Generated at {new Date(result.generatedAt).toLocaleString()}</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          {result && (
            <button
              onClick={handleCopyMarkdown}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-600/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
          )}
          <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
