import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TicketCard from './TicketCard.js';
import type { Ticket, Epic } from '@ai-jam/shared';

interface SortableTicketCardProps {
  ticket: Ticket;
  epics: Epic[];
  onClick?: () => void;
}

export default function SortableTicketCard({ ticket, epics, onClick }: SortableTicketCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} epics={epics} onClick={onClick} />
    </div>
  );
}
