import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import ControlPanel from './components/ControlPanel.jsx';
import CountdownTimer from './components/CountdownTimer.jsx';

export default function App() {
  const [state, setState] = useState({ running: false, multiplier: 1, rates: {} });
  const [dashUrl, setDashUrl] = useState(null);

  useEffect(() => {
    api.getStatus().then((s) => setState(s.state)).catch(() => {});
    api.getConfig().then((c) => {
      if (c.osdDashboardId) {
        const g = "(refreshInterval:(pause:!f,value:5000),time:(from:now-15m,to:now))";
        setDashUrl(`/osd/app/dashboards#/view/${c.osdDashboardId}?embed=true&_g=${g}`);
      } else {
        setDashUrl('/osd/app/dashboards');
      }
    }).catch(() => setDashUrl('/osd/app/dashboards'));
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
