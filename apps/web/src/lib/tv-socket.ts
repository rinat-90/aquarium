
import { io, type Socket } from 'socket.io-client';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function createTvSocket(displayToken: string): Socket {
  return io(API_URL, {
    autoConnect: false,
    transports: ['websocket'],
    auth: {
      displayToken,
    },
  });
}
