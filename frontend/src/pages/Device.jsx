// pages/Device.jsx
import { useState, useEffect } from 'react';
import { useDeviceStatus } from '../hooks/useRFData';
import { getSimulatorConfig, updateSimulatorConfig, applySimulatorScenario } from '../services/api';
import { Cpu, Wifi, Clock, Database, Radio, Sliders, Play, RotateCcw } from 'lucide-react';

const fmt = (v) => (v !== null && v !== undefined ? String(v) : '—');

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
  const { data: device, error, refetch: refetchDevice } = useDeviceStatus();

  // Simulation test mode state
  const [simConfig, setSimConfig] = useState(null);
  const [loadingSim, setLoadingSim] = useState(false);
  const [simMsg, setSimMsg] = useState(null);

  // Form controls
  const [distanceM, setDistanceM] = useState(1.0);
  const [wallAttenDb, setWallAttenDb] = useState(0.0);
  const [numWalls, setNumWalls] = useState(0);
  const [noiseFloorDbm, setNoiseFloorDbm] = useState(-95.0);
  const [interfDbm, setInterfDbm] = useState(-120.0);
  const [signalStdDb, setSignalStdDb] = useState(1.0);

  const isConnected = device?.status === 'connected' || device?.connected === true;
  const isSimulation = (device?.data_source || '').toLowerCase() === 'simulated' || (device?.data_source || '').toLowerCase() === 'simulator';
  const uptime = device?.uptime_s != null
    ? `${Math.floor(device.uptime_s / 3600)}h ${Math.floor((device.uptime_s % 3600) / 60)}m ${Math.floor(device.uptime_s % 60)}s`
    : '—';

  // Load simulator config if simulator is active
  const loadSimConfig = async () => {
    try {
      const cfg = await getSimulatorConfig();
      setSimConfig(cfg);
      if (cfg) {
        setDistanceM(cfg.distance_m ?? 1.0);
        setWallAttenDb(cfg.wall_attenuation_db ?? 0.0);
        setNumWalls(cfg.num_walls ?? 0);
        setNoiseFloorDbm(cfg.noise_floor_dbm ?? -95.0);
        setInterfDbm(cfg.interference_level_dbm ?? -120.0);
        setSignalStdDb(cfg.signal_variation_std_db ?? 1.0);
      }
    } catch {
      // Backend may be in pure real-hardware mode
    }
  };

  useEffect(() => {
    if (isSimulation) {
      loadSimConfig();
    }
  }, [isSimulation]);

  const handleApplyScenario = async (scKey) => {
    setLoadingSim(true);
    setSimMsg(null);
    try {
      const res = await applySimulatorScenario(scKey);
      setSimMsg({ ok: true, text: `Scenario applied: ${res?.message || scKey}` });
      await loadSimConfig();
      refetchDevice();
    } catch (e) {
      setSimMsg({ ok: false, text: e.message });
    } finally {
      setLoadingSim(false);
    }
  };

  const handleUpdateCustomConfig = async (e) => {
    e.preventDefault();
    setLoadingSim(true);
    setSimMsg(null);
    try {
      await updateSimulatorConfig({
        distance_m: parseFloat(distanceM),
        wall_attenuation_db: parseFloat(wallAttenDb),
        num_walls: parseInt(numWalls, 10),
        noise_floor_dbm: parseFloat(noiseFloorDbm),
        interference_level_dbm: parseFloat(interfDbm),
        signal_variation_std_db: parseFloat(signalStdDb),
      });
      setSimMsg({ ok: true, text: 'Custom simulation parameters updated successfully.' });
      await loadSimConfig();
      refetchDevice();
    } catch (e) {
      setSimMsg({ ok: false, text: e.message });
    } finally {
      setLoadingSim(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cpu size={22} color="#5A7A00" />
          <div>
            <h1 className="page-title">Device & Simulation</h1>
            <p className="page-subtitle">Hardware telemetry and physics-based scenario testing</p>
          </div>
        </div>
      </div>

      {error && <div className="state-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Device header card */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
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
            <span style={{
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              marginRight: 6,
              background: isSimulation ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: isSimulation ? '#CA8A04' : '#16A34A',
              border: `1px solid ${isSimulation ? 'rgba(234, 179, 8, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
            }}>
              {isSimulation ? 'SYNTHETIC / SIMULATION' : 'REAL PHYSICAL HARDWARE'}
            </span>
            · AD8317 RF Power Detector
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isConnected ? '#22C55E' : '#EF4444',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: isConnected ? '#16A34A' : '#DC2626' }}>
            {isConnected ? 'ONLINE / CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Controlled Physics Simulation Testbench (Active in Simulator Mode) */}
      {isSimulation && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #E3E3DD', background: '#FAFAF7' }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={16} color="#5A7A00" />
              <span className="card-title" style={{ fontSize: 12, color: '#111' }}>
                Controlled Physics Simulation Test Mode
              </span>
            </div>
            <span className="card-badge" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' }}>
              SCENARIO TESTING BENCH
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            Run controlled external-factor scenarios to verify path loss, obstacle penetration, interference, and outage recovery before hardware deployment.
          </p>

          {simMsg && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: 12,
              background: simMsg.ok ? '#F0FDF4' : '#FEF2F2',
              color: simMsg.ok ? '#15803D' : '#B91C1C',
              border: `1px solid ${simMsg.ok ? '#BBF7D0' : '#FECACA'}`,
            }}>
              {simMsg.text}
            </div>
          )}

          {/* Preset Scenario Buttons */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase' }}>
              Repeatable Scenarios:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'baseline', label: '1. Baseline (1m Line-of-Sight)' },
                { id: 'increased_distance', label: '2. Increased Distance (15m Path Loss)' },
                { id: 'obstacle_introduced', label: '3. Obstacle (2x Concrete Walls)' },
                { id: 'increased_interference', label: '4. High Interference / Jamming' },
                { id: 'device_outage', label: '5. Temporary Device Outage' },
                { id: 'recovery', label: '6. Outage Recovery' },
              ].map((sc) => {
                const active = simConfig?.active_scenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleApplyScenario(sc.id)}
                    disabled={loadingSim}
                    className="btn btn-sm"
                    style={{
                      background: active ? '#171717' : '#FFFFFF',
                      color: active ? '#B7FF3C' : '#333',
                      border: `1px solid ${active ? '#171717' : '#D1D5DB'}`,
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <Play size={11} fill={active ? '#B7FF3C' : 'none'} />
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Parameter Adjustment Form */}
          <form onSubmit={handleUpdateCustomConfig} style={{ borderTop: '1px solid #E5E5DF', paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 10, textTransform: 'uppercase' }}>
              Fine-Tune Physical Parameters:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label">Distance (m)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={distanceM}
                  onChange={(e) => setDistanceM(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Wall Attenuation (dB/wall)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={wallAttenDb}
                  onChange={(e) => setWallAttenDb(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Number of Walls</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={numWalls}
                  onChange={(e) => setNumWalls(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Noise Floor (dBm)</label>
                <input
                  type="number"
                  step="1"
                  value={noiseFloorDbm}
                  onChange={(e) => setNoiseFloorDbm(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Interference Level (dBm)</label>
                <input
                  type="number"
                  step="1"
                  value={interfDbm}
                  onChange={(e) => setInterfDbm(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Signal Variation Std (dB)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={signalStdDb}
                  onChange={(e) => setSignalStdDb(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={loadingSim} className="btn btn-primary btn-sm">
                Apply Custom Parameters
              </button>
              <button
                type="button"
                onClick={() => handleApplyScenario('baseline')}
                disabled={loadingSim}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw size={12} /> Reset to Baseline
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid-2">
        {/* Connection info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Connection</span>
            <Wifi size={14} color="#999" />
          </div>
          <InfoRow label="Status" value={device?.status?.toUpperCase()} />
          <InfoRow label="Data Source" value={device?.data_source?.toUpperCase()} />
          <InfoRow label="Active Scenario" value={simConfig?.active_scenario?.toUpperCase() || (isSimulation ? 'BASELINE' : 'N/A')} />
          <InfoRow label="IP Address" value={device?.ip_address} mono />
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
          <InfoRow label="Firmware / Version" value={device?.firmware_version || '—'} mono />
        </div>

        {/* Hardware & Calibration Assumptions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Detector Calibration Assumptions</span>
            <Database size={14} color="#999" />
          </div>
          <InfoRow label="Detector Model" value="AD8317 / AD8318" />
          <InfoRow label="Detector Slope" value="-25 mV/dB (-0.025 V/dB)" mono />
          <InfoRow label="Detector Intercept" value="-60.0 dBm @ 0.50 V" mono />
          <InfoRow label="ADC Full Scale" value="12-bit (3.3V / 4095 steps)" mono />
          <InfoRow label="LNA State" value={device?.lna_enabled ? 'ENABLED' : 'DISABLED'} />
        </div>

        {/* Physics Propagation Model */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Physics Model Equations</span>
          </div>
          <InfoRow label="Path Loss Formula" value="PL = 10 * n * log10(d / d0)" mono />
          <InfoRow label="Wall Loss Formula" value="Loss = N_walls * Atten_wall" mono />
          <InfoRow label="Noise Combining" value="P_eff = 10*log10(10^(N/10) + 10^(I/10))" mono />
          <InfoRow label="ADC Quantization" value="ADC = floor(V_det / 3.3 * 4095)" mono />
        </div>
      </div>
    </div>
  );
}
