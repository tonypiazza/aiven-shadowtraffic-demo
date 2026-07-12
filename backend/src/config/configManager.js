import { writeFileSync } from 'node:fs';

/**
 * Owns the ShadowTraffic control state and renders the config JSON.
 *
 * State: { running, multiplier, rates: { <type>: eventsPerSec, ... } }
 * render() emits ONE ShadowTraffic generator per domain event type. Each
 * generator's effective rate is round(rates[type] * multiplier). ShadowTraffic's
 * schema requires a non-empty generators array with non-empty connections and a
 * throughput >= 1, so a type at effective rate 0 (or when stopped) is emitted with
 * localConfigs.maxEvents = 0 — valid, but produces nothing. (shadowtraffic 1.19.7)
 */
export class ConfigManager {
  constructor({ domain, kafkaConnection, configPath = null, debounceMs = 500 }) {
    this.domain = domain;
    this.kafkaConnection = kafkaConnection;
    this.configPath = configPath;
    this.debounceMs = debounceMs;
    this.state = {
      running: false,
      multiplier: 1,
      rates: { ...domain.defaultRates },
    };
    this._timer = null;
  }

  getState() {
    return {
      running: this.state.running,
      multiplier: this.state.multiplier,
      rates: { ...this.state.rates },
    };
  }

  setRunning(running) {
    this.state.running = Boolean(running);
    return this.getState();
  }

  setMultiplier(n) {
    this.state.multiplier = Math.max(0, Number(n) || 0);
    return this.getState();
  }

  setRate(type, n) {
    if (!this.domain.types.includes(type)) throw new Error(`Unknown event type: ${type}`);
    this.state.rates[type] = Math.max(0, Number(n) || 0);
    return this.getState();
  }

  applyScenario(name) {
    const preset = this.domain.scenarios[name];
    if (!preset) throw new Error(`Unknown scenario: ${name}`);
    this.state.rates = { ...this.domain.defaultRates, ...preset };
    return this.getState();
  }

  stop() {
    this.state.running = false;
    return this.getState();
  }

  render() {
    const { running, multiplier, rates } = this.state;
    const generators = this.domain.types.map((type) => {
      const effRate = Math.round((rates[type] || 0) * multiplier);
      const produce = running && effRate > 0;
      return {
        topic: this.domain.topic,
        connection: 'kafka',
        key: this.domain.renderKey(), // Kafka partition key carries repo_id
        localConfigs: produce ? { throughput: effRate } : { maxEvents: 0 },
        value: this.domain.renderValue(type),
      };
    });
    return {
      connections: { kafka: this.kafkaConnection },
      generators,
    };
  }

  // Debounced so rapid control changes (e.g. slider drags) collapse into a single
  // disk write, avoiding thrashing ShadowTraffic's --watch file reloader.
  writeConfig() {
    if (!this.configPath) throw new Error('configPath not set');
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      try {
        writeFileSync(this.configPath, JSON.stringify(this.render(), null, 2));
      } catch (err) {
        // The write runs inside a timer, so an uncaught throw here would crash the
        // process. Log and keep serving — the next control action retries the write.
        this.lastWriteError = err?.message || String(err);
        console.warn(`config write failed (will retry on next action): ${this.lastWriteError}`);
      }
    }, this.debounceMs);
  }
}
