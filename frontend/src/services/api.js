/**
 * api.js — Centralized RF Monitor API Service
 *
 * All requests to the Flask backend go through this module.
 * Base URL uses Vite's dev proxy (/api → http://127.0.0.1:5000/api).
 */

import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE || '';

const client = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err?.response?.data?.error || err?.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

export const getHealth = () => client.get('/api/health');
export const getDeviceStatus = () => client.get('/api/device/status');
export const getLatestMeasurement = () => client.get('/api/measurements/latest');
export const getMeasurementHistory = (minutes = 5, limit = 2000) =>
  client.get('/api/measurements/history', { params: { minutes, limit } });
export const getAnalyticsSummary = (minutes = 60) =>
  client.get('/api/analytics/summary', { params: { minutes } });
export const getAnalyticsTimeseries = (minutes = 60, points = 300) =>
  client.get('/api/analytics/timeseries', { params: { minutes, points } });
export const getAnalyticsDistribution = (minutes = 60) =>
  client.get('/api/analytics/distribution', { params: { minutes } });
export const getAnalyticsCompare = (minutes = 5) =>
  client.get('/api/analytics/compare', { params: { minutes } });
export const getEvents = (limit = 200) =>
  client.get('/api/events', { params: { limit } });
export const getAIStatus = () => client.get('/api/ai/status');
export const getAIPredictions = (limit = 100) =>
  client.get('/api/ai/predictions', { params: { limit } });
export const trainAIModel = (mode = 'online', minutes = 60) =>
  client.post('/api/ai/train', { mode, minutes });
export const postAutoTrainConfig = (config) =>
  client.post('/api/ai/autotrain', config);
export const sendCopilotMessage = (message) =>
  client.post('/api/copilot/chat', { message });
export const getCalibration = () => client.get('/api/calibration');
export const postCalibration = (reference_dbm, measured_dbm, notes = '') =>
  client.post('/api/calibration', { reference_dbm, measured_dbm, notes });
export const exportDataUrl = (format = 'json', minutes = 60) =>
  `${BASE}/api/export?format=${format}&minutes=${minutes}`;
export const getSettings = () => client.get('/api/settings');
export const getSimulatorConfig = () => client.get('/api/simulator/config');
export const updateSimulatorConfig = (config) => client.post('/api/simulator/config', config);
export const applySimulatorScenario = (scenario) => client.post('/api/simulator/scenario', { scenario });
export const getCoverageMeasurements = async () => {
  try {
    return await client.get('/api/coverage');
  } catch (e) {
    // When Flask backend has no /api/coverage endpoint yet, return structured API-ready demo response
    return {
      status: 'demo_location',
      has_gps: false,
      data_source: 'demo',
      device_location: {
        latitude: 26.293498,
        longitude: 89.459139,
        name: 'RF Monitor Device — Cooch Behar Government Engineering College',
        badge: 'DEMO LOCATION (CGEC)',
      },
      measurements: [],
    };
  }
};

export default {
  getHealth, getDeviceStatus, getLatestMeasurement, getMeasurementHistory,
  getAnalyticsSummary, getAnalyticsTimeseries, getAnalyticsDistribution,
  getAnalyticsCompare, getEvents, getAIStatus, getAIPredictions, trainAIModel,
  sendCopilotMessage, getCalibration, postCalibration, exportDataUrl, getSettings,
  getSimulatorConfig, updateSimulatorConfig, applySimulatorScenario,
  getCoverageMeasurements,
};
