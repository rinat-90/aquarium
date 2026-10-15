import Fastify from 'fastify';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureDefault: vi.fn(),
  notify: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  fishCount: vi.fn(),
  fishUpdateMany: vi.fn(),
  aquariumDeleteMany: vi.fn(),
  raw: vi.fn(),
}));

vi.mock('@aquarium/database', () => ({
  prisma: {
    aquarium: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      updateMany: mocks.updateMany,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../lib/get-authenticated-user.js', () => ({ getAuthenticatedUser: mocks.getUser }));
vi.mock('../services/aquarium.service.js', () => ({ ensureDefaultAquarium: mocks.ensureDefault }));
vi.mock('../realtime/socket.js', () => ({ notifyAquariumChanged: mocks.notify }));

import { aquariumRoutes } from '../routes/aquariums.js';

const user = { id: 'owner-1' };
const aquarium = { id: 'tank-1', ownerId: user.id, name: 'Reef', isDefault: true };
const second = { id: 'tank-2', ownerId: user.id, name: 'Ocean', isDefault: false };

function makeApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(aquariumRoutes);
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(user);
  mocks.ensureDefault.mockResolvedValue(aquarium);
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: mocks.raw,
      aquarium: {
        findMany: mocks.findMany,
        findFirst: mocks.findFirst,
        updateMany: mocks.updateMany,
        deleteMany: mocks.aquariumDeleteMany,
      },
      fish: { count: mocks.fishCount, updateMany: mocks.fishUpdateMany },
    }),
  );
  mocks.raw.mockResolvedValue([{ id: user.id }]);
});

afterEach(() => vi.restoreAllMocks());

describe('aquarium HTTP routes', () => {
  it('rejects unauthenticated list requests without touching the database', async () => {
    mocks.getUser.mockResolvedValue(null);
    const app = makeApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/aquariums' });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Unauthorized' });
      expect(mocks.ensureDefault).not.toHaveBeenCalled();
      expect(mocks.findMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('lists only the signed-in owner’s aquariums', async () => {
    mocks.findMany.mockResolvedValue([aquarium]);
    const app = makeApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/aquariums' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([aquarium]);
      expect(mocks.ensureDefault).toHaveBeenCalledWith(user.id);
      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { ownerId: user.id },
        include: { fish: true },
        orderBy: { createdAt: 'asc' },
      });
    } finally {
      await app.close();
    }
  });

  it('returns 404 when an aquarium is not owned by the user', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const app = makeApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/aquariums/other-tank' });
      expect(response.statusCode).toBe(404);
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { id: 'other-tank', ownerId: user.id },
        include: { fish: true },
      });
    } finally {
      await app.close();
    }
  });

  it('creates an aquarium for the authenticated owner', async () => {
    mocks.create.mockResolvedValue({ ...second, name: 'My Ocean' });
    const app = makeApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/aquariums',
        payload: { name: 'My Ocean' },
      });
      expect(response.statusCode).toBe(201);
      expect(mocks.create).toHaveBeenCalledWith({ data: { name: 'My Ocean', ownerId: user.id } });
    } finally {
      await app.close();
    }
  });

  it('rejects an empty aquarium name before creation', async () => {
    const app = makeApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/aquariums',
        payload: { name: '   ' },
      });
      expect(response.statusCode).toBe(400);
      expect(mocks.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('updates only an aquarium owned by the user and notifies viewers', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findFirst.mockResolvedValue({ ...aquarium, name: 'New Reef' });
    const app = makeApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/aquariums/tank-1',
        payload: { name: 'New Reef' },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { id: aquarium.id, ownerId: user.id },
        data: { name: 'New Reef' },
      });
      expect(mocks.notify).toHaveBeenCalledWith(aquarium.id);
    } finally {
      await app.close();
    }
  });

  it('does not notify when updating a missing aquarium', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const app = makeApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/aquariums/missing',
        payload: { name: 'New Reef' },
      });
      expect(response.statusCode).toBe(404);
      expect(mocks.notify).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('rejects empty update payloads', async () => {
    const app = makeApp();
    try {
      const response = await app.inject({ method: 'PATCH', url: '/aquariums/tank-1', payload: {} });
      expect(response.statusCode).toBe(400);
      expect(mocks.updateMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('prevents deleting the last aquarium', async () => {
    mocks.findMany.mockResolvedValue([aquarium]);
    const app = makeApp();
    try {
      const response = await app.inject({ method: 'DELETE', url: '/aquariums/tank-1' });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: 'You cannot delete your last aquarium.' });
      expect(mocks.aquariumDeleteMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('requires a destination when deleting an aquarium containing fish', async () => {
    mocks.findMany.mockResolvedValue([aquarium, second]);
    mocks.fishCount.mockResolvedValue(2);
    const app = makeApp();
    try {
      const response = await app.inject({ method: 'DELETE', url: '/aquariums/tank-1' });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Choose an aquarium to move your fish to.' });
      expect(mocks.fishUpdateMany).not.toHaveBeenCalled();
      expect(mocks.aquariumDeleteMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('transfers fish and assigns a new default before deleting an aquarium', async () => {
    mocks.findMany.mockResolvedValue([aquarium, second]);
    mocks.fishCount.mockResolvedValue(2);
    const app = makeApp();
    try {
      const response = await app.inject({
        method: 'DELETE',
        url: '/aquariums/tank-1',
        payload: { destinationAquariumId: second.id },
      });
      expect(response.statusCode).toBe(204);
      expect(mocks.fishUpdateMany).toHaveBeenCalledWith({
        where: { ownerId: user.id, aquariumId: aquarium.id },
        data: { aquariumId: second.id },
      });
      expect(mocks.aquariumDeleteMany).toHaveBeenCalledWith({
        where: { id: aquarium.id, ownerId: user.id },
      });
      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { id: second.id, ownerId: user.id },
        data: { isDefault: true },
      });
      expect(mocks.notify).toHaveBeenCalledWith(second.id);
      expect(mocks.notify).toHaveBeenCalledWith(aquarium.id);
    } finally {
      await app.close();
    }
  });

  it('rejects a destination aquarium outside the owner’s aquarium list', async () => {
    mocks.findMany.mockResolvedValue([aquarium, second]);
    mocks.fishCount.mockResolvedValue(1);
    const app = makeApp();
    try {
      const response = await app.inject({
        method: 'DELETE',
        url: '/aquariums/tank-1',
        payload: { destinationAquariumId: 'other-user-tank' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Invalid destination aquarium.' });
      expect(mocks.fishUpdateMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
