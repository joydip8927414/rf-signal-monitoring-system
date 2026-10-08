// pages/Events.jsx
import { useState, useMemo } from 'react';
import { usePolled } from '../hooks/useRFData';
import { getEvents } from '../services/api';
import EventTimeline from '../components/EventTimeline';
import StatusBadge from '../components/StatusBadge';
import { RefreshCw } from 'lucide-react';

const LIMIT_OPTIONS = [50, 100, 200];

export default function Events() {
  const [limit, setLimit] = useState(100);
  const [filter, setFilter] = useState('');

  const { data, loading, refetch } = usePolled(
    () => getEvents(limit),
    15000,
    [limit]
  );

  const events = useMemo(() => {
    const all = data?.data || [];
    if (!filter) return all;
    const f = filter.toUpperCase();
    return all.filter(
      (e) =>
        e.event_type?.includes(f) ||
        e.ai_classification?.includes(f) ||
        e.data_source?.toUpperCase().includes(f)
    );
  }, [data, filter]);

  // Stats
  const total      = data?.count ?? 0;
  const anomalies  = useMemo(() => (data?.data || []).filter((e) => e.ai_classification === 'ANOMALY').length, [data]);
  const alerts     = useMemo(() => (data?.data || []).filter((e) => e.event_type === 'ALERT').length, [data]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">RF Events</h1>
            <p className="page-subtitle">Anomalies, alerts, and signal events log</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={refetch} id="events-refresh-btn">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '12px 20px', flex: 1, textAlign: 'center' }}>
          <div className="metric-label">Total Events</div>
          <div className="metric-value" style={{ fontSize: 24 }}>{total}</div>
        </div>
        <div className="card" style={{ padding: '12px 20px', flex: 1, textAlign: 'center' }}>
          <div className="metric-label">Anomalies</div>
          <div className="metric-value" style={{ fontSize: 24, color: anomalies > 0 ? '#EF4444' : undefined }}>
            {anomalies}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 20px', flex: 1, textAlign: 'center' }}>
          <div className="metric-label">Alerts</div>
          <div className="metric-value" style={{ fontSize: 24, color: alerts > 0 ? '#F59E0B' : undefined }}>
            {alerts}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ maxWidth: 240 }}
            placeholder="Filter by type…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            id="events-filter-input"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {LIMIT_OPTIONS.map((l) => (
              <button
                key={l}
                className={`btn btn-sm ${limit === l ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLimit(l)}
                id={`events-limit-${l}`}
              >
                {l}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
            Showing {events.length} of {total}
          </span>
        </div>
      </div>

      {/* Events table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3E3DD' }}>
          <span className="card-title">Event Log</span>
        </div>
        {loading ? (
          <div className="state-empty">Loading events…</div>
        ) : (
          <EventTimeline events={events} />
        )}
      </div>
    </div>
  );
}
