import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTicketCard from './SortableTicketCard.js';
import EpicGroup from './EpicGroup.js';
import type { Ticket, TicketStatus, Epic } from '@ai-jam/shared';

interface BoardColumnProps {
  status: TicketStatus;
  label: string;
  colorClass: string;
  tickets: Ticket[];
  count: number;
  epics: Epic[];
  groupByEpic?: boolean;
  onTicketClick?: (ticket: Ticket) => void;
}

export default function BoardColumn({ status, label, colorClass, tickets, count, epics, groupByEpic, onTicketClick }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const ticketIds = tickets.map((t) => t.id);

  // Group tickets by epic
  function renderGrouped() {
    const groups = new Map<string | null, Ticket[]>();
    for (const ticket of tickets) {
      const key = ticket.epicId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ticket);
    }

    // Sort: epics in their sort order, ungrouped last
    const epicMap = new Map(epics.map((e) => [e.id, e]));
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const ea = epicMap.get(a);
      const eb = epicMap.get(b);
      return (ea?.sortOrder ?? 0) - (eb?.sortOrder ?? 0);
    });

    return sortedKeys.map((epicId) => (
      <EpicGroup
        key={epicId ?? '__none'}
        epic={epicId ? epicMap.get(epicId) ?? null : null}
        tickets={groups.get(epicId)!}
        epics={epics}
        onTicketClick={onTicketClick}
      />
    ));
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 min-w-72 shrink-0 rounded-xl bg-gray-900/50 border-t-2 ${colorClass} ${
        isOver ? 'ring-2 ring-indigo-500/30 bg-gray-900/70' : ''
      }`}
    >
      <div className="px-3 py-2.5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">{label}</h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{count}</span>
      </div>

      <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-[100px]">
          {groupByEpic && epics.length > 0 ? (
            renderGrouped()
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <SortableTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  epics={epics}
                  onClick={onTicketClick ? () => onTicketClick(ticket) : undefined}
                />
              ))}
            </div>
          )}

          {tickets.length === 0 && (
            <div className="text-center py-10">
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-gray-600 text-xs">Drop tickets here</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
