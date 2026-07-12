import { describe, it, expect } from 'vitest';
import { createApp } from '../src/server.js';

async function get(app, path) {
  const { default: request } = await import('supertest');
  return request(app).get(path);
}

describe('createApp', () => {
  const env = { KAFKA_BOOTSTRAP_SERVER: 'h:1', DATABASE_URL: 'postgres://u:p@h:1/db?sslmode=require' };
  const fakePool = { query: async () => ({ rows: [] }) };

  it('boots with a fake pool and serves /api/status', async () => {
    const { app } = createApp({ env, pgPool: fakePool, configPath: '/tmp/rev4-config.json' });
    const res = await get(app, '/api/status');
    expect(res.status).toBe(200);
    expect(res.body.state.running).toBe(false);
  });

  it('unknown /api route → JSON 404 (not SPA html)', async () => {
    const { app } = createApp({ env, pgPool: fakePool, configPath: '/tmp/rev4-config.json' });
    const res = await get(app, '/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('a failing pool poll does not crash — error captured on poller.lastError', async () => {
    const bad = { query: async () => { throw new Error('pg down'); } };
    const { poller } = createApp({ env, pgPool: bad, configPath: '/tmp/rev4-config.json' });
    poller.start();
    await new Promise((r) => setTimeout(r, 20));
    poller.stop();
    expect(poller.lastError).toMatch(/pg down/);
  });
});
