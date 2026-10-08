/**
 * useRFData.js — Custom hooks for live RF measurement polling
 * Supports Pause / Resume, 1-second update interval, and in-flight request locks.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getLatestMeasurement, getDeviceStatus, getCoverageMeasurements } from '../services/api';

const DEFAULT_POLL_MS = 1000; // 1-second default interval
const POLL_DEVICE_MS = 4000;

export function useLatestMeasurement(isPaused = false, intervalMs = DEFAULT_POLL_MS) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetch = useCallback(async () => {
    if (isFetchingRef.current) return; // Prevent overlapping requests
    isFetchingRef.current = true;
    try {
      const d = await getLatestMeasurement();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
      // Retain last valid data on transient error
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Initial fetch immediately on resume/mount
    fetch();

    const activeInterval = Math.max(200, Number(intervalMs) || DEFAULT_POLL_MS);
    timerRef.current = setInterval(fetch, activeInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetch, isPaused, intervalMs]);

  return { data, error, loading, refetch: fetch };
}

export function useDeviceStatus() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const d = await getDeviceStatus();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, POLL_DEVICE_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetch]);

  return { data, error };
}

export function usePolled(fetchFn, intervalMs = DEFAULT_POLL_MS, deps = [], isPaused = false) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const d = await fetchFn();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    doFetch();
    const activeInterval = Math.max(200, Number(intervalMs) || DEFAULT_POLL_MS);
    timerRef.current = setInterval(doFetch, activeInterval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [doFetch, intervalMs, isPaused]);

  return { data, error, loading, refetch: doFetch };
}

export function useCoverageData() {
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFetchingRef = useRef(false);

  const fetchCoverage = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const d = await getCoverageMeasurements();
      setCoverage(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
    const timer = setInterval(fetchCoverage, 10000);
    return () => clearInterval(timer);
  }, [fetchCoverage]);

  return { coverage, loading, error, refetch: fetchCoverage };
}
