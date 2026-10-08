// components/ChartCard.jsx
import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import { useLive } from '../context/LiveContext';

export default function ChartCard({ title, value, meta, children, className = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isPaused, togglePause } = useLive();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div className={`chart-card ${isFullscreen ? 'fullscreen' : ''} ${className}`}>
      <div className="chart-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="chart-title">{title}</span>
          
          {/* Live / Paused Status Indicator Badge on Every Chart */}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            background: isPaused ? '#FEF3C7' : 'rgba(183, 255, 60, 0.15)',
            color: isPaused ? '#D97706' : '#B7FF3C',
            border: `1px solid ${isPaused ? '#F59E0B' : 'rgba(183, 255, 60, 0.4)'}`,
            fontFamily: 'JetBrains Mono, monospace',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {isPaused ? '⏸ PAUSED' : '● LIVE'}
          </span>

          {isFullscreen && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(183, 255, 60, 0.15)',
              color: '#B7FF3C',
              border: '1px solid rgba(183, 255, 60, 0.4)',
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              FULLSCREEN MODE (Press Esc to exit)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {meta && <span className="chart-meta">{meta}</span>}

          {/* Quick Pause / Resume Button per Chart Card */}
          <button
            onClick={togglePause}
            className="chart-fullscreen-btn"
            title={isPaused ? 'Resume Live Stream' : 'Pause Live Stream'}
            aria-label={isPaused ? 'Resume Live Stream' : 'Pause Live Stream'}
            style={{ color: isPaused ? '#D97706' : '#666' }}
          >
            {isPaused ? <Play size={13} fill="#D97706" /> : <Pause size={13} fill="#666" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="chart-fullscreen-btn"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen View'}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen View'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {value !== undefined && (
        <div className="chart-value">{value}</div>
      )}

      <div className="chart-body" style={{ flex: 1, width: '100%', minHeight: isFullscreen ? 'calc(100vh - 120px)' : undefined }}>
        {children}
      </div>
    </div>
  );
}
