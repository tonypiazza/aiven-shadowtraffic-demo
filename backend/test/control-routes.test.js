import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { ConfigManager } from '../src/config/configManager.js';
import { createControlRouter } from '../src/routes/control.js';
import github from '../src/domains/github.js';

function makeApp() {
  const cm = new ConfigManager({ domain: github, kafkaConnection: { kind: 'kafka', producerConfigs: {} } });
  cm.writeConfig = () => {}; // stub disk write
  const app = express();
  app.use(express.json());
  app.use('/api/control', createControlRouter(cm));
  return { app, cm };
}

async function post(app, path, body) {
  const { default: request } = await import('supertest');
  return request(app).post(path).send(body);
}

describe('control routes', () => {
  let app, cm;
  beforeEach(() => { ({ app, cm } = makeApp()); });

  it('POST /run {running:true} starts', async () => {
    const res = await post(app, '/api/control/run', { running: true });
    expect(res.status).toBe(200);
    expect(res.body.running).toBe(true);
  });

  it('POST /rate sets a single event type rate', async () => {
    const res = await post(app, '/api/control/rate', { type: 'PushEvent', rate: 1234 });
    expect(res.status).toBe(200);
    expect(res.body.rates.PushEvent).toBe(1234);
  });

  it('POST /rate rejects unknown type with 400', async () => {
    const res = await post(app, '/api/control/rate', { type: 'Nope', rate: 5 });
    expect(res.status).toBe(400);
  });

  it('POST /multiplier sets the global multiplier', async () => {
    const res = await post(app, '/api/control/multiplier', { multiplier: 3 });
    expect(res.status).toBe(200);
    expect(res.body.multiplier).toBe(3);
  });

  it('POST /scenario applies a preset', async () => {
    const res = await post(app, '/api/control/scenario', { scenario: 'release-rush' });
    expect(res.status).toBe(200);
    expect(res.body.rates.PushEvent).toBe(github.scenarios['release-rush'].PushEvent);
  });

  it('POST /scenario rejects unknown with 400', async () => {
    const res = await post(app, '/api/control/scenario', { scenario: 'nope' });
    expect(res.status).toBe(400);
  });

  it('POST /pause sets running false', async () => {
    cm.setRunning(true);
    const res = await post(app, '/api/control/pause', {});
    expect(res.status).toBe(200);
    expect(res.body.running).toBe(false);
  });
});
