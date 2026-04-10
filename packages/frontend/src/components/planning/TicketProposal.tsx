import { useApproveProposal, useRejectProposal } from '../../api/mutations.js';
import type { TicketProposal as TicketProposalType, ProposedTicketData } from '@ai-jam/shared';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-blue-500/20 text-blue-400',
  low: 'bg-gray-500/20 text-gray-400',
};

interface TicketProposalProps {
  proposal: TicketProposalType;
  featureId: string;
  onResolved?: () => void;
}

export default function TicketProposal({ proposal, featureId, onResolved }: TicketProposalProps) {
  const approve = useApproveProposal(featureId);
  const reject = useRejectProposal(featureId);
  const data = proposal.ticketData as ProposedTicketData;

  const isPending = proposal.status === 'pending' || proposal.status === 'edited';
  const isApproved = proposal.status === 'approved';
  const isRejected = proposal.status === 'rejected';

  async function handleApprove() {
    await approve.mutateAsync(proposal.id);
    onResolved?.();
  }

  async function handleReject() {
    await reject.mutateAsync(proposal.id);
    onResolved?.();
  }

  return (
    <div
      className={`rounded-lg border p-3 ${
        isApproved
          ? 'border-green-600/50 bg-green-900/10'
          : isRejected
            ? 'border-red-600/50 bg-red-900/10 opacity-60'
            : 'border-gray-700 bg-gray-800/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white truncate">{data.title}</h4>
            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_COLORS[data.priority] || ''}`}>
              {data.priority}
            </span>
            {data.storyPoints && (
              <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded shrink-0">
                {data.storyPoints}pt
              </span>
            )}
          </div>

          {data.epicTitle && (
            <p className="text-xs text-gray-500 mb-1">Epic: {data.epicTitle}</p>
          )}

          {data.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-1">{data.description}</p>
          )}

          {data.acceptanceCriteria && data.acceptanceCriteria.length > 0 && (
            <div className="mt-1.5">
              <p className="text-xs text-gray-500 mb-0.5">Acceptance Criteria:</p>
              <ul className="text-xs text-gray-400 space-y-0.5">
                {data.acceptanceCriteria.slice(0, 3).map((c, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-gray-600">-</span>
                    <span className="line-clamp-1">{c}</span>
                  </li>
                ))}
                {data.acceptanceCriteria.length > 3 && (
                  <li className="text-gray-600">+{data.acceptanceCriteria.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Status badge or action buttons */}
        {isPending ? (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleApprove}
              disabled={approve.isPending}
              className="bg-green-600/20 hover:bg-green-600/30 text-green-400 px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={handleReject}
              disabled={reject.isPending}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : (
          <span
            className={`text-xs px-2 py-0.5 rounded shrink-0 ${
              isApproved ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
            }`}
          >
            {isApproved ? 'Approved' : 'Rejected'}
          </span>
        )}
      </div>
    </div>
  );
}
