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

export default function ClaudeTicketModal({ projectId, featureId, onClose }: ClaudeTicketModalProps) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [showPreview, setShowPreview] = useState(false);

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
        toast.success('Ticket created successfully!');
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket';
      toast.error(message);
      setIsStreaming(false);
    }
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

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id));
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
            <span className="text-indigo-400">✨</span>
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
              {/* Description */}
              <p className="text-gray-400 text-sm mb-4">
                Describe what you want in plain English. Claude will help create a structured ticket with title, description, and priority.
              </p>

              {/* Prompt Input */}
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

              {/* Attachments */}
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
                    <span className="text-gray-500 text-sm">
                      Click to upload or drag and drop
                    </span>
                    <span className="text-gray-600 text-xs">
                      Images, PDF, TXT, MD (max 10MB)
                    </span>
                  </div>
                </button>

                {/* Attachment List */}
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                        <span className="text-xl">{att.type === 'image' ? '🖼️' : '📄'}</span>
                        <span className="flex-1 text-sm text-gray-300 truncate">{att.filename}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
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
              {/* Streaming Preview */}
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
              ) : (
                <>
                  {/* Success state */}
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">✅</div>
                    <h3 className="text-white font-semibold text-lg mb-2">Ticket Created!</h3>
                    <p className="text-gray-400 text-sm">Your ticket has been added to the board.</p>
                  </div>
                </>
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
      </div>
    </div>
  );
}
