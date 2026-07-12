import { Router } from 'express';

export function createControlRouter(configManager) {
  const router = Router();

  router.post('/run', (req, res) => {
    const running = Boolean(req.body?.running);
    if (running) configManager.setRunning(true);
    else configManager.stop();
    configManager.writeConfig();
    res.json(configManager.getState());
  });

  router.post('/pause', (req, res) => {
    configManager.setRunning(false);
    configManager.writeConfig();
    res.json(configManager.getState());
  });

  router.post('/rate', (req, res) => {
    try {
      configManager.setRate(req.body?.type, req.body?.rate);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    configManager.writeConfig();
    res.json(configManager.getState());
  });

  router.post('/multiplier', (req, res) => {
    configManager.setMultiplier(req.body?.multiplier);
    configManager.writeConfig();
    res.json(configManager.getState());
  });

  router.post('/scenario', (req, res) => {
    try {
      configManager.applyScenario(req.body?.scenario);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    configManager.writeConfig();
    res.json(configManager.getState());
  });

  return router;
}
