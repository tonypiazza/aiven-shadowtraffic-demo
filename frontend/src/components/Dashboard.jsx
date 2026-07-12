import React from 'react';
import KpiTile from './KpiTile.jsx';
import HeroChart from './HeroChart.jsx';
import BreakdownChart from './BreakdownChart.jsx';

export default function Dashboard({ metrics }) {
  const kpis = metrics?.kpis || {};
  return (
    <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>Live Dashboard</h2>
      {!metrics && <div style={{ color: '#888', marginBottom: 12 }}>Waiting for data…</div>}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <KpiTile label="Events/sec" value={kpis.eventsPerSec} />
        <KpiTile label="Total events" value={kpis.totalEvents} />
        <KpiTile label="Active repos" value={kpis.activeRepos} />
      </div>
      <div style={{ marginBottom: 12 }}><HeroChart series={metrics?.series || []} /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <BreakdownChart data={metrics?.topRepos || []} title="Top repositories" />
        <BreakdownChart data={metrics?.byType || []} title="Events by type (last 60s)" />
      </div>
    </div>
  );
}
