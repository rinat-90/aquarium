import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@aquarium/database';

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3001',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins: [
    process.env.WEB_URL ??
    'http://localhost:5173',
  ],
});