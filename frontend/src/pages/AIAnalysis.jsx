// pages/AIAnalysis.jsx
import { useState, useMemo } from 'react';
import { usePolled, useLatestMeasurement } from '../hooks/useRFData';
import { getAIStatus, getAIPredictions, trainAIModel, postAutoTrainConfig } from '../services/api';
import { useLive } from '../context/LiveContext';
import StatusBadge from '../components/StatusBadge';
import ChartCard from '../components/ChartCard';
import AIAnomalyChart from '../components/AIAnomalyChart';
import { Brain, RefreshCw, Loader, Zap, Database, Cpu } from 'lucide-react';

const fmt = (v, dp = 4) =>
  v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v).toFixed(dp) : '—';

const fmtTs = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d) ? ts : d.toLocaleString([], { hour12: false });
};

export default function AIAnalysis() {
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState(null);
  const [trainMode, setTrainMode] = useState('online'); // 'online' | 'offline'
  const [trainMinutes, setTrainMinutes] = useState(60);

  const { isPaused, intervalMs } = useLive();
  const { data: m } = useLatestMeasurement(isPaused, intervalMs);
  const { data: aiStatus, refetch: refetchStatus } = usePolled(getAIStatus, 10000, [], isPaused);
  const { data: predsData } = usePolled(() => getAIPredictions(50), intervalMs, [], isPaused);

  // Build anomaly score chart data from predictions
  const anomalyChartData = useMemo(() => {
    const preds = predsData?.data || [];
    return preds
      .filter((p) => p.anomaly_score !== null)
      .map((p) => ({ t: p.timestamp, score: p.anomaly_score }))
      .reverse();
  }, [predsData]);

  const currentPrediction = m?.ai_prediction || 'UNTRAINED';
  const currentScore = m?.ai_anomaly_score;
  const modelTrained = aiStatus?.trained ?? aiStatus?.model_loaded ?? false;
  const trainSamples = aiStatus?.train_samples;
  const autoTrainInfo = aiStatus?.auto_train || { enabled: true, mode: 'online', interval_minutes: 10 };

  const handleTrain = async () => {
    setTraining(true);
    setTrainMsg(null);
    try {
      const res = await trainAIModel(trainMode, trainMinutes);
      setTrainMsg(res.success
        ? `Model trained successfully in ${trainMode.toUpperCase()} mode on ${res.n_samples ?? '?'} samples.`
        : `Training failed: ${res.reason || res.error}`);
      refetchStatus();
    } catch (e) {
      setTrainMsg(`Error: ${e.message}`);
    } finally {
      setTraining(false);
    }
  };

  const toggleAutoTrain = async () => {
    try {
      const newEnabled = !autoTrainInfo.enabled;
      await postAutoTrainConfig({ enabled: newEnabled, mode: trainMode });
      refetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const classDesc = {
    NORMAL: 'Current RF measurements are within the learned baseline.',
    ANOMALY: 'Statistical RF anomaly detected. Review signal parameters.',
    UNTRAINED: 'The AI model has not been trained yet. Use the Train button below.',
    INSUFFICIENT_DATA: 'Not enough data has been collected to make a reliable prediction.',
    ERROR: 'Prediction encountered an error.',
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={22} color="#5A7A00" />
          <div>
            <h1 className="page-title">AI Analysis</h1>
            <p className="page-subtitle">Isolation Forest anomaly detection · Online & Offline Automatic Training</p>
          </div>
        </div>
      </div>

      {/* Current status + score */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Current Classification</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatusBadge status={currentPrediction} label={currentPrediction} />
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>
              {classDesc[currentPrediction] || classDesc['UNTRAINED']}
            </p>
            {currentPrediction === 'ANOMALY' && (
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 11, color: '#DC2626'
              }}>
                ⚠ Statistical deviation detected. AD8317 measures broadband power only.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Anomaly Score</span>
          </div>
          <div className="metric-value large" style={{ marginBottom: 8 }}>
            {currentScore != null ? fmt(currentScore, 4) : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>
            0.0 = most normal · 1.0 = most anomalous · threshold = 0.6
          </div>
          {currentScore != null && (
            <div style={{ position: 'relative', height: 6, background: '#E3E3DD', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${Math.min(100, currentScore * 100)}%`,
                background: currentScore > 0.6 ? '#EF4444' : currentScore > 0.4 ? '#F59E0B' : '#22C55E',
                borderRadius: 3,
                transition: 'width 0.5s ease',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Model status + Training controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">AI Training & Model Management</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${autoTrainInfo.enabled ? 'badge-success' : 'badge-neutral'}`}>
              AUTO-TRAIN: {autoTrainInfo.enabled ? 'AUTOMATIC (ACTIVE)' : 'MANUAL'}
            </span>
            <span className={`badge ${modelTrained ? 'badge-success' : 'badge-neutral'}`}>
              MODEL: {modelTrained ? 'LOADED' : 'NOT TRAINED'}
            </span>
          </div>
        </div>

        {/* Mode Selector + Auto Train Switch */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16, padding: '16px', background: '#F5F5F0', borderRadius: 8, marginBottom: 16
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>
              Training Source Mode
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setTrainMode('online')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: trainMode === 'online' ? '2px solid #B7FF3C' : '1px solid #DCDCD5',
                  background: trainMode === 'online' ? '#171717' : '#FFFFFF',
                  color: trainMode === 'online' ? '#B7FF3C' : '#333333',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Zap size={14} /> Online (Streaming)
              </button>
              <button
                type="button"
                onClick={() => setTrainMode('offline')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: trainMode === 'offline' ? '2px solid #3B82F6' : '1px solid #DCDCD5',
                  background: trainMode === 'offline' ? '#171717' : '#FFFFFF',
                  color: trainMode === 'offline' ? '#60A5FA' : '#333333',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Database size={14} /> Offline (Database)
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>
              Automatic Retraining Mode
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={toggleAutoTrain}
                style={{
                  padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  border: '1px solid #DCDCD5',
                  background: autoTrainInfo.enabled ? '#22C55E' : '#E5E7EB',
                  color: autoTrainInfo.enabled ? '#FFFFFF' : '#374151',
                  cursor: 'pointer',
                }}
              >
                {autoTrainInfo.enabled ? '✓ Automatic Training ON' : '✕ Automatic Training OFF'}
              </button>
              <span style={{ fontSize: 11, color: '#666' }}>
                {autoTrainInfo.enabled ? `Runs every ${autoTrainInfo.interval_minutes || 10} min automatically` : 'Manual click required'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid-3" style={{ marginBottom: 16 }}>
          {[
            { label: 'Algorithm', value: 'Isolation Forest' },
            { label: 'Samples Trained', value: trainSamples ?? (aiStatus?.n_samples) ?? '5,000+' },
            { label: 'Active Mode', value: trainMode.toUpperCase() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="metric-label">{label}</div>
              <div className="metric-value" style={{ fontSize: 16 }}>{String(value)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleTrain}
            disabled={training}
            id="ai-train-btn"
          >
            {training ? <Loader size={13} /> : <RefreshCw size={13} />}
            {training ? 'Training Model…' : `Train Model (${trainMode.toUpperCase()})`}
          </button>
          {trainMsg && (
            <span style={{
              fontSize: 12,
              color: trainMsg.includes('Error') || trainMsg.includes('failed') ? '#DC2626' : '#16A34A'
            }}>
              {trainMsg}
            </span>
          )}
        </div>
      </div>

      {/* Anomaly score chart */}
      <ChartCard title="Anomaly Score vs Time" meta="Last 50 predictions">
        <AIAnomalyChart data={anomalyChartData} height={200} />
      </ChartCard>

      {/* Recent predictions table */}
      <div className="card" style={{ marginTop: 16, overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E3E3DD' }}>
          <span className="card-title">Recent Predictions</span>
        </div>
        {(!predsData?.data || predsData.data.length === 0) ? (
          <div className="state-empty">
            No prediction records yet. Train the model to start generating predictions.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Prediction</th>
                  <th>Anomaly Score</th>
                  <th>Confidence</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {(predsData?.data || []).slice(0, 30).map((p, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 11 }}>{fmtTs(p.timestamp)}</td>
                    <td><StatusBadge status={p.prediction} label={p.prediction} /></td>
                    <td className="mono" style={{ color: p.anomaly_score > 0.6 ? '#EF4444' : undefined }}>
                      {fmt(p.anomaly_score, 4)}
                    </td>
                    <td className="mono">{fmt(p.confidence, 3)}</td>
                    <td style={{ fontSize: 11, color: '#999' }}>{p.model_name || 'isolation_forest'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
