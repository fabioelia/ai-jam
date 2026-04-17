import { useState, useRef, useEffect } from 'react';
import type { Comment } from '@ai-jam/shared';

interface CommentThreadProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (body: string) => Promise<void>;
}

export default function CommentThread({ comments, currentUserId, onAddComment }: CommentThreadProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // Clear success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      await onAddComment(body.trim());
      setBody('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
      // Focus back on textarea on error
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (body.trim() && !submitting) {
        handleSubmit(e);
      }
    }
  }

  function formatCommentDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="space-y-3">
      {/* Comment list */}
      <div
        className="space-y-3 max-h-64 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Comments"
      >
        {comments.length === 0 ? (
          <p className="text-gray-600 text-xs italic py-2" role="status">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          <>
            {comments.map((comment, index) => (
              <article
                key={comment.id}
                className={`bg-gray-800/50 rounded-lg px-3 py-2.5 transition-all ${
                  index === comments.length - 1 ? 'ring-2 ring-indigo-500/30' : ''
                }`}
                aria-label={`Comment by ${comment.userId === currentUserId ? 'you' : comment.userId.slice(0, 8)}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-300">
                    {comment.userId === currentUserId ? (
                      <span className="text-indigo-400">You</span>
                    ) : (
                      comment.userId.slice(0, 8)
                    )}
                  </span>
                  <time
                    className="text-xs text-gray-500"
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                  >
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                  {comment.body}
                </p>
              </article>
            ))}
            <div ref={commentsEndRef} />
          </>
        )}
      </div>

      {/* Success message */}
      {success && (
        <div
          className="bg-green-900/20 border border-green-800/50 rounded-lg px-3 py-2 text-sm text-green-400 flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">✓</span>
          Comment added successfully
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-sm text-red-400 flex items-center gap-2"
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <label htmlFor="comment-input" className="sr-only">
            Add a comment
          </label>
          <textarea
            ref={textareaRef}
            id="comment-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... (Cmd/Ctrl+Enter to send)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[60px] transition-all"
            rows={2}
            disabled={submitting}
            aria-describedby="comment-hint"
          />
          <span
            id="comment-hint"
            className="text-xs text-gray-500 absolute bottom-2 right-2"
          >
            {body.length} / 1000
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Enter</kbd> to submit
          </p>
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            className="bg-indigo-600 hover:bg-indigo-500 focus:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <svg
                  className="animate-spin h-3 w-3 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Sending...
              </>
            ) : (
              <>
                Send
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
