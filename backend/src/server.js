import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDomain } from './domains/index.js';
import { buildKafkaConnection } from './config/kafkaConnection.js';
import { ConfigManager } from './config/configManager.js';
import { makePool } from './db/pgClient.js';
import { MetricsPoller } from './db/metricsPoller.js';
import { createControlRouter } from './routes/control.js';
import { createStatusRouter } from './routes/status.js';

const TTL_MS = 60 * 60 * 1000; // hard-coded 60 minutes

export function createApp({ env = process.env, pgPool = null, configPath = '/data/config.json', startedAt = Date.now() } = {}) {
  const domain = getDomain(env.DOMAIN);
  const kafkaConnection = buildKafkaConnection(env);
  const configManager = new ConfigManager({ domain, kafkaConnection, configPath, debounceMs: 500 });
  const pool = pgPool || makePool(env);
  const poller = new MetricsPoller({ domain, pool, intervalMs: 1500 });
  // Errors are captured on poller.lastError; attaching a listener also prevents
  // an unhandled 'error' event from crashing the process.
  poller.on('error', () => {});

  const app = express();
  app.use(express.json());
  app.use('/api/control', createControlRouter(configManager));
  app.use('/api', createStatusRouter({ configManager, poller, startedAt, ttlMs: TTL_MS }));

  const here = dirname(fileURLToPath(import.meta.url));
  const spaDir = join(here, '..', 'public');
  app.use(express.static(spaDir));
  // SPA fallback — but unknown /api routes 404 as JSON, never index.html.
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(join(spaDir, 'index.html'));
  });

  return { app, configManager, poller, pool };
}

// Only start listening when run directly (not under test).
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const { app, configManager, poller } = createApp();
  configManager.writeConfig();
  poller.start();
  const port = Number(process.env.PORT) || 8080;
  app.listen(port, '0.0.0.0', () => console.log(`backend listening on ${port}`));
}
