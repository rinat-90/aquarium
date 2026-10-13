import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@aquarium/database';
import { auth } from '../lib/auth.js';
import {
  disconnectTvDisplaySession,
  switchTvDisplayAquarium,
  getOnlineTvDisplaySessionIds
} from '../realtime/socket.js';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAIRING_TTL_MS = 5 * 60 * 1000;
const DISPLAY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const generateSecret = () => randomBytes(32).toString('base64url');
const hashSecret = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function bearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token.length >= 32 && token.length <= 512 ? token : null;
}

async function authenticatedUserId(request: FastifyRequest): Promise<string | null> {
  const cookie = request.headers.cookie;
  if (!cookie) return null;
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  return session?.user?.id ?? null;
}

export async function tvPairingRoutes(app: FastifyInstance) {
  // TV: create a challenge. The secret is a bearer capability, not a short PIN.
  app.post('/api/tv/pairing', async (_request, reply) => {
    const code = generateSecret();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await prisma.tvPairingSession.create({
      data: { codeHash: hashSecret(code), expiresAt },
    });
    return reply.code(201).send({ code, expiresAt: expiresAt.toISOString() });
  });

  // TV: poll with its original secret. Only the TV that holds this code
  // should redeem the approval. Redemption is atomic and single-use.
  app.get<{ Params: { code: string } }>(
    '/api/tv/pairing/:code',
    async (request, reply) => {
      const { code } = request.params;
      if (code.length < 32 || code.length > 512) {
        return reply.code(404).send({ error: 'Pairing not found' });
      }
      const codeHash = hashSecret(code);
      const pairing = await prisma.tvPairingSession.findUnique({ where: { codeHash } });
      if (!pairing) return reply.code(404).send({ error: 'Pairing not found' });
      if (pairing.expiresAt <= new Date()) {
        return reply.code(410).send({ status: 'expired' });
      }
      if (pairing.status === 'pending') return { status: 'pending' };
      if (pairing.status !== 'approved' || !pairing.aquariumId || !pairing.approvedByUserId) {
        return reply.code(410).send({ status: 'unavailable' });
      }

      const token = generateSecret();
      const expiresAt = new Date(Date.now() + DISPLAY_TTL_MS);
      const redeemed = await prisma.$transaction(async (tx) => {
        const claimed = await tx.tvPairingSession.updateMany({
          where: { id: pairing.id, status: 'approved', consumedAt: null, expiresAt: { gt: new Date() } },
          data: { status: 'consumed', consumedAt: new Date() },
        });
        if (claimed.count !== 1) return false;
        // Ownership may have changed between approval and redemption.
        const aquarium = await tx.aquarium.findFirst({
          where: { id: pairing.aquariumId!, ownerId: pairing.approvedByUserId! },
          select: { id: true },
        });
        if (!aquarium) return false;
        await tx.tvDisplaySession.create({
          data: {
            tokenHash: hashSecret(token),
            aquariumId: aquarium.id,
            ownerId: pairing.approvedByUserId!,
            expiresAt,
          },
        });
        return true;
      });
      if (!redeemed) return reply.code(409).send({ status: 'unavailable' });
      return { status: 'paired', token, aquariumId: pairing.aquariumId, expiresAt: expiresAt.toISOString() };
    },
  );

  // Phone: owner approves the challenge after scanning the QR URL.
  app.post<{
    Params: { code: string };
    Body: { aquariumId?: string };
  }>('/api/tv/pairing/:code/approve', async (request, reply) => {
    const userId = await authenticatedUserId(request);
    if (!userId) return reply.code(401).send({ error: 'Authentication required' });
    const { code } = request.params;
    const aquariumId = request.body?.aquariumId;
    if (code.length < 32 || code.length > 512 || typeof aquariumId !== 'string' || !aquariumId) {
      return reply.code(400).send({ error: 'Invalid pairing code or aquarium ID' });
    }
    const aquarium = await prisma.aquarium.findFirst({
      where: { id: aquariumId, ownerId: userId },
      select: { id: true },
    });
    if (!aquarium) return reply.code(403).send({ error: 'Aquarium access denied' });
    const updated = await prisma.tvPairingSession.updateMany({
      where: { codeHash: hashSecret(code), status: 'pending', expiresAt: { gt: new Date() } },
      data: { status: 'approved', aquariumId, approvedByUserId: userId, approvedAt: new Date() },
    });
    if (updated.count !== 1) return reply.code(409).send({ error: 'Pairing expired or already used' });
    return { ok: true };
  });

  // Paired TV: aquarium-scoped read-only fish data.
  app.get('/api/tv/display/fish', async (request, reply) => {
    const token = bearerToken(request);
    if (!token) return reply.code(401).send({ error: 'Display token required' });
    const session = await prisma.tvDisplaySession.findUnique({
      where: { tokenHash: hashSecret(token) },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return reply.code(401).send({ error: 'Invalid or expired display token' });
    }
    const aquarium = await prisma.aquarium.findFirst({
      where: { id: session.aquariumId, ownerId: session.ownerId },
      select: { id: true },
    });
    if (!aquarium) return reply.code(403).send({ error: 'Aquarium access revoked' });
    const fish = await prisma.fish.findMany({
      where: { aquariumId: aquarium.id, ownerId: session.ownerId },
      orderBy: { createdAt: 'asc' },
    });
    return { aquariumId: aquarium.id, fish };
  });

  app.get<{ Params: { fishId: string } }>(
    '/api/tv/display/fish/:fishId/texture',
    async (request, reply) => {
      const token = bearerToken(request);

      if (!token) {
        return reply.code(401).send({
          error: 'Display token required',
        });
      }

      const session = await prisma.tvDisplaySession.findUnique({
        where: {
          tokenHash: hashSecret(token),
        },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        return reply.code(401).send({
          error: 'Invalid or expired display token',
        });
      }

      const aquarium = await prisma.aquarium.findFirst({
        where: {
          id: session.aquariumId,
          ownerId: session.ownerId,
        },
        select: {
          id: true,
        },
      });

      if (!aquarium) {
        return reply.code(403).send({
          error: 'Aquarium access revoked',
        });
      }

      const fish = await prisma.fish.findFirst({
        where: {
          id: request.params.fishId,
          aquariumId: aquarium.id,
          ownerId: session.ownerId,
        },
        select: {
          paintKey: true,
        },
      });

      if (!fish?.paintKey) {
        return reply.code(404).send({
          error: 'Fish texture not found',
        });
      }

      const textureKeyPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;

      if (!textureKeyPattern.test(fish.paintKey)) {
        return reply.code(500).send({
          error: 'Invalid texture key',
        });
      }

      const storageDir =
        process.env.STORAGE_DIR ??
        join(process.cwd(), 'storage', 'fish-textures');

      try {
        const buffer = await readFile(
          join(storageDir, fish.paintKey),
        );

        return reply
          .type('image/png')
          .header('Cache-Control', 'private, no-store')
          .send(buffer);
      } catch (error) {
        request.log.error(
          { err: error },
          'Failed to read TV fish texture',
        );

        return reply.code(404).send({
          error: 'Texture file not found',
        });
      }
    },
  );

  // Owner: list active TV display sessions.
  app.get('/api/tv/display/sessions', async (request, reply) => {
    const userId = await authenticatedUserId(request);

    if (!userId) {
      return reply.code(401).send({
        error: 'Authentication required',
      });
    }

    const sessions = await prisma.tvDisplaySession.findMany({
      where: {
        ownerId: userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        aquariumId: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const onlineSessionIds = getOnlineTvDisplaySessionIds();

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        aquariumId: session.aquariumId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isOnline: onlineSessionIds.has(session.id),
      })),
    };
  });

  // Owner: switch the aquarium displayed on a paired TV.
  app.post<{
    Params: { sessionId: string };
    Body: { aquariumId?: string };
  }>(
    '/api/tv/display/sessions/:sessionId/switch',
    async (request, reply) => {
      const userId = await authenticatedUserId(request);

      if (!userId) {
        return reply.code(401).send({
          error: 'Authentication required',
        });
      }

      const { sessionId } = request.params;
      const aquariumId = request.body?.aquariumId;

      if (
        typeof sessionId !== 'string' ||
        !sessionId ||
        sessionId.length > 256 ||
        typeof aquariumId !== 'string' ||
        !aquariumId
      ) {
        return reply.code(400).send({
          error: 'Invalid session or aquarium ID',
        });
      }

      // Verify the user owns the destination aquarium.
      const aquarium = await prisma.aquarium.findFirst({
        where: {
          id: aquariumId,
          ownerId: userId,
        },
        select: { id: true },
      });

      if (!aquarium) {
        return reply.code(403).send({
          error: 'Aquarium access denied',
        });
      }

      // Update only an active session owned by this user.
      const result = await prisma.tvDisplaySession.updateMany({
        where: {
          id: sessionId,
          ownerId: userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { aquariumId },
      });

      if (result.count !== 1) {
        return reply.code(404).send({
          error: 'Active display session not found',
        });
      }

      switchTvDisplayAquarium(sessionId, aquariumId);

      return { ok: true };
    },
  );

  // Owner: revoke an active TV display session.
  app.post<{ Params: { sessionId: string } }>(
    '/api/tv/display/sessions/:sessionId/revoke',
    async (request, reply) => {
      const userId = await authenticatedUserId(request);
      if (!userId) return reply.code(401).send({ error: 'Authentication required' });
      const { sessionId } = request.params;
      if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) {
        return reply.code(400).send({ error: 'Invalid session ID' });
      }
      const result = await prisma.tvDisplaySession.updateMany({
        where: { id: sessionId, ownerId: userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count !== 1) {
        return reply.code(404).send({ error: 'Active display session not found' });
      }
      disconnectTvDisplaySession(sessionId);
      return { ok: true };
    },
  );

}
