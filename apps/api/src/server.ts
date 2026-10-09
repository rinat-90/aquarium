
import 'dotenv/config';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';

import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { prisma } from '@aquarium/database';

import { auth } from './lib/auth.js';
import { aquariumRoutes } from './routes/aquariums.js';
import { fishRoutes } from './routes/fish.js';
import { fishTextureRoutes } from './routes/fish-textures.js';

const app = Fastify({
  logger: true,
});

// Zod request validation and response serialization.
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Consistent API error responses.

app.setErrorHandler((error, request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({
      error: 'Validation failed',
      details: error.validation.map((issue) => ({
        path: issue.instancePath,
        message: issue.message,
      })),
    });
  }

  // Safely extract properties from unknown errors.
  const statusCode =
    error !== null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500;

  const message =
    error instanceof Error
      ? error.message
      : 'Unexpected error';

  if (statusCode >= 500) {
    request.log.error(error);
  } else {
    request.log.warn(
      { err: error },
      'Request failed',
    );
  }

  return reply.code(statusCode).send({
    error:
      statusCode >= 500
        ? 'Internal server error'
        : message,
  });
});


async function start() {
  try {
    // Register CORS before all routes, including Better Auth.
    await app.register(cors, {
      origin: 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Multipart uploads for fish PNG textures.
    await app.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    });

    // Better Auth routes.
    // Better Auth handles its own request validation.
    app.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',

      handler: async (request, reply) => {
        const baseURL =
          process.env.BETTER_AUTH_URL ??
          'http://localhost:3001';

        const url = new URL(request.url, baseURL);

        const headers = new Headers();

        for (const [key, value] of Object.entries(
          request.headers,
        )) {
          if (value !== undefined) {
            headers.set(
              key,
              Array.isArray(value)
                ? value.join(', ')
                : value,
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

        // Forward response headers except Set-Cookie,
        // which must preserve multiple values.
        for (const [key, value] of response.headers) {
          if (key !== 'set-cookie') {
            reply.header(key, value);
          }
        }

        const cookies = response.headers.getSetCookie();

        if (cookies.length > 0) {
          reply.header('set-cookie', cookies);
        }

        return reply.send(
          Buffer.from(await response.arrayBuffer()),
        );
      },
    });

    // Database health check.
    app.get('/health', async () => {
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    });

    // Application routes.
    await app.register(aquariumRoutes);
    await app.register(fishRoutes);
    await app.register(fishTextureRoutes);

    // Start API server.
    await app.listen({
      port: Number(process.env.PORT ?? 3001),
      host: process.env.HOST ?? '127.0.0.1',
    });

    app.log.info('Aquarium API is running');
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;

    await shutdown();
  }
}

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Failed to close Fastify');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

void start();
