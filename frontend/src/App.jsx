import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import ControlPanel from './components/ControlPanel.jsx';
import CountdownTimer from './components/CountdownTimer.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [state, setState] = useState({ running: false, multiplier: 1, rates: {} });
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    api.getStatus().then((s) => setState(s.state)).catch(() => {});
    const unsub = api.subscribeMetrics(setMetrics);
    return unsub;
  }, []);

  const run = (running) => api.setRunning(running).then(setState);
  const pause = () => api.pause().then(setState);
  const rate = (type, r) => { setState((s) => ({ ...s, rates: { ...s.rates, [type]: r } })); api.setRate(type, r).then(setState); };
  const multiplier = (m) => { setState((s) => ({ ...s, multiplier: m })); api.setMultiplier(m).then(setState); };
  const scenario = (id) => api.setScenario(id).then(setState).catch(() => {});

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex' }}>
      <CountdownTimer />
      <ControlPanel state={state} onRun={run} onPause={pause} onRate={rate} onMultiplier={multiplier} onScenario={scenario} />
      <Dashboard metrics={metrics} />
    </div>
  );
}
