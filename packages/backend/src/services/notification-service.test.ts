import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a chainable mock that resolves at the end of the chain
function chainable(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  chain.select = handler;
  chain.from = handler;
  chain.where = handler;
  chain.limit = () => Promise.resolve(resolveValue);
  chain.insert = handler;
  chain.values = handler;
  chain.returning = () => Promise.resolve(resolveValue);
  return chain;
}

let dbMock: ReturnType<typeof chainable>;

vi.mock('../db/connection.js', () => ({
  get db() {
    return dbMock;
  },
}));

vi.mock('../db/schema.js', () => ({
  notifications: { projectId: 'projectId', featureId: 'featureId', isRead: 'isRead', userId: 'userId', id: 'id' },
  notificationPreferences: { userId: 'userId', projectId: 'projectId', notificationType: 'notificationType', enabled: 'enabled' },
  projectMembers: { projectId: 'projectId', userId: 'userId' },
  tickets: { id: 'id', projectId: 'projectId', featureId: 'featureId', createdBy: 'createdBy', assignedUserId: 'assignedUserId' },
  comments: { ticketId: 'ticketId', userId: 'userId' },
  features: { id: 'id', projectId: 'projectId', createdBy: 'createdBy' },
  projects: { id: 'id', ownerId: 'ownerId' },
}));

vi.mock('../websocket/socket-server.js', () => ({
  broadcastToUser: vi.fn(),
}));

// Helper: build a stateful db mock for notifyTicketStakeholders
// selectResult: what ticket SELECT returns
// Returns a mock that tracks insert calls so we can assert on them
function makeTicketStakeholdersMock(selectResult: unknown[]) {
  const insertedNotifications: unknown[] = [];
  let selectCalled = false;

  const mock = new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      if (prop === 'select') {
        return () => {
          const inner: Record<string, unknown> = {};
          const self = () => inner;
          inner.select = self;
          inner.from = self;
          inner.where = self;
          inner.limit = () => {
            if (!selectCalled) {
              selectCalled = true;
              return Promise.resolve(selectResult);
            }
            return Promise.resolve([]);
          };
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
          return inner;
        };
      }
      if (prop === 'insert') {
        return () => {
          const inner: Record<string, unknown> = {};
          let capturedValues: unknown = null;
          inner.values = (vals: unknown) => {
            capturedValues = vals;
            return inner;
          };
          inner.returning = () => {
            const notif = { id: `notif-${insertedNotifications.length}`, ...((capturedValues as Record<string, unknown>) ?? {}) };
            insertedNotifications.push(notif);
            return Promise.resolve([notif]);
          };
          return inner;
        };
      }
      return () => ({});
    },
  });

  return { mock, insertedNotifications };
}

