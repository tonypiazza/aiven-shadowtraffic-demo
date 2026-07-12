async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  setRunning: (running) => post('/api/control/run', { running }),
  pause: () => post('/api/control/pause', {}),
  setRate: (type, rate) => post('/api/control/rate', { type, rate }),
  setMultiplier: (multiplier) => post('/api/control/multiplier', { multiplier }),
  setScenario: (scenario) => post('/api/control/scenario', { scenario }),
  getStatus: () => fetch('/api/status').then((r) => r.json()),
  getTtl: () => fetch('/api/ttl').then((r) => r.json()),
  subscribeMetrics: (onMetrics) => {
    const es = new EventSource('/api/metrics');
    es.onmessage = (e) => { try { onMetrics(JSON.parse(e.data)); } catch {} };
    return () => es.close();
  },
};
