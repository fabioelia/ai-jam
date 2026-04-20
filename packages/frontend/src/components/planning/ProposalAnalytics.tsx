import { useMemo } from 'react';
import type { TicketProposal as TicketProposalType } from '@ai-jam/shared';

interface ProposalAnalyticsProps {
  proposals: TicketProposalType[];
}

interface AnalyticsData {
  totalProposals: number;
  approvalRate: number;
  rejectionRate: number;
  pendingRate: number;
  averageDecisionTime: number;
  proposalsByStatus: Record<string, number>;
  proposalsByPriority: Record<string, number>;
  trend: {
    date: string;
    approved: number;
    rejected: number;
    total: number;
  }[];
}

export default function ProposalAnalytics({ proposals }: ProposalAnalyticsProps) {
  const analytics = useMemo((): AnalyticsData => {
    const total = proposals.length;
    const approved = proposals.filter(p => p.status === 'approved').length;
    const rejected = proposals.filter(p => p.status === 'rejected').length;
    const pending = proposals.filter(p => ['pending', 'proposed', 'edited'].includes(p.status)).length;

    const proposalsByStatus = proposals.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const proposalsByPriority = proposals.reduce((acc, p) => {
      const priority = (p.ticketData as any)?.priority || 'unknown';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average decision time
    const resolvedProposals = proposals.filter(p => p.resolvedAt);
    const avgDecisionTime = resolvedProposals.length > 0
      ? resolvedProposals.reduce((sum, p) => {
          const created = new Date(p.createdAt).getTime();
          const resolved = new Date(p.resolvedAt!).getTime();
          return sum + (resolved - created);
        }, 0) / resolvedProposals.length / 1000 / 60 // Convert to minutes
      : 0;

    // Create trend data (last 7 days)
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayProposals = proposals.filter(p => {
        const proposalDate = new Date(p.createdAt).toISOString().split('T')[0];
        return proposalDate === dateStr;
      });

      trend.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        approved: dayProposals.filter(p => p.status === 'approved').length,
        rejected: dayProposals.filter(p => p.status === 'rejected').length,
        total: dayProposals.length
      });
    }

    return {
      totalProposals: total,
      approvalRate: total > 0 ? (approved / total) * 100 : 0,
      rejectionRate: total > 0 ? (rejected / total) * 100 : 0,
      pendingRate: total > 0 ? (pending / total) * 100 : 0,
      averageDecisionTime: avgDecisionTime,
      proposalsByStatus,
      proposalsByPriority,
      trend
    };
  }, [proposals]);

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'Less than a minute';
    if (minutes < 60) return `${Math.round(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getHealthColor = (rate: number) => {
    if (rate >= 70) return 'text-green-400';
    if (rate >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xs text-gray-500">Total</span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics.totalProposals}</div>
          <div className="text-xs text-gray-600 mt-1">Proposals</div>
        </div>

        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs text-gray-500">Approval</span>
          </div>
          <div className={`text-2xl font-bold ${getHealthColor(analytics.approvalRate)}`}>
            {analytics.approvalRate.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">Rate</div>
        </div>

        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-yellow-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-500">Avg. Time</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatTime(analytics.averageDecisionTime)}
          </div>
          <div className="text-xs text-gray-600 mt-1">To Decision</div>
        </div>

        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="text-xs text-gray-500">Rejection</span>
          </div>
          <div className={`text-2xl font-bold ${getHealthColor(100 - analytics.rejectionRate)}`}>
            {analytics.rejectionRate.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-600 mt-1">Rate</div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
        <h3 className="text-sm font-semibold text-white mb-4">7-Day Trend</h3>
        <div className="flex items-end justify-between gap-2 h-32">
          {analytics.trend.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 w-full">
                <div
                  className="flex-1 bg-green-600/60 rounded-t transition-all hover:bg-green-600"
                  style={{ height: `${(day.approved / Math.max(...analytics.trend.map(d => d.total), 1)) * 100}%` }}
                  title={`Approved: ${day.approved}`}
                />
                <div
                  className="flex-1 bg-red-600/60 rounded-t transition-all hover:bg-red-600"
                  style={{ height: `${(day.rejected / Math.max(...analytics.trend.map(d => d.total), 1)) * 100}%` }}
                  title={`Rejected: ${day.rejected}`}
                />
              </div>
              <span className="text-xs text-gray-600">{day.date}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-600/60" />
            <span className="text-xs text-gray-500">Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-600/60" />
            <span className="text-xs text-gray-500">Rejected</span>
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
        <h3 className="text-sm font-semibold text-white mb-4">Status Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(analytics.proposalsByStatus).map(([status, count]) => {
            const percentage = (count / analytics.totalProposals) * 100;
            const statusColors: Record<string, string> = {
              approved: 'bg-green-600',
              rejected: 'bg-red-600',
              pending: 'bg-yellow-600',
              proposed: 'bg-blue-600',
              edited: 'bg-purple-600',
              draft: 'bg-gray-600'
            };

            return (
              <div key={status} className="flex items-center gap-3">
                <div className="w-24 text-xs text-gray-400 capitalize">{status}</div>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${statusColors[status] || 'bg-gray-600'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-right text-xs text-gray-300">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority breakdown */}
      {Object.keys(analytics.proposalsByPriority).length > 0 && (
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
          <h3 className="text-sm font-semibold text-white mb-4">Priority Distribution</h3>
          <div className="space-y-3">
            {Object.entries(analytics.proposalsByPriority).map(([priority, count]) => {
              const percentage = (count / analytics.totalProposals) * 100;
              const priorityColors: Record<string, string> = {
                critical: 'bg-red-600',
                high: 'bg-orange-600',
                medium: 'bg-blue-600',
                low: 'bg-gray-600'
              };

              return (
                <div key={priority} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-400 capitalize">{priority}</div>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${priorityColors[priority] || 'bg-gray-600'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-xs text-gray-300">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
