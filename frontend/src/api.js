async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

// Control API lives under /control (OpenSearch Dashboards owns /api at the root).
export const api = {
  setRunning: (running) => post('/control/run', { running }),
  pause: () => post('/control/pause', {}),
  setRate: (type, rate) => post('/control/rate', { type, rate }),
  setMultiplier: (multiplier) => post('/control/multiplier', { multiplier }),
  setScenario: (scenario) => post('/control/scenario', { scenario }),
  getStatus: () => fetch('/control/status').then((r) => r.json()),
  getTtl: () => fetch('/control/ttl').then((r) => r.json()),
  getConfig: () => fetch('/control/config').then((r) => r.json()),
};
