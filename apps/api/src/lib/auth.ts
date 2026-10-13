
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@aquarium/database';

const isProduction = process.env.NODE_ENV === 'production';

const trustedOrigins = [
  process.env.WEB_URL ?? 'http://localhost:5173',

  ...(!isProduction
    ? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.86.23:5173',

      // HTTPS tunnel for testing the guided fish scanner.
      'https://afford-traveller-speed-tba.trycloudflare.com',
      'https://begins-rendered-soccer-incorporated.trycloudflare.com',

    ]
    : []),
]
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(
    (value, index, origins) =>
      value.length > 0 && origins.indexOf(value) === index,
  );

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

  trustedOrigins,

  advanced: {
    defaultCookieAttributes: {
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      httpOnly: true,
    },
  },
});
