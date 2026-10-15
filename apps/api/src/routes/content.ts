import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@aquarium/database';
import { contentTypeSchema, contentDefinitionSchema } from '@aquarium/aquarium-engine/content';

const listQuery = z.object({ type: contentTypeSchema.optional() });
const detailParams = z.object({ type: contentTypeSchema, slug: z.string().min(1) });

function toPublicItem(item: {
  id: string;
  type: 'THEME' | 'FISH_SPECIES' | 'DECORATION';
  slug: string;
  name: string;
  publishedVersionId: string | null;
  versions: Array<{ id: string; version: number; schemaVersion: number; definition: unknown }>;
}) {
  const version = item.versions.find((v) => v.id === item.publishedVersionId);
  if (!version) return null;
  const parsed = contentDefinitionSchema.safeParse(version.definition);
  if (!parsed.success || parsed.data.type !== item.type) return null;
  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    name: item.name,
    version: version.version,
    schemaVersion: version.schemaVersion,
    definition: parsed.data.data,
  };
}

export async function contentRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get('/content', { schema: { querystring: listQuery } }, async (request) => {
    const items = await prisma.contentItem.findMany({
      where: {
        status: 'PUBLISHED',
        publishedVersionId: { not: null },
        ...(request.query.type ? { type: request.query.type } : {}),
      },
      include: { versions: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return { items: items.map(toPublicItem).filter((item) => item !== null) };
  });

  api.get('/content/:type/:slug', { schema: { params: detailParams } }, async (request, reply) => {
    const item = await prisma.contentItem.findUnique({
      where: {
        type_slug: {
          type: request.params.type,
          slug: request.params.slug,
        },
      },
      include: {
        versions: true,
      },
    });
    if (!item || item.status !== 'PUBLISHED') {
      return reply.code(404).send({ error: 'Content not found' });
    }
    const result = toPublicItem(item);
    if (!result) return reply.code(404).send({ error: 'Content not found' });
    return result;
  });
}
