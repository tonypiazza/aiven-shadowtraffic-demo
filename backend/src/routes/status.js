import { Router } from 'express';

export function createStatusRouter({ configManager, poller, startedAt, ttlMs }) {
  const router = Router();

  router.get('/status', (req, res) => {
    // Surface a stuck config write (e.g. read-only /data) so the UI can warn.
    res.json({ state: configManager.getState(), configWriteError: configManager.lastWriteError || null });
  });

  router.get('/ttl', (req, res) => {
    const remainingMs = Math.max(0, startedAt + ttlMs - Date.now());
    res.json({ remainingMs, ttlMs });
  });

  // Server-Sent Events: push each poller 'metrics' DTO to the browser for a
  // smooth, flicker-free live dashboard (we control the rendering).
  router.get('/metrics', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders?.();
    const onMetrics = (dto) => res.write(`data: ${JSON.stringify(dto)}\n\n`);
    poller.on('metrics', onMetrics);
    req.on('close', () => poller.off('metrics', onMetrics));
  });

  return router;
}
