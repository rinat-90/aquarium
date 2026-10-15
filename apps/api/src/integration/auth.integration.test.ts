import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../realtime/socket.js', () => ({ notifyAquariumChanged: vi.fn() }));

// No real email delivery during integration tests.
vi.mock('../lib/mailer.js', () => ({ sendEmail: vi.fn(async () => undefined) }));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('Auth integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { auth } = await import('../lib/auth.js');
const { aquariumRoutes } = await import('../routes/aquariums.js');

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
const origin = new URL(baseURL).origin;
const createdEmails: string[] = [];
let app: ReturnType<typeof Fastify>;

function newAccount() {
  const email = `auth-test-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return { email, password: 'SecureTestPassword123!', name: 'Test Parent' };
}

async function authRequest(path: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return auth.handler(
    new Request(new URL(`/api/auth/${path}`, baseURL), {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function sessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .find((value) => value.includes('session_token='));
  expect(cookie, 'Expected a Better Auth session cookie').toBeDefined();
  return cookie!;
}

async function register() {
  const account = newAccount();
  const response = await authRequest('sign-up/email', account);
  expect(response.status).toBe(200);
  // Email verification is covered end-to-end in auth-email.integration.test.ts.
  // Other suites only need a verified parent with a genuine Better Auth session.
  await prisma.user.update({ where: { email: account.email }, data: { emailVerified: true } });
  const login = await authRequest('sign-in/email', {
    email: account.email,
    password: account.password,
  });
  expect(login.status).toBe(200);
  return { account, response, cookie: sessionCookie(login) };
}

beforeAll(async () => {
  await prisma.$connect();
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(aquariumRoutes);
  await app.ready();
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  createdEmails.length = 0;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('Better Auth with real PostgreSQL', () => {
  it('registers a user and creates an email/password account', async () => {
    const { account } = await register();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: account.email },
      include: { accounts: true },
    });
    expect(user.email).toBe(account.email);
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]?.providerId).toBe('credential');
    expect(user.accounts[0]?.password).toBeTruthy();
  });

  it('signs in with valid credentials and returns a session cookie', async () => {
    const { account } = await register();
    const response = await authRequest('sign-in/email', {
      email: account.email,
      password: account.password,
    });
    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toContain('session_token=');
  });

  it('rejects an incorrect password', async () => {
    const { account } = await register();
    const response = await authRequest('sign-in/email', {
      email: account.email,
      password: 'WrongPassword123!',
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.getSetCookie().some((c) => c.includes('session_token='))).toBe(false);
  });

  it('does not create a duplicate account for an existing email', async () => {
    const { account } = await register();

    const response = await authRequest('sign-up/email', account);

    // Better Auth may return 200 to avoid email enumeration.
    expect([200, 400, 409, 422]).toContain(response.status);

    expect(
      await prisma.user.count({
        where: { email: account.email },
      }),
    ).toBe(1);
  });

  it('retrieves the correct session from a real cookie', async () => {
    const { account, cookie } = await register();
    const response = await authRequest('get-session', undefined, cookie);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.email).toBe(account.email);
    expect(data.session.userId).toBe(data.user.id);
  });

  it('rejects an invalid session cookie on protected routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/aquariums',
      headers: { cookie: 'better-auth.session_token=invalid-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects an expired database session on protected routes', async () => {
    const { account, cookie } = await register();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const response = await app.inject({ method: 'GET', url: '/aquariums', headers: { cookie } });
    expect(response.statusCode).toBe(401);
  });

  it('signs out and invalidates the session for protected routes', async () => {
    const { cookie } = await register();
    const before = await app.inject({ method: 'GET', url: '/aquariums', headers: { cookie } });
    expect(before.statusCode).toBe(200);
    const signOut = await authRequest('sign-out', {}, cookie);
    expect(signOut.status).toBe(200);
    const after = await app.inject({ method: 'GET', url: '/aquariums', headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });
});
