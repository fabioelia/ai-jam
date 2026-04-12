import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Hoisted mocks (avoids TDZ with vi.mock hoisting) ─────────────────────────

const {
  mockBroadcastToUser,
  mockOffsetSelect,
  mockLimitSelect,
  mockOrderBySelect,
  mockGroupBySelect,
  mockWhereSelect,
  mockFromSelect,
  mockSelectDb,
  mockReturningUpdate,
  mockWhereUpdate,
  mockSetUpdate,
  mockUpdateDb,
  mockReturningDelete,
  mockWhereDelete,
  mockDeleteDb,
  mockOnConflictInsert,
  mockValuesInsert,
  mockInsertDb,
} = vi.hoisted(() => {
  const mockBroadcastToUser = vi.fn();

  // select chain: select().from().where().orderBy().limit().offset()
  //               select().from().where().groupBy()
  //               select().from().where()  (plain resolved)
  const mockOffsetSelect = vi.fn();
  const mockLimitSelect = vi.fn().mockReturnValue({ offset: mockOffsetSelect });
  const mockOrderBySelect = vi.fn().mockReturnValue({ limit: mockLimitSelect });
  const mockGroupBySelect = vi.fn();
  const mockWhereSelect = vi.fn().mockReturnValue({
    orderBy: mockOrderBySelect,
    groupBy: mockGroupBySelect,
  });
  const mockFromSelect = vi.fn().mockReturnValue({ where: mockWhereSelect });
  const mockSelectDb = vi.fn().mockReturnValue({ from: mockFromSelect });

  // update chain: update().set().where().returning()
  const mockReturningUpdate = vi.fn();
  const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturningUpdate });
  const mockSetUpdate = vi.fn().mockReturnValue({ where: mockWhereUpdate });
  const mockUpdateDb = vi.fn().mockReturnValue({ set: mockSetUpdate });

  // delete chain: delete().where().returning()
  const mockReturningDelete = vi.fn();
  const mockWhereDelete = vi.fn().mockReturnValue({ returning: mockReturningDelete });
  const mockDeleteDb = vi.fn().mockReturnValue({ where: mockWhereDelete });

  // insert chain: insert().values().onConflictDoUpdate()
  const mockOnConflictInsert = vi.fn();
  const mockValuesInsert = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictInsert });
  const mockInsertDb = vi.fn().mockReturnValue({ values: mockValuesInsert });

  return {
    mockBroadcastToUser,
    mockOffsetSelect,
    mockLimitSelect,
    mockOrderBySelect,
    mockGroupBySelect,
    mockWhereSelect,
    mockFromSelect,
    mockSelectDb,
    mockReturningUpdate,
    mockWhereUpdate,
    mockSetUpdate,
    mockUpdateDb,
    mockReturningDelete,
    mockWhereDelete,
    mockDeleteDb,
    mockOnConflictInsert,
    mockValuesInsert,
    mockInsertDb,
  };
});

vi.mock('../websocket/socket-server.js', () => ({
  broadcastToUser: mockBroadcastToUser,
}));

vi.mock('../db/connection.js', () => ({
  db: {
    select: mockSelectDb,
    update: mockUpdateDb,
    delete: mockDeleteDb,
    insert: mockInsertDb,
  },
}));

// ── Import routes after mocks ─────────────────────────────────────────────────

import { notificationRoutes } from './notifications.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const PROJECT_ID = 'project-1';
const NOTIF_ID = 'notif-1';

const FEATURE_ID = 'feature-1';

const NOTIFICATION = {
  id: NOTIF_ID,
  userId: USER_ID,
  projectId: PROJECT_ID,
  featureId: null,
  ticketId: null,
  type: 'comment_added',
  title: 'New comment',
  body: 'Someone commented',
  actionUrl: null,
  contextId: null,
  metadata: null,
  isRead: 0,
  createdAt: new Date().toISOString(),
};

const READ_NOTIFICATION = { ...NOTIFICATION, isRead: 1 };

