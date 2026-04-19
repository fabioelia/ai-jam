import type { PresenceUser } from '@ai-jam/shared';

type ContextKey = string; // `${context}:${contextId}`

const presenceMap = new Map<ContextKey, Map<string, PresenceUser>>();
const typingMap = new Map<string, Set<string>>(); // userId -> Set<ticketId>
const typingLastAt = new Map<string, number>();

const TYPING_TIMEOUT_MS = 5000;

function ctxKey(context: string, contextId: string): ContextKey {
  return `${context}:${contextId}`;
}

export function getUsersInContext(context: string, contextId: string): PresenceUser[] {
  return Array.from(presenceMap.get(ctxKey(context, contextId))?.values() ?? []);
}

export function setPresence(user: Omit<PresenceUser, 'connectedAt'>): PresenceUser[] {
  const key = ctxKey(user.context, user.contextId);
  const bucket = presenceMap.get(key) ?? new Map<string, PresenceUser>();
  bucket.set(user.userId, { ...user, connectedAt: Date.now() });
  presenceMap.set(key, bucket);
  return Array.from(bucket.values());
}

export function removePresence(userId: string, context: string, contextId: string): PresenceUser[] {
  const key = ctxKey(context, contextId);
  const bucket = presenceMap.get(key);
  if (bucket) {
    bucket.delete(userId);
    if (bucket.size === 0) presenceMap.delete(key);
    return Array.from(bucket.values());
  }
  return [];
}

export function removeAllPresence(userId: string): string[] {
  const affectedKeys: ContextKey[] = [];
  for (const [key, bucket] of presenceMap) {
    if (bucket.has(userId)) {
      bucket.delete(userId);
      affectedKeys.push(key);
      if (bucket.size === 0) presenceMap.delete(key);
    }
  }
  // Also clear typing state
  typingMap.delete(userId);
  return affectedKeys;
}

// Typing
export function setTyping(userId: string, userName: string, ticketId: string) {
  let tickets = typingMap.get(userId);
  if (!tickets) {
    tickets = new Set<string>();
    typingMap.set(userId, tickets);
  }
  tickets.add(ticketId);
  typingLastAt.set(`${userId}:${ticketId}`, Date.now());
}

export function clearTyping(userId: string, ticketId: string) {
  const tickets = typingMap.get(userId);
  if (tickets) {
    tickets.delete(ticketId);
    if (tickets.size === 0) typingMap.delete(userId);
  }
  typingLastAt.delete(`${userId}:${ticketId}`);
}

export function getAllTypingUsers(ticketId: string): Map<string, string> {
  // userId -> userName
  const result = new Map<string, string>();
  const now = Date.now();
  for (const [userId, tickets] of typingMap) {
    if (tickets.has(ticketId)) {
      const key = `${userId}:${ticketId}`;
      const last = typingLastAt.get(key) ?? 0;
      if (now - last < TYPING_TIMEOUT_MS) {
        const userName = userId; // will be enriched by socket.data.userName in the handler
        result.set(userId, userName);
      } else {
        // Expired — clean up
        clearTyping(userId, ticketId);
      }
    }
  }
  return result;
}
