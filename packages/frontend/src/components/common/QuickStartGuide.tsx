import { useState } from 'react';

interface QuickStartGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onStartProject?: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
}

const steps: Step[] = [
  {
    id: 'create-project',
    title: '1. Create Your Project',
    description: 'Start by creating a project to organize your features and connect it to your codebase.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    tips: [
      'Use Repository URL for GitHub projects to enable advanced features',
      'Add a GitHub Personal Access Token for private repositories',
      'Local Directory is great for existing projects on your machine',
    ],
  },
  {
    id: 'create-feature',
    title: '2. Plan Your Features',
    description: 'Break down your product into features that can be planned and tracked independently.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    tips: [
      'Give each feature a clear, descriptive name',
      'Use "Plan with Claude" to break features into tickets',
      'Review and approve ticket proposals before adding to board',
    ],
  },
  {
    id: 'execute-tickets',
    title: '3. Execute with AI Agents',
    description: 'Let AI agents work on your tickets while you monitor progress and provide guidance.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    tips: [
      'Agents work on tickets in the order they appear',
      'Monitor progress in the Sessions sidebar and Agents panel',
      'Review agent work and provide feedback through comments',
    ],
  },
  {
    id: 'collaborate',
    title: '4. Collaborate with Your Team',
    description: 'Work together in real-time with team members, track progress, and stay informed.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    tips: [
      'Add team members in Project Settings',
      'Enable notifications for important events',
      'Use comments to discuss tickets and agent work',
    ],
  },
];

export default function QuickStartGuide({ isOpen, onClose, onStartProject }: QuickStartGuideProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-white">Welcome to AI Jam! 🚀</h2>
            <p className="text-gray-400 text-sm mt-1">Get started with AI-powered project management</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-colors"
            aria-label="Close guide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`border border-gray-700 rounded-xl overflow-hidden transition-all duration-200 ${
                  expandedStep === step.id ? 'bg-gray-800/50' : 'bg-gray-900'
                }`}
              >
                <button
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="shrink-0 w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-1">{step.title}</h3>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 shrink-0 transition-transform ${
                      expandedStep === step.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedStep === step.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-gray-800 animate-in slide-in-from-top duration-200">
                    <div className="pt-4">
                      <p className="text-sm font-medium text-gray-300 mb-3">Tips for success:</p>
                      <ul className="space-y-2">
                        {step.tips.map((tip, tipIndex) => (
                          <li key={tipIndex} className="flex items-start gap-2 text-sm text-gray-400">
                            <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Additional resources */}
          <div className="mt-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <h4 className="text-indigo-300 font-medium mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Need help?
            </h4>
            <p className="text-gray-400 text-sm mb-3">
              Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">?</kbd> anytime to open keyboard shortcuts,
              or click the help icon in the header for full documentation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
          >
            Skip for now
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setExpandedStep(null);
                onClose();
              }}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Maybe later
            </button>
            {onStartProject && (
              <button
                onClick={() => {
                  onClose();
                  onStartProject();
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create Your First Project
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
