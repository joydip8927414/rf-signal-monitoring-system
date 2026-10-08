/**
 * realtime.js — Polling-based real-time data service
 * Architecture is ready for WebSocket/SSE upgrade in the future.
 */

const subscriptions = new Map();
let idCounter = 0;

/**
 * Poll a function at a given interval, calling subscribers with the result.
 * Returns an unsubscribe function.
 */
export function createPoller(fetchFn, intervalMs = 1000) {
  const listeners = new Map();
  let timer = null;
  let running = false;

  async function tick() {
    try {
      const data = await fetchFn();
      listeners.forEach((cb) => cb({ data, error: null }));
    } catch (err) {
      listeners.forEach((cb) => cb({ data: null, error: err }));
    }
  }

  function start() {
    if (running) return;
    running = true;
    tick(); // immediate first call
    timer = setInterval(tick, intervalMs);
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  function subscribe(cb) {
    const id = ++idCounter;
    listeners.set(id, cb);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(id);
      if (listeners.size === 0) stop();
    };
  }

  return { subscribe, stop };
}

export default { createPoller };
