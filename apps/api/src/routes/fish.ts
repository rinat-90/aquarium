
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';

const fishSpeciesSchema = z.enum([
  'classic',
  'angelfish',
  'drawn',
]);

const fishNameSchema = z
  .string()
  .trim()
  .min(1, 'Fish name is required')
  .max(100, 'Fish name must be 100 characters or less');

const fishColorSchema = z
  .string()
  .regex(
    /^#[0-9a-fA-F]{6}$/,
    'Color must be a valid hex color',
  );

const fishSizeSchema = z
  .number()
  .min(0.1)
  .max(5);

const fishIdParamsSchema = z.object({
  id: z.string().min(1),
});

const createFishSchema = z.strictObject({
  name: fishNameSchema,
  species: fishSpeciesSchema.default('classic'),
  bodyColor: fishColorSchema.default('#4F9CF9'),
  finColor: fishColorSchema.default('#3B82F6'),
  size: fishSizeSchema.default(1),
  aquariumId: z.string().min(1).optional(),
});

const updateFishSchema = z
  .strictObject({
    name: fishNameSchema.optional(),
    species: fishSpeciesSchema.optional(),
    bodyColor: fishColorSchema.optional(),
    finColor: fishColorSchema.optional(),
    size: fishSizeSchema.optional(),
    aquariumId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field is required',
  );

type CreateFishBody = z.input<typeof createFishSchema>;
type UpdateFishBody = z.input<typeof updateFishSchema>;

type FishParams = z.infer<typeof fishIdParamsSchema>;

function validationError(
  reply: {
    code: (status: number) => {
      send: (body: unknown) => unknown;
    };
  },
  error: z.ZodError,
) {
  return reply.code(400).send({
    error: 'Validation failed',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export async function fishRoutes(app: FastifyInstance) {
  // List fish belonging to the signed-in parent.
  app.get('/fish', async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
      });
    }

    return prisma.fish.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    });
  });

  // Create a fish.
  app.post<{ Body: CreateFishBody }>(
    '/fish',
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const parsed = createFishSchema.safeParse(request.body);

      if (!parsed.success) {
        return validationError(reply, parsed.error);
      }

      const {
        name,
        species,
        bodyColor,
        finColor,
        size,
        aquariumId,
      } = parsed.data;

      // Never allow a fish to be assigned to
      // another parent's aquarium.
      if (aquariumId) {
        const aquarium = await prisma.aquarium.findFirst({
          where: {
            id: aquariumId,
            ownerId: user.id,
          },
          select: { id: true },
        });

        if (!aquarium) {
          return reply.code(404).send({
            error: 'Aquarium not found',
          });
        }
      }

      const fish = await prisma.fish.create({
        data: {
          name,
          species,
          bodyColor,
          finColor,
          size,
          ownerId: user.id,
          aquariumId: aquariumId ?? null,
        },
      });

      return reply.code(201).send(fish);
    },
  );

  // Get a single fish.
  app.get<{ Params: FishParams }>(
    '/fish/:id',
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const parsed = fishIdParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return validationError(reply, parsed.error);
      }

      const fish = await prisma.fish.findFirst({
        where: {
          id: parsed.data.id,
          ownerId: user.id,
        },
      });

      if (!fish) {
        return reply.code(404).send({
          error: 'Fish not found',
        });
      }

      return fish;
    },
  );

  // Update a fish, including moving it between aquariums.
  app.patch<{
    Params: FishParams;
    Body: UpdateFishBody;
  }>(
    '/fish/:id',
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const parsedParams = fishIdParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return validationError(reply, parsedParams.error);
      }

      const parsedBody = updateFishSchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        return validationError(reply, parsedBody.error);
      }

      const { aquariumId, ...otherFields } =
        parsedBody.data;

      const fishId = parsedParams.data.id;

      // Check aquarium ownership before updating.
      if (aquariumId !== undefined && aquariumId !== null) {
        const aquarium = await prisma.aquarium.findFirst({
          where: {
            id: aquariumId,
            ownerId: user.id,
          },
          select: { id: true },
        });

        if (!aquarium) {
          return reply.code(404).send({
            error: 'Aquarium not found',
          });
        }
      }

      // updateMany ensures the ownership condition
      // is applied to the write itself.
      const result = await prisma.fish.updateMany({
        where: {
          id: fishId,
          ownerId: user.id,
        },
        data: {
          ...otherFields,
          ...(aquariumId !== undefined
            ? { aquariumId }
            : {}),
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: 'Fish not found',
        });
      }

      return prisma.fish.findFirst({
        where: {
          id: fishId,
          ownerId: user.id,
        },
      });
    },
  );

  // Delete a fish.
  app.delete<{ Params: FishParams }>(
    '/fish/:id',
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const parsed = fishIdParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return validationError(reply, parsed.error);
      }

      const result = await prisma.fish.deleteMany({
        where: {
          id: parsed.data.id,
          ownerId: user.id,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: 'Fish not found',
        });
      }

      return reply.code(204).send();
    },
  );
}
