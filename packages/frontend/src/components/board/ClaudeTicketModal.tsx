import { useState, useRef, useEffect } from 'react';
import { useCreateClaudeTicket } from '../../api/mutations.js';
import { toast } from '../../stores/toast-store.js';

interface ClaudeTicketModalProps {
  projectId: string;
  featureId: string;
  onClose: () => void;
}

interface Attachment {
  id: string;
  type: 'image' | 'document';
  mimeType: string;
  url: string;
  filename: string;
  size: number;
}

interface DependencySuggestion {
  ticketId: string;
  ticket: { id: string; title: string; status: string; priority: string };
  relationship: 'blocks' | 'blocked_by' | 'related';
  confidence: number;
  reason: string;
}

export default function ClaudeTicketModal({ projectId, featureId, onClose }: ClaudeTicketModalProps) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [suggestions, setSuggestions] = useState<DependencySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [acceptedDependencies, setAcceptedDependencies] = useState<string[]>([]);

  const createTicket = useCreateClaudeTicket(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamedResponse]);

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsStreaming(true);
    setStreamedResponse('');
    setShowPreview(true);
    setSuggestions([]);
    setAcceptedDependencies([]);

    try {
      const result = await createTicket.mutateAsync({
        userPrompt: prompt,
        featureId,
        attachments: attachments.map(a => ({ id: a.id, type: a.type, mimeType: a.mimeType, url: a.url })),
        onStream: (delta) => {
          setStreamedResponse(prev => prev + delta);
        },
      });

      if ('ticket' in result) {
        // After successful creation, fetch dependency suggestions
        const generatedTicket = result.ticket;
        fetchSuggestions(generatedTicket.title, generatedTicket.description, generatedTicket.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket';
      toast.error(message);
      setIsStreaming(false);
    }
  }

  async function fetchSuggestions(title: string, description: string | null, excludeTicketId: string) {
    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/tickets/suggest-dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ title, description, excludeTicketId }),
      });

      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Failed to fetch dependency suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  function toggleAccepted(ticketId: string) {
    setAcceptedDependencies(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  }

  function dismissSuggestion(ticketId: string) {
    setSuggestions(prev => prev.filter(s => s.ticketId !== ticketId));
  }

  function handleRemoveAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setAttachments(prev => [...prev, data.attachment]);
      toast.success('File uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload file');
    }

    e.target.value = '';
  }

  // Relationship badge color
  function relationshipColor(r: string) {
    if (r === 'blocked_by') return 'bg-red-900/40 text-red-300 border-red-700/50';
    if (r === 'blocks') return 'bg-amber-900/40 text-amber-300 border-amber-700/50';
    return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
  }

  function relationshipIcon(r: string) {
    if (r === 'blocked_by') return '\u2B06\uFE0F';
    if (r === 'blocks') return '\u2B07\uFE0F';
    return '\uD83D\uDD17';
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span className="text-indigo-400">\u2728</span>
            Create Ticket with Claude
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showPreview ? (
            <>
              <p className="text-gray-400 text-sm mb-4">
                Describe what you want in plain English. Claude will help create a structured ticket with title, description, and priority.
              </p>

              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">What needs to be done?</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Add dark mode toggle to settings page with persistence in localStorage..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[120px] resize-none"
                  disabled={isStreaming}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Attachments (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.txt,.md"
                  className="hidden"
                  disabled={isStreaming}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-700 rounded-lg px-4 py-6 text-center hover:border-indigo-500 transition-colors"
                  disabled={isStreaming}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-500 text-sm">Click to upload</span>
                    <span className="text-gray-600 text-xs">Images, PDF, TXT, MD (max 10MB)</span>
                  </div>
                </button>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                        <span className="text-xl">{att.type === 'image' ? '\uD83D\uDDBC\uFE0F' : '\uD83D\uDCC4'}</span>
                        <span className="flex-1 text-sm text-gray-300 truncate">{att.filename}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {isStreaming ? (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-indigo-400 text-sm mb-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                    Claude is generating...
                  </div>
                  <div className="bg-gray-800 border border-indigo-500/30 rounded-lg p-4 min-h-[150px]">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {streamedResponse}
                    </pre>
                    <div ref={streamEndRef} />
                  </div>
                </div>
              ) : suggestions.length > 0 || isLoadingSuggestions ? (
                <>
                  {/* Ticket created, now showing dependency suggestions */}
                  <div className="text-center py-4">
                    <div className="text-4xl mb-2">\u2705</div>
                    <h3 className="text-white font-semibold text-lg mb-1">Ticket Created!</h3>
                    <p className="text-gray-400 text-sm">Your ticket has been added to the board.</p>
                  </div>

                  {/* Dependency Suggestions */}
                  <div className="mt-4 border-t border-gray-800 pt-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      <span className="text-indigo-400">\uD83D\uDD0D</span>
                      AI Found {suggestions.length} Related Ticket(s)
                      {isLoadingSuggestions && <span className="text-gray-500 text-xs ml-2">(scanning...)</span>}
                    </h3>

                    {!isLoadingSuggestions && suggestions.length > 0 && (
                      <div className="space-y-2">
                        {suggestions.map(s => {
                          const accepted = acceptedDependencies.includes(s.ticketId);
                          return (
                            <div
                              key={s.ticketId}
                              className={`flex items-start gap-3 rounded-lg px-3 py-2 border transition-colors ${
                                accepted
                                  ? 'bg-indigo-500/10 border-indigo-500/40'
                                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={accepted}
                                onChange={() => toggleAccepted(s.ticketId)}
                                className="mt-1 w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-xs px-1.5 py-0.5 rounded border ${relationshipColor(s.relationship)}`}>
                                    {relationshipIcon(s.relationship)} {s.relationship.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-gray-500">{s.ticket.status}</span>
                                </div>
                                <p className="text-sm text-gray-200 truncate">{s.ticket.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{Math.round(s.confidence * 100)}%</span>
                                <button
                                  onClick={() => dismissSuggestion(s.ticketId)}
                                  className="text-gray-500 hover:text-gray-300 text-xs px-1"
                                  title="Dismiss suggestion"
                                >
                                  \u2715
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {acceptedDependencies.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2 text-center">
                            {acceptedDependencies.length} relationship(s) will be linked
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">\u2705</div>
                  <h3 className="text-white font-semibold text-lg mb-2">Ticket Created!</h3>
                  <p className="text-gray-400 text-sm">Your ticket has been added to the board.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isStreaming && !showPreview && (
          <div className="px-6 py-4 border-t border-gray-800 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleCreateTicket}
              disabled={!prompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Generate Ticket
            </button>
          </div>
        )}

        {/* Close button when done */}
        {!isStreaming && (isStreaming === false && showPreview) && (
          <div className="px-6 py-4 border-t border-gray-800 flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
