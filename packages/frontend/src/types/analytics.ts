export type DateRangePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: DateRangePreset;
}

export interface AgentPerformanceMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  successRate: number;
  avgSessionDuration: number; // in minutes
  avgTokensPerSession: number;
  totalTokensUsed: number;
  avgRetryCount: number;
  mostCommonActivity: string;
  trendingActivity: string;
  efficiency: number; // 0-100 score
}

export interface ProjectProgressMetrics {
  projectId: string;
  projectName: string;
  totalTickets: number;
  completedTickets: number;
  inProgressTickets: number;
  backlogTickets: number;
  completionRate: number;
  averageStoryPoints: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  velocity: number; // points per week
  cycleTime: number; // average days to completion
  burndownData: Array<{
    date: string;
    remainingPoints: number;
    completedPoints: number;
  }>;
  milestoneProgress: Array<{
    milestone: string;
    completed: number;
    total: number;
    dueDate: string;
  }>;
}

export interface TeamProductivityMetrics {
  userId: string;
  userName: string;
  userAvatar: string | null;
  ticketsCreated: number;
  ticketsCompleted: number;
  commentsAdded: number;
  proposalsCreated: number;
  proposalsApproved: number;
  sessionHours: number;
  activeDays: number;
  productivityScore: number; // 0-100
  collaborationIndex: number; // 0-100
  activityTrend: 'increasing' | 'stable' | 'decreasing';
  topSkills: string[];
}

export interface AnalyticsInsight {
  id: string;
  type: 'improvement' | 'warning' | 'info' | 'success';
  category: 'agents' | 'projects' | 'team' | 'process';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedActions?: string[];
  relatedMetrics?: string[];
  createdAt: Date;
}

export interface AnalyticsReport {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  createdBy: string;
  dateRange: DateRange;
  metrics: {
    agents: AgentPerformanceMetrics[];
    projects: ProjectProgressMetrics[];
    team: TeamProductivityMetrics[];
  };
  insights: AnalyticsInsight[];
  summary: {
    totalSessions: number;
    totalTicketsCompleted: number;
    overallProductivity: number;
    avgEfficiency: number;
  };
}

export interface ChartDataPoint {
  name: string;
  value: number;
  date?: string;
  category?: string;
}

export interface AnalyticsFilters {
  dateRange: DateRange;
  projects?: string[];
  agents?: string[];
  users?: string[];
  includeWeekends?: boolean;
}

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  includeCharts: boolean;
  includeInsights: boolean;
  includeRawData: boolean;
  template?: 'summary' | 'detailed' | 'executive';
}
