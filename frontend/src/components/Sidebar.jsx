// components/Sidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Activity, BarChart2, Map, Zap,
  Brain, Clock, Cpu, Sliders, Radio
} from 'lucide-react';

const NAV = [
  {
    section: 'Monitor',
    items: [
      { path: '/', label: 'Overview', icon: Activity },
      { path: '/analytics', label: 'RF Analytics', icon: BarChart2 },
      { path: '/coverage', label: 'Coverage Map', icon: Map },
      { path: '/events', label: 'RF Events', icon: Zap },
    ],
  },
  {
    section: 'Analysis',
    items: [
      { path: '/ai', label: 'AI Analysis', icon: Brain },
      { path: '/history', label: 'History', icon: Clock },
    ],
  },
  {
    section: 'System',
    items: [
      { path: '/device', label: 'Device', icon: Cpu },
      { path: '/calibration', label: 'Calibration', icon: Sliders },
    ],
  },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <aside className={`app-sidebar${mobileOpen ? ' open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={18} color="#B7FF3C" style={{ flexShrink: 0 }} />
            <div className="sidebar-logo-title">RF Monitor</div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="sidebar-mobile-close"
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          )}
        </div>
        <div className="sidebar-logo-sub">Using ESP32 & ADC</div>
      </div>

      {/* Navigation */}
      {NAV.map(({ section, items }) => (
        <div key={section} className="sidebar-section">
          <div className="sidebar-section-label">{section}</div>
          {items.map(({ path, label, icon: Icon }) => {
            const active = pathname === path;
            return (
              <button
                key={path}
                className={`sidebar-nav-item${active ? ' active' : ''}`}
                onClick={() => go(path)}
                id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="nav-icon" size={16} style={{ flexShrink: 0 }} />
                <span className="sidebar-nav-text">{label}</span>
              </button>
            );
          })}
        </div>
      ))}

      {/* Bottom spacer */}
      <div style={{ flex: 1 }} />
    </aside>
  );
}
