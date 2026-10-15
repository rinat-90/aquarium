import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import { once } from 'node:events';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('Socket integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { auth } = await import('../lib/auth.js');
const {
  initializeSocket,
  closeSocket,
  notifyAquariumChanged,
  switchTvDisplayAquarium,
  disconnectTvDisplaySession,
  setTvDisplayPaused,
} = await import('../realtime/socket.js');

const authBase = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
const createdEmails: string[] = [];
const clients: ClientSocket[] = [];
let httpServer: HttpServer;
let socketURL: string;

async function createParent() {
  const email = `socket-test-${randomUUID()}@example.test`;
  createdEmails.push(email);
  const response = await auth.handler(
    new Request(new URL('/api/auth/sign-up/email', authBase), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: new URL(authBase).origin },
      body: JSON.stringify({ email, password: 'SocketTestPassword123!', name: 'Socket Parent' }),
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .find((value) => value.includes('session_token='));
  expect(cookie).toBeDefined();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { user, cookie: cookie! };
}

async function createAquarium(ownerId: string) {
  return prisma.aquarium.create({ data: { ownerId, name: 'Socket test aquarium' } });
}

async function createDisplay(ownerId: string, aquariumId: string, paused = false) {
  const token = randomBytes(32).toString('base64url');
  const session = await prisma.tvDisplaySession.create({
    data: {
      ownerId,
      aquariumId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      pausedAt: paused ? new Date() : null,
    },
  });
  return { token, session };
}

async function connect(options: { cookie?: string; displayToken?: string } = {}) {
  const socket = connectClient(socketURL, {
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000,
    extraHeaders: options.cookie ? { cookie: options.cookie } : undefined,
    auth: options.displayToken ? { displayToken: options.displayToken } : undefined,
    autoConnect: false,
  });
  clients.push(socket);
  const connected = new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  socket.connect();
  await connected;
  return socket;
}

async function join(socket: ClientSocket, event: 'tv:join' | 'aquarium:join', aquariumId?: string) {
  return event === 'tv:join'
    ? (socket.timeout(2000).emitWithAck(event) as Promise<{ ok: boolean }>)
    : (socket.timeout(2000).emitWithAck(event, aquariumId) as Promise<{ ok: boolean }>);
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(event, handler);
  });
}

beforeAll(async () => {
  await prisma.$connect();
  httpServer = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  initializeSocket(httpServer, '*');
  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
  socketURL = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
    client.removeAllListeners();
  }
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  createdEmails.length = 0;
});

