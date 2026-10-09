
import 'dotenv/config';

import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { prisma } from '@aquarium/database';
import { auth } from './lib/auth.js';
import { aquariumRoutes } from './routes/aquariums.js';
import { fishRoutes } from './routes/fish.js';
import { fishTextureRoutes } from './routes/fish-textures.js';

const app = Fastify({
  logger: true,
});

async function start() {
  try {

    // Better Auth routes
    app.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',

      // Preserve the raw JSON body for Better Auth.
      // Fastify normally parses JSON before the route handler.
      handler: async (request, reply) => {
        const baseURL =
          process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';

        const url = new URL(request.url, baseURL);

        const headers = new Headers();

        for (const [key, value] of Object.entries(request.headers)) {
          if (value !== undefined) {
            headers.set(
              key,
              Array.isArray(value) ? value.join(', ') : value,
            );
          }
        }

        const hasBody =
          request.method !== 'GET' &&
          request.method !== 'HEAD';

        const body = hasBody
          ? typeof request.body === 'string'
            ? request.body
            : request.body == null
              ? undefined
              : JSON.stringify(request.body)
          : undefined;

        const webRequest = new Request(url, {
          method: request.method,
          headers,
          body,
        });

        const response = await auth.handler(webRequest);

        reply.code(response.status);

        // Preserve headers, including multiple Set-Cookie values.
        for (const [key, value] of response.headers) {
          if (key !== 'set-cookie') {
            reply.header(key, value);
          }
        }

        const cookies = response.headers.getSetCookie();

        if (cookies.length > 0) {
          reply.header('set-cookie', cookies);
        }

        return reply.send(Buffer.from(await response.arrayBuffer()));
      },
    });

    // Health check
    app.get('/health', async () => {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    });

    await app.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    });

    // Aquarium routes
    await app.register(aquariumRoutes);
    await app.register(fishRoutes);
    await app.register(fishTextureRoutes);

    // Start server
    await app.listen({
      port: Number(process.env.PORT ?? 3001),
      host: process.env.HOST ?? '127.0.0.1',
    });

    app.log.info('Aquarium API is running');
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
    await app.close();
    await prisma.$disconnect();
  }
}

async function shutdown() {
  await app.close();
  await prisma.$disconnect();
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

void start();
