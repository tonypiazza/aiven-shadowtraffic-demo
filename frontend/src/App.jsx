import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import ControlPanel from './components/ControlPanel.jsx';
import CountdownTimer from './components/CountdownTimer.jsx';

export default function App() {
  const [state, setState] = useState({ running: false, multiplier: 1, rates: {} });
  const [dashUrl, setDashUrl] = useState(null);

  useEffect(() => {
    api.getStatus().then((s) => setState(s.state)).catch(() => {});
    // OSD is proxied at the origin ROOT (not under /osd), so its root-absolute
    // assets resolve. The iframe deep-links to the demo dashboard (a fixed
    // saved-object id shipped in deploy/osd-dashboard-objects.ndjson); an
    // OSD_DASHBOARD_ID env var overrides it if ever needed.
    const DEFAULT_DASHBOARD_ID = 'github-events-dashboard';
    const g = "(refreshInterval:(pause:!f,value:30000),time:(from:now-5m,to:now))";
    api.getConfig()
      .then((c) => c.osdDashboardId || DEFAULT_DASHBOARD_ID)
      .catch(() => DEFAULT_DASHBOARD_ID)
      .then((id) => setDashUrl(`/app/dashboards#/view/${id}?embed=true&_g=${g}`));
  }, []);

  const run = (running) => api.setRunning(running).then(setState);
  const pause = () => api.pause().then(setState);
  const rate = (type, r) => { setState((s) => ({ ...s, rates: { ...s.rates, [type]: r } })); api.setRate(type, r).then(setState); };
  const multiplier = (m) => { setState((s) => ({ ...s, multiplier: m })); api.setMultiplier(m).then(setState); };
  const scenario = (id) => api.setScenario(id).then(setState).catch(() => {});

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex' }}>
      <CountdownTimer />
      <ControlPanel state={state}
        onRun={run} onPause={pause} onRate={rate} onMultiplier={multiplier} onScenario={scenario} />
      <div style={{ flex: 1, position: 'relative' }}>
        {dashUrl
          ? <iframe title="OpenSearch Dashboards" src={dashUrl}
                    style={{ width: '100%', height: '100%', border: 0 }} />
          : <div style={{ padding: 24, color: '#888' }}>Loading OpenSearch Dashboards…</div>}
      </div>
    </div>
  );
}
