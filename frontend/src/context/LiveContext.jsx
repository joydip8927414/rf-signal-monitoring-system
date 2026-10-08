// context/LiveContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const LiveContext = createContext({
  isPaused: false,
  togglePause: () => {},
  setIsPaused: () => {},
  intervalMs: 1000,
  setIntervalMs: () => {},
  lastUpdate: null,
  setLastUpdate: () => {},
});

export function LiveProvider({ children }) {
  const [isPaused, setIsPaused] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000); // Default 1000ms (1 second)
  const [lastUpdate, setLastUpdate] = useState(null);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  return (
    <LiveContext.Provider
      value={{
        isPaused,
        setIsPaused,
        togglePause,
        intervalMs,
        setIntervalMs,
        lastUpdate,
        setLastUpdate,
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export const useLive = () => useContext(LiveContext);
