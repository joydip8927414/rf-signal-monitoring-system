// pages/Overview.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { Pause, Play, Clock, Zap } from 'lucide-react';
import { useLatestMeasurement, usePolled } from '../hooks/useRFData';
import { getAnalyticsTimeseries, getEvents } from '../services/api';
import { useLive } from '../context/LiveContext';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';
import RFPowerChart from '../components/RFPowerChart';
import StatusBadge from '../components/StatusBadge';
import EventTimeline from '../components/EventTimeline';

const fmt = (v, dp = 1) =>
  v !== null && v !== undefined && !isNaN(Number(v))
    ? Number(v).toFixed(dp)
    : '—';

export default function Overview() {
  const { isPaused, togglePause, intervalMs, setIntervalMs } = useLive();

  // Poll live measurement respecting isPaused state & configured interval (default 1000ms)
  const { data: m, error: mErr, loading } = useLatestMeasurement(isPaused, intervalMs);

  // Poll initial timeseries history
  const { data: tsData } = usePolled(
    () => getAnalyticsTimeseries(10, 200),
    10000,
    [],
    isPaused
  );

  const { data: evtData } = usePolled(() => getEvents(10), 10000, [], isPaused);

  // Local chart buffer state
  const [chartSeries, setChartSeries] = useState([]);
  const lastTsRef = useRef(null);

  // Initialize chart series from initial timeseries data if state is empty
  useEffect(() => {
    if (tsData?.series && tsData.series.length > 0 && chartSeries.length === 0) {
      setChartSeries(tsData.series);
      lastTsRef.current = tsData.series[tsData.series.length - 1]?.t;
    }
  }, [tsData, chartSeries.length]);

  // Append fresh live measurement to chart buffer when LIVE
  useEffect(() => {
    if (isPaused || !m || !m.timestamp) return;

    if (m.timestamp !== lastTsRef.current) {
      lastTsRef.current = m.timestamp;
      const newPoint = {
        t: m.timestamp,
        sig: m.signal_dbm,
        noise: m.noise_dbm,
        snr: m.snr_db,
        adc: m.adc_value,
        vdet: m.detector_voltage,
      };

      setChartSeries((prev) => {
        const updated = [...prev, newPoint];
        return updated.length > 200 ? updated.slice(-200) : updated;
      });
    }
  }, [m, isPaused]);

  const events = useMemo(() => evtData?.data || [], [evtData]);
  const aiStatus = m?.ai_prediction || 'UNTRAINED';
  const aiScore = m?.ai_anomaly_score;

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Real-time broadband RF signal monitoring and analysis (AD8317)</p>
        </div>

        {/* Overview Live / Pause Control Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={togglePause}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              background: isPaused ? '#FEF3C7' : '#171717',
              color: isPaused ? '#D97706' : '#B7FF3C',
              border: `1px solid ${isPaused ? '#F59E0B' : '#B7FF3C'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {isPaused ? <Play size={13} fill="#D97706" color="#D97706" /> : <Pause size={13} fill="#B7FF3C" color="#B7FF3C" />}
            <span>{isPaused ? 'RESUME FEED' : 'PAUSE FEED'}</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#FFFFFF',
            border: '1px solid #E3E3DD',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            <Clock size={13} color="#666" />
            <span style={{ color: '#666', fontSize: 11 }}>Rate:</span>
            <select
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 700,
                color: '#111',
                cursor: 'pointer',
                outline: 'none',
                fontSize: 12,
              }}
            >
              <option value={1000}>1.0 sec (Default)</option>
              <option value={2000}>2.0 sec</option>
              <option value={5000}>5.0 sec</option>
            </select>
          </div>
        </div>
      </div>

      {mErr && (
        <div className="state-error" style={{ marginBottom: 20 }}>
          Backend connection indicator: Retaining last measurement ({mErr})
        </div>
      )}

      {/* Metric Cards */}
      <div className="metric-grid">
        <MetricCard
          label="RF Power"
          value={loading ? '…' : fmt(m?.signal_dbm, 1)}
          unit="dBm"
          sub="Live measurement"
          accentBorder
        />
        <MetricCard
          label="Noise Floor"
          value={loading ? '…' : fmt(m?.noise_dbm, 1)}
          unit="dBm"
          sub={m ? `Rolling mean: ${fmt(m.rolling_mean_dbm, 1)} dBm` : '—'}
        />
        <MetricCard
          label="SNR"
          value={loading ? '…' : fmt(m?.snr_db, 1)}
          unit="dB"
          sub={m?.snr_db > 15 ? 'Good' : m?.snr_db > 5 ? 'Marginal' : m?.snr_db != null ? 'Poor' : '—'}
        />
        <MetricCard
          label="Detector Voltage"
          value={loading ? '…' : fmt(m?.detector_voltage, 4)}
          unit="V"
          sub="AD8317 output"
        />
        <MetricCard
          label="ADC Value"
          value={loading ? '…' : m?.adc_value ?? '—'}
          unit="/ 4095"
          sub="12-bit raw count"
        />
        <MetricCard
          label="AI Status"
          value={
            <StatusBadge status={aiStatus} label={aiStatus} />
          }
          sub={aiScore != null ? `Score: ${fmt(aiScore, 4)}` : 'Model not trained'}
        />
      </div>

      {/* Main chart */}
      <ChartCard
        title="RF Power vs Time (Broadband Power Trend)"
        value={m?.signal_dbm != null ? `${fmt(m.signal_dbm, 2)} dBm` : undefined}
        meta={`${chartSeries.length} points · ${isPaused ? 'PAUSED' : `LIVE (${(intervalMs / 1000).toFixed(1)}s interval)`}`}
      >
        <RFPowerChart data={chartSeries} height={260} />
      </ChartCard>

      {/* Second row */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        {/* Rolling stats card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Signal Statistics</span>
            <span className="card-badge">Rolling Window</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Rolling Mean', value: fmt(m?.rolling_mean_dbm, 2), unit: 'dBm' },
              { label: 'Rolling Std Dev', value: fmt(m?.rolling_std_db, 3), unit: 'dB' },
              { label: 'Rolling Min', value: fmt(m?.rolling_min_dbm, 2), unit: 'dBm' },
              { label: 'Rolling Max', value: fmt(m?.rolling_max_dbm, 2), unit: 'dBm' },
              { label: 'Rate of Change', value: fmt(m?.rate_of_change_db, 3), unit: 'dB/s' },
              { label: 'LNA', value: m?.lna_enabled ? 'ENABLED' : m?.lna_enabled === false ? 'DISABLED' : '—', unit: '' },
            ].map(({ label, value, unit }) => (
              <div key={label}>
                <div className="metric-label">{label}</div>
                <div className="metric-value" style={{ fontSize: 16 }}>
                  {value}<span style={{ fontSize: 11, marginLeft: 3, color: '#666' }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent events */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">Recent Events</span>
            <span style={{ fontSize: 11, color: '#999' }}>{events.length} events</span>
          </div>
          <EventTimeline events={events.slice(0, 5)} />
        </div>
      </div>

      {/* Alerts */}
      {m?.has_alerts && m?.alerts?.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginBottom: 6 }}>
            ACTIVE ALERTS
          </div>
          {m.alerts.map((a, i) => {
            const alertText = typeof a === 'string'
              ? a
              : typeof a === 'object' && a !== null
              ? (a.type ? `${a.type}${a.value != null ? `: ${Number(a.value).toFixed(1)}` : ''}${a.threshold != null ? ` (threshold: ${a.threshold})` : ''}` : JSON.stringify(a))
              : String(a);
            return (
              <div key={i} style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                • {alertText}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
