import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('../lib/get-authenticated-user.js', () => ({ getAuthenticatedUser: mocks.user }));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('Onboarding integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { onboardingRoutes } = await import('../routes/onboarding.js');
const app = Fastify({ logger: false });
const createdUserIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
  await app.register(onboardingRoutes);
  await app.ready();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe('onboarding status', () => {
  it('requires authentication for read and completion', async () => {
    mocks.user.mockResolvedValue(null);
    expect((await app.inject({ method: 'GET', url: '/api/onboarding' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/onboarding/complete' })).statusCode).toBe(401);
  });

  it('defaults to incomplete and persists completion idempotently', async () => {
    const account = await prisma.user.create({ data: { email: `onboarding-${randomUUID()}@example.test` } });
    createdUserIds.push(account.id);
    mocks.user.mockResolvedValue({ id: account.id });
    const initial = await app.inject({ method: 'GET', url: '/api/onboarding' });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual({ onboardingCompleted: false });
    for (let i = 0; i < 2; i++) {
      const result = await app.inject({ method: 'POST', url: '/api/onboarding/complete' });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual({ onboardingCompleted: true });
    }
    expect((await app.inject({ method: 'GET', url: '/api/onboarding' })).json()).toEqual({ onboardingCompleted: true });
  });

  it('does not expose another user’s status', async () => {
    const first = await prisma.user.create({ data: { email: `first-${randomUUID()}@example.test` } });
    const second = await prisma.user.create({ data: { email: `second-${randomUUID()}@example.test` } });
    createdUserIds.push(first.id, second.id);
    mocks.user.mockResolvedValue({ id: first.id });
    await app.inject({ method: 'POST', url: '/api/onboarding/complete' });
    mocks.user.mockResolvedValue({ id: second.id });
    expect((await app.inject({ method: 'GET', url: '/api/onboarding' })).json()).toEqual({ onboardingCompleted: false });
  });
});
