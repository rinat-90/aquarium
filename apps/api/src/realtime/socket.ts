import { createHash, randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { prisma } from '@aquarium/database';
import { auth } from '../lib/auth.js';

const FEED_COOLDOWN_MS = 3_000;

const lastFeedByAquarium = new Map<string, number>();

let io: Server | undefined;
const aquariumRoom = (id: string) => `aquarium:${id}`;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
type JoinResult = { ok: boolean };

export function getOnlineTvDisplaySessionIds(): Set<string> {
  const onlineSessionIds = new Set<string>();

  if (!io) {
    return onlineSessionIds;
  }

  for (const socket of io.sockets.sockets.values()) {
    if (!socket.connected) continue;

    const sessionId = socket.data.displaySessionId as
      | string
      | null;

    if (sessionId) {
      onlineSessionIds.add(sessionId);
    }
  }

  return onlineSessionIds;
}

export function disconnectTvDisplaySession(sessionId: string) {
  // Disconnect every connected socket associated with this display session.
  // In a multi-instance deployment, use the Socket.IO Redis adapter and
  // serverSideEmit (or a shared pub/sub channel) to propagate revocations.
  const server = io;
  if (!server) return;
  for (const socket of server.sockets.sockets.values()) {
    if (socket.data.displaySessionId === sessionId) {
      socket.emit('tv:session-revoked');
      socket.disconnect(true);
    }
  }
}

export function switchTvDisplayAquarium(
  sessionId: string,
  aquariumId: string,
) {
  const server = io;
  if (!server) return;

  for (const socket of server.sockets.sockets.values()) {
    if (socket.data.displaySessionId !== sessionId) continue;

    const previousAquariumId = socket.data.displayAquariumId as string | null;

    if (previousAquariumId) {
      socket.leave(aquariumRoom(previousAquariumId));
    }

    socket.data.displayAquariumId = aquariumId;
    void socket.join(aquariumRoom(aquariumId));

    socket.emit('tv:aquarium-switched', { aquariumId });
  }
}

export function initializeSocket(
  httpServer: HttpServer,
  webOrigin: string | string[],
) {
  io = new Server(httpServer, {
    cors: {
      origin: webOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      socket.data.userId = null;
      socket.data.displaySessionId = null;
      socket.data.displayAquariumId = null;
      socket.data.displayExpiresAt = null;

      const displayToken = socket.handshake.auth?.displayToken;
      if (displayToken !== undefined) {
        if (typeof displayToken !== 'string' || displayToken.length < 32 || displayToken.length > 512) {
          return next(new Error('Invalid display token'));
        }
        const session = await prisma.tvDisplaySession.findUnique({
          where: { tokenHash: hashToken(displayToken) },
        });
        if (!session || session.revokedAt || session.expiresAt <= new Date()) {
          return next(new Error('Display session expired or revoked'));
        }
        const aquarium = await prisma.aquarium.findFirst({
          where: { id: session.aquariumId, ownerId: session.ownerId },
          select: { id: true },
        });
        if (!aquarium) return next(new Error('Display access revoked'));
        socket.data.displaySessionId = session.id;
        socket.data.displayAquariumId = aquarium.id;
        socket.data.displayExpiresAt = session.expiresAt.getTime();
        return next();
      }

      const cookie = socket.handshake.headers.cookie;
      if (!cookie) return next();
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      if (session?.user?.id) socket.data.userId = session.user.id;
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const expiresAt = socket.data.displayExpiresAt as number | null;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    if (expiresAt !== null && Number.isFinite(expiresAt)) {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        socket.disconnect(true);
        return;
      }
      // setTimeout is limited to 2^31-1 milliseconds (~24.8 days).
      // Reschedule until expiration (display sessions can last 30 days).
      const scheduleExpiry = () => {
        const wait = expiresAt - Date.now();
        if (wait <= 0) {
          socket.emit('tv:session-expired');
          socket.disconnect(true);
          return;
        }
        expiryTimer = setTimeout(scheduleExpiry, Math.min(wait, 2_147_483_647));
      };
      scheduleExpiry();
    }
    socket.on('disconnect', () => {
      if (expiryTimer) clearTimeout(expiryTimer);
    });

    socket.on('aquarium:join', async (aquariumId: unknown, acknowledge?: (result: JoinResult) => void) => {
      if (typeof aquariumId !== 'string' || !socket.data.userId) {
        acknowledge?.({ ok: false });
        return;
      }
      try {
        const aquarium = await prisma.aquarium.findFirst({
          where: { id: aquariumId, ownerId: socket.data.userId },
          select: { id: true },
        });
        if (!aquarium || !socket.connected) return acknowledge?.({ ok: false });
        await socket.join(aquariumRoom(aquariumId));
        acknowledge?.({ ok: true });
      } catch {
        acknowledge?.({ ok: false });
      }
    });

    socket.on('tv:join', async (acknowledge?: (result: JoinResult) => void) => {
      const sessionId = socket.data.displaySessionId as string | null;
      const aquariumId = socket.data.displayAquariumId as string | null;
      if (!sessionId || !aquariumId) return acknowledge?.({ ok: false });
      try {
        const session = await prisma.tvDisplaySession.findUnique({ where: { id: sessionId } });
        if (!session || session.revokedAt || session.expiresAt <= new Date() || session.aquariumId !== aquariumId) {
          return acknowledge?.({ ok: false });
        }
        const aquarium = await prisma.aquarium.findFirst({
          where: { id: aquariumId, ownerId: session.ownerId },
          select: { id: true },
        });
        if (!aquarium || !socket.connected) return acknowledge?.({ ok: false });
        await socket.join(aquariumRoom(aquariumId));
        // A revoke might have happened while the database queries ran.
        const stillValid = await prisma.tvDisplaySession.findFirst({
          where: {
            id: sessionId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            aquariumId: true,
          },
        });

        if (!stillValid) {
          socket.leave(aquariumRoom(aquariumId));
          socket.disconnect(true);
          return acknowledge?.({ ok: false });
        }

// The aquarium may have changed while tv:join was running.
        if (
          stillValid.aquariumId !== aquariumId ||
          socket.data.displayAquariumId !== aquariumId
        ) {
          socket.leave(aquariumRoom(aquariumId));

          // Tell the TV to synchronize with its current session.
          if (socket.connected) {
            socket.emit('tv:aquarium-switched', {
              aquariumId: stillValid.aquariumId,
            });
          }

          return acknowledge?.({ ok: false });
        }

        acknowledge?.({ ok: true });
      } catch {
        acknowledge?.({ ok: false });
      }
    });

    socket.on(
      'aquarium:feed',
      async (
        aquariumId: unknown,
        acknowledge?: (
          result: {
            ok: boolean;
            retryAfterMs?: number;
          },
        ) => void,
      ) => {
        const userId = socket.data.userId as string | null;

        if (
          typeof aquariumId !== 'string' ||
          !aquariumId ||
          !userId
        ) {
          acknowledge?.({ ok: false });
          return;
        }

        try {
          const aquarium = await prisma.aquarium.findFirst({
            where: {
              id: aquariumId,
              ownerId: userId,
            },
            select: { id: true },
          });

          if (!aquarium || !socket.connected) {
            acknowledge?.({ ok: false });
            return;
          }

          const now = Date.now();
          const lastFeed = lastFeedByAquarium.get(aquariumId) ?? 0;

          const remainingMs = FEED_COOLDOWN_MS - (now - lastFeed);

          if (remainingMs > 0) {
            acknowledge?.({
              ok: false,
              retryAfterMs: remainingMs,
            });
            return;
          }

          lastFeedByAquarium.set(aquariumId, now);

          io?.to(aquariumRoom(aquariumId)).emit('aquarium:feed', {
            aquariumId,
            eventId: randomUUID(),
          });

          acknowledge?.({ ok: true });
        } catch (error) {
          console.error('[Socket] Failed to feed aquarium:', error);
          acknowledge?.({ ok: false });
        }
      },
    );
    socket.on('aquarium:leave', (aquariumId: unknown) => {
      if (typeof aquariumId === 'string' && socket.data.userId) {
        void socket.leave(aquariumRoom(aquariumId));
      }
    });
    socket.on('tv:leave', () => {
      const aquariumId = socket.data.displayAquariumId as string | null;
      if (aquariumId) void socket.leave(aquariumRoom(aquariumId));
    });
  });
  return io;
}

export function notifyAquariumChanged(aquariumId: string) {
  io?.to(aquariumRoom(aquariumId)).emit('aquarium:changed', { aquariumId });
}

export async function closeSocket() {
  if (!io) return;
  const server = io;
  io = undefined;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}


export function setTvDisplayPaused(
  sessionId: string,
  paused: boolean,
) {
  const server = io;
  if (!server) return;

  for (const socket of server.sockets.sockets.values()) {
    if (socket.data.displaySessionId !== sessionId) {
      continue;
    }

    const aquariumId = socket.data.displayAquariumId as
      | string
      | null;

    socket.data.displayPaused = paused;

    if (paused && aquariumId) {
      void socket.leave(aquariumRoom(aquariumId));
    }

    if (!paused && aquariumId) {
      void socket.join(aquariumRoom(aquariumId));
    }

    socket.emit('tv:broadcast-status', {
      paused,
      aquariumId,
    });
  }
}

