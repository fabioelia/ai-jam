import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, joinBoard, leaveBoard } from '../api/socket.js';
import { useBoardStore } from '../stores/board-store.js';
import type { Ticket, TicketStatus } from '@ai-jam/shared';

export function useBoardSync(projectId: string) {
  const qc = useQueryClient();
  const addTicket = useBoardStore((s) => s.addTicket);
  const updateTicket = useBoardStore((s) => s.updateTicket);
  const moveTicket = useBoardStore((s) => s.moveTicket);
  const removeTicket = useBoardStore((s) => s.removeTicket);

  useEffect(() => {
    if (!projectId) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    joinBoard(projectId);

    socket.on('board:ticket:created', ({ ticket }) => {
      addTicket(ticket);
    });

    socket.on('board:ticket:updated', ({ ticketId, changes }) => {
      updateTicket(ticketId, changes);
    });

    socket.on('board:ticket:moved', ({ ticketId, toStatus, sortOrder }) => {
      moveTicket(ticketId, toStatus as TicketStatus, sortOrder);
    });

    socket.on('board:ticket:deleted', ({ ticketId }) => {
      removeTicket(ticketId);
    });

    return () => {
      leaveBoard(projectId);
      socket.off('board:ticket:created');
      socket.off('board:ticket:updated');
      socket.off('board:ticket:moved');
      socket.off('board:ticket:deleted');
    };
  }, [projectId, addTicket, updateTicket, moveTicket, removeTicket]);
}
