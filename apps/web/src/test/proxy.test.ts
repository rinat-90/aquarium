import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('Vite development proxy', () => {
  it('forwards API and realtime requests to the backend', () => {
    const proxy = viteConfig.server?.proxy;
    expect(proxy).toBeDefined();
    expect(proxy).toHaveProperty('/api');
    expect(proxy).toHaveProperty('/socket.io');
    expect(proxy).toHaveProperty('^/fish(?:/|$)');
  });
});
