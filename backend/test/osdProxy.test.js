import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createOsdProxy } from '../src/routes/osdProxy.js';

let upstream, upstreamUrl;

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    if (!req.headers.authorization) { res.writeHead(401); return res.end('no auth'); }
    if (req.url === '/redir') { res.writeHead(302, { location: '/app/home' }); return res.end(); }
    if (req.url === '/redir-prefixed') { res.writeHead(302, { location: '/osd/app/home' }); return res.end(); }
    if (req.url === '/redir-abs') { res.writeHead(302, { location: 'https://elsewhere.example/x' }); return res.end(); }
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
  const app = express();
  app.use('/osd', createOsdProxy({ target: upstreamUrl, username: 'u', password: 'p' }));
  return app;
}
async function get(app, path) {
  const { default: request } = await import('supertest');
  return request(app).get(path);
}

describe('createOsdProxy', () => {
  it('injects Basic auth and forwards the sub-path (200)', async () => {
    const r = await get(makeApp(), '/osd/api/status');
    expect(r.status).toBe(200);
    expect(r.text).toContain('ok:/api/status');
    const expected = 'Basic ' + Buffer.from('u:p').toString('base64');
    expect(r.text).toContain('auth=' + expected);
  });

  it('strips x-frame-options and frame-ancestors from CSP', async () => {
    const r = await get(makeApp(), '/osd/api/status');
    expect(r.headers['x-frame-options']).toBeUndefined();
    expect(r.headers['content-security-policy'] || '').not.toMatch(/frame-ancestors/i);
    // non-framing CSP directives should survive
    expect(r.headers['content-security-policy'] || '').toMatch(/script-src/i);
  });

  it('rewrites root-relative redirect Location under /osd', async () => {
    const r = await get(makeApp(), '/osd/redir');
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe('/osd/app/home');
  });

  it('does not double-prefix a Location already under /osd', async () => {
    const r = await get(makeApp(), '/osd/redir-prefixed');
    expect(r.headers.location).toBe('/osd/app/home');
  });

  it('leaves absolute redirect Locations untouched', async () => {
    const r = await get(makeApp(), '/osd/redir-abs');
    expect(r.headers.location).toBe('https://elsewhere.example/x');
  });
});
