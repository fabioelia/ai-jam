import { useNavigate } from 'react-router-dom';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';

export default function AnalyticsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <h1 className="text-xl font-bold text-white">Analytics</h1>

            <div className="w-16" /> {/* Spacer for balance */}
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <AnalyticsDashboard />
    </div>
  );
}
