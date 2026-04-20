import { useState } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '@ai-jam/shared';

interface QuickActionsProps {
  ticket: Ticket;
  onStartAgent?: () => void;
  onComplete?: () => void;
  onAssignToUser?: (userId: string) => void;
  onAssignToPersona?: (persona: string) => void;
  onUpdateStatus?: (status: TicketStatus) => void;
  onUpdatePriority?: (priority: TicketPriority) => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
}

const STATUS_OPTIONS: TicketStatus[] = ['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done'];
const PRIORITY_OPTIONS: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
const PERSONA_OPTIONS = [
  { value: 'planner', label: 'Planner' },
  { value: 'implementer', label: 'Implementer' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'qa_tester', label: 'QA Tester' },
  { value: 'acceptance_validator', label: 'Validator' },
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  qa: 'QA',
  acceptance: 'Acceptance',
  done: 'Done',
};

const PRIORITY_COLORS: Record<TicketPriority, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  low: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

export default function QuickActions({
  ticket,
  onStartAgent,
  onComplete,
  onAssignToUser,
  onAssignToPersona,
  onUpdateStatus,
  onUpdatePriority,
  onDuplicate,
  onArchive,
}: QuickActionsProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Quick Actions</h3>

      {/* Primary Actions */}
      <div className="grid grid-cols-2 gap-2">
        {/* Start Agent */}
        {onStartAgent && (
          <button
            onClick={onStartAgent}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Agent
          </button>
        )}

        {/* Complete */}
        {onComplete && ticket.status !== 'done' && (
          <button
            onClick={onComplete}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Complete
          </button>
        )}
      </div>

      {/* Status Change */}
      {onUpdateStatus && (
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 hover:shadow-sm hover:shadow-gray-900/10 active:bg-gray-600 active:scale-[0.99] rounded-lg text-sm transition-all duration-200 border border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Status:</span>
              <span className="text-white font-medium">{STATUS_LABELS[ticket.status]}</span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showStatusMenu && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top duration-200">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    onUpdateStatus(status);
                    setShowStatusMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-sm ${
                    status === ticket.status ? 'text-indigo-400' : 'text-gray-300 hover:text-gray-400'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Priority Change */}
      {onUpdatePriority && (
        <div className="relative">
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 hover:shadow-sm hover:shadow-gray-900/10 active:bg-gray-600 active:scale-[0.99] rounded-lg text-sm transition-all duration-200 border border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Priority:</span>
              <span className={`font-medium capitalize ${PRIORITY_COLORS[ticket.priority].text}`}>
                {ticket.priority}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${showPriorityMenu ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPriorityMenu && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top duration-200">
              {PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  onClick={() => {
                    onUpdatePriority(priority);
                    setShowPriorityMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-sm flex items-center gap-2 ${
                    priority === ticket.priority ? 'text-indigo-400' : 'text-gray-300 hover:text-gray-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority].bg}`} />
                  <span className="capitalize">{priority}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Persona Assignment */}
      {onAssignToPersona && (
        <div className="relative">
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 hover:shadow-sm hover:shadow-gray-900/10 active:bg-gray-600 active:scale-[0.99] rounded-lg text-sm transition-all duration-200 border border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Assigned Persona:</span>
              <span className="text-white font-medium">
                {ticket.assignedPersona || 'Unassigned'}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPersonaMenu && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top duration-200">
              <button
                onClick={() => {
                  onAssignToPersona('');
                  setShowPersonaMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-800 hover:text-gray-400 transition-all duration-200 hover:shadow-sm hover:shadow-gray-900/10"
              >
                Unassign
              </button>
              {PERSONA_OPTIONS.map((persona) => (
                <button
                  key={persona.value}
                  onClick={() => {
                    onAssignToPersona(persona.value);
                    setShowPersonaMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-sm ${
                    ticket.assignedPersona === persona.value ? 'text-indigo-400' : 'text-gray-300'
                  }`}
                >
                  {persona.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Secondary Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-800">
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-all hover:shadow-md hover:shadow-gray-900/10 active:bg-gray-600 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </button>
        )}

        {onArchive && (
          <button
            onClick={onArchive}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-all hover:shadow-md hover:shadow-gray-900/10 active:bg-gray-600 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Archive
          </button>
        )}
      </div>
    </div>
  );
}
