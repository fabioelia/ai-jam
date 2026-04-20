import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { createServer } from 'http';
import { config } from './config.js';
import authPlugin from './auth/auth-plugin.js';
import { authRoutes } from './auth/auth-routes.js';
import { projectRoutes } from './routes/projects.js';
import { featureRoutes } from './routes/features.js';
import { epicRoutes } from './routes/epics.js';
import { ticketRoutes } from './routes/tickets.js';
import { commentRoutes } from './routes/comments.js';
import { boardRoutes } from './routes/board.js';
import { agentSessionRoutes } from './routes/agent-sessions.js';
import { chatSessionRoutes } from './routes/chat-sessions.js';
import { proposalRoutes } from './routes/proposals.js';
import { ticketNoteRoutes } from './routes/ticket-notes.js';
import { transitionGateRoutes } from './routes/transition-gates.js';
import { systemPromptRoutes } from './routes/system-prompts.js';
import { scanRoutes } from './routes/scans.js';
import { notificationRoutes } from './routes/notifications.js';
import { attentionRoutes } from './routes/attention.js';
import { userRoutes } from './routes/users.js';
import { standupRoutes } from './routes/standup.js';
import { retrospectiveRoutes } from './routes/retrospective.js';
import { sprintPlanningRoutes } from './routes/sprint-planning.js';
import { ticketQualityRoutes } from './routes/ticket-quality.js';
import { blockerDependencyRoutes } from './routes/blocker-dependency.js';
import { ticketPrioritizerRoutes } from './routes/ticket-prioritizer.js';
import { epicHealthRoutes } from './routes/epic-health.js';
import { projectHealthRoutes } from './routes/project-health.js';
import { deadlineRiskRoutes } from './routes/deadline-risk.js';
import { releaseReadinessRoutes } from './routes/release-readiness.js';
import { ticketTriageRoutes } from './routes/ticket-triage.js';
import { workloadBalancerRoutes } from './routes/workload-balancer.js';
import { agentPerformanceRoutes } from './routes/agent-performance.js';
import { agentRoutingRoutes } from './routes/agent-routing.js';
import { escalationDetectorRoutes } from './routes/escalation-detector.js';
import { agentBurnoutRoutes } from './routes/agent-burnout.js';
import { agentSkillProfilerRoutes } from './routes/agent-skill-profiler.js';
import { agentKnowledgeGapRoutes } from './routes/agent-knowledge-gap.js';
import { agentCollaborationRoutes } from './routes/agent-collaboration.js';
import { agentHandoffQualityRoutes } from './routes/agent-handoff-quality.js';
import { agentTaskSequencerRoutes } from './routes/agent-task-sequencer.js';
import { agentLoadPredictorRoutes } from './routes/agent-load-predictor.js';
import { agentVelocityForecasterRoutes } from './routes/agent-velocity-forecaster.js';
import { agentSprintCommitmentRoutes } from './routes/agent-sprint-commitment.js';
import { agentCollaborationNetworkRoutes } from './routes/agent-collaboration-network.js';
import { agentContextRetentionRoutes } from './routes/agent-context-retention.js';
import { agentFocusAdvisorRoutes } from './routes/agent-focus-advisor.js';
import { agentResponseTimeRoutes } from './routes/agent-response-time.js';
import { agentPriorityAlignmentRoutes } from './routes/agent-priority-alignment.js';
import { agentStallDetectorRoutes } from './routes/agent-stall-detector.js';
import { agentSpecializationMapperRoutes } from './routes/agent-specialization-mapper.js';
import { agentBottleneckAnalyzerRoutes } from './routes/agent-bottleneck-analyzer.js';
import { agentQueueDepthRoutes } from './routes/agent-queue-depth.js';
import { agentSkillGapRoutes } from './routes/agent-skill-gap.js';
import { agentConflictDetectorRoutes } from './routes/agent-conflict-detector.js';
import { agentDecisionQualityRoutes } from './routes/agent-decision-quality.js';
import { agentPerformanceTrendRoutes } from './routes/agent-performance-trend.js';
import { agentCoverageGapRoutes } from './routes/agent-coverage-gap.js';
import { agentDependencyMapperRoutes } from './routes/agent-dependency-mapper.js';
import { agentContextUtilizationRoutes } from './routes/agent-context-utilization.js';
import { agentHandoffSuccessRoutes } from './routes/agent-handoff-success.js';
import { agentIdleTimeRoutes } from './routes/agent-idle-time.js';
import { agentThroughputEfficiencyRoutes } from './routes/agent-throughput-efficiency.js';
import { agentWorkloadFairnessRoutes } from './routes/agent-workload-fairness.js';
import { agentErrorRatesRoutes } from './routes/agent-error-rates.js';
import { agentEscalationPatternRoutes } from './routes/agent-escalation-patterns.js';
import { agentRecoveryPatternRoutes } from './routes/agent-recovery-patterns.js';
import { agentTaskVelocityRoutes } from './routes/agent-task-velocity.js';
import { agentContextSwitchRoutes } from './routes/agent-context-switch.js';
import { agentParallelCapacityRoutes } from './routes/agent-parallel-capacity.js';
import { agentEstimationAccuracyRoutes } from './routes/agent-estimation-accuracy.js';
import { agentGoalAlignmentRoutes } from './routes/agent-goal-alignment.js';
import { agentOutputQualityRoutes } from './routes/agent-output-quality.js';
import { agentCommunicationQualityRoutes } from './routes/agent-communication-quality.js';
import { agentTaskAbandonmentRoutes } from './routes/agent-task-abandonment.js';
import { agentWorkloadDistributionRoutes } from './routes/agent-workload-distribution.js';
import { agentTaskComplexityRoutes } from './routes/agent-task-complexity.js';
import { agentSessionDepthRoutes } from './routes/agent-session-depth.js';
import { agentFeedbackLoopRoutes } from './routes/agent-feedback-loop.js';
import { agentReassignmentRatesRoutes } from './routes/agent-reassignment-rates.js';
import { agentLearningCurvesRoutes } from './routes/agent-learning-curves.js';
import { setupSocketServer } from './websocket/socket-server.js';
import { startRuntime } from './agent-runtime/runtime-manager.js';
import { startPtyDaemon } from './agent-runtime/pty-daemon-manager.js';
import { db } from './db/connection.js';
import { chatSessions, agentSessions } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  // Mark leftover running agent sessions as failed — but leave chat sessions alone.
  // Chat session PTYs live in the agent-runtime process which survives backend restarts.
  // Chat session status is updated by the runtime-manager when PTYs actually exit.
  await db.update(agentSessions).set({ status: 'failed', activity: 'idle', outputSummary: 'Session interrupted by backend restart', completedAt: new Date() }).where(eq(agentSessions.status, 'running'));
  await db.update(agentSessions).set({ status: 'failed', activity: 'idle', outputSummary: 'Session never started (pending at backend restart)', completedAt: new Date() }).where(eq(agentSessions.status, 'pending'));

  const fastify = Fastify({
    logger: true,
  });

  // CORS — allow any origin in dev (backend is on 0.0.0.0 for LAN access)
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting (global default — generous; auth routes override with stricter limits)
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart file uploads (5 MB limit)
  await fastify.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  // Auth
  await fastify.register(authPlugin);

  // Routes
  await fastify.register(authRoutes);
  await fastify.register(projectRoutes);
  await fastify.register(featureRoutes);
  await fastify.register(epicRoutes);
  await fastify.register(ticketRoutes);
  await fastify.register(commentRoutes);
  await fastify.register(boardRoutes);
  await fastify.register(agentSessionRoutes);
  await fastify.register(chatSessionRoutes);
  await fastify.register(proposalRoutes);
  await fastify.register(ticketNoteRoutes);
  await fastify.register(transitionGateRoutes);
  await fastify.register(systemPromptRoutes);
  await fastify.register(scanRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(attentionRoutes);
  await fastify.register(userRoutes);
  await fastify.register(standupRoutes);
  await fastify.register(retrospectiveRoutes);
  await fastify.register(sprintPlanningRoutes);
  await fastify.register(ticketQualityRoutes);
    await fastify.register(blockerDependencyRoutes);
    await fastify.register(ticketPrioritizerRoutes);
  await fastify.register(epicHealthRoutes);
  await fastify.register(projectHealthRoutes);
  await fastify.register(deadlineRiskRoutes);
  await fastify.register(releaseReadinessRoutes);
  await fastify.register(ticketTriageRoutes);
  await fastify.register(workloadBalancerRoutes);
  await fastify.register(agentPerformanceRoutes);
  await fastify.register(agentRoutingRoutes);
  await fastify.register(escalationDetectorRoutes);
  await fastify.register(agentBurnoutRoutes);
  await fastify.register(agentSkillProfilerRoutes);
  await fastify.register(agentKnowledgeGapRoutes);
  await fastify.register(agentCollaborationRoutes);
  await fastify.register(agentHandoffQualityRoutes);
  await fastify.register(agentTaskSequencerRoutes);
  await fastify.register(agentLoadPredictorRoutes);
  await fastify.register(agentVelocityForecasterRoutes);
  await fastify.register(agentSprintCommitmentRoutes);
  await fastify.register(agentCollaborationNetworkRoutes);
  await fastify.register(agentContextRetentionRoutes);
  await fastify.register(agentFocusAdvisorRoutes);
  await fastify.register(agentResponseTimeRoutes);
  await fastify.register(agentPriorityAlignmentRoutes);
  await fastify.register(agentStallDetectorRoutes);
  await fastify.register(agentSpecializationMapperRoutes);
  await fastify.register(agentBottleneckAnalyzerRoutes);
  await fastify.register(agentQueueDepthRoutes);
  await fastify.register(agentSkillGapRoutes);
  await fastify.register(agentConflictDetectorRoutes);
  await fastify.register(agentDecisionQualityRoutes);
  await fastify.register(agentPerformanceTrendRoutes);
  await fastify.register(agentCoverageGapRoutes);
  await fastify.register(agentDependencyMapperRoutes);
  await fastify.register(agentContextUtilizationRoutes);
  await fastify.register(agentHandoffSuccessRoutes);
  await fastify.register(agentIdleTimeRoutes);
  await fastify.register(agentThroughputEfficiencyRoutes);
  await fastify.register(agentWorkloadFairnessRoutes);
  await fastify.register(agentErrorRatesRoutes);
  await fastify.register(agentEscalationPatternRoutes);
  await fastify.register(agentRecoveryPatternRoutes);
  await fastify.register(agentTaskVelocityRoutes);
  await fastify.register(agentContextSwitchRoutes);
  await fastify.register(agentParallelCapacityRoutes);
  await fastify.register(agentEstimationAccuracyRoutes);
  await fastify.register(agentGoalAlignmentRoutes);
  await fastify.register(agentOutputQualityRoutes);
  await fastify.register(agentCommunicationQualityRoutes);
  await fastify.register(agentTaskAbandonmentRoutes);
  await fastify.register(agentWorkloadDistributionRoutes);
  await fastify.register(agentTaskComplexityRoutes);
  await fastify.register(agentSessionDepthRoutes);
  await fastify.register(agentFeedbackLoopRoutes);
  await fastify.register(agentReassignmentRatesRoutes);
  await fastify.register(agentLearningCurvesRoutes);

  // Health check
  fastify.get('/api/health', async () => ({ status: 'ok' }));

  // Start server
  await fastify.ready();

  // Get the underlying http server for Socket.IO
  const httpServer = fastify.server;
  setupSocketServer(httpServer);

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`AI Jam backend running on port ${config.port}`);

  // Connect to agent-runtime (non-blocking — will retry if not available)
  startRuntime().catch((err) => {
    console.warn('Agent runtime not available at startup:', err.message || err);
  });

  // Connect to pty-daemon for interactive sessions (non-blocking)
  startPtyDaemon().catch((err) => {
    console.warn('PTY daemon not available at startup:', err.message || err);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
