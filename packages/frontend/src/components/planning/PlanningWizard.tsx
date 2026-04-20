import { useState } from 'react';

interface PlanningStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  active: boolean;
  tips: string[];
  examplePrompts: string[];
}

interface PlanningWizardProps {
  onPromptSelected: (prompt: string) => void;
  onStartPlanning: () => void;
}

const STEPS: Omit<PlanningStep, 'completed' | 'active'>[] = [
  {
    id: '1',
    title: 'Define Your Feature',
    description: 'Start by clearly describing what you want to build and why it matters',
    icon: '🎯',
    tips: [
      'Think about the problem you\'re solving',
      'Consider who will use this feature',
      'Define success criteria upfront'
    ],
    examplePrompts: [
      'I want to build a user authentication system with email verification and password reset',
      'Create an analytics dashboard that shows user engagement metrics',
      'Implement a real-time chat feature with message history'
    ]
  },
  {
    id: '2',
    title: 'Break Down Requirements',
    description: 'Identify the key components and technical requirements',
    icon: '🔧',
    tips: [
      'List all necessary API endpoints',
      'Consider database schema changes',
      'Think about UI components needed'
    ],
    examplePrompts: [
      'Break down the authentication system into smaller technical tasks',
      'What database tables do I need for user management?',
      'Identify the main components for the dashboard UI'
    ]
  },
  {
    id: '3',
    title: 'Plan Implementation',
    description: 'Create a structured plan with prioritized tickets and dependencies',
    icon: '📋',
    tips: [
      'Start with core functionality first',
      'Identify dependencies between tasks',
      'Set realistic estimates for each ticket'
    ],
    examplePrompts: [
      'Create a prioritized list of tickets for the authentication feature',
      'Identify dependencies between the dashboard components',
      'Estimate story points for each task'
    ]
  },
  {
    id: '4',
    title: 'Review & Refine',
    description: 'Review the proposed tickets and make adjustments as needed',
    icon: '✨',
    tips: [
      'Check if all requirements are covered',
      'Validate priorities and estimates',
      'Consider edge cases and error handling'
    ],
    examplePrompts: [
      'Review the proposed tickets for completeness',
      'Are there any missing edge cases to handle?',
      'Help me refine the acceptance criteria'
    ]
  }
];

export default function PlanningWizard({ onPromptSelected, onStartPlanning }: PlanningWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const steps: PlanningStep[] = STEPS.map((step, idx) => ({
    ...step,
    completed: idx < currentStep,
    active: idx === currentStep
  }));

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePromptClick = (prompt: string) => {
    onPromptSelected(prompt);
    setShowDetails(false);
  };

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step.completed
                    ? 'bg-green-600 text-white'
                    : step.active
                      ? 'bg-indigo-600 text-white scale-110'
                      : 'bg-gray-800 text-gray-500'
                }`}
              >
                {step.completed ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 transition-all ${
                    step.completed ? 'bg-green-600' : 'bg-gray-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`text-xs transition-all ${
            showDetails
              ? 'text-indigo-400'
              : 'text-gray-500 hover:text-gray-400'
          }`}
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Current step content */}
      <div className="p-5 rounded-xl border border-gray-700 bg-gray-800/50 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${
            currentStepData.active
              ? 'bg-indigo-600/20 scale-110'
              : 'bg-gray-800'
          }`}>
            {currentStepData.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">{currentStepData.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{currentStepData.description}</p>

            {showDetails && (
              <>
                {/* Tips */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Tips</h4>
                  <ul className="space-y-1.5">
                    {currentStepData.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-indigo-400 mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Example prompts */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Example Prompts</h4>
                  <div className="space-y-2">
                    {currentStepData.examplePrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePromptClick(prompt)}
                        className="w-full text-left p-3 rounded-lg bg-gray-900/50 border border-gray-700 hover:border-indigo-500 hover:bg-gray-900 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 group-hover:text-indigo-400">Prompt {idx + 1}</span>
                          <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-indigo-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-300 group-hover:text-white mt-1 line-clamp-2">{prompt}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-700">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            Previous
          </button>

          <div className="text-xs text-gray-600">
            Step {currentStep + 1} of {steps.length}
          </div>

          <button
            onClick={currentStep === steps.length - 1 ? onStartPlanning : handleNext}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
          >
            {currentStep === steps.length - 1 ? 'Start Planning' : 'Next Step'}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onPromptSelected('Help me plan this feature step by step')}
          className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 hover:border-indigo-500 hover:bg-gray-800 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
              Guided Planning
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Let me guide you through each step of the planning process
          </p>
        </button>

        <button
          onClick={() => onPromptSelected('Start with a fresh planning session')}
          className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 hover:border-green-500 hover:bg-gray-800 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white group-hover:text-green-300 transition-colors">
              Quick Start
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Jump right in and start planning with your own description
          </p>
        </button>
      </div>
    </div>
  );
}
