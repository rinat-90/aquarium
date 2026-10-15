import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

describe('Fastify test environment', () => {
  it('supports HTTP injection without opening a port', async () => {
    const app = Fastify();
    try {
      app.get('/health-test', async () => ({ status: 'ok' }));
      const response = await app.inject({ method: 'GET', url: '/health-test' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});
