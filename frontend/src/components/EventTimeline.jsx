// components/EventTimeline.jsx
import StatusBadge from './StatusBadge';

const fmtTs = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString([], { hour12: false });
};

const fmt1 = (v, dp = 1, unit = '') =>
  v !== null && v !== undefined && !isNaN(v) ? `${Number(v).toFixed(dp)}${unit}` : '—';

export default function EventTimeline({ events = [] }) {
  if (!events.length) {
    return (
      <div className="state-empty">
        <span>No recent RF events</span>
        <span style={{ fontSize: 11 }}>Events appear when anomalies or alerts are detected</span>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>AI Class</th>
            <th>Peak Power</th>
            <th>SNR</th>
            <th>Score</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={e.id ?? i}>
              <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {fmtTs(e.start_time)}
              </td>
              <td>
                <StatusBadge
                  status={e.event_type}
                  label={e.event_type}
                />
              </td>
              <td>
                {e.ai_classification
                  ? <StatusBadge status={e.ai_classification} label={e.ai_classification} />
                  : <span style={{ color: '#999', fontSize: 11 }}>—</span>}
              </td>
              <td className="mono">{fmt1(e.peak_power_dbm, 1, ' dBm')}</td>
              <td className="mono">{fmt1(e.snr_db, 1, ' dB')}</td>
              <td className="mono" style={{ color: e.ai_anomaly_score > 0.6 ? '#EF4444' : undefined }}>
                {fmt1(e.ai_anomaly_score, 4)}
              </td>
              <td>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px',
                  background: '#171717', color: '#B7FF3C', borderRadius: 3
                }}>
                  {(e.data_source || '—').toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
