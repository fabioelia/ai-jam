import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard, useProjectSessions } from '../api/queries.js';
import type { PlanningSession, ExecutionSession, ScanSession } from '../api/queries.js';
import { useCreateFeature, useCreateTicket, useSprintPlan, useBlockerAnalysis, useTicketPrioritizer, useEpicHealth, useProjectHealth, useDeadlineRisk, useReleaseReadiness, useWorkloadBalance, useAgentPerformance, useAgentRouting, useEscalationDetect, useAgentSkillProfiles, useAgentCollaboration, useAgentBurnout, useAgentKnowledgeGap, useAgentHandoffQuality, useAgentTaskSequence, useAgentLoadPredictor, useAgentVelocityForecast, useAgentSprintCommitment, useAgentCollaborationNetwork, useAgentContextRetention, useAgentFocusAdvisor, useAgentResponseTime, useAgentPriorityAlignment, useAgentStallDetector, useAgentSpecializationMapper, useAgentBottleneckAnalyzer, useAgentQueueDepth, useAgentSkillGap, useAgentConflictDetector, useAgentDecisionQuality, useAgentPerformanceTrend, useAgentCoverageGap, useAgentDependencyMapper, useAgentContextUtilization, useAgentHandoffSuccess, useAgentIdleTime, useAgentThroughputEfficiency, useAgentWorkloadFairness, useAgentErrorRates, useAgentEscalationPatterns, useAgentGoalAlignment, useAgentRecoveryPatterns, useAgentTaskVelocity, useAgentContextSwitch, useAgentParallelCapacity, useAgentEstimationAccuracy, useAgentTaskAbandonment, useAgentCommunicationQuality, useAgentWorkloadDistribution, useAgentTaskComplexity, useAgentSessionDepth, useAgentFeedbackLoops, useAgentReassignmentRates, useAgentAutonomy, useAgentReworkRate, useAgentDecisionSpeed, useAgentHandoffChainDepth, useAgentInterruptionImpact, useAgentScopeAdherence, useAgentBlockerFrequency, useAgentTokenBudget, useAgentSpecializationDrift, useAgentKnowledgeFreshness, useAgentPersonaAlignment, useAgentCollaborationGraph, useAgentMultitaskingEfficiency, useAgentResponseLatency, useAgentErrorRecovery, useAnalyzeAgentConfidenceCalibration, useAgentFeedbackIncorporation, useAgentThroughputRate, useAgentSuccessRate, useAgentCostEfficiency, useAgentDeadlineAdherence, useAgentSessionDuration, useAgentRetryPattern, useAgentToolUsagePattern, useAgentPriorityAdherence, useAgentCognitiveLoad, useAgentParallelTaskEfficiency, useAgentLearningVelocity, getAgentOutputQuality, AgentOutputQualityReport, getAgentLearningCurves, LearningCurveReport, type AgentLearningVelocityReport, type PersonaAlignmentReport, type AgentCollaborationGraphReport, type MultitaskingEfficiencyReport, useAgentGoalCompletion, useAgentCommunicationPatterns, useAgentDecisionQualityV2, useAgentSelfCorrectionRate, useAgentDependencyResolution, useAgentContextWindow, useAgentOutputConsistency, useAgentCollaborationEfficiency, type AgentCollaborationEfficiencyReport, type AgentCollaborationMetrics, useAgentAdaptationSpeed, type AgentAdaptationSpeedReport, type AgentAdaptationMetrics, useAgentScopeDrift, type AgentScopeDriftReport, type AgentScopeDriftMetrics, useAgentInstructionCompliance, type AgentInstructionComplianceReport, useAgentEscalationPatternAnalyzer, type AgentEscalationPatternAnalyzerReport, useAgentFeedbackIntegration, type AgentFeedbackIntegrationReport, useAgentProactivity, type AgentProactivityReport, type AgentProactivityMetrics, useAgentDecisionLatency, type AgentDecisionLatencyReport, type AgentDecisionLatencyMetrics, useAgentResourceConsumption, type AgentResourceConsumptionReport, type AgentResourceMetrics, useAgentSessionQuality, type AgentSessionQualityReport, type AgentSessionQualityMetrics, useAgentWorkflowTransitions, type AgentWorkflowTransitionReport, type AgentWorkflowTransitionMetrics, type WorkflowStateStats, useAgentKnowledgeTransfer, type AgentKnowledgeTransferReport, type AgentKnowledgeTransferMetrics, useAgentDelegationDepth, useAgentAutonomyIndex, useAgentBlockedTime, useAgentQualitySpeed, type AgentQualitySpeedReport, useAgentSpecialization, type AgentSpecializationReport, type AgentSpecializationMetrics, useAgentCollaborationScore, type AgentCollaborationScoreReport, useAgentThroughput, type AgentThroughputReport, useAgentIdleTimeAnalyzer, useAgentResponseTimeEfficiency, useAgentErrorRecoveryRate, useAgentWorkloadBalance, type AgentWorkloadMetrics, type AgentWorkloadReport, useAgentDeadlineAdherenceAnalyzer, type AgentDeadlineMetrics, type AgentDeadlineAdherenceReport, useAgentTokenCostEfficiency, type AgentTokenCostReport, useAgentSkillCoverage, type AgentSkillCoverageReport, useAgentLearningCurveAnalyzer, type AgentLearningCurveReport, useAgentCollaborationNetworkAnalyzer, type AgentCollaborationNetworkReport, useAgentPeakPerformance, type AgentPeakPerformanceReport, useAgentContextSwitchCost, type AgentContextSwitchCostReport, useAgentBurnoutRisk, type BurnoutRiskReport, useAgentHandoffSuccessRate, type HandoffSuccessRateReport, useAgentTaskCompletionVelocity, type TaskCompletionVelocityReport, useAgentInterruptionFrequency, type InterruptionFrequencyReport, useAgentSessionDurationAnalyzer, type SessionDurationReport, useAgentFailurePatterns, type FailurePatternReport, useAgentQueueDepthAnalyzer, type QueueDepthReport, useAgentRetryRate, type RetryRateReport, useAgentAvailability, type AvailabilityReport, useAgentSpecializationIndex, type SpecializationIndexReport, useAgentResponseLag, type ResponseLagReport, useAgentCapacityUtilization, type CapacityUtilizationReport, useAgentThroughputVariability, type ThroughputVariabilityReport, useAgentCostPerOutcome, type CostPerOutcomeReport, useAgentWorkloadSaturation, type WorkloadSaturationReport, useAgentRecoveryTime, type RecoveryTimeReport, useAgentEscalationRate, type EscalationRateReport, useAgentKnowledgeGapAnalyzer, type KnowledgeGapReport, useAgentIdleTimeTracker, type IdleTimeTrackerReport, useAgentParallelTaskEfficiencyTracker, type ParallelTaskEfficiencyTrackerReport, useAgentContextRetentionAnalyzer, type AgentContextRetentionAnalyzerReport, useAgentGoalDriftAnalyzer, type AgentGoalDriftReport, useAgentDecisionLatencyAnalyzer, type AgentDecisionLatencyAnalyzerReport, useAgentOutputQualityConsistency, type AgentOutputQualityConsistencyReport, useAgentCollaborationEfficiencyAnalyzer, type AgentCollaborationEfficiencyAnalyzerReport, useAgentInstructionAdherenceAnalyzer, type AgentInstructionAdherenceReport, useAgentCommunicationQualityAnalyzer, type AgentCommunicationQualityAnalyzerReport, useAgentAdaptationSpeedAnalyzer, type AgentAdaptationSpeedAnalyzerReport, useAgentSelfCorrectionRateAnalyzer, type AgentSelfCorrectionRateAnalyzerReport, useAgentConfidenceCalibrationAnalyzer, type AgentConfidenceCalibrationAnalyzerReport, useAgentTaskPrioritizationAccuracyAnalyzer, type AgentTaskPrioritizationAccuracyReport, useAgentToolSelectionAccuracyAnalyzer, type AgentToolSelectionAccuracyReport, useAgentWorkflowCoverageAnalyzer, type AgentWorkflowCoverageReport, useAgentDependencyRiskAnalyzer, type AgentDependencyRiskReport, useAgentMultiAgentSyncEfficiencyAnalyzer, type AgentMultiAgentSyncEfficiencyReport, useAgentOutputAccuracyRateAnalyzer, type AgentOutputAccuracyRateReport, useAgentGoalCompletionRateAnalyzer, type AgentGoalCompletionRateAnalyzerReport, useAgentPromptEfficiencyAnalyzer, type AgentPromptEfficiencyAnalyzerReport, useAgentLearningRateAnalyzer, type AgentLearningRateAnalyzerReport, useAgentErrorRecoverySpeedAnalyzer, type AgentErrorRecoverySpeedAnalyzerReport, useAgentAutonomyLevelAnalyzer, type AgentAutonomyLevelReport, useAgentResourceEfficiencyAnalyzer, type AgentResourceEfficiencyReport, useAgentMultiTurnConsistencyAnalyzer, type AgentMultiTurnConsistencyReport, useAgentPromptSensitivityAnalyzer, type AgentPromptSensitivityReport, useAgentDecisionConfidenceAnalyzer, type AgentDecisionConfidenceReport, useAgentKnowledgeTransferEfficiencyAnalyzer, type AgentKnowledgeTransferEfficiencyReport, useAgentInstructionComplexityAnalyzer, type AgentInstructionComplexityReport, useAgentContextWindowUtilizationAnalyzer, type AgentContextWindowUtilizationReport, useAgentCognitiveLoadEstimator, type AgentCognitiveLoadEstimatorReport, useAgentGoalAlignmentScore, type AgentGoalAlignmentReport, useAgentTrustScoreAnalyzer, type AgentTrustScoreAnalyzerReport, useAgentWorkflowBottleneckAnalyzer, type AgentWorkflowBottleneckAnalyzerReport, useAgentFeedbackIntegrationSpeedAnalyzer, type AgentFeedbackIntegrationSpeedAnalyzerReport, useAgentScopeCreepDetector, type AgentScopeCreepDetectorReport, useAgentAttentionSpanAnalyzer, type AgentAttentionSpanAnalyzerReport, useAgentHallucinationRateAnalyzer, type AgentHallucinationRateAnalyzerReport, useAgentToolUsageEfficiencyAnalyzer, type AgentToolUsageEfficiencyReport, useAgentInstructionParseAccuracyAnalyzer, type AgentInstructionParseAccuracyReport, useAgentResponseCoherenceAnalyzer, type AgentResponseCoherenceReport, useAgentSemanticDriftAnalyzer, type AgentSemanticDriftReport, useAgentBiasDetectionRateAnalyzer, type AgentBiasDetectionReport, useAgentMemoryPersistenceAnalyzer, type AgentMemoryPersistenceReport, useAgentReasoningChainDepthAnalyzer, type AgentReasoningChainDepthReport, useAgentErrorPropagationAnalyzer, type AgentErrorPropagationReport, useAgentAbstractionLevelAnalyzer, type AgentAbstractionLevelAnalyzerReport, useAgentTemporalConsistencyAnalyzer, type AgentTemporalConsistencyAnalyzerReport, useAgentOutputFormatComplianceAnalyzer, type AgentOutputFormatComplianceAnalyzerReport, useAgentCapabilityBoundaryAwarenessAnalyzer, type AgentCapabilityBoundaryAwarenessAnalyzerReport, useAgentProactiveInitiativeRateAnalyzer, type AgentProactiveInitiativeRateAnalyzerReport, useAgentKnowledgeBoundaryMappingAnalyzer, type AgentKnowledgeBoundaryMappingAnalyzerReport, useAgentCommunicationOverheadAnalyzer, type AgentCommunicationOverheadAnalyzerReport, useAgentSpecializationDriftAnalyzer, type AgentSpecializationDriftAnalyzerReport, useAgentCognitiveFlexibilityAnalyzer, type AgentCognitiveFlexibilityReport, useAgentDelegationAccuracyAnalyzer, type AgentDelegationAccuracyReport, useAgentInstructionClarityScoreAnalyzer, type AgentInstructionClarityReport, useAgentContextUtilizationEfficiencyAnalyzer, type AgentContextUtilizationEfficiencyReport, useAgentMultiModalProcessingEfficiencyAnalyzer, type AgentMultiModalProcessingEfficiencyReport, useAgentConstraintSatisfactionRateAnalyzer, type AgentConstraintSatisfactionReport, useAgentOutputCompletenessAnalyzer, type AgentOutputCompletenessAnalyzerReport, useAgentInstructionDisambiguationRateAnalyzer, type AgentInstructionDisambiguationRateAnalyzerReport, useAgentParallelismEfficiencyAnalyzer, type AgentParallelismEfficiencyAnalyzerReport, useAgentDecisionReversalRateAnalyzer, type AgentDecisionReversalRateAnalyzerReport, useAgentPriorityAlignmentRateAnalyzer, type AgentPriorityAlignmentRateAnalyzerReport, useAgentSessionWarmUpTimeAnalyzer, type AgentSessionWarmUpTimeAnalyzerReport, useAgentInteractionRichnessAnalyzer, type AgentInteractionRichnessAnalyzerReport, useAgentBoundaryViolationRateAnalyzer, type AgentBoundaryViolationRateAnalyzerReport, useAgentSemanticConsistencyRateAnalyzer, type AgentSemanticConsistencyRateAnalyzerReport, useAgentKnowledgeRecencyIndexAnalyzer, type AgentKnowledgeRecencyIndexAnalyzerReport, useAgentTaskScopeExpansionRateAnalyzer, type AgentTaskScopeExpansionRateAnalyzerReport, useAgentResponseLatencyAnalyzer, type AgentResponseLatencyAnalyzerReport, useAgentOutputVerbosityAnalyzer, type AgentOutputVerbosityAnalyzerReport, useAgentFocusRetentionAnalyzer, type AgentFocusRetentionAnalyzerReport, useAgentInstructionRedundancyAnalyzer, type AgentInstructionRedundancyAnalyzerReport, useAgentGoalDriftRateAnalyzer, type AgentGoalDriftRateAnalyzerReport, useAgentHypothesisTestingRateAnalyzer, type AgentHypothesisTestingRateAnalyzerReport, useAgentCrossDomainTransferAnalyzer, type AgentCrossDomainTransferAnalyzerReport, useAgentInstructionFollowingFidelityAnalyzer, type AgentInstructionFollowingFidelityAnalyzerReport, useAgentAdaptiveLearningRateAnalyzer, type AgentAdaptiveLearningRateAnalyzerReport, useAgentCollaborationBottleneckAnalyzer, type AgentCollaborationBottleneckAnalyzerReport, useAgentContextSwitchingCostAnalyzer, type AgentContextSwitchingCostAnalyzerReport, useAgentCalibrationScoreAnalyzer, type AgentCalibrationScoreAnalyzerReport, useAgentRecoveryTimeAnalyzer, type AgentRecoveryTimeAnalyzerReport, useAgentInterruptionHandlingEfficiencyAnalyzer, type AgentInterruptionHandlingEfficiencyReport, useAgentNarrativeCoherenceAnalyzer, type AgentNarrativeCoherenceReport } from '../api/mutations.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useBoardSync } from '../hooks/useBoardSync.js';
import { useAgentSync } from '../hooks/useAgentSync.js';
import { useNotificationSync } from '../hooks/useNotificationSync.js';
import { useSessionLastSeen } from '../hooks/useSessionLastSeen.js';
import { BoardSkeleton } from '../components/common/Skeleton.js';
import EmptyState from '../components/common/EmptyState.js';
import ErrorDisplay from '../components/common/ErrorDisplay.js';
import NotificationBell from '../components/notifications/NotificationBell.js';
import KanbanBoard from '../components/board/KanbanBoard.js';
import TicketDetail from '../components/board/TicketDetail.js';
import AgentActivityFeed from '../components/agents/AgentActivityFeed.js';
import FiltersPopover from '../components/board/FiltersPopover.js';
import SprintIntelligenceModal from '../components/board/SprintIntelligenceModal.js';
import StandupReportModal from '../components/board/StandupReportModal.js';
import RetrospectiveReportModal from '../components/board/RetrospectiveReportModal.js';
import SprintPlanningModal from '../components/board/SprintPlanningModal.js';
import BlockerDependencyModal from '../components/board/BlockerDependencyModal.js';
import TicketPrioritizerModal from '../components/board/TicketPrioritizerModal.js';
import EpicHealthModal from '../components/board/EpicHealthModal.js';
import ProjectHealthModal from '../components/board/ProjectHealthModal.js';
import DeadlineRiskModal from '../components/board/DeadlineRiskModal.js';
import ReleaseReadinessModal from '../components/board/ReleaseReadinessModal.js';
import WorkloadBalancerModal from '../components/board/WorkloadBalancerModal.js';
import AgentPerformanceModal from '../components/board/AgentPerformanceModal.js';
import AgentRoutingModal from '../components/board/AgentRoutingModal.js';
import EscalationDetectorModal from '../components/board/EscalationDetectorModal.js';
import AgentSkillProfilerModal from '../components/board/AgentSkillProfilerModal.js';
import AgentCollaborationModal from '../components/board/AgentCollaborationModal.js';
import AgentBurnoutModal from '../components/board/AgentBurnoutModal.js';
import AgentKnowledgeGapModal from '../components/board/AgentKnowledgeGapModal.js';
import AgentHandoffQualityModal from '../components/board/AgentHandoffQualityModal.js';
import AgentTaskSequenceModal from '../components/board/AgentTaskSequenceModal.js';
import AgentLoadPredictorModal from '../components/board/AgentLoadPredictorModal.js';
import AgentVelocityForecastModal from '../components/board/AgentVelocityForecastModal.js';
import AgentSprintCommitmentModal from '../components/board/AgentSprintCommitmentModal.js';
import AgentCollaborationNetworkModal from '../components/board/AgentCollaborationNetworkModal.js';
import AgentContextRetentionModal from '../components/board/AgentContextRetentionModal.js';
import AgentFocusAdvisorModal from '../components/board/AgentFocusAdvisorModal.js';
import AgentResponseTimeModal from '../components/board/AgentResponseTimeModal.js';
import AgentPriorityAlignmentModal from '../components/board/AgentPriorityAlignmentModal.js';
import AgentStallDetectorModal from '../components/board/AgentStallDetectorModal.js';
import AgentSpecializationMapperModal from '../components/board/AgentSpecializationMapperModal.js';
import AgentBottleneckAnalyzerModal from '../components/board/AgentBottleneckAnalyzerModal.js';
import AgentQueueDepthModal from '../components/board/AgentQueueDepthModal.js';
import AgentSkillGapModal from '../components/board/AgentSkillGapModal.js';
import AgentConflictDetectorModal from '../components/board/AgentConflictDetectorModal.js';
import AgentDecisionQualityModal from '../components/board/AgentDecisionQualityModal.js';
import AgentPerformanceTrendModal from '../components/board/AgentPerformanceTrendModal.js';
import AgentCoverageGapModal from '../components/board/AgentCoverageGapModal.js';
import AgentDependencyMapperModal from '../components/board/AgentDependencyMapperModal.js';
import AgentContextUtilizationModal from '../components/board/AgentContextUtilizationModal.js';
import AgentHandoffSuccessModal from '../components/board/AgentHandoffSuccessModal.js';
import AgentIdleTimeModal from '../components/board/AgentIdleTimeModal.js';
import AgentThroughputEfficiencyModal from '../components/board/AgentThroughputEfficiencyModal.js';
import AgentWorkloadFairnessModal from '../components/board/AgentWorkloadFairnessModal.js';
import AgentErrorRateModal from '../components/board/AgentErrorRateModal.js';
import AgentEscalationPatternModal from '../components/board/AgentEscalationPatternModal.js';
import AgentGoalAlignmentModal from '../components/board/AgentGoalAlignmentModal.js';
import AgentRecoveryPatternModal from '../components/board/AgentRecoveryPatternModal.js';
import AgentTaskVelocityModal from '../components/board/AgentTaskVelocityModal.js';
import AgentContextSwitchModal from '../components/board/AgentContextSwitchModal.js';
import AgentParallelCapacityModal from '../components/board/AgentParallelCapacityModal.js';
import AgentEstimationAccuracyModal from '../components/board/AgentEstimationAccuracyModal.js';
import AgentTaskAbandonmentModal from '../components/board/AgentTaskAbandonmentModal.js';
import AgentOutputQualityModal from '../components/board/AgentOutputQualityModal.js';
import AgentTaskComplexityModal from '../components/board/AgentTaskComplexityModal.js';
import AgentCommunicationQualityModal from '../components/board/AgentCommunicationQualityModal.js';
import AgentWorkloadDistributionModal from '../components/board/AgentWorkloadDistributionModal.js';
import AgentSessionDepthModal from '../components/board/AgentSessionDepthModal.js';
import AgentFeedbackLoopModal from '../components/board/AgentFeedbackLoopModal.js';
import AgentReassignmentRatesModal from '../components/board/AgentReassignmentRatesModal.js';
import AgentLearningCurveModal from '../components/board/AgentLearningCurveModal.js';
import AgentAutonomyLevelModal from '../components/board/AgentAutonomyLevelModal.js';
import AgentReworkRateModal from '../components/board/AgentReworkRateModal.js';
import AgentDecisionSpeedModal from '../components/board/AgentDecisionSpeedModal.js';
import AgentHandoffChainDepthModal from '../components/board/AgentHandoffChainDepthModal.js';
import AgentInterruptionImpactModal from '../components/board/AgentInterruptionImpactModal.js';
import AgentScopeAdherenceModal from '../components/board/AgentScopeAdherenceModal.js';
import AgentBlockerFrequencyModal from '../components/board/AgentBlockerFrequencyModal.js';
import AgentTokenBudgetModal from '../components/board/AgentTokenBudgetModal.js';
import AgentKnowledgeFreshnessModal from '../components/board/AgentKnowledgeFreshnessModal.js';
import AgentResponseLatencyModal from '../components/board/AgentResponseLatencyModal.js';
import AgentErrorRecoveryModal from '../components/board/AgentErrorRecoveryModal.js';
import AgentConfidenceCalibrationModal from '../components/board/AgentConfidenceCalibrationModal.js';
import AgentFeedbackIncorporationModal from '../components/board/AgentFeedbackIncorporationModal.js';
import AgentThroughputRateModal from '../components/board/AgentThroughputRateModal.js';
import AgentSuccessRateModal from '../components/board/AgentSuccessRateModal.js';
import AgentCostEfficiencyModal from '../components/board/AgentCostEfficiencyModal.js';
import AgentPersonaAlignmentModal from '../components/board/AgentPersonaAlignmentModal.js';
import AgentCollaborationGraphModal from '../components/board/AgentCollaborationGraphModal.js';
import AgentMultitaskingEfficiencyModal from '../components/board/AgentMultitaskingEfficiencyModal.js';
import AgentSpecializationDriftModal from '../components/board/AgentSpecializationDriftModal.js';
import AgentDeadlineAdherenceModal from '../components/board/AgentDeadlineAdherenceModal.js';
import AgentSessionDurationModal from '../components/board/AgentSessionDurationModal.js';
import AgentRetryPatternModal from '../components/board/AgentRetryPatternModal.js';
import AgentToolUsagePatternModal from '../components/board/AgentToolUsagePatternModal.js';
import AgentPriorityAdherenceModal from '../components/board/AgentPriorityAdherenceModal.js';
import AgentCognitiveLoadModal from '../components/AgentCognitiveLoadModal.js';
import AgentParallelTaskEfficiencyModal from '../components/AgentParallelTaskEfficiencyModal.js';
import AgentLearningVelocityModal from '../components/board/AgentLearningVelocityModal.js';
import AgentGoalCompletionModal from '../components/board/AgentGoalCompletionModal.js';
import AgentDecisionQualityV2Modal from '../components/board/AgentDecisionQualityV2Modal.js';
import AgentCommunicationPatternModal from '../components/board/AgentCommunicationPatternModal.js';
import AgentSelfCorrectionRateModal from '../components/board/AgentSelfCorrectionRateModal.js';
import AgentDependencyResolutionModal from '../components/board/AgentDependencyResolutionModal.js';
import AgentContextWindowModal from '../components/board/AgentContextWindowModal.js';
import AgentOutputConsistencyModal from '../components/board/AgentOutputConsistencyModal.js';
import AgentCollaborationEfficiencyModal from '../components/AgentCollaborationEfficiencyModal.js';
import AgentAdaptationSpeedModal from '../components/board/AgentAdaptationSpeedModal.js';
import AgentScopeDriftModal from '../components/board/AgentScopeDriftModal.js';
import AgentInstructionComplianceModal from '../components/board/AgentInstructionComplianceModal.js';
import AgentEscalationPatternAnalyzerModal from '../components/board/AgentEscalationPatternAnalyzerModal.js';
import AgentFeedbackIntegrationModal from '../components/board/AgentFeedbackIntegrationModal.js';
import AgentProactivityModal from '../components/board/AgentProactivityModal.js';
import AgentDecisionLatencyModal from '../components/board/AgentDecisionLatencyModal.js';
import AgentResourceConsumptionModal from '../components/board/AgentResourceConsumptionModal.js';
import AgentSessionQualityModal from '../components/board/AgentSessionQualityModal.js';
import AgentWorkflowTransitionModal from '../components/board/AgentWorkflowTransitionModal.js';
import AgentKnowledgeTransferModal from '../components/board/AgentKnowledgeTransferModal.js';
import AgentDelegationDepthModal from '../components/board/AgentDelegationDepthModal.js';
import AgentAutonomyIndexModal from '../components/board/AgentAutonomyIndexModal.js';
import AgentBlockedTimeModal from '../components/board/AgentBlockedTimeModal.js';
import AgentQualitySpeedModal from '../components/board/AgentQualitySpeedModal.js';
import AgentSpecializationModal from '../components/board/AgentSpecializationModal.js';
import AgentCollaborationScoreModal from '../components/board/AgentCollaborationScoreModal.js';
import AgentThroughputModal from '../components/board/AgentThroughputModal.js';
import AgentIdleTimeAnalyzerModal from '../components/board/AgentIdleTimeAnalyzerModal.js';
import AgentResponseTimeEfficiencyModal from '../components/board/AgentResponseTimeEfficiencyModal.js';
import AgentErrorRecoveryRateModal from '../components/board/AgentErrorRecoveryRateModal.js';
import AgentWorkloadBalanceModal from '../components/board/AgentWorkloadBalanceModal.js';
import AgentDeadlineAdherenceAnalyzerModal from '../components/board/AgentDeadlineAdherenceAnalyzerModal.js';
import AgentTokenCostEfficiencyModal from '../components/board/AgentTokenCostEfficiencyModal.js';
import AgentSkillCoverageModal from '../components/board/AgentSkillCoverageModal.js';
import AgentLearningCurveAnalyzerModal from '../components/board/AgentLearningCurveAnalyzerModal.js';
import AgentCollaborationNetworkAnalyzerModal from '../components/board/AgentCollaborationNetworkAnalyzerModal.js';
import AgentPeakPerformanceModal from '../components/board/AgentPeakPerformanceModal.js';
import AgentContextSwitchCostModal from '../components/board/AgentContextSwitchCostModal.js';
import AgentBurnoutRiskModal from '../components/board/AgentBurnoutRiskModal.js';
import AgentHandoffSuccessRateModal from '../components/board/AgentHandoffSuccessRateModal.js';
import AgentTaskCompletionVelocityModal from '../components/board/AgentTaskCompletionVelocityModal.js';
import AgentInterruptionFrequencyModal from '../components/board/AgentInterruptionFrequencyModal.js';
import AgentSessionDurationAnalyzerModal from '../components/board/AgentSessionDurationAnalyzerModal.js';
import AgentFailurePatternModal from '../components/board/AgentFailurePatternModal.js';
import AgentQueueDepthAnalyzerModal from '../components/board/AgentQueueDepthAnalyzerModal.js';
import AgentRetryRateModal from '../components/board/AgentRetryRateModal.js';
import AgentAvailabilityModal from '../components/board/AgentAvailabilityModal.js';
import AgentSpecializationIndexModal from '../components/board/AgentSpecializationIndexModal.js';
import AgentResponseLagModal from '../components/board/AgentResponseLagModal.js';
import AgentCapacityUtilizationModal from '../components/board/AgentCapacityUtilizationModal.js';
import AgentThroughputVariabilityModal from '../components/board/AgentThroughputVariabilityModal.js';
import AgentCostPerOutcomeModal from '../components/board/AgentCostPerOutcomeModal.js';
import AgentWorkloadSaturationModal from '../components/board/AgentWorkloadSaturationModal.js';
import AgentRecoveryTimeModal from '../components/board/AgentRecoveryTimeModal.js';
import AgentEscalationRateModal from '../components/board/AgentEscalationRateModal.js';
import AgentKnowledgeGapAnalyzerModal from '../components/board/AgentKnowledgeGapAnalyzerModal.js';
import AgentIdleTimeTrackerModal from '../components/board/AgentIdleTimeTrackerModal.js';
import AgentParallelTaskEfficiencyTrackerModal from '../components/board/AgentParallelTaskEfficiencyTrackerModal.js';
import AgentContextRetentionAnalyzerModal from '../components/board/AgentContextRetentionAnalyzerModal.js';
import AgentGoalDriftAnalyzerModal from '../components/board/AgentGoalDriftAnalyzerModal.js';
import AgentDecisionLatencyAnalyzerModal from '../components/board/AgentDecisionLatencyAnalyzerModal.js';
import AgentOutputQualityConsistencyModal from '../components/board/AgentOutputQualityConsistencyModal.js';
import AgentCollaborationEfficiencyAnalyzerModal from '../components/board/AgentCollaborationEfficiencyAnalyzerModal.js';
import AgentInstructionAdherenceAnalyzerModal from '../components/board/AgentInstructionAdherenceAnalyzerModal.js';
import AgentCommunicationQualityAnalyzerModal from '../components/board/AgentCommunicationQualityAnalyzerModal.js';
import AgentAdaptationSpeedAnalyzerModal from '../components/board/AgentAdaptationSpeedAnalyzerModal.js';
import AgentSelfCorrectionRateAnalyzerModal from '../components/board/AgentSelfCorrectionRateAnalyzerModal.js';
import AgentConfidenceCalibrationAnalyzerModal from '../components/board/AgentConfidenceCalibrationAnalyzerModal.js';
import AgentTaskPrioritizationAccuracyAnalyzerModal from '../components/board/AgentTaskPrioritizationAccuracyAnalyzerModal.js';
import AgentToolSelectionAccuracyAnalyzerModal from '../components/board/AgentToolSelectionAccuracyAnalyzerModal.js';
import AgentWorkflowCoverageAnalyzerModal from '../components/board/AgentWorkflowCoverageAnalyzerModal.js';
import AgentDependencyRiskAnalyzerModal from '../components/board/AgentDependencyRiskAnalyzerModal.js';
import AgentMultiAgentSyncEfficiencyModal from '../components/board/AgentMultiAgentSyncEfficiencyModal.js';
import AgentOutputAccuracyRateModal from '../components/board/AgentOutputAccuracyRateModal.js';
import AgentGoalCompletionRateAnalyzerModal from '../components/board/AgentGoalCompletionRateAnalyzerModal.js';
import AgentPromptEfficiencyAnalyzerModal from '../components/board/AgentPromptEfficiencyAnalyzerModal.js';
import AgentLearningRateAnalyzerModal from '../components/board/AgentLearningRateAnalyzerModal.js';
import AgentErrorRecoverySpeedAnalyzerModal from '../components/board/AgentErrorRecoverySpeedAnalyzerModal.js';
import AgentAutonomyLevelAnalyzerModal from '../components/board/AgentAutonomyLevelAnalyzerModal.js';
import AgentResourceEfficiencyAnalyzerModal from '../components/board/AgentResourceEfficiencyAnalyzerModal.js';
import AgentMultiTurnConsistencyAnalyzerModal from '../components/board/AgentMultiTurnConsistencyAnalyzerModal.js';
import AgentPromptSensitivityAnalyzerModal from '../components/board/AgentPromptSensitivityAnalyzerModal.js';
import AgentDecisionConfidenceAnalyzerModal from '../components/board/AgentDecisionConfidenceAnalyzerModal.js';
import AgentKnowledgeTransferEfficiencyAnalyzerModal from '../components/board/AgentKnowledgeTransferEfficiencyAnalyzerModal.js';
import AgentInstructionComplexityAnalyzerModal from '../components/board/AgentInstructionComplexityAnalyzerModal.js';
import AgentContextWindowUtilizationAnalyzerModal from '../components/board/AgentContextWindowUtilizationAnalyzerModal.js';
import AgentCognitiveLoadEstimatorModal from '../components/board/AgentCognitiveLoadEstimatorModal.js';
import AgentGoalAlignmentScoreModal from '../components/board/AgentGoalAlignmentScoreModal.js';
import AgentTrustScoreAnalyzerModal from '../components/board/AgentTrustScoreAnalyzerModal.js';
import AgentWorkflowBottleneckAnalyzerModal from '../components/board/AgentWorkflowBottleneckAnalyzerModal.js';
import AgentFeedbackIntegrationSpeedAnalyzerModal from '../components/board/AgentFeedbackIntegrationSpeedAnalyzerModal.js';
import AgentScopeCreepDetectorModal from '../components/board/AgentScopeCreepDetectorModal.js';
import AgentAttentionSpanAnalyzerModal from '../components/board/AgentAttentionSpanAnalyzerModal.js';
import AgentHallucinationRateAnalyzerModal from '../components/board/AgentHallucinationRateAnalyzerModal.js';
import AgentToolUsageEfficiencyAnalyzerModal from '../components/board/AgentToolUsageEfficiencyAnalyzerModal.js';
import AgentInstructionParseAccuracyAnalyzerModal from '../components/board/AgentInstructionParseAccuracyAnalyzerModal.js';
import AgentResponseCoherenceAnalyzerModal from '../components/board/AgentResponseCoherenceAnalyzerModal.js';
import AgentSemanticDriftAnalyzerModal from '../components/board/AgentSemanticDriftAnalyzerModal.js';
import AgentBiasDetectionRateAnalyzerModal from '../components/board/AgentBiasDetectionRateAnalyzerModal.js';
import AgentMemoryPersistenceAnalyzerModal from '../components/board/AgentMemoryPersistenceAnalyzerModal.js';
import AgentReasoningChainDepthAnalyzerModal from '../components/board/AgentReasoningChainDepthAnalyzerModal.js';
import AgentErrorPropagationAnalyzerModal from '../components/board/AgentErrorPropagationAnalyzerModal.js';
import AgentAbstractionLevelAnalyzerModal from '../components/board/AgentAbstractionLevelAnalyzerModal.js';
import AgentTemporalConsistencyAnalyzerModal from '../components/board/AgentTemporalConsistencyAnalyzerModal.js';
import AgentOutputFormatComplianceAnalyzerModal from '../components/board/AgentOutputFormatComplianceAnalyzerModal.js';
import AgentCapabilityBoundaryAwarenessAnalyzerModal from '../components/board/AgentCapabilityBoundaryAwarenessAnalyzerModal.js';
import AgentProactiveInitiativeRateAnalyzerModal from '../components/board/AgentProactiveInitiativeRateAnalyzerModal.js';
import AgentKnowledgeBoundaryMappingAnalyzerModal from '../components/board/AgentKnowledgeBoundaryMappingAnalyzerModal.js';
import { AgentCommunicationOverheadAnalyzerModal } from '../components/board/AgentCommunicationOverheadAnalyzerModal.js';
import { AgentSpecializationDriftAnalyzerModal } from '../components/board/AgentSpecializationDriftAnalyzerModal.js';
import { AgentCognitiveFlexibilityAnalyzerModal } from '../components/board/AgentCognitiveFlexibilityAnalyzerModal.js';
import { AgentDelegationAccuracyAnalyzerModal } from '../components/board/AgentDelegationAccuracyAnalyzerModal.js';
import { AgentInstructionClarityScoreAnalyzerModal } from '../components/board/AgentInstructionClarityScoreAnalyzerModal.js';
import { AgentContextUtilizationEfficiencyAnalyzerModal } from '../components/board/AgentContextUtilizationEfficiencyAnalyzerModal.js';
import { AgentMultiModalProcessingEfficiencyAnalyzerModal } from '../components/board/AgentMultiModalProcessingEfficiencyAnalyzerModal.js';
import { AgentConstraintSatisfactionRateAnalyzerModal } from '../components/board/AgentConstraintSatisfactionRateAnalyzerModal.js';
import { AgentOutputCompletenessAnalyzerModal } from '../components/board/AgentOutputCompletenessAnalyzerModal.js';
import { AgentInstructionDisambiguationRateAnalyzerModal } from '../components/board/AgentInstructionDisambiguationRateAnalyzerModal.js';
import { AgentParallelismEfficiencyAnalyzerModal } from '../components/board/AgentParallelismEfficiencyAnalyzerModal.js';
import { AgentDecisionReversalRateAnalyzerModal } from '../components/board/AgentDecisionReversalRateAnalyzerModal.js';
import { AgentPriorityAlignmentRateAnalyzerModal } from '../components/board/AgentPriorityAlignmentRateAnalyzerModal.js';
import { AgentSessionWarmUpTimeAnalyzerModal } from '../components/board/AgentSessionWarmUpTimeAnalyzerModal.js';
import { AgentInteractionRichnessAnalyzerModal } from '../components/board/AgentInteractionRichnessAnalyzerModal.js';
import { AgentBoundaryViolationRateAnalyzerModal } from '../components/board/AgentBoundaryViolationRateAnalyzerModal.js';
import { AgentSemanticConsistencyRateAnalyzerModal } from '../components/board/AgentSemanticConsistencyRateAnalyzerModal.js';
import { AgentKnowledgeRecencyIndexAnalyzerModal } from '../components/board/AgentKnowledgeRecencyIndexAnalyzerModal.js';
import { AgentTaskScopeExpansionRateAnalyzerModal } from '../components/board/AgentTaskScopeExpansionRateAnalyzerModal.js';
import { AgentResponseLatencyAnalyzerModal } from '../components/board/AgentResponseLatencyAnalyzerModal.js';
import { AgentOutputVerbosityAnalyzerModal } from '../components/board/AgentOutputVerbosityAnalyzerModal.js';
import { AgentFocusRetentionAnalyzerModal } from '../components/board/AgentFocusRetentionAnalyzerModal.js';
import { AgentInstructionRedundancyAnalyzerModal } from '../components/board/AgentInstructionRedundancyAnalyzerModal';
import { AgentGoalDriftRateAnalyzerModal } from '../components/board/AgentGoalDriftRateAnalyzerModal';
import { AgentHypothesisTestingRateAnalyzerModal } from '../components/board/AgentHypothesisTestingRateAnalyzerModal';
import { AgentCrossDomainTransferAnalyzerModal } from '../components/board/AgentCrossDomainTransferAnalyzerModal';
import { AgentInstructionFollowingFidelityAnalyzerModal } from '../components/board/AgentInstructionFollowingFidelityAnalyzerModal';
import { AgentAdaptiveLearningRateAnalyzerModal } from '../components/board/AgentAdaptiveLearningRateAnalyzerModal';
import { AgentCollaborationBottleneckAnalyzerModal } from '../components/board/AgentCollaborationBottleneckAnalyzerModal';
import { AgentContextSwitchingCostAnalyzerModal } from '../components/board/AgentContextSwitchingCostAnalyzerModal';
import { AgentCalibrationScoreAnalyzerModal } from '../components/board/AgentCalibrationScoreAnalyzerModal';
import { AgentRecoveryTimeAnalyzerModal } from '../components/board/AgentRecoveryTimeAnalyzerModal';
import { AgentInterruptionHandlingEfficiencyAnalyzerModal } from '../components/board/AgentInterruptionHandlingEfficiencyAnalyzerModal';
import { AgentNarrativeCoherenceAnalyzerModal } from '../components/board/AgentNarrativeCoherenceAnalyzerModal';
import HelpModal from '../components/common/HelpModal.js';
import HelpContent from '../components/common/HelpContent.js';
import HelpTooltip from '../components/common/HelpTooltip.js';
import UserAvatar from '../components/common/UserAvatar.js';
import type { Ticket } from '@ai-jam/shared';
import { getClientErrorMessage } from '../api/client.js';
import { toast } from '../stores/toast-store.js';

