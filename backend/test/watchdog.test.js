import { describe, it, expect, vi } from 'vitest';
import { teardownAll } from '../src/lifecycle/watchdog.js';

describe('teardownAll', () => {
  it('terminates all three services', async () => {
    const calls = [];
    const terminate = vi.fn(async ({ service }) => { calls.push(service); });
    const summary = await teardownAll({
      token: 't', project: 'p',
      services: ['kafka-svc', 'ch-svc', 'app-svc'],
      terminateImpl: terminate, retries: 1, delayMs: 0,
    });
    expect(calls.sort()).toEqual(['app-svc', 'ch-svc', 'kafka-svc']);
    expect(summary.succeeded.sort()).toEqual(['app-svc', 'ch-svc', 'kafka-svc']);
    expect(summary.failed).toEqual([]);
  });

  it('retries failures and records still-failing services', async () => {
    const terminate = vi.fn(async ({ service }) => {
      if (service === 'ch-svc') throw new Error('transient');
      return true;
    });
    const summary = await teardownAll({
      token: 't', project: 'p',
      services: ['kafka-svc', 'ch-svc', 'app-svc'],
      terminateImpl: terminate, retries: 2, delayMs: 0,
    });
    expect(summary.failed).toEqual(['ch-svc']);
    expect(summary.succeeded.sort()).toEqual(['app-svc', 'kafka-svc']);
    const chAttempts = terminate.mock.calls.filter(([a]) => a.service === 'ch-svc').length;
    expect(chAttempts).toBe(3);
  });
});
