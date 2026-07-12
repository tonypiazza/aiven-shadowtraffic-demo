import React from 'react';

export default function KpiTile({ label, value, unit }) {
  const display = typeof value === 'number' ? value.toLocaleString() : (value ?? '—');
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid #e3e3e3', borderRadius: 10, padding: '12px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{display}{unit ? <span style={{ fontSize: 14, color: '#888' }}> {unit}</span> : null}</div>
    </div>
  );
}
