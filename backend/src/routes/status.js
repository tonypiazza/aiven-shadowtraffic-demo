import { Router } from 'express';

export function createStatusRouter({ configManager, startedAt, ttlMs, osdDashboardId }) {
  const router = Router();

  router.get('/status', (req, res) => {
    // Surface a stuck config write (e.g. read-only /data) so the UI can warn.
    res.json({ state: configManager.getState(), configWriteError: configManager.lastWriteError || null });
  });

  router.get('/ttl', (req, res) => {
    const remainingMs = Math.max(0, startedAt + ttlMs - Date.now());
    res.json({ remainingMs, ttlMs });
  });

  // Front-end bootstrap config — notably the OpenSearch Dashboards dashboard id
  // the SPA embeds via the /osd reverse proxy.
  router.get('/config', (req, res) => {
    res.json({ osdDashboardId: osdDashboardId || null });
  });

  return router;
}