describe('notifyTicketStakeholders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('notifies creator and assigned user, excludes actor', async () => {
    const ticket = { projectId: 'proj-1', featureId: 'feat-1', createdBy: 'user-creator', assignedUserId: 'user-assigned' };
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([ticket]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    const result = await notifyTicketStakeholders('ticket-1', 'ticket_moved', 'Ticket A moved to done', null, '/projects/proj-1/board?ticket=ticket-1', 'user-actor');

    expect(result).toEqual(['user-creator', 'user-assigned']);
    expect(insertedNotifications).toHaveLength(2);
    expect((insertedNotifications[0] as Record<string, unknown>).userId).toBe('user-creator');
    expect((insertedNotifications[1] as Record<string, unknown>).userId).toBe('user-assigned');
  });

  it('excludes actor from recipients when actor is creator', async () => {
    const ticket = { projectId: 'proj-1', featureId: 'feat-1', createdBy: 'user-actor', assignedUserId: 'user-assigned' };
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([ticket]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    const result = await notifyTicketStakeholders('ticket-1', 'ticket_moved', 'Ticket moved', null, null, 'user-actor');

    expect(result).toEqual(['user-assigned']);
    expect(insertedNotifications).toHaveLength(1);
    expect((insertedNotifications[0] as Record<string, unknown>).userId).toBe('user-assigned');
  });

  it('deduplicates when creator and assigned are the same user', async () => {
    const ticket = { projectId: 'proj-1', featureId: 'feat-1', createdBy: 'user-a', assignedUserId: 'user-a' };
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([ticket]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    const result = await notifyTicketStakeholders('ticket-1', 'ticket_moved', 'Ticket moved', null, null, 'user-actor');

    expect(result).toEqual(['user-a']);
    expect(insertedNotifications).toHaveLength(1);
  });

  it('returns empty array when ticket not found', async () => {
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    const result = await notifyTicketStakeholders('nonexistent', 'ticket_moved', 'Ticket moved', null, null, 'user-actor');

    expect(result).toEqual([]);
    expect(insertedNotifications).toHaveLength(0);
  });

  it('returns empty array when only stakeholder is the actor', async () => {
    const ticket = { projectId: 'proj-1', featureId: 'feat-1', createdBy: 'user-actor', assignedUserId: null };
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([ticket]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    const result = await notifyTicketStakeholders('ticket-1', 'ticket_moved', 'Ticket moved', null, null, 'user-actor');

    expect(result).toEqual([]);
    expect(insertedNotifications).toHaveLength(0);
  });

  it('handles null assignedUserId — only notifies creator', async () => {
    const ticket = { projectId: 'proj-1', featureId: 'feat-1', createdBy: 'user-creator', assignedUserId: null };
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([ticket]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    const result = await notifyTicketStakeholders('ticket-1', 'ticket_moved', 'Ticket moved', null, null, 'user-actor');

    expect(result).toEqual(['user-creator']);
    expect(insertedNotifications).toHaveLength(1);
  });

  it('passes correct notification fields — type, title, ticketId, actionUrl', async () => {
    const ticket = { projectId: 'proj-1', featureId: 'feat-1', createdBy: 'user-creator', assignedUserId: null };
    const { mock, insertedNotifications } = makeTicketStakeholdersMock([ticket]);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketStakeholders } = await import('./notification-service.js');
    await notifyTicketStakeholders('ticket-1', 'ticket_moved', 'My Ticket moved to done', null, '/projects/proj-1/board?ticket=ticket-1', 'user-actor');

    const notif = insertedNotifications[0] as Record<string, unknown>;
    expect(notif.type).toBe('ticket_moved');
    expect(notif.title).toBe('My Ticket moved to done');
    expect(notif.ticketId).toBe('ticket-1');
    expect(notif.actionUrl).toBe('/projects/proj-1/board?ticket=ticket-1');
    expect(notif.projectId).toBe('proj-1');
  });
});

describe('notifyFeatureCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notification for feature creator', async () => {
    // First call: select feature → returns feature with createdBy
    // Second call: insert notification → returns notification
    let callCount = 0;
    dbMock = new Proxy({} as Record<string, unknown>, {
      get(_, prop) {
        if (prop === 'select' || prop === 'insert') {
          callCount++;
        }
        const currentCall = callCount;
        return (..._args: unknown[]) => {
          const inner: Record<string, unknown> = {};
          const self = () => inner;
          inner.select = self;
          inner.from = self;
          inner.where = self;
          inner.insert = self;
          inner.values = self;
          inner.limit = () => {
            if (currentCall === 1) {
              return Promise.resolve([{ projectId: 'project-1', createdBy: 'user-creator' }]);
            }
            return Promise.resolve([]);
          };
          inner.returning = () => {
            return Promise.resolve([{
              id: 'notif-1',
              userId: 'user-creator',
              projectId: 'project-1',
              type: 'proposal_created',
              title: 'New ticket proposed: Test',
            }]);
          };
          // Make inner thenable for cases where chain resolves directly
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
          return inner;
        };
      },
    });

    const { notifyFeatureCreator } = await import('./notification-service.js');
    const result = await notifyFeatureCreator('feature-1', 'proposal_created', 'New ticket proposed: Test');

    expect(result).toBeTruthy();
    expect(result!.userId).toBe('user-creator');
  });

  it('returns null when feature not found', async () => {
    dbMock = new Proxy({} as Record<string, unknown>, {
      get() {
        return () => {
          const inner: Record<string, unknown> = {};
          const self = () => inner;
          inner.select = self;
          inner.from = self;
          inner.where = self;
          inner.limit = () => Promise.resolve([]);
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
          return inner;
        };
      },
    });

    const { notifyFeatureCreator } = await import('./notification-service.js');
    const result = await notifyFeatureCreator('nonexistent', 'proposal_created', 'Test');

    expect(result).toBeNull();
  });
});

