import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../src/config/configManager.js';
import github from '../src/domains/github.js';

const kafka = { kind: 'kafka', producerConfigs: {} };
const make = () => new ConfigManager({ domain: github, kafkaConnection: kafka });

describe('ConfigManager (github per-type)', () => {
  it('initial state: stopped, multiplier 1, default rates', () => {
    const s = make().getState();
    expect(s.running).toBe(false);
    expect(s.multiplier).toBe(1);
    expect(s.rates.PushEvent).toBe(github.defaultRates.PushEvent);
  });

  it('running render: one generator per type, throughput = rate*multiplier', () => {
    const cm = make(); cm.setRunning(true); cm.setMultiplier(2);
    const cfg = cm.render();
    expect(cfg.generators).toHaveLength(github.types.length);
    const push = cfg.generators.find((g) => g.value.type === 'PushEvent');
    expect(push.topic).toBe('github-events');
    expect(push.localConfigs.throughput).toBe(github.defaultRates.PushEvent * 2);
    expect(push.key).toBeDefined(); // keyed by repo_id
    expect(cfg.connections.kafka).toEqual(kafka);
  });

  it('setRate(0) makes that type idle (maxEvents:0), others still produce', () => {
    const cm = make(); cm.setRunning(true); cm.setRate('IssuesEvent', 0);
    const cfg = cm.render();
    const issues = cfg.generators.find((g) => g.value.type === 'IssuesEvent');
    expect(issues.localConfigs.maxEvents).toBe(0);
    expect(issues.localConfigs.throughput).toBeUndefined();
    const push = cfg.generators.find((g) => g.value.type === 'PushEvent');
    expect(push.localConfigs.throughput).toBeGreaterThan(0);
  });

  it('stopped render: every generator idle (maxEvents:0)', () => {
    const cfg = make().render();
    expect(cfg.generators).toHaveLength(github.types.length);
    for (const g of cfg.generators) expect(g.localConfigs.maxEvents).toBe(0);
  });

  it('multiplier 0 makes everything idle even when running', () => {
    const cm = make(); cm.setRunning(true); cm.setMultiplier(0);
    for (const g of cm.render().generators) expect(g.localConfigs.maxEvents).toBe(0);
  });

  it('applyScenario sets per-type rates from the preset', () => {
    const cm = make(); cm.applyScenario('release-rush');
    expect(cm.getState().rates.PushEvent).toBe(github.scenarios['release-rush'].PushEvent);
  });

  it('rejects unknown scenario and unknown type', () => {
    const cm = make();
    expect(() => cm.applyScenario('nope')).toThrow(/scenario/i);
    expect(() => cm.setRate('BogusEvent', 5)).toThrow(/type/i);
  });
});
