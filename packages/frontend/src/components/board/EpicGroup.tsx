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
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full px-1 py-1 text-left group"
      >
        <span className="text-gray-500 text-xs transition-transform" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>
          &#9662;
        </span>
        {epic ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: epic.color || '#6b7280' }} />
            <span className="text-xs font-medium text-gray-400 truncate group-hover:text-gray-300">{epic.title}</span>
          </>
        ) : (
          <span className="text-xs font-medium text-gray-500 italic group-hover:text-gray-400">No Epic</span>
        )}
        <span className="text-xs text-gray-600 ml-auto">{tickets.length}</span>
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
