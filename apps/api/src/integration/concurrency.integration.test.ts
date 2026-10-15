import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../lib/get-authenticated-user.js', () => ({
  getAuthenticatedUser: mocks.user,
}));
vi.mock('../realtime/socket.js', () => ({
  notifyAquariumChanged: mocks.notify,
}));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('Concurrency integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { aquariumRoutes } = await import('../routes/aquariums.js');

let app: ReturnType<typeof Fastify>;
let owner: { id: string };
let first: { id: string };
let second: { id: string };
let third: { id: string };
const createdUserIds: string[] = [];

async function defaults() {
  return prisma.aquarium.findMany({
    where: { ownerId: owner.id, isDefault: true },
    select: { id: true },
  });
}

beforeAll(async () => {
  await prisma.$connect();
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(aquariumRoutes);
  await app.ready();
});

beforeEach(async () => {
  mocks.user.mockReset();
  mocks.notify.mockReset();
  owner = await prisma.user.create({
    data: { email: `concurrency-${randomUUID()}@example.test` },
  });
  createdUserIds.push(owner.id);
  first = await prisma.aquarium.create({
    data: { ownerId: owner.id, name: 'First', isDefault: true },
  });
  second = await prisma.aquarium.create({
    data: { ownerId: owner.id, name: 'Second' },
  });
  third = await prisma.aquarium.create({
    data: { ownerId: owner.id, name: 'Third' },
  });
  mocks.user.mockResolvedValue(owner);
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('concurrent aquarium operations with PostgreSQL', () => {
  it('serializes simultaneous default switches and keeps exactly one default', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'PATCH', url: `/aquariums/${second.id}/default` }),
      app.inject({ method: 'PATCH', url: `/aquariums/${third.id}/default` }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const currentDefaults = await defaults();
    expect(currentDefaults).toHaveLength(1);
    expect([second.id, third.id]).toContain(currentDefaults[0]!.id);
  });

  it('allows only one concurrent deletion of the same empty aquarium', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'DELETE', url: `/aquariums/${second.id}` }),
      app.inject({ method: 'DELETE', url: `/aquariums/${second.id}` }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([204, 404]);
    expect(await prisma.aquarium.count({ where: { id: second.id } })).toBe(0);
    expect(await defaults()).toEqual([{ id: first.id }]);
  });

  it('transfers every fish when deleting an aquarium', async () => {
    const fish = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        prisma.fish.create({
          data: {
            name: `Fish ${index}`,
            ownerId: owner.id,
            aquariumId: second.id,
          },
        }),
      ),
    );

    const response = await app.inject({
      method: 'DELETE',
      url: `/aquariums/${second.id}`,
      payload: { destinationAquariumId: third.id },
    });

    expect(response.statusCode).toBe(204);
    expect(await prisma.aquarium.count({ where: { id: second.id } })).toBe(0);
    const moved = await prisma.fish.findMany({
      where: { id: { in: fish.map((item) => item.id) } },
    });
    expect(moved).toHaveLength(fish.length);
    expect(moved.every((item) => item.aquariumId === third.id)).toBe(true);
    expect(await defaults()).toEqual([{ id: first.id }]);
  });

  it('preserves a valid default when switching defaults while deleting the old default', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'PATCH', url: `/aquariums/${second.id}/default` }),
      app.inject({ method: 'DELETE', url: `/aquariums/${first.id}` }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 204]);
    expect(await prisma.aquarium.count({ where: { id: first.id } })).toBe(0);
    const currentDefaults = await defaults();
    expect(currentDefaults).toHaveLength(1);
    expect([second.id, third.id]).toContain(currentDefaults[0]!.id);
  });
});
