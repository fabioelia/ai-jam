import { useState } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '@ai-jam/shared';

interface TicketQuickActionsProps {
  ticket: Ticket;
  onStatusChange: (status: TicketStatus) => void;
  onPriorityChange: (priority: TicketPriority) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStartAgent: () => void;
  onComplete: () => void;
}

const STATUS_OPTIONS: { key: TicketStatus; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'text-gray-400 bg-gray-500/20' },
  { key: 'in_progress', label: 'In Progress', color: 'text-blue-400 bg-blue-500/20' },
  { key: 'review', label: 'Review', color: 'text-amber-400 bg-amber-500/20' },
  { key: 'qa', label: 'QA', color: 'text-purple-400 bg-purple-500/20' },
  { key: 'acceptance', label: 'Acceptance', color: 'text-cyan-400 bg-cyan-500/20' },
  { key: 'done', label: 'Done', color: 'text-green-400 bg-green-500/20' },
];

const PRIORITY_OPTIONS: { key: TicketPriority; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: 'text-red-400 bg-red-500/20' },
  { key: 'high', label: 'High', color: 'text-orange-400 bg-orange-500/20' },
  { key: 'medium', label: 'Medium', color: 'text-blue-400 bg-blue-500/20' },
  { key: 'low', label: 'Low', color: 'text-gray-400 bg-gray-500/20' },
];

export default function TicketQuickActions({
  ticket,
  onStatusChange,
  onPriorityChange,
  onEdit,
  onDelete,
  onDuplicate,
  onStartAgent,
  onComplete,
}: TicketQuickActionsProps) {
  const [showMore, setShowMore] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      {/* Start Agent Button */}
      {onStartAgent && (
        <button
          onClick={onStartAgent}
          className="group relative p-2 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          title="Start agent on this ticket"
          aria-label="Start agent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-7h-7v-7l5 3v4l-5-3z" />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-gray-400 text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Start Agent
          </span>
        </button>
      )}

      {/* Complete Button */}
      {onComplete && ticket.status !== 'done' && (
        <button
          onClick={onComplete}
          className="group relative p-2 rounded-lg bg-green-600/10 hover:bg-green-600/20 text-green-400 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20 active:scale-95"
          title="Mark as complete"
          aria-label="Mark as complete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2l-9-9" />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-gray-400 text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Complete
          </span>
        </button>
      )}

      {/* Status Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowStatusMenu(!showStatusMenu);
            setShowPriorityMenu(false);
            setShowMore(false);
          }}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 transition-all duration-200 hover:shadow-sm active:scale-95"
          title="Change status"
          aria-label="Change status"
          aria-expanded={showStatusMenu}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>

        {showStatusMenu && (
          <div className="absolute top-full right-0 mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="py-1">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    onStatusChange(option.key);
                    setShowStatusMenu(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors ${
                    ticket.status === option.key ? 'bg-gray-800' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                  <span className="text-sm text-gray-300">{option.label}</span>
                  {ticket.status === option.key && (
                    <svg className="w-4 h-4 ml-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Priority Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setShowPriorityMenu(!showPriorityMenu);
            setShowStatusMenu(false);
            setShowMore(false);
          }}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 transition-all duration-200 hover:shadow-sm active:scale-95"
          title="Change priority"
          aria-label="Change priority"
          aria-expanded={showPriorityMenu}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414-6.414a1 1 0 00-.707 0L9.293 7.293a1 1 0 00-.707.293L2.586 7.293A1 1 0 013 8V4zm0 8v2.586a1 1 0 00.293.707l6.414-6.414a1 1 0 01.707 0L14.707 8.293a1 1 0 01.707.293L20.586 10.293a1 1 0 00.707.707V12a1 1 0 01-1 1H4a1 1 0 01-1-1V12zm0 4v2.586a1 1 0 00.293.707l6.414-6.414a1 1 0 01.707 0L14.707 14.293a1 1 0 01.707.293L20.586 16.293a1 1 0 00.707.707V16a1 1 0 01-1 1H4a1 1 0 01-1-1V16z" />
          </svg>
        </button>

        {showPriorityMenu && (
          <div className="absolute top-full right-0 mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="py-1">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    onPriorityChange(option.key);
                    setShowPriorityMenu(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors ${
                    ticket.priority === option.key ? 'bg-gray-800' : ''
                  }`}
                >
                  <svg className={`w-4 h-4 ${option.color.split(' ')[0]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
                  </svg>
                  <span className="text-sm text-gray-300 capitalize">{option.label}</span>
                  {ticket.priority === option.key && (
                    <svg className="w-4 h-4 ml-auto text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Button */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="group relative p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 transition-all duration-200 hover:shadow-sm hover:shadow-gray-900/10 active:scale-95"
          title="Edit ticket"
          aria-label="Edit ticket"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2h2.828l-8.586-8.586z" />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-gray-400 text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Edit
          </span>
        </button>
      )}

      {/* More Actions */}
      <div className="relative">
        <button
          onClick={() => {
            setShowMore(!showMore);
            setShowStatusMenu(false);
            setShowPriorityMenu(false);
          }}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 transition-all duration-200 hover:shadow-sm hover:shadow-gray-900/10 active:scale-95"
          title="More actions"
          aria-label="More actions"
          aria-expanded={showMore}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 5a2 2 0 110-2h0a2 2 0 110 2zm0 7a2 2 0 110-2h0a2 2 0 110 2zm0 7a2 2 0 110-2h0a2 2 0 110 2z" />
          </svg>
        </button>

        {showMore && (
          <div className="absolute top-full right-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="py-1">
              {onDuplicate && (
                <button
                  onClick={() => {
                    onDuplicate();
                    setShowMore(false);
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2h-6a2 2 0 00-2 2zm8 0v6m-6-6h6" />
                  </svg>
                  <span className="text-sm text-gray-300">Duplicate</span>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    setShowMore(false);
                    onDelete();
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors text-left group"
                >
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-sm text-gray-300 group-hover:text-red-400 transition-colors">Delete</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
