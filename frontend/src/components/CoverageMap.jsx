// components/CoverageMap.jsx
import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Signal, Wifi, Radio, AlertCircle } from 'lucide-react';
import { useLatestMeasurement, useDeviceStatus, useCoverageData } from '../hooks/useRFData';

// Fix standard Leaflet default marker icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Create custom device location marker
const createDeviceIcon = () => {
  return L.divIcon({
    className: 'custom-device-icon',
    html: `
      <div style="
        width: 32px; height: 32px;
        background: #171717;
        border: 2.5px solid #B7FF3C;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 14px rgba(183, 255, 60, 0.7);
        cursor: pointer;
      ">
        <div style="width: 10px; height: 10px; background: #B7FF3C; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Signal strength classification helper
const getSignalCategory = (dbm) => {
  if (dbm === null || dbm === undefined || isNaN(dbm)) {
    return { label: 'Unknown', color: '#999999', key: 'unknown' };
  }
  if (dbm >= -50) return { label: 'Very Strong', color: '#22C55E', key: 'very_strong' };
  if (dbm >= -60) return { label: 'Strong', color: '#10B981', key: 'strong' };
  if (dbm >= -70) return { label: 'Moderate', color: '#3B82F6', key: 'moderate' };
  if (dbm >= -85) return { label: 'Weak', color: '#F59E0B', key: 'weak' };
  return { label: 'Very Weak', color: '#EF4444', key: 'very_weak' };
};

// Create custom measurement point marker
const createMeasurementIcon = (dbm) => {
  const { color } = getSignalCategory(dbm);
  return L.divIcon({
    className: 'custom-meas-icon',
    html: `
      <div style="
        width: 16px; height: 16px;
        background: ${color};
        border: 2px solid #FFFFFF;
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
};

// Auto-recenter map view component
function MapRecenter({ center }) {
  const map = useMap();
  map.setView(center);
  return null;
}

export default function CoverageMap() {
  const { data: latest } = useLatestMeasurement();
  const { data: device } = useDeviceStatus();
  const { coverage } = useCoverageData();

  // Reference/Demo coordinates for development — Cooch Behar Government Engineering College
  const demoLocation = useMemo(() => ({
    lat: 26.293498,
    lng: 89.459139,
    name: 'RF Monitor Device — Cooch Behar Government Engineering College',
    badge: 'DEMO LOCATION (CGEC)',
  }), []);

  const measurements = coverage?.measurements || [];
  const hasGpsData = coverage?.has_gps || false;
  const isDemo = !hasGpsData;
  const dataSource = isDemo ? 'Demo' : (device?.data_source || 'Hardware');

  const signalVal = latest?.signal_dbm !== undefined && latest?.signal_dbm !== null ? `${latest.signal_dbm.toFixed(1)} dBm` : '--';
  const snrVal = latest?.snr_db !== undefined && latest?.snr_db !== null ? `${latest.snr_db.toFixed(1)} dB` : '--';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Map Status Panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {/* Coverage Status */}
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} color="#666" /> Coverage Status
          </div>
          <div className="metric-value" style={{ fontSize: 15, fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isDemo ? 'Waiting for Data' : 'Active'}
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              background: isDemo ? '#FFFBEB' : '#ECFDF5',
              color: isDemo ? '#D97706' : '#059669',
              border: `1px solid ${isDemo ? '#FDE68A' : '#A7F3D0'}`,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {isDemo ? 'DEMO LOCATION' : 'REAL GPS'}
            </span>
          </div>
        </div>

        {/* Data Source */}
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={14} color="#666" /> Data Source
          </div>
          <div className="metric-value" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            {dataSource}
          </div>
        </div>

        {/* Measurement Points */}
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Navigation size={14} color="#666" /> Measurement Points
          </div>
          <div className="metric-value" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {measurements.length}
          </div>
        </div>

        {/* Latest Signal */}
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Signal size={14} color="#666" /> Latest Signal
          </div>
          <div className="metric-value" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#B7FF3C', fontFamily: 'JetBrains Mono, monospace' }}>
            {signalVal}
          </div>
        </div>

        {/* Latest SNR */}
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wifi size={14} color="#666" /> Latest SNR
          </div>
          <div className="metric-value" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#3B82F6', fontFamily: 'JetBrains Mono, monospace' }}>
            {snrVal}
          </div>
        </div>

        {/* GPS Status */}
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} color="#666" /> GPS Status
          </div>
          <div className="metric-value" style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: '#666' }}>
            {hasGpsData ? 'Connected' : 'Not Connected'}
          </div>
        </div>
      </div>

      {/* Main Map Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E3E3DD',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
        }}>
          <div>
            <div className="card-title" style={{ fontSize: 15, fontWeight: 700 }}>RF Coverage Map</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
              OpenStreetMap RF signal telemetry mapping
            </div>
          </div>
          {isDemo && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 6,
              background: '#171717',
              color: '#B7FF3C',
              border: '1px solid #B7FF3C',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              DEMO LOCATION
            </span>
          )}
        </div>

        {/* Leaflet Map Container */}
        <div style={{ height: 480, width: '100%', position: 'relative' }}>
          <MapContainer
            center={[demoLocation.lat, demoLocation.lng]}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Recenter Map when location updates */}
            <MapRecenter center={[demoLocation.lat, demoLocation.lng]} />

            {/* Device Marker */}
            <Marker
              position={[demoLocation.lat, demoLocation.lng]}
              icon={createDeviceIcon()}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', padding: '4px 2px', minWidth: 200 }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#D97706',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    padding: '2px 6px',
                    borderRadius: 4,
                    display: 'inline-block',
                    marginBottom: 6,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {demoLocation.badge}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                    {demoLocation.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                    Lat: {demoLocation.lat.toFixed(5)} | Lng: {demoLocation.lng.toFixed(5)}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', borderTop: '1px solid #EEE', paddingTop: 6 }}>
                    Reference coordinate for development.
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Real Measurement Points (if any exist) */}
            {measurements.map((pt, idx) => {
              if (!pt.latitude || !pt.longitude) return null;
              const cat = getSignalCategory(pt.signal_dbm);
              return (
                <Marker
                  key={idx}
                  position={[pt.latitude, pt.longitude]}
                  icon={createMeasurementIcon(pt.signal_dbm)}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', padding: 4, fontSize: 12, lineHeight: 1.6 }}>
                      <div style={{ fontWeight: 700, color: cat.color, fontSize: 13, marginBottom: 4 }}>
                        {cat.label} ({pt.signal_dbm?.toFixed(1)} dBm)
                      </div>
                      <div>Noise Floor: <strong>{pt.noise_dbm !== undefined ? `${pt.noise_dbm.toFixed(1)} dBm` : '--'}</strong></div>
                      <div>SNR: <strong>{pt.snr_db !== undefined ? `${pt.snr_db.toFixed(1)} dB` : '--'}</strong></div>
                      <div>Timestamp: <span style={{ fontFamily: 'JetBrains Mono' }}>{pt.timestamp || '--'}</span></div>
                      <div>Source: <span>{pt.data_source || 'simulated'}</span></div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                        {pt.latitude?.toFixed(5)}, {pt.longitude?.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map Legend Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #E3E3DD',
            borderRadius: 8,
            padding: '10px 14px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#111', marginBottom: 8, letterSpacing: '0.05em' }}>
              RF SIGNAL STRENGTH
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: '#444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }}></span>
                <span>&ge; -50 dBm</span>
                <span style={{ color: '#888', marginLeft: 'auto', fontSize: 10 }}>Very Strong</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></span>
                <span>-50 to -60 dBm</span>
                <span style={{ color: '#888', marginLeft: 'auto', fontSize: 10 }}>Strong</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }}></span>
                <span>-60 to -70 dBm</span>
                <span style={{ color: '#888', marginLeft: 'auto', fontSize: 10 }}>Moderate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }}></span>
                <span>-70 to -85 dBm</span>
                <span style={{ color: '#888', marginLeft: 'auto', fontSize: 10 }}>Weak</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }}></span>
                <span>&lt; -85 dBm</span>
                <span style={{ color: '#888', marginLeft: 'auto', fontSize: 10 }}>Very Weak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Data Empty / Warning Notice */}
        {measurements.length === 0 && (
          <div style={{
            padding: '16px 20px',
            background: '#FAF9F6',
            borderTop: '1px solid #E3E3DD',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <AlertCircle size={20} color="#D97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                Coverage data unavailable
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                Connect GPS/GNSS location data and collect RF measurements to generate coverage.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
