import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import BoardColumn from './BoardColumn.js';
import TicketCard from './TicketCard.js';
import { useBoardStore } from '../../stores/board-store.js';
import { apiFetch } from '../../api/client.js';
import { toast } from '../../stores/toast-store.js';
import type { BoardState, Ticket, TicketStatus, Epic } from '@ai-jam/shared';

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  qa: 'QA',
  acceptance: 'Acceptance',
  done: 'Done',
};

const COLUMN_COLORS: Record<string, string> = {
  backlog: 'border-gray-600',
  in_progress: 'border-blue-500',
  review: 'border-yellow-500',
  qa: 'border-orange-500',
  acceptance: 'border-purple-500',
  done: 'border-green-500',
};

interface KanbanBoardProps {
  board: BoardState;
  projectId: string;
  epicFilter?: string;
  priorityFilter?: string;
  personaFilter?: string;
  searchQuery?: string;
  groupByEpic?: boolean;
  onTicketClick?: (ticket: Ticket) => void;
}

export default function KanbanBoard({ board, projectId, epicFilter, priorityFilter, personaFilter, searchQuery, groupByEpic, onTicketClick }: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const columns = useBoardStore((s) => s.columns);
  const setBoard = useBoardStore((s) => s.setBoard);
  const moveTicketStore = useBoardStore((s) => s.moveTicket);
  const reorderTicket = useBoardStore((s) => s.reorderTicket);

  // Sync server board state into store
  useEffect(() => {
    setBoard(board);
  }, [board, setBoard]);

  // Filter tickets for display (store keeps all tickets for DnD)
  const searchLower = searchQuery?.toLowerCase().trim() || '';
  const filteredColumns = useMemo(() => {
    if (!epicFilter && !priorityFilter && !personaFilter && !searchLower) return columns;
    return columns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((t) => {
        if (epicFilter && t.epicId !== epicFilter) return false;
        if (priorityFilter && t.priority !== priorityFilter) return false;
        if (personaFilter && t.assignedPersona !== personaFilter) return false;
        if (searchLower) {
          const inTitle = t.title.toLowerCase().includes(searchLower);
          const inDesc = t.description?.toLowerCase().includes(searchLower);
          if (!inTitle && !inDesc) return false;
        }
        return true;
      }),
    }));
  }, [columns, epicFilter, priorityFilter, personaFilter, searchLower]);

  // Track which column an item is hovering over
  const overColumnRef = useRef<string | null>(null);

  function findTicketColumn(ticketId: string): string | null {
    for (const col of columns) {
      if (col.tickets.some((t) => t.id === ticketId)) return col.status;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const ticket = columns.flatMap((col) => col.tickets).find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = findTicketColumn(activeId);

    // Determine if we're over a column or another ticket
    let targetColumn: string | null = null;
    let targetIndex: number | null = null;

    // Check if overId is a column status
    const isColumn = columns.some((c) => c.status === overId);
    if (isColumn) {
      targetColumn = overId;
      const col = columns.find((c) => c.status === overId);
      targetIndex = col ? col.tickets.length : 0;
    } else {
      // Over another ticket — find its column and position
      for (const col of columns) {
        const idx = col.tickets.findIndex((t) => t.id === overId);
        if (idx !== -1) {
          targetColumn = col.status;
          targetIndex = idx;
          break;
        }
      }
    }

    if (!activeColumn || !targetColumn || targetIndex === null) return;

    // Cross-column move during drag (optimistic visual update)
    if (activeColumn !== targetColumn) {
      overColumnRef.current = targetColumn;
      moveTicketStore(activeId, targetColumn as TicketStatus, targetIndex);
    }
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    overColumnRef.current = null;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the ticket's current position in store (after any DragOver moves)
    const currentColumn = findTicketColumn(activeId);
    if (!currentColumn) return;

    // Determine final position
    let targetColumn = currentColumn;
    let targetIndex = 0;

    const isColumn = columns.some((c) => c.status === overId);
    if (isColumn) {
      targetColumn = overId;
      const col = columns.find((c) => c.status === overId);
      targetIndex = col ? col.tickets.findIndex((t) => t.id === activeId) : 0;
      if (targetIndex === -1) targetIndex = col ? col.tickets.length : 0;
    } else {
      for (const col of columns) {
        const idx = col.tickets.findIndex((t) => t.id === overId);
        if (idx !== -1) {
          targetColumn = col.status;
          // Place after the hovered ticket
          const activeIdx = col.tickets.findIndex((t) => t.id === activeId);
          targetIndex = activeIdx !== -1 ? activeIdx : idx;
          break;
        }
      }
    }

    // Find the original ticket from the server board
    const originalTicket = board.columns
      .flatMap((col) => col.tickets)
      .find((t) => t.id === activeId);

    if (!originalTicket) return;

    // Persist to server
    try {
      if (originalTicket.status !== targetColumn) {
        await apiFetch(`/tickets/${activeId}/move`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: targetColumn, sortOrder: targetIndex }),
        });
      } else if (targetIndex !== originalTicket.sortOrder) {
        await apiFetch(`/tickets/${activeId}/reorder`, {
          method: 'POST',
          body: JSON.stringify({ sortOrder: targetIndex }),
        });
      }
    } catch (err) {
      // Revert on error — re-sync from server
      setBoard(board);
      toast.error('Failed to move ticket. Changes reverted.');
    }
  }, [board, columns, setBoard]);

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        {filteredColumns.map((column) => (
          <BoardColumn
            key={column.status}
            status={column.status}
            label={COLUMN_LABELS[column.status] || column.status}
            colorClass={COLUMN_COLORS[column.status] || 'border-gray-600'}
            tickets={column.tickets}
            count={column.tickets.length}
            epics={board.epics}
            groupByEpic={groupByEpic}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTicket ? (
          <TicketCard
            ticket={activeTicket}
            epics={board.epics}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
