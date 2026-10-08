// components/StatusBadge.jsx
export default function StatusBadge({ status, label }) {
  const statusStr = typeof status === 'string'
    ? status
    : typeof status === 'object' && status !== null
    ? (status.type || status.prediction || JSON.stringify(status))
    : String(status || '');

  const labelStr = typeof label === 'string'
    ? label
    : typeof label === 'object' && label !== null
    ? (label.type || label.prediction || JSON.stringify(label))
    : statusStr;

  const key = statusStr.toUpperCase();

  const cls = {
    NORMAL: 'badge-success',
    ANOMALY: 'badge-danger',
    ALERT: 'badge-warning',
    ONLINE: 'badge-success',
    OFFLINE: 'badge-danger',
    UNTRAINED: 'badge-neutral',
    INSUFFICIENT_DATA: 'badge-neutral',
    ERROR: 'badge-danger',
  }[key] || 'badge-neutral';

  return (
    <span className={`badge ${cls}`}>
      {labelStr || statusStr || '—'}
    </span>
  );
}
