
import type { FastifyInstance } from 'fastify';
import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';

type CreateFishBody = {
  name: string;
  species?: string;
  bodyColor?: string;
  finColor?: string;
  size?: number;
  aquariumId?: string;
};

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
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              pattern: '\\S',
            },
            species: {
              type: 'string',
              enum: ['classic', 'angelfish'],
            },
            bodyColor: {
              type: 'string',
              pattern: '^#[0-9a-fA-F]{6}$',
            },
            finColor: {
              type: 'string',
              pattern: '^#[0-9a-fA-F]{6}$',
            },
            size: {
              type: 'number',
              minimum: 0.1,
              maximum: 5,
            },
            aquariumId: {
              type: 'string',
              minLength: 1,
            },
          },
        },
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

      // Never allow a fish to be assigned to another parent's aquarium.
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
          name: name.trim(),
          species: species ?? 'classic',
          bodyColor: bodyColor ?? '#4F9CF9',
          finColor: finColor ?? '#3B82F6',
          size: size ?? 1,
          ownerId: user.id,
          aquariumId: aquariumId ?? null,
        },
      });

      return reply.code(201).send(fish);
    },
  );


  // Get a single fish
  app.get<{ Params: { id: string } }>(
    '/fish/:id',
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

  // Update a fish, including moving it between aquariums
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      species?: string;
      bodyColor?: string;
      finColor?: string;
      size?: number;
      aquariumId?: string | null;
    };
  }>(
    '/fish/:id',
    {
      schema: {
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              pattern: '\\S',
            },
            species: {
              type: 'string',
              enum: ['classic', 'angelfish'],
            },
            bodyColor: {
              type: 'string',
              pattern: '^#[0-9a-fA-F]{6}$',
            },
            finColor: {
              type: 'string',
              pattern: '^#[0-9a-fA-F]{6}$',
            },
            size: {
              type: 'number',
              minimum: 0.1,
              maximum: 5,
            },
            aquariumId: {
              anyOf: [
                { type: 'string', minLength: 1 },
                { type: 'null' },
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return reply.code(401).send({
          error: 'Unauthorized',
        });
      }

      const existingFish = await prisma.fish.findFirst({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
        select: { id: true },
      });

      if (!existingFish) {
        return reply.code(404).send({
          error: 'Fish not found',
        });
      }

      const { aquariumId, name, ...otherFields } = request.body;

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

      const result = await prisma.fish.updateMany({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
        data: {
          ...otherFields,
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(aquariumId !== undefined ? { aquariumId } : {}),
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

  // Delete a fish
  app.delete<{ Params: { id: string } }>(
    '/fish/:id',
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
