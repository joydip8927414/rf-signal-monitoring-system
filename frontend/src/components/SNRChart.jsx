// components/SNRChart.jsx
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Brush
} from 'recharts';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const fmt = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E3E3DD', borderRadius: 8,
      padding: '8px 12px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace"
    }}>
      <div style={{ color: '#666', marginBottom: 4 }}>{fmt(label)}</div>
      <div style={{ color: '#3B82F6' }}>
        SNR: <strong>{payload[0]?.value?.toFixed(2)} dB</strong>
      </div>
    </div>
  );
};

export default function SNRChart({ data = [], height = 180, enableZoom = true }) {
  const [zoomFactor, setZoomFactor] = useState(1);
  const [showBrush, setShowBrush] = useState(false);

  const displayData = useMemo(() => {
    if (!data || !data.length) return [];
    if (zoomFactor <= 1) return data;
    const count = Math.max(5, Math.floor(data.length / zoomFactor));
    return data.slice(-count);
  }, [data, zoomFactor]);

  if (!data || !data.length) {
    return <div className="chart-empty">No SNR data available</div>;
  }

  const zoomIn = () => setZoomFactor((z) => Math.min(16, z * 2));
  const zoomOut = () => setZoomFactor((z) => Math.max(1, z / 2));
  const resetZoom = () => setZoomFactor(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {enableZoom && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#999', fontFamily: 'JetBrains Mono, monospace' }}>
              Zoom: <strong>{zoomFactor}x</strong> ({displayData.length} pts)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={zoomIn}
              disabled={zoomFactor >= 16}
              style={{
                background: '#171717', border: '1px solid #3B82F6', color: '#60A5FA',
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                cursor: zoomFactor >= 16 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'JetBrains Mono, monospace',
                opacity: zoomFactor >= 16 ? 0.5 : 1,
              }}
              title="Zoom In"
            >
              <ZoomIn size={11} /> + Zoom
            </button>
            <button
              onClick={zoomOut}
              disabled={zoomFactor <= 1}
              style={{
                background: 'transparent', border: '1px solid #E3E3DD', color: '#666',
                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                cursor: zoomFactor <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'JetBrains Mono, monospace',
                opacity: zoomFactor <= 1 ? 0.5 : 1,
              }}
              title="Zoom Out"
            >
              <ZoomOut size={11} /> -
            </button>
            {zoomFactor > 1 && (
              <button
                onClick={resetZoom}
                style={{
                  background: 'transparent', border: '1px solid #E3E3DD', color: '#888',
                  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'JetBrains Mono, monospace',
                }}
                title="Reset Zoom"
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
            <button
              onClick={() => setShowBrush((b) => !b)}
              style={{
                background: showBrush ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: '1px solid ' + (showBrush ? '#3B82F6' : '#E3E3DD'),
                color: showBrush ? '#1D4ED8' : '#666',
                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
              }}
              title="Toggle Timeline Brush Slider"
            >
              Slider
            </button>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={displayData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="snrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E3E3DD" vertical={false} />
          <XAxis
            dataKey="t" tickFormatter={fmt}
            tick={{ fontSize: 10, fill: '#999' }} axisLine={{ stroke: '#E3E3DD' }}
            tickLine={false} interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#999', fontFamily: 'JetBrains Mono' }}
            axisLine={false} tickLine={false} unit=" dB" width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone" dataKey="snr" name="SNR"
            stroke="#3B82F6" strokeWidth={2}
            fill="url(#snrGrad)"
            dot={displayData.length <= 1 ? { r: 4, fill: '#3B82F6' } : false}
            isAnimationActive={false}
          />
          {showBrush && (
            <Brush
              dataKey="t" height={26} stroke="#3B82F6" fill="#171717" tickFormatter={fmt}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
