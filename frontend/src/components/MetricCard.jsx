// components/MetricCard.jsx
export default function MetricCard({ label, value, unit, sub, accentBorder = false, valueClass = '' }) {
  return (
    <div className={`metric-card${accentBorder ? ' accent-border' : ''}`}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${valueClass ? ' ' + valueClass : ''}`}>
        {value ?? '—'}
      </div>
      {unit && <div className="metric-unit">{unit}</div>}
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
