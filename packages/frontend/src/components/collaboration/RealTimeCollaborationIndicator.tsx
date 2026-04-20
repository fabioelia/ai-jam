import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../../api/socket.js';
import type { User } from '@ai-jam/shared';

interface ActiveUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  isViewingTicket?: boolean;
  isEditing?: boolean;
  lastActivity: number;
}

interface RealTimeCollaborationIndicatorProps {
  ticketId?: string;
  projectId?: string;
  featureId?: string;
  currentUserId: string;
  currentUser: User;
  onCollaboratorsChange?: (collaborators: ActiveUser[]) => void;
}

export default function RealTimeCollaborationIndicator({
  ticketId,
  projectId,
  featureId,
  currentUserId,
  currentUser,
  onCollaboratorsChange,
}: RealTimeCollaborationIndicatorProps) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Update parent component with collaborators
  useEffect(() => {
    onCollaboratorsChange?.(activeUsers);
  }, [activeUsers, onCollaboratorsChange]);

  // Setup socket connection and real-time collaboration
  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    let heartbeatInterval: NodeJS.Timeout;
    let cleanupTimeout: NodeJS.Timeout;

    try {
      socket = getSocket();
      setIsConnected(true);
    } catch {
      return;
    }

    // Join collaboration rooms
    if (ticketId) {
      socket.emit('join:ticket', { ticketId });
    }
    if (projectId) {
      socket.emit('join:board', { projectId });
    }
    if (featureId) {
      socket.emit('join:feature', { featureId });
    }

    // Handle presence updates
    const handlePresenceUpdate = ({ users }: { users: ActiveUser[] }) => {
      const filteredUsers = users.filter((u) => u.userId !== currentUserId);
      setActiveUsers(filteredUsers);
    };

    // Handle user started editing
    const handleUserStartedEditing = ({ userId, userName }: { userId: string; userName: string }) => {
      setActiveUsers((prev) =>
        prev.map((u) =>
          u.userId === userId
            ? { ...u, isEditing: true, lastActivity: Date.now() }
            : u
        )
      );
    };

    // Handle user stopped editing
    const handleUserStoppedEditing = ({ userId }: { userId: string }) => {
      setActiveUsers((prev) =>
        prev.map((u) =>
          u.userId === userId
            ? { ...u, isEditing: false, lastActivity: Date.now() }
            : u
        )
      );
    };

    // Handle user typing
    const handleUserTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => new Set([...prev, userId]));

      // Clear typing status after 3 seconds of no activity
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 3000);
    };

    // Send heartbeat to maintain presence
    heartbeatInterval = setInterval(() => {
      socket.emit('presence:heartbeat', {
        userId: currentUserId,
        userName: currentUser.name,
        avatarUrl: currentUser.avatarUrl,
        ticketId,
        projectId,
        featureId,
      });
    }, 30000); // Every 30 seconds

    // Cleanup inactive users periodically
    cleanupTimeout = setInterval(() => {
      const now = Date.now();
      setActiveUsers((prev) =>
        prev.filter((u) => now - u.lastActivity < 60000) // Remove users inactive for 1 minute
      );
    }, 15000); // Every 15 seconds

    // Register event listeners
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('presence:user:started-editing', handleUserStartedEditing);
    socket.on('presence:user:stopped-editing', handleUserStoppedEditing);
    socket.on('presence:user:typing', handleUserTyping);

    // Emit presence on connect
    socket.emit('presence:join', {
      userId: currentUserId,
      userName: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
      ticketId,
      projectId,
      featureId,
    });

    return () => {
      // Leave collaboration rooms
      if (ticketId) {
        socket.emit('leave:ticket', { ticketId });
      }
      if (projectId) {
        socket.emit('leave:board', { projectId });
      }
      if (featureId) {
        socket.emit('leave:feature', { featureId });
      }

      // Remove event listeners
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('presence:user:started-editing', handleUserStartedEditing);
      socket.off('presence:user:stopped-editing', handleUserStoppedEditing);
      socket.off('presence:user:typing', handleUserTyping);

      // Clear intervals
      clearInterval(heartbeatInterval);
      clearInterval(cleanupTimeout);

      // Emit presence leave
      socket.emit('presence:leave', {
        userId: currentUserId,
        ticketId,
        projectId,
        featureId,
      });
    };
  }, [currentUserId, currentUser, ticketId, projectId, featureId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    try {
      const socket = getSocket();
      socket.emit('presence:typing', {
        userId: currentUserId,
        ticketId,
        projectId,
      });
    } catch {
      // Socket not connected
    }
  }, [currentUserId, ticketId, projectId]);

  // Send editing state
  const sendEditingState = useCallback((isEditing: boolean) => {
    try {
      const socket = getSocket();
      socket.emit(isEditing ? 'presence:editing:start' : 'presence:editing:stop', {
        userId: currentUserId,
        ticketId,
        projectId,
      });
    } catch {
      // Socket not connected
    }
  }, [currentUserId, ticketId, projectId]);

  if (activeUsers.length === 0) {
    return null;
  }

  const editingUsers = activeUsers.filter((u) => u.isEditing);
  const typingUsersList = activeUsers.filter((u) => typingUsers.has(u.userId));

  return (
    <div className="flex items-center gap-2">
      {/* Active Users Avatars */}
      <div className="flex items-center -space-x-2">
        {activeUsers.slice(0, 5).map((user, index) => (
          <div
            key={user.userId}
            className={`
              w-7 h-7 rounded-full border-2 border-gray-900 flex items-center justify-center
              bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-medium text-white
              relative transition-all hover:scale-110 hover:z-10 cursor-default
              ${user.isEditing ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900' : ''}
              ${typingUsers.has(user.userId) ? 'animate-pulse' : ''}
            `}
            style={{ zIndex: activeUsers.length - index }}
            title={`${user.userName}${user.isEditing ? ' is editing' : ''}${typingUsers.has(user.userId) ? ' is typing...' : ''}`}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.userName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.userName.charAt(0).toUpperCase()
            )}
            {/* Online indicator */}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-gray-900 rounded-full" />
            {/* Editing indicator */}
            {user.isEditing && (
              <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-400 border-2 border-gray-900 rounded-full" />
            )}
          </div>
        ))}

        {/* More users indicator */}
        {activeUsers.length > 5 && (
          <div
            className="w-7 h-7 rounded-full border-2 border-gray-900 bg-gray-700 text-xs font-medium text-white flex items-center justify-center relative"
            style={{ zIndex: 0 }}
            title={`${activeUsers.length - 5} more users`}
          >
            +{activeUsers.length - 5}
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-xs text-gray-400">
          {activeUsers.length} {activeUsers.length === 1 ? 'person' : 'people'} viewing
        </span>
      </div>

      {/* Activity status */}
      {(editingUsers.length > 0 || typingUsersList.length > 0) && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {editingUsers.length > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2h2.828l-8.586-8.586z" />
              </svg>
              {editingUsers.length} {editingUsers.length === 1 ? 'editing' : 'editing'}
            </span>
          )}
          {typingUsersList.length > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {typingUsersList.length} {typingUsersList.length === 1 ? 'typing' : 'typing'}
            </span>
          )}
        </div>
      )}

      {/* Connection status */}
      {!isConnected && (
        <div className="flex items-center gap-1 text-xs text-red-400">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Disconnected
        </div>
      )}
    </div>
  );
}
