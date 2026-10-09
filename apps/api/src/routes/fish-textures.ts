
import type { FastifyInstance } from 'fastify';
import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';

import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { readFile } from 'node:fs/promises';
import { isNativeError } from 'node:util/types';

const STORAGE_DIR = join(
  process.cwd(),
  'storage',
  'fish-textures',
);

const PNG_SIGNATURE = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
]);

export async function fishTextureRoutes(app: FastifyInstance) {

  // Download a fish's painted texture
  app.get<{ Params: { id: string } }>(
    '/fish/:id/texture',
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
        select: {
          paintKey: true,
        },
      });

      if (!fish) {
        return reply.code(404).send({
          error: 'Fish not found',
        });
      }

      if (!fish.paintKey) {
        return reply.code(404).send({
          error: 'Fish has no painted texture',
        });
      }

      // Only allow UUID-generated PNG filenames.
      if (
        !/^[0-9a-f-]{36}\.png$/i.test(fish.paintKey)
      ) {
        return reply.code(500).send({
          error: 'Invalid stored texture key',
        });
      }

      const filePath = join(STORAGE_DIR, fish.paintKey);

      let buffer: Buffer;

      try {
        buffer = await readFile(filePath);
      } catch (error) {
        if (
          isNativeError(error) &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return reply.code(404).send({
            error: 'Texture file not found',
          });
        }

        throw error;
      }

      return reply
        .type('image/png')
        .header('Cache-Control', 'private, no-store')
        .send(Buffer.from(buffer));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/fish/:id/texture',
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

      if (!request.isMultipart()) {
        return reply.code(415).send({
          error: 'Expected multipart/form-data',
        });
      }

      const file = await request.file({
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      });

      if (!file) {
        return reply.code(400).send({
          error: 'No file uploaded',
        });
      }

      if (
        file.fieldname !== 'texture' ||
        file.mimetype !== 'image/png'
      ) {
        return reply.code(415).send({
          error: 'Expected a PNG file in the texture field',
        });
      }

      const buffer = await file.toBuffer();

      if (
        buffer.length < PNG_SIGNATURE.length ||
        !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
      ) {
        return reply.code(400).send({
          error: 'Invalid PNG file',
        });
      }

      await mkdir(STORAGE_DIR, { recursive: true });

      const paintKey = `${randomUUID()}.png`;
      const filePath = join(STORAGE_DIR, paintKey);

      await writeFile(filePath, buffer, { flag: 'wx' });

      try {
        const updated = await prisma.fish.updateMany({
          where: {
            id: fish.id,
            ownerId: user.id,
          },
          data: { paintKey },
        });

        if (updated.count === 0) {
          await unlink(filePath);
          return reply.code(404).send({
            error: 'Fish not found',
          });
        }
      } catch (error) {
        await unlink(filePath).catch(() => {});
        throw error;
      }

      return reply.send({
        fishId: fish.id,
        paintKey,
        message: 'Texture uploaded successfully',
      });
    },
  );
}
