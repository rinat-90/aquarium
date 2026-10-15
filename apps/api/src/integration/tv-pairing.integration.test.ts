import { createHash, randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const socketMocks = vi.hoisted(() => ({
  disconnectTvDisplaySession: vi.fn(),
  switchTvDisplayAquarium: vi.fn(),
  getOnlineTvDisplaySessionIds: vi.fn(() => new Set<string>()),
  setTvDisplayPaused: vi.fn(),
}));
vi.mock('../realtime/socket.js', () => socketMocks);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('TV pairing integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { auth } = await import('../lib/auth.js');
const { tvPairingRoutes } = await import('../routes/tv-pairing.js');

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
const createdEmails: string[] = [];
const pairingIds: string[] = [];
const displayIds: string[] = [];
let app: ReturnType<typeof Fastify>;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function register() {
  const email = `tv-integration-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const response = await auth.handler(
    new Request(new URL('/api/auth/sign-up/email', baseURL), {
      method: 'POST',
      headers: { origin: new URL(baseURL).origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'SecureTestPassword123!', name: 'TV Test Parent' }),
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .find((value) => value.includes('session_token='));
  expect(cookie).toBeDefined();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const aquarium = await prisma.aquarium.create({
    data: { ownerId: user.id, name: 'TV Aquarium', isDefault: true },
  });
  return { user, aquarium, cookie: cookie! };
}

async function challenge() {
  const response = await app.inject({ method: 'POST', url: '/api/tv/pairing' });
  expect(response.statusCode).toBe(201);
  const data = response.json() as { code: string; expiresAt: string };
  const record = await prisma.tvPairingSession.findUniqueOrThrow({
    where: { codeHash: hash(data.code) },
  });
  pairingIds.push(record.id);
  expect(record.codeHash).not.toBe(data.code);
  return data;
}

async function approve(code: string, cookie: string, aquariumId: string) {
  return app.inject({
    method: 'POST',
    url: `/api/tv/pairing/${code}/approve`,
    headers: { cookie },
    payload: { aquariumId },
  });
}

async function pair(cookie: string, aquariumId: string) {
  const { code } = await challenge();
  expect((await approve(code, cookie, aquariumId)).statusCode).toBe(200);
  const response = await app.inject({ method: 'GET', url: `/api/tv/pairing/${code}` });
  expect(response.statusCode).toBe(200);
  const data = response.json() as { status: string; token: string; aquariumId: string };
  expect(data.status).toBe('paired');
  expect(data.aquariumId).toBe(aquariumId);
  const session = await prisma.tvDisplaySession.findUniqueOrThrow({
    where: { tokenHash: hash(data.token) },
  });
  displayIds.push(session.id);
  expect(session.tokenHash).not.toBe(data.token);
  return { ...data, session };
}

beforeAll(async () => {
  await prisma.$connect();
  app = Fastify({ logger: false });
  await app.register(tvPairingRoutes);
  await app.ready();
});

afterEach(async () => {
  // These TV session tables do not have foreign keys to User/Aquarium.
  await prisma.tvDisplaySession.deleteMany({ where: { id: { in: displayIds } } });
  await prisma.tvPairingSession.deleteMany({ where: { id: { in: pairingIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  displayIds.length = 0;
  pairingIds.length = 0;
  createdEmails.length = 0;
  vi.clearAllMocks();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('TV pairing HTTP routes with real PostgreSQL and Better Auth', () => {
  it('creates a pairing challenge and stores only its hash', async () => {
    const { code, expiresAt } = await challenge();
    expect(code.length).toBeGreaterThanOrEqual(32);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('reports pending for an unapproved pairing', async () => {
    const { code } = await challenge();
    const response = await app.inject({ method: 'GET', url: `/api/tv/pairing/${code}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'pending' });
  });

  it('requires a real authenticated session to approve', async () => {
    const { code } = await challenge();
    const response = await approve(code, '', 'some-aquarium');
    expect(response.statusCode).toBe(401);
  });

  it('prevents approval of another user’s aquarium', async () => {
    const owner = await register();
    const stranger = await register();
    const { code } = await challenge();
    const response = await approve(code, stranger.cookie, owner.aquarium.id);
    expect(response.statusCode).toBe(403);
  });

  it('approves and redeems a challenge, issuing a hashed display token', async () => {
    const { aquarium, cookie } = await register();
    const paired = await pair(cookie, aquarium.id);
    expect(paired.session.aquariumId).toBe(aquarium.id);
    expect(paired.session.revokedAt).toBeNull();
  });

  it('allows a pairing code to be redeemed only once', async () => {
    const { aquarium, cookie } = await register();
    const { code } = await challenge();
    expect((await approve(code, cookie, aquarium.id)).statusCode).toBe(200);
    const first = await app.inject({ method: 'GET', url: `/api/tv/pairing/${code}` });
    expect(first.statusCode).toBe(200);
    const firstToken = (first.json() as { token: string }).token;
    const session = await prisma.tvDisplaySession.findUniqueOrThrow({
      where: { tokenHash: hash(firstToken) },
    });
    displayIds.push(session.id);
    const second = await app.inject({ method: 'GET', url: `/api/tv/pairing/${code}` });
    expect(second.statusCode).toBe(410);
    expect(await prisma.tvDisplaySession.count({ where: { id: session.id } })).toBe(1);
  });

  it('rejects expired pairing challenges', async () => {
    const { code } = await challenge();
    await prisma.tvPairingSession.update({
      where: { codeHash: hash(code) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const response = await app.inject({ method: 'GET', url: `/api/tv/pairing/${code}` });
    expect(response.statusCode).toBe(410);
  });

  it('requires a valid bearer token for TV fish data', async () => {
    const owner = await register();
    const paired = await pair(owner.cookie, owner.aquarium.id);
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/tv/display/fish' });
    expect(unauthenticated.statusCode).toBe(401);
    const invalid = await app.inject({
      method: 'GET',
      url: '/api/tv/display/fish',
      headers: { authorization: `Bearer ${'x'.repeat(43)}` },
    });
    expect(invalid.statusCode).toBe(401);
    const valid = await app.inject({
      method: 'GET',
      url: '/api/tv/display/fish',
      headers: { authorization: `Bearer ${paired.token}` },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().aquariumId).toBe(owner.aquarium.id);
  });

  it('limits TV fish results to the paired aquarium and owner', async () => {
    const owner = await register();
    const stranger = await register();
    await prisma.fish.create({
      data: { name: 'Visible fish', ownerId: owner.user.id, aquariumId: owner.aquarium.id },
    });
    await prisma.fish.create({
      data: { name: 'Hidden fish', ownerId: stranger.user.id, aquariumId: stranger.aquarium.id },
    });
    const paired = await pair(owner.cookie, owner.aquarium.id);
    const response = await app.inject({
      method: 'GET',
      url: '/api/tv/display/fish',
      headers: { authorization: `Bearer ${paired.token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().fish.map((fish: { name: string }) => fish.name)).toEqual([
      'Visible fish',
    ]);
  });

  it('revokes a TV session and invalidates its bearer token', async () => {
    const owner = await register();
    const paired = await pair(owner.cookie, owner.aquarium.id);
    const response = await app.inject({
      method: 'POST',
      url: `/api/tv/display/sessions/${paired.session.id}/revoke`,
      headers: { cookie: owner.cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(socketMocks.disconnectTvDisplaySession).toHaveBeenCalledWith(paired.session.id);
    const rejected = await app.inject({
      method: 'GET',
      url: '/api/tv/display/fish',
      headers: { authorization: `Bearer ${paired.token}` },
    });
    expect(rejected.statusCode).toBe(401);
  });

  it('switches a TV session only to an aquarium owned by the parent', async () => {
    const owner = await register();
    const stranger = await register();
    const destination = await prisma.aquarium.create({
      data: { ownerId: owner.user.id, name: 'Second' },
    });
    const paired = await pair(owner.cookie, owner.aquarium.id);
    const url = `/api/tv/display/sessions/${paired.session.id}/switch`;
    const denied = await app.inject({
      method: 'POST',
      url,
      headers: { cookie: owner.cookie },
      payload: { aquariumId: stranger.aquarium.id },
    });
    expect(denied.statusCode).toBe(403);
    const allowed = await app.inject({
      method: 'POST',
      url,
      headers: { cookie: owner.cookie },
      payload: { aquariumId: destination.id },
    });
    expect(allowed.statusCode).toBe(200);
    expect(
      (await prisma.tvDisplaySession.findUniqueOrThrow({ where: { id: paired.session.id } }))
        .aquariumId,
    ).toBe(destination.id);
    expect(socketMocks.switchTvDisplayAquarium).toHaveBeenCalledWith(
      paired.session.id,
      destination.id,
    );
  });

  it('persists pause/resume and calls the socket notification hooks', async () => {
    const owner = await register();
    const paired = await pair(owner.cookie, owner.aquarium.id);
    const url = `/api/tv/display/sessions/${paired.session.id}`;
    const paused = await app.inject({
      method: 'POST',
      url: `${url}/pause`,
      headers: { cookie: owner.cookie },
    });
    expect(paused.statusCode).toBe(200);
    expect(
      (await prisma.tvDisplaySession.findUniqueOrThrow({ where: { id: paired.session.id } }))
        .pausedAt,
    ).not.toBeNull();
    expect(socketMocks.setTvDisplayPaused).toHaveBeenCalledWith(paired.session.id, true);
    const resumed = await app.inject({
      method: 'POST',
      url: `${url}/resume`,
      headers: { cookie: owner.cookie },
    });
    expect(resumed.statusCode).toBe(200);
    expect(
      (await prisma.tvDisplaySession.findUniqueOrThrow({ where: { id: paired.session.id } }))
        .pausedAt,
    ).toBeNull();
    expect(socketMocks.setTvDisplayPaused).toHaveBeenCalledWith(paired.session.id, false);
  });
});
