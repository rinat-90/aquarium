
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
}
