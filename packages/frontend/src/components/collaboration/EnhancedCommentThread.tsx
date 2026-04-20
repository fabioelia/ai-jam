import { useState, useRef, useEffect, useCallback } from 'react';
import type { Comment, User, ProjectMember } from '@ai-jam/shared';
import { useAuthStore } from '../../stores/auth-store.js';
import { toast } from '../../stores/toast-store.js';

interface EnhancedCommentThreadProps {
  comments: Comment[];
  ticketId: string;
  projectId: string;
  onAddComment: (body: string, mentionedUserIds: string[]) => Promise<void>;
  onReply: (commentId: string, body: string, mentionedUserIds: string[]) => Promise<void>;
  users?: User[];
  projectMembers?: ProjectMember[];
}

interface CommentNode {
  comment: Comment;
  replies: Comment[];
  depth: number;
}

interface Mention {
  userId: string;
  userName: string;
  start: number;
  end: number;
}

export default function EnhancedCommentThread({
  comments,
  ticketId,
  projectId,
  onAddComment,
  onReply,
  users = [],
  projectMembers = [],
}: EnhancedCommentThreadProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [activeMention, setActiveMention] = useState<Mention | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const currentUser = useAuthStore((s) => s.user);

  // Build comment tree with threading
  const commentTree = useCallback((): CommentNode[] => {
    const nodes = new Map<string, CommentNode>();
    const rootComments: CommentNode[] = [];

    // Initialize nodes
    comments.forEach((comment) => {
      nodes.set(comment.id, { comment, replies: [], depth: 0 });
    });

    // Build tree structure
    comments.forEach((comment) => {
      const node = nodes.get(comment.id);
      if (!node) return;

      // Extract parent comment ID from metadata or from comment body parsing
      const parentId = extractParentId(comment);
      if (parentId && nodes.has(parentId)) {
        const parentNode = nodes.get(parentId)!;
        parentNode.replies.push(comment);
        node.depth = parentNode.depth + 1;
      } else {
        rootComments.push(node);
      }
    });

    // Sort replies within each thread
    const sortTree = (nodes: CommentNode[]): CommentNode[] => {
      return nodes
        .sort((a, b) => new Date(a.comment.createdAt).getTime() - new Date(b.comment.createdAt).getTime())
        .map((node) => ({
          ...node,
          replies: sortTree(node.replies),
        }));
    };

    return sortTree(rootComments);
  }, [comments]);

  // Get available users for mentions
  const availableUsers = useCallback(() => {
    const memberUsers = projectMembers.map((member) => {
      const user = users.find((u) => u.id === member.userId);
      return user ? { ...user, role: member.role } : null;
    }).filter(Boolean) as Array<User & { role: string }>;

    // Include current user if not in members
    if (currentUser && !memberUsers.find((u) => u.id === currentUser.id)) {
      memberUsers.push({ ...currentUser, role: 'owner' });
    }

    return memberUsers;
  }, [projectMembers, users, currentUser]);

  // Find mentions in text
  const findMentions = useCallback((text: string): Mention[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const mentions: Mention[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const userName = match[1].trim();
      const user = availableUsers().find((u) => u.name.toLowerCase() === userName.toLowerCase());
      if (user) {
        mentions.push({
          userId: user.id,
          userName: user.name,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return mentions;
  }, [availableUsers]);

  // Filter mentions based on query
  const filteredMentionUsers = useCallback(() => {
    const users = availableUsers();
    if (!mentionQuery) return users.slice(0, 8);

    const query = mentionQuery.toLowerCase();
    return users
      .filter((user) => user.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [mentionQuery, availableUsers]);

  // Handle text input with mention detection
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBody(text);

    // Check for @ symbol and potential mention
    const cursorPos = e.target.selectionStart;
    const beforeCursor = text.substring(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }

    // Update mentioned users
    const mentions = findMentions(text);
    const userIds = new Set(mentions.map((m) => m.userId));
    setMentionedUserIds(userIds);
  }, [findMentions]);

  // Handle mention selection
  const handleSelectMention = useCallback((user: User & { role: string }) => {
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const text = body;
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);

    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const newText = text.substring(0, mentionMatch.index) + `@${user.name} ` + afterCursor;
      setBody(newText);
      setShowMentionSuggestions(false);
      setMentionQuery('');
      setMentionedUserIds((prev) => new Set([...prev, user.id]));

      // Focus and move cursor after mention
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          mentionMatch.index + user.name.length + 2,
          mentionMatch.index + user.name.length + 2
        );
      }, 0);
    }
  }, [body]);

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

  // Click outside to close mention suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(event.target as Node)) {
        setShowMentionSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      await onAddComment(body.trim(), Array.from(mentionedUserIds));
      setBody('');
      setMentionedUserIds(new Set());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(commentId: string) {
    if (!replyBody.trim()) return;

    setSubmittingReply(true);
    try {
      const mentions = findMentions(replyBody);
      const userIds = new Set(mentions.map((m) => m.userId));
      await onReply(commentId, replyBody.trim(), Array.from(userIds));
      setReplyBody('');
      setReplyingTo(null);
      toast.success('Reply added successfully');
    } catch (err) {
      toast.error('Failed to add reply');
    } finally {
      setSubmittingReply(false);
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

  function getUserDisplayName(userId: string): string {
    const user = users.find((u) => u.id === userId);
    if (!user) return userId.slice(0, 8);
    return currentUser?.id === userId ? 'You' : user.name;
  }

  function getUserAvatar(userId: string): string {
    const user = users.find((u) => u.id === userId);
    return user?.avatarUrl || '';
  }

  function extractParentId(comment: Comment): string | null {
    try {
      const metadata = comment as Comment & { metadata?: { parentCommentId?: string } };
      return metadata.metadata?.parentCommentId || null;
    } catch {
      return null;
    }
  }

  function getReplyCount(commentId: string): number {
    const count = comments.filter((c) => {
      const parentId = extractParentId(c);
      return parentId === commentId;
    }).length;
    return count;
  }

  function toggleThreadExpansion(commentId: string) {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }

  function renderComment(node: CommentNode) {
    const { comment, replies, depth } = node;
    const isCurrentUser = currentUser?.id === comment.userId;
    const replyCount = getReplyCount(comment.id);
    const isExpanded = expandedThreads.has(comment.id);
    const hasReplies = replies.length > 0 || replyCount > 0;

    return (
      <div key={comment.id} className="animate-in fade-in duration-300">
        <article
          className={`
            bg-gray-800/50 rounded-lg px-4 py-3 transition-all
            hover:bg-gray-800/70 hover:shadow-sm hover:shadow-gray-900/10
            ${depth > 0 ? 'ml-6 mt-2 border-l-2 border-indigo-500/30' : 'mb-3'}
            ${isCurrentUser ? 'ring-1 ring-indigo-500/20' : ''}
          `}
          aria-label={`Comment by ${getUserDisplayName(comment.userId)}`}
        >
          {/* Comment Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                {getUserAvatar(comment.userId) ? (
                  <img
                    src={getUserAvatar(comment.userId)}
                    alt={getUserDisplayName(comment.userId)}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getUserDisplayName(comment.userId).charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isCurrentUser ? 'text-indigo-400' : 'text-gray-300'}`}>
                    {getUserDisplayName(comment.userId)}
                  </span>
                  <time
                    className="text-xs text-gray-500"
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                  >
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </div>
              </div>
            </div>
          </div>

          {/* Comment Body */}
          <div className="mt-2 pl-9">
            <p className="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
              {renderCommentWithMentions(comment.body)}
            </p>
          </div>

          {/* Comment Actions */}
          <div className="mt-2 flex items-center gap-2 pl-9">
            <button
              onClick={() => {
                if (replyingTo === comment.id) {
                  setReplyingTo(null);
                } else {
                  setReplyingTo(comment.id);
                  setReplyBody(`@${getUserDisplayName(comment.userId)} `);
                }
              }}
              className="text-xs text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Reply
            </button>
            {hasReplies && (
              <button
                onClick={() => toggleThreadExpansion(comment.id)}
                className="text-xs text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>

          {/* Reply Input */}
          {replyingTo === comment.id && (
            <div className="mt-3 pl-9">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (replyBody.trim() && !submittingReply) {
                      handleReply(comment.id);
                    }
                  }
                }}
                placeholder={`Reply to ${getUserDisplayName(comment.userId)}... (Cmd/Ctrl+Enter to send)`}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
                rows={2}
                disabled={submittingReply}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-xs text-gray-500 hover:text-gray-400 px-2 py-1 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={!replyBody.trim() || submittingReply}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-3 py-1 rounded transition-colors flex items-center gap-1"
                >
                  {submittingReply ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reply'
                  )}
                </button>
              </div>
            </div>
          )}
        </article>

        {/* Render Replies */}
        {hasReplies && isExpanded && replies.map((reply) => renderComment({ comment: reply, replies: [], depth: depth + 1 }))}
      </div>
    );
  }

  function renderCommentWithMentions(body: string): React.ReactNode {
    const parts: Array<{ type: 'text' | 'mention'; content: string; userId?: string }> = [];
    let lastIndex = 0;
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    let match;

    while ((match = mentionRegex.exec(body)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: body.substring(lastIndex, match.index) });
      }

      // Check if it's a valid user mention
      const userName = match[1].trim();
      const user = availableUsers().find((u) => u.name.toLowerCase() === userName.toLowerCase());

      if (user) {
        parts.push({ type: 'mention', content: `@${user.name}`, userId: user.id });
      } else {
        parts.push({ type: 'text', content: match[0] });
      }

      lastIndex = mentionRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < body.length) {
      parts.push({ type: 'text', content: body.substring(lastIndex) });
    }

    return parts.map((part, index) =>
      part.type === 'mention' ? (
        <span key={index} className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-medium">
          @{part.content.substring(1)}
        </span>
      ) : (
        <span key={index}>{part.content}</span>
      )
    );
  }

  const tree = commentTree();

  return (
    <div className="space-y-4">
      {/* Comment List */}
      <div
        className="space-y-2 max-h-96 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Comments"
      >
        {comments.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 animate-in scale-in duration-300">
              <svg className="w-6 h-6 text-gray-600 animate-in fade-in duration-300 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm italic animate-in fade-in duration-300 delay-200">
              No comments yet. Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <>
            {tree.map((node) => renderComment(node))}
            <div ref={commentsEndRef} />
          </>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div
          className="bg-green-900/20 border border-green-800/50 rounded-lg px-4 py-3 text-sm text-green-400 flex items-center gap-2 animate-in fade-in duration-200"
          role="status"
          aria-live="polite"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Comment added successfully
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2 animate-shake animate-in fade-in duration-200"
          role="alert"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <label htmlFor="comment-input" className="sr-only">
            Add a comment
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="comment-input"
              value={body}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (body.trim() && !submitting) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="Add a comment... Use @ to mention team members"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[80px] transition-all"
              rows={3}
              disabled={submitting}
              aria-describedby="comment-hint"
            />

            {/* Mention Suggestions */}
            {showMentionSuggestions && (
              <div
                ref={mentionRef}
                className="absolute bottom-full left-0 mb-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 animate-in fade-in duration-150"
              >
                <div className="p-2 border-b border-gray-700">
                  <p className="text-xs text-gray-400 font-medium">Mention someone</p>
                </div>
                {filteredMentionUsers().length > 0 ? (
                  <div className="max-h-48 overflow-y-auto">
                    {filteredMentionUsers().map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectMention(user)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-gray-200">{user.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                        <kbd className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                          @{user.name.split(' ')[0]}
                        </kbd>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center">
                    <p className="text-xs text-gray-500">No users found</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <span id="comment-hint" className="text-xs text-gray-500 absolute bottom-2 right-2">
            {body.length} / 2000
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {mentionedUserIds.size > 0 && (
              <span className="text-xs text-indigo-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {mentionedUserIds.size} {mentionedUserIds.size === 1 ? 'mention' : 'mentions'}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 flex items-center gap-2 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Send Comment
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
