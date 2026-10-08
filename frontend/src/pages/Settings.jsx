// pages/Settings.jsx
import { usePolled } from '../hooks/useRFData';
import { getSettings } from '../services/api';
import { Settings as SettingsIcon, Info } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="card" style={{ marginBottom: 16 }}>
    <div className="card-header" style={{ marginBottom: 16 }}>
      <span className="card-title">{title}</span>
    </div>
    {children}
  </div>
);

const SettingRow = ({ label, value, note }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 0', borderBottom: '1px solid #F0F0EA',
  }}>
    <div>
      <div style={{ fontSize: 13, color: '#111', fontWeight: 500 }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{note}</div>}
    </div>
    <div style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12, fontWeight: 600, color: '#111',
      background: '#F5F5F0', padding: '3px 8px',
      borderRadius: 4, border: '1px solid #E3E3DD',
    }}>
      {value ?? '—'}
    </div>
  </div>
);

export default function Settings() {
  const { data: settings, loading } = usePolled(getSettings, 60000, []);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SettingsIcon size={22} color="#5A7A00" />
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">
              Configuration values from <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>config.py</code> and environment variables
            </p>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20,
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
        fontSize: 12, color: '#2563EB',
      }}>
        <Info size={14} />
        Settings are read-only. To change values, update environment variables or <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>config.py</code> and restart Flask.
      </div>

      {loading ? (
        <div className="state-empty">Loading settings…</div>
      ) : settings ? (
        <>
          <Section title="Device Settings">
            <SettingRow label="Data Source" value={settings.data_source?.toUpperCase()} note="RF_SOURCE env var · 'simulator' or 'esp32'" />
            <SettingRow label="Device ID" value={settings.device_id} note="DEVICE_ID env var" />
          </Section>

          <Section title="Simulator Settings">
            <SettingRow label="Sim Update Interval" value={`${settings.sim_interval_s} s`} note="SIM_INTERVAL_S" />
            <SettingRow label="Base Power" value={`${settings.sim_base_power_dbm} dBm`} note="SIM_BASE_POWER_DBM" />
            <SettingRow label="Noise Floor" value={`${settings.sim_noise_floor_dbm} dBm`} note="SIM_NOISE_FLOOR_DBM" />
            <SettingRow label="Spectrum Mode" value={settings.spectrum_mode ? 'ENABLED' : 'DISABLED'} note="SIM_SPECTRUM_MODE" />
          </Section>

          <Section title="RF Processing">
            <SettingRow label="Rolling Window" value={`${settings.rolling_window} samples`} note="ROLLING_WINDOW" />
          </Section>

          <Section title="AI / ML Settings">
            <SettingRow label="IF Contamination" value={settings.if_contamination} note="Expected anomaly fraction for Isolation Forest" />
            <SettingRow label="Anomaly Threshold" value={settings.anomaly_threshold} note="Score above this → ANOMALY classification" />
          </Section>

          <Section title="Alert Thresholds">
            <SettingRow label="Power High Alert" value={`${settings.alert_power_high_dbm} dBm`} note="ALERT_POWER_HIGH_DBM" />
            <SettingRow label="Power Low Alert" value={`${settings.alert_power_low_dbm} dBm`} note="ALERT_POWER_LOW_DBM" />
            <SettingRow label="SNR Low Alert" value={`${settings.alert_snr_low_db} dB`} note="ALERT_SNR_LOW_DB" />
          </Section>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Raw Settings JSON</span>
            </div>
            <pre style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#444',
              background: '#F5F5F0', padding: 16, borderRadius: 8,
              overflowX: 'auto', lineHeight: 1.8,
            }}>
              {JSON.stringify(settings, null, 2)}
            </pre>
          </div>
        </>
      ) : (
        <div className="state-error">Failed to load settings</div>
      )}
    </div>
  );
}
