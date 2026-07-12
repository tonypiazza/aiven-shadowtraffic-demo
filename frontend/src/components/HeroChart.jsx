import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = { PushEvent: '#54B399', PullRequestEvent: '#6092C0', ReleaseEvent: '#D36086', IssuesEvent: '#9170B8' };
const TYPES = ['PushEvent', 'PullRequestEvent', 'ReleaseEvent', 'IssuesEvent'];

// series is [{ t (epoch seconds), type, value }]; pivot to one row per timestamp.
function pivot(series) {
  const byT = new Map();
  for (const { t, type, value } of series) {
    if (!byT.has(t)) byT.set(t, { t });
    byT.get(t)[type] = value;
  }
  return [...byT.values()].sort((a, b) => a.t - b.t)
    .map((row) => { for (const ty of TYPES) row[ty] = row[ty] || 0; return row; });
}

export default function HeroChart({ series }) {
  const data = pivot(series || []);
  return (
    <div style={{ background: '#fff', border: '1px solid #e3e3e3', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>GitHub events/sec by type (last 2 min)</div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <XAxis dataKey="t" tick={{ fontSize: 10 }} tickFormatter={(t) => new Date(t * 1000).toLocaleTimeString()} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip labelFormatter={(t) => new Date(t * 1000).toLocaleTimeString()} />
          <Legend />
          {TYPES.map((ty) => (
            <Area key={ty} type="monotone" dataKey={ty} stackId="1" stroke={COLORS[ty]} fill={COLORS[ty]} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
