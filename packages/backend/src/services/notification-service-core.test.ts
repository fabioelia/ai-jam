/**
 * Direct unit tests for the 5 core notification-service methods:
 * createNotification, getNotifications, markRead, markAllRead, getUnreadCount
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const broadcastToUserMock = vi.fn();

// Track all DB operations for assertions
interface DbCall {
  op: 'insert' | 'select' | 'update';
  values?: unknown;
  conditions?: unknown[];
  returning?: unknown[];
  result?: unknown;
}
let dbCalls: DbCall[] = [];

let insertReturnValue: unknown[] = [];
let selectReturnValue: unknown[] = [];
let updateReturnValue: unknown[] = [];
let countReturnValue: unknown[] = [];

vi.mock('../db/connection.js', () => {
  const mock = new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      const propStr = String(prop);

      if (propStr === 'insert') {
        return () => {
          let captured: unknown = null;
          const chain: Record<string, unknown> = {};
          chain.values = (vals: unknown) => { captured = vals; return chain; };
          chain.returning = () => {
            dbCalls.push({ op: 'insert', values: captured });
            return Promise.resolve(insertReturnValue);
          };
          return chain;
        };
      }

      if (propStr === 'select') {
        return () => {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.from = self;
          chain.where = self;
          chain.orderBy = self;
          chain.limit = self;
          chain.offset = () => {
            dbCalls.push({ op: 'select' });
            return Promise.resolve(selectReturnValue);
          };
          // Allow chain to resolve without .offset()
          chain.then = (resolve: (v: unknown) => void) => {
            dbCalls.push({ op: 'select' });
            return Promise.resolve(selectReturnValue).then(resolve);
          };
          return chain;
        };
      }

      if (propStr === 'update') {
        return () => {
          const chain: Record<string, unknown> = {};
          const self = () => chain;
          chain.set = self;
          chain.where = () => {
            // Return a thenable chain that also has .returning()
            const whereResult: Record<string, unknown> = {};
            whereResult.returning = () => {
              dbCalls.push({ op: 'update' });
              return Promise.resolve(updateReturnValue);
            };
            // Also make it thenable for markAllRead (no .returning())
            whereResult.then = (resolve: (v: unknown) => void) => {
              dbCalls.push({ op: 'update' });
              return Promise.resolve(updateReturnValue).then(resolve);
            };
            return whereResult;
          };
          return chain;
        };
      }

      return () => ({});
    },
  });
  return { db: mock };
});

vi.mock('../db/schema.js', () => ({
  notifications: {
    id: 'id', projectId: 'projectId', userId: 'userId', featureId: 'featureId',
    type: 'type', isRead: 'isRead', createdAt: 'createdAt',
  },
  notificationPreferences: {
    userId: 'userId', projectId: 'projectId', notificationType: 'notificationType', enabled: 'enabled',
  },
  projectMembers: { projectId: 'projectId', userId: 'userId' },
  tickets: { id: 'id', projectId: 'projectId', featureId: 'featureId', createdBy: 'createdBy', assignedUserId: 'assignedUserId' },
  comments: { ticketId: 'ticketId', userId: 'userId' },
  features: { id: 'id', projectId: 'projectId', createdBy: 'createdBy' },
  projects: { id: 'id', ownerId: 'ownerId' },
}));

vi.mock('../websocket/socket-server.js', () => ({
  broadcastToUser: broadcastToUserMock,
}));

// Stub drizzle-orm operators — tests verify logic, not SQL generation
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  and: (...args: unknown[]) => ({ and: args }),
  ne: (col: unknown, val: unknown) => ({ ne: [col, val] }),
  desc: (col: unknown) => ({ desc: col }),
  count: () => ({ count: true }),
}));

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    dbCalls = [];
    selectReturnValue = []; // no preference override by default
  });

  it('inserts notification and returns it', async () => {
    const notif = {
      id: 'notif-1', userId: 'user-1', projectId: 'proj-1',
      type: 'ticket_moved', title: 'Ticket moved', isRead: 0,
    };
    insertReturnValue = [notif];

    const { createNotification } = await import('./notification-service.js');
    const result = await createNotification({
      userId: 'user-1', projectId: 'proj-1', type: 'ticket_moved', title: 'Ticket moved',
    });

    expect(result).toEqual(notif);
    // First DB call is select (preference check), second is insert
    const insertCall = dbCalls.find(c => c.op === 'insert');
    expect(insertCall).toBeDefined();
    expect((insertCall!.values as Record<string, unknown>).userId).toBe('user-1');
    expect((insertCall!.values as Record<string, unknown>).projectId).toBe('proj-1');
    expect((insertCall!.values as Record<string, unknown>).type).toBe('ticket_moved');
    expect((insertCall!.values as Record<string, unknown>).title).toBe('Ticket moved');
  });

  it('broadcasts to user after insert', async () => {
    const notif = { id: 'notif-2', userId: 'user-1', projectId: 'proj-1', type: 'comment_added', title: 'Comment' };
    insertReturnValue = [notif];

    const { createNotification } = await import('./notification-service.js');
    await createNotification({ userId: 'user-1', projectId: 'proj-1', type: 'comment_added', title: 'Comment' });

    expect(broadcastToUserMock).toHaveBeenCalledOnce();
    expect(broadcastToUserMock).toHaveBeenCalledWith('user-1', 'notification:created', { notification: notif });
  });

  it('skips when user disabled this notification type', async () => {
    selectReturnValue = [{ enabled: 0 }];
    insertReturnValue = [{ id: 'should-not-be-created' }];

    const { createNotification } = await import('./notification-service.js');
    const result = await createNotification({
      userId: 'user-1', projectId: 'proj-1', type: 'ticket_moved', title: 'Ticket moved',
    });

    expect(result).toBeNull();
    expect(dbCalls.find(c => c.op === 'insert')).toBeUndefined();
    expect(broadcastToUserMock).not.toHaveBeenCalled();
  });

  it('proceeds when preference exists but enabled', async () => {
    selectReturnValue = [{ enabled: 1 }];
    const notif = { id: 'notif-5', userId: 'user-1', projectId: 'proj-1', type: 'ticket_moved', title: 'Moved' };
    insertReturnValue = [notif];

    const { createNotification } = await import('./notification-service.js');
    const result = await createNotification({
      userId: 'user-1', projectId: 'proj-1', type: 'ticket_moved', title: 'Moved',
    });

    expect(result).toEqual(notif);
    expect(dbCalls.find(c => c.op === 'insert')).toBeDefined();
  });

  it('stores null for optional fields when not provided', async () => {
    const notif = { id: 'notif-3', userId: 'user-1', projectId: 'proj-1', type: 'test', title: 'T' };
    insertReturnValue = [notif];

    const { createNotification } = await import('./notification-service.js');
    await createNotification({ userId: 'user-1', projectId: 'proj-1', type: 'test', title: 'T' });

    const insertCall = dbCalls.find(c => c.op === 'insert');
    const vals = insertCall!.values as Record<string, unknown>;
    expect(vals.body).toBeNull();
    expect(vals.actionUrl).toBeNull();
    expect(vals.featureId).toBeNull();
    expect(vals.ticketId).toBeNull();
    expect(vals.metadata).toBeNull();
  });

  it('stores provided optional fields', async () => {
    insertReturnValue = [{ id: 'notif-4' }];

    const { createNotification } = await import('./notification-service.js');
    await createNotification({
      userId: 'u', projectId: 'p', type: 't', title: 'T',
      body: 'body text', actionUrl: '/url', featureId: 'feat-1',
      ticketId: 'ticket-1', metadata: { key: 'value' },
    });

    const insertCall = dbCalls.find(c => c.op === 'insert');
    const vals = insertCall!.values as Record<string, unknown>;
    expect(vals.body).toBe('body text');
    expect(vals.actionUrl).toBe('/url');
    expect(vals.featureId).toBe('feat-1');
    expect(vals.ticketId).toBe('ticket-1');
    expect(vals.metadata).toEqual({ key: 'value' });
  });
});

describe('markRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    dbCalls = [];
    updateReturnValue = [];
  });

  it('issues update and returns updated row', async () => {
    const updated = { id: 'notif-1', isRead: 1, userId: 'user-1' };
    updateReturnValue = [updated];

    const { markRead } = await import('./notification-service.js');
    const result = await markRead('notif-1', 'user-1');

    expect(result).toEqual(updated);
    expect(dbCalls).toHaveLength(1);
    expect(dbCalls[0].op).toBe('update');
  });

  it('returns undefined when notification not found or wrong user', async () => {
    updateReturnValue = [];

    const { markRead } = await import('./notification-service.js');
    const result = await markRead('nonexistent', 'user-1');

    expect(result).toBeUndefined();
  });
});

describe('markAllRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    dbCalls = [];
    updateReturnValue = [];
  });

  it('issues bulk update without featureId', async () => {
    updateReturnValue = [];
    const { markAllRead } = await import('./notification-service.js');
    await markAllRead('proj-1', 'user-1');

    expect(dbCalls).toHaveLength(1);
    expect(dbCalls[0].op).toBe('update');
  });

  it('issues bulk update with featureId scope', async () => {
    updateReturnValue = [];
    const { markAllRead } = await import('./notification-service.js');
    await markAllRead('proj-1', 'user-1', 'feat-1');

    expect(dbCalls).toHaveLength(1);
    expect(dbCalls[0].op).toBe('update');
  });

  it('resolves without error when no unread notifications', async () => {
    updateReturnValue = [];
    const { markAllRead } = await import('./notification-service.js');
    await expect(markAllRead('proj-1', 'user-1')).resolves.toBeUndefined();
  });
});

describe('getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    dbCalls = [];
    countReturnValue = [];
  });

  it('returns integer count', async () => {
    selectReturnValue = [{ count: 7 }];
    const { getUnreadCount } = await import('./notification-service.js');
    const result = await getUnreadCount('proj-1', 'user-1');
    expect(result).toBe(7);
  });

  it('returns 0 when no unread', async () => {
    selectReturnValue = [{ count: 0 }];
    const { getUnreadCount } = await import('./notification-service.js');
    const result = await getUnreadCount('proj-1', 'user-1');
    expect(result).toBe(0);
  });

  it('returns 0 on empty result', async () => {
    selectReturnValue = [];
    const { getUnreadCount } = await import('./notification-service.js');
    const result = await getUnreadCount('proj-1', 'user-1');
    expect(result).toBe(0);
  });

  it('accepts optional featureId', async () => {
    selectReturnValue = [{ count: 3 }];
    const { getUnreadCount } = await import('./notification-service.js');
    const result = await getUnreadCount('proj-1', 'user-1', 'feat-1');
    expect(result).toBe(3);
  });
});
