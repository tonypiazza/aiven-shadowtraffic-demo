import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function CountdownTimer() {
  const [remainingMs, setRemainingMs] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getTtl().then((r) => alive && setRemainingMs(r.remainingMs));
    const id = setInterval(() => {
      setRemainingMs((prev) => (prev == null ? prev : Math.max(0, prev - 1000)));
    }, 1000);
    const resync = setInterval(() => api.getTtl().then((r) => alive && setRemainingMs(r.remainingMs)), 30000);
    return () => { alive = false; clearInterval(id); clearInterval(resync); };
  }, []);

  const label = remainingMs == null ? '—'
    : remainingMs === 0 ? 'expired — tearing down'
    : `${String(Math.floor(remainingMs / 60000)).padStart(2, '0')}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}`;

  return (
    <div style={{ position: 'fixed', top: 12, right: 16, padding: '6px 12px',
                  background: remainingMs === 0 ? '#b00020' : '#222', color: '#fff',
                  borderRadius: 8, fontFamily: 'monospace', fontSize: 14, zIndex: 1000 }}>
      ⏳ {label}
    </div>
  );
}
