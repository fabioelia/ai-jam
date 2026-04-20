import type { AgentPerformanceMetrics, ProjectProgressMetrics, TeamProductivityMetrics } from '../../types/analytics';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

function MetricCard({ title, value, change, icon, trend = 'neutral', description }: MetricCardProps) {
  const trendColors = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-gray-400',
  };

  const getIconColor = () => {
    switch (trend) {
      case 'positive':
        return 'text-emerald-500 bg-emerald-500/10';
      case 'negative':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-indigo-500 bg-indigo-500/10';
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 hover:border-gray-700 transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${getIconColor()}`}>
            {icon}
          </div>
        )}
      </div>
      {change && (
        <div className="flex items-center gap-2 mt-2">
          {change.direction === 'up' && (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {change.direction === 'down' && (
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span className={`text-sm ${trendColors[trend]}`}>
            {change.value.toFixed(1)}%
          </span>
          <span className="text-gray-500 text-sm">vs last period</span>
        </div>
      )}
      {description && (
        <p className="text-gray-500 text-sm mt-2">{description}</p>
      )}
    </div>
  );
}

interface AgentPerformanceCardProps {
  agent: AgentPerformanceMetrics;
}

export function AgentPerformanceCard({ agent }: AgentPerformanceCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 hover:border-indigo-500/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold mb-1">{agent.agentName}</h3>
          <p className="text-gray-500 text-sm">Type: {agent.agentId}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          agent.efficiency >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
          agent.efficiency >= 60 ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          {agent.efficiency.toFixed(0)}% Efficient
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-gray-500 text-xs mb-1">Total Sessions</p>
          <p className="text-white font-semibold">{agent.totalSessions}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Success Rate</p>
          <p className="text-white font-semibold">{(agent.successRate * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Avg Duration</p>
          <p className="text-white font-semibold">{Math.round(agent.avgSessionDuration)}m</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Tokens/Session</p>
          <p className="text-white font-semibold">{Math.round(agent.avgTokensPerSession).toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800">
        <p className="text-gray-500 text-xs mb-2">Most Common Activity</p>
        <p className="text-white text-sm">{agent.mostCommonActivity}</p>
      </div>
    </div>
  );
}

interface ProjectProgressCardProps {
  project: ProjectProgressMetrics;
}

export function ProjectProgressCard({ project }: ProjectProgressCardProps) {
  const completionPercentage = (project.completedStoryPoints / project.totalStoryPoints) * 100;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 hover:border-indigo-500/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">{project.projectName}</h3>
          <p className="text-gray-500 text-sm">{project.totalTickets} total tickets</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          project.completionRate >= 0.8 ? 'bg-emerald-500/10 text-emerald-400' :
          project.completionRate >= 0.5 ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          {(project.completionRate * 100).toFixed(0)}% Complete
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <p className="text-gray-500 text-xs mb-1">Done</p>
          <p className="text-emerald-400 font-semibold">{project.completedTickets}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">In Progress</p>
          <p className="text-yellow-400 font-semibold">{project.inProgressTickets}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Backlog</p>
          <p className="text-gray-400 font-semibold">{project.backlogTickets}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs mb-1">Story Points</p>
            <p className="text-white text-sm">
              {project.completedStoryPoints} / {project.totalStoryPoints}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Velocity</p>
            <p className="text-white text-sm">{project.velocity} pts/week</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TeamMemberCardProps {
  member: TeamProductivityMetrics;
}

export function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 hover:border-indigo-500/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-semibold">
            {member.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-semibold">{member.userName}</h3>
            <p className="text-gray-500 text-sm">{member.activeDays} active days</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          member.productivityScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
          member.productivityScore >= 60 ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          {member.productivityScore.toFixed(0)}% Productive
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-gray-500 text-xs mb-1">Tickets Created</p>
          <p className="text-white font-semibold">{member.ticketsCreated}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Completed</p>
          <p className="text-emerald-400 font-semibold">{member.ticketsCompleted}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Comments</p>
          <p className="text-white font-semibold">{member.commentsAdded}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Hours</p>
          <p className="text-white font-semibold">{member.sessionHours.toFixed(0)}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs mb-1">Collaboration</p>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full"
                  style={{ width: `${member.collaborationIndex}%` }}
                />
              </div>
              <span className="text-white text-xs">{member.collaborationIndex.toFixed(0)}%</span>
            </div>
          </div>
          {member.activityTrend !== 'neutral' && (
            <div className={`text-xs flex items-center gap-1 ${
              member.activityTrend === 'increasing' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {member.activityTrend === 'increasing' ? '↑' : '↓'} Trending
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { MetricCard };
