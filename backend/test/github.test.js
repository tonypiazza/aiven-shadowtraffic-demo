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
});
