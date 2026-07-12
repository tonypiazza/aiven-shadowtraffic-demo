import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function BreakdownChart({ data, title }) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid #e3e3e3', borderRadius: 10, padding: 12, minWidth: 0 }}>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={120} />
          <Tooltip />
          <Bar dataKey="value" fill="#3a7afe" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
