import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import ControlPanel from './components/ControlPanel.jsx';
import CountdownTimer from './components/CountdownTimer.jsx';

const DEFAULT_DASHBOARD_ID = 'github-events-dashboard';
// Embed mode with auto-refresh OFF (pause:!t) — the presenter refreshes on demand
// via the sidebar button, which reloads the iframe (one clean re-query, no flicker).
const buildDashUrl = (id) =>
  `/app/dashboards#/view/${id}?embed=true&_g=(refreshInterval:(pause:!t,value:0),time:(from:now-2m,to:now))`;

export default function App() {
  const [state, setState] = useState({ running: false, multiplier: 1, rates: {} });
  const [dashboardId, setDashboardId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.getStatus().then((s) => setState(s.state)).catch(() => {});
    api.getConfig()
      .then((c) => c.osdDashboardId || DEFAULT_DASHBOARD_ID)
      .catch(() => DEFAULT_DASHBOARD_ID)
      .then(setDashboardId);
  }, []);

  const run = (running) => api.setRunning(running).then(setState);
  const pause = () => api.pause().then(setState);
  const rate = (type, r) => { setState((s) => ({ ...s, rates: { ...s.rates, [type]: r } })); api.setRate(type, r).then(setState); };
  const multiplier = (m) => { setState((s) => ({ ...s, multiplier: m })); api.setMultiplier(m).then(setState); };
  const scenario = (id) => api.setScenario(id).then(setState).catch(() => {});
  // Bumping the key remounts the iframe → OSD reloads and re-queries once.
  const refreshDashboard = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex' }}>
      <CountdownTimer />
      <ControlPanel state={state}
        onRun={run} onPause={pause} onRate={rate} onMultiplier={multiplier}
        onScenario={scenario} onRefresh={refreshDashboard} />
      <div style={{ flex: 1, position: 'relative' }}>
        {dashboardId
          ? <iframe key={reloadKey} title="OpenSearch Dashboards" src={buildDashUrl(dashboardId)}
                    style={{ width: '100%', height: '100%', border: 0 }} />
          : <div style={{ padding: 24, color: '#888' }}>Loading OpenSearch Dashboards…</div>}
      </div>
    </div>
  );
}
