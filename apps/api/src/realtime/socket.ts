import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { prisma } from '@aquarium/database';
import { auth } from '../lib/auth.js';

let io: Server | undefined;

const aquariumRoom = (id: string) => `aquarium:${id}`;

export function initializeSocket(
  server: HttpServer,
  webOrigin: string,
) {
  io = new Server(server, {
    cors: {
      origin: webOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie;

      if (!cookie) {
        return next(new Error('Missing session cookie'));
      }

      const session = await auth.api.getSession({
        headers: new Headers({
          cookie,
        }),
      });

      if (!session?.user?.id) {
        return next(new Error('Invalid session'));
      }

      socket.data.userId = session.user.id;
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      next(new Error('Session authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.on(
      'aquarium:join',
      async (
        aquariumId: string,
        acknowledge?: (result: {
          ok: boolean;
        }) => void,
      ) => {
        if (typeof aquariumId !== 'string') {
          acknowledge?.({ ok: false });
          return;
        }

        try {
          const aquarium = await prisma.aquarium.findFirst({
            where: {
              id: aquariumId,
              ownerId: socket.data.userId,
            },
            select: { id: true },
          });

          if (!aquarium) {
            acknowledge?.({ ok: false });
            return;
          }

          await socket.join(aquariumRoom(aquariumId));
          acknowledge?.({ ok: true });
        } catch {
          acknowledge?.({ ok: false });
        }
      },
    );

    socket.on('aquarium:leave', (aquariumId: string) => {
      if (typeof aquariumId === 'string') {
        void socket.leave(aquariumRoom(aquariumId));
      }
    });
  });

  return io;
}

export function notifyAquariumChanged(aquariumId: string) {
  io?.to(aquariumRoom(aquariumId)).emit(
    'aquarium:changed',
    { aquariumId },
  );
}

export async function closeSocket() {
  if (!io) return;

  const server = io;
  io = undefined;

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}