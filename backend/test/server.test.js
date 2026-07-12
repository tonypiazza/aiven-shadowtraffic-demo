import { describe, it, expect } from 'vitest';
import { createApp, resolveOsdTarget } from '../src/server.js';

async function get(app, path) {
  const { default: request } = await import('supertest');
  return request(app).get(path);
}

describe('createApp', () => {
  const env = {
    KAFKA_BOOTSTRAP_SERVER: 'h:1',
    OPENSEARCH_URL: 'https://avnadmin:secret@os-host:12345',
    OSD_DASHBOARD_ID: 'dash-xyz',
  };

  it('serves control state at /control/status', async () => {
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/control/status');
    expect(res.status).toBe(200);
    expect(res.body.state.running).toBe(false);
  });

  it('exposes the OSD dashboard id via /control/config', async () => {
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/control/config');
    expect(res.body.osdDashboardId).toBe('dash-xyz');
  });

  it('proxies unknown root paths to OSD (OSD owns the root), not an SPA fallback', async () => {
    // OSD's own paths (/api/*, /app/*, /bootstrap.js) go to the proxy. Target is
    // unreachable in test → 502 (proxy mounted), never our JSON 404 or SPA html.
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/api/status'); // OSD's own API path
    expect(res.status).toBe(502);
  });

  it('replies 503 for OSD paths when OpenSearch is not configured', async () => {
    const { app } = createApp({ env: { KAFKA_BOOTSTRAP_SERVER: 'h:1' }, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/app/dashboards');
    expect(res.status).toBe(503);
  });
});

describe('resolveOsdTarget', () => {
  it('derives the Dashboards endpoint from OPENSEARCH_URL by dropping the DB port (→443) and keeps creds', () => {
    const t = resolveOsdTarget({ OPENSEARCH_URL: 'https://avnadmin:secret@os-host.aivencloud.com:13973' });
    expect(t.target).toBe('https://os-host.aivencloud.com'); // no port → https 443
    expect(t.username).toBe('avnadmin');
    expect(t.password).toBe('secret');
  });

  it('uses an explicit OPENSEARCH_DASHBOARDS_URL host:port as-is', () => {
    const t = resolveOsdTarget({ OPENSEARCH_DASHBOARDS_URL: 'https://u:p@osd-host:5601' });
    expect(t.target).toBe('https://osd-host:5601');
  });

  it('returns null when neither URL is set', () => {
    expect(resolveOsdTarget({})).toBeNull();
  });
});
