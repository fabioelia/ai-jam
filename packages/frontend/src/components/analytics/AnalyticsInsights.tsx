import type { AnalyticsInsight } from '../../types/analytics';

interface AnalyticsInsightsProps {
  insights: AnalyticsInsight[];
  onInsightClick?: (insight: AnalyticsInsight) => void;
}

export default function AnalyticsInsights({ insights, onInsightClick }: AnalyticsInsightsProps) {
  const getTypeIcon = (type: AnalyticsInsight['type']) => {
    switch (type) {
      case 'improvement':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getTypeStyles = (type: AnalyticsInsight['type']) => {
    switch (type) {
      case 'improvement':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'info':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'success':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  const getImpactBadge = (impact: AnalyticsInsight['impact']) => {
    switch (impact) {
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">High Impact</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400">Medium Impact</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">Low Impact</span>;
    }
  };

  const getCategoryBadge = (category: AnalyticsInsight['category']) => {
    const categoryLabels: Record<AnalyticsInsight['category'], string> = {
      agents: 'Agents',
      projects: 'Projects',
      team: 'Team',
      process: 'Process',
    };
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">{categoryLabels[category]}</span>;
  };

  if (insights.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <svg
          className="w-12 h-12 text-gray-600 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h3 className="text-white font-semibold mb-2">No insights available</h3>
        <p className="text-gray-500 text-sm">Check back later for personalized insights based on your analytics data.</p>
      </div>
    );
  }

  // Sort insights by impact and type
  const sortedInsights = [...insights].sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.impact] - impactOrder[b.impact];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Insights & Recommendations</h2>
        <span className="text-sm text-gray-500">{insights.length} insights</span>
      </div>

      <div className="space-y-3">
        {sortedInsights.map((insight) => (
          <div
            key={insight.id}
            className={`bg-gray-900 border rounded-xl p-4 hover:border-gray-700 transition-all duration-300 cursor-pointer ${getTypeStyles(insight.type)}`}
            onClick={() => onInsightClick?.(insight)}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getTypeStyles(insight.type)} flex-shrink-0`}>
                {getTypeIcon(insight.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-white font-semibold">{insight.title}</h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getImpactBadge(insight.impact)}
                    {getCategoryBadge(insight.category)}
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-3">{insight.description}</p>

                {insight.suggestedActions && insight.suggestedActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs mb-2">Suggested actions:</p>
                    <ul className="space-y-1">
                      {insight.suggestedActions.map((action, index) => (
                        <li key={index} className="text-gray-400 text-xs flex items-start gap-2">
                          <span className="text-indigo-400 mt-0.5">→</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.relatedMetrics && insight.relatedMetrics.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs mb-2">Related metrics:</p>
                    <div className="flex flex-wrap gap-2">
                      {insight.relatedMetrics.map((metric) => (
                        <span key={metric} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