// ---- Modal Component ----
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (modal) {
      modal.focus();
    }
    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="bg-gray-900 border border-gray-700 rounded-xl p-4 md:p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const SIDEBAR_STORAGE_KEY = 'ai-jam:sidebar-width';

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId!);
  const { data: features } = useFeatures(projectId!);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [selectedFeatureId, setSelectedFeatureId] = useState<string | undefined>();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [epicFilter, setEpicFilter] = useState<string | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [personaFilter, setPersonaFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByEpic, setGroupByEpic] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: board, isLoading: boardLoading } = useBoard(projectId!, selectedFeatureId);

  // Real-time sync
  useBoardSync(projectId!);
  useAgentSync(projectId!);
  useNotificationSync();

  const [showAgentPanel, setShowAgentPanel] = useState(false);

  const createFeature = useCreateFeature(projectId!);
  const createTicket = useCreateTicket(projectId!);
  const sprintPlan = useSprintPlan();

  const { data: sessions } = useProjectSessions(projectId!);
  const [showSessionsSidebar, setShowSessionsSidebar] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored ? Math.min(480, Math.max(200, Number(stored))) : 256;
  });

  const persistSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(width));
  }, []);

  const [showNewFeature, setShowNewFeature] = useState(false);
  const [featureTitle, setFeatureTitle] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [boardError, setBoardError] = useState<unknown>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSprintAnalysis, setShowSprintAnalysis] = useState(false);
  const [showSprintPlan, setShowSprintPlan] = useState(false);
  const [showStandup, setShowStandup] = useState(false);
  const [showRetrospective, setShowRetrospective] = useState(false);
  const [showBlockers, setShowBlockers] = useState(false);
  const blockerAnalysis = useBlockerAnalysis();
  const [showPrioritizer, setShowPrioritizer] = useState(false);
  const ticketPrioritizer = useTicketPrioritizer();
  const [showEpicHealth, setShowEpicHealth] = useState(false);
  const epicHealth = useEpicHealth();
  const { analyze: analyzeProjectHealth, loading: projectHealthLoading, result: projectHealthResult, setResult: setProjectHealthResult } = useProjectHealth();
  const { analyze: analyzeDeadlineRisk, loading: deadlineRiskLoading, result: deadlineRiskResult, setResult: setDeadlineRiskResult } = useDeadlineRisk();
  const releaseReadiness = useReleaseReadiness();
  const workloadBalance = useWorkloadBalance();
  const agentPerformance = useAgentPerformance();
  const [showAgentPerformance, setShowAgentPerformance] = useState(false);
  const agentRouting = useAgentRouting();
  const [showAgentRouting, setShowAgentRouting] = useState(false);
  const escalationDetect = useEscalationDetect();
  const [showEscalationDetector, setShowEscalationDetector] = useState(false);
  const skillProfiler = useAgentSkillProfiles();
  const [showSkillProfiler, setShowSkillProfiler] = useState(false);
  const agentCollaboration = useAgentCollaboration();
  const [showCollaboration, setShowCollaboration] = useState(false);
  const agentBurnout = useAgentBurnout();
  const [showAgentBurnout, setShowAgentBurnout] = useState(false);
  const knowledgeGap = useAgentKnowledgeGap(projectId!);
  const [showKnowledgeGap, setShowKnowledgeGap] = useState(false);
  const handoffQuality = useAgentHandoffQuality();
  const [showHandoffQuality, setShowHandoffQuality] = useState(false);
  const agentTaskSequence = useAgentTaskSequence();
  const [showAgentTaskSequence, setShowAgentTaskSequence] = useState(false);
  const agentLoadPredictor = useAgentLoadPredictor();
  const [showAgentLoadPredictor, setShowAgentLoadPredictor] = useState(false);
  const agentVelocityForecast = useAgentVelocityForecast();
  const [showAgentVelocityForecast, setShowAgentVelocityForecast] = useState(false);
  const agentSprintCommitment = useAgentSprintCommitment();
  const [showAgentSprintCommitment, setShowAgentSprintCommitment] = useState(false);
  const collaborationNetwork = useAgentCollaborationNetwork(projectId!);
  const [showCollaborationNetwork, setShowCollaborationNetwork] = useState(false);
  const [showContextRetention, setShowContextRetention] = useState(false);
  const agentFocusAdvisor = useAgentFocusAdvisor();
  const [showAgentFocusAdvisor, setShowAgentFocusAdvisor] = useState(false);
  const agentResponseTime = useAgentResponseTime();
  const [showAgentResponseTime, setShowAgentResponseTime] = useState(false);
  const agentPriorityAlignment = useAgentPriorityAlignment();
  const [showPriorityAlignment, setShowPriorityAlignment] = useState(false);
  const agentStallDetector = useAgentStallDetector();
  const [showStallDetector, setShowStallDetector] = useState(false);
  const agentSpecializationMapper = useAgentSpecializationMapper();
  const [showSpecializationMapper, setShowSpecializationMapper] = useState(false);
  const agentBottleneckAnalyzer = useAgentBottleneckAnalyzer();
  const [showBottleneckAnalyzer, setShowBottleneckAnalyzer] = useState(false);
  const agentQueueDepth = useAgentQueueDepth();
  const [showAgentQueueDepth, setShowAgentQueueDepth] = useState(false);
  const agentSkillGap = useAgentSkillGap();
  const [showAgentSkillGap, setShowAgentSkillGap] = useState(false);
  const agentConflictDetector = useAgentConflictDetector();
  const [showAgentConflictDetector, setShowAgentConflictDetector] = useState(false);
  const agentDecisionQuality = useAgentDecisionQuality();
  const [showAgentDecisionQuality, setShowAgentDecisionQuality] = useState(false);
  const agentPerformanceTrend = useAgentPerformanceTrend();
  const [showAgentPerformanceTrend, setShowAgentPerformanceTrend] = useState(false);
  const agentCoverageGap = useAgentCoverageGap();
  const [showAgentCoverageGap, setShowAgentCoverageGap] = useState(false);
  const agentDependencyMapper = useAgentDependencyMapper();
  const [showAgentDependencyMapper, setShowAgentDependencyMapper] = useState(false);
  const agentContextUtilization = useAgentContextUtilization();
  const [showAgentContextUtilization, setShowAgentContextUtilization] = useState(false);
  const agentHandoffSuccess = useAgentHandoffSuccess();
  const [showAgentHandoffSuccess, setShowAgentHandoffSuccess] = useState(false);
  const agentIdleTime = useAgentIdleTime();
  const [showAgentIdleTime, setShowAgentIdleTime] = useState(false);
  const agentThroughputEfficiency = useAgentThroughputEfficiency();
  const [showAgentThroughputEfficiency, setShowAgentThroughputEfficiency] = useState(false);
  const agentWorkloadFairness = useAgentWorkloadFairness();
  const [showAgentWorkloadFairness, setShowAgentWorkloadFairness] = useState(false);
  const agentErrorRates = useAgentErrorRates();
  const [showAgentErrorRates, setShowAgentErrorRates] = useState(false);
  const agentEscalationPatterns = useAgentEscalationPatterns();
  const [showAgentEscalationPatterns, setShowAgentEscalationPatterns] = useState(false);
  const agentGoalAlignment = useAgentGoalAlignment();
  const [showAgentGoalAlignment, setShowAgentGoalAlignment] = useState(false);
  const agentRecoveryPatterns = useAgentRecoveryPatterns();
  const [showAgentRecoveryPatterns, setShowAgentRecoveryPatterns] = useState(false);
  const agentTaskVelocity = useAgentTaskVelocity();
  const [showAgentTaskVelocity, setShowAgentTaskVelocity] = useState(false);
  const agentContextSwitch = useAgentContextSwitch();
  const [showAgentContextSwitch, setShowAgentContextSwitch] = useState(false);
  const agentParallelCapacity = useAgentParallelCapacity();
  const [showAgentParallelCapacity, setShowAgentParallelCapacity] = useState(false);
  const agentEstimationAccuracy = useAgentEstimationAccuracy();
  const [showAgentEstimationAccuracy, setShowAgentEstimationAccuracy] = useState(false);
  const agentTaskAbandonment = useAgentTaskAbandonment();
  const [showAgentTaskAbandonment, setShowAgentTaskAbandonment] = useState(false);
  const agentCommunicationQuality = useAgentCommunicationQuality();
  const [showAgentCommunicationQuality, setShowAgentCommunicationQuality] = useState(false);
  const agentWorkloadDistribution = useAgentWorkloadDistribution();
  const [showAgentWorkloadDistribution, setShowAgentWorkloadDistribution] = useState(false);
  const [agentOutputQualityScores, setAgentOutputQualityScores] = useState<AgentOutputQualityReport | null>(null);
  const [agentOutputQualityLoading, setAgentOutputQualityLoading] = useState(false);
  const [showAgentOutputQuality, setShowAgentOutputQuality] = useState(false);
  const agentTaskComplexity = useAgentTaskComplexity();
  const [showAgentTaskComplexity, setShowAgentTaskComplexity] = useState(false);
  const agentSessionDepth = useAgentSessionDepth();
  const [showAgentSessionDepth, setShowAgentSessionDepth] = useState(false);
  const agentFeedbackLoops = useAgentFeedbackLoops();
  const [showAgentFeedbackLoops, setShowAgentFeedbackLoops] = useState(false);
  const agentReassignmentRates = useAgentReassignmentRates();
  const [showAgentReassignmentRates, setShowAgentReassignmentRates] = useState(false);
  const [showLearningCurveModal, setShowLearningCurveModal] = useState(false);
  const [learningCurveData, setLearningCurveData] = useState<LearningCurveReport | null>(null);
  const agentAutonomy = useAgentAutonomy(projectId!);
  const [showAgentAutonomy, setShowAgentAutonomy] = useState(false);
  const agentReworkRate = useAgentReworkRate(projectId!);
  const [showAgentReworkRate, setShowAgentReworkRate] = useState(false);
  const agentDecisionSpeed = useAgentDecisionSpeed(projectId!);
  const [showAgentDecisionSpeed, setShowAgentDecisionSpeed] = useState(false);
  const agentHandoffChainDepth = useAgentHandoffChainDepth(projectId!);
  const [showAgentHandoffChainDepth, setShowAgentHandoffChainDepth] = useState(false);
  const agentScopeAdherence = useAgentScopeAdherence(projectId!);
  const [showAgentScopeAdherence, setShowAgentScopeAdherence] = useState(false);
  const agentBlockerFrequency = useAgentBlockerFrequency(projectId!);
  const [showAgentBlockerFrequency, setShowAgentBlockerFrequency] = useState(false);
  const agentTokenBudget = useAgentTokenBudget(projectId!);
  const [showAgentTokenBudget, setShowAgentTokenBudget] = useState(false);
  const agentKnowledgeFreshness = useAgentKnowledgeFreshness(projectId!);
  const [showAgentKnowledgeFreshness, setShowAgentKnowledgeFreshness] = useState(false);
  const agentResponseLatency = useAgentResponseLatency(projectId!);
  const [showAgentResponseLatency, setShowAgentResponseLatency] = useState(false);
  const agentErrorRecovery = useAgentErrorRecovery(projectId!);
  const [showAgentErrorRecovery, setShowAgentErrorRecovery] = useState(false);
  const agentPersonaAlignmentMutation = useAgentPersonaAlignment(projectId!);
  const [showAgentPersonaAlignment, setShowAgentPersonaAlignment] = useState(false);
  const [agentPersonaAlignmentResult, setAgentPersonaAlignmentResult] = useState<PersonaAlignmentReport | null>(null);
  const agentCollaborationGraphMutation = useAgentCollaborationGraph(projectId!);
  const [showAgentCollaborationGraph, setShowAgentCollaborationGraph] = useState(false);
  const [agentCollaborationGraphResult, setAgentCollaborationGraphResult] = useState<AgentCollaborationGraphReport | null>(null);
  const agentMultitaskingEfficiencyMutation = useAgentMultitaskingEfficiency(projectId!);
  const [showAgentMultitaskingEfficiency, setShowAgentMultitaskingEfficiency] = useState(false);
  const [agentMultitaskingEfficiencyResult, setAgentMultitaskingEfficiencyResult] = useState<MultitaskingEfficiencyReport | null>(null);
  const agentConfidenceCalibration = useAnalyzeAgentConfidenceCalibration();
  const [showAgentConfidenceCalibration, setShowAgentConfidenceCalibration] = useState(false);
  const agentFeedbackIncorporation = useAgentFeedbackIncorporation(projectId!);
  const [showAgentFeedbackIncorporation, setShowAgentFeedbackIncorporation] = useState(false);
  const agentSpecializationDrift = useAgentSpecializationDrift(projectId!);
  const [showAgentSpecializationDrift, setShowAgentSpecializationDrift] = useState(false);
  const agentInterruptionImpact = useAgentInterruptionImpact(projectId!);
  const [showAgentInterruptionImpact, setShowAgentInterruptionImpact] = useState(false);
  const agentThroughputRate = useAgentThroughputRate(projectId!);
  const [showAgentThroughputRate, setShowAgentThroughputRate] = useState(false);
  const agentSuccessRate = useAgentSuccessRate(projectId!);
  const [showAgentSuccessRate, setShowAgentSuccessRate] = useState(false);
  const agentCostEfficiency = useAgentCostEfficiency(projectId!);
  const [showAgentCostEfficiency, setShowAgentCostEfficiency] = useState(false);
  const agentDeadlineAdherence = useAgentDeadlineAdherence(projectId!);
  const [showAgentDeadlineAdherence, setShowAgentDeadlineAdherence] = useState(false);
  const agentSessionDuration = useAgentSessionDuration(projectId!);
  const [showAgentSessionDuration, setShowAgentSessionDuration] = useState(false);
  const agentRetryPattern = useAgentRetryPattern(projectId!);
  const [showAgentRetryPattern, setShowAgentRetryPattern] = useState(false);
  const agentToolUsagePattern = useAgentToolUsagePattern(projectId!);
  const [showAgentToolUsagePattern, setShowAgentToolUsagePattern] = useState(false);
  const agentPriorityAdherence = useAgentPriorityAdherence(projectId!);
  const [showAgentPriorityAdherence, setShowAgentPriorityAdherence] = useState(false);
  const cognitiveLoad = useAgentCognitiveLoad(projectId!);
  const [showCognitiveLoad, setShowCognitiveLoad] = useState(false);
  const parallelTaskEfficiency = useAgentParallelTaskEfficiency(projectId!);
  const [showParallelTaskEfficiency, setShowParallelTaskEfficiency] = useState(false);
  const learningVelocity = useAgentLearningVelocity(projectId!);
  const [showLearningVelocity, setShowLearningVelocity] = useState(false);
  const agentGoalCompletion = useAgentGoalCompletion(projectId!);
  const [showAgentGoalCompletion, setShowAgentGoalCompletion] = useState(false);
  const agentCommunicationPatterns = useAgentCommunicationPatterns(projectId!);
  const [showAgentCommunicationPatterns, setShowAgentCommunicationPatterns] = useState(false);
  const agentDecisionQualityV2 = useAgentDecisionQualityV2(projectId!);
  const [showAgentDecisionQualityV2, setShowAgentDecisionQualityV2] = useState(false);
  const agentSelfCorrectionRate = useAgentSelfCorrectionRate(projectId!);
  const [showAgentSelfCorrectionRate, setShowAgentSelfCorrectionRate] = useState(false);
  const agentDependencyResolution = useAgentDependencyResolution(projectId!);
  const [showAgentDependencyResolution, setShowAgentDependencyResolution] = useState(false);
  const contextWindow = useAgentContextWindow(projectId!);
  const [showContextWindow, setShowContextWindow] = useState(false);
  const agentOutputConsistency = useAgentOutputConsistency(projectId!);
  const [showAgentOutputConsistency, setShowAgentOutputConsistency] = useState(false);
  const agentCollaborationEfficiency = useAgentCollaborationEfficiency(projectId!);
  const [showAgentCollaborationEfficiency, setShowAgentCollaborationEfficiency] = useState(false);
  const agentAdaptationSpeed = useAgentAdaptationSpeed(projectId!);
  const [showAgentAdaptationSpeed, setShowAgentAdaptationSpeed] = useState(false);
  const agentScopeDrift = useAgentScopeDrift(projectId!);
  const [showAgentScopeDrift, setShowAgentScopeDrift] = useState(false);
  const agentInstructionCompliance = useAgentInstructionCompliance(projectId!);
  const [showAgentInstructionCompliance, setShowAgentInstructionCompliance] = useState(false);
  const agentEscalationPatternAnalyzer = useAgentEscalationPatternAnalyzer(projectId!);
  const [showAgentEscalationPatternAnalyzer, setShowAgentEscalationPatternAnalyzer] = useState(false);
  const agentFeedbackIntegration = useAgentFeedbackIntegration(projectId!);
  const [showAgentFeedbackIntegration, setShowAgentFeedbackIntegration] = useState(false);
  const agentProactivity = useAgentProactivity(projectId!);
  const [showAgentProactivity, setShowAgentProactivity] = useState(false);
  const agentDecisionLatency = useAgentDecisionLatency(projectId!);
  const [showAgentDecisionLatency, setShowAgentDecisionLatency] = useState(false);
  const agentResourceConsumption = useAgentResourceConsumption(projectId!);
  const [showAgentResourceConsumption, setShowAgentResourceConsumption] = useState(false);
  const agentSessionQuality = useAgentSessionQuality(projectId!);
  const [showAgentSessionQuality, setShowAgentSessionQuality] = useState(false);
  const agentWorkflowTransitions = useAgentWorkflowTransitions(projectId!);
  const [showAgentWorkflowTransitions, setShowAgentWorkflowTransitions] = useState(false);
  const agentKnowledgeTransfer = useAgentKnowledgeTransfer(projectId!);
  const [showAgentKnowledgeTransfer, setShowAgentKnowledgeTransfer] = useState(false);
  const agentDelegationDepth = useAgentDelegationDepth(projectId!);
  const [showAgentDelegationDepth, setShowAgentDelegationDepth] = useState(false);
  const agentAutonomyIndex = useAgentAutonomyIndex(projectId!);
  const [showAgentAutonomyIndex, setShowAgentAutonomyIndex] = useState(false);
  const agentBlockedTime = useAgentBlockedTime(projectId!);
  const [showAgentBlockedTime, setShowAgentBlockedTime] = useState(false);
  const agentQualitySpeed = useAgentQualitySpeed(projectId!);
  const [showAgentQualitySpeed, setShowAgentQualitySpeed] = useState(false);
  const agentSpecialization = useAgentSpecialization(projectId!);
  const [showAgentSpecialization, setShowAgentSpecialization] = useState(false);
  const agentCollaborationScore = useAgentCollaborationScore(projectId!);
  const [showAgentCollaborationScore, setShowAgentCollaborationScore] = useState(false);
  const agentThroughput = useAgentThroughput(projectId!);
  const [showAgentThroughput, setShowAgentThroughput] = useState(false);
  const agentIdleTimeAnalyzer = useAgentIdleTimeAnalyzer(projectId!);
  const [showAgentIdleTimeAnalyzer, setShowAgentIdleTimeAnalyzer] = useState(false);
  const agentResponseTimeEfficiency = useAgentResponseTimeEfficiency(projectId!);
  const [showAgentResponseTimeEfficiency, setShowAgentResponseTimeEfficiency] = useState(false);
  const agentErrorRecoveryRate = useAgentErrorRecoveryRate(projectId!);
  const [showAgentErrorRecoveryRate, setShowAgentErrorRecoveryRate] = useState(false);
  const agentWorkloadBalance = useAgentWorkloadBalance(projectId!);
  const [showAgentWorkloadBalance, setShowAgentWorkloadBalance] = useState(false);
  const agentDeadlineAdherenceAnalyzer = useAgentDeadlineAdherenceAnalyzer(projectId!);
  const [showAgentDeadlineAdherenceAnalyzer, setShowAgentDeadlineAdherenceAnalyzer] = useState(false);
  const agentTokenCostEfficiency = useAgentTokenCostEfficiency(projectId!);
  const [showAgentTokenCostEfficiency, setShowAgentTokenCostEfficiency] = useState(false);
  const agentSkillCoverage = useAgentSkillCoverage(projectId!);
  const [showAgentSkillCoverage, setShowAgentSkillCoverage] = useState(false);
  const agentLearningCurveAnalyzer = useAgentLearningCurveAnalyzer(projectId!);
  const [showAgentLearningCurveAnalyzer, setShowAgentLearningCurveAnalyzer] = useState(false);
  const agentCollaborationNetworkAnalyzer = useAgentCollaborationNetworkAnalyzer(projectId!);
  const [showAgentCollaborationNetworkAnalyzer, setShowAgentCollaborationNetworkAnalyzer] = useState(false);
  const agentPeakPerformance = useAgentPeakPerformance(projectId!);
  const [showAgentPeakPerformance, setShowAgentPeakPerformance] = useState(false);
  const agentContextSwitchCost = useAgentContextSwitchCost(projectId!);
  const [showAgentContextSwitchCost, setShowAgentContextSwitchCost] = useState(false);
  const agentBurnoutRisk = useAgentBurnoutRisk(projectId!);
  const [showAgentBurnoutRisk, setShowAgentBurnoutRisk] = useState(false);
  const agentHandoffSuccessRate = useAgentHandoffSuccessRate(projectId!);
  const [showAgentHandoffSuccessRate, setShowAgentHandoffSuccessRate] = useState(false);
  const agentTaskCompletionVelocity = useAgentTaskCompletionVelocity(projectId!);
  const [showAgentTaskCompletionVelocity, setShowAgentTaskCompletionVelocity] = useState(false);
  const agentInterruptionFrequency = useAgentInterruptionFrequency(projectId!);
  const [showAgentInterruptionFrequency, setShowAgentInterruptionFrequency] = useState(false);
  const agentSessionDurationAnalyzer = useAgentSessionDurationAnalyzer(projectId!);
  const [showAgentSessionDurationAnalyzer, setShowAgentSessionDurationAnalyzer] = useState(false);
  const agentFailurePatterns = useAgentFailurePatterns(projectId!);
  const [showAgentFailurePatterns, setShowAgentFailurePatterns] = useState(false);
  const agentQueueDepthAnalyzer = useAgentQueueDepthAnalyzer(projectId!);
  const [showAgentQueueDepthAnalyzer, setShowAgentQueueDepthAnalyzer] = useState(false);
  const agentRetryRate = useAgentRetryRate(projectId!);
  const [showAgentRetryRate, setShowAgentRetryRate] = useState(false);
  const agentAvailability = useAgentAvailability(projectId!);
  const [showAgentAvailability, setShowAgentAvailability] = useState(false);
  const agentSpecializationIndex = useAgentSpecializationIndex(projectId!);
  const [showAgentSpecializationIndex, setShowAgentSpecializationIndex] = useState(false);
  const agentResponseLag = useAgentResponseLag(projectId!);
  const [showAgentResponseLag, setShowAgentResponseLag] = useState(false);
  const agentCapacityUtilization = useAgentCapacityUtilization(projectId!);
  const [showAgentCapacityUtilization, setShowAgentCapacityUtilization] = useState(false);
  const agentThroughputVariability = useAgentThroughputVariability(projectId!);
  const [showAgentThroughputVariability, setShowAgentThroughputVariability] = useState(false);
  const agentCostPerOutcome = useAgentCostPerOutcome(projectId!);
  const [showAgentCostPerOutcome, setShowAgentCostPerOutcome] = useState(false);
  const agentWorkloadSaturation = useAgentWorkloadSaturation(projectId!);
  const [showAgentWorkloadSaturation, setShowAgentWorkloadSaturation] = useState(false);
  const agentRecoveryTime = useAgentRecoveryTime(projectId!);
  const [showAgentRecoveryTime, setShowAgentRecoveryTime] = useState(false);
  const agentEscalationRate = useAgentEscalationRate(projectId!);
  const [showAgentEscalationRate, setShowAgentEscalationRate] = useState(false);
  const agentKnowledgeGapAnalyzer = useAgentKnowledgeGapAnalyzer(projectId!);
  const [showAgentKnowledgeGapAnalyzer, setShowAgentKnowledgeGapAnalyzer] = useState(false);
  const agentIdleTimeTracker = useAgentIdleTimeTracker(projectId!);
  const [showAgentIdleTimeTracker, setShowAgentIdleTimeTracker] = useState(false);
  const agentParallelTaskEfficiencyTracker = useAgentParallelTaskEfficiencyTracker(projectId!);
  const [showAgentParallelTaskEfficiencyTracker, setShowAgentParallelTaskEfficiencyTracker] = useState(false);
  const agentContextRetentionAnalyzer = useAgentContextRetentionAnalyzer(projectId!);
  const [showAgentContextRetentionAnalyzer, setShowAgentContextRetentionAnalyzer] = useState(false);
  const agentGoalDriftAnalyzer = useAgentGoalDriftAnalyzer(projectId!);
  const [showAgentGoalDriftAnalyzer, setShowAgentGoalDriftAnalyzer] = useState(false);
  const agentDecisionLatencyAnalyzer = useAgentDecisionLatencyAnalyzer(projectId!);
  const [showAgentDecisionLatencyAnalyzer, setShowAgentDecisionLatencyAnalyzer] = useState(false);
  const agentOutputQualityConsistency = useAgentOutputQualityConsistency(projectId!);
  const [showAgentOutputQualityConsistency, setShowAgentOutputQualityConsistency] = useState(false);
  const agentCollaborationEfficiencyAnalyzer = useAgentCollaborationEfficiencyAnalyzer(projectId!);
  const [showAgentCollaborationEfficiencyAnalyzer, setShowAgentCollaborationEfficiencyAnalyzer] = useState(false);
  const agentInstructionAdherenceAnalyzer = useAgentInstructionAdherenceAnalyzer(projectId!);
  const [showAgentInstructionAdherenceAnalyzer, setShowAgentInstructionAdherenceAnalyzer] = useState(false);
  const agentCommunicationQualityAnalyzer = useAgentCommunicationQualityAnalyzer(projectId!);
  const [showAgentCommunicationQualityAnalyzer, setShowAgentCommunicationQualityAnalyzer] = useState(false);
  const agentAdaptationSpeedAnalyzer = useAgentAdaptationSpeedAnalyzer(projectId!);
  const [showAgentAdaptationSpeedAnalyzer, setShowAgentAdaptationSpeedAnalyzer] = useState(false);
  const agentSelfCorrectionRateAnalyzer = useAgentSelfCorrectionRateAnalyzer(projectId!);
  const [showAgentSelfCorrectionRateAnalyzer, setShowAgentSelfCorrectionRateAnalyzer] = useState(false);
  const agentConfidenceCalibrationAnalyzer = useAgentConfidenceCalibrationAnalyzer(projectId!);
  const [showAgentConfidenceCalibrationAnalyzer, setShowAgentConfidenceCalibrationAnalyzer] = useState(false);
  const agentTaskPrioritizationAccuracyAnalyzer = useAgentTaskPrioritizationAccuracyAnalyzer(projectId!);
  const [showAgentTaskPrioritizationAccuracyAnalyzer, setShowAgentTaskPrioritizationAccuracyAnalyzer] = useState(false);
  const agentToolSelectionAccuracyAnalyzer = useAgentToolSelectionAccuracyAnalyzer(projectId!);
  const [showAgentToolSelectionAccuracyAnalyzer, setShowAgentToolSelectionAccuracyAnalyzer] = useState(false);
  const agentWorkflowCoverageAnalyzer = useAgentWorkflowCoverageAnalyzer(projectId!);
  const [showAgentWorkflowCoverageAnalyzer, setShowAgentWorkflowCoverageAnalyzer] = useState(false);
  const agentDependencyRiskAnalyzer = useAgentDependencyRiskAnalyzer(projectId!);
  const [showAgentDependencyRiskAnalyzer, setShowAgentDependencyRiskAnalyzer] = useState(false);
  const agentMultiAgentSyncEfficiency = useAgentMultiAgentSyncEfficiencyAnalyzer(projectId!);
  const [showAgentMultiAgentSyncEfficiency, setShowAgentMultiAgentSyncEfficiency] = useState(false);
  const agentOutputAccuracyRate = useAgentOutputAccuracyRateAnalyzer(projectId!);
  const [showAgentOutputAccuracyRate, setShowAgentOutputAccuracyRate] = useState(false);
  const agentGoalCompletionRateAnalyzer = useAgentGoalCompletionRateAnalyzer(projectId!);
  const [showAgentGoalCompletionRateAnalyzer, setShowAgentGoalCompletionRateAnalyzer] = useState(false);
  const agentPromptEfficiencyAnalyzer = useAgentPromptEfficiencyAnalyzer(projectId!);
  const [showAgentPromptEfficiencyAnalyzer, setShowAgentPromptEfficiencyAnalyzer] = useState(false);
  const agentLearningRateAnalyzer = useAgentLearningRateAnalyzer(projectId!);
  const [showAgentLearningRateAnalyzer, setShowAgentLearningRateAnalyzer] = useState(false);
  const agentErrorRecoverySpeedAnalyzer = useAgentErrorRecoverySpeedAnalyzer(projectId!);
  const [showAgentErrorRecoverySpeedAnalyzer, setShowAgentErrorRecoverySpeedAnalyzer] = useState(false);
  const agentAutonomyLevelAnalyzer = useAgentAutonomyLevelAnalyzer(projectId!);
  const [showAgentAutonomyLevelAnalyzer, setShowAgentAutonomyLevelAnalyzer] = useState(false);
  const agentResourceEfficiencyAnalyzer = useAgentResourceEfficiencyAnalyzer(projectId!);
  const [showAgentResourceEfficiencyAnalyzer, setShowAgentResourceEfficiencyAnalyzer] = useState(false);
  const agentMultiTurnConsistencyAnalyzer = useAgentMultiTurnConsistencyAnalyzer(projectId!);
  const [showAgentMultiTurnConsistencyAnalyzer, setShowAgentMultiTurnConsistencyAnalyzer] = useState(false);
  const agentPromptSensitivityAnalyzer = useAgentPromptSensitivityAnalyzer(projectId!);
  const [showAgentPromptSensitivityAnalyzer, setShowAgentPromptSensitivityAnalyzer] = useState(false);
  const agentDecisionConfidenceAnalyzer = useAgentDecisionConfidenceAnalyzer(projectId!);
  const [showAgentDecisionConfidenceAnalyzer, setShowAgentDecisionConfidenceAnalyzer] = useState(false);
  const agentKnowledgeTransferEfficiencyAnalyzer = useAgentKnowledgeTransferEfficiencyAnalyzer(projectId!);
  const [showAgentKnowledgeTransferEfficiencyAnalyzer, setShowAgentKnowledgeTransferEfficiencyAnalyzer] = useState(false);
  const agentInstructionComplexityAnalyzer = useAgentInstructionComplexityAnalyzer(projectId!);
  const [showAgentInstructionComplexityAnalyzer, setShowAgentInstructionComplexityAnalyzer] = useState(false);
  const agentContextWindowUtilizationAnalyzer = useAgentContextWindowUtilizationAnalyzer(projectId!);
  const [showAgentContextWindowUtilizationAnalyzer, setShowAgentContextWindowUtilizationAnalyzer] = useState(false);
  const agentCognitiveLoadEstimator = useAgentCognitiveLoadEstimator(projectId!);
  const [showAgentCognitiveLoadEstimator, setShowAgentCognitiveLoadEstimator] = useState(false);
  const agentGoalAlignmentScore = useAgentGoalAlignmentScore(projectId!);
  const [showAgentGoalAlignmentScore, setShowAgentGoalAlignmentScore] = useState(false);
  const { analyze: analyzeTrustScore, loading: loadingTrustScore, result: trustScoreResult, setResult: setTrustScoreResult } = useAgentTrustScoreAnalyzer(projectId!);
  const [showAgentTrustScoreAnalyzer, setShowAgentTrustScoreAnalyzer] = useState(false);
  const { analyze: analyzeWorkflowBottleneck, loading: loadingWorkflowBottleneck, result: workflowBottleneckResult, setResult: setWorkflowBottleneckResult } = useAgentWorkflowBottleneckAnalyzer(projectId!);
  const [showAgentWorkflowBottleneckAnalyzer, setShowAgentWorkflowBottleneckAnalyzer] = useState(false);
  const { analyze: analyzeFeedbackIntegrationSpeed, loading: loadingFeedbackIntegrationSpeed, result: feedbackIntegrationSpeedResult, setResult: setFeedbackIntegrationSpeedResult } = useAgentFeedbackIntegrationSpeedAnalyzer(projectId!);
  const [showAgentFeedbackIntegrationSpeedAnalyzer, setShowAgentFeedbackIntegrationSpeedAnalyzer] = useState(false);
  const { analyze: analyzeScopeCreepDetector, loading: loadingScopeCreepDetector, result: scopeCreepDetectorResult, setResult: setScopeCreepDetectorResult } = useAgentScopeCreepDetector(projectId!);
  const [showAgentScopeCreepDetector, setShowAgentScopeCreepDetector] = useState(false);
  const { analyze: analyzeAttentionSpan, loading: loadingAttentionSpan, result: attentionSpanResult, setResult: setAttentionSpanResult } = useAgentAttentionSpanAnalyzer(projectId!);
  const [showAgentAttentionSpanAnalyzer, setShowAgentAttentionSpanAnalyzer] = useState(false);
  const { analyze: analyzeHallucinationRate, loading: loadingHallucinationRate, result: hallucinationRateResult, setResult: setHallucinationRateResult } = useAgentHallucinationRateAnalyzer(projectId!);
  const [showAgentHallucinationRateAnalyzer, setShowAgentHallucinationRateAnalyzer] = useState(false);
  const { analyze: analyzeToolUsageEfficiency, loading: loadingToolUsageEfficiency, result: toolUsageEfficiencyResult, setResult: setToolUsageEfficiencyResult } = useAgentToolUsageEfficiencyAnalyzer(projectId!);
  const [showAgentToolUsageEfficiencyAnalyzer, setShowAgentToolUsageEfficiencyAnalyzer] = useState(false);
  const { analyze: analyzeInstructionParseAccuracy, loading: loadingInstructionParseAccuracy, result: instructionParseAccuracyResult, setResult: setInstructionParseAccuracyResult } = useAgentInstructionParseAccuracyAnalyzer(projectId!);
  const [showAgentInstructionParseAccuracyAnalyzer, setShowAgentInstructionParseAccuracyAnalyzer] = useState(false);
  const agentResponseCoherenceAnalyzer = useAgentResponseCoherenceAnalyzer(projectId!);
  const [showAgentResponseCoherenceAnalyzer, setShowAgentResponseCoherenceAnalyzer] = useState(false);
  const agentSemanticDriftAnalyzer = useAgentSemanticDriftAnalyzer(projectId!);
  const [showAgentSemanticDriftAnalyzer, setShowAgentSemanticDriftAnalyzer] = useState(false);
  const agentBiasDetectionRateAnalyzer = useAgentBiasDetectionRateAnalyzer(projectId!);
  const [showAgentBiasDetectionRateAnalyzer, setShowAgentBiasDetectionRateAnalyzer] = useState(false);
  const agentMemoryPersistenceAnalyzer = useAgentMemoryPersistenceAnalyzer(projectId!);
  const [showAgentMemoryPersistenceAnalyzer, setShowAgentMemoryPersistenceAnalyzer] = useState(false);
  const agentReasoningChainDepthAnalyzer = useAgentReasoningChainDepthAnalyzer(projectId!);
  const [showAgentReasoningChainDepthAnalyzer, setShowAgentReasoningChainDepthAnalyzer] = useState(false);
  const agentErrorPropagationAnalyzer = useAgentErrorPropagationAnalyzer(projectId!);
  const [showAgentErrorPropagationAnalyzer, setShowAgentErrorPropagationAnalyzer] = useState(false);
  const agentAbstractionLevelAnalyzer = useAgentAbstractionLevelAnalyzer(projectId!);
  const [showAgentAbstractionLevelAnalyzer, setShowAgentAbstractionLevelAnalyzer] = useState(false);
  const agentTemporalConsistencyAnalyzer = useAgentTemporalConsistencyAnalyzer(projectId!);
  const [showAgentTemporalConsistencyAnalyzer, setShowAgentTemporalConsistencyAnalyzer] = useState(false);
  const agentOutputFormatComplianceAnalyzer = useAgentOutputFormatComplianceAnalyzer(projectId!);
  const [showAgentOutputFormatComplianceAnalyzer, setShowAgentOutputFormatComplianceAnalyzer] = useState(false);
  const agentCapabilityBoundaryAwarenessAnalyzer = useAgentCapabilityBoundaryAwarenessAnalyzer(projectId!);
  const [showAgentCapabilityBoundaryAwarenessAnalyzer, setShowAgentCapabilityBoundaryAwarenessAnalyzer] = useState(false);
  const agentProactiveInitiativeRateAnalyzer = useAgentProactiveInitiativeRateAnalyzer(projectId!);
  const [showAgentProactiveInitiativeRateAnalyzer, setShowAgentProactiveInitiativeRateAnalyzer] = useState(false);
  const agentKnowledgeBoundaryMappingAnalyzer = useAgentKnowledgeBoundaryMappingAnalyzer(projectId!);
  const [showAgentKnowledgeBoundaryMappingAnalyzer, setShowAgentKnowledgeBoundaryMappingAnalyzer] = useState(false);
  const agentCommunicationOverheadAnalyzer = useAgentCommunicationOverheadAnalyzer(projectId!);
  const [showAgentCommunicationOverheadAnalyzer, setShowAgentCommunicationOverheadAnalyzer] = useState(false);
  const agentSpecializationDriftAnalyzerNew = useAgentSpecializationDriftAnalyzer(projectId!);
  const [showAgentSpecializationDriftAnalyzer, setShowAgentSpecializationDriftAnalyzer] = useState(false);
  const agentCognitiveFlexibilityAnalyzer = useAgentCognitiveFlexibilityAnalyzer(projectId!);
  const [showAgentCognitiveFlexibilityAnalyzer, setShowAgentCognitiveFlexibilityAnalyzer] = useState(false);
  const agentDelegationAccuracyAnalyzer = useAgentDelegationAccuracyAnalyzer(projectId!);
  const [showAgentDelegationAccuracyAnalyzer, setShowAgentDelegationAccuracyAnalyzer] = useState(false);
  const agentInstructionClarityScoreAnalyzer = useAgentInstructionClarityScoreAnalyzer(projectId!);
  const [showAgentInstructionClarityScoreAnalyzer, setShowAgentInstructionClarityScoreAnalyzer] = useState(false);
  const agentContextUtilizationEfficiencyAnalyzer = useAgentContextUtilizationEfficiencyAnalyzer(projectId!);
  const [showAgentContextUtilizationEfficiencyAnalyzer, setShowAgentContextUtilizationEfficiencyAnalyzer] = useState(false);
  const agentMultiModalProcessingEfficiencyAnalyzer = useAgentMultiModalProcessingEfficiencyAnalyzer(projectId!);
  const [showAgentMultiModalProcessingEfficiencyAnalyzer, setShowAgentMultiModalProcessingEfficiencyAnalyzer] = useState(false);
  const agentConstraintSatisfactionRateAnalyzer = useAgentConstraintSatisfactionRateAnalyzer(projectId!);
  const [showAgentConstraintSatisfactionRateAnalyzer, setShowAgentConstraintSatisfactionRateAnalyzer] = useState(false);
  const agentOutputCompletenessAnalyzer = useAgentOutputCompletenessAnalyzer(projectId!);
  const [showAgentOutputCompletenessAnalyzer, setShowAgentOutputCompletenessAnalyzer] = useState(false);
  const agentInstructionDisambiguationRateAnalyzer = useAgentInstructionDisambiguationRateAnalyzer(projectId!);
  const [showAgentInstructionDisambiguationRateAnalyzer, setShowAgentInstructionDisambiguationRateAnalyzer] = useState(false);
  const agentParallelismEfficiencyAnalyzer = useAgentParallelismEfficiencyAnalyzer(projectId!);
  const [showAgentParallelismEfficiencyAnalyzer, setShowAgentParallelismEfficiencyAnalyzer] = useState(false);
  const agentDecisionReversalRateAnalyzer = useAgentDecisionReversalRateAnalyzer(projectId!);
  const [showAgentDecisionReversalRateAnalyzer, setShowAgentDecisionReversalRateAnalyzer] = useState(false);
  const agentPriorityAlignmentRateAnalyzer = useAgentPriorityAlignmentRateAnalyzer(projectId!);
  const [showAgentPriorityAlignmentRateAnalyzer, setShowAgentPriorityAlignmentRateAnalyzer] = useState(false);
  const agentSessionWarmUpTimeAnalyzer = useAgentSessionWarmUpTimeAnalyzer(projectId!);
  const [showAgentSessionWarmUpTimeAnalyzer, setShowAgentSessionWarmUpTimeAnalyzer] = useState(false);
  const agentInteractionRichnessAnalyzer = useAgentInteractionRichnessAnalyzer(projectId!);
  const [showAgentInteractionRichnessAnalyzer, setShowAgentInteractionRichnessAnalyzer] = useState(false);
  const agentBoundaryViolationRateAnalyzer = useAgentBoundaryViolationRateAnalyzer(projectId!);
  const [showAgentBoundaryViolationRateAnalyzer, setShowAgentBoundaryViolationRateAnalyzer] = useState(false);
  const agentSemanticConsistencyRateAnalyzer = useAgentSemanticConsistencyRateAnalyzer(projectId!);
  const [showAgentSemanticConsistencyRateAnalyzer, setShowAgentSemanticConsistencyRateAnalyzer] = useState(false);
  const agentKnowledgeRecencyIndexAnalyzer = useAgentKnowledgeRecencyIndexAnalyzer(projectId!);
  const [showAgentKnowledgeRecencyIndexAnalyzer, setShowAgentKnowledgeRecencyIndexAnalyzer] = useState(false);
  const agentTaskScopeExpansionRateAnalyzer = useAgentTaskScopeExpansionRateAnalyzer(projectId!);
  const [showAgentTaskScopeExpansionRateAnalyzer, setShowAgentTaskScopeExpansionRateAnalyzer] = useState(false);
  const agentResponseLatencyAnalyzer = useAgentResponseLatencyAnalyzer(projectId!);
  const [showAgentResponseLatencyAnalyzer, setShowAgentResponseLatencyAnalyzer] = useState(false);
  const agentOutputVerbosityAnalyzer = useAgentOutputVerbosityAnalyzer(projectId!);
  const [showAgentOutputVerbosityAnalyzer, setShowAgentOutputVerbosityAnalyzer] = useState(false);
  const agentFocusRetentionAnalyzer = useAgentFocusRetentionAnalyzer(projectId!);
  const [showAgentFocusRetentionAnalyzer, setShowAgentFocusRetentionAnalyzer] = useState(false);
  const { analyze: analyzeInstructionRedundancy, loading: instructionRedundancyLoading, result: instructionRedundancyResult, setResult: setInstructionRedundancyResult } = useAgentInstructionRedundancyAnalyzer(projectId ?? '');
  const [showAgentInstructionRedundancyAnalyzer, setShowAgentInstructionRedundancyAnalyzer] = useState(false);
  const { analyze: analyzeGoalDriftRate, loading: goalDriftRateLoading, result: goalDriftRateResult, setResult: setGoalDriftRateResult } = useAgentGoalDriftRateAnalyzer(projectId ?? '');
  const [showAgentGoalDriftRateAnalyzer, setShowAgentGoalDriftRateAnalyzer] = useState(false);
  const { analyze: analyzeHypothesisTestingRate, loading: hypothesisTestingRateLoading, result: hypothesisTestingRateResult, setResult: setHypothesisTestingRateResult } = useAgentHypothesisTestingRateAnalyzer(projectId ?? '');
  const [showAgentHypothesisTestingRateAnalyzer, setShowAgentHypothesisTestingRateAnalyzer] = useState(false);
  const { analyze: analyzeCrossDomainTransfer, loading: crossDomainTransferLoading, result: crossDomainTransferResult, setResult: setCrossDomainTransferResult } = useAgentCrossDomainTransferAnalyzer(projectId ?? '');
  const [showAgentCrossDomainTransferAnalyzer, setShowAgentCrossDomainTransferAnalyzer] = useState(false);
  const { analyze: analyzeInstructionFollowingFidelity, loading: instructionFollowingFidelityLoading, result: instructionFollowingFidelityResult, setResult: setInstructionFollowingFidelityResult } = useAgentInstructionFollowingFidelityAnalyzer(projectId ?? '');
  const [showAgentInstructionFollowingFidelityAnalyzer, setShowAgentInstructionFollowingFidelityAnalyzer] = useState(false);
  const { analyze: analyzeAdaptiveLearningRate, loading: adaptiveLearningRateLoading, result: adaptiveLearningRateResult, setResult: setAdaptiveLearningRateResult } = useAgentAdaptiveLearningRateAnalyzer(projectId ?? '');
  const [showAgentAdaptiveLearningRateAnalyzer, setShowAgentAdaptiveLearningRateAnalyzer] = useState(false);
  const { analyze: analyzeCollaborationBottleneck, loading: collaborationBottleneckLoading, result: collaborationBottleneckResult, setResult: setCollaborationBottleneckResult } = useAgentCollaborationBottleneckAnalyzer(projectId ?? '');
  const [showAgentCollaborationBottleneckAnalyzer, setShowAgentCollaborationBottleneckAnalyzer] = useState(false);
  const { analyze: analyzeContextSwitchingCost, loading: contextSwitchingCostLoading, result: contextSwitchingCostResult, setResult: setContextSwitchingCostResult } = useAgentContextSwitchingCostAnalyzer(projectId ?? '');
  const [showAgentContextSwitchingCostAnalyzer, setShowAgentContextSwitchingCostAnalyzer] = useState(false);
  const { analyze: analyzeCalibrationScore, loading: calibrationScoreLoading, result: calibrationScoreResult, setResult: setCalibrationScoreResult } = useAgentCalibrationScoreAnalyzer(projectId ?? '');
  const [showAgentCalibrationScoreAnalyzer, setShowAgentCalibrationScoreAnalyzer] = useState(false);
  const { analyze: analyzeRecoveryTimeAnalyzer, loading: recoveryTimeAnalyzerLoading, result: recoveryTimeAnalyzerResult, setResult: setRecoveryTimeAnalyzerResult } = useAgentRecoveryTimeAnalyzer(projectId ?? '');
  const [showAgentRecoveryTimeAnalyzer, setShowAgentRecoveryTimeAnalyzer] = useState(false);
  const { analyze: analyzeInterruptionHandlingEfficiency, loading: interruptionHandlingEfficiencyLoading, result: interruptionHandlingEfficiencyResult, setResult: setInterruptionHandlingEfficiencyResult } = useAgentInterruptionHandlingEfficiencyAnalyzer(projectId ?? '');
  const [showAgentInterruptionHandlingEfficiencyAnalyzer, setShowAgentInterruptionHandlingEfficiencyAnalyzer] = useState(false);
  const { analyze: analyzeNarrativeCoherence, loading: narrativeCoherenceLoading, result: narrativeCoherenceResult, setResult: setNarrativeCoherenceResult } = useAgentNarrativeCoherenceAnalyzer(projectId ?? '');
  const [showAgentNarrativeCoherenceAnalyzer, setShowAgentNarrativeCoherenceAnalyzer] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [helpView, setHelpView] = useState<'overview' | 'getting-started' | 'features' | 'shortcuts'>('overview');

  // Keyboard shortcuts: Escape to close modals, ? for shortcuts, H for help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (showNewFeature) setShowNewFeature(false);
        if (showNewTicket) setShowNewTicket(false);
        if (showShortcuts) setShowShortcuts(false);
        if (showMobileMenu) setShowMobileMenu(false);
        if (showHelp) setShowHelp(false);
        if (showSprintAnalysis) setShowSprintAnalysis(false);
        if (showStandup) setShowStandup(false);
        if (showRetrospective) setShowRetrospective(false);
      }

      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
      }

      if ((e.key === 'h' || e.key === 'H') && e.metaKey) {
        e.preventDefault();
        setShowHelp(!showHelp);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewFeature, showNewTicket, showShortcuts, showMobileMenu, showHelp]);

  async function handleCreateFeature(e: React.FormEvent) {
    e.preventDefault();
    try {
      const feature = await createFeature.mutateAsync({ title: featureTitle });
      toast.success(`Feature "${featureTitle}" created`);
      setSelectedFeatureId(feature.id);
      setShowNewFeature(false);
      setFeatureTitle('');
    } catch (error) {
      toast.error(`Failed to create feature: ${getClientErrorMessage(error)}`);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFeatureId) return;
    try {
      await createTicket.mutateAsync({
        title: ticketTitle,
        description: ticketDesc || undefined,
        featureId: selectedFeatureId,
      });
      toast.success(`Ticket "${ticketTitle}" created`);
      setShowNewTicket(false);
      setTicketTitle('');
      setTicketDesc('');
    } catch (error) {
      toast.error(`Failed to create ticket: ${getClientErrorMessage(error)}`);
    }
  }

  // Unique assigned personas for filter dropdown
  const assignedPersonas = useMemo(() => {
    if (!board) return [];
    const personas = new Set<string>();
    for (const col of board.columns) {
      for (const t of col.tickets) {
        if (t.assignedPersona) personas.add(t.assignedPersona);
      }
    }
    return [...personas].sort();
  }, [board]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-800 md:px-2.5"
              aria-label="Back to projects"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Projects</span>
            </button>
            <h1 className="text-base md:text-lg font-bold text-white truncate">{project?.name || 'Loading...'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-3">
              <HelpTooltip
                content="View and manage planning and execution sessions"
                position="bottom"
              >
                <button
                  onClick={() => setShowSessionsSidebar(!showSessionsSidebar)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
                    showSessionsSidebar
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                  aria-label={showSessionsSidebar ? 'Hide sessions' : 'Show sessions'}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sessions
                </button>
              </HelpTooltip>
              <HelpTooltip
                content="Monitor AI agent activity in real-time"
                position="bottom"
              >
                <button
                  onClick={() => setShowAgentPanel(!showAgentPanel)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
                    showAgentPanel
                      ? 'bg-green-600/20 border-green-500 text-green-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                  }`}
                  aria-label={showAgentPanel ? 'Hide agents' : 'Show agents'}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1m8.06-4a6.002 6.002 0 01-9.58-5.092M9 10a3.003 3.003 0 00-.72 2.063L9 10m6-6a3.003 3.003 0 00-.72 2.063L9 10m6-6a3.003 3.003 0 01-.72 2.063L9 10" />
                  </svg>
                  Agents
                </button>
              </HelpTooltip>
              <button
                onClick={() => navigate(`/projects/${projectId}/settings`)}
                className="text-sm px-3 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-all duration-150 flex items-center gap-1.5"
                aria-label="Project settings"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
              <HelpTooltip content="Open keyboard shortcuts" position="bottom">
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="text-sm px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all duration-150"
                  aria-label="Keyboard shortcuts"
                >
                  <kbd className="text-xs font-mono">?</kbd>
                </button>
              </HelpTooltip>
              <HelpTooltip content="Open help documentation" position="bottom">
                <button
                  onClick={() => setShowHelp(true)}
                  className="text-sm px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-indigo-400 hover:text-indigo-300 hover:border-gray-600 transition-all duration-150"
                  aria-label="Help"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </HelpTooltip>
              <div className="w-px h-5 bg-gray-700" />
              <UserAvatar size="md" />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Always show notification bell */}
            <NotificationBell projectId={projectId!} />
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-800 bg-gray-900 animate-in slide-in-from-top duration-200">
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={() => { setShowSessionsSidebar(!showSessionsSidebar); setShowMobileMenu(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-150 flex items-center gap-2 ${
                  showSessionsSidebar
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sessions
              </button>
              <button
                onClick={() => { setShowAgentPanel(!showAgentPanel); setShowMobileMenu(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-150 flex items-center gap-2 ${
                  showAgentPanel
                    ? 'bg-green-600/20 border-green-500 text-green-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1m8.06-4a6.002 6.002 0 01-9.58-5.092M9 10a3.003 3.003 0 00-.72 2.063L9 10m6-6a3.003 3.003 0 00-.72 2.063L9 10m6-6a3.003 3.003 0 01-.72 2.063L9 10" />
                </svg>
                Agents
              </button>
              <button
                onClick={() => { navigate(`/projects/${projectId}/settings`); setShowMobileMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 transition-all duration-150 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
              <button
                onClick={() => { setShowShortcuts(true); setShowMobileMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 transition-all duration-150 flex items-center gap-2"
              >
                <kbd className="text-xs font-mono">?</kbd>
                Keyboard Shortcuts
              </button>
              <div className="border-t border-gray-800 my-2" />
              <div className="px-3 py-2">
                <UserAvatar size="md" showDropdown={false} />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Toolbar */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-4 md:px-6 py-2 flex items-center gap-2 md:gap-3 shrink-0 overflow-x-auto">
        {/* Feature Context */}
        <select
          value={selectedFeatureId || ''}
          onChange={(e) => setSelectedFeatureId(e.target.value || undefined)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-2 md:px-3 py-1.5 focus:outline-none focus:border-indigo-500 min-w-0 max-w-[150px] sm:max-w-[200px] md:max-w-none"
        >
          <option value="">All Features</option>
          {features?.map((f) => (
            <option key={f.id} value={f.id}>{f.title}</option>
          ))}
        </select>

        <button
          onClick={() => setShowNewFeature(true)}
          className="text-indigo-400 hover:text-indigo-300 text-xs sm:text-sm flex items-center gap-1 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Feature</span>
        </button>

        {selectedFeatureId && (
          <button
            onClick={() => navigate(`/projects/${projectId}/features/${selectedFeatureId}/plan`)}
            className="bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30 px-2 md:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden md:inline">Plan with Claude</span>
            <span className="md:hidden">Plan</span>
          </button>
        )}

        <div className="hidden md:block w-px h-5 bg-gray-700" />

        {/* Filters Button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
              filtersOpen
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414-6.414a1 1 0 00-.707 0L9.293 7.293a1 1 0 00-.707.293L2.586 7.293A1 1 0 013 8V4zm0 8v2.586a1 1 0 00.293.707l6.414-6.414a1 1 0 01.707 0L14.707 8.293a1 1 0 01.707.293L20.586 10.293a1 1 0 00.707.707V12a1 1 0 01-1 1H4a1 1 0 01-1-1V12zm0 4v2.586a1 1 0 00.293.707l6.414-6.414a1 1 0 01.707 0L14.707 14.293a1 1 0 01.707.293L20.586 16.293a1 1 0 00.707.707V16a1 1 0 01-1 1H4a1 1 0 01-1-1V16z" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {(epicFilter || priorityFilter || personaFilter || searchQuery) && (
              <span className="ml-0.5 bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">
                {[epicFilter, priorityFilter, personaFilter, searchQuery].filter(Boolean).length}
              </span>
            )}
          </button>

          <FiltersPopover
            isOpen={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            epics={board?.epics || []}
            personas={assignedPersonas}
            epicFilter={epicFilter}
            priorityFilter={priorityFilter}
            personaFilter={personaFilter}
            searchQuery={searchQuery}
            onEpicFilterChange={setEpicFilter}
            onPriorityFilterChange={setPriorityFilter}
            onPersonaFilterChange={setPersonaFilter}
            onSearchChange={setSearchQuery}
            onClearAll={() => {
              setEpicFilter(undefined);
              setPriorityFilter(undefined);
              setPersonaFilter(undefined);
              setSearchQuery('');
            }}
          />
        </div>

        {/* View Toggle */}
        {board && board.epics.length > 0 && (
          <button
            onClick={() => setGroupByEpic(!groupByEpic)}
            className={`text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 shrink-0 ${
              groupByEpic
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="hidden sm:inline">Group by Epic</span>
          </button>
        )}

        {/* Sprint Analysis Button */}
        <button
          onClick={() => setShowSprintAnalysis(true)}
          className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors flex items-center gap-1 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="hidden sm:inline">Sprint Analysis</span>
        </button>

        {/* Plan Sprint Button */}
        <button
          onClick={async () => {
            setShowSprintPlan(true);
            try {
              await sprintPlan.generate(projectId!);
            } catch (error) {
              toast.error(`Failed to generate sprint plan: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={sprintPlan.loading}
          className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Plan Sprint</span>
        </button>

        {/* Standup Report Button */}
        <button
          onClick={() => setShowStandup(true)}
          className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-amber-400 hover:text-amber-300 hover:border-amber-500/50 transition-colors flex items-center gap-1 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="hidden sm:inline">Standup</span>
        </button>

        {/* Retrospective Report Button */}
        <button
          onClick={() => setShowRetrospective(true)}
          className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-teal-400 hover:text-teal-300 hover:border-teal-500/50 transition-colors flex items-center gap-1 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Retro</span>
        </button>

        {/* Prioritize Button */}
        <button
          onClick={async () => {
            setShowPrioritizer(true);
            try {
              await ticketPrioritizer.prioritize(projectId!);
            } catch (error) {
              toast.error(`Failed to prioritize tickets: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={ticketPrioritizer.loading}
          className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m-9 4h5m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <span className="hidden sm:inline">{ticketPrioritizer.loading ? 'Analyzing...' : 'Prioritize'}</span>
        </button>

        {/* Blocker & Dependency Analysis Button */}
        {/* Epic Health Button */}
        {board?.epics?.[0]?.id != null && (
          <button
            onClick={() => epicHealth.analyze(board?.epics?.[0]?.id!)}
            disabled={epicHealth.loading}
            className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-teal-400 hover:text-teal-300 hover:border-teal-500/50 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="hidden sm:inline">{epicHealth.loading ? 'Analyzing...' : 'Epic Health'}</span>
          </button>
        )}

        {/* Project Health Button */}
        <button
          onClick={() => { analyzeProjectHealth(projectId!); }}
          disabled={projectHealthLoading}
          className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50'
        >
          {projectHealthLoading ? (
            <><span className='animate-spin'>⟳</span> Analyzing...</>
          ) : (
            <><span>📊</span> Project Health</>
          )}
        </button>

        {/* Release Readiness Button */}
        <button
          onClick={async () => {
            try {
              await releaseReadiness.check(projectId!, selectedFeatureId);
            } catch (error) {
              toast.error(`Release check failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={releaseReadiness.loading}
          className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
        >
          {releaseReadiness.loading ? (
            <><span className='animate-spin'>⟳</span> Checking...</>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Release Check</>
          )}
        </button>

        {/* Balance Workload Button */}
        <button
          onClick={async () => {
            try {
              await workloadBalance.balance(projectId!, selectedFeatureId);
            } catch (error) {
              toast.error(`Workload analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={workloadBalance.loading}
          className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50'
        >
          {workloadBalance.loading ? (
            <><span className='animate-spin'>⟳</span> Analyzing...</>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 6h18M3 12h18M3 18h18' /></svg> Balance Workload</>
          )}
        </button>

        {/* Agent Performance Button */}
        <button
          onClick={async () => {
            setShowAgentPerformance(true);
            try {
              await agentPerformance.analyze(projectId!);
            } catch (error) {
              toast.error(`Agent performance analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentPerformance.loading}
          className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
        >
          {agentPerformance.loading ? (
            <><span className='animate-spin'>⟳</span> Analyzing...</>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /></svg> Agent Performance</>
          )}
        </button>

        {/* Route Tickets Button */}
        <button
          onClick={async () => {
            setShowAgentRouting(true);
            try {
              await agentRouting.route(projectId!);
            } catch (error) {
              toast.error(`Agent routing failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentRouting.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentRouting.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' /></svg> Route Tickets</>
          )}
        </button>

        {/* Collaborate Button */}
        <button
          onClick={async () => {
            setShowCollaboration(true);
            try {
              await agentCollaboration.collaborate(projectId!);
            } catch (error) {
              toast.error(`Collaboration analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCollaboration.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentCollaboration.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' /></svg> Collaborate</>
          )}
        </button>

        {/* Escalation Risk Button */}
        <button
          onClick={async () => {
            setShowEscalationDetector(true);
            try {
              await escalationDetect.detect(projectId!);
            } catch (error) {
              toast.error(`Escalation analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={escalationDetect.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {escalationDetect.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' /></svg> Escalation Risk</>
          )}
        </button>

        {/* Agent Health Button */}
        <button
          onClick={async () => {
            setShowAgentBurnout(true);
            try {
              await agentBurnout.detect(projectId!);
            } catch (error) {
              toast.error(`Agent health analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentBurnout.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          {agentBurnout.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Agent Health</>
          )}
        </button>

        {/* Skill Profiler Button */}
        <button
          onClick={async () => {
            setShowSkillProfiler(true);
            try {
              await skillProfiler.profile(projectId!);
            } catch (error) {
              toast.error(`Skill profiling failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={skillProfiler.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {skillProfiler.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' /></svg> Skill Profiles</>
          )}
        </button>

        {/* Knowledge Gaps Button */}
        <button
          onClick={async () => {
            setShowKnowledgeGap(true);
            try {
              await knowledgeGap.analyze();
            } catch (error) {
              toast.error(`Knowledge gap analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={knowledgeGap.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {knowledgeGap.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Knowledge Gaps</>
          )}
        </button>

        {/* Handoff Quality Button */}
        <button
          onClick={async () => {
            setShowHandoffQuality(true);
            try {
              await handoffQuality.analyze(projectId!);
            } catch (error) {
              toast.error(`Handoff quality analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={handoffQuality.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {handoffQuality.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' /></svg> Handoff Quality</>
          )}
        </button>

        {/* Task Sequence Button */}
        <button
          onClick={async () => {
            setShowAgentTaskSequence(true);
            try {
              await agentTaskSequence.sequence(projectId!);
            } catch (error) {
              toast.error(`Task sequence failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentTaskSequence.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentTaskSequence.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' /></svg> Task Sequence</>
          )}
        </button>

        {/* Velocity Forecast Button */}
        <button
          onClick={async () => {
            setShowAgentVelocityForecast(true);
            try {
              await agentVelocityForecast.forecast(projectId!);
            } catch (error) {
              toast.error(`Velocity forecast failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentVelocityForecast.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentVelocityForecast.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' /></svg> Velocity Forecast</>
          )}
        </button>

        {/* Load Forecast Button */}
        <button
          onClick={async () => {
            setShowAgentLoadPredictor(true);
            try {
              await agentLoadPredictor.predict(projectId!);
            } catch (error) {
              toast.error(`Load forecast failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentLoadPredictor.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentLoadPredictor.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /></svg> Load Forecast</>
          )}
        </button>

        {/* Sprint Commitments Button */}
        <button
          onClick={async () => {
            setShowAgentSprintCommitment(true);
            try {
              await agentSprintCommitment.analyze(projectId!);
            } catch (error) {
              toast.error(`Sprint commitment analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSprintCommitment.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentSprintCommitment.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' /></svg> Sprint Commitments</>
          )}
        </button>

        {/* Collaboration Network Button */}
        <button
          onClick={async () => {
            setShowCollaborationNetwork(true);
            try {
              await collaborationNetwork.analyze();
            } catch (error) {
              toast.error(`Collaboration network analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={collaborationNetwork.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50"
        >
          {collaborationNetwork.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' /></svg> Collaboration Network</>
          )}
        </button>

        {/* Context Retention Button */}
        <button
          onClick={() => setShowContextRetention(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg> Context Retention
        </button>

        {/* FEAT-142: Idle Time Button */}
        <button
          onClick={() => setShowAgentIdleTimeAnalyzer(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Idle Time
        </button>

        {/* FEAT-143: Response Time Button */}
        <button
          onClick={() => setShowAgentResponseTimeEfficiency(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg> Response Time
        </button>

        {/* FEAT-144: Error Recovery Button */}
        <button
          onClick={() => setShowAgentErrorRecoveryRate(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' /></svg> Error Recovery
        </button>

        {/* FEAT-145: Workload Balance Button */}
        <button
          onClick={() => setShowAgentWorkloadBalance(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' /></svg> Workload Balance
        </button>

        {/* FEAT-146: Deadline Adherence Analyzer Button */}
        <button
          onClick={() => setShowAgentDeadlineAdherenceAnalyzer(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' /></svg> Deadline Adherence
        </button>

        {/* FEAT-147: Token Cost Efficiency Button */}
        <button
          onClick={() => agentTokenCostEfficiency.analyze().then(() => setShowAgentTokenCostEfficiency(true))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          disabled={agentTokenCostEfficiency.loading}
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Token Cost
        </button>

        {/* FEAT-148: Skill Coverage Analyzer Button */}
        <button
          onClick={() => agentSkillCoverage.analyze().then(() => setShowAgentSkillCoverage(true))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
          disabled={agentSkillCoverage.loading}
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' /></svg> Skill Coverage
        </button>

        {/* FEAT-149: Learning Curve Analyzer Button */}
        <button
          onClick={() => agentLearningCurveAnalyzer.analyze().then(() => setShowAgentLearningCurveAnalyzer(true))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-fuchsia-600 hover:bg-fuchsia-700 text-white disabled:opacity-50"
          disabled={agentLearningCurveAnalyzer.loading}
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' /></svg> Learning Curve
        </button>

        {/* FEAT-150: Collaboration Network Analyzer Button */}
        <button
          onClick={() => agentCollaborationNetworkAnalyzer.analyze().then(() => setShowAgentCollaborationNetworkAnalyzer(true))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-50"
          disabled={agentCollaborationNetworkAnalyzer.loading}
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' /></svg> Collaboration
        </button>

        {/* FEAT-151: Peak Performance Windows Button */}
        <button
          onClick={() => agentPeakPerformance.analyze().then(() => setShowAgentPeakPerformance(true))}
          disabled={agentPeakPerformance.loading}
          className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentPeakPerformance.loading ? 'Analyzing...' : 'Peak Windows'}
        </button>

        {/* FEAT-152: Context Switch Cost Button */}
        <button
          onClick={() => agentContextSwitchCost.analyze().then(() => setShowAgentContextSwitchCost(true))}
          disabled={agentContextSwitchCost.loading}
          className="flex items-center gap-2 px-3 py-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentContextSwitchCost.loading ? 'Analyzing...' : 'Switch Cost'}
        </button>

        {/* FEAT-153: Burnout Risk Button */}
        <button
          onClick={() => agentBurnoutRisk.analyze().then(() => setShowAgentBurnoutRisk(true))}
          disabled={agentBurnoutRisk.loading}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-600/30 text-indigo-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentBurnoutRisk.loading ? 'Analyzing...' : 'Burnout Risk'}
        </button>

        {/* FEAT-154: Handoff Success Rate Button */}
        <button
          onClick={() => agentHandoffSuccessRate.analyze().then(() => setShowAgentHandoffSuccessRate(true))}
          disabled={agentHandoffSuccessRate.loading}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-600/30 text-orange-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentHandoffSuccessRate.loading ? 'Analyzing...' : 'Handoff Rate'}
        </button>

        {/* FEAT-155: Task Velocity Button */}
        <button
          onClick={() => agentTaskCompletionVelocity.analyze().then(() => setShowAgentTaskCompletionVelocity(true))}
          disabled={agentTaskCompletionVelocity.loading}
          className="flex items-center gap-2 px-3 py-2 bg-pink-600/10 hover:bg-pink-600/20 border border-pink-600/30 text-pink-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentTaskCompletionVelocity.loading ? 'Analyzing...' : 'Task Velocity'}
        </button>

        {/* FEAT-156: Interruptions Button */}
        <button
          onClick={() => agentInterruptionFrequency.analyze().then(() => setShowAgentInterruptionFrequency(true))}
          disabled={agentInterruptionFrequency.loading}
          className="flex items-center gap-2 px-3 py-2 bg-yellow-600/10 hover:bg-yellow-600/20 border border-yellow-600/30 text-yellow-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentInterruptionFrequency.loading ? 'Analyzing...' : 'Interruptions'}
        </button>

        {/* FEAT-157: Session Duration Button */}
        <button
          onClick={() => agentSessionDurationAnalyzer.analyze().then(() => setShowAgentSessionDurationAnalyzer(true))}
          disabled={agentSessionDurationAnalyzer.loading}
          className="flex items-center gap-2 px-3 py-2 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/30 text-amber-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentSessionDurationAnalyzer.loading ? 'Analyzing...' : 'Session Duration'}
        </button>

        {/* FEAT-158: Failure Patterns Button */}
        <button
          onClick={() => agentFailurePatterns.analyze().then(() => setShowAgentFailurePatterns(true))}
          disabled={agentFailurePatterns.loading}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/30 text-emerald-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentFailurePatterns.loading ? 'Analyzing...' : 'Failure Patterns'}
        </button>

        {/* FEAT-159: Queue Depth Analyzer Button */}
        <button
          onClick={() => agentQueueDepthAnalyzer.analyze().then(() => setShowAgentQueueDepthAnalyzer(true))}
          disabled={agentQueueDepthAnalyzer.loading}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-600/30 text-orange-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentQueueDepthAnalyzer.loading ? 'Analyzing...' : 'Queue Depth'}
        </button>

        {/* FEAT-160: Retry Rate Button */}
        <button
          onClick={() => agentRetryRate.analyze().then(() => setShowAgentRetryRate(true))}
          disabled={agentRetryRate.loading}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-600/30 text-purple-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentRetryRate.loading ? 'Analyzing...' : 'Retry Rate'}
        </button>

        {/* FEAT-161: Agent Availability Button */}
        <button
          onClick={() => agentAvailability.analyze().then(() => setShowAgentAvailability(true))}
          disabled={agentAvailability.loading}
          className="flex items-center gap-2 px-3 py-2 bg-sky-600/10 hover:bg-sky-600/20 border border-sky-600/30 text-sky-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {agentAvailability.loading ? 'Analyzing...' : 'Availability'}
        </button>

        {/* FEAT-162: Agent Specialization Index Button */}
        <button
          onClick={() => agentSpecializationIndex.analyze().then(() => setShowAgentSpecializationIndex(true))}
          disabled={agentSpecializationIndex.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30 disabled:opacity-50"
        >
          {agentSpecializationIndex.loading ? 'Analyzing...' : 'Specialization Index'}
        </button>

        {/* FEAT-163: Agent Response Lag Button */}
        <button
          onClick={() => agentResponseLag.analyze().then(() => setShowAgentResponseLag(true))}
          disabled={agentResponseLag.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-orange-600 hover:bg-orange-500 text-white border-orange-500/30 disabled:opacity-50"
        >
          {agentResponseLag.loading ? 'Analyzing...' : 'Response Lag'}
        </button>

        {/* FEAT-164: Agent Capacity Utilization Button */}
        <button
          onClick={() => agentCapacityUtilization.analyze().then(() => setShowAgentCapacityUtilization(true))}
          disabled={agentCapacityUtilization.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30 disabled:opacity-50"
        >
          {agentCapacityUtilization.loading ? 'Analyzing...' : 'Capacity Utilization'}
        </button>

        {/* FEAT-165: Agent Throughput Variability Button */}
        <button
          onClick={() => agentThroughputVariability.analyze().then(() => setShowAgentThroughputVariability(true))}
          disabled={agentThroughputVariability.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-lime-600 hover:bg-lime-500 text-white border-lime-500/30 disabled:opacity-50"
        >
          {agentThroughputVariability.loading ? 'Analyzing...' : 'Throughput Variability'}
        </button>

        {/* FEAT-166: Agent Cost Per Outcome Button */}
        <button
          onClick={() => agentCostPerOutcome.analyze().then(() => setShowAgentCostPerOutcome(true))}
          disabled={agentCostPerOutcome.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-sky-600 hover:bg-sky-500 text-white border-sky-500/30 disabled:opacity-50"
        >
          {agentCostPerOutcome.loading ? 'Analyzing...' : 'Cost Per Outcome'}
        </button>

        {/* FEAT-167: Agent Workload Saturation Button */}
        <button
          onClick={() => agentWorkloadSaturation.analyze().then(() => setShowAgentWorkloadSaturation(true))}
          disabled={agentWorkloadSaturation.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-amber-600 hover:bg-amber-500 text-white border-amber-500/30 disabled:opacity-50"
        >
          {agentWorkloadSaturation.loading ? 'Analyzing...' : 'Workload Saturation'}
        </button>

        {/* FEAT-168: Agent Recovery Time Button */}
        <button
          onClick={() => agentRecoveryTime.analyze().then(() => setShowAgentRecoveryTime(true))}
          disabled={agentRecoveryTime.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-pink-600 hover:bg-pink-500 text-white border-pink-500/30 disabled:opacity-50"
        >
          {agentRecoveryTime.loading ? 'Analyzing...' : 'Recovery Time'}
        </button>

        {/* FEAT-169: Agent Escalation Rate Button */}
        <button
          onClick={() => agentEscalationRate.analyze().then(() => setShowAgentEscalationRate(true))}
          disabled={agentEscalationRate.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-purple-600 hover:bg-purple-500 text-white border-purple-500/30 disabled:opacity-50"
        >
          {agentEscalationRate.loading ? 'Analyzing...' : 'Escalation Rate'}
        </button>

        {/* FEAT-170: Agent Knowledge Gap Analyzer Button */}
        <button
          onClick={() => agentKnowledgeGapAnalyzer.analyze().then(() => setShowAgentKnowledgeGapAnalyzer(true))}
          disabled={agentKnowledgeGapAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-red-600 hover:bg-red-500 text-white border-red-500/30 disabled:opacity-50"
        >
          {agentKnowledgeGapAnalyzer.loading ? 'Analyzing...' : 'Knowledge Gaps'}
        </button>

        {/* FEAT-171: Agent Idle Time Tracker Button */}
        <button
          onClick={() => agentIdleTimeTracker.analyze().then(() => setShowAgentIdleTimeTracker(true))}
          disabled={agentIdleTimeTracker.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-green-600 hover:bg-green-500 text-white border-green-500/30 disabled:opacity-50"
        >
          {agentIdleTimeTracker.loading ? 'Analyzing...' : 'Idle Time Tracker'}
        </button>

        {/* FEAT-172: Agent Parallel Task Efficiency Tracker Button */}
        <button
          onClick={() => agentParallelTaskEfficiencyTracker.analyze().then(() => setShowAgentParallelTaskEfficiencyTracker(true))}
          disabled={agentParallelTaskEfficiencyTracker.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-blue-600 hover:bg-blue-500 text-white border-blue-500/30 disabled:opacity-50"
        >
          {agentParallelTaskEfficiencyTracker.loading ? 'Analyzing...' : 'Parallel Efficiency Tracker'}
        </button>

        {/* FEAT-173: Agent Context Retention Analyzer Button */}
        <button
          onClick={() => agentContextRetentionAnalyzer.analyze().then(() => setShowAgentContextRetentionAnalyzer(true))}
          disabled={agentContextRetentionAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30 disabled:opacity-50"
        >
          {agentContextRetentionAnalyzer.loading ? 'Analyzing...' : 'Context Retention'}
        </button>

        {/* FEAT-174: Agent Goal Drift Analyzer Button */}
        <button
          onClick={() => agentGoalDriftAnalyzer.analyze().then(() => setShowAgentGoalDriftAnalyzer(true))}
          disabled={agentGoalDriftAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-orange-600 hover:bg-orange-500 text-white border-orange-500/30 disabled:opacity-50"
        >
          {agentGoalDriftAnalyzer.loading ? 'Analyzing...' : 'Goal Drift'}
        </button>

        {/* FEAT-175: Agent Decision Latency Analyzer Button */}
        <button
          onClick={() => agentDecisionLatencyAnalyzer.analyze().then(() => setShowAgentDecisionLatencyAnalyzer(true))}
          disabled={agentDecisionLatencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/30 disabled:opacity-50"
        >
          {agentDecisionLatencyAnalyzer.loading ? 'Analyzing...' : 'Decision Latency'}
        </button>

        {/* FEAT-176: Agent Output Quality Consistency Button */}
        <button
          onClick={() => agentOutputQualityConsistency.analyze().then(() => setShowAgentOutputQualityConsistency(true))}
          disabled={agentOutputQualityConsistency.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30 disabled:opacity-50"
        >
          {agentOutputQualityConsistency.loading ? 'Analyzing...' : 'Output Quality'}
        </button>

        {/* FEAT-177: Agent Collaboration Efficiency Analyzer Button */}
        <button
          onClick={() => agentCollaborationEfficiencyAnalyzer.analyze().then(() => setShowAgentCollaborationEfficiencyAnalyzer(true))}
          disabled={agentCollaborationEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30 disabled:opacity-50"
        >
          {agentCollaborationEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Collab Efficiency'}
        </button>

        {/* FEAT-178: Agent Instruction Adherence Analyzer Button */}
        <button
          onClick={() => agentInstructionAdherenceAnalyzer.analyze().then(() => setShowAgentInstructionAdherenceAnalyzer(true))}
          disabled={agentInstructionAdherenceAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-amber-600 hover:bg-amber-500 text-white border-amber-500/30 disabled:opacity-50"
        >
          {agentInstructionAdherenceAnalyzer.loading ? 'Analyzing...' : 'Instruction Adherence'}
        </button>

        {/* FEAT-179: Agent Communication Quality Analyzer Button */}
        <button
          onClick={() => agentCommunicationQualityAnalyzer.analyze().then(() => setShowAgentCommunicationQualityAnalyzer(true))}
          disabled={agentCommunicationQualityAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30 disabled:opacity-50"
        >
          {agentCommunicationQualityAnalyzer.loading ? 'Analyzing...' : 'Comms Quality'}
        </button>

        {/* FEAT-180: Agent Adaptation Speed Analyzer Button */}
        <button
          onClick={() => agentAdaptationSpeedAnalyzer.analyze().then(() => setShowAgentAdaptationSpeedAnalyzer(true))}
          disabled={agentAdaptationSpeedAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all bg-pink-600 hover:bg-pink-500 text-white border-pink-500/30 disabled:opacity-50"
        >
          {agentAdaptationSpeedAnalyzer.loading ? 'Analyzing...' : 'Adaptation Speed'}
        </button>

        {/* FEAT-181: Agent Self-Correction Rate Analyzer Button */}
        <button
          onClick={() => agentSelfCorrectionRateAnalyzer.analyze().then(() => setShowAgentSelfCorrectionRateAnalyzer(true))}
          disabled={agentSelfCorrectionRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-lime-600/30 bg-lime-500/10 hover:bg-lime-500/20 text-lime-300 disabled:opacity-50"
        >
          {agentSelfCorrectionRateAnalyzer.loading ? 'Analyzing...' : 'Self-Correction'}
        </button>

        {/* FEAT-182: Agent Confidence Calibration Analyzer Button */}
        <button
          onClick={() => agentConfidenceCalibrationAnalyzer.analyze().then(() => setShowAgentConfidenceCalibrationAnalyzer(true))}
          disabled={agentConfidenceCalibrationAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-sky-600/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 disabled:opacity-50"
        >
          {agentConfidenceCalibrationAnalyzer.loading ? 'Analyzing...' : 'Confidence Cal.'}
        </button>

        {/* FEAT-183: Agent Task Prioritization Accuracy Analyzer Button */}
        <button
          onClick={() => agentTaskPrioritizationAccuracyAnalyzer.analyze().then(() => setShowAgentTaskPrioritizationAccuracyAnalyzer(true))}
          disabled={agentTaskPrioritizationAccuracyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-rose-600/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-50"
        >
          {agentTaskPrioritizationAccuracyAnalyzer.loading ? 'Analyzing...' : 'Task Prioritization'}
        </button>

        {/* FEAT-184: Agent Tool Selection Accuracy Analyzer Button */}
        <button
          onClick={() => agentToolSelectionAccuracyAnalyzer.analyze().then(() => setShowAgentToolSelectionAccuracyAnalyzer(true))}
          disabled={agentToolSelectionAccuracyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-amber-600/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 disabled:opacity-50"
        >
          {agentToolSelectionAccuracyAnalyzer.loading ? 'Analyzing...' : 'Tool Selection'}
        </button>

        {/* FEAT-185: Agent Workflow Coverage Analyzer Button */}
        <button
          onClick={() => agentWorkflowCoverageAnalyzer.analyze().then(() => setShowAgentWorkflowCoverageAnalyzer(true))}
          disabled={agentWorkflowCoverageAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-rose-600/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-50"
        >
          {agentWorkflowCoverageAnalyzer.loading ? 'Analyzing...' : 'Workflow Coverage'}
        </button>

        {/* FEAT-186: Agent Dependency Risk Analyzer Button */}
        <button
          onClick={() => agentDependencyRiskAnalyzer.analyze().then(() => setShowAgentDependencyRiskAnalyzer(true))}
          disabled={agentDependencyRiskAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-teal-600/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 disabled:opacity-50"
        >
          {agentDependencyRiskAnalyzer.loading ? 'Analyzing...' : 'Dependency Risk'}
        </button>

        {/* FEAT-187: Multi-Agent Sync Efficiency Button */}
        <button
          onClick={() => agentMultiAgentSyncEfficiency.analyze().then(() => setShowAgentMultiAgentSyncEfficiency(true))}
          disabled={agentMultiAgentSyncEfficiency.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-purple-600/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 disabled:opacity-50"
        >
          {agentMultiAgentSyncEfficiency.loading ? 'Analyzing...' : 'Sync Efficiency'}
        </button>

        {/* FEAT-188: Output Accuracy Rate Button */}
        <button
          onClick={() => agentOutputAccuracyRate.analyze().then(() => setShowAgentOutputAccuracyRate(true))}
          disabled={agentOutputAccuracyRate.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
        >
          {agentOutputAccuracyRate.loading ? 'Analyzing...' : 'Output Accuracy'}
        </button>

        {/* FEAT-189: Goal Completion Rate Button */}
        <button
          onClick={() => agentGoalCompletionRateAnalyzer.analyze().then(() => setShowAgentGoalCompletionRateAnalyzer(true))}
          disabled={agentGoalCompletionRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-violet-600/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 disabled:opacity-50"
        >
          {agentGoalCompletionRateAnalyzer.loading ? 'Analyzing...' : 'Goal Completion Rate'}
        </button>

        {/* FEAT-190: Prompt Efficiency Button */}
        <button
          onClick={() => agentPromptEfficiencyAnalyzer.analyze().then(() => setShowAgentPromptEfficiencyAnalyzer(true))}
          disabled={agentPromptEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-amber-600/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 disabled:opacity-50"
        >
          {agentPromptEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Prompt Efficiency'}
        </button>

        {/* FEAT-191: Learning Rate Button */}
        <button
          onClick={() => agentLearningRateAnalyzer.analyze().then(() => setShowAgentLearningRateAnalyzer(true))}
          disabled={agentLearningRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-lime-600/30 bg-lime-500/10 hover:bg-lime-500/20 text-lime-300 disabled:opacity-50"
        >
          {agentLearningRateAnalyzer.loading ? 'Analyzing...' : 'Learning Rate'}
        </button>

        {/* FEAT-192: Error Recovery Speed Button */}
        <button
          onClick={() => agentErrorRecoverySpeedAnalyzer.analyze().then(() => setShowAgentErrorRecoverySpeedAnalyzer(true))}
          disabled={agentErrorRecoverySpeedAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-sky-600/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 disabled:opacity-50"
        >
          {agentErrorRecoverySpeedAnalyzer.loading ? 'Analyzing...' : 'Error Recovery Speed'}
        </button>

        {/* FEAT-193: Autonomy Level Button */}
        <button
          onClick={() => agentAutonomyLevelAnalyzer.analyze().then(() => setShowAgentAutonomyLevelAnalyzer(true))}
          disabled={agentAutonomyLevelAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-indigo-600/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 disabled:opacity-50"
        >
          {agentAutonomyLevelAnalyzer.loading ? 'Analyzing...' : 'Autonomy Level'}
        </button>

        {/* FEAT-194: Resource Efficiency Button */}
        <button
          onClick={() => agentResourceEfficiencyAnalyzer.analyze().then(() => setShowAgentResourceEfficiencyAnalyzer(true))}
          disabled={agentResourceEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-pink-600/30 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 disabled:opacity-50"
        >
          {agentResourceEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Resource Efficiency'}
        </button>

        {/* FEAT-195: Multi-Turn Consistency Button */}
        <button
          onClick={() => agentMultiTurnConsistencyAnalyzer.analyze().then(() => setShowAgentMultiTurnConsistencyAnalyzer(true))}
          disabled={agentMultiTurnConsistencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-cyan-600/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 disabled:opacity-50"
        >
          {agentMultiTurnConsistencyAnalyzer.loading ? 'Analyzing...' : 'Multi-Turn Consistency'}
        </button>

        {/* FEAT-196: Prompt Sensitivity Button */}
        <button
          onClick={() => agentPromptSensitivityAnalyzer.analyze().then(() => setShowAgentPromptSensitivityAnalyzer(true))}
          disabled={agentPromptSensitivityAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-orange-600/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 disabled:opacity-50"
        >
          {agentPromptSensitivityAnalyzer.loading ? 'Analyzing...' : 'Prompt Sensitivity'}
        </button>

        {/* FEAT-197: Decision Confidence Button */}
        <button
          onClick={() => agentDecisionConfidenceAnalyzer.analyze().then(() => setShowAgentDecisionConfidenceAnalyzer(true))}
          disabled={agentDecisionConfidenceAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-stone-600/30 bg-stone-500/10 hover:bg-stone-500/20 text-stone-300 disabled:opacity-50"
        >
          {agentDecisionConfidenceAnalyzer.loading ? 'Analyzing...' : 'Decision Confidence'}
        </button>

        {/* FEAT-198: Knowledge Transfer Efficiency Button */}
        <button
          onClick={() => agentKnowledgeTransferEfficiencyAnalyzer.analyze().then(() => setShowAgentKnowledgeTransferEfficiencyAnalyzer(true))}
          disabled={agentKnowledgeTransferEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-zinc-600/30 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-300 disabled:opacity-50"
        >
          {agentKnowledgeTransferEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Knowledge Transfer Efficiency'}
        </button>

        {/* FEAT-195: Instruction Complexity Button */}
        <button
          onClick={() => agentInstructionComplexityAnalyzer.analyze().then(() => setShowAgentInstructionComplexityAnalyzer(true))}
          disabled={agentInstructionComplexityAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-slate-600/30 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 disabled:opacity-50"
        >
          {agentInstructionComplexityAnalyzer.loading ? 'Analyzing...' : 'Instruction Complexity'}
        </button>

        {/* FEAT-196: Context Window Utilization Button */}
        <button
          onClick={() => agentContextWindowUtilizationAnalyzer.analyze().then(() => setShowAgentContextWindowUtilizationAnalyzer(true))}
          disabled={agentContextWindowUtilizationAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-yellow-600/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 disabled:opacity-50"
        >
          {agentContextWindowUtilizationAnalyzer.loading ? 'Analyzing...' : 'Context Window Utilization'}
        </button>

        {/* FEAT-199: Cognitive Load Estimator Button */}
        <button
          onClick={() => agentCognitiveLoadEstimator.analyze().then(() => setShowAgentCognitiveLoadEstimator(true))}
          disabled={agentCognitiveLoadEstimator.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-red-600/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50"
        >
          {agentCognitiveLoadEstimator.loading ? 'Analyzing...' : 'Cognitive Load'}
        </button>

        {/* FEAT-200: Goal Alignment Score Button */}
        <button
          onClick={() => agentGoalAlignmentScore.analyze().then(() => setShowAgentGoalAlignmentScore(true))}
          disabled={agentGoalAlignmentScore.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-purple-600/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 disabled:opacity-50"
        >
          {agentGoalAlignmentScore.loading ? 'Analyzing...' : 'Goal Alignment'}
        </button>

        {/* FEAT-201: Trust Score Analyzer Button */}
        <button
          onClick={() => analyzeTrustScore().then(() => setShowAgentTrustScoreAnalyzer(true))}
          disabled={loadingTrustScore}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-blue-600/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 disabled:opacity-50"
        >
          {loadingTrustScore ? 'Analyzing...' : 'Trust Score'}
        </button>

        {/* FEAT-202: Workflow Bottleneck Analyzer Button */}
        <button
          onClick={() => analyzeWorkflowBottleneck().then(() => setShowAgentWorkflowBottleneckAnalyzer(true))}
          disabled={loadingWorkflowBottleneck}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
        >
          {loadingWorkflowBottleneck ? 'Analyzing...' : 'Workflow Bottleneck'}
        </button>

        {/* FEAT-203: Feedback Integration Speed Analyzer Button */}
        <button
          onClick={() => analyzeFeedbackIntegrationSpeed().then(() => setShowAgentFeedbackIntegrationSpeedAnalyzer(true))}
          disabled={loadingFeedbackIntegrationSpeed}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-orange-600/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 disabled:opacity-50"
        >
          {loadingFeedbackIntegrationSpeed ? 'Analyzing...' : 'Feedback Speed'}
        </button>

        {/* FEAT-204: Scope Creep Detector Button */}
        <button
          onClick={() => analyzeScopeCreepDetector().then(() => setShowAgentScopeCreepDetector(true))}
          disabled={loadingScopeCreepDetector}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-teal-600/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 disabled:opacity-50"
        >
          {loadingScopeCreepDetector ? 'Analyzing...' : 'Scope Creep'}
        </button>

        {/* FEAT-205: Attention Span Analyzer Button */}
        <button
          onClick={() => analyzeAttentionSpan().then(() => setShowAgentAttentionSpanAnalyzer(true))}
          disabled={loadingAttentionSpan}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-rose-600/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-50"
        >
          {loadingAttentionSpan ? 'Analyzing...' : 'Attention Span'}
        </button>

        {/* FEAT-206: Hallucination Rate Analyzer Button */}
        <button
          onClick={() => analyzeHallucinationRate().then(() => setShowAgentHallucinationRateAnalyzer(true))}
          disabled={loadingHallucinationRate}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-fuchsia-600/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 disabled:opacity-50"
        >
          {loadingHallucinationRate ? 'Analyzing...' : 'Hallucination Rate'}
        </button>

        {/* FEAT-207: Tool Usage Efficiency Button */}
        <button
          onClick={() => analyzeToolUsageEfficiency().then(() => setShowAgentToolUsageEfficiencyAnalyzer(true))}
          disabled={loadingToolUsageEfficiency}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-violet-600/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 disabled:opacity-50"
        >
          {loadingToolUsageEfficiency ? 'Analyzing...' : 'Tool Usage'}
        </button>

        {/* FEAT-208: Instruction Parse Accuracy Button */}
        <button
          onClick={() => analyzeInstructionParseAccuracy().then(() => setShowAgentInstructionParseAccuracyAnalyzer(true))}
          disabled={loadingInstructionParseAccuracy}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-amber-600/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 disabled:opacity-50"
        >
          {loadingInstructionParseAccuracy ? 'Analyzing...' : 'Parse Accuracy'}
        </button>

        {/* FEAT-211: Response Coherence Button */}
        <button
          onClick={() => agentResponseCoherenceAnalyzer.analyze().then(() => setShowAgentResponseCoherenceAnalyzer(true))}
          disabled={agentResponseCoherenceAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-cyan-600/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 disabled:opacity-50"
        >
          {agentResponseCoherenceAnalyzer.loading ? 'Analyzing...' : 'Response Coherence'}
        </button>

        {/* FEAT-212: Semantic Drift Button */}
        <button
          onClick={() => agentSemanticDriftAnalyzer.analyze().then(() => setShowAgentSemanticDriftAnalyzer(true))}
          disabled={agentSemanticDriftAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-indigo-600/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 disabled:opacity-50"
        >
          {agentSemanticDriftAnalyzer.loading ? 'Analyzing...' : 'Semantic Drift'}
        </button>

        {/* FEAT-213: Bias Detection Rate Button */}
        <button
          onClick={() => agentBiasDetectionRateAnalyzer.analyze().then(() => setShowAgentBiasDetectionRateAnalyzer(true))}
          disabled={agentBiasDetectionRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-green-600/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 disabled:opacity-50"
        >
          {agentBiasDetectionRateAnalyzer.loading ? 'Analyzing...' : 'Bias Detection Rate'}
        </button>

        {/* FEAT-214: Memory Persistence Button */}
        <button
          onClick={() => agentMemoryPersistenceAnalyzer.analyze().then(() => setShowAgentMemoryPersistenceAnalyzer(true))}
          disabled={agentMemoryPersistenceAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-neutral-600/30 bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-300 disabled:opacity-50"
        >
          {agentMemoryPersistenceAnalyzer.loading ? 'Analyzing...' : 'Memory Persistence'}
        </button>
        <button
          onClick={() => agentReasoningChainDepthAnalyzer.analyze().then(() => setShowAgentReasoningChainDepthAnalyzer(true))}
          disabled={agentReasoningChainDepthAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-slate-600/30 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 disabled:opacity-50"
        >
          {agentReasoningChainDepthAnalyzer.loading ? 'Analyzing...' : 'Reasoning Chain Depth'}
        </button>
        <button
          onClick={() => agentErrorPropagationAnalyzer.analyze().then(() => setShowAgentErrorPropagationAnalyzer(true))}
          disabled={agentErrorPropagationAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-yellow-600/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 disabled:opacity-50"
        >
          {agentErrorPropagationAnalyzer.loading ? 'Analyzing...' : 'Error Propagation'}
        </button>
        <button
          onClick={() => agentAbstractionLevelAnalyzer.analyze().then(() => setShowAgentAbstractionLevelAnalyzer(true))}
          disabled={agentAbstractionLevelAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-pink-600/30 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 disabled:opacity-50"
        >
          {agentAbstractionLevelAnalyzer.loading ? 'Analyzing...' : 'Abstraction Level'}
        </button>
        <button
          onClick={() => agentTemporalConsistencyAnalyzer.analyze().then(() => setShowAgentTemporalConsistencyAnalyzer(true))}
          disabled={agentTemporalConsistencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-stone-600/30 bg-stone-500/10 hover:bg-stone-500/20 text-stone-300 disabled:opacity-50"
        >
          {agentTemporalConsistencyAnalyzer.loading ? 'Analyzing...' : 'Temporal Consistency'}
        </button>
        <button
          onClick={() => agentOutputFormatComplianceAnalyzer.analyze().then(() => setShowAgentOutputFormatComplianceAnalyzer(true))}
          disabled={agentOutputFormatComplianceAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-gray-600/30 bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 disabled:opacity-50"
        >
          {agentOutputFormatComplianceAnalyzer.loading ? 'Analyzing...' : 'Output Format Compliance'}
        </button>
        <button
          onClick={() => agentCapabilityBoundaryAwarenessAnalyzer.analyze().then(() => setShowAgentCapabilityBoundaryAwarenessAnalyzer(true))}
          disabled={agentCapabilityBoundaryAwarenessAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-purple-600/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 disabled:opacity-50"
        >
          {agentCapabilityBoundaryAwarenessAnalyzer.loading ? 'Analyzing...' : 'Capability Boundary Awareness'}
        </button>
        <button
          onClick={() => agentProactiveInitiativeRateAnalyzer.analyze().then(() => setShowAgentProactiveInitiativeRateAnalyzer(true))}
          disabled={agentProactiveInitiativeRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-red-600/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50"
        >
          {agentProactiveInitiativeRateAnalyzer.loading ? 'Analyzing...' : 'Proactive Initiative Rate'}
        </button>
        <button
          onClick={() => agentKnowledgeBoundaryMappingAnalyzer.analyze().then(() => setShowAgentKnowledgeBoundaryMappingAnalyzer(true))}
          disabled={agentKnowledgeBoundaryMappingAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-blue-600/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 disabled:opacity-50"
        >
          {agentKnowledgeBoundaryMappingAnalyzer.loading ? 'Analyzing...' : 'Knowledge Boundary Mapping'}
        </button>
        <button
          onClick={() => agentCommunicationOverheadAnalyzer.analyze().then(() => setShowAgentCommunicationOverheadAnalyzer(true))}
          disabled={agentCommunicationOverheadAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-orange-600/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 disabled:opacity-50"
        >
          {agentCommunicationOverheadAnalyzer.loading ? 'Analyzing...' : 'Communication Overhead'}
        </button>
        <button
          onClick={() => agentSpecializationDriftAnalyzerNew.analyze().then(() => setShowAgentSpecializationDriftAnalyzer(true))}
          disabled={agentSpecializationDriftAnalyzerNew.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-teal-600/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 disabled:opacity-50"
        >
          {agentSpecializationDriftAnalyzerNew.loading ? 'Analyzing...' : 'Specialization Drift Analyzer'}
        </button>
        <button
          onClick={() => agentCognitiveFlexibilityAnalyzer.analyze().then(() => setShowAgentCognitiveFlexibilityAnalyzer(true))}
          disabled={agentCognitiveFlexibilityAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-rose-600/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-50"
        >
          {agentCognitiveFlexibilityAnalyzer.loading ? 'Analyzing...' : 'Cognitive Flexibility'}
        </button>
        <button
          onClick={() => agentDelegationAccuracyAnalyzer.analyze().then(() => setShowAgentDelegationAccuracyAnalyzer(true))}
          disabled={agentDelegationAccuracyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-fuchsia-600/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 disabled:opacity-50"
        >
          {agentDelegationAccuracyAnalyzer.loading ? 'Analyzing...' : 'Delegation Accuracy'}
        </button>
        <button
          onClick={() => agentInstructionClarityScoreAnalyzer.analyze().then(() => setShowAgentInstructionClarityScoreAnalyzer(true))}
          disabled={agentInstructionClarityScoreAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-emerald-600/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
        >
          {agentInstructionClarityScoreAnalyzer.loading ? 'Analyzing...' : 'Instruction Clarity'}
        </button>
        <button
          onClick={() => agentContextUtilizationEfficiencyAnalyzer.analyze().then(() => setShowAgentContextUtilizationEfficiencyAnalyzer(true))}
          disabled={agentContextUtilizationEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-zinc-600/30 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-300 disabled:opacity-50"
        >
          {agentContextUtilizationEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Context Utilization Efficiency'}
        </button>
        <button
          onClick={() => agentMultiModalProcessingEfficiencyAnalyzer.analyze().then(() => setShowAgentMultiModalProcessingEfficiencyAnalyzer(true))}
          disabled={agentMultiModalProcessingEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-amber-600/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 disabled:opacity-50"
        >
          {agentMultiModalProcessingEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Multi-Modal Efficiency'}
        </button>
        <button
          onClick={() => agentConstraintSatisfactionRateAnalyzer.analyze().then(() => setShowAgentConstraintSatisfactionRateAnalyzer(true))}
          disabled={agentConstraintSatisfactionRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-violet-600/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 disabled:opacity-50"
        >
          {agentConstraintSatisfactionRateAnalyzer.loading ? 'Analyzing...' : 'Constraint Satisfaction'}
        </button>
        <button
          onClick={() => agentOutputCompletenessAnalyzer.analyze().then(() => setShowAgentOutputCompletenessAnalyzer(true))}
          disabled={agentOutputCompletenessAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-cyan-600/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 disabled:opacity-50"
        >
          {agentOutputCompletenessAnalyzer.loading ? 'Analyzing...' : 'Output Completeness'}
        </button>
        <button
          onClick={() => agentInstructionDisambiguationRateAnalyzer.analyze().then(() => setShowAgentInstructionDisambiguationRateAnalyzer(true))}
          disabled={agentInstructionDisambiguationRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-lime-600/30 bg-lime-500/10 hover:bg-lime-500/20 text-lime-300 disabled:opacity-50"
        >
          {agentInstructionDisambiguationRateAnalyzer.loading ? 'Analyzing...' : 'Instruction Disambiguation'}
        </button>
        <button
          onClick={() => agentParallelismEfficiencyAnalyzer.analyze().then(() => setShowAgentParallelismEfficiencyAnalyzer(true))}
          disabled={agentParallelismEfficiencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-sky-600/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 disabled:opacity-50"
        >
          {agentParallelismEfficiencyAnalyzer.loading ? 'Analyzing...' : 'Parallelism Efficiency'}
        </button>
        <button
          onClick={() => agentDecisionReversalRateAnalyzer.analyze().then(() => setShowAgentDecisionReversalRateAnalyzer(true))}
          disabled={agentDecisionReversalRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-indigo-600/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 disabled:opacity-50"
        >
          {agentDecisionReversalRateAnalyzer.loading ? 'Analyzing...' : 'Decision Reversal Rate'}
        </button>
        <button
          onClick={() => agentPriorityAlignmentRateAnalyzer.analyze().then(() => setShowAgentPriorityAlignmentRateAnalyzer(true))}
          disabled={agentPriorityAlignmentRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-green-600/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 disabled:opacity-50"
        >
          {agentPriorityAlignmentRateAnalyzer.loading ? 'Analyzing...' : 'Priority Alignment Rate'}
        </button>
        <button
          onClick={() => agentSessionWarmUpTimeAnalyzer.analyze().then(() => setShowAgentSessionWarmUpTimeAnalyzer(true))}
          disabled={agentSessionWarmUpTimeAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-yellow-600/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 disabled:opacity-50"
        >
          {agentSessionWarmUpTimeAnalyzer.loading ? 'Analyzing...' : 'Session Warm-Up Time'}
        </button>
        <button
          onClick={() => agentInteractionRichnessAnalyzer.analyze().then(() => setShowAgentInteractionRichnessAnalyzer(true))}
          disabled={agentInteractionRichnessAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-purple-600/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 disabled:opacity-50"
        >
          {agentInteractionRichnessAnalyzer.loading ? 'Analyzing...' : 'Interaction Richness'}
        </button>
        <button
          onClick={() => agentBoundaryViolationRateAnalyzer.analyze().then(() => setShowAgentBoundaryViolationRateAnalyzer(true))}
          disabled={agentBoundaryViolationRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-pink-600/30 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 disabled:opacity-50"
        >
          {agentBoundaryViolationRateAnalyzer.loading ? 'Analyzing...' : 'Boundary Violation Rate'}
        </button>
        <button
          onClick={() => agentSemanticConsistencyRateAnalyzer.analyze().then(() => setShowAgentSemanticConsistencyRateAnalyzer(true))}
          disabled={agentSemanticConsistencyRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-stone-600/30 bg-stone-500/10 hover:bg-stone-500/20 text-stone-300 disabled:opacity-50"
        >
          {agentSemanticConsistencyRateAnalyzer.loading ? 'Analyzing...' : 'Semantic Consistency Rate'}
        </button>
        <button
          onClick={() => agentKnowledgeRecencyIndexAnalyzer.analyze().then(() => setShowAgentKnowledgeRecencyIndexAnalyzer(true))}
          disabled={agentKnowledgeRecencyIndexAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-gray-600/30 bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 disabled:opacity-50"
        >
          {agentKnowledgeRecencyIndexAnalyzer.loading ? 'Analyzing...' : 'Knowledge Recency Index'}
        </button>
        <button
          onClick={() => agentTaskScopeExpansionRateAnalyzer.analyze().then(() => setShowAgentTaskScopeExpansionRateAnalyzer(true))}
          disabled={agentTaskScopeExpansionRateAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-red-600/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50"
        >
          {agentTaskScopeExpansionRateAnalyzer.loading ? 'Analyzing...' : 'Scope Expansion Rate'}
        </button>
        <button
          onClick={() => agentResponseLatencyAnalyzer.analyze().then(() => setShowAgentResponseLatencyAnalyzer(true))}
          disabled={agentResponseLatencyAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-blue-600/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 disabled:opacity-50"
        >
          {agentResponseLatencyAnalyzer.loading ? 'Analyzing...' : 'Response Latency Analyzer'}
        </button>
        <button
          onClick={() => agentOutputVerbosityAnalyzer.analyze().then(() => setShowAgentOutputVerbosityAnalyzer(true))}
          disabled={agentOutputVerbosityAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-orange-600/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 disabled:opacity-50"
        >
          {agentOutputVerbosityAnalyzer.loading ? 'Analyzing...' : 'Output Verbosity'}
        </button>
        <button
          onClick={() => agentFocusRetentionAnalyzer.analyze().then(() => setShowAgentFocusRetentionAnalyzer(true))}
          disabled={agentFocusRetentionAnalyzer.loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all border-teal-600/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 disabled:opacity-50"
        >
          {agentFocusRetentionAnalyzer.loading ? 'Analyzing...' : 'Focus Retention'}
        </button>
        <button
          onClick={() => { analyzeInstructionRedundancy(); setShowAgentInstructionRedundancyAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
        >
          Instruction Redundancy
        </button>
        <button
          onClick={() => { analyzeGoalDriftRate(); setShowAgentGoalDriftRateAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/30 hover:bg-fuchsia-500/20 transition-colors"
        >
          Goal Drift Rate
        </button>
        <button
          onClick={() => { analyzeHypothesisTestingRate(); setShowAgentHypothesisTestingRateAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
        >
          Hypothesis Testing
        </button>
        <button
          onClick={() => { analyzeCrossDomainTransfer(); setShowAgentCrossDomainTransferAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-colors"
        >
          Cross-Domain Transfer
        </button>
        <button
          onClick={() => { analyzeInstructionFollowingFidelity(); setShowAgentInstructionFollowingFidelityAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 hover:bg-slate-500/20 transition-colors"
        >
          Instruction Fidelity
        </button>
        <button
          onClick={() => { analyzeAdaptiveLearningRate(); setShowAgentAdaptiveLearningRateAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
        >
          Adaptive Learning
        </button>
        <button
          onClick={() => { analyzeCollaborationBottleneck(); setShowAgentCollaborationBottleneckAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-colors"
        >
          Collab Bottleneck
        </button>
        <button
          onClick={() => { analyzeContextSwitchingCost(); setShowAgentContextSwitchingCostAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
        >
          Context Switching Cost
        </button>
        <button
          onClick={() => { analyzeCalibrationScore(); setShowAgentCalibrationScoreAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-lime-500/10 text-lime-400 border border-lime-500/30 hover:bg-lime-500/20 transition-colors"
        >
          Calibration Score
        </button>
        <button
          onClick={() => { analyzeRecoveryTimeAnalyzer(); setShowAgentRecoveryTimeAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors"
        >
          Recovery Time
        </button>
        <button
          onClick={() => { analyzeInterruptionHandlingEfficiency(); setShowAgentInterruptionHandlingEfficiencyAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20 transition-colors"
        >
          Interruption Handling
        </button>
        <button
          onClick={() => { analyzeNarrativeCoherence(); setShowAgentNarrativeCoherenceAnalyzer(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors"
        >
          Narrative Coherence
        </button>

        {/* Agent Autonomy Button */}
        <button
          onClick={async () => {
            setShowAgentAutonomy(true);
            try {
              await agentAutonomy.analyze();
            } catch (error) {
              toast.error(`Agent autonomy analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentAutonomy.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentAutonomy.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' /></svg> Agent Autonomy</>
          )}
        </button>

        {/* Agent Interruption Impact Button */}
        <button
          onClick={async () => {
            setShowAgentInterruptionImpact(true);
            try {
              await agentInterruptionImpact.analyze();
            } catch (error) {
              toast.error(`Interruption impact analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentInterruptionImpact.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentInterruptionImpact.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Interruption Impact</>
          )}
        </button>

        {/* Agent Rework Rate Button */}
        <button
          onClick={async () => {
            setShowAgentReworkRate(true);
            try {
              await agentReworkRate.analyze();
            } catch (error) {
              toast.error(`Agent rework rate analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentReworkRate.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
        >
          {agentReworkRate.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' /></svg> Agent Rework Rate</>
          )}
        </button>

        {/* Chain Depth Button */}
        <button
          onClick={async () => {
            setShowAgentHandoffChainDepth(true);
            try {
              await agentHandoffChainDepth.analyze();
            } catch (error) {
              toast.error(`Chain depth analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentHandoffChainDepth.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentHandoffChainDepth.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h8m-8 6h16' /></svg> Chain Depth</>
          )}
        </button>

        {/* Scope Adherence Button */}
        <button
          onClick={async () => {
            setShowAgentScopeAdherence(true);
            try {
              await agentScopeAdherence.analyze();
            } catch (error) {
              toast.error(`Scope adherence analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentScopeAdherence.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentScopeAdherence.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Scope Adherence</>
          )}
        </button>

        {/* Agent Blockers Button */}
        <button
          onClick={async () => {
            setShowAgentBlockerFrequency(true);
            try {
              await agentBlockerFrequency.analyze();
            } catch (error) {
              toast.error(`Blocker frequency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentBlockerFrequency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
        >
          {agentBlockerFrequency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Agent Blockers</>
          )}
        </button>

        {/* Token Budget Button */}
        <button
          onClick={async () => {
            setShowAgentTokenBudget(true);
            try {
              await agentTokenBudget.analyze();
            } catch (error) {
              toast.error(`Token budget analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentTokenBudget.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          {agentTokenBudget.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /></svg> Token Budget</>
          )}
        </button>

        {/* Knowledge Freshness Button */}
        <button
          onClick={async () => {
            setShowAgentKnowledgeFreshness(true);
            try {
              await agentKnowledgeFreshness.analyze();
            } catch (error) {
              toast.error(`Knowledge freshness analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentKnowledgeFreshness.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          {agentKnowledgeFreshness.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Knowledge</>
          )}
        </button>

        {/* Response Latency Button */}
        <button
          onClick={async () => {
            setShowAgentResponseLatency(true);
            try {
              await agentResponseLatency.analyze();
            } catch (error) {
              toast.error(`Response latency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentResponseLatency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentResponseLatency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Latency</>
          )}
        </button>

        {/* Error Recovery Button */}
        <button
          onClick={async () => {
            setShowAgentErrorRecovery(true);
            try {
              await agentErrorRecovery.analyze();
            } catch (error) {
              toast.error(`Error recovery analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentErrorRecovery.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
        >
          {agentErrorRecovery.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' /></svg> Error Recovery</>
          )}
        </button>

        {/* Persona Alignment Button */}
        <button
          onClick={async () => {
            setShowAgentPersonaAlignment(true);
            try {
              const data = await agentPersonaAlignmentMutation.mutateAsync();
              setAgentPersonaAlignmentResult(data);
            } catch (error) {
              toast.error(`Persona alignment analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentPersonaAlignmentMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentPersonaAlignmentMutation.isPending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' /></svg> Persona Alignment</>
          )}
        </button>

        {/* Collab Graph Button */}
        <button
          onClick={async () => {
            setShowAgentCollaborationGraph(true);
            try {
              const data = await agentCollaborationGraphMutation.mutateAsync();
              setAgentCollaborationGraphResult(data);
            } catch (error) {
              toast.error(`Collaboration graph analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCollaborationGraphMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentCollaborationGraphMutation.isPending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' /></svg> Collab Graph</>
          )}
        </button>

        {/* Multi-Task Button */}
        <button
          onClick={async () => {
            setShowAgentMultitaskingEfficiency(true);
            try {
              const data = await agentMultitaskingEfficiencyMutation.mutateAsync();
              setAgentMultitaskingEfficiencyResult(data);
            } catch (error) {
              toast.error(`Multi-tasking efficiency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentMultitaskingEfficiencyMutation.isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
        >
          {agentMultitaskingEfficiencyMutation.isPending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 10h16M4 14h16M4 18h16' /></svg> Multitasking</>
          )}
        </button>

        {/* Response Latency Button */}
        <button
          onClick={async () => {
            setShowAgentResponseLatency(true);
            try {
              await agentResponseLatency.analyze();
            } catch (error) {
              toast.error(`Response latency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentResponseLatency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentResponseLatency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Latency</>
          )}
        </button>

        {/* Confidence Cal. Button */}
        <button
          onClick={async () => {
            setShowAgentConfidenceCalibration(true);
            try {
              await agentConfidenceCalibration.analyze(projectId!);
            } catch (error) {
              toast.error(`Confidence calibration analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentConfidenceCalibration.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
        >
          {agentConfidenceCalibration.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /></svg> Confidence Cal.</>
          )}
        </button>

        {/* Feedback Inc. Button */}
        <button
          onClick={async () => {
            setShowAgentFeedbackIncorporation(true);
            try {
              await agentFeedbackIncorporation.analyze();
            } catch (error) {
              toast.error(`Feedback incorporation analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentFeedbackIncorporation.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentFeedbackIncorporation.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Feedback Inc.</>
          )}
        </button>

        {/* Spec. Drift Button */}
        <button
          onClick={async () => {
            setShowAgentSpecializationDrift(true);
            try {
              await agentSpecializationDrift.analyze();
            } catch (error) {
              toast.error(`Specialization drift analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSpecializationDrift.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {agentSpecializationDrift.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' /></svg> Specialization Drift</>
          )}
        </button>

        {/* Decision Speed Button */}
        <button
          onClick={async () => {
            setShowAgentDecisionSpeed(true);
            try {
              await agentDecisionSpeed.analyze();
            } catch (error) {
              toast.error(`Decision speed analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDecisionSpeed.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentDecisionSpeed.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg> Decision Speed</>
          )}
        </button>

        {/* Focus Advisor Button */}
        <button
          onClick={async () => {
            setShowAgentFocusAdvisor(true);
            try {
              await agentFocusAdvisor.advise(projectId!);
            } catch (error) {
              toast.error(`Focus advisor failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentFocusAdvisor.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentFocusAdvisor.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Focus Advisor</>
          )}
        </button>

        {/* Response Times Button */}
        <button
          onClick={async () => {
            setShowAgentResponseTime(true);
            try {
              await agentResponseTime.profile(projectId!);
            } catch (error) {
              toast.error(`Response time profiler failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentResponseTime.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentResponseTime.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Response Times</>
          )}
        </button>

        {/* Priority Alignment Button */}
        <button
          onClick={async () => {
            setShowPriorityAlignment(true);
            try {
              await agentPriorityAlignment.analyze(projectId!);
            } catch (error) {
              toast.error(`Priority alignment analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentPriorityAlignment.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          {agentPriorityAlignment.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' /></svg> Priority Alignment</>
          )}
        </button>

        {/* Stall Detector Button */}
        <button
          onClick={async () => {
            setShowStallDetector(true);
            try {
              await agentStallDetector.detect(projectId!);
            } catch (error) {
              toast.error(`Stall detection failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentStallDetector.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentStallDetector.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Stall Detector</>
          )}
        </button>

        {/* Specializations Button */}
        <button
          onClick={async () => {
            setShowSpecializationMapper(true);
            try {
              await agentSpecializationMapper.map(projectId!);
            } catch (error) {
              toast.error(`Specialization mapping failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSpecializationMapper.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentSpecializationMapper.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' /></svg> Specializations</>
          )}
        </button>

        {/* Bottlenecks Button */}
        <button
          onClick={async () => {
            setShowBottleneckAnalyzer(true);
            try {
              await agentBottleneckAnalyzer.analyze(projectId!);
            } catch (error) {
              toast.error(`Bottleneck analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentBottleneckAnalyzer.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {agentBottleneckAnalyzer.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Bottlenecks</>
          )}
        </button>

        {/* Queue Depth Button */}
        <button
          onClick={async () => {
            setShowAgentQueueDepth(true);
            try {
              await agentQueueDepth.monitor(projectId!);
            } catch (error) {
              toast.error(`Queue depth monitoring failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentQueueDepth.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentQueueDepth.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4' /></svg> Queue Depth</>
          )}
        </button>

        {/* Skill Gaps Button */}
        <button
          onClick={async () => {
            setShowAgentSkillGap(true);
            try {
              await agentSkillGap.analyze(projectId!);
            } catch (error) {
              toast.error(`Skill gap analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSkillGap.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
        >
          {agentSkillGap.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' /></svg> Skill Gaps</>
          )}
        </button>

        {/* Conflicts Button */}
        <button
          onClick={async () => {
            setShowAgentConflictDetector(true);
            try {
              await agentConflictDetector.analyze(projectId!);
            } catch (error) {
              toast.error(`Conflict detection failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentConflictDetector.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentConflictDetector.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Conflicts</>
          )}
        </button>

        {/* Quality Button */}
        <button
          onClick={async () => {
            setShowAgentDecisionQuality(true);
            try {
              await agentDecisionQuality.analyze(projectId!);
            } catch (error) {
              toast.error(`Decision quality analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDecisionQuality.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentDecisionQuality.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Quality</>
          )}
        </button>

        {/* Perf Trends Button */}
        <button
          onClick={async () => {
            setShowAgentPerformanceTrend(true);
            try {
              await agentPerformanceTrend.analyze(projectId!);
            } catch (error) {
              toast.error(`Performance trend analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentPerformanceTrend.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentPerformanceTrend.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' /></svg> Perf Trends</>
          )}
        </button>

        {/* Coverage Gaps Button */}
        <button
          onClick={async () => {
            setShowAgentCoverageGap(true);
            try {
              await agentCoverageGap.analyze(projectId!);
            } catch (error) {
              toast.error(`Coverage gap analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCoverageGap.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentCoverageGap.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' /></svg> Coverage Gaps</>
          )}
        </button>

        {/* Dependencies Button */}
        <button
          onClick={async () => {
            setShowAgentDependencyMapper(true);
            try {
              await agentDependencyMapper.analyze(projectId!);
            } catch (error) {
              toast.error(`Dependency mapping failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDependencyMapper.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentDependencyMapper.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' /></svg> Dep Resolution</>
          )}
        </button>

        {/* Context Utilization Button */}
        <button
          onClick={async () => {
            setShowAgentContextUtilization(true);
            try {
              await agentContextUtilization.analyze(projectId!);
            } catch (error) {
              toast.error(`Context utilization analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentContextUtilization.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentContextUtilization.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' /></svg> Context</>
          )}
        </button>

        {/* Handoffs Button */}
        <button
          onClick={async () => {
            setShowAgentHandoffSuccess(true);
            try {
              await agentHandoffSuccess.analyze(projectId!);
            } catch (error) {
              toast.error(`Handoff success analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentHandoffSuccess.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentHandoffSuccess.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' /></svg> Handoffs</>
          )}
        </button>

        {/* Idle Time Button */}
        <button
          onClick={async () => {
            setShowAgentIdleTime(true);
            try {
              await agentIdleTime.analyze(projectId!);
            } catch (error) {
              toast.error(`Idle time analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentIdleTime.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentIdleTime.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Idle Time</>
          )}
        </button>

        {/* Throughput Button */}
        <button
          onClick={async () => {
            setShowAgentThroughputEfficiency(true);
            try {
              await agentThroughputEfficiency.analyze(projectId!);
            } catch (error) {
              toast.error(`Throughput analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentThroughputEfficiency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentThroughputEfficiency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg> Throughput</>
          )}
        </button>

        {/* Fairness Button */}
        <button
          onClick={async () => {
            setShowAgentWorkloadFairness(true);
            try {
              await agentWorkloadFairness.analyze(projectId!);
            } catch (error) {
              toast.error(`Fairness analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentWorkloadFairness.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentWorkloadFairness.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' /></svg> Fairness</>
          )}
        </button>

        {/* Error Rates Button */}
        <button
          onClick={async () => {
            setShowAgentErrorRates(true);
            try {
              await agentErrorRates.analyze(projectId!);
            } catch (error) {
              toast.error(`Error rate analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentErrorRates.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {agentErrorRates.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Error Rates</>
          )}
        </button>

        {/* Escalation Pattern Button */}
        <button
          onClick={async () => {
            setShowAgentEscalationPatterns(true);
            try {
              await agentEscalationPatterns.analyze(projectId!);
            } catch (error) {
              toast.error(`Escalation analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentEscalationPatterns.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentEscalationPatterns.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' /></svg> Escalation</>
          )}
        </button>

        {/* Goal Alignment Button */}
        <button
          onClick={async () => {
            setShowAgentGoalAlignment(true);
            try {
              await agentGoalAlignment.analyze(projectId!);
            } catch (error) {
              toast.error(`Goal alignment analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentGoalAlignment.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          {agentGoalAlignment.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' /></svg> Goal Alignment</>
          )}
        </button>

        {/* Recovery Pattern Button */}
        <button
          onClick={async () => {
            setShowAgentRecoveryPatterns(true);
            try {
              await agentRecoveryPatterns.analyze(projectId!);
            } catch (error) {
              toast.error(`Recovery analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentRecoveryPatterns.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentRecoveryPatterns.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' /></svg> Recovery</>
          )}
        </button>

        {/* Task Velocity Button */}
        <button
          onClick={async () => {
            setShowAgentTaskVelocity(true);
            try {
              await agentTaskVelocity.analyze(projectId!);
            } catch (error) {
              toast.error(`Velocity analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentTaskVelocity.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentTaskVelocity.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M13 10V3L4 14h7v7l9-11h-7z' /></svg> Velocity</>
          )}
        </button>

        {/* Context Switch Button */}
        <button
          onClick={async () => {
            setShowAgentContextSwitch(true);
            try {
              await agentContextSwitch.analyze(projectId!);
            } catch (error) {
              toast.error(`Context switch analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentContextSwitch.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentContextSwitch.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' /></svg> Context Switch</>
          )}
        </button>

        {/* Parallel Load Button */}
        <button
          onClick={async () => {
            setShowAgentParallelCapacity(true);
            try {
              await agentParallelCapacity.analyze(projectId!);
            } catch (error) {
              toast.error(`Parallel capacity analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentParallelCapacity.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          {agentParallelCapacity.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 6h16M4 12h16M4 18h16' /></svg> Parallel Load</>
          )}
        </button>

        {/* Estimation Button */}
        <button
          onClick={async () => {
            setShowAgentEstimationAccuracy(true);
            try {
              await agentEstimationAccuracy.analyze(projectId!);
            } catch (error) {
              toast.error(`Estimation analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentEstimationAccuracy.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-50"
        >
          {agentEstimationAccuracy.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' /></svg> Estimation Accuracy</>
          )}
        </button>

        {/* Abandonment Button */}
        <button
          onClick={async () => {
            setShowAgentTaskAbandonment(true);
            try {
              await agentTaskAbandonment.analyze(projectId!);
            } catch (error) {
              toast.error(`Abandonment analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentTaskAbandonment.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentTaskAbandonment.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' /></svg> Task Abandonment</>
          )}
        </button>

        {/* Comm Quality Button */}
        <button
          onClick={async () => {
            setShowAgentCommunicationQuality(true);
            try {
              await agentCommunicationQuality.analyze(projectId!);
            } catch (error) {
              toast.error(`Communication quality analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCommunicationQuality.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentCommunicationQuality.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' /></svg> Comm Quality</>
          )}
        </button>

        {/* Workload Heatmap Button */}
        <button
          onClick={async () => {
            setShowAgentWorkloadDistribution(true);
            try {
              await agentWorkloadDistribution.analyze(projectId!);
            } catch (error) {
              toast.error(`Workload distribution analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentWorkloadDistribution.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentWorkloadDistribution.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' /></svg> Workload Heatmap</>
          )}
        </button>

        {/* Agent Output Quality Button */}
        <button
          onClick={async () => {
            setShowAgentOutputQuality(true);
            setAgentOutputQualityLoading(true);
            try {
              const data = await getAgentOutputQuality(projectId!);
              setAgentOutputQualityScores(data);
            } catch (error) {
              toast.error(`Output quality scoring failed: ${getClientErrorMessage(error)}`);
            } finally {
              setAgentOutputQualityLoading(false);
            }
          }}
          disabled={agentOutputQualityLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentOutputQualityLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' /></svg> Agent Output Quality</>
          )}
        </button>

        {/* Agent Session Depth Button */}
        <button
          onClick={async () => {
            setShowAgentSessionDepth(true);
            try {
              await agentSessionDepth.analyze(projectId!);
            } catch (error) {
              toast.error(`Session depth analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSessionDepth.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentSessionDepth.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' /></svg> Session Depth</>
          )}
        </button>

        {/* Agent Feedback Loops Button */}
        <button
          onClick={async () => {
            setShowAgentFeedbackLoops(true);
            try {
              await agentFeedbackLoops.analyze(projectId!);
            } catch (error) {
              toast.error(`Feedback loop analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentFeedbackLoops.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentFeedbackLoops.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' /></svg> Feedback Loops</>
          )}
        </button>

        {/* Agent Reassignment Rates Button */}
        <button
          onClick={async () => {
            setShowAgentReassignmentRates(true);
            try {
              await agentReassignmentRates.analyze(projectId!);
            } catch (error) {
              toast.error(`Reassignment rate analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentReassignmentRates.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentReassignmentRates.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg> Reassignments</>
          )}
        </button>

        {/* Agent Learning Curves Button */}
        <button
          onClick={async () => {
            setShowLearningCurveModal(true);
            try {
              const data = await getAgentLearningCurves(projectId!);
              setLearningCurveData(data);
            } catch (error) {
              toast.error(`Learning curve analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Learning Curves
        </button>

        {/* Task Complexity Button */}
        <button
          onClick={async () => {
            setShowAgentTaskComplexity(true);
            try {
              await agentTaskComplexity.analyze(projectId!);
            } catch (error) {
              toast.error(`Task complexity analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentTaskComplexity.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentTaskComplexity.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg> Task Complexity</>
          )}
        </button>

        {/* Throughput Rate Button */}
        <button
          onClick={async () => {
            setShowAgentThroughputRate(true);
            try {
              await agentThroughputRate.analyze();
            } catch (error) {
              toast.error(`Throughput rate analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentThroughputRate.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentThroughputRate.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Throughput Rate</>
          )}
        </button>

        {/* Success Rate Button */}
        <button
          onClick={async () => {
            setShowAgentSuccessRate(true);
            try {
              await agentSuccessRate.analyze();
            } catch (error) {
              toast.error(`Success rate analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSuccessRate.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {agentSuccessRate.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Success Rate</>
          )}
        </button>

        {/* Cost Efficiency Button */}
        <button
          onClick={async () => {
            setShowAgentCostEfficiency(true);
            try {
              await agentCostEfficiency.analyze();
            } catch (error) {
              toast.error(`Cost efficiency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCostEfficiency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentCostEfficiency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Cost Efficiency</>
          )}
        </button>

        {/* Deadline Adherence Button */}
        <button
          onClick={async () => {
            setShowAgentDeadlineAdherence(true);
            try {
              await agentDeadlineAdherence.analyze();
            } catch (error) {
              toast.error(`Deadline adherence analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDeadlineAdherence.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentDeadlineAdherence.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Deadline Adherence</>
          )}
        </button>

        {/* Session Duration Button */}
        <button
          onClick={async () => {
            setShowAgentSessionDuration(true);
            try {
              await agentSessionDuration.analyze();
            } catch (error) {
              toast.error(`Session duration analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSessionDuration.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentSessionDuration.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Session Duration</>
          )}
        </button>

        {/* Retry Pattern Button */}
        <button
          onClick={async () => {
            setShowAgentRetryPattern(true);
            try {
              await agentRetryPattern.analyze();
            } catch (error) {
              toast.error(`Retry pattern analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentRetryPattern.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {agentRetryPattern.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Retry Pattern</>
          )}
        </button>

        {/* Tool Patterns Button */}
        <button
          onClick={async () => {
            setShowAgentToolUsagePattern(true);
            try {
              await agentToolUsagePattern.analyze();
            } catch (error) {
              toast.error(`Tool usage pattern analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentToolUsagePattern.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentToolUsagePattern.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Tool Patterns</>
          )}
        </button>

        {/* Priority Adherence Button */}
        <button
          onClick={async () => {
            setShowAgentPriorityAdherence(true);
            try {
              await agentPriorityAdherence.analyze();
            } catch (error) {
              toast.error(`Priority adherence analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentPriorityAdherence.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {agentPriorityAdherence.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Priority Adherence</>
          )}
        </button>

        {/* Cognitive Load Button */}
        <button
          onClick={async () => {
            setShowCognitiveLoad(true);
            try {
              await cognitiveLoad.analyze();
            } catch (error) {
              toast.error(`Cognitive load analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={cognitiveLoad.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {cognitiveLoad.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Cognitive Load</>
          )}
        </button>

        {/* Learning Velocity Button */}
        <button
          onClick={async () => {
            setShowLearningVelocity(true);
            try {
              await learningVelocity.analyze();
            } catch (error) {
              toast.error(`Learning velocity analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={learningVelocity.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {learningVelocity.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Learning Velocity</>
          )}
        </button>

        {/* Parallel Tasks Button */}
        <button
          onClick={async () => {
            setShowParallelTaskEfficiency(true);
            try {
              await parallelTaskEfficiency.analyze();
            } catch (error) {
              toast.error(`Parallel task efficiency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={parallelTaskEfficiency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {parallelTaskEfficiency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Parallel Tasks</>
          )}
        </button>

        {/* Goal Completion Button */}
        <button
          onClick={async () => {
            setShowAgentGoalCompletion(true);
            try {
              await agentGoalCompletion.analyze();
            } catch (error) {
              toast.error(`Goal completion analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentGoalCompletion.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentGoalCompletion.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' /></svg> Goal Completion</>
          )}
        </button>

        {/* Decision Quality V2 Button */}
        <button
          onClick={async () => {
            setShowAgentDecisionQualityV2(true);
            try {
              await agentDecisionQualityV2.analyze();
            } catch (error) {
              toast.error(`Decision quality analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDecisionQualityV2.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentDecisionQualityV2.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' /></svg> Decision Quality</>
          )}
        </button>

                {/* Communication Patterns Button */}
        <button
          onClick={async () => {
            setShowAgentCommunicationPatterns(true);
            try {
              await agentCommunicationPatterns.analyze();
            } catch (error) {
              toast.error(`Communication pattern analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCommunicationPatterns.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {agentCommunicationPatterns.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Communication Patterns</>
          )}
        </button>

        {/* Self-Correction Rate Button */}
        <button
          onClick={async () => {
            setShowAgentSelfCorrectionRate(true);
            try {
              await agentSelfCorrectionRate.analyze();
            } catch (error) {
              toast.error(`Self-correction analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSelfCorrectionRate.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentSelfCorrectionRate.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Self-Correction</>
          )}
        </button>

        {/* Dependency Resolution Button */}
        <button
          onClick={async () => {
            setShowAgentDependencyResolution(true);
            try {
              await agentDependencyResolution.analyze();
            } catch (error) {
              toast.error(`Dependency resolution analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDependencyResolution.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentDependencyResolution.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Dep Resolution</>
          )}
        </button>

        {/* Context Window Button */}
        <button
          onClick={async () => {
            setShowContextWindow(true);
            try {
              await contextWindow.analyze();
            } catch (error) {
              toast.error(`Context window analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={contextWindow.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {contextWindow.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Context Window</>
          )}
        </button>

        {/* Output Consistency Button */}
        <button
          onClick={async () => {
            setShowAgentOutputConsistency(true);
            try {
              await agentOutputConsistency.analyze();
            } catch (error) {
              toast.error(`Output consistency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentOutputConsistency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentOutputConsistency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Output Consistency</>
          )}
        </button>

        {/* Collaboration Efficiency Button */}
        <button
          onClick={async () => {
            setShowAgentCollaborationEfficiency(true);
            try {
              await agentCollaborationEfficiency.analyze();
            } catch (error) {
              toast.error(`Collaboration efficiency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCollaborationEfficiency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentCollaborationEfficiency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Collaboration Efficiency</>
          )}
        </button>

        {/* Adaptation Speed Button */}
        <button
          onClick={async () => {
            setShowAgentAdaptationSpeed(true);
            try {
              await agentAdaptationSpeed.analyze();
            } catch (error) {
              toast.error(`Adaptation speed analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentAdaptationSpeed.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          {agentAdaptationSpeed.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Adaptation Speed</>
          )}
        </button>

        {/* Scope Drift Button */}
        <button
          onClick={async () => {
            setShowAgentScopeDrift(true);
            try {
              await agentScopeDrift.analyze();
            } catch (error) {
              toast.error(`Scope drift analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentScopeDrift.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-50"
        >
          {agentScopeDrift.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Scope Drift</>
          )}
        </button>

        {/* Instruction Compliance Button */}
        <button
          onClick={async () => {
            setShowAgentInstructionCompliance(true);
            try {
              await agentInstructionCompliance.analyze();
            } catch (error) {
              toast.error(`Instruction compliance analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentInstructionCompliance.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
        >
          {agentInstructionCompliance.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Instruction Compliance</>
          )}
        </button>

        {/* Escalation Patterns Button */}
        <button
          onClick={async () => {
            setShowAgentEscalationPatternAnalyzer(true);
            try {
              await agentEscalationPatternAnalyzer.analyze();
            } catch (error) {
              toast.error(`Escalation pattern analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentEscalationPatternAnalyzer.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentEscalationPatternAnalyzer.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Escalation Patterns</>
          )}
        </button>

        {/* Feedback Integration Button */}
        <button
          onClick={async () => {
            setShowAgentFeedbackIntegration(true);
            try {
              await agentFeedbackIntegration.analyze();
            } catch (error) {
              toast.error(`Feedback integration analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentFeedbackIntegration.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentFeedbackIntegration.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Feedback Integration</>
          )}
        </button>

        {/* Proactivity Button */}
        <button
          onClick={async () => {
            setShowAgentProactivity(true);
            try {
              await agentProactivity.analyze();
            } catch (error) {
              toast.error(`Proactivity analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentProactivity.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {agentProactivity.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Proactivity</>
          )}
        </button>

        {/* Decision Latency Button */}
        <button
          onClick={async () => {
            setShowAgentDecisionLatency(true);
            try {
              await agentDecisionLatency.analyze();
            } catch (error) {
              toast.error(`Decision latency analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDecisionLatency.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
        >
          {agentDecisionLatency.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Decision Latency</>
          )}
        </button>

        {/* Resource Consumption Button */}
        <button
          onClick={async () => {
            setShowAgentResourceConsumption(true);
            try {
              await agentResourceConsumption.analyze();
            } catch (error) {
              toast.error(`Resource consumption analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentResourceConsumption.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
        >
          {agentResourceConsumption.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Resource Use</>
          )}
        </button>

        {/* Session Quality Button */}
        <button
          onClick={async () => {
            setShowAgentSessionQuality(true);
            try {
              await agentSessionQuality.analyze();
            } catch (error) {
              toast.error(`Session quality analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSessionQuality.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentSessionQuality.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Session Quality</>
          )}
        </button>

        {/* Workflow Transitions Button */}
        <button
          onClick={async () => {
            setShowAgentWorkflowTransitions(true);
            try {
              await agentWorkflowTransitions.analyze();
            } catch (error) {
              toast.error(`Workflow transition analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentWorkflowTransitions.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
        >
          {agentWorkflowTransitions.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Workflow</>
          )}
        </button>

        {/* Knowledge Transfer Button */}
        <button
          onClick={async () => {
            setShowAgentKnowledgeTransfer(true);
            try {
              await agentKnowledgeTransfer.analyze();
            } catch (error) {
              toast.error(`Knowledge transfer analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentKnowledgeTransfer.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
        >
          {agentKnowledgeTransfer.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Knowledge Transfer</>
          )}
        </button>

        {/* Delegation Depth Button */}
        <button
          onClick={async () => {
            setShowAgentDelegationDepth(true);
            try {
              await agentDelegationDepth.analyze();
            } catch (error) {
              toast.error(`Delegation depth analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentDelegationDepth.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-fuchsia-600 hover:bg-fuchsia-700 text-white disabled:opacity-50"
        >
          {agentDelegationDepth.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Delegation Depth</>
          )}
        </button>

        {/* Autonomy Index Button */}
        <button
          onClick={async () => {
            setShowAgentAutonomyIndex(true);
            try {
              await agentAutonomyIndex.analyze();
            } catch (error) {
              toast.error(`Autonomy index analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentAutonomyIndex.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
        >
          {agentAutonomyIndex.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Autonomy Index</>
          )}
        </button>

        {/* Blocked Time Button */}
        <button
          onClick={async () => {
            setShowAgentBlockedTime(true);
            try {
              await agentBlockedTime.analyze();
            } catch (error) {
              toast.error(`Blocked time analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentBlockedTime.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50"
        >
          {agentBlockedTime.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Blocked Time</>
          )}
        </button>

        {/* Quality-Speed Button */}
        <button
          onClick={async () => {
            setShowAgentQualitySpeed(true);
            try {
              await agentQualitySpeed.analyze();
            } catch (error) {
              toast.error(`Quality-speed analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentQualitySpeed.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {agentQualitySpeed.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Quality-Speed</>
          )}
        </button>

        {/* Specialization Button */}
        <button
          onClick={async () => {
            setShowAgentSpecialization(true);
            try {
              await agentSpecialization.analyze();
            } catch (error) {
              toast.error(`Specialization analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentSpecialization.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-slate-600 hover:bg-slate-700 text-white disabled:opacity-50"
        >
          {agentSpecialization.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Specialization</>
          )}
        </button>

        {/* Collaboration Score Button */}
        <button
          onClick={async () => {
            setShowAgentCollaborationScore(true);
            try {
              await agentCollaborationScore.analyze();
            } catch (error) {
              toast.error(`Collaboration score analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentCollaborationScore.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {agentCollaborationScore.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Collaboration</>
          )}
        </button>

        {/* Throughput Button */}
        <button
          onClick={async () => {
            setShowAgentThroughput(true);
            try {
              await agentThroughput.analyze();
            } catch (error) {
              toast.error(`Throughput analysis failed: ${getClientErrorMessage(error)}`);
            }
          }}
          disabled={agentThroughput.loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          {agentThroughput.loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <>Throughput</>
          )}
        </button>

        {/* Deadline Risk Button */}
        {!deadlineDate ? (
          <input
            type="date"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            className="text-xs sm:text-sm px-2 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-amber-300 focus:outline-none focus:border-amber-500 shrink-0"
            placeholder="Deadline date"
            title="Set deadline date for risk prediction"
          />
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={async () => {
                try {
                  await analyzeDeadlineRisk(projectId!, deadlineDate);
                } catch (error) {
                  toast.error(`Failed to predict deadline risk: ${getClientErrorMessage(error)}`);
                }
              }}
              disabled={deadlineRiskLoading}
              className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deadlineRiskLoading ? (
                <><span className="animate-spin">&#8635;</span> <span className="hidden sm:inline">Predicting...</span></>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg><span className="hidden sm:inline">Deadline Risk</span></>
              )}
            </button>
            <button
              onClick={() => { setDeadlineDate(''); setDeadlineRiskResult(null); }}
              className="text-xs px-1.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
              title="Clear deadline date"
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* Blocker & Dependency Analysis Button */}
        {board?.columns?.flatMap((c) => c.tickets).length != null && board.columns.flatMap((c) => c.tickets).length >= 2 && (
          <button
            onClick={async () => {
              setShowBlockers(true);
              try {
                await blockerAnalysis.analyze(projectId!);
              } catch (error) {
                toast.error(`Failed to analyze dependencies: ${getClientErrorMessage(error)}`);
              }
            }}
            disabled={blockerAnalysis.loading}
            className="text-xs sm:text-sm px-2 md:px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-amber-400 hover:text-amber-300 hover:border-amber-500/50 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">Analyze Dependencies</span>
          </button>
        )}

        <div className="flex-1" />

        {/* Primary Actions */}
        {selectedFeatureId && (
          <button
            onClick={() => setShowNewTicket(true)}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-2 md:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 transition-all shrink-0 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Ticket</span>
          </button>
        )}
      </div>

      {/* Modals */}
      {showNewFeature && (
        <Modal onClose={() => setShowNewFeature(false)}>
          <form onSubmit={handleCreateFeature} className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-lg">New Feature</h2>
              <p className="text-gray-500 text-sm mt-1">Create a new feature to start planning and tracking work.</p>
            </div>
            <div>
              <label htmlFor="feature-title" className="block text-sm font-medium text-gray-400 mb-1.5">Feature Title</label>
              <input
                id="feature-title"
                type="text"
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
                placeholder="e.g., User authentication system"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                autoFocus
                required
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowNewFeature(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!featureTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
              >
                Create Feature
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showNewTicket && (
        <Modal onClose={() => setShowNewTicket(false)}>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-lg">New Ticket</h2>
              <p className="text-gray-500 text-sm mt-1">Add a task to the current feature board.</p>
            </div>
            <div>
              <label htmlFor="ticket-title" className="block text-sm font-medium text-gray-400 mb-1.5">Ticket Title</label>
              <input
                id="ticket-title"
                type="text"
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="e.g., Implement login form"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="ticket-desc" className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
              <textarea
                id="ticket-desc"
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                placeholder="Describe the work to be done..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all h-28 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ticketTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
              >
                Create Ticket
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <Modal onClose={() => setShowShortcuts(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Keyboard Shortcuts</h2>
              <kbd className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">?</kbd>
            </div>
            <div className="space-y-3">
              <ShortcutItem keys={['Esc']} description="Close modals or dialogs" />
              <ShortcutItem keys={['?', 'Shift']} description="Toggle this shortcuts dialog" />
              <ShortcutItem keys={['/']} description="Focus search in filters" />
            </div>
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 italic">More shortcuts coming soon</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Sessions Sidebar + Board + Agent Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sessions Sidebar */}
        {showSessionsSidebar && (
          <SessionsSidebar
            sessions={sessions}
            projectId={projectId!}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            onTicketSelect={(ticketId) => {
              const ticket = board?.columns.flatMap((c) => c.tickets).find((t) => t.id === ticketId);
              if (ticket) setSelectedTicket(ticket);
            }}
            width={sidebarWidth}
            onWidthChange={persistSidebarWidth}
          />
        )}

        <div className="flex-1 overflow-hidden">
          {boardError ? (
            <div className="flex items-center justify-center h-full p-6">
              <ErrorDisplay
                error={boardError}
                onRetry={() => {
                  setBoardError(null);
                  window.location.reload();
                }}
              />
            </div>
          ) : boardLoading ? (
            <BoardSkeleton />
          ) : board ? (
            <KanbanBoard
              board={board}
              projectId={projectId!}
              epicFilter={epicFilter}
              priorityFilter={priorityFilter}
              personaFilter={personaFilter}
              searchQuery={searchQuery}
              groupByEpic={groupByEpic}
              onTicketClick={setSelectedTicket}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                title="No feature selected"
                description="Select a feature from the dropdown above or create a new one to start tracking work."
                action={{
                  label: 'Create Feature',
                  onClick: () => setShowNewFeature(true),
                }}
              />
            </div>
          )}
        </div>

        {/* Agent Activity Panel */}
        {showAgentPanel && (
          <div className="w-80 shrink-0 border-l border-gray-800 bg-gray-900 overflow-y-auto">
            <AgentActivityFeed />
          </div>
        )}
      </div>

      {/* Ticket Detail Slide-over */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          epics={board?.epics || []}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {/* Help Modal */}
      {showHelp && (
        <HelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="Help & Documentation"
        >
          <HelpContent view={helpView} onViewChange={setHelpView} />
        </HelpModal>
      )}

      {/* Sprint Planning Modal */}
      {showSprintPlan && sprintPlan.plan && (
        <SprintPlanningModal
          plan={sprintPlan.plan}
          velocity={sprintPlan.plan.capacityUtilization > 0 ? Math.round((sprintPlan.plan.estimatedPoints / sprintPlan.plan.capacityUtilization) * 10) / 10 : sprintPlan.plan.estimatedPoints}
          onClose={() => { sprintPlan.setPlan(null); setShowSprintPlan(false); }}
        />
      )}

      {/* Standup Report Modal */}
      {showStandup && (
        <StandupReportModal
          projectId={projectId!}
          onClose={() => setShowStandup(false)}
        />
      )}

      {/* Retrospective Report Modal */}
      {showRetrospective && (
        <RetrospectiveReportModal
          projectId={projectId!}
          onClose={() => setShowRetrospective(false)}
        />
      )}

      {/* Blocker & Dependency Analysis Modal */}
      {showBlockers && project && (
        <BlockerDependencyModal
          projectId={projectId!}
          projectName={project.name}
          onClose={() => { blockerAnalysis.setResult(null); setShowBlockers(false); }}
        />
      )}

      {/* Ticket Prioritizer Modal */}
      {showPrioritizer && project && ticketPrioritizer.result && (
        <TicketPrioritizerModal
          result={ticketPrioritizer.result}
          projectName={project.name}
          onClose={() => { ticketPrioritizer.setResult(null); setShowPrioritizer(false); }}
        />
      )}

      {/* Epic Health Modal */}
      {epicHealth.result && (
        <EpicHealthModal
          result={epicHealth.result}
          isOpen={!!epicHealth.result}
          onClose={() => epicHealth.setResult(null)}
        />
      )}

      {/* Project Health Modal */}
      {projectHealthResult && (
        <ProjectHealthModal
          result={projectHealthResult}
          isOpen={true}
          onClose={() => setProjectHealthResult(null)}
        />
      )}

      {/* Deadline Risk Modal */}
      {deadlineRiskResult && (
        <DeadlineRiskModal
          result={deadlineRiskResult}
          isOpen={true}
          onClose={() => setDeadlineRiskResult(null)}
        />
      )}

      {/* Release Readiness Modal */}
      {releaseReadiness.result && (
        <ReleaseReadinessModal
          result={releaseReadiness.result}
          isOpen={!!releaseReadiness.result}
          onClose={() => releaseReadiness.setResult(null)}
        />
      )}

      {/* Workload Balancer Modal */}
      {workloadBalance.result && (
        <WorkloadBalancerModal
          result={workloadBalance.result}
          isOpen={!!workloadBalance.result}
          onClose={() => workloadBalance.setResult(null)}
        />
      )}

      {/* Agent Performance Modal */}
      {showAgentPerformance && (
        <AgentPerformanceModal
          result={agentPerformance.result}
          isOpen={showAgentPerformance}
          loading={agentPerformance.loading}
          onClose={() => { agentPerformance.setResult(null); setShowAgentPerformance(false); }}
        />
      )}

      {showAgentRouting && (
        <AgentRoutingModal
          result={agentRouting.result}
          isOpen={showAgentRouting}
          loading={agentRouting.loading}
          onClose={() => { agentRouting.setResult(null); setShowAgentRouting(false); }}
        />
      )}

      {/* Escalation Detector Modal */}
      {showEscalationDetector && (
        <EscalationDetectorModal
          result={escalationDetect.result}
          isOpen={showEscalationDetector}
          loading={escalationDetect.loading}
          onClose={() => { escalationDetect.setResult(null); setShowEscalationDetector(false); }}
        />
      )}

      {/* Agent Skill Profiler Modal */}
      {showSkillProfiler && (
        <AgentSkillProfilerModal
          result={skillProfiler.result}
          isOpen={showSkillProfiler}
          loading={skillProfiler.loading}
          onClose={() => { skillProfiler.setResult(null); setShowSkillProfiler(false); }}
        />
      )}

      {showCollaboration && (
        <AgentCollaborationModal
          result={agentCollaboration.result}
          isOpen={showCollaboration}
          loading={agentCollaboration.loading}
          onClose={() => { agentCollaboration.setResult(null); setShowCollaboration(false); }}
        />
      )}

      {showAgentBurnout && (
        <AgentBurnoutModal
          result={agentBurnout.result}
          isOpen={showAgentBurnout}
          loading={agentBurnout.loading}
          onClose={() => { agentBurnout.setResult(null); setShowAgentBurnout(false); }}
        />
      )}

      {showKnowledgeGap && (
        <AgentKnowledgeGapModal
          data={knowledgeGap.data}
          isOpen={showKnowledgeGap}
          loading={knowledgeGap.loading}
          onClose={() => { knowledgeGap.setData(null); setShowKnowledgeGap(false); }}
        />
      )}

      {showHandoffQuality && (
        <AgentHandoffQualityModal
          result={handoffQuality.result}
          isOpen={showHandoffQuality}
          loading={handoffQuality.loading}
          onClose={() => { handoffQuality.setResult(null); setShowHandoffQuality(false); }}
        />
      )}

      {showAgentTaskSequence && (
        <AgentTaskSequenceModal result={agentTaskSequence.result} isOpen={showAgentTaskSequence} loading={agentTaskSequence.loading} onClose={() => { agentTaskSequence.setResult(null); setShowAgentTaskSequence(false); }} />
      )}

      {showAgentLoadPredictor && (
        <AgentLoadPredictorModal result={agentLoadPredictor.result} isOpen={showAgentLoadPredictor} loading={agentLoadPredictor.loading} onClose={() => { agentLoadPredictor.setResult(null); setShowAgentLoadPredictor(false); }} />
      )}

      {showAgentVelocityForecast && (
        <AgentVelocityForecastModal result={agentVelocityForecast.result} isOpen={showAgentVelocityForecast} loading={agentVelocityForecast.loading} onClose={() => { agentVelocityForecast.setResult(null); setShowAgentVelocityForecast(false); }} />
      )}

      {showAgentSprintCommitment && (
        <AgentSprintCommitmentModal result={agentSprintCommitment.result} isOpen={showAgentSprintCommitment} loading={agentSprintCommitment.loading} onClose={() => { agentSprintCommitment.setResult(null); setShowAgentSprintCommitment(false); }} />
      )}

      {showCollaborationNetwork && (
        <AgentCollaborationNetworkModal result={collaborationNetwork.result} isOpen={showCollaborationNetwork} loading={collaborationNetwork.loading} onClose={() => { collaborationNetwork.setResult(null); setShowCollaborationNetwork(false); }} />
      )}

      {showContextRetention && (
        <AgentContextRetentionModal projectId={projectId!} onClose={() => { setShowContextRetention(false); }} />
      )}

      {showAgentIdleTimeAnalyzer && (
        <AgentIdleTimeAnalyzerModal projectId={projectId!} onClose={() => { setShowAgentIdleTimeAnalyzer(false); }} />
      )}

      {showAgentResponseTimeEfficiency && (
        <AgentResponseTimeEfficiencyModal projectId={projectId!} onClose={() => { setShowAgentResponseTimeEfficiency(false); }} />
      )}

      {showAgentErrorRecoveryRate && (
        <AgentErrorRecoveryRateModal projectId={projectId!} onClose={() => { setShowAgentErrorRecoveryRate(false); }} />
      )}

      {showAgentWorkloadBalance && (
        <AgentWorkloadBalanceModal projectId={projectId!} onClose={() => { setShowAgentWorkloadBalance(false); }} />
      )}

      {showAgentDeadlineAdherenceAnalyzer && (
        <AgentDeadlineAdherenceAnalyzerModal projectId={projectId!} onClose={() => { setShowAgentDeadlineAdherenceAnalyzer(false); }} />
      )}

      {showAgentTokenCostEfficiency && (
        <AgentTokenCostEfficiencyModal projectId={projectId!} result={agentTokenCostEfficiency.result} loading={agentTokenCostEfficiency.loading} onClose={() => { agentTokenCostEfficiency.setResult(null); setShowAgentTokenCostEfficiency(false); }} />
      )}

      {showAgentSkillCoverage && (
        <AgentSkillCoverageModal projectId={projectId!} result={agentSkillCoverage.result} loading={agentSkillCoverage.loading} onClose={() => { agentSkillCoverage.setResult(null); setShowAgentSkillCoverage(false); }} />
      )}

      {showAgentLearningCurveAnalyzer && (
        <AgentLearningCurveAnalyzerModal projectId={projectId!} result={agentLearningCurveAnalyzer.result} loading={agentLearningCurveAnalyzer.loading} onClose={() => { agentLearningCurveAnalyzer.setResult(null); setShowAgentLearningCurveAnalyzer(false); }} />
      )}

      {showAgentCollaborationNetworkAnalyzer && (
        <AgentCollaborationNetworkAnalyzerModal projectId={projectId!} result={agentCollaborationNetworkAnalyzer.result} loading={agentCollaborationNetworkAnalyzer.loading} onClose={() => { agentCollaborationNetworkAnalyzer.setResult(null); setShowAgentCollaborationNetworkAnalyzer(false); }} />
      )}

      {showAgentPeakPerformance && (
        <AgentPeakPerformanceModal projectId={projectId!} result={agentPeakPerformance.result} loading={agentPeakPerformance.loading} onClose={() => { agentPeakPerformance.setResult(null); setShowAgentPeakPerformance(false); }} />
      )}

      {showAgentContextSwitchCost && (
        <AgentContextSwitchCostModal projectId={projectId!} result={agentContextSwitchCost.result} loading={agentContextSwitchCost.loading} onClose={() => { agentContextSwitchCost.setResult(null); setShowAgentContextSwitchCost(false); }} />
      )}

      {showAgentBurnoutRisk && (
        <AgentBurnoutRiskModal projectId={projectId!} result={agentBurnoutRisk.result} loading={agentBurnoutRisk.loading} onClose={() => { agentBurnoutRisk.setResult(null); setShowAgentBurnoutRisk(false); }} />
      )}

      {showAgentHandoffSuccessRate && (
        <AgentHandoffSuccessRateModal projectId={projectId!} result={agentHandoffSuccessRate.result} loading={agentHandoffSuccessRate.loading} onClose={() => { agentHandoffSuccessRate.setResult(null); setShowAgentHandoffSuccessRate(false); }} />
      )}

      {showAgentTaskCompletionVelocity && (
        <AgentTaskCompletionVelocityModal projectId={projectId!} result={agentTaskCompletionVelocity.result} loading={agentTaskCompletionVelocity.loading} onClose={() => { agentTaskCompletionVelocity.setResult(null); setShowAgentTaskCompletionVelocity(false); }} />
      )}

      {showAgentInterruptionFrequency && (
        <AgentInterruptionFrequencyModal projectId={projectId!} result={agentInterruptionFrequency.result} loading={agentInterruptionFrequency.loading} onClose={() => { agentInterruptionFrequency.setResult(null); setShowAgentInterruptionFrequency(false); }} />
      )}

      {showAgentSessionDurationAnalyzer && (
        <AgentSessionDurationAnalyzerModal result={agentSessionDurationAnalyzer.result} loading={agentSessionDurationAnalyzer.loading} onClose={() => { agentSessionDurationAnalyzer.setResult(null); setShowAgentSessionDurationAnalyzer(false); }} />
      )}

      {showAgentFailurePatterns && (
        <AgentFailurePatternModal result={agentFailurePatterns.result} loading={agentFailurePatterns.loading} onClose={() => { agentFailurePatterns.setResult(null); setShowAgentFailurePatterns(false); }} />
      )}

      {showAgentQueueDepthAnalyzer && (
        <AgentQueueDepthAnalyzerModal result={agentQueueDepthAnalyzer.result} loading={agentQueueDepthAnalyzer.loading} onClose={() => { agentQueueDepthAnalyzer.setResult(null); setShowAgentQueueDepthAnalyzer(false); }} />
      )}

      {showAgentRetryRate && (
        <AgentRetryRateModal result={agentRetryRate.result} loading={agentRetryRate.loading} onClose={() => { agentRetryRate.setResult(null); setShowAgentRetryRate(false); }} />
      )}

      {showAgentAvailability && (
        <AgentAvailabilityModal result={agentAvailability.result} loading={agentAvailability.loading} onClose={() => { agentAvailability.setResult(null); setShowAgentAvailability(false); }} />
      )}

      {showAgentSpecializationIndex && (
        <AgentSpecializationIndexModal result={agentSpecializationIndex.result} loading={agentSpecializationIndex.loading} onClose={() => { agentSpecializationIndex.setResult(null); setShowAgentSpecializationIndex(false); }} />
      )}

      {showAgentResponseLag && (
        <AgentResponseLagModal result={agentResponseLag.result} loading={agentResponseLag.loading} onClose={() => { agentResponseLag.setResult(null); setShowAgentResponseLag(false); }} />
      )}

      {showAgentCapacityUtilization && (
        <AgentCapacityUtilizationModal result={agentCapacityUtilization.result} loading={agentCapacityUtilization.loading} onClose={() => { agentCapacityUtilization.setResult(null); setShowAgentCapacityUtilization(false); }} />
      )}

      {showAgentThroughputVariability && (
        <AgentThroughputVariabilityModal result={agentThroughputVariability.result} loading={agentThroughputVariability.loading} onClose={() => { agentThroughputVariability.setResult(null); setShowAgentThroughputVariability(false); }} />
      )}

      {showAgentCostPerOutcome && (
        <AgentCostPerOutcomeModal result={agentCostPerOutcome.result} loading={agentCostPerOutcome.loading} onClose={() => { agentCostPerOutcome.setResult(null); setShowAgentCostPerOutcome(false); }} />
      )}

      {showAgentWorkloadSaturation && (
        <AgentWorkloadSaturationModal result={agentWorkloadSaturation.result} loading={agentWorkloadSaturation.loading} onClose={() => { agentWorkloadSaturation.setResult(null); setShowAgentWorkloadSaturation(false); }} />
      )}

      {showAgentRecoveryTime && (
        <AgentRecoveryTimeModal result={agentRecoveryTime.result} loading={agentRecoveryTime.loading} onClose={() => { agentRecoveryTime.setResult(null); setShowAgentRecoveryTime(false); }} />
      )}

      {showAgentEscalationRate && (
        <AgentEscalationRateModal result={agentEscalationRate.result} loading={agentEscalationRate.loading} onClose={() => { agentEscalationRate.setResult(null); setShowAgentEscalationRate(false); }} />
      )}

      {showAgentKnowledgeGapAnalyzer && (
        <AgentKnowledgeGapAnalyzerModal result={agentKnowledgeGapAnalyzer.result} loading={agentKnowledgeGapAnalyzer.loading} onClose={() => { agentKnowledgeGapAnalyzer.setResult(null); setShowAgentKnowledgeGapAnalyzer(false); }} />
      )}

      {showAgentIdleTimeTracker && (
        <AgentIdleTimeTrackerModal result={agentIdleTimeTracker.result} loading={agentIdleTimeTracker.loading} onClose={() => { agentIdleTimeTracker.setResult(null); setShowAgentIdleTimeTracker(false); }} />
      )}

      {showAgentParallelTaskEfficiencyTracker && (
        <AgentParallelTaskEfficiencyTrackerModal result={agentParallelTaskEfficiencyTracker.result} loading={agentParallelTaskEfficiencyTracker.loading} onClose={() => { agentParallelTaskEfficiencyTracker.setResult(null); setShowAgentParallelTaskEfficiencyTracker(false); }} />
      )}

      {showAgentContextRetentionAnalyzer && (
        <AgentContextRetentionAnalyzerModal result={agentContextRetentionAnalyzer.result} loading={agentContextRetentionAnalyzer.loading} onClose={() => { agentContextRetentionAnalyzer.setResult(null); setShowAgentContextRetentionAnalyzer(false); }} />
      )}

      {showAgentGoalDriftAnalyzer && (
        <AgentGoalDriftAnalyzerModal result={agentGoalDriftAnalyzer.result} loading={agentGoalDriftAnalyzer.loading} onClose={() => { agentGoalDriftAnalyzer.setResult(null); setShowAgentGoalDriftAnalyzer(false); }} />
      )}

      {showAgentDecisionLatencyAnalyzer && (
        <AgentDecisionLatencyAnalyzerModal result={agentDecisionLatencyAnalyzer.result} loading={agentDecisionLatencyAnalyzer.loading} onClose={() => { agentDecisionLatencyAnalyzer.setResult(null); setShowAgentDecisionLatencyAnalyzer(false); }} />
      )}

      {showAgentOutputQualityConsistency && (
        <AgentOutputQualityConsistencyModal result={agentOutputQualityConsistency.result} loading={agentOutputQualityConsistency.loading} onClose={() => { agentOutputQualityConsistency.setResult(null); setShowAgentOutputQualityConsistency(false); }} />
      )}

      {showAgentCollaborationEfficiencyAnalyzer && (
        <AgentCollaborationEfficiencyAnalyzerModal result={agentCollaborationEfficiencyAnalyzer.result} loading={agentCollaborationEfficiencyAnalyzer.loading} onClose={() => { agentCollaborationEfficiencyAnalyzer.setResult(null); setShowAgentCollaborationEfficiencyAnalyzer(false); }} />
      )}

      {showAgentInstructionAdherenceAnalyzer && (
        <AgentInstructionAdherenceAnalyzerModal result={agentInstructionAdherenceAnalyzer.result} loading={agentInstructionAdherenceAnalyzer.loading} onClose={() => { agentInstructionAdherenceAnalyzer.setResult(null); setShowAgentInstructionAdherenceAnalyzer(false); }} />
      )}

      {showAgentCommunicationQualityAnalyzer && (
        <AgentCommunicationQualityAnalyzerModal result={agentCommunicationQualityAnalyzer.result} loading={agentCommunicationQualityAnalyzer.loading} onClose={() => { agentCommunicationQualityAnalyzer.setResult(null); setShowAgentCommunicationQualityAnalyzer(false); }} />
      )}

      {showAgentAdaptationSpeedAnalyzer && (
        <AgentAdaptationSpeedAnalyzerModal result={agentAdaptationSpeedAnalyzer.result} loading={agentAdaptationSpeedAnalyzer.loading} onClose={() => { agentAdaptationSpeedAnalyzer.setResult(null); setShowAgentAdaptationSpeedAnalyzer(false); }} />
      )}

      {showAgentSelfCorrectionRateAnalyzer && (
        <AgentSelfCorrectionRateAnalyzerModal result={agentSelfCorrectionRateAnalyzer.result} loading={agentSelfCorrectionRateAnalyzer.loading} onClose={() => { agentSelfCorrectionRateAnalyzer.setResult(null); setShowAgentSelfCorrectionRateAnalyzer(false); }} />
      )}

      {showAgentConfidenceCalibrationAnalyzer && (
        <AgentConfidenceCalibrationAnalyzerModal result={agentConfidenceCalibrationAnalyzer.result} loading={agentConfidenceCalibrationAnalyzer.loading} onClose={() => { agentConfidenceCalibrationAnalyzer.setResult(null); setShowAgentConfidenceCalibrationAnalyzer(false); }} />
      )}

      {showAgentTaskPrioritizationAccuracyAnalyzer && (
        <AgentTaskPrioritizationAccuracyAnalyzerModal result={agentTaskPrioritizationAccuracyAnalyzer.result} loading={agentTaskPrioritizationAccuracyAnalyzer.loading} onClose={() => { agentTaskPrioritizationAccuracyAnalyzer.setResult(null); setShowAgentTaskPrioritizationAccuracyAnalyzer(false); }} />
      )}

      {showAgentToolSelectionAccuracyAnalyzer && (
        <AgentToolSelectionAccuracyAnalyzerModal result={agentToolSelectionAccuracyAnalyzer.result} loading={agentToolSelectionAccuracyAnalyzer.loading} onClose={() => { agentToolSelectionAccuracyAnalyzer.setResult(null); setShowAgentToolSelectionAccuracyAnalyzer(false); }} />
      )}

      {showAgentWorkflowCoverageAnalyzer && (
        <AgentWorkflowCoverageAnalyzerModal result={agentWorkflowCoverageAnalyzer.result} loading={agentWorkflowCoverageAnalyzer.loading} onClose={() => { agentWorkflowCoverageAnalyzer.setResult(null); setShowAgentWorkflowCoverageAnalyzer(false); }} />
      )}

      {showAgentDependencyRiskAnalyzer && (
        <AgentDependencyRiskAnalyzerModal result={agentDependencyRiskAnalyzer.result} loading={agentDependencyRiskAnalyzer.loading} onClose={() => { agentDependencyRiskAnalyzer.setResult(null); setShowAgentDependencyRiskAnalyzer(false); }} />
      )}

      {showAgentMultiAgentSyncEfficiency && (
        <AgentMultiAgentSyncEfficiencyModal result={agentMultiAgentSyncEfficiency.result} loading={agentMultiAgentSyncEfficiency.loading} onClose={() => { agentMultiAgentSyncEfficiency.setResult(null); setShowAgentMultiAgentSyncEfficiency(false); }} />
      )}

      {showAgentOutputAccuracyRate && (
        <AgentOutputAccuracyRateModal result={agentOutputAccuracyRate.result} loading={agentOutputAccuracyRate.loading} onClose={() => { agentOutputAccuracyRate.setResult(null); setShowAgentOutputAccuracyRate(false); }} />
      )}

      {showAgentGoalCompletionRateAnalyzer && (
        <AgentGoalCompletionRateAnalyzerModal result={agentGoalCompletionRateAnalyzer.result} loading={agentGoalCompletionRateAnalyzer.loading} onClose={() => { agentGoalCompletionRateAnalyzer.setResult(null); setShowAgentGoalCompletionRateAnalyzer(false); }} />
      )}

      {showAgentPromptEfficiencyAnalyzer && (
        <AgentPromptEfficiencyAnalyzerModal result={agentPromptEfficiencyAnalyzer.result} loading={agentPromptEfficiencyAnalyzer.loading} onClose={() => { agentPromptEfficiencyAnalyzer.setResult(null); setShowAgentPromptEfficiencyAnalyzer(false); }} />
      )}

      {showAgentLearningRateAnalyzer && (
        <AgentLearningRateAnalyzerModal result={agentLearningRateAnalyzer.result} loading={agentLearningRateAnalyzer.loading} onClose={() => { agentLearningRateAnalyzer.setResult(null); setShowAgentLearningRateAnalyzer(false); }} />
      )}

      {showAgentErrorRecoverySpeedAnalyzer && (
        <AgentErrorRecoverySpeedAnalyzerModal result={agentErrorRecoverySpeedAnalyzer.result} loading={agentErrorRecoverySpeedAnalyzer.loading} onClose={() => { agentErrorRecoverySpeedAnalyzer.setResult(null); setShowAgentErrorRecoverySpeedAnalyzer(false); }} />
      )}

      {showAgentAutonomyLevelAnalyzer && (
        <AgentAutonomyLevelAnalyzerModal result={agentAutonomyLevelAnalyzer.result} loading={agentAutonomyLevelAnalyzer.loading} onClose={() => { agentAutonomyLevelAnalyzer.setResult(null); setShowAgentAutonomyLevelAnalyzer(false); }} />
      )}

      {showAgentResourceEfficiencyAnalyzer && (
        <AgentResourceEfficiencyAnalyzerModal result={agentResourceEfficiencyAnalyzer.result} loading={agentResourceEfficiencyAnalyzer.loading} onClose={() => { agentResourceEfficiencyAnalyzer.setResult(null); setShowAgentResourceEfficiencyAnalyzer(false); }} />
      )}

      {showAgentMultiTurnConsistencyAnalyzer && (
        <AgentMultiTurnConsistencyAnalyzerModal result={agentMultiTurnConsistencyAnalyzer.result} loading={agentMultiTurnConsistencyAnalyzer.loading} onClose={() => { agentMultiTurnConsistencyAnalyzer.setResult(null); setShowAgentMultiTurnConsistencyAnalyzer(false); }} />
      )}

      {showAgentPromptSensitivityAnalyzer && (
        <AgentPromptSensitivityAnalyzerModal result={agentPromptSensitivityAnalyzer.result} loading={agentPromptSensitivityAnalyzer.loading} onClose={() => { agentPromptSensitivityAnalyzer.setResult(null); setShowAgentPromptSensitivityAnalyzer(false); }} />
      )}

      {showAgentDecisionConfidenceAnalyzer && (
        <AgentDecisionConfidenceAnalyzerModal result={agentDecisionConfidenceAnalyzer.result} loading={agentDecisionConfidenceAnalyzer.loading} onClose={() => { agentDecisionConfidenceAnalyzer.setResult(null); setShowAgentDecisionConfidenceAnalyzer(false); }} />
      )}

      {showAgentKnowledgeTransferEfficiencyAnalyzer && (
        <AgentKnowledgeTransferEfficiencyAnalyzerModal result={agentKnowledgeTransferEfficiencyAnalyzer.result} loading={agentKnowledgeTransferEfficiencyAnalyzer.loading} onClose={() => { agentKnowledgeTransferEfficiencyAnalyzer.setResult(null); setShowAgentKnowledgeTransferEfficiencyAnalyzer(false); }} />
      )}

      {showAgentInstructionComplexityAnalyzer && (
        <AgentInstructionComplexityAnalyzerModal result={agentInstructionComplexityAnalyzer.result} loading={agentInstructionComplexityAnalyzer.loading} onClose={() => { agentInstructionComplexityAnalyzer.setResult(null); setShowAgentInstructionComplexityAnalyzer(false); }} />
      )}

      {showAgentContextWindowUtilizationAnalyzer && (
        <AgentContextWindowUtilizationAnalyzerModal result={agentContextWindowUtilizationAnalyzer.result} loading={agentContextWindowUtilizationAnalyzer.loading} onClose={() => { agentContextWindowUtilizationAnalyzer.setResult(null); setShowAgentContextWindowUtilizationAnalyzer(false); }} />
      )}

      {showAgentCognitiveLoadEstimator && (
        <AgentCognitiveLoadEstimatorModal result={agentCognitiveLoadEstimator.result} loading={agentCognitiveLoadEstimator.loading} onClose={() => { agentCognitiveLoadEstimator.setResult(null); setShowAgentCognitiveLoadEstimator(false); }} />
      )}

      {showAgentGoalAlignmentScore && (
        <AgentGoalAlignmentScoreModal result={agentGoalAlignmentScore.result} loading={agentGoalAlignmentScore.loading} onClose={() => { agentGoalAlignmentScore.setResult(null); setShowAgentGoalAlignmentScore(false); }} />
      )}

      {showAgentTrustScoreAnalyzer && (
        <AgentTrustScoreAnalyzerModal result={trustScoreResult} loading={loadingTrustScore} onClose={() => { setTrustScoreResult(null); setShowAgentTrustScoreAnalyzer(false); }} />
      )}

      {showAgentWorkflowBottleneckAnalyzer && (
        <AgentWorkflowBottleneckAnalyzerModal result={workflowBottleneckResult} loading={loadingWorkflowBottleneck} onClose={() => { setWorkflowBottleneckResult(null); setShowAgentWorkflowBottleneckAnalyzer(false); }} />
      )}

      {showAgentFeedbackIntegrationSpeedAnalyzer && (
        <AgentFeedbackIntegrationSpeedAnalyzerModal result={feedbackIntegrationSpeedResult} loading={loadingFeedbackIntegrationSpeed} onClose={() => { setFeedbackIntegrationSpeedResult(null); setShowAgentFeedbackIntegrationSpeedAnalyzer(false); }} />
      )}

      {showAgentScopeCreepDetector && (
        <AgentScopeCreepDetectorModal result={scopeCreepDetectorResult} loading={loadingScopeCreepDetector} onClose={() => { setScopeCreepDetectorResult(null); setShowAgentScopeCreepDetector(false); }} />
      )}

      {showAgentAttentionSpanAnalyzer && (
        <AgentAttentionSpanAnalyzerModal result={attentionSpanResult} loading={loadingAttentionSpan} onClose={() => { setAttentionSpanResult(null); setShowAgentAttentionSpanAnalyzer(false); }} />
      )}

      {showAgentHallucinationRateAnalyzer && (
        <AgentHallucinationRateAnalyzerModal result={hallucinationRateResult} loading={loadingHallucinationRate} onClose={() => { setHallucinationRateResult(null); setShowAgentHallucinationRateAnalyzer(false); }} />
      )}
      {showAgentToolUsageEfficiencyAnalyzer && (
        <AgentToolUsageEfficiencyAnalyzerModal result={toolUsageEfficiencyResult} loading={loadingToolUsageEfficiency} onClose={() => { setToolUsageEfficiencyResult(null); setShowAgentToolUsageEfficiencyAnalyzer(false); }} />
      )}
      {showAgentInstructionParseAccuracyAnalyzer && (
        <AgentInstructionParseAccuracyAnalyzerModal result={instructionParseAccuracyResult} loading={loadingInstructionParseAccuracy} onClose={() => { setInstructionParseAccuracyResult(null); setShowAgentInstructionParseAccuracyAnalyzer(false); }} />
      )}
      {showAgentResponseCoherenceAnalyzer && (
        <AgentResponseCoherenceAnalyzerModal result={agentResponseCoherenceAnalyzer.result} loading={agentResponseCoherenceAnalyzer.loading} onClose={() => { agentResponseCoherenceAnalyzer.setResult(null); setShowAgentResponseCoherenceAnalyzer(false); }} />
      )}
      {showAgentSemanticDriftAnalyzer && (
        <AgentSemanticDriftAnalyzerModal result={agentSemanticDriftAnalyzer.result} loading={agentSemanticDriftAnalyzer.loading} onClose={() => { agentSemanticDriftAnalyzer.setResult(null); setShowAgentSemanticDriftAnalyzer(false); }} />
      )}

      {showAgentBiasDetectionRateAnalyzer && (
        <AgentBiasDetectionRateAnalyzerModal result={agentBiasDetectionRateAnalyzer.result} loading={agentBiasDetectionRateAnalyzer.loading} onClose={() => { agentBiasDetectionRateAnalyzer.setResult(null); setShowAgentBiasDetectionRateAnalyzer(false); }} />
      )}

      {showAgentMemoryPersistenceAnalyzer && (
        <AgentMemoryPersistenceAnalyzerModal result={agentMemoryPersistenceAnalyzer.result} loading={agentMemoryPersistenceAnalyzer.loading} onClose={() => { agentMemoryPersistenceAnalyzer.setResult(null); setShowAgentMemoryPersistenceAnalyzer(false); }} />
      )}
      {showAgentReasoningChainDepthAnalyzer && (
        <AgentReasoningChainDepthAnalyzerModal result={agentReasoningChainDepthAnalyzer.result} loading={agentReasoningChainDepthAnalyzer.loading} onClose={() => { agentReasoningChainDepthAnalyzer.setResult(null); setShowAgentReasoningChainDepthAnalyzer(false); }} />
      )}
      {showAgentErrorPropagationAnalyzer && (
        <AgentErrorPropagationAnalyzerModal result={agentErrorPropagationAnalyzer.result} loading={agentErrorPropagationAnalyzer.loading} onClose={() => { agentErrorPropagationAnalyzer.setResult(null); setShowAgentErrorPropagationAnalyzer(false); }} />
      )}
      {showAgentAbstractionLevelAnalyzer && (
        <AgentAbstractionLevelAnalyzerModal result={agentAbstractionLevelAnalyzer.result} loading={agentAbstractionLevelAnalyzer.loading} onClose={() => { agentAbstractionLevelAnalyzer.setResult(null); setShowAgentAbstractionLevelAnalyzer(false); }} />
      )}
      {showAgentTemporalConsistencyAnalyzer && (
        <AgentTemporalConsistencyAnalyzerModal result={agentTemporalConsistencyAnalyzer.result} loading={agentTemporalConsistencyAnalyzer.loading} onClose={() => { agentTemporalConsistencyAnalyzer.setResult(null); setShowAgentTemporalConsistencyAnalyzer(false); }} />
      )}
      {showAgentOutputFormatComplianceAnalyzer && (
        <AgentOutputFormatComplianceAnalyzerModal result={agentOutputFormatComplianceAnalyzer.result} loading={agentOutputFormatComplianceAnalyzer.loading} onClose={() => { agentOutputFormatComplianceAnalyzer.setResult(null); setShowAgentOutputFormatComplianceAnalyzer(false); }} />
      )}
      {showAgentCapabilityBoundaryAwarenessAnalyzer && (
        <AgentCapabilityBoundaryAwarenessAnalyzerModal result={agentCapabilityBoundaryAwarenessAnalyzer.result} loading={agentCapabilityBoundaryAwarenessAnalyzer.loading} onClose={() => { agentCapabilityBoundaryAwarenessAnalyzer.setResult(null); setShowAgentCapabilityBoundaryAwarenessAnalyzer(false); }} />
      )}
      {showAgentProactiveInitiativeRateAnalyzer && (
        <AgentProactiveInitiativeRateAnalyzerModal result={agentProactiveInitiativeRateAnalyzer.result} loading={agentProactiveInitiativeRateAnalyzer.loading} onClose={() => { agentProactiveInitiativeRateAnalyzer.setResult(null); setShowAgentProactiveInitiativeRateAnalyzer(false); }} />
      )}
      {showAgentKnowledgeBoundaryMappingAnalyzer && (
        <AgentKnowledgeBoundaryMappingAnalyzerModal result={agentKnowledgeBoundaryMappingAnalyzer.result} loading={agentKnowledgeBoundaryMappingAnalyzer.loading} onClose={() => { agentKnowledgeBoundaryMappingAnalyzer.setResult(null); setShowAgentKnowledgeBoundaryMappingAnalyzer(false); }} />
      )}
      {showAgentCommunicationOverheadAnalyzer && (
        <AgentCommunicationOverheadAnalyzerModal result={agentCommunicationOverheadAnalyzer.result} loading={agentCommunicationOverheadAnalyzer.loading} onClose={() => { agentCommunicationOverheadAnalyzer.setResult(null); setShowAgentCommunicationOverheadAnalyzer(false); }} />
      )}
      {showAgentSpecializationDriftAnalyzer && (
        <AgentSpecializationDriftAnalyzerModal result={agentSpecializationDriftAnalyzerNew.result} loading={agentSpecializationDriftAnalyzerNew.loading} onClose={() => { agentSpecializationDriftAnalyzerNew.setResult(null); setShowAgentSpecializationDriftAnalyzer(false); }} />
      )}
      {showAgentCognitiveFlexibilityAnalyzer && (
        <AgentCognitiveFlexibilityAnalyzerModal result={agentCognitiveFlexibilityAnalyzer.result} loading={agentCognitiveFlexibilityAnalyzer.loading} onClose={() => { agentCognitiveFlexibilityAnalyzer.setResult(null); setShowAgentCognitiveFlexibilityAnalyzer(false); }} />
      )}
      {showAgentDelegationAccuracyAnalyzer && (
        <AgentDelegationAccuracyAnalyzerModal result={agentDelegationAccuracyAnalyzer.result} loading={agentDelegationAccuracyAnalyzer.loading} onClose={() => { agentDelegationAccuracyAnalyzer.setResult(null); setShowAgentDelegationAccuracyAnalyzer(false); }} />
      )}
      {showAgentInstructionClarityScoreAnalyzer && (
        <AgentInstructionClarityScoreAnalyzerModal result={agentInstructionClarityScoreAnalyzer.result} loading={agentInstructionClarityScoreAnalyzer.loading} onClose={() => { agentInstructionClarityScoreAnalyzer.setResult(null); setShowAgentInstructionClarityScoreAnalyzer(false); }} />
      )}
      {showAgentContextUtilizationEfficiencyAnalyzer && (
        <AgentContextUtilizationEfficiencyAnalyzerModal result={agentContextUtilizationEfficiencyAnalyzer.result} loading={agentContextUtilizationEfficiencyAnalyzer.loading} onClose={() => { agentContextUtilizationEfficiencyAnalyzer.setResult(null); setShowAgentContextUtilizationEfficiencyAnalyzer(false); }} />
      )}
      {showAgentMultiModalProcessingEfficiencyAnalyzer && (
        <AgentMultiModalProcessingEfficiencyAnalyzerModal result={agentMultiModalProcessingEfficiencyAnalyzer.result} loading={agentMultiModalProcessingEfficiencyAnalyzer.loading} onClose={() => { agentMultiModalProcessingEfficiencyAnalyzer.setResult(null); setShowAgentMultiModalProcessingEfficiencyAnalyzer(false); }} />
      )}
      {showAgentConstraintSatisfactionRateAnalyzer && (
        <AgentConstraintSatisfactionRateAnalyzerModal result={agentConstraintSatisfactionRateAnalyzer.result} loading={agentConstraintSatisfactionRateAnalyzer.loading} onClose={() => { agentConstraintSatisfactionRateAnalyzer.setResult(null); setShowAgentConstraintSatisfactionRateAnalyzer(false); }} />
      )}
      {showAgentOutputCompletenessAnalyzer && (
        <AgentOutputCompletenessAnalyzerModal result={agentOutputCompletenessAnalyzer.result} loading={agentOutputCompletenessAnalyzer.loading} onClose={() => { agentOutputCompletenessAnalyzer.setResult(null); setShowAgentOutputCompletenessAnalyzer(false); }} />
      )}
      {showAgentInstructionDisambiguationRateAnalyzer && (
        <AgentInstructionDisambiguationRateAnalyzerModal result={agentInstructionDisambiguationRateAnalyzer.result} loading={agentInstructionDisambiguationRateAnalyzer.loading} onClose={() => { agentInstructionDisambiguationRateAnalyzer.setResult(null); setShowAgentInstructionDisambiguationRateAnalyzer(false); }} />
      )}
      {showAgentParallelismEfficiencyAnalyzer && (
        <AgentParallelismEfficiencyAnalyzerModal result={agentParallelismEfficiencyAnalyzer.result} loading={agentParallelismEfficiencyAnalyzer.loading} onClose={() => { agentParallelismEfficiencyAnalyzer.setResult(null); setShowAgentParallelismEfficiencyAnalyzer(false); }} />
      )}
      {showAgentDecisionReversalRateAnalyzer && (
        <AgentDecisionReversalRateAnalyzerModal result={agentDecisionReversalRateAnalyzer.result} loading={agentDecisionReversalRateAnalyzer.loading} onClose={() => { agentDecisionReversalRateAnalyzer.setResult(null); setShowAgentDecisionReversalRateAnalyzer(false); }} />
      )}
      {showAgentPriorityAlignmentRateAnalyzer && (
        <AgentPriorityAlignmentRateAnalyzerModal result={agentPriorityAlignmentRateAnalyzer.result} loading={agentPriorityAlignmentRateAnalyzer.loading} onClose={() => { agentPriorityAlignmentRateAnalyzer.setResult(null); setShowAgentPriorityAlignmentRateAnalyzer(false); }} />
      )}
      {showAgentSessionWarmUpTimeAnalyzer && (
        <AgentSessionWarmUpTimeAnalyzerModal result={agentSessionWarmUpTimeAnalyzer.result} loading={agentSessionWarmUpTimeAnalyzer.loading} onClose={() => { agentSessionWarmUpTimeAnalyzer.setResult(null); setShowAgentSessionWarmUpTimeAnalyzer(false); }} />
      )}
      {showAgentInteractionRichnessAnalyzer && (
        <AgentInteractionRichnessAnalyzerModal result={agentInteractionRichnessAnalyzer.result} loading={agentInteractionRichnessAnalyzer.loading} onClose={() => { agentInteractionRichnessAnalyzer.setResult(null); setShowAgentInteractionRichnessAnalyzer(false); }} />
      )}
      {showAgentBoundaryViolationRateAnalyzer && (
        <AgentBoundaryViolationRateAnalyzerModal result={agentBoundaryViolationRateAnalyzer.result} loading={agentBoundaryViolationRateAnalyzer.loading} onClose={() => { agentBoundaryViolationRateAnalyzer.setResult(null); setShowAgentBoundaryViolationRateAnalyzer(false); }} />
      )}
      {showAgentSemanticConsistencyRateAnalyzer && (
        <AgentSemanticConsistencyRateAnalyzerModal result={agentSemanticConsistencyRateAnalyzer.result} loading={agentSemanticConsistencyRateAnalyzer.loading} onClose={() => { agentSemanticConsistencyRateAnalyzer.setResult(null); setShowAgentSemanticConsistencyRateAnalyzer(false); }} />
      )}
      {showAgentKnowledgeRecencyIndexAnalyzer && (
        <AgentKnowledgeRecencyIndexAnalyzerModal result={agentKnowledgeRecencyIndexAnalyzer.result} loading={agentKnowledgeRecencyIndexAnalyzer.loading} onClose={() => { agentKnowledgeRecencyIndexAnalyzer.setResult(null); setShowAgentKnowledgeRecencyIndexAnalyzer(false); }} />
      )}
      {showAgentTaskScopeExpansionRateAnalyzer && (
        <AgentTaskScopeExpansionRateAnalyzerModal result={agentTaskScopeExpansionRateAnalyzer.result} loading={agentTaskScopeExpansionRateAnalyzer.loading} onClose={() => { agentTaskScopeExpansionRateAnalyzer.setResult(null); setShowAgentTaskScopeExpansionRateAnalyzer(false); }} />
      )}
      {showAgentResponseLatencyAnalyzer && (
        <AgentResponseLatencyAnalyzerModal result={agentResponseLatencyAnalyzer.result} loading={agentResponseLatencyAnalyzer.loading} onClose={() => { agentResponseLatencyAnalyzer.setResult(null); setShowAgentResponseLatencyAnalyzer(false); }} />
      )}
      {showAgentOutputVerbosityAnalyzer && (
        <AgentOutputVerbosityAnalyzerModal result={agentOutputVerbosityAnalyzer.result} loading={agentOutputVerbosityAnalyzer.loading} onClose={() => { agentOutputVerbosityAnalyzer.setResult(null); setShowAgentOutputVerbosityAnalyzer(false); }} />
      )}
      {showAgentFocusRetentionAnalyzer && (
        <AgentFocusRetentionAnalyzerModal result={agentFocusRetentionAnalyzer.result} loading={agentFocusRetentionAnalyzer.loading} onClose={() => { agentFocusRetentionAnalyzer.setResult(null); setShowAgentFocusRetentionAnalyzer(false); }} />
      )}
      {showAgentInstructionRedundancyAnalyzer && (
        <AgentInstructionRedundancyAnalyzerModal
          result={instructionRedundancyResult}
          loading={instructionRedundancyLoading}
          onClose={() => { setShowAgentInstructionRedundancyAnalyzer(false); setInstructionRedundancyResult(null); }}
        />
      )}
      {showAgentGoalDriftRateAnalyzer && (
        <AgentGoalDriftRateAnalyzerModal
          result={goalDriftRateResult}
          loading={goalDriftRateLoading}
          onClose={() => { setShowAgentGoalDriftRateAnalyzer(false); setGoalDriftRateResult(null); }}
        />
      )}
      {showAgentHypothesisTestingRateAnalyzer && (
        <AgentHypothesisTestingRateAnalyzerModal
          result={hypothesisTestingRateResult}
          loading={hypothesisTestingRateLoading}
          onClose={() => { setShowAgentHypothesisTestingRateAnalyzer(false); setHypothesisTestingRateResult(null); }}
        />
      )}
      {showAgentCrossDomainTransferAnalyzer && (
        <AgentCrossDomainTransferAnalyzerModal
          result={crossDomainTransferResult}
          loading={crossDomainTransferLoading}
          onClose={() => { setShowAgentCrossDomainTransferAnalyzer(false); setCrossDomainTransferResult(null); }}
        />
      )}
      {showAgentInstructionFollowingFidelityAnalyzer && (
        <AgentInstructionFollowingFidelityAnalyzerModal
          result={instructionFollowingFidelityResult}
          loading={instructionFollowingFidelityLoading}
          onClose={() => { setShowAgentInstructionFollowingFidelityAnalyzer(false); setInstructionFollowingFidelityResult(null); }}
        />
      )}
      {showAgentAdaptiveLearningRateAnalyzer && (
        <AgentAdaptiveLearningRateAnalyzerModal
          result={adaptiveLearningRateResult}
          loading={adaptiveLearningRateLoading}
          onClose={() => { setShowAgentAdaptiveLearningRateAnalyzer(false); setAdaptiveLearningRateResult(null); }}
        />
      )}
      {showAgentCollaborationBottleneckAnalyzer && (
        <AgentCollaborationBottleneckAnalyzerModal
          result={collaborationBottleneckResult}
          loading={collaborationBottleneckLoading}
          onClose={() => { setShowAgentCollaborationBottleneckAnalyzer(false); setCollaborationBottleneckResult(null); }}
        />
      )}
      {showAgentContextSwitchingCostAnalyzer && (
        <AgentContextSwitchingCostAnalyzerModal
          result={contextSwitchingCostResult}
          loading={contextSwitchingCostLoading}
          onClose={() => { setShowAgentContextSwitchingCostAnalyzer(false); setContextSwitchingCostResult(null); }}
        />
      )}
      {showAgentCalibrationScoreAnalyzer && (
        <AgentCalibrationScoreAnalyzerModal
          result={calibrationScoreResult}
          loading={calibrationScoreLoading}
          onClose={() => { setShowAgentCalibrationScoreAnalyzer(false); setCalibrationScoreResult(null); }}
        />
      )}
      {showAgentRecoveryTimeAnalyzer && (
        <AgentRecoveryTimeAnalyzerModal
          result={recoveryTimeAnalyzerResult}
          loading={recoveryTimeAnalyzerLoading}
          onClose={() => { setShowAgentRecoveryTimeAnalyzer(false); setRecoveryTimeAnalyzerResult(null); }}
        />
      )}
      {showAgentInterruptionHandlingEfficiencyAnalyzer && (
        <AgentInterruptionHandlingEfficiencyAnalyzerModal
          result={interruptionHandlingEfficiencyResult}
          loading={interruptionHandlingEfficiencyLoading}
          onClose={() => { setShowAgentInterruptionHandlingEfficiencyAnalyzer(false); setInterruptionHandlingEfficiencyResult(null); }}
        />
      )}
      {showAgentNarrativeCoherenceAnalyzer && (
        <AgentNarrativeCoherenceAnalyzerModal
          result={narrativeCoherenceResult}
          loading={narrativeCoherenceLoading}
          onClose={() => { setShowAgentNarrativeCoherenceAnalyzer(false); setNarrativeCoherenceResult(null); }}
        />
      )}

      {showAgentFocusAdvisor && (
        <AgentFocusAdvisorModal result={agentFocusAdvisor.result} isOpen={showAgentFocusAdvisor} loading={agentFocusAdvisor.loading} onClose={() => { agentFocusAdvisor.setResult(null); setShowAgentFocusAdvisor(false); }} />
      )}

      {showAgentResponseTime && (
        <AgentResponseTimeModal result={agentResponseTime.result} isOpen={showAgentResponseTime} loading={agentResponseTime.loading} onClose={() => { agentResponseTime.setResult(null); setShowAgentResponseTime(false); }} />
      )}

      {showPriorityAlignment && (
        <AgentPriorityAlignmentModal result={agentPriorityAlignment.result} isOpen={showPriorityAlignment} loading={agentPriorityAlignment.loading} onClose={() => { agentPriorityAlignment.setResult(null); setShowPriorityAlignment(false); }} />
      )}

      {showStallDetector && (
        <AgentStallDetectorModal result={agentStallDetector.result} isOpen={showStallDetector} loading={agentStallDetector.loading} onClose={() => { agentStallDetector.setResult(null); setShowStallDetector(false); }} />
      )}

      {showSpecializationMapper && (
        <AgentSpecializationMapperModal result={agentSpecializationMapper.result} isOpen={showSpecializationMapper} loading={agentSpecializationMapper.loading} onClose={() => { agentSpecializationMapper.setResult(null); setShowSpecializationMapper(false); }} />
      )}

      {showBottleneckAnalyzer && (
        <AgentBottleneckAnalyzerModal result={agentBottleneckAnalyzer.result} isOpen={showBottleneckAnalyzer} loading={agentBottleneckAnalyzer.loading} onClose={() => { agentBottleneckAnalyzer.setResult(null); setShowBottleneckAnalyzer(false); }} />
      )}

      {showAgentQueueDepth && (
        <AgentQueueDepthModal result={agentQueueDepth.result} isOpen={showAgentQueueDepth} loading={agentQueueDepth.loading} onClose={() => { agentQueueDepth.setResult(null); setShowAgentQueueDepth(false); }} />
      )}

      {showAgentSkillGap && (
        <AgentSkillGapModal result={agentSkillGap.result} isOpen={showAgentSkillGap} loading={agentSkillGap.loading} onClose={() => { agentSkillGap.setResult(null); setShowAgentSkillGap(false); }} />
      )}

      {showAgentConflictDetector && (
        <AgentConflictDetectorModal result={agentConflictDetector.result} isOpen={showAgentConflictDetector} loading={agentConflictDetector.loading} onClose={() => { agentConflictDetector.setResult(null); setShowAgentConflictDetector(false); }} />
      )}

      {showAgentDecisionQuality && (
        <AgentDecisionQualityModal result={agentDecisionQuality.result} isOpen={showAgentDecisionQuality} loading={agentDecisionQuality.loading} onClose={() => { agentDecisionQuality.setResult(null); setShowAgentDecisionQuality(false); }} />
      )}

      {showAgentPerformanceTrend && (
        <AgentPerformanceTrendModal result={agentPerformanceTrend.result} isOpen={showAgentPerformanceTrend} loading={agentPerformanceTrend.loading} onClose={() => { agentPerformanceTrend.setResult(null); setShowAgentPerformanceTrend(false); }} />
      )}

      {showAgentCoverageGap && (
        <AgentCoverageGapModal result={agentCoverageGap.result} isOpen={showAgentCoverageGap} loading={agentCoverageGap.loading} onClose={() => { agentCoverageGap.setResult(null); setShowAgentCoverageGap(false); }} />
      )}

      {showAgentDependencyMapper && (
        <AgentDependencyMapperModal result={agentDependencyMapper.result} isOpen={showAgentDependencyMapper} loading={agentDependencyMapper.loading} onClose={() => { agentDependencyMapper.setResult(null); setShowAgentDependencyMapper(false); }} />
      )}

      {showAgentContextUtilization && (
        <AgentContextUtilizationModal result={agentContextUtilization.result} isOpen={showAgentContextUtilization} loading={agentContextUtilization.loading} onClose={() => { agentContextUtilization.setResult(null); setShowAgentContextUtilization(false); }} />
      )}

      {showAgentHandoffSuccess && (
        <AgentHandoffSuccessModal result={agentHandoffSuccess.result} isOpen={showAgentHandoffSuccess} loading={agentHandoffSuccess.loading} onClose={() => { agentHandoffSuccess.setResult(null); setShowAgentHandoffSuccess(false); }} />
      )}

      {showAgentIdleTime && (
        <AgentIdleTimeModal result={agentIdleTime.result} isOpen={showAgentIdleTime} loading={agentIdleTime.loading} onClose={() => { agentIdleTime.setResult(null); setShowAgentIdleTime(false); }} />
      )}

      {showAgentThroughputEfficiency && (
        <AgentThroughputEfficiencyModal result={agentThroughputEfficiency.result} isOpen={showAgentThroughputEfficiency} loading={agentThroughputEfficiency.loading} onClose={() => { agentThroughputEfficiency.setResult(null); setShowAgentThroughputEfficiency(false); }} />
      )}

      {showAgentWorkloadFairness && (
        <AgentWorkloadFairnessModal result={agentWorkloadFairness.result} isOpen={showAgentWorkloadFairness} loading={agentWorkloadFairness.loading} onClose={() => { agentWorkloadFairness.setResult(null); setShowAgentWorkloadFairness(false); }} />
      )}

      {showAgentErrorRates && (
        <AgentErrorRateModal result={agentErrorRates.result} isOpen={showAgentErrorRates} loading={agentErrorRates.loading} onClose={() => { agentErrorRates.setResult(null); setShowAgentErrorRates(false); }} />
      )}

      {showAgentEscalationPatterns && (
        <AgentEscalationPatternModal result={agentEscalationPatterns.result} isOpen={showAgentEscalationPatterns} loading={agentEscalationPatterns.loading} onClose={() => { agentEscalationPatterns.setResult(null); setShowAgentEscalationPatterns(false); }} />
      )}

      {showAgentGoalAlignment && (
        <AgentGoalAlignmentModal result={agentGoalAlignment.result} isOpen={showAgentGoalAlignment} loading={agentGoalAlignment.loading} onClose={() => { agentGoalAlignment.setResult(null); setShowAgentGoalAlignment(false); }} />
      )}

      {showAgentRecoveryPatterns && (
        <AgentRecoveryPatternModal result={agentRecoveryPatterns.result} isOpen={showAgentRecoveryPatterns} loading={agentRecoveryPatterns.loading} onClose={() => { agentRecoveryPatterns.setResult(null); setShowAgentRecoveryPatterns(false); }} />
      )}

      {showAgentTaskVelocity && (
        <AgentTaskVelocityModal result={agentTaskVelocity.result} isOpen={showAgentTaskVelocity} loading={agentTaskVelocity.loading} onClose={() => { agentTaskVelocity.setResult(null); setShowAgentTaskVelocity(false); }} />
      )}

      {showAgentContextSwitch && (
        <AgentContextSwitchModal result={agentContextSwitch.result} isOpen={showAgentContextSwitch} loading={agentContextSwitch.loading} onClose={() => { agentContextSwitch.setResult(null); setShowAgentContextSwitch(false); }} />
      )}

      {showAgentParallelCapacity && (
        <AgentParallelCapacityModal result={agentParallelCapacity.result} isOpen={showAgentParallelCapacity} loading={agentParallelCapacity.loading} onClose={() => { agentParallelCapacity.setResult(null); setShowAgentParallelCapacity(false); }} />
      )}

      {showAgentEstimationAccuracy && (
        <AgentEstimationAccuracyModal result={agentEstimationAccuracy.result} isOpen={showAgentEstimationAccuracy} loading={agentEstimationAccuracy.loading} onClose={() => { agentEstimationAccuracy.setResult(null); setShowAgentEstimationAccuracy(false); }} />
      )}

      {showAgentTaskAbandonment && (
        <AgentTaskAbandonmentModal result={agentTaskAbandonment.result} isOpen={showAgentTaskAbandonment} loading={agentTaskAbandonment.loading} onClose={() => { agentTaskAbandonment.setResult(null); setShowAgentTaskAbandonment(false); }} />
      )}

      {showAgentOutputQuality && (
        <AgentOutputQualityModal report={agentOutputQualityScores} isOpen={showAgentOutputQuality} loading={agentOutputQualityLoading} onClose={() => { setAgentOutputQualityScores(null); setShowAgentOutputQuality(false); }} />
      )}

      {showAgentCommunicationQuality && (
        <AgentCommunicationQualityModal result={agentCommunicationQuality.result} isOpen={showAgentCommunicationQuality} loading={agentCommunicationQuality.loading} onClose={() => { agentCommunicationQuality.setResult(null); setShowAgentCommunicationQuality(false); }} />
      )}

      {showAgentWorkloadDistribution && (
        <AgentWorkloadDistributionModal result={agentWorkloadDistribution.result} isOpen={showAgentWorkloadDistribution} loading={agentWorkloadDistribution.loading} onClose={() => { agentWorkloadDistribution.setResult(null); setShowAgentWorkloadDistribution(false); }} />
      )}

      {showAgentTaskComplexity && (
        <AgentTaskComplexityModal result={agentTaskComplexity.result} isOpen={showAgentTaskComplexity} loading={agentTaskComplexity.loading} onClose={() => { agentTaskComplexity.setResult(null); setShowAgentTaskComplexity(false); }} />
      )}

      {showAgentSessionDepth && (
        <AgentSessionDepthModal result={agentSessionDepth.result} isOpen={showAgentSessionDepth} loading={agentSessionDepth.loading} onClose={() => { agentSessionDepth.setResult(null); setShowAgentSessionDepth(false); }} />
      )}

      {showAgentFeedbackLoops && (
        <AgentFeedbackLoopModal result={agentFeedbackLoops.result} isOpen={showAgentFeedbackLoops} loading={agentFeedbackLoops.loading} onClose={() => { agentFeedbackLoops.setResult(null); setShowAgentFeedbackLoops(false); }} />
      )}

      {showAgentReassignmentRates && agentReassignmentRates.result && (
        <AgentReassignmentRatesModal report={agentReassignmentRates.result} onClose={() => { agentReassignmentRates.setResult(null); setShowAgentReassignmentRates(false); }} />
      )}
      {showLearningCurveModal && learningCurveData && (
        <AgentLearningCurveModal report={learningCurveData} onClose={() => { setLearningCurveData(null); setShowLearningCurveModal(false); }} />
      )}
      {showAgentAutonomy && (
        <AgentAutonomyLevelModal result={agentAutonomy.result} isOpen={showAgentAutonomy} loading={agentAutonomy.loading} onClose={() => { agentAutonomy.setResult(null); setShowAgentAutonomy(false); }} />
      )}
      {showAgentReworkRate && (
        <AgentReworkRateModal result={agentReworkRate.result} isOpen={showAgentReworkRate} loading={agentReworkRate.loading} onClose={() => { agentReworkRate.setResult(null); setShowAgentReworkRate(false); }} />
      )}
      {showAgentInterruptionImpact && (
        <AgentInterruptionImpactModal result={agentInterruptionImpact.result} isOpen={showAgentInterruptionImpact} loading={agentInterruptionImpact.loading} onClose={() => { setShowAgentInterruptionImpact(false); }} />
      )}
      {showAgentHandoffChainDepth && (
        <AgentHandoffChainDepthModal result={agentHandoffChainDepth.result} isOpen={showAgentHandoffChainDepth} loading={agentHandoffChainDepth.loading} onClose={() => { agentHandoffChainDepth.setResult(null); setShowAgentHandoffChainDepth(false); }} />
      )}
      {showAgentBlockerFrequency && (
        <AgentBlockerFrequencyModal result={agentBlockerFrequency.result} isOpen={showAgentBlockerFrequency} loading={agentBlockerFrequency.loading} onClose={() => { agentBlockerFrequency.setResult(null); setShowAgentBlockerFrequency(false); }} />
      )}
      {showAgentTokenBudget && (
        <AgentTokenBudgetModal result={agentTokenBudget.result} isOpen={showAgentTokenBudget} loading={agentTokenBudget.loading} onClose={() => { agentTokenBudget.setResult(null); setShowAgentTokenBudget(false); }} />
      )}
      {showAgentKnowledgeFreshness && (
        <AgentKnowledgeFreshnessModal result={agentKnowledgeFreshness.result} isOpen={showAgentKnowledgeFreshness} loading={agentKnowledgeFreshness.loading} onClose={() => { agentKnowledgeFreshness.setResult(null); setShowAgentKnowledgeFreshness(false); }} />
      )}
      {showAgentPersonaAlignment && (
        <AgentPersonaAlignmentModal result={agentPersonaAlignmentResult} isOpen={showAgentPersonaAlignment} loading={agentPersonaAlignmentMutation.isPending} onClose={() => { setAgentPersonaAlignmentResult(null); setShowAgentPersonaAlignment(false); }} />
      )}
      {showAgentCollaborationGraph && (
        <AgentCollaborationGraphModal result={agentCollaborationGraphResult} isOpen={showAgentCollaborationGraph} loading={agentCollaborationGraphMutation.isPending} onClose={() => { setAgentCollaborationGraphResult(null); setShowAgentCollaborationGraph(false); }} />
      )}
      {showAgentMultitaskingEfficiency && (
        <AgentMultitaskingEfficiencyModal result={agentMultitaskingEfficiencyResult} isOpen={showAgentMultitaskingEfficiency} loading={agentMultitaskingEfficiencyMutation.isPending} onClose={() => { setAgentMultitaskingEfficiencyResult(null); setShowAgentMultitaskingEfficiency(false); }} />
      )}
      {showAgentResponseLatency && (
        <AgentResponseLatencyModal result={agentResponseLatency.result} isOpen={showAgentResponseLatency} loading={agentResponseLatency.loading} onClose={() => { agentResponseLatency.setResult(null); setShowAgentResponseLatency(false); }} />
      )}
      {showAgentErrorRecovery && (
        <AgentErrorRecoveryModal result={agentErrorRecovery.result} isOpen={showAgentErrorRecovery} loading={agentErrorRecovery.loading} onClose={() => { agentErrorRecovery.setResult(null); setShowAgentErrorRecovery(false); }} />
      )}
      {showAgentConfidenceCalibration && (
        <AgentConfidenceCalibrationModal result={agentConfidenceCalibration.result} isOpen={showAgentConfidenceCalibration} loading={agentConfidenceCalibration.loading} onClose={() => { agentConfidenceCalibration.setResult(null); setShowAgentConfidenceCalibration(false); }} />
      )}
      {showAgentFeedbackIncorporation && (
        <AgentFeedbackIncorporationModal result={agentFeedbackIncorporation.result} isOpen={showAgentFeedbackIncorporation} loading={agentFeedbackIncorporation.loading} onClose={() => { agentFeedbackIncorporation.setResult(null); setShowAgentFeedbackIncorporation(false); }} />
      )}
      {showAgentSpecializationDrift && (
        <AgentSpecializationDriftModal result={agentSpecializationDrift.result} isOpen={showAgentSpecializationDrift} loading={agentSpecializationDrift.loading} onClose={() => { agentSpecializationDrift.setResult(null); setShowAgentSpecializationDrift(false); }} />
      )}
      {showAgentScopeAdherence && (
        <AgentScopeAdherenceModal result={agentScopeAdherence.result} isOpen={showAgentScopeAdherence} loading={agentScopeAdherence.loading} onClose={() => { agentScopeAdherence.setResult(null); setShowAgentScopeAdherence(false); }} />
      )}
      {showAgentDecisionSpeed && (
        <AgentDecisionSpeedModal result={agentDecisionSpeed.result} isOpen={showAgentDecisionSpeed} loading={agentDecisionSpeed.loading} onClose={() => { agentDecisionSpeed.setResult(null); setShowAgentDecisionSpeed(false); }} />
      )}
      {showAgentThroughputRate && (
        <AgentThroughputRateModal result={agentThroughputRate.result} isOpen={showAgentThroughputRate} loading={agentThroughputRate.loading} onClose={() => { agentThroughputRate.setResult(null); setShowAgentThroughputRate(false); }} />
      )}
      {showAgentSuccessRate && (
        <AgentSuccessRateModal result={agentSuccessRate.result} isOpen={showAgentSuccessRate} loading={agentSuccessRate.loading} onClose={() => { agentSuccessRate.setResult(null); setShowAgentSuccessRate(false); }} />
      )}
      {showAgentCostEfficiency && (
        <AgentCostEfficiencyModal result={agentCostEfficiency.result} isOpen={showAgentCostEfficiency} loading={agentCostEfficiency.loading} onClose={() => { agentCostEfficiency.setResult(null); setShowAgentCostEfficiency(false); }} />
      )}
      {showAgentDeadlineAdherence && (
        <AgentDeadlineAdherenceModal result={agentDeadlineAdherence.result} isOpen={showAgentDeadlineAdherence} loading={agentDeadlineAdherence.loading} onClose={() => { agentDeadlineAdherence.setResult(null); setShowAgentDeadlineAdherence(false); }} />
      )}
      {showAgentSessionDuration && (
        <AgentSessionDurationModal result={agentSessionDuration.result} isOpen={showAgentSessionDuration} loading={agentSessionDuration.loading} onClose={() => { agentSessionDuration.setResult(null); setShowAgentSessionDuration(false); }} />
      )}
      {showAgentRetryPattern && (
        <AgentRetryPatternModal result={agentRetryPattern.result} isOpen={showAgentRetryPattern} loading={agentRetryPattern.loading} onClose={() => { agentRetryPattern.setResult(null); setShowAgentRetryPattern(false); }} />
      )}
      {showAgentToolUsagePattern && (
        <AgentToolUsagePatternModal result={agentToolUsagePattern.result} isOpen={showAgentToolUsagePattern} loading={agentToolUsagePattern.loading} onClose={() => { agentToolUsagePattern.setResult(null); setShowAgentToolUsagePattern(false); }} />
      )}
      {showAgentPriorityAdherence && (
        <AgentPriorityAdherenceModal result={agentPriorityAdherence.result} isOpen={showAgentPriorityAdherence} loading={agentPriorityAdherence.loading} onClose={() => { agentPriorityAdherence.setResult(null); setShowAgentPriorityAdherence(false); }} />
      )}
      {showCognitiveLoad && <AgentCognitiveLoadModal report={cognitiveLoad.data} onClose={() => setShowCognitiveLoad(false)} />}
      {showLearningVelocity && <AgentLearningVelocityModal report={learningVelocity.data} onClose={() => { learningVelocity.setData(null); setShowLearningVelocity(false); }} />}
      {showParallelTaskEfficiency && <AgentParallelTaskEfficiencyModal report={parallelTaskEfficiency.data} onClose={() => { parallelTaskEfficiency.setData(null); setShowParallelTaskEfficiency(false); }} />}
      {showAgentGoalCompletion && (
        <AgentGoalCompletionModal result={agentGoalCompletion.result} isOpen={showAgentGoalCompletion} loading={agentGoalCompletion.loading} onClose={() => { agentGoalCompletion.setResult(null); setShowAgentGoalCompletion(false); }} />
      )}
      {showAgentDecisionQualityV2 && (
        <AgentDecisionQualityV2Modal result={agentDecisionQualityV2.result} isOpen={showAgentDecisionQualityV2} loading={agentDecisionQualityV2.loading} onClose={() => { agentDecisionQualityV2.setResult(null); setShowAgentDecisionQualityV2(false); }} />
      )}
      {showAgentCommunicationPatterns && (
        <AgentCommunicationPatternModal result={agentCommunicationPatterns.result} isOpen={showAgentCommunicationPatterns} loading={agentCommunicationPatterns.loading} onClose={() => { agentCommunicationPatterns.setResult(null); setShowAgentCommunicationPatterns(false); }} />
      )}
      {showAgentSelfCorrectionRate && (
        <AgentSelfCorrectionRateModal result={agentSelfCorrectionRate.result} isOpen={showAgentSelfCorrectionRate} loading={agentSelfCorrectionRate.loading} onClose={() => { agentSelfCorrectionRate.setResult(null); setShowAgentSelfCorrectionRate(false); }} />
      )}
      {showAgentDependencyResolution && (
        <AgentDependencyResolutionModal result={agentDependencyResolution.result} isOpen={showAgentDependencyResolution} loading={agentDependencyResolution.loading} onClose={() => { agentDependencyResolution.setResult(null); setShowAgentDependencyResolution(false); }} />
      )}
      {showAgentCollaborationEfficiency && (
        <AgentCollaborationEfficiencyModal report={agentCollaborationEfficiency.result} onClose={() => { agentCollaborationEfficiency.setResult(null); setShowAgentCollaborationEfficiency(false); }} />
      )}
      {showAgentAdaptationSpeed && (
        <AgentAdaptationSpeedModal report={agentAdaptationSpeed.result} onClose={() => { agentAdaptationSpeed.setResult(null); setShowAgentAdaptationSpeed(false); }} />
      )}
      {showAgentScopeDrift && (
        <AgentScopeDriftModal report={agentScopeDrift.result} onClose={() => { agentScopeDrift.setResult(null); setShowAgentScopeDrift(false); }} />
      )}
      {showContextWindow && (
        <AgentContextWindowModal result={contextWindow.result} isOpen={showContextWindow} loading={contextWindow.loading} onClose={() => { contextWindow.setResult(null); setShowContextWindow(false); }} />
      )}
      {showAgentOutputConsistency && (
        <AgentOutputConsistencyModal result={agentOutputConsistency.result} isOpen={showAgentOutputConsistency} loading={agentOutputConsistency.loading} onClose={() => { agentOutputConsistency.setResult(null); setShowAgentOutputConsistency(false); }} />
      )}
      {showAgentInstructionCompliance && (
        <AgentInstructionComplianceModal result={agentInstructionCompliance.result} isOpen={showAgentInstructionCompliance} loading={agentInstructionCompliance.loading} onClose={() => { agentInstructionCompliance.setResult(null); setShowAgentInstructionCompliance(false); }} />
      )}
      {showAgentEscalationPatternAnalyzer && (
        <AgentEscalationPatternAnalyzerModal data={agentEscalationPatternAnalyzer.data} isOpen={showAgentEscalationPatternAnalyzer} loading={agentEscalationPatternAnalyzer.loading} onClose={() => { agentEscalationPatternAnalyzer.setData(null); setShowAgentEscalationPatternAnalyzer(false); }} />
      )}
      {showAgentFeedbackIntegration && (
        <AgentFeedbackIntegrationModal data={agentFeedbackIntegration.data} isOpen={showAgentFeedbackIntegration} loading={agentFeedbackIntegration.loading} onClose={() => { agentFeedbackIntegration.setData(null); setShowAgentFeedbackIntegration(false); }} />
      )}
      {showAgentProactivity && (
        <AgentProactivityModal data={agentProactivity.data} isOpen={showAgentProactivity} loading={agentProactivity.loading} onClose={() => { agentProactivity.setData(null); setShowAgentProactivity(false); }} />
      )}
      {showAgentDecisionLatency && (
        <AgentDecisionLatencyModal data={agentDecisionLatency.data} isOpen={showAgentDecisionLatency} loading={agentDecisionLatency.loading} onClose={() => { agentDecisionLatency.setData(null); setShowAgentDecisionLatency(false); }} />
      )}
      {showAgentResourceConsumption && (
        <AgentResourceConsumptionModal data={agentResourceConsumption.data} isOpen={showAgentResourceConsumption} loading={agentResourceConsumption.loading} onClose={() => { agentResourceConsumption.setData(null); setShowAgentResourceConsumption(false); }} />
      )}
      {showAgentSessionQuality && (
        <AgentSessionQualityModal data={agentSessionQuality.data} isOpen={showAgentSessionQuality} loading={agentSessionQuality.loading} onClose={() => { agentSessionQuality.setData(null); setShowAgentSessionQuality(false); }} />
      )}
      {showAgentWorkflowTransitions && (
        <AgentWorkflowTransitionModal data={agentWorkflowTransitions.data} isOpen={showAgentWorkflowTransitions} loading={agentWorkflowTransitions.loading} onClose={() => { agentWorkflowTransitions.setData(null); setShowAgentWorkflowTransitions(false); }} />
      )}
      {showAgentKnowledgeTransfer && (
        <AgentKnowledgeTransferModal result={agentKnowledgeTransfer.data ?? null} isOpen={showAgentKnowledgeTransfer} loading={agentKnowledgeTransfer.loading} onClose={() => { agentKnowledgeTransfer.setData(null); setShowAgentKnowledgeTransfer(false); }} />
      )}
      {showAgentDelegationDepth && (
        <AgentDelegationDepthModal data={agentDelegationDepth.data ?? null} isOpen={showAgentDelegationDepth} loading={agentDelegationDepth.loading} onClose={() => { agentDelegationDepth.setData(null); setShowAgentDelegationDepth(false); }} />
      )}
      {showAgentAutonomyIndex && (
        <AgentAutonomyIndexModal result={agentAutonomyIndex.data ?? null} isOpen={showAgentAutonomyIndex} loading={agentAutonomyIndex.loading} onClose={() => { agentAutonomyIndex.setData(null); setShowAgentAutonomyIndex(false); }} />
      )}
      {showAgentBlockedTime && (
        <AgentBlockedTimeModal result={agentBlockedTime.data ?? null} isOpen={showAgentBlockedTime} loading={agentBlockedTime.loading} onClose={() => { agentBlockedTime.setData(null); setShowAgentBlockedTime(false); }} />
      )}
      {showAgentQualitySpeed && (
        <AgentQualitySpeedModal result={agentQualitySpeed.data ?? null} isOpen={showAgentQualitySpeed} loading={agentQualitySpeed.loading} onClose={() => { agentQualitySpeed.setData(null); setShowAgentQualitySpeed(false); }} />
      )}
      {showAgentSpecialization && (
        <AgentSpecializationModal result={agentSpecialization.data ?? null} isOpen={showAgentSpecialization} loading={agentSpecialization.loading} onClose={() => { agentSpecialization.setData(null); setShowAgentSpecialization(false); }} />
      )}
      {showAgentCollaborationScore && (
        <AgentCollaborationScoreModal result={agentCollaborationScore.data ?? null} isOpen={showAgentCollaborationScore} loading={agentCollaborationScore.loading} onClose={() => { agentCollaborationScore.setData(null); setShowAgentCollaborationScore(false); }} />
      )}
      {showAgentThroughput && (
        <AgentThroughputModal result={agentThroughput.data ?? null} isOpen={showAgentThroughput} loading={agentThroughput.loading} onClose={() => { agentThroughput.setData(null); setShowAgentThroughput(false); }} />
      )}
    </div>
  );
}

// ---- Utility helpers ----

function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function formatDuration(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ---- Shortcut Item Component ----

function ShortcutItem({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd key={key} className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2 py-1 rounded font-mono">
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-sm text-gray-400">{description}</span>
    </div>
  );
}

// ---- Sessions Sidebar ----

const statusDot: Record<string, string> = {
  active: 'bg-green-400',
  running: 'bg-green-400',
  pending: 'bg-yellow-400',
  completed: 'bg-gray-500',
  failed: 'bg-red-400',
};

const personaColors: Record<string, string> = {
  planner: 'text-indigo-400',
  implementer: 'text-green-400',
  reviewer: 'text-amber-400',
  qa_tester: 'text-orange-400',
  acceptance_validator: 'text-purple-400',
  orchestrator: 'text-violet-400',
  repo_scanner: 'text-yellow-400',
};

function SessionsSidebar({
  sessions,
  projectId,
  selectedFeatureId,
  onSelectFeature,
  onTicketSelect,
  width,
  onWidthChange,
}: {
  sessions: ReturnType<typeof useProjectSessions>['data'];
  projectId: string;
  selectedFeatureId?: string;
  onSelectFeature: (id: string | undefined) => void;
  onTicketSelect: (ticketId: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const navigate = useNavigate();
  const isDragging = useRef(false);
  const { isUnread, markSeen } = useSessionLastSeen();
  const [expandedSection, setExpandedSection] = useState<'planning' | 'execution' | 'scans' | 'all'>('all');
  const [, forceUpdate] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(480, Math.max(200, startWidth + delta));
      onWidthChange(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, onWidthChange]);

  const toggleSection = useCallback((section: 'planning' | 'execution' | 'scans') => {
    setExpandedSection((prev) => prev === section ? 'all' : section);
  }, []);

  const shouldShowSection = useCallback((section: 'planning' | 'execution' | 'scans') => {
    return expandedSection === 'all' || expandedSection === section;
  }, [expandedSection]);

  const planning = sessions?.planning || [];
  const execution = sessions?.execution || [];
  const scans = sessions?.scans || [];

  const activePlanning = planning.filter((s) => s.status === 'active');
  const pastPlanning = planning.filter((s) => s.status !== 'active');
  const activeExecution = execution.filter((s) => s.status === 'running' || s.status === 'pending');
  const pastExecution = execution.filter((s) => s.status !== 'running' && s.status !== 'pending');

  function handlePlanningClick(s: PlanningSession) {
    markSeen(s.id);
    forceUpdate((n) => n + 1);
    navigate(`/projects/${projectId}/features/${s.featureId}/plan`);
  }

  function handleNewPlanning() {
    if (selectedFeatureId) {
      navigate(`/projects/${projectId}/features/${selectedFeatureId}/plan`);
    }
  }

  return (
    <div className="shrink-0 border-r border-gray-800 bg-gray-900 flex relative" style={{ width }}>
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Sessions</h3>
            {selectedFeatureId && (
              <button
                onClick={handleNewPlanning}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 hover:shadow-md hover:shadow-indigo-500/10 active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Plan
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Sections */}
        <div className="flex-1">
          {/* Planning sessions */}
          <SessionSection
            title="Planning"
            count={planning.length}
            isExpanded={shouldShowSection('planning')}
            onToggle={() => toggleSection('planning')}
          >
            {planning.length === 0 ? (
              <SectionEmptyState message="No planning sessions" />
            ) : (
              <div className="space-y-0.5">
                {planning.map((s) => (
                  <PlanningSessionItem
                    key={s.id}
                    session={s}
                    isUnread={isUnread(s.id, s.lastActivityAt || s.createdAt)}
                    onClick={() => handlePlanningClick(s)}
                    isActive={s.status === 'active'}
                  />
                ))}
              </div>
            )}
          </SessionSection>

          {/* Execution sessions */}
          <SessionSection
            title="Execution"
            count={execution.length}
            isExpanded={shouldShowSection('execution')}
            onToggle={() => toggleSection('execution')}
          >
            {execution.length === 0 ? (
              <SectionEmptyState message="No agent sessions" />
            ) : (
              <div className="space-y-0.5">
                {execution.map((s) => (
                  <ExecutionSessionItem
                    key={s.id}
                    session={s}
                    isUnread={isUnread(s.id, s.completedAt || s.createdAt)}
                    onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); onTicketSelect(s.ticketId); }}
                  />
                ))}
              </div>
            )}
          </SessionSection>

          {/* Scan sessions */}
          {scans.length > 0 && (
            <SessionSection
              title="Scans"
              count={scans.length}
              isExpanded={shouldShowSection('scans')}
              onToggle={() => toggleSection('scans')}
            >
              <div className="space-y-0.5">
                {scans.map((s) => (
                  <ScanSessionItem
                    key={s.id}
                    session={s}
                    isUnread={isUnread(s.id, s.completedAt || s.createdAt)}
                    onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); navigate(`/projects/${projectId}/settings`); }}
                  />
                ))}
              </div>
            </SessionSection>
          )}
        </div>
      </div>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group z-10 flex items-center justify-center"
      >
        <div className="w-px h-full bg-transparent group-hover:bg-indigo-500/50 transition-colors" />
        <div className="absolute w-3 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
          <span className="block w-0.5 h-0.5 rounded-full bg-gray-400" />
          <span className="block w-0.5 h-0.5 rounded-full bg-gray-400" />
          <span className="block w-0.5 h-0.5 rounded-full bg-gray-400" />
        </div>
      </div>
    </div>
  );
}

// ---- Session Sidebar Sub-components ----

function SessionSection({
  title,
  count,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-800/50">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800/30 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">
            {title}
          </span>
        </div>
        {count > 0 && (
          <span className="text-xs text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {isExpanded && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

function SectionEmptyState({ message }: { message: string }) {
  return (
    <div className="py-6 text-center">
      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-2">
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414-2.414a1 1 0 00-.707-.293h-3.172a1 1 0 00-.707.293l-2.414 2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="text-xs text-gray-600 italic">{message}</p>
    </div>
  );
}

function PlanningSessionItem({
  session,
  isUnread,
  onClick,
  isActive,
}: {
  session: PlanningSession;
  isUnread: boolean;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-800/50 group transition-all duration-150"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600 group-hover:bg-gray-500'} transition-colors`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm truncate ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'} transition-colors`}>
              {session.featureTitle}
            </span>
            {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
          </div>
          {session.totalProposalCount != null && session.totalProposalCount > 0 && (
            <p className="text-xs text-gray-600 mt-0.5">
              {session.approvedProposalCount ?? 0}/{session.totalProposalCount} tickets created
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {session.lastActorRole && (
              <span className="text-[10px] text-gray-600 bg-gray-800/30 px-1.5 py-0.5 rounded">
                {session.lastActorRole === 'user' ? 'You' : 'Claude'}
              </span>
            )}
            <span className="text-[10px] text-gray-600">
              {session.lastActivityAt ? relativeTime(session.lastActivityAt) : 'active'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ExecutionSessionItem({
  session,
  isUnread,
  onClick,
}: {
  session: ExecutionSession;
  isUnread: boolean;
  onClick: () => void;
}) {
  const isActive = session.status === 'running' || session.status === 'pending';
  return (
    <div
      onClick={onClick}
      className={`px-2 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
        isActive ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : session.status === 'failed' ? 'bg-red-400' : 'bg-gray-600'} transition-colors`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium ${personaColors[session.personaType] || 'text-gray-500'}`}>
              {session.personaType.replace(/_/g, ' ')}
            </span>
            {session.status === 'failed' && (
              <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-medium">
                failed
              </span>
            )}
            {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
            {session.startedAt && (
              <span className="text-[10px] text-gray-600 ml-auto">{formatDuration(session.startedAt, session.completedAt)}</span>
            )}
          </div>
          {session.featureTitle && (
            <p className="text-[10px] text-gray-600 truncate mt-1">{session.featureTitle}</p>
          )}
          <p className={`text-xs truncate mt-0.5 ${session.status === 'failed' ? 'text-red-400/80' : 'text-gray-400'}`}>
            {session.ticketTitle}
          </p>
          {session.activity && session.activity !== 'idle' && (
            <p className="text-[10px] text-gray-600 truncate mt-0.5 italic">{session.activity}</p>
          )}
          {(session.status === 'completed' || session.status === 'failed') && session.outputSummary && (
            <p className={`text-[10px] mt-1 italic truncate ${session.status === 'failed' ? 'text-red-400/70' : 'text-gray-600'}`} title={session.outputSummary}>
              {session.outputSummary.slice(0, 70)}{session.outputSummary.length > 70 ? '\u2026' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScanSessionItem({
  session,
  isUnread,
  onClick,
}: {
  session: ScanSession;
  isUnread: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-2 py-2 rounded-lg hover:bg-gray-800/30 transition-all duration-150 cursor-pointer"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${session.status === 'running' ? 'bg-yellow-400 animate-pulse' : session.status === 'completed' ? 'bg-gray-500' : 'bg-red-400'} transition-colors`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-yellow-400">repo scanner</span>
            {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
            <span className={`text-[10px] ml-auto ${session.status === 'completed' ? 'text-gray-600' : session.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
              {session.status}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {new Date(session.createdAt).toLocaleDateString()}
          </p>
          {session.status === 'completed' && session.outputSummary && (
            <p className="text-[10px] text-gray-600 italic truncate mt-0.5" title={session.outputSummary}>
              {session.outputSummary.slice(0, 50)}{session.outputSummary.length > 50 ? '\u2026' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
