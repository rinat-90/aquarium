import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('@aquarium/database', () => ({
  prisma: { contentItem: { findMany: mocks.findMany, findUnique: mocks.findUnique } },
}));

// Test the route's validation and publication logic independently of the engine's
// content-definition schema. Engine schema validation should have separate tests.
vi.mock('@aquarium/aquarium-engine/content', () => {
  const contentTypeSchema = z.enum(['THEME', 'FISH_SPECIES', 'DECORATION']);
  return {
    contentTypeSchema,
    contentDefinitionSchema: z.object({
      type: contentTypeSchema,
      data: z.object({ label: z.string() }),
    }),
  };
});

import { contentRoutes } from '../routes/content.js';

const definition = (type: 'THEME' | 'FISH_SPECIES' | 'DECORATION' = 'THEME') => ({
  type,
  data: { label: 'Sample content' },
});

const contentItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'content-1',
  type: 'THEME' as const,
  slug: 'coral-reef',
  name: 'Coral Reef',
  status: 'PUBLISHED',
  publishedVersionId: 'version-2',
  versions: [
    { id: 'version-1', version: 1, schemaVersion: 1, definition: definition() },
    { id: 'version-2', version: 2, schemaVersion: 1, definition: definition() },
  ],
  ...overrides,
});

async function request(url: string) {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(contentRoutes);
  try {
    return await app.inject({ method: 'GET', url });
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
});

describe('GET /content', () => {
  it('returns an empty catalog', async () => {
    const response = await request('/content');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it('queries only published items with a published version and orders them', async () => {
    await request('/content');
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED', publishedVersionId: { not: null } },
      include: { versions: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  });

  it.each(['THEME', 'FISH_SPECIES', 'DECORATION'] as const)(
    'filters by content type %s',
    async (type) => {
      const response = await request(`/content?type=${type}`);
      expect(response.statusCode).toBe(200);
      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED', publishedVersionId: { not: null }, type },
        }),
      );
    },
  );

  it('rejects an invalid type before querying the database', async () => {
    const response = await request('/content?type=INVALID');
    expect(response.statusCode).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('returns the selected published version, not the first version', async () => {
    mocks.findMany.mockResolvedValue([contentItem()]);
    const response = await request('/content');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: 'content-1',
          type: 'THEME',
          slug: 'coral-reef',
          name: 'Coral Reef',
          version: 2,
          schemaVersion: 1,
          definition: { label: 'Sample content' },
        },
      ],
    });
  });

  it('excludes records with no matching published version', async () => {
    mocks.findMany.mockResolvedValue([
      contentItem({ publishedVersionId: 'missing' }),
      contentItem({ publishedVersionId: null }),
    ]);
    expect((await request('/content')).json()).toEqual({ items: [] });
  });

  it('excludes invalid definitions and mismatched definition types', async () => {
    mocks.findMany.mockResolvedValue([
      contentItem({
        versions: [
          {
            id: 'version-2',
            version: 2,
            schemaVersion: 1,
            definition: { type: 'THEME', data: {} },
          },
        ],
      }),
      contentItem({
        versions: [
          { id: 'version-2', version: 2, schemaVersion: 1, definition: definition('FISH_SPECIES') },
        ],
      }),
    ]);
    expect((await request('/content')).json()).toEqual({ items: [] });
  });

  it('keeps valid items while omitting invalid ones', async () => {
    mocks.findMany.mockResolvedValue([
      contentItem({ id: 'valid' }),
      contentItem({ id: 'invalid', publishedVersionId: 'missing' }),
    ]);
    const response = await request('/content');
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0].id).toBe('valid');
  });
});

describe('GET /content/:type/:slug', () => {
  it('looks up content by compound type and slug', async () => {
    mocks.findUnique.mockResolvedValue(contentItem());
    const response = await request('/content/THEME/coral-reef');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 'content-1', version: 2 });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { type_slug: { type: 'THEME', slug: 'coral-reef' } },
      include: { versions: true },
    });
  });

  it('returns 404 for missing content', async () => {
    const response = await request('/content/THEME/unknown');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Content not found' });
  });

  it.each(['DRAFT', 'ARCHIVED'])('returns 404 for %s content', async (status) => {
    mocks.findUnique.mockResolvedValue(contentItem({ status }));
    expect((await request('/content/THEME/coral-reef')).statusCode).toBe(404);
  });

  it('returns 404 if no published version exists', async () => {
    mocks.findUnique.mockResolvedValue(contentItem({ publishedVersionId: null }));
    expect((await request('/content/THEME/coral-reef')).statusCode).toBe(404);
  });

  it('returns 404 if the published definition is invalid', async () => {
    mocks.findUnique.mockResolvedValue(
      contentItem({
        versions: [
          {
            id: 'version-2',
            version: 2,
            schemaVersion: 1,
            definition: { type: 'THEME', data: {} },
          },
        ],
      }),
    );
    expect((await request('/content/THEME/coral-reef')).statusCode).toBe(404);
  });

  it('returns 404 if the published definition has a different type', async () => {
    mocks.findUnique.mockResolvedValue(
      contentItem({
        versions: [
          { id: 'version-2', version: 2, schemaVersion: 1, definition: definition('DECORATION') },
        ],
      }),
    );
    expect((await request('/content/THEME/coral-reef')).statusCode).toBe(404);
  });

  it('rejects an invalid content type before querying the database', async () => {
    const response = await request('/content/INVALID/coral-reef');
    expect(response.statusCode).toBe(400);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
