// App.jsx — RF Monitor React Application
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Overview    from './pages/Overview';
import Analytics   from './pages/Analytics';
import Coverage    from './pages/Coverage';
import Events      from './pages/Events';
import AIAnalysis  from './pages/AIAnalysis';
import History     from './pages/History';
import Device      from './pages/Device';
import Calibration from './pages/Calibration';

import { LiveProvider } from './context/LiveContext';

export default function App() {
  return (
    <ErrorBoundary>
      <LiveProvider>
        <BrowserRouter>
          <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/"            element={<Overview />} />
              <Route path="/analytics"   element={<Analytics />} />
              <Route path="/coverage"    element={<Coverage />} />
              <Route path="/events"      element={<Events />} />
              <Route path="/ai"          element={<AIAnalysis />} />
              <Route path="/history"     element={<History />} />
              <Route path="/device"      element={<Device />} />
              <Route path="/calibration" element={<Calibration />} />
              {/* Fallback */}
              <Route path="*"            element={<Overview />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </LiveProvider>
  </ErrorBoundary>
);
}
