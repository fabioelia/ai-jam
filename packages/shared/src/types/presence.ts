export interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  context: 'board' | 'ticket' | 'feature';
  contextId: string;
  connectedAt: number;
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  userId: string | null;
  userName: string | null;
  avatarUrl: string | null;
  targetId: string;
  targetType: 'ticket' | 'comment' | 'reaction' | 'attention' | 'agent' | 'notification';
  description: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}
