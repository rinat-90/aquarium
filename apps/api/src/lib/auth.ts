import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@aquarium/database';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from './auth-emails.js';

const isProduction = process.env.NODE_ENV === 'production';

const trustedOrigins = [
  process.env.WEB_URL ?? 'http://localhost:5173',

  ...(!isProduction
    ? [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://192.168.86.23:5173',

        // HTTPS tunnel for testing the guided fish scanner.
        process.env.WEB_HTTPS ?? '',
      ]
    : []),
]
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter((value, index, origins) => value.length > 0 && origins.indexOf(value) === index);

// The normal first-account verification invokes both callbacks. Email-change
// verification invokes only afterEmailVerification. Track the current request
// so welcome mail is never sent when someone changes their email.
const firstVerificationRequests = new WeakSet<object>();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,

    sendResetPassword: async ({ user, token }) => {
      const webUrl = (process.env.WEB_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');

      const resetUrl = new URL('/reset-password', webUrl);
      resetUrl.searchParams.set('token', token);

      await sendPasswordResetEmail(user.email, user.name, resetUrl.toString());
    },
  },

  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
  },

  emailVerification: {
    beforeEmailVerification: async (_user, request) => {
      if (request) firstVerificationRequests.add(request);
    },
    afterEmailVerification: async (user, request) => {
      if (!request || !firstVerificationRequests.has(request)) return;
      firstVerificationRequests.delete(request);
      try {
        await sendWelcomeEmail(user.email, user.name);
      } catch (error) {
        // A welcome email failure must never prevent successful verification.
        console.error('Failed to send Family Aquarium welcome email:', error);
      }
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, user.name, url);
    },
  },

  trustedOrigins,

  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: isProduction || process.env.BETTER_AUTH_URL?.startsWith('https://') === true,
      httpOnly: true,
    },
  },
});
