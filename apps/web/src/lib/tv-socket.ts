
import { io, type Socket } from 'socket.io-client';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function createTvSocket(displayToken: string): Socket {
  return io(API_URL, {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    auth: {
      displayToken,
    },
  });
}
