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
  projectMembers: { projectId: 'projectId', userId: 'userId' },
  tickets: { id: 'id', projectId: 'projectId', featureId: 'featureId', createdBy: 'createdBy', assignedUserId: 'assignedUserId' },
  comments: { ticketId: 'ticketId', userId: 'userId' },
  features: { id: 'id', projectId: 'projectId', createdBy: 'createdBy' },
  projects: { id: 'id', ownerId: 'ownerId' },
}));

vi.mock('../websocket/socket-server.js', () => ({
  broadcastToBoard: vi.fn(),
}));

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
