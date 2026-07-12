import { EventEmitter } from 'node:events';

/**
 * Polls Postgres on an interval, runs the domain's metric queries, shapes the
 * results into a DTO, and emits 'metrics'. Errors are isolated (emit 'error',
 * never throw) so a transient DB issue can't crash the process. Recursive
 * setTimeout (not setInterval) so a slow poll never overlaps the next.
 */
export class MetricsPoller extends EventEmitter {
  constructor({ domain, pool, intervalMs = 1500 }) {
    super();
    this.domain = domain;
    this.pool = pool;
    this.intervalMs = intervalMs;
    this._running = false;
    this._handle = null;
    this.lastError = null;
  }

  async pollOnce() {
    try {
      const raw = {};
      for (const [key, sql] of Object.entries(this.domain.metricQueries)) {
        const res = await this.pool.query(sql);
        raw[key] = res.rows;
      }
      const dto = this.domain.shapeMetrics(raw);
      this.emit('metrics', dto);
      return dto;
    } catch (err) {
      this.lastError = err?.message || String(err);
      this.emit('error', err);
      return null;
    }
  }

  start() {
    if (this._running) return;
    this._running = true;
    const loop = async () => {
      if (!this._running) return;
      await this.pollOnce();
      if (this._running) this._handle = setTimeout(loop, this.intervalMs);
    };
    loop();
  }

  stop() {
    this._running = false;
    if (this._handle) { clearTimeout(this._handle); this._handle = null; }
  }
}
