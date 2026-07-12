import { describe, it, expect } from 'vitest';
import { buildPgConfig } from '../src/db/pgClient.js';

describe('buildPgConfig', () => {
  it('parses DATABASE_URL and strips sslmode, enabling TLS with the CA cert', () => {
    const cfg = buildPgConfig({
      DATABASE_URL: 'postgres://avnadmin:secret@pg-host:12345/defaultdb?sslmode=require',
      PROJECT_CA_CERT: '-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----',
    });
    expect(cfg.connectionString).not.toMatch(/sslmode/);
    expect(cfg.connectionString).toContain('pg-host:12345');
    expect(cfg.ssl).toBeTruthy();
    expect(cfg.ssl.ca).toContain('BEGIN CERTIFICATE');
    expect(cfg.ssl.rejectUnauthorized).toBe(true);
  });

  it('throws when DATABASE_URL missing', () => {
    expect(() => buildPgConfig({})).toThrow(/DATABASE_URL/);
  });

  it('works without a CA cert (ssl rejectUnauthorized false fallback)', () => {
    const cfg = buildPgConfig({ DATABASE_URL: 'postgres://u:p@h:1/db?sslmode=require' });
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
  });
});