afterAll(async () => {
  await closeSocket();
  if (httpServer?.listening) {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await prisma.$disconnect();
});

describe('Socket.IO with real PostgreSQL and Better Auth', () => {
  it('rejects an invalid TV display token during connection', async () => {
    await expect(connect({ displayToken: randomBytes(32).toString('base64url') })).rejects.toThrow(
      'Display session expired or revoked',
    );
  });

  it('does not allow anonymous clients to join an aquarium', async () => {
    const parent = await createParent();
    const aquarium = await createAquarium(parent.user.id);
    const socket = await connect();
    expect(await join(socket, 'aquarium:join', aquarium.id)).toEqual({ ok: false });
    expect(await join(socket, 'tv:join')).toEqual({ ok: false });
  });

  it('allows the owner to join but rejects a different owner', async () => {
    const parent = await createParent();
    const other = await createParent();
    const aquarium = await createAquarium(parent.user.id);
    const ownerSocket = await connect({ cookie: parent.cookie });
    const otherSocket = await connect({ cookie: other.cookie });
    expect(await join(ownerSocket, 'aquarium:join', aquarium.id)).toEqual({ ok: true });
    expect(await join(otherSocket, 'aquarium:join', aquarium.id)).toEqual({ ok: false });
  });

  it('delivers aquarium changes to the paired TV room', async () => {
    const parent = await createParent();
    const aquarium = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, aquarium.id);
    const tv = await connect({ displayToken: display.token });
    expect(await join(tv, 'tv:join')).toEqual({ ok: true });
    const received = waitForEvent<{ aquariumId: string }>(tv, 'aquarium:changed');
    notifyAquariumChanged(aquarium.id);
    expect(await received).toEqual({ aquariumId: aquarium.id });
  });

  it('switches a TV between aquarium rooms', async () => {
    const parent = await createParent();
    const first = await createAquarium(parent.user.id);
    const second = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, first.id);
    const tv = await connect({ displayToken: display.token });
    expect(await join(tv, 'tv:join')).toEqual({ ok: true });
    await prisma.tvDisplaySession.update({
      where: { id: display.session.id },
      data: { aquariumId: second.id },
    });
    const switched = waitForEvent<{ aquariumId: string }>(tv, 'tv:aquarium-switched');
    switchTvDisplayAquarium(display.session.id, second.id);
    expect(await switched).toEqual({ aquariumId: second.id });
    const changed = waitForEvent<{ aquariumId: string }>(tv, 'aquarium:changed');
    notifyAquariumChanged(second.id);
    expect(await changed).toEqual({ aquariumId: second.id });
  });

  it('disconnects the TV when its session is revoked', async () => {
    const parent = await createParent();
    const aquarium = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, aquarium.id);
    const tv = await connect({ displayToken: display.token });
    expect(await join(tv, 'tv:join')).toEqual({ ok: true });
    await prisma.tvDisplaySession.update({
      where: { id: display.session.id },
      data: { revokedAt: new Date() },
    });
    const revoked = waitForEvent<void>(tv, 'tv:session-revoked');
    disconnectTvDisplaySession(display.session.id);
    await revoked;
    expect(tv.connected).toBe(false);
  });

  it('notifies a connected TV when paused and resumed', async () => {
    const parent = await createParent();
    const aquarium = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, aquarium.id);
    const tv = await connect({ displayToken: display.token });
    expect(await join(tv, 'tv:join')).toEqual({ ok: true });
    const paused = waitForEvent<{ paused: boolean }>(tv, 'tv:broadcast-status');
    setTvDisplayPaused(display.session.id, true);
    expect(await paused).toMatchObject({ paused: true });
    const resumed = waitForEvent<{ paused: boolean }>(tv, 'tv:broadcast-status');
    setTvDisplayPaused(display.session.id, false);
    expect(await resumed).toMatchObject({ paused: false });
  });

  it('keeps a paused TV out of the new aquarium room until resumed (regression)', async () => {
    const parent = await createParent();
    const first = await createAquarium(parent.user.id);
    const second = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, first.id);
    const tv = await connect({ displayToken: display.token });
    expect(await join(tv, 'tv:join')).toEqual({ ok: true });

    await prisma.tvDisplaySession.update({
      where: { id: display.session.id },
      data: { pausedAt: new Date() },
    });
    const paused = waitForEvent<{ paused: boolean }>(tv, 'tv:broadcast-status');
    setTvDisplayPaused(display.session.id, true);
    expect(await paused).toMatchObject({ paused: true });

    await prisma.tvDisplaySession.update({
      where: { id: display.session.id },
      data: { aquariumId: second.id },
    });
    const switched = waitForEvent<{ aquariumId: string }>(tv, 'tv:aquarium-switched');
    switchTvDisplayAquarium(display.session.id, second.id);
    expect(await switched).toEqual({ aquariumId: second.id });

    const changes: string[] = [];
    tv.on('aquarium:changed', (payload: { aquariumId: string }) => {
      changes.push(payload.aquariumId);
    });
    notifyAquariumChanged(first.id);
    notifyAquariumChanged(second.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(changes).toEqual([]);

    await prisma.tvDisplaySession.update({
      where: { id: display.session.id },
      data: { pausedAt: null },
    });
    const resumed = waitForEvent<{ paused: boolean; aquariumId: string }>(
      tv,
      'tv:broadcast-status',
    );
    setTvDisplayPaused(display.session.id, false);
    expect(await resumed).toMatchObject({ paused: false, aquariumId: second.id });

    const changed = waitForEvent<{ aquariumId: string }>(tv, 'aquarium:changed');
    notifyAquariumChanged(second.id);
    expect(await changed).toEqual({ aquariumId: second.id });
  });

  it('keeps a TV connected while switching aquariums if it connected paused', async () => {
    const parent = await createParent();
    const first = await createAquarium(parent.user.id);
    const second = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, first.id, true);
    const tv = await connect({ displayToken: display.token });
    expect(await join(tv, 'tv:join')).toEqual({ ok: false });

    await prisma.tvDisplaySession.update({
      where: { id: display.session.id },
      data: { aquariumId: second.id },
    });
    const switched = waitForEvent<{ aquariumId: string }>(tv, 'tv:aquarium-switched');
    switchTvDisplayAquarium(display.session.id, second.id);
    expect(await switched).toEqual({ aquariumId: second.id });

    const changes: string[] = [];
    tv.on('aquarium:changed', (payload: { aquariumId: string }) => {
      changes.push(payload.aquariumId);
    });
    notifyAquariumChanged(second.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(changes).toEqual([]);
    expect(tv.connected).toBe(true);
  });

  it('does not let a paused TV rejoin its aquarium room after reconnecting (regression)', async () => {
    const parent = await createParent();
    const aquarium = await createAquarium(parent.user.id);
    const display = await createDisplay(parent.user.id, aquarium.id, true);
    const tv = await connect({ displayToken: display.token });
    // This should be false until the owner resumes the TV session.
    // Expected to fail against the current tv:join implementation.
    expect(await join(tv, 'tv:join')).toEqual({ ok: false });
  });
});
