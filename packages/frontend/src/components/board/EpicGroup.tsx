import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTicketCard from './SortableTicketCard.js';
import type { Ticket, Epic } from '@ai-jam/shared';

interface EpicGroupProps {
  epic: Epic | null; // null = ungrouped tickets
  tickets: Ticket[];
  epics: Epic[];
  onTicketClick?: (ticket: Ticket) => void;
}

export default function EpicGroup({ epic, tickets, epics, onTicketClick }: EpicGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (tickets.length === 0) return null;

  const ticketIds = tickets.map((t) => t.id);

  return (
    <div className="mb-1 animate-in slide-in-from-bottom duration-200">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full px-1 py-1 text-left group rounded-lg hover:bg-gray-800/50 transition-colors active:bg-gray-800/70"
      >
        <svg
          className="w-3 h-3 text-gray-500 transition-transform group-hover:text-gray-400"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {epic ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: epic.color || '#6b7280' }} />
            <span className="text-xs font-medium text-gray-400 truncate group-hover:text-gray-300 transition-colors">{epic.title}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-gray-500 italic group-hover:text-gray-400 transition-colors">No Epic</span>
        )}
        <span className="text-xs text-gray-600 ml-auto group-hover:text-gray-500 transition-colors">{tickets.length}</span>
      </button>

      {!collapsed && (
        <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 mt-1">
            {tickets.map((ticket) => (
              <SortableTicketCard
                key={ticket.id}
                ticket={ticket}
                epics={epics}
                onClick={onTicketClick ? () => onTicketClick(ticket) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
