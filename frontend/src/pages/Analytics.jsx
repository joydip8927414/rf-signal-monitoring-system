// pages/Analytics.jsx
import { useState, useMemo } from 'react';
import { usePolled } from '../hooks/useRFData';
import { getAnalyticsTimeseries, getAnalyticsSummary } from '../services/api';
import { useLive } from '../context/LiveContext';
import ChartCard from '../components/ChartCard';
import RFPowerChart from '../components/RFPowerChart';
import SNRChart from '../components/SNRChart';
import NoiseChart from '../components/NoiseChart';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const fmt = (v, dp = 2) =>
  v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v).toFixed(dp) : '—';

const fmtTs = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const TIME_OPTIONS = [5, 15, 30, 60];

export default function Analytics() {
  const [minutes, setMinutes] = useState(30);
  const { isPaused, intervalMs } = useLive();

  const { data: tsData, loading } = usePolled(
    () => getAnalyticsTimeseries(minutes, 400),
    Math.max(2000, intervalMs * 2),
    [minutes],
    isPaused
  );
  const { data: summary } = usePolled(
    () => getAnalyticsSummary(minutes),
    Math.max(4000, intervalMs * 4),
    [minutes],
    isPaused
  );

  const series = useMemo(() => tsData?.series || [], [tsData]);
  const voltData = useMemo(() => series.map((r) => ({ t: r.t, vdet: r.vdet })), [series]);
  const adcData  = useMemo(() => series.map((r) => ({ t: r.t, adc: r.adc })), [series]);
  const sig      = summary?.signal_dbm;
  const snrS     = summary?.snr_db;
  const noiseS   = summary?.noise_dbm;

  const StatRow = ({ label, stats, unit }) => {
    if (!stats) return (
      <tr><td>{label}</td><td colSpan={4} style={{ color: '#999' }}>No data</td></tr>
    );
    return (
      <tr>
        <td style={{ fontWeight: 600 }}>{label}</td>
        <td className="mono">{fmt(stats.min)} {unit}</td>
        <td className="mono">{fmt(stats.max)} {unit}</td>
        <td className="mono">{fmt(stats.mean)} {unit}</td>
        <td className="mono">{fmt(stats.stdev)} {unit}</td>
      </tr>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">RF Analytics</h1>
            <p className="page-subtitle">Signal analysis, statistics, and trends</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {TIME_OPTIONS.map((m) => (
              <button
                key={m}
                className={`btn btn-sm ${minutes === m ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMinutes(m)}
                id={`analytics-time-${m}`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary statistics table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Summary Statistics</span>
          <span className="card-badge">{minutes} min window · {tsData?.count ?? 0} samples</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Min</th>
                <th>Max</th>
                <th>Mean</th>
                <th>Std Dev</th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Signal Power" stats={sig} unit="dBm" />
              <StatRow label="SNR" stats={snrS} unit="dB" />
              <StatRow label="Noise Floor" stats={noiseS} unit="dBm" />
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <ChartCard title="RF Power vs Time" meta={`${minutes} min`}>
          <RFPowerChart data={series} height={200} />
        </ChartCard>
        <ChartCard title="SNR vs Time" meta={`${minutes} min`}>
          <SNRChart data={series} height={200} />
        </ChartCard>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <ChartCard title="Noise Floor vs Time" meta={`${minutes} min`}>
          <NoiseChart data={series} height={180} />
        </ChartCard>

        <ChartCard title="Detector Voltage vs Time" meta="AD8317">
          {voltData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={voltData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3DD" vertical={false} />
                <XAxis dataKey="t" tickFormatter={fmtTs} tick={{ fontSize: 10, fill: '#999' }}
                  axisLine={{ stroke: '#E3E3DD' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'JetBrains Mono' }}
                  axisLine={false} tickLine={false} unit="V" width={50} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, fontFamily: 'JetBrains Mono' }}
                  formatter={(v) => [`${v?.toFixed(4)} V`, 'Detector']} labelFormatter={fmtTs} />
                <Line type="monotone" dataKey="vdet" stroke="#8B5CF6" strokeWidth={2}
                  dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="chart-empty">No detector data</div>}
        </ChartCard>
      </div>

      <ChartCard title="ADC Value vs Time" meta="12-bit / 4095">
        {adcData.length ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={adcData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3DD" vertical={false} />
              <XAxis dataKey="t" tickFormatter={fmtTs} tick={{ fontSize: 10, fill: '#999' }}
                axisLine={{ stroke: '#E3E3DD' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#999', fontFamily: 'JetBrains Mono' }}
                axisLine={false} tickLine={false} domain={[0, 4095]} width={50} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, fontFamily: 'JetBrains Mono' }}
                formatter={(v) => [v, 'ADC']} labelFormatter={fmtTs} />
              <Line type="monotone" dataKey="adc" stroke="#10B981" strokeWidth={1.5}
                dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="chart-empty">No ADC data</div>}
      </ChartCard>
    </div>
  );
}
