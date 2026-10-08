// components/Layout.jsx
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import RFCopilot from './RFCopilot';

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="app-main">
        <Header
          onMenuToggle={() => setMobileOpen((o) => !o)}
        />
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Floating Copilot */}
      <RFCopilot />
    </div>
  );
}
