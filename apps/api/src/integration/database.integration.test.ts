import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || new URL(databaseUrl).pathname !== '/aquarium_test') {
  throw new Error('Integration tests require DATABASE_URL pointing to aquarium_test');
}

// Import only after checking the database URL.
const { prisma } = await import('@aquarium/database');

const userIds: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  for (const id of userIds) {
    await prisma.user.deleteMany({ where: { id } });
  }

  await prisma.$disconnect();
});

async function createTestUser() {
  const user = await prisma.user.create({
    data: {
      email: `integration-${randomUUID()}@example.test`,
    },
  });

  userIds.push(user.id);
  return user;
}

describe('PostgreSQL integration', () => {
  it('creates an aquarium belonging to a user', async () => {
    const user = await createTestUser();

    const aquarium = await prisma.aquarium.create({
      data: {
        name: 'Integration Aquarium',
        ownerId: user.id,
      },
    });

    const saved = await prisma.aquarium.findUnique({
      where: { id: aquarium.id },
      include: { owner: true },
    });

    expect(saved?.name).toBe('Integration Aquarium');
    expect(saved?.owner.id).toBe(user.id);
  });

  it('transfers a fish between aquariums', async () => {
    const user = await createTestUser();

    const first = await prisma.aquarium.create({
      data: { name: 'First', ownerId: user.id },
    });

    const second = await prisma.aquarium.create({
      data: { name: 'Second', ownerId: user.id },
    });

    const fish = await prisma.fish.create({
      data: {
        name: 'Nemo',
        ownerId: user.id,
        aquariumId: first.id,
      },
    });

    await prisma.fish.update({
      where: { id: fish.id },
      data: { aquariumId: second.id },
    });

    const updated = await prisma.fish.findUnique({
      where: { id: fish.id },
    });

    expect(updated?.aquariumId).toBe(second.id);
  });

  it('rolls back a failed transaction', async () => {
    const user = await createTestUser();
    const name = `Rollback-${randomUUID()}`;

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.aquarium.create({
          data: { name, ownerId: user.id },
        });

        throw new Error('Simulated failure');
      }),
    ).rejects.toThrow('Simulated failure');

    const count = await prisma.aquarium.count({
      where: { name, ownerId: user.id },
    });

    expect(count).toBe(0);
  });

  it('rejects an aquarium with a nonexistent owner', async () => {
    await expect(
      prisma.aquarium.create({
        data: {
          name: 'Invalid Owner',
          ownerId: `missing-${randomUUID()}`,
        },
      }),
    ).rejects.toThrow();
  });

  it('cascades aquarium deletion when its owner is deleted', async () => {
    const user = await createTestUser();

    const aquarium = await prisma.aquarium.create({
      data: { name: 'Cascade Test', ownerId: user.id },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const result = await prisma.aquarium.findUnique({
      where: { id: aquarium.id },
    });

    expect(result).toBeNull();
  });
});
