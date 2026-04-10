import { create } from 'zustand';
import type { Ticket, TicketStatus, BoardState, BoardColumn } from '@ai-jam/shared';
import { TICKET_STATUS_ORDER } from '@ai-jam/shared';

interface BoardStore {
  columns: BoardColumn[];
  setBoard: (board: BoardState) => void;
  moveTicket: (ticketId: string, toStatus: TicketStatus, newIndex: number) => Ticket | null;
  reorderTicket: (ticketId: string, newIndex: number) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicket: (ticketId: string, changes: Partial<Ticket>) => void;
  removeTicket: (ticketId: string) => void;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  columns: TICKET_STATUS_ORDER.map((status) => ({ status, tickets: [] })),

  setBoard: (board) => {
    set({ columns: board.columns });
  },

  moveTicket: (ticketId, toStatus, newIndex) => {
    const columns = get().columns.map((col) => ({ ...col, tickets: [...col.tickets] }));
    let ticket: Ticket | null = null;

    // Remove from source column
    for (const col of columns) {
      const idx = col.tickets.findIndex((t) => t.id === ticketId);
      if (idx !== -1) {
        [ticket] = col.tickets.splice(idx, 1);
        break;
      }
    }
    if (!ticket) return null;

    // Insert into target column
    const targetCol = columns.find((c) => c.status === toStatus);
    if (!targetCol) return null;

    const updatedTicket = { ...ticket, status: toStatus, sortOrder: newIndex };
    targetCol.tickets.splice(newIndex, 0, updatedTicket);

    // Recalculate sort orders for the target column
    targetCol.tickets.forEach((t, i) => {
      t.sortOrder = i;
    });

    set({ columns });
    return updatedTicket;
  },

  reorderTicket: (ticketId, newIndex) => {
    const columns = get().columns.map((col) => ({ ...col, tickets: [...col.tickets] }));

    for (const col of columns) {
      const oldIndex = col.tickets.findIndex((t) => t.id === ticketId);
      if (oldIndex !== -1) {
        const [ticket] = col.tickets.splice(oldIndex, 1);
        col.tickets.splice(newIndex, 0, ticket);
        col.tickets.forEach((t, i) => {
          t.sortOrder = i;
        });
        break;
      }
    }

    set({ columns });
  },

  addTicket: (ticket) => {
    const columns = get().columns.map((col) => ({ ...col, tickets: [...col.tickets] }));
    const col = columns.find((c) => c.status === ticket.status);
    if (col) {
      col.tickets.push(ticket);
      col.tickets.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    set({ columns });
  },

  updateTicket: (ticketId, changes) => {
    const columns = get().columns.map((col) => ({
      ...col,
      tickets: col.tickets.map((t) => (t.id === ticketId ? { ...t, ...changes } : t)),
    }));
    set({ columns });
  },

  removeTicket: (ticketId) => {
    const columns = get().columns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((t) => t.id !== ticketId),
    }));
    set({ columns });
  },
}));