describe('notifyProjectOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notification for project owner', async () => {
    let callCount = 0;
    dbMock = new Proxy({} as Record<string, unknown>, {
      get(_, prop) {
        if (prop === 'select' || prop === 'insert') {
          callCount++;
        }
        const currentCall = callCount;
        return () => {
          const inner: Record<string, unknown> = {};
          const self = () => inner;
          inner.select = self;
          inner.from = self;
          inner.where = self;
          inner.insert = self;
          inner.values = self;
          inner.limit = () => {
            if (currentCall === 1) {
              return Promise.resolve([{ ownerId: 'user-owner' }]);
            }
            return Promise.resolve([]);
          };
          inner.returning = () => {
            return Promise.resolve([{
              id: 'notif-2',
              userId: 'user-owner',
              projectId: 'project-1',
              type: 'scan_completed',
              title: 'Repo scan completed',
            }]);
          };
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
          return inner;
        };
      },
    });

    const { notifyProjectOwner } = await import('./notification-service.js');
    const result = await notifyProjectOwner('project-1', 'scan_completed', 'Repo scan completed', 'Generated 6 files');

    expect(result).toBeTruthy();
    expect(result!.userId).toBe('user-owner');
  });

  it('returns null when project not found', async () => {
    dbMock = new Proxy({} as Record<string, unknown>, {
      get() {
        return () => {
          const inner: Record<string, unknown> = {};
          const self = () => inner;
          inner.select = self;
          inner.from = self;
          inner.where = self;
          inner.limit = () => Promise.resolve([]);
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
          return inner;
        };
      },
    });

    const { notifyProjectOwner } = await import('./notification-service.js');
    const result = await notifyProjectOwner('nonexistent', 'scan_completed', 'Test');

    expect(result).toBeNull();
  });
});

// Helper: build db mock for notifyTicketCommenters
// ticketResult: what ticket SELECT returns, commenterRows: what selectDistinct returns
function makeTicketCommentersMock(ticketResult: unknown[], commenterRows: unknown[]) {
  const insertedNotifications: unknown[] = [];

  const mock = new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      const propStr = String(prop);

      if (propStr === 'select') {
        return () => {
          const inner: Record<string, unknown> = {};
          const self = () => inner;
          inner.select = self;
          inner.from = self;
          inner.where = self;
          inner.limit = () => Promise.resolve(ticketResult);
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
          return inner;
        };
      }

      if (propStr === 'selectDistinct') {
        return () => {
          const inner: Record<string, unknown> = {};
          inner.from = () => inner;
          // .where() must return a Promise — it is await-ed directly
          inner.where = () => Promise.resolve(commenterRows);
          inner.then = (resolve: (v: unknown) => void) => Promise.resolve(commenterRows).then(resolve);
          return inner;
        };
      }

      if (propStr === 'insert') {
        return () => {
          const inner: Record<string, unknown> = {};
          let capturedValues: unknown = null;
          inner.values = (vals: unknown) => {
            capturedValues = vals;
            return inner;
          };
          inner.returning = () => {
            const notif = { id: `notif-${insertedNotifications.length}`, ...((capturedValues as Record<string, unknown>) ?? {}) };
            insertedNotifications.push(notif);
            return Promise.resolve([notif]);
          };
          return inner;
        };
      }

      return () => ({});
    },
  });

  return { mock, insertedNotifications };
}

