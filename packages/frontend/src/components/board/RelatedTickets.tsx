import { useState } from 'react';
import type { Ticket, Epic } from '@ai-jam/shared';

interface RelatedTicketsProps {
  ticket: Ticket;
  allTickets: Ticket[];
  epics: Epic[];
  onTicketClick?: (ticketId: string) => void;
}

interface RelatedGroup {
  title: string;
  tickets: Ticket[];
  type: 'same-epic' | 'similar-title' | 'same-author' | 'blocking' | 'dependent';
}

export default function RelatedTickets({ ticket, allTickets, epics, onTicketClick }: RelatedTicketsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['same-epic']));

  const toggleGroup = (type: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedGroups(newExpanded);
  };

  // Find related tickets
  const findRelatedTickets = (): RelatedGroup[] => {
    const groups: RelatedGroup[] = [];

    // Tickets in same epic
    if (ticket.epicId) {
      const sameEpicTickets = allTickets.filter(t => t.epicId === ticket.epicId && t.id !== ticket.id);
      if (sameEpicTickets.length > 0) {
        groups.push({
          title: 'Same Epic',
          tickets: sameEpicTickets,
          type: 'same-epic',
        });
      }
    }

    // Tickets with similar titles (simple matching)
    const titleWords = ticket.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const similarTitleTickets = allTickets.filter(t => {
      if (t.id === ticket.id) return false;
      const tWords = t.title.toLowerCase().split(/\s+/);
      return titleWords.some(word => tWords.some(tw => tw.includes(word)));
    }).slice(0, 5); // Limit to 5

    if (similarTitleTickets.length > 0) {
      groups.push({
        title: 'Similar Tickets',
        tickets: similarTitleTickets,
        type: 'similar-title',
      });
    }

    // Tickets created by same user
    const sameAuthorTickets = allTickets.filter(t => t.createdBy === ticket.createdBy && t.id !== ticket.id);
    if (sameAuthorTickets.length > 0) {
      groups.push({
        title: 'Created by Same User',
        tickets: sameAuthorTickets.slice(0, 5),
        type: 'same-author',
      });
    }

    // Tickets with same priority
    const samePriorityTickets = allTickets.filter(t => t.priority === ticket.priority && t.id !== ticket.id && t.status !== 'done');
    if (samePriorityTickets.length > 0) {
      groups.push({
        title: `Same Priority (${ticket.priority})`,
        tickets: samePriorityTickets.slice(0, 5),
        type: 'blocking', // Reusing type for simplicity
      });
    }

    return groups;
  };

  const relatedGroups = findRelatedTickets();

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-gray-500/20 text-gray-400',
    };
    return colors[priority] || colors.low;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      backlog: 'bg-gray-600',
      in_progress: 'bg-blue-500',
      review: 'bg-yellow-500',
      qa: 'bg-orange-500',
      acceptance: 'bg-purple-500',
      done: 'bg-green-500',
    };
    return colors[status] || colors.backlog;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Related Tickets</h3>

      {relatedGroups.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-xs text-gray-600">No related tickets found</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {relatedGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.type);

            return (
              <div key={group.type} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.type)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800 hover:shadow-sm hover:shadow-gray-900/10 active:bg-gray-700 active:scale-[0.99] transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-medium text-gray-300">{group.title}</span>
                    <span className="text-xs text-gray-500">({group.tickets.length})</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {group.tickets.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onTicketClick?.(t.id)}
                        className="w-full text-left p-2 rounded-lg bg-gray-900/50 hover:bg-gray-800 hover:shadow-sm hover:shadow-gray-900/10 hover:-translate-y-0.5 transition-all duration-200 border border-gray-700 hover:border-gray-600"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-medium text-white truncate">{t.title}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(t.status)}`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded ${getPriorityColor(t.priority)} capitalize`}>
                            {t.priority}
                          </span>
                          <span className="text-gray-500">#{t.id.slice(0, 8)}</span>
                        </div>
                        {t.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