// ── App setup ─────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.decorate('authenticate', async () => {});
  app.addHook('onRequest', async (request) => {
    (request as unknown as { user: { userId: string } }).user = { userId: USER_ID };
  });
  await app.register(notificationRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore select chain
  mockSelectDb.mockReturnValue({ from: mockFromSelect });
  mockFromSelect.mockReturnValue({ where: mockWhereSelect });
  mockWhereSelect.mockReturnValue({ orderBy: mockOrderBySelect, groupBy: mockGroupBySelect });
  mockOrderBySelect.mockReturnValue({ limit: mockLimitSelect });
  mockLimitSelect.mockReturnValue({ offset: mockOffsetSelect });
  // Restore update chain
  mockUpdateDb.mockReturnValue({ set: mockSetUpdate });
  mockSetUpdate.mockReturnValue({ where: mockWhereUpdate });
  mockWhereUpdate.mockReturnValue({ returning: mockReturningUpdate });
  // Restore delete chain
  mockDeleteDb.mockReturnValue({ where: mockWhereDelete });
  mockWhereDelete.mockReturnValue({ returning: mockReturningDelete });
  // Restore insert chain
  mockInsertDb.mockReturnValue({ values: mockValuesInsert });
  mockValuesInsert.mockReturnValue({ onConflictDoUpdate: mockOnConflictInsert });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  it('returns notification list for user', async () => {
    mockOffsetSelect.mockResolvedValueOnce([NOTIFICATION]);

    const res = await app.inject({ method: 'GET', url: '/api/notifications' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(NOTIF_ID);
  });

  it('applies default limit=50 and offset=0', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    await app.inject({ method: 'GET', url: '/api/notifications' });

    expect(mockLimitSelect).toHaveBeenCalledWith(50);
    expect(mockOffsetSelect).toHaveBeenCalledWith(0);
  });

  it('applies custom limit and offset from query params', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    await app.inject({ method: 'GET', url: '/api/notifications?limit=10&offset=20' });

    expect(mockLimitSelect).toHaveBeenCalledWith(10);
    expect(mockOffsetSelect).toHaveBeenCalledWith(20);
  });

  it('returns empty array when no notifications', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'GET', url: '/api/notifications' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('passes type filter to where clause when provided', async () => {
    mockOffsetSelect.mockResolvedValueOnce([NOTIFICATION]);

    const res = await app.inject({ method: 'GET', url: '/api/notifications?type=comment_added' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });

  it('combines projectId, type, and unreadOnly filters', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/notifications?projectId=${PROJECT_ID}&type=gate_result&unreadOnly=true&limit=5&offset=10`,
    });

    expect(res.statusCode).toBe(200);
    expect(mockLimitSelect).toHaveBeenCalledWith(5);
    expect(mockOffsetSelect).toHaveBeenCalledWith(10);
  });
});

describe('GET /api/notifications/unread-count', () => {
  it('returns total count and byProject breakdown', async () => {
    mockGroupBySelect.mockResolvedValueOnce([
      { projectId: PROJECT_ID, count: 3 },
      { projectId: 'project-2', count: 2 },
    ]);

    const res = await app.inject({ method: 'GET', url: '/api/notifications/unread-count' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(5);
    expect(body.byProject[PROJECT_ID]).toBe(3);
    expect(body.byProject['project-2']).toBe(2);
  });

  it('returns count=0 and empty byProject when no unread', async () => {
    mockGroupBySelect.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'GET', url: '/api/notifications/unread-count' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(0);
    expect(body.byProject).toEqual({});
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks notification read and returns updated row', async () => {
    mockReturningUpdate.mockResolvedValueOnce([READ_NOTIFICATION]);

    const res = await app.inject({ method: 'PATCH', url: `/api/notifications/${NOTIF_ID}/read` });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(NOTIF_ID);
    expect(body.isRead).toBe(1);
  });

  it('returns 404 when notification not found or belongs to different user', async () => {
    mockReturningUpdate.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'PATCH', url: '/api/notifications/nonexistent/read' });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('Notification not found');
  });

  it('broadcasts notification:read to user room on success', async () => {
    mockReturningUpdate.mockResolvedValueOnce([READ_NOTIFICATION]);

    await app.inject({ method: 'PATCH', url: `/api/notifications/${NOTIF_ID}/read` });

    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      USER_ID,
      'notification:read',
      expect.objectContaining({ notificationId: NOTIF_ID, userId: USER_ID }),
    );
  });

  it('does NOT broadcast when notification not found', async () => {
    mockReturningUpdate.mockResolvedValueOnce([]);

    await app.inject({ method: 'PATCH', url: '/api/notifications/nonexistent/read' });

    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });
});

describe('POST /api/notifications/read-all', () => {
  it('marks all notifications read and returns updated count', async () => {
    mockReturningUpdate.mockResolvedValueOnce([READ_NOTIFICATION, READ_NOTIFICATION]);

    const res = await app.inject({ method: 'POST', url: '/api/notifications/read-all' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).updated).toBe(2);
  });

  it('broadcasts notification:read-all to user room', async () => {
    mockReturningUpdate.mockResolvedValueOnce([READ_NOTIFICATION]);

    await app.inject({ method: 'POST', url: '/api/notifications/read-all' });

    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      USER_ID,
      'notification:read-all',
      expect.objectContaining({ userId: USER_ID }),
    );
  });

  it('scopes update to projectId when provided and broadcasts projectId', async () => {
    mockReturningUpdate.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      payload: { projectId: PROJECT_ID },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      USER_ID,
      'notification:read-all',
      expect.objectContaining({ projectId: PROJECT_ID }),
    );
  });

  it('returns updated=0 when no unread notifications exist', async () => {
    mockReturningUpdate.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'POST', url: '/api/notifications/read-all' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).updated).toBe(0);
  });
});

describe('DELETE /api/notifications/:id', () => {
  it('deletes notification and returns { ok: true }', async () => {
    mockReturningDelete.mockResolvedValueOnce([NOTIFICATION]);

    const res = await app.inject({ method: 'DELETE', url: `/api/notifications/${NOTIF_ID}` });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('returns 404 when notification not found or belongs to different user', async () => {
    mockReturningDelete.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'DELETE', url: '/api/notifications/nonexistent' });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('Notification not found');
  });
});

describe('DELETE /api/notifications/read', () => {
  it('deletes all read notifications and returns count', async () => {
    mockReturningDelete.mockResolvedValueOnce([READ_NOTIFICATION, READ_NOTIFICATION]);

    const res = await app.inject({ method: 'DELETE', url: '/api/notifications/read' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).deleted).toBe(2);
  });

  it('scopes deletion to projectId when provided', async () => {
    mockReturningDelete.mockResolvedValueOnce([READ_NOTIFICATION]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/notifications/read',
      payload: { projectId: PROJECT_ID },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).deleted).toBe(1);
  });

  it('returns deleted=0 when no read notifications exist', async () => {
    mockReturningDelete.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'DELETE', url: '/api/notifications/read' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).deleted).toBe(0);
  });
});

// ── Project-scoped notification endpoints ────────────────────────────────────

describe('GET /api/projects/:projectId/notifications', () => {
  it('returns paginated notifications for project scoped to user', async () => {
    mockOffsetSelect.mockResolvedValueOnce([NOTIFICATION]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(NOTIF_ID);
  });

  it('applies default limit=50 and offset=0', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    await app.inject({ method: 'GET', url: `/api/projects/${PROJECT_ID}/notifications` });

    expect(mockLimitSelect).toHaveBeenCalledWith(50);
    expect(mockOffsetSelect).toHaveBeenCalledWith(0);
  });

  it('clamps limit to 100 max', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications?limit=500`,
    });

    expect(mockLimitSelect).toHaveBeenCalledWith(100);
  });

  it('handles NaN limit/offset gracefully', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications?limit=abc&offset=xyz`,
    });

    expect(mockLimitSelect).toHaveBeenCalledWith(50);
    expect(mockOffsetSelect).toHaveBeenCalledWith(0);
  });

  it('passes featureId, type, and isRead filters', async () => {
    mockOffsetSelect.mockResolvedValueOnce([NOTIFICATION]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications?featureId=${FEATURE_ID}&type=comment_added&isRead=false`,
    });

    expect(res.statusCode).toBe(200);
    // Verify where was called (conditions built correctly)
    expect(mockWhereSelect).toHaveBeenCalled();
  });

  it('returns empty array when no notifications', async () => {
    mockOffsetSelect.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});

