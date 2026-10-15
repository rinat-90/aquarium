import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Prevent all real SMTP / Resend traffic. Keep this mock before importing auth.
const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_message: unknown) => undefined),
}));
vi.mock('../lib/mailer.js', () => ({ sendEmail }));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('Auth email integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { auth } = await import('../lib/auth.js');
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
const origin = new URL(baseURL).origin;
const emailsToClean = new Set<string>();

type SentMail = { to: string; subject: string; text: string; html?: string };

function messages() {
  return sendEmail.mock.calls.map(([message]) => message as SentMail);
}

function mailTo(email: string, subject: string): SentMail {
  const mail = messages().find((item) => item.to === email && item.subject.includes(subject));
  expect(mail, `Expected ${subject} email to ${email}`).toBeDefined();
  return mail!;
}

function extractUrl(mail: SentMail, pattern: RegExp): URL {
  const match = mail.text.match(pattern);
  expect(match, `Expected link in ${mail.subject}`).not.toBeNull();
  return new URL(match![1]!);
}

async function request(path: string, body?: unknown, cookie?: string) {
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

async function followVerificationLink(url: URL) {
  // The link may point at the API origin; only its path and query are needed.
  return request(`${url.pathname.replace(/^\/api\/auth\//, '')}${url.search}`);
}

function cookieOf(response: Response) {
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .find((value) => value.includes('session_token='));
  expect(cookie, 'Expected session cookie').toBeDefined();
  return cookie!;
}

async function createAccount() {
  const email = `auth-email-${randomUUID()}@example.test`;
  emailsToClean.add(email);
  const account = { email, password: 'SecureTestPassword123!', name: 'Test Parent' };
  const signup = await request('sign-up/email', account);
  expect(signup.status).toBe(200);
  return account;
}

async function verify(account: { email: string }) {
  const url = extractUrl(
    mailTo(account.email, 'Verify your Family Aquarium email'),
    /Verify your email:\s*(\S+)/,
  );
  const response = await followVerificationLink(url);
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(400);
  return response;
}

async function verifiedAccount() {
  const account = await createAccount();
  await verify(account);
  const login = await request('sign-in/email', {
    email: account.email,
    password: account.password,
  });
  expect(login.status).toBe(200);
  return { account, cookie: cookieOf(login) };
}

beforeAll(async () => {
  await prisma.$connect();
});
afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [...emailsToClean] } } });
  emailsToClean.clear();
  sendEmail.mockClear();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Email verification and recovery (real PostgreSQL, mocked delivery)', () => {
  it('creates an unverified user and sends a verification link to the correct address', async () => {
    const account = await createAccount();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    expect(user.emailVerified).toBe(false);
    const url = extractUrl(
      mailTo(account.email, 'Verify your Family Aquarium email'),
      /Verify your email:\s*(\S+)/,
    );
    expect(url.pathname).toContain('/verify-email');
    expect(url.searchParams.get('token')).toBeTruthy();
    expect(url.searchParams.get('callbackURL')).toContain('/aquariums');
  });

  it('does not allow an unverified account to sign in', async () => {
    const account = await createAccount();
    const login = await request('sign-in/email', {
      email: account.email,
      password: account.password,
    });
    expect(login.status).toBeGreaterThanOrEqual(400);
  });

  it('verifies email and sends a single welcome email', async () => {
    const account = await createAccount();
    await verify(account);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    expect(user.emailVerified).toBe(true);
    expect(
      messages().filter((mail) => mail.subject.includes('Welcome to Family Aquarium')),
    ).toHaveLength(1);
  });

  it('rejects an invalid verification token', async () => {
    const account = await createAccount();
    const result = await request(`verify-email?token=${randomUUID()}&callbackURL=%2Faquariums`);
    expect(result.status).toBe(302);

    const location = result.headers.get('location');
    expect(location).toBeTruthy();
    expect(new URL(location!, 'http://localhost:3001').searchParams.has('error')).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    expect(user.emailVerified).toBe(false);
  });

  it('emails a password reset link and allows a new password', async () => {
    const { account } = await verifiedAccount();
    sendEmail.mockClear();
    const start = await request('request-password-reset', {
      email: account.email,
      redirectTo: 'http://localhost:5173/reset-password',
    });
    expect(start.status).toBe(200);
    const resetUrl = extractUrl(
      mailTo(account.email, 'Reset your Family Aquarium password'),
      /Reset your password:\s*(\S+)/,
    );
    const token = resetUrl.searchParams.get('token');
    expect(token).toBeTruthy();
    const nextPassword = 'BrandNewSecurePassword123!';
    const reset = await request('reset-password', { token, newPassword: nextPassword });
    expect(reset.status).toBe(200);
    const oldLogin = await request('sign-in/email', {
      email: account.email,
      password: account.password,
    });
    expect(oldLogin.status).toBeGreaterThanOrEqual(400);
    const newLogin = await request('sign-in/email', {
      email: account.email,
      password: nextPassword,
    });
    expect(newLogin.status).toBe(200);
  });

  it('rejects invalid password-reset tokens', async () => {
    const result = await request('reset-password', {
      token: randomUUID(),
      newPassword: 'BrandNewSecurePassword123!',
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it('requires verification when changing the account email', async () => {
    const { account, cookie } = await verifiedAccount();
    const newEmail = `auth-email-new-${randomUUID()}@example.test`;
    emailsToClean.add(newEmail);
    sendEmail.mockClear();
    const change = await request(
      'change-email',
      { newEmail, callbackURL: 'http://localhost:5173/aquariums' },
      cookie,
    );
    expect(change.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: account.email } })).email).toBe(
      account.email,
    );
    // If this fails, Better Auth's changeEmail configuration needs a delivery callback.
    const mail = mailTo(newEmail, 'Verify');
    expect(mail.text).toContain('http');
  });
});
