// components/RFPowerChart.jsx
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Brush
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
      padding: '8px 12px', fontSize: 11, lineHeight: 1.8,
      fontFamily: "'JetBrains Mono', monospace"
    }}>
      <div style={{ color: '#666', marginBottom: 4 }}>{fmt(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function RFPowerChart({ data = [], height = 220, enableZoom = true }) {
  const [zoomFactor, setZoomFactor] = useState(1); // 1 = 100%, 2 = 50%, 4 = 25%, 8 = 12.5%
  const [showBrush, setShowBrush] = useState(false);

  // Slice data based on zoomFactor (Hook called unconditionally)
  const displayData = useMemo(() => {
    if (!data || !data.length) return [];
    if (zoomFactor <= 1) return data;
    const count = Math.max(5, Math.floor(data.length / zoomFactor));
    return data.slice(-count);
  }, [data, zoomFactor]);

  if (!data || !data.length) {
    return <div className="chart-empty">No measurement data available</div>;
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
                background: '#171717', border: '1px solid #B7FF3C', color: '#B7FF3C',
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                cursor: zoomFactor >= 16 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'JetBrains Mono, monospace',
                opacity: zoomFactor >= 16 ? 0.5 : 1,
              }}
              title="Zoom In (Magnify Power Trend)"
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
                background: showBrush ? 'rgba(183,255,60,0.15)' : 'transparent',
                border: '1px solid ' + (showBrush ? '#B7FF3C' : '#E3E3DD'),
                color: showBrush ? '#111' : '#666',
                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
              }}
              title="Toggle Interactive Brush Slider"
            >
              Slider
            </button>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={displayData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E3E3DD" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={fmt}
            tick={{ fontSize: 10, fill: '#999' }}
            axisLine={{ stroke: '#E3E3DD' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#999', fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            unit=" dBm"
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="sig"
            name="Signal"
            stroke="#B7FF3C"
            strokeWidth={2}
            dot={displayData.length <= 1 ? { r: 4, fill: '#B7FF3C' } : false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="noise"
            name="Noise Floor"
            stroke="#888"
            strokeWidth={1.5}
            dot={displayData.length <= 1 ? { r: 3, fill: '#888' } : false}
            strokeDasharray="4 2"
            isAnimationActive={false}
          />
          {showBrush && (
            <Brush
              dataKey="t"
              height={26}
              stroke="#5A7A00"
              fill="#171717"
              tickFormatter={fmt}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