describe('GET /api/projects/:projectId/notifications/unread-count', () => {
  it('returns count scoped to user and project', async () => {
    mockWhereSelect.mockResolvedValueOnce([{ count: 7 }]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications/unread-count`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(7);
  });

  it('returns count=0 when no unread', async () => {
    mockWhereSelect.mockResolvedValueOnce([{ count: 0 }]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications/unread-count`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).count).toBe(0);
  });

  it('accepts featureId query param', async () => {
    mockWhereSelect.mockResolvedValueOnce([{ count: 3 }]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notifications/unread-count?featureId=${FEATURE_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).count).toBe(3);
    expect(mockWhereSelect).toHaveBeenCalled();
  });
});

describe('PATCH /api/projects/:projectId/notifications/read-all', () => {
  it('marks all project notifications read for user', async () => {
    mockReturningUpdate.mockResolvedValueOnce([READ_NOTIFICATION, READ_NOTIFICATION]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/notifications/read-all`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).updated).toBe(2);
  });

  it('broadcasts notification:read-all with projectId', async () => {
    mockReturningUpdate.mockResolvedValueOnce([READ_NOTIFICATION]);

    await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/notifications/read-all`,
    });

    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      USER_ID,
      'notification:read-all',
      expect.objectContaining({ userId: USER_ID, projectId: PROJECT_ID }),
    );
  });

  it('scopes to featureId when provided', async () => {
    mockReturningUpdate.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/notifications/read-all?featureId=${FEATURE_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).updated).toBe(0);
    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      USER_ID,
      'notification:read-all',
      expect.objectContaining({ featureId: FEATURE_ID }),
    );
  });

  it('returns updated=0 when no unread notifications', async () => {
    mockReturningUpdate.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/notifications/read-all`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).updated).toBe(0);
  });
});

describe('GET /api/projects/:projectId/notification-preferences', () => {
  it('returns preferences map for user+project', async () => {
    mockWhereSelect.mockResolvedValueOnce([
      { notificationType: 'comment_added', enabled: 1 },
      { notificationType: 'gate_result', enabled: 0 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notification-preferences`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.preferences.comment_added).toBe(true);
    expect(body.preferences.gate_result).toBe(false);
  });

  it('returns empty preferences object when none set', async () => {
    mockWhereSelect.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/notification-preferences`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).preferences).toEqual({});
  });
});

describe('PUT /api/projects/:projectId/notification-preferences', () => {
  it('upserts preferences and returns updated state', async () => {
    mockOnConflictInsert.mockResolvedValue(undefined);
    mockWhereSelect.mockResolvedValueOnce([
      { notificationType: 'comment_added', enabled: 1 },
      { notificationType: 'gate_result', enabled: 0 },
    ]);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/notification-preferences`,
      payload: { preferences: { comment_added: true, gate_result: false } },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.preferences.comment_added).toBe(true);
    expect(body.preferences.gate_result).toBe(false);
  });

  it('returns 400 when preferences object missing from body', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/notification-preferences`,
      payload: {},
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('preferences');
  });

  it('calls onConflictDoUpdate once per preference entry', async () => {
    mockOnConflictInsert.mockResolvedValue(undefined);
    mockWhereSelect.mockResolvedValueOnce([]);

    await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/notification-preferences`,
      payload: { preferences: { type_a: true, type_b: false, type_c: true } },
      headers: { 'content-type': 'application/json' },
    });

    expect(mockInsertDb).toHaveBeenCalledTimes(3);
    expect(mockOnConflictInsert).toHaveBeenCalledTimes(3);
  });
});
