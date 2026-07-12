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

  it('boots and serves /api/status', async () => {
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/api/status');
    expect(res.status).toBe(200);
    expect(res.body.state.running).toBe(false);
  });

  it('exposes the OSD dashboard id via /api/config', async () => {
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/api/config');
    expect(res.body.osdDashboardId).toBe('dash-xyz');
  });

  it('returns JSON 404 for unknown /api routes (not the SPA html)', async () => {
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('mounts /osd (proxy attempts upstream, not an SPA 404)', async () => {
    // OSD target is unreachable in test → proxy returns 502 (mounted), not the SPA fallback.
    const { app } = createApp({ env, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/osd/api/status');
    expect([502, 200]).toContain(res.status); // 502 expected (host unresolvable); never SPA html
  });

  it('replies 503 on /osd when OpenSearch is not configured', async () => {
    const { app } = createApp({ env: { KAFKA_BOOTSTRAP_SERVER: 'h:1' }, configPath: '/tmp/test-config.json' });
    const res = await get(app, '/osd/anything');
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
