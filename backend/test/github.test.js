import { describe, it, expect } from 'vitest';
import github from '../src/domains/github.js';

describe('github domain pack', () => {
  it('exposes topic, keyField, and the 4 curated types', () => {
    expect(github.topic).toBe('github-events');
    expect(github.keyField).toBe('repo_id');
    expect(github.types).toEqual(['PushEvent','PullRequestEvent','IssuesEvent','ReleaseEvent']);
  });

  it('has a positive default rate for every type', () => {
    for (const t of github.types) expect(github.defaultRates[t]).toBeGreaterThan(0);
  });

  it('renderValue produces GH-Archive-shaped fields including key field and type', () => {
    const v = github.renderValue('PushEvent');
    expect(v.type).toBe('PushEvent');
    for (const f of ['actor_login','actor_id','repo_full_name','repo_id','org_login','created_at']) {
      expect(v).toHaveProperty(f);
    }
    expect(v).toHaveProperty('commit_count');
  });

  it('renderValue sets a literal type per event type', () => {
    expect(github.renderValue('IssuesEvent').type).toBe('IssuesEvent');
    expect(github.renderValue('ReleaseEvent').type).toBe('ReleaseEvent');
    expect(github.renderValue('PullRequestEvent').type).toBe('PullRequestEvent');
  });

  it('release-rush scenario spikes Push/PR/Release above normal', () => {
    const n = github.scenarios.normal, r = github.scenarios['release-rush'];
    expect(r.PushEvent).toBeGreaterThan(n.PushEvent);
    expect(r.ReleaseEvent).toBeGreaterThan(n.ReleaseEvent);
    expect(r.PullRequestEvent).toBeGreaterThan(n.PullRequestEvent);
  });

  it('scenarios only reference known types', () => {
    for (const preset of Object.values(github.scenarios)) {
      for (const k of Object.keys(preset)) expect(github.types).toContain(k);
    }
  });

  it('exposes table + metricQueries + shapeMetrics', () => {
    expect(github.table).toBe('github_events');
    for (const k of ['eventsPerSec', 'totalEvents', 'activeRepos', 'byType', 'topRepos', 'series'])
      expect(typeof github.metricQueries[k]).toBe('string');
  });

  it('metric queries reference the table and bucket created_at as epoch-millis', () => {
    expect(github.metricQueries.series).toContain('github_events');
    expect(github.metricQueries.series).toContain('created_at/1000');
  });

  it('shapeMetrics maps raw rows to a dashboard DTO', () => {
    const raw = {
      eventsPerSec: [{ v: 512 }],
      totalEvents: [{ v: 1200000 }],
      activeRepos: [{ v: 8 }],
      byType: [{ label: 'PushEvent', value: 400 }, { label: 'IssuesEvent', value: 50 }],
      topRepos: [{ label: 'torvalds/linux', value: 900 }],
      series: [{ t: 1783800000, type: 'PushEvent', value: 120 }],
    };
    const dto = github.shapeMetrics(raw);
    expect(dto.kpis.eventsPerSec).toBe(512);
    expect(dto.kpis.totalEvents).toBe(1200000);
    expect(dto.kpis.activeRepos).toBe(8);
    expect(dto.byType[0]).toEqual({ label: 'PushEvent', value: 400 });
    expect(dto.topRepos[0].label).toBe('torvalds/linux');
    expect(dto.series[0]).toEqual({ t: 1783800000, type: 'PushEvent', value: 120 });
    expect(dto).toHaveProperty('ts');
  });
});
