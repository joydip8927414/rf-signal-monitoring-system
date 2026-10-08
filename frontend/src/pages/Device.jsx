// pages/Device.jsx
import { useDeviceStatus } from '../hooks/useRFData';
import { Cpu, Wifi, Clock, Database, Radio } from 'lucide-react';

const fmt = (v, dp = 1) =>
  v !== null && v !== undefined ? String(v) : '—';

const InfoRow = ({ label, value, mono = false }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #F0F0EA',
  }}>
    <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
    <span style={{
      fontSize: 13, fontWeight: 600, color: '#111',
      fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
    }}>
      {value || '—'}
    </span>
  </div>
);

export default function Device() {
  const { data: device, error } = useDeviceStatus();

  const isConnected = device?.status === 'connected' || device?.connected === true;
  const uptime = device?.uptime_s != null
    ? `${Math.floor(device.uptime_s / 3600)}h ${Math.floor((device.uptime_s % 3600) / 60)}m ${Math.floor(device.uptime_s % 60)}s`
    : '—';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cpu size={22} color="#5A7A00" />
          <div>
            <h1 className="page-title">Device</h1>
            <p className="page-subtitle">RF measurement hardware status and telemetry</p>
          </div>
        </div>
      </div>

      {error && <div className="state-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Device header card */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Radio size={24} color="#B7FF3C" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', fontFamily: 'JetBrains Mono, monospace' }}>
            {device?.device_id || 'ESP32-RF-001'}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {device?.data_source?.toUpperCase() || 'SIMULATOR'} · AD8317 RF Power Detector
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isConnected ? '#22C55E' : '#EF4444',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: isConnected ? '#16A34A' : '#DC2626' }}>
            {isConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="grid-2">
        {/* Connection info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Connection</span>
            <Wifi size={14} color="#999" />
          </div>
          <InfoRow label="Status" value={device?.status?.toUpperCase()} />
          <InfoRow label="Data Source" value={device?.data_source?.toUpperCase()} />
          <InfoRow label="IP Address" value={device?.ip_address} mono />
          <InfoRow label="Wi-Fi RSSI" value={device?.wifi_rssi != null ? `${device.wifi_rssi} dBm` : '—'} mono />
          <InfoRow label="Streaming" value={device?.streaming ? 'ACTIVE' : 'INACTIVE'} />
        </div>

        {/* Telemetry */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Telemetry</span>
            <Clock size={14} color="#999" />
          </div>
          <InfoRow label="Device ID" value={device?.device_id} mono />
          <InfoRow label="Uptime" value={uptime} mono />
          <InfoRow label="Sample Count" value={device?.sample_count?.toLocaleString()} mono />
          <InfoRow label="Update Rate" value={device?.update_rate_hz != null ? `${device.update_rate_hz} Hz` : '—'} />
          <InfoRow label="Last Measurement" value={device?.last_measurement_time
            ? new Date(device.last_measurement_time).toLocaleTimeString([], { hour12: false }) : '—'} mono />
        </div>

        {/* Hardware */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Hardware</span>
            <Database size={14} color="#999" />
          </div>
          <InfoRow label="Detector" value="AD8317" />
          <InfoRow label="LNA Status" value={device?.lna_enabled ? 'ENABLED' : device?.lna_enabled === false ? 'DISABLED' : '—'} />
          <InfoRow label="ADC Resolution" value="12-bit (4096 steps)" />
          <InfoRow label="Frequency" value="Broadband (AD8317 has no freq resolution)" />
          <InfoRow label="Slope" value="~25 mV/dB" mono />
        </div>

        {/* ESP32 config */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">ESP32 Config</span>
          </div>
          <InfoRow label="Host" value={device?.esp32_host || '—'} mono />
          <InfoRow label="Port" value={device?.esp32_port || '—'} mono />
          <InfoRow label="Timeout" value={device?.timeout_s != null ? `${device.timeout_s}s` : '—'} />
          <InfoRow label="Sim Interval" value={device?.sim_interval_s != null ? `${device.sim_interval_s}s` : '—'} />
          <InfoRow label="Firmware" value={device?.firmware_version || '—'} mono />
        </div>
      </div>
    </div>
  );
}
