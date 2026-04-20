import { useState } from 'react';
import type { TicketProposal as TicketProposalType } from '@ai-jam/shared';

interface ProposalComparisonProps {
  proposals: TicketProposalType[];
}

interface ProposedTicketData {
  title: string;
  description: string;
  epicTitle?: string;
  priority: string;
  storyPoints?: number;
  acceptanceCriteria?: string[];
}

export default function ProposalComparison({ proposals }: ProposalComparisonProps) {
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);

  const toggleProposal = (proposalId: string) => {
    const newSelection = new Set(selectedProposals);
    if (newSelection.has(proposalId)) {
      newSelection.delete(proposalId);
    } else if (newSelection.size < 3) {
      newSelection.add(proposalId);
    }
    setSelectedProposals(newSelection);
  };

  const proposalsToCompare = proposals.filter(p => selectedProposals.has(p.id));
  const canCompare = selectedProposals.size >= 2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Proposal Comparison</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Select 2-3 proposals to compare side by side
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              compareMode
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {compareMode ? 'Exit Compare' : 'Compare'}
          </button>
          {selectedProposals.size > 0 && (
            <button
              onClick={() => setSelectedProposals(new Set())}
              className="text-xs text-gray-500 hover:text-white"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>

      {/* Comparison mode */}
      {compareMode && (
        <>
          {/* Selection grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {proposals.map((proposal) => {
              const data = proposal.ticketData as ProposedTicketData;
              const isSelected = selectedProposals.has(proposal.id);
              const isDisabled = !isSelected && selectedProposals.size >= 3;

              return (
                <button
                  key={proposal.id}
                  onClick={() => !isDisabled && toggleProposal(proposal.id)}
                  disabled={isDisabled}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-600/10 shadow-lg shadow-indigo-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white mb-1 truncate">{data.title}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2">{data.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{data.priority}</span>
                    {data.storyPoints && (
                      <span className="text-xs text-gray-600">{data.storyPoints}pt</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Comparison view */}
          {canCompare && (
            <div className="mt-4 animate-in slide-in-from-bottom duration-300">
              <ComparisonView proposals={proposalsToCompare} />
            </div>
          )}

          {!canCompare && selectedProposals.size > 0 && (
            <div className="p-4 rounded-xl border border-dashed border-gray-700 bg-gray-800/30 text-center">
              <p className="text-sm text-gray-500">
                {selectedProposals.size === 1 ? 'Select one more proposal to compare' : ''}
              </p>
            </div>
          )}
        </>
      )}

      {/* List view (default) */}
      {!compareMode && (
        <div className="space-y-2">
          {proposals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No proposals to compare</p>
            </div>
          ) : (
            proposals.map((proposal) => {
              const data = proposal.ticketData as ProposedTicketData;
              return (
                <div
                  key={proposal.id}
                  className="p-4 rounded-xl border border-gray-700 bg-gray-800/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center text-lg">
                      📋
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-white">{data.title}</h4>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                          {data.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{data.description}</p>
                      {data.acceptanceCriteria && data.acceptanceCriteria.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-600 mb-1">Acceptance Criteria:</p>
                          <ul className="text-xs text-gray-500 space-y-0.5">
                            {data.acceptanceCriteria.slice(0, 2).map((c, i) => (
                              <li key={i} className="line-clamp-1">• {c}</li>
                            ))}
                            {data.acceptanceCriteria.length > 2 && (
                              <li className="text-gray-600">+{data.acceptanceCriteria.length - 2} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonView({ proposals }: { proposals: TicketProposalType[] }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'criteria'>('overview');

  const renderField = (label: string, values: string[]) => (
    <div className="p-3 rounded-lg bg-gray-900/50">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="space-y-1">
        {values.map((value, idx) => (
          <p key={idx} className="text-sm text-gray-300">{value || '-'}</p>
        ))}
      </div>
    </div>
  );

  const renderFieldWithDiff = (label: string, values: string[]) => {
    const uniqueValues = Array.from(new Set(values));
    const hasDiff = uniqueValues.length > 1;

    return (
      <div className={`p-3 rounded-lg ${hasDiff ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-gray-900/50'}`}>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-gray-500">{label}</p>
          {hasDiff && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-600/20 text-yellow-400">Diff</span>
          )}
        </div>
        <div className="space-y-1">
          {values.map((value, idx) => (
            <p key={idx} className="text-sm text-gray-300">{value || '-'}</p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {['overview', 'details', 'criteria'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-all ${
              activeTab === tab
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className={`grid gap-4 ${activeTab === 'criteria' ? 'grid-cols-1' : 'grid-cols-' + proposals.length}`}>
          {proposals.map((proposal, idx) => {
            const data = proposal.ticketData as ProposedTicketData;
            return (
              <div key={proposal.id} className="space-y-3">
                {/* Header */}
                <div className="p-3 rounded-lg bg-indigo-600/10 border border-indigo-600/30">
                  <h4 className="text-sm font-semibold text-white mb-1">{data.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="px-1.5 py-0.5 rounded bg-gray-700">{data.priority}</span>
                    {data.storyPoints && <span>{data.storyPoints}pt</span>}
                  </div>
                </div>

                {activeTab === 'overview' && (
                  <>
                    {renderFieldWithDiff('Priority', proposals.map(p => (p.ticketData as ProposedTicketData).priority))}
                    {renderFieldWithDiff('Story Points', proposals.map(p => String((p.ticketData as ProposedTicketData).storyPoints || '-')))}
                    {renderField('Epic', proposals.map(p => (p.ticketData as ProposedTicketData).epicTitle || '-'))}
                  </>
                )}

                {activeTab === 'details' && (
                  <>
                    {renderFieldWithDiff('Title', proposals.map(p => (p.ticketData as ProposedTicketData).title))}
                    {renderField('Description', proposals.map(p => (p.ticketData as ProposedTicketData).description))}
                    {renderField('Epic', proposals.map(p => (p.ticketData as ProposedTicketData).epicTitle || '-'))}
                  </>
                )}

                {activeTab === 'criteria' && (
                  <div className="p-3 rounded-lg bg-gray-900/50">
                    <p className="text-xs text-gray-500 mb-2">Acceptance Criteria</p>
                    <ul className="space-y-1.5">
                      {data.acceptanceCriteria?.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
