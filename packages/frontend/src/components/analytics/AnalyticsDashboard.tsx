import { useState, useMemo } from 'react';
import AnalyticsChart from './AnalyticsChart';
import {
  MetricCard,
  AgentPerformanceCard,
  ProjectProgressCard,
  TeamMemberCard,
} from './AnalyticsMetrics';
import AnalyticsInsights from './AnalyticsInsights';
import DateRangePicker from './DateRangePicker';
import AnalyticsExport from './AnalyticsExport';
import { getDateRangeForPreset } from 'date-fns';
import { format } from '../../utils/analytics-utils';
import type {
  AgentPerformanceMetrics,
  ProjectProgressMetrics,
  TeamProductivityMetrics,
  AnalyticsInsight as AnalyticsInsightType,
  DateRange,
} from '../../types/analytics';
import {
  generateMockAgentPerformance,
  generateMockProjectProgress,
  generateMockTeamProductivity,
  generateMockInsights,
} from '../../utils/analytics-mock-data';

interface AnalyticsDashboardProps {
  projectId?: string;
}

type AnalyticsView = 'overview' | 'agents' | 'projects' | 'team';

export default function AnalyticsDashboard({ projectId }: AnalyticsDashboardProps) {
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForPreset('month'));
  const [isLoading, setIsLoading] = useState(false);

  // Mock data - in production, this would come from API
  const agentPerformance: AgentPerformanceMetrics[] = useMemo(() =>
    generateMockAgentPerformance(), []);

  const projectProgress: ProjectProgressMetrics[] = useMemo(() =>
    generateMockProjectProgress(), []);

  const teamProductivity: TeamProductivityMetrics[] = useMemo(() =>
    generateMockTeamProductivity(), []);

  const insights: AnalyticsInsightType[] = useMemo(() =>
    generateMockInsights(), []);

  // Chart data
  const activityTrendData = useMemo(() => {
    return [
      { name: 'Week 1', sessions: 45, tokens: 650000, tickets: 12 },
      { name: 'Week 2', sessions: 52, tokens: 720000, tickets: 15 },
      { name: 'Week 3', sessions: 48, tokens: 680000, tickets: 14 },
      { name: 'Week 4', sessions: 58, tokens: 790000, tickets: 18 },
    ];
  }, []);

  const efficiencyData = useMemo(() => {
    return agentPerformance.map(agent => ({
      name: agent.agentName,
      efficiency: agent.efficiency,
      successRate: agent.successRate * 100,
      avgDuration: agent.avgSessionDuration,
    }));
  }, [agentPerformance]);

  const ticketDistribution = useMemo(() => {
    return projectProgress.reduce((acc, project) => {
      return {
        completed: acc.completed + project.completedTickets,
        inProgress: acc.inProgress + project.inProgressTickets,
        backlog: acc.backlog + project.backlogTickets,
      };
    }, { completed: 0, inProgress: 0, backlog: 0 });
  }, [projectProgress]);

  const pieChartData = useMemo(() => [
    { name: 'Completed', value: ticketDistribution.completed },
    { name: 'In Progress', value: ticketDistribution.inProgress },
    { name: 'Backlog', value: ticketDistribution.backlog },
  ], [ticketDistribution]);

  const viewButtons = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'agents' as const, label: 'Agents', icon: '🤖' },
    { id: 'projects' as const, label: 'Projects', icon: '📁' },
    { id: 'team' as const, label: 'Team', icon: '👥' },
  ];

  const exportData = useMemo(() => ({
    id: 'report-1',
    title: 'Analytics Report',
    description: `Analytics report for ${format(dateRange.startDate, 'MMM d')} - ${format(dateRange.endDate, 'MMM d')}`,
    createdAt: new Date(),
    createdBy: 'current-user',
    dateRange,
    metrics: {
      agents: agentPerformance,
      projects: projectProgress,
      team: teamProductivity,
    },
    insights,
    summary: {
      totalSessions: agentPerformance.reduce((acc, agent) => acc + agent.totalSessions, 0),
      totalTicketsCompleted: projectProgress.reduce((acc, project) => acc + project.completedTickets, 0),
      overallProductivity: teamProductivity.reduce((acc, member) => acc + member.productivityScore, 0) / teamProductivity.length,
      avgEfficiency: agentPerformance.reduce((acc, agent) => acc + agent.efficiency, 0) / agentPerformance.length,
    },
  }), [dateRange, agentPerformance, projectProgress, teamProductivity, insights]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
              <p className="text-gray-500 text-sm mt-1">
                {format(dateRange.startDate, 'MMM d')} - {format(dateRange.endDate, 'MMM d, yyyy')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <AnalyticsExport data={exportData} />
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {viewButtons.map((button) => (
              <button
                key={button.id}
                onClick={() => setActiveView(button.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeView === button.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span>{button.icon}</span>
                {button.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {activeView === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Sessions"
                value={exportData.summary.totalSessions}
                change={{ value: 12.5, direction: 'up' }}
                description="All agents across projects"
              />
              <MetricCard
                title="Tickets Completed"
                value={exportData.summary.totalTicketsCompleted}
                change={{ value: 8.3, direction: 'up' }}
                description="This period"
              />
              <MetricCard
                title="Avg Efficiency"
                value={`${exportData.summary.avgEfficiency.toFixed(0)}%`}
                change={{ value: 5.2, direction: 'up' }}
                description="Agent performance score"
              />
              <MetricCard
                title="Team Productivity"
                value={`${exportData.summary.overallProductivity.toFixed(0)}%`}
                change={{ value: 3.8, direction: 'up' }}
                description="Average team score"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Activity Trend</h3>
                <AnalyticsChart type="area" data={activityTrendData} height={250} />
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Ticket Distribution</h3>
                <AnalyticsChart type="pie" data={pieChartData} height={250} />
              </div>
            </div>

            {/* Agent Efficiency */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Agent Efficiency Comparison</h3>
              <AnalyticsChart type="bar" data={efficiencyData} height={300} />
            </div>

            {/* Insights */}
            <AnalyticsInsights insights={insights} />
          </div>
        )}

        {activeView === 'agents' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agentPerformance.map((agent) => (
                <AgentPerformanceCard key={agent.agentId} agent={agent} />
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Agent Session Distribution</h3>
              <AnalyticsChart type="bar" data={activityTrendData} height={300} />
            </div>
          </div>
        )}

        {activeView === 'projects' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectProgress.map((project) => (
                <ProjectProgressCard key={project.projectId} project={project} />
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Project Burndown</h3>
              <AnalyticsChart type="line" data={projectProgress[0]?.burndownData || []} height={300} />
            </div>
          </div>
        )}

        {activeView === 'team' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamProductivity.map((member) => (
                <TeamMemberCard key={member.userId} member={member} />
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Team Productivity Comparison</h3>
              <AnalyticsChart type="bar" data={teamProductivity.map(m => ({
                name: m.userName,
                value: m.productivityScore,
              }))} height={300} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