describe('notifyTicketCommenters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('notifies prior commenters, excludes actor', async () => {
    const { mock, insertedNotifications } = makeTicketCommentersMock(
      [{ projectId: 'proj-1', featureId: 'feat-1' }],
      [{ userId: 'user-a' }, { userId: 'user-b' }],
    );
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketCommenters } = await import('./notification-service.js');
    const result = await notifyTicketCommenters(
      'ticket-1', 'actor-user', 'comment_added', 'New comment on X', 'body', '/url', [],
    );

    expect(result).toHaveLength(2);
    expect(result).toContain('user-a');
    expect(result).toContain('user-b');
    expect(insertedNotifications).toHaveLength(2);
  });

  it('skips skipUserIds — deduplication with stakeholders', async () => {
    const { mock, insertedNotifications } = makeTicketCommentersMock(
      [{ projectId: 'proj-1', featureId: 'feat-1' }],
      [{ userId: 'user-stakeholder' }, { userId: 'user-new' }],
    );
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketCommenters } = await import('./notification-service.js');
    const result = await notifyTicketCommenters(
      'ticket-1', 'actor-user', 'comment_added', 'New comment', 'body', '/url',
      ['user-stakeholder'],
    );

    expect(result).toHaveLength(1);
    expect(result).toContain('user-new');
    expect(result).not.toContain('user-stakeholder');
    expect(insertedNotifications).toHaveLength(1);
  });

  it('returns empty array when ticket not found', async () => {
    const { mock, insertedNotifications } = makeTicketCommentersMock([], []);
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketCommenters } = await import('./notification-service.js');
    const result = await notifyTicketCommenters(
      'nonexistent', 'actor-user', 'comment_added', 'New comment', 'body', '/url', [],
    );

    expect(result).toEqual([]);
    expect(insertedNotifications).toHaveLength(0);
  });

  it('returns empty when no prior commenters', async () => {
    const { mock, insertedNotifications } = makeTicketCommentersMock(
      [{ projectId: 'proj-1', featureId: 'feat-1' }],
      [],
    );
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketCommenters } = await import('./notification-service.js');
    const result = await notifyTicketCommenters(
      'ticket-1', 'actor-user', 'comment_added', 'New comment', 'body', '/url', [],
    );

    expect(result).toEqual([]);
    expect(insertedNotifications).toHaveLength(0);
  });

  it('returns empty when all commenters are in skipUserIds', async () => {
    const { mock, insertedNotifications } = makeTicketCommentersMock(
      [{ projectId: 'proj-1', featureId: 'feat-1' }],
      [{ userId: 'user-already' }],
    );
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketCommenters } = await import('./notification-service.js');
    const result = await notifyTicketCommenters(
      'ticket-1', 'actor-user', 'comment_added', 'New comment', 'body', '/url',
      ['user-already'],
    );

    expect(result).toEqual([]);
    expect(insertedNotifications).toHaveLength(0);
  });

  it('passes correct notification fields — type, title, body, ticketId, actionUrl', async () => {
    const { mock, insertedNotifications } = makeTicketCommentersMock(
      [{ projectId: 'proj-1', featureId: 'feat-1' }],
      [{ userId: 'user-commenter' }],
    );
    dbMock = mock as ReturnType<typeof chainable>;

    const { notifyTicketCommenters } = await import('./notification-service.js');
    await notifyTicketCommenters(
      'ticket-1', 'actor-user', 'comment_added',
      'New comment on My Ticket', 'truncated body text',
      '/projects/proj-1/board?ticket=ticket-1',
      [],
    );

    const notif = insertedNotifications[0] as Record<string, unknown>;
    expect(notif.type).toBe('comment_added');
    expect(notif.title).toBe('New comment on My Ticket');
    expect(notif.body).toBe('truncated body text');
    expect(notif.ticketId).toBe('ticket-1');
    expect(notif.projectId).toBe('proj-1');
    expect(notif.actionUrl).toBe('/projects/proj-1/board?ticket=ticket-1');
  });
});
