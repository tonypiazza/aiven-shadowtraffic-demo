import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createOsdProxy } from '../src/routes/osdProxy.js';

let upstream, upstreamUrl;

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    if (!req.headers.authorization) { res.writeHead(401); return res.end('no auth'); }
    if (req.url === '/redir') { res.writeHead(302, { location: '/app/home' }); return res.end(); }
    res.writeHead(200, {
      'x-frame-options': 'DENY',
      'content-security-policy': "frame-ancestors 'none'; script-src 'self'",
      'content-type': 'text/plain',
    });
    res.end('ok:' + req.url + ':auth=' + req.headers.authorization);
  });
  await new Promise((r) => upstream.listen(0, r));
  upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
});
afterAll(() => upstream.close());

function makeApp() {
  // OSD proxy is the catch-all at the origin root (OSD owns the path space).
  const app = express();
  app.use(createOsdProxy({ target: upstreamUrl, username: 'u', password: 'p' }));
  return app;
}
async function get(app, path) {
  const { default: request } = await import('supertest');
  return request(app).get(path);
}

describe('createOsdProxy', () => {
  it('injects Basic auth and forwards the path as-is (200)', async () => {
    const r = await get(makeApp(), '/api/status');
    expect(r.status).toBe(200);
    expect(r.text).toContain('ok:/api/status');
    const expected = 'Basic ' + Buffer.from('u:p').toString('base64');
    expect(r.text).toContain('auth=' + expected);
  });

  it('forwards OSD root-absolute asset paths unchanged', async () => {
    const r = await get(makeApp(), '/bootstrap.js');
    expect(r.status).toBe(200);
    expect(r.text).toContain('ok:/bootstrap.js');
  });

  it('strips x-frame-options and frame-ancestors from CSP', async () => {
    const r = await get(makeApp(), '/api/status');
    expect(r.headers['x-frame-options']).toBeUndefined();
    expect(r.headers['content-security-policy'] || '').not.toMatch(/frame-ancestors/i);
    // non-framing CSP directives should survive
    expect(r.headers['content-security-policy'] || '').toMatch(/script-src/i);
  });

  it('passes redirect Location through unchanged (OSD owns root)', async () => {
    const r = await get(makeApp(), '/redir');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/app/home');
  });
});
