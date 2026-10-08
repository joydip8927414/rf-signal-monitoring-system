// pages/Calibration.jsx
import { useState } from 'react';
import { usePolled } from '../hooks/useRFData';
import { getCalibration, postCalibration } from '../services/api';
import { Sliders, CheckCircle, AlertCircle } from 'lucide-react';

const fmt = (v, dp = 4) =>
  v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v).toFixed(dp) : '—';

const fmtTs = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString([], { hour12: false });
};

export default function Calibration() {
  const [refDbm, setRefDbm] = useState('');
  const [measDbm, setMeasDbm] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const { data, refetch } = usePolled(getCalibration, 30000, []);
  const latest = data?.latest;
  const history = data?.history || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!refDbm || !measDbm) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await postCalibration(parseFloat(refDbm), parseFloat(measDbm), notes);
      setMsg({ ok: true, text: 'Calibration recorded successfully.' });
      setRefDbm(''); setMeasDbm(''); setNotes('');
      refetch();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const correctionDb = refDbm && measDbm
    ? (parseFloat(refDbm) - parseFloat(measDbm)).toFixed(4)
    : null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sliders size={22} color="#5A7A00" />
          <div>
            <h1 className="page-title">Calibration</h1>
            <p className="page-subtitle">AD8317 power measurement calibration records</p>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Current calibration */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Latest Calibration</span>
            <span className={`badge ${latest ? 'badge-success' : 'badge-neutral'}`}>
              {latest ? 'CALIBRATED' : 'NONE'}
            </span>
          </div>
          {latest ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {[
                  { label: 'Reference', value: `${fmt(latest.reference_dbm, 2)} dBm` },
                  { label: 'Measured', value: `${fmt(latest.measured_dbm, 2)} dBm` },
                  { label: 'Correction', value: `${fmt(latest.correction_db, 4)} dB` },
                  { label: 'Recorded', value: fmtTs(latest.timestamp) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="metric-label">{label}</div>
                    <div className="metric-value" style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              {latest.notes && (
                <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                  Notes: {latest.notes}
                </div>
              )}
            </>
          ) : (
            <div className="state-empty" style={{ padding: 24 }}>
              No calibration records yet
            </div>
          )}
        </div>

        {/* New calibration form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Record Calibration</span>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Reference Power (dBm)</label>
              <input
                className="form-input"
                type="number" step="0.01" placeholder="e.g. -50.00"
                value={refDbm}
                onChange={(e) => setRefDbm(e.target.value)}
                id="cal-ref-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Measured Power (dBm)</label>
              <input
                className="form-input"
                type="number" step="0.01" placeholder="e.g. -51.23"
                value={measDbm}
                onChange={(e) => setMeasDbm(e.target.value)}
                id="cal-meas-input"
              />
            </div>
            {correctionDb !== null && (
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: '#F5F5F0', border: '1px solid #E3E3DD',
                fontSize: 12, marginBottom: 12, fontFamily: 'JetBrains Mono, monospace',
              }}>
                Correction factor: <strong>{correctionDb} dB</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input
                className="form-input"
                placeholder="Equipment, conditions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                id="cal-notes-input"
              />
            </div>
            {msg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 12,
                color: msg.ok ? '#16A34A' : '#DC2626'
              }}>
                {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {msg.text}
              </div>
            )}
            <button
              className="btn btn-primary btn-full"
              type="submit"
              disabled={submitting || !refDbm || !measDbm}
              id="cal-submit-btn"
            >
              {submitting ? 'Saving…' : 'Record Calibration'}
            </button>
          </form>
        </div>
      </div>

      {/* Calibration history */}
      {history.length > 0 && (
        <div className="card" style={{ marginTop: 16, overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3E3DD' }}>
            <span className="card-title">Calibration History</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Device</th>
                <th>Reference (dBm)</th>
                <th>Measured (dBm)</th>
                <th>Correction (dB)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 11 }}>{fmtTs(h.timestamp)}</td>
                  <td style={{ fontSize: 11 }}>{h.device_id}</td>
                  <td className="mono">{fmt(h.reference_dbm, 2)}</td>
                  <td className="mono">{fmt(h.measured_dbm, 2)}</td>
                  <td className="mono">{fmt(h.correction_db, 4)}</td>
                  <td style={{ fontSize: 11, color: '#666' }}>{h.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
