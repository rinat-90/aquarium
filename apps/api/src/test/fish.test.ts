import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  notify: vi.fn(),
  fishFindMany: vi.fn(),
  fishFindFirst: vi.fn(),
  fishCreate: vi.fn(),
  fishUpdateMany: vi.fn(),
  fishDeleteMany: vi.fn(),
  aquariumFindFirst: vi.fn(),
}));

vi.mock('@aquarium/database', () => ({
  prisma: {
    fish: {
      findMany: mocks.fishFindMany,
      findFirst: mocks.fishFindFirst,
      create: mocks.fishCreate,
      updateMany: mocks.fishUpdateMany,
      deleteMany: mocks.fishDeleteMany,
    },
    aquarium: { findFirst: mocks.aquariumFindFirst },
  },
}));
vi.mock('../lib/get-authenticated-user.js', () => ({ getAuthenticatedUser: mocks.getUser }));
vi.mock('../realtime/socket.js', () => ({ notifyAquariumChanged: mocks.notify }));

import { fishRoutes } from '../routes/fish.js';

const owner = { id: 'owner-1' };
const fish = {
  id: 'fish-1',
  ownerId: owner.id,
  aquariumId: 'tank-1',
  name: 'Bubbles',
  species: 'classic',
};

function makeApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(fishRoutes);
  return app;
}

async function request(options: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  payload?: object;
}) {
  const app = makeApp();
  try {
    return await app.inject(options);
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(owner);
  mocks.aquariumFindFirst.mockResolvedValue({ id: 'tank-1' });
  mocks.fishFindFirst.mockResolvedValue(fish);
  mocks.fishCreate.mockResolvedValue(fish);
  mocks.fishUpdateMany.mockResolvedValue({ count: 1 });
  mocks.fishDeleteMany.mockResolvedValue({ count: 1 });
});

afterEach(() => vi.restoreAllMocks());

