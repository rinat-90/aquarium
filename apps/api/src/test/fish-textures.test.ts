import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  notify: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('@aquarium/database', () => ({
  prisma: { fish: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));
vi.mock('../lib/get-authenticated-user.js', () => ({
  getAuthenticatedUser: mocks.getUser,
}));
vi.mock('../realtime/socket.js', () => ({ notifyAquariumChanged: mocks.notify }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    mkdir: mocks.mkdir,
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
    unlink: mocks.unlink,
  };
});

import { fishTextureRoutes } from '../routes/fish-textures.js';

const fishId = '11111111-1111-4111-8111-111111111111';
const oldKey = '22222222-2222-4222-8222-222222222222.png';
const url = `/fish/${fishId}/texture`;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const ownedFish = (overrides: Record<string, unknown> = {}) => ({
  id: fishId,
  aquariumId: 'aquarium-1',
  paintKey: oldKey,
  ...overrides,
});

function multipartBody(
  data: Buffer = png,
  options: { field?: string; mime?: string; filename?: string } = {},
) {
  const boundary = 'aquarium-texture-test-boundary';
  const field = options.field ?? 'texture';
  const mime = options.mime ?? 'image/png';
  const filename = options.filename ?? 'fish.png';
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
      ),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

async function request(options: {
  method: 'GET' | 'POST';
  url?: string;
  headers?: Record<string, string>;
  payload?: Buffer | object;
}) {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(multipart);
  await app.register(fishTextureRoutes);
  try {
    return await app.inject({ ...options, url: options.url ?? url });
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: 'user-1' });
  mocks.findFirst.mockResolvedValue(ownedFish());
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.readFile.mockResolvedValue(png);
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.unlink.mockResolvedValue(undefined);
});

describe('GET fish texture', () => {
  it('requires authentication before querying fish', async () => {
    mocks.getUser.mockResolvedValue(null);
    const response = await request({ method: 'GET' });
    expect(response.statusCode).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('only queries fish owned by the current user', async () => {
    await request({ method: 'GET' });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: fishId, ownerId: 'user-1' },
      select: { paintKey: true },
    });
  });

  it('returns 404 for a missing fish', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await request({ method: 'GET' })).statusCode).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('returns 404 when no texture is assigned', async () => {
    mocks.findFirst.mockResolvedValue(ownedFish({ paintKey: null }));
    expect((await request({ method: 'GET' })).statusCode).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('rejects unsafe stored keys before accessing disk', async () => {
    mocks.findFirst.mockResolvedValue(ownedFish({ paintKey: '../secret.png' }));
    expect((await request({ method: 'GET' })).statusCode).toBe(500);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it('returns PNG bytes with private no-store caching', async () => {
    const response = await request({ method: 'GET' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.rawPayload).toEqual(png);
    expect(mocks.readFile).toHaveBeenCalledWith(expect.stringContaining(oldKey));
  });

  it('returns 404 when the texture file is missing', async () => {
    mocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    const response = await request({ method: 'GET' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('Texture file not found');
  });

  it('returns 500 on unexpected disk read errors', async () => {
    mocks.readFile.mockRejectedValue(new Error('disk failure'));
    expect((await request({ method: 'GET' })).statusCode).toBe(500);
  });
});

describe('POST fish texture', () => {
  it('requires authentication before querying fish', async () => {
    mocks.getUser.mockResolvedValue(null);
    const response = await request({ method: 'POST', ...multipartBody() });
    expect(response.statusCode).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('queries only the owner’s fish', async () => {
    await request({ method: 'POST', ...multipartBody() });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: fishId, ownerId: 'user-1' },
      select: { id: true, aquariumId: true, paintKey: true },
    });
  });

  it('returns 404 if fish is missing', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await request({ method: 'POST', ...multipartBody() })).statusCode).toBe(404);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('rejects non-multipart requests', async () => {
    const response = await request({ method: 'POST', payload: { test: true } });
    expect(response.statusCode).toBe(415);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('rejects multipart requests without a file', async () => {
    const boundary = 'empty-boundary';
    const response = await request({
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.from(`--${boundary}--\r\n`),
    });
    expect(response.statusCode).toBe(400);
  });

  it.each([
    ['wrong field', { field: 'image' }],
    ['wrong MIME', { mime: 'image/jpeg' }],
  ])('rejects %s', async (_name, options) => {
    const response = await request({ method: 'POST', ...multipartBody(png, options) });
    expect(response.statusCode).toBe(415);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('rejects spoofed PNG content', async () => {
    const response = await request({
      method: 'POST',
      ...multipartBody(Buffer.from('not actually a png')),
    });
    expect(response.statusCode).toBe(400);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('rejects a truncated PNG signature', async () => {
    const response = await request({ method: 'POST', ...multipartBody(png.subarray(0, 4)) });
    expect(response.statusCode).toBe(400);
  });

  it('enforces the 5 MB multipart limit', async () => {
    const tooLarge = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
    const response = await request({ method: 'POST', ...multipartBody(tooLarge) });
    expect(response.statusCode).toBe(413);
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('stores a new texture, updates ownership-scoped DB record, notifies, and deletes old texture', async () => {
    const response = await request({ method: 'POST', ...multipartBody() });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.fishId).toBe(fishId);
    expect(body.paintKey).toMatch(/^[\da-f-]{36}\.png$/);
    expect(body.paintKey).not.toBe(oldKey);
    expect(mocks.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith(expect.stringContaining(body.paintKey), png, {
      flag: 'wx',
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: fishId, ownerId: 'user-1' },
      data: { paintKey: body.paintKey },
    });
    expect(mocks.notify).toHaveBeenCalledWith('aquarium-1');
    expect(mocks.unlink).toHaveBeenCalledWith(expect.stringContaining(oldKey));
  });

  it('does not notify when fish has no aquarium', async () => {
    mocks.findFirst.mockResolvedValue(ownedFish({ aquariumId: null, paintKey: null }));
    expect((await request({ method: 'POST', ...multipartBody() })).statusCode).toBe(200);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('does not delete an unsafe previous texture key', async () => {
    mocks.findFirst.mockResolvedValue(ownedFish({ paintKey: '../unsafe.png' }));
    expect((await request({ method: 'POST', ...multipartBody() })).statusCode).toBe(200);
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('deletes the newly written file if the fish disappears before update', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await request({ method: 'POST', ...multipartBody() });
    expect(response.statusCode).toBe(404);
    expect(mocks.unlink).toHaveBeenCalledTimes(1);
    expect(mocks.unlink).toHaveBeenCalledWith(mocks.writeFile.mock.calls[0][0]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('cleans up the new file if the database update throws', async () => {
    mocks.updateMany.mockRejectedValue(new Error('database unavailable'));
    const response = await request({ method: 'POST', ...multipartBody() });
    expect(response.statusCode).toBe(500);
    expect(mocks.unlink).toHaveBeenCalledWith(mocks.writeFile.mock.calls[0][0]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('does not update the database if writing the file fails', async () => {
    mocks.writeFile.mockRejectedValue(new Error('disk full'));
    expect((await request({ method: 'POST', ...multipartBody() })).statusCode).toBe(500);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('succeeds even when removing the previous texture fails', async () => {
    mocks.unlink.mockRejectedValue(new Error('permission denied'));
    const response = await request({ method: 'POST', ...multipartBody() });
    expect(response.statusCode).toBe(200);
    expect(mocks.notify).toHaveBeenCalledWith('aquarium-1');
  });
});
