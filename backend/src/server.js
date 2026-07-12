import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDomain } from './domains/index.js';
import { buildKafkaConnection } from './config/kafkaConnection.js';
import { ConfigManager } from './config/configManager.js';
import { createControlRouter } from './routes/control.js';
import { createStatusRouter } from './routes/status.js';
import { createOsdProxy } from './routes/osdProxy.js';

const TTL_MS = 60 * 60 * 1000; // hard-coded 60 minutes

/**
 * Resolve the OpenSearch Dashboards base URL + Basic-auth creds for the proxy.
 * Aiven injects OPENSEARCH_URL as a full URI (https://user:pass@host:port). If a
 * dedicated dashboards URL/creds are provided, prefer them.
 */
function resolveOsdTarget(env) {
  const explicit = env.OPENSEARCH_DASHBOARDS_URL;
  const raw = explicit || env.OPENSEARCH_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const username = env.OPENSEARCH_USER || decodeURIComponent(u.username) || 'avnadmin';
    const password = env.OPENSEARCH_PASSWORD || decodeURIComponent(u.password) || '';
    // strip creds from the target origin
    const target = `${u.protocol}//${u.host}`;
    return { target, username, password };
  } catch {
    return null;
  }
}

export function createApp({ env = process.env, configPath = '/data/config.json', startedAt = Date.now() } = {}) {
  const domain = getDomain(env.DOMAIN);
  const kafkaConnection = buildKafkaConnection(env);
  const configManager = new ConfigManager({ domain, kafkaConnection, configPath, debounceMs: 500 });

  const app = express();
  app.use(express.json());
  app.use('/api/control', createControlRouter(configManager));
  app.use('/api', createStatusRouter({
    configManager,
    startedAt,
    ttlMs: TTL_MS,
    osdDashboardId: env.OSD_DASHBOARD_ID || null,
  }));

  // Reverse-proxy OpenSearch Dashboards under /osd so the SPA can iframe it
  // same-origin. If OSD isn't configured, the route replies 503 (rather than 404).
  const osd = resolveOsdTarget(env);
  if (osd) {
    app.use('/osd', createOsdProxy(osd));
  } else {
    app.use('/osd', (req, res) => res.status(503).json({ error: 'OpenSearch Dashboards not configured' }));
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const spaDir = join(here, '..', 'public');
  app.use(express.static(spaDir));
  // SPA fallback — but /api and /osd never fall through to index.html.
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/osd')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(join(spaDir, 'index.html'));
  });

  return { app, configManager };
}

// Only start listening when run directly (not under test).
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const { app, configManager } = createApp();
  configManager.writeConfig();
  const port = Number(process.env.PORT) || 8080;
  app.listen(port, '0.0.0.0', () => console.log(`backend listening on ${port}`));
}
