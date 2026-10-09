
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';

import {
  fishIdParamsSchema,
  createFishSchema,
  updateFishSchema,
} from '../schemas/fish.schema.js';

export async function fishRoutes(app: FastifyInstance) {
  const api = app.withTypeProvider<ZodTypeProvider>();

  // List fish belonging to the signed-in user.
  api.get('/fish', async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
      });
    }

    return prisma.fish.findMany({
      where: {
        ownerId: user.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  });

  // Create a fish.
  api.post(
    '/fish',
    {
      schema: {
        body: createFishSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const {
        name,
        species,
        bodyColor,
        finColor,
        size,
        aquariumId,
      } = request.body;

      if (aquariumId) {
        const aquarium = await prisma.aquarium.findFirst({
          where: {
            id: aquariumId,
            ownerId: user.id,
          },
          select: {
            id: true,
          },
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
          species: species ?? 'classic',
          ...(bodyColor !== undefined && { bodyColor }),
          ...(finColor !== undefined && { finColor }),
          ...(size !== undefined && { size }),
          ...(aquariumId !== undefined && { aquariumId }),
          ownerId: user.id,
        },
      });

      return reply.code(201).send(fish);
    },
  );

  // Get a fish owned by the signed-in user.
  api.get(
    '/fish/:id',
    {
      schema: {
        params: fishIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const fish = await prisma.fish.findFirst({
        where: {
          id: request.params.id,
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

  // Update a fish.
  api.patch(
    '/fish/:id',
    {
      schema: {
        params: fishIdParamsSchema,
        body: updateFishSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const {
        name,
        species,
        bodyColor,
        finColor,
        size,
        aquariumId,
      } = request.body;

      // Verify ownership before assigning an aquarium.
      if (aquariumId) {
        const aquarium = await prisma.aquarium.findFirst({
          where: {
            id: aquariumId,
            ownerId: user.id,
          },
          select: {
            id: true,
          },
        });

        if (!aquarium) {
          return reply.code(404).send({
            error: 'Aquarium not found',
          });
        }
      }

      const result = await prisma.fish.updateMany({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
        data: {
          ...(name !== undefined && { name }),
          ...(species !== undefined && { species }),
          ...(bodyColor !== undefined && { bodyColor }),
          ...(finColor !== undefined && { finColor }),
          ...(size !== undefined && { size }),
          ...(aquariumId !== undefined && { aquariumId }),
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: 'Fish not found',
        });
      }

      return prisma.fish.findFirst({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
      });
    },
  );

  // Delete a fish.
  api.delete(
    '/fish/:id',
    {
      schema: {
        params: fishIdParamsSchema,
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const result = await prisma.fish.deleteMany({
        where: {
          id: request.params.id,
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
