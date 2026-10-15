import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  pairingCreate: vi.fn(),
  pairingFind: vi.fn(),
  pairingUpdate: vi.fn(),
  displayCreate: vi.fn(),
  displayFind: vi.fn(),
  displayFindMany: vi.fn(),
  displayUpdate: vi.fn(),
  aquariumFind: vi.fn(),
  fishFindMany: vi.fn(),
  fishFind: vi.fn(),
  transaction: vi.fn(),
  online: vi.fn(),
  disconnect: vi.fn(),
  switchAquarium: vi.fn(),
  setPaused: vi.fn(),
}));

vi.mock('@aquarium/database', () => ({
  prisma: {
    tvPairingSession: {
      create: mocks.pairingCreate,
      findUnique: mocks.pairingFind,
      updateMany: mocks.pairingUpdate,
    },
    tvDisplaySession: {
      create: mocks.displayCreate,
      findUnique: mocks.displayFind,
      findMany: mocks.displayFindMany,
      updateMany: mocks.displayUpdate,
    },
    aquarium: { findFirst: mocks.aquariumFind },
    fish: { findMany: mocks.fishFindMany, findFirst: mocks.fishFind },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../lib/auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('../realtime/socket.js', () => ({
  getOnlineTvDisplaySessionIds: mocks.online,
  disconnectTvDisplaySession: mocks.disconnect,
  switchTvDisplayAquarium: mocks.switchAquarium,
  setTvDisplayPaused: mocks.setPaused,
}));

import { tvPairingRoutes } from '../routes/tv-pairing.js';

const code = 'a'.repeat(43);
const token = 'b'.repeat(43);
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const cookie = { cookie: 'session=valid' };
const authorization = { authorization: `Bearer ${token}` };
const pairing = (overrides = {}) => ({
  id: 'pair-1',
  status: 'pending',
  expiresAt: future(),
  aquariumId: null,
  approvedByUserId: null,
  consumedAt: null,
  ...overrides,
});
const display = (overrides = {}) => ({
  id: 'display-1',
  ownerId: 'user-1',
  aquariumId: 'tank-1',
  revokedAt: null,
  expiresAt: future(),
  pausedAt: null,
  ...overrides,
});
const makeApp = () => {
  const app = Fastify();
  app.register(tvPairingRoutes);
  return app;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.pairingCreate.mockResolvedValue({});
  mocks.pairingUpdate.mockResolvedValue({ count: 1 });
  mocks.displayUpdate.mockResolvedValue({ count: 1 });
  mocks.aquariumFind.mockResolvedValue({ id: 'tank-1', appearance: { theme: 'reef' } });
  mocks.displayFind.mockResolvedValue(display());
  mocks.displayFindMany.mockResolvedValue([]);
  mocks.fishFindMany.mockResolvedValue([]);
  mocks.online.mockReturnValue(new Set());
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      tvPairingSession: { updateMany: mocks.pairingUpdate },
      aquarium: { findFirst: mocks.aquariumFind },
      tvDisplaySession: { create: mocks.displayCreate },
    }),
  );
});
afterEach(() => vi.restoreAllMocks());

type TestRequestOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  payload?: string | Buffer | object;
};

async function request(options: TestRequestOptions) {
  const app = makeApp();
  try {
    return await app.inject(options);
  } finally {
    await app.close();
  }
}

describe('TV pairing challenge', () => {
  it('creates a secret challenge stored only as a SHA-256 hash', async () => {
    const response = await request({ method: 'POST', url: '/api/tv/pairing' });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.code.length).toBeGreaterThanOrEqual(32);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(mocks.pairingCreate).toHaveBeenCalledWith({
      data: {
        codeHash: hash(body.code),
        expiresAt: expect.any(Date),
      },
    });
    expect(JSON.stringify(mocks.pairingCreate.mock.calls)).not.toContain(body.code);
  });

  it('rejects malformed and unknown challenges', async () => {
    expect((await request({ method: 'GET', url: '/api/tv/pairing/short' })).statusCode).toBe(404);
    expect(mocks.pairingFind).not.toHaveBeenCalled();
    mocks.pairingFind.mockResolvedValue(null);
    expect((await request({ method: 'GET', url: `/api/tv/pairing/${code}` })).statusCode).toBe(404);
    expect(mocks.pairingFind).toHaveBeenCalledWith({ where: { codeHash: hash(code) } });
  });

  it('reports pending, expired, and unavailable challenges', async () => {
    for (const [record, statusCode, status] of [
      [pairing(), 200, 'pending'],
      [pairing({ expiresAt: past() }), 410, 'expired'],
      [pairing({ status: 'consumed' }), 410, 'unavailable'],
    ] as const) {
      mocks.pairingFind.mockResolvedValue(record);
      const response = await request({ method: 'GET', url: `/api/tv/pairing/${code}` });
      expect(response.statusCode).toBe(statusCode);
      expect(response.json().status).toBe(status);
    }
  });

  it('redeems an approved challenge atomically and creates a hashed display token', async () => {
    mocks.pairingFind.mockResolvedValue(
      pairing({ status: 'approved', aquariumId: 'tank-1', approvedByUserId: 'user-1' }),
    );
    const response = await request({ method: 'GET', url: `/api/tv/pairing/${code}` });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('paired');
    expect(body.aquariumId).toBe('tank-1');
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(mocks.pairingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pair-1', status: 'approved', consumedAt: null }),
        data: expect.objectContaining({ status: 'consumed' }),
      }),
    );
    expect(mocks.displayCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: hash(body.token),
        ownerId: 'user-1',
        aquariumId: 'tank-1',
      }),
    });
  });

  it('refuses redemption when another request claimed it or ownership was lost', async () => {
    mocks.pairingFind.mockResolvedValue(
      pairing({ status: 'approved', aquariumId: 'tank-1', approvedByUserId: 'user-1' }),
    );
    mocks.pairingUpdate.mockResolvedValueOnce({ count: 0 });
    expect((await request({ method: 'GET', url: `/api/tv/pairing/${code}` })).statusCode).toBe(409);
    mocks.aquariumFind.mockResolvedValueOnce(null);
    expect((await request({ method: 'GET', url: `/api/tv/pairing/${code}` })).statusCode).toBe(409);
    expect(mocks.displayCreate).not.toHaveBeenCalled();
  });
});

