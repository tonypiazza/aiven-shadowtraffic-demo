import { describe, it, expect } from 'vitest';
import express from 'express';
import { EventEmitter } from 'node:events';
import { createStatusRouter } from '../src/routes/status.js';
import { ConfigManager } from '../src/config/configManager.js';
import github from '../src/domains/github.js';

async function get(app, path) {
  const { default: request } = await import('supertest');
  return request(app).get(path);
}
function makeApp(overrides = {}) {
  const cm = new ConfigManager({ domain: github, kafkaConnection: { kind: 'kafka', producerConfigs: {} } });
  const poller = new EventEmitter();
  const startedAt = overrides.startedAt ?? Date.now();
  const ttlMs = overrides.ttlMs ?? 3600000;
  const app = express();
  app.use('/api', createStatusRouter({ configManager: cm, poller, startedAt, ttlMs }));
  return { app, poller };
}

describe('status routes', () => {
  it('GET /api/status returns control state', async () => {
    const { app } = makeApp();
    const res = await get(app, '/api/status');
    expect(res.status).toBe(200);
    expect(res.body.state.running).toBe(false);
    expect(res.body.state.rates.PushEvent).toBeGreaterThan(0);
  });

  it('GET /api/ttl returns remaining ms not exceeding ttl', async () => {
    const { app } = makeApp({ startedAt: Date.now(), ttlMs: 60000 });
    const res = await get(app, '/api/ttl');
    expect(res.status).toBe(200);
    expect(res.body.remainingMs).toBeGreaterThan(0);
    expect(res.body.remainingMs).toBeLessThanOrEqual(60000);
  });

  it('GET /api/ttl clamps to 0 after expiry', async () => {
    const { app } = makeApp({ startedAt: Date.now() - 120000, ttlMs: 60000 });
    const res = await get(app, '/api/ttl');
    expect(res.body.remainingMs).toBe(0);
  });
});
