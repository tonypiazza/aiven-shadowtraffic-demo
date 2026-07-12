import { describe, it, expect, vi } from 'vitest';
import { teardownAll, readStartedAtMs, startWatchdog, expandServices } from '../src/lifecycle/watchdog.js';
import { connectServicesFrom } from '../src/lifecycle/aivenClient.js';

const silent = { log: () => {}, error: () => {} };

describe('teardownAll', () => {
  it('terminates all three services', async () => {
    const calls = [];
    const terminate = vi.fn(async ({ service }) => { calls.push(service); });
    const summary = await teardownAll({
      token: 't', project: 'p',
      services: ['kafka-svc', 'ch-svc', 'app-svc'],
      terminateImpl: terminate, retries: 1, delayMs: 0, log: silent,
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
      terminateImpl: terminate, retries: 2, delayMs: 0, log: silent,
    });
    expect(summary.failed).toEqual(['ch-svc']);
    expect(summary.succeeded.sort()).toEqual(['app-svc', 'kafka-svc']);
    const chAttempts = terminate.mock.calls.filter(([a]) => a.service === 'ch-svc').length;
    expect(chAttempts).toBe(3);
  });

  it('logs each failed attempt and the final give-up (no silent failures)', async () => {
    const errors = [];
    const log = { log: () => {}, error: (m) => errors.push(m) };
    const terminate = vi.fn(async () => { throw new Error('403 forbidden'); });
    await teardownAll({
      token: 't', project: 'p', services: ['app-svc'],
      terminateImpl: terminate, retries: 2, delayMs: 0, log,
    });
    // 3 per-attempt failure lines, each naming the cause
    expect(errors.filter((m) => m.startsWith('watchdog: terminate app-svc attempt') && m.includes('403 forbidden')).length).toBe(3);
    // plus a final give-up line that also surfaces the cause
    expect(errors.some((m) => m.includes('GAVE UP on app-svc') && m.includes('403 forbidden'))).toBe(true);
  });
});

describe('readStartedAtMs', () => {
  it('parses epoch seconds into ms', () => {
    expect(readStartedAtMs('/data/started_at', () => '1700000000\n')).toBe(1700000000000);
  });
  it('returns null on missing/garbage file', () => {
    expect(readStartedAtMs('/nope', () => { throw new Error('ENOENT'); })).toBeNull();
    expect(readStartedAtMs('/x', () => 'not-a-number')).toBeNull();
  });
});

describe('connectServicesFrom', () => {
  it('extracts the kafka_connect dest service, ignoring other integrations', () => {
    const integrations = [
      { integration_type: 'kafka_connect', source_service: 'kafka', dest_service: 'demo-connect' },
      { integration_type: 'kafka_logs', source_service: 'kafka', dest_service: 'os-logs' },
    ];
    expect(connectServicesFrom(integrations, 'kafka')).toEqual(['demo-connect']);
  });
  it('tolerates *_name field variants and never returns the kafka service itself', () => {
    const integrations = [
      { integration_type_name: 'kafka_connect', source_service_name: 'kafka', dest_service_name: 'connect-x' },
    ];
    expect(connectServicesFrom(integrations, 'kafka')).toEqual(['connect-x']);
  });
  it('returns empty for no integrations', () => {
    expect(connectServicesFrom([], 'kafka')).toEqual([]);
    expect(connectServicesFrom(undefined, 'kafka')).toEqual([]);
  });
});

describe('expandServices', () => {
  it('inserts the discovered Connect service just before Kafka', async () => {
    const listImpl = async () => [
      { integration_type: 'kafka_connect', source_service: 'kafka', dest_service: 'demo-connect' },
    ];
    const out = await expandServices({
      token: 't', project: 'p', services: ['kafka', 'postgres', 'demo-app'],
      kafkaService: 'kafka', listImpl, log: silent,
    });
    expect(out).toEqual(['demo-connect', 'kafka', 'postgres', 'demo-app']);
  });
  it('falls back to the static list if discovery throws', async () => {
    const listImpl = async () => { throw new Error('500'); };
    const out = await expandServices({
      token: 't', project: 'p', services: ['kafka', 'demo-app'],
      kafkaService: 'kafka', listImpl, log: silent,
    });
    expect(out).toEqual(['kafka', 'demo-app']);
  });
  it('is a no-op when kafkaService is not in the list', async () => {
    const listImpl = async () => { throw new Error('should not be called'); };
    const out = await expandServices({
      token: 't', project: 'p', services: ['demo-app'], kafkaService: 'kafka', listImpl, log: silent,
    });
    expect(out).toEqual(['demo-app']);
  });
  it('does not duplicate an already-listed service', async () => {
    const listImpl = async () => [
      { integration_type: 'kafka_connect', source_service: 'kafka', dest_service: 'demo-connect' },
    ];
    const out = await expandServices({
      token: 't', project: 'p', services: ['demo-connect', 'kafka', 'demo-app'],
      kafkaService: 'kafka', listImpl, log: silent,
    });
    expect(out).toEqual(['demo-connect', 'kafka', 'demo-app']);
  });
});

describe('startWatchdog deadline', () => {
  it('does NOT fire before the wall-clock deadline even across simulated restarts', async () => {
    const terminate = vi.fn(async () => true);
    let clock = 1_000_000;
    const now = () => clock;
    let tick;
    const setIntervalImpl = (fn) => { tick = fn; return 1; };
    // Anchor to a start time 59 min ago; ttl 60 min => 1 min remaining.
    const startedAtMs = clock - 59 * 60 * 1000;
    startWatchdog({
      token: 't', project: 'p', services: ['app-svc'], ttlMs: 60 * 60 * 1000,
      startedAtMs, now, setIntervalImpl, terminateImpl: terminate,
    });
    await tick();                    // still before deadline
    expect(terminate).not.toHaveBeenCalled();
    clock += 2 * 60 * 1000;          // advance past deadline (wall clock)
    await tick();
    expect(terminate).toHaveBeenCalledWith(expect.objectContaining({ service: 'app-svc' }));
  });
});
