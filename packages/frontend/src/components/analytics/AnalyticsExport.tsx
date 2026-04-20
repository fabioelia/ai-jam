import { useState } from 'react';
import type { ExportOptions, AnalyticsReport } from '../../types/analytics';
import { exportToCSV, exportToJSON } from '../../utils/analytics-utils';
import { format } from 'date-fns';

interface AnalyticsExportProps {
  data: AnalyticsReport;
  onExport?: (format: 'pdf' | 'csv' | 'json') => void;
}

export default function AnalyticsExport({ data, onExport }: AnalyticsExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('csv');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeInsights, setIncludeInsights] = useState(true);
  const [includeRawData, setIncludeRawData] = useState(false);
  const [template, setTemplate] = useState<'summary' | 'detailed' | 'executive'>('summary');

  const handleExport = () => {
    const options: ExportOptions = {
      format,
      includeCharts,
      includeInsights,
      includeRawData,
      template,
    };

    const filename = `analytics-${data.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    switch (format) {
      case 'csv':
        if (template === 'summary') {
          const summaryData = [data.summary];
          exportToCSV(summaryData, `${filename}-summary`);
        } else {
          const agentsData = data.metrics.agents;
          const projectsData = data.metrics.projects;
          const teamData = data.metrics.team;

          exportToCSV([...agentsData, ...projectsData, ...teamData], filename);
        }
        break;

      case 'json':
        const exportData = {
          ...data,
          options,
          exportedAt: new Date().toISOString(),
        };
        exportToJSON(exportData, filename);
        break;

      case 'pdf':
        // PDF export would need a library like jsPDF or html2canvas
        alert('PDF export coming soon! Please use CSV or JSON export for now.');
        break;
    }

    onExport?.(format);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:border-gray-700 px-4 py-2 rounded-lg text-white text-sm transition-all duration-200"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Export</span>
      </button>

      {isOpen && (
        <>
          <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-4">
              <h3 className="text-white font-semibold mb-4">Export Analytics</h3>

              <div className="space-y-4">
                {/* Format Selection */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setFormat('csv')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        format === 'csv'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => setFormat('json')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        format === 'json'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => setFormat('pdf')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        format === 'pdf'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      PDF
                    </button>
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Template</label>
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as any)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="summary">Summary</option>
                    <option value="detailed">Detailed</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>

                {/* Options */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Include</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeCharts}
                        onChange={(e) => setIncludeCharts(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-300 text-sm">Charts</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeInsights}
                        onChange={(e) => setIncludeInsights(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-300 text-sm">Insights</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeRawData}
                        onChange={(e) => setIncludeRawData(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-300 text-sm">Raw Data</span>
                    </label>
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Report
                </button>
              </div>
            </div>
          </div>

          {/* Close dropdown when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
}
