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
  throw new Error('Ownership integration tests require the aquarium_test database');
}

const { prisma } = await import('@aquarium/database');
const { aquariumRoutes } = await import('../routes/aquariums.js');
const { fishRoutes } = await import('../routes/fish.js');

type TestUser = { id: string };
let alice: TestUser;
let bob: TestUser;
let aliceTank: { id: string };
let bobTank: { id: string };
let bobFish: { id: string };
let app: ReturnType<typeof Fastify>;
const createdUsers: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(aquariumRoutes);
  await app.register(fishRoutes);
  await app.ready();
});

beforeEach(async () => {
  mocks.user.mockReset();
  mocks.notify.mockReset();
  const suffix = randomUUID();
  alice = await prisma.user.create({ data: { email: `alice-${suffix}@example.test` } });
  bob = await prisma.user.create({ data: { email: `bob-${suffix}@example.test` } });
  createdUsers.push(alice.id, bob.id);
  aliceTank = await prisma.aquarium.create({
    data: { name: 'Alice Tank', ownerId: alice.id, isDefault: true },
  });
  bobTank = await prisma.aquarium.create({
    data: { name: 'Bob Tank', ownerId: bob.id, isDefault: true },
  });
  bobFish = await prisma.fish.create({
    data: { name: 'Bob Fish', ownerId: bob.id, aquariumId: bobTank.id },
  });
  mocks.user.mockResolvedValue(alice);
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  createdUsers.length = 0;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('API ownership with real PostgreSQL', () => {
  it('lists only the current user’s aquariums and fish', async () => {
    const tanks = await app.inject({ method: 'GET', url: '/aquariums' });
    const fish = await app.inject({ method: 'GET', url: '/fish' });
    expect(tanks.statusCode).toBe(200);
    expect(tanks.json().map((tank: { id: string }) => tank.id)).toEqual([aliceTank.id]);
    expect(fish.statusCode).toBe(200);
    expect(fish.json()).toEqual([]);
  });

  it('cannot read another user’s aquarium or fish', async () => {
    const tank = await app.inject({ method: 'GET', url: `/aquariums/${bobTank.id}` });
    const fish = await app.inject({ method: 'GET', url: `/fish/${bobFish.id}` });
    expect(tank.statusCode).toBe(404);
    expect(fish.statusCode).toBe(404);
  });

  it('cannot rename another user’s aquarium', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/aquariums/${bobTank.id}`,
      payload: { name: 'Stolen' },
    });
    expect(response.statusCode).toBe(404);
    expect((await prisma.aquarium.findUniqueOrThrow({ where: { id: bobTank.id } })).name).toBe(
      'Bob Tank',
    );
  });

  it('cannot rename or delete another user’s fish', async () => {
    const update = await app.inject({
      method: 'PATCH',
      url: `/fish/${bobFish.id}`,
      payload: { name: 'Stolen' },
    });
    const deletion = await app.inject({ method: 'DELETE', url: `/fish/${bobFish.id}` });
    expect(update.statusCode).toBe(404);
    expect(deletion.statusCode).toBe(404);
    expect((await prisma.fish.findUniqueOrThrow({ where: { id: bobFish.id } })).name).toBe(
      'Bob Fish',
    );
  });

  it('cannot create a fish in another user’s aquarium', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/fish',
      payload: { name: 'Intruder', aquariumId: bobTank.id },
    });
    expect(response.statusCode).toBe(404);
    expect(await prisma.fish.count({ where: { ownerId: alice.id } })).toBe(0);
  });

  it('cannot move an owned fish into another user’s aquarium', async () => {
    const fish = await prisma.fish.create({
      data: { name: 'Alice Fish', ownerId: alice.id, aquariumId: aliceTank.id },
    });
    const response = await app.inject({
      method: 'PATCH',
      url: `/fish/${fish.id}`,
      payload: { aquariumId: bobTank.id },
    });
    expect(response.statusCode).toBe(404);
    expect((await prisma.fish.findUniqueOrThrow({ where: { id: fish.id } })).aquariumId).toBe(
      aliceTank.id,
    );
  });

  it('cannot delete another user’s aquarium or its fish', async () => {
    const response = await app.inject({ method: 'DELETE', url: `/aquariums/${bobTank.id}` });
    expect(response.statusCode).toBe(404);
    expect(await prisma.aquarium.count({ where: { id: bobTank.id } })).toBe(1);
    expect(await prisma.fish.count({ where: { id: bobFish.id } })).toBe(1);
  });

  it('cannot clear another user’s aquarium fish', async () => {
    const response = await app.inject({ method: 'DELETE', url: `/aquariums/${bobTank.id}/fish` });
    expect(response.statusCode).toBe(404);
    expect(await prisma.fish.count({ where: { id: bobFish.id } })).toBe(1);
  });

  it('cannot set another user’s aquarium as default', async () => {
    const response = await app.inject({ method: 'PATCH', url: `/aquariums/${bobTank.id}/default` });
    expect(response.statusCode).toBe(404);
    expect(
      (await prisma.aquarium.findUniqueOrThrow({ where: { id: aliceTank.id } })).isDefault,
    ).toBe(true);
    expect((await prisma.aquarium.findUniqueOrThrow({ where: { id: bobTank.id } })).isDefault).toBe(
      true,
    );
  });
});
