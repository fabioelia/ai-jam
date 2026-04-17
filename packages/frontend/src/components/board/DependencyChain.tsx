import type { DependencyChain, TicketStatus, TicketPriority } from '@ai-jam/shared';

const STATUS_COLORS: Record<TicketStatus, string> = {
  backlog: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  qa: 'bg-yellow-500',
  acceptance: 'bg-orange-500',
  done: 'bg-green-500',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  qa: 'QA',
  acceptance: 'Acceptance',
  done: 'Done',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-blue-400',
  low: 'text-gray-400',
};

interface DependencyChainProps {
  chain: DependencyChain;
  onTicketClick?: (ticketId: string) => void;
}

interface TreeNodeProps {
  ticket: DependencyChain['upstream'][number];
  onTicketClick?: (ticketId: string) => void;
  isLast?: boolean;
}

function TreeNode({ ticket, onTicketClick, isLast = false }: TreeNodeProps) {
  const handleClick = () => {
    if (onTicketClick) {
      onTicketClick(ticket.ticket.id);
    }
  };

  return (
    <div className="flex items-start gap-2">
      {/* Tree connector line */}
      <div className="flex flex-col items-center pt-2">
        <div className={`w-0.5 h-4 bg-gray-600 ${isLast ? 'hidden' : ''}`} />
        <div className={`w-0.5 h-full bg-gray-600 ${ticket.depth === 1 ? 'hidden' : ''}`} />
      </div>

      {/* Ticket node */}
      <div
        onClick={handleClick}
        className={`flex-1 min-w-0 p-2 rounded-lg border transition-colors ${
          onTicketClick
            ? 'bg-gray-800 border-gray-700 hover:border-gray-600 cursor-pointer'
            : 'bg-gray-850 border-gray-750'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[ticket.ticket.status]}`} />
          <span className="text-xs text-gray-400 flex-shrink-0">
            {STATUS_LABELS[ticket.ticket.status]}
          </span>
          {ticket.ticket.priority !== 'medium' && (
            <span className={`text-xs capitalize ${PRIORITY_COLORS[ticket.ticket.priority]}`}>
              {ticket.ticket.priority}
            </span>
          )}
        </div>
        <p className="text-sm text-white truncate" title={ticket.ticket.title}>
          {ticket.ticket.title}
        </p>
      </div>
    </div>
  );
}

export default function DependencyChain({ chain, onTicketClick }: DependencyChainProps) {
  const hasUpstream = chain.upstream.length > 0;
  const hasDownstream = chain.downstream.length > 0;

  if (!hasUpstream && !hasDownstream) {
    return (
      <div className="text-sm text-gray-500 italic">
        No dependencies
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upstream dependencies (this ticket depends on these) */}
      {hasUpstream && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <span className="text-red-400">↑</span>
            Depends on ({chain.upstream.length})
          </h4>
          <div className="space-y-1 pl-2 border-l-2 border-red-900/50">
            {chain.upstream.map((node, index) => (
              <TreeNode
                key={node.ticket.id}
                ticket={node}
                onTicketClick={onTicketClick}
                isLast={index === chain.upstream.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Downstream dependencies (tickets that depend on this one) */}
      {hasDownstream && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <span className="text-green-400">↓</span>
            Blocks ({chain.downstream.length})
          </h4>
          <div className="space-y-1 pl-2 border-l-2 border-green-900/50">
            {chain.downstream.map((node, index) => (
              <TreeNode
                key={node.ticket.id}
                ticket={node}
                onTicketClick={onTicketClick}
                isLast={index === chain.downstream.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