describe('TV pairing approval', () => {
  const url = `/api/tv/pairing/${code}/approve`;
  it('requires an authenticated owner', async () => {
    expect(
      (await request({ method: 'POST', url, payload: { aquariumId: 'tank-1' } })).statusCode,
    ).toBe(401);
    expect(mocks.aquariumFind).not.toHaveBeenCalled();
  });
  it('rejects missing aquarium ID and malformed code', async () => {
    expect((await request({ method: 'POST', url, headers: cookie, payload: {} })).statusCode).toBe(
      400,
    );
    expect(
      (
        await request({
          method: 'POST',
          url: '/api/tv/pairing/short/approve',
          headers: cookie,
          payload: { aquariumId: 'tank-1' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('rejects aquariums not owned by the user', async () => {
    mocks.aquariumFind.mockResolvedValue(null);
    expect(
      (await request({ method: 'POST', url, headers: cookie, payload: { aquariumId: 'tank-2' } }))
        .statusCode,
    ).toBe(403);
    expect(mocks.pairingUpdate).not.toHaveBeenCalled();
  });
  it('approves only pending, unexpired challenges for the owner', async () => {
    const response = await request({
      method: 'POST',
      url,
      headers: cookie,
      payload: { aquariumId: 'tank-1' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(mocks.pairingUpdate).toHaveBeenCalledWith({
      where: { codeHash: hash(code), status: 'pending', expiresAt: { gt: expect.any(Date) } },
      data: {
        status: 'approved',
        aquariumId: 'tank-1',
        approvedByUserId: 'user-1',
        approvedAt: expect.any(Date),
      },
    });
  });
  it('rejects expired or already approved challenges', async () => {
    mocks.pairingUpdate.mockResolvedValue({ count: 0 });
    expect(
      (await request({ method: 'POST', url, headers: cookie, payload: { aquariumId: 'tank-1' } }))
        .statusCode,
    ).toBe(409);
  });
});

describe('paired TV read-only access', () => {
  it('requires a bearer token and rejects invalid or expired sessions', async () => {
    const url = '/api/tv/display/fish';
    expect((await request({ method: 'GET', url })).statusCode).toBe(401);
    expect(
      (await request({ method: 'GET', url, headers: { authorization: 'Bearer short' } }))
        .statusCode,
    ).toBe(401);
    mocks.displayFind.mockResolvedValueOnce(null);
    expect((await request({ method: 'GET', url, headers: authorization })).statusCode).toBe(401);
    mocks.displayFind.mockResolvedValueOnce(display({ expiresAt: past() }));
    expect((await request({ method: 'GET', url, headers: authorization })).statusCode).toBe(401);
  });
  it('rejects sessions whose aquarium ownership was revoked', async () => {
    mocks.aquariumFind.mockResolvedValue(null);
    expect(
      (await request({ method: 'GET', url: '/api/tv/display/fish', headers: authorization }))
        .statusCode,
    ).toBe(403);
  });
  it('returns only the paired aquarium’s fish and appearance', async () => {
    mocks.fishFindMany.mockResolvedValue([{ id: 'fish-1' }]);
    const response = await request({
      method: 'GET',
      url: '/api/tv/display/fish',
      headers: authorization,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      aquariumId: 'tank-1',
      appearance: { theme: 'reef' },
      fish: [{ id: 'fish-1' }],
    });
    expect(mocks.displayFind).toHaveBeenCalledWith({ where: { tokenHash: hash(token) } });
    expect(mocks.fishFindMany).toHaveBeenCalledWith({
      where: { aquariumId: 'tank-1', ownerId: 'user-1' },
      orderBy: { createdAt: 'asc' },
    });
  });
  it('rejects textures for fish outside the paired aquarium', async () => {
    mocks.fishFind.mockResolvedValue(null);
    const response = await request({
      method: 'GET',
      url: '/api/tv/display/fish/fish-2/texture',
      headers: authorization,
    });
    expect(response.statusCode).toBe(404);
    expect(mocks.fishFind).toHaveBeenCalledWith({
      where: { id: 'fish-2', aquariumId: 'tank-1', ownerId: 'user-1' },
      select: { paintKey: true },
    });
  });
  it('rejects invalid texture keys without reading the filesystem', async () => {
    mocks.fishFind.mockResolvedValue({ paintKey: '../secret.png' });
    const response = await request({
      method: 'GET',
      url: '/api/tv/display/fish/fish-1/texture',
      headers: authorization,
    });
    expect(response.statusCode).toBe(500);
  });
});

describe('owner TV session management', () => {
  it('requires authentication to list sessions', async () => {
    expect((await request({ method: 'GET', url: '/api/tv/display/sessions' })).statusCode).toBe(
      401,
    );
  });
  it('lists only active owner sessions with online status', async () => {
    mocks.displayFindMany.mockResolvedValue([display()]);
    mocks.online.mockReturnValue(new Set(['display-1']));
    const response = await request({
      method: 'GET',
      url: '/api/tv/display/sessions',
      headers: cookie,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().sessions[0]).toMatchObject({
      id: 'display-1',
      aquariumId: 'tank-1',
      isOnline: true,
    });
    expect(mocks.displayFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: 'user-1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
      }),
    );
  });
  it('switches only the owner’s active display to an owned aquarium', async () => {
    const response = await request({
      method: 'POST',
      url: '/api/tv/display/sessions/display-1/switch',
      headers: cookie,
      payload: { aquariumId: 'tank-2' },
    });
    expect(response.statusCode).toBe(200);
    expect(mocks.displayUpdate).toHaveBeenCalledWith({
      where: {
        id: 'display-1',
        ownerId: 'user-1',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { aquariumId: 'tank-2' },
    });
    expect(mocks.switchAquarium).toHaveBeenCalledWith('display-1', 'tank-2');
  });
  it('does not switch displays when aquarium access is denied', async () => {
    mocks.aquariumFind.mockResolvedValue(null);
    expect(
      (
        await request({
          method: 'POST',
          url: '/api/tv/display/sessions/display-1/switch',
          headers: cookie,
          payload: { aquariumId: 'tank-2' },
        })
      ).statusCode,
    ).toBe(403);
    expect(mocks.switchAquarium).not.toHaveBeenCalled();
  });
  it('does not notify sockets when the session is not active', async () => {
    mocks.displayUpdate.mockResolvedValue({ count: 0 });
    expect(
      (
        await request({
          method: 'POST',
          url: '/api/tv/display/sessions/display-1/switch',
          headers: cookie,
          payload: { aquariumId: 'tank-2' },
        })
      ).statusCode,
    ).toBe(404);
    expect(mocks.switchAquarium).not.toHaveBeenCalled();
  });
  it('revokes an owned display and disconnects it', async () => {
    const response = await request({
      method: 'POST',
      url: '/api/tv/display/sessions/display-1/revoke',
      headers: cookie,
    });
    expect(response.statusCode).toBe(200);
    expect(mocks.displayUpdate).toHaveBeenCalledWith({
      where: { id: 'display-1', ownerId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.disconnect).toHaveBeenCalledWith('display-1');
  });
  it('pauses and resumes a display, updating realtime state', async () => {
    for (const [action, pausedAt, isPaused] of [
      ['pause', expect.any(Date), true],
      ['resume', null, false],
    ] as const) {
      const response = await request({
        method: 'POST',
        url: `/api/tv/display/sessions/display-1/${action}`,
        headers: cookie,
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.displayUpdate).toHaveBeenCalledWith({
        where: {
          id: 'display-1',
          ownerId: 'user-1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: { pausedAt },
      });
      expect(mocks.setPaused).toHaveBeenCalledWith('display-1', isPaused);
    }
  });
  it('rejects session changes without owner authentication', async () => {
    for (const action of ['switch', 'revoke', 'pause', 'resume']) {
      const response = await request({
        method: 'POST',
        url: `/api/tv/display/sessions/display-1/${action}`,
        payload: { aquariumId: 'tank-2' },
      });
      expect(response.statusCode).toBe(401);
    }
    expect(mocks.displayUpdate).not.toHaveBeenCalled();
  });
});
