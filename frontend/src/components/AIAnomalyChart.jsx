// components/AIAnomalyChart.jsx
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Brush
} from 'recharts';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const fmt = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function AIAnomalyChart({ data = [], threshold = 0.6, height = 180, enableZoom = true }) {
  const [zoomFactor, setZoomFactor] = useState(1);
  const [showBrush, setShowBrush] = useState(false);

  const displayData = useMemo(() => {
    if (!data || !data.length) return [];
    if (zoomFactor <= 1) return data;
    const count = Math.max(5, Math.floor(data.length / zoomFactor));
    return data.slice(-count);
  }, [data, zoomFactor]);

  if (!data || !data.length) return <div className="chart-empty">No AI score data available</div>;

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
                background: '#171717', border: '1px solid #EF4444', color: '#F87171',
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
                background: showBrush ? 'rgba(239,68,68,0.15)' : 'transparent',
                border: '1px solid ' + (showBrush ? '#EF4444' : '#E3E3DD'),
                color: showBrush ? '#DC2626' : '#666',
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
            <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E3E3DD" vertical={false} />
          <XAxis dataKey="t" tickFormatter={fmt} tick={{ fontSize: 10, fill: '#999' }}
            axisLine={{ stroke: '#E3E3DD' }} tickLine={false} interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'JetBrains Mono' }}
            axisLine={false} tickLine={false} domain={[0, 1]} width={40} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, fontFamily: 'JetBrains Mono' }}
            formatter={(v) => [v?.toFixed(4), 'Anomaly Score']}
            labelFormatter={fmt}
          />
          <ReferenceLine y={threshold} stroke="#EF4444" strokeDasharray="4 2"
            label={{ value: 'Threshold', position: 'right', fontSize: 10, fill: '#EF4444' }} />
          <Area type="monotone" dataKey="score" stroke="#EF4444" strokeWidth={2}
            fill="url(#aiGrad)" dot={false} isAnimationActive={false} />
          {showBrush && (
            <Brush
              dataKey="t" height={26} stroke="#EF4444" fill="#171717" tickFormatter={fmt}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
