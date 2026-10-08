// pages/Coverage.jsx
import CoverageMap from '../components/CoverageMap';

export default function Coverage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Coverage Map</h1>
        <p className="page-subtitle">Geographic RF signal strength visualization</p>
      </div>
      <CoverageMap />
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">About Coverage Mapping</span>
        </div>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>
          Coverage mapping requires GPS-tagged measurements. Each data point needs latitude, longitude,
          and altitude coordinates recorded alongside the RF measurement. The AD8317 power detector
          measures broadband signal strength at each location, which is then plotted on the map.
        </p>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginTop: 10 }}>
          To enable coverage mapping, the backend must provide location-stamped measurement records.
          No GPS coordinates are ever fabricated or estimated.
        </p>
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 8,
          background: '#F5F5F0', border: '1px solid #E3E3DD', fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace', color: '#666'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Required backend fields:</div>
          <div>measurement.latitude — float (decimal degrees)</div>
          <div>measurement.longitude — float (decimal degrees)</div>
          <div>measurement.altitude_m — float (optional)</div>
        </div>
      </div>
    </div>
  );
}
