
import type { FastifyRequest } from 'fastify';
import { auth } from './auth.js';

export async function getAuthenticatedUser(request: FastifyRequest) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(
        key,
        Array.isArray(value) ? value.join(', ') : value,
      );
    }
  }

  const session = await auth.api.getSession({ headers });

  return session?.user ?? null;
}
