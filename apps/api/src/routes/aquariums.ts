
import type { FastifyInstance } from 'fastify';
import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';

export async function aquariumRoutes(app: FastifyInstance) {
  // List aquariums belonging to the signed-in parent.
  app.get('/aquariums', async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
      });
    }

    return prisma.aquarium.findMany({
      where: { ownerId: user.id },
      include: { fish: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  // Get one aquarium, but only if the parent owns it.
  app.get<{ Params: { id: string } }>(
    '/aquariums/:id',
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
        include: { fish: true },
      });

      if (!aquarium) {
        return reply.code(404).send({
          error: 'Aquarium not found',
        });
      }

      return aquarium;
    },
  );


  // Create an aquarium for the signed-in parent.
  app.post<{
    Body: {
      name?: string;
    };
  }>('/aquariums', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
          },
        },
      },
    },
  }, async (request, reply) => {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return reply.code(401).send({
        error: 'Unauthorized',
      });
    }

    const name = request.body.name?.trim() || 'My Aquarium';

    const aquarium = await prisma.aquarium.create({
      data: {
        name,
        ownerId: user.id,
      },
    });

    return reply.code(201).send(aquarium);
  });


  // Rename an aquarium
  app.patch<{
    Params: { id: string };
    Body: { name: string };
  }>(
    '/aquariums/:id',
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

      const name = request.body.name.trim();

      const result = await prisma.aquarium.updateMany({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
        data: { name },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          error: 'Aquarium not found',
        });
      }

      const aquarium = await prisma.aquarium.findFirst({
        where: {
          id: request.params.id,
          ownerId: user.id,
        },
      });

      return reply.send(aquarium);
    },
  );

  // Delete an aquarium
  app.delete<{ Params: { id: string } }>(
    '/aquariums/:id',
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
