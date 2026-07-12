import React from 'react';

const TYPES = [
  { id: 'PushEvent', label: 'Push', max: 5000 },
  { id: 'PullRequestEvent', label: 'Pull Request', max: 3000 },
  { id: 'IssuesEvent', label: 'Issues', max: 2000 },
  { id: 'ReleaseEvent', label: 'Release', max: 1000 },
];

const SCENARIOS = [
  { id: 'normal', label: '↩ Normal' },
  { id: 'release-rush', label: '🔥 Release rush' },
];

export default function ControlPanel({ state, onRun, onPause, onRate, onMultiplier, onScenario }) {
  const rates = state.rates || {};
  return (
    <div style={{ width: '32%', minWidth: 300, padding: 20, borderRight: '1px solid #e3e3e3',
                  background: '#fafafa', overflowY: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>ShadowTraffic Controls</h2>
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#888', marginBottom: 6 }}>GitHub events → Kafka → OpenSearch</div>

      <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
        <button onClick={() => onRun(true)} disabled={state.running}
                style={{ flex: 1, padding: '10px', borderRadius: 8 }}>▶ Start</button>
        <button onClick={onPause} disabled={!state.running}
                style={{ flex: 1, padding: '10px', borderRadius: 8 }}>⏸ Pause</button>
        <button onClick={() => onRun(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 8 }}>⏹ Stop</button>
      </div>

      <label style={{ fontSize: 12, textTransform: 'uppercase', color: '#888' }}>Global multiplier ×{state.multiplier}</label>
      <input type="range" min="0" max="10" step="1" value={state.multiplier}
             onChange={(e) => onMultiplier(Number(e.target.value))}
             style={{ width: '100%', marginBottom: 18 }} />

      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Per-type rate (events/sec)</div>
      {TYPES.map((t) => (
        <div key={t.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{t.label}</span>
            <span style={{ fontFamily: 'monospace' }}>{rates[t.id] ?? 0}</span>
          </div>
          <input type="range" min="0" max={t.max} step="10" value={rates[t.id] ?? 0}
                 onChange={(e) => onRate(t.id, Number(e.target.value))}
                 style={{ width: '100%' }} />
        </div>
      ))}

      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#888', margin: '14px 0 6px' }}>Scenarios</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => onScenario(s.id)}
                  style={{ padding: '10px', borderRadius: 8, border: '1px solid #ccc', background: '#fff' }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
