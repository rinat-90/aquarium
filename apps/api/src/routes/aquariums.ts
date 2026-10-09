
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { z } from 'zod';

import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';
import { ensureDefaultAquarium } from '../services/aquarium.service.js';

import {
  aquariumIdParamsSchema,
  createAquariumSchema,
  updateAquariumSchema,
} from '../schemas/aquarium.schema.js';

// DELETE requests can have an optional JSON body.
// Validate it manually to support both empty and non-empty aquariums.
const deleteAquariumBodySchema = z.object({
  destinationAquariumId: z.string().min(1).optional(),
});

export async function aquariumRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<ZodTypeProvider>();

  // List the signed-in user's aquariums.
  api.get('/aquariums', async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
      });
    }

    await ensureDefaultAquarium(user.id);

    return prisma.aquarium.findMany({
      where: {
        ownerId: user.id,
      },
      include: {
        fish: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  });

  // Get one aquarium.
  api.get(
    '/aquariums/:id',
    {
      schema: {
        params: aquariumIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const aquarium = await prisma.aquarium.findFirst({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
        include: {
          fish: true,
        },
      });

      if (!aquarium) {
        return reply.code(404).send({
          error: 'Aquarium not found',
        });
      }

      return aquarium;
    },
  );

  // Create an aquarium.
  api.post(
    '/aquariums',
    {
      schema: {
        body: createAquariumSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      // Ensure the user's initial default exists first.
      await ensureDefaultAquarium(user.id);

      const aquarium = await prisma.aquarium.create({
        data: {
          name: request.body.name ?? 'My Aquarium',
          ownerId: user.id,
        },
      });

      return reply.code(201).send(aquarium);
    },
  );

  // Rename an aquarium.
  api.patch(
    '/aquariums/:id',
    {
      schema: {
        params: aquariumIdParamsSchema,
        body: updateAquariumSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const result = await prisma.aquarium.updateMany({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
        data: {
          name: request.body.name,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: 'Aquarium not found',
        });
      }

      return prisma.aquarium.findFirst({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
      });
    },
  );

  // Delete an aquarium, transferring its fish safely.
  api.delete(
    '/aquariums/:id',
    {
      schema: {
        params: aquariumIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const parsedBody = deleteAquariumBodySchema.safeParse(
        request.body ?? {},
      );

      if (!parsedBody.success) {
        return reply.code(400).send({
          error: 'Invalid deletion request',
          details: z.flattenError(parsedBody.error),
        });
      }

      const aquariumId = request.params.id;
      const destinationId =
        parsedBody.data.destinationAquariumId;

      const result = await prisma.$transaction(async (tx) => {
        // Serialize aquarium changes for this owner.
        await tx.$queryRaw`
          SELECT id
          FROM "User"
          WHERE id = ${user.id}
          FOR UPDATE
        `;

        const aquariums = await tx.aquarium.findMany({
          where: {
            ownerId: user.id,
          },
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        });

        const source = aquariums.find(
          (item) => item.id === aquariumId,
        );

        if (!source) {
          return {
            status: 404 as const,
            error: 'Aquarium not found',
          };
        }

        const remaining = aquariums.filter(
          (item) => item.id !== aquariumId,
        );

        if (remaining.length === 0) {
          return {
            status: 409 as const,
            error: 'You cannot delete your last aquarium.',
          };
        }

        const fishCount = await tx.fish.count({
          where: {
            ownerId: user.id,
            aquariumId,
          },
        });

        if (fishCount > 0 && !destinationId) {
          return {
            status: 400 as const,
            error: 'Choose an aquarium to move your fish to.',
          };
        }

        if (
          destinationId &&
          !remaining.some(
            (item) => item.id === destinationId,
          )
        ) {
          return {
            status: 400 as const,
            error: 'Invalid destination aquarium.',
          };
        }

        // Move all fish before deleting the aquarium.
        if (fishCount > 0 && destinationId) {
          await tx.fish.updateMany({
            where: {
              ownerId: user.id,
              aquariumId,
            },
            data: {
              aquariumId: destinationId,
            },
          });
        }

        // Delete only an aquarium owned by this user.
        await tx.aquarium.deleteMany({
          where: {
            id: aquariumId,
            ownerId: user.id,
          },
        });

        // Assign a new default if necessary.
        if (source.isDefault) {
          const nextDefaultId =
            destinationId ?? remaining[0]!.id;

          await tx.aquarium.updateMany({
            where: {
              id: nextDefaultId,
              ownerId: user.id,
            },
            data: {
              isDefault: true,
            },
          });
        }

        return {
          status: 204 as const,
        };
      });

      if (result.status !== 204) {
        return reply.code(result.status).send({
          error: result.error,
        });
      }

      return reply.code(204).send();
    },
  );

  // Set the signed-in user's default aquarium.
  api.patch(
    '/aquariums/:id/default',
    {
      schema: {
        params: aquariumIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const { id } = request.params;

      try {
        const aquarium = await prisma.$transaction(
          async (tx) => {
            // Serialize default changes for this owner.
            await tx.$queryRaw`
              SELECT id
              FROM "User"
              WHERE id = ${user.id}
              FOR UPDATE
            `;

            const target = await tx.aquarium.findFirst({
              where: {
                id,
                ownerId: user.id,
              },
            });

            if (!target) {
              return null;
            }

            if (target.isDefault) {
              return target;
            }

            // Clear the old default first to satisfy
            // the partial unique index.
            await tx.aquarium.updateMany({
              where: {
                ownerId: user.id,
                isDefault: true,
              },
              data: {
                isDefault: false,
              },
            });

            return tx.aquarium.update({
              where: {
                id: target.id,
              },
              data: {
                isDefault: true,
              },
            });
          },
        );

        if (!aquarium) {
          return reply.code(404).send({
            error: 'Aquarium not found',
          });
        }

        return aquarium;
      } catch (error) {
        request.log.error(
          error,
          'Failed to set default aquarium',
        );

        return reply.code(500).send({
          error: 'Failed to set default aquarium',
        });
      }
    },
  );
}