describe('fish HTTP routes', () => {
  it.each([
    ['GET', '/fish'],
    ['GET', '/fish/fish-1'],
    ['POST', '/fish'],
    ['PATCH', '/fish/fish-1'],
    ['DELETE', '/fish/fish-1'],
  ] as const)('requires authentication for %s %s', async (method, url) => {
    mocks.getUser.mockResolvedValue(null);
    const response = await request({
      method,
      url,
      ...((method === 'POST' || method === 'PATCH') && { payload: { name: 'Bubbles' } }),
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.fishCreate).not.toHaveBeenCalled();
    expect(mocks.fishUpdateMany).not.toHaveBeenCalled();
    expect(mocks.fishDeleteMany).not.toHaveBeenCalled();
  });

  it('lists fish scoped to the current owner', async () => {
    mocks.fishFindMany.mockResolvedValue([fish]);
    const response = await request({ method: 'GET', url: '/fish' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([fish]);
    expect(mocks.fishFindMany).toHaveBeenCalledWith({
      where: { ownerId: owner.id },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns only a fish owned by the current user', async () => {
    const response = await request({ method: 'GET', url: '/fish/fish-1' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(fish);
    expect(mocks.fishFindFirst).toHaveBeenCalledWith({
      where: { id: 'fish-1', ownerId: owner.id },
    });
  });

  it('returns 404 for a missing or unowned fish', async () => {
    mocks.fishFindFirst.mockResolvedValue(null);
    const response = await request({ method: 'GET', url: '/fish/other-fish' });
    expect(response.statusCode).toBe(404);
    expect(mocks.fishFindFirst).toHaveBeenCalledWith({
      where: { id: 'other-fish', ownerId: owner.id },
    });
  });

  it('creates a fish with default species and owner', async () => {
    mocks.fishCreate.mockResolvedValue({ ...fish, aquariumId: null });
    const response = await request({ method: 'POST', url: '/fish', payload: { name: 'Bubbles' } });
    expect(response.statusCode).toBe(201);
    expect(mocks.fishCreate).toHaveBeenCalledWith({
      data: { name: 'Bubbles', species: 'classic', ownerId: owner.id },
    });
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('verifies aquarium ownership before creating and notifies the display', async () => {
    const response = await request({
      method: 'POST',
      url: '/fish',
      payload: { name: 'Bubbles', species: 'guppy', aquariumId: 'tank-1', bodyColor: '#12abEF' },
    });
    expect(response.statusCode).toBe(201);
    expect(mocks.aquariumFindFirst).toHaveBeenCalledWith({
      where: { id: 'tank-1', ownerId: owner.id },
      select: { id: true },
    });
    expect(mocks.fishCreate).toHaveBeenCalledWith({
      data: {
        name: 'Bubbles',
        species: 'guppy',
        aquariumId: 'tank-1',
        bodyColor: '#12abEF',
        ownerId: owner.id,
      },
    });
    expect(mocks.notify).toHaveBeenCalledWith('tank-1');
  });

  it('rejects creation in an aquarium owned by someone else', async () => {
    mocks.aquariumFindFirst.mockResolvedValue(null);
    const response = await request({
      method: 'POST',
      url: '/fish',
      payload: { name: 'Bubbles', aquariumId: 'other-tank' },
    });
    expect(response.statusCode).toBe(404);
    expect(mocks.fishCreate).not.toHaveBeenCalled();
  });

  it.each([
    { name: '' },
    { name: 'Bubbles', species: 'shark' },
    { name: 'Bubbles', bodyColor: 'red' },
    { name: 'Bubbles', size: 6 },
    { name: 'Bubbles', headDirection: 'up' },
    { name: 'Bubbles', unknownField: true },
  ])('rejects invalid fish creation payload %j', async (payload) => {
    const response = await request({ method: 'POST', url: '/fish', payload });
    expect(response.statusCode).toBe(400);
    expect(mocks.fishCreate).not.toHaveBeenCalled();
  });

  it('updates only the signed-in user’s fish', async () => {
    const response = await request({
      method: 'PATCH',
      url: '/fish/fish-1',
      payload: { name: 'Nemo' },
    });
    expect(response.statusCode).toBe(200);
    expect(mocks.fishUpdateMany).toHaveBeenCalledWith({
      where: { id: 'fish-1', ownerId: owner.id },
      data: { name: 'Nemo' },
    });
    expect(mocks.notify).toHaveBeenCalledWith('tank-1');
  });

  it('notifies both aquariums when moving a fish', async () => {
    mocks.aquariumFindFirst.mockResolvedValue({ id: 'tank-2' });
    mocks.fishFindFirst
      .mockResolvedValueOnce({ aquariumId: 'tank-1' })
      .mockResolvedValueOnce({ ...fish, aquariumId: 'tank-2' });
    const response = await request({
      method: 'PATCH',
      url: '/fish/fish-1',
      payload: { aquariumId: 'tank-2' },
    });
    expect(response.statusCode).toBe(200);
    expect(mocks.fishUpdateMany).toHaveBeenCalledWith({
      where: { id: 'fish-1', ownerId: owner.id },
      data: { aquariumId: 'tank-2' },
    });
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith('tank-1');
    expect(mocks.notify).toHaveBeenCalledWith('tank-2');
  });

  it('allows removing a fish from an aquarium with null', async () => {
    mocks.fishFindFirst
      .mockResolvedValueOnce({ aquariumId: 'tank-1' })
      .mockResolvedValueOnce({ ...fish, aquariumId: null });
    const response = await request({
      method: 'PATCH',
      url: '/fish/fish-1',
      payload: { aquariumId: null },
    });
    expect(response.statusCode).toBe(200);
    expect(mocks.fishUpdateMany).toHaveBeenCalledWith({
      where: { id: 'fish-1', ownerId: owner.id },
      data: { aquariumId: null },
    });
    expect(mocks.aquariumFindFirst).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith('tank-1');
  });

  it('rejects moving fish to an unowned aquarium', async () => {
    mocks.aquariumFindFirst.mockResolvedValue(null);
    const response = await request({
      method: 'PATCH',
      url: '/fish/fish-1',
      payload: { aquariumId: 'other-tank' },
    });
    expect(response.statusCode).toBe(404);
    expect(mocks.fishUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects empty fish updates', async () => {
    const response = await request({ method: 'PATCH', url: '/fish/fish-1', payload: {} });
    expect(response.statusCode).toBe(400);
    expect(mocks.fishUpdateMany).not.toHaveBeenCalled();
  });

  it('does not update fish owned by someone else', async () => {
    mocks.fishFindFirst.mockResolvedValue(null);
    const response = await request({
      method: 'PATCH',
      url: '/fish/other-fish',
      payload: { name: 'Nope' },
    });
    expect(response.statusCode).toBe(404);
    expect(mocks.fishUpdateMany).not.toHaveBeenCalled();
  });

  it('returns 404 if an update affects zero rows', async () => {
    mocks.fishUpdateMany.mockResolvedValue({ count: 0 });
    const response = await request({
      method: 'PATCH',
      url: '/fish/fish-1',
      payload: { name: 'Nemo' },
    });
    expect(response.statusCode).toBe(404);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('deletes an owned fish and notifies the aquarium', async () => {
    const response = await request({ method: 'DELETE', url: '/fish/fish-1' });
    expect(response.statusCode).toBe(204);
    expect(mocks.fishDeleteMany).toHaveBeenCalledWith({
      where: { id: 'fish-1', ownerId: owner.id },
    });
    expect(mocks.notify).toHaveBeenCalledWith('tank-1');
  });

  it('does not delete a fish owned by someone else', async () => {
    mocks.fishFindFirst.mockResolvedValue(null);
    const response = await request({ method: 'DELETE', url: '/fish/other-fish' });
    expect(response.statusCode).toBe(404);
    expect(mocks.fishDeleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 when deleteMany affects zero rows', async () => {
    mocks.fishDeleteMany.mockResolvedValue({ count: 0 });
    const response = await request({ method: 'DELETE', url: '/fish/fish-1' });
    expect(response.statusCode).toBe(404);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
