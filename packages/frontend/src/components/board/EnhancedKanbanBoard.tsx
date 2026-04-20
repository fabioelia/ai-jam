import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import BoardColumn from './BoardColumn.js';
import TicketCard from './TicketCard.js';
import { useBoardStore } from '../../stores/board-store.js';
import { apiFetch, getClientErrorMessage } from '../../api/client.js';
import { toast } from '../../stores/toast-store.js';
import PriorityBadge from '../common/Badge.js';
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

const COLUMN_ICONS: Record<string, string> = {
  backlog: '📝',
  in_progress: '🔄',
  review: '👀',
  qa: '🔍',
  acceptance: '✅',
  done: '✓',
};

interface EnhancedKanbanBoardProps {
  board: BoardState;
  projectId: string;
  epicFilter?: string;
  priorityFilter?: string;
  personaFilter?: string;
  searchQuery?: string;
  statusFilters?: string[];
  dateRange?: { start: string; end: string };
  groupByEpic?: boolean;
  onTicketClick?: (ticket: Ticket) => void;
  onTicketCountChange?: (count: number) => void;
}

export default function EnhancedKanbanBoard({
  board,
  projectId,
  epicFilter,
  priorityFilter,
  personaFilter,
  searchQuery,
  statusFilters = [],
  dateRange,
  groupByEpic = false,
  onTicketClick,
  onTicketCountChange,
}: EnhancedKanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
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
    const hasBasicFilters = epicFilter || priorityFilter || personaFilter || searchLower;
    const hasAdvancedFilters = statusFilters.length > 0 || dateRange?.start || dateRange?.end;

    if (!hasBasicFilters && !hasAdvancedFilters) return columns;

    return columns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((t) => {
        // Basic filters
        if (epicFilter && t.epicId !== epicFilter) return false;
        if (priorityFilter && t.priority !== priorityFilter) return false;
        if (personaFilter && t.assignedPersona !== personaFilter) return false;
        if (searchLower) {
          const inTitle = t.title.toLowerCase().includes(searchLower);
          const inDesc = t.description?.toLowerCase().includes(searchLower);
          if (!inTitle && !inDesc) return false;
        }

        // Advanced filters
        if (statusFilters.length > 0 && !statusFilters.includes(t.status)) return false;
        if (dateRange?.start || dateRange?.end) {
          const ticketDate = new Date(t.createdAt);
          if (dateRange.start && ticketDate < new Date(dateRange.start)) return false;
          if (dateRange.end && ticketDate > new Date(dateRange.end)) return false;
        }

        return true;
      }),
    }));
  }, [columns, epicFilter, priorityFilter, personaFilter, searchLower, statusFilters, dateRange]);

  // Calculate filtered ticket count and notify parent
  const filteredTicketCount = useMemo(() => {
    return filteredColumns.reduce((sum, col) => sum + col.tickets.length, 0);
  }, [filteredColumns]);

  const totalTicketCount = useMemo(() => {
    return columns.reduce((sum, col) => sum + col.tickets.length, 0);
  }, [columns]);

  useEffect(() => {
    onTicketCountChange?.(filteredTicketCount);
  }, [filteredTicketCount, onTicketCountChange]);

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
    setDraggedTicketId(event.active.id as string);

    // Add subtle body effect during drag
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('dragging-active');
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if over a column or another ticket
    const isColumn = columns.some((c) => c.status === overId);
    if (isColumn) {
      overColumnRef.current = overId;
    } else {
      // Find which column and position
      for (const col of columns) {
        const idx = col.tickets.findIndex((t) => t.id === overId);
        if (idx !== -1) {
          overColumnRef.current = col.status;
          break;
        }
      }
    }
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    setDraggedTicketId(null);
    overColumnRef.current = null;

    // Reset cursor and remove visual feedback class
    document.body.style.cursor = '';
    document.body.classList.remove('dragging-active');

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the ticket's current position in store
    const currentColumn = findTicketColumn(activeId);
    if (!currentColumn) return;

    // Determine final position
    let targetColumn = currentColumn;
    let targetIndex = 0;

    const isColumn = columns.some((c) => c.status === overId);
    if (isColumn) {
      targetColumn = overId;
      const col = columns.find((c) => c.status === overId);
      targetIndex = col ? col.tickets.length : 0;
    } else {
      for (const col of columns) {
        const idx = col.tickets.findIndex((t) => t.id === overId);
        if (idx !== -1) {
          targetColumn = col.status;
          targetIndex = idx;
          break;
        }
      }
    }

    if (!currentColumn || !targetColumn || targetIndex === null) return;

    // Persist to server
    try {
      if (currentColumn !== targetColumn) {
        await apiFetch(`/tickets/${activeId}/move`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: targetColumn, sortOrder: targetIndex }),
        });
        toast.success(`Ticket moved to ${COLUMN_LABELS[targetColumn] || targetColumn}`);
      } else if (targetIndex !== 0) {
        // Reorder within same column
        await apiFetch(`/tickets/${activeId}/reorder`, {
          method: 'POST',
          body: JSON.stringify({ sortOrder: targetIndex }),
        });
      }
      moveTicketStore(activeId, targetColumn as TicketStatus, targetIndex);
    } catch (err) {
      // Revert on error — re-sync from server
      setBoard(board);
      toast.error(`Failed to move ticket: ${getClientErrorMessage(err)}`);
    }
  }, [board, columns, setBoard]);

  // Require 5px of movement before activating drag
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(pointerSensor);

  // Check if filters are active
  const hasActiveFilters = epicFilter || priorityFilter || personaFilter || searchQuery || statusFilters.length > 0 || dateRange?.start || dateRange?.end;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Filter Status Bar */}
        {hasActiveFilters && (
          <div className="px-4 py-2 border-b border-gray-800 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 flex items-center justify-between shrink-0 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414-6.414a1 1 0 00-.707 0L9.293 7.293a1 1 0 00-.707.293L2.586 7.293A1 1 0 013 8V4zm0 8v2.586a1 1 0 00.293.707l6.414-6.414a1 1 0 01.707 0L14.707 8.293a1 1 0 01.707.293L20.586 10.293a1 1 0 00.707.707V12a1 1 0 01-1 1H4a1 1 0 01-1-1V12zm0 4v2.586a1 1 0 00.293.707l6.414-6.414a1 1 0 01.707 0L14.707 14.293a1 1 0 01.707.293L20.586 16.293a1 1 0 00.707.707V16a1 1 0 01-1 1H4a1 1 0 01-1-1V16z" />
              </svg>
              <span className="text-xs text-gray-400">
                <span className="font-semibold text-indigo-300">{filteredTicketCount}</span> of{' '}
                <span className="font-semibold">{totalTicketCount}</span> tickets filtered
              </span>
            </div>
            <button
              onClick={() => {
                // Clear filters logic would go here
                toast.info('Clear all filters');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg border border-indigo-500/30 bg-indigo-600/10 hover:bg-indigo-600/20 transition-all active:scale-95"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Board Columns */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="flex gap-4 min-h-full pb-4">
            {filteredColumns.map((col) => {
              const isEmpty = col.tickets.length === 0;
              const isOverColumn = overColumnRef.current === col.status;

              return (
                <div
                  key={col.status}
                  className={`
                    flex flex-col w-60 sm:w-64 md:w-72 min-w-[240px] sm:min-w-64 md:min-w-72 shrink-0
                    rounded-xl transition-all duration-300 ease-out animate-in fade-in
                    ${COLUMN_COLORS[col.status]}
                    ${isOverColumn ? 'ring-2 ring-indigo-500/50 bg-gray-800/80 scale-[1.01] shadow-2xl shadow-indigo-500/30' : 'hover:shadow-lg hover:shadow-gray-900/10'}
                  `}
                  style={{ animationDelay: `${Object.keys(COLUMN_COLORS).indexOf(col.status) * 50}ms` }}
                >
                  {/* Column Header */}
                  <div className="px-4 py-3 flex items-center justify-between bg-gray-900/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{COLUMN_ICONS[col.status]}</span>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-200">{COLUMN_LABELS[col.status] || col.status}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Ticket count with visual indicator */}
                      <div className="relative">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
                          col.tickets.length > 0
                            ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30'
                            : 'bg-gray-800/50 text-gray-600'
                        }`}>
                          {col.tickets.length}
                        </span>
                        {/* Pulse animation for non-empty columns */}
                        {col.tickets.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full animate-ping" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Column Content */}
                  <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-[200px]">
                    {isEmpty ? (
                      <EmptyColumn
                        status={col.status}
                        hasFilters={hasActiveFilters}
                      />
                    ) : (
                      <div className="space-y-3">
                        {col.tickets.map((ticket, index) => (
                          <div
                            key={ticket.id}
                            className="animate-in slide-in-from-bottom duration-400 ease-out"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <TicketCard
                              ticket={ticket}
                              epics={board.epics || []}
                              isDragging={draggedTicketId === ticket.id}
                              onClick={() => onTicketClick?.(ticket)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay for visual feedback */}
        <DragOverlay>
          {(activeTicket) => (
            <div className="opacity-50">
              <TicketCard
                ticket={activeTicket}
                epics={board.epics || []}
                isDragging={true}
              />
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// Empty column component with helpful messaging
function EmptyColumn({ status, hasFilters }: { status: string; hasFilters: boolean }) {
  const getEmptyMessage = () => {
    if (hasFilters) {
      return 'No tickets match your filters';
    }
    switch (status) {
      case 'backlog':
        return 'No tickets in backlog';
      case 'in_progress':
        return 'No tickets in progress';
      case 'review':
        return 'No tickets under review';
      case 'qa':
        return 'No tickets in QA';
      case 'acceptance':
        return 'No tickets awaiting acceptance';
      case 'done':
        return 'No completed tickets yet';
      default:
        return 'No tickets';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'backlog':
        return '📝';
      case 'in_progress':
        return '🔄';
      case 'review':
        return '👀';
      case 'qa':
        return '🔍';
      case 'acceptance':
        return '✅';
      case 'done':
        return '✓';
      default:
        return '📋';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-700/30 to-gray-600/30 flex items-center justify-center">
          <span className="text-4xl animate-bounce">{getIcon()}</span>
        </div>
        <div className="absolute inset-0 bg-gray-500/10 rounded-2xl blur-md animate-pulse" />
      </div>
      <p className="text-gray-500 text-sm mb-2">{getEmptyMessage()}</p>
      {hasFilters && (
        <p className="text-gray-600 text-xs">Try adjusting your filters</p>
      )}
    </div>
  );
}
