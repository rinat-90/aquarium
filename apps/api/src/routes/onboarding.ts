import type { FastifyInstance } from 'fastify';
import { prisma } from '@aquarium/database';
import { getAuthenticatedUser } from '../lib/get-authenticated-user.js';

/** Account-scoped onboarding status. No client-supplied user ID is accepted. */
export async function onboardingRoutes(app: FastifyInstance) {
  app.get('/api/onboarding', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { onboardingCompleted: true },
    });
    if (!account) return reply.code(401).send({ error: 'Unauthorized' });
    return account;
  });

  // Idempotent: once completed, onboarding cannot be reset accidentally.
  app.post('/api/onboarding/complete', async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const result = await prisma.user.updateMany({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    });
    if (result.count === 0) return reply.code(401).send({ error: 'Unauthorized' });
    return { onboardingCompleted: true };
  });
}
