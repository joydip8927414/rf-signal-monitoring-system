// components/Header.jsx
import { useState, useEffect } from 'react';
import { Pause, Play, Clock } from 'lucide-react';
import { useDeviceStatus } from '../hooks/useRFData';
import { useLive } from '../context/LiveContext';

export default function Header() {
  const [time, setTime] = useState(new Date());
  const { data: device } = useDeviceStatus();
  const { isPaused, togglePause, intervalMs, setIntervalMs } = useLive();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isConnected = device?.status === 'connected' || device?.connected === true;
  const source = device?.data_source?.toUpperCase() || '—';

  return (
    <header className="app-header">
      {/* Left — Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="header-brand">
          <div className="header-title">RF Monitor</div>
          <div className="header-subtitle">ESP32 · AD8317 · AI/ML RF Analysis Platform</div>
        </div>
      </div>

      {/* Right — Status indicators & Live Controls */}
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Pause / Resume Live Toggle */}
        <button
          onClick={togglePause}
          id="btn-header-live-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            background: isPaused ? '#FEF3C7' : '#171717',
            color: isPaused ? '#D97706' : '#B7FF3C',
            border: `1px solid ${isPaused ? '#F59E0B' : '#B7FF3C'}`,
            transition: 'all 0.2s ease',
          }}
          title={isPaused ? 'Resume live spectrum data updates' : 'Pause live spectrum data updates'}
        >
          {isPaused ? (
            <>
              <Play size={12} fill="#D97706" color="#D97706" />
              <span>RESUME</span>
            </>
          ) : (
            <>
              <Pause size={12} fill="#B7FF3C" color="#B7FF3C" />
              <span className="live-dot" style={{ background: '#B7FF3C', width: 6, height: 6, borderRadius: '50%' }} />
              <span>LIVE</span>
            </>
          )}
        </button>

        {/* Update Interval Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F5F5F0', border: '1px solid #E3E3DD', borderRadius: 6, padding: '2px 6px' }}>
          <Clock size={12} color="#666" />
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              color: '#444',
              fontFamily: 'JetBrains Mono, monospace',
              cursor: 'pointer',
              outline: 'none',
            }}
            title="Polling / Update Interval (Default 1 Second)"
          >
            <option value={1000}>1.0s</option>
            <option value={2000}>2.0s</option>
            <option value={5000}>5.0s</option>
          </select>
        </div>

        {/* Connection status */}
        <div className="status-chip" id="header-status-chip">
          <span className={`status-dot${isConnected ? '' : ' offline'}`} />
          {isConnected ? 'ONLINE' : 'OFFLINE'}
        </div>

        {/* Data source badge */}
        <span className="source-badge" id="header-source-badge">
          {source}
        </span>

        {/* Clock */}
        <span className="header-time" id="header-clock">
          {time.toLocaleTimeString([], { hour12: false })}
        </span>
      </div>
    </header>
  );
}
