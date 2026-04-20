import type {
  AgentPerformanceMetrics,
  ProjectProgressMetrics,
  TeamProductivityMetrics,
  AnalyticsInsight,
} from '../types/analytics';
import { generateInsight } from './analytics-utils';

export function generateMockAgentPerformance(): AgentPerformanceMetrics[] {
  const personas = [
    'frontend-developer',
    'backend-developer',
    'code-reviewer',
    'qa-specialist',
    'devops-engineer',
    'product-manager',
  ];

  return personas.map((persona) => {
    const totalSessions = Math.floor(Math.random() * 40) + 30;
    const completedSessions = Math.floor(totalSessions * (0.7 + Math.random() * 0.2));
    const failedSessions = totalSessions - completedSessions;

    return {
      agentId: persona,
      agentName: persona.split('-').map((word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      totalSessions,
      completedSessions,
      failedSessions,
      successRate: completedSessions / totalSessions,
      avgSessionDuration: Math.random() * 40 + 20,
      avgTokensPerSession: Math.floor(Math.random() * 10000) + 8000,
      totalTokensUsed: (Math.floor(Math.random() * 10000) + 8000) * totalSessions,
      avgRetryCount: Math.random() * 2,
      mostCommonActivity: ['coding', 'reviewing', 'testing', 'planning'][Math.floor(Math.random() * 4)],
      trendingActivity: ['optimization', 'refactoring', 'documentation'][Math.floor(Math.random() * 3)],
      efficiency: Math.floor(Math.random() * 30) + 70,
    };
  });
}

export function generateMockProjectProgress(): ProjectProgressMetrics[] {
  const projectNames = [
    'AI Jam Platform',
    'Analytics Dashboard',
    'Mobile App',
    'API Gateway',
    'User Authentication',
  ];

  return projectNames.map((name, index) => {
    const totalTickets = Math.floor(Math.random() * 20) + 15;
    const completedTickets = Math.floor(totalTickets * (0.5 + Math.random() * 0.3));
    const inProgressTickets = Math.floor((totalTickets - completedTickets) * 0.6);
    const backlogTickets = totalTickets - completedTickets - inProgressTickets;

    const totalStoryPoints = totalTickets * (Math.floor(Math.random() * 4) + 3);
    const completedStoryPoints = Math.floor(totalStoryPoints * (completedTickets / totalTickets));

    return {
      projectId: String(index + 1),
      projectName: name,
      totalTickets,
      completedTickets,
      inProgressTickets,
      backlogTickets,
      completionRate: completedTickets / totalTickets,
      averageStoryPoints: totalStoryPoints / totalTickets,
      totalStoryPoints,
      completedStoryPoints,
      velocity: Math.floor(Math.random() * 15) + 15,
      cycleTime: Math.floor(Math.random() * 5) + 3,
      burndownData: generateMockBurndownData(totalStoryPoints, completedStoryPoints),
      milestoneProgress: generateMockMilestoneProgress(),
    };
  });
}

export function generateMockTeamProductivity(): TeamProductivityMetrics[] {
  const teamMembers = [
    { id: '1', name: 'Alex Thompson' },
    { id: '2', name: 'Sarah Chen' },
    { id: '3', name: 'Michael Rodriguez' },
    { id: '4', name: 'Emily Watson' },
    { id: '5', name: 'David Kim' },
  ];

  return teamMembers.map((member) => {
    const ticketsCreated = Math.floor(Math.random() * 20) + 15;
    const ticketsCompleted = Math.floor(ticketsCreated * (0.7 + Math.random() * 0.2));
    const commentsAdded = Math.floor(Math.random() * 100) + 50;
    const proposalsCreated = Math.floor(Math.random() * 10) + 5;
    const proposalsApproved = Math.floor(proposalsCreated * (0.6 + Math.random() * 0.3));
    const activeDays = Math.floor(Math.random() * 10) + 15;
    const sessionHours = activeDays * (4 + Math.random() * 4);

    return {
      userId: member.id,
      userName: member.name,
      userAvatar: null,
      ticketsCreated,
      ticketsCompleted,
      commentsAdded,
      proposalsCreated,
      proposalsApproved,
      sessionHours,
      activeDays,
      productivityScore: Math.floor(Math.random() * 25) + 70,
      collaborationIndex: Math.floor(Math.random() * 30) + 60,
      activityTrend: ['increasing', 'stable', 'decreasing'][Math.floor(Math.random() * 3)] as any,
      topSkills: ['Development', 'Review', 'Planning', 'Testing'].slice(0, Math.floor(Math.random() * 3) + 1),
    };
  });
}

export function generateMockInsights(): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [
    generateInsight(
      'improvement',
      'agents',
      'Optimize Agent Session Duration',
      'Frontend Developer agents show 15% longer average session times. Consider breaking down complex tasks into smaller sub-tasks.',
      'medium',
      [
        'Review and optimize prompt templates for complex tasks',
        'Implement task decomposition for requests over 10k tokens',
        'Add timeout monitoring and automatic session splitting',
      ],
      ['avgSessionDuration', 'efficiency'],
    ),
    generateInsight(
      'success',
      'projects',
      'Excellent Project Velocity',
      'Multiple projects maintain healthy velocity, exceeding targets by an average of 20%.',
      'high',
      [
        'Maintain current workflow and practices',
        'Document successful practices for other projects',
        'Consider increasing sprint capacity by 10-15%',
      ],
      ['velocity', 'completionRate'],
    ),
    generateInsight(
      'warning',
      'team',
      'Collaboration Opportunity',
      'Some team members show below-average collaboration index. Encourage more code reviews and team discussions.',
      'medium',
      [
        'Assign more code review tasks',
        'Encourage participation in planning discussions',
        'Schedule pair programming sessions with team members',
      ],
      ['collaborationIndex', 'commentsAdded'],
    ),
    generateInsight(
      'info',
      'agents',
      'Token Usage Trends',
      'Certain agent types use more tokens per session. Monitor for cost optimization opportunities.',
      'low',
      [
        'Review prompt complexity',
        'Consider using smaller models for routine tasks',
        'Implement response caching for common operations',
      ],
      ['avgTokensPerSession', 'totalTokensUsed'],
    ),
    generateInsight(
      'warning',
      'process',
      'Code Review Bottleneck',
      'Code review agent shows longer processing times. Consider adding additional reviewers.',
      'medium',
      [
        'Add backup code reviewer agent',
        'Implement parallel review process for larger PRs',
        'Optimize review criteria to reduce complexity',
      ],
      ['avgSessionDuration', 'totalSessions'],
    ),
  ];

  return insights;
}

function generateMockBurndownData(totalPoints: number, completedPoints: number) {
  const weeks = Math.floor(Math.random() * 2) + 3;
  const data = [];
  const pointsPerWeek = Math.floor(totalPoints / weeks);

  for (let i = 0; i <= weeks; i++) {
    const remaining = Math.max(0, totalPoints - (pointsPerWeek * i));
    const completed = Math.min(completedPoints, pointsPerWeek * i);
    data.push({
      date: `Week ${i + 1}`,
      remainingPoints: remaining,
      completedPoints: completed,
    });
  }

  return data;
}

function generateMockMilestoneProgress() {
  const milestones = [
    'MVP Launch',
    'Beta Testing',
    'Public Release',
    'Feature Complete',
  ];

  return milestones.slice(0, Math.floor(Math.random() * 2) + 2).map((milestone) => ({
    milestone,
    completed: Math.floor(Math.random() * 5) + 3,
    total: Math.floor(Math.random() * 5) + 5,
    dueDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  }));
}
