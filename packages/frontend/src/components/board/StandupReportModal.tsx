import { useState } from 'react';
import { useStandupReport } from '../../api/mutations.js';
import type { StandupReport } from '../../api/mutations.js';

interface StandupReportModalProps {
  projectId: string;
  onClose: () => void;
}

export default function StandupReportModal({ projectId, onClose }: StandupReportModalProps) {
  const { generate, loading, report } = useStandupReport();
  const [generated, setGenerated] = useState(false);

  async function handleGenerate() {
    await generate(projectId);
    setGenerated(true);
  }

  function confidenceColor(confidence: number) {
    if (confidence >= 0.8) return 'text-green-400 bg-green-400/20 border-green-500/50';
    if (confidence >= 0.5) return 'text-yellow-400 bg-yellow-400/20 border-yellow-500/50';
    return 'text-red-400 bg-red-400/20 border-red-500/50';
  }

  function formatClipboard(report: StandupReport): string {
    const section = (title: string, items: string[]) => {
      if (items.length === 0) return `**${title}**\n- None`;
      return `**${title}**\n${items.map(i => `- ${i}`).join('\n')}`;
    };
    return [section('Yesterday', report.yesterday), section('Today', report.today), section('Blockers', report.blockers)].join('\n\n');
  }

  function handleCopy() {
    if (!report) return;
    navigator.clipboard.writeText(formatClipboard(report));
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            ðŸ—£ Standup Report
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!generated ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">
                AI will generate a concise daily standup report from the current board state.
              </p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? 'Generating...' : 'Generate Standup'}
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">AI is generating the standup report...</p>
            </div>
          ) : report ? (
            <>
              {/* Confidence Badge */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Confidence</span>
                <span className={`px-3 py-1 rounded-full text-sm border ${confidenceColor(report.confidence)}`}>
                  {Math.round(report.confidence * 100)}%
                </span>
              </div>

              {/* Yesterday */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Yesterday</h3>
                <ul className="space-y-1.5">
                  {report.yesterday.length > 0
                    ? report.yesterday.map(item => (
                        <li key={item} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-green-400 mt-0.5 shrink-0">&rarr;</span>
                          {item}
                        </li>
                      ))
                    : <li className="text-sm text-gray-600">No completed items</li>}
                </ul>
              </div>

              {/* Today */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Today</h3>
                <ul className="space-y-1.5">
                  {report.today.length > 0
                    ? report.today.map(item => (
                        <li key={item} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5 shrink-0">&rarr;</span>
                          {item}
                        </li>
                      ))
                    : <li className="text-sm text-gray-600">No in-progress items</li>}
                </ul>
              </div>

              {/* Blockers */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Blockers</h3>
                <ul className="space-y-1.5">
                  {report.blockers.length > 0
                    ? report.blockers.map(item => (
                        <li key={item} className="text-sm text-red-300 flex items-start gap-2">
                          <span className="text-red-500 mt-0.5 shrink-0">&rarr;</span>
                          {item}
                        </li>
                      ))
                    : <li className="text-sm text-gray-600">No blockers</li>}
                </ul>
              </div>

              {/* Reasoning */}
              {report.reasoning && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Reasoning</h3>
                  <p className="text-sm text-gray-400">{report.reasoning}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center">No report data available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          {generated && report && (
            <button
              onClick={handleCopy}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy to Clipboard
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
