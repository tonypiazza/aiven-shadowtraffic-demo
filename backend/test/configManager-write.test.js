import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigManager } from '../src/config/configManager.js';
import github from '../src/domains/github.js';

let dir, path;
const kafkaConn = { kind: 'kafka', producerConfigs: {} };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  path = join(dir, 'config.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('ConfigManager.writeConfig', () => {
  it('writes rendered config to disk after debounce', async () => {
    const cm = new ConfigManager({ domain: github, kafkaConnection: kafkaConn, configPath: path, debounceMs: 20 });
    cm.setRunning(true);
    cm.writeConfig();
    await new Promise((r) => setTimeout(r, 60));
    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.generators).toHaveLength(github.types.length);
  });

  it('collapses rapid writes into a single flush', async () => {
    const cm = new ConfigManager({ domain: github, kafkaConnection: kafkaConn, configPath: path, debounceMs: 30 });
    cm.setRunning(true);
    cm.setMultiplier(1); cm.writeConfig();
    cm.setMultiplier(2); cm.writeConfig();
    cm.setMultiplier(3); cm.writeConfig();
    await new Promise((r) => setTimeout(r, 80));
    const written = JSON.parse(readFileSync(path, 'utf8'));
    const push = written.generators.find((g) => g.value.type === 'PushEvent');
    expect(push.localConfigs.throughput).toBe(github.defaultRates.PushEvent * 3);
  });
});
