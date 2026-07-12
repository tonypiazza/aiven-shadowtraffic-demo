import { describe, it, expect, vi } from 'vitest';
import { MetricsPoller } from '../src/db/metricsPoller.js';
import github from '../src/domains/github.js';

describe('MetricsPoller', () => {
  it('runs all domain queries and emits a shaped DTO', async () => {
    const pool = {
      query: vi.fn(async (sql) => {
        if (sql.includes('count(*)/5.0')) return { rows: [{ v: 512 }] };
        if (sql.includes('count(DISTINCT repo_id)')) return { rows: [{ v: 8 }] };
        if (sql.includes('count(*) AS v FROM github_events') && !sql.includes('DISTINCT')) return { rows: [{ v: 1000 }] };
        if (sql.includes('GROUP BY type ORDER BY value')) return { rows: [{ label: 'PushEvent', value: 400 }] };
        if (sql.includes('GROUP BY repo_full_name')) return { rows: [{ label: 'a/b', value: 9 }] };
        if (sql.includes('GROUP BY t, type')) return { rows: [{ t: 1, type: 'PushEvent', value: 5 }] };
        return { rows: [] };
      }),
    };
    let dto = null;
    const p = new MetricsPoller({ domain: github, pool, intervalMs: 1000 });
    p.on('metrics', (d) => { dto = d; });
    await p.pollOnce();
    expect(dto.kpis.eventsPerSec).toBe(512);
    expect(dto.kpis.activeRepos).toBe(8);
    expect(dto.topRepos[0].label).toBe('a/b');
    expect(dto.series[0].type).toBe('PushEvent');
    expect(dto).toHaveProperty('ts');
  });

  it('emits error and does not throw when a query fails', async () => {
    const pool = { query: vi.fn(async () => { throw new Error('pg down'); }) };
    let errs = 0;
    const p = new MetricsPoller({ domain: github, pool, intervalMs: 1000 });
    p.on('error', () => { errs++; });
    await p.pollOnce();
    expect(errs).toBe(1);
    expect(p.lastError).toMatch(/pg down/);
  });

  it('start() does not overlap polls when a poll is slower than the interval', async () => {
    let active = 0, maxConcurrent = 0;
    const pool = {
      query: vi.fn(async () => {
        active++; maxConcurrent = Math.max(maxConcurrent, active);
        await new Promise((r) => setTimeout(r, 10));
        active--; return { rows: [] };
      }),
    };
    const p = new MetricsPoller({ domain: github, pool, intervalMs: 1 });
    p.start();
    await new Promise((r) => setTimeout(r, 80));
    p.stop();
    expect(maxConcurrent).toBe(1);
  });
});
