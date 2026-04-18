import HelpModal, { HelpSection, HelpItem, Shortcut, Feature } from './HelpModal.js';

interface HelpContentProps {
  view: 'overview' | 'getting-started' | 'features' | 'shortcuts';
  onViewChange: (view: 'overview' | 'getting-started' | 'features' | 'shortcuts') => void;
}

export default function HelpContent({ view, onViewChange }: HelpContentProps) {
  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'getting-started' as const, label: 'Getting Started' },
    { key: 'features' as const, label: 'Features' },
    { key: 'shortcuts' as const, label: 'Shortcuts' },
  ];

  return (
    <div>
      {/* Navigation tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onViewChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              view === tab.key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'overview' && <OverviewContent />}
      {view === 'getting-started' && <GettingStartedContent />}
      {view === 'features' && <FeaturesContent />}
      {view === 'shortcuts' && <ShortcutsContent />}
    </div>
  );
}

function OverviewContent() {
  return (
    <div>
      <p className="text-gray-300 mb-6 leading-relaxed">
        AI Jam is an AI-powered project management tool that helps you plan, track, and execute features
        with the help of AI agents. It combines traditional project management boards with intelligent
        assistance to accelerate your development workflow.
      </p>

      <HelpSection title="Core Concepts">
        <HelpItem
          question="What are Projects?"
          answer="Projects are workspaces that contain your features, tickets, and AI agent sessions. Each project can be linked to a Git repository for context and automated workflows."
        />
        <HelpItem
          question="What are Features?"
          answer="Features are high-level initiatives or user stories that you want to implement. Each feature has its own planning sessions and can contain multiple tickets."
        />
        <HelpItem
          question="What are Tickets?"
          answer="Tickets are individual tasks that need to be completed. They flow through different stages: Backlog → In Progress → Review → QA → Acceptance → Done."
        />
        <HelpItem
          question="What are AI Agents?"
          answer="AI agents are specialized AI personas that help you with different aspects of development, including planning, implementation, code review, testing, and more."
        />
      </HelpSection>

      <HelpSection title="How AI Jam Works">
        <HelpItem
          question="Planning Phase"
          answer="Use the 'Plan with Claude' feature to break down your feature into actionable tickets. The AI helps you create a comprehensive plan with user stories and acceptance criteria."
        />
        <HelpItem
          question="Execution Phase"
          answer="AI agents can pick up tickets and implement them. Each ticket goes through automated gates and human review before being marked as done."
        />
        <HelpItem
          question="Real-time Collaboration"
          answer="All updates happen in real-time. Team members can see agent progress, comment on tickets, and receive notifications about important events."
        />
      </HelpSection>
    </div>
  );
}

function GettingStartedContent() {
  return (
    <div>
      <HelpSection title="Step 1: Create a Project">
        <HelpItem
          question="Setting up your workspace"
          answer={
            <>
              <p className="mb-2">Start by creating a new project on the dashboard:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-400 text-sm">
                <li>Click 'New Project' on the dashboard</li>
                <li>Enter a project name</li>
                <li>Choose your source (Repository URL or Local Directory)</li>
                <li>For repositories, provide a GitHub URL and optionally a PAT for private repos</li>
              </ol>
            </>
          }
        />
        <HelpItem
          question="Repository vs Local"
          answer="Repository URL connects to a GitHub repo and enables advanced features like worktrees. Local Directory is for existing projects on your machine but limits some collaborative features."
        />
      </HelpSection>

      <HelpSection title="Step 2: Create a Feature">
        <HelpItem
          question="Planning your work"
          answer={
            <>
              <p className="mb-2">Once your project is created:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-400 text-sm">
                <li>Navigate to the project board</li>
                <li>Click 'Feature' in the toolbar to create a new feature</li>
                <li>Give it a clear, descriptive title</li>
                <li>Click 'Plan with Claude' to start AI-assisted planning</li>
              </ol>
            </>
          }
        />
      </HelpSection>

      <HelpSection title="Step 3: Plan with AI">
        <HelpItem
          question="Interactive planning"
          answer="In the planning view, describe what you want to build. Claude will help you break it down into tickets, suggest acceptance criteria, and create a comprehensive implementation plan."
        />
        <HelpItem
          question="Reviewing proposals"
          answer="Claude will propose tickets for your feature. Review each one, make edits if needed, and approve or reject. Approved tickets are automatically added to your board."
        />
      </HelpSection>

      <HelpSection title="Step 4: Execute and Track">
        <HelpItem
          question="Starting work"
          answer="Assign tickets to AI agents or team members. Agents will work on tickets in parallel when possible, moving them through the workflow automatically."
        />
        <HelpItem
          question="Monitoring progress"
          answer="Use the Sessions sidebar to track AI agent activity and the Agents panel to see real-time progress. Notifications will alert you to important events."
        />
      </HelpSection>
    </div>
  );
}

function FeaturesContent() {
  return (
    <div>
      <HelpSection title="Core Features">
        <Feature
          title="AI-Powered Planning"
          description="Break down features into actionable tickets with the help of Claude. Get intelligent suggestions for implementation, testing, and documentation."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
        />
        <Feature
          title="Automated Workflow"
          description="Tickets move through stages automatically with AI agent assistance. Transition gates ensure quality checks at each step."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <Feature
          title="Real-time Collaboration"
          description="Work together with your team in real-time. See updates instantly, comment on tickets, and get notified about important events."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <Feature
          title="Smart Notifications"
          description="Get notified about agent completions, ticket movements, gate decisions, and more. Customize your notification preferences per project."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
        />
      </HelpSection>

      <HelpSection title="Advanced Features">
        <Feature
          title="Repository Scanning"
          description="Scan your repository to generate knowledge files that AI agents use for context. This improves understanding of your codebase and conventions."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
        <Feature
          title="System Prompts"
          description="Customize AI agent behavior with system prompts. Override global defaults per project to tailor agent responses to your needs."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <Feature
          title="Agent Model Configuration"
          description="Choose which AI model (Opus, Sonnet, or Haiku) each agent persona uses. Optimize for cost vs. performance based on your needs."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1m8.06-4a6.002 6.002 0 01-9.58-5.092M9 10a3.003 3.003 0 00-.72 2.063L9 10m6-6a3.003 3.003 0 00-5.918 3.422M14 6l-.5-4.285m0 8.569L9 10" />
            </svg>
          }
        />
      </HelpSection>
    </div>
  );
}

function ShortcutsContent() {
  return (
    <div>
      <HelpSection title="Navigation">
        <Shortcut keys={['Esc']} description="Close modals, dialogs, or slide-over panels" />
        <Shortcut keys={['/']} description="Focus search in filters (when on board page)" />
        <Shortcut keys={['G', 'P']} description="Go to Projects dashboard" />
        <Shortcut keys={['G', 'B']} description="Go to Board (when in a project)" />
        <Shortcut keys={['G', 'S']} description="Go to Settings (when in a project)" />
      </HelpSection>

      <HelpSection title="Board Actions">
        <Shortcut keys={['N', 'F']} description="Create new Feature" />
        <Shortcut keys={['N', 'T']} description="Create new Ticket (requires feature selected)" />
        <Shortcut keys={['F']} description="Open/Close Filters" />
        <Shortcut keys={['G', 'E']} description="Toggle Group by Epic" />
      </HelpSection>

      <HelpSection title="Planning">
        <Shortcut keys={['P']} description="Open Plan with Claude (when feature selected)" />
        <Shortcut keys={['N', 'S']} description="Start new planning session" />
        <Shortcut keys={['Enter']} description="Send message (in planning chat)" />
      </HelpSection>

      <HelpSection title="General">
        <Shortcut keys={['?']} description="Open this help dialog" />
        <Shortcut keys={['Cmd', 'K']} description="Open quick command palette (coming soon)" />
        <Shortcut keys={['Cmd', '/']} description="Search (coming soon)" />
      </HelpSection>
    </div>
  );
}
