import { useState } from 'react';
import type { Comment } from '@ai-jam/shared';

interface CommentThreadProps {
  comments: Comment[];
  currentUserId: string;
  onAddComment: (body: string) => Promise<void>;
}

export default function CommentThread({ comments, currentUserId, onAddComment }: CommentThreadProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(body.trim());
      setBody('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-gray-600 text-xs italic">No comments yet</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-gray-800/50 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-300">
                  {comment.userId === currentUserId ? 'You' : comment.userId.slice(0, 8)}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
