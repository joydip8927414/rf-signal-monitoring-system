// pages/History.jsx
import { useState, useMemo, useCallback } from 'react';
import { getMeasurementHistory, exportDataUrl } from '../services/api';
import { usePolled } from '../hooks/useRFData';
import { Download, RefreshCw } from 'lucide-react';

const fmt = (v, dp = 2) =>
  v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v).toFixed(dp) : '—';

const fmtTs = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString([], { hour12: false });
};

const MINUTE_OPTIONS = [5, 15, 30, 60, 180, 360];

export default function History() {
  const [minutes, setMinutes] = useState(60);
  const [search, setSearch] = useState('');

  const fetchFn = useCallback(() => getMeasurementHistory(minutes, 2000), [minutes]);
  const { data, loading, refetch } = usePolled(fetchFn, 30000, [minutes]);

  const rows = useMemo(() => {
    const all = data?.data || [];
    if (!search) return all;
    const f = search.toLowerCase();
    return all.filter(
      (r) =>
        r.device_id?.toLowerCase().includes(f) ||
        r.data_source?.toLowerCase().includes(f)
    );
  }, [data, search]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">History</h1>
            <p className="page-subtitle">Historical RF measurement records</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={refetch}>
              <RefreshCw size={12} /> Refresh
            </button>
            <a
              href={exportDataUrl('csv', minutes)}
              download="rf_measurements.csv"
              className="btn btn-primary btn-sm"
              id="history-export-csv"
            >
              <Download size={12} /> Export CSV
            </a>
            <a
              href={exportDataUrl('json', minutes)}
              download="rf_measurements.json"
              className="btn btn-secondary btn-sm"
              id="history-export-json"
            >
              <Download size={12} /> JSON
            </a>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="form-label" style={{ marginBottom: 4 }}>Time Window</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  className={`btn btn-sm ${minutes === m ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMinutes(m)}
                  id={`history-time-${m}`}
                >
                  {m >= 60 ? `${m / 60}h` : `${m}m`}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <input
              className="form-input"
              style={{ width: 200 }}
              placeholder="Filter by device / source…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="history-search"
            />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#999' }}>
          {loading ? 'Loading…' : `${rows.length} records · ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`} window`}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th>Timestamp</th>
                <th>Device</th>
                <th>Signal (dBm)</th>
                <th>Noise (dBm)</th>
                <th>SNR (dB)</th>
                <th>Detector (V)</th>
                <th>ADC</th>
                <th>LNA</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    {loading ? 'Loading measurement history…' : 'No measurements in selected window'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {fmtTs(r.timestamp)}
                    </td>
                    <td style={{ fontSize: 11 }}>{r.device_id}</td>
                    <td className="mono">{fmt(r.signal_dbm, 2)}</td>
                    <td className="mono">{fmt(r.noise_dbm, 2)}</td>
                    <td className="mono">{fmt(r.snr_db, 2)}</td>
                    <td className="mono">{fmt(r.detector_voltage, 4)}</td>
                    <td className="mono">{r.adc_value ?? '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: r.lna_enabled ? 'rgba(34,197,94,0.1)' : '#F5F5F0',
                        color: r.lna_enabled ? '#16A34A' : '#999',
                      }}>
                        {r.lna_enabled ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px',
                        background: '#171717', color: '#B7FF3C', borderRadius: 3,
                      }}>
                        {(r.data_source || '').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
