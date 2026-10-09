
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';
import { ensureDefaultAquarium } from '../services/aquarium.service.js';

import {
  aquariumIdParamsSchema,
  createAquariumSchema,
  updateAquariumSchema,
} from '../schemas/aquarium.schema.js';

export async function aquariumRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<ZodTypeProvider>();

  // List aquariums belonging to the signed-in parent.
  // Automatically create a default aquarium if none exists.
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

  // Get one aquarium, only if the parent owns it.
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

  // Create an additional aquarium for the signed-in parent.
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

      // Only update aquariums belonging to this user.
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

  // Delete an aquarium.
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

      const result = await prisma.aquarium.deleteMany({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: 'Aquarium not found',
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
        const aquarium = await prisma.$transaction(async (tx) => {
          // Serialize default changes for this user.
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

          // No changes needed if this is already the default.
          if (target.isDefault) {
            return target;
          }

          // Clear the previous default first to satisfy
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
            where: { id: target.id },
            data: {
              isDefault: true,
            },
          });
        });

        if (!aquarium) {
          return reply.code(404).send({
            error: 'Aquarium not found',
          });
        }

        return aquarium;
      } catch (error) {
        request.log.error(error, 'Failed to set default aquarium');

        return reply.code(500).send({
          error: 'Failed to set default aquarium',
        });
      }
    },
  );

}
