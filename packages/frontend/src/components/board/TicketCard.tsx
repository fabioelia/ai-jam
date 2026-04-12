import { useAgentStore } from '../../stores/agent-store.js';
import type { Ticket, Epic } from '@ai-jam/shared';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-blue-500/20 text-blue-400',
  low: 'bg-gray-500/20 text-gray-400',
};

interface TicketCardProps {
  ticket: Ticket;
  epics?: Epic[];
  isDragging?: boolean;
  onClick?: () => void;
}

export default function TicketCard({ ticket, epics, isDragging, onClick }: TicketCardProps) {
  const epic = epics?.find((e) => e.id === ticket.epicId);
  const activeAgent = useAgentStore((s) => s.getSessionForTicket(ticket.id));
  const lastAgent = useAgentStore((s) => s.getLastSessionForTicket(ticket.id));

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors select-none ${
        isDragging ? 'shadow-xl ring-2 ring-indigo-500 scale-105' : ''
      } ${activeAgent ? 'border-green-600/50' : 'border-gray-700'} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Epic badge */}
      {epic && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: epic.color || '#6b7280' }}
          />
          <span className="text-xs text-gray-400 truncate">{epic.title}</span>
        </div>
      )}

      <p className="text-white text-sm font-medium mb-2 line-clamp-2">{ticket.title}</p>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[ticket.priority] || ''}`}>
          {ticket.priority}
        </span>

        {ticket.storyPoints != null && (
          <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
            {ticket.storyPoints}pt
          </span>
        )}

        {ticket.assignedPersona && (
          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded ml-auto truncate max-w-24">
            {ticket.assignedPersona}
          </span>
        )}
      </div>

      {activeAgent ? (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-700/50">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400 capitalize">
            {activeAgent.personaType.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-gray-600 ml-auto">
            {activeAgent.activity === 'busy' ? 'working' : activeAgent.activity}
          </span>
        </div>
      ) : lastAgent && (lastAgent.status === 'failed' || lastAgent.status === 'completed') ? (
        <div className="mt-2 pt-2 border-t border-gray-700/50">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lastAgent.status === 'failed' ? 'bg-red-400' : 'bg-gray-500'}`} />
            <span className={`text-xs capitalize ${lastAgent.status === 'failed' ? 'text-red-400' : 'text-gray-500'}`}>
              {lastAgent.personaType.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs ml-auto ${lastAgent.status === 'failed' ? 'text-red-400' : 'text-gray-600'}`}>
              {lastAgent.status}
            </span>
          </div>
          {lastAgent.summary && (
            <p className={`text-[10px] mt-1 line-clamp-2 ${lastAgent.status === 'failed' ? 'text-red-400/70' : 'text-gray-600'}`}>
              {lastAgent.summary}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
